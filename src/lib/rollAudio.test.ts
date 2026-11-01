import { expect, it, vi } from "vitest";
import { RollAudio } from "./rollAudio";
it("releases a native note that finishes starting after stop", async () => {
  let finish: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const send = vi
    .fn()
    .mockImplementation((_pitch: number, down: boolean) =>
      down ? pending : Promise.resolve(),
    );
  const fail = vi.fn(),
    audio = new RollAudio(send, fail);
  await audio.arm();
  audio.note(60, true);
  audio.stop();
  finish();
  await pending;
  await Promise.resolve();
  expect(send).toHaveBeenCalledWith(60, false);
  expect(fail).not.toHaveBeenCalled();
});
it("reports current audio failures and does not report a stopped generation as a new failure", async () => {
  const fail = vi.fn();
  const audio = new RollAudio(
    vi.fn().mockRejectedValue(new Error("unavailable")),
    fail,
  );
  audio.note(60, true);
  await Promise.resolve();
  await Promise.resolve();
  expect(fail).toHaveBeenCalledTimes(1);
  audio.note(62, true);
  audio.dispose();
  await Promise.resolve();
  await Promise.resolve();
  expect(fail).toHaveBeenCalledTimes(1);
});
