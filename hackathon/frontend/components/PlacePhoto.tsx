"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { localizedPlaceName } from "@/lib/localized-place";
import type { Category, Place } from "@/lib/types";
import { Icon } from "./Icon";

// Line illustrations by place type, for places that have no verified photo.
// They are drawn to read as "illustration", so nobody mistakes them for the place itself.
const ART: Record<Category, React.ReactNode> = {
  food: (
    <>
      <path d="M22 62h76a38 38 0 01-24 35v5H46v-5a38 38 0 01-24-35z" />
      <path d="M48 46c0-6 5-7 5-13M61 46c0-6 5-7 5-13M74 46c0-6 5-7 5-13" />
      <path d="M12 108h96" />
    </>
  ),
  cafe: (
    <>
      <path d="M26 46h56v26a22 22 0 01-22 22H48a22 22 0 01-22-22z" />
      <path d="M82 54h7a11 11 0 010 22h-7" />
      <path d="M42 34c0-6 5-7 5-12M58 34c0-6 5-7 5-12" />
      <path d="M18 106h80" />
    </>
  ),
  nature: (
    <>
      <path d="M8 98c14-2 22-30 36-30s18 20 30 20 14-10 22-10 12 8 16 20" />
      <path d="M60 60V34M60 34c-9 0-15-6-15-13 0-8 7-15 15-15s15 7 15 15c0 7-6 13-15 13z" />
      <path d="M8 108h104" />
    </>
  ),
  culture: (
    <>
      <path d="M12 48c18-3 34-13 48-32 14 19 30 29 48 32" />
      <path d="M26 50v44M94 50v44M46 50v44M74 50v44" />
      <path d="M16 94h88M10 106h100" />
    </>
  ),
  market: (
    <>
      <path d="M18 46l8-24h68l8 24" />
      <path d="M18 46a10.5 10.5 0 0021 0 10.5 10.5 0 0021 0 10.5 10.5 0 0021 0 10.5 10.5 0 0021 0" />
      <path d="M26 58v44h68V58M50 102V78h20v24" />
    </>
  ),
  photo: (
    <>
      <path d="M8 84c16-3 28-26 42-26s20 16 32 16 16-12 30-12" />
      <circle cx="88" cy="34" r="12" />
      <path d="M8 100c10 0 10 5 20 5s10-5 20-5 10 5 20 5 10-5 20-5 10 5 20 5" />
    </>
  ),
};

function Placeholder({ place, className, compact }: { place: Place; className: string; compact: boolean }) {
  const { locale, t } = useLocale();
  return (
    <div
      className={`ph ${className}`}
      data-cat={place.category}
      role="img"
      aria-label={`${localizedPlaceName(place, locale)}: ${t.stop.noPhoto}`}
    >
      <svg
        className="ph__art"
        viewBox="0 0 120 120"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ART[place.category]}
      </svg>
      {!compact && (
        <span className="ph__note">
          <Icon name="info" size={13} />
          {t.stop.noPhoto}
        </span>
      )}
    </div>
  );
}

// US-05: the place's own photo, or an illustration that says there is no photo yet.
// Never another place's photo and never a generated image.
export function PlacePhoto({ place, className = "stop__photo", compact = false }: { place: Place; className?: string; compact?: boolean }) {
  const { locale } = useLocale();
  const [failed, setFailed] = useState(false);
  if (!place.image_url || failed) return <Placeholder place={place} className={className} compact={compact} />;
  return (
    // Plain <img>: Supabase/TourAPI hosts don't need next/image allow-listing (R-09).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={place.image_url}
      alt={localizedPlaceName(place, locale)}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/** Photo source and verification date. Shown wherever the photo is. */
export function PhotoCredit({ place, className = "stop__credit" }: { place: Place; className?: string }) {
  const { t } = useLocale();
  const parts: string[] = [];
  if (place.image_url && place.image_source) parts.push(t.stop.photoCredit(place.image_source));
  if (place.last_verified_at) parts.push(t.stop.verified(place.last_verified_at));
  if (!parts.length) return null;
  return (
    <p className={className}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> | </span>}
          {p}
        </span>
      ))}
    </p>
  );
}
