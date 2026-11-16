"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { describeFrom, loadDescriptions, localizedReason, type LocalizedText } from "@/lib/localized-place";
import { useMachineTranslation } from "@/lib/translation";
import type { CourseItem, Place } from "@/lib/types";
import { Icon } from "./Icon";

// One rendering rule for every piece of API text:
//   reviewed translation  -> show it
//   translation service   -> show its output, marked as machine translation, original one tap away
//   neither               -> show the English original and say that translation is not connected
function Body({ local, className }: { local: LocalizedText; className?: string }) {
  const { locale, t } = useLocale();
  const mt = useMachineTranslation(local.original, locale, !local.translated);

  if (local.translated) return <p className={className}>{local.text}</p>;

  if (mt.status === "done") {
    return (
      <>
        <p className={className}>{mt.text}</p>
        <p className="tr-note">
          <Icon name="globe" size={14} />
          <span>
            {t.stop.trMachine}
            {mt.provider ? ` (${mt.provider})` : ""}
          </span>
        </p>
        <details className="tr-original">
          <summary>{t.stop.trOriginal}</summary>
          <p lang="en" style={{ marginTop: 6 }}>
            {local.original}
          </p>
        </details>
      </>
    );
  }

  return (
    <>
      <p className={className} lang="en">
        {local.original}
      </p>
      {mt.status !== "idle" && (
        <p className="tr-note" role="note">
          {mt.status === "pending" ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Icon name="info" size={14} />}
          <span>{mt.status === "pending" ? t.stop.trPending : mt.status === "error" ? t.stop.trFailed : t.stop.trEnglish}</span>
        </p>
      )}
    </>
  );
}

/** The AI's reason for recommending a stop. */
export function ReasonText({ item, className = "stop__reason" }: { item: Pick<CourseItem, "reason_en">; className?: string }) {
  const { locale } = useLocale();
  return <Body local={localizedReason(item, locale)} className={className} />;
}

type Loaded = { locale: Locale; table: Awaited<ReturnType<typeof loadDescriptions>> };

/** The place description. Translations load on demand, so English visitors never fetch them. */
export function PlaceDescription({ place, className }: { place: Pick<Place, "id" | "description_en">; className?: string }) {
  const { locale, t } = useLocale();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const original = place.description_en?.trim() ?? "";

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

  if (!original) return null;
  if (locale === "en") return <p className={className}>{original}</p>;
  if (!loaded || loaded.locale !== locale) return <p className={`${className ?? ""} fine`}>{t.map.aboutPending}</p>;

  const text = describeFrom(loaded.table, place);
  return <Body local={text ? { text, translated: true, original } : { text: original, translated: false, original }} className={className} />;
}
