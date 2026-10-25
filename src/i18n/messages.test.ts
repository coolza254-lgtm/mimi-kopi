import { describe, expect, it } from "vitest";
import { locales, th } from "./messages";

describe("messages", () => {
  const keys = Object.keys(th).sort();

  for (const [name, messages] of Object.entries(locales)) {
    it(`${name} has exactly the Thai keys`, () => {
      expect(Object.keys(messages).sort()).toEqual(keys);
    });

    it(`${name} has no empty strings`, () => {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), key).not.toBe("");
      }
    });
  }
});
