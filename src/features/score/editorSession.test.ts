import { describe, expect, it } from "vitest";
import { newSong } from "./score";
import { readEditorSession, saveEditorSession } from "./editorSession";

const songs = [newSong("first", "First", new Date()), newSong("second", "Second", new Date())];
const session = { songId: "second", cursor: 32, range: { from: 2, to: 3 } };

describe("editor resume hints", () => {
  it("restores the last song, insertion point and selected measures", () => {
    let raw = "";
    const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } };
    expect(saveEditorSession(session, storage)).toBe(true);
    expect(readEditorSession(songs, storage)).toEqual(session);
    expect(readEditorSession(songs.slice(0, 1), storage)).toBeNull();
  });

  it.each([null, {}, { ...session, cursor: -1 }, { ...session, cursor: 1000 }, { ...session, cursor: "32" },
    { ...session, range: { from: 3, to: 1 } }, { ...session, range: { from: 0, to: 8 } }, { ...session, range: { from: 0.5, to: 1 } }])("ignores damaged or stale hints without changing songs: %j", (value) => {
    expect(readEditorSession(songs, { getItem: () => JSON.stringify(value) })).toBeNull();
    expect(songs[1].notes).toEqual([]);
  });

  it("tolerates unavailable storage and reports failed writes", () => {
    expect(readEditorSession(songs, { getItem: () => { throw new Error("Blocked"); } })).toBeNull();
    expect(saveEditorSession(session, { setItem: () => { throw new Error("Full"); } })).toBe(false);
    expect(readEditorSession(songs, { getItem: () => "invalid JSON" })).toBeNull();
  });
});
