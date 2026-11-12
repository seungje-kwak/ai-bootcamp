// Kakao Maps JavaScript SDK loader (7.4). Loaded once per page with autoload=false, then kakao.maps.load().
// Only the small part of the SDK this app uses is typed here.
import { MAP_CONFIG } from "@/config/map";

export type KLatLng = { getLat(): number; getLng(): number };
export type KLatLngBounds = { extend(p: KLatLng): void };
export type KMap = {
  setBounds(b: KLatLngBounds, top?: number, right?: number, bottom?: number, left?: number): void;
  setCenter(p: KLatLng): void;
  setLevel(level: number): void;
  relayout(): void;
};
export type KLayer = { setMap(map: KMap | null): void };

export type KakaoMaps = {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KLatLng;
  LatLngBounds: new () => KLatLngBounds;
  Map: new (el: HTMLElement, opts: { center: KLatLng; level: number }) => KMap;
  CustomOverlay: new (opts: {
    position: KLatLng;
    content: HTMLElement;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
    map?: KMap;
  }) => KLayer;
  Polyline: new (opts: {
    path: KLatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    map?: KMap;
  }) => KLayer;
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const LOAD_TIMEOUT_MS = 8000;
let pending: Promise<KakaoMaps> | null = null;

/** Resolves with kakao.maps, or rejects (no key, blocked script, unregistered domain, timeout). */
export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (!MAP_CONFIG.kakaoKey) return Promise.reject(new Error("NEXT_PUBLIC_KAKAO_MAP_KEY is empty"));
  if (pending) return pending;

  pending = new Promise<KakaoMaps>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Kakao SDK load timeout")), LOAD_TIMEOUT_MS);
    const ready = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        window.clearTimeout(timer);
        reject(new Error("Kakao SDK loaded without kakao.maps (check the key and the registered domain)"));
        return;
      }
      maps.load(() => {
        window.clearTimeout(timer);
        resolve(maps);
      });
    };
    if (window.kakao?.maps) return ready();

    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(MAP_CONFIG.kakaoKey)}&autoload=false`;
    s.async = true;
    s.onload = ready;
    s.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("Kakao SDK script failed (check the key and the registered domain)"));
    };
    document.head.appendChild(s);
  }).catch((e) => {
    pending = null; // allow a retry on the next mount
    throw e;
  });
  return pending;
}
