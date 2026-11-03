import { useState } from "react";
import LearningPath from "../components/LearningPath";
import Practice from "./Practice";
import type { LearningLaunchOptions } from "../features/lessons/learningPath";
import type { PracticeIntent } from "../features/lessons/practiceNavigation";
import type { Locale, MessageKey } from "../i18n/messages";

export default function PracticeJourney({ t, locale, onLearn, onSkills, onPractice, onOpenSound, onFocusChange }: {
  t: (key: MessageKey) => string;
  locale: Locale;
  onLearn: (stepId?: string, options?: LearningLaunchOptions) => void;
  onSkills: () => void;
  onPractice: (intent: PracticeIntent) => void;
  onOpenSound: () => void;
  onFocusChange: (focus: boolean) => void;
}) {
  const [browse, setBrowse] = useState(false);
  if (browse) return <><button type="button" className="btn text journey-back" onClick={() => { setBrowse(false); window.scrollTo(0, 0); }}>{t("journeyBack")}</button><Practice t={t} locale={locale} onOpenSound={onOpenSound} onFocusChange={onFocusChange} /></>;
  return <LearningPath t={t} onChapter={(chapter) => onLearn(chapter.id)} onExercise={(kind, options) => onLearn(kind, options)} onSkills={onSkills} onPractice={onPractice} onBrowse={() => setBrowse(true)} />;
}
