"use client";

import { useEffect, useRef } from "react";

// The fixed action bar at the bottom of a screen. It publishes its own height as
// --bottom-bar-h so page padding and the floating shortcut buttons always clear it,
// whatever the content or the phone's safe area.
export function BottomBar({ children, label }: { children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--bottom-bar-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--bottom-bar-h", "0px");
    };
  }, []);

  return (
    <div ref={ref} className="bottom-bar" role="region" aria-label={label}>
      <div className="bottom-bar__inner">{children}</div>
    </div>
  );
}
