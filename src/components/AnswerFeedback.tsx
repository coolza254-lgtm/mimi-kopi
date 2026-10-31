import type { MessageKey } from "../i18n/messages";
import { useEffect, useRef } from "react";

interface Props {
  state: "correct" | "wrong" | null;
  message?: string;
  onRetry?: () => void;
  t: (key: MessageKey) => string;
}
export default function AnswerFeedback({ state, message, onRetry, t }: Props) {
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (state === "wrong") retry.current?.focus({ preventScroll: true }); }, [state]);
  return <div className="answer-feedback" data-state={state ?? "idle"}>
    <div className="answer-feedback-copy" role="status" aria-live="polite" aria-atomic="true">
      {state && <><span className="answer-feedback-icon" aria-hidden="true">{state === "correct" ? "✓" : "!"}</span><div><strong>{t(state === "correct" ? "answerAuto" : "answerWrongTitle")}</strong>{message && <p>{message}</p>}</div></>}
      {!state && message && <p>{message}</p>}
    </div>
    {state === "wrong" && onRetry && <button ref={retry} className="btn primary" onClick={onRetry}>{t("answerRetry")}</button>}
  </div>;
}
