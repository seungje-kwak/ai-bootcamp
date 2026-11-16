"use client";

import { useState } from "react";
import { kakaoDirectionsUrl } from "@/lib/directions";
import { straightLineMeters } from "@/lib/geo";
import { useLocale } from "@/lib/i18n";
import { localizedCategory, localizedPhrase, localizedPlaceName } from "@/lib/localized-place";
import { useRouteEstimate } from "@/lib/route-estimate";
import { addMinutes } from "@/lib/time";
import type { CourseItem, ItemStatus, Place, Tier, UserProfile } from "@/lib/types";
import { CategoryIcon } from "./CategoryIcon";
import { DriverCard } from "./DriverCard";
import { FoodBadges } from "./FoodBadges";
import { Icon, MOVE_ICON } from "./Icon";
import { PlaceDescription, ReasonText } from "./LocalizedText";
import { PhotoCredit, PlacePhoto } from "./PlacePhoto";

/** How the traveler reaches `to` from `from`. Null for the first stop (no move_method / move_min). */
export function hasMove(item: Pick<CourseItem, "move_method" | "move_min">): boolean {
  return item.move_method != null && item.move_min != null;
}

// The leg between two stops. What is known and what is estimated are kept apart:
//   time            -> from the itinerary (planner estimate), labelled as such
//   distance        -> straight line between the two coordinates, labelled as such
//   road distance,
//   taxi fare       -> only when the route service answered; otherwise no number at all
// `from` is missing when the previous place is no longer in the plan (for example the closed
// place that an alternative replaced): then only the planned time and the directions link are shown.
export function MoveLeg({ from, to }: { from?: CourseItem; to: CourseItem }) {
  const { locale, t } = useLocale();
  const isTaxi = to.move_method === "taxi" && from !== undefined;
  const route = useRouteEstimate(from?.place ?? null, to.place, isTaxi);
  if (to.move_method == null || to.move_min == null) return null;

  const straight = from ? t.common.distance(straightLineMeters(from.place, to.place)) : null;
  const toName = localizedPlaceName(to.place, locale);

  return (
    <div className="leg">
      <div className="leg__rail" aria-hidden="true">
        <span className="leg__icon">
          <Icon name={MOVE_ICON[to.move_method]} size={17} />
        </span>
      </div>
      <div className="leg__body">
        <p className="leg__main">
          {t.move.summary(t.move.method[to.move_method], to.move_min)}
        </p>
        <p className="leg__route">
          {from && (
            <>
              <span>{localizedPlaceName(from.place, locale)}</span>
              <Icon name="arrowRight" size={14} />
            </>
          )}
          <span>{toName}</span>
        </p>
        {straight && <p className="leg__meta">{t.move.legNote(straight)}</p>}
        {isTaxi && route.status === "ok" && (
          <>
            <p className="leg__fare">
              {t.move.fareLine(t.common.won(route.taxiFareKrw), t.common.distance(route.distanceM), route.durationMin)}
            </p>
            <p className="leg__meta">{t.move.fareSource}</p>
          </>
        )}
        {isTaxi && route.status !== "ok" && route.status !== "idle" && (
          <p className="leg__meta" role="note">
            {route.status === "loading" ? t.move.fareLoading : route.status === "error" ? t.move.fareFailed : t.move.fareNone}
          </p>
        )}
        <a
          className="leg__link text-link"
          href={kakaoDirectionsUrl(to.place)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t.move.directions}: ${toName}`}
        >
          {t.move.directions}
          <Icon name="external" size={15} />
        </a>
      </div>
    </div>
  );
}

const SIMPLE_HOURS = /^[\d:\s\-–~]+$/; // "09:00-18:00": reads the same in every language
const ALWAYS_OPEN = new Set(["Open 24 hours", "24h / always open"]);

function Facts({ place }: { place: Place }) {
  const { t } = useLocale();
  const a = place.accessibility;
  const f = t.stop.facts;
  const facts: { text: string; warn?: boolean }[] = [];
  facts.push({ text: a.walking_level === 1 ? f.walk1 : a.walking_level === 2 ? f.walk2 : f.walk3, warn: a.walking_level === 3 });
  facts.push({ text: a.terrain === "flat" ? f.flat : a.terrain === "slope" ? f.slope : f.steep, warn: a.terrain !== "flat" });
  if (a.has_stairs === true) facts.push({ text: f.stairs, warn: true });
  if (a.has_stairs === false) facts.push({ text: f.noStairs });
  if (a.restroom === true) facts.push({ text: f.restroom });
  if (a.has_seating === true) facts.push({ text: f.seating });
  if (a.wheelchair_ok === true) facts.push({ text: f.wheelchair });
  if (a.wheelchair_ok === false) facts.push({ text: f.noWheelchair, warn: true });

  return (
    <div className="stop__section">
      <span className="label">{t.stop.goodToKnow}</span>
      <ul className="facts-list">
        {facts.map((x) => (
          <li key={x.text} data-tone={x.warn ? "warn" : undefined}>
            <Icon name={x.warn ? "alert" : "check"} size={15} />
            {x.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function About({ place }: { place: Place }) {
  const { locale, t } = useLocale();
  const hours = place.opening_hours?.trim();
  const closed = (place.closed_days ?? [])
    .map((d) => t.stop.weekdays[d as keyof typeof t.stop.weekdays])
    .filter(Boolean)
    .join(t.stop.listJoin);
  const hoursNeutral = hours ? SIMPLE_HOURS.test(hours) : false;
  return (
    <details className="disclosure">
      <summary>
        {t.stop.about}
        <Icon name="chevronDown" size={18} />
      </summary>
      <dl className="disclosure__body">
        <div>
          <PlaceDescription place={place} />
        </div>
        {(hours || closed) && (
          <div>
            <dt>{t.stop.hours}</dt>
            {hours && (
              <dd lang={locale !== "en" && !hoursNeutral && !ALWAYS_OPEN.has(hours) ? "en" : undefined}>
                {ALWAYS_OPEN.has(hours) ? t.stop.open24 : hours}
              </dd>
            )}
            {closed && <dd>{t.stop.closedOn(closed)}</dd>}
          </div>
        )}
      </dl>
    </details>
  );
}

// US-18 (P1): premium shows the cards; the free preview shows a lock row.
function PhraseCards({ item, tier }: { item: CourseItem; tier: Tier }) {
  const { locale, t } = useLocale();
  if (tier === "free") {
    return (
      <p className="lock-row">
        <Icon name="lock" size={16} />
        {t.stop.phrasesLocked}
      </p>
    );
  }
  if (!item.phrase_cards.length) return null;
  return (
    <details className="disclosure">
      <summary>
        <span className="inline-flex items-center gap-2">
          <Icon name="chat" size={17} />
          {t.stop.phrases(item.phrase_cards.length)}
        </span>
        <Icon name="chevronDown" size={18} />
      </summary>
      <ul className="phrases" style={{ paddingBottom: 14 }}>
        {item.phrase_cards.map((c, i) => {
          const gloss = localizedPhrase(c.text_en, locale);
          return (
            <li key={i} className="phrase">
              <p lang="ko" className="phrase__ko">
                {c.text_ko}
              </p>
              {locale !== "ko" && (
                <p className="phrase__gloss" lang={gloss.translated ? undefined : "en"}>
                  {gloss.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

// 6.3 timeline card. Order of information: name, when and how long, why it was chosen,
// what is useful to know there, then the actions. `size="large"` is the current stop in trip mode (6.4).
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
  selected?: boolean;
  onShowOnMap?: () => void;
  children?: React.ReactNode;
}) {
  const [driverOpen, setDriverOpen] = useState(false);
  const { locale, t } = useLocale();
  const p = item.place;
  const name = localizedPlaceName(p, locale);
  const current = status === "current";

  return (
    <article
      id={`stop-${item.order}`}
      tabIndex={-1}
      aria-label={`${t.stop.order(item.order)}: ${name}`}
      className={`card stop ${size === "large" ? "is-large" : ""} ${current ? "is-current" : selected ? "is-selected" : ""}`}
    >
      <div className="stop__media">
        <PlacePhoto place={p} />
        <span className={`stop-no stop__no ${current ? "is-current" : ""}`} aria-hidden="true">
          {item.order}
        </span>
        {isNew && <span className="chip chip-solid stop__flag">{t.stop.isNew}</span>}
      </div>

      <div className="stop__body">
        <PhotoCredit place={p} />
        <h3 className="display stop__name">{name}</h3>
        {name !== p.name_ko && (
          <p lang="ko" className="stop__ko">
            {p.name_ko}
          </p>
        )}

        <p className="stop__time">
          <span>
            <Icon name="clock" size={17} />
            {t.stop.timeRange(item.start_time, addMinutes(item.start_time, item.stay_min))}
          </span>
          <span className="chip chip-sea">{t.stop.stay(item.stay_min)}</span>
        </p>

        <ul className="stop__chips">
          <li className="chip">
            <CategoryIcon category={p.category} size={14} />
            {localizedCategory(p.category, locale)}
          </li>
          {p.accessibility.indoor && (
            <li className="chip">
              <Icon name="home" size={14} />
              {t.stop.indoor}
            </li>
          )}
          {item.is_rest_stop && (
            <li className="chip chip-leaf">
              <Icon name="bench" size={14} />
              {t.stop.rest}
            </li>
          )}
        </ul>

        <div className="stop__why">
          <p className="label">
            <Icon name="sparkle" size={16} />
            {t.stop.why}
          </p>
          <ReasonText item={item} />
        </div>

        <FoodBadges food={p.food_options} diet={diet} />
        <Facts place={p} />
        <About place={p} />
        <PhraseCards item={item} tier={tier} />

        <div className="stop__actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDriverOpen(true)}>
            <Icon name="taxi" size={19} />
            {t.stop.driver}
          </button>
          {onShowOnMap && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onShowOnMap}>
              <Icon name="map" size={19} />
              {t.stop.showOnMap}
            </button>
          )}
        </div>
        {children}
      </div>

      {driverOpen && <DriverCard place={p} onClose={() => setDriverOpen(false)} />}
    </article>
  );
}
