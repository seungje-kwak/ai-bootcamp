"""Railway 시작 파일

RUN_MODE=cron → 수집 작업 한 번 하고 종료 (Cron 서비스)
그 외          → 웹 서버 (Railway가 정해 주는 $PORT 로 실행)

내 컴퓨터에서는 이 파일 대신 아래처럼 실행합니다 (코드 고치면 자동 재시작):
    uvicorn main:app --reload --port 8000
"""
import os

if os.getenv("RUN_MODE", "web").strip().lower() == "cron":
    import collect_job

    collect_job.main()
else:
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
