"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locale";
import { en, type Messages } from "./messages/en";
import { ja } from "./messages/ja";
import { ko } from "./messages/ko";
import { zh } from "./messages/zh";

export { LOCALES, LOCALE_STORAGE_KEY, htmlLang, isLocale, languageNames } from "./locale";
export type { Locale } from "./locale";
export type { Messages } from "./messages/en";

export const MESSAGES: Record<Locale, Messages> = { en, zh, ja, ko };

export type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** UI copy for the current language. */
  t: Messages;
};

// The provider lives in components/LocaleProvider.tsx and wraps the whole app, so every
// screen switches together and the choice survives navigation and reloads.
export const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: en,
});

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
