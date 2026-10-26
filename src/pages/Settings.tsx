import { localeNames, type Locale, type MessageKey } from "../i18n/messages";
import type { Settings as AppSettings, Theme } from "../lib/settings";
import type { UpdateState } from "../lib/updates";

interface Props {
  t: (key: MessageKey) => string;
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  version: string | null;
  desktop: boolean;
  update: UpdateState;
  onCheck: () => void;
  onInstall: () => void;
}

export default function Settings({ t, settings, onChange, version, desktop, update, onCheck, onInstall }: Props) {
  const busy = update.kind === "checking" || update.kind === "installing";
  return (
    <>
      <h1 className="title">{t("settingsTitle")}</h1>
      <div className="cards">
        <section className="card" aria-labelledby="general">
          <h2 id="general">{t("settingsGeneral")}</h2>
          <label className="field">
            {t("language")}
            <select value={settings.locale} onChange={(e) => onChange({ ...settings, locale: e.target.value as Locale })}>
              {Object.entries(localeNames).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t("theme")}
            <select value={settings.theme} onChange={(e) => onChange({ ...settings, theme: e.target.value as Theme })}>
              <option value="light">{t("themeLight")}</option>
              <option value="dark">{t("themeDark")}</option>
            </select>
          </label>
        </section>

        <section className="card" aria-labelledby="updates">
          <h2 id="updates">{t("updatesTitle")}</h2>
          <dl className="rows">
            <dt>{t("version")}</dt>
            <dd>{version ?? "—"}</dd>
          </dl>
          <UpdateStatus t={t} update={update} />
          <div className="actions">
            {update.kind === "available" ? (
              <button type="button" className="btn primary" disabled={busy} onClick={onInstall}>
                {t("updatesInstall")}
              </button>
            ) : (
              <button type="button" className="btn" disabled={!desktop || busy} onClick={onCheck}>
                {update.kind === "checking" ? t("updatesChecking") : t("updatesCheck")}
              </button>
            )}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.autoUpdate}
              onChange={(e) => onChange({ ...settings, autoUpdate: e.target.checked })}
            />
            {t("updatesAuto")}
          </label>
          <p className="muted small">{t("updatesHint")}</p>
        </section>
      </div>
      <details className="card settings-about">
        <summary>{t("appRomaji")} · {t("version")} {version ?? "—"}</summary>
        <p className="muted small">{t("phaseBody")}</p>
        <p className="muted small">{t("runtime")}: {t(desktop ? "runtimeDesktop" : "runtimeBrowser")}</p>
      </details>
    </>
  );
}

export function UpdateStatus({ t, update }: { t: (key: MessageKey) => string; update: UpdateState }) {
  switch (update.kind) {
    case "current":
      return <p className="notice">{t("updatesNone")}</p>;
    case "available":
      return (
        <div className="notice">
          <strong>{t("updatesAvailable").replace("{version}", update.update.version)}</strong>
          {update.update.body && <p className="small update-notes">{update.update.body}</p>}
        </div>
      );
    case "installing":
      return (
        <p className="notice">{t("updateFlowTitle")} · {update.version}</p>
      );
    case "error":
      return (
        <div className="notice error" role="alert">
          <strong>{t("updatesError")}</strong>
          <p className="small">{t("updateFlowErrorHint")}</p>
          <details className="small muted"><summary>{t("updateFlowDetails")}</summary>{update.message}</details>
        </div>
      );
    default:
      return null;
  }
}
