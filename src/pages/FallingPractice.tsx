import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import PianoKeyboard from "../components/PianoKeyboard";
import { noteName, isBlackKey } from "../features/midi/notes";
import {
  rollFinished,
  rollGeometry,
  rollInput,
  rollPlan,
  rollTick,
  startRoll,
  type RollPlan,
  type RollState,
} from "../features/score/roll";
import type { Song, ScoreHand } from "../features/score/score";
import type { MessageKey } from "../i18n/messages";
import { backend, inDesktopApp, type MidiEvent } from "../lib/backend";
import { RollAudio } from "../lib/rollAudio";
import "../styles/falling.css";

type Status = "ready" | "running" | "paused" | "done";
interface Props {
  song: Song;
  hands: ScoreHand | "both";
  from: number;
  to: number;
  speed: number;
  t: (key: MessageKey) => string;
  onBack: () => void;
  onFocusChange?: (focus: boolean) => void;
  onComplete: (
    simulated: boolean,
    selection: { from: number; to: number },
  ) => boolean;
}
const clock = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;

const laneCache = new WeakMap<RollPlan, ReturnType<typeof rollGeometry>>();

function paint(
  canvas: HTMLCanvasElement,
  plan: RollPlan,
  run: RollState,
  listen: boolean,
  hints: boolean,
  reduced: boolean,
  beat: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1,
    width = canvas.width / ratio,
    height = canvas.height / ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const dark = document.documentElement.dataset.theme === "dark";
  ctx.clearRect(0, 0, width, height);
  let keys = laneCache.get(plan);
  if (!keys) {
    keys = rollGeometry(plan.low, plan.high);
    laneCache.set(plan, keys);
  }
  const horizon = 3.5;
  for (const [pitch, key] of keys) {
    if (isBlackKey(pitch)) continue;
    ctx.fillStyle = dark
      ? pitch % 12 === 0
        ? "#ffffff06"
        : "#ffffff02"
      : pitch % 12 === 0
        ? "#20203005"
        : "#20203002";
    ctx.fillRect(key.x * width, 0, key.width * width, height);
    ctx.fillStyle = dark ? "#ffffff0a" : "#1717250a";
    ctx.fillRect(key.x * width, 0, 1, height);
  }
  if (!reduced)
    for (
      let time = Math.ceil(Math.max(0, run.time) / beat) * beat;
      time < run.time + horizon;
      time += beat
    ) {
      const y = height - ((time - run.time) / horizon) * height;
      ctx.fillStyle = dark ? "#ffffff0b" : "#1717250b";
      ctx.fillRect(0, y, width, 1);
    }
  const step = listen
    ? [...plan.steps].reverse().find((s) => s.start <= run.time)
    : plan.steps[run.step];
  for (const n of plan.notes) {
    if (n.start + n.dur < run.time || n.start > run.time + horizon) continue;
    if (reduced && (!step || n.start !== step.start)) continue;
    const key = keys.get(n.pitch)!;
    const bottom = reduced
      ? height - 8
      : height - ((n.start - run.time) / horizon) * height;
    const barHeight = reduced
      ? Math.min(140, height * 0.4)
      : Math.max(9, (n.dur / horizon) * height - 3);
    const x = key.x * width + 2,
      y = bottom - barHeight,
      w = Math.max(3, key.width * width - 4);
    const left = n.hand === "L",
      active = n.start <= run.time + 0.025 && n.start + n.dur > run.time;
    const gradient = ctx.createLinearGradient(x, Math.max(0, y), x + w, bottom);
    gradient.addColorStop(0, left ? "#81edc2" : "#8dbaff");
    gradient.addColorStop(1, left ? "#18ad7a" : "#367cf1");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, w, barHeight, Math.min(7, w / 3));
    ctx.fill();
    ctx.strokeStyle = dark ? "#ffffff55" : "#ffffffa0";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (hints && w > 23 && bottom > 20 && y < height - 10) {
      ctx.fillStyle = "#07182f";
      ctx.font = '700 11px "Noto Sans Thai Variable", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(
        noteName(n.pitch),
        x + w / 2,
        Math.min(height - 12, Math.max(18, bottom - 13)),
      );
    }
    if (active) {
      const glow = ctx.createRadialGradient(
        x + w / 2,
        height,
        0,
        x + w / 2,
        height,
        70,
      );
      glow.addColorStop(0, left ? "#31dda46b" : "#589eff6b");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 70, height - 70, w + 140, 70);
    }
  }
  const fade = ctx.createLinearGradient(0, 0, 0, Math.min(80, height / 3));
  fade.addColorStop(0, dark ? "#080909" : "#f7f8fa");
  fade.addColorStop(1, dark ? "#08090900" : "#f7f8fa00");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, Math.min(80, height / 3));
}

export default function FallingPractice({
  song,
  hands,
  from,
  to,
  speed: initialSpeed,
  t,
  onBack,
  onFocusChange,
  onComplete,
}: Props) {
  const desktop = inDesktopApp();
  const [selection, setSelection] = useState({ from, to });
  const [connected, setConnected] = useState(!desktop),
    [retryRequested, setRetryRequested] = useState(false);
  const resumeButton = useRef<HTMLButtonElement>(null);
  const [speed, setSpeed] = useState(initialSpeed),
    [listen, setListen] = useState(false),
    [hints, setHints] = useState(true),
    [loop, setLoop] = useState(false);
  const [status, setStatus] = useState<Status>("ready"),
    [issue, setIssue] = useState(false),
    [saved, setSaved] = useState(true),
    [attempt, setAttempt] = useState(0),
    [busy, setBusy] = useState(false);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const plan = useMemo(
    () => rollPlan(song, hands, selection.from, selection.to, speed),
    [song, hands, selection.from, selection.to, speed],
  );
  const startToken = useRef(0);
  const successAt = useRef(-1000);
  const run = useRef(startRoll()),
    statusRef = useRef<Status>("ready"),
    alive = useRef(true),
    canvas = useRef<HTMLCanvasElement>(null),
    screenHeld = useRef(new Set<number>());
  const guide = useRef(new Map<number, number>()),
    cursor = useRef(0),
    failRef = useRef<() => void>(() => undefined),
    completed = useRef(false),
    completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const audio = useMemo(
    () =>
      new RollAudio(
        desktop
          ? (p, down) =>
              backend.midiSimulate(down ? [0x90, p, 80] : [0x80, p, 0])
          : undefined,
        () => failRef.current(),
      ),
    [desktop],
  );
  const releaseScreen = useCallback(() => {
    const pitches = new Set(screenHeld.current);
    pitches.forEach((p) => audio.note(p, false));
    screenHeld.current.clear();
    run.current = {
      ...run.current,
      held: run.current.held.filter((p) => !pitches.has(p)),
    };
  }, [audio]);
  const events = useMemo(
    () =>
      plan.notes
        .flatMap((n) => [
          { at: n.start, pitch: n.pitch, down: true },
          { at: n.start + n.dur, pitch: n.pitch, down: false },
        ])
        .sort((a, b) => a.at - b.at || Number(a.down) - Number(b.down)),
    [plan],
  );
  const [reduced, setReduced] = useState(false);
  const changeStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);
  const clear = useCallback(() => {
    audio.stop();
    screenHeld.current.clear();
    guide.current.clear();
    run.current = { ...run.current, held: [], pressed: [], extra: [] };
  }, [audio]);
  const pause = useCallback(() => {
    if (statusRef.current === "running") {
      clear();
      changeStatus("paused");
    }
  }, [clear, changeStatus]);
  failRef.current = () => {
    if (alive.current) {
      setIssue(true);
      pause();
    }
  };
  useEffect(() => {
    alive.current = true;
    const blur = () => {
        startToken.current++;
        pause();
      },
      visibility = () => {
        if (document.hidden) {
          startToken.current++;
          pause();
        }
      };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    motion();
    media.addEventListener("change", motion);
    return () => {
      alive.current = false;
      startToken.current++;
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
      audio.dispose();
    };
  }, [audio, pause]);
  useEffect(() => {
    onFocusChange?.(
      status === "running" ||
        status === "paused" ||
        (status === "done" && loop && saved),
    );
    return () => onFocusChange?.(false);
  }, [status, loop, saved, onFocusChange]);
  const feed = useCallback(
    (e: MidiEvent) => {
      if (e.pitch === null || statusRef.current !== "running" || listen) return;
      if (e.kind !== "noteOn" && e.kind !== "noteOff") return;
      const before = run.current.step;
      run.current = rollInput(
        plan,
        run.current,
        e.pitch,
        e.kind === "noteOn" && e.velocity !== 0,
        e.simulated,
      );
      if (run.current.step !== before) {
        successAt.current = performance.now();
        releaseScreen();
      }
      redraw();
    },
    [plan, listen, releaseScreen],
  );
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    setConnected(false);
    const subscriptions = [
      backend.onMidiEvent((e) => {
        if (active && !e.simulated) feed(e);
      }),
      backend.onMidiReset(() => {
        if (active) {
          clear();
          pause();
        }
      }),
    ];
    void Promise.all(subscriptions)
      .then(() => {
        if (active) {
          setConnected(true);
          setIssue(false);
        }
      })
      .catch(() => undefined);
    const stops: (() => void)[] = [];
    subscriptions.forEach((p) => {
      void p
        .then((unlisten) => {
          if (!active) unlisten();
          else stops.push(unlisten);
        })
        .catch(() => {
          if (active) failRef.current();
        });
    });
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
  }, [desktop, feed, clear, pause, attempt]);
  const start = async (restart: boolean) => {
    if (busy || !connected || document.hidden) return;
    const token = ++startToken.current;
    setBusy(true);
    setIssue(false);
    try {
      await audio.arm();
      if (!alive.current || token !== startToken.current) return;
      clear();
      if (restart) {
        run.current = startRoll();
        completed.current = false;
        setSaved(true);
      }
      cursor.current = 0;
      while (
        cursor.current < events.length &&
        events[cursor.current].at <= run.current.time
      )
        cursor.current++;
      if (listen)
        for (const n of plan.notes)
          if (
            n.start <= run.current.time &&
            n.start + n.dur > run.current.time
          ) {
            const count = guide.current.get(n.pitch) ?? 0;
            guide.current.set(n.pitch, count + 1);
            if (!count) audio.note(n.pitch, true);
          }
      changeStatus("running");
      redraw();
    } catch {
      if (alive.current) {
        setIssue(true);
        changeStatus("paused");
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (connected && retryRequested) {
      setRetryRequested(false);
      void start(false);
    }
  });
  useEffect(() => {
    if (status === "paused") resumeButton.current?.focus();
  }, [status]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      element.width = Math.max(1, Math.round(bounds.width * ratio));
      element.height = Math.max(1, Math.round(bounds.height * ratio));
      paint(
        element,
        plan,
        run.current,
        listen,
        hints,
        reduced,
        60 / song.tempo / speed,
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [plan, listen, hints, reduced, song.tempo, speed, status]);
  useEffect(() => {
    if (status !== "running") return;
    let frame = 0,
      previous = performance.now(),
      lastUi = previous;
    const tick = (now: number) => {
      if (statusRef.current !== "running") return;
      const delta = (now - previous) / 1000;
      previous = now;
      // A background suspension must not jump the song or silently skip notes.
      if (delta > 0.5) {
        pause();
        return;
      }
      const before = run.current.step;
      run.current = rollTick(plan, run.current, delta, listen);
      if (run.current.step !== before) {
        successAt.current = now;
        releaseScreen();
      }
      if (listen)
        while (
          cursor.current < events.length &&
          events[cursor.current].at <= run.current.time
        ) {
          const e = events[cursor.current++],
            count = guide.current.get(e.pitch) ?? 0;
          if (e.down) {
            guide.current.set(e.pitch, count + 1);
            audio.note(e.pitch, true);
          } else {
            guide.current.set(e.pitch, Math.max(0, count - 1));
            if (count <= 1) {
              guide.current.delete(e.pitch);
              audio.note(e.pitch, false);
            }
          }
        }
      if (canvas.current)
        paint(
          canvas.current,
          plan,
          run.current,
          listen,
          hints,
          reduced,
          60 / song.tempo / speed,
        );
      if (now - lastUi > 80 || run.current.step !== before) {
        redraw();
        lastUi = now;
      }
      if (rollFinished(plan, run.current, listen)) {
        audio.stop();
        guide.current.clear();
        screenHeld.current.clear();
        run.current = { ...run.current, held: [], pressed: [], extra: [] };
        changeStatus("done");
        if (!listen && !completed.current) {
          completed.current = true;
          setSaved(
            completeRef.current(
              run.current.simulated || !run.current.realSeen,
              selection,
            ),
          );
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    status,
    plan,
    listen,
    hints,
    reduced,
    speed,
    song.tempo,
    events,
    audio,
    pause,
    changeStatus,
    releaseScreen,
    selection,
  ]);
  useEffect(() => {
    if (status !== "done" || !loop || !saved || run.current.held.length) return;
    const timer = window.setTimeout(() => void start(true), 1200);
    return () => window.clearTimeout(timer);
  });
  const screenKey = (pitch: number, down: boolean) => {
    if (statusRef.current !== "running" || listen) return;
    if (down) screenHeld.current.add(pitch);
    else screenHeld.current.delete(pitch);
    audio.note(pitch, down);
    feed({
      kind: down ? "noteOn" : "noteOff",
      pitch,
      velocity: down ? 80 : 0,
      timestampUs: performance.now() * 1000,
      simulated: true,
    } as MidiEvent);
  };
  const current = run.current,
    target = listen
      ? ([...plan.steps].reverse().find((step) => step.start <= current.time) ??
        plan.steps[0])
      : plan.steps[current.step],
    waiting = !listen && target && current.time >= target.start;
  const targetNotes = plan.notes.filter((n) => n.start === target?.start);
  const targets =
    !listen && target && current.time >= target.start - 0.18
      ? target.pitches
      : [];
  const left = targetNotes.filter((n) => n.hand === "L").map((n) => n.pitch);
  const shownHeld = listen ? [...guide.current.keys()] : current.held;
  const leftHeld = shownHeld.filter((pitch) => {
    const preceding = plan.notes.filter(
      (n) => n.pitch === pitch && n.start <= current.time + (listen ? 0 : 0.18),
    );
    return preceding[preceding.length - 1]?.hand === "L";
  });
  const names = hints && target ? target.pitches.map(noteName).join(" + ") : "";
  const active =
    status === "running" ||
    status === "paused" ||
    (status === "done" && loop && saved);
  return (
    <section className={`falling-practice${active ? " is-active" : ""}`}>
      <header className="falling-top">
        <button
          type="button"
          className="btn"
          onClick={() => {
            clear();
            onBack();
          }}
        >
          ‹ {t("back")}
        </button>
        <div>
          <span className="eyebrow">{t("rollOpen")}</span>
          <h1>{song.title}</h1>
        </div>
        <span className="falling-source">
          {t(
            !desktop || current.simulated
              ? "rollSimulated"
              : current.realSeen
                ? "rollReal"
                : "rollInputReady",
          )}
        </span>
        {active && (
          <button
            type="button"
            className="btn"
            onClick={pause}
            disabled={status !== "running"}
          >
            {t("rollPause")}
          </button>
        )}
      </header>
      {status === "ready" ? (
        <div className="falling-setup card">
          <div className="falling-cover" aria-hidden="true">
            {[22, 46, 16, 65, 38, 80, 28].map((height, i) => (
              <i
                key={i}
                className={i % 2 ? "right" : "left"}
                style={{
                  height: `${height}%`,
                  left: `${12 + i * 11}%`,
                  top: `${8 + (i % 3) * 6}%`,
                }}
              />
            ))}
            <div className="falling-cover-keys">
              {Array.from({ length: 14 }, (_, i) => (
                <b key={i} />
              ))}
            </div>
          </div>
          <div className="falling-setup-body">
            <span className="eyebrow">
              {t("measureShort")} {selection.from + 1}–{selection.to + 1} ·{" "}
              {plan.notes.length} {t("rollNotes")}
            </span>
            <h2>{t("rollTitle")}</h2>
            <div className="falling-legend">
              <span className="left">{t("rollLeft")}</span>
              <span className="right">{t("rollRight")}</span>
            </div>
            <div
              className="falling-modes"
              role="group"
              aria-label={t("rollMode")}
            >
              <button
                type="button"
                aria-pressed={!listen}
                onClick={() => setListen(false)}
              >
                {t("rollWait")}
              </button>
              <button
                type="button"
                aria-pressed={listen}
                onClick={() => setListen(true)}
              >
                {t("rollListen")}
              </button>
            </div>
            <p className="small muted">
              {t(listen ? "rollListenHelp" : "rollWaitHelp")}
            </p>
            <details className="falling-range">
              <summary>
                {t("rollRange")} · {t("measureShort")} {selection.from + 1}–
                {selection.to + 1}
              </summary>
              <div className="falling-range-fields">
                <label>
                  {t("playFrom")}
                  <select
                    value={selection.from}
                    onChange={(e) =>
                      setSelection((r) => ({
                        from: Number(e.target.value),
                        to: Math.max(r.to, Number(e.target.value)),
                      }))
                    }
                  >
                    {Array.from({ length: song.measures }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("playTo")}
                  <select
                    value={selection.to}
                    onChange={(e) =>
                      setSelection((r) => ({
                        from: Math.min(r.from, Number(e.target.value)),
                        to: Number(e.target.value),
                      }))
                    }
                  >
                    {Array.from({ length: song.measures }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <div className="falling-options">
              <label>
                {t("playSpeed")}
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  {[0.25, 0.5, 0.75, 1].map((v) => (
                    <option key={v} value={v}>
                      {v * 100}%
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={hints}
                  onChange={(e) => setHints(e.target.checked)}
                />
                {t("rollHints")}
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!reduced}
                  onChange={(e) => setReduced(!e.target.checked)}
                />
                {t("rollAnimate")}
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                />
                {t("rollLoop")}
              </label>
            </div>
            {issue && (
              <div role="alert">
                <p>{t("rollError")}</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setIssue(false);
                    setAttempt((n) => n + 1);
                  }}
                >
                  {t("rollRetry")}
                </button>
              </div>
            )}
            {!desktop && listen && (
              <p className="small muted">{t("rollGuide")}</p>
            )}
            <button
              type="button"
              className="btn primary big"
              disabled={busy || !connected || issue || !plan.notes.length}
              onClick={() => void start(true)}
            >
              {t(plan.notes.length ? "rollStart" : "rollEmpty")}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : status === "done" ? (
        <div className="falling-result card">
          <span className="falling-complete" aria-hidden="true">
            ✓
          </span>
          <h2>{t(listen ? "rollHeard" : "rollDone")}</h2>
          <p className="muted">{song.title}</p>
          {!listen && (
            <>
              <div className="falling-result-stats">
                <div>
                  <strong>
                    {current.step} / {plan.steps.length}
                  </strong>
                  <span>{t("rollGroups")}</span>
                </div>
                <div>
                  <strong>{current.wrong}</strong>
                  <span>{t("rollWrong")}</span>
                </div>
              </div>
              <p className="small muted">
                {t(
                  current.simulated || !current.realSeen
                    ? "rollSimulated"
                    : "rollReal",
                )}{" "}
                · {t("rollRecord")}
              </p>
            </>
          )}
          {!saved && (
            <div role="alert">
              <p>{t("rollSaveError")}</p>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSaved(
                    completeRef.current(
                      current.simulated || !current.realSeen,
                      selection,
                    ),
                  )
                }
              >
                {t("rollRetrySave")}
              </button>
            </div>
          )}
          <div className="actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => void start(true)}
              disabled={busy}
            >
              {t("rollAgain")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                clear();
                changeStatus("ready");
              }}
            >
              {t("back")}
            </button>
          </div>
        </div>
      ) : (
        <div className="falling-stage">
          <div
            className="falling-progress"
            role="progressbar"
            aria-label={t("rollOpen")}
            aria-valuemin={0}
            aria-valuemax={plan.duration}
            aria-valuenow={Math.max(0, current.time)}
          >
            <i
              style={{
                width: `${(Math.max(0, current.time) / Math.max(1, plan.duration)) * 100}%`,
              }}
            />
          </div>
          <div className="falling-hud">
            <span>
              {t(listen ? "rollListen" : "rollWait")} ·{" "}
              {Math.round(speed * 100)}%
            </span>
            <div
              className={`falling-prompt${current.lastWrong !== null ? " wrong" : performance.now() - successAt.current < 300 ? " correct" : ""}`}
              aria-live="polite"
            >
              <span>
                {t(
                  current.lastWrong !== null
                    ? "tryAgain"
                    : performance.now() - successAt.current < 300
                      ? "rollCorrect"
                      : waiting
                        ? "rollWaiting"
                        : listen
                          ? "rollListen"
                          : "rollMoving",
                )}
              </span>
              {names && (
                <strong>
                  {current.lastWrong !== null
                    ? `${noteName(current.lastWrong)} → `
                    : ""}
                  {names}
                </strong>
              )}
            </div>
            <span>
              {clock(current.time)} / {clock(plan.duration)}
            </span>
          </div>
          <div className="falling-lanes">
            <canvas ref={canvas} aria-hidden="true" />
            {status === "paused" && (
              <div className="falling-pause">
                <div>
                  <span className="eyebrow">
                    {t(issue ? "rollError" : "rollPaused")}
                  </span>
                  <h2>{t("rollReady")}</h2>
                  <button
                    ref={resumeButton}
                    type="button"
                    className="btn primary big"
                    disabled={busy || (!connected && !issue)}
                    onClick={() => {
                      if (issue && desktop) {
                        setConnected(false);
                        setRetryRequested(true);
                        setAttempt((n) => n + 1);
                      } else void start(false);
                    }}
                  >
                    {t(issue ? "rollRetry" : "rollResume")} →
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className={`falling-keyboard${listen ? " guide" : ""}`}>
            <PianoKeyboard
              held={shownHeld}
              leftHeld={leftHeld}
              targets={targets}
              leftTargets={left}
              low={plan.low}
              high={plan.high}
              latch
              onPress={(p) => screenKey(p, true)}
              onRelease={(p) => screenKey(p, false)}
            />
          </div>
          {reduced && <p className="falling-motion small">{t("rollMotion")}</p>}
        </div>
      )}
    </section>
  );
}
