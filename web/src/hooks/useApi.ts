import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

// ---------- Generic fetch hook ----------

export function useApi<T>(endpoint: string, defaultValue: T) {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, setData };
}

// ---------- Mutation helpers ----------

async function request<T = unknown>(method: string, endpoint: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const apiPost = <T = unknown>(endpoint: string, body?: unknown) => request<T>('POST', endpoint, body);
export const apiPut = <T = unknown>(endpoint: string, body?: unknown) => request<T>('PUT', endpoint, body);
export const apiDelete = (endpoint: string) => request<void>('DELETE', endpoint);

// ---------- Notes ----------

export interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  synced: boolean;
}

interface NotesResponse {
  notes: Note[];
  total: number;
  page: number;
  page_size: number;
}

export function useNotes() {
  const { data, loading, error, refetch, setData } = useApi<NotesResponse>('/notes', { notes: [], total: 0, page: 1, page_size: 20 });
  const notes = data.notes;
  const setNotes = (updater: (prev: Note[]) => Note[]) => {
    setData((prev) => ({ ...prev, notes: updater(prev.notes) }));
  };

  const createNote = async (title: string, content: string) => {
    const note = await apiPost<Note>('/notes', { title, content });
    setNotes((prev) => [note, ...prev]);
    return note;
  };

  const updateNote = async (id: string, title: string, content: string) => {
    const updated = await apiPut<Note>(`/notes/${id}`, { title, content });
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    return updated;
  };

  const deleteNote = async (id: string) => {
    await apiDelete(`/notes/${id}`);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const syncNotes = async () => {
    await apiPost('/sync');
    await refetch();
  };

  return { notes, loading, error, refetch, createNote, updateNote, deleteNote, syncNotes };
}

// ---------- TTS ----------

export async function ttsSpeak(text: string, voice?: string, speed?: number): Promise<HTMLAudioElement> {
  const params = new URLSearchParams({ text });
  if (voice) params.set('voice', voice);
  if (speed !== undefined) params.set('speed', String(speed));

  const res = await fetch(`${API_BASE}/tts/speak?${params}`);
  if (!res.ok) throw new Error(`TTS failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener('ended', () => URL.revokeObjectURL(url));
  return audio;
}

interface VoiceInfo {
  ShortName: string;
  FriendlyName: string;
  Gender: string;
  Locale: string;
}

export function useTtsVoices() {
  const { data, loading, error, refetch } = useApi<Record<string, VoiceInfo[]>>('/tts/voices', {});
  const voices = Object.values(data).flat().filter((v) => v.Locale?.startsWith('en-'));
  return { data: voices, loading, error, refetch };
}
