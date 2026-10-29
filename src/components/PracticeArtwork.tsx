import { useId } from "react";
import "../styles/studio-art.css";

/** Original decorative instrument and sound trail, unrelated to assessment data. */
export default function PracticeArtwork() {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;
  return <svg className="practice-artwork studio-art" viewBox="0 0 480 350" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}-aura`}>
        <stop stopColor="var(--studio-art-glow)" stopOpacity=".33" />
        <stop offset=".5" stopColor="var(--studio-art-glow-soft)" stopOpacity=".18" />
        <stop offset="1" stopColor="var(--studio-art-glow-soft)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="var(--studio-art-glass)" stopOpacity=".32" />
        <stop offset="1" stopColor="var(--studio-art-glass-shade)" stopOpacity=".08" />
      </linearGradient>
      <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="var(--studio-art-rim)" stopOpacity=".7" />
        <stop offset="1" stopColor="var(--studio-art-rim)" stopOpacity=".06" />
      </linearGradient>
      <linearGradient id={`${id}-case`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="var(--studio-art-body-top)" />
        <stop offset="1" stopColor="var(--studio-art-body-bottom)" />
      </linearGradient>
      <linearGradient id={`${id}-white`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="var(--studio-art-white)" />
        <stop offset=".75" stopColor="var(--studio-art-white-mid)" />
        <stop offset="1" stopColor="var(--studio-art-white-shade)" />
      </linearGradient>
      <linearGradient id={`${id}-black`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="var(--studio-art-black-top)" />
        <stop offset=".28" stopColor="var(--studio-art-black-mid)" />
        <stop offset="1" stopColor="var(--studio-art-black)" />
      </linearGradient>
      <linearGradient id={`${id}-note`} x1="0" y1="1" x2="1" y2="0">
        <stop stopColor="var(--studio-art-note)" />
        <stop offset="1" stopColor="var(--studio-art-note-light)" />
      </linearGradient>
      <linearGradient id={`${id}-secondary`} x1="0" y1="1" x2="1" y2="0">
        <stop stopColor="var(--studio-art-note-alt)" />
        <stop offset="1" stopColor="var(--studio-art-note-alt-light)" />
      </linearGradient>
      <linearGradient id={`${id}-trail`} x1="0" y1="1" x2="1" y2="0">
        <stop stopColor="var(--studio-art-glow)" stopOpacity=".08" />
        <stop offset=".55" stopColor="var(--studio-art-note-light)" stopOpacity=".8" />
        <stop offset="1" stopColor="var(--studio-art-note-alt-light)" stopOpacity=".12" />
      </linearGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-40%" width="170%" height="200%">
        <feDropShadow dx="0" dy="17" stdDeviation="12" floodColor="var(--studio-art-shadow)" floodOpacity=".42" />
      </filter>
      <filter id={`${id}-note-shadow`} x="-60%" y="-40%" width="220%" height="220%">
        <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="var(--studio-art-shadow)" floodOpacity=".3" />
      </filter>
    </defs>

    <ellipse cx="263" cy="173" rx="220" ry="161" fill={paint("aura")} />
    <g className="studio-art-orbits" fill="none">
      <ellipse cx="256" cy="188" rx="197" ry="102" transform="rotate(-18 256 188)" stroke="var(--studio-art-orbit)" strokeOpacity=".22" />
      <ellipse cx="256" cy="188" rx="214" ry="117" transform="rotate(-18 256 188)" stroke="var(--studio-art-orbit)" strokeOpacity=".09" />
      <path d="M50 239c71 74 273 51 377-42" stroke="var(--studio-art-note)" strokeOpacity=".45" strokeLinecap="round" />
      <path d="M95 129c39-59 168-92 271-63" stroke="var(--studio-art-rim)" strokeOpacity=".3" strokeDasharray="2 8" strokeLinecap="round" />
    </g>
    <circle cx="67" cy="226" r="5" fill="var(--studio-art-note-light)" />
    <circle cx="420" cy="154" r="4" fill="var(--studio-art-note-alt-light)" />
    <circle cx="349" cy="49" r="3" fill="var(--studio-art-white)" />
    <path d="m409 89 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="var(--studio-art-note-light)" opacity=".8" />
    <path d="m89 78 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="var(--studio-art-note-alt-light)" opacity=".7" />

    <g className="studio-art-glass" transform="translate(176 47) rotate(-12 100 58)">
      <rect x="6" y="8" width="196" height="112" rx="20" fill="var(--studio-art-lowlight)" opacity=".13" />
      <rect width="196" height="112" rx="20" fill={paint("glass")} stroke={paint("edge")} />
      <path d="M20 77h156M20 50h156" stroke="var(--studio-art-rim)" strokeOpacity=".12" />
      <path d="m20 68 15-1 10-21 14 40 15-52 14 37 14-9 13 1 14-25 12 34 13-8 22-1" fill="none" stroke="var(--studio-art-white)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {[13, 22, 17, 28, 12, 19, 31, 21, 15, 25, 11].map((height, i) => <rect key={i} x={22 + i * 14} y={93 - height} width="5" height={height} rx="2.5" fill={i % 3 === 0 ? "var(--studio-art-note-alt)" : "var(--studio-art-note-light)"} opacity=".28" />)}
      <circle cx="22" cy="20" r="3" fill="var(--studio-art-note-light)" />
      <path d="M34 20h36" stroke="var(--studio-art-rim)" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
    </g>

    <path className="studio-art-trail" d="M119 208c-12-38 36-43 59-73s20-80 83-103" fill="none" stroke={paint("trail")} strokeWidth="2" strokeDasharray="3 10" strokeLinecap="round" />
    <g className="studio-art-note studio-art-note-primary" transform="translate(118 107) rotate(-17)" filter={paint("note-shadow")}>
      <path d="M0 24V-22l33-7v40c0 7-6 13-14 13-6 0-10-3-10-7s6-10 14-10c1 0 2 0 3 1v-23L7-11v32c0 8-7 14-15 14-6 0-10-3-10-7s7-10 14-10c2 0 3 0 4 1Z" fill={paint("note")} />
      <path d="m7-19 19-4" stroke="var(--studio-art-white)" strokeWidth="2" strokeOpacity=".7" strokeLinecap="round" />
    </g>
    <g className="studio-art-note studio-art-note-secondary" transform="translate(383 73) rotate(16)" filter={paint("note-shadow")}>
      <path d="M0 15v-37h7v4c12 5 16 13 9 24-1-10-5-13-9-14v24C7 24-8 29-13 22c-4-7 6-15 13-13Z" fill={paint("secondary")} />
    </g>
    <g className="studio-art-keyboard" filter={paint("shadow")}>
      <g transform="translate(55 175) rotate(-13) skewX(18)">
        <path d="M0 96h332l9 10v13a9 9 0 0 1-9 9H18L0 113Z" fill="var(--studio-art-lowlight)" />
        <path d="m332 6 9 9v91l-9-9Z" fill="var(--studio-art-body-top)" />
        <rect width="332" height="112" rx="13" fill={paint("case")} stroke="var(--studio-art-rim)" strokeOpacity=".45" />
        <path d="M14 1h304" stroke="var(--studio-art-white)" strokeOpacity=".6" strokeLinecap="round" />
        <circle cx="19" cy="14" r="2.8" fill="var(--studio-art-note-light)" />
        <circle cx="31" cy="14" r="2" fill="var(--studio-art-muted)" />
        <circle cx="41" cy="14" r="2" fill="var(--studio-art-muted)" />
        <rect x="258" y="10" width="57" height="8" rx="4" fill="var(--studio-art-lowlight)" />
        <path d="M265 14h22" stroke="var(--studio-art-note-light)" strokeWidth="2" strokeLinecap="round" />
        {Array.from({ length: 14 }, (_, i) => <g key={i}>
          <rect x={12 + i * 22} y="28" width="21.5" height="74" rx="3" fill={paint("white")} />
          <path d={`M${15 + i * 22} 96h15`} stroke="var(--studio-art-white)" strokeWidth="2" strokeOpacity=".8" strokeLinecap="round" />
        </g>)}
        {[3, 8].map((i) => <rect key={i} x={15 + i * 22} y="81" width="15" height="13" rx="3" fill={i === 3 ? "var(--studio-art-inlay)" : "var(--studio-art-note-alt)"} opacity=".65" />)}
        {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => <g key={i}>
          <rect x={12 + (i + 1) * 22 - 6.5} y="27" width="13" height="46" rx="2.5" fill="var(--studio-art-black)" />
          <rect x={13 + (i + 1) * 22 - 6.5} y="27" width="11" height="39" rx="2" fill={paint("black")} />
          <path d={`M${15 + (i + 1) * 22 - 6.5} 30h6`} stroke="var(--studio-art-muted)" strokeWidth="1" strokeOpacity=".65" strokeLinecap="round" />
        </g>)}
        <path d="M19 113h296" stroke="var(--studio-art-muted)" strokeOpacity=".55" strokeLinecap="round" />
      </g>
    </g>
    <g className="studio-art-lightmarks" strokeLinecap="round">
      <path d="m87 287 42-10" stroke="var(--studio-art-rim)" strokeWidth="2" opacity=".6" />
      <path d="m89 298 23-5" stroke="var(--studio-art-rim)" opacity=".25" />
      <path d="m370 262 42-10" stroke="var(--studio-art-note-alt-light)" strokeWidth="2" opacity=".5" />
    </g>
  </svg>;
}
