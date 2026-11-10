import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from supabase import create_client

from cart import create_router as create_cart_router

load_dotenv()

# 로컬에선 .env를 읽고, Railway에선 Variables가 이미 들어 있음
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]
FRONT_ORIGINS = [
    o.strip() for o in os.getenv("FRONT_ORIGINS", "").split(",") if o.strip()
]

sb = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

app = FastAPI(title="my-api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONT_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 장바구니 API (/products, /cart/...) 는 cart.py 에 있음
app.include_router(create_cart_router(sb))


class NoteIn(BaseModel):
    content: str = Field(min_length=1, max_length=500)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/v")
def health2():
    return {"s": 100, "t":200}


@app.get("/health/db")
def health_db():
    """Supabase 연결 확인용: notes 테이블을 1건 조회해 본다."""
    try:
        sb.table("notes").select("id").limit(1).execute()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Supabase 연결 실패: {e}")
    return {"status": "ok", "db": "connected"}


@app.get("/notes")
def list_notes():
    res = sb.table("notes").select("*").order("created_at", desc=True).execute()
    return res.data


@app.post("/notes", status_code=201)
def create_note(note: NoteIn):
    res = sb.table("notes").insert({"content": note.content.strip()}).execute()
    return res.data[0]


@app.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int):
    res = sb.table("notes").delete().eq("id", note_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="해당 메모가 없습니다.")
