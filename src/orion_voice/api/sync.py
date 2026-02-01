from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from orion_voice.api.notes import DB_PATH, DB_DIR, NoteOut, _CREATE_TABLE
from orion_voice.core.config import OrionConfig

router = APIRouter(prefix="/api/sync", tags=["sync"])


async def verify_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization scheme")
    config = OrionConfig.load()
    if not config.web_sync.api_key:
        raise HTTPException(status_code=403, detail="Sync not configured on server")
    if token != config.web_sync.api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return token


class SyncStatus(BaseModel):
    enabled: bool
    last_sync: Optional[str] = None
    note_count: int = 0


class SyncNotePayload(BaseModel):
    id: str
    title: str
    content: str
    created_at: str
    updated_at: str
    deleted: bool = False


class SyncPushRequest(BaseModel):
    notes: list[SyncNotePayload]


class SyncPullResponse(BaseModel):
    notes: list[SyncNotePayload]


class SyncPushResponse(BaseModel):
    received: int
    merged: int


async def _get_db() -> aiosqlite.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))
    await db.execute(_CREATE_TABLE)
    await db.commit()
    return db


@router.get("/status", response_model=SyncStatus)
async def sync_status() -> SyncStatus:
    config = OrionConfig.load()
    db = await _get_db()
    try:
        cursor = await db.execute("SELECT COUNT(*) FROM notes WHERE deleted = 0")
        row = await cursor.fetchone()
        count = row[0]
    finally:
        await db.close()
    return SyncStatus(enabled=config.web_sync.enabled, note_count=count)


@router.post("/push", response_model=SyncPushResponse)
async def sync_push(body: SyncPushRequest, _token: str = Depends(verify_token)) -> SyncPushResponse:
    db = await _get_db()
    merged = 0
    try:
        for note in body.notes:
            cursor = await db.execute("SELECT updated_at FROM notes WHERE id = ?", (note.id,))
            existing = await cursor.fetchone()

            if existing is None:
                await db.execute(
                    "INSERT INTO notes (id, title, content, created_at, updated_at, deleted) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (note.id, note.title, note.content, note.created_at, note.updated_at, int(note.deleted)),
                )
                merged += 1
            else:
                local_updated = existing[0]
                if note.updated_at > local_updated:
                    await db.execute(
                        "UPDATE notes SET title = ?, content = ?, updated_at = ?, deleted = ? WHERE id = ?",
                        (note.title, note.content, note.updated_at, int(note.deleted), note.id),
                    )
                    merged += 1
        await db.commit()
    finally:
        await db.close()
    return SyncPushResponse(received=len(body.notes), merged=merged)


@router.post("/pull", response_model=SyncPullResponse)
async def sync_pull(
    since: Optional[str] = None,
    _token: str = Depends(verify_token),
) -> SyncPullResponse:
    db = await _get_db()
    try:
        if since:
            cursor = await db.execute(
                "SELECT id, title, content, created_at, updated_at, deleted FROM notes WHERE updated_at > ?",
                (since,),
            )
        else:
            cursor = await db.execute(
                "SELECT id, title, content, created_at, updated_at, deleted FROM notes"
            )
        rows = await cursor.fetchall()
        notes = [
            SyncNotePayload(
                id=r[0], title=r[1], content=r[2], created_at=r[3], updated_at=r[4], deleted=bool(r[5])
            )
            for r in rows
        ]
    finally:
        await db.close()
    return SyncPullResponse(notes=notes)
