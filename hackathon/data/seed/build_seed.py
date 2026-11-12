"""MyPace Jeju 시드 CSV 생성 스크립트.

입력
  - poi_selected_20.csv          : 제주도장소(POI)데이터_20151231에서 고른 관광지 20곳 (원본 값)
  - research/places_batch*.json  : 원본에 없는 필드를 인터넷에서 조사한 결과
  - research/food_options.json   : 1인 주문 가능 식당·카페 조사 결과
출력 (Supabase Table Editor > Import data from CSV 로 바로 올릴 수 있는 형태)
  - places.csv, place_accessibility.csv, food_options.csv, phrase_cards.csv, place_sources.csv

실행: day2 가상환경 재사용
  ..\\..\\..\\day2\\vjeju\\Scripts\\python.exe build_seed.py
"""
import csv
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
RESEARCH = os.path.join(HERE, "research")

# 장소 id 순서 = poi_selected_20.csv 순서 (1~20), 식당·카페는 21번부터
POI_ORDER = ["30961", "6760", "2665", "2088", "2654", "2991", "2869", "58", "11252", "847",
             "21172", "525", "10241", "637", "68794", "57716", "6056", "979", "34370", "35314"]


def b(v):
    """JSON 값을 Postgres boolean CSV 값으로. 확인 못 한 값(null)은 빈칸으로 둔다."""
    if v is True:
        return "true"
    if v is False:
        return "false"
    return ""


def s(v):
    if v is None:
        return ""
    if isinstance(v, list):
        return " | ".join(str(x) for x in v)
    return str(v)


def write(name, header, rows):
    path = os.path.join(HERE, name)
    # utf-8-sig: 엑셀에서 열어도 한글이 깨지지 않고, Supabase import도 정상 동작
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def load_research():
    by_poi = {}
    for p in sorted(glob.glob(os.path.join(RESEARCH, "places_batch*.json"))):
        with open(p, encoding="utf-8") as f:
            for item in json.load(f):
                by_poi[str(item["poi_id"]).strip()] = item
    with open(os.path.join(RESEARCH, "food_options.json"), encoding="utf-8") as f:
        food = json.load(f)
    return by_poi, food


def main():
    with open(os.path.join(HERE, "poi_selected_20.csv"), encoding="utf-8-sig") as f:
        poi = {r["poi_id"]: r for r in csv.DictReader(f)}
    research, food = load_research()
    missing = [p for p in POI_ORDER if p not in research]
    if missing:
        raise SystemExit(f"조사 결과가 없는 poi_id: {missing}")

    places, access, sources = [], [], []
    for i, pid in enumerate(POI_ORDER, start=1):
        o, r = poi[pid], research[pid]
        places.append([
            i, pid, s(r.get("name_en")), s(r.get("name_ko")) or o["name_ko_poi"], s(r.get("category")),
            s(r.get("description_en")), o["lat"], o["lng"], s(r.get("address_ko")),
            s(r.get("image_url")), s(r.get("image_source")), s(r.get("avg_stay_min")),
            s(r.get("opening_hours")), s(r.get("closed_days")), s(r.get("price_level")),
            s(r.get("admission_adult_krw")), s(r.get("phone")), s(r.get("official_url")),
            "",  # last_verified_at: 팀원이 현장/공식 확인 후 날짜 기입
        ])
        wc = r.get("wheelchair_ok")
        indoor = r.get("indoor")
        access.append([
            i, s(r.get("walking_level")), s(r.get("terrain")), b(r.get("has_stairs")),
            # 'partial' 은 boolean 컬럼에 넣을 수 없어 보수적으로 false + 메모로 남김
            "false" if wc == "partial" else b(wc),
            "false" if indoor == "mixed" else b(indoor),
            b(r.get("has_seating")), b(r.get("restroom")), s(r.get("fatigue_score")),
            "; ".join(x for x in [
                "wheelchair: partial" if wc == "partial" else "",
                "indoor: mixed (indoor+outdoor)" if indoor == "mixed" else "",
                f"accessible_restroom={r.get('accessible_restroom')}" if r.get("accessible_restroom") is not None else "",
            ] if x),
        ])
        sources.append([i, s(r.get("name_ko")), "제주특별자치도_제주도장소(POI)데이터_20151231 (poi_id=%s)" % pid,
                        s(r.get("image_page_url")), s(r.get("accessibility_source_url")),
                        s(r.get("sources")), s(r.get("notes"))])

    food_rows = []
    for j, r in enumerate(food, start=len(POI_ORDER) + 1):
        places.append([
            j, "", s(r.get("name_en")), s(r.get("name_ko")), s(r.get("type")),
            s(r.get("description_en")), s(r.get("lat")), s(r.get("lng")), s(r.get("address_ko")),
            s(r.get("image_url")), s(r.get("image_source")), "50" if r.get("type") == "restaurant" else "40",
            s(r.get("opening_hours")), s(r.get("closed_days")), s(r.get("price_level")),
            "", s(r.get("phone")), s(r.get("official_url")), "",
        ])
        access.append([j, "1", "", "", "", "true", "true", "", "1", "restaurant/cafe - 접근성 미확인"])
        halal = r.get("halal")
        food_rows.append([
            j, b(r.get("solo_ok")),
            "true" if r.get("vegan") in (True, "options") else b(r.get("vegan")),
            "true" if r.get("vegetarian") in (True, "options") else b(r.get("vegetarian")),
            "true" if halal in ("certified", "muslim_friendly") else ("false" if halal in (False, "no_pork") else ""),
            b(r.get("english_menu")), s(r.get("signature_menu_en")), s(r.get("allergens")),
            "; ".join(x for x in [
                f"vegan={r.get('vegan')}" if r.get("vegan") == "options" else "",
                f"halal={halal}" if halal else "",
                s(r.get("solo_ok_evidence")),
            ] if x),
        ])
        sources.append([j, s(r.get("name_ko")), "web research", "", "", s(r.get("sources")), s(r.get("notes"))])

    write("places.csv", ["id", "poi_id", "name_en", "name_ko", "category", "description_en", "lat", "lng",
                         "address_ko", "image_url", "image_source", "avg_stay_min", "opening_hours",
                         "closed_days", "price_level", "admission_adult_krw", "phone", "official_url",
                         "last_verified_at"], places)
    write("place_accessibility.csv", ["place_id", "walking_level", "terrain", "has_stairs", "wheelchair_ok",
                                      "indoor", "has_seating", "restroom", "fatigue_score", "note"], access)
    write("food_options.csv", ["place_id", "solo_ok", "vegan", "vegetarian", "halal", "english_menu",
                               "signature_menu_en", "allergens", "note"], food_rows)
    write("place_sources.csv", ["place_id", "name_ko", "base_data", "image_page_url",
                                "accessibility_source_url", "sources", "notes"], sources)

    from phrase_cards import PHRASES
    write("phrase_cards.csv", ["id", "place_id", "situation", "text_en", "text_ko"],
          [[k, s(p), sit, en, ko] for k, (p, sit, en, ko) in enumerate(PHRASES, start=1)])


if __name__ == "__main__":
    main()
