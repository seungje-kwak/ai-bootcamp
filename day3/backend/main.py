"""API 주소(엔드포인트) 정의

/health        서버 살아 있는지 + 데이터 모드(sample/api)
/collect       [POST] 관공서 API 받기 → 가공 → Supabase 저장 (X-Admin-Token 필요)
/air/latest    최신 시간의 측정소별 값
/air/summary   시간대별 요약 (그래프용)
/air/forecast  다음 1시간 예측 (시계열 선형회귀) + 어제 같은 시간 비교

자동 수집: 서버가 켜져 있는 동안 매시 20분(한국 시간)마다 스스로 수집해 Supabase에 쌓습니다.
(에어코리아는 정시 값을 보통 15분 전후에 올림 → 20분에 가져감)
- 켜기/끄기: AUTO_COLLECT=on / off  (안 적으면 DATA_MODE=api 일 때 켜짐)
- 수집할 시도: COLLECT_SIDOS=제주,서울  (안 적으면 제주)
"""
import asyncio
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from postgrest.exceptions import APIError

import airkorea
from db import sb  # db.py 가 .env 를 먼저 읽어 둠

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
# 끝에 / 를 붙여 적는 실수가 많아서 자동으로 떼어 냄 (브라우저가 보내는 주소에는 / 가 없음)
FRONT_ORIGINS = [o.strip().rstrip("/") for o in os.getenv("FRONT_ORIGINS", "").split(",") if o.strip()]
COLLECT_MINUTE = 20  # 매시 몇 분에 수집할지 (한국 시간)

# 자동 수집 상태 (/health 에서 확인)
AUTO = {"enabled": False, "next_run": None, "last_run": None}


def auto_collect_enabled() -> bool:
    v = (os.getenv("AUTO_COLLECT") or "").strip().lower()
    if not v:
        return airkorea.data_mode() == "api"  # 예시 데이터는 매시간 쌓아 봐야 같은 값이라 끔
    return v not in ("0", "false", "off", "no")


def collect_sidos() -> list:
    return [s.strip() for s in os.getenv("COLLECT_SIDOS", "제주").split(",") if s.strip()]


def collect_all() -> dict:
    """설정된 시도를 모두 수집. 한 곳이 실패해도 나머지는 계속."""
    results = {}
    for sido in collect_sidos():
        try:
            r = run_collect(sido)
            results[sido] = {"saved": r["saved"], "missing": r["missing"], "data_time": r["summary"]["data_time"]}
        except Exception as e:
            results[sido] = {"error": str(e)[:200]}
    return results


def next_run_time() -> datetime:
    now = datetime.now(airkorea.KST)
    nxt = now.replace(minute=COLLECT_MINUTE, second=0, microsecond=0)
    return nxt if nxt > now else nxt + timedelta(hours=1)


async def auto_collect_loop():
    await asyncio.sleep(5)  # 서버가 뜨자마자 한 번 수집 (배포·재시작해도 빈 시간이 덜 생김)
    while True:
        started = datetime.now(airkorea.KST)
        try:
            results = await asyncio.to_thread(collect_all)  # 수집은 별도 스레드에서 → API 응답은 안 멈춤
        except Exception as e:
            results = {"error": str(e)[:200]}
        AUTO["last_run"] = {"at": started.isoformat(timespec="seconds"), "results": results}
        print("[auto-collect]", AUTO["last_run"], flush=True)
        nxt = next_run_time()
        AUTO["next_run"] = nxt.isoformat(timespec="seconds")
        await asyncio.sleep((nxt - datetime.now(airkorea.KST)).total_seconds())


@asynccontextmanager
async def lifespan(app):
    task = None
    if auto_collect_enabled():
        AUTO["enabled"] = True
        task = asyncio.create_task(auto_collect_loop())
    yield
    if task:
        task.cancel()


app = FastAPI(title="day3 관공서 데이터 수집 서버", lifespan=lifespan)

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
    return {"ok": True, "mode": airkorea.data_mode(), "auto_collect": AUTO}


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


FORECAST_WINDOW_HOURS = 6  # 최근 몇 시간의 흐름으로 직선을 그을지


@app.get("/air/forecast")
def air_forecast(sido: str = "제주"):
    """시계열 선형회귀: 최근 6시간의 평균 PM2.5로 직선을 그어 다음 1시간 값을 예측
    + 어제 같은 시간 값과 비교 (매시간 쌓아 두었기 때문에 가능한 일)"""
    recent = (
        sb.table("air_summary").select("data_time,avg_pm25")
        .eq("sido", sido).order("data_time", desc=True).limit(FORECAST_WINDOW_HOURS * 2).execute().data
    )
    if not recent:
        return {"ready": False, "message": "아직 수집된 기록이 없어요", "records": 0}

    latest_time = datetime.fromisoformat(recent[0]["data_time"])
    # 수집이 끊겼던 옛날 기록은 빼고 "최근 6시간" 안의 기록만 사용
    window = [r for r in recent if latest_time - datetime.fromisoformat(r["data_time"]) < timedelta(hours=FORECAST_WINDOW_HOURS)]
    window.reverse()  # 오래된 순
    # x = 가장 최근 기록 기준 몇 시간 전인지(-5, -4, … 0), y = 평균 PM2.5
    points = [((datetime.fromisoformat(r["data_time"]) - latest_time).total_seconds() / 3600, r["avg_pm25"]) for r in window]

    # 어제 같은 시간 (24시간 전) 기록
    yesterday = (
        sb.table("air_summary").select("data_time,avg_pm25,grade")
        .eq("sido", sido).eq("data_time", (latest_time - timedelta(hours=24)).isoformat()).execute().data
    )
    base = {
        "latest_time": latest_time.astimezone(airkorea.KST).isoformat(),
        "latest_pm25": recent[0]["avg_pm25"],
        "yesterday_same_hour": yesterday[0] if yesterday else None,
        "records": len(window),
    }

    fc = airkorea.forecast_next(points)
    if fc is None:
        return {**base, "ready": False, "message": "최근 6시간 안에 기록이 3개 이상 쌓이면 예측해요"}
    slope = fc["slope_per_hour"]
    return {
        **base,
        "ready": True,
        "next_time": (latest_time + timedelta(hours=1)).astimezone(airkorea.KST).isoformat(),
        "predicted_pm25": fc["predicted"],
        "grade": airkorea.pm25_grade(fc["predicted"]),
        "slope_per_hour": slope,
        "trend": "증가" if slope > 0.5 else "감소" if slope < -0.5 else "유지",
        "based_on": len(window),
    }
