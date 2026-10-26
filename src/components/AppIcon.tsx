export type IconName = "today" | "lessons" | "piano" | "score" | "sound" | "settings" | "arrow" | "chevron" | "clock" | "check" | "moon" | "sun";

const paths: Record<IconName, string[]> = {
  today: ["M3 10 12 3l9 7", "M5 9v11h5v-6h4v6h5V9"],
  lessons: ["M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4Z", "M13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2"],
  piano: ["M3 4h18v16H3Z", "M7 4v9h3V4M14 4v9h3V4", "M9 13v7M15 13v7"],
  score: ["M4 5h10M4 10h8M4 15h6", "M17 4v12M17 4l4-1v4l-4 1", "M17 16c-1-2-5-1-5 1s5 2 5-1Z"],
  sound: ["M4 4v16M12 4v16M20 4v16", "M2 9h4M10 15h4M18 8h4"],
  settings: ["M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"],
  arrow: ["M4 12h15M13 6l6 6-6 6"],
  chevron: ["m9 5 7 7-7 7"],
  clock: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "M12 7v5l3 2"],
  check: ["m5 12 4 4L19 6"],
  moon: ["M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z"],
  sun: ["M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"],
};

export default function AppIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`app-icon ${className}`} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {paths[name].map((d, i) => <path key={i} d={d} />)}
  </svg>;
}
