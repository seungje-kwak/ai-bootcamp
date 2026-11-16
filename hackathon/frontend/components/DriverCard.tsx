"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/lib/i18n";
import type { Place } from "@/lib/types";
import { Icon } from "./Icon";

// US-07: a full-screen card the traveler holds up to a taxi driver.
// The Korean name, address and request always come straight from the API and are never translated.
// Closing it returns to exactly where the traveler was: same scroll position, focus back on the button.
export function DriverCard({ place, onClose }: { place: Place; onClose: () => void }) {
  const { t } = useLocale();
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollY = window.scrollY;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      // keep keyboard focus inside the card while it is open
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>("button, a[href]");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      window.scrollTo({ top: scrollY, behavior: "instant" });
      opener?.focus({ preventScroll: true });
    };
  }, []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(place.address_ko);
      setCopy("done");
    } catch {
      setCopy("failed"); // e.g. http on a phone: the address stays selectable instead
    }
  }

  return createPortal(
    <div
      className="driver"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="driver__sheet" ref={sheetRef}>
        <div className="driver__top">
          <p id="driver-title" className="driver__title">
            <Icon name="taxi" size={22} />
            <span>{t.driver.title}</span>
          </p>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label={t.common.close}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="driver__card" lang="ko">
          <p className="driver__label">목적지</p>
          <p className="driver__name">{place.name_ko}</p>
          <p className="driver__addr">{place.address_ko}</p>
          <p className="driver__ask">이 주소로 가 주세요.</p>
        </div>

        <p className="driver__meaning">{t.driver.meaning}</p>

        <div className="driver__actions">
          <button type="button" className="btn btn-primary" onClick={copyAddress}>
            <Icon name={copy === "done" ? "check" : "copy"} size={19} />
            {copy === "done" ? t.driver.copied : t.driver.copy}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t.driver.done}
          </button>
        </div>
        <p className="driver__status" role="status" aria-live="polite">
          {copy === "failed" ? t.driver.copyFailed : ""}
        </p>
      </div>
    </div>,
    document.body,
  );
}
