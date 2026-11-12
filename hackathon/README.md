# MyPace Jeju

The spec is [prd-mypace-jeju.md](prd-mypace-jeju.md). Field names, enums, and paths follow PRD chapters 8, 9 and 10 exactly.

```
frontend/   Next.js 14 + Tailwind (screens 1-5, illustrated map)       → Vercel (Root Directory: frontend)
backend/    FastAPI (6 endpoints, filter → LLM/rules → validate → timing) → Railway (Root Directory: backend)
data/       seed CSVs (seed/), Emma demo course (demo/emma_course.json)
```

## Run locally

```bash
# backend (http://localhost:8000)
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe scripts/build_places.py      # data/seed/*.csv → app/data/*.json
.venv/Scripts/python.exe scripts/reset_emma.py        # save the Emma demo course
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000

# frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

Emma demo: http://localhost:3000/course/e33a0000-0000-4000-8000-000000000001
Run `scripts/reset_emma.py` again before every rehearsal (13.5).

## Behavior by environment variable (backend/.env, see .env.example)

| Setting | When empty | When filled |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Local JSON store (`backend/local_db.json`) | Supabase tables |
| `LLM_API_KEY` | Rule-based planner (10.8) | LLM picks the stops. `LLM_PROVIDER=gemini` (default, model `gemini-3.1-flash-lite`, JSON schema output, temperature 0.3) or `claude` (model `claude-opus-5-5`). `LLM_MODEL` overrides the model. If it fails twice, falls back to the rule planner (`LLM_FALLBACK_RULES=false` returns 502 `LLM_FAILED` instead) |
| `REQUIRE_VERIFIED` | `false`: places with no photo or verification date are still candidates | `true`: F-1 applies (turn on before the demo) |

Frontend: `NEXT_PUBLIC_API_URL` is the only variable (`frontend/.env.local`).

## Switching to Supabase

1. Run `backend/sql/schema.sql` in the Supabase SQL editor (7 tables, RLS on).
2. Put `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env`.
3. `scripts/seed_supabase.py` (upload places, accessibility, food_options, phrase_cards), then `scripts/reset_emma.py`.

Q-05 note: PostgREST reads `order=` in a URL as the sort option, so the backend never filters `course_items` by the `"order"` column. A re-plan replaces a course's items by `course_id` and restores the old rows if the insert fails. Keep this in mind when writing new Supabase queries.

## Seed normalization (scripts/build_places.py)

- category: `history_culture`, `museum` → `culture`; `market_shopping` → `market`; `park`, `oreum_hike` → `nature`; `beach` → `photo`; `restaurant` → `food`. Yongduam Rock and Dodubong Peak are overridden to `photo`.
- terrain: free-text description → `flat` / `slope` / `steep`; closed_days: free text → `["mon".."sun"]`; price_level: free/low/mid/high → 0-3.
- **8 places outside the map bounds (7.2) are excluded** (Q-13): Jeju Museum of Art, Hamdeok Beach, Jeju 4·3 Peace Park, Jeolmul Forest, Jeju Stone Park, Roe Deer Observation Center, Cafe Delmoondo, and Chammatna Gimbap (no coordinates). Widening the range means changing `bounds`/`aspectRatio` in `frontend/config/map.ts`, `BOUNDS` in `build_places.py`, and the fallback SVG together.
