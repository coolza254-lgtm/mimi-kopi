import { describe, expect, it } from "vitest";
import night from "./night.css?raw";

const colors = Object.fromEntries([...night.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((m) => [m[1], m[2]]));
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const [dark, light] = [luminance(colors[a]), luminance(colors[b])].sort((x, y) => x - y);
  return (light + 0.05) / (dark + 0.05);
};

describe("monochrome night palette", () => {
  it("has no chromatic colour values", () => {
    const literals = [...night.matchAll(/#([\da-f]{6})\b/gi)].map((m) => m[1].toLowerCase());
    expect(literals.length).toBeGreaterThan(20);
    for (const hex of literals) {
      expect(hex.slice(0, 2)).toBe(hex.slice(2, 4));
      expect(hex.slice(2, 4)).toBe(hex.slice(4, 6));
    }
  });

  it("keeps primary and secondary copy readable on every night surface", () => {
    for (const foreground of ["text", "muted"]) {
      for (const background of ["bg", "surface", "surface-2", "sidebar", "pink-soft", "blue-soft", "violet-soft"]) {
        expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast("on-primary", "primary")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("on-pink", "pink")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps piano labels, boundaries and target indicators visible without a white keyboard", () => {
    for (const key of ["key-white", "key-black"]) {
      expect(contrast("key-label", key)).toBeGreaterThanOrEqual(4.5);
      expect(contrast("key-edge", key)).toBeGreaterThanOrEqual(3);
      expect(contrast("focus", key)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast("key-on-pressed", "key-pressed")).toBeGreaterThanOrEqual(4.5);
    expect(luminance(colors["key-white"])).toBeLessThan(0.1);
  });
});
