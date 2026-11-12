"use client";

import { useState } from "react";
import { MAP_CONFIG } from "@/config/map";
import type { CourseItem, Place } from "@/lib/types";
import { FallbackMap } from "./FallbackMap";
import { KakaoMap } from "./KakaoMap";
import { PhotoCredit, PlacePhoto } from "./PlacePhoto";

type Selected = { place: Place; stay: number; order?: number };
export type MapSelect = (s: Selected) => void;

// 7장: Kakao map when NEXT_PUBLIC_KAKAO_MAP_KEY is set and the SDK loads; otherwise the fallback SVG (7.1).
// Both draw the same markers and line; the bottom card (7.7) lives here so it is shared.
export function JejuMap({
  items,
  places = [],
  tripMode = false,
}: {
  items: CourseItem[];
  places?: Place[];
  tripMode?: boolean;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [kakaoFailed, setKakaoFailed] = useState(false);
  const useKakao = Boolean(MAP_CONFIG.kakaoKey) && !kakaoFailed;

  return (
    <div className="relative">
      {useKakao ? (
        <KakaoMap
          items={items}
          places={places}
          tripMode={tripMode}
          onSelect={setSelected}
          onError={(e) => {
            console.warn("Kakao map unavailable, using the fallback map:", e);
            setKakaoFailed(true);
          }}
        />
      ) : (
        <FallbackMap items={items} places={places} tripMode={tripMode} onSelect={setSelected} />
      )}

      {selected && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Close" onClick={() => setSelected(null)} />
          <div className="absolute inset-x-2 bottom-2 z-40 overflow-hidden rounded-2xl bg-white shadow-xl border border-line">
            <div className="flex">
              <div className="w-28 shrink-0">
                <PlacePhoto place={selected.place} className="h-full min-h-[112px]" />
              </div>
              <div className="min-w-0 flex-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold leading-tight">
                    {selected.order ? `${selected.order}. ` : ""}
                    {selected.place.name_en}
                  </p>
                  <button onClick={() => setSelected(null)} className="text-muted text-lg leading-none" aria-label="Close">
                    ×
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted line-clamp-2">{selected.place.description_en}</p>
                <p className="mt-1 text-xs font-medium text-sea">Stay {selected.stay} min</p>
                <PhotoCredit place={selected.place} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
