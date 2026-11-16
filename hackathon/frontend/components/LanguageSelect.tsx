"use client";

import { htmlLang, languageNames, LOCALES, useLocale, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

// Two shapes of the same control:
//   "segmented": every language visible (landing, where choosing is the point)
//   "menu":      a compact native select for the top bar of the other screens
// Both read and write the app-wide locale, so no screen can fall out of step.
// `compact` shrinks the menu to its globe icon on a phone, for bars that have little room (trip mode).
export function LanguageSelect({ variant = "menu", compact = false }: { variant?: "segmented" | "menu"; compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const label = `${t.common.language} / Language / 语言 / 言語 / 언어`;

  if (variant === "segmented") {
    return (
      <div className="lang-seg" role="group" aria-label={label}>
        {LOCALES.map((l) => (
          <button key={l} type="button" lang={htmlLang[l]} aria-pressed={locale === l} onClick={() => setLocale(l)}>
            {languageNames[l]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <label className={`lang-menu ${compact ? "lang-menu-compact" : ""}`}>
      <Icon name="globe" size={18} />
      <span className="sr-only">{label}</span>
      <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {languageNames[l]}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={14} className="lang-menu__chev" />
    </label>
  );
}
