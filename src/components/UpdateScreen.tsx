import { useEffect, useRef } from "react";
import type { MessageKey } from "../i18n/messages";
import type { InstallProgress } from "../lib/updates";
import "../styles/update-screen.css";

interface Props {
  t: (key: MessageKey) => string;
  version: string;
  progress: InstallProgress;
}

const phases = ["downloading", "installing", "restarting"] as const;
const titles: Record<InstallProgress["phase"], MessageKey> = {
  downloading: "updateFlowDownloading", installing: "updateFlowInstalling", restarting: "updateFlowRestarting",
};
const bodies: Record<InstallProgress["phase"], MessageKey> = {
  downloading: "updateFlowDownloadBody", installing: "updateFlowInstallBody", restarting: "updateFlowRestartBody",
};
const labels: Record<InstallProgress["phase"], MessageKey> = {
  downloading: "updateFlowDownload", installing: "updateFlowInstall", restarting: "updateFlowRestart",
};

function bytes(value: number) {
  if (value < 1000) return `${value} B`;
  if (value < 1000 ** 2) return `${(value / 1000).toFixed(1)} KB`;
  return `${(value / 1000 ** 2).toFixed(1)} MB`;
}

/** A native modal keeps navigation and shortcuts out of the installation flow. */
export default function UpdateScreen({ t, version, progress }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const current = phases.indexOf(progress.phase);
  const percent = progress.phase === "downloading" ? progress.percent : null;

  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement;
    const keepOpen = (event: Event) => event.preventDefault();
    node.addEventListener("cancel", keepOpen);
    node.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      node.removeEventListener("cancel", keepOpen);
      node.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  const downloaded = progress.phase === "downloading" && progress.receivedBytes > 0
    ? progress.totalBytes !== null
      ? t("updateFlowBytes").replace("{received}", bytes(progress.receivedBytes)).replace("{total}", bytes(progress.totalBytes))
      : t("updateFlowReceived").replace("{received}", bytes(progress.receivedBytes))
    : null;

  return (
    <dialog className="update-screen" ref={dialog} closedby="none" aria-modal="true" aria-labelledby="update-flow-title" aria-describedby="update-flow-intro update-flow-hint" onKeyDownCapture={(event) => { if (event.key === "Escape") event.preventDefault(); }}>
      <div className="update-screen-content">
        <span className="update-screen-brand">{t("appRomaji")}</span>
        <div className="update-screen-art" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {progress.phase === "downloading" ? <path d="M32 12v28m-10-10 10 10 10-10M15 40v10h34V40" />
              : progress.phase === "installing" ? <><path d="m32 11 20 11v22L32 55 12 44V22Z" /><path d="m12 22 20 11 20-11M32 33v22M22 17l20 11" /></>
                : <><path d="M48 26a17 17 0 1 0 0 15M48 14v12H36" /><path d="m25 33 5 5 10-11" /></>}
          </svg>
        </div>
        <h1 id="update-flow-title" ref={heading} tabIndex={-1}>{t("updateFlowTitle")}</h1>
        <p id="update-flow-intro" className="update-screen-intro">{t("updateFlowVersion").replace("{version}", version)}</p>

        <div className="update-screen-status" role="status" aria-live="polite" aria-atomic="true">
          <h2>{t(titles[progress.phase])}</h2>
          <p>{t(bodies[progress.phase])}</p>
        </div>
        <div className="update-screen-download">
          <div className="update-screen-reading">
            <span>{downloaded ?? (progress.phase === "downloading" ? t("updateFlowUnknown") : t(titles[progress.phase]))}</span>
            {percent !== null && <strong>{percent}<small>%</small></strong>}
          </div>
          <div className={`update-screen-progress${percent === null ? " indeterminate" : ""}`} role="progressbar" aria-label={t(titles[progress.phase])} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-valuetext={percent === null ? t(titles[progress.phase]) : `${percent}%`}>
            <span style={percent === null ? undefined : { width: `${percent}%` }} />
          </div>
        </div>

        <ol className="update-screen-steps" aria-label={t("updateFlowStages")}>
          {phases.map((phase, index) => <li key={phase} className={index < current ? "done" : index === current ? "current" : "waiting"} aria-current={index === current ? "step" : undefined}>
            <span className="update-screen-step-mark" aria-hidden="true">{index < current ? <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg> : index + 1}</span>
            <span>{t(labels[phase])}<span className="update-screen-sr-only"> · {t(index < current ? "updateFlowDone" : index === current ? "updateFlowCurrent" : "updateFlowWaiting")}</span></span>
          </li>)}
        </ol>
        <p id="update-flow-hint" className="update-screen-hint">{t("updateFlowHint")}</p>
      </div>
    </dialog>
  );
}
