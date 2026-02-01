import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  FileText,
  Trash2,
  Check,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  synced: boolean;
}

const initialNotes: Note[] = [
  {
    id: '1',
    title: 'Meeting Notes - Sprint Review',
    content:
      'Discussed Q4 goals and feature roadmap. Action items: finalize API spec, set up staging environment, coordinate with design on new dashboard layout.',
    updatedAt: '2 min ago',
    synced: true,
  },
  {
    id: '2',
    title: 'Voice Command Ideas',
    content:
      'Explore wake word detection, custom command aliases, multi-language support for STT pipeline.',
    updatedAt: '1 hr ago',
    synced: true,
  },
  {
    id: '3',
    title: 'API Design v2',
    content:
      'RESTful endpoints for notes CRUD, WebSocket for real-time STT streaming, auth via JWT tokens.',
    updatedAt: '3 hrs ago',
    synced: false,
  },
];

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);
  const [editTitle, setEditTitle] = useState(notes[0]?.title ?? '');
  const [editContent, setEditContent] = useState(notes[0]?.content ?? '');

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  );

  const selected = notes.find((n) => n.id === selectedId);

  const selectNote = (note: Note) => {
    setSelectedId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const createNote = () => {
    const note: Note = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
      updatedAt: 'Just now',
      synced: false,
    };
    setNotes([note, ...notes]);
    selectNote(note);
  };

  const saveNote = () => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedId
          ? { ...n, title: editTitle, content: editContent, updatedAt: 'Just now', synced: false }
          : n
      )
    );
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) {
      const remaining = notes.filter((n) => n.id !== id);
      if (remaining.length) selectNote(remaining[0]);
      else {
        setSelectedId(null);
        setEditTitle('');
        setEditContent('');
      }
    }
  };

  return (
    <div className="h-full flex gap-4">
      {/* Notes list */}
      <div className="w-72 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-orion-text">Notes</h2>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={createNote}
            className="w-8 h-8 rounded-lg bg-orion-primary/15 text-orion-primary hover:bg-orion-primary/25 flex items-center justify-center transition-colors"
          >
            <Plus size={16} />
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-orion-text-tertiary"
          />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="orion-input pl-8"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
          <AnimatePresence>
            {filtered.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => selectNote(note)}
                className={clsx(
                  'p-3 rounded-orion cursor-pointer transition-all duration-150 group',
                  selectedId === note.id
                    ? 'bg-orion-surface-2 border border-orion-border'
                    : 'hover:bg-orion-surface border border-transparent'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-orion-text truncate">
                      {note.title}
                    </p>
                    <p className="text-xs text-orion-text-tertiary mt-1 line-clamp-2">
                      {note.content}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-orion-text-tertiary hover:text-orion-danger transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-orion-text-tertiary">
                    {note.updatedAt}
                  </span>
                  {note.synced ? (
                    <Check size={10} className="text-orion-success" />
                  ) : (
                    <RefreshCw size={10} className="text-orion-warning" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col orion-card">
        {selected ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-orion-text-tertiary">
                <FileText size={14} />
                <span className="text-xs">
                  {selected.synced ? 'Synced' : 'Unsaved changes'}
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={saveNote}
                className="orion-btn-primary text-xs py-1.5 px-3"
              >
                Save
              </motion.button>
            </div>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-transparent text-lg font-semibold text-orion-text border-none outline-none mb-3 placeholder:text-orion-text-tertiary"
              placeholder="Note title..."
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 bg-transparent text-sm text-orion-text-secondary leading-relaxed border-none outline-none resize-none placeholder:text-orion-text-tertiary"
              placeholder="Start writing..."
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText size={32} className="mx-auto text-orion-text-tertiary mb-2" />
              <p className="text-sm text-orion-text-tertiary">
                Select or create a note
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
