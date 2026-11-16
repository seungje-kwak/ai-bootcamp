"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LocaleContext, MESSAGES } from "@/lib/i18n";
import { htmlLang, isLocale, LOCALE_STORAGE_KEY, type Locale } from "@/lib/locale";

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

function persist(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode: the cookie below still carries the choice */
  }
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=${ONE_YEAR_SEC}; samesite=lax`;
  document.documentElement.lang = htmlLang[locale];
}

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // A language saved by an earlier version (localStorage only) wins once, then both stores agree.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (isLocale(saved) && saved !== initialLocale) {
      setLocaleState(saved);
      persist(saved);
    } else {
      persist(initialLocale);
    }
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persist(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale, t: MESSAGES[locale] }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
