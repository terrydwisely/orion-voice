import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  FileText,
  Trash2,
  Check,
  RefreshCw,
  ArrowLeft,
  Save,
} from 'lucide-react';
import clsx from 'clsx';
import { useNotes, type Note } from '../hooks/useApi';

export default function Notes() {
  const { notes, loading, error, createNote, updateNote, deleteNote } = useNotes();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  );

  const selected = notes.find((n) => n.id === selectedId);

  // Auto-select first note on desktop when none selected
  useEffect(() => {
    if (!selectedId && notes.length > 0 && window.innerWidth >= 768) {
      selectNote(notes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  function selectNote(note: Note) {
    setSelectedId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setShowEditor(true);
  }

  async function handleCreate() {
    try {
      const note = await createNote('Untitled Note', '');
      selectNote(note);
      setTimeout(() => titleRef.current?.focus(), 100);
    } catch {
      // Fallback for offline: local-only note
      const local: Note = {
        id: `local-${Date.now()}`,
        title: 'Untitled Note',
        content: '',
        updated_at: new Date().toISOString(),
        synced: false,
      };
      selectNote(local);
    }
  }

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateNote(selectedId, editTitle, editContent);
    } catch {
      // Silently fail — note stays local
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNote(id);
    } catch {
      // ignore
    }
    if (selectedId === id) {
      setSelectedId(null);
      setShowEditor(false);
    }
  }

  function handleBack() {
    setShowEditor(false);
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      const now = Date.now();
      const diff = now - d.getTime();
      if (diff < 60_000) return 'Just now';
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
      return d.toLocaleDateString();
    } catch {
      return iso;
    }
  }

  // ---- Render ----

  const listPanel = (
    <div className={clsx('flex flex-col h-full', showEditor && 'hidden md:flex')}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-5 md:pt-5">
        <h2 className="text-lg font-semibold text-orion-text">Notes</h2>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleCreate}
          className="w-9 h-9 rounded-lg bg-orion-primary/15 text-orion-primary hover:bg-orion-primary/25 flex items-center justify-center transition-colors"
        >
          <Plus size={18} />
        </motion.button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3 md:px-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orion-text-tertiary" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="orion-input pl-8"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 space-y-1 pb-4">
        {loading && (
          <div className="flex items-center justify-center py-12 text-orion-text-tertiary text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading...
          </div>
        )}
        {error && !loading && (
          <div className="text-center py-12 text-orion-danger text-sm">Failed to load notes</div>
        )}
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
                  <p className="text-sm font-medium text-orion-text truncate">{note.title}</p>
                  <p className="text-xs text-orion-text-tertiary mt-1 line-clamp-2">{note.content}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(note.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-orion-text-tertiary hover:text-orion-danger transition-all shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-orion-text-tertiary">{formatDate(note.updated_at)}</span>
                {note.synced ? (
                  <Check size={10} className="text-orion-success" />
                ) : (
                  <RefreshCw size={10} className="text-orion-warning" />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <FileText size={28} className="mx-auto text-orion-text-tertiary mb-2" />
            <p className="text-sm text-orion-text-tertiary">
              {search ? 'No notes match your search' : 'No notes yet. Create one!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const editorPanel = (
    <div className={clsx('flex flex-col h-full', !showEditor && 'hidden md:flex')}>
      {selected ? (
        <>
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-5">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="md:hidden p-1.5 rounded-lg text-orion-text-tertiary hover:text-orion-text hover:bg-orion-surface-2 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2 text-orion-text-tertiary">
                <FileText size={14} />
                <span className="text-xs">{selected.synced ? 'Synced' : 'Unsaved changes'}</span>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={saving}
              className="orion-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Save size={12} />
              {saving ? 'Saving...' : 'Save'}
            </motion.button>
          </div>

          {/* Editor body */}
          <div className="flex-1 flex flex-col px-4 pb-4 md:px-5 min-h-0">
            <div className="flex-1 flex flex-col orion-card">
              <input
                ref={titleRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-transparent text-lg font-semibold text-orion-text border-none outline-none mb-3 placeholder:text-orion-text-tertiary"
                placeholder="Note title..."
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-transparent text-sm text-orion-text-secondary leading-relaxed border-none outline-none resize-none placeholder:text-orion-text-tertiary min-h-[200px]"
                placeholder="Start writing..."
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText size={36} className="mx-auto text-orion-text-tertiary mb-3" />
            <p className="text-sm text-orion-text-tertiary">Select or create a note</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex">
      {/* List — full width on mobile, fixed on desktop */}
      <div className="w-full md:w-80 md:shrink-0 md:border-r md:border-orion-border-subtle">{listPanel}</div>
      {/* Editor — full width on mobile overlay, flex-1 on desktop */}
      <div className={clsx(
        'md:relative md:inset-auto md:flex-1 md:bg-transparent',
        showEditor ? 'absolute inset-0 z-10 bg-orion-bg' : 'hidden md:block'
      )}>
        {editorPanel}
      </div>
    </div>
  );
}
