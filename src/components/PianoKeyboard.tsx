import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { isBlackKey, noteName, PIANO_HIGH, PIANO_LOW } from "../features/midi/notes";

interface Props {
  held: readonly number[];
  /** Keys the player should press next, drawn with an outline. */
  targets?: readonly number[];
  leftTargets?: readonly number[];
  latch?: boolean;
  /** Text shown on a key instead of its name, e.g. a finger number. */
  labels?: Readonly<Record<number, string>>;
  onPress: (pitch: number) => void;
  onRelease: (pitch: number) => void;
  low?: number;
  high?: number;
}

export default function PianoKeyboard({
  held,
  targets = [],
  leftTargets,
  latch = false,
  labels = {},
  onPress,
  onRelease,
  low = PIANO_LOW,
  high = PIANO_HIGH,
}: Props) {
  const down = useRef(new Set<number>());
  useEffect(() => { if (latch) down.current.forEach((p) => { if (!held.includes(p)) down.current.delete(p); }); }, [held, latch]);
  const pitches = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const whites = pitches.filter((p) => !isBlackKey(p));
  const whiteWidth = 100 / whites.length;
  const heldSet = new Set(held);
  const targetSet = new Set(targets);
  const classes = (base: string, p: number) =>
    `${base}${heldSet.has(p) ? " on" : ""}${targetSet.has(p) ? ` target${leftTargets ? leftTargets.includes(p) ? " target-left" : " target-right" : ""}` : ""}`;

  const press = (p: number) => {
    if (latch && down.current.has(p)) { down.current.delete(p); onRelease(p); return; }
    if (down.current.has(p)) return;
    down.current.add(p);
    onPress(p);
  };
  const release = (p: number) => {
    if (latch) return;
    if (!down.current.delete(p)) return;
    onRelease(p);
  };

  const keyProps = (p: number) => ({
    type: "button" as const,
    "aria-label": noteName(p),
    "aria-pressed": heldSet.has(p),
    onPointerDown: (e: PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      press(p);
    },
    onPointerUp: () => release(p),
    onPointerCancel: () => release(p),
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        press(p);
      }
    },
    onKeyUp: (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") release(p);
    },
    onBlur: () => release(p),
  });

  let whiteIndex = -1;
  return (
    <div className="piano" role="group" aria-label="Piano keyboard">
      {pitches.map((p) => {
        if (!isBlackKey(p)) {
          whiteIndex++;
          return (
            <button
              key={p}
              className={classes("white-key", p)}
              style={{ left: `${whiteIndex * whiteWidth}%`, width: `${whiteWidth}%` }}
              {...keyProps(p)}
            >
              {labels[p] ?? (p % 12 === 0 || targetSet.has(p) ? noteName(p) : "")}
            </button>
          );
        }
        const width = whiteWidth * 0.62;
        return (
          <button
            key={p}
            className={classes("black-key", p)}
            style={{ left: `${(whiteIndex + 1) * whiteWidth - width / 2}%`, width: `${width}%` }}
            {...keyProps(p)}
          >
            {labels[p] ?? ""}
          </button>
        );
      })}
    </div>
  );
}
