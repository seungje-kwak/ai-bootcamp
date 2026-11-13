"use client";

import { useState } from "react";
import type { Place } from "@/lib/types";
import { CATEGORY_META } from "./CategoryIcon";

// US-05: real photo or a category placeholder. Never another photo, never AI images.
export function PlacePhoto({ place, className = "h-40" }: { place: Place; className?: string }) {
  const [failed, setFailed] = useState(false);
  const meta = CATEGORY_META[place.category];
  if (!place.image_url || failed) {
    return (
      <div
        className={`${className} w-full flex items-center justify-center text-white/90`}
        style={{ background: meta.color }}
        role="img"
        aria-label={`${place.name_en} (no photo yet)`}
      >
        <span className="text-4xl" aria-hidden>
          {meta.icon}
        </span>
      </div>
    );
  }
  return (
    // Plain <img>: Supabase/TourAPI hosts don't need next/image allow-listing (R-09).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={place.image_url}
      alt={place.name_en}
      className={`${className} w-full object-cover`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function PhotoCredit({ place }: { place: Place }) {
  const parts: string[] = [];
  if (place.image_url && place.image_source) parts.push(`Photo: ${place.image_source}`);
  if (place.last_verified_at) parts.push(`Verified ${place.last_verified_at}`);
  if (!parts.length) return null;
  return <p className="text-[11px] text-muted leading-snug">{parts.join(" · ")}</p>;
}
