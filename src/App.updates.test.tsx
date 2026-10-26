// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InstallProgress } from "./lib/updates";
import { en } from "./i18n/messages";
import App from "./App";

const { find, install } = vi.hoisted(() => ({ find: vi.fn(), install: vi.fn() }));
vi.mock("./lib/updates", () => ({ findUpdate: find, installUpdate: install }));
vi.mock("./lib/backend", () => ({
  inDesktopApp: () => true,
  backend: { appInfo: async () => ({ version: "current-version" }), audioSetGain: vi.fn(), audioSetTone: vi.fn() },
}));
vi.mock("./pages/Today", () => ({ default: () => null }));

const available = { kind: "available", update: { version: "test-version", body: "Test update" } };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const mount = async (autoUpdate = false) => {
  localStorage.setItem("mimi-kopi.settings", JSON.stringify({ locale: "en", theme: "dark", autoUpdate }));
  await act(async () => { render(<App />); });
  fireEvent.click(screen.getByRole("button", { name: en.navSettings }));
};
const check = async () => { await act(async () => { fireEvent.click(screen.getByRole("button", { name: en.updatesCheck })); }); };

beforeEach(() => {
  localStorage.clear();
  find.mockReset().mockResolvedValue(available);
  install.mockReset();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("in-app update screen", () => {
  it("opens once, follows the actual progress callback, and recovers to an actionable error", async () => {
    const pending = deferred<void>();
    let report!: (state: InstallProgress) => void;
    install.mockImplementation(async (_update, callback) => { report = callback; await pending.promise; });
    await mount();
    await check();
    const button = screen.getByRole("button", { name: en.updatesInstall });
    act(() => { button.click(); button.click(); });
    expect(install).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: en.updateFlowTitle })).toBeTruthy();
    act(() => report({ phase: "downloading", percent: 47, receivedBytes: 4700, totalBytes: 10000 }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("47");
    act(() => report({ phase: "installing", percent: null, receivedBytes: 10000, totalBytes: 10000 }));
    expect(screen.getByRole("status").textContent).toContain(en.updateFlowInstalling);
    await act(async () => pending.reject(new Error("Installation failed")));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(en.updateFlowErrorHint);
    act(() => report({ phase: "downloading", percent: 10, receivedBytes: 1000, totalBytes: 10000 }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByRole("button", { name: en.updatesCheck }) as HTMLButtonElement).disabled).toBe(false);
    find.mockResolvedValueOnce({ kind: "current" });
    await check();
    expect(screen.getByText(en.updatesNone)).toBeTruthy();
  });

  it("does not let an older startup check replace an installation in progress", async () => {
    const startup = deferred<typeof available>();
    const pending = deferred<void>();
    find.mockReturnValueOnce(startup.promise).mockResolvedValueOnce(available);
    install.mockReturnValue(pending.promise);
    await mount(true);
    await check();
    fireEvent.click(screen.getByRole("button", { name: en.updatesInstall }));
    await act(async () => startup.resolve({ ...available, update: { ...available.update, version: "older-check" } }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(en.updateFlowVersion.replace("{version}", "test-version"))).toBeTruthy();
    expect(screen.queryByText(/older-check/)).toBeNull();
    await act(async () => pending.resolve());
  });
});
