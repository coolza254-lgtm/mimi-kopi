import { describe, expect, it } from "vitest";
import { progress } from "./updates";

describe("update progress", () => {
  it("is unknown until the size is known", () => {
    expect(progress(500, undefined)).toBeNull();
    expect(progress(500, 0)).toBeNull();
  });

  it("rounds and never passes 100", () => {
    expect(progress(1, 3)).toBe(33);
    expect(progress(4, 3)).toBe(100);
  });
});
