export const MAX_SONG_MEMO = 4000;
export const MAX_SONG_COVER = 180_000;

/** Only embedded raster covers are accepted; no remote requests or SVG content. */
export function isSongCover(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_SONG_COVER &&
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/** Resize a user-selected image before storing it with the song. */
export async function makeSongCover(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Unsupported cover image");
  }
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid image"));
    reader.onerror = () => reject(new Error("Image read failed"));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = source;
  });
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 32_000_000) {
    throw new Error("Image dimensions too large");
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image rendering unavailable");
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 320, 320);
  const cover = canvas.toDataURL("image/jpeg", 0.75);
  if (!isSongCover(cover)) throw new Error("Cover too large");
  return cover;
}
