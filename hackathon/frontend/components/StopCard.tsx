"use client";

import { useState } from "react";
import { useLocale, travelMessages } from "@/lib/i18n";
import { contentHelp, localizedCategory, localizedPlaceName, localizedReason } from "@/lib/localized-place";
import type { CourseItem, Tier, UserProfile } from "@/lib/types";
import { CategoryIcon } from "./CategoryIcon";
import { DriverCard } from "./DriverCard";
import { FoodBadges } from "./FoodBadges";
import { PhotoCredit, PlacePhoto } from "./PlacePhoto";
import { PlaceGuide } from "./PlaceGuide";

export function moveLabel(item: Pick<CourseItem, "move_method" | "move_min">): string | null {
  if (item.move_method == null || item.move_min == null) return null;
  if (item.move_method === "walk") return `${item.move_min} min walk`;
  if (item.move_method === "taxi") return `${item.move_min} min by taxi`;
  return `${item.move_min} min by bus`;
}

export function MoveInfo({ item }: { item: CourseItem }) {
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  if (!moveLabel(item)) return null;
  const directions = `https://map.kakao.com/link/to/${encodeURIComponent(item.place.name_ko)},${item.place.lat},${item.place.lng}`;
  const method = item.move_method === "taxi" ? tx.moveTaxi : item.move_method === "bus" ? tx.moveBus : tx.moveWalk;
  return <div className="move-strip">
    <span className="move-strip__symbol" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {item.move_method === "walk" ? <><circle cx="13" cy="4" r="2"/><path d="m7 21 3-6 2-3m-4-5 4 2 3 3 3 1m-9 1-3 1m8-3 3 5v4"/></> : item.move_method === "taxi" ? <><path d="M5 10 7 5h10l2 5M4 10h16v8H4zM6 18v2m12-2v2M7 14h2m6 0h2"/></> : <><rect x="5" y="3" width="14" height="16" rx="2"/><path d="M5 9h14M8 22l2-3m4 0 2 3M8 13h2m4 0h2"/></>}
      </svg>
    </span>
    <span className="move-strip__content"><small>{tx.nextMove}</small><strong>{item.move_min} {tx.min} · {method}</strong></span>
    <a className="move-strip__link" href={directions} target="_blank" rel="noopener noreferrer" aria-label={`${tx.route}: ${item.place.name_ko}`}>
      {tx.route}<span aria-hidden="true"> ↗</span>
    </a>
    {item.move_method === "taxi" && <span className="move-strip__fare">{tx.fare}</span>}
  </div>;
}

export function StopCard({ item, tier, diet = "none", size = "normal", isNew = false, children }: {
  item: CourseItem;
  tier: Tier;
  diet?: UserProfile["diet"];
  size?: "normal" | "large";
  isNew?: boolean;
  children?: React.ReactNode;
}) {
  const [driverOpen, setDriverOpen] = useState(false);
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  const p = item.place;
  const localized = localizedReason(item, locale);
  const large = size === "large";
  return (
    <article id={`stop-${item.order}`} className={`stop-card ${large ? "stop-card--current" : ""}`}>
      <div className="stop-card__media">
        <PlacePhoto place={p} className={large ? "h-52" : "h-40"} />
        <span className="stop-card__time"><span className="stop-card__ordinal">{String(item.order).padStart(2, "0")}</span><span className="stop-card__time-dot">·</span>{item.start_time}</span>
        {isNew && <span className="stop-card__new">{tx.new}</span>}
      </div>
      <div className="stop-card__body">
        <div className="stop-card__heading">
          <CategoryIcon category={p.category} size={42} />
          <div className="stop-card__title-block">
            <p className="stop-card__category">{localizedCategory(p.category, locale)}</p>
            <h3>{localizedPlaceName(p, locale)}</h3>
            <p className="stop-card__korean-name" lang="ko">{p.name_ko}</p>
          </div>
        </div>
        <div className="stop-card__metadata">
          <span className="stop-card__duration">◷ {tx.stay} {item.stay_min} {tx.min}</span>
          {p.accessibility.indoor && <span>{tx.indoor}</span>}
          {item.is_rest_stop && <span>{tx.rest}</span>}
        </div>
        <div className="stop-card__why">
          <div className="stop-card__eyebrow"><span className="stop-card__eyebrow-rule" />{tx.whyStop}</div>
          <p>{localized.text}</p>
          {locale !== "en" && !localized.hasTranslation && localized.original && (
            <details className="stop-card__original">
              <summary>{contentHelp(locale).original} <span aria-hidden="true">⌄</span></summary>
              <p lang="en">{localized.original}</p>
            </details>
          )}
        </div>
        <PlaceGuide place={p} />
        <FoodBadges food={p.food_options} diet={diet} locale={locale} />
        <PhraseCards item={item} tier={tier} />
        <button type="button" onClick={() => setDriverOpen(true)} className="stop-card__driver">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 11 2-5h10l2 5M5 11h14v7H5zM7 18v2m10-2v2M5 14h2m10 0h2"/></svg>
          <span>{tx.driver}</span><span className="stop-card__driver-arrow" aria-hidden="true">↗</span>
        </button>
        <div className="stop-card__map-actions">
          <button type="button" className="stop-card__map-link" onClick={() => {
            window.dispatchEvent(new CustomEvent("mypace:select-place", { detail: { placeId: p.id } }));
          }}>
            <span aria-hidden="true">⌖</span> {locale === "ko" ? "지도에서 확인" : locale === "en" ? "View on map" : locale === "zh" ? "在地图查看" : "地図で確認"}
          </button>
          <a className="stop-card__map-link" href={`https://map.kakao.com/link/map/${encodeURIComponent(p.name_ko)},${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer">
            {locale === "ko" ? "카카오맵 열기" : locale === "en" ? "Open Kakao Map" : locale === "zh" ? "打开Kakao地图" : "カカオマップで見る"} ↗
          </a>
        </div>
        {children}
        <PhotoCredit place={p} />
      </div>
      {driverOpen && <DriverCard place={p} onClose={() => setDriverOpen(false)} />}
    </article>
  );
}

function PhraseCards({ item, tier }: { item: CourseItem; tier: Tier }) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  if (tier === "free") return (
    <div className="phrase-preview" aria-label={`${tx.phrases} · ${tx.premium}`}>
      <span className="phrase-preview__lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>
      <span className="phrase-preview__text"><strong>{tx.phrases}</strong><small>{tx.premium} · {tx.lockedFeature}</small></span>
      <span className="phrase-preview__chevron" aria-hidden="true">›</span>
    </div>
  );
  if (!item.phrase_cards.length) return null;
  return <div className="phrase-list">
    <button type="button" onClick={() => setOpen(v => !v)} className="phrase-list__toggle" aria-expanded={open}>
      <span>✦ &nbsp;{tx.phrases} ({item.phrase_cards.length})</span><span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <ul className="phrase-list__items">{item.phrase_cards.map((c, i) => <li key={i}>
      <p lang="ko" className="phrase-list__ko">{c.text_ko}</p>
      <p lang="en" className="phrase-list__en"><small>EN</small>{c.text_en}</p>
    </li>)}</ul>}
  </div>;
}
