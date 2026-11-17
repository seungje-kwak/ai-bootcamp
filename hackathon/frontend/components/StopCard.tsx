"use client";

import { useState } from "react";
import { kakaoDirectionsUrl } from "@/lib/directions";
import { straightLineMeters } from "@/lib/geo";
import { MESSAGES, useLocale, travelMessages } from "@/lib/i18n";
import { localizedCategory, localizedPhrase, localizedPlaceName } from "@/lib/localized-place";
import { useRouteEstimate } from "@/lib/route-estimate";
import { addMinutes } from "@/lib/time";
import type { CourseItem, ItemStatus, Tier, UserProfile } from "@/lib/types";
import { CategoryIcon } from "./CategoryIcon";
import { DriverCard } from "./DriverCard";
import { FoodBadges } from "./FoodBadges";
import { ReasonText } from "./LocalizedText";
import { PhotoCredit, PlacePhoto } from "./PlacePhoto";
import { PlaceGuide } from "./PlaceGuide";

/** How the traveler reaches this stop. Null for the first stop (no move_method / move_min). */
export function hasMove(item: Pick<CourseItem, "move_method" | "move_min">): boolean {
  return item.move_method != null && item.move_min != null;
}

export function moveLabel(item: Pick<CourseItem, "move_method" | "move_min">): string | null {
  if (item.move_method == null || item.move_min == null) return null;
  if (item.move_method === "walk") return `${item.move_min} min walk`;
  if (item.move_method === "taxi") return `${item.move_min} min by taxi`;
  return `${item.move_min} min by bus`;
}

// The leg into `item`. What is known and what is estimated are kept apart:
//   time            -> from the itinerary (planner estimate)
//   distance        -> straight line between the two coordinates, labelled as such
//   road distance,
//   taxi fare       -> only when the route service answered; otherwise no number at all
// `from` is missing for the first stop or when the previous place left the plan (a re-plan replaced it).
export function MoveInfo({ item, from }: { item: CourseItem; from?: CourseItem }) {
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  const M = MESSAGES[locale];
  const isTaxi = item.move_method === "taxi" && from !== undefined;
  const route = useRouteEstimate(from?.place ?? null, item.place, isTaxi);
  if (!hasMove(item)) return null;
  const method = item.move_method === "taxi" ? tx.moveTaxi : item.move_method === "bus" ? tx.moveBus : tx.moveWalk;
  const toName = localizedPlaceName(item.place, locale);
  const straight = from ? M.common.distance(straightLineMeters(from.place, item.place)) : null;
  return (
    <div className="move-strip">
      <span className="move-strip__symbol" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {item.move_method === "walk" ? (
            <>
              <circle cx="13" cy="4" r="2" />
              <path d="m7 21 3-6 2-3m-4-5 4 2 3 3 3 1m-9 1-3 1m8-3 3 5v4" />
            </>
          ) : item.move_method === "taxi" ? (
            <path d="M5 10 7 5h10l2 5M4 10h16v8H4zM6 18v2m12-2v2M7 14h2m6 0h2" />
          ) : (
            <>
              <rect x="5" y="3" width="14" height="16" rx="2" />
              <path d="M5 9h14M8 22l2-3m4 0 2 3M8 13h2m4 0h2" />
            </>
          )}
        </svg>
      </span>
      <span className="move-strip__content">
        <small>{tx.nextMove}</small>
        <strong>
          {item.move_min} {tx.min} · {method}
        </strong>
        {from && (
          <span className="move-strip__route">
            {localizedPlaceName(from.place, locale)} → {toName}
          </span>
        )}
        {straight && <span className="move-strip__meta">{M.move.legNote(straight)}</span>}
        {isTaxi && route.status === "ok" && (
          <>
            <span className="move-strip__fare-line">{M.move.fareLine(M.common.won(route.taxiFareKrw), M.common.distance(route.distanceM), route.durationMin)}</span>
            <span className="move-strip__meta">{M.move.fareSource}</span>
          </>
        )}
        {isTaxi && route.status !== "ok" && route.status !== "idle" && (
          <span className="move-strip__meta" role="note">
            {route.status === "loading" ? M.move.fareLoading : route.status === "error" ? M.move.fareFailed : M.move.fareNone}
          </span>
        )}
      </span>
      <a className="move-strip__link" href={kakaoDirectionsUrl(item.place)} target="_blank" rel="noopener noreferrer" aria-label={`${M.move.directions}: ${toName}`}>
        {tx.route}
        <span aria-hidden="true"> ↗</span>
      </a>
    </div>
  );
}

const SIMPLE_HOURS = /^[\d:\s\-–~]+$/; // "09:00-18:00": reads the same in every language
const ALWAYS_OPEN = new Set(["Open 24 hours", "24h / always open"]);

/** Opening hours and closed days, when the place has them. */
function Hours({ item }: { item: CourseItem }) {
  const { locale } = useLocale();
  const S = MESSAGES[locale].stop;
  const p = item.place;
  const hours = p.opening_hours?.trim();
  const closed = (p.closed_days ?? [])
    .map((d) => S.weekdays[d as keyof typeof S.weekdays])
    .filter(Boolean)
    .join(S.listJoin);
  if (!hours && !closed) return null;
  const neutral = hours ? SIMPLE_HOURS.test(hours) || ALWAYS_OPEN.has(hours) : true;
  return (
    <div className="stop-card__hours">
      <small>{S.hours}</small>
      {hours && <p lang={locale !== "en" && !neutral ? "en" : undefined}>{ALWAYS_OPEN.has(hours) ? S.open24 : hours}</p>}
      {closed && <p>{S.closedOn(closed)}</p>}
    </div>
  );
}

export function StopCard({
  item,
  tier,
  diet = "none",
  size = "normal",
  isNew = false,
  status,
  selected = false,
  onShowOnMap,
  children,
}: {
  item: CourseItem;
  tier: Tier;
  diet?: UserProfile["diet"];
  size?: "normal" | "large";
  isNew?: boolean;
  /** Trip mode only: marks the card the traveler is at. */
  status?: ItemStatus;
  /** The stop picked on the map or in the overview. */
  selected?: boolean;
  /** Defaults to selecting the place on the page's map. */
  onShowOnMap?: () => void;
  children?: React.ReactNode;
}) {
  const [driverOpen, setDriverOpen] = useState(false);
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  const S = MESSAGES[locale].stop;
  const p = item.place;
  const large = size === "large";
  const name = localizedPlaceName(p, locale);
  const current = status === "current";
  const showOnMap =
    onShowOnMap ?? (() => window.dispatchEvent(new CustomEvent("mypace:select-place", { detail: { placeId: p.id } })));
  return (
    <article
      id={`stop-${item.order}`}
      tabIndex={-1}
      aria-label={`${S.order(item.order)}: ${name}`}
      className={`stop-card ${large ? "stop-card--current" : ""} ${current ? "is-current" : selected ? "is-selected" : ""}`}
    >
      <div className="stop-card__media">
        <PlacePhoto place={p} className={large ? "h-52" : "h-40"} />
        <span className="stop-card__time">
          <span className="stop-card__ordinal">{String(item.order).padStart(2, "0")}</span>
          <span className="stop-card__time-dot">·</span>
          {S.timeRange(item.start_time, addMinutes(item.start_time, item.stay_min))}
        </span>
        {isNew && <span className="stop-card__new">{tx.new}</span>}
      </div>
      <div className="stop-card__body">
        <div className="stop-card__heading">
          <CategoryIcon category={p.category} size={42} />
          <div className="stop-card__title-block">
            <p className="stop-card__category">{localizedCategory(p.category, locale)}</p>
            <h3>{name}</h3>
            {name !== p.name_ko && (
              <p className="stop-card__korean-name" lang="ko">
                {p.name_ko}
              </p>
            )}
          </div>
        </div>
        <div className="stop-card__metadata">
          <span className="stop-card__duration">
            ◷ {tx.stay} {item.stay_min} {tx.min}
          </span>
          {p.accessibility.indoor && <span>{tx.indoor}</span>}
          {item.is_rest_stop && <span>{tx.rest}</span>}
        </div>
        <div className="stop-card__why">
          <div className="stop-card__eyebrow">
            <span className="stop-card__eyebrow-rule" />
            {tx.whyStop}
          </div>
          <ReasonText item={item} />
        </div>
        <PlaceGuide place={p} />
        <Hours item={item} />
        <FoodBadges food={p.food_options} diet={diet} locale={locale} />
        <PhraseCards item={item} tier={tier} />
        <button type="button" onClick={() => setDriverOpen(true)} className="stop-card__driver">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 11 2-5h10l2 5M5 11h14v7H5zM7 18v2m10-2v2M5 14h2m10 0h2" />
          </svg>
          <span>{tx.driver}</span>
          <span className="stop-card__driver-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
        <div className="stop-card__map-actions">
          <button type="button" className="stop-card__map-link" onClick={showOnMap}>
            <span aria-hidden="true">⌖</span> {S.showOnMap}
          </button>
          <a
            className="stop-card__map-link"
            href={`https://map.kakao.com/link/map/${encodeURIComponent(p.name_ko)},${p.lat},${p.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {MESSAGES[locale].map.openKakao} ↗
          </a>
        </div>
        {children}
        <PhotoCredit place={p} />
      </div>
      {driverOpen && <DriverCard place={p} onClose={() => setDriverOpen(false)} />}
    </article>
  );
}

// US-18 (P1): premium shows the cards; the free preview shows a lock row.
function PhraseCards({ item, tier }: { item: CourseItem; tier: Tier }) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  if (tier === "free")
    return (
      <div className="phrase-preview" aria-label={`${tx.phrases} · ${tx.premium}`}>
        <span className="phrase-preview__lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <span className="phrase-preview__text">
          <strong>{tx.phrases}</strong>
          <small>
            {tx.premium} · {tx.lockedFeature}
          </small>
        </span>
        <span className="phrase-preview__chevron" aria-hidden="true">
          ›
        </span>
      </div>
    );
  if (!item.phrase_cards.length) return null;
  return (
    <div className="phrase-list">
      <button type="button" onClick={() => setOpen((v) => !v)} className="phrase-list__toggle" aria-expanded={open}>
        <span>
          ✦ &nbsp;{tx.phrases} ({item.phrase_cards.length})
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="phrase-list__items">
          {item.phrase_cards.map((c, i) => {
            const gloss = localizedPhrase(c.text_en, locale);
            return (
              <li key={i}>
                <p lang="ko" className="phrase-list__ko">
                  {c.text_ko}
                </p>
                {locale !== "ko" && (
                  <p lang={gloss.translated ? undefined : "en"} className="phrase-list__en">
                    <small>{gloss.translated && locale !== "en" ? locale.toUpperCase() : "EN"}</small>
                    {gloss.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
