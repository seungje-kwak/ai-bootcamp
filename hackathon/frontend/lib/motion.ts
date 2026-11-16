/** "smooth" unless the traveler asked their device for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** Scrolls an element into view and moves keyboard focus to it without a second jump. */
export function scrollToId(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
  return true;
}
