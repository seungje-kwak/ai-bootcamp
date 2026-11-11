"""API 주소(엔드포인트) 정의

/health        서버 살아 있는지 + 데이터 모드(sample/api)
/collect       [POST] 관공서 API 받기 → 가공 → Supabase 저장 (X-Admin-Token 필요)
/air/latest    최신 시간의 측정소별 값
/air/summary   시간대별 요약 (그래프용)
/air/forecast  다음 1시간 예측
"""
import os
import secrets
from datetime import datetime, timedelta

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from postgrest.exceptions import APIError

import airkorea
from db import sb  # db.py 가 .env 를 먼저 읽어 둠

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
FRONT_ORIGINS = [o.strip() for o in os.getenv("FRONT_ORIGINS", "").split(",") if o.strip()]

app = FastAPI(title="day3 관공서 데이터 수집 서버")

# 출입 명단: 여기 적힌 화면 주소만 브라우저에서 이 API를 부를 수 있음
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONT_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(APIError)
def supabase_error(request, exc: APIError):
    """Supabase 오류를 화면에서도 읽을 수 있게 (예: 테이블이 없으면 schema.sql 실행 안내)"""
    hint = " → Supabase SQL Editor에서 schema.sql 을 실행하세요." if exc.code == "PGRST205" else ""
    return JSONResponse(status_code=500, content={"detail": f"Supabase 오류: {exc.message}{hint}"})


def run_collect(sido: str) -> dict:
    raw = airkorea.fetch_raw(sido)                 # 1) 받기
    rows = airkorea.clean_items(raw, sido)         # 2) 가공
    if not rows:
        raise airkorea.FetchError(f"'{sido}' 측정값이 없습니다. 시도 이름을 확인하세요 (예: 제주, 서울).")
    summary = airkorea.summarize(rows, sido)       #    요약
    # 3) 저장. upsert = 없으면 넣고 있으면 덮어쓰기 → 같은 시간을 두 번 수집해도 중복 없음
    sb.table("air_measurements").upsert(rows, on_conflict="sido,station_name,data_time").execute()
    sb.table("air_summary").upsert(summary, on_conflict="sido,data_time").execute()
    return {
        "received": len(airkorea.items_of(raw)),
        "saved": len(rows),
        "missing": summary["missing_count"],
        "summary": summary,
    }


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")  # 주소만 쳐도 시험 화면으로


@app.get("/health")
def health():
    return {"ok": True, "mode": airkorea.data_mode()}


@app.post("/collect")
def collect(
    sido: str = Query("제주"),
    x_admin_token: str = Header(default="", description="Railway/.env 의 ADMIN_TOKEN 과 같은 값"),
):
    if not ADMIN_TOKEN or not secrets.compare_digest(x_admin_token.encode(), ADMIN_TOKEN.encode()):
        raise HTTPException(status_code=401, detail="관리자 토큰이 틀렸습니다.")
    try:
        return run_collect(sido)
    except airkorea.FetchError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:  # Supabase 테이블이 없거나 unique 조건이 없을 때 등
        raise HTTPException(status_code=500, detail=f"Supabase 저장 실패 (schema.sql 실행했나요?): {e}")


@app.get("/air/latest")
def air_latest(sido: str = "제주"):
    last = (
        sb.table("air_measurements").select("data_time")
        .eq("sido", sido).order("data_time", desc=True).limit(1).execute().data
    )
    if not last:
        return []
    rows = (
        sb.table("air_measurements")
        .select("station_name,data_time,pm10,pm25,grade,is_missing")
        .eq("sido", sido).eq("data_time", last[0]["data_time"]).execute().data
    )
    # 나쁜 순으로, 점검 중(값 없음)은 맨 아래
    rows.sort(key=lambda r: (r["is_missing"], -(r["pm25"] or 0)))
    return rows


@app.get("/air/summary")
def air_summary(sido: str = "제주", hours: int = Query(24, ge=1, le=24 * 30)):
    """가장 최근 기록부터 거꾸로 hours 시간 동안의 요약 (오래된 순)"""
    last = (
        sb.table("air_summary").select("data_time")
        .eq("sido", sido).order("data_time", desc=True).limit(1).execute().data
    )
    if not last:
        return []
    since = datetime.fromisoformat(last[0]["data_time"]) - timedelta(hours=hours)
    return (
        sb.table("air_summary").select("*")
        .eq("sido", sido).gt("data_time", since.isoformat())
        .order("data_time").execute().data
    )


@app.get("/air/forecast")
def air_forecast(sido: str = "제주"):
    recent = (
        sb.table("air_summary").select("data_time,avg_pm25")
        .eq("sido", sido).order("data_time", desc=True).limit(6).execute().data
    )
    recent.reverse()  # 오래된 순
    predicted = airkorea.forecast_next([r["avg_pm25"] for r in recent])
    if predicted is None:
        return {"ready": False, "message": "기록이 3시간 이상 쌓이면 예측해요", "records": len(recent)}
    next_time = datetime.fromisoformat(recent[-1]["data_time"]) + timedelta(hours=1)
    return {
        "ready": True,
        "next_time": next_time.astimezone(airkorea.KST).isoformat(),
        "predicted_pm25": predicted,
        "grade": airkorea.pm25_grade(predicted),
        "based_on": len(recent),
    }
