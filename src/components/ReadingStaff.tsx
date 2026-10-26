import { staffStep } from "../features/midi/notes";

/** One five-line staff, so each question can be read without unrelated notation. */
export default function ReadingStaff({ pitch, label }: { pitch: number; label: string }) {
  const treble = pitch >= 60;
  const top = treble ? 38 : 26;
  const bottom = top - 8;
  const step = staffStep(pitch);
  const y = (s: number) => 52 + (top - s) * 12;
  const ledger: number[] = [];
  for (let s = bottom - 2; s >= step; s -= 2) ledger.push(s);
  for (let s = top + 2; s <= step; s += 2) ledger.push(s);
  const down = step >= bottom + 4;
  return <svg className="reading-staff" viewBox="0 0 420 235" role="img" aria-label={label}>
    <g className="reading-lines">{[0, 2, 4, 6, 8].map((d) => <line key={d} x1="25" x2="395" y1={y(top - d)} y2={y(top - d)} />)}</g>
    {treble ? <text className="reading-clef" data-clef="treble" x="43" y={y(bottom) - 5} fontSize="130" aria-hidden="true">𝄞</text>
      : <g className="reading-clef" data-clef="bass" transform={`translate(0 ${y(top - 2) - 76})`} aria-hidden="true">
        <path d="M52 76 C53 52 90 51 91 76 C92 99 68 124 47 134 C65 117 80 99 80 79 C80 63 63 61 59 76 Z" />
        <circle cx="55" cy="76" r="6" /><circle className="bass-dot" cx="102" cy="64" r="4" /><circle className="bass-dot" cx="102" cy="88" r="4" />
      </g>}
    <g className="reading-note">
      {ledger.map((s) => <line key={s} x1="227" x2="273" y1={y(s)} y2={y(s)} />)}
      <ellipse cx="250" cy={y(step)} rx="14" ry="10" transform={`rotate(-18 250 ${y(step)})`} />
      <line x1={down ? 237 : 263} x2={down ? 237 : 263} y1={y(step)} y2={y(step) + (down ? 64 : -64)} />
    </g>
  </svg>;
}
