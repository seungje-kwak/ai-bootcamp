"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { scrollBehavior, scrollToId } from "@/lib/motion";
import { Icon } from "./Icon";

// Two floating shortcuts on the right edge:
//   - back to top, once the traveler has scrolled away from it
//   - jump to the current stop (the first stop before the day has started), while that card is out of view
// They sit above the fixed bottom bar (--bottom-bar-h) and are removed from the tab order when hidden.
export function QuickNavigator({ targetId, mode }: { targetId?: string; mode: "first" | "current" }) {
  const { t } = useLocale();
  const [showTop, setShowTop] = useState(false);
  const [targetInView, setTargetInView] = useState(true);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      setShowTop(window.scrollY > 320);
      const el = targetId ? document.getElementById(targetId) : null;
      if (!el) return setTargetInView(true);
      const r = el.getBoundingClientRect();
      // "in view" = the top of the card is on screen, in the upper two thirds
      setTargetInView(r.top > -60 && r.top < window.innerHeight * 0.66);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targetId]);

  const jumpLabel = mode === "current" ? t.nav.current : t.nav.first;
  const hideJump = !targetId || targetInView;

  return (
    <nav className="fab-stack" aria-label={t.nav.label}>
      <button
        type="button"
        className="fab"
        data-hidden={!showTop}
        tabIndex={showTop ? 0 : -1}
        aria-hidden={!showTop}
        aria-label={t.nav.top}
        title={t.nav.top}
        onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
      >
        <Icon name="arrowUp" size={22} />
      </button>
      <button
        type="button"
        className="fab fab-current"
        data-hidden={hideJump}
        tabIndex={hideJump ? -1 : 0}
        aria-hidden={hideJump}
        aria-label={jumpLabel}
        title={jumpLabel}
        onClick={() => targetId && scrollToId(targetId)}
      >
        <Icon name="target" size={22} />
      </button>
    </nav>
  );
}
