import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import PianoKeyboard from "../components/PianoKeyboard";
import { initialMidiView, midiReducer, simulatedEvent } from "../features/midi/midiState";
import { loadAudioPrefs, saveAudioPrefs } from "../lib/audioPrefs";
import { noteName } from "../features/midi/notes";
import type { MessageKey } from "../i18n/messages";
import {
  backend,
  inDesktopApp,
  type AudioStatus,
  type CapabilityReport,
  type MidiEvent,
  type MidiStatus,
} from "../lib/backend";

interface Props {
  t: (key: MessageKey) => string;
}

const MONITOR_ROWS = 50;
const VELOCITY = 90;

const capabilityRows: { key: MessageKey; field: keyof CapabilityReport }[] = [
  { key: "capNoteOnOff", field: "noteOnOff" },
  { key: "capVelocity", field: "velocity" },
  { key: "capSustain", field: "sustainCc64" },
  { key: "capPolyphony", field: "polyphony" },
];

const eventLabel: Record<MidiEvent["kind"], MessageKey> = {
  noteOn: "eventNoteOn",
  noteOff: "eventNoteOff",
  controlChange: "eventControl",
  other: "eventOther",
};

const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

export default function SoundMidi({ t }: Props) {
  const desktop = inDesktopApp();
  const [view, dispatch] = useReducer(midiReducer, initialMidiView);
  const [inputs, setInputs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [midi, setMidi] = useState<MidiStatus | null>(null);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [output, setOutput] = useState(() => loadAudioPrefs().outputDevice ?? "");
  const [audio, setAudio] = useState<AudioStatus | null>(null);
  const [gains, setGains] = useState<Record<"master" | "piano", number>>({ master: 80, piano: 80 });
  const [error, setError] = useState<string | null>(null);
  // Keys held with the mouse, so they can be released if the window loses focus.
  const screenHeld = useRef(new Set<number>());

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    try {
      setError(null);
      return await action();
    } catch (e) {
      setError(String(e));
      return undefined;
    }
  }, []);

  const refresh = useCallback(async () => {
    const result = await run(() => Promise.all([backend.midiListInputs(), backend.audioListOutputs()]));
    if (!result) return;
    const [ins, outs] = result;
    setInputs(ins);
    setOutputs(outs);
    setInput((current) => (current && ins.includes(current) ? current : (ins[0] ?? "")));
  }, [run]);

  useEffect(() => {
    if (!desktop) return;
    void refresh();
    void run(async () => {
      const [m, a] = await Promise.all([backend.midiStatus(), backend.audioStatus()]);
      setMidi(m);
      setAudio(a);
      if (m.wanted) setInput(m.wanted);
    });
    const subscriptions = [
      backend.onMidiEvent((event) => dispatch({ type: "event", event })),
      backend.onMidiReset(() => dispatch({ type: "reset" })),
      backend.onMidiStatus(setMidi),
    ];
    return () => subscriptions.forEach((p) => void p.then((unlisten) => unlisten()));
  }, [desktop, refresh, run]);

  const sendKey = useCallback(
    (pitch: number, down: boolean) => {
      if (down) screenHeld.current.add(pitch);
      else screenHeld.current.delete(pitch);
      if (desktop) {
        void run(() => backend.midiSimulate(down ? [0x90, pitch, VELOCITY] : [0x80, pitch, 0]));
      } else {
        dispatch({ type: "event", event: simulatedEvent(pitch, down, VELOCITY) });
      }
    },
    [desktop, run],
  );

  // Losing focus mid-click must not leave an on-screen key stuck (spec §6.1).
  useEffect(() => {
    const onBlur = () => [...screenHeld.current].forEach((p) => sendKey(p, false));
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [sendKey]);

  const setGain = (channel: "master" | "piano", value: number) => {
    setGains((g) => ({ ...g, [channel]: value }));
    if (desktop) void run(() => backend.audioSetGain(channel, value / 100));
  };

  const chooseSoundFont = async () => {
    const path = await run(() => open({ multiple: false, directory: false, filters: [{ name: "SoundFont", extensions: ["sf2"] }] }));
    if (typeof path !== "string") return;
    const status = await run(() => backend.audioLoadSoundFont(path));
    if (!status) return;
    setAudio(status);
    if (status.instrument === "soundfont") saveAudioPrefs({ soundFontPath: path });
  };

  const applyOutput = async () => {
    const status = await run(() => backend.audioOpen(output || null));
    if (!status) return;
    setAudio(status);
    if (status.device) saveAudioPrefs({ outputDevice: output || null });
  };

  const midiLine = midi?.connected
    ? `${t("midiConnected")}: ${midi.connected}`
    : midi?.wanted
      ? `${t("midiWaiting")}: ${midi.wanted}`
      : t("midiNotConnected");

  return (
    <>
      <h1 className="title">{t("soundTitle")}</h1>
      {!desktop && <p className="notice">{t("browserNotice")}</p>}
      {error && (
        <p className="notice error" role="alert">
          {t("errorPrefix")}: {error}
        </p>
      )}

      <div className="cards">
        <section className="card" aria-labelledby="midi-in">
          <h2 id="midi-in">{t("midiInput")}</h2>
          <label className="field">
            {t("midiDevice")}
            <select value={input} onChange={(e) => setInput(e.target.value)} disabled={!desktop || inputs.length === 0}>
              {inputs.length === 0 && <option value="">{t("midiNoDevices")}</option>}
              {inputs.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="button" className="btn" onClick={() => void refresh()} disabled={!desktop}>
              {t("refresh")}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!desktop || !input}
              onClick={() => void run(() => backend.midiConnect(input)).then((s) => s && setMidi(s))}
            >
              {t("connect")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!desktop || !midi?.wanted}
              onClick={() => void run(() => backend.midiDisconnect()).then((s) => s && setMidi(s))}
            >
              {t("disconnect")}
            </button>
          </div>
          <p role="status">
            <span className="badge">{midiLine}</span>
          </p>
          {midi?.error && <p className="muted small">{midi.error}</p>}
          <p className="muted small">{t("midiHint")}</p>
        </section>

        <section className="card" aria-labelledby="caps">
          <h2 id="caps">{t("capTitle")}</h2>
          <dl className="rows">
            {capabilityRows.map(({ key, field }) => (
              <div key={field} className="row-pair">
                <dt>{t(key)}</dt>
                <dd>
                  <span className="badge">{t(`status_${midi?.capabilities[field] ?? "not_yet_tested"}`)}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted small">{t("capHint")}</p>
        </section>

        <section className="card" aria-labelledby="audio-out">
          <h2 id="audio-out">{t("audioOutput")}</h2>
          <label className="field">
            {t("audioDevice")}
            <select value={output} onChange={(e) => setOutput(e.target.value)} disabled={!desktop}>
              <option value="">{t("audioDefault")}</option>
              {outputs.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={!desktop}
              onClick={() => void applyOutput()}
            >
              {t("apply")}
            </button>
            <button type="button" className="btn primary" disabled={!desktop} onClick={() => void run(() => backend.audioTestSound())}>
              {t("testSound")}
            </button>
          </div>
          <dl className="rows">
            <dt>{t("audioDevice")}</dt>
            <dd>{audio?.device ?? t("audioNone")}</dd>
            <dt>{t("sampleRate")}</dt>
            <dd>{audio?.sampleRate ? `${audio.sampleRate} Hz` : "—"}</dd>
            <dt>{t("channels")}</dt>
            <dd>{audio?.channels ?? "—"}</dd>
            <dt>{t("instrument")}</dt>
            <dd>{audio?.instrument === "soundfont" ? audio.soundFont : t("instrumentBasic")}</dd>
            <dt>{t("latency")}</dt>
            <dd>{t("latencyNotMeasured")}</dd>
          </dl>
          {audio?.error && <p className="muted small">{audio.error}</p>}
          <button type="button" className="btn" disabled={!desktop} onClick={() => void chooseSoundFont()}>
            {t("soundFontChoose")}
          </button>
          <p className="muted small">{t("soundFontHint")}</p>
        </section>

        <section className="card" aria-labelledby="volume">
          <h2 id="volume">{t("volume")}</h2>
          {(["master", "piano"] as const).map((channel) => (
            <label key={channel} className="slider">
              <span>{t(channel === "master" ? "gainMaster" : "gainPiano")}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={gains[channel]}
                onChange={(e) => setGain(channel, Number(e.target.value))}
              />
              <span className="muted">{gains[channel]}</span>
            </label>
          ))}
        </section>
      </div>

      <section className="card" aria-labelledby="keyboard">
        <div className="card-head">
          <h2 id="keyboard">{t("keyboardTitle")}</h2>
          <span className="badge">{view.sustain ? t("sustainOn") : t("sustainOff")}</span>
        </div>
        <PianoKeyboard held={view.held} onPress={(p) => sendKey(p, true)} onRelease={(p) => sendKey(p, false)} />
        <p className="muted small">{t("keyboardHint")}</p>
      </section>

      <section className="card" aria-labelledby="monitor">
        <div className="card-head">
          <h2 id="monitor">{t("monitorTitle")}</h2>
          <button type="button" className="btn" onClick={() => dispatch({ type: "clearLog" })}>
            {t("clear")}
          </button>
        </div>
        {view.log.length === 0 ? (
          <p className="muted">{t("monitorEmpty")}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("colTime")}</th>
                  <th scope="col">{t("colSource")}</th>
                  <th scope="col">{t("colEvent")}</th>
                  <th scope="col">{t("colNote")}</th>
                  <th scope="col">{t("colChannel")}</th>
                  <th scope="col">{t("colValue")}</th>
                  <th scope="col">{t("colRaw")}</th>
                </tr>
              </thead>
              <tbody>
                {view.log.slice(0, MONITOR_ROWS).map((e, i) => (
                  <tr key={`${e.timestampUs}-${i}`}>
                    <td>{(e.timestampUs / 1000).toFixed(1)}</td>
                    <td>{e.simulated ? t("sourceSimulated") : t("sourceHardware")}</td>
                    <td>{t(eventLabel[e.kind])}</td>
                    <td>{e.pitch !== null ? `${noteName(e.pitch)} (${e.pitch})` : e.control !== null ? `CC${e.control}` : "—"}</td>
                    <td>{e.channel !== null ? e.channel + 1 : "—"}</td>
                    <td>{e.velocity ?? e.value ?? "—"}</td>
                    <td className="mono">{hex(e.raw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
