"use client";

// Road distance and taxi fare for a taxi leg, from /api/route-estimate.
// A number is shown only when the route service really answered; there is no local guess.
import { useEffect, useState } from "react";

export type RouteEstimateState =
  | { status: "idle" }
  | { status: "unavailable" } // no route service connected
  | { status: "loading" }
  | { status: "ok"; distanceM: number; durationMin: number; taxiFareKrw: number }
  | { status: "error" };

type Point = { lat: number; lng: number };

let capability: Promise<boolean> | null = null;
function routeCapability() {
  capability ??= fetch("/api/route-estimate", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { configured: false }))
    .then((j) => Boolean(j?.configured))
    .catch(() => false);
  return capability;
}

const results = new Map<string, Promise<RouteEstimateState>>();

function fetchEstimate(from: Point, to: Point): Promise<RouteEstimateState> {
  const key = `${from.lat},${from.lng}>${to.lat},${to.lng}`;
  let p = results.get(key);
  if (!p) {
    p = fetch(`/api/route-estimate?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`, { cache: "no-store" })
      .then(async (r): Promise<RouteEstimateState> => {
        if (!r.ok) return { status: "error" };
        const j = await r.json();
        if (typeof j?.distance_m !== "number" || typeof j?.duration_s !== "number" || typeof j?.taxi_fare_krw !== "number") {
          return { status: "error" };
        }
        return { status: "ok", distanceM: j.distance_m, durationMin: Math.max(1, Math.round(j.duration_s / 60)), taxiFareKrw: j.taxi_fare_krw };
      })
      .catch((): RouteEstimateState => ({ status: "error" }));
    results.set(key, p);
    p.then((s) => s.status === "error" && results.delete(key)); // allow a retry later
  }
  return p;
}

export function useRouteEstimate(from: Point | null, to: Point | null, enabled: boolean): RouteEstimateState {
  const [state, setState] = useState<RouteEstimateState>({ status: "idle" });
  const fromLat = from?.lat;
  const fromLng = from?.lng;
  const toLat = to?.lat;
  const toLng = to?.lng;

  useEffect(() => {
    if (!enabled || fromLat == null || fromLng == null || toLat == null || toLng == null) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    routeCapability().then((configured) => {
      if (cancelled) return;
      if (!configured) return setState({ status: "unavailable" });
      setState({ status: "loading" });
      fetchEstimate({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }).then((s) => !cancelled && setState(s));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, fromLat, fromLng, toLat, toLng]);

  return state;
}
