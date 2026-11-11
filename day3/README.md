# day3 · 관공서 데이터 수집 서버 (제주 미세먼지)

공공데이터(에어코리아) → **FastAPI(Railway)** 에서 받기·가공·예측 → **Supabase** 에 저장 → **Vercel** 화면에 표시

```
day3/
├─ backend/              ← GitHub → Railway (서비스 이름: day3_backend)
│  ├─ airkorea.py        받기 · 가공 · 예측 (가장 오래 볼 파일)
│  ├─ main.py            API 주소: /health /collect /air/latest /air/summary /air/forecast
│  ├─ db.py              Supabase 연결 (열쇠는 환경변수에서만)
│  ├─ collect_job.py     한 번 수집하고 끝 (Cron용)
│  ├─ start.py           Railway 시작 파일 (RUN_MODE=cron 이면 수집, 아니면 웹 서버)
│  ├─ schema.sql         Supabase에 만들 테이블 2개
│  ├─ sample_response.json  키 없이 시연용 예시 응답 (DATA_MODE=sample)
│  ├─ requirements.txt · railway.json · Procfile · .python-version(3.10)
│  ├─ .env               ← day2/my-api/.env 복사 + 새 값 추가 (GitHub에 안 올라감)
│  └─ .env.example       ← .env 의 빈 양식 (GitHub에 올라감)
└─ frontend/             ← GitHub → Vercel (프로젝트 이름: day3_frontend)
   ├─ index.html         미세먼지 보드 화면
   └─ config.js          로컬이면 127.0.0.1:8000, 배포면 Railway 주소
```

---

## 1단계. 내 컴퓨터에서 실행 (day2/vjeju 재활용)

가상환경은 새로 만들지 않고 `day2/vjeju` 를 그대로 씁니다. (필요한 패키지가 이미 다 설치돼 있음)

**터미널 1: 백엔드** (127.0.0.1:8000)
```powershell
cd "D:\사용자\바탕화면\학교\대학원 2\ai 부트캠프\day3\backend"
..\..\day2\vjeju\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```
→ 브라우저에서 http://127.0.0.1:8000/health → `{"ok":true,"mode":"sample"}`
→ http://127.0.0.1:8000/docs → FastAPI 시험 화면

**터미널 2: 프론트엔드** (127.0.0.1:5000)
```powershell
cd "D:\사용자\바탕화면\학교\대학원 2\ai 부트캠프\day3\frontend"
..\..\day2\vjeju\Scripts\python.exe -m http.server 5000 --bind 127.0.0.1
```
→ http://127.0.0.1:5000

> `.env` 의 `FRONT_ORIGINS=http://127.0.0.1:5000,http://localhost:5000` 이 "이 화면 주소는 API를 불러도 된다"는 출입 명단입니다.
> VS Code Live Server(5500번)로 열면 CORS 오류가 나니 5000번으로 여세요.

### .env 구성 (backend/.env)
| 변수 | 값 | 비고 |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | day2/my-api/.env 에서 복사 | 같은 Supabase 프로젝트 사용 |
| `PUBLIC_DATA_KEY` | (비어 있음) | 공공데이터 키 승인되면 **Decoding 키** 입력 |
| `ADMIN_TOKEN` | 무작위 문자열로 생성해 둠 | /collect 실행 비밀번호 |
| `FRONT_ORIGINS` | `http://127.0.0.1:5000,http://localhost:5000` | Railway에서는 **Vercel 주소** |
| `DATA_MODE` | `sample` | 키 받기 전 예시 데이터로 연습. 줄을 지우면 진짜 API |

---

## 2단계. Supabase 테이블 만들기 (필수, 한 번만)

1. Supabase → day2에서 쓰던 프로젝트 → 왼쪽 **SQL Editor** → **New query**
2. `backend/schema.sql` 내용 전체 붙여넣기 → **Run**
3. **Table Editor**에 `air_measurements`, `air_summary` 가 생겼는지 확인 (RLS Enabled)

그다음 http://127.0.0.1:8000/docs → **POST /collect** → Try it out → `x-admin-token` 칸에 `.env` 의 `ADMIN_TOKEN` 값 → Execute
→ `{"received": 6, "saved": 6, "missing": 2, ...}` 가 나오고 5000번 화면에 표가 채워지면 성공.
(5000번 화면 아래 "관리자: 지금 수집하기"에 토큰을 넣어도 같습니다.)

---

## 3단계. 공공데이터포털 인증키 발급

1. https://www.data.go.kr 회원가입·로그인 → 검색창에 **에어코리아 대기오염정보**
2. **한국환경공단_에어코리아_대기오염정보** (오픈 API) → **활용신청** (활용 목적: 교육 실습)
3. **마이페이지 → 데이터활용 → Open API → 활용신청 현황**에서 승인 확인
4. **일반 인증키(Decoding)** 복사 → `backend/.env` 의 `PUBLIC_DATA_KEY=` 뒤에 붙여넣기
5. `DATA_MODE=sample` 줄 삭제 → 서버 재시작 → `/health` 가 `"mode":"api"` 인지 확인 → 다시 `/collect`

> ① **Encoding 키 말고 Decoding 키.** 코드가 키를 자동으로 인코딩하므로 Encoding 키를 넣으면 두 번 인코딩되어 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` 가 납니다.
> ② 신청 직후에는 키가 바로 안 될 수 있습니다(반영까지 시간 걸림). 그동안은 `DATA_MODE=sample` 로 진행.

사용 API: 시도별 실시간 측정정보 조회 `getCtprvnRltmMesureDnsty` (sidoName=제주)

---

## 4단계. GitHub → Railway (backend, 서비스 이름 day3_backend)

Railway 체험 크레딧은 **$5 / 30일**입니다. 크레딧을 아끼려고 **day2의 기존 서비스(my-api)는 삭제하고** 새로 만듭니다.

1. (VS Code) day3 변경사항을 커밋하고 GitHub(`ai-bootcamp` 저장소)에 push
   - `backend/.env` 는 `.gitignore` 에 있어서 올라가지 않습니다. push 전에 GitHub에 `.env` 가 없는지 꼭 확인!
2. Railway → 기존 프로젝트의 my-api 서비스 → **Settings → Danger → Delete Service** (선택이지만 권장)
3. Railway → **New Project → Deploy from GitHub repo** → `ai-bootcamp` 선택
4. 서비스 **Settings**
   - 서비스 이름: `day3_backend`
   - **Root Directory**: `/day3/backend`  ← 저장소 안의 하위 폴더라서 꼭 지정
   - **Custom Start Command**: `python start.py` (또는 Config-as-code 경로를 `/day3/backend/railway.json` 으로)
5. **Variables → Raw Editor** 에 붙여넣기 (값은 backend/.env 에서 복사)
   ```
   SUPABASE_URL=...
   SUPABASE_SECRET_KEY=...
   PUBLIC_DATA_KEY=
   ADMIN_TOKEN=...
   FRONT_ORIGINS=https://(5단계에서 받은 Vercel 주소)
   DATA_MODE=sample
   ```
   처음 배포가 `KeyError: 'SUPABASE_URL'` 로 실패해도 정상입니다. Variables 저장 후 **Deploy**.
6. **Settings → Networking → Generate Domain** → `https://day3backend-production-xxxx.up.railway.app` 같은 주소
7. `주소/health` → `{"ok":true,"mode":"sample"}` 이면 성공

> Railway는 내 vjeju를 쓰지 않습니다. `requirements.txt` 를 읽어 Linux 서버에 패키지를 새로 설치하고, `.python-version` 을 보고 Python 3.10을 씁니다.

---

## 5단계. GitHub → Vercel (frontend, 프로젝트 이름 day3_frontend)

1. `frontend/config.js` 의 `RAILWAY_API_URL` 을 4단계 6번 주소로 바꾸기 (끝에 `/` 없이) → 커밋·push
2. Vercel → **Add New → Project** → `ai-bootcamp` 저장소 Import
   - Project Name: `day3_frontend`
   - **Root Directory**: `day3/frontend`
   - Framework Preset: **Other** (빌드 명령 없음, 정적 HTML)
3. Deploy → `https://day3-frontend-xxxx.vercel.app` 같은 주소 확인
4. Railway `day3_backend` Variables 의 `FRONT_ORIGINS` 에 이 Vercel 주소를 넣고 저장 → 재배포
   (`https://` 포함, 끝 `/` 없이. 로컬도 계속 쓰려면 쉼표로 `http://127.0.0.1:5000` 추가)

---

## 6단계 (선택). 매시간 자동 수집 (Railway Cron)

같은 Railway 프로젝트 → **+ New → GitHub Repo** → 같은 저장소 → 서비스 하나 더
- Root Directory `/day3/backend`, Start Command `python start.py`
- Variables: 웹 서비스와 같은 값 + `RUN_MODE=cron` (+ 여러 지역은 `COLLECT_SIDOS=제주,서울,부산`)
- Settings → **Cron Schedule** `10 * * * *` (매시 10분, UTC 기준) · 공개 주소는 만들 필요 없음

크레딧($5)을 쓰므로 수업 후에는 꺼 두는 것을 권장합니다.

---

## 자주 나는 오류

| 증상 | 원인 → 해결 |
|---|---|
| 화면에 "Could not find the table …" | 2단계 schema.sql 실행 안 함 |
| 화면에 "API 연결 실패" | 백엔드 꺼짐, 또는 `FRONT_ORIGINS` 에 화면 주소 없음 |
| `/collect` → 401 | `x-admin-token` 이 `ADMIN_TOKEN` 과 다름 |
| `/collect` → 502 "JSON이 아님" | Encoding 키 사용 또는 승인 전 → Decoding 키, 기다리기, 그동안 `DATA_MODE=sample` |
| Railway 빌드 실패 · 모듈 없음 | Root Directory 를 `/day3/backend` 로 안 함 |
| Railway 주소 502 | Generate Domain 포트를 비우거나 로그의 포트 숫자와 맞추기 |
| `/air/forecast` 가 계속 "3시간 이상…" | 요약 기록 3개 미만. sample 모드는 시간이 같아서 1개만 쌓임 → 진짜 API + Cron 으로 몇 시간 쌓이면 나옴 |
