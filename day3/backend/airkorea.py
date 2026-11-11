"""관공서(에어코리아) 데이터: 받기 · 가공 · 예측

수업에서 가장 오래 보는 파일입니다.
- fetch_raw()     : 받기  (관공서 API 호출, 또는 DATA_MODE=sample 이면 예시 파일)
- clean_items()   : 가공  ('-' 정리, 글자 → 숫자, 글자 시간 → 진짜 시간, 등급)
- summarize()     : 요약  (평균, 가장 나쁜 측정소, 누락 수)
- forecast_next() : 예측  (최근 값으로 직선을 그어 다음 1시간 값 예측)
"""
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

# 한국 시간(UTC+9). Windows에는 시간대 DB가 없어서 zoneinfo 대신 고정 오프셋을 씁니다.
KST = timezone(timedelta(hours=9))

# 한국환경공단_에어코리아_대기오염정보 > 시도별 실시간 측정정보 조회
API_URL = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty"
SAMPLE_FILE = Path(__file__).with_name("sample_response.json")


class FetchError(Exception):
    """관공서 API에서 데이터를 못 받았을 때"""


def data_mode() -> str:
    """DATA_MODE=sample 이면 예시 파일, 그 외(줄이 없으면)는 진짜 관공서 API"""
    return (os.getenv("DATA_MODE") or "api").strip().lower()


# ---------------------------------------------------------------- 1) 받기
def fetch_raw(sido: str) -> dict:
    if data_mode() == "sample":
        return json.loads(SAMPLE_FILE.read_text(encoding="utf-8"))

    key = os.getenv("PUBLIC_DATA_KEY", "").strip()
    if not key:
        raise FetchError("PUBLIC_DATA_KEY 환경변수가 없습니다. 키를 넣거나 DATA_MODE=sample 로 바꾸세요.")

    params = {
        "serviceKey": key,  # Decoding 키! (httpx가 알아서 인코딩해서 보냄)
        "returnType": "json",
        "numOfRows": 100,
        "pageNo": 1,
        "sidoName": sido,
        "ver": "1.0",
    }
    try:
        res = httpx.get(API_URL, params=params, timeout=15)
    except httpx.HTTPError as e:
        raise FetchError(f"관공서 API 연결 실패: {e}") from e

    try:
        data = res.json()
    except ValueError:
        # 키가 틀리면 JSON 대신 XML(SERVICE_KEY_IS_NOT_REGISTERED_ERROR 등)이 옵니다.
        raise FetchError(f"응답이 JSON이 아님 (Decoding 키인지, 승인됐는지 확인): {res.text[:200]}")

    header = (data.get("response") or {}).get("header") or {}
    if header.get("resultCode") != "00":
        raise FetchError(f"관공서 API 오류: {header.get('resultCode')} {header.get('resultMsg')}")
    return data


def items_of(raw: dict) -> list:
    body = (raw.get("response") or {}).get("body") or {}
    return body.get("items") or []


# ---------------------------------------------------------------- 2) 가공
def to_number(v):
    """'-', '', None → None / "38" → 38.0"""
    if v is None:
        return None
    s = str(v).strip()
    if s in ("", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def to_time(s):
    """"2026-11-10 14:00" → 2026-11-10 14:00 (한국 시간)
    "2026-11-10 24:00" → 2026-11-11 00:00  (24시를 다음 날 0시로)"""
    if not s:
        return None
    try:
        day, hm = str(s).strip().split(" ")
        hour, minute = hm.split(":")
        base = datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=KST)
        return base + timedelta(hours=int(hour), minutes=int(minute))
    except ValueError:
        return None


def pm25_grade(v):
    """초미세먼지(PM2.5) 등급: 0~15 좋음 · 16~35 보통 · 36~75 나쁨 · 76~ 매우나쁨"""
    if v is None:
        return "정보없음"
    if v <= 15:
        return "좋음"
    if v <= 35:
        return "보통"
    if v <= 75:
        return "나쁨"
    return "매우나쁨"


def clean_items(raw: dict, sido: str) -> list:
    rows = []
    for it in items_of(raw):
        name = (it.get("stationName") or "").strip()
        t = to_time(it.get("dataTime"))
        if not name or t is None:
            continue
        pm10 = to_number(it.get("pm10Value"))
        pm25 = to_number(it.get("pm25Value"))
        rows.append({
            "sido": sido,
            "station_name": name,
            "data_time": t.isoformat(),
            "pm10": pm10,
            "pm25": pm25,
            "grade": pm25_grade(pm25),
            "is_missing": pm25 is None,  # 고장·점검 중인 측정소
        })
    return rows


def summarize(rows: list, sido: str) -> dict:
    valid = [r for r in rows if r["pm25"] is not None]
    pm10s = [r["pm10"] for r in rows if r["pm10"] is not None]
    avg25 = round(sum(r["pm25"] for r in valid) / len(valid), 1) if valid else None
    worst = max(valid, key=lambda r: r["pm25"]) if valid else None
    return {
        "sido": sido,
        "data_time": max(r["data_time"] for r in rows),
        "station_count": len(rows),
        "missing_count": len(rows) - len(valid),
        "avg_pm10": round(sum(pm10s) / len(pm10s), 1) if pm10s else None,
        "avg_pm25": avg25,
        "grade": pm25_grade(avg25),
        "worst_station": worst["station_name"] if worst else None,
        "worst_pm25": worst["pm25"] if worst else None,
    }


# ---------------------------------------------------------------- 3) 예측
def forecast_next(values: list):
    """최근 값들로 직선(선형회귀)을 그어 다음 1시간 값을 예측합니다.
    라이브러리 없이 직접 계산. 값이 3개 미만이면 None.
    실제 서비스에서는 이 자리에 scikit-learn 같은 모델을 넣으면 됩니다."""
    ys = [v for v in values if v is not None]
    n = len(ys)
    if n < 3:
        return None
    mean_x = (n - 1) / 2
    mean_y = sum(ys) / n
    sxx = sum((x - mean_x) ** 2 for x in range(n))
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in enumerate(ys))
    slope = sxy / sxx
    predicted = mean_y + slope * (n - mean_x)  # x = n 이 "다음 1시간"
    return max(0.0, round(predicted, 1))
