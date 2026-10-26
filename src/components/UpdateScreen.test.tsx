// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { en, locales } from "../i18n/messages";
import type { InstallProgress } from "../lib/updates";
import UpdateScreen from "./UpdateScreen";

const nativeShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const nativeClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => cleanup());
afterAll(() => {
  for (const [name, descriptor] of [["showModal", nativeShow], ["close", nativeClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
const downloading: InstallProgress = { phase: "downloading", percent: 40, receivedBytes: 4096, totalBytes: 10240 };
const view = (progress: InstallProgress) => <UpdateScreen t={(key) => en[key]} version="test-version" progress={progress} />;

describe("update screen", () => {
  it("shows real download measurements with an accessible progress bar", () => {
    render(view(downloading));
    expect(screen.getByRole("dialog", { name: en.updateFlowTitle })).toBeTruthy();
    expect(screen.getByText("4.1 KB of 10.2 KB")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText(en.updateFlowVersion.replace("{version}", "test-version"))).toBeTruthy();
    const steps = within(screen.getByRole("list", { name: en.updateFlowStages })).getAllByRole("listitem");
    expect(steps[0].getAttribute("aria-current")).toBe("step");
    expect(steps[1].textContent).toContain(en.updateFlowWaiting);
  });

  it("never invents a percentage or remaining time when the size is unknown", () => {
    render(view({ ...downloading, percent: null, totalBytes: null }));
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
    expect(screen.getByText("4.1 KB downloaded")).toBeTruthy();
    expect(screen.queryByText(/\d+%/)).toBeNull();
  });

  it("keeps 100% download separate from installation and restart", () => {
    const app = render(view({ ...downloading, percent: 100 }));
    expect(screen.getByRole("status").textContent).toContain(en.updateFlowDownloading);
    app.rerender(view({ ...downloading, phase: "installing", percent: null }));
    expect(screen.getByRole("status").textContent).toContain(en.updateFlowInstalling);
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps[0].textContent).toContain(en.updateFlowDone);
    expect(steps[1].getAttribute("aria-current")).toBe("step");
    app.rerender(view({ ...downloading, phase: "restarting", percent: null }));
    expect(screen.getByRole("status").textContent).toContain(en.updateFlowRestarting);
  });

  it("focuses the modal, blocks Escape dismissal and restores the opener in StrictMode", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const app = render(<StrictMode>{view(downloading)}</StrictMode>);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: en.updateFlowTitle }));
    const dialog = screen.getByRole("dialog");
    expect(fireEvent.keyDown(dialog, { key: "Escape" })).toBe(false);
    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(false);
    expect(dialog.hasAttribute("open")).toBe(true);
    app.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("has the update flow copy in every supported language", () => {
    for (const locale of Object.values(locales)) {
      const app = render(<UpdateScreen t={(key) => locale[key]} version="test-version" progress={downloading} />);
      expect(screen.getByRole("dialog", { name: locale.updateFlowTitle })).toBeTruthy();
      expect(screen.getByText(locale.updateFlowHint)).toBeTruthy();
      app.unmount();
    }
  });
});
