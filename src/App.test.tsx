// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lessons } from "./features/lessons/lessons";
import { recordRun, saveProgress } from "./features/lessons/progress";
import { en } from "./i18n/messages";
import App from "./App";

vi.mock("./lib/backend", () => ({ inDesktopApp: () => false, backend: {} }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("mimi-kopi.settings", JSON.stringify({ locale: "en", theme: "light", autoUpdate: false }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("practice navigation", () => {
  it("starts Today's suggested chapter directly and the learning sidebar returns to the path", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: en.pathContinue }));
    expect(screen.getByRole("heading", { name: en.learnTry.replace("{note}", "C4") })).toBeTruthy();
    expect(screen.queryByRole("list", { name: en.pathTitle })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.navLearn }));
    expect(screen.getByRole("list", { name: en.pathTitle })).toBeTruthy();
  });
  it("opens focused bass practice from the path without changing to treble or awarding chapter completion", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: en.navLearn }));
    fireEvent.click(within(screen.getByRole("list", { name: en.pathTitle })).getByRole("button", { name: new RegExp(en.learnBass) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.pathPractice}`) }));
    expect(screen.getByRole("heading", { name: `${en.learnBass} · ${en.drillPractice}` })).toBeTruthy();
    expect(screen.queryByText(en.learnCheckHint)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.drillBegin }));
    expect(screen.getByRole("img", { name: `${en.drillReadPrompt}: C3` })).toBeTruthy();
    expect(localStorage.getItem("mimi-kopi.learning.v1")).toBeNull();
    fireEvent.click(within(screen.getByRole("navigation", { name: en.navSectionPractice })).getByRole("button", { name: en.navPractice }));
    expect(screen.getByRole("heading", { name: en.drillTitle })).toBeTruthy();
  });
  it("returns from an open lesson to the curriculum through the same sidebar page", () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole("navigation", { name: en.navSectionPractice })).getByRole("button", { name: en.navPractice }));
    fireEvent.click(screen.getByRole("button", { name: en.drillLegacyOpen }));
    const last = lessons.at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(last.title.en) }));
    expect(screen.getByRole("heading", { name: last.title.en })).toBeTruthy();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
    fireEvent.click(within(screen.getByRole("navigation", { name: en.navSectionPractice })).getByRole("button", { name: en.navPractice }));
    expect(screen.getByRole("heading", { name: en.drillTitle })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: en.lessonSetup })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("refreshes real course evidence after returning home without counting legacy completion as a new chapter", () => {
    render(<App />);
    saveProgress(recordRun({}, lessons[0], { accuracy: 0.95, durationMs: 1000, simulated: false }, new Date("2026-10-26T00:00:00Z")));
    fireEvent.click(screen.getByRole("button", { name: en.navSkills }));
    fireEvent.click(screen.getByRole("button", { name: en.navToday }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByRole("heading", { name: en.learnKeyboard })).toBeTruthy();
    localStorage.setItem("mimi-kopi.learning.v1", JSON.stringify({ keyboard: { realAt: new Date(Date.now() - 1000).toISOString() } }));
    fireEvent.click(screen.getByRole("button", { name: en.navSkills }));
    fireEvent.click(screen.getByRole("button", { name: en.navToday }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByRole("heading", { name: en.exDirection })).toBeTruthy();
    expect(screen.getByText(en.pathNoMastery)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("persists the toolbar night toggle and keeps only usable pages in navigation", () => {
    const app = render(<App />);
    const navigation = screen.getAllByRole("navigation");
    expect(navigation.flatMap((nav) => [...nav.querySelectorAll("button")])).toHaveLength(8);
    expect(document.querySelector(".brand, .workspace-location, .studio-label, .nav-label")).toBeNull();
    expect(screen.queryByText(en.browserNotice)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.themeDark }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    app.unmount();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: en.navSettings }));
    expect((screen.getByRole("combobox", { name: en.theme }) as HTMLSelectElement).value).toBe("dark");
    expect(screen.getByText(`${en.runtime}: ${en.runtimeBrowser}`)).toBeTruthy();
  });
});
