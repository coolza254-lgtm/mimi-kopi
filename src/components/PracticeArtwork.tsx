/** Original decorative illustration, independent from lesson or user score data. */
export default function PracticeArtwork() {
  return <svg className="practice-artwork" viewBox="0 0 340 240" aria-hidden="true" focusable="false">
    <rect className="art-paper-shadow" x="41" y="30" width="248" height="151" rx="14" transform="rotate(-7 165 105)" />
    <g transform="rotate(-7 165 105)">
      <rect className="art-paper" x="34" y="22" width="248" height="151" rx="14" />
      <path className="art-staff" d="M57 65h202M57 76h202M57 87h202M57 98h202M57 109h202" />
      <path className="art-note" d="M82 98V53m48 34V42m47 34V31m46 56V42" />
      {[[77, 99], [125, 88], [172, 77], [218, 88]].map(([cx, cy], i) => <ellipse className={i === 1 ? "art-note-head accent" : "art-note-head"} key={cx} cx={cx} cy={cy} rx="7" ry="5" transform={`rotate(-18 ${cx} ${cy})`} />)}
      <path className="art-small-line" d="M58 137h47M118 137h28" />
    </g>
    <g transform="rotate(5 170 165)">
      <rect className="art-keyboard-shadow" x="33" y="139" width="279" height="77" rx="12" />
      <rect className="art-keyboard" x="27" y="131" width="279" height="77" rx="11" />
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <path className="art-key-divider" key={i} d={`M${27 + i * 31} 139v61`} />)}
      {[50, 81, 143, 174, 205, 267].map((x) => <rect className="art-black-key" key={x} x={x} y="131" width="17" height="45" rx="3" />)}
      <rect className="art-active-key" x="120" y="139" width="29" height="60" rx="3" />
      <rect className="art-black-key" x="143" y="131" width="17" height="45" rx="3" />
    </g>
  </svg>;
}
