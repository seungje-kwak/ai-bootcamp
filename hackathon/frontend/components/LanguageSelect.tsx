"use client";

import type { Locale } from "@/lib/i18n";
import { languageNames } from "@/lib/i18n";

export function LanguageSelect({ value, onChange, compact = false }: { value: Locale; onChange: (locale: Locale) => void; compact?: boolean }) {
  return (
    <div className={`language-switch ${compact ? "language-switch--compact" : ""}`} role="group" aria-label="Language / 언어 / 语言 / 言語">
      {(["ko", "en", "zh", "ja"] as const).map((lang) => (
        <button key={lang} type="button" aria-pressed={value === lang} className={`language-switch__option ${value === lang ? "is-active" : ""}`} onClick={() => onChange(lang)}>
          {languageNames[lang]}
        </button>
      ))}
    </div>
  );
}
