"use client";

import { useState } from "react";
import { localizedPlaceName } from "@/lib/localized-place";
import { MESSAGES, useLocale } from "@/lib/i18n";
import type { Category, Place } from "@/lib/types";

// Line drawings by place type, for places with no verified photo. They read as "illustration",
// so nobody mistakes them for the place itself.
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

// US-05 / PRD 6.3: the place's own photo, or a category illustration on a plain background.
// Never another place's photo and never a generated image. Only the card whose photo failed switches.
export function PlacePhoto({ place, className = "h-40" }: { place: Place; className?: string }) {
  const [failed, setFailed] = useState(false);
  const { locale } = useLocale();

  if (!place.image_url || failed) {
    return (
      <div
        className={`${className} place-photo-fallback place-photo-fallback--${place.category}`}
        role="img"
        aria-label={`${localizedPlaceName(place, locale)}: ${MESSAGES[locale].stop.noPhoto}`}
      >
        <span className="place-photo-fallback__glow" aria-hidden="true" />
        <svg
          className="place-photo-fallback__art"
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
      </div>
    );
  }
  return (
    // Plain <img>: Supabase/TourAPI hosts don't need next/image allow-listing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={place.image_url}
      alt={localizedPlaceName(place, locale)}
      className={`${className} w-full object-cover`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/** Photo source and verification date. Shown wherever the photo is. */
export function PhotoCredit({ place }: { place: Place }) {
  const { locale } = useLocale();
  const parts: string[] = [];
  if (place.image_url && place.image_source) parts.push(`${locale === "zh" ? "图片来源" : locale === "ja" ? "写真提供" : locale === "ko" ? "사진 출처" : "Photo"}: ${place.image_source}`);
  if (place.last_verified_at) parts.push(`${locale === "zh" ? "核实日期" : locale === "ja" ? "確認日" : locale === "ko" ? "확인일" : "Verified"}: ${place.last_verified_at}`);
  if (!parts.length) return null;
  return <p className="photo-credit">{parts.join(" · ")}</p>;
}
