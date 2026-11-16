import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { LocaleProvider } from "@/components/LocaleProvider";
import { htmlLang, LOCALE_STORAGE_KEY, pickLocale, type Locale } from "@/lib/locale";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const DESCRIPTION: Record<Locale, string> = {
  en: "A Jeju City day built from real places with real photos, re-planned as your day changes.",
  zh: "用真实地点和真实照片为你安排济州市的一天，计划有变时随时重新规划。",
  ja: "実在するスポットと本物の写真でつくる済州市の一日。予定が変わればその場で組み直します。",
  ko: "실제 장소와 실제 사진으로 짜는 제주시 하루 일정. 상황이 바뀌면 그 자리에서 다시 짜 드립니다.",
};

// The saved language is read on the server, so a reload or a shared link renders in that
// language from the first byte instead of flashing English.
function requestLocale(): Locale {
  return pickLocale(cookies().get(LOCALE_STORAGE_KEY)?.value, headers().get("accept-language"));
}

export function generateMetadata(): Metadata {
  return { title: "MyPace Jeju", description: DESCRIPTION[requestLocale()] };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f5a5f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = requestLocale();
  return (
    // The font variable sits on <html>: the type tokens in globals.css (:root) are built from it.
    <html lang={htmlLang[locale]} className={geistSans.variable}>
      <body className="font-sans">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
