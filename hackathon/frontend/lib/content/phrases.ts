// Reviewed translations of short, fixed English strings from the seed data:
// signature dishes, allergen notes and the English side of the Korean phrase cards.
// Key = the exact English text from the API; value = [简体中文, 日本語, 한국어].
// Anything not listed here is shown in English (see localized-place.ts).
// PHRASES has no Korean column: a phrase card already carries its Korean text (text_ko).
type Pair = readonly [zh: string, ja: string, ko?: string];

export const MENU: Record<string, Pair> = {
  "Chicken Mandi Rice": ["鸡肉曼迪饭", "チキン・マンディライス", "치킨 만디 라이스"],
  "Pad Thai": ["泰式炒河粉", "パッタイ", "팟타이"],
  "Bracken & Beef Spicy Soup": ["蕨菜牛肉辣汤", "ワラビと牛肉の辛いスープ", "고사리 육개장"],
  "Jeju Pork Noodle Soup": ["济州猪肉汤面", "済州の豚肉そば", "고기국수"],
  "Chilseong Latte": ["七星拿铁", "七星ラテ", "칠성라떼"],
  "Briquette-grilled Jeju black pork geun-gogi, 400 g portion": ["煤球炭烤济州黑猪肉（geun-gogi），400克一份", "練炭焼きの済州黒豚クンゴギ（400g）", "연탄불 제주 흑돼지 근고기 (400g)"],
  "Momguk, pork broth soup with gulfweed, small": ["Momguk（马尾藻猪肉汤），小份", "モムクッ（ホンダワラ入り豚スープ）小", "몸국 (소)"],
  "Horse mackerel soybean-paste soup": ["竹荚鱼大酱汤", "アジの味噌仕立てスープ", "각재기국"],
  "Abalone cold raw seafood soup": ["鲍鱼冷生海鲜汤", "アワビの冷たい刺身スープ", "전복물회"],
  "Beef haejangguk": ["牛肉醒酒汤", "牛肉のヘジャンクク", "소고기 해장국"],
  "Lunch set with braised rockfish, per person, min. 2 people, orders 10:00-14:50": ["炖鲪鱼午间套餐（按人计价，2人起点，10:00–14:50可点）", "ウロク（クロソイ）の煮付けランチセット（1名分、2名から、注文は10:00〜14:50）", "우럭조림 런치 세트 (1인 기준, 2인 이상, 주문 10:00~14:50)"],
  "Braised whole hairtail on an iron plate, small for 2": ["铁板炖整条带鱼，小份（2人份）", "太刀魚の丸ごと鉄板煮付け（小・2名分）", "철판 통갈치조림 (소, 2인분)"],
  "Sea snail knife-cut noodle soup": ["海螺刀切面", "巻き貝のカルグクス", "보말칼국수"],
  "Raw mackerel sashimi, small for 2": ["生鲭鱼刺身，小份（2人份）", "サバの刺身（小・2名分）", "고등어회 (소, 2인분)"],
  "Abalone hot stone pot rice with sea urchin soup": ["鲍鱼石锅饭配海胆汤", "アワビの石焼き釜飯とウニスープ", "전복돌솥밥과 성게국"],
  "Sea urchin seaweed soup": ["海胆海带汤", "ウニとワカメのスープ", "성게미역국"],
  "Horse meat yukhoe rice bowl, dinner": ["生拌马肉盖饭（晚餐）", "馬肉ユッケ丼（ディナー）", "말고기 육회덮밥 (저녁)"],
  "Buckwheat crepe rolled with radish, 1 piece": ["荞麦饼卷萝卜（1个）", "大根を巻いたそば粉クレープ（1個）", "빙떡 (1개)"],
  "Barley bread, 1 piece": ["大麦面包（1个）", "麦パン（1個）", "보리빵 (1개)"],
  "Green tea shaved ice, 1-2 people": ["绿茶刨冰（1–2人份）", "緑茶かき氷（1〜2名分）", "녹차빙수 (1~2인분)"],
};

export const ALLERGENS: Record<string, Pair> = {
  "beef (main ingredient); full allergen list not published": ["牛肉（主要食材）；未公布完整过敏原清单", "牛肉（主な食材）。アレルゲンの全リストは公開されていません", "소고기(주재료). 전체 알레르기 유발 성분 목록은 공개되지 않았습니다"],
  "wheat, pork (main ingredients); full allergen list not published": ["小麦、猪肉（主要食材）；未公布完整过敏原清单", "小麦、豚肉（主な食材）。アレルゲンの全リストは公開されていません", "밀, 돼지고기(주재료). 전체 알레르기 유발 성분 목록은 공개되지 않았습니다"],
  "milk (yogurt-based); full allergen list not published": ["牛奶（以酸奶为基底）；未公布完整过敏原清单", "乳（ヨーグルトベース）。アレルゲンの全リストは公開されていません", "우유(요거트 베이스). 전체 알레르기 유발 성분 목록은 공개되지 않았습니다"],
};

export const PHRASES: Record<string, Pair> = {
  "Table for one, please.": ["一位，谢谢。", "ひとりです。"],
  "Can I order a single portion?": ["可以点一人份吗？", "1人前でも注文できますか？"],
  "Do you have an English menu?": ["有英文菜单吗？", "英語のメニューはありますか？"],
  "I'm vegan. No meat, fish, eggs or dairy, please.": ["我吃纯素。请不要放肉、鱼、蛋和奶制品。", "ヴィーガンです。肉、魚、卵、乳製品は抜いてください。"],
  "I'm vegetarian. No meat or fish, please.": ["我吃素。请不要放肉和鱼。", "ベジタリアンです。肉と魚は抜いてください。"],
  "Does this have pork in it?": ["这个里面有猪肉吗？", "これには豚肉が入っていますか？"],
  "Not spicy, please.": ["请不要做辣。", "辛くしないでください。"],
  "Can I get the rest to go?": ["剩下的可以打包吗？", "残りを持ち帰りにできますか？"],
  "Can I pay by card?": ["可以刷卡吗？", "カードで払えますか？"],
  "Please take me to this address.": ["请送我到这个地址。", "この住所までお願いします。"],
  "Could you call a taxi for me?": ["能帮我叫一辆出租车吗？", "タクシーを呼んでいただけますか？"],
  "Does this bus go to Jeju City Hall?": ["这辆公交车去济州市政府吗？", "このバスは済州市庁に行きますか？"],
  "Where is the restroom?": ["洗手间在哪里？", "トイレはどこですか？"],
  "Is there somewhere I can sit and rest?": ["有可以坐下休息的地方吗？", "座って休める場所はありますか？"],
  "How much is this?": ["这个多少钱？", "これはいくらですか？"],
  "Can I buy just one?": ["可以只买一个吗？", "1つだけ買えますか？"],
  "Can I try a little?": ["可以尝一点吗？", "少し味見してもいいですか？"],
  "Please pack it so I can take it on the plane.": ["请帮我包装好，方便带上飞机。", "飛行機に持ち込めるように包んでください。"],
  "One of these, please. I'll eat it here.": ["请给我一份这个，我在这里吃。", "これを1つください。ここで食べます。"],
  "Is the market open today?": ["今天市场开门吗？", "今日は市場が開いていますか？"],
  "Can I buy a small amount of tangerines?": ["橘子可以少买一点吗？", "ミカンを少しだけ買えますか？"],
  "Where is the food section?": ["卖小吃的区域在哪里？", "食べ物売り場はどこですか？"],
  "Do you have this in a different size?": ["这个有别的尺码吗？", "これの別のサイズはありますか？"],
  "Can I get a tax refund?": ["可以退税吗？", "免税の手続きはできますか？"],
  "Is admission free?": ["入场免费吗？", "入場は無料ですか？"],
  "One adult ticket, please.": ["请给我一张成人票。", "大人1枚ください。"],
  "Is there a locker for my bag?": ["有可以寄存包的储物柜吗？", "荷物を預けるロッカーはありますか？"],
  "One adult ticket, please. Can I play the games inside?": ["请给我一张成人票。里面的游戏可以玩吗？", "大人1枚ください。中でゲームを遊べますか？"],
  "Is there a video or guide in English?": ["有英文的影片或导览吗？", "英語の映像やガイドはありますか？"],
  "Could you take a photo of me?": ["能帮我拍张照吗？", "写真を撮っていただけますか？"],
  "Which way to the top?": ["去山顶走哪边？", "頂上はどちらですか？"],
  "How long does it take to the top?": ["到山顶要多久？", "頂上までどのくらいかかりますか？"],
  "Where is the bus stop to Jeju City?": ["去济州市区的公交车站在哪里？", "済州市内行きのバス停はどこですか？"],
  "Is this path flat?": ["这条路平坦吗？", "この道は平らですか？"],
  "Which dishes are vegan?": ["哪些菜是纯素的？", "ヴィーガンの料理はどれですか？"],
  "Is there a prayer room?": ["有祈祷室吗？", "礼拝室はありますか？"],
  "One pad thai, vegan please - no egg, no fish sauce.": ["请给我一份泰式炒河粉，做成纯素的，不要放鸡蛋和鱼露。", "パッタイを1つ、ヴィーガンでお願いします。卵とナンプラーは抜いてください。"],
  "One bracken beef soup (gosari yukgaejang), please.": ["请给我一份蕨菜牛肉汤（gosari yukgaejang）。", "ワラビと牛肉のスープ（コサリユッケジャン）を1つください。"],
  "One pork noodle soup (gogi guksu), please.": ["请给我一份猪肉汤面（gogi guksu）。", "豚肉そば（コギグクス）を1つください。"],
  "One Chilseong latte, please.": ["请给我一杯七星拿铁。", "七星ラテを1つください。"],
  "Can I order just one dish for one person?": ["一个人只点一道菜可以吗？", "ひとりで1品だけ注文してもいいですか？"],
};
