"use client";

import { useState } from "react";
import { localizedPlaceName } from "@/lib/localized-place";
import { useLocale } from "@/lib/i18n";
import type { Place } from "@/lib/types";

// Editorial placeholder for unavailable images. Never substitute another real place's photo.
export function PlacePhoto({ place, className = "h-40" }: { place: Place; className?: string }) {
  const [failed, setFailed] = useState(false);
  const { locale } = useLocale();

  if (!place.image_url || failed) {
    const mockKind = /삼성혈|Samseonghyeol/i.test(`${place.name_ko} ${place.name_en}`) || place.category === "culture" ? "culture" : place.category === "market" ? "market" : place.category === "food" || place.category === "cafe" ? "food" : "culture";
    const mockNotice = locale === "ko" ? "AI 생성 시연 이미지 · 실제 장소 사진 아님" : locale === "zh" ? "AI生成示例图 · 非真实地点照片" : locale === "ja" ? "AI生成サンプル · 実際の場所の写真ではありません" : "AI-generated sample · not a real place photo";
    return (
      <div className={`${className} demo-photo`} role="img" aria-label={`${localizedPlaceName(place, locale)} · ${mockNotice}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/images/demo/${mockKind}.webp`} alt="" className="demo-photo__image" loading="lazy" />
        <span className="demo-photo__badge">{mockNotice}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={place.image_url} alt={localizedPlaceName(place, locale)} className={`${className} w-full object-cover`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}

export function PhotoCredit({ place }: { place: Place }) {
  const { locale } = useLocale();
  const parts: string[] = [];
  if (place.image_url && place.image_source) parts.push(`${locale === "zh" ? "图片来源" : locale === "ja" ? "写真提供" : locale === "ko" ? "사진 출처" : "Photo"}: ${place.image_source}`);
  if (place.last_verified_at) parts.push(`${locale === "zh" ? "核实日期" : locale === "ja" ? "確認日" : locale === "ko" ? "확인일" : "Verified"}: ${place.last_verified_at}`);
  if (!parts.length) return null;
  return <p className="photo-credit">{parts.join(" · ")}</p>;
}
