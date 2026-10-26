// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ReadingStaff from "./ReadingStaff";

afterEach(cleanup);
it("places middle C below the treble staff on its own ledger line", () => {
  const { container } = render(<ReadingStaff pitch={60} label="Middle C" />);
  const lines = [...container.querySelectorAll(".reading-lines line")].map((line) => Number(line.getAttribute("y1")));
  const y = Number(container.querySelector("ellipse")?.getAttribute("cy"));
  expect(lines).toHaveLength(5);
  expect(y).toBeGreaterThan(lines[4]);
  expect([...container.querySelectorAll(".reading-note line")].some((line) => Number(line.getAttribute("y1")) === y && Number(line.getAttribute("y2")) === y)).toBe(true);
});
it("places E4 on the lowest treble line", () => {
  const { container } = render(<ReadingStaff pitch={64} label="E4" />);
  const lines = container.querySelectorAll(".reading-lines line");
  expect(container.querySelector("ellipse")?.getAttribute("cy")).toBe(lines[4].getAttribute("y1"));
  expect(container.querySelector(".reading-clef")?.textContent).toBe("𝄞");
});
it("shows C3 in the bass staff space below its middle line", () => {
  const { container } = render(<ReadingStaff pitch={48} label="C3" />);
  const lines = container.querySelectorAll(".reading-lines line");
  const y = Number(container.querySelector("ellipse")?.getAttribute("cy"));
  expect(y).toBeGreaterThan(Number(lines[2].getAttribute("y1")));
  expect(y).toBeLessThan(Number(lines[3].getAttribute("y1")));
  expect(container.querySelector(".reading-clef")?.getAttribute("data-clef")).toBe("bass");
  const dots = [...container.querySelectorAll(".bass-dot")].map((dot) => Number(dot.getAttribute("cy")));
  expect((dots[0] + dots[1]) / 2).toBe(Number(lines[1].getAttribute("y1")));
});
