// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lessons } from "../features/lessons/lessons";
import { en } from "../i18n/messages";
import Today from "./Today";

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("today practice plan", () => {
  it("opens each practice destination without inventing daily completion", () => {
    const onPractice = vi.fn();
    const onFreePlay = vi.fn();
    const onEditor = vi.fn();
    render(<Today t={(key) => en[key]} locale="en" onPractice={onPractice} onFreePlay={onFreePlay} onEditor={onEditor} onSound={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: en.pathContinue }));
    expect(onPractice).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.drillLegacyOpen) }));
    expect(onPractice).toHaveBeenLastCalledWith(lessons[0]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.todayWarmup) }));
    expect(onFreePlay).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.todayLesson) }));
    expect(onPractice).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.todaySong) }));
    expect(onEditor).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.todayReview) }));
    expect(onPractice).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByText(en.todayPlanHint)).toBeTruthy();
    expect(screen.getByText(en.pathNoMastery)).toBeTruthy();
  });
});
