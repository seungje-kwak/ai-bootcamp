"use client";

import { useEffect, useRef, useState } from "react";

/** Images already in the repo; all are illustrations/renders, never presented as real-place photos. */
export const LANDING_IMAGES = {
  hero: "/images/jeju-3d-hero.webp",
  culture: "/images/demo/culture.webp",
  food: "/images/demo/food.webp",
  market: "/images/demo/market.webp",
};

/** "① A → ② B → ③ C" (any locale) becomes ["A", "B", "C"], so the steps need no new copy. */
export function splitSteps(guideHow: string): string[] {
  return guideHow
    .split("→")
    .map((part) => part.replace(/^[\s①-⑳\d.)]+/, "").trim())
    .filter(Boolean);
}

/** Strips the trailing arrow glyph from CTA copy when the design draws its own arrow. */
export function plainCta(label: string): string {
  return label.replace(/[\s↗→]+$/, "");
}

/** True once the page has scrolled past `offset` px. */
export function useScrolled(offset = 40): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);
  return scrolled;
}

/** Adds `is-in` to every `[data-reveal]` inside the returned ref as it enters the viewport. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}
