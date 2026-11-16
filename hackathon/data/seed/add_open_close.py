"""places.csv 에 open_time, close_time 열을 채운다 (tasks/prd-trip-time.md US-T01).

opening_hours 문장(사람이 읽는 글)에서 여는 시각과 닫는 시각을 뽑는다.
  - "24h / always open", "Open 24 hours"  -> 둘 다 빈칸 (항상 열려 있음)
  - "09:00-18:00 (last entry 17:30)"       -> 09:00, 18:00 (괄호 안과 break/prep/last order 는 무시)
  - 계절·요일별로 여러 개면 가장 짧은 시간 -> 가장 늦게 열고 가장 일찍 닫는 값
  - 자정을 넘기면 (17:00-02:00, 10:00-00:00) -> close_time 은 24:00
  - 시간을 알 수 없는 문장(빈칸, "varies by store", 숙소 체크인 등) -> 둘 다 빈칸
OVERRIDES 에 적힌 장소는 문장을 읽지 않고 그 값을 쓴다.

실행 (표준 라이브러리만 사용, 여러 번 실행해도 결과가 같다):
  python data/seed/add_open_close.py            # places.csv 를 고쳐 쓴다
  python data/seed/add_open_close.py --check    # 고치지 않고 결과만 보여준다
"""
import csv
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "places.csv")

RANGE = re.compile(r"(?<![\d:])(\d{1,2}):(\d{2})\s*[-~–]\s*(\d{1,2}):(\d{2})(?![\d:])")
# 이 낱말 뒤에 오는 시간대는 영업시간이 아니다
NOT_HOURS = re.compile(r"(break|prep|lunch|last order|last entry|ticket|night opening|night market|swimming|"
                       r"check-?in|check-?out|performance|session)", re.I)
ALWAYS = re.compile(r"(24\s*h\b|always open|open 24 hours)", re.I)

# id -> (open_time, close_time). 문장만으로는 틀리게 읽히는 곳.
OVERRIDES = {
    4: ("09:00", "18:00"),     # 본관 시간. 어린이박물관·실감영상실 시간은 뺀다
    6: ("07:00", "21:00"),     # 시장 본 시간. 야시장 시간은 뺀다
    9: ("", ""),               # 해변은 항상 개방. 읽힌 시간은 해수욕 시간
    10: ("", ""),              # 야외 정원과 산책로는 연중 개방
    13: ("", ""),              # 야외 공원은 항상 개방
    173: ("", ""),             # 분화구는 항상 개방
    191: ("", ""),             # 1층은 항상 개방
    467: ("", ""),             # 해변은 항상 개방
    493: ("", ""),             # 야외 공원은 항상 개방
    52: ("18:00", "22:00"),    # 야시장
    142: ("", ""),             # 건물 바깥은 항상 개방
    199: ("", ""),             # 하구는 항상 개방
    258: ("09:00", "17:30"),   # 탐방로 겨울 시간
    266: ("09:00", "21:50"),   # 관람 시간. 족욕 시간은 뺀다
    355: ("09:00", "18:00"),   # 트랙터 투어 시간은 뺀다
    447: ("08:30", "19:30"),   # 공원 시간. 안쪽 시설 시간은 뺀다
    458: ("05:00", "22:00"),   # 본관 시간
    480: ("09:00", "18:00"),   # 숙박 체크인 시각이 섞여 읽힘
    563: ("10:00", "18:00"),   # 전시 시간
    622: ("09:00", "18:00"),   # 본관 시간
    808: ("09:30", "18:00"),   # 브런치 시간은 뺀다
}


def to_min(h, m):
    return int(h) * 60 + int(m)


def hhmm(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def parse(text):
    """(open, close, how). open/close 는 "HH:MM" 또는 둘 다 ""."""
    t = (text or "").strip()
    if not t:
        return "", "", "empty"
    body = re.sub(r"\([^)]*\)", " ", t)          # 괄호 안은 입장 마감·브레이크 같은 덧붙임
    ranges = []
    for seg in re.split(r"[;.]\s+|[;.]$", body):
        seg_ranges = []
        for m in RANGE.finditer(seg):
            before = seg[:m.start()]
            # 같은 조각 안에서 바로 앞 시간대 뒤에 나온 낱말만 본다
            last = max(before.rfind(","), 0)
            if NOT_HOURS.search(before[last:]):
                continue
            seg_ranges.append(m)
        ranges += seg_ranges
    if not ranges:
        if ALWAYS.search(t):
            return "", "", "always"
        return "", "", "unknown"
    opens, closes = [], []
    for m in ranges:
        o, c = to_min(m.group(1), m.group(2)), to_min(m.group(3), m.group(4))
        if o >= 24 * 60:
            continue
        if c <= o or c > 24 * 60:                  # 자정을 넘김
            c = 24 * 60
        opens.append(o)
        closes.append(c)
    if not opens:
        return "", "", "unknown"
    o, c = max(opens), min(closes)                 # 가장 짧은 기본 시간
    if o >= c:
        return "", "", "unknown"
    return hhmm(o), hhmm(c), ("range" if len(opens) == 1 else "shortest")


def main():
    check = "--check" in sys.argv
    with open(PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        header = list(reader.fieldnames)
        rows = list(reader)
    for col in ("open_time", "close_time"):
        if col not in header:
            header.insert(header.index("closed_days"), col)

    counts, review = {}, []
    for r in rows:
        pid = int(r["id"])
        if pid in OVERRIDES:
            o, c = OVERRIDES[pid]
            how = "override"
        else:
            o, c, how = parse(r["opening_hours"])
        r["open_time"], r["close_time"] = o or "", c or ""
        counts[how] = counts.get(how, 0) + 1
        if how in ("unknown", "shortest"):
            review.append((how, pid, r["category"], o, c, r["opening_hours"]))

    for how, n in sorted(counts.items()):
        print(f"{how:9} {n}")
    if check:
        for how, pid, cat, o, c, text in review:
            print(f"{how:8} {pid:>4} {cat:16} {o or '-':5} {c or '-':5} | {text[:150]}")
        return 0
    with open(PATH, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        w.writerows(rows)
    print(f"places.csv: {len(rows)} rows written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
