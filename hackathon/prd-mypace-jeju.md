# PRD: MyPace Jeju (가칭)

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.1 초안 |
| 작성일 | 2026-11-12 |
| 용도 | 팀원 3명(A 프론트, B 백엔드, C 데이터·기획)이 각자 AI 코딩 도구에 넣고 개발하는 공통 기준 문서 |
| 둘 곳 | 모노레포의 `tasks/prd-mypace-jeju.md`. 세 사람이 같은 파일을 본다 |

## 이 문서를 읽는 법

1. **표기가 곧 계약이다.** 필드명, enum 값, URL 경로, JSON 구조는 이 문서 표기를 그대로 쓴다. 바꿔야 하면 코드보다 이 문서(8·9·10장)를 먼저 고치고 팀에 알린다.
2. **[제안] 표시.** 팀이 정해 둔 내용에는 없지만, 화면·데이터·API가 어긋나지 않으려면 값이 하나로 정해져야 해서 이 문서가 채운 부분이다. 결정이 필요한 것은 15장에 질문으로 모았다. 답이 나오기 전까지는 제안값대로 개발하고, 답이 달라지면 문서를 고친다.
3. **예시 값은 형식만 본다.** 9·10장 JSON의 장소 이름, 좌표, 주소, 문구는 형식을 보여주는 임의 값이다. 시드 데이터 파일이 이 문서를 쓸 때 전달되지 않아 실제 값과 맞춰 보지 못했다(Q-04). 식당·카페 예시는 실제 가게에 대한 틀린 정보가 되지 않도록 가상의 이름을 썼다.
4. **AI 코딩 도구에 넣을 때.** 문서 전체를 넣고 스토리 번호와 절 번호로 지시한다. 예: "나는 A(프론트)다. US-04를 7장대로 구현해 줘."

## 목차

1. 개요와 목표
2. 타깃 사용자와 문제
3. 차별점
4. 범위
5. 사용자 스토리
6. 화면별 요구사항
7. 일러스트 지도 상세 명세
8. 데이터 모델
9. API 명세
10. LLM 프롬프트 설계와 출력 JSON 스키마
11. 비기능 요구사항
12. 역할 분담과 이틀 일정
13. 데모 시나리오
14. 리스크와 대응
15. 미정 사항

---

## 1. 개요와 목표

### 1.1 제품 개요

| 항목 | 내용 |
|---|---|
| 이름 | MyPace Jeju (가칭) |
| 한 줄 소개 | 취향과 몸 상태를 입력하면 제주시 하루 코스를 실제 장소 사진과 함께 짜주고, 여행 중에도 상황에 맞춰 다시 짜주는, 혼자 온 외국인 여행자를 위한 맞춤 가이드투어 서비스 |
| 타깃 | 제주시를 혼자 여행하는 외국인. 한국어를 못 한다 |
| UI 언어 | 영어 |
| 발표 메시지 | "ChatGPT가 주는 건 계획표, 저희가 주는 건 여행 내내 같이 다니는 가이드입니다." |

### 1.2 개발 상황

- AI 부트캠프 해커톤. 3명이 이틀 동안 AI 코딩 도구(바이브 코딩)로 개발한다.
- 이 문서는 세 사람이 각자 AI 코딩 도구에 넣는 공통 기준이다. 화면, 데이터, API가 어긋나지 않게 하는 것이 이 문서의 목적이다.

### 1.3 기술 구성

| 구분 | 내용 |
|---|---|
| 프론트 | Next.js + Tailwind, Vercel 배포 |
| 백엔드 | FastAPI, Railway 배포 |
| DB·스토리지 | Supabase (Postgres + Storage의 `place-images` 버킷) |
| LLM | LLM API. 코스 생성과 재구성에 쓰고, 백엔드에서만 호출한다 |
| 저장소 | GitHub 모노레포 `frontend/`, `backend/`, `data/`. push하면 Vercel과 Railway가 자동 배포한다 |
| 호출 경로 | 프론트는 FastAPI만 호출한다. Supabase와 LLM은 백엔드만 호출한다 |

### 1.4 목표

| # | 목표 | 달성했는지 보는 기준 |
|---|---|---|
| G1 | Day 1 저녁까지 온보딩 → 코스 생성 → 결과 화면이 배포 환경에서 끝까지 동작한다 | 배포된 Vercel 주소에서 온보딩을 마치면 DB의 실제 장소로 만든 코스가 결과 화면에 나온다 |
| G2 | 발표에서 Emma 시나리오(13장) 4단계를 배포 환경에서 시연한다 | 리허설에서 처음부터 끝까지 2번 연속 성공 [제안] |
| G3 | 차별점 3가지를 말이 아니라 화면으로 보여준다 | 3장 표의 "화면에서 보이는 곳"이 모두 동작한다 |
| G4 | 프론트·백엔드·데이터가 이 문서만 보고 연결된다 | 실제 요청·응답의 필드명과 구조가 9장과 같다 |

---

## 2. 타깃 사용자와 문제

### 2.1 타깃 사용자

- 제주시를 혼자 여행하는 외국인. 한국어를 못 한다. 그래서 화면은 전부 영어다.
- 대표 사용자(데모 페르소나): Emma, 34세, 독일인, 혼자 여행 중. 비건이고 사진을 좋아한다. 제주시에서 하루를 보낸다.

### 2.2 풀려는 문제

| 문제 | 여행자가 겪는 일 | 답하는 차별점 |
|---|---|---|
| AI가 짜준 계획을 믿기 어렵다 | 계획표의 장소와 사진이 실제와 같은지 여행자가 확인할 방법이 없다 | 차별점 1 |
| 계획은 여행 중에 깨진다 | 피곤하거나, 비가 오거나, 배가 고프거나, 가 보니 문이 닫혀 있으면 계획표만으로는 다음에 어디로 갈지 알 수 없다 | 차별점 2 |
| 혼자 온 외국인이라 생기는 불편이 있다 | 1인분 주문이 되는지, 영어 메뉴가 있는지, 비건·할랄이 되는지 모른다. 택시 기사에게 목적지를 전하기 어렵고, 현장에서 쓸 한국어 문장을 모른다 | 차별점 3 |

### 2.3 입력값으로 다루는 것

취향과 몸 상태(체력, 걷기 가능 시간, 오르막 피하기 등)는 코스 생성의 입력값이다. 차별점으로 내세우지 않는다.

---

## 3. 차별점

차별점은 아래 3가지뿐이다. 화면 문구와 발표에서 이 3가지 외의 것을 차별점으로 내세우지 않는다.

### 3.1 실제로 존재하는 장소와 사진만 보여준다

| 약속 | 구현으로 지키는 방법 | 화면에서 보이는 곳 | 스토리 |
|---|---|---|---|
| AI는 DB에 있는 장소 ID 중에서만 고른다 | LLM에는 DB에서 뽑은 후보만 주고 장소 ID만 받는다. 백엔드가 응답의 ID를 DB와 대조해 없는 ID는 버린다 (10.5) | 코스의 모든 장소가 DB 장소다 | US-02 |
| 모든 장소에 실제 사진, 사진 출처, 마지막 확인일을 표시한다 | `image_url`, `image_source`, `last_verified_at`를 카드에 표시한다. AI 생성 이미지는 쓰지 않는다 | 타임라인 카드, 지도 하단 카드 | US-05 |
| "문 닫았어요" 신고 기록을 남겨 데이터가 계속 검증되게 한다 | 신고를 `place_reports`에 저장한다 | 여행 모드의 "It's closed" 버튼 | US-10 |

### 3.2 여행 중에 다시 짜준다

버튼을 누르면 남은 일정만 다시 만든다. 이미 지나간 일정은 건드리지 않는다.

| 버튼 | 영어 라벨 [제안] | `reason` 값 [제안] | 다시 짤 때 바뀌는 것 | 스토리 |
|---|---|---|---|---|
| 비가 와요 | It's raining | `rain` | 실내 장소만 | US-09 |
| 문 닫았어요 | It's closed | `closed` | 해당 장소를 대체 장소로 교체 + 신고 저장 | US-10 |
| 배고파요 | I'm hungry | `hungry` | 근처 식당 삽입 | US-16 |
| 피곤해요 | I'm tired | `tired` | 걷기 강도 낮은 곳 | US-17 |

조건별 처리 규칙은 10.7에 있다.

### 3.3 혼자 온 외국인의 실제 불편을 안다

| 약속 | 구현으로 지키는 방법 | 화면에서 보이는 곳 | 스토리 |
|---|---|---|---|
| 1인분 주문 가능, 영어 메뉴 여부, 비건/할랄 표시 | `food_options`의 값을 배지로 표시한다 | 식당 카드 | US-06 |
| 택시 기사님께 보여주는 한글 이름·주소 카드 | `name_ko`, `address_ko`를 큰 글자로 보여준다 | 장소 카드의 "Show to driver" 버튼 | US-07 |
| 장소별 현지 문장 카드 (예: 시장에서 "이거 얼마예요?") | `phrase_cards`를 장소 카드에 보여준다 | 장소 카드 (프리미엄) | US-18 |

---

## 4. 범위

### 4.1 MVP에 포함 (P0)

이틀 안에 3명이 만들 범위다. 데모 시나리오(13장)에 필요한 것만 넣었다.

| 영역 | 포함하는 것 |
|---|---|
| 화면 | 랜딩, 온보딩 5단계, 결과 페이지, 여행 모드, 구매 |
| 코스 생성 | 필터링 → LLM → 검증 → 이동 시간 계산 → 저장 (10장) |
| 지도 | 일러스트(준비 전에는 대체 SVG) 위 마커, 방문 순서 번호, 점선 동선, 설정 파일 하나 |
| 신뢰 표시 | 장소마다 실제 사진, 사진 출처, 마지막 확인일 |
| 재구성 | 비가 와요, 문 닫았어요(+ 신고 저장) |
| 혼자 여행 편의 | 식당 배지(1인분·식단·영어 메뉴), Show to driver 카드 |
| 수익 모델 | 무료는 3곳까지 미리보기, 구매 목업으로 프리미엄 전환 |
| API | 엔드포인트 6개 (9장) |
| 데이터 | 시드 20곳 보강, 식당·카페 5곳 이상 추가, Emma 데모 코스 사전 저장 |
| 배포 | Vercel, Railway, Supabase 연결과 자동 배포 |

### 4.2 시간이 남으면 (P1)

P0가 배포 환경에서 끝난 뒤, 아래 순서대로 한다.

| 순서 | 기능 | 메모 |
|---|---|---|
| 1 | 재구성: 배고파요 | 재구성 4종은 같은 파이프라인을 쓴다. 조건표(10.7)에 한 줄씩 더하면 된다 |
| 2 | 재구성: 피곤해요 | 위와 같음 |
| 3 | 문장 카드 | 프리미엄 전용. 무료에서는 잠금 표시 |
| 4 | 지도 마커를 누르면 하단 카드 | 7.7 |
| 5 | 일러스트 지도 적용 | 그림이 준비되면 설정 파일의 이미지 경로만 바꾼다 |
| 6 | 재구성 뒤 바뀐 일정에 "New" 표시 | 프론트에서 이전 목록과 비교한다 |
| 7 | LLM 실패 시 규칙 기반 코스로 대체 [제안] | 10.8 |
| 8 | 여행 모드에도 지도 표시 | 결과 페이지의 지도 컴포넌트를 그대로 쓴다 |

배고파요와 피곤해요를 P1에 둔 이유: 데모는 비가 와요와 문 닫았어요만 쓴다. 두 버튼이 기능 동결 시점에 동작하지 않으면 화면에서 숨긴다. 동작하지 않는 버튼을 발표 화면에 남기지 않는다.

### 4.3 나중에 (P2)

| 기능 | 메모 |
|---|---|
| 오프라인 PDF | 프리미엄 혜택. 구매 화면에는 "Coming soon"으로 적는다 (Q-21) |
| 무료의 재구성 횟수 제한 | 프리미엄이 "무제한 재구성"이므로 무료에는 제한이 있어야 하지만 횟수가 정해지지 않았다 (Q-20) |
| 재구성 없이 신고만 하는 화면 | 엔드포인트(`POST /places/{id}/report`)는 P0로 만든다 |
| `opening_hours`, `price_level`, `allergens` 표시 | 데이터가 채워지고 형식이 정해진 뒤 (Q-14) |
| 코스 시작 시각 고르기 | MVP는 기본값 사용 (Q-06) |
| 새로고침해도 여행 모드의 진행 위치 유지 | MVP는 재구성할 때만 서버에 반영한다 (Q-11) |

### 4.4 제외 (이번 해커톤에서 만들지 않는다)

팀이 정해 둔 제외:

- 실제 결제 연동. 결제는 목업만 만든다.
- 실제 지도 API(카카오맵, 구글맵, Leaflet).
- 확장 수익 모델(로컬 가이드·택시투어 예약 수수료, 숙소 B2B). 발표 자료에만 넣는다.
- AI 생성 이미지.

정해 둔 범위에 없어서 제외로 정리한 것 [제안]:

- 회원 가입과 로그인. 테이블에 사용자 정보가 없다. 코스는 `courses.id`로만 구분한다.
- 버스 이동 안내. `move_method`의 `bus` 값은 남겨 두지만 MVP는 `walk`와 `taxi`만 만든다. 코스 생성 로직이 도보와 택시 시간만 추정하기 때문이다.
- 날씨 자동 감지. 비는 "비가 와요" 버튼으로만 반영한다.
- 지도 범위(7.2) 밖의 장소, 이틀 이상의 일정.
- 영어 외의 화면 언어.
- 신고를 관리하는 관리자 화면.

---

## 5. 사용자 스토리

### 5.1 한눈에 보기

| ID | 역할 | 스토리 | 우선순위 | 담당 |
|---|---|---|---|---|
| US-01 | 여행자 | 온보딩 5단계로 취향과 몸 상태를 입력한다 | P0 | A |
| US-02 | 여행자 | 실제 장소만으로 짠 코스를 받는다 | P0 | B |
| US-03 | 여행자 | 코스를 시간순 타임라인으로 본다 | P0 | A |
| US-04 | 여행자 | 일러스트 지도에서 동선을 본다 | P0 | A |
| US-05 | 여행자 | 장소마다 실제 사진, 출처, 확인일을 본다 | P0 | A, C |
| US-06 | 여행자 | 식당의 1인분·식단·영어 메뉴 배지를 본다 | P0 | A, C |
| US-07 | 여행자 | 택시 기사에게 Show to driver 카드를 보여준다 | P0 | A |
| US-08 | 여행자 | 여행 모드에서 현재 일정을 본다 | P0 | A |
| US-09 | 여행자 | 비가 오면 남은 일정을 실내 코스로 바꾼다 | P0 | B, A |
| US-10 | 여행자 | 문이 닫혀 있으면 대체 장소를 받고 신고를 남긴다 | P0 | B, A |
| US-11 | 여행자 | 무료로 3곳까지 미리 본다 | P0 | B, A |
| US-12 | 여행자 | 프리미엄 구매(목업)로 전체 코스를 연다 | P0 | A, B |
| US-13 | 팀 | 배포와 연결을 먼저 끝낸다 | P0 | A, B, C |
| US-14 | 데이터 담당 | 시드와 데모 데이터를 준비한다 | P0 | C |
| US-15 | 발표자 | Emma 코스를 미리 저장하고 초기화한다 | P0 | C, B |
| US-16 | 여행자 | 배가 고프면 근처 식당을 일정에 넣는다 | P1 | B, A |
| US-17 | 여행자 | 피곤하면 걷기 강도가 낮은 곳으로 바꾼다 | P1 | B, A |
| US-18 | 여행자 | 장소별 현지 문장 카드를 본다 | P1 | A, C |
| US-19 | 여행자 | 지도 마커를 눌러 장소 정보를 본다 | P1 | A |
| US-20 | 발표자 | 대체 SVG를 일러스트로 바꾼다 | P1 | A |
| US-21 | 여행자 | 재구성 뒤 무엇이 바뀌었는지 본다 | P1 | A |
| US-22 | 여행자 | LLM이 실패해도 코스를 받는다 | P1 | B |
| US-23 | 여행자 | 여행 모드에서도 지도를 본다 | P1 | A |
| US-24 | 여행자 | 코스를 오프라인 PDF로 받는다 | P2 | 미정 |
| US-25 | 사업 | 무료의 재구성 횟수를 제한한다 | P2 | 미정 |
| US-26 | 여행자 | 재구성 없이 폐업 신고만 남긴다 | P2 | 미정 |
| US-27 | 여행자 | 새로고침해도 여행 모드의 진행 위치가 남는다 | P2 | 미정 |

### 5.2 모든 P0 스토리의 공통 완료 기준

- [ ] 로컬이 아니라 배포 환경(Vercel 주소 + Railway 주소)에서 확인했다
- [ ] 빌드와 린트 오류가 없다
- [ ] 화면이 있는 스토리는 브라우저에서 직접 눌러 확인했다 (AI 코딩 도구에 `dev-browser` 같은 브라우저 검증 기능이 있으면 그것으로 확인한다)
- [ ] 요청과 응답의 필드명이 9장과 같다

### 5.3 P0 스토리와 완료 기준

#### US-01 온보딩 5단계로 취향과 몸 상태를 입력한다 (A)

혼자 여행하는 외국인으로서, 카드를 고르는 것만으로 취향과 몸 상태를 알려주고 싶다. 그래야 글을 쓰지 않고도 나에게 맞는 코스를 받을 수 있다.

- [ ] `/onboarding`에 5단계가 6.2의 순서, 선택지, 값으로 나온다
- [ ] 선택하지 않은 단계에서는 Next가 눌리지 않고, Back으로 돌아가면 이전 선택이 남아 있다
- [ ] 마지막 단계에서 "Create my day"를 누르면 9.5 형식의 `POST /courses` 요청이 한 번만 나간다 (연속으로 눌러도 한 번)
- [ ] 응답을 기다리는 동안 로딩 화면이 보인다
- [ ] 성공하면 `/course/{id}`로 이동한다. 실패하면 오류 문구와 "Try again"이 보이고 선택값이 남아 있다

#### US-02 실제 장소만으로 짠 코스를 받는다 (B)

혼자 여행하는 외국인으로서, DB에 실제로 있는 장소만으로 짠 코스를 받고 싶다. 그래야 없는 곳을 찾아 헤매지 않는다.

- [ ] `POST /courses`가 9.5의 요청을 받아 201과 `Course`(9.3)를 돌려준다
- [ ] 응답의 모든 `place_id`가 `places`에 있다. LLM이 후보에 없는 ID를 돌려주는 경우를 테스트로 만들어 그 항목이 빠지는 것을 확인했다
- [ ] `diet`가 `vegan`이면 `food_options`가 있는 장소는 `vegan = true`인 곳만 들어간다
- [ ] `start_time`, `move_method`, `move_min`은 LLM이 아니라 백엔드가 10.6 규칙으로 계산한다
- [ ] `courses` 1행과 `course_items` N행이 저장되고, `GET /courses/{id}`가 같은 내용을 돌려준다
- [ ] LLM 응답이 형식에 맞지 않으면 1번 다시 시도하고, 그래도 실패하면 502 `LLM_FAILED`를 돌려준다. 이때 DB에 반쪽짜리 코스가 남지 않는다

#### US-03 코스를 시간순 타임라인으로 본다 (A)

혼자 여행하는 외국인으로서, 오늘 갈 곳을 시간 순서대로 보고 싶다. 그래야 언제 어디에 얼마나 머무는지 한 번에 안다.

- [ ] `/course/{id}`에 `items`가 `order` 순서대로 카드로 나온다
- [ ] 카드마다 사진, `name_en`, `start_time`, 체류 시간(`stay_min`), 추천 이유(`reason_en`)가 보인다
- [ ] 두 번째 카드부터 카드 위에 이동 방법과 시간이 보인다 (`walk`면 "8 min walk", `taxi`면 "12 min by taxi")
- [ ] 불러오는 동안 스켈레톤이 보이고, 없는 코스(404)면 안내 문구와 "Plan a new day" 버튼이 보인다

#### US-04 일러스트 지도에서 동선을 본다 (A)

혼자 여행하는 외국인으로서, 오늘 갈 곳이 서로 어디쯤인지 그림 지도로 보고 싶다. 그래야 동선을 한눈에 이해한다.

- [ ] 배경 이미지 경로와 위도·경도 범위는 `frontend/config/map.ts` 한 파일에만 있다. 다른 파일에 숫자가 흩어져 있지 않다
- [ ] 7.3의 검증 좌표가 표의 x/y 위치에 찍힌다
- [ ] 코스의 장소마다 카테고리 아이콘 마커와 방문 순서 번호가 보이고, 마커가 `order` 순서대로 점선으로 이어진다
- [ ] 화면 폭을 바꿔도 마커와 점선이 배경에서 밀리지 않는다
- [ ] 일러스트가 없어도 대체 SVG(7.8)로 동작한다

#### US-05 장소마다 실제 사진, 출처, 확인일을 본다 (A, C)

혼자 여행하는 외국인으로서, 사진이 진짜인지와 정보를 언제 확인했는지 보고 싶다. 그래야 이 코스를 믿고 움직인다.

- [ ] 모든 장소 카드에 사진과 함께 "Photo: {image_source}"와 "Verified {last_verified_at}"가 보인다
- [ ] `image_url`이 없거나 불러오지 못하면 카테고리 아이콘이 있는 자리 표시 화면이 나온다. 다른 사진이나 AI 생성 이미지로 대신하지 않는다
- [ ] (C) `image_url`은 모두 `place-images` 버킷에 올린 실제 사진이고, `image_source`가 채워져 있다
- [ ] (C) 데모 코스에 나오는 모든 장소에 `image_url`, `image_source`, `last_verified_at`가 있다

#### US-06 식당의 1인분·식단·영어 메뉴 배지를 본다 (A, C)

혼자 온 외국인으로서, 식당에 들어가기 전에 혼자 주문할 수 있는지와 내가 먹을 수 있는 메뉴가 있는지 알고 싶다. 그래야 문 앞에서 돌아서지 않는다.

- [ ] `place.food_options`가 있는 카드에 값이 `true`인 항목만 배지로 나온다: Solo OK, Vegan, Vegetarian, Halal, English menu
- [ ] `signature_menu_en`이 있으면 카드에 보인다
- [ ] `food_options`가 `null`인 장소에는 배지 영역이 없다
- [ ] (C) `food_options`가 있는 장소가 5곳 이상이고 모두 `solo_ok = true`다

#### US-07 택시 기사에게 Show to driver 카드를 보여준다 (A)

한국어를 못 하는 여행자로서, 택시 기사에게 목적지의 한글 이름과 주소를 화면으로 보여주고 싶다. 그래야 말이 통하지 않아도 도착한다.

- [ ] 모든 장소 카드에 "Show to driver" 버튼이 있다
- [ ] 누르면 화면 전체에 `name_ko`와 `address_ko`가 큰 한글로 보인다 (6.3의 구성)
- [ ] 닫으면 원래 화면의 같은 위치로 돌아온다

#### US-08 여행 모드에서 현재 일정을 본다 (A)

여행 중인 사람으로서, 지금 있는 곳과 다음에 갈 곳만 크게 보고 싶다. 그래야 걸으면서도 한 손으로 확인한다.

- [ ] `/course/{id}/trip`에서 `status`가 `current`인 항목이 가장 크게 보이고, `done`은 흐리게, `upcoming`은 아래 목록으로 보인다
- [ ] "Done, next stop"을 누르면 다음 항목이 현재 일정이 된다
- [ ] 재구성 버튼이 화면 아래에 고정되어 있다 (P0는 It's raining, It's closed)
- [ ] 마지막 항목까지 끝내면 완료 화면이 보인다

#### US-09 비가 오면 남은 일정을 실내 코스로 바꾼다 (B, A)

여행 중인 사람으로서, 비가 오면 버튼 하나로 남은 일정을 실내 장소로 바꾸고 싶다. 그래야 계획을 처음부터 다시 짜지 않는다.

- [ ] `POST /courses/{id}/replan`에 `{"reason":"rain","current_order":n}`을 보내면 n번 항목까지는 그대로이고 그 뒤 항목만 바뀐 `Course`가 돌아온다
- [ ] 새로 들어온 항목의 장소는 모두 `accessibility.indoor = true`다
- [ ] 이미 지나간 장소(n번까지)가 다시 나오지 않는다
- [ ] 새 항목의 `start_time`은 n번 항목이 끝나는 시각 뒤로 이어진다
- [ ] 실패하면 DB의 기존 일정이 그대로 남는다
- [ ] (A) 버튼을 누르면 로딩이 보이고, 성공하면 목록과 지도가 바뀌며 안내 문구가 보인다. 실패하면 기존 일정이 그대로라는 문구와 Retry가 보인다

#### US-10 문이 닫혀 있으면 대체 장소를 받고 신고를 남긴다 (B, A)

여행 중인 사람으로서, 도착한 곳이 닫혀 있으면 바로 다른 곳을 받고 싶다. 내 신고가 남아서 다음 여행자가 같은 일을 겪지 않으면 좋겠다.

- [ ] `{"reason":"closed","current_order":n}`을 보내면 n번 항목의 장소가 다른 장소로 바뀌고, 그 항목의 `status`가 `current`다
- [ ] `place_reports`에 닫힌 장소의 `place_id`와 `type = "closed"`로 1행이 생긴다
- [ ] 닫힌 장소는 이 코스에 다시 나오지 않는다
- [ ] 앞서 "비가 와요"를 누른 코스라면 대체 장소도 `indoor = true`다
- [ ] (A) 누르면 확인 창이 먼저 뜨고, 성공하면 신고가 기록됐다는 안내가 보인다
- [ ] `POST /places/{id}/report`를 따로 호출해도 201과 함께 1행이 생긴다

#### US-11 무료로 3곳까지 미리 본다 (B, A)

처음 온 사용자로서, 결제하기 전에 코스의 앞부분을 보고 싶다. 그래야 돈을 낼 만한지 판단한다.

- [ ] `tier`가 `free`인 코스는 `Course`를 돌려주는 모든 엔드포인트에서 `items`가 `order`가 작은 3개뿐이다
- [ ] `total_items`는 전체 항목 수, `locked_count`는 가려진 항목 수다
- [ ] 가려진 항목의 장소 정보는 응답 어디에도 없다
- [ ] (A) 세 번째 카드 아래에 잠금 카드가 보이고, 누르면 구매 화면으로 간다
- [ ] (A) 지도에는 돌려받은 3곳만 번호와 점선으로 나온다

#### US-12 프리미엄 구매(목업)로 전체 코스를 연다 (A, B)

미리보기를 본 사용자로서, 결제해서 전체 코스를 열고 싶다. 그래야 하루 일정을 끝까지 쓴다.

- [ ] `/course/{id}/purchase`에 Free와 Premium 요금제가 6.5의 문구로 나온다
- [ ] "Pay now"를 누르면 `POST /purchase`가 호출되고 `courses.tier`가 `premium`으로 바뀐다
- [ ] 응답과 그 뒤의 `GET /courses/{id}`에 전체 항목이 들어 있고 `locked_count`가 0이다. 새로고침해도 그대로다
- [ ] 결제 정보(카드 번호 등)를 넣는 칸이 없고, 실제 결제가 아니라는 문구가 보인다
- [ ] 이미 `premium`인 코스에 다시 호출해도 200이다

#### US-13 배포와 연결을 먼저 끝낸다 (A, B, C)

팀으로서, 기능을 만들기 전에 빈 프로젝트를 배포하고 프론트 → 백엔드 → Supabase 연결을 확인하고 싶다. 그래야 마지막 날 배포 문제로 시간을 잃지 않는다.

- [ ] Vercel 주소에서 프론트가 열리고, Railway 주소에서 `GET /places`가 200을 돌려준다
- [ ] 배포된 프론트가 배포된 백엔드의 `GET /places`를 불러 Supabase에 있는 장소 수를 화면에 보여준다 (CORS 통과)
- [ ] main에 push하면 Vercel과 Railway가 자동으로 다시 배포한다
- [ ] Vercel의 환경 변수는 `NEXT_PUBLIC_API_URL` 하나뿐이고, 저장소에 키가 커밋되어 있지 않다

#### US-14 시드와 데모 데이터를 준비한다 (C)

데이터 담당으로서, 코스 생성과 데모에 필요한 데이터를 테이블에 채우고 싶다. 그래야 프론트와 백엔드가 실제 데이터로 개발한다.

- [ ] 8장의 테이블 7개가 Supabase에 있고, 시드 20곳이 `places`와 `place_accessibility`에 들어 있다
- [ ] 1인 주문이 가능한 식당·카페를 5곳 이상 추가했다. 각각 `places`, `place_accessibility`, `food_options` 세 테이블에 모두 행이 있다
- [ ] 모든 장소의 좌표가 지도 범위(7.2) 안에 있다
- [ ] 13.4의 데모 데이터 조건을 모두 만족한다
- [ ] AI 생성 이미지가 한 장도 없다

#### US-15 Emma 코스를 미리 저장하고 초기화한다 (C, B)

발표자로서, LLM이 느려도 Emma 코스를 바로 열고 싶다. 그래야 발표가 멈추지 않는다.

- [ ] 미리 저장한 Emma 코스가 정해진 ID로 DB에 있고, `/course/{그 ID}`가 LLM 호출 없이 열린다
- [ ] 초기화 스크립트를 한 번 실행하면 Emma 코스가 처음 상태(`tier`, 항목, `status`, `user_profile`)로 돌아간다
- [ ] 리허설에서 13.2의 4단계를 처음부터 끝까지 2번 연속 성공했다

### 5.4 P1, P2 스토리

완료 기준은 착수할 때 붙인다. 규칙은 아래 절을 따른다.

| ID | 내용 | 따르는 절 |
|---|---|---|
| US-16 | "I'm hungry"를 누르면 지금 위치에서 가장 가까운 식당이 다음 일정으로 들어간다 | 10.7 |
| US-17 | "I'm tired"를 누르면 남은 일정이 걷기 강도가 낮은 곳으로 바뀐다 | 10.7 |
| US-18 | 프리미엄 코스의 장소 카드에 문장 카드가 보인다. 무료에서는 잠금 줄이 보인다 | 6.3, 9.3 |
| US-19 | 지도 마커를 누르면 하단 카드에 사진, 설명, 체류 시간이 보인다 | 7.7 |
| US-20 | 설정 파일의 이미지 경로를 바꾸면 대체 SVG 대신 일러스트가 보인다 | 7.2, 7.9 |
| US-21 | 재구성 뒤 새로 들어온 카드에 "New" 표시가 붙는다 | 6.4 |
| US-22 | LLM이 두 번 실패하면 규칙으로 고른 코스를 돌려준다 | 10.8 |
| US-23 | 여행 모드에 지도가 있고 현재 일정의 마커가 강조된다 | 7.5 |
| US-24 | 프리미엄 코스를 PDF로 받는다 | 미정 (Q-21) |
| US-25 | 무료 코스는 재구성을 정해진 횟수만 할 수 있다 | 미정 (Q-20) |
| US-26 | 장소 카드에서 재구성 없이 폐업 신고만 남긴다 | 9.8 |
| US-27 | 여행 모드의 현재 위치를 브라우저에 저장해 새로고침해도 유지한다 | 6.4 |

---

## 6. 화면별 요구사항

### 6.0 공통

| 화면 | 경로 [제안] | 부르는 API |
|---|---|---|
| 1. 랜딩 | `/` | 없음 |
| 2. 온보딩 | `/onboarding` | `POST /courses` |
| 3. 결과 페이지 | `/course/{id}` | `GET /courses/{id}`, `GET /places` |
| 4. 여행 모드 | `/course/{id}/trip` | `GET /courses/{id}`, `POST /courses/{id}/replan` |
| 5. 구매 | `/course/{id}/purchase` | `GET /courses/{id}`, `POST /purchase` |

- 화면 문구는 모두 영어다. 이 장의 영어 문구는 [제안]이고 C가 다듬는다.
- 로그인이 없다. 코스 주소(`/course/{id}`)를 아는 사람이 그 코스를 본다.
- 기준 화면 폭은 모바일(약 390px)로 잡고, 넓은 화면에서는 같은 폭으로 가운데에 보여준다 [제안] (Q-24).
- 요청 중에는 버튼을 비활성으로 바꿔 같은 요청이 두 번 나가지 않게 한다.
- 요청이 실패하면 9.2의 `code`에 맞는 문구와 다시 시도할 버튼을 보여준다.

### 6.1 랜딩 (`/`)

| 구성 요소 | 내용 |
|---|---|
| 서비스 이름 | MyPace Jeju |
| 한 줄 소개 | 1.1의 한 줄 소개를 영어로 옮긴 문구. 예: "Tell us your taste and your pace. Get a Jeju City day built from real places with real photos, re-planned as your day changes." |
| 버튼 | "Plan my day" → `/onboarding` |

- 동작: 버튼 하나뿐이다. 데이터 요청이 없다.
- 빈 상태·로딩·오류: 데이터를 부르지 않는 화면이라 해당 없음.

### 6.2 온보딩 (`/onboarding`)

카드 선택형 5단계다. 단계 이름은 팀이 정한 것이고, 선택지와 값은 [제안]이다 (Q-02).

| 단계 | 화면 제목 | 고르는 방식 | 선택지 → 값 | `user_profile` 키 |
|---|---|---|---|---|
| 1. 취향 | What do you enjoy? | 여러 개 (1개 이상) | Nature → `nature`, Markets → `market`, Cafés → `cafe`, Local food → `food`, Culture & history → `culture`, Photo spots → `photo` | `interests` |
| 2. 체력·몸 상태 | How do you like to move? | 항목 3개를 한 화면에서 | 체력: Take it easy → `1`, Average → `2`, Active → `3` | `fitness_level` |
| | | | 한 번에 걸을 수 있는 시간: 10 min → `10`, 20 min → `20`, 30 min or more → `30` | `max_walk_min` |
| | | | 오르막 피하기: Avoid uphill 켬 → `true`, 끔 → `false` | `avoid_slopes` |
| 3. 오늘 컨디션 | How do you feel today? | 하나 | Great → `great`, Okay → `normal`, A bit tired → `tired` | `condition_today` |
| 4. 식단 | Any food needs? | 하나 | No restrictions → `none`, Vegan → `vegan`, Vegetarian → `vegetarian`, Halal → `halal` | `diet` |
| 5. 일정 | How long is your day? | 하나 | Half day → `half_day`, Full day → `full_day` | `duration` |

동작

- 한 화면에 한 단계를 보여준다. 위에 진행 표시("2 / 5"), 아래에 Back과 Next가 있다.
- 선택값은 단계를 오가도 남아 있다 (프론트 상태로 보관).
- 5단계의 버튼은 "Create my day"다. 누르면 위 표의 값으로 `user_profile`을 만들어 `POST /courses`를 보낸다 (9.5).
- 성공하면 응답의 `id`로 `/course/{id}`로 이동한다.

상태

| 상태 | 화면 |
|---|---|
| 빈 상태 | 해당 없음. 고르기 전에는 Next가 비활성이다 |
| 로딩 | 화면 전체 로딩. "Building your day from verified places…" 코스 생성은 LLM 때문에 수십 초까지 걸릴 수 있다 (11.1). 그동안 다시 보내기를 막는다 |
| 오류: 502 `LLM_FAILED`, 네트워크 | "That took longer than expected." + "Try again" (같은 값으로 다시 보낸다). 선택값은 남는다 |
| 오류: 409 `NO_CANDIDATES` | "We couldn't find enough places for these choices." + "Change my answers" (1단계로 간다) |

### 6.3 결과 페이지 (`/course/{id}`)

핵심 화면이다. 위에서 아래로 다음 순서다.

1. 헤더: "Your day in Jeju City"와 정차 수("{total_items} stops"). 무료면 "Preview" 표시.
2. 일러스트 지도 (7장).
3. 타임라인 카드 목록. `items`를 `order` 순서대로.
4. 무료일 때만 잠금 카드.
5. 화면 아래 고정 버튼 "Start my day" → `/course/{id}/trip`.

타임라인 카드

| 요소 | 쓰는 데이터 | 표시 규칙 |
|---|---|---|
| 이동 정보 (카드 위) | `move_method`, `move_min` | 이전 장소에서 이 장소까지의 이동이다. 둘 다 `null`인 첫 카드에는 없다. `walk`면 "{move_min} min walk", `taxi`면 "{move_min} min by taxi" |
| 순서와 시각 | `order`, `start_time` | "2 · 10:45" |
| 사진 | `place.image_url` | 없거나 불러오지 못하면 자리 표시(카테고리 아이콘 + 단색 배경) |
| 사진 출처와 확인일 | `place.image_source`, `place.last_verified_at` | "Photo: {image_source} · Verified {last_verified_at}". 값이 없는 쪽은 뺀다 |
| 이름 | `place.name_en`, `place.name_ko` | 영어 이름을 크게, 한글 이름을 작게 |
| 카테고리 | `place.category` | 지도 마커와 같은 아이콘 (7.5) |
| 체류 시간 | `stay_min` | "Stay {stay_min} min" |
| 추천 이유 | `reason_en` | 그대로 보여준다 |
| 쉬어 가기 | `is_rest_stop` | `true`면 "Rest stop" 배지 |
| 식당 배지 | `place.food_options` | `null`이면 영역이 없다. 값이 `true`인 것만 배지로: Solo OK, Vegan, Vegetarian, Halal, English menu. `signature_menu_en`이 있으면 "Try: {signature_menu_en}" |
| Show to driver | `place.name_ko`, `place.address_ko` | 버튼. 누르면 아래의 전체 화면 카드 |
| 문장 카드 (P1) | `phrase_cards`, `tier` | `premium`이고 배열이 비어 있지 않으면 보여준다. `free`면 잠금 줄 "Local phrases · Premium" |

Show to driver 카드 (전체 화면)

| 위치 | 내용 |
|---|---|
| 맨 위, 작게 | "Show this screen to your taxi driver" |
| 가운데, 가장 크게 | `name_ko` |
| 그 아래 | `address_ko` |
| 그 아래 | 고정 문장 "이 주소로 가 주세요." [제안] |
| 맨 아래 | "Close" 버튼 |

밝은 배경에 검은 글자로 하고, 이름은 32px 이상으로 한다 [제안].

잠금 카드 (무료)

- 문구: "{locked_count} more stops in your full day"
- 버튼: "Unlock full day" → `/course/{id}/purchase`

상태

| 상태 | 화면 |
|---|---|
| 로딩 | 지도 배경과 카드 스켈레톤 3개 |
| 빈 상태 | `items`가 빈 배열일 때 "No stops in this plan yet." + "Plan a new day". 정상 흐름에서는 나오지 않는다 |
| 오류: 404 `COURSE_NOT_FOUND` | "We couldn't find this plan." + "Plan a new day" → `/` |
| 오류: 네트워크, 5xx | "Something went wrong." + "Retry" |
| 사진 실패 | 그 카드의 사진 자리만 자리 표시로 바꾼다. 나머지는 그대로 |

### 6.4 여행 모드 (`/course/{id}/trip`)

구성

1. 헤더: "Now". `user_profile.conditions.indoor_only`가 `true`면 "Indoor plan" 표시 [제안].
2. 현재 일정 카드: 6.3의 카드와 같은 내용을 크게 보여주고 "Done, next stop" 버튼을 둔다.
3. 다음 일정 목록: 시각, 이름, 이동 정보만 작게.
4. 지나간 일정: 흐리게 접어 둔다.
5. 화면 아래 고정: 재구성 버튼.

재구성 버튼

| 라벨 | `reason` | 우선순위 | 누르면 |
|---|---|---|---|
| It's raining | `rain` | P0 | 바로 요청 |
| It's closed | `closed` | P0 | 확인 창을 띄운 뒤 요청 |
| I'm hungry | `hungry` | P1 | 바로 요청 |
| I'm tired | `tired` | P1 | 바로 요청 |

동작

- 현재 일정: 처음 들어오면 `status`가 `current`인 항목이다. "Done, next stop"을 누르면 프론트 상태에서 다음 항목으로 넘어간다. 서버는 부르지 않는다 [제안] (Q-11).
- 현재 일정의 `order`를 `current_order`라고 부른다. 재구성 요청에 이 값을 넣어 보내고, 서버가 그때 `status`를 맞춘다.
- 재구성: `POST /courses/{id}/replan`에 `reason`과 `current_order`를 보낸다 (9.7). 응답으로 온 `Course`로 화면 전체를 바꾼다.
- "It's closed" 확인 창: "Report {name_en} as closed and get an alternative?" / "Yes, it's closed" / "Cancel". 신고는 재구성 요청 안에서 저장되므로 프론트는 `POST /places/{id}/report`를 따로 부르지 않는다.
- 무료 코스도 들어올 수 있고, 돌려받은 항목만 보인다 (Q-01).

재구성 성공 뒤 안내 문구

| `reason` | 문구 |
|---|---|
| `rain` | "Plan updated. Indoor stops for the rest of your day." |
| `closed` | "Thanks, we've noted that {name_en} was closed. Here's an alternative." |
| `hungry` | "Added a place to eat nearby." |
| `tired` | "Plan updated. Easier stops with less walking." |

상태

| 상태 | 화면 |
|---|---|
| 로딩 (처음) | 스켈레톤 |
| 로딩 (재구성) | 현재 일정과 지나간 일정은 그대로 두고, 다음 일정 자리에 "Re-planning the rest of your day…". 재구성 버튼은 비활성 |
| 빈 상태 | 현재 일정이 마지막이면 다음 일정 자리에 "This is your last stop." 마지막 일정까지 끝내면 "Day complete" + "Back to my plan" |
| 오류: 재구성 502, 네트워크 | "We couldn't re-plan just now. Your current plan is unchanged." + "Retry" |
| 오류: 재구성 409 `NO_CANDIDATES` | "No other places fit right now. Your current plan is unchanged." |
| 오류: 처음 404 | 6.3과 같다 |

### 6.5 구매 (`/course/{id}/purchase`)

요금제 카드

| | Free | Premium |
|---|---|---|
| 설명 | Course preview | 건당 결제. 이 코스 하나에 적용된다 |
| 혜택 | Up to 3 stops | Full course, Unlimited re-planning, Local phrase cards, Offline PDF |
| 가격 | 없음 | 설정 상수 `PREMIUM_PRICE_LABEL` 한 곳에서 관리한다. 값은 미정 (Q-19) |

- 아직 만들지 않은 혜택(Offline PDF)에는 "Coming soon"을 붙인다 [제안] (Q-21).
- 버튼 "Pay now" 아래에 "Demo payment. No real charge."를 보여준다.
- 카드 번호처럼 실제 결제 정보를 받는 입력란은 만들지 않는다 (11.2).
- 확장 수익 모델(로컬 가이드·택시투어 예약 수수료, 숙소 B2B)은 화면에 넣지 않는다. 발표 자료에만 넣는다.

동작

- "Pay now" → `POST /purchase`에 `course_id`를 보낸다 (9.9) → 성공 화면 "You're all set." + "See my full day" → `/course/{id}`.

상태

| 상태 | 화면 |
|---|---|
| 로딩 (처음) | `GET /courses/{id}`로 `tier`를 확인하는 동안 스켈레톤 |
| 빈 상태 | 해당 없음 |
| 이미 `premium` | "This plan is already unlocked." + "See my full day" |
| 로딩 (결제) | 버튼에 로딩 표시, 비활성 |
| 오류 | "Payment didn't go through. Nothing was charged." + "Try again" |

---

## 7. 일러스트 지도 상세 명세

### 7.1 원칙

- 실제 지도 API(카카오맵, 구글맵, Leaflet)를 쓰지 않는다.
- 제주시 원도심을 그린 일러스트 이미지 한 장 위에 장소 마커를 대략적인 위치로 올린다.
- 일러스트가 준비되기 전에는 해안선과 오름만 있는 단순 SVG로 대신한다.
- 배경 이미지와 위도·경도 범위는 설정 파일 하나에서 바꾼다.

### 7.2 설정 파일

위치는 `frontend/config/map.ts` [제안], 이미지 파일은 `frontend/public/map/`에 둔다.

```ts
export const MAP_CONFIG = {
  // 일러스트가 준비되면 이 경로만 바꾼다
  image: "/map/jeju-city-fallback.svg",
  // 이미지의 네 변이 나타내는 위도·경도
  bounds: { lngMin: 126.44, lngMax: 126.56, latMin: 33.46, latMax: 33.53 },
  // 이미지의 가로 ÷ 세로
  aspectRatio: 10 / 7,
};
```

- 이 값들은 이 파일에만 둔다. 지도 컴포넌트는 `MAP_CONFIG`를 가져다 쓰고, 숫자를 직접 적지 않는다.
- 범위를 바꾸면 `bounds`와 `aspectRatio`를 함께 바꾼다 (7.9).

### 7.3 좌표 변환

위도·경도를 이미지 안의 퍼센트 위치로 선형 변환한다. y축은 뒤집는다 (위도가 클수록 위쪽).

```
x% = (lng − lngMin) ÷ (lngMax − lngMin) × 100
y% = (latMax − lat) ÷ (latMax − latMin) × 100
```

```ts
export function toPercent(lat, lng, b = MAP_CONFIG.bounds) {
  const x = ((lng - b.lngMin) / (b.lngMax - b.lngMin)) * 100;
  const y = ((b.latMax - lat) / (b.latMax - b.latMin)) * 100;
  const inBounds = x >= 0 && x <= 100 && y >= 0 && y <= 100;
  return { x, y, inBounds };
}
```

검증 좌표. 구현한 뒤 아래 값이 나오는지 확인한다.

| lat | lng | x% | y% | 뜻 |
|---|---|---|---|---|
| 33.53 | 126.44 | 0 | 0 | 왼쪽 위 모서리 |
| 33.46 | 126.56 | 100 | 100 | 오른쪽 아래 모서리 |
| 33.495 | 126.50 | 50 | 50 | 한가운데 |
| 33.5125 | 126.53 | 75 | 25 | 오른쪽 위 4분의 1 지점 |
| 33.54 | 126.60 | 133.3 | −14.3 | 범위 밖. 그리지 않는다 |

### 7.4 배치

| 층 (아래 → 위) | 구현 |
|---|---|
| 바깥 상자 | `position: relative`, 가로 100%, `aspect-ratio`는 `MAP_CONFIG.aspectRatio` |
| 배경 이미지 | 상자를 가로·세로 100%로 꽉 채운다 |
| 동선 | 상자 전체를 덮는 SVG 한 장. `viewBox="0 0 100 100"`, `preserveAspectRatio="none"` |
| 코스 밖 마커 | `position: absolute; left: x%; top: y%` |
| 코스 마커 | 위와 같고 더 위에 쌓는다 |
| 하단 카드 (P1) | 지도 아래쪽에서 올라온다 |

- 배경이 잘리거나 여백이 생기면 퍼센트 위치가 어긋난다. `object-fit`에 기대지 말고 상자 비율을 이미지 비율과 같게 맞춘다.
- 마커는 가리키는 점이 좌표에 오도록 `transform`으로 옮긴다. 핀 모양이면 핀 끝(`translate(-50%, -100%)`), 원 모양이면 중심(`translate(-50%, -50%)`).
- 동선 SVG는 가로와 세로가 다른 비율로 늘어난다. 선에 `vector-effect="non-scaling-stroke"`를 주어 선 굵기와 점선 간격이 일그러지지 않게 한다.

### 7.5 마커

| `category` | 아이콘 [제안] |
|---|---|
| `nature` | 나무 |
| `market` | 가게 |
| `cafe` | 커피잔 |
| `food` | 수저 |
| `culture` | 옛 건물 |
| `photo` | 카메라 |

- 아이콘 세트와 색은 A가 정한다. 타임라인 카드의 카테고리 아이콘과 같은 것을 쓴다.
- 코스 마커: 카테고리 아이콘과 방문 순서 번호(`order`)를 함께 보여준다.
- 코스 밖 마커: `GET /places`로 받은 장소 중 코스에 없는 곳. 작고 흐리게, 번호 없이 보여준다 [제안] (Q-23).
- 여행 모드에서 지도를 쓰면(P1) `current`는 강조하고 `done`은 흐리게 한다.
- 범위 밖 좌표(`inBounds`가 `false`)는 그리지 않는다.

### 7.6 동선

- 코스가 있으면 `items`를 `order` 순서대로 점선으로 잇는다. 점은 각 장소의 x%, y%다.
- 무료 코스는 돌려받은 3곳만 잇는다.
- 재구성 뒤에는 새로 받은 `Course`로 번호와 점선을 다시 그린다.

### 7.7 하단 카드 (P1)

- 마커를 누르면 하단 카드가 열려 사진(출처와 확인일 포함), `name_en`, `description_en`, 체류 시간을 보여준다.
- 체류 시간은 코스 장소면 그 항목의 `stay_min`, 코스 밖 장소면 `avg_stay_min`이다.
- 카드 바깥을 누르거나 닫기 버튼을 누르면 닫힌다.

### 7.8 대체 SVG

- 파일: `frontend/public/map/jeju-city-fallback.svg`. `viewBox="0 0 1000 700"` (10:7).
- 그리는 것: 바다(위쪽), 땅(아래쪽), 해안선 하나, 오름 두세 개. 글자와 도로는 넣지 않는다.
- 해안선은 실제 위치에 맞춰야 바닷가 장소의 마커가 바다에 빠지지 않는다. 아래 가이드 좌표를 이어 그린다. 대략값이므로, 시드 데이터의 바닷가 장소가 해안선 바로 아래 땅에 찍히는지로 확인한다.

| 지점 | lng | lat | x% | y% |
|---|---|---|---|---|
| 해안선 서쪽 끝 | 126.440 | 33.495 | 0 | 50.0 |
| 해안선 | 126.455 | 33.499 | 12.5 | 44.3 |
| 해안선 | 126.470 | 33.510 | 25.0 | 28.6 |
| 해안선 | 126.490 | 33.517 | 41.7 | 18.6 |
| 해안선 | 126.510 | 33.517 | 58.3 | 18.6 |
| 해안선 | 126.525 | 33.519 | 70.8 | 15.7 |
| 해안선 | 126.545 | 33.522 | 87.5 | 11.4 |
| 해안선 동쪽 끝 | 126.560 | 33.525 | 100 | 7.1 |
| 오름 (도두봉 부근) | 126.468 | 33.508 | 23.3 | 31.4 |
| 오름 (사라봉 부근) | 126.546 | 33.517 | 88.3 | 18.6 |

viewBox가 1000×700이면 x%에 10을, y%에 7을 곱한 값이 좌표다.

### 7.9 일러스트 제작 가이드

- 비율은 10:7로 그린다 (예: 2000×1400px). 범위가 가로 약 11.1km, 세로 약 7.8km라서 이 비율이면 방향에 따른 왜곡이 거의 없다.
- 이미지의 네 변이 `bounds`와 정확히 일치해야 한다. 이미지 안에 여백, 테두리, 제목을 넣지 않는다.
- 그림은 과장해도 되지만 해안선과 큰 지형은 실제 위치에 둔다. 마커는 실제 좌표로 찍히므로 그림만 옮겨 그리면 마커가 엉뚱한 곳에 온다.
- 정렬 확인: 위치를 잘 아는 장소 3곳(바닷가 1곳, 원도심 1곳, 남쪽 1곳)의 마커가 그림의 그 자리에 오는지 본다.
- 범위를 바꿀 때의 비율: 가로 ÷ 세로 ≈ (경도 폭 × 0.837) ÷ 위도 폭. 지금 범위는 (0.12 × 0.837) ÷ 0.07 ≈ 1.43이다.
- 누가 어떤 방법으로 그릴지는 정해지지 않았다 (Q-22).

### 7.10 범위 밖 장소와 마커 겹침

- DB에는 지도 범위 안의 장소만 넣는다 (C). 시드 20곳이 모두 범위 안인지 확인이 필요하다 (Q-04, Q-13).
- 모바일 폭에서는 지도 1px이 약 30m다. 지름 28px 마커 하나가 약 870m를 덮으므로, 장소가 몰린 원도심에서는 마커가 겹친다.
- 겹침 대응: 코스 마커를 항상 위에 쌓고, 코스 밖 마커는 작게 그린다. 그래도 겹치면 설정 파일에 장소별 보정값 `offsets: { [placeId]: { dx, dy } }`(단위 %)을 두고 손으로 띄운다 [제안] (P1).

---

## 8. 데이터 모델

테이블과 컬럼 이름은 팀이 정한 그대로다. 타입은 [제안]이다. "현재 상태"는 시드 데이터에 값이 있는지를 뜻한다.

### 8.1 테이블 관계

- `places` 1 : 1 `place_accessibility` (모든 장소에 반드시 있어야 한다)
- `places` 1 : 0~1 `food_options` (식당·카페만)
- `places` 1 : N `phrase_cards`
- `places` 1 : N `place_reports`
- `courses` 1 : N `course_items`
- `places` 1 : N `course_items`

### 8.2 `places`

| 컬럼 | 타입 | 설명 | 현재 상태 |
|---|---|---|---|
| `id` | integer, PK | 장소 ID. LLM이 고르는 값이다. 형식은 시드 파일을 따른다 (Q-04) | 있음 |
| `source_poi_id` | text, null 허용 | 제주특별자치도 장소 POI 데이터의 원본 ID. POI 데이터 밖에서 추가한 장소는 `null` | 있음 |
| `name_en` | text | 영어 이름. 화면에 보여준다 | 있음 |
| `name_ko` | text | 한글 이름. Show to driver에 쓴다 | 있음 |
| `category` | text | `nature`, `market`, `cafe`, `food`, `culture`, `photo` 중 하나 | 있음 |
| `description_en` | text | 영어 설명. 지도 하단 카드와 LLM 입력에 쓴다 | 있음 |
| `lat` | double precision | 위도 | 있음 |
| `lng` | double precision | 경도 | 있음 |
| `address_ko` | text | 한글 주소. Show to driver에 쓴다 | 있음 |
| `image_url` | text, null 허용 | `place-images` 버킷에 올린 사진의 공개 URL | 비어 있음 |
| `image_source` | text, null 허용 | 사진 출처 표기 (Q-16) | 비어 있음 |
| `avg_stay_min` | integer | 평균 체류 시간(분) | 있음 |
| `opening_hours` | text, null 허용 | 영업 시간. 형식 미정 (Q-14) | 비어 있음 |
| `closed_days` | text[], 기본값 빈 배열 | 휴무 요일. `mon`~`sun` [제안] (Q-14) | 비어 있음 |
| `price_level` | integer, null 허용 | 가격대. 기준 미정 (Q-14) | 비어 있음 |
| `last_verified_at` | date, null 허용 | 마지막 확인일 (Q-15) | 비어 있음 |
| `source_date` | date, null 허용 | 원본 데이터 기준일. POI 데이터는 `2015-12-31` | 있음 |

### 8.3 `place_accessibility`

| 컬럼 | 타입 | 설명 | 쓰이는 곳 | 현재 상태 |
|---|---|---|---|---|
| `place_id` | integer, PK, FK → `places.id` | | | 있음 |
| `walking_level` | integer (1~3) | 걷기 강도 | 후보 필터 F-4 | 있음 |
| `terrain` | text | `flat`, `slope`, `steep` 중 하나 | 후보 필터 F-5 | 있음 |
| `has_stairs` | boolean, null 허용 | 계단 여부 | MVP에서 쓰지 않음 | 비어 있음 |
| `wheelchair_ok` | boolean, null 허용 | 휠체어 가능 여부 | MVP에서 쓰지 않음 | 비어 있음 |
| `indoor` | boolean | 실내 여부 | 후보 필터 F-6 (비가 와요) | 있음 |
| `has_seating` | boolean, null 허용 | 앉을 곳 여부 | MVP에서 쓰지 않음 | 비어 있음 |
| `restroom` | boolean, null 허용 | 화장실 여부 | MVP에서 쓰지 않음 | 비어 있음 |
| `nearest_public_restroom_m` | integer, null 허용 | 가장 가까운 공중화장실까지 거리(m) | MVP에서 쓰지 않음 | 있음 |
| `fatigue_score` | integer (1~5) | 피로도 | LLM 입력 (참고값) | 있음 |

`walking_level`과 `fatigue_score`는 숫자가 클수록 힘든 것으로 가정했다. 시드 파일로 확인해야 한다 (Q-04).

### 8.4 `food_options`

아직 데이터가 없다. 1인 주문이 가능한 식당·카페가 최소 5곳 필요하다.

| 컬럼 | 타입 | 설명 | 쓰이는 곳 |
|---|---|---|---|
| `place_id` | integer, PK, FK → `places.id` | | |
| `solo_ok` | boolean | 1인분 주문 가능 | 후보 필터 F-3, "Solo OK" 배지 |
| `vegan` | boolean | 비건 메뉴 있음 | 후보 필터 F-3, "Vegan" 배지 |
| `vegetarian` | boolean | 채식 메뉴 있음 | 후보 필터 F-3, "Vegetarian" 배지 |
| `halal` | boolean | 할랄 | 후보 필터 F-3, "Halal" 배지 |
| `english_menu` | boolean | 영어 메뉴 있음 | "English menu" 배지 |
| `signature_menu_en` | text, null 허용 | 대표 메뉴(영어) | 카드의 "Try: …" |
| `allergens` | text, null 허용 | 알레르기 유발 재료. 형식 미정 (Q-14) | MVP에서 쓰지 않음 |

### 8.5 `phrase_cards`

아직 데이터가 없다. 한 장소에 여러 장을 둘 수 있다.

| 컬럼 | 타입 | 설명 | 예 |
|---|---|---|---|
| `place_id` | integer, FK → `places.id` | | |
| `situation` | text | 쓰는 상황(영어) | Asking the price at a stall |
| `text_en` | text | 영어 뜻 | How much is this? |
| `text_ko` | text | 한국어 문장 | 이거 얼마예요? |

### 8.6 `courses`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid, PK | 코스 ID. 주소(`/course/{id}`)에 쓰이므로 추측할 수 없는 값으로 한다 |
| `user_profile` | jsonb | 온보딩 입력과 현재 조건 (8.9) |
| `tier` | text, 기본값 `free` | `free` 또는 `premium` |
| `created_at` | timestamptz, 기본값 현재 시각 | |

### 8.7 `course_items`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `course_id` | uuid, FK → `courses.id` | |
| `order` | integer | 방문 순서. 1부터. (`course_id`, `order`)가 유일하다 |
| `place_id` | integer, FK → `places.id` | |
| `start_time` | text | 도착 시각. `"HH:MM"` (24시간, 한국 시간) |
| `stay_min` | integer | 체류 시간(분) |
| `move_method` | text, null 허용 | **이전 장소에서 이 장소까지**의 이동 방법. `walk`, `bus`, `taxi` 중 하나. 코스의 첫 항목은 `null`. MVP는 `walk`와 `taxi`만 만든다 |
| `move_min` | integer, null 허용 | 그 이동에 걸리는 시간(분). 코스의 첫 항목은 `null` |
| `reason_en` | text | 추천 이유(영어). LLM이 쓴다 |
| `is_rest_stop` | boolean, 기본값 `false` | 쉬어 가는 정차인지. LLM 출력으로 채운다 [제안] (Q-12) |
| `status` | text | `done`, `current`, `upcoming` 중 하나 |

`order`는 SQL 예약어다. SQL에서는 항상 `"order"`처럼 큰따옴표로 감싼다 (Q-05).

### 8.8 `place_reports`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `place_id` | integer, FK → `places.id` | 신고된 장소 |
| `type` | text | 신고 종류. 지금은 `closed` 하나 [제안] |
| `created_at` | timestamptz, 기본값 현재 시각 | |

### 8.9 `user_profile` JSON [제안]

`courses.user_profile`에 저장하고, `POST /courses` 요청에도 같은 키를 쓴다 (Q-02).

| 키 | 값 | 온보딩 단계 | 쓰이는 곳 |
|---|---|---|---|
| `interests` | `places.category` 값의 배열. 1개 이상 | 1. 취향 | LLM 선호, 후보가 많을 때 우선순위 |
| `fitness_level` | `1`, `2`, `3` | 2. 체력·몸 상태 | 후보 필터 F-4 |
| `max_walk_min` | `10`, `20`, `30`. 한 번에 이어서 걸을 수 있는 시간(분) (Q-07) | 2. 체력·몸 상태 | 도보와 택시를 가르는 기준 (10.6) |
| `avoid_slopes` | `true`, `false` | 2. 체력·몸 상태 | 후보 필터 F-5 |
| `condition_today` | `great`, `normal`, `tired` | 3. 오늘 컨디션 | 후보 필터 F-4, LLM 입력 |
| `diet` | `none`, `vegan`, `vegetarian`, `halal` | 4. 식단 | 후보 필터 F-3 |
| `duration` | `half_day`, `full_day` | 5. 일정 | 코스 길이 (10.6) |
| `conditions` | `{ "indoor_only": boolean, "low_walking": boolean }` | 없음. 서버가 붙인다 | 재구성으로 켜진 조건. 처음에는 둘 다 `false` (10.7) |

### 8.10 데이터를 넣을 때 지킬 규칙 (C)

- 모든 `places` 행에 `place_accessibility` 행이 있어야 한다. 새로 추가하는 식당·카페도 같다. 없으면 `indoor` 값을 알 수 없어 "비가 와요" 코스에서 빠진다.
- `food_options` 행이 있는 장소는 `category`가 `food` 또는 `cafe`다.
- 모든 좌표는 지도 범위(7.2) 안에 있다.
- `image_url`은 `place-images` 버킷의 공개 URL이다. 한국관광공사 TourAPI 등 공공 데이터의 사진을 쓰고 `image_source`에 출처를 남긴다. AI 생성 이미지는 쓰지 않는다.
- 2015년 기준 데이터라 폐업이나 변경이 있을 수 있다. 확인한 장소에만 `last_verified_at`를 채운다 (Q-15).

---

## 9. API 명세

### 9.1 공통 규칙

- 기본 주소는 `NEXT_PUBLIC_API_URL`(Railway 주소)이다.
- 요청과 응답은 JSON이다. 인증은 없다.
- 필드명은 snake_case이고 DB 컬럼 이름과 같다.
- 값이 없으면 키를 빼지 않고 `null`을 넣는다. 배열은 비어 있어도 `[]`를 넣는다.
- `start_time`은 `"HH:MM"`(24시간, 한국 시간), 날짜는 `"YYYY-MM-DD"`, `created_at`은 ISO 8601 UTC다.
- `Course`를 돌려주는 엔드포인트 4개(`POST /courses`, `GET /courses/{id}`, `POST /courses/{id}/replan`, `POST /purchase`)는 같은 `Course` 형태를 쓰고, 무료 3곳 제한도 똑같이 적용한다.

| 엔드포인트 | 하는 일 | 성공 응답 |
|---|---|---|
| `GET /places` | 장소 전체 목록 | 200, `{ "places": Place[] }` |
| `POST /courses` | 온보딩 입력으로 코스 생성 | 201, `Course` |
| `GET /courses/{id}` | 코스 조회. 무료는 3곳까지만 | 200, `Course` |
| `POST /courses/{id}/replan` | 남은 일정 재구성 | 200, `Course` |
| `POST /places/{id}/report` | 문 닫았어요 신고 | 201, 신고 1건 |
| `POST /purchase` | 결제 목업. `tier`를 `premium`으로 변경 | 200, `Course` |

### 9.2 오류

직접 돌려주는 오류는 아래 형태다.

```json
{ "detail": { "code": "COURSE_NOT_FOUND", "message": "Course not found." } }
```

| HTTP | `code` | 언제 | 프론트 처리 |
|---|---|---|---|
| 404 | `COURSE_NOT_FOUND` | 없는 코스 ID | 6.3의 404 화면 |
| 404 | `COURSE_ITEM_NOT_FOUND` | `current_order`가 그 코스에 없는 값 | 일반 오류 문구 |
| 404 | `PLACE_NOT_FOUND` | 없는 장소 ID | 일반 오류 문구 |
| 409 | `NO_CANDIDATES` | 조건에 맞는 후보가 모자라 일정을 만들 수 없음 | 6.2, 6.4의 문구 |
| 502 | `LLM_FAILED` | LLM 호출이나 검증이 재시도 뒤에도 실패 | 6.2, 6.4의 문구 + 다시 시도 |
| 422 | 없음 | 요청 형식이 틀림. FastAPI 기본 응답이라 `detail`이 배열이다 | 일반 오류 문구. 개발 중에 잡아야 하는 버그다 |

프론트 규칙: `detail.code`가 문자열이면 그 코드로 분기한다. 아니면 "Something went wrong."과 Retry를 보여준다.

### 9.3 공통 타입

표기는 TypeScript 형식이다. 백엔드의 Pydantic 모델도 같은 이름과 구조로 만든다.

```ts
type Category = "nature" | "market" | "cafe" | "food" | "culture" | "photo";
type Tier = "free" | "premium";
type MoveMethod = "walk" | "bus" | "taxi";            // MVP는 walk, taxi만 만든다
type ItemStatus = "done" | "current" | "upcoming";
type ReplanReason = "rain" | "closed" | "hungry" | "tired";

type Accessibility = {
  walking_level: 1 | 2 | 3;
  terrain: "flat" | "slope" | "steep";
  has_stairs: boolean | null;
  wheelchair_ok: boolean | null;
  indoor: boolean;
  has_seating: boolean | null;
  restroom: boolean | null;
  nearest_public_restroom_m: number | null;
  fatigue_score: 1 | 2 | 3 | 4 | 5;
};

type FoodOptions = {
  solo_ok: boolean;
  vegan: boolean;
  vegetarian: boolean;
  halal: boolean;
  english_menu: boolean;
  signature_menu_en: string | null;
  allergens: string | null;
};

type PhraseCard = { situation: string; text_en: string; text_ko: string };

type Place = {
  id: number;
  source_poi_id: string | null;
  name_en: string;
  name_ko: string;
  category: Category;
  description_en: string;
  lat: number;
  lng: number;
  address_ko: string;
  image_url: string | null;
  image_source: string | null;
  avg_stay_min: number;
  opening_hours: string | null;
  closed_days: string[];              // "mon" ~ "sun"
  price_level: number | null;
  last_verified_at: string | null;    // "YYYY-MM-DD"
  source_date: string | null;         // "YYYY-MM-DD"
  accessibility: Accessibility;       // place_accessibility 행
  food_options: FoodOptions | null;   // food_options 행. 없으면 null
};

type UserProfile = {
  interests: Category[];
  fitness_level: 1 | 2 | 3;
  max_walk_min: 10 | 20 | 30;
  avoid_slopes: boolean;
  condition_today: "great" | "normal" | "tired";
  diet: "none" | "vegan" | "vegetarian" | "halal";
  duration: "half_day" | "full_day";
  conditions: { indoor_only: boolean; low_walking: boolean };   // 응답에만 있다
};

type CourseItem = {
  order: number;
  place_id: number;
  start_time: string;                 // "HH:MM"
  stay_min: number;
  move_method: MoveMethod | null;     // 이전 장소 → 이 장소. 코스의 첫 항목은 null
  move_min: number | null;
  reason_en: string;
  is_rest_stop: boolean;
  status: ItemStatus;
  place: Place;
  phrase_cards: PhraseCard[];         // tier가 free면 항상 []
};

type Course = {
  id: string;                         // uuid
  tier: Tier;
  created_at: string;                 // ISO 8601 UTC
  user_profile: UserProfile;
  total_items: number;                // 가려진 것을 포함한 전체 항목 수
  locked_count: number;               // 가려진 항목 수. premium이면 0
  items: CourseItem[];                // order 오름차순. free면 앞의 3개만
};
```

`total_items`, `locked_count`, `user_profile.conditions`, `CourseItem.place`, `CourseItem.phrase_cards`는 테이블에 없는 응답 전용 필드다 [제안]. 잠금 카드와 화면 한 번 호출 구성을 위해 넣었다.

### 9.4 `GET /places`

장소 전체를 `id` 오름차순으로 돌려준다. 지도의 코스 밖 마커와 Day 1 연결 확인에 쓴다. 문장 카드는 프리미엄 전용이라 여기에는 없다.

응답 200

```json
{
  "places": [
    {
      "id": 7,
      "source_poi_id": "POI-0007",
      "name_en": "Yongduam Rock",
      "name_ko": "용두암",
      "category": "photo",
      "description_en": "A seaside lava rock shaped like a dragon's head.",
      "lat": 33.5161,
      "lng": 126.5119,
      "address_ko": "제주특별자치도 제주시 용두암길 15",
      "image_url": "https://<project-ref>.supabase.co/storage/v1/object/public/place-images/7.jpg",
      "image_source": "Korea Tourism Organization (TourAPI)",
      "avg_stay_min": 30,
      "opening_hours": null,
      "closed_days": [],
      "price_level": null,
      "last_verified_at": "2026-11-12",
      "source_date": "2015-12-31",
      "accessibility": {
        "walking_level": 1,
        "terrain": "flat",
        "has_stairs": null,
        "wheelchair_ok": null,
        "indoor": false,
        "has_seating": null,
        "restroom": null,
        "nearest_public_restroom_m": 150,
        "fatigue_score": 2
      },
      "food_options": null
    },
    {
      "id": 21,
      "source_poi_id": null,
      "name_en": "Sample Vegan Kitchen",
      "name_ko": "샘플 비건 식당",
      "category": "food",
      "description_en": "Placeholder entry. Replace with a real, verified restaurant.",
      "lat": 33.5128,
      "lng": 126.5241,
      "address_ko": "제주특별자치도 제주시 예시로 12",
      "image_url": "https://<project-ref>.supabase.co/storage/v1/object/public/place-images/21.jpg",
      "image_source": "Korea Tourism Organization (TourAPI)",
      "avg_stay_min": 60,
      "opening_hours": null,
      "closed_days": ["mon"],
      "price_level": null,
      "last_verified_at": "2026-11-12",
      "source_date": null,
      "accessibility": {
        "walking_level": 1,
        "terrain": "flat",
        "has_stairs": null,
        "wheelchair_ok": null,
        "indoor": true,
        "has_seating": null,
        "restroom": null,
        "nearest_public_restroom_m": null,
        "fatigue_score": 1
      },
      "food_options": {
        "solo_ok": true,
        "vegan": true,
        "vegetarian": true,
        "halal": false,
        "english_menu": true,
        "signature_menu_en": "Tofu bibimbap",
        "allergens": "soy, sesame"
      }
    }
  ]
}
```

### 9.5 `POST /courses`

온보딩 입력으로 코스를 만든다. 처리 순서는 10장이다.

| 요청 필드 | 필수 | 값 |
|---|---|---|
| `user_profile` | 예 | 8.9의 키 7개. `conditions`는 보내지 않는다 |
| `start_time` | 아니오 | `"HH:MM"`. 없으면 `"10:00"` [제안] (Q-06) |

요청

```json
{
  "user_profile": {
    "interests": ["photo", "market", "cafe"],
    "fitness_level": 2,
    "max_walk_min": 20,
    "avoid_slopes": false,
    "condition_today": "normal",
    "diet": "vegan",
    "duration": "full_day"
  },
  "start_time": "10:00"
}
```

응답 201. 새 코스는 `tier`가 `free`이고, 1번 항목이 `current`, 나머지가 `upcoming`이다. 아래는 전체 6개 중 3개만 돌려준 모습이다.

```jsonc
{
  "id": "0b7f6c1e-5d1a-4c1e-9a55-2f3f1f2a9d10",
  "tier": "free",
  "created_at": "2026-11-12T01:05:00Z",
  "user_profile": {
    "interests": ["photo", "market", "cafe"],
    "fitness_level": 2,
    "max_walk_min": 20,
    "avoid_slopes": false,
    "condition_today": "normal",
    "diet": "vegan",
    "duration": "full_day",
    "conditions": { "indoor_only": false, "low_walking": false }
  },
  "total_items": 6,
  "locked_count": 3,
  "items": [
    {
      "order": 1,
      "place_id": 7,
      "start_time": "10:00",
      "stay_min": 30,
      "move_method": null,
      "move_min": null,
      "reason_en": "A seaside photo spot to start your day, on flat ground with very little walking.",
      "is_rest_stop": false,
      "status": "current",
      "place": { /* 9.4의 Place와 같은 형태 (id 7) */ },
      "phrase_cards": []
    },
    {
      "order": 2,
      "place_id": 3,
      "start_time": "10:45",
      "stay_min": 60,
      "move_method": "taxi",
      "move_min": 12,
      "reason_en": "You said you enjoy markets, and this one is close to your first stop.",
      "is_rest_stop": false,
      "status": "upcoming",
      "place": { /* Place (id 3) */ },
      "phrase_cards": []
    },
    {
      "order": 3,
      "place_id": 21,
      "start_time": "11:55",
      "stay_min": 60,
      "move_method": "walk",
      "move_min": 8,
      "reason_en": "A lunch stop with vegan dishes where you can order for one.",
      "is_rest_stop": false,
      "status": "upcoming",
      "place": { /* Place (id 21, food_options 포함) */ },
      "phrase_cards": []
    }
  ]
}
```

오류: 409 `NO_CANDIDATES`, 502 `LLM_FAILED`, 422.

### 9.6 `GET /courses/{id}`

코스를 조회한다. 응답은 `Course`다.

무료 3곳 규칙 (`Course`를 돌려주는 모든 엔드포인트에 같이 적용)

| | `tier` = `free` | `tier` = `premium` |
|---|---|---|
| `items` | `order`가 작은 3개 | 전체 |
| `total_items` | 전체 항목 수 | 전체 항목 수 |
| `locked_count` | `total_items − 3` (0보다 작으면 0) | 0 |
| `phrase_cards` | 항상 `[]` | 그 장소의 문장 카드 |

가려진 항목은 응답에 넣지 않는다. 프론트에서 숨기는 방식으로 만들지 않는다.

예시 코스. 9.5에서 만든 코스가 `premium`일 때 돌려주는 6개 항목이다.

| `order` | `place_id` | 장소 (예시) | `start_time` | `stay_min` | `move_method` | `move_min` | `status` |
|---|---|---|---|---|---|---|---|
| 1 | 7 | Yongduam Rock | 10:00 | 30 | null | null | current |
| 2 | 3 | Dongmun Traditional Market | 10:45 | 60 | taxi | 12 | upcoming |
| 3 | 21 | Sample Vegan Kitchen | 11:55 | 60 | walk | 8 | upcoming |
| 4 | 5 | Jeju Mokgwana | 13:00 | 45 | walk | 5 | upcoming |
| 5 | 11 | Samseonghyeol | 13:55 | 50 | taxi | 10 | upcoming |
| 6 | 9 | Sarabong Peak | 15:00 | 60 | taxi | 14 | upcoming |

`premium`일 때 2번 항목의 `phrase_cards`

```json
[
  {
    "situation": "Asking the price at a stall",
    "text_en": "How much is this?",
    "text_ko": "이거 얼마예요?"
  }
]
```

오류: 404 `COURSE_NOT_FOUND`.

### 9.7 `POST /courses/{id}/replan`

남은 일정을 다시 만든다. 조건별 규칙은 10.7이다.

| 요청 필드 | 필수 | 값 |
|---|---|---|
| `reason` | 예 | `rain`, `closed`, `hungry`, `tired` 중 하나 |
| `current_order` | 예 | 여행 모드에서 지금 현재 일정인 항목의 `order` |

처리 요약

1. `status`를 `current_order`에 맞춘다. `order`가 더 작으면 `done`, 같으면 `current`, 더 크면 `upcoming`.
2. `rain`, `hungry`, `tired`는 `current` 항목까지 그대로 두고 그 뒤를 다시 만든다. `closed`는 `current` 항목(닫힌 장소)부터 다시 만든다.
3. 새 일정이 검증까지 끝난 뒤에만 DB를 바꾼다. 실패하면 기존 일정이 그대로 남는다.
4. `closed`는 같은 요청 안에서 `place_reports`에 신고를 저장한다. 프론트가 `POST /places/{id}/report`를 따로 부르지 않는다.

요청 (비가 와요. 5번 항목에 있을 때)

```json
{ "reason": "rain", "current_order": 5 }
```

응답 200. 9.6의 예시 코스에서 6번(실외)이 실내 장소 2곳으로 바뀐다. `conditions.indoor_only`가 `true`가 된다.

```jsonc
{
  "id": "0b7f6c1e-5d1a-4c1e-9a55-2f3f1f2a9d10",
  "tier": "premium",
  "created_at": "2026-11-12T01:05:00Z",
  "user_profile": {
    // 나머지 키는 그대로
    "conditions": { "indoor_only": true, "low_walking": false }
  },
  "total_items": 7,
  "locked_count": 0,
  "items": [
    // 1~4번: 내용은 그대로이고 status만 "done"
    { "order": 5, "place_id": 11, "start_time": "13:55", "stay_min": 50, "move_method": "taxi", "move_min": 10, "status": "current" },
    { "order": 6, "place_id": 14, "start_time": "14:55", "stay_min": 60, "move_method": "walk", "move_min": 7, "status": "upcoming" },
    { "order": 7, "place_id": 12, "start_time": "16:10", "stay_min": 70, "move_method": "taxi", "move_min": 12, "status": "upcoming" }
  ]
}
```

위 예시는 줄여 쓴 것이다. 실제 응답의 각 항목에는 `reason_en`, `is_rest_stop`, `place`, `phrase_cards`가 모두 들어 있다. 14번은 Jeju Folklore & Natural History Museum, 12번은 Jeju National Museum이다 (둘 다 예시에서 `indoor`가 `true`).

이어서 문 닫았어요. 6번 항목(14번 장소)에 도착했는데 닫혀 있을 때의 요청

```json
{ "reason": "closed", "current_order": 6 }
```

응답 200의 항목

| `order` | `place_id` | 장소 (예시) | `start_time` | `stay_min` | `move_method` | `move_min` | `status` |
|---|---|---|---|---|---|---|---|
| 1~5 | 그대로 | 그대로 | 그대로 | 그대로 | 그대로 | 그대로 | done |
| 6 | 12 | Jeju National Museum (대체 장소) | 15:10 | 70 | taxi | 12 | current |
| 7 | 18 | Sample Café | 16:35 | 45 | taxi | 14 | upcoming |

- `place_reports`에 `place_id` 14, `type` `closed`로 1행이 생긴다.
- 대체 장소도 실내다. 앞에서 켜진 `indoor_only`가 유지되기 때문이다.
- 6번의 이동 정보는 닫힌 장소(사용자가 지금 서 있는 곳)에서 대체 장소까지다.

오류: 404 `COURSE_NOT_FOUND`, 404 `COURSE_ITEM_NOT_FOUND`, 409 `NO_CANDIDATES`, 502 `LLM_FAILED`.

### 9.8 `POST /places/{id}/report`

문 닫았어요 신고를 `place_reports`에 저장한다.

- 여행 모드의 "It's closed" 버튼은 이 엔드포인트를 부르지 않는다. 재구성이 같은 저장 함수를 안에서 부른다. 이 엔드포인트는 재구성 없이 신고만 남길 때 쓴다 (화면은 P2).
- MVP에서 신고는 기록만 한다. 신고된 장소를 다른 코스의 후보에서 빼지 않는다 (Q-18). 리허설에서 쌓인 신고가 데모 코스를 바꾸지 않게 하기 위해서다.

요청

```json
{ "type": "closed" }
```

응답 201

```json
{ "place_id": 14, "type": "closed", "created_at": "2026-11-13T06:02:10Z" }
```

오류: 404 `PLACE_NOT_FOUND`.

### 9.9 `POST /purchase`

결제 목업이다. 실제 결제는 없다. 코스의 `tier`를 `premium`으로 바꾸고 전체 코스를 돌려준다. 이미 `premium`이어도 200을 돌려준다.

요청

```json
{ "course_id": "0b7f6c1e-5d1a-4c1e-9a55-2f3f1f2a9d10" }
```

응답 200. `Course` 전체다.

```jsonc
{
  "id": "0b7f6c1e-5d1a-4c1e-9a55-2f3f1f2a9d10",
  "tier": "premium",
  "created_at": "2026-11-12T01:05:00Z",
  "user_profile": { /* 그대로 */ },
  "total_items": 6,
  "locked_count": 0,
  "items": [ /* 9.6 예시 코스의 6개 항목 전체 */ ]
}
```

오류: 404 `COURSE_NOT_FOUND`.

---

## 10. LLM 프롬프트 설계와 출력 JSON 스키마

### 10.1 파이프라인

팀이 정한 5단계다.

| 단계 | 하는 일 | 하는 주체 | 절 |
|---|---|---|---|
| 1 | 식단, 휴무일, 체력, 날씨(실내) 조건으로 1차 필터링 → 후보 15~20곳 | Python | 10.2 |
| 2 | 후보 장소와 사용자 프로필을 LLM에 넘기고 장소 ID, 순서, 체류 시간, 추천 이유를 JSON으로만 받는다 | LLM | 10.3, 10.4 |
| 3 | Pydantic으로 형식을 검증하고 DB에 없는 ID를 지운다 | Python | 10.5 |
| 4 | 좌표로 거리를 계산해 도보·택시 시간을 추정한다 | Python | 10.6 |
| 5 | Supabase에 저장하고 돌려준다 | Python | 9.5 |

재구성은 `status`가 `upcoming`인 항목만 지우고 조건을 바꿔 1~5를 다시 실행한다 (10.7).

역할을 나누는 원칙: LLM은 장소 고르기, 순서, 체류 시간, 추천 이유만 맡는다. ID 검증, 거리, 시각, 이동 방법은 Python이 계산한다.

### 10.2 1단계: 후보 필터링

| 규칙 | 조건 | 메모 |
|---|---|---|
| F-1 검증된 장소 | 환경 변수 `REQUIRE_VERIFIED`가 `true`면 `image_url`이나 `last_verified_at`가 비어 있는 장소를 뺀다 [제안] | 차별점 1을 코드로 지킨다. 데이터를 채우는 동안에는 `false`, 데모 전에 `true` |
| F-2 휴무일 | `closed_days`에 오늘 요일이 있으면 뺀다. 빈 배열이면 영업으로 본다 | 오늘은 한국 시간 기준이다. 서버 시간이 UTC일 수 있으니 변환한다 |
| F-3 식단 | `food_options`가 있는 장소에만 적용한다. `solo_ok = true`여야 한다 [제안]. `diet`가 `vegan`이면 `vegan = true`, `vegetarian`이면 `vegetarian = true` 또는 `vegan = true`, `halal`이면 `halal = true` | `food_options`가 없는 장소는 식단과 상관없이 통과한다 |
| F-4 체력 | `walking_level`이 허용 단계 이하여야 한다. 허용 단계는 `fitness_level`이다. `condition_today`가 `tired`이거나 `conditions.low_walking`이 `true`면 허용 단계는 1이다 [제안] | 숫자가 클수록 힘들다고 가정 (Q-04) |
| F-5 오르막 | `avoid_slopes`가 `true`면 `terrain = flat`만 남긴다 [제안] | |
| F-6 날씨 | `conditions.indoor_only`가 `true`면 `indoor = true`만 남긴다 | "비가 와요"를 누르면 켜진다 |
| F-7 점심 | `needs_lunch`가 `false`면 `category`가 `food`인 후보를 뺀다. 고정된 첫 정차는 예외다 [제안] | 식사가 두 번 들어가지 않게 한다 |
| F-8 재구성 때 제외 | `done`이나 `current`인 장소, 이번에 닫혔다고 신고한 장소를 뺀다 | |
| F-9 개수 | 20곳이 넘으면 `interests`에 있는 `category`를 먼저 남기고 20곳에서 자른다. `needs_lunch`가 `true`면 `food` 후보를 3곳 이상 남긴다 [제안] | |

후보가 모자랄 때 [제안]

- 후보가 2곳 미만이면 F-4의 허용 단계를 1 올려 한 번 더 필터링한다.
- 그래도 2곳 미만이면 409 `NO_CANDIDATES`를 돌려준다.
- 지금 데이터는 시드 20곳과 식당·카페 5곳 이상이다. 필터를 거치면 후보가 15곳보다 적은 경우가 많다. "15~20곳"은 위쪽 한도로 본다.

`needs_lunch` 규칙 [제안] (Q-08)

- 새 코스: 코스 시간대가 12:00~13:00을 포함하면 `true`.
- 재구성: `done`과 `current` 항목에 `category`가 `food`인 장소가 없고, 남은 시간대가 12:00~13:00을 포함하면 `true`.
- `hungry` 재구성: `false`. 대신 첫 정차를 식당으로 고정한다 (10.7).

### 10.3 LLM 입력

시스템 프롬프트(10.4)와 아래 JSON 하나를 보낸다. 온보딩이 모두 선택형이라 사용자가 직접 쓴 글은 들어가지 않는다.

새 코스의 입력

```json
{
  "traveler": {
    "interests": ["photo", "market", "cafe"],
    "fitness_level": 2,
    "max_walk_min": 20,
    "avoid_slopes": false,
    "condition_today": "normal",
    "diet": "vegan"
  },
  "trip": {
    "start_time": "10:00",
    "time_budget_min": 480,
    "min_items": 5,
    "max_items": 7,
    "needs_lunch": true,
    "indoor_only": false,
    "low_walking": false,
    "origin": null
  },
  "replan": null,
  "candidates": [
    {
      "id": 7,
      "name_en": "Yongduam Rock",
      "category": "photo",
      "description_en": "A seaside lava rock shaped like a dragon's head.",
      "lat": 33.5161,
      "lng": 126.5119,
      "avg_stay_min": 30,
      "walking_level": 1,
      "terrain": "flat",
      "indoor": false,
      "fatigue_score": 2,
      "food": null
    },
    {
      "id": 21,
      "name_en": "Sample Vegan Kitchen",
      "category": "food",
      "description_en": "Placeholder entry. Replace with a real, verified restaurant.",
      "lat": 33.5128,
      "lng": 126.5241,
      "avg_stay_min": 60,
      "walking_level": 1,
      "terrain": "flat",
      "indoor": true,
      "fatigue_score": 1,
      "food": {
        "solo_ok": true,
        "vegan": true,
        "vegetarian": true,
        "halal": false,
        "english_menu": true,
        "signature_menu_en": "Tofu bibimbap"
      }
    }
  ]
}
```

재구성일 때 달라지는 부분. 9.7의 "비가 와요" 예시다. `traveler`와 `candidates`의 형태는 같다.

```json
{
  "trip": {
    "start_time": "14:45",
    "time_budget_min": 195,
    "min_items": 1,
    "max_items": 2,
    "needs_lunch": false,
    "indoor_only": true,
    "low_walking": false,
    "origin": { "name_en": "Samseonghyeol", "lat": 33.5044, "lng": 126.5292 }
  },
  "replan": {
    "reason": "rain",
    "fixed_first_place_id": null,
    "keep_if_possible": []
  }
}
```

입력 값을 정하는 규칙

| 필드 | 새 코스 | 재구성 |
|---|---|---|
| `trip.start_time` | 요청의 `start_time`. 없으면 `"10:00"` | 10.7의 시작 시각 |
| `trip.time_budget_min` | `half_day`는 240, `full_day`는 480 [제안] (Q-06) | 코스 종료 시각 − `trip.start_time` |
| `trip.min_items`, `trip.max_items` | `half_day`는 3~4, `full_day`는 5~7 [제안] | 1 ~ (남은 분 ÷ 70을 내림한 값, 최소 1) [제안] |
| `trip.needs_lunch` | 10.2 | 10.2 |
| `trip.indoor_only`, `trip.low_walking` | 둘 다 `false` | `user_profile.conditions`의 값 |
| `trip.origin` | `null` | 10.7의 출발 위치 |
| `replan` | `null` | `reason`, `fixed_first_place_id`, `keep_if_possible` (10.7) |
| `candidates` | 10.2를 통과한 장소 | 10.2를 통과한 장소 |

- 코스 종료 시각 = 1번 항목의 `start_time` + 240분 또는 480분.
- `min_items`와 `max_items`는 후보 수보다 클 수 없다.

### 10.4 시스템 프롬프트

```text
You are a day-trip planner for solo foreign travelers in Jeju City, South Korea.
You receive one JSON object with "traveler", "trip", "replan" and "candidates".
Plan the stops and return JSON only.

Hard rules
1. Use only places from "candidates". Copy each "id" exactly into "place_id". Never invent a place or an id.
2. Use each place at most once.
3. Choose between trip.min_items and trip.max_items places.
4. The total of stay_min plus rough travel time between stops must fit within trip.time_budget_min.
5. If trip.needs_lunch is true, include exactly one place whose category is "food", placed so that it starts between 11:30 and 13:30.
6. If replan.fixed_first_place_id is set, that place must be the first item.
7. If replan.keep_if_possible is not empty, keep those places in that order unless another hard rule forbids it.

Preferences
8. Prefer categories listed in traveler.interests.
9. Order the stops so the route does not zigzag. Use lat and lng. If trip.origin is given, start near it.
10. If traveler.fitness_level is 1, traveler.condition_today is "tired", or trip.low_walking is true: prefer lower walking_level and fatigue_score, choose fewer stops, and include a rest stop (a cafe or a place to sit) with "is_rest_stop": true.
11. Keep stay_min close to the candidate's avg_stay_min.

Writing reason_en
12. One or two short sentences, at most 200 characters, in plain English, addressed to the traveler as "you".
13. Use only facts that appear in the input. Do not mention opening hours, prices, history, transport, travel time, or anything else that is not in the candidate data.

Output
Return only one JSON object in exactly this shape. No markdown, no code fence, no extra text.
{"items":[{"place_id":7,"order":1,"stay_min":30,"reason_en":"...","is_rest_stop":false}]}
```

### 10.5 출력 JSON 스키마와 검증

LLM 출력

```json
{
  "items": [
    {
      "place_id": 7,
      "order": 1,
      "stay_min": 30,
      "reason_en": "A seaside photo spot to start your day, on flat ground with very little walking.",
      "is_rest_stop": false
    },
    {
      "place_id": 3,
      "order": 2,
      "stay_min": 60,
      "reason_en": "You said you enjoy markets, and this one is close to your first stop.",
      "is_rest_stop": false
    },
    {
      "place_id": 21,
      "order": 3,
      "stay_min": 60,
      "reason_en": "A lunch stop with vegan dishes where you can order for one.",
      "is_rest_stop": false
    }
  ]
}
```

| 필드 | 타입 | 뜻 | 저장하는 컬럼 |
|---|---|---|---|
| `place_id` | integer | 후보의 `id` | `course_items.place_id` |
| `order` | integer, 1부터 | 방문 순서 | `course_items.order` |
| `stay_min` | integer | 체류 시간(분) | `course_items.stay_min` |
| `reason_en` | string | 추천 이유 | `course_items.reason_en` |
| `is_rest_stop` | boolean, 없으면 `false` | 쉬어 가는 정차 [제안] (Q-12) | `course_items.is_rest_stop` |

`start_time`, `move_method`, `move_min`, `status`는 LLM이 내지 않는다. 백엔드가 채운다.

Pydantic 모델

```python
from pydantic import BaseModel, Field

class LLMItem(BaseModel):
    place_id: int
    order: int = Field(ge=1)
    stay_min: int = Field(gt=0)
    reason_en: str = Field(min_length=1, max_length=300)
    is_rest_stop: bool = False

class LLMCourse(BaseModel):
    items: list[LLMItem] = Field(min_length=1)
```

검증과 후처리. 이 순서로 한다.

| 규칙 | 하는 일 |
|---|---|
| V-1 | 응답을 JSON으로 읽고 `LLMCourse`로 검증한다. 실패하면 10.8 |
| V-2 | `place_id`가 후보 목록에 없는 항목을 버린다. 후보는 DB에서 뽑았으므로 DB에 없는 ID도 여기서 걸러진다 |
| V-3 | 같은 `place_id`가 두 번 나오면 첫 번째만 남긴다 |
| V-4 | 고정된 첫 정차가 있으면 그 항목을 맨 앞에 둔다. LLM이 빠뜨렸으면 백엔드가 넣는다 (`stay_min`은 `avg_stay_min`, `reason_en`은 정해 둔 문장) |
| V-5 | `stay_min`이 10 미만이거나 240을 넘으면 그 장소의 `avg_stay_min`으로 바꾼다 [제안] |
| V-6 | `order` 순으로 정렬하고 번호를 다시 매긴다. 새 코스는 1부터, 재구성은 남겨 둔 마지막 항목의 다음 번호부터 |
| V-7 | 남은 항목이 0개면 실패로 본다. 10.8 |

### 10.6 4단계: 이동 방법과 시각 계산

상수 [제안]. 백엔드 설정 파일 한 곳에 둔다.

| 상수 | 값 | 뜻 |
|---|---|---|
| `DETOUR_FACTOR` | 1.3 | 직선거리를 실제 이동 거리로 보정하는 배수 |
| `WALK_M_PER_MIN` | 67 | 도보 속도 (약 4km/h) |
| `TAXI_M_PER_MIN` | 333 | 택시 속도 (약 20km/h) |
| `TAXI_EXTRA_MIN` | 5 | 택시를 잡고 타고 내리는 시간 |
| `HALF_DAY_MIN`, `FULL_DAY_MIN` | 240, 480 | 반나절과 하루의 길이(분) (Q-06) |
| `DEFAULT_START` | "10:00" | 코스 시작 시각 기본값 (Q-06) |

계산 규칙

1. 거리(m) = 두 좌표의 직선거리(하버사인) × `DETOUR_FACTOR`.
2. 도보(분) = 올림(거리 ÷ 67). 택시(분) = 올림(거리 ÷ 333) + 5.
3. 도보(분)가 `max_walk_min` 이하면 `walk`, 넘으면 `taxi`다.
4. 코스의 1번 항목은 `move_method`와 `move_min`이 `null`이고 `start_time`은 코스 시작 시각이다.
5. 그 뒤 항목의 `start_time` = 앞 항목의 `start_time` + 앞 항목의 `stay_min` + 이 항목의 `move_min`. 5분 단위로 올린다.
6. 재구성으로 새로 만든 첫 항목은 출발 위치(10.7)에서 오는 이동으로 계산한다.
7. 끝나는 시각이 코스 종료 시각을 넘는 항목은 뒤에서부터 뺀다. 1개는 남긴다.

검산. 9.6 예시 코스의 값이다 (`max_walk_min`은 20).

| 구간 | 보정 거리 | 도보 | 택시 | 결과 | 도착 시각 계산 | `start_time` |
|---|---|---|---|---|---|---|
| 1 → 2 | 2,029m | 31분 | 12분 | taxi 12 | 10:30 + 12 = 10:42 | 10:45 |
| 2 → 3 | 484m | 8분 | 7분 | walk 8 | 11:45 + 8 = 11:53 | 11:55 |
| 3 → 4 | 300m | 5분 | 6분 | walk 5 | 12:55 + 5 = 13:00 | 13:00 |
| 4 → 5 | 1,601m | 24분 | 10분 | taxi 10 | 13:45 + 10 = 13:55 | 13:55 |
| 5 → 6 | 2,723m | 41분 | 14분 | taxi 14 | 14:45 + 14 = 14:59 | 15:00 |

### 10.7 재구성 조건표

| | `rain` | `tired` | `hungry` | `closed` |
|---|---|---|---|---|
| 그대로 두는 항목 | `done`, `current` | `done`, `current` | `done`, `current` | `done` |
| 다시 만드는 범위 | `current` 다음부터 | `current` 다음부터 | `current` 다음부터 | `current` 항목부터 (닫힌 장소를 지운다) |
| 시작 시각 | `current`의 `start_time` + `stay_min` | 왼쪽과 같음 | 왼쪽과 같음 | `current`의 `start_time` |
| 출발 위치 | `current` 장소 | `current` 장소 | `current` 장소 | 닫힌 장소 (사용자가 지금 서 있는 곳) |
| 바뀌는 조건 | `conditions.indoor_only = true` | `conditions.low_walking = true` | 없음 | 닫힌 장소를 후보에서 뺀다 |
| 조건이 이후에도 남는가 | 남는다 | 남는다 | 해당 없음 | 닫힌 장소는 이 코스에서 계속 빠진다 |
| 고정된 첫 정차 | 없음 | 없음 | 출발 위치에서 가장 가까운 `food` 후보 | 출발 위치에서 가장 가까운, 닫힌 장소와 같은 `category`의 후보. 없으면 `category`와 상관없이 가장 가까운 후보 |
| 추가로 하는 일 | 없음 | 없음 | 고정한 식당 외의 `food` 후보를 뺀다 | `place_reports`에 저장. 새 첫 항목의 `status`는 `current` |

- 이 표의 "남는다", 출발 위치, 고정된 첫 정차는 [제안]이다 (Q-09, Q-10, Q-17).
- 조건이 남는 이유: 데모에서 "비가 와요" 다음에 "문 닫았어요"를 누른다. 조건이 남지 않으면 비가 오는데 실외 장소가 대체 장소로 나올 수 있다.
- 고정된 첫 정차는 Python이 거리로 고른다. F-7(점심)을 적용하기 전의 후보에서 고른다. 닫힌 곳이 식당이면 대체 장소도 식당이어야 하기 때문이다. LLM은 그 장소를 첫 항목에 두고 추천 이유를 쓴다. 고를 후보가 없으면 409 `NO_CANDIDATES`다.
- `keep_if_possible`: 기존 `upcoming` 항목의 장소 중 새 필터를 통과한 것을 원래 순서대로 넣는다. 재구성 때마다 일정이 통째로 바뀌는 것을 줄인다.

처리 순서

1. 코스와 항목을 읽는다. 코스가 없으면 404 `COURSE_NOT_FOUND`, `current_order`가 없는 값이면 404 `COURSE_ITEM_NOT_FOUND`.
2. `current_order`로 각 항목의 새 `status`를 계산한다 (아직 저장하지 않는다).
3. 위 표로 조건, 시작 시각, 출발 위치, 고정된 첫 정차를 정한다.
4. 10.2 → 10.3 → 10.4 → 10.5 → 10.6을 실행해 새 항목을 만든다.
5. 성공했을 때만 DB를 바꾼다: `status` 저장, `user_profile.conditions` 저장, 기존 `upcoming` 항목 삭제(`closed`는 `current` 항목도 삭제), 새 항목 삽입, `closed`는 신고 저장.
6. `Course`를 돌려준다. 4에서 실패하면 DB를 바꾸지 않고 오류를 돌려준다.

### 10.8 실패 처리

| 상황 | 처리 |
|---|---|
| LLM 호출이 20초 안에 끝나지 않거나 오류가 난다 [제안] | 1번 다시 시도한다 |
| JSON으로 읽을 수 없거나 Pydantic 검증에 실패한다 | 1번 다시 시도한다 |
| 검증 뒤 남은 항목이 0개다 | 1번 다시 시도한다 |
| 다시 시도해도 실패한다 | 502 `LLM_FAILED`. DB를 바꾸지 않는다 |
| (P1) 규칙 기반 대체 [제안] | 다시 시도해도 실패하면 후보를 `interests` 일치, `fatigue_score` 낮은 순으로 정렬해 `max_items`개를 고른다. `stay_min`은 `avg_stay_min`, `reason_en`은 정해 둔 문장으로 채운다 |
| 발표 중 지연 | Emma 코스를 미리 저장해 둔다 (13.5) |

LLM 설정 [제안]: temperature를 낮게(예: 0.3) 두어 결과가 덜 흔들리게 한다. 제공자가 JSON 출력 모드나 구조화 출력을 지원하면 쓴다. 제공자와 모델은 정해지지 않았다 (Q-03).

---

## 11. 비기능 요구사항

### 11.1 성능

목표값은 [제안]이다.

| 항목 | 목표 |
|---|---|
| `GET /places`, `GET /courses/{id}`, `POST /purchase`, `POST /places/{id}/report` | 배포 환경에서 1초 이내 |
| `POST /courses`, `POST /courses/{id}/replan` | 15초 이내. LLM 타임아웃 20초에 재시도 1번이라 가장 느리면 40초쯤이다 |
| 프론트의 요청 대기 한도 | 45초. 넘으면 오류 화면 |
| 로딩 표시 | 요청을 보내자마자 보인다. LLM을 부르는 두 요청은 6.2, 6.4의 로딩 문구를 쓴다 |
| 장소 사진 | 긴 변 1200px 이하, 300KB 이하로 줄여서 올린다 |
| 지도 배경 | 500KB 이하 |

### 11.2 보안

- 프론트는 FastAPI만 호출한다. Supabase와 LLM을 브라우저에서 직접 부르지 않는다.
- CORS: 백엔드는 허용 출처를 환경 변수 `ALLOWED_ORIGINS`로 받는다 [제안]. Vercel 운영 주소와 `http://localhost:3000`을 넣는다. Vercel 미리보기 배포는 주소가 배포마다 달라 CORS에 걸리므로 확인은 운영 주소에서 한다.
- 무료 3곳 제한은 서버에서 자른다. 가려진 항목을 응답에 넣고 프론트에서 숨기는 방식으로 만들지 않는다.
- 결제 목업은 실제 결제 정보를 받지 않는다. 카드 번호 입력란을 만들지 않는다.
- LLM에는 온보딩 선택값만 들어간다. 요청 값은 Pydantic으로 허용된 값인지 검증한다.
- Supabase의 모든 테이블에 RLS를 켜고 정책은 만들지 않는다 [제안]. 백엔드는 service key로 접근하므로 영향이 없고, 다른 키로는 읽거나 쓸 수 없다.
- `place-images` 버킷은 공개 읽기로 둔다 [제안]. 프론트가 `image_url`을 이미지 주소로 바로 쓴다.
- 이름, 이메일, 연락처를 받지 않는다. `user_profile`에는 온보딩 선택값만 저장한다.
- 로그에 키를 남기지 않는다.

### 11.3 키 관리와 환경 변수

| 위치 | 변수 | 내용 |
|---|---|---|
| Vercel | `NEXT_PUBLIC_API_URL` | Railway의 FastAPI 주소. Vercel에는 이것만 둔다 |
| Railway | `SUPABASE_URL` | Supabase 프로젝트 주소 |
| Railway | `SUPABASE_SERVICE_KEY` | Supabase service key |
| Railway | `LLM_API_KEY` | LLM 키 |
| Railway | `LLM_MODEL` | 모델 이름 (Q-03) |
| Railway | `ALLOWED_ORIGINS` | CORS 허용 출처 |
| Railway | `REQUIRE_VERIFIED` | 후보 필터 F-1을 켤지 (`true`, `false`) |

`NEXT_PUBLIC_API_URL` 외의 변수 이름은 [제안]이다. B가 정하고 이 표를 고친다.

- `NEXT_PUBLIC_`으로 시작하는 값은 브라우저에 그대로 드러난다. 키에는 이 접두사를 쓰지 않는다.
- Supabase service key와 LLM 키는 Railway에만 둔다. 프론트 코드, 저장소, 채팅방에 붙여 넣지 않는다.
- `.env`는 `.gitignore`에 넣는다. 변수 이름만 적은 `.env.example`을 저장소에 둔다.
- 키가 저장소에 올라갔으면 지우는 것으로 끝내지 않고 바로 새 키로 바꾼다.

---

## 12. 역할 분담과 이틀 일정

### 12.1 역할 분담

| 담당 | 맡는 것 | 주요 산출물 | 스토리 |
|---|---|---|---|
| A 프론트 | 화면, 일러스트 지도, 재구성 버튼, 결제 목업 | `frontend/`의 화면 5개, 지도 컴포넌트와 `config/map.ts`, 대체 SVG | US-01, 03, 04, 05, 06, 07, 08, 12와 US-09~11의 화면 |
| B 백엔드 | 엔드포인트, 필터링·프롬프트·검증 | `backend/`의 엔드포인트 6개, 필터링, 프롬프트, 검증, 시간 계산 | US-02, 09, 10, 11, 12 |
| C 데이터·기획 | Supabase 테이블, 시드 데이터, 사진, 데모 시나리오, 발표 자료 | `data/`의 시드와 초기화 스크립트, `place-images`의 사진, Emma 데모 코스, 발표 자료 | US-14, 15와 US-05, 06의 데이터 |

### 12.2 함께 지킬 작업 규칙 [제안]

1. **가짜 응답 먼저.** Day 1 오전에 B가 9장의 예시 JSON을 그대로 돌려주는 엔드포인트 6개를 먼저 배포한다. A는 처음부터 배포된 API 주소로 화면을 만들고, B는 그 뒤에서 진짜 로직으로 바꾼다.
2. **문서 먼저.** 필드명이나 구조를 바꿔야 하면 이 문서(8·9·10장)를 먼저 고치고 팀에 알린 뒤 코드를 바꾼다.
3. **폴더를 나눠 쓴다.** A는 `frontend/`, B는 `backend/`, C는 `data/`만 고친다. main에 push하면 바로 배포되므로 깨진 상태로 push하지 않는다.
4. **배포 설정.** Vercel 프로젝트의 Root Directory는 `frontend`, Railway 서비스의 Root Directory는 `backend`로 잡는다.
5. **기능 동결 뒤에는** 버그와 문구만 고친다. 동작하지 않는 P1 버튼과 영역은 숨긴다.

### 12.3 Day 1

| 시간대 | A | B | C | 끝났는지 보는 기준 |
|---|---|---|---|---|
| 첫 1시간 | Next.js 빈 프로젝트를 Vercel에 배포. `GET /places`를 불러 장소 수를 보여주는 임시 화면 | FastAPI 빈 프로젝트를 Railway에 배포. `GET /places`가 Supabase를 읽어 응답. CORS 설정 | Supabase 프로젝트, 테이블 7개, 시드 20곳 올리기, `place-images` 버킷 | US-13 완료 |
| 오전 | 랜딩, 온보딩 5단계 (US-01) | 나머지 엔드포인트를 가짜 응답으로 배포. 이어서 후보 필터링 (10.2) | 식당·카페 5곳 이상 조사와 입력. 사진 모으기 시작 (데모에 쓸 장소부터) | 배포된 화면에서 온보딩을 마치면 가짜 응답으로 결과 화면까지 넘어간다 |
| 오후 | 결과 페이지: 타임라인 카드, 사진·출처·확인일, 식당 배지 (US-03, 05, 06). 지도: 대체 SVG와 마커 (US-04) | LLM 프롬프트, 검증, 시간 계산, 저장 (US-02). `GET /courses/{id}`와 무료 3곳 (US-11) | 사진·출처·확인일 입력 계속. Emma 프로필과 데모 코스 초안 | `POST /courses`가 실제 LLM으로 코스를 만든다 |
| 저녁까지 | 전원이 배포 환경에서 온보딩 → 코스 생성 → 결과 화면을 끝까지 돌려 본다 | | | G1 달성 |

### 12.4 Day 2

| 시간대 | A | B | C | 끝났는지 보는 기준 |
|---|---|---|---|---|
| 오전 | 여행 모드와 재구성 버튼 (US-08, US-09·10의 화면). Show to driver (US-07). 지도 번호와 점선 (US-04 마무리). 문장 카드 (US-18) | 재구성: 비가 와요, 문 닫았어요와 신고 저장 (US-09, 10). 이어서 배고파요, 피곤해요 (US-16, 17) | 문장 카드 데이터. Emma 코스 사전 저장과 초기화 스크립트 (US-15). 데모 데이터 조건 점검 (13.4). 발표 자료 | 배포 환경에서 비가 와요 → 문 닫았어요가 이어서 동작한다 |
| 오후 초반 | 구매 화면과 잠금 카드 (US-12, US-11의 화면). 디자인 정리. 일러스트가 준비됐으면 적용 (US-20) | `POST /purchase` (US-12). 오류 응답과 타임아웃 점검. `REQUIRE_VERIFIED`를 `true`로 | 발표 자료 마무리. ChatGPT 비교 자료 | 구매 뒤 전체 코스가 열린다 |
| 오후 후반 | 기능 동결. 전원이 데모 리허설을 2번 이상 하고 13.6을 점검한다 | | | G2 달성 |

실제 시작 시각, 기능 동결 시각, 발표 시각은 정해지지 않았다 (Q-26).

---

## 13. 데모 시나리오

### 13.1 페르소나

Emma, 34세, 독일인, 혼자 여행 중. 비건이고 사진을 좋아한다. 제주시에서 하루를 보낸다.

| `user_profile` 키 | 값 | 근거 |
|---|---|---|
| `diet` | `vegan` | 비건 |
| `interests` | `photo`를 포함 | 사진을 좋아함 |
| `duration` | `full_day` | 제주시에서 하루 |
| 나머지 키 | 미정 | C가 정한다 (Q-25) |

### 13.2 시연 순서

팀이 정한 4단계다.

| 단계 | 보여주는 것 | 화면과 조작 | 필요한 것 |
|---|---|---|---|
| 1 | 같은 조건의 ChatGPT 결과와 우리 결과 비교. 우리 쪽은 실제 사진, 출처, 확인일이 있다 | 발표 자료의 ChatGPT 결과 → 결과 페이지의 타임라인 카드 | ChatGPT 비교 자료, 미리 저장한 Emma 코스 (US-15), US-03, US-05 |
| 2 | 점심 식당 카드의 "1인분 OK · 비건 · 영어 메뉴" 배지. 이동할 때 "Show to driver" 카드 | 결과 페이지에서 점심 카드의 배지 → 택시로 가는 장소 카드의 "Show to driver" | US-06, US-07 |
| 3 | 오후 3시 "비가 와요" → 실내 코스로 변경. 이어서 "문 닫았어요" → 대체 장소로 교체 | 여행 모드에서 "Done, next stop"으로 오후 3시 무렵 일정까지 이동 → "It's raining" → "Done, next stop" → "It's closed" | US-08, US-09, US-10 |
| 4 | 프리미엄 구매로 마무리 | 구매 화면 → "Pay now" → 전체 코스 | US-11, US-12 |

ChatGPT 결과는 발표 중에 직접 돌리지 않고 미리 받아 둔 자료를 쓴다 [제안]. Emma와 같은 조건으로 물은 결과여야 한다. "없는 장소가 들어 있다"처럼 사실을 말하려면 직접 확인한 사례만 쓴다.

### 13.3 순서 충돌 (결정 필요)

무료 코스는 3곳까지만 돌려준다. 하루 코스에서 오후 3시 일정은 보통 네 번째 이후다. 그래서 구매(4단계)보다 앞에 있는 3단계에서 오후 3시 일정과 재구성 결과가 화면에 나오지 않는다. 아래 중 하나를 정해야 한다 (Q-01).

| 안 | 내용 | 바뀌는 것 |
|---|---|---|
| 가 | 구매를 3단계 앞으로 옮긴다 (1 → 2 → 구매 → 3) | 시연 순서만 바뀐다. 마지막 장면이 재구성이 된다 |
| 나 | 순서를 유지하고 Emma 코스를 처음부터 `premium`으로 저장한다. 4단계에서는 구매 화면만 보여준다 | 4단계에 잠긴 일정이 열리는 장면이 없다 |
| 다 | 무료의 범위를 바꾼다. 예: 무료도 전체 코스를 보고 재구성과 문장 카드만 프리미엄으로 둔다 | 수익 모델과 무료 3곳 규칙(9.6)이 바뀐다 |

임시 기본값은 "가"다. "가"와 "나"는 코드가 같다. 여행 모드와 재구성에는 `tier` 검사를 넣지 않고, 무료 제한은 응답에서 3곳만 돌려주는 한 군데에만 둔다.

### 13.4 데모가 성립하려면 필요한 데이터 조건 (C)

- [ ] Emma 코스에 `category`가 `photo`인 장소가 1곳 이상 있다
- [ ] 점심 식당의 `food_options`에서 `solo_ok`, `vegan`, `english_menu`가 모두 `true`다 (배지 3개가 한 카드에 보여야 한다)
- [ ] Emma 코스에 `move_method`가 `taxi`인 구간이 1개 이상 있다 (Show to driver를 자연스럽게 보여준다)
- [ ] 오후 3시 무렵 뒤의 일정에 `indoor`가 `false`인 장소가 1곳 이상 있다 (비가 와요로 일정이 바뀌는 것이 보여야 한다)
- [ ] Emma의 필터(10.2)를 통과하고 `indoor`가 `true`이며 오후 3시 전 일정에 없는 장소가 3곳 이상 있다 (비가 온 뒤 일정을 채우고, 그중 한 곳이 닫혀도 실내 대체 장소가 남아야 한다)
- [ ] Emma 코스와 재구성 결과에 나올 수 있는 모든 장소에 `image_url`, `image_source`, `last_verified_at`가 있다
- [ ] 문장 카드를 보여줄 거면 시장 장소에 문장 카드가 1장 이상 있다

### 13.5 사전 저장과 초기화

- Emma 코스를 정해진 ID로 `courses`와 `course_items`에 미리 넣어 둔다. `/course/{그 ID}`를 열면 LLM을 부르지 않고 바로 보인다.
- 초기화 스크립트는 `data/` 아래에 둔다. Emma 코스를 지우고 처음 상태로 다시 넣는다. 재구성과 구매를 하면 코스가 바뀌므로 리허설과 발표 직전마다 실행한다.
- 저장한 코스에는 발표용 기기의 북마크로 들어간다 [제안]. 화면에 따로 링크를 만들지 않는다 (Q-25).
- 3단계의 재구성은 발표 중에도 LLM을 부른다. 미리 저장한 코스만으로는 이 구간의 지연을 막지 못한다 (14장 R-01).

### 13.6 발표 직전 점검

- [ ] 초기화 스크립트를 실행했다
- [ ] `REQUIRE_VERIFIED`가 `true`다
- [ ] 발표용 기기에서 Emma 코스 주소와 여행 모드 주소가 열린다
- [ ] 발표장의 네트워크에서 배포 주소가 열린다
- [ ] 백엔드를 미리 한 번 호출해 두었다 (`GET /places`)
- [ ] ChatGPT 비교 자료가 발표 자료에 들어 있다
- [ ] 전체 흐름을 녹화한 백업 영상이 발표용 기기에 있다 [제안]

### 13.7 문제가 생기면

| 상황 | 대응 |
|---|---|
| 새 코스 생성이 느리다 | 미리 저장한 Emma 코스를 연다 |
| 재구성이 실패하거나 느리다 | Retry를 한 번 누른다. 그래도 안 되면 백업 영상으로 넘어간다 |
| 배포 주소가 열리지 않는다 | 백업 영상으로 넘어간다 |

---

## 14. 리스크와 대응

| ID | 리스크 | 영향 | 대응 | 담당 |
|---|---|---|---|---|
| R-01 | 발표 중 LLM이 느리거나 실패한다 | 코스 생성과 재구성이 멈춘다 | Emma 코스 사전 저장 (13.5). 타임아웃과 재시도 (10.8). 재구성 구간은 백업 영상. 여유가 되면 규칙 기반 대체 (US-22) | B, C |
| R-02 | LLM이 없는 ID나 틀린 형식을 돌려준다 | 없는 장소가 코스에 들어가 차별점 1이 깨진다 | 후보 대조와 Pydantic 검증 (10.5), 재시도 | B |
| R-03 | 추천 이유(`reason_en`)에 사실과 다른 내용이 들어간다 | 실제 정보만 보여준다는 약속이 깨진다 | 프롬프트 규칙 13(입력에 있는 사실만), 글자 수 제한. 데모 코스의 문구는 사람이 읽고 확인한다 | B, C |
| R-04 | 2015년 기준 데이터라 폐업하거나 바뀐 장소가 있다 | 닫힌 곳을 추천한다 | 데모에 쓸 장소부터 확인하고 `last_verified_at`를 채운다. 확인된 곳만 후보에 넣는다 (F-1) | C |
| R-05 | 사진 확보가 늦어진다 (공공 데이터 이용 신청, 장소와 사진 맞추기, 이용 조건 확인) | 사진 없는 카드가 생겨 차별점 1이 약해진다 | Day 1 오전에 시작한다. 데모 장소를 먼저 채운다. 사진 없는 장소는 F-1로 후보에서 뺀다 | C |
| R-06 | 필터 뒤 후보가 모자란다 (특히 비건, 실내만) | 409가 나거나 일정이 한두 곳뿐이다 | 13.4의 데이터 조건을 먼저 맞춘다. 허용 단계 완화 (10.2) | C, B |
| R-07 | 프론트와 백엔드의 필드가 어긋난다 | 연결하는 데 시간을 잃는다 | 가짜 응답 먼저, 문서 먼저 (12.2) | A, B |
| R-08 | 배포, CORS, 환경 변수에서 막힌다 | Day 1 목표(G1)가 밀린다 | 첫 1시간에 US-13을 끝낸다. 확인은 Vercel 운영 주소에서 한다 | 전원 |
| R-09 | 사진이 화면에 뜨지 않는다 | 차별점 1을 보여줄 수 없다 | 버킷을 공개 읽기로 둔다. Next.js 이미지 컴포넌트를 쓰면 Supabase 주소를 허용 목록에 넣어야 한다. 일반 `<img>`를 써도 된다 | A, C |
| R-10 | 일러스트가 늦어진다 | 지도 배경이 없다 | 대체 SVG를 먼저 만든다 (7.8). 일러스트는 경로만 바꿔 적용한다 | A |
| R-11 | 원도심에 마커가 몰려 겹치거나, 범위 밖 장소가 있다 | 지도를 읽기 어렵다 | 7.10 | A, C |
| R-12 | 무료 3곳 제한과 데모 순서가 충돌한다 | 3단계가 화면에 나오지 않는다 | 13.3, Q-01 | 전원 |
| R-13 | 재구성할 때마다 일정이 크게 달라진다 | 리허설과 발표의 결과가 다르다 | 낮은 temperature, `keep_if_possible`, 고정된 첫 정차는 Python이 고른다 (10.7) | B |
| R-14 | 리허설로 데모 데이터가 바뀐다 | 발표 때 코스가 이미 재구성되거나 구매된 상태다 | 초기화 스크립트 (13.5) | C |
| R-15 | 서버 시간이 UTC라 요일과 시각이 어긋난다 | 휴무일 필터가 틀린다 | 한국 시간으로 바꿔 계산한다 (F-2). `start_time`은 문자열로 다룬다 | B |
| R-16 | 범위가 넘친다 | P0가 끝나지 않는다 | P0를 먼저 끝낸다. P1은 4.2의 순서대로 한다. 기능 동결을 지킨다 | 전원 |

---

## 15. 미정 사항

"임시 기본값"은 답이 나오기 전까지 개발에 쓰는 값이다. 기본값이 "없음"인 항목은 답이 있어야 진행할 수 있다.

### 15.1 개발을 시작하기 전에 정할 것

| ID | 질문 | 임시 기본값 | 영향 받는 곳 | 정할 사람 |
|---|---|---|---|---|
| Q-01 | 무료 코스는 3곳만 돌려주는데 데모는 구매(4단계) 전에 오후 3시 재구성(3단계)을 보여준다. 13.3의 가, 나, 다 중 무엇으로 맞출까? | "가". 구매를 3단계 앞으로 옮긴다. 여행 모드와 재구성에는 `tier` 검사를 넣지 않는다 | 13장, 6.4, 9.6 | 전원 |
| Q-02 | 온보딩 5단계의 선택지와 `user_profile` 키를 6.2와 8.9의 제안대로 확정할까? | 제안대로 | 6.2, 8.9, 9.5, 10.2 | A, B, C |
| Q-03 | LLM은 어느 제공자의 어떤 모델을 쓰나? JSON 출력 모드를 지원하나? | 없음 | 10.8, 11.3 | B |
| Q-04 | 시드 파일에서 확인할 3가지. (1) `places.id`의 형식은? (2) `walking_level`과 `fatigue_score`는 숫자가 클수록 힘든 것이 맞나? (3) 20곳이 모두 지도 범위 안에 있나? | (1) 정수 (2) 맞다고 가정 (3) 범위 밖 장소는 DB에 넣지 않는다 | 7.10, 8.2, 8.3, 10.2, 9장의 예시 값 | C |
| Q-05 | `course_items.order`는 SQL 예약어다. 이름을 그대로 쓸까, 바꿀까? | 그대로 쓰고 SQL에서는 `"order"`로 감싼다 | 8.7, 9.3, 10.5 | B, C |
| Q-06 | 코스는 몇 시에 시작하고, 반나절과 하루는 각각 몇 시간인가? | 10:00에 시작, 반나절 4시간, 하루 8시간 | 9.5, 10.3, 10.6 | C |

### 15.2 기본값으로 개발하고 Day 1 안에 확인할 것

| ID | 질문 | 임시 기본값 | 영향 받는 곳 | 정할 사람 |
|---|---|---|---|---|
| Q-07 | "걷기 가능 시간"은 한 번에 이어서 걷는 시간인가, 하루에 걷는 시간의 합인가? | 한 번에 이어서 걷는 시간. 도보와 택시를 가르는 기준으로 쓴다 | 6.2, 8.9, 10.6 | C |
| Q-08 | 코스에 점심 식당을 항상 넣나? | 코스 시간대가 12:00~13:00을 포함하면 1곳 넣는다 | 10.2 | C |
| Q-09 | "문 닫았어요"는 현재 일정의 장소만 신고하나? 신고 저장은 재구성 요청 안에서 하나? | 둘 다 그렇다. 프론트는 재구성만 호출한다 | 6.4, 9.7, 9.8, 10.7 | A, B |
| Q-10 | "비가 와요"와 "피곤해요"로 켜진 조건을 그 뒤 재구성에도 계속 적용하나? 끄는 방법이 필요한가? | 계속 적용한다. 끄는 버튼은 만들지 않는다 | 8.9, 10.7 | B |
| Q-11 | 현재 일정은 어떻게 정하나? 사용자가 누르는 방식인가, 시계 기준인가? | 사용자가 "Done, next stop"을 누른다. 발표가 실제 오후 3시에 열리지 않으므로 시계 기준은 데모에 맞지 않는다 | 6.4, 9.7 | A |
| Q-12 | `is_rest_stop`은 누가 어떤 기준으로 채우나? | LLM 출력에 넣는다 | 8.7, 10.4, 10.5 | B |
| Q-13 | 지도 범위 밖의 장소는 어떻게 하나? | DB에 넣지 않는다. 프론트는 범위 밖 좌표를 그리지 않는다 | 7.10, 8.10 | C, A |
| Q-14 | `opening_hours`, `closed_days`, `price_level`, `allergens`의 형식은? | `closed_days`만 `mon`~`sun` 배열로 정해 필터에 쓴다. 나머지는 형식을 정할 때까지 화면에 쓰지 않는다 | 8.2, 8.4, 10.2 | C |
| Q-15 | "마지막 확인일"은 무엇을 어떻게 확인한 날인가? 영업 여부를 어디서 확인하면 확인한 것으로 보나? | 없음. 발표에서 확인 방법을 설명할 수 있어야 한다 | 8.2, 14장 R-04 | C |
| Q-16 | 사진 출처(`image_source`)를 어떤 형식으로 적나? 사진마다 이용 조건을 어떻게 확인하나? | 출처 기관 이름을 영어로 적는다. 이용 조건은 사진을 받을 때 확인한다 | 6.3, 8.2 | C |
| Q-17 | "배고파요"와 "문 닫았어요"는 남은 일정 전체를 LLM으로 다시 만드나, 식당 하나 끼우기와 한 곳 바꾸기만 규칙으로 처리하나? | 팀이 정한 대로 LLM으로 다시 만들고 첫 정차만 Python이 고정한다. 규칙만으로 처리하면 더 빠르고 결과가 일정하다 | 10.7 | B |
| Q-18 | 신고가 쌓인 장소를 다른 코스의 후보에서 빼나? | 빼지 않는다. 기록만 한다 | 9.8, 10.2 | B, C |

### 15.3 발표 전까지 정할 것

| ID | 질문 | 임시 기본값 | 영향 받는 곳 | 정할 사람 |
|---|---|---|---|---|
| Q-19 | 프리미엄의 가격과 통화는? | 없음. 화면은 설정 상수 `PREMIUM_PRICE_LABEL` 한 곳에서 읽는다 | 6.5 | C |
| Q-20 | 프리미엄이 "무제한 재구성"이면 무료는 몇 번까지인가? | MVP는 횟수 제한을 만들지 않는다 | 4.3, 6.5 | C |
| Q-21 | 아직 만들지 않는 혜택(오프라인 PDF)과 잠긴 혜택(문장 카드)을 화면에 어떻게 적나? | 오프라인 PDF는 "Coming soon", 문장 카드는 무료에서 잠금 줄 | 6.3, 6.5 | A, C |
| Q-22 | 지도 일러스트는 누가 어떤 방법으로 그리나? AI 생성 이미지를 쓰지 않는다는 원칙이 지도 그림에도 적용되나? | 없음. 정해질 때까지 대체 SVG를 쓴다 | 7.8, 7.9 | A, C |
| Q-23 | 결과 지도에 코스에 없는 장소의 마커도 보여주나? | 작고 흐리게 보여준다 | 7.5 | A |
| Q-24 | 기준 화면 크기는? 발표는 어떤 화면으로 하나? | 모바일 폭 기준. 넓은 화면에서는 가운데에 같은 폭으로 | 6.0 | A |
| Q-25 | 데모 준비. Emma의 나머지 프로필 값은? 저장한 코스에는 어떻게 들어가나? ChatGPT 비교는 어떻게 보여주나? | 프로필은 C가 정한다. 북마크로 들어간다. ChatGPT 결과는 미리 받아 둔 자료를 쓴다 | 13장 | C |
| Q-26 | 실제 시작 시각, 기능 동결 시각, 발표 시각은? | 없음 | 12장 | 전원 |

### 15.4 담당자가 바꿔도 되는 것

영어 문구, 화면 경로, 아이콘, 파일 위치, 환경 변수 이름, 이동 시간 상수, 성능 목표는 [제안]이다. 담당자가 바꿔도 되고, 바꾸면 이 문서를 고친다.

