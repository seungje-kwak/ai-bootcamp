"use client";

import { useEffect, useRef, useState } from "react";
import { type LatLng, MAP_CONFIG, toPercent } from "@/config/map";
import { useLocale } from "@/lib/i18n";
import { type KakaoMaps, type KLayer, type KMap, loadKakaoMaps } from "@/lib/kakao";
import { localizedPlaceName } from "@/lib/localized-place";
import type { CourseItem, Place } from "@/lib/types";
import type { MapPick } from "./JejuMap";

// HTML markers (7.5) built by hand: CustomOverlay takes a DOM element, not React.
// They use the same .map-pin / .map-dot classes as the stand-in map (app/globals.css).
function pinClass(it: CourseItem, tripMode: boolean, selected: boolean) {
  const current = tripMode && it.status === "current";
  const done = tripMode && it.status === "done";
  return `map-pin${current ? " is-current" : ""}${done ? " is-done" : ""}${selected ? " is-selected" : ""}`;
}

function coursePin(it: CourseItem, label: string, onClick: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = String(it.order);
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onClick);
  return el;
}

function otherDot(label: string, onClick: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "map-dot";
  el.setAttribute("aria-label", label);
  el.addEventListener("click", onClick);
  return el;
}

// 7장: Kakao map with numbered course markers and a dashed line in visit order.
// Calls onError if the SDK cannot be loaded, so the parent can switch to the stand-in map.
export function KakaoMap({
  items,
  places,
  tripMode,
  selectedOrder,
  selectedPlaceId,
  onPick,
  center,
  onError,
}: {
  items: CourseItem[];
  places: Place[];
  tripMode: boolean;
  selectedOrder: number | null;
  selectedPlaceId: number | null;
  onPick: (pick: MapPick) => void;
  center?: LatLng;
  onError: (e: unknown) => void;
}) {
  const { locale, t } = useLocale();
  const boxRef = useRef<HTMLDivElement>(null);
  const kakaoRef = useRef<KakaoMaps | null>(null);
  const mapRef = useRef<KMap | null>(null);
  const layersRef = useRef<KLayer[]>([]);
  const pinsRef = useRef(new Map<number, { el: HTMLElement; item: CourseItem }>());
  const dotsRef = useRef(new Map<number, HTMLElement>());
  const fitRef = useRef<() => void>(() => {});
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const [ready, setReady] = useState(false);
  const [drawn, setDrawn] = useState(0); // bumps after markers are (re)built, so selection is re-applied
  const centerLat = center?.lat ?? MAP_CONFIG.center.lat;
  const centerLng = center?.lng ?? MAP_CONFIG.center.lng;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !boxRef.current) return;
        kakaoRef.current = maps;
        mapRef.current = new maps.Map(boxRef.current, {
          center: new maps.LatLng(MAP_CONFIG.center.lat, MAP_CONFIG.center.lng),
          level: MAP_CONFIG.level,
        });
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) errorRef.current(e);
      });
    return () => {
      cancelled = true;
      layersRef.current.forEach((l) => l.setMap(null));
      layersRef.current = [];
    };
  }, []);

  // Draw markers and the line; fit the view to the course (7.4, 7.6).
  useEffect(() => {
    const maps = kakaoRef.current;
    const map = mapRef.current;
    if (!ready || !maps || !map) return;

    layersRef.current.forEach((l) => l.setMap(null));
    pinsRef.current.clear();
    dotsRef.current.clear();
    const layers: KLayer[] = [];
    const ll = (p: Place) => new maps.LatLng(p.lat, p.lng);
    const inBounds = (p: Place) => toPercent(p.lat, p.lng).inBounds; // 7.5: never draw out-of-bounds points

    const courseIds = new Set(items.map((i) => i.place_id));
    for (const p of places) {
      if (courseIds.has(p.id) || !inBounds(p)) continue;
      const el = otherDot(`${localizedPlaceName(p, locale)} (${t.map.notOnRoute})`, () => pickRef.current({ kind: "place", place: p }));
      dotsRef.current.set(p.id, el);
      layers.push(new maps.CustomOverlay({ map, position: ll(p), content: el, xAnchor: 0.5, yAnchor: 0.5, zIndex: 1, clickable: true }));
    }

    const stops = [...items].sort((a, b) => a.order - b.order).filter((it) => inBounds(it.place));
    if (stops.length > 1) {
      // 7.6: straight dashed line in visit order. Not a road route.
      layers.push(
        new maps.Polyline({
          map,
          path: stops.map((it) => ll(it.place)),
          strokeWeight: 3,
          strokeColor: MAP_CONFIG.routeColor,
          strokeOpacity: 0.9,
          strokeStyle: "shortdash",
        }),
      );
    }
    for (const it of stops) {
      const current = tripMode && it.status === "current";
      const el = coursePin(it, t.map.stopLabel(it.order, localizedPlaceName(it.place, locale)), () =>
        pickRef.current({ kind: "stop", order: it.order }),
      );
      el.className = pinClass(it, tripMode, false);
      pinsRef.current.set(it.order, { el, item: it });
      layers.push(
        new maps.CustomOverlay({ map, position: ll(it.place), content: el, xAnchor: 0.5, yAnchor: 0.5, zIndex: current ? 4 : 3, clickable: true }),
      );
    }
    layersRef.current = layers;

    fitRef.current = () => {
      if (stops.length === 0) {
        map.setLevel(MAP_CONFIG.level);
        map.setCenter(new maps.LatLng(centerLat, centerLng));
      } else if (stops.length === 1) {
        map.setLevel(MAP_CONFIG.singleStopLevel);
        map.setCenter(ll(stops[0].place));
      } else {
        const b = new maps.LatLngBounds();
        stops.forEach((it) => b.extend(ll(it.place)));
        const pad = MAP_CONFIG.fitPaddingPx;
        map.setBounds(b, pad, pad, pad, pad);
      }
    };
    fitRef.current();
    setDrawn((n) => n + 1);
  }, [ready, items, places, tripMode, locale, t, centerLat, centerLng]);

  // Reflect the selection (from the map itself or from a timeline card) on the markers.
  useEffect(() => {
    const maps = kakaoRef.current;
    const map = mapRef.current;
    if (!ready || !maps || !map) return;
    pinsRef.current.forEach(({ el, item }, order) => {
      const selected = order === selectedOrder;
      el.className = pinClass(item, tripMode, selected);
      el.setAttribute("aria-pressed", String(selected));
      if (selected) map.panTo(new maps.LatLng(item.place.lat, item.place.lng));
    });
    dotsRef.current.forEach((el, id) => {
      el.className = `map-dot${id === selectedPlaceId ? " is-selected" : ""}`;
    });
  }, [ready, drawn, selectedOrder, selectedPlaceId, tripMode]);

  // Keep the map sized to its box (7.4).
  useEffect(() => {
    const el = boxRef.current;
    if (!ready || !el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.relayout();
      fitRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  return (
    <div className="map__box" style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }}>
      <div ref={boxRef} className="absolute inset-0" />
      {!ready && <div className="skeleton absolute inset-0" role="status" aria-label={t.map.loading} />}
    </div>
  );
}
