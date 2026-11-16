# MyPace Jeju

The spec is [prd-mypace-jeju.md](prd-mypace-jeju.md). Field names, enums, and paths follow PRD chapters 8, 9 and 10 exactly.

```
frontend/   Next.js 14 + Tailwind (screens 1-5, Kakao map)             → Vercel (Root Directory: hackathon/frontend)
backend/    FastAPI (6 endpoints, filter → LLM/rules → validate → timing) → Railway (Root Directory: hackathon/backend)
data/       seed CSVs (seed/), Emma demo course (demo/emma_course.json)
```

## Run locally

```bash
# backend (http://localhost:8000)
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
# first fill SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env (see "Setting up Supabase")
.venv/Scripts/python.exe scripts/build_places.py      # data/seed/*.csv → app/data/*.json
.venv/Scripts/python.exe scripts/seed_supabase.py     # upload places to Supabase
.venv/Scripts/python.exe scripts/reset_emma.py        # save the Emma demo course
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000

# frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

Emma demo: http://localhost:3000/course/e33a0000-0000-4000-8000-000000000001
Run `scripts/reset_emma.py` again to put the Emma course back to its starting state (PRD US-15).

## Behavior by environment variable (backend/.env, see .env.example)

| Setting | When empty | When filled |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | The backend does not start (required) | Supabase tables |
| `LLM_API_KEY` | Rule-based planner (10.8) | LLM picks the stops. `LLM_PROVIDER=gemini` (default, model `gemini-3.1-flash-lite`, JSON schema output, temperature 0.3) or `claude` (model `claude-opus-5-5`). `LLM_MODEL` overrides the model. If it fails twice, falls back to the rule planner (`LLM_FALLBACK_RULES=false` returns 502 `LLM_FAILED` instead) |
| `REQUIRE_VERIFIED` | `false`: places with no photo or verification date are still candidates | `true`: F-1 applies (turn on before the demo) |

Frontend (`frontend/.env.local`, and the same names in Vercel):

| Setting | When empty | When filled |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | — (required, include `https://` in Vercel) | Backend address |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | A simple test-only map is drawn instead of the Kakao map (kept for checking screens without a key; not part of the PRD) | Kakao map (PRD 7). Use the app's **JavaScript key** and register `http://localhost:3000` and the Vercel URL under Platform → Web → Site domain in Kakao Developers. If the SDK fails to load (unregistered domain, blocked script) the same test-only map is shown and the rest of the page keeps working. Vercel needs a redeploy after changing it |

## Setting up Supabase (required)

1. Run `backend/sql/schema.sql` in the Supabase SQL editor (7 tables, RLS on). It is safe to run again: on a database made before 2026-11-13 it adds the `places.open_time` and `places.close_time` columns.
2. Put `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env`.
3. `scripts/seed_supabase.py` (upload places, accessibility, food_options, phrase_cards), then `scripts/reset_emma.py`.

### Adding opening hours to an existing database (trip time, 2026-11-13)

The planner keeps a stop only when the whole stay is inside the place's `open_time`-`close_time`. Until the two columns exist and are filled, every place counts as always open. Do these in order:

1. In the Supabase SQL editor run `backend/sql/schema.sql` again, or only these lines:
   ```sql
   alter table places add column if not exists open_time  text check (open_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
   alter table places add column if not exists close_time text check (close_time ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$');
   ```
2. `scripts/build_places.py` (reads `open_time` / `close_time` from `data/seed/places.csv`; stops on a badly formed value).
3. `scripts/seed_supabase.py` (upsert; fills the new columns). Seeding before step 1 fails because the columns are missing.
4. `scripts/reset_emma.py` (the demo course now carries `start_time` and `end_time` in `user_profile`).

Deploy the backend and the frontend together: the old frontend sends `duration`, which the new backend answers with 422.

### Food options can be null, and areas come from coordinates (recommendation P0, 2026-11-15)

`food_options.solo_ok`, `vegan`, `vegetarian`, `halal`, `english_menu` are now true / false / null (null = not known). Places get their area from the Jeju boundary file, so 56 places move to another area. Do these in order:

1. In the Supabase SQL editor:
   ```sql
   alter table food_options alter column solo_ok drop not null;
   alter table food_options alter column vegan drop not null;
   alter table food_options alter column vegetarian drop not null;
   alter table food_options alter column halal drop not null;
   alter table food_options alter column english_menu drop not null;
   ```
2. Deploy the new backend.
3. `scripts/seed_supabase.py` (writes the nulls and the new `area_id`s). Seeding before step 1 fails on the `not null` constraint.

Q-05 note: PostgREST reads `order=` in a URL as the sort option, so the backend never filters `course_items` by the `"order"` column. A re-plan replaces a course's items by `course_id` and restores the old rows if the insert fails. Keep this in mind when writing new Supabase queries.

## Recommendation eval (scripts/eval_planner.py)

Builds the same courses every time (selectable areas × 20 profiles × 3 time windows = 720, Wednesday) with `planner.new_course` and prints the metrics of `tasks/prd-recommendation-p0.md` FR-3 per area. Reads `app/data/*.json` only; Supabase is not used.

```bash
# rule planner, all 720 scenarios -> backend/eval/rules.json
backend/.venv/Scripts/python.exe backend/scripts/eval_planner.py
# LLM planner, 60 scenarios at most 10 calls a minute -> backend/eval/llm-<model>.json
backend/.venv/Scripts/python.exe backend/scripts/eval_planner.py --llm --limit 60 --rpm 10
```

`--weekday mon` changes the day, `--label` / `--out` the output file. With `--llm`, `--limit` defaults to 30 and may not be over 200; the run stops (exit code 1, `aborted: true` in the JSON) on HTTP 429, a quota error, or 3 failed calls in a row. Saved results: `backend/eval/baseline-rules.json` (before P0), `backend/eval/p0-rules.json` (after).

## Seed normalization (scripts/build_places.py)

- category: `history_culture`, `museum` → `culture`; `market_shopping` → `market`; `park`, `oreum_hike` → `nature`; `beach` → `photo`; `restaurant` → `food`. Yongduam Rock and Dodubong Peak are overridden to `photo`.
- open_time / close_time: `"HH:MM"` columns in `data/seed/places.csv`, both empty = always open, `24:00` = open past midnight. They were filled from the `opening_hours` text by `data/seed/add_open_close.py` (shortest regular hours; places whose text gives no hours are left empty). The build stops on a value like `9:00` or when open is not before close.
- area_id: from the coordinates and `app/data/jeju_admin.geojson` (`areas.area_of_point`); from `address_ko` only when the point is in no boundary. The build lists the places where the two differ. The boundary file is made by `scripts/build_jeju_admin.py` (see `data/seed/README.md` for the source).
- food_options: an empty cell stays `null` (not known); it is no longer turned into `false`.
- terrain: free-text description → `flat` / `slope` / `steep`; closed_days: free text → `["mon".."sun"]`; price_level: free/low/mid/high → 0-3.
- **`BOUNDS` in `build_places.py` covers Jeju main island** (lat 33.10-33.58, lng 126.13-126.99), the range `app/data/places.json` was built with when the Jeju-wide places were added on 2026-11-13: 1,065 places are kept and only Chammatna Gimbap (no coordinates) is skipped. The map in `frontend/config/map.ts` and the test-only map image still show Jeju City only; widening them belongs to the "start area" work (`tasks/prd-start-area.md`).
