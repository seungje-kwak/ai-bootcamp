"use client";

import { useEffect } from "react";
import type { Place } from "@/lib/types";

// US-07 / 6.3: full-screen card to show a taxi driver. Overlay only, so closing keeps the scroll position.
export function DriverCard({ place, onClose }: { place: Place; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="mx-auto w-full max-w-[430px] flex-1 flex flex-col px-6 py-8">
        <p className="text-sm text-muted text-center">Show this screen to your taxi driver</p>
        <div className="flex-1 flex flex-col justify-center text-center gap-6 text-black">
          <p lang="ko" className="text-[40px] font-bold leading-tight break-keep">
            {place.name_ko}
          </p>
          <p lang="ko" className="text-2xl leading-snug break-keep">
            {place.address_ko}
          </p>
          <p lang="ko" className="text-2xl font-semibold">
            이 주소로 가 주세요.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-ink text-white py-4 text-lg font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
}
