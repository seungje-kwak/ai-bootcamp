"""The 14 areas a traveler can pick (tasks/prd-start-area.md): which area a place is in, and
whether an area has enough places to be picked (FR-4)."""
from __future__ import annotations

import json
import math
from typing import Optional

from . import config
from .errors import ApiError

# Each eup / myeon is one area. Every dong of a city is in that city's downtown area.
EUP_MYEON = {
    "한림읍": "hallim", "애월읍": "aewol", "구좌읍": "gujwa", "조천읍": "jocheon",
    "한경면": "hangyeong", "추자면": "chuja", "우도면": "udo",
    "대정읍": "daejeong", "남원읍": "namwon", "성산읍": "seongsan",
    "안덕면": "andeok", "표선면": "pyoseon",
}
PUBLIC_KEYS = ("id", "group", "name_en", "name_ko", "description_en", "center_lat", "center_lng")


def area_of_name(name_ko: str) -> Optional[str]:
    """Area id from a Korean address or boundary name, or None when it does not say.
    The eup / myeon name is looked for first, because "제주시" is in those names too."""
    text = name_ko or ""
    for name, area_id in EUP_MYEON.items():
        if name in text:
            return area_id
    if "제주시" in text:
        return "jeju-city"
    if "서귀포시" in text:
        return "seogwipo-city"
    return None


def area_of_address(address_ko: str) -> Optional[str]:
    """Area id from a Korean address, or None when the address does not say.
    The eup / myeon name is looked for first, because "제주시" is in those addresses too."""
    return area_of_name(address_ko)


# --------------------------------------------------------------------------- area from coordinates
# prd-recommendation-p0 FR-7, FR-8: the 43 eup / myeon / dong boundaries in app/data/jeju_admin.geojson.
# Each boundary: (area_id, bbox (lng0, lat0, lng1, lat1), polygons). A polygon is a list of rings
# (the outer ring first, then holes); a ring is a list of (lng, lat).
_BOUNDARIES: Optional[list[tuple[str, tuple, list]]] = None


def load_boundaries() -> list[tuple[str, tuple, list]]:
    """Read the boundary file once and keep it."""
    global _BOUNDARIES
    if _BOUNDARIES is None:
        data = json.loads((config.SEED_DATA_DIR / "jeju_admin.geojson").read_text(encoding="utf-8"))
        out = []
        for f in data["features"]:
            area_id = area_of_name(f["properties"]["adm_nm"])
            if area_id is None:
                raise ValueError(f"boundary {f['properties']['adm_nm']!r} is not in any area")
            g = f["geometry"]
            polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
            polys = [[[(float(x), float(y)) for x, y in ring] for ring in poly] for poly in polys]
            xs = [x for poly in polys for x, _ in poly[0]]
            ys = [y for poly in polys for _, y in poly[0]]
            out.append((area_id, (min(xs), min(ys), max(xs), max(ys)), polys))
        _BOUNDARIES = out
    return _BOUNDARIES


def _in_ring(x: float, y: float, ring: list[tuple[float, float]]) -> bool:
    """Ray casting: a ray from the point to the east crosses the ring an odd number of times."""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_polygon(x: float, y: float, poly: list) -> bool:
    return _in_ring(x, y, poly[0]) and not any(_in_ring(x, y, hole) for hole in poly[1:])


def _edge_km(lat: float, lng: float, polys: list) -> float:
    """Shortest distance from the point to any edge of the boundary, on a flat local projection."""
    kx = math.cos(math.radians(lat)) * 111.32
    ky = 110.57
    best = math.inf
    for poly in polys:
        for ring in poly:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
                ax, ay = (x1 - lng) * kx, (y1 - lat) * ky
                bx, by = (x2 - lng) * kx, (y2 - lat) * ky
                dx, dy = bx - ax, by - ay
                seg = dx * dx + dy * dy
                t = 0.0 if seg == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg))
                best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


def area_of_point(lat: float, lng: float) -> Optional[str]:
    """FR-8: the area of the boundary the point is in. Outside all of them (coast, small rocks): the area
    of the closest boundary within AREA_EDGE_TOLERANCE_KM. Otherwise None."""
    boundaries = load_boundaries()
    for area_id, (x0, y0, x1, y1), polys in boundaries:
        if x0 <= lng <= x1 and y0 <= lat <= y1 and any(_in_polygon(lng, lat, poly) for poly in polys):
            return area_id
    tol = config.AREA_EDGE_TOLERANCE_KM
    margin_lat, margin_lng = tol / 110.57, tol / (math.cos(math.radians(lat)) * 111.32)
    best, best_km = None, math.inf
    for area_id, (x0, y0, x1, y1), polys in boundaries:
        if not (x0 - margin_lng <= lng <= x1 + margin_lng and y0 - margin_lat <= lat <= y1 + margin_lat):
            continue
        km = _edge_km(lat, lng, polys)
        if km < best_km:
            best, best_km = area_id, km
    return best if best_km <= tol else None


def load_seed_areas() -> list[dict]:
    return json.loads((config.SEED_DATA_DIR / "areas.json").read_text(encoding="utf-8"))


def _counts(places: list[dict]) -> bool:
    """FR-4 for the places of one area."""
    if config.REQUIRE_VERIFIED:      # same rule as the planner's F-1
        places = [p for p in places if p.get("image_url") and p.get("last_verified_at")]
    food = [p for p in places if p["category"] == "food"]
    # solo_ok true or null (not known): only a place known to refuse one diner is left out
    solo = [p for p in food if (p.get("food_options") or {}).get("solo_ok") is not False]
    cafes = [p for p in places if p["category"] == "cafe"]
    easy = [p for p in places if p["accessibility"]["walking_level"] == 1 and p["accessibility"]["terrain"] == "flat"]
    indoor = [p for p in places if p["accessibility"]["indoor"]]
    return (len(places) >= config.AREA_MIN_PLACES and len(food) >= config.AREA_MIN_FOOD
            and len(solo) >= config.AREA_MIN_SOLO_FOOD and len(cafes) >= config.AREA_MIN_CAFE
            and len(easy) >= config.AREA_MIN_EASY and len(indoor) >= config.AREA_MIN_INDOOR)


def summaries(areas: list[dict], places: list[dict]) -> list[dict]:
    """`GET /areas` rows: every area in sort_order, with its place count and whether it can be picked."""
    by_area: dict[str, list[dict]] = {}
    for p in places:
        by_area.setdefault(p.get("area_id"), []).append(p)
    out = []
    for a in sorted(areas, key=lambda a: a["sort_order"]):
        mine = by_area.get(a["id"], [])
        out.append({**{k: a[k] for k in PUBLIC_KEYS}, "place_count": len(mine), "selectable": _counts(mine)})
    return out


def check_area(area_id: str, areas: list[dict], places: list[dict]) -> None:
    """422 INVALID_AREA unless `area_id` is one of the areas and can be picked (FR-3)."""
    row = next((a for a in summaries(areas, places) if a["id"] == area_id), None)
    if row is None:
        raise ApiError(422, "INVALID_AREA", "That area does not exist.")
    if not row["selectable"]:
        raise ApiError(422, "INVALID_AREA", "That area is not ready yet.")
