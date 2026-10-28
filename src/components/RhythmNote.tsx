export default function RhythmNote({ beats, label }: { beats:number;label:string }) {
  return <svg className="rhythm-symbol" viewBox="0 0 100 140" role="img" aria-label={label}>
    <ellipse cx="44" cy="100" rx={beats===4?22:18} ry="12" transform={beats===4?undefined:"rotate(-18 44 100)"} fill={beats===1?"currentColor":"none"} stroke="currentColor" strokeWidth={beats===4?5:3} />
    {beats!==4&&<line x1="61" x2="61" y1="97" y2="22" stroke="currentColor" strokeWidth="3" />}
  </svg>;
}
