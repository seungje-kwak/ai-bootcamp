"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Place } from "@/lib/types";
import { MESSAGES, travelMessages, useLocale } from "@/lib/i18n";

export function DriverCard({ place, onClose }: { place: Place; onClose: () => void }) {
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const copied = copy === "done";
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // US-07: closing returns to exactly where the traveler was (same scroll position, focus back on the button).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollY = window.scrollY;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
      window.scrollTo({ top: scrollY, behavior: "instant" });
      opener?.focus({ preventScroll: true });
    };
  }, []);
  async function copyAddress() {
    try { await navigator.clipboard.writeText(place.address_ko); setCopy("done"); } catch { setCopy("failed"); /* e.g. http on a phone: the address stays selectable instead */ }
  }
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={tx.driverTitle} className="driver-modal">
      <div className="driver-sheet" aria-describedby="driver-info" >
        <div className="driver-sheet__top">
          <div className="v9-brand v9-driver-brand">MyPace <strong>Jeju</strong></div>
          <button ref={closeRef} onClick={onClose} className="driver-close" aria-label={tx.close}>✕</button>
        </div>
        <div className="driver-sheet__body">
          <div className="driver-sheet__eyebrow">🚕 &nbsp;{tx.driverTitle}</div>
          <p className="driver-sheet__hint" id="driver-info">{tx.driverHint}</p>
          <div className="driver-address" lang="ko">
            <div className="driver-address__label">DESTINATION / 목적지</div>
            <h2>{place.name_ko || place.name_en}</h2>
            <p className="driver-address__street">{place.address_ko || "주소 정보 확인 필요"}</p>
            <div className="driver-address__line" />
            <p className="driver-address__request">기사님, 이 주소로 가 주세요.</p>
          </div>
        </div>
        <div className="driver-sheet__actions">
          <p className="driver-sheet__footer" lang="ko">목적지를 확인해 주셔서 감사합니다.</p>
          <button className="driver-copy" type="button" onClick={copyAddress}>{copied ? `✓ ${tx.copied}` : `▢ ${tx.copy}`}</button>
          <button className="driver-done" type="button" onClick={onClose}>{tx.close}</button>
          <p className="driver-sheet__hint" role="status" aria-live="polite">{copy === "failed" ? MESSAGES[locale].driver.copyFailed : ""}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
