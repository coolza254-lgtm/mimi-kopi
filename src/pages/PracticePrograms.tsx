import { useCallback, useEffect, useRef, useState } from "react";
import ChordFingerGuide from "../components/ChordFingerGuide";
import MidiConnection from "../components/MidiConnection";
import PianoKeyboard from "../components/PianoKeyboard";
import ReadingStaff from "../components/ReadingStaff";
import AnswerFeedback from "../components/AnswerFeedback";
import { uiFeedback } from "../lib/uiFeedback";
import { courseChapters } from "../features/lessons/course";
import { advanceDrill, createDrillPlan, drillPool, inputDrill, pauseDrill, resetDrillInput, resumeDrill, retryDrill, startDrill, type DrillConfig, type DrillKind, type DrillPlan, type DrillRun } from "../features/lessons/drills";
import { appendDrillHistory, comparableChecks, drillRecord, firstTryRate, readDrillHistory, weakTargets, type DrillRecord } from "../features/lessons/drillHistory";
import { noteName } from "../features/midi/notes";
import type { Locale, MessageKey } from "../i18n/messages";
import { backend, inDesktopApp, type MidiEvent } from "../lib/backend";
import "../styles/drills.css";

interface Props {
  t: (key: MessageKey) => string;
  locale: Locale;
  onLegacy: () => void;
  onOpenSound?: () => void;
  onFocusChange?: (focus: boolean) => void;
  initialConfig?: Partial<DrillConfig>;
  course?: { plan: DrillPlan; title: string; purpose?: "assessment" | "practice"; onComplete: (record: DrillRecord) => boolean };
}
const names: Record<DrillKind, MessageKey> = { notes: "drillNotes", staff: "drillStaff", chords: "drillChords" };
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function PracticePrograms({ t, locale, onLegacy, onOpenSound, onFocusChange, initialConfig, course }: Props) {
  const desktop = inDesktopApp();
  const coursePractice = course?.purpose === "practice" || course?.plan.config.mode === "practice";
  const chapterPitches = course?.plan.targets.flatMap((target) => target.pitches);
  const keyboardLow = chapterPitches ? Math.floor(Math.min(...chapterPitches) / 12) * 12 : 48;
  const keyboardHigh = chapterPitches ? Math.ceil(Math.max(...chapterPitches) / 12) * 12 : 84;
  const [config, setConfig] = useState<DrillConfig>(course?.plan.config ?? { kind: "staff", level: 1, count: 24, mode: "practice", ...initialConfig });
  const [plan, setPlan] = useState<DrillPlan | null>(null);
  const [run, setRun] = useState(startDrill);
  const [historyData, setHistoryData] = useState(readDrillHistory);
  const history = historyData.ok ? historyData.records : [];
  const [result, setResult] = useState<DrillRecord | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [keyboard, setKeyboard] = useState(!desktop);
  const [guideId, setGuideId] = useState("C");
  const [customAmount, setCustomAmount] = useState(![12, 24, 48].includes(config.count));
  const [customCount, setCustomCount] = useState(customAmount ? String(config.count) : "36");
  const screenHeld = useRef(new Set<number>());
  const runId = useRef("");
  const saved = useRef(false);
  const lastCue = useRef("");
  const heading = useRef<HTMLHeadingElement>(null);
  const focus = !!plan && !result;

  useEffect(() => { onFocusChange?.(focus); return () => onFocusChange?.(false); }, [focus, onFocusChange]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [plan, result, run.phase === "paused"]);

  const feed = useCallback((event: MidiEvent) => {
    if (!plan || event.pitch === null || (event.kind !== "noteOn" && event.kind !== "noteOff")) return;
    const input = { kind: event.kind, pitch: event.pitch, timeMs: event.timestampUs / 1000, simulated: event.simulated };
    setRun((current) => inputDrill(plan, current, input));
  }, [plan]);
  useEffect(() => {
    if (!desktop || !focus) return;
    let live = true;
    const subscriptions = [backend.onMidiEvent((event) => { if (live) feed(event); }), backend.onMidiReset(() => {
      if (!live) return;
      setConnectionIssue(true);
      setRun(resetDrillInput);
    })];
    subscriptions.forEach((p) => void p.catch(() => { if (live) { setConnectionIssue(true); setRun(pauseDrill); } }));
    return () => { live = false; subscriptions.forEach((p) => void p.then((stop) => stop(), () => undefined)); };
  }, [desktop, focus, feed]);
  const sendKey = useCallback((pitch: number, down: boolean) => {
    if (down) screenHeld.current.add(pitch); else screenHeld.current.delete(pitch);
    if (desktop) void backend.midiSimulate(down ? [0x90, pitch, 90] : [0x80, pitch, 0]).catch(() => { setConnectionIssue(true); setRun(pauseDrill); });
    else feed({ kind: down ? "noteOn" : "noteOff", pitch, timestampUs: performance.now() * 1000, simulated: true } as MidiEvent);
  }, [desktop, feed]);
  const pause = useCallback(() => {
    [...screenHeld.current].forEach((p) => sendKey(p, false));
    setRun(pauseDrill);
  }, [sendKey]);
  useEffect(() => {
    const blur = () => pause();
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); pause(); } };
    if (focus) { window.addEventListener("blur", blur); window.addEventListener("keydown", escape); }
    return () => { window.removeEventListener("blur", blur); window.removeEventListener("keydown", escape); [...screenHeld.current].forEach((p) => sendKey(p, false)); };
  }, [focus, sendKey, pause]);
  useEffect(() => {
    if (!plan || run.phase !== "feedback") return;
    const timer = window.setTimeout(() => setRun((current) => advanceDrill(plan, current)), 450);
    return () => window.clearTimeout(timer);
  }, [plan, run.phase]);
  useEffect(() => {
    if (run.phase !== "feedback" && run.phase !== "review") return;
    const key = `${runId.current}:${run.step}:${run.phase}:${run.wrong}`;
    if (lastCue.current !== key) { lastCue.current = key; uiFeedback.play(run.phase === "feedback" ? "correct" : "wrong"); }
  }, [run.step, run.phase, run.wrong]);

  const finish = useCallback((current: DrillRun) => {
    if (!plan || saved.current) return;
    saved.current = true;
    if (!current.trials.length) { setPlan(null); return; }
    const record = drillRecord(plan, current, new Date(), runId.current);
    const historySaved = appendDrillHistory(record);
    const chapterSaved = !record.completed || !course || coursePractice || course.onComplete(record);
    setSaveFailed(!historySaved || !chapterSaved);
    setResult(record);
    setHistoryData(readDrillHistory());
  }, [plan, course, coursePractice]);
  useEffect(() => { if (run.phase === "finished") finish(run); }, [run, finish]);

  const begin = () => {
    const nextConfig = { ...config, count: customAmount ? Math.max(12, Math.min(120, Math.round(Number(customCount) || 12))) : config.count };
    setConfig(nextConfig);
    if (customAmount) setCustomCount(String(nextConfig.count));
    saved.current = false;
    runId.current = crypto.randomUUID();
    setConnectionIssue(false); setSaveFailed(false); setResult(null); setRun(startDrill());
    setPlan(course?.plan ?? createDrillPlan(nextConfig, crypto.getRandomValues(new Uint32Array(1))[0]));
  };
  const back = () => { setResult(null); setPlan(null); setRun(startDrill()); };
  const pool = drillPool(config);
  const guide = pool.find((entry) => entry.id === guideId) ?? pool[0];
  const target = plan?.targets[Math.min(run.step, plan.targets.length - 1)];
  const previous = result ? comparableChecks(history, result).at(-1) : undefined;
  const targetName = (id: string) => config.kind === "chords" ? drillPool({ ...config, level: 3 }).find((item) => item.id === id)?.name ?? id : noteName(Number(id));
  const historyIssue = !historyData.ok && <div className="notice error"><p role="alert">{t("pathLoadError")}</p><button className="btn text" onClick={() => setHistoryData(readDrillHistory())}>{t("pathRetry")}</button></div>;

  if (result) return <div className="drill-results">
    <header className="page-head"><h1 className="title" ref={heading} tabIndex={-1}>{t(result.completed ? "drillResults" : "drillPartial")}</h1><span className="badge">{t(result.simulated ? "drillSimulated" : "todayPianoRuns")}</span></header>
    <div className="drill-result-stats">
      <div><span>{t("drillFirst")}</span><strong>{pct(firstTryRate(result))}</strong><small>{result.trials.filter((item) => item.firstTry).length} / {result.trials.length}</small></div>
      <div><span>{t("drillErrors")}</span><strong>{result.trials.reduce((sum, item) => sum + item.wrong, result.pending?.wrong ?? 0)}</strong></div>
      <div><span>{t("drillDone")}</span><strong>{result.trials.length} / {result.plan.count}</strong></div>
    </div>
    {saveFailed && <p className="notice error" role="alert">{t("resultSaveFailed")}</p>}
    {historyIssue}
    <section className="card"><h2>{t("drillWeak")}</h2>{weakTargets(result).length ? <ul className="drill-weak">{weakTargets(result).map((item) => <li key={item.id}><strong>{targetName(item.id)}</strong><span>{item.wrong} {t("drillTimes")}</span></li>)}</ul> : <p>{t("drillNoWeak")}</p>}</section>
    {result.plan.mode === "check" && previous ? <section className="card"><h2>{t("drillPrevious")}</h2><p className="drill-comparison">{pct(firstTryRate(previous))} → {pct(firstTryRate(result))}</p><p className="muted small">{Math.round((firstTryRate(result) - firstTryRate(previous)) * 100)} {t("drillDelta")}</p></section> : <p className="muted small">{t(result.plan.mode === "practice" ? "drillPracticeResult" : "drillNoComparison")}</p>}
    <div className="actions"><button type="button" className="btn primary" onClick={begin}>{t("drillRetry")}</button><button type="button" className="btn" onClick={course ? onLegacy : back}>{t(course ? "learnBack" : "drillExit")}</button></div>
  </div>;

  if (plan && target) return <div data-ui-sound="off" className={`drill-focus${keyboard ? " with-keyboard" : ""}${run.phase === "feedback" ? " correct" : run.lastWrong !== null ? " incorrect" : ""}`}>
    <header className="drill-focus-top"><div className="session-progress"><span>{Math.min(run.step + 1, plan.config.count)} / {plan.config.count}{run.simulated && ` · ${t("drillSimulated")}`}</span><progress aria-label={t("drillDone")} value={run.trials.length} max={plan.config.count} /></div>{run.phase !== "paused" && <button type="button" className="btn text" onClick={pause}>{t("drillPause")}</button>}</header>
    {run.phase === "paused" ? <section className="drill-paused">
      <h1 className="title" ref={heading} tabIndex={-1}>{t("drillPaused")}</h1>
      {connectionIssue && <p className="notice" role="status">{t("drillDeviceReset")}</p>}
      <MidiConnection t={t} onOpenSound={onOpenSound} />
      {plan.config.kind === "chords" && <ChordFingerGuide key={target.id} target={target} t={t} />}
      <label className="check"><input type="checkbox" checked={keyboard} onChange={(e) => setKeyboard(e.target.checked)} />{t("drillScreen")}</label>
      <div className="actions"><button type="button" className="btn primary" onClick={() => { setConnectionIssue(false); setRun(resumeDrill); }}>{t("drillResume")}</button><button type="button" className="btn" onClick={() => finish(run)}>{t("drillEnd")}</button></div>
    </section> : <>
      <section className="drill-question" aria-label={t(names[plan.config.kind])}>
        {plan.config.kind === "staff" ? <><h1 className="sr-only" ref={heading} tabIndex={-1}>{t("drillReadPrompt")}</h1><ReadingStaff pitch={target.pitches[0]} label={`${t("drillReadPrompt")}: ${noteName(target.pitches[0])}`} /></> : <><h1 className="drill-question-label" ref={heading} tabIndex={-1}>{t(plan.config.kind === "chords" ? "drillChordPrompt" : "drillNamePrompt")}</h1><div className="drill-big">{target.name ?? noteName(target.pitches[0])}</div></>}
      </section>
      <AnswerFeedback state={run.phase === "feedback" ? "correct" : run.phase === "review" ? "wrong" : null} t={t} message={run.phase === "review" && run.lastWrong !== null ? t("answerPlayed").replace("{actual}", noteName(run.lastWrong)).replace("{expected}", target.pitches.map(noteName).join(" + ")) : run.phase === "feedback" && run.held.length ? t("answerReleaseNext") : run.phase === "release" ? t("drillRelease") : undefined} onRetry={() => setRun(retryDrill)} />
      {keyboard && <div className="drill-screen"><span className="small muted">{t("drillScreen")}{plan.config.kind === "chords" && ` · ${t("drillLatch")}`}</span><PianoKeyboard held={run.held} low={keyboardLow} high={keyboardHigh} latch={plan.config.kind === "chords"} labels={Object.fromEntries(Array.from({ length: keyboardHigh - keyboardLow + 1 }, (_, i) => [keyboardLow + i, ""]))} onPress={(p) => sendKey(p, true)} onRelease={(p) => sendKey(p, false)} /></div>}
    </>}
  </div>;

  if (course) return <section className="learn-check-intro">
    <button className="btn text" onClick={onLegacy}>{t("learnBack")}</button>
    <h1 className="title">{course.title} · {t(coursePractice ? "drillPractice" : "learnCheck")}</h1><p>{t(coursePractice ? "drillPracticeResult" : "learnCheckHint")}</p>
    {historyIssue}
    <MidiConnection t={t} onOpenSound={onOpenSound} />
    <button className="btn primary big" onClick={begin}>{t("drillBegin")}</button>
  </section>;
  const reference = createDrillPlan({ ...config, count: customAmount ? Math.max(12, Math.min(120, Math.round(Number(customCount) || 12))) : config.count, mode: "check" }, 0).key;
  const checks = history.filter((r) => r.completed && r.key === reference);
  const rangeName = (c: DrillConfig) => c.kind === "chords" ? drillPool(c).map((item) => item.name).join(" · ") : t(c.level === 1 ? "drillLow" : c.level === 2 ? "drillMiddle" : "drillWide");
  const recordRange = (record: DrillRecord) => { const chapter = courseChapters.find((item) => record.key === `learn-v1:${item.id}:12` || record.key === `learn-practice-v1:${item.id}:${record.plan.count}`); return chapter ? t(chapter.title) : rangeName(record.plan); };
  return <div className="programs">
    <header className="page-head"><h1 className="title" ref={heading} tabIndex={-1}>{t("drillTitle")}</h1><button type="button" className="btn text" onClick={onLegacy}>{t("drillLegacyOpen")}</button></header>
    <div className="program-picker" role="group" aria-label={t("drillTitle")}>
      {(["notes", "staff", "chords"] as const).map((kind) => <button key={kind} type="button" className={`program-choice${config.kind === kind ? " selected" : ""}`} aria-pressed={config.kind === kind} onClick={() => setConfig((c) => ({ ...c, kind }))}><strong>{t(names[kind])}</strong><span>{t(kind === "notes" ? "drillNotesHint" : kind === "staff" ? "drillStaffHint" : "drillChordsHint")}</span></button>)}
    </div>
    <section className="card program-settings">
      <div className="program-fields">
        <label className="field">{t("drillLevel")}<select value={config.level} onChange={(e) => setConfig({ ...config, level: Number(e.target.value) as DrillConfig["level"] })}>{[1, 2, 3].map((level) => <option key={level} value={level}>{config.kind === "chords" ? ["C · G", "C · G · Am", "C · G · Am · F"][level - 1] : t(level === 1 ? "drillLow" : level === 2 ? "drillMiddle" : "drillWide")}</option>)}</select></label>
        <label className="field">{t("drillAmount")}<select value={customAmount ? "custom" : config.count} onChange={(e) => { setCustomAmount(e.target.value === "custom"); if (e.target.value !== "custom") setConfig({ ...config, count: Number(e.target.value) }); }}><option value="12">{t("drillLight")}</option><option value="24">{t("drillNormal")}</option><option value="48">{t("drillIntense")}</option><option value="custom">{t("drillCustom")}</option></select></label>
        {customAmount && <label className="field">{t("drillCustom")} (12–120)<input type="number" min={12} max={120} step={1} value={customCount} onChange={(e) => setCustomCount(e.target.value)} /></label>}
        <label className="field">{t("drillMode")}<select value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value as DrillConfig["mode"] })}><option value="practice">{t("drillPractice")}</option><option value="check">{t("drillCheck")}</option></select></label>
      </div>
      {config.mode === "check" && <p className="small muted">{t("drillCheckHint")}</p>}
      <MidiConnection t={t} onOpenSound={onOpenSound} />
      {config.kind === "chords" && <><div className="choice-row">{pool.map((entry) => <button type="button" key={entry.id} className="choice compact" aria-pressed={guide.id === entry.id} onClick={() => setGuideId(entry.id)}>{entry.name}</button>)}</div><ChordFingerGuide key={guide.id} target={guide} t={t} /></>}
      <div className="actions"><button type="button" className="btn primary big" onClick={begin}>{t("drillBegin")}</button></div>
    </section>
    <section className="program-history" aria-labelledby="program-history"><h2 id="program-history">{t("drillHistory")}</h2>
      {historyIssue || (!history.length ? <p className="muted">{t("drillEmpty")}</p> : <>
        {checks.length > 1 && <CheckTrend records={checks} t={t} locale={locale} />}
        <ul>{history.slice(-8).reverse().map((record) => <li key={record.id}><div><strong>{t(names[record.plan.kind])} · {t(record.plan.mode === "check" ? "drillCheck" : "drillPractice")}</strong><span>{new Date(record.at).toLocaleDateString(locale)} · {record.trials.length}/{record.plan.count} · {recordRange(record)}{record.simulated ? ` · ${t("drillSimulated")}` : ""}{!record.completed ? ` · ${t("drillPartial")}` : ""}</span></div><span aria-label={t("drillFirstLabel")}>{pct(firstTryRate(record))}</span></li>)}</ul>
      </>)}
    </section>
  </div>;
}

function CheckTrend({ records, t, locale }: { records: DrillRecord[]; t: Props["t"]; locale: Locale }) {
  const real = records.filter((r) => !r.simulated).slice(-6);
  const simulated = records.filter((r) => r.simulated).slice(-6);
  const series = real.length > 1 ? real : simulated;
  if (series.length < 2) return null;
  const points = series.map((r, i) => ({ x: 40 + i * 300 / (series.length - 1), y: 125 - firstTryRate(r) * 95, r }));
  return <div className="check-trend"><p className="small muted">{t("pathFamiliar")} · {t(series[0].simulated ? "drillSimulated" : "todayPianoRuns")}</p><svg viewBox="0 0 380 170" role="img" aria-label={`${t("drillProgress")}: ${series.map((r) => pct(firstTryRate(r))).join(", ")}`}>
    <line className="trend-axis" x1="25" x2="355" y1="125" y2="125" />
    <polyline className="trend-line" points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
    {points.map(({ x, y, r }) => <g key={r.id}><circle className="trend-point" cx={x} cy={y} r="4" /><text x={x} y={y - 10} textAnchor="middle">{pct(firstTryRate(r))}</text><text x={x} y="150" textAnchor="middle">{new Date(r.at).toLocaleDateString(locale, { day: "numeric", month: "numeric" })}</text></g>)}
  </svg></div>;
}
