import { useEffect, useState } from "react";
import { localeNames, locales, type Locale, type MessageKey } from "./i18n/messages";
import { fetchAppInfo, type AppInfo, type CapabilityStatus } from "./lib/appInfo";
import { loadSettings, saveSettings, type Settings, type Theme } from "./lib/settings";

const navItems: { key: MessageKey; enabled: boolean }[] = [
  { key: "navToday", enabled: true },
  { key: "navPractice", enabled: false },
  { key: "navSongs", enabled: false },
  { key: "navEarCopy", enabled: false },
  { key: "navProgress", enabled: false },
  { key: "navSettings", enabled: false },
];

const capabilityRows: { key: MessageKey; field: keyof AppInfo["capabilities"] }[] = [
  { key: "capNoteOnOff", field: "noteOnOff" },
  { key: "capVelocity", field: "velocity" },
  { key: "capSustain", field: "sustainCc64" },
  { key: "capPolyphony", field: "polyphony" },
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [info, setInfo] = useState<AppInfo | null>(null);
  const t = (key: MessageKey) => locales[settings.locale][key];
  const statusLabel = (status: CapabilityStatus) => t(`status_${status}`);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.locale;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    fetchAppInfo().then(setInfo, () => setInfo(null));
  }, []);

  return (
    <div className="shell">
      <aside className="side" aria-label={t("appRomaji")}>
        <div className="brand">
          <span className="logo" aria-hidden="true">耳</span>
          <div>
            <div className="brand-name">{t("appName")}</div>
            <div className="brand-sub">{t("appRomaji")}</div>
          </div>
        </div>
        <nav className="nav">
          {navItems.map(({ key, enabled }) => (
            <button
              key={key}
              type="button"
              className="nav-item"
              disabled={!enabled}
              aria-current={key === "navToday" ? "page" : undefined}
              title={enabled ? undefined : t("comingSoon")}
            >
              {t(key)}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <label>
            {t("language")}
            <select
              value={settings.locale}
              onChange={(e) => setSettings({ ...settings, locale: e.target.value as Locale })}
            >
              {Object.entries(localeNames).map(([value, name]) => (
                <option key={value} value={value}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            {t("theme")}
            <select
              value={settings.theme}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value as Theme })}
            >
              <option value="light">{t("themeLight")}</option>
              <option value="dark">{t("themeDark")}</option>
            </select>
          </label>
        </div>
      </aside>
      <main className="main">
        <h1 className="title">{t("todayTitle")}</h1>
        <div className="cards">
          <section className="card" aria-labelledby="phase">
            <h2 id="phase">{t("phaseTitle")}</h2>
            <p className="muted">{t("phaseBody")}</p>
            <dl className="rows">
              <dt>{t("version")}</dt>
              <dd>{info?.version ?? "—"}</dd>
              <dt>{t("runtime")}</dt>
              <dd>{info ? t("runtimeDesktop") : t("runtimeBrowser")}</dd>
            </dl>
          </section>
          <section className="card" aria-labelledby="hardware">
            <h2 id="hardware">{t("hardwareTitle")}</h2>
            <p><span className="badge">{t("hardwareNotVerified")}</span></p>
            <dl className="rows">
              {capabilityRows.map(({ key, field }) => (
                <div key={field} style={{ display: "contents" }}>
                  <dt>{t(key)}</dt>
                  <dd><span className="badge">{statusLabel(info?.capabilities[field] ?? "not_yet_tested")}</span></dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
