"""Supabase 연결 (열쇠는 환경변수에서만 꺼냄)

- 내 컴퓨터: .env 파일을 읽음 (python-dotenv)
- Railway  : Variables 에 넣은 값이 이미 환경변수로 들어 있음
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# 이 파일 옆의 .env 를 읽음 (어느 폴더에서 실행해도 같은 .env). Railway엔 .env가 없으니 그냥 넘어감
load_dotenv(Path(__file__).with_name(".env"))

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
