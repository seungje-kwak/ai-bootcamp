"use client";

import { useLocale, travelMessages } from "@/lib/i18n";

export function QuickNavigator({ currentStopId, trip = false }: { currentStopId?: string; trip?: boolean }) {
  const { locale } = useLocale();
  const tx = travelMessages[locale];
  function scrollToStop() {
    if (!currentStopId) return;
    document.getElementById(currentStopId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <nav className={`quick-nav ${trip ? "quick-nav--trip" : ""}`} aria-label="Page shortcuts">
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={tx.top} title={tx.top}>↑</button>
      <button type="button" className="quick-nav__current" onClick={scrollToStop} disabled={!currentStopId} aria-label={tx.jump} title={tx.jump}>◎</button>
    </nav>
  );
}
