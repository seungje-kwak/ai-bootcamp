# MyPace Jeju 시드 데이터 (관광지 20곳 + 식당·카페 7곳)

원본: `제주특별자치도_제주도장소(POI)데이터_20151231.csv` (74,440행) 에서 제주시 관광지 20곳을 골랐어요.
원본에 없는 필드는 2026-11-11 기준으로 인터넷(공식 사이트, VisitJeju, 한국관광공사 TourAPI·무장애여행, Wikimedia Commons 등)에서 조사했어요.

## 파일
| 파일 | Supabase 테이블 | 행 수 |
|---|---|---|
| `places.csv` | `places` | 27 (관광지 1~20, 식당·카페 21~27) |
| `place_accessibility.csv` | `place_accessibility` | 27 |
| `food_options.csv` | `food_options` | 7 |
| `phrase_cards.csv` | `phrase_cards` | 50 (place_id 빈칸 = 공통 카드) |
| `place_sources.csv` | (참고용, 업로드 안 해도 됨) | 장소별 출처 URL·불확실한 점 메모 |
| `poi_selected_20.csv` | – | 원본 POI 20행 그대로 |
| `research/*.json` | – | 조사 원본. CSV는 `build_seed.py` 로 다시 만들 수 있어요 |

다시 생성: `..\..\..\day2\vjeju\Scripts\python.exe build_seed.py` (day2 가상환경 재사용, 표준 라이브러리만 사용)

## 고른 20곳
1 용두암 · 2 제주목관아 · 3 삼성혈 · 4 국립제주박물관 · 5 민속자연사박물관 · 6 동문재래시장 · 7 사라봉공원 · 8 도두봉 · 9 이호테우해변 · 10 한라수목원 · 11 제주도립미술관 · 12 함덕해수욕장 · 13 제주4·3평화공원 · 14 절물자연휴양림 · 15 김만덕객주 · 16 넥슨뮤지엄 · 17 제주돌문화공원 · 18 제주시민속오일시장 · 19 노루생태관찰원 · 20 칠성로상점가

실내(비 오는 날 대체용): 4, 5, 11, 16 / 반실내: 6, 10, 13, 17, 18, 20

## 필드별 출처
| 필드 | 출처 |
|---|---|
| `poi_id`, `lat`, `lng` | 원본 POI CSV (2015년 좌표 그대로) |
| `name_ko`, `name_en`, `address_ko`(도로명), `description_en`, `category`, `phone`, `official_url` | 인터넷 조사 (원본 지번 주소는 `poi_selected_20.csv`에 보존) |
| `opening_hours`, `closed_days`, `price_level`, `admission_adult_krw` | 공식 사이트 > VisitJeju > 한국관광공사 순으로 우선 |
| `image_url`, `image_source` | 한국관광공사 TourAPI 대표이미지(tong.visitkorea.or.kr), Wikimedia Commons, VisitJeju CDN |
| `has_stairs`, `wheelchair_ok`, `has_seating`, `restroom` | 한국관광공사 무장애여행, VisitJeju 무장애 정보, 휠내비 등. **확인 못 한 값은 빈칸(null)** |
| `avg_stay_min`, `walking_level`, `fatigue_score` | 조사 기반 추정치 (코스 생성용) |
| `last_verified_at` | **빈칸.** 팀원이 확인한 날짜를 기입 |
| `food_options` 전체, 식당·카페 `places` 21~27 | 인터넷 조사 (HappyCow, VisitJeju 무슬림 가이드, DiningCode 등) |
| `phrase_cards` | 직접 작성 |

### boolean 변환 규칙
- `wheelchair_ok = partial`(일부 구간만 가능) → `false`, `indoor = mixed`(실내+야외) → `false`. 원래 값은 `note` 컬럼에 남겼어요.
- `food_options.vegan/vegetarian`: "옵션 있음"도 `true`. `halal`: muslim-friendly 이상만 `true`.
- `price_level`: 관광지는 성인 입장료 기준(free / low ≤3,000 / mid ≤10,000 / high), 식당은 1인 식사 기준(low <10,000 / mid ≤20,000).

## 팀원이 꼭 확인할 것
1. **제주도립미술관 입장료**: 미술관 공식 페이지 8,000원 vs 한국관광공사·VisitJeju 2,000원. 일단 8,000원(mid)으로 넣었어요.
2. **넥슨컴퓨터박물관 → 넥슨뮤지엄**: 2026-05-12 재개관, 성인 14,000원으로 인상. 사진(Commons)은 2014년 옛 간판이에요.
3. **김만덕객주 운영시간**: 출처마다 달라서 빈칸. 휴무일(매주 월 vs 격주 월)도 엇갈려요.
4. **사진 라이선스**: 사라봉·한라수목원·김만덕객주·칠성로 사진은 VisitJeju CDN 이미지라 재사용 조건이 명시돼 있지 않아요. 발표 전에 한국관광공사 포토코리아(공공누리) 사진으로 바꾸는 걸 추천해요. Wikimedia 사진은 CC BY-SA라 `image_source` 표기 필수.
5. **Supabase Storage 업로드**: 지금 `image_url`은 외부 원본 URL이에요. `place-images` 버킷에 올린 뒤 공개 URL로 교체하세요.
6. **식당**: 아살람(휴무일 출처 불일치, 할랄 인증 여부 미확인), 팟타이시암(주소·영업시간 출처 불일치), 마음에온(최근 리뷰가 2년 전 → 영업 중인지 확인), 참맛나김밥(좌표 없음).
7. **좌표**: 원본 2015년 좌표라 일부는 주차장·입구 기준이에요(예: 용두암 좌표는 용연 쪽).
8. **민속자연사박물관**: 2026-11-23~24 소독 휴관 공지 있음.
