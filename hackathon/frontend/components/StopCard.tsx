"use client";

import { useState } from "react";
import type { CourseItem, Tier, UserProfile } from "@/lib/types";
import { CategoryIcon, CATEGORY_META } from "./CategoryIcon";
import { DriverCard } from "./DriverCard";
import { FoodBadges } from "./FoodBadges";
import { PhotoCredit, PlacePhoto } from "./PlacePhoto";

export function moveLabel(item: Pick<CourseItem, "move_method" | "move_min">): string | null {
  if (item.move_method == null || item.move_min == null) return null;
  if (item.move_method === "walk") return `${item.move_min} min walk`;
  if (item.move_method === "taxi") return `${item.move_min} min by taxi`;
  return `${item.move_min} min by bus`;
}

export function MoveInfo({ item }: { item: CourseItem }) {
  const label = moveLabel(item);
  if (!label) return null;
  return (
    <div className="flex items-center gap-2 pl-5 py-2 text-sm text-muted">
      <span className="h-6 border-l-2 border-dashed border-sea/50" aria-hidden />
      <span aria-hidden>{item.move_method === "taxi" ? "🚕" : "🚶"}</span>
      <span>{label}</span>
    </div>
  );
}

// 6.3 timeline card. `size="large"` is reused for the current stop in trip mode (6.4).
export function StopCard({
  item,
  tier,
  diet = "none",
  size = "normal",
  isNew = false,
  children,
}: {
  item: CourseItem;
  tier: Tier;
  diet?: UserProfile["diet"];
  size?: "normal" | "large";
  isNew?: boolean;
  children?: React.ReactNode;
}) {
  const [driverOpen, setDriverOpen] = useState(false);
  const p = item.place;
  const large = size === "large";

  return (
    <article
      id={`stop-${item.order}`}
      className={`rounded-2xl border bg-paper overflow-hidden shadow-sm ${
        large ? "border-sea" : "border-line"
      }`}
    >
      <div className="relative">
        <PlacePhoto place={p} className={large ? "h-52" : "h-40"} />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-sm font-semibold shadow">
          <span>{item.order}</span>
          <span className="text-muted">·</span>
          <span>{item.start_time}</span>
        </div>
        {isNew && (
          <span className="absolute right-3 top-3 rounded-full bg-tangerine text-white px-2 py-0.5 text-xs font-bold shadow">
            New
          </span>
        )}
      </div>
      <div className="p-4">
        <PhotoCredit place={p} />
        <div className="mt-2 flex items-start gap-2.5">
          <CategoryIcon category={p.category} />
          <div className="min-w-0 flex-1">
            <h3 className={`${large ? "text-xl" : "text-lg"} font-bold leading-tight`}>{p.name_en}</h3>
            <p lang="ko" className="text-sm text-muted">
              {p.name_ko}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-sea-soft text-sea px-2 py-0.5 font-medium">Stay {item.stay_min} min</span>
          <span className="rounded-full bg-sand px-2 py-0.5 text-muted">{CATEGORY_META[p.category].label}</span>
          {p.accessibility.indoor && <span className="rounded-full bg-sand px-2 py-0.5 text-muted">Indoor</span>}
          {item.is_rest_stop && (
            <span className="rounded-full bg-leaf/10 text-leaf px-2 py-0.5 font-medium">Rest stop</span>
          )}
        </div>
        <p className="mt-3 text-[15px] leading-relaxed">{item.reason_en}</p>
        <FoodBadges food={p.food_options} diet={diet} />
        <PhraseCards item={item} tier={tier} />
        <button
          onClick={() => setDriverOpen(true)}
          className="mt-4 w-full rounded-xl border border-ink/80 py-2.5 text-sm font-semibold active:bg-sand"
        >
          🚕 Show to driver
        </button>
        {children}
      </div>
      {driverOpen && <DriverCard place={p} onClose={() => setDriverOpen(false)} />}
    </article>
  );
}

// US-18 (P1): premium shows cards; free shows a lock row.
function PhraseCards({ item, tier }: { item: CourseItem; tier: Tier }) {
  const [open, setOpen] = useState(false);
  if (tier === "free") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-sand px-3 py-2 text-sm text-muted">
        <span aria-hidden>🔒</span> Local phrases · Premium
      </div>
    );
  }
  if (!item.phrase_cards.length) return null;
  return (
    <div className="mt-3 rounded-xl bg-sea-soft/60 border border-sea/15">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-sea"
        aria-expanded={open}
      >
        <span>💬 Local phrases ({item.phrase_cards.length})</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="px-3 pb-3 space-y-2">
          {item.phrase_cards.map((c, i) => (
            <li key={i} className="rounded-lg bg-white px-3 py-2">
              <p lang="ko" className="text-lg font-semibold">
                {c.text_ko}
              </p>
              <p className="text-sm text-muted">{c.text_en}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
