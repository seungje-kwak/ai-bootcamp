"""한 번 수집하고 끝나는 작업 (Railway Cron 서비스용)

COLLECT_SIDOS=제주,서울,부산 처럼 여러 시도를 한 번에 수집할 수 있습니다.
Cron 작업은 끝나야 다음 회차가 돌기 때문에 마지막에 스스로 종료합니다.
"""
import os
import sys

from main import run_collect


def main():
    sidos = [s.strip() for s in os.getenv("COLLECT_SIDOS", "제주").split(",") if s.strip()]
    failed = False
    for sido in sidos:
        try:
            result = run_collect(sido)
            print(sido, "→", {k: result[k] for k in ("received", "saved", "missing")}, flush=True)
        except Exception as e:
            failed = True
            print(sido, "→ 실패:", e, file=sys.stderr, flush=True)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
