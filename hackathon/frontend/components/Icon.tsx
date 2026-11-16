import type { Category, MoveMethod } from "@/lib/types";

// One line-icon set for the whole app (24px grid, 1.7 stroke, round joins).
// Map markers, cards, buttons and placeholders all draw from here so nothing
// falls back to emoji, which render differently on every phone.
const PATHS = {
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  flag: <path d="M6 21V4M6 5h11l-2.2 3.5L17 12H6" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  map: <path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5l-6-2zM9 4.5v13M15 6.5v13" />,
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h6.5a3 3 0 000-6h-5a3 3 0 010-6H16" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4.6" r="1.7" />
      <path d="M12.5 8l-1.7 5.2M12.5 8.6l2.9 2.2 2.2.4M12 8.4L9.2 9.8l-1 2.6M10.8 13.2l2.8 2.8.8 4.5M10.8 13.2L9.6 17l-2.2 3.5" />
    </>
  ),
  taxi: (
    <>
      <path d="M10 4.5h4V7h-4z" />
      <path d="M4 17.5V13l1.7-4.4A2.4 2.4 0 018 7h8a2.4 2.4 0 012.3 1.6L20 13v4.5M4 17.5h16M5.2 12.4h13.6M6.5 17.5v1.8M17.5 17.5v1.8" />
      <path d="M7.4 14.9h.01M16.6 14.9h.01" />
    </>
  ),
  bus: (
    <>
      <rect x="5" y="4" width="14" height="14" rx="2.5" />
      <path d="M5 11.5h14M8 18v2M16 18v2M8.3 14.8h.01M15.7 14.8h.01" />
    </>
  ),
  external: (
    <path d="M14 5h5v5M19 5l-8.5 8.5M17 14v4a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 015 18V8.5A1.5 1.5 0 016.5 7H10" />
  ),
  copy: (
    <>
      <rect x="9" y="9" width="10.5" height="10.5" rx="2" />
      <path d="M15 9V6.5A1.5 1.5 0 0013.5 5h-7A1.5 1.5 0 005 6.5v7A1.5 1.5 0 006.5 15H9" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
    </>
  ),
  chat: (
    <path d="M5 6.5A1.5 1.5 0 016.5 5h11A1.5 1.5 0 0119 6.5v8a1.5 1.5 0 01-1.5 1.5H11l-4 3.5V16h-.5A1.5 1.5 0 015 14.5z" />
  ),
  sparkle: (
    <>
      <path d="M11 4l1.6 4.4L17 10l-4.4 1.6L11 16l-1.6-4.4L5 10l4.4-1.6L11 4z" />
      <path d="M18 15l.7 1.8 1.8.7-1.8.7L18 20l-.7-1.8-1.8-.7 1.8-.7L18 15z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5l8.5 14.5h-17L12 4.5z" />
      <path d="M12 10v4.5M12 17v.01" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.8 5.4 3.8 8.5s-1.3 5.9-3.8 8.5c-2.5-2.6-3.8-5.4-3.8-8.5S9.5 6.1 12 3.5z" />
    </>
  ),
  list: <path d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01" />,
  home: <path d="M4 11l8-6.5 8 6.5M6 9.8V19h12V9.8" />,
  bench: <path d="M5 11h14M6.5 11V7.5M17.5 11V7.5M5 14.5h14M7 14.5V19M17 14.5V19" />,
  // re-plan reasons
  rain: (
    <>
      <path d="M7.5 14.5a3.5 3.5 0 01.4-7 4.6 4.6 0 018.9 1.2 3 3 0 01-.3 5.8z" />
      <path d="M9 17.5l-.8 2M12.5 17.5l-.8 2M16 17.5l-.8 2" />
    </>
  ),
  closed: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  hungry: <path d="M7 4v5a2 2 0 004 0V4M9 4v16M16 20V4c-1.7 1.6-2.6 4.2-2.6 7.5H16" />,
  tired: (
    <>
      <path d="M4 18v-7M4 15h16v3M20 15v-2a2.5 2.5 0 00-2.5-2.5H11V15" />
      <circle cx="7.5" cy="12" r="1.5" />
    </>
  ),
  // moods
  moodGreat: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 10h.01M15 10h.01M8.5 14c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2" />
    </>
  ),
  moodOkay: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 10h.01M15 10h.01M9 15h6" />
    </>
  ),
  moodTired: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 10.5h2M14 10.5h2M9.5 15.5c.8-.6 1.6-.9 2.5-.9s1.7.3 2.5.9" />
    </>
  ),
  // diets
  leaf: <path d="M5 19c0-8 5-13 14-14 0 9-4.5 14-12 14M5 19c2-4.5 5-7.5 9-9.5" />,
  sprout: (
    <path d="M12 20v-8M12 12c0-3.5-2.5-5.5-6.5-5.5 0 3.5 2.5 5.5 6.5 5.5zM12 14c0-3 2.2-4.8 6.5-4.8 0 3-2.2 4.8-6.5 4.8z" />
  ),
  crescent: <path d="M15.5 4.5a8 8 0 100 15 6.5 6.5 0 010-15z" />,
  // categories (shared by map markers, cards and photo placeholders)
  nature: (
    <path d="M12 21v-6M12 15c-3.6 0-6-2.3-6-5.3C6 6.6 8.7 3.5 12 3.5s6 3.1 6 6.2c0 3-2.4 5.3-6 5.3zM12 12.5l2.2-2.2M12 10.5L10 8.5" />
  ),
  market: (
    <path d="M4 10l1.5-5h13L20 10M4 10a2.67 2.67 0 005.33 0 2.67 2.67 0 005.34 0A2.67 2.67 0 0020 10M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20" />
  ),
  cafe: (
    <path d="M5 9h11v5.5A4.5 4.5 0 0111.5 19h-2A4.5 4.5 0 015 14.5zM16 10.5h1.5a2.25 2.25 0 010 4.5H16M8 4.5c0 1 .8 1.2.8 2.2M11.5 4.5c0 1 .8 1.2.8 2.2" />
  ),
  food: <path d="M4 12h16a8 8 0 01-5 7.4V20H9v-.6A8 8 0 014 12zM9 9.5l9-5M11.5 10l8-3.2" />,
  culture: (
    <path d="M3.5 10.5c3-.6 6-2.6 8.5-6 2.5 3.4 5.5 5.4 8.5 6M6.5 10.8V19M17.5 10.8V19M4.5 19h15M10 19v-4.5h4V19" />
  ),
  photo: (
    <>
      <path d="M4.5 8.5A1.5 1.5 0 016 7h2l1.4-2h5.2L16 7h2a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0118 19H6a1.5 1.5 0 01-1.5-1.5z" />
      <circle cx="12" cy="12.8" r="3.2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}

export const CATEGORY_ICON: Record<Category, IconName> = {
  nature: "nature",
  market: "market",
  cafe: "cafe",
  food: "food",
  culture: "culture",
  photo: "photo",
};

export const MOVE_ICON: Record<MoveMethod, IconName> = { walk: "walk", taxi: "taxi", bus: "bus" };
