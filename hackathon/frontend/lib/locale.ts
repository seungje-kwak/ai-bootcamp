// Locale constants shared by server components (app/layout.tsx) and client code.
// No "use client" here: the root layout calls these on the server.
export type Locale = "en" | "zh" | "ja" | "ko";

export const LOCALES: readonly Locale[] = ["en", "zh", "ja", "ko"];
export const DEFAULT_LOCALE: Locale = "en";

/** One name for both the cookie (read by the server, so a reload renders in the right
 *  language straight away) and the localStorage entry (kept from the first language patch). */
export const LOCALE_STORAGE_KEY = "mypace-jeju-language";

export const languageNames: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  ja: "日本語",
  ko: "한국어",
};

export const htmlLang: Record<Locale, string> = { en: "en", zh: "zh-CN", ja: "ja", ko: "ko" };

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "zh" || v === "ja" || v === "ko";
}

/** Saved choice first; otherwise the browser's preferred language if we support it. */
export function pickLocale(saved: string | undefined | null, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(saved)) return saved;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag.startsWith("ko")) return "ko";
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}
