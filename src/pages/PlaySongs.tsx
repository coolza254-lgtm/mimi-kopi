import { useCallback, useEffect, useRef, useState } from "react";
import PianoKeyboard from "../components/PianoKeyboard";
import { activeSongPitches, fallingKey, notesForHands, practiceSongs, songEnd, songSeconds, type PracticeSong, type SongHands } from "../features/songs/catalog";
import { noteName } from "../features/midi/notes";
import type { Locale, MessageKey } from "../i18n/messages";
import { backend, inDesktopApp } from "../lib/backend";
import "../styles/songs.css";

interface Props { t: (key: MessageKey) => string; locale: Locale; onFocusChange?: (focus: boolean) => void }
const LOW = 48;
const HIGH = 84;
const AHEAD = 8;

export default function PlaySongs({ t, locale, onFocusChange }: Props) {
  const desktop = inDesktopApp();
  const [song, setSong] = useState<PracticeSong | null>(null);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-4);
  const [speed, setSpeed] = useState(.75);
  const [guide, setGuide] = useState(false);
  const [hands, setHands] = useState<SongHands>("right");
  const [held, setHeld] = useState<number[]>([]);
  const [issue, setIssue] = useState(false);
  const position = useRef(-4);
  const sounding = useRef(new Set<number>());
  const screen = useRef(new Set<number>());
  const mounted = useRef(true);
  const ended = !!song && beat >= songEnd(song);

  const send = useCallback((pitch: number, down: boolean) => {
    if (!desktop) return;
    void backend.midiSimulate(down ? [0x90, pitch, 84] : [0x80, pitch, 0]).catch(() => {
      if (mounted.current) { setIssue(true); setPlaying(false); }
    });
  }, [desktop]);
  const silence = useCallback(() => {
    const notes = new Set([...sounding.current, ...screen.current]);
    sounding.current.clear(); screen.current.clear();
    notes.forEach((pitch) => send(pitch, false));
  }, [send]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; silence(); };
  }, [silence]);
  useEffect(() => { onFocusChange?.(!!song); return () => onFocusChange?.(false); }, [song, onFocusChange]);
  const pause = useCallback(() => { setPlaying(false); silence(); setHeld([]); }, [silence]);
  useEffect(() => {
    if (!song) return;
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") pause(); };
    const hidden = () => { if (document.hidden) pause(); };
    window.addEventListener("blur", pause); window.addEventListener("keydown", escape); document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("blur", pause); window.removeEventListener("keydown", escape); document.removeEventListener("visibilitychange", hidden); };
  }, [song, pause]);
  useEffect(() => {
    if (!desktop || !song) return;
    let live = true;
    const subs = [backend.onMidiEvent((event) => {
      if (!live || event.pitch === null || event.simulated) return;
      const pitch = event.pitch;
      if (event.kind === "noteOn") setHeld((keys) => [...new Set([...keys, pitch])]);
      if (event.kind === "noteOff") setHeld((keys) => keys.filter((p) => p !== pitch));
    }), backend.onMidiReset(() => { if (live) pause(); })];
    subs.forEach((p) => void p.catch(() => { if (live) { setIssue(true); pause(); } }));
    return () => { live = false; subs.forEach((p) => void p.then((stop) => stop(), () => undefined)); };
  }, [desktop, song, pause]);
  useEffect(() => {
    if (!playing || !song) return;
    let frame = 0;
    const start = performance.now();
    const from = position.current;
    const end = songEnd(song);
    const tick = (now: number) => {
      const next = from + (now - start) / 60000 * song.tempo * speed;
      if (next >= end) {
        silence();
        position.current = end; setBeat(end); setPlaying(false);
        return;
      }
      const notes = new Set(guide && desktop ? activeSongPitches(song, next, hands) : []);
      sounding.current.forEach((p) => { if (!notes.has(p)) send(p, false); });
      notes.forEach((p) => { if (!sounding.current.has(p)) send(p, true); });
      sounding.current = notes;
      position.current = next; setBeat(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); silence(); };
  }, [playing, song, speed, guide, hands, desktop, send, silence]);

  const restart = () => { pause(); position.current = -4; setBeat(-4); setIssue(false); };
  const press = (pitch: number) => { screen.current.add(pitch); setHeld((keys) => [...new Set([...keys, pitch])]); send(pitch, true); };
  const release = (pitch: number) => { screen.current.delete(pitch); setHeld((keys) => keys.filter((p) => p !== pitch)); if (!sounding.current.has(pitch)) send(pitch, false); };
  if (!song) return <div className="song-library">
    <header><h1 className="title">{t("songsTitle")}</h1><p className="muted">{t("songsIntro")}</p></header>
    <div className="song-grid">{practiceSongs.map((item, i) => <article className="song-card" key={item.id}>
      <div className="song-cover" aria-hidden="true"><span>0{i + 1}</span><svg viewBox="0 0 240 100">{item.notes.slice(0, 15).map((n, index) => <rect key={index} x={index * 15 + 8} y={82 - (n.pitch - 55) * 4} width="8" height={n.duration * 14 + 5} rx="4" />)}</svg></div>
      <div className="song-card-copy"><h2>{item.title[locale]}</h2><p>{item.composer}</p><span>{t("songsSimple")} · {Math.ceil(songSeconds(item, 1))} s</span>
        <button className="btn primary" onClick={() => { restart(); setSong(item); }}>{t("songsOpen")}</button>
        <details><summary>{t("songsSource")}</summary><p>{t("songsRights")}</p><a href={item.source} target="_blank" rel="noreferrer">{item.composer}</a></details>
      </div>
    </article>)}</div>
    <p className="small muted">{t("songsRights")}</p>
  </div>;

  const expected = activeSongPitches(song, beat, hands);
  return <div className="song-player">
    <header className="song-toolbar"><button className="btn text" onClick={() => { pause(); setSong(null); }}>{t("songsBack")}</button><h1>{song.title[locale]}</h1>
      <button className="btn" onClick={() => { if (playing) pause(); else { if (ended) restart(); setPlaying(true); } }}>{playing ? t("songsPause") : ended ? t("songsRestart") : beat > -4 ? t("songsResume") : t("songsStart")}</button>
    </header>
    {!playing && <section className="song-options" aria-label={t("songsReady")}>
      <label>{t("songsSpeed")}<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{[.25,.5,.75,1].map((value) => <option key={value} value={value}>{value * 100}%</option>)}</select></label>
      <label>{t("songsHands")}<select value={hands} onChange={(e) => { restart(); setHands(e.target.value as SongHands); }}><option value="right">{t("songsRight")}</option><option value="left">{t("songsLeft")}</option><option value="both">{t("songsBoth")}</option></select></label>
      <span className="song-hand-legend"><i className="left" />{t("songsLeft")}<i className="right" />{t("songsRight")}</span>
      <label><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} disabled={!desktop} />{t("songsGuide")}</label>
      <button className="btn text" onClick={restart}>{t("songsRestart")}</button>
      <span className="small muted">{ended ? t("songsFinished") : t("songsNoScore")}</span>
      {!desktop && <span className="small muted">{t("songsBrowser")}</span>}
      {issue && <p role="alert">{t("songsError")}</p>}
    </section>}
    <div className="song-stage">
      <div className="falling-lane" role="img" aria-label={t("songsRoll")}>
        {Array.from({length: HIGH - LOW + 1}, (_, i) => LOW + i).filter((p) => p % 12 === 0).map((p) => <i className="roll-octave" key={p} style={{left:`${fallingKey(p).left}%`}} />)}
        {notesForHands(song, hands).map((n, i) => {
          if (n.beat > beat + AHEAD || n.beat + n.duration < beat) return null;
          const geometry = fallingKey(n.pitch);
          return <div key={i} className={`falling-bar hand-${n.hand}${n.beat <= beat ? " touching" : ""}`} style={{left:`${geometry.left}%`,width:`${geometry.width}%`,top:`${(1 - (n.beat + n.duration - beat) / AHEAD) * 100}%`,height:`${n.duration / AHEAD * 100}%`}}><span>{n.hand === "left" ? "L" : "R"} · {noteName(n.pitch)}</span></div>;
        })}
        {beat < 0 && <div className="song-countdown" aria-live="off">{Math.ceil(-beat)}</div>}
      </div>
      <PianoKeyboard low={LOW} high={HIGH} held={held} targets={expected} leftTargets={activeSongPitches(song, beat, "left")} onPress={press} onRelease={release} />
    </div>
    <progress className="song-progress" aria-label={t("songsProgress")} max={songEnd(song)} value={Math.max(0, beat)} />
  </div>;
}
