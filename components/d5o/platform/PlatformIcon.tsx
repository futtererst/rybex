import type { ReactNode } from "react";

export type PlatformIconName = "hub" | "discover" | "inbox" | "portfolio" | "decision" | "calendar" | "people" | "execution" | "handoff" | "evidence" | "insight" | "model" | "settings" | "plus";

const paths: Record<PlatformIconName, ReactNode> = {
  hub: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></>,
  discover: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5M8 13l2-2 1.5 1.5L14 9" /></>,
  inbox: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 14h5l2 3h4l2-3h5" /></>,
  portfolio: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
  decision: <><path d="M4 4h16v16H4zM8 9h8M8 13h5M8 17h8" /><path d="m15 13 2 2 3-3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 18h3M15 14h2" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1" /></>,
  execution: <><path d="M4 20h16M6 17V8l6-4 6 4v9M9 17v-5h6v5M4 8l8-5 8 5" /></>,
  handoff: <><path d="M4 8h12l-3-3M16 8l-3 3M20 16H8l3-3M8 16l3 3" /></>,
  evidence: <><path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7" /></>,
  insight: <><path d="M4 20V4M4 20h16M8 16l4-5 3 2 5-7" /><circle cx="8" cy="16" r="1" /><circle cx="12" cy="11" r="1" /><circle cx="20" cy="6" r="1" /></>,
  model: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="8" y="14" width="8" height="7" rx="1" /><path d="M6.5 10v3h5.5M17.5 10v3H12v1" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  plus: <path d="M12 4v16M4 12h16" />
};

export function PlatformIcon({ name }: { name: PlatformIconName }) {
  return <svg aria-hidden="true" className="d5o-platform-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{paths[name]}</svg>;
}
