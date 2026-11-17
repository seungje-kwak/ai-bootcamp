"use client";

import { useEffect, useState } from "react";
import { MESSAGES, useLocale, type Locale } from "@/lib/i18n";
import { contentHelp, describeFrom, loadDescriptions, localizedDescription, localizedReason } from "@/lib/localized-place";
import { useMachineTranslation } from "@/lib/translation";
import type { CourseItem, Place } from "@/lib/types";

type Local = { text: string; hasTranslation: boolean; original: string };

// One rendering rule for API text that is not English-only:
//   reviewed translation  -> show it
//   translation service   -> show its output, marked as machine translation, original one tap away
//   neither               -> the short local-language summary, with the English original one tap away
function Body({ local, className, originalLabel }: { local: Local; className?: string; originalLabel: string }) {
  const { locale } = useLocale();
  const S = MESSAGES[locale].stop;
  const mt = useMachineTranslation(local.original, locale, !local.hasTranslation);

  if (local.hasTranslation || locale === "en") return <p className={className}>{local.text}</p>;

  if (mt.status === "done") {
    return (
      <>
        <p className={className}>{mt.text}</p>
        <p className="tr-note">
          {S.trMachine}
          {mt.provider ? ` (${mt.provider})` : ""}
        </p>
        <details className="stop-card__original">
          <summary>
            {S.trOriginal} <span aria-hidden="true">⌄</span>
          </summary>
          <p lang="en">{local.original}</p>
        </details>
      </>
    );
  }

  return (
    <>
      <p className={className}>{local.text}</p>
      {mt.status === "pending" && (
        <p className="tr-note" role="status">
          {S.trPending}
        </p>
      )}
      {local.original && (
        <details className="stop-card__original">
          <summary>
            {originalLabel} <span aria-hidden="true">⌄</span>
          </summary>
          <p lang="en">{local.original}</p>
        </details>
      )}
    </>
  );
}

const helpFor = (locale: Locale) => (locale === "en" ? null : contentHelp(locale));

/** The planner's reason for recommending a stop. */
export function ReasonText({ item, className }: { item: CourseItem; className?: string }) {
  const { locale } = useLocale();
  return <Body local={localizedReason(item, locale)} className={className} originalLabel={helpFor(locale)?.original ?? ""} />;
}

type Loaded = { locale: Locale; table: Awaited<ReturnType<typeof loadDescriptions>> };

/** The place description. Reviewed translations load on demand, so English visitors never fetch them. */
export function PlaceDescription({ place, className, override }: { place: Place; className?: string; override?: string | null }) {
  const { locale } = useLocale();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (locale === "en") return;
    let live = true;
    loadDescriptions(locale)
      .then((table) => live && setLoaded({ locale, table }))
      .catch(() => live && setLoaded({ locale, table: {} }));
    return () => {
      live = false;
    };
  }, [locale]);

  const fallback = localizedDescription(place, locale);
  if (!fallback.original && !override) return null;
  if (locale === "en") return <p className={className}>{fallback.text}</p>;
  if (override) return <p className={className}>{override}</p>;
  if (!loaded || loaded.locale !== locale) return <p className={className}>{MESSAGES[locale].map.aboutPending}</p>;

  const reviewed = describeFrom(loaded.table, place);
  const local: Local = reviewed ? { text: reviewed, hasTranslation: true, original: fallback.original } : fallback;
  return <Body local={local} className={className} originalLabel={helpFor(locale)?.originalDescription ?? ""} />;
}
