import { useState } from "react";
import { noteName } from "../features/midi/notes";
import type { DrillTarget } from "../features/lessons/drills";
import type { MessageKey } from "../i18n/messages";

export default function ChordFingerGuide({ target, t }: { target: DrillTarget; t: (key: MessageKey) => string }) {
  const [selected, setSelected] = useState(0);
  const names: MessageKey[] = ["drillThumb", "drillIndex", "drillMiddleFinger", "drillRing", "drillPinky"];
  const naturals = [57, 59, 60, 62, 64, 65, 67];
  return <section className="chord-guide" aria-label={t("drillGuide")}>
    <div className="chord-guide-top"><strong>{target.name}</strong><span>{t("drillGuideHand")}</span></div>
    <div className="chord-guide-picture">
      <div className="finger-hand" role="img" aria-label={t("drillGuideHand")}>
        <div className="finger-palm" />
        {[1, 2, 3, 4, 5].map((finger) => <div key={finger} className={`finger-digit finger-digit-${finger}${target.fingers?.includes(finger) && (!selected || selected === finger) ? " lit" : ""}`}><span>{finger}</span></div>)}
      </div>
      <div className="finger-keyboard" role="img" aria-label={target.pitches.map((p, i) => `${noteName(p)}: ${target.fingers?.[i]}`).join(", ")}>
        {naturals.map((p, i) => { const n = target.pitches.indexOf(p); const finger = n < 0 ? null : target.fingers?.[n];
          return <div key={p} style={{ left: `${i / 7 * 100}%`, width: `${100 / 7}%` }} className={`finger-white${finger ? " used" : ""}${finger && (!selected || selected === finger) ? " lit" : ""}`}><span>{noteName(p)}</span>{finger && <b>{finger}</b>}</div>;
        })}
        {[0, 2, 3, 5].map((i) => <div key={i} className="finger-black" style={{ left: `${(i + 1) / 7 * 100 - 4.15}%` }} />)}
      </div>
    </div>
    <div className="finger-mapping">{target.fingers?.map((finger, i) => <button key={finger} type="button" className="btn" aria-pressed={selected === finger} onClick={() => setSelected(selected === finger ? 0 : finger)}><b>{finger}</b><span>{t(names[finger - 1])} → {noteName(target.pitches[i])}</span></button>)}</div>
    <p className="small muted">{t("drillFingerLimit")}</p>
  </section>;
}
