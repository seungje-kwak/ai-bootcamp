// Landing illustration, drawn for this app (no stock or scraped imagery):
// Jeju City seen from the sea. Hallasan behind, the black basalt shore, and a three-stop
// route along the coast: the same numbered markers the itinerary and the map use.
export function HeroArt({ label }: { label: string }) {
  const stops = [
    { x: 176, y: 664 },
    { x: 410, y: 656 },
    { x: 622, y: 662 },
  ];
  return (
    <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7eedd" />
          <stop offset="1" stopColor="#f1dfc6" />
        </linearGradient>
        <linearGradient id="hero-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b7076" />
          <stop offset="1" stopColor="#0a454a" />
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#hero-sky)" />
      <circle cx="570" cy="368" r="88" fill="#d6745a" />
      {/* Hallasan, a broad shield volcano */}
      <path
        d="M-40 566C90 546 190 490 280 432c50-32 88-58 122-66 18-4 34-2 50 6 48 22 108 70 188 116 60 34 130 60 200 74v84H-40z"
        fill="#8fb4ae"
      />
      {/* oreum (small volcanic cones) and the low land in front */}
      <path d="M-40 612c60-4 104-40 150-48 48 8 92 42 152 48h200c58-6 104-34 150-40 48 6 92 34 150 40l78 2v40H-40z" fill="#5c9590" />
      <path d="M-40 642c160-12 300 6 460-4 140-8 280 8 420-2v66H-40z" fill="#efe3c8" />
      {/* black basalt shoreline */}
      <path
        d="M-40 704v-16l30-6 28 8 28-10 34 9 32-8 38 9 38-7 38 8 36-9 38 8 38-9 34 8 38-7 36 8 38-9 36 8 36-7 38 8 36-9 38 8 36-7 38 8 36-8 34 7 28-5v20z"
        fill="#283335"
      />
      <rect x="-40" y="700" width="880" height="320" fill="url(#hero-sea)" />
      <g fill="none" stroke="#8cc0bd" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round">
        <path d="M70 770q20-9 40 0t40 0" />
        <path d="M330 812q20-9 40 0t40 0t40 0" />
        <path d="M590 762q20-9 40 0t40 0" />
        <path d="M150 890q20-9 40 0t40 0" />
        <path d="M470 912q20-9 40 0t40 0t40 0" />
        <path d="M660 860q20-9 40 0t40 0" />
      </g>
      {/* the route: dotted, in visit order */}
      <path
        d="M176 664c84-26 150 14 234-8 72-18 132 20 212 6"
        fill="none"
        stroke="#1f2729"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray="0.1 12"
      />
      {stops.map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r="24" fill="#0f5a5f" stroke="#fffdf8" strokeWidth="4" />
          <text x={s.x} y={s.y + 7} textAnchor="middle" fontSize="21" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
