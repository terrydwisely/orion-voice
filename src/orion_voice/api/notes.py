from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiosqlite
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/notes", tags=["notes"])

import os

_data_dir = os.environ.get("ORION_DATA_DIR")
DB_DIR = Path(_data_dir) if _data_dir else Path.home() / ".orion-voice"
DB_PATH = DB_DIR / "notes.db"

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
)
"""


async def get_db() -> aiosqlite.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute(_CREATE_TABLE)
    await db.commit()
    return db


class NoteCreate(BaseModel):
    content: str
    title: str = ""


class NoteUpdate(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None


class NoteOut(BaseModel):
    id: str
    title: str
    content: str
    created_at: str
    updated_at: str


class NoteListResponse(BaseModel):
    notes: list[NoteOut]
    total: int
    page: int
    page_size: int


@router.post("", response_model=NoteOut, status_code=201)
async def create_note(body: NoteCreate) -> NoteOut:
    note_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (note_id, body.title, body.content, now, now),
        )
        await db.commit()
        return NoteOut(id=note_id, title=body.title, content=body.content, created_at=now, updated_at=now)
    finally:
        await db.close()


@router.get("", response_model=NoteListResponse)
async def list_notes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> NoteListResponse:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT COUNT(*) FROM notes WHERE deleted = 0")
        row = await cursor.fetchone()
        total = row[0]

        offset = (page - 1) * page_size
        cursor = await db.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes "
            "WHERE deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (page_size, offset),
        )
        rows = await cursor.fetchall()
        notes = [NoteOut(id=r[0], title=r[1], content=r[2], created_at=r[3], updated_at=r[4]) for r in rows]
        return NoteListResponse(notes=notes, total=total, page=page, page_size=page_size)
    finally:
        await db.close()


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(note_id: str) -> NoteOut:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ? AND deleted = 0",
            (note_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Note not found")
        return NoteOut(id=row[0], title=row[1], content=row[2], created_at=row[3], updated_at=row[4])
    finally:
        await db.close()


@router.put("/{note_id}", response_model=NoteOut)
async def update_note(note_id: str, body: NoteUpdate) -> NoteOut:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ? AND deleted = 0",
            (note_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Note not found")

        title = body.title if body.title is not None else row[1]
        content = body.content if body.content is not None else row[2]
        now = datetime.now(timezone.utc).isoformat()

        await db.execute(
            "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?",
            (title, content, now, note_id),
        )
        await db.commit()
        return NoteOut(id=note_id, title=title, content=content, created_at=row[3], updated_at=now)
    finally:
        await db.close()


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: str) -> None:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM notes WHERE id = ? AND deleted = 0", (note_id,))
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Note not found")
        now = datetime.now(timezone.utc).isoformat()
        await db.execute("UPDATE notes SET deleted = 1, updated_at = ? WHERE id = ?", (now, note_id))
        await db.commit()
    finally:
        await db.close()
