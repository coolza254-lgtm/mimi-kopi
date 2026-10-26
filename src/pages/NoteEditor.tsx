import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Lesson } from "../features/lessons/lessons";
import { loadProgress, recordFor, recordRun, saveProgress } from "../features/lessons/progress";
import { noteName } from "../features/midi/notes";
import {
  baseDuration,
  DURATIONS,
  isDotted,
  KEYS,
  keySignatureLetters,
  lastUsedMeasure,
  loadSongs,
  newSong,
  pitchAt,
  saveSongs,
  snapStart,
  spell,
  toSteps,
  unitsPerMeasure,
  type ScoreHand,
  type ScoreNote,
  type Song,
} from "../features/score/score";
import { MAX_SONG_FILE_BYTES, parseSongFile, serializeSongFile, songFilename } from "../features/score/songFile";
import { clampMeasureRange, enterMidiNote, playbackEvents } from "../features/score/editor";
import type { Locale, MessageKey } from "../i18n/messages";
import { backend, inDesktopApp } from "../lib/backend";
import { LessonPlayer } from "./Practice";

interface Props {
  t: (key: MessageKey) => string;
  locale: Locale;
}

// Layout of one system (row) of the grand staff, in SVG units.
const PER_ROW = 4;
const HEAD = 116;
const UNIT_W = 17;
const PAD = 18;
const ROW_H = 250;
const HALF = 6;
const TREBLE_TOP = 38; // F5
const BASS_TOP = 26; // A3
const TREBLE_OFF = 52;
const BASS_OFF = TREBLE_OFF + 48 + 72;

const durationLabel: Record<number, MessageKey> = {
  16: "durWhole",
  8: "durHalf",
  4: "durQuarter",
  2: "durEighth",
  1: "durSixteenth",
};

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

type Accidental = 1 | -1 | 0 | null;
type Hands = "R" | "L" | "both";

export default function NoteEditor({ t, locale }: Props) {
  const desktop = inDesktopApp();
  const [songs, setSongs] = useState<Song[]>(() => {
    const saved = loadSongs();
    return saved.length > 0 ? saved : [newSong(uid(), t("songUntitled"), new Date())];
  });
  const [songId, setSongId] = useState(() => songs[0].id);
  const song = songs.find((s) => s.id === songId) ?? songs[0];
  const [history, setHistory] = useState<{ undo: Song[]; redo: Song[] }>({ undo: [], redo: [] });
  const [dur, setDur] = useState(4);
  const [dotted, setDotted] = useState(false);
  const [accidental, setAccidental] = useState<Accidental>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ pitch: number; start: number; hand: ScoreHand } | null>(null);
  const [midiInput, setMidiInput] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const [requestedRange, setRange] = useState({ from: 0, to: 3 });
  const range = clampMeasureRange(song.measures, requestedRange);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [hands, setHands] = useState<Hands>("both");
  const [practice, setPractice] = useState<Lesson | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileMessage, setFileMessage] = useState<MessageKey | null>(null);
  const [fileError, setFileError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const lastInput = useRef<{ time: number; start: number } | null>(null);
  const playback = useRef<{ timers: number[]; frame: number; sounding: Set<number> } | null>(null);

  const units = unitsPerMeasure(song);
  const noteDur = dotted ? dur * 1.5 : dur;
  const measureW = units * UNIT_W + PAD + 10;
  const rows = Math.ceil(song.measures / PER_ROW);
  const width = HEAD + PER_ROW * measureW + 12;
  const height = rows * ROW_H + 20;
  const midiDraft = useRef({ song, cursor, dur: noteDur, enabled: midiInput && !practice && !fileBusy });

  useLayoutEffect(() => {
    midiDraft.current = { song, cursor, dur: noteDur, enabled: midiInput && !practice && !fileBusy };
  }, [song, cursor, noteDur, midiInput, practice, fileBusy]);
  useEffect(() => { lastInput.current = null; }, [songId, noteDur, midiInput, practice, fileBusy]);

  useEffect(() => saveSongs(songs), [songs]);

  /** Replaces the current song; `record` false while dragging, so one drag is one undo step. */
  const update = useCallback(
    (change: (s: Song) => Song, record = true) => {
      if (record) setHistory((h) => ({ undo: [...h.undo.slice(-99), song], redo: [] }));
      setSongs((all) => all.map((s) => {
        if (s.id !== songId) return s;
        const next = change(s);
        return { ...next, measures: Math.max(next.measures, lastUsedMeasure(next) + 1), updatedAt: new Date().toISOString() };
      }));
    },
    [songId, song],
  );

  const restore = (from: "undo" | "redo") => {
    const stack = history[from];
    const previous = stack[stack.length - 1];
    if (!previous) return;
    setHistory((h) => ({
      ...h,
      [from]: h[from].slice(0, -1),
      [from === "undo" ? "redo" : "undo"]: [...h[from === "undo" ? "redo" : "undo"], song],
    }));
    setSongs((all) => all.map((s) => (s.id === previous.id ? previous : s)));
  };

  // Geometry ------------------------------------------------------------
  const measureX = (m: number) => HEAD + (m % PER_ROW) * measureW;
  const rowTop = (m: number) => Math.floor(m / PER_ROW) * ROW_H + 10;
  const noteX = (start: number) => measureX(Math.floor(start / units)) + PAD + (start % units) * UNIT_W + 6;
  const stepY = (step: number, hand: ScoreHand, top: number) =>
    hand === "R" ? top + TREBLE_OFF + (TREBLE_TOP - step) * HALF : top + BASS_OFF + (BASS_TOP - step) * HALF;

  /** Pitch, start and staff for a point on the score, or null outside it. */
  const locate = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const row = Math.floor((p.y - 10) / ROW_H);
    const col = Math.floor((p.x - HEAD) / measureW);
    if (row < 0 || col < 0 || col >= PER_ROW) return null;
    const measure = row * PER_ROW + col;
    if (measure >= song.measures) return null;
    const top = row * ROW_H + 10;
    const middle = top + (TREBLE_OFF + 48 + BASS_OFF) / 2;
    const hand: ScoreHand = p.y < middle ? "R" : "L";
    const step =
      hand === "R"
        ? TREBLE_TOP - Math.round((p.y - top - TREBLE_OFF) / HALF)
        : BASS_TOP - Math.round((p.y - top - BASS_OFF) / HALF);
    const clamped = Math.max(hand === "R" ? 25 : 10, Math.min(hand === "R" ? 47 : 31, step));
    const raw = measure * units + Math.floor((p.x - measureX(measure) - PAD) / UNIT_W);
    return { step: clamped, hand, start: snapStart(raw, noteDur, units) };
  };

  const pitchFor = (step: number) =>
    Math.max(21, Math.min(108, pitchAt(step, song.fifths, accidental === null ? undefined : accidental)));

  // Editing -------------------------------------------------------------
  const onScoreDown = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current) return;
    const at = locate(e.clientX, e.clientY);
    if (!at) return;
    const pitch = pitchFor(at.step);
    const existing = song.notes.find((n) => n.start === at.start && n.pitch === pitch);
    if (existing) {
      setSelected(existing.id);
      return;
    }
    const note: ScoreNote = { id: uid(), pitch, start: at.start, dur: noteDur, hand: at.hand };
    update((s) => ({ ...s, notes: [...s.notes, note] }));
    setSelected(note.id);
    setAccidental(null);
    setCursor(at.start + noteDur);
    if (desktop) {
      void backend.midiSimulate([0x90, pitch, 80]).catch(() => undefined);
      window.setTimeout(() => void backend.midiSimulate([0x80, pitch, 0]).catch(() => undefined), 300);
    }
  };

  const onNoteDown = (e: PointerEvent, id: string) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setSelected(id);
    drag.current = { id, moved: false };
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const at = locate(e.clientX, e.clientY);
    if (drag.current) {
      if (!at) return;
      const id = drag.current.id;
      const first = !drag.current.moved;
      const n = song.notes.find((x) => x.id === id);
      if (!n) return;
      const pitch = pitchAt(at.step, song.fifths);
      const start = snapStart(at.start, n.dur, units);
      if (pitch === n.pitch && start === n.start && at.hand === n.hand) return;
      drag.current.moved = true;
      update((s) => ({ ...s, notes: s.notes.map((x) => (x.id === id ? { ...x, pitch, start, hand: at.hand } : x)) }), first);
      return;
    }
    setHover(at ? { pitch: pitchFor(at.step), start: at.start, hand: at.hand } : null);
  };

  const onUp = () => {
    drag.current = null;
  };

  const changeSelected = (change: (n: ScoreNote) => ScoreNote | null) => {
    if (!selected) return;
    update((s) => ({
      ...s,
      notes: s.notes.flatMap((n) => {
        if (n.id !== selected) return [n];
        const next = change(n);
        return next ? [next] : [];
      }),
    }));
  };

  const removeSelected = () => {
    changeSelected(() => null);
    setSelected(null);
  };

  const pickAccidental = (a: Accidental) => {
    const sel = song.notes.find((n) => n.id === selected);
    if (sel && a !== null) {
      const s = spell(sel.pitch, song.fifths);
      changeSelected((n) => ({ ...n, pitch: pitchAt(s.step, song.fifths, a) }));
      return;
    }
    setAccidental((cur) => (cur === a ? null : a));
  };

  const pickDuration = (d: number) => {
    setDur(d);
    if (selected) changeSelected((n) => ({ ...n, dur: dotted ? d * 1.5 : d }));
  };

  const toggleDot = () => {
    const next = !dotted;
    setDotted(next);
    if (selected) changeSelected((n) => ({ ...n, dur: next ? baseDuration(n.dur) * 1.5 : baseDuration(n.dur) }));
  };

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, select")) return;
    const sel = song.notes.find((n) => n.id === selected);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      restore(e.shiftKey ? "redo" : "undo");
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      restore("redo");
    } else if (e.key >= "1" && e.key <= "5") {
      pickDuration(DURATIONS[Number(e.key) - 1]);
    } else if (e.key === ".") {
      toggleDot();
    } else if ((e.key === "Delete" || e.key === "Backspace") && sel) {
      e.preventDefault();
      removeSelected();
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && sel) {
      e.preventDefault();
      const s = spell(sel.pitch, song.fifths);
      const step = s.step + (e.key === "ArrowUp" ? 1 : -1);
      changeSelected((n) => ({ ...n, pitch: Math.max(21, Math.min(108, pitchAt(step, song.fifths))) }));
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && sel) {
      e.preventDefault();
      const grid = Math.max(1, Math.min(4, baseDuration(sel.dur)));
      const start = Math.max(0, sel.start + (e.key === "ArrowRight" ? grid : -grid));
      if (Math.floor(start / units) < song.measures) changeSelected((n) => ({ ...n, start }));
    } else if (e.key === "Escape") {
      setSelected(null);
    }
  };

  // Notes from the piano: chords pressed together share one start.
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    const sub = backend.onMidiEvent((e) => {
      const draft = midiDraft.current;
      if (!active || !draft.enabled || playback.current) return;
      const next = enterMidiNote({ ...draft, last: lastInput.current }, e, draft.dur, uid(), performance.now(), new Date());
      if (!next) return;
      // Advance synchronously so a burst of MIDI events sees the preceding note
      // even before React commits the next render. State updaters stay pure.
      midiDraft.current = { ...draft, song: next.song, cursor: next.cursor };
      lastInput.current = next.last;
      setSongs((all) => all.map((s) => s.id === next.song.id ? next.song : s));
      setCursor(next.cursor);
      setHistory((h) => ({ undo: [...h.undo.slice(-99), draft.song], redo: [] }));
    });
    return () => {
      active = false;
      void sub.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [desktop]);

  // Playback ------------------------------------------------------------
  const stop = useCallback(() => {
    const pb = playback.current;
    if (!pb) return;
    pb.timers.forEach((id) => window.clearTimeout(id));
    cancelAnimationFrame(pb.frame);
    if (desktop) pb.sounding.forEach((p) => void backend.midiSimulate([0x80, p, 0]).catch(() => undefined));
    playback.current = null;
    setPlayhead(null);
  }, [desktop]);

  useEffect(() => stop, [stop]);
  // A running loop must not keep an old song, hand selection or range alive.
  useEffect(() => { stop(); }, [stop, song, range.from, range.to, hands, speed, loop]);

  const play = () => {
    stop();
    const from = range.from * units;
    const to = (range.to + 1) * units;
    const ms16 = 60_000 / (song.tempo * speed) / 4;
    const pb = { timers: [] as number[], frame: 0, sounding: new Set<number>() };
    playback.current = pb;
    const send = (bytes: number[]) => {
      if (desktop) void backend.midiSimulate(bytes).catch(() => undefined);
    };
    for (const event of playbackEvents(song, hands, from, to)) {
      pb.timers.push(window.setTimeout(() => {
        if (event.on) pb.sounding.add(event.pitch);
        else pb.sounding.delete(event.pitch);
        send([event.on ? 0x90 : 0x80, event.pitch, event.on ? 80 : 0]);
      }, event.at * ms16));
    }
    const began = performance.now();
    const total = (to - from) * ms16;
    const tick = () => {
      const elapsed = performance.now() - began;
      if (elapsed >= total) {
        stop();
        if (loop) play();
        return;
      }
      setPlayhead(from + elapsed / ms16);
      pb.frame = requestAnimationFrame(tick);
    };
    pb.frame = requestAnimationFrame(tick);
  };

  // Songs ---------------------------------------------------------------
  const selectSong = (id: string) => {
    stop();
    setSongId(id);
    setHistory({ undo: [], redo: [] });
    setSelected(null);
    setCursor(null);
    setRange({ from: 0, to: Math.min(3, (songs.find((s) => s.id === id)?.measures ?? 4) - 1) });
    lastInput.current = null;
  };

  const importSong = (text: string) => {
    const imported = parseSongFile(text, uid(), new Date());
    selectSong(imported.id);
    setRange({ from: 0, to: Math.min(3, imported.measures - 1) });
    setSongs((all) => [...all, imported]);
    setFileError(false);
    setFileMessage("songImported");
  };

  const importDesktop = async () => {
    setFileBusy(true);
    setFileMessage(null);
    stop();
    try {
      const path = await open({ multiple: false, filters: [{ name: t("songFileType"), extensions: ["json"] }] });
      if (typeof path === "string") importSong(await backend.songFileRead(path));
    } catch {
      setFileError(true);
      setFileMessage("songImportFailed");
    } finally {
      setFileBusy(false);
    }
  };

  const exportSong = async () => {
    setFileBusy(true);
    setFileMessage(null);
    try {
      const contents = serializeSongFile(song);
      // An exported file must be readable again without changing its notes.
      parseSongFile(contents, song.id, new Date());
      const filename = songFilename(song.title);
      if (desktop) {
        const path = await save({ defaultPath: filename, filters: [{ name: t("songFileType"), extensions: ["json"] }] });
        if (!path) return;
        await backend.songFileWrite(path, contents);
        setFileMessage("songExported");
      } else {
        const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setFileMessage("songDownloadStarted");
      }
      setFileError(false);
    } catch {
      setFileError(true);
      setFileMessage("songExportFailed");
    } finally {
      setFileBusy(false);
    }
  };

  const addSong = () => {
    const s = newSong(uid(), t("songUntitled"), new Date());
    selectSong(s.id);
    setSongs((all) => [...all, s]);
  };

  const deleteSong = () => {
    if (!window.confirm(t("songDeleteConfirm"))) return;
    const rest = songs.filter((s) => s.id !== song.id);
    const next = rest.length > 0 ? rest : [newSong(uid(), t("songUntitled"), new Date())];
    selectSong(next[0].id);
    setSongs(next);
  };

  const startPractice = () => {
    stop();
    const steps = toSteps(song, hands, range.from, range.to);
    if (steps.length === 0) return;
    const title = `${song.title} · ${t("measureShort")} ${range.from + 1}–${range.to + 1}`;
    const goal = t("songPracticeGoal");
    setPractice({
      id: `song-${song.id}-${hands}-${range.from}-${range.to}`,
      version: steps.flat().reduce((h, p, i) => (h * 31 + p + i) % 1_000_003, steps.length),
      unit: "song",
      hand: hands === "R" ? "right" : hands === "L" ? "left" : "both",
      title: { th: title, en: title, ja: title },
      goal: { th: goal, en: goal, ja: goal },
      steps,
    });
  };

  const [progress, setProgress] = useState(() => loadProgress());
  if (practice) {
    return (
      <LessonPlayer
        lesson={practice}
        record={recordFor(progress, practice)}
        next={null}
        t={t}
        locale={locale}
        onFinish={(l, result) => {
          const next = recordRun(progress, l, result, new Date());
          setProgress(next);
          return saveProgress(next);
        }}
        onOpen={setPractice}
        onBack={() => setPractice(null)}
      />
    );
  }

  // Drawing -------------------------------------------------------------
  const lastMeasure = Math.max(0, song.measures - 1);
  const used = lastUsedMeasure(song);

  const drawNote = (n: { pitch: number; start: number; dur: number; hand: ScoreHand }, cls: string, key: string, id?: string) => {
    const m = Math.floor(n.start / units);
    if (m >= song.measures) return null;
    const top = rowTop(m);
    const s = spell(n.pitch, song.fifths);
    const x = noteX(n.start);
    const y = stepY(s.step, n.hand, top);
    const [bottom, topLine, middle] = n.hand === "R" ? [30, 38, 34] : [18, 26, 22];
    const ledgers: number[] = [];
    for (let st = bottom - 2; st >= s.step; st -= 2) ledgers.push(st);
    for (let st = topLine + 2; st <= s.step; st += 2) ledgers.push(st);
    const base = baseDuration(n.dur);
    const up = s.step < middle;
    const stemX = up ? x + 6.5 : x - 6.5;
    const stemEnd = up ? y - 34 : y + 34;
    return (
      <g
        key={key}
        className={`sn ${cls}`}
        onPointerDown={id ? (e) => onNoteDown(e, id) : undefined}
        role={id ? "button" : undefined}
        aria-label={id ? `${noteName(n.pitch)} ${t(durationLabel[base])}` : undefined}
      >
        {ledgers.map((st) => (
          <line key={st} className="ledger" x1={x - 12} x2={x + 12} y1={stepY(st, n.hand, top)} y2={stepY(st, n.hand, top)} />
        ))}
        {s.accidental && (
          <text className="acc" x={x - 22} y={y + 6} fontSize="18">
            {s.accidental}
          </text>
        )}
        <ellipse
          className={base >= 8 ? "head hollow" : "head"}
          cx={x}
          cy={y}
          rx="7.5"
          ry="5.5"
          transform={`rotate(-20 ${x} ${y})`}
        />
        {base <= 8 && <line className="stem" x1={stemX} x2={stemX} y1={y} y2={stemEnd} />}
        {base <= 2 && <path className="flag" d={`M${stemX} ${stemEnd} q2 ${up ? 8 : -8} 9 ${up ? 13 : -13}`} />}
        {base === 1 && <path className="flag" d={`M${stemX} ${stemEnd + (up ? 7 : -7)} q2 ${up ? 8 : -8} 9 ${up ? 13 : -13}`} />}
        {isDotted(n.dur) && <circle className="dot" cx={x + 12} cy={s.step % 2 === 0 ? y - 3 : y} r="2.3" />}
        {id && <rect className="hit" x={x - 11} y={y - 9} width="22" height="18" />}
      </g>
    );
  };

  const keyLetters = keySignatureLetters(song.fifths);
  const sigY = (letter: number, hand: ScoreHand, top: number) => {
    // Conventional octave for each key-signature letter on each staff.
    const treble = song.fifths > 0 ? [35, 36, 37, 38, 39, 33, 34] : [35, 36, 37, 31, 32, 33, 34];
    const step = hand === "R" ? treble[letter] : treble[letter] - 14;
    return stepY(step, hand, top);
  };

  return (
    <div className="editor" onKeyDown={onKey}>
      <header className="page-head">
        <div>
          <h1 className="title">{t("editorTitle")}</h1>
          <p className="muted">{t("editorIntro")}</p>
        </div>
        <span className="badge">{t("editorPrivate")}</span>
      </header>

      <section className="card editor-song">
        <label className="field">
          {t("songPick")}
          <select value={song.id} onChange={(e) => selectSong(e.target.value)}>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || t("songUntitled")}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          {t("songTitle")}
          <input maxLength={200} value={song.title} onChange={(e) => update((s) => ({ ...s, title: e.target.value }), false)} />
        </label>
        <label className="field">
          {t("songKey")}
          <select value={song.fifths} onChange={(e) => update((s) => ({ ...s, fifths: Number(e.target.value) }))}>
            {KEYS.map((k) => (
              <option key={k.fifths} value={k.fifths}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("songTime")}
          <select value={song.beats} onChange={(e) => update((s) => ({ ...s, beats: Number(e.target.value) }))}>
            {[2, 3, 4].map((b) => (
              <option key={b} value={b}>
                {b}/4
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("songTempo")}
          <input
            type="number"
            min={30}
            max={240}
            value={song.tempo}
            onChange={(e) => update((s) => ({ ...s, tempo: Math.max(30, Math.min(240, Number(e.target.value) || 80)) }), false)}
          />
        </label>
        <div className="actions">
          <button type="button" className="btn" onClick={addSong}>
            {t("songNew")}
          </button>
          <button type="button" className="btn" onClick={deleteSong}>
            {t("songDelete")}
          </button>
          <button type="button" className="btn" disabled={fileBusy} onClick={() => desktop ? void importDesktop() : fileInput.current?.click()}>
            {t("songImport")}
          </button>
          <button type="button" className="btn" disabled={fileBusy} onClick={() => void exportSong()}>
            {t("songExport")}
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setFileBusy(true);
            setFileMessage(null);
            stop();
            try {
              if (file.size > MAX_SONG_FILE_BYTES) throw new Error("Song file too large");
              importSong(await file.text());
            } catch {
              setFileError(true);
              setFileMessage("songImportFailed");
            } finally {
              setFileBusy(false);
            }
          }} />
        </div>
      </section>
      <p className="muted small">{t("songBackupHint")}</p>
      {fileMessage && <p role={fileError ? "alert" : "status"}>{t(fileMessage)}</p>}

      <section className="card editor-tools" aria-label={t("editorTools")}>
        <div className="tool-group">
          <span>{t("toolLength")}</span>
          <div className="seg-row" role="radiogroup" aria-label={t("toolLength")}>
            {DURATIONS.map((d, i) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={dur === d}
                className={`choice compact${dur === d ? " on" : ""}`}
                title={`${t(durationLabel[d])} (${i + 1})`}
                onClick={() => pickDuration(d)}
              >
                {t(durationLabel[d])}
              </button>
            ))}
            <button type="button" aria-pressed={dotted} className={`choice compact${dotted ? " on" : ""}`} onClick={toggleDot}>
              {t("toolDot")} ·
            </button>
          </div>
        </div>
        <div className="tool-group">
          <span>{t("toolAccidental")}</span>
          <div className="seg-row">
            {(
              [
                [1, "♯"],
                [-1, "♭"],
                [0, "♮"],
              ] as const
            ).map(([a, label]) => (
              <button
                key={a}
                type="button"
                aria-pressed={accidental === a}
                className={`choice compact accidental-btn${accidental === a ? " on" : ""}`}
                onClick={() => pickAccidental(a)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="tool-group">
          <span>{t("toolEdit")}</span>
          <div className="seg-row">
            <button type="button" className="btn" disabled={history.undo.length === 0} onClick={() => restore("undo")}>
              ↶ {t("toolUndo")}
            </button>
            <button type="button" className="btn" disabled={history.redo.length === 0} onClick={() => restore("redo")}>
              ↷ {t("toolRedo")}
            </button>
            <button type="button" className="btn" disabled={!selected} onClick={removeSelected}>
              {t("toolDelete")}
            </button>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={midiInput} onChange={(e) => setMidiInput(e.target.checked)} />
          {t("toolMidiInput")}
        </label>
      </section>

      <section className="card score-card">
        <div className="score-scroll" tabIndex={0} aria-label={t("editorScore")}>
          <svg
            ref={svgRef}
            className="score"
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            onPointerDown={onScoreDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={() => setHover(null)}
          >
            {Array.from({ length: rows }, (_, r) => {
              const top = r * ROW_H + 10;
              const count = Math.min(PER_ROW, song.measures - r * PER_ROW);
              const right = HEAD + count * measureW;
              return (
                <g key={r}>
                  {[0, 2, 4, 6, 8].map((d) => (
                    <g key={d} className="staff-line">
                      <line x1="10" x2={right} y1={top + TREBLE_OFF + d * HALF} y2={top + TREBLE_OFF + d * HALF} />
                      <line x1="10" x2={right} y1={top + BASS_OFF + d * HALF} y2={top + BASS_OFF + d * HALF} />
                    </g>
                  ))}
                  <line className="barline" x1="10" x2="10" y1={top + TREBLE_OFF} y2={top + BASS_OFF + 48} />
                  <text className="clef" x="14" y={top + TREBLE_OFF + 40} fontSize="56">
                    𝄞
                  </text>
                  <text className="clef" x="16" y={top + BASS_OFF + 30} fontSize="38">
                    𝄢
                  </text>
                  {keyLetters.map((letter, i) => (
                    <g key={letter}>
                      <text className="acc" x={50 + i * 8} y={sigY(letter, "R", top) + 6} fontSize="18">
                        {song.fifths > 0 ? "♯" : "♭"}
                      </text>
                      <text className="acc" x={50 + i * 8} y={sigY(letter, "L", top) + 6} fontSize="18">
                        {song.fifths > 0 ? "♯" : "♭"}
                      </text>
                    </g>
                  ))}
                  {r === 0 &&
                    [TREBLE_OFF, BASS_OFF].map((off) => (
                      <g key={off} className="time-sig">
                        <text x={HEAD - 24} y={top + off + 22} fontSize="24">
                          {song.beats}
                        </text>
                        <text x={HEAD - 24} y={top + off + 46} fontSize="24">
                          4
                        </text>
                      </g>
                    ))}
                  {Array.from({ length: count }, (_, c) => {
                    const m = r * PER_ROW + c;
                    const x = measureX(m) + measureW;
                    const inRange = m >= range.from && m <= range.to;
                    return (
                      <g key={m}>
                        {inRange && (
                          <rect className="range-band" x={measureX(m)} y={top + TREBLE_OFF - 30} width={measureW} height={BASS_OFF - TREBLE_OFF + 84} />
                        )}
                        <line className="barline" x1={x} x2={x} y1={top + TREBLE_OFF} y2={top + BASS_OFF + 48} />
                        <text className="measure-no" x={measureX(m) + 4} y={top + TREBLE_OFF - 12}>
                          {m + 1}
                        </text>
                        {Array.from({ length: song.beats }, (_, b) => (
                          <line
                            key={b}
                            className="beat-tick"
                            x1={measureX(m) + PAD + b * 4 * UNIT_W + 6}
                            x2={measureX(m) + PAD + b * 4 * UNIT_W + 6}
                            y1={top + TREBLE_OFF + 48 + 30}
                            y2={top + TREBLE_OFF + 48 + 42}
                          />
                        ))}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {cursor !== null && Math.floor(cursor / units) < song.measures && (
              <line
                className="input-cursor"
                x1={noteX(cursor) - 10}
                x2={noteX(cursor) - 10}
                y1={rowTop(Math.floor(cursor / units)) + TREBLE_OFF - 20}
                y2={rowTop(Math.floor(cursor / units)) + BASS_OFF + 60}
              />
            )}
            {song.notes.map((n) => drawNote(n, n.id === selected ? "selected" : "", n.id, n.id))}
            {hover && !drag.current && drawNote({ ...hover, dur: noteDur }, "ghost", "ghost")}
            {playhead !== null && Math.floor(playhead / units) < song.measures && (
              <line
                className="playhead"
                x1={noteX(playhead)}
                x2={noteX(playhead)}
                y1={rowTop(Math.floor(playhead / units)) + TREBLE_OFF - 24}
                y2={rowTop(Math.floor(playhead / units)) + BASS_OFF + 64}
              />
            )}
          </svg>
        </div>
        <div className="score-foot">
          <span className="small muted">
            {hover ? `${noteName(hover.pitch)} · ${t(durationLabel[dur])}${dotted ? " ·" : ""}` : t("editorHint")}
          </span>
          <div className="actions">
            <button type="button" className="btn" disabled={song.measures >= 400} onClick={() => update((s) => ({ ...s, measures: Math.min(400, s.measures + PER_ROW) }))}>
              + {t("addMeasures")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={song.measures <= Math.max(1, used + 1)}
              onClick={() => update((s) => ({ ...s, measures: Math.max(used + 1, 1, s.measures - 1) }))}
            >
              − {t("removeMeasure")}
            </button>
          </div>
        </div>
      </section>

      <section className="card editor-play">
        <label className="field">
          {t("playFrom")}
          <select value={range.from} onChange={(e) => setRange((r) => ({ from: Number(e.target.value), to: Math.max(r.to, Number(e.target.value)) }))}>
            {Array.from({ length: song.measures }, (_, m) => (
              <option key={m} value={m}>
                {t("measureShort")} {m + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("playTo")}
          <select value={Math.min(range.to, lastMeasure)} onChange={(e) => setRange((r) => ({ from: Math.min(r.from, Number(e.target.value)), to: Number(e.target.value) }))}>
            {Array.from({ length: song.measures }, (_, m) => (
              <option key={m} value={m}>
                {t("measureShort")} {m + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("playHands")}
          <select value={hands} onChange={(e) => setHands(e.target.value as Hands)}>
            <option value="both">{t("handBoth")}</option>
            <option value="R">{t("handRight")}</option>
            <option value="L">{t("handLeft")}</option>
          </select>
        </label>
        <label className="field">
          {t("playSpeed")}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {[0.5, 0.75, 1].map((v) => (
              <option key={v} value={v}>
                {Math.round(v * 100)}%
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          {t("playLoop")}
        </label>
        <div className="actions">
          {playhead === null ? (
            <button type="button" className="btn primary" onClick={play}>
              ▶ {t("playListen")}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={stop}>
              ■ {t("playStop")}
            </button>
          )}
          <button type="button" className="btn" disabled={toSteps(song, hands, range.from, range.to).length === 0} onClick={startPractice}>
            {t("practiceThis")} ›
          </button>
        </div>
      </section>
      {!desktop && <p className="muted small">{t("browserNotice")}</p>}
    </div>
  );
}
