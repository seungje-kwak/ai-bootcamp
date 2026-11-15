"""Cut Jeju's 43 eup / myeon / dong boundaries out of the national admdongkor GeoJSON and simplify them
(tasks/prd-recommendation-p0.md US-R05). Writes backend/app/data/jeju_admin.geojson.

Source: https://github.com/vuski/admdongkor (HangJeongDong_ver20261001.geojson), see data/seed/README.md.

Run:  backend/.venv/Scripts/python.exe backend/scripts/build_jeju_admin.py <path to HangJeongDong_*.geojson>
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "app" / "data" / "jeju_admin.geojson"
JEJU = "제주특별자치도"
MIN_STEP_M = 20.0          # drop a vertex closer than this to the last kept one
MAX_BYTES = 1_000_000


def _dist_m(a: list[float], b: list[float]) -> float:
    lat = math.radians((a[1] + b[1]) / 2)
    dx = math.radians(b[0] - a[0]) * math.cos(lat) * 6371000.0
    dy = math.radians(b[1] - a[1]) * 6371000.0
    return math.hypot(dx, dy)


def simplify_ring(ring: list[list[float]], step: float) -> list[list[float]]:
    kept = [ring[0]]
    for pt in ring[1:-1]:
        if _dist_m(kept[-1], pt) >= step:
            kept.append(pt)
    if len(kept) < 3:                      # a tiny ring: keep it as it was
        kept = ring[:-1]
    kept.append(kept[0])                   # closed
    return [[round(x, 5), round(y, 5)] for x, y in kept]


def simplify(geom: dict, step: float) -> dict:
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    out = [[simplify_ring(r, step) for r in poly] for poly in polys]
    return {"type": "MultiPolygon", "coordinates": out}


def main(src: str) -> int:
    data = json.loads(Path(src).read_text(encoding="utf-8"))
    feats = [f for f in data["features"] if f["properties"].get("sidonm") == JEJU]
    if len(feats) != 43:
        print(f"ERROR: expected 43 Jeju boundaries, found {len(feats)}")
        return 1
    out = {
        "type": "FeatureCollection",
        "name": "jeju_admin",
        "source": f"{data.get('name')} from https://github.com/vuski/admdongkor (SGIS, KOGL Type 1 / CC BY 4.0)",
        "features": [{
            "type": "Feature",
            "properties": {k: f["properties"][k] for k in ("adm_nm", "adm_cd", "adm_cd2")},
            "geometry": simplify(f["geometry"], MIN_STEP_M),
        } for f in sorted(feats, key=lambda f: f["properties"]["adm_cd2"])],
    }
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    if len(text.encode("utf-8")) > MAX_BYTES:
        print(f"ERROR: {len(text.encode('utf-8'))} bytes, more than {MAX_BYTES}")
        return 1
    OUT.write_text(text + "\n", encoding="utf-8")
    print(f"{len(out['features'])} boundaries, {OUT.stat().st_size} bytes -> {OUT}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
