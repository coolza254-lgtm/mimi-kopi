import { unitsPerMeasure, type Song } from "./score";

export interface EditorSession {
  songId: string;
  cursor: number | null;
  range: { from: number; to: number };
}
const KEY = "mimi-kopi.editor-session";

/** Session hints are disposable; they never replace or repair the song library. */
export function readEditorSession(songs: Song[], storage?: Pick<Storage, "getItem">): EditorSession | null {
  try {
    const value: unknown = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const s = value as EditorSession;
    const song = songs.find((item) => item.id === s.songId);
    if (!song || (s.cursor !== null && (typeof s.cursor !== "number" || !Number.isFinite(s.cursor) || s.cursor < 0 || s.cursor > song.measures * unitsPerMeasure(song)))) return null;
    if (!s.range || !Number.isInteger(s.range.from) || !Number.isInteger(s.range.to) || s.range.from < 0 || s.range.to < s.range.from || s.range.to >= song.measures) return null;
    return { songId: song.id, cursor: s.cursor, range: { from: s.range.from, to: s.range.to } };
  } catch {
    return null;
  }
}

export function saveEditorSession(session: EditorSession, storage?: Pick<Storage, "setItem">): boolean {
  try {
    (storage ?? globalThis.localStorage).setItem(KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}
