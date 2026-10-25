import { useEffect, useState } from "react";
import brandMark from "./assets/brand-mark.png";
import { localeNames, locales, type Locale, type MessageKey } from "./i18n/messages";
import { backend, inDesktopApp, type AppInfo } from "./lib/backend";
import { loadSettings, saveSettings, type Settings, type Theme } from "./lib/settings";
import Practice from "./pages/Practice";
import SoundMidi from "./pages/SoundMidi";
import Today from "./pages/Today";

type Page = "today" | "practice" | "sound";

const navItems: { key: MessageKey; page?: Page }[] = [
  { key: "navToday", page: "today" },
  { key: "navPractice", page: "practice" },
  { key: "navSongs" },
  { key: "navEarCopy" },
  { key: "navProgress" },
  { key: "navSound", page: "sound" },
  { key: "navSettings" },
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [page, setPage] = useState<Page>("today");
  const [info, setInfo] = useState<AppInfo | null>(null);
  const t = (key: MessageKey) => locales[settings.locale][key];

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.locale;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (inDesktopApp()) backend.appInfo().then(setInfo, () => setInfo(null));
  }, []);

  return (
    <div className="shell">
      <aside className="side" aria-label={t("appRomaji")}>
        <div className="brand">
          <img className="logo" src={brandMark} alt="" />
          <div>
            <div className="brand-name">{t("appName")}</div>
            <div className="brand-sub">{t("appRomaji")}</div>
          </div>
        </div>
        <nav className="nav">
          {navItems.map(({ key, page: target }) => (
            <button
              key={key}
              type="button"
              className="nav-item"
              disabled={!target}
              aria-current={target === page ? "page" : undefined}
              title={target ? undefined : t("comingSoon")}
              onClick={() => target && setPage(target)}
            >
              {t(key)}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <label>
            {t("language")}
            <select value={settings.locale} onChange={(e) => setSettings({ ...settings, locale: e.target.value as Locale })}>
              {Object.entries(localeNames).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("theme")}
            <select value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value as Theme })}>
              <option value="light">{t("themeLight")}</option>
              <option value="dark">{t("themeDark")}</option>
            </select>
          </label>
        </div>
      </aside>
      <main className="main">
        {page === "sound" ? (
          <SoundMidi t={t} />
        ) : page === "practice" ? (
          <Practice t={t} locale={settings.locale} />
        ) : (
          <Today t={t} info={info} />
        )}
      </main>
    </div>
  );
}
