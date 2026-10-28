import { useCallback, useEffect, useRef, useState } from "react";
import AppIcon, { type IconName } from "./components/AppIcon";
import UpdateScreen from "./components/UpdateScreen";
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
import Skills from "./pages/Skills";
import Learn from "./pages/Learn";

type Page = "today" | "learn" | "practice" | "skills" | "free" | "editor" | "sound" | "settings";

const navItems: { key: MessageKey; page: Page; icon: IconName; group: "practice" | "setup" }[] = [
  { key: "navToday", page: "today", icon: "today", group: "practice" },
  { key: "navLearn", page: "learn", icon: "lessons", group: "practice" },
  { key: "navPractice", page: "practice", icon: "lessons", group: "practice" },
  { key: "navSkills", page: "skills", icon: "check", group: "practice" },
  { key: "navFreePlay", page: "free", icon: "piano", group: "practice" },
  { key: "navNoteEditor", page: "editor", icon: "score", group: "practice" },
  { key: "navSound", page: "sound", icon: "sound", group: "setup" },
  { key: "navSettings", page: "settings", icon: "settings", group: "setup" },
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
  const [practiceVisit, setPracticeVisit] = useState(0);
  const [practiceFocus, setPracticeFocus] = useState(false);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ kind: "idle" });
  const updateBusy = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const desktop = inDesktopApp();
  const t = (key: MessageKey) => locales[settings.locale][key];

  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [page, practiceVisit]);

  const navigate = (target: Page, lesson: Lesson | null = null) => {
    setInitialLesson(lesson);
    if (target === "practice") setPracticeVisit((visit) => visit + 1);
    setPage(target);
  };

  const checkUpdate = useCallback(async () => {
    if (updateBusy.current) return;
    updateBusy.current = true;
    setUpdate({ kind: "checking" });
    try {
      setUpdate(await findUpdate());
    } finally {
      updateBusy.current = false;
    }
  }, []);

  const install = async () => {
    if (updateBusy.current || update.kind !== "available") return;
    updateBusy.current = true;
    const pending = update.update;
    let active = true;
    setUpdate({ kind: "installing", version: pending.version, progress: { phase: "downloading", percent: null, receivedBytes: 0, totalBytes: null } });
    try {
      await installUpdate(pending, (progress) => {
        if (active) setUpdate({ kind: "installing", version: pending.version, progress });
      });
    } catch (e) {
      setUpdate({ kind: "error", message: String(e) });
    } finally {
      active = false;
      updateBusy.current = false;
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
        if (state.kind === "available") setUpdate((current) => current.kind === "idle" ? state : current);
      });
    }
  }, []);

  return (
    <div className="shell" data-page={page} data-focus={practiceFocus && (page === "practice" || page === "learn" || page === "editor")}>
      <a className="skip-link" href="#main-content">{t("navSkip")}</a>
      <aside className="side" aria-label={t("appRomaji")}>
        <div className="side-space" aria-hidden="true" />
        <nav className="nav" aria-label={t("navSectionPractice")}>
          {navItems.filter((item) => item.group === "practice").map(({ key, page: target, icon }) => (
            <button
              key={key}
              type="button"
              className="nav-item"
              aria-current={target === page ? "page" : undefined}
              onClick={() => navigate(target)}
            >
              <AppIcon name={icon} /><span>{t(key)}</span>
              {target === page && <span className="nav-current-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <nav className="nav nav-setup" aria-label={t("navSectionSetup")}>
            {navItems.filter((item) => item.group === "setup").map(({ key, page: target, icon }) => (
              <button key={key} type="button" className="nav-item" aria-current={target === page ? "page" : undefined}
                onClick={() => navigate(target)}>
                <AppIcon name={icon} /><span>{t(key)}</span>
              </button>
            ))}
          </nav>
          {update.kind === "available" && (
            <button type="button" className="update-banner" onClick={() => navigate("settings")}>
              <strong>{t("updatesAvailable").replace("{version}", update.update.version)}</strong>
              <span>{t("updatesOpen")}</span>
            </button>
          )}
          <span className="muted">
            {t("version")} {info?.version ?? "—"}
          </span>
        </div>
      </aside>
      <div className="workspace">
        <div className="workspace-toolbar">
          <div className="workspace-tools">
            <button type="button" className="icon-button" title={t(settings.theme === "light" ? "themeDark" : "themeLight")}
              aria-label={t(settings.theme === "light" ? "themeDark" : "themeLight")}
              onClick={() => setSettings((s) => ({ ...s, theme: s.theme === "light" ? "dark" : "light" }))}>
              <AppIcon name={settings.theme === "light" ? "moon" : "sun"} />
            </button>
          </div>
        </div>
      <main className="main" id="main-content" tabIndex={-1} ref={mainRef}>
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
        ) : page === "learn" ? (
          <Learn t={t} locale={settings.locale} onFocusChange={setPracticeFocus} onOpenSound={() => navigate("sound")} onSkills={()=>navigate("skills")} onPractice={()=>navigate("practice")} />
        ) : page === "skills" ? (
          <Skills t={t} locale={settings.locale} onPractice={() => navigate("practice")} />
        ) : page === "editor" ? (
          <NoteEditor t={t} locale={settings.locale} onFocusChange={setPracticeFocus} />
        ) : page === "free" ? (
          <FreePlay t={t} onOpenSound={() => navigate("sound")} />
        ) : page === "sound" ? (
          <SoundMidi t={t} />
        ) : page === "practice" ? (
          <Practice key={practiceVisit} t={t} locale={settings.locale} initialLesson={initialLesson} onOpenSound={() => navigate("sound")} onFocusChange={setPracticeFocus} />
        ) : (
          <Today t={t} locale={settings.locale}
            onPractice={(lesson) => navigate("practice", lesson)}
            onFreePlay={() => navigate("free")} onEditor={() => navigate("editor")} onSound={() => navigate("sound")} onLearn={()=>navigate("learn")} onSkills={()=>navigate("skills")} />
        )}
      </main>
      </div>
      {update.kind === "installing" && <UpdateScreen t={t} version={update.version} progress={update.progress} />}
    </div>
  );
}
