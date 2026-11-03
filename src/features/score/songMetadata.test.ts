// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSongCover, makeSongCover, MAX_SONG_COVER } from "./songMetadata";

afterEach(() => vi.restoreAllMocks());

describe("local song covers", () => {
  it.each(["https://example.com/cover.jpg", "file:///cover.jpg", "data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,AA==", "data:image/jpeg;base64,invalid!", "data:image/jpeg;base64,/9j/" + "A".repeat(MAX_SONG_COVER), null])("rejects remote, active, oversized or invalid cover data: %s", (value) => {
    expect(isSongCover(value)).toBe(false);
  });

  it("rejects unsupported or oversized source files before reading them", async () => {
    const read = vi.spyOn(FileReader.prototype, "readAsDataURL");
    await expect(makeSongCover(new File(["svg"], "cover.svg", { type: "image/svg+xml" }))).rejects.toThrow();
    await expect(makeSongCover(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cover.png", { type: "image/png" }))).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });

  it("crops, downsizes and re-encodes a selected image without retaining the original file", async () => {
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, "result", { value: "data:image/png;base64,AA==" });
      this.onload?.call(this, new ProgressEvent("load") as ProgressEvent<FileReader>);
    });
    vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(function (this: HTMLImageElement) {
      Object.defineProperties(this, { naturalWidth: { value: 1200 }, naturalHeight: { value: 800 } });
      this.onload?.call(this, new Event("load"));
    });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,/9j/AA==");
    const cover = await makeSongCover(new File(["png"], "cover.png", { type: "image/png" }));
    expect(isSongCover(cover)).toBe(true);
    expect(drawImage).toHaveBeenCalledWith(expect.any(HTMLImageElement), 200, 0, 800, 800, 0, 0, 320, 320);
    expect(encode).toHaveBeenCalledWith("image/jpeg", 0.75);
  });
});
