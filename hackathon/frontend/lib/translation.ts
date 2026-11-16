"use client";

// Client side of the translation pipeline for text no dictionary covers (free-form AI reasons).
// It asks /api/translate once whether a service is connected. If not, callers show the
// English original with a notice; nothing is sent and nothing is made up.
import { useEffect, useState } from "react";
import type { Locale } from "./locale";

export type MachineTranslation =
  | { status: "idle" } // not needed (English, or already translated another way)
  | { status: "pending" }
  | { status: "done"; text: string; provider: string | null }
  | { status: "unavailable" } // no service connected
  | { status: "error" };

type Target = Exclude<Locale, "en">;

let capability: Promise<{ configured: boolean; provider: string | null }> | null = null;
function translationCapability() {
  capability ??= fetch("/api/translate", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { configured: false, provider: null }))
    .then((j) => ({ configured: Boolean(j?.configured), provider: typeof j?.provider === "string" ? j.provider : null }))
    .catch(() => ({ configured: false, provider: null }));
  return capability;
}

const done = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const keyOf = (target: Target, text: string) => `${target}\u0000${text}`;

type Job = { text: string; resolve: (t: string) => void; reject: (e: unknown) => void };
const queue: Record<Target, Job[]> = { zh: [], ja: [], ko: [] };
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  flushTimer = null;
  for (const target of ["zh", "ja", "ko"] as const) {
    const jobs = queue[target].splice(0);
    // The route accepts up to 20 texts per call.
    for (let i = 0; i < jobs.length; i += 20) {
      const batch = jobs.slice(i, i + 20);
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, texts: batch.map((j) => j.text) }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { translations: string[] };
        batch.forEach((j, n) => j.resolve(data.translations[n]));
      } catch (e) {
        batch.forEach((j) => j.reject(e));
      }
    }
  }
}

function request(target: Target, text: string): Promise<string> {
  const key = keyOf(target, text);
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = new Promise<string>((resolve, reject) => {
    queue[target].push({ text, resolve, reject });
    flushTimer ??= setTimeout(flush, 40); // collect the stops on screen into one request
  })
    .then((t) => {
      done.set(key, t);
      return t;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Translation state for one English text. Pass `enabled: false` when a dictionary already covered it. */
export function useMachineTranslation(text: string, locale: Locale, enabled: boolean): MachineTranslation {
  const active = enabled && locale !== "en" && text.trim().length > 0;
  const [state, setState] = useState<MachineTranslation>({ status: "idle" });

  useEffect(() => {
    if (!active) {
      setState({ status: "idle" });
      return;
    }
    const target = locale as Target;
    let cancelled = false;
    setState({ status: "pending" });
    translationCapability().then(({ configured, provider }) => {
      if (cancelled) return;
      if (!configured) return setState({ status: "unavailable" });
      const cached = done.get(keyOf(target, text));
      if (cached) return setState({ status: "done", text: cached, provider });
      request(target, text)
        .then((t) => !cancelled && setState({ status: "done", text: t, provider }))
        .catch(() => !cancelled && setState({ status: "error" }));
    });
    return () => {
      cancelled = true;
    };
  }, [active, locale, text]);

  return active ? state : { status: "idle" };
}
