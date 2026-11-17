"use client";

import { useEffect, useRef, useState } from "react";
import { MAP_CONFIG, toPercent } from "@/config/map";
import { JEJU_LANDMARKS, ISLAND_MAP_BOUNDS } from "@/lib/landmarks";
import { useLocale } from "@/lib/i18n";
import { type KakaoMaps, type KLayer, type KMap, loadKakaoMaps } from "@/lib/kakao";
import type { Category, CourseItem, Place } from "@/lib/types";
import type { MapSelect } from "./JejuMap";

const MARKER_PX = 28;

// HTML markers (7.5) built by hand: CustomOverlay takes a DOM element, not React.
function courseMarker(it: CourseItem, tripMode: boolean, onClick: () => void) {
  const current = tripMode && it.status === "current";
  const done = tripMode && it.status === "done";
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${it.order}. ${it.place.name_en}`);
  el.style.cssText = [
    "position:relative",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    `width:${MARKER_PX}px`,
    `height:${MARKER_PX}px`,
    "border-radius:9999px",
    "border:2px solid #fff",
    `background:${current ? "#164e54" : "#217981"}`,
    current
      ? "box-shadow:0 0 0 4px rgba(242,140,40,.5),0 4px 6px rgba(0,0,0,.2);transform:scale(1.25)"
      : "box-shadow:0 4px 6px rgba(0,0,0,.2)",
    done ? "opacity:.4" : "",
    "cursor:pointer",
    "padding:0",
  ].join(";");
  const index = document.createElement("span");
  index.textContent = String(it.order);
  index.setAttribute("aria-hidden", "true");
  index.style.cssText = "color:white;font-size:12px;font-weight:800;line-height:1";
  el.append(index);
  el.addEventListener("click", onClick);
  return el;
}

function otherMarker(p: Place, onClick: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", p.name_en);
  const icons: Record<string,string> = {nature:"⛰",market:"🛍",cafe:"☕",food:"🍜",culture:"🏛",photo:"📷"};
  el.textContent = icons[p.category] || "•";
  el.style.cssText =
    "width:31px;height:31px;border-radius:9999px;background:rgba(255,255,255,.96);border:2px solid #c7dcd6;" +
    "font-size:17px;line-height:27px;color:#3c827d;cursor:pointer;padding:0;box-shadow:0 3px 10px rgba(0,0,0,.15)";
  el.addEventListener("click", onClick);
  return el;
}

// 7장: Kakao map with course markers, order numbers and a dashed line.
// Calls onError if the SDK cannot be loaded, so the parent can switch to the fallback SVG.
export function KakaoMap({
  items,
  places,
  tripMode,
  activeCategories,
  focusPlace,
  center,
  onSelect,
  onError,
}: {
  items: CourseItem[];
  places: Place[];
  tripMode: boolean;
  activeCategories: Set<Category>;
  focusPlace: Place | null;
  /** The chosen area's centre (GET /areas), used when the course has no stops (PRD 7.6). */
  center?: { lat: number; lng: number };
  onSelect: MapSelect;
  onError: (e: unknown) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const {locale} = useLocale();
  const [viewMode, setViewMode] = useState<"island" | "course" | "focus">("course");
  const kakaoRef = useRef<KakaoMaps | null>(null);
  const mapRef = useRef<KMap | null>(null);
  const layersRef = useRef<KLayer[]>([]);
  const locationOverlayRef = useRef<KLayer | null>(null);
  const fitRef = useRef<() => void>(() => {});
  const islandFitRef = useRef<() => void>(() => {});
  const onFocusRef = useRef<((place: Place) => void) | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const [ready, setReady] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(MAP_CONFIG.level);
  const [locationStatus, setLocationStatus] = useState<"idle"|"loading"|"denied"|"unsupported">("idle");
  function locateMe() {
    if (!navigator.geolocation || !kakaoRef.current || !mapRef.current) {
      setLocationStatus("unsupported"); return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(({coords}) => {
      const kakao = kakaoRef.current; const map = mapRef.current;
      if (!kakao || !map) return;
      locationOverlayRef.current?.setMap(null);
      const pin = document.createElement("div");
      pin.className = "map-user-location";
      pin.textContent = "●";
      pin.title = locale==="ko"?"내 현재 위치":locale==="en"?"My location":locale==="zh"?"我的位置":"現在地";
      locationOverlayRef.current = new kakao.CustomOverlay({map, position:new kakao.LatLng(coords.latitude,coords.longitude),content:pin,xAnchor:.5,yAnchor:.5,zIndex:8});
      map.setCenter(new kakao.LatLng(coords.latitude,coords.longitude));
      map.setLevel(4);setCurrentLevel(4);setViewMode("focus");setLocationStatus("idle");
    }, () => setLocationStatus("denied"), {enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }
  function changeZoom(change: number) {
    const map = mapRef.current;
    if (!map) return;
    const level = (map as KMap & { getLevel?: () => number }).getLevel?.() ?? currentLevel;
    const next = Math.max(1, Math.min(12, level + change));
    map.setLevel(next);
    setCurrentLevel(next);
  }

  const stopSignature = items.map(it => `${it.place_id}:${it.order}`).join("|");

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let zoomHandler: (() => void) | null = null;
    let createdMap: KMap | null = null;
    let createdMaps: KakaoMaps | null = null;
    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !boxRef.current) return;
        kakaoRef.current = maps;
        mapRef.current = new maps.Map(boxRef.current, {
          center: new maps.LatLng(MAP_CONFIG.center.lat, MAP_CONFIG.center.lng),
          level: MAP_CONFIG.level,
        });
        createdMaps = maps;
        createdMap = mapRef.current;
        zoomHandler = () => setCurrentLevel(createdMap?.getLevel() ?? MAP_CONFIG.level);
        maps.event?.addListener(createdMap, "zoom_changed", zoomHandler);
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) errorRef.current(e);
      });
    return () => {
      cancelled = true;
      if (createdMap && createdMaps?.event && zoomHandler) createdMaps.event.removeListener(createdMap, "zoom_changed", zoomHandler);
      layersRef.current.forEach((l) => l.setMap(null));
      layersRef.current = [];
      locationOverlayRef.current?.setMap(null);
      locationOverlayRef.current = null;
    };
  }, []);

  // Draw markers and the line; fit the view to the course (7.4, 7.6).
  useEffect(() => {
    const maps = kakaoRef.current;
    const map = mapRef.current;
    if (!ready || !maps || !map) return;

    layersRef.current.forEach((l) => l.setMap(null));
    const layers: KLayer[] = [];
    const ll = (p: Place) => new maps.LatLng(p.lat, p.lng);
    const inBounds = (p: Place) => toPercent(p.lat, p.lng, ISLAND_MAP_BOUNDS).inBounds; // 7.5: never draw out-of-bounds points

    const courseIds = new Set(items.map((i) => i.place_id));
    for (const p of places) {
      if (courseIds.has(p.id) || !activeCategories.has(p.category) || !inBounds(p)) continue;
      layers.push(
        new maps.CustomOverlay({
          map,
          position: ll(p),
          content: otherMarker(p, () => selectRef.current({ place: p, stay: p.avg_stay_min })),
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: 1,
          clickable: true,
        }),
      );
    }

    // Geographic reference points are independent of the API place list and are always visible within the viewport.
    for (const landmark of JEJU_LANDMARKS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `map-landmark-sdk map-landmark-sdk--${landmark.id}`;
      button.setAttribute("aria-label", landmark.names[locale]);
      button.title = landmark.names[locale];
      const pictogram = document.createElement("span"); pictogram.className = "map-landmark-sdk__emoji";
      pictogram.textContent = landmark.emoji;
      const caption = document.createElement("span"); caption.className = "map-landmark-sdk__name";
      caption.textContent = landmark.names[locale];
      button.append(pictogram, caption);
      button.addEventListener("click", () => {
        setViewMode("focus");
        map.setCenter(new maps.LatLng(landmark.lat, landmark.lng));
        map.setLevel(landmark.id === "airport" ? 5 : 6);
        setCurrentLevel(map.getLevel?.() ?? 6);
      });
      layers.push(new maps.CustomOverlay({map,position:new maps.LatLng(landmark.lat,landmark.lng),content:button,xAnchor:.5,yAnchor:.75,zIndex:2,clickable:true}));
    }
    const stops = [...items].sort((a, b) => a.order - b.order).filter((it) => inBounds(it.place));
    if (stops.length > 1) {
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
      layers.push(
        new maps.CustomOverlay({
          map,
          position: ll(it.place),
          content: courseMarker(it, tripMode, () =>
            selectRef.current({ place: it.place, stay: it.stay_min, order: it.order }),
          ),
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: current ? 4 : 3,
          clickable: true,
        }),
      );
    }
    layersRef.current = layers;

    islandFitRef.current = () => {
      const b = new maps.LatLngBounds();
      JEJU_LANDMARKS.forEach(p => b.extend(new maps.LatLng(p.lat,p.lng)));
      stops.forEach(it => b.extend(ll(it.place)));
      map.setBounds(b, 56, 46, 56, 46);
      setCurrentLevel(map.getLevel?.() ?? MAP_CONFIG.level);
    };
    onFocusRef.current = (place) => {
      map.setCenter(ll(place));
      map.setLevel(4);
      setCurrentLevel(map.getLevel?.() ?? 4);
    };
    fitRef.current = () => {
      if (stops.length === 0) {
        const c = center ?? MAP_CONFIG.center;
        map.setLevel(MAP_CONFIG.level);
        map.setCenter(new maps.LatLng(c.lat, c.lng));
      } else if (stops.length === 1) {
        map.setLevel(MAP_CONFIG.singleStopLevel);
        map.setCenter(ll(stops[0].place));
      } else {
        const b = new maps.LatLngBounds();
        stops.forEach((it) => b.extend(ll(it.place)));
        const pad = MAP_CONFIG.fitPaddingPx;
        map.setBounds(b, pad, pad, pad, pad);
      }
      setCurrentLevel((map as KMap & { getLevel?: () => number }).getLevel?.() ?? MAP_CONFIG.level);
    };
    // Do NOT automatically reset the user's zoom when categories or language change.
    // Fitting the view happens in a separate effect below.
  }, [ready, items, places, tripMode, activeCategories, locale, focusPlace, viewMode, center]);

  const lastSignature = useRef(stopSignature);
  useEffect(() => {
    if (lastSignature.current === stopSignature) return;
    lastSignature.current = stopSignature;
    setViewMode("course");
  }, [stopSignature]);

  useEffect(() => {
    if (!ready) return;
    if (viewMode === "island") islandFitRef.current();
    else if (viewMode === "course") fitRef.current();
  }, [ready, viewMode, stopSignature]);

  useEffect(() => {
    if (focusPlace && ready) {
      setViewMode("focus");
      onFocusRef.current?.(focusPlace);
    }
  }, [focusPlace, ready]);

  // Keep the map sized to its box (7.4).
  useEffect(() => {
    const el = boxRef.current;
    if (!ready || !el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.relayout();
      if (viewMode === "island") islandFitRef.current();
      else if (viewMode === "course") fitRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, viewMode]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-line bg-sea-soft isolate"
      style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }}
    >
      <div ref={boxRef} className="absolute inset-0" />
      <div className="map-view-switch" role="group" aria-label={locale==="ko"?"지도 보기 범위":"Map view"}>
        <button type="button" className={viewMode==="island"?"is-active":""} disabled={!ready} onClick={()=>{setViewMode("island");islandFitRef.current()}}>{locale==="ko"?"🌴 제주 전체":locale==="zh"?"🌴 全岛":locale==="ja"?"🌴 済州全島":"🌴 Island"}</button>
        <button type="button" className={viewMode==="course"?"is-active":""} disabled={!ready} onClick={()=>{setViewMode("course");fitRef.current()}}>{locale==="ko"?"📍 내 코스":locale==="zh"?"📍 行程":locale==="ja"?"📍 旅程":"📍 My stops"}</button>
      </div>
      <button type="button" className="map-locate-button" disabled={!ready||locationStatus==="loading"} onClick={locateMe} title={locale==="ko"?"GPS 위치 권한이 필요해요": "GPS permission required"}>
        ⌖ {locationStatus==="loading"?(locale==="ko"?"찾는 중...":"Locating..."):(locale==="ko"?"내 위치":locale==="en"?"My location":locale==="zh"?"我的位置":"現在地")}
      </button>
      {(locationStatus==="denied"||locationStatus==="unsupported") && <p className="map-location-error" role="status">{locale==="ko"?"위치 확인 불가 · 휴대폰 위치 권한과 HTTPS를 확인하세요":locale==="zh"?"无法定位 · 请检查权限与 HTTPS":locale==="ja"?"位置取得不可 · 権限とHTTPSを確認":"Location unavailable · check permissions and HTTPS"}</p>}
      {!ready && <div className="skeleton absolute inset-0" aria-label="Loading map" />}
      <div className="map-surface__zoom map-surface__zoom--sdk" role="group" aria-label="Zoom map">
        <button type="button" disabled={!ready || currentLevel<=1} onClick={()=>changeZoom(-1)} aria-label="Zoom in">+</button>
        <button type="button" disabled={!ready || currentLevel>=12} onClick={()=>changeZoom(1)} aria-label="Zoom out">−</button>
        <button type="button" disabled={!ready} onClick={()=>{setViewMode("course");fitRef.current()}} aria-label="Fit all stops">↺</button>
      </div>
    </div>
  );
}
