import { isBlackKey, staffStep } from "../features/midi/notes";

interface Props {
  /** Pitches to show together; C4 and above go on the treble staff. */
  pitches: readonly number[];
  label: string;
}

const HALF = 7;
const TREBLE_TOP = 38; // F5
const BASS_TOP = 26; // A3
const TREBLE_Y = 34;
const BASS_Y = 142;
const NOTE_X = 168;

const trebleY = (step: number) => TREBLE_Y + (TREBLE_TOP - step) * HALF;
const bassY = (step: number) => BASS_Y + (BASS_TOP - step) * HALF;

/** Steps that need a short ledger line between the staff and `step`. */
function ledgers(step: number, bottom: number, top: number): number[] {
  const out: number[] = [];
  for (let s = bottom - 2; s >= step; s -= 2) out.push(s);
  for (let s = top + 2; s <= step; s += 2) out.push(s);
  return out;
}

/** A grand staff with the given notes, for reading along with the keys. */
export default function MiniStaff({ pitches, label }: Props) {
  const lines = (y: (s: number) => number, from: number) =>
    [0, 2, 4, 6, 8].map((d) => <line key={d} x1="8" x2="292" y1={y(from + d)} y2={y(from + d)} />);
  const placed = [...pitches]
    .sort((a, b) => a - b)
    .map((p) => {
      const step = staffStep(p);
      const treble = p >= 60;
      return { p, step, treble, y: treble ? trebleY(step) : bassY(step) };
    });
  // Neighbouring steps on one staff would overlap: nudge every other one right.
  const xs = placed.map((n, i) => {
    const prev = placed[i - 1];
    return prev && prev.treble === n.treble && n.step - prev.step === 1 ? NOTE_X + 17 : NOTE_X;
  });

  return (
    <svg className="mini-staff" viewBox="0 0 300 220" role="img" aria-label={label}>
      <g className="staff-lines">
        {lines(trebleY, 30)}
        {lines(bassY, 18)}
        <line x1="8" x2="8" y1={trebleY(38)} y2={bassY(18)} />
        <line x1="292" x2="292" y1={trebleY(38)} y2={bassY(18)} />
      </g>
      <text className="clef" x="14" y={trebleY(30) + 9} fontSize="60" aria-hidden="true">
        𝄞
      </text>
      <text className="clef" x="16" y={bassY(24) + 10} fontSize="40" aria-hidden="true">
        𝄢
      </text>
      {placed.map((n, i) => {
        const [bottom, top] = n.treble ? [30, 38] : [18, 26];
        const y = n.treble ? trebleY : bassY;
        return (
          <g key={n.p} className="staff-note">
            {ledgers(n.step, bottom, top).map((s) => (
              <line key={s} className="ledger" x1={xs[i] - 14} x2={xs[i] + 14} y1={y(s)} y2={y(s)} />
            ))}
            {isBlackKey(n.p) && (
              <text className="accidental" x={xs[i] - 28} y={n.y + 7} fontSize="22" aria-hidden="true">
                ♯
              </text>
            )}
            <ellipse cx={xs[i]} cy={n.y} rx="9" ry="6.5" transform={`rotate(-20 ${xs[i]} ${n.y})`} />
          </g>
        );
      })}
    </svg>
  );
}
