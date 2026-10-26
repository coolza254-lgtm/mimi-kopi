import { useEffect, useState } from "react";
import type { MessageKey } from "../i18n/messages";
import { backend, inDesktopApp, type MidiStatus } from "../lib/backend";

interface Props {
  t: (key: MessageKey) => string;
  onOpenSound?: () => void;
}

export default function MidiConnection({ t, onOpenSound }: Props) {
  const desktop = inDesktopApp();
  const [status, setStatus] = useState<MidiStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let receivedUpdate = false;
    let unlisten: (() => void) | undefined;
    setStatus(null);
    setFailed(false);

    const connect = async () => {
      try {
        // Subscribe first so a change between registration and the snapshot is not lost.
        const stop = await backend.onMidiStatus((next) => {
          if (disposed) return;
          receivedUpdate = true;
          setStatus(next);
          setFailed(false);
        });
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        const current = await backend.midiStatus();
        // A live event is newer than a snapshot that was already in flight.
        if (!disposed && !receivedUpdate) setStatus(current);
      } catch {
        if (!disposed && !receivedUpdate) setFailed(true);
      }
    };
    void connect();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [desktop]);

  const state = !desktop ? "simulated"
    : failed || status?.error ? "error"
      : status?.connected ? "connected"
        : status?.wanted ? "waiting"
          : status ? "disconnected" : "unknown";
  const labels: Record<typeof state, MessageKey> = {
    simulated: "midiConnectionSimulated",
    error: "midiConnectionError",
    connected: "midiConnectionConnected",
    waiting: "midiConnectionWaiting",
    disconnected: "midiConnectionDisconnected",
    unknown: "midiConnectionChecking",
  };
  const detail = state === "connected" ? status!.connected
    : state === "simulated" ? t("midiConnectionBrowserHint")
      : t("midiConnectionHelp");
  const needsSetup = desktop && state !== "connected";

  return (
    <div className={`midi-connection ${state}`}>
      <div className="midi-connection-info" role="status" aria-live="polite" aria-atomic="true">
        <strong className="midi-connection-title">{t(labels[state])}</strong>
        <span className="midi-connection-detail">{detail}</span>
      </div>
      {needsSetup && onOpenSound && (
        <button type="button" className="btn" onClick={onOpenSound}>{t("midiConnectionOpen")}</button>
      )}
    </div>
  );
}
