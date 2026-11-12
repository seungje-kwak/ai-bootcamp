"""phrase_cards 테이블 원본 (직접 작성).

(place_id, situation, text_en, text_ko)
place_id 가 None 인 카드는 어느 장소에서나 쓰는 공통 카드.
place_id 번호는 places.csv 의 id 와 같다 (1~20 관광지, 21~ 식당·카페).
"""

PHRASES = [
    # ---- 공통: 식당 (혼자 온 외국인) ----
    (None, "restaurant", "Table for one, please.", "한 명이에요."),
    (None, "restaurant", "Can I order a single portion?", "1인분도 주문할 수 있어요?"),
    (None, "restaurant", "Do you have an English menu?", "영어 메뉴 있어요?"),
    (None, "restaurant", "I'm vegan. No meat, fish, eggs or dairy, please.",
     "저는 비건이에요. 고기, 생선, 달걀, 유제품은 빼 주세요."),
    (None, "restaurant", "I'm vegetarian. No meat or fish, please.", "저는 채식주의자예요. 고기랑 생선은 빼 주세요."),
    (None, "restaurant", "Does this have pork in it?", "이거 돼지고기 들어가요?"),
    (None, "restaurant", "Not spicy, please.", "안 맵게 해 주세요."),
    (None, "restaurant", "Can I get the rest to go?", "남은 거 포장해 주세요."),
    (None, "restaurant", "Can I pay by card?", "카드 결제 돼요?"),
    # ---- 공통: 이동 ----
    (None, "taxi", "Please take me to this address.", "이 주소로 가 주세요."),
    (None, "taxi", "Could you call a taxi for me?", "택시 좀 불러 주실 수 있어요?"),
    (None, "bus", "Does this bus go to Jeju City Hall?", "이 버스 제주시청 가요?"),
    (None, "general", "Where is the restroom?", "화장실이 어디예요?"),
    (None, "general", "Is there somewhere I can sit and rest?", "앉아서 쉴 수 있는 곳 있어요?"),

    # ---- 시장 (6 동문재래시장, 18 제주시민속오일시장, 20 칠성로) ----
    (6, "market", "How much is this?", "이거 얼마예요?"),
    (6, "market", "Can I buy just one?", "하나만 살 수 있어요?"),
    (6, "market", "Can I try a little?", "조금 맛봐도 돼요?"),
    (6, "market", "Please pack it so I can take it on the plane.", "비행기에 가지고 탈 수 있게 포장해 주세요."),
    (6, "night_market", "One of these, please. I'll eat it here.", "이거 하나 주세요. 여기서 먹을게요."),
    (18, "market", "Is the market open today?", "오늘 오일장 열어요?"),
    (18, "market", "Can I buy a small amount of tangerines?", "귤 조금만 살 수 있어요?"),
    (18, "market", "Where is the food section?", "먹거리 파는 곳이 어디예요?"),
    (20, "shopping", "Do you have this in a different size?", "이거 다른 사이즈 있어요?"),
    (20, "shopping", "Can I get a tax refund?", "택스 리펀 돼요?"),

    # ---- 박물관·미술관 (4, 5, 11, 13, 16, 17) ----
    (4, "ticket", "Is admission free?", "입장료 무료예요?"),
    (5, "ticket", "One adult ticket, please.", "성인 한 장 주세요."),
    (5, "ticket", "Is there a locker for my bag?", "가방 맡길 물품보관함 있어요?"),
    (11, "ticket", "One adult ticket, please.", "성인 한 장 주세요."),
    (13, "guide", "Is there an English audio guide?", "영어 오디오 가이드 있어요?"),
    (16, "ticket", "One adult ticket, please. Can I play the games inside?",
     "성인 한 장 주세요. 안에서 게임해 볼 수 있어요?"),
    (17, "ticket", "How long does it take to walk around?", "다 둘러보는 데 얼마나 걸려요?"),

    # ---- 역사 유적 (2 제주목관아, 3 삼성혈) ----
    (2, "ticket", "One adult ticket, please.", "성인 한 장 주세요."),
    (3, "ticket", "Is there a video or guide in English?", "영어로 된 영상이나 안내가 있어요?"),

    # ---- 자연·오름·해변 (1, 7, 8, 9, 10, 12, 14, 19) ----
    (1, "photo", "Could you take a photo of me?", "사진 한 장 찍어 주실 수 있어요?"),
    (7, "hike", "Which way to the top?", "정상은 어느 쪽이에요?"),
    (8, "hike", "How long does it take to the top?", "정상까지 얼마나 걸려요?"),
    (9, "beach", "Where is the bus stop to Jeju City?", "제주시내 가는 버스 정류장이 어디예요?"),
    (10, "walk", "Is this path flat?", "이 길 평평해요?"),
    (12, "beach", "Can I swim here now?", "지금 여기서 수영해도 돼요?"),
    (14, "walk", "Which trail is the easiest?", "제일 쉬운 산책로가 어디예요?"),
    (19, "ticket", "Can I feed the deer?", "노루한테 먹이 줘도 돼요?"),

    # ---- 식당·카페 (21~27, food_options.json 순서) ----
    (21, "restaurant", "Which dishes are vegan?", "비건 메뉴는 어떤 거예요?"),
    (21, "restaurant", "Is there a prayer room?", "기도실 있어요?"),
    (22, "restaurant", "One pad thai, vegan please - no egg, no fish sauce.",
     "팟타이 하나 비건으로 주세요. 달걀이랑 피시소스는 빼 주세요."),
    (23, "restaurant", "One bracken beef soup (gosari yukgaejang), please.", "고사리육개장 하나 주세요."),
    (24, "restaurant", "One pork noodle soup (gogi guksu), please.", "고기국수 하나 주세요."),
    (25, "cafe", "One Mundo Einspänner, please. I'll have it here.", "문도슈페너 하나 주세요. 먹고 갈게요."),
    (26, "restaurant", "One yeolmu guksu, please.", "열무국수 하나 주세요."),
    (27, "cafe", "One Chilseong latte, please.", "칠성라떼 하나 주세요."),

    # ---- 김만덕객주 (15) ----
    (15, "restaurant", "Can I order just one dish for one person?", "한 사람이 한 가지만 시켜도 돼요?"),
]
