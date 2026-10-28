import { staffStep } from "../features/midi/notes";

/** Original three-note phrases, quarter notes on one treble staff. */
export default function PhraseStaff({ pitches, label }: { pitches:number[];label:string }) {
  const y=(p:number)=>42+(38-staffStep(p))*10;
  return <svg className="phrase-score" viewBox="0 0 650 190" role="img" aria-label={label}>
    {[0,1,2,3,4].map((i)=><line className="staff-line" key={i} x1="20" x2="630" y1={42+i*20} y2={42+i*20} />)}
    <text className="reading-clef" x="28" y="118" fontSize="112" fill="currentColor" aria-hidden="true">𝄞</text>
    {pitches.map((p,i)=>{const x=190+i*160,cy=y(p);return <g className="note-mark" key={i}>
      {p===60&&<line x1={x-22} x2={x+22} y1={cy} y2={cy} strokeWidth="2" />}
      <ellipse cx={x} cy={cy} rx="12" ry="9" transform={`rotate(-18 ${x} ${cy})`} /><line x1={x+11} x2={x+11} y1={cy} y2={cy-54} strokeWidth="2" />
    </g>;})}
  </svg>;
}
