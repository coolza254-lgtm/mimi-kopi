import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import PianoKeyboard from "../components/PianoKeyboard";
import { chordName } from "../features/midi/chords";
import { initialMidiView, midiReducer, simulatedEvent } from "../features/midi/midiState";
import { noteName } from "../features/midi/notes";
import type { MessageKey } from "../i18n/messages";
import { defaultTone, loadAudioPrefs, saveAudioPrefs, tonePresets, type TonePrefs, type Touch } from "../lib/audioPrefs";
import { backend, inDesktopApp, type AudioStatus, type MidiEvent } from "../lib/backend";

interface Props {
  t: (key: MessageKey) => string;
  onOpenSound: () => void;
}

const SCREEN_VELOCITY = 90;
type SoundIssue = "status" | "midi" | "input" | "tone" | "gain" | "sound" | "storage";

const touchOptions: { value: Touch; label: MessageKey; hint: MessageKey }[] = [
  { value: "natural", label: "touchNatural", hint: "touchNaturalHint" },
  { value: "light", label: "touchLight", hint: "touchLightHint" },
  { value: "heavy", label: "touchHeavy", hint: "touchHeavyHint" },
  { value: "fixed", label: "touchFixed", hint: "touchFixedHint" },
];

const presetLabel: Record<(typeof tonePresets)[number]["id"], MessageKey> = {
  practice: "presetPractice",
  hall: "presetHall",
  soft: "presetSoft",
};

/** What the instrument plays for a key velocity, mirroring mimi-core's Touch. */
function heard(velocity: number, tone: TonePrefs): number {
  const v = Math.min(127, Math.max(1, velocity)) / 127;
  switch (tone.touch) {
    case "natural":
      return Math.round(v * 127);
    case "fixed":
      return tone.fixedVelocity;
    case "light":
      return Math.max(1, Math.round(Math.sqrt(v) * 127));
    case "heavy":
      return Math.max(1, Math.round(v ** 1.6 * 127));
  }
}

export default function FreePlay({ t, onOpenSound }: Props) {
  const desktop = inDesktopApp();
  const [view, dispatch] = useReducer(midiReducer, initialMidiView);
  const [tone, setTone] = useState<TonePrefs>(() => loadAudioPrefs().tone);
  const [volume, setVolume] = useState(() => loadAudioPrefs().master);
  const [audio, setAudio] = useState<AudioStatus | null>(null);
  const [lastVelocity, setLastVelocity] = useState<number | null>(null);
  const [pedal, setPedal] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [issues, setIssues] = useState<Partial<Record<SoundIssue, boolean>>>({});
  const [retrying, setRetrying] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const live = useRef(true);
  const lifetime = useRef(0);
  const requestedSound = useRef<"basic" | "file" | null>(null);
  const screenHeld = useRef(new Set<number>());
  const savedFile = loadAudioPrefs().soundFontPath;

  useEffect(() => { live.current = true; lifetime.current++; return () => { live.current = false; lifetime.current++; }; }, []);
  const setIssue = useCallback((kind: SoundIssue, failed: boolean) => {
    if (live.current) setIssues((current) => current[kind] === failed ? current : { ...current, [kind]: failed });
  }, []);
  const runNative = useCallback(async <T,>(kind: SoundIssue, action: () => Promise<T>): Promise<T | undefined> => {
    const started = lifetime.current;
    try {
      const result = await action();
      if (started === lifetime.current) setIssue(kind, false);
      return result;
    } catch {
      if (started === lifetime.current) setIssue(kind, true);
      return undefined;
    }
  }, [setIssue]);

  const feed = useCallback((e: MidiEvent) => {
    if (!live.current) return;
    dispatch({ type: "event", event: e });
    if (e.kind === "noteOn" && e.velocity !== null) setLastVelocity(e.velocity);
  }, []);

  const sendKey = useCallback(
    (pitch: number, down: boolean) => {
      if (down) screenHeld.current.add(pitch);
      else screenHeld.current.delete(pitch);
      if (desktop) {
        void runNative("input", () => backend.midiSimulate(down ? [0x90, pitch, SCREEN_VELOCITY] : [0x80, pitch, 0]));
      } else {
        feed(simulatedEvent(pitch, down, SCREEN_VELOCITY));
      }
    },
    [desktop, feed, runNative],
  );

  const releaseScreenInput = useCallback(() => {
    [...screenHeld.current].forEach((p) => sendKey(p, false));
    if (live.current) setPedal(false);
    if (desktop) void runNative("input", () => backend.midiSimulate([0xb0, 64, 0]));
  }, [desktop, sendKey, runNative]);

  useEffect(() => {
    if (!desktop) return;
    let active = true;
    let connected = 0;
    void backend.audioStatus().then((status) => {
      if (active) { setAudio(status); setIssue("status", !!status.error); }
    }, () => { if (active) setIssue("status", true); });
    const subscriptions = [backend.onMidiEvent((event) => { if (active) feed(event); }), backend.onMidiReset(() => {
      if (!active) return;
      releaseScreenInput();
      dispatch({ type: "reset" });
    })];
    subscriptions.forEach((p) => void p.then(() => {
      connected++;
      if (active && connected === subscriptions.length) setIssue("midi", false);
    }, () => { if (active) setIssue("midi", true); }));
    return () => {
      active = false;
      subscriptions.forEach((p) => void p.then((unlisten) => unlisten(), () => undefined));
    };
  }, [desktop, feed, releaseScreenInput, setIssue, connectionAttempt]);

  // Losing focus or leaving the page releases both on-screen keys and sustain.
  useEffect(() => {
    window.addEventListener("blur", releaseScreenInput);
    return () => {
      window.removeEventListener("blur", releaseScreenInput);
      releaseScreenInput();
    };
  }, [releaseScreenInput]);

  const changeTone = (change: Partial<TonePrefs>) => {
    const next = { ...tone, ...change };
    setTone(next);
    setIssue("storage", !saveAudioPrefs({ tone: next }));
    if (desktop) void runNative("tone", () => backend.audioSetTone(next));
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    setIssue("storage", !saveAudioPrefs({ master: value }));
    if (desktop) void runNative("gain", () => backend.audioSetGain("master", value / 100));
  };

  const togglePedal = () => {
    const on = !pedal;
    setPedal(on);
    if (desktop) void runNative("input", () => backend.midiSimulate([0xb0, 64, on ? 127 : 0]));
  };

  const switchSound = async (kind: "basic" | "file") => {
    if (!desktop || switching) return;
    requestedSound.current = kind;
    setSwitching(true);
    try {
      const status = await runNative("sound", () => kind === "basic" ? backend.audioUseBasic() : backend.audioLoadSoundFont(savedFile!));
      if (live.current && status) { setAudio(status); setIssue("sound", !!status.error); }
    } finally {
      if (live.current) setSwitching(false);
    }
  };

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    if (issues.storage) setIssue("storage", !saveAudioPrefs({ tone, master: volume }));
    if (issues.midi) setConnectionAttempt((attempt) => attempt + 1);
    if (issues.input) setPedal(false);
    if (desktop) {
      await Promise.all([
        runNative("status", () => backend.audioStatus()).then((status) => {
          if (live.current && status) { setAudio(status); setIssue("status", !!status.error); }
        }),
        ...(issues.tone ? [runNative("tone", () => backend.audioSetTone(tone))] : []),
        ...(issues.gain ? [runNative("gain", () => backend.audioSetGain("master", volume / 100))] : []),
        ...(issues.input ? [runNative("input", () => backend.midiSimulate([0xb0, 64, 0]))] : []),
        ...(issues.sound && requestedSound.current ? [switchSound(requestedSound.current)] : []),
      ]);
    }
    if (live.current) setRetrying(false);
  };

  const held = view.held;
  const chord = chordName(held);
  const usingFile = audio !== null && audio.instrument !== "basic";
  const fileName = savedFile?.split(/[\\/]/).pop() ?? null;
  const sustainOn = view.sustain || pedal;
  const issue = (Object.keys(issues) as SoundIssue[]).find((kind) => issues[kind]);

  return (
    <div className="free">
      <header className="page-head">
        <div>
          <h1 className="title">{t("freeTitle")}</h1>
          <p className="muted">{t("freeIntro")}</p>
        </div>
        <span className="badge">{t("freeNoScore")}</span>
      </header>

      {issue && <div className="notice error" role="alert">
        <p>{t(issue === "storage" ? "freePrefsError" : issue === "midi" || issue === "input" ? "freeInputError" : "freeSoundError")}</p>
        <div className="actions">
          <button type="button" className="btn" disabled={retrying || switching} onClick={() => void retry()}>{t("freeRetry")}</button>
          {issue !== "storage" && <button type="button" className="btn" onClick={onOpenSound}>{t("midiConnectionOpen")}</button>}
        </div>
      </div>}

      <div className="free-grid">
        <section className="card stage" aria-labelledby="stage-title">
          <h2 id="stage-title" className="sr-only">
            {t("freeNowPlaying")}
          </h2>
          <div className={`stage-chord${held.length === 0 ? " idle" : ""}`} aria-live="polite">
            {chord ?? (held.length > 0 ? held.map(noteName).join(" · ") : "♪")}
          </div>
          <div className="stage-notes">
            {held.length === 0 ? (
              <span className="muted">{t("freeWaiting")}</span>
            ) : (
              held.map((p) => (
                <span key={p} className="note-chip">
                  {noteName(p)}
                </span>
              ))
            )}
          </div>
          <dl className="stage-stats">
            <div>
              <dt>{t("freeLastPress")}</dt>
              <dd>{lastVelocity ?? "—"}</dd>
            </div>
            <div>
              <dt>{t("freeHeardAs")}</dt>
              <dd>{lastVelocity === null ? "—" : heard(lastVelocity, tone)}</dd>
            </div>
            <div>
              <dt>{t("freeSustain")}</dt>
              <dd>
                <span className={`pill${sustainOn ? " on" : ""}`}>{sustainOn ? t("on") : t("off")}</span>
              </dd>
            </div>
          </dl>
          <div className="actions">
            <button type="button" className={`btn${pedal ? " primary" : ""}`} aria-pressed={pedal} onClick={togglePedal}>
              {t("freePedal")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!desktop}
              onClick={() => {
                setPedal(false);
                void runNative("input", () => backend.midiReleaseAll());
              }}
            >
              {t("freeStopAll")}
            </button>
          </div>
        </section>

      <section className="card free-keyboard" aria-label={t("keyboardTitle")}>
        <PianoKeyboard held={held} onPress={(p) => sendKey(p, true)} onRelease={(p) => sendKey(p, false)} />
        <p className="muted small">{desktop ? t("freeKeyboardHint") : t("browserNotice")}</p>
      </section>

        <aside className="card tone-panel" aria-labelledby="tone-title">
          <h2 id="tone-title">{t("toneTitle")}</h2>

          <fieldset className="group">
            <legend>{t("toneSound")}</legend>
            <div className="choice-row">
              <button
                type="button"
                className={`choice${!usingFile ? " on" : ""}`}
                aria-pressed={!usingFile}
                disabled={!desktop || switching}
                onClick={() => void switchSound("basic")}
              >
                {t("instrumentBasic")}
              </button>
              {fileName && (
                <button
                  type="button"
                  className={`choice${usingFile ? " on" : ""}`}
                  aria-pressed={usingFile}
                  disabled={!desktop || switching}
                  onClick={() => void switchSound("file")}
                >
                  {switching ? t("soundLoading") : fileName}
                </button>
              )}
            </div>
            <button type="button" className="link" onClick={onOpenSound}>
              {t("toneOtherFile")}
            </button>
          </fieldset>

          <fieldset className="group">
            <legend>{t("touchTitle")}</legend>
            <div className="touch-grid" role="radiogroup" aria-label={t("touchTitle")}>
              {touchOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={tone.touch === o.value}
                  className={`choice${tone.touch === o.value ? " on" : ""}`}
                  onClick={() => changeTone({ touch: o.value })}
                >
                  <strong>{t(o.label)}</strong>
                  <span className="small">{t(o.hint)}</span>
                </button>
              ))}
            </div>
            {tone.touch === "fixed" && (
              <label className="range">
                <span>
                  {t("touchLevel")} <b>{Math.round((tone.fixedVelocity / 127) * 100)}%</b>
                </span>
                <input
                  type="range"
                  min={20}
                  max={127}
                  value={tone.fixedVelocity}
                  onChange={(e) => changeTone({ fixedVelocity: Number(e.target.value) })}
                />
              </label>
            )}
          </fieldset>

          <fieldset className="group">
            <legend>{t("toneColour")}</legend>
            <div className="choice-row">
              {tonePresets.map((p) => (
                <button key={p.id} type="button" className="choice compact" onClick={() => changeTone(p.tone)}>
                  {t(presetLabel[p.id])}
                </button>
              ))}
            </div>
            <label className="range">
              <span>
                {t("toneReverb")} <b>{tone.reverb}</b>
              </span>
              <input type="range" min={0} max={100} value={tone.reverb} onChange={(e) => changeTone({ reverb: Number(e.target.value) })} />
            </label>
            <label className="range">
              <span>
                {t("toneBrightness")} <b>{tone.brightness}</b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={tone.brightness}
                onChange={(e) => changeTone({ brightness: Number(e.target.value) })}
              />
              <span className="range-ends small muted">
                <span>{t("toneSoft")}</span>
                <span>{t("toneBright")}</span>
              </span>
            </label>
            <label className="range">
              <span>
                {t("toneVolume")} <b>{volume}</b>
              </span>
              <input type="range" min={0} max={100} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} />
            </label>
          </fieldset>

          <button type="button" className="btn" onClick={() => changeTone(defaultTone)}>
            {t("toneReset")}
          </button>
        </aside>
      </div>


    </div>
  );
}
