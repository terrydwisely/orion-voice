import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  FileText,
  Trash2,
  Check,
  RefreshCw,
  Play,
  Square,
} from 'lucide-react';
import clsx from 'clsx';
import { apiPost, apiPut, apiDelete } from '../hooks/useApi';

const API_BASE = 'http://127.0.0.1:8432';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  synced: boolean;
}

interface ApiNote {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return 'Just now';
  }
}

function toNote(a: ApiNote): Note {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    updatedAt: timeAgo(a.updated_at),
    synced: true,
  };
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes from backend
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notes?page_size=100`);
      if (!res.ok) return;
      const data = await res.json();
      const loaded: Note[] = data.notes.map(toNote);
      setNotes(loaded);
      // Auto-select first note if nothing selected
      if (loaded.length > 0 && !selectedId) {
        setSelectedId(loaded[0].id);
        setEditTitle(loaded[0].title);
        setEditContent(loaded[0].content);
      }
    } catch {
      // Backend may not be ready
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  );

  const selected = notes.find((n) => n.id === selectedId);

  const stopPlayback = async () => {
    if (playing) {
      try { await apiPost('/api/tts/stop'); } catch {}
      setPlaying(false);
    }
  };

  const handlePlay = async () => {
    const text = editContent.trim() || editTitle.trim();
    if (!text) return;
    setPlaying(true);
    try {
      await apiPost('/api/tts/speak', { text, stream: false });
    } catch {}
    setPlaying(false);
  };

  const selectNote = (note: Note) => {
    // Save current note before switching
    flushSave();
    stopPlayback();
    setSelectedId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  // Auto-save with debounce
  const scheduleSave = useCallback((noteId: string, title: string, content: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await apiPut(`/api/notes/${noteId}`, { title, content });
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, title, content, updatedAt: 'Just now', synced: true }
              : n
          )
        );
      } catch {
        // Mark unsaved
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId ? { ...n, synced: false } : n
          )
        );
      }
    }, 800);
  }, []);

  const flushSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    // Do an immediate save of current note
    if (selectedId) {
      apiPut(`/api/notes/${selectedId}`, { title: editTitle, content: editContent }).catch(() => {});
    }
  };

  const handleTitleChange = (value: string) => {
    setEditTitle(value);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedId ? { ...n, title: value, synced: false } : n
      )
    );
    if (selectedId) scheduleSave(selectedId, value, editContent);
  };

  const handleContentChange = (value: string) => {
    setEditContent(value);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedId ? { ...n, content: value, synced: false } : n
      )
    );
    if (selectedId) scheduleSave(selectedId, editTitle, value);
  };

  const createNote = async () => {
    try {
      const result = await apiPost<ApiNote>('/api/notes', {
        title: 'Untitled Note',
        content: '',
      });
      const note = toNote(result);
      setNotes((prev) => [note, ...prev]);
      setSelectedId(note.id);
      setEditTitle(note.title);
      setEditContent(note.content);
    } catch {}
  };

  const deleteNote = async (id: string) => {
    try {
      await apiDelete(`/api/notes/${id}`);
    } catch {}
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
          {loading ? (
            <p className="text-xs text-orion-text-tertiary text-center py-4">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-orion-text-tertiary text-center py-4">No notes yet</p>
          ) : (
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
                        {note.title || 'Untitled Note'}
                      </p>
                      <p className="text-xs text-orion-text-tertiary mt-1 line-clamp-2">
                        {note.content || 'Empty note'}
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
          )}
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
                  {selected.synced ? 'Saved' : 'Saving...'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlay}
                  disabled={playing}
                  className={clsx(
                    'text-xs py-1.5 px-3 rounded-lg font-medium flex items-center gap-1.5 transition-colors',
                    playing
                      ? 'bg-orion-surface-2 text-orion-text-tertiary cursor-not-allowed'
                      : 'bg-orion-primary/15 text-orion-primary hover:bg-orion-primary/25'
                  )}
                >
                  <Play size={12} />
                  Play
                </motion.button>
                {playing && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={stopPlayback}
                    className="text-xs py-1.5 px-3 rounded-lg font-medium flex items-center gap-1.5 bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                  >
                    <Square size={12} />
                    Stop
                  </motion.button>
                )}
              </div>
            </div>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="bg-transparent text-lg font-semibold text-orion-text border-none outline-none mb-3 placeholder:text-orion-text-tertiary"
              placeholder="Note title..."
            />
            <textarea
              value={editContent}
              onChange={(e) => handleContentChange(e.target.value)}
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
