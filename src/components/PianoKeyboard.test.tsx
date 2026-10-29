// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PianoKeyboard from "./PianoKeyboard";

afterEach(cleanup);
const key = (name: string) => screen.getByRole("button", { name });
const tabKeys = () => within(screen.getByRole("group", { name: "Piano keyboard" })).getAllByRole("button").filter((button) => button.tabIndex === 0);

describe("piano keyboard navigation", () => {
  it("uses one tab stop across 88 keys and moves through black keys by semitone", () => {
    const press = vi.fn(), release = vi.fn();
    render(<><button>Before piano</button><PianoKeyboard held={[]} onPress={press} onRelease={release} /><button>After piano</button></>);
    expect(tabKeys()).toEqual([key("C4")]);
    act(() => key("C4").focus());
    fireEvent.keyDown(key("C4"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(key("C#4"));
    expect(tabKeys()).toEqual([key("C#4")]);
    fireEvent.keyDown(key("C#4"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(key("D4"));
    fireEvent.keyDown(key("D4"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(key("C#4"));
    expect(press).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    key("C#4").dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it("uses Home and End for range endpoints, clamps arrows and keeps one entry after a range change", () => {
    const view = render(<PianoKeyboard held={[]} low={48} high={72} onPress={vi.fn()} onRelease={vi.fn()} />);
    act(() => key("C4").focus());
    fireEvent.keyDown(key("C4"), { key: "Home" });
    expect(document.activeElement).toBe(key("C3"));
    fireEvent.keyDown(key("C3"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(key("C3"));
    fireEvent.keyDown(key("C3"), { key: "End" });
    expect(document.activeElement).toBe(key("C5"));
    fireEvent.keyDown(key("C5"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(key("C5"));
    view.rerender(<PianoKeyboard held={[]} low={48} high={55} onPress={vi.fn()} onRelease={vi.fn()} />);
    expect(tabKeys()).toEqual([key("G3")]);
  });

  it("releases a held note when arrow navigation blurs it and suppresses activation repeats", () => {
    const press = vi.fn(), release = vi.fn();
    render(<PianoKeyboard held={[]} low={60} high={64} onPress={press} onRelease={release} />);
    act(() => key("C4").focus());
    fireEvent.keyDown(key("C4"), { key: " " });
    const repeat = new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true, cancelable: true });
    key("C4").dispatchEvent(repeat);
    expect(repeat.defaultPrevented).toBe(true);
    expect(press).toHaveBeenCalledExactlyOnceWith(60);
    fireEvent.keyDown(key("C4"), { key: "ArrowRight" });
    expect(release).toHaveBeenCalledExactlyOnceWith(60);
    fireEvent.keyUp(key("C#4"), { key: " " });
    expect(release).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(key("C#4"), { key: "Enter" });
    fireEvent.keyUp(key("C#4"), { key: "Enter" });
    expect(press).toHaveBeenLastCalledWith(61);
    expect(release).toHaveBeenLastCalledWith(61);
  });

  it("keeps latched chord notes held while navigating and toggles them on the next activation", () => {
    function LatchedPiano() {
      const [held, setHeld] = useState<number[]>([]);
      return <><PianoKeyboard held={held} low={60} high={64} latch onPress={(pitch) => setHeld((notes) => [...notes, pitch])} onRelease={(pitch) => setHeld((notes) => notes.filter((note) => note !== pitch))} /><button>Leave piano</button></>;
    }
    render(<LatchedPiano />);
    act(() => key("C4").focus());
    fireEvent.keyDown(key("C4"), { key: "Enter" });
    fireEvent.keyUp(key("C4"), { key: "Enter" });
    fireEvent.keyDown(key("C4"), { key: "End" });
    fireEvent.keyDown(key("E4"), { key: "Enter" });
    fireEvent.keyUp(key("E4"), { key: "Enter" });
    expect(key("C4").getAttribute("aria-pressed")).toBe("true");
    expect(key("E4").getAttribute("aria-pressed")).toBe("true");
    act(() => key("Leave piano").focus());
    expect(key("E4").getAttribute("aria-pressed")).toBe("true");
    act(() => key("E4").focus());
    fireEvent.keyDown(key("E4"), { key: "Home" });
    fireEvent.keyDown(key("C4"), { key: "Enter" });
    fireEvent.keyUp(key("C4"), { key: "Enter" });
    expect(key("C4").getAttribute("aria-pressed")).toBe("false");
    expect(key("E4").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps pointer play and cancellation working and updates the keyboard entry point", () => {
    const press = vi.fn(), release = vi.fn();
    render(<PianoKeyboard held={[]} low={60} high={64} onPress={press} onRelease={release} />);
    const target = key("D4");
    Object.defineProperty(target, "setPointerCapture", { value: vi.fn() });
    fireEvent.pointerDown(target, { pointerId: 1 });
    expect(press).toHaveBeenCalledExactlyOnceWith(62);
    expect(tabKeys()).toEqual([target]);
    fireEvent.pointerCancel(target, { pointerId: 1 });
    expect(release).toHaveBeenCalledExactlyOnceWith(62);
    fireEvent.pointerUp(target, { pointerId: 1 });
    expect(release).toHaveBeenCalledTimes(1);
  });
});
