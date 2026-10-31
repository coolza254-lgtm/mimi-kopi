import { useId } from "react";

/** Original decorative instrument; the bars are artwork, not performance data. */
export default function PracticeArtwork() {
  const id = useId();
  return <svg className="practice-artwork atelier-art" viewBox="0 0 460 350" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-trail`} x2="0" y2="1"><stop stopColor="var(--art-accent)" stopOpacity=".05" /><stop offset="1" stopColor="var(--art-accent)" stopOpacity=".75" /></linearGradient>
      <linearGradient id={`${id}-keys`} x2="0" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#e9e9e9" /></linearGradient>
    </defs>
    <rect className="art-panel" x="25" y="20" width="410" height="310" rx="40" />
    <g className="art-staff" fill="none" stroke="var(--art-line)"><path d="M62 76h336M62 100h336M62 124h336M62 148h336M62 172h336" /><path d="M114 49v151M226 49v151M338 49v151" strokeDasharray="3 8" /></g>
    <g fill={`url(#${id}-trail)`}><rect x="116" y="102" width="29" height="122" rx="10" /><rect x="204" y="71" width="29" height="149" rx="10" /><rect x="293" y="44" width="29" height="167" rx="10" /></g>
    <g transform="translate(38 196) rotate(-9 190 48)">
      <rect x="1" y="13" width="384" height="108" rx="20" fill="var(--art-shadow)" opacity=".12" />
      <rect width="384" height="113" rx="18" fill="var(--art-case)" />
      <path d="M17 12h350" stroke="var(--art-accent)" strokeWidth="3" strokeLinecap="round" />
      {Array.from({ length: 14 }, (_, i) => <rect key={i} x={17+i*25} y="21" width="24" height="78" rx="4" fill={`url(#${id}-keys)`} />)}
      {[0,1,3,4,5,7,8,10,11,12].map((i) => <rect key={i} x={35+i*25} y="21" width="15" height="46" rx="3" fill="#202020" />)}
      {[3,6,10].map((i) => <rect key={i} x={19+i*25} y="91" width="19" height="5" rx="2" fill="var(--art-accent)" />)}
    </g>
    <g fill="var(--art-ink)"><ellipse cx="358" cy="81" rx="10" ry="7" transform="rotate(-18 358 81)" /><path d="M365 80V45h4v35z" /><ellipse cx="82" cy="165" rx="8" ry="6" transform="rotate(-18 82 165)" /><path d="M88 164v-29h3v29z" /></g>
    <path d="m383 145 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="var(--art-accent)" />
  </svg>;
}
