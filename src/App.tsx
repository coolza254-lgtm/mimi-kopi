import { useCallback, useEffect, useState } from "react";
import brandMark from "./assets/brand-mark.png";
import type { Lesson } from "./features/lessons/lessons";
import { locales, type MessageKey } from "./i18n/messages";
import { loadAudioPrefs, saveAudioPrefs } from "./lib/audioPrefs";
import { backend, inDesktopApp, type AppInfo } from "./lib/backend";
import { loadSettings, saveSettings, type Settings } from "./lib/settings";
import { findUpdate, installUpdate, type UpdateState } from "./lib/updates";
import FreePlay from "./pages/FreePlay";
import NoteEditor from "./pages/NoteEditor";
import Practice from "./pages/Practice";
import SettingsPage from "./pages/Settings";
import SoundMidi from "./pages/SoundMidi";
import Today from "./pages/Today";

type Page = "today" | "practice" | "free" | "editor" | "sound" | "settings";

const navItems: { key: MessageKey; page?: Page }[] = [
  { key: "navToday", page: "today" },
  { key: "navPractice", page: "practice" },
  { key: "navFreePlay", page: "free" },
  { key: "navNoteEditor", page: "editor" },
  { key: "navSongs" },
  { key: "navEarCopy" },
  { key: "navProgress" },
  { key: "navSound", page: "sound" },
  { key: "navSettings", page: "settings" },
];

/** Reopens the remembered output device, volume, tone and piano sound (.sf2 or .sfz). A device that is not
 * plugged in falls back to the Windows default so the app is never silent. */
async function restoreAudio() {
  const prefs = loadAudioPrefs();
  try {
    await backend.audioSetGain("master", prefs.master / 100);
    await backend.audioSetGain("piano", prefs.piano / 100);
    await backend.audioSetTone(prefs.tone);
    if (prefs.outputDevice) {
      const status = await backend.audioOpen(prefs.outputDevice);
      if (!status.device) await backend.audioOpen(null);
    }
    if (prefs.soundFontPath) {
      const status = await backend.audioLoadSoundFont(prefs.soundFontPath).catch(() => null);
      if (!status || status.instrument === "basic") saveAudioPrefs({ soundFontPath: null });
    }
  } catch {
    // The Sound & MIDI page shows the current status and any error.
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [page, setPage] = useState<Page>("today");
  const [initialLesson, setInitialLesson] = useState<Lesson | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ kind: "idle" });
  const desktop = inDesktopApp();
  const t = (key: MessageKey) => locales[settings.locale][key];

  const checkUpdate = useCallback(async () => {
    setUpdate({ kind: "checking" });
    setUpdate(await findUpdate());
  }, []);

  const install = async () => {
    if (update.kind !== "available") return;
    const pending = update.update;
    setUpdate({ kind: "installing", percent: null });
    try {
      await installUpdate(pending, (percent) => setUpdate({ kind: "installing", percent }));
    } catch (e) {
      setUpdate({ kind: "error", message: String(e) });
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.locale;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!inDesktopApp()) return;
    backend.appInfo().then(setInfo, () => setInfo(null));
    void restoreAudio();
    // Offline or no release yet: stay quiet; the Settings page can check again.
    if (loadSettings().autoUpdate) {
      void findUpdate().then((state) => {
        if (state.kind === "available") setUpdate(state);
      });
    }
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
              onClick={() => { if (target) { setInitialLesson(null); setPage(target); } }}
            >
              {t(key)}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {update.kind === "available" && (
            <button type="button" className="update-banner" onClick={() => setPage("settings")}>
              <strong>{t("updatesAvailable").replace("{version}", update.update.version)}</strong>
              <span>{t("updatesOpen")}</span>
            </button>
          )}
          <span className="muted">
            {t("version")} {info?.version ?? "—"}
          </span>
        </div>
      </aside>
      <main className="main">
        {page === "settings" ? (
          <SettingsPage
            t={t}
            settings={settings}
            onChange={setSettings}
            version={info?.version ?? null}
            desktop={desktop}
            update={update}
            onCheck={() => void checkUpdate()}
            onInstall={() => void install()}
          />
        ) : page === "editor" ? (
          <NoteEditor t={t} locale={settings.locale} />
        ) : page === "free" ? (
          <FreePlay t={t} onOpenSound={() => setPage("sound")} />
        ) : page === "sound" ? (
          <SoundMidi t={t} />
        ) : page === "practice" ? (
          <Practice t={t} locale={settings.locale} initialLesson={initialLesson} />
        ) : (
          <Today t={t} info={info} locale={settings.locale}
            onPractice={(lesson) => { setInitialLesson(lesson); setPage("practice"); }}
            onFreePlay={() => setPage("free")} onEditor={() => setPage("editor")} onSound={() => setPage("sound")} />
        )}
      </main>
    </div>
  );
}
