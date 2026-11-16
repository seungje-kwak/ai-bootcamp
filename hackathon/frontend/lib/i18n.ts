"use client";

import { useEffect, useState } from "react";
import { en, type Messages } from "./messages/en";
import { ja } from "./messages/ja";
import { ko } from "./messages/ko";
import { zh } from "./messages/zh";

export type Locale = "en" | "zh" | "ja" | "ko";
export const LOCALE_STORAGE_KEY = "mypace-jeju-language";

export const languageNames: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  ja: "日本語",
  ko: "한국어",
};

// Detailed UI copy (states, onboarding area/time rules) kept from the earlier design.
export type { Messages };
export const MESSAGES: Record<Locale, Messages> = { en, zh, ja, ko };

export const messages = {
  en: {
    label: "YOUR JEJU, YOUR PACE",
    eyebrow: "AN INTELLIGENT TRAVEL COMPANION",
    heroLineOne: "Jeju is",
    heroLineTwo: "yours to discover.",
    subhead: "An unforgettable day, thoughtfully planned around you.",
    badge: "MADE FOR SOLO EXPLORERS",
    microOne: "Real local places",
    microTwo: "A pace that feels right",
    microThree: "Help along the way",
    primary: "Plan my journey",
    secondary: "Your personal guide to Jeju City",
    guide: "Your day, beautifully mapped out",
    stepLabel: "MAKE IT YOURS",
    stepNames: ["Your interests", "Your pace", "Your mood", "Your table", "Your time"],
    titles: ["What makes you curious?", "Explore at your own pace.", "How are you feeling today?", "Let's find your kind of food.", "When shall we explore?"],
    subtitles: ["Choose as many as you like.", "We'll make every stop comfortable.", "Your energy shapes the day.", "We'll keep your preferences in mind.", "Choose your start time and how long you'd like to go."],
    interests: ["Nature", "Markets", "Cafés", "Local food", "Culture & history", "Photo spots"],
    energyLabel: "Your energy",
    energies: ["Relaxed", "Balanced", "Adventurous"],
    walkingLabel: "Comfortable walking time",
    walkOptions: ["10 min", "20 min", "30+ min"],
    avoidSlopes: "Avoid steep hills",
    moods: ["Feeling great", "Doing okay", "A little tired"],
    diets: ["No restrictions", "Vegan", "Vegetarian", "Halal"],
    quickTimeLabel: "How much time do you have?",
    half: "Half day", full: "Full day", halfDesc: "About 4 hours", fullDesc: "About 8 hours",
    startTime: "Start time", endTime: "Estimated finish", timeZone: "Jeju local time · KST",
    timeNote: "Your plan includes travel and breaks. The selected window can differ from the 4h/8h itinerary that the current API can generate.",
    back: "Back", next: "Continue", create: "Create my day", loading: "Curating your Jeju journey…", loadingSub: "Matching you with verified places.",
    error: "We couldn't create your journey just now.", retry: "Try again", noCandidates: "Not enough places match these choices.", change: "Edit my choices",
    selection: "Selected", progress: "Step", of: "of", design: "DESIGNED AROUND YOU",
  },
  zh: {
    label: "按自己的节奏游济州", eyebrow: "你的智能旅行伙伴", heroLineOne: "济州，", heroLineTwo: "由你自由探索。",
    subhead: "根据你的兴趣与步调，规划独一无二的美好旅程。", badge: "为独自旅行者设计", microOne: "真实的当地景点", microTwo: "适合你的步调", microThree: "旅途中贴心协助",
    primary: "开始规划旅程", secondary: "你的济州市专属旅行向导", guide: "属于你的美好旅程", stepLabel: "定制你的旅程",
    stepNames: ["兴趣", "步调", "状态", "饮食", "时间"],
    titles: ["你对什么感兴趣？", "按照你的节奏探索。", "今天感觉怎么样？", "你喜欢什么样的美食？", "什么时候开始探索？"],
    subtitles: ["可以多选。", "我们会为你安排舒适的路线。", "根据今天的精力安排旅程。", "我们会考虑你的饮食需求。", "选择出发时间和旅行时长。"],
    interests: ["自然风光", "市场", "咖啡馆", "当地美食", "文化与历史", "拍照打卡"], energyLabel: "活动强度", energies: ["轻松", "适中", "活力满满"],
    walkingLabel: "单次舒适步行时间", walkOptions: ["10分钟", "20分钟", "30分钟以上"], avoidSlopes: "避开陡坡",
    moods: ["状态很好", "还不错", "有点疲惫"], diets: ["没有限制", "纯素", "素食", "清真"],
    quickTimeLabel: "你有多少时间？", half: "半天", full: "全天", halfDesc: "约4小时", fullDesc: "约8小时", startTime: "开始时间", endTime: "预计结束", timeZone: "济州当地时间 · 韩国标准时间",
    timeNote: "行程包含交通与休息时间。目前服务器仅能生成约4小时或8小时的行程。", back: "返回", next: "继续", create: "生成我的行程", loading: "正在为你规划济州之旅…", loadingSub: "正在匹配已核实的景点。", error: "暂时无法创建行程。", retry: "重试", noCandidates: "符合条件的地点不足。", change: "调整选择", selection: "已选择", progress: "第", of: "步，共", design: "专为你设计",
  },
  ja: {
    label: "自分らしく済州島を旅しよう", eyebrow: "あなた専用のAI旅ガイド", heroLineOne: "済州島を、", heroLineTwo: "思いのままに。",
    subhead: "あなたの好みとペースに合わせた、特別な一日を。", badge: "ひとり旅のために", microOne: "実在する地元スポット", microTwo: "自分らしいペース", microThree: "旅先での安心サポート",
    primary: "旅をプランする", secondary: "済州市を案内するあなただけのガイド", guide: "あなたらしい一日をプラン", stepLabel: "旅をカスタマイズ",
    stepNames: ["興味", "ペース", "体調", "食事", "時間"],
    titles: ["どんなことに興味がありますか？", "自分のペースで楽しもう。", "今日の体調はいかがですか？", "お食事の希望は？", "何時から旅を始めますか？"],
    subtitles: ["複数選択できます。", "無理のないルートをご案内します。", "体調に合わせてご提案します。", "食事の希望を考慮します。", "開始時刻と旅の長さを選んでください。"],
    interests: ["自然", "市場", "カフェ", "地元グルメ", "文化・歴史", "写真スポット"], energyLabel: "活動レベル", energies: ["のんびり", "ふつう", "アクティブ"],
    walkingLabel: "一度に歩ける時間", walkOptions: ["10分", "20分", "30分以上"], avoidSlopes: "急な坂道を避ける",
    moods: ["とても元気", "ふつう", "少し疲れている"], diets: ["制限なし", "ヴィーガン", "ベジタリアン", "ハラール"],
    quickTimeLabel: "旅に使える時間", half: "半日", full: "一日", halfDesc: "約4時間", fullDesc: "約8時間", startTime: "開始時刻", endTime: "終了予定", timeZone: "済州島の現地時間 · KST",
    timeNote: "移動と休憩も含みます。現在のAPIが生成できる旅程は約4時間または8時間です。", back: "戻る", next: "続ける", create: "旅のプランを作る", loading: "済州島の旅をプランしています…", loadingSub: "確認済みスポットを探しています。", error: "旅程を作成できませんでした。", retry: "再試行", noCandidates: "条件に合うスポットが足りません。", change: "条件を変更", selection: "選択中", progress: "ステップ", of: "/", design: "あなたのために",
  },
  ko: {
    label: "나의 속도로 즐기는 제주", eyebrow: "당신만을 위한 AI 여행 가이드", heroLineOne: "제주의 하루를,", heroLineTwo: "나답게 여행하다.",
    subhead: "내 취향과 컨디션에 맞춰, 제주의 특별한 하루를 설계해 보세요.", badge: "혼자 떠나는 여행을 위한", microOne: "실제 검증된 여행지", microTwo: "나에게 맞는 여행 속도", microThree: "여행 중에도 든든한 안내",
    primary: "내 여행 계획하기", secondary: "제주를 만나는 가장 나다운 방법", guide: "나만의 제주 여행 코스", stepLabel: "내 취향으로 준비하기",
    stepNames: ["관심사", "활동 수준", "오늘의 컨디션", "식사", "여행 시간"],
    titles: ["어떤 여행을 좋아하세요?", "내게 맞는 속도로 걸어요.", "오늘 컨디션은 어때요?", "식사에서 중요한 게 있나요?", "언제부터 여행할까요?"],
    subtitles: ["관심 있는 항목을 자유롭게 골라주세요.", "무리하지 않는 동선을 추천해 드려요.", "몸 상태에 맞는 일정을 제안할게요.", "식사 조건을 꼼꼼하게 반영할게요.", "시작과 종료 시각을 30분 단위로 선택하세요."],
    interests: ["자연", "시장·쇼핑", "카페", "로컬 맛집", "문화·역사", "사진 명소"], energyLabel: "활동 강도", energies: ["느긋하게", "적당하게", "활동적으로"],
    walkingLabel: "한 번에 걷기 편한 시간", walkOptions: ["10분", "20분", "30분 이상"], avoidSlopes: "언덕길 피하기",
    moods: ["기분 좋아요", "보통이에요", "조금 피곤해요"], diets: ["제한 없음", "비건", "채식", "할랄"],
    quickTimeLabel: "여행 가능 시간", half: "반나절", full: "하루", halfDesc: "약 4시간", fullDesc: "약 8시간", startTime: "시작 시각", endTime: "종료 시각", timeZone: "제주 현지 시간 · KST",
    timeNote: "이동 및 휴식 시간을 포함합니다. 현재 서버는 약 4시간 또는 8시간 코스를 지원하므로, 선택한 시간과 생성된 코스 길이가 다를 수 있습니다.", back: "이전", next: "다음", create: "맞춤 여행 생성", loading: "당신의 제주 여행을 설계하고 있어요…", loadingSub: "검증된 장소와 편안한 동선을 찾는 중이에요.", error: "지금은 여행 코스를 만들지 못했어요.", retry: "다시 시도", noCandidates: "조건에 맞는 여행지가 충분하지 않아요.", change: "선택 수정", selection: "선택됨", progress: "단계", of: "/", design: "당신을 위한 설계",
  },
} as const;

export function useLocale() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === "en" || saved === "zh" || saved === "ja" || saved === "ko") {
      setLocale(saved);
      document.documentElement.lang = saved === "zh" ? "zh-CN" : saved;
    }
    const sync = () => {
      const other = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (other === "en" || other === "zh" || other === "ja" || other === "ko") setLocale(other);
    };
    window.addEventListener("mypace-language-change", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("mypace-language-change", sync); window.removeEventListener("storage", sync); };
  }, []);
  function updateLocale(next: Locale) {
    setLocale(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : next;
    window.dispatchEvent(new Event("mypace-language-change"));
  }
  return { locale, setLocale: updateLocale, t: messages[locale] };
}


// Client-side translations for travel screens. Place facts and AI reasons stay in their
// source language until an approved translation service is connected.
export const travelMessages = {
  en: { whyStop:"WHY WE CHOSE THIS", noPhoto:"Photo not available", lockedFeature:"Available with Premium", stops:"stops", dayTitle:"Your day in Jeju City", preview:"Preview", premium:"Premium", itinerary:"YOUR PERSONAL ITINERARY", mapTitle:"Your journey, mapped", timeline:"YOUR ROUTE", start:"Start my day", map:"Map", hideMap:"Hide map", now:"Now exploring", next:"Coming up next", earlier:"Completed", done:"Done, next stop", back:"Back to my plan", current:"Current stop", top:"Back to top", jump:"Jump to current stop", driver:"Show to driver", driverTitle:"SHOW TO YOUR DRIVER", driverHint:"Please show this address to your taxi driver", copy:"Copy Korean address", copied:"Address copied", close:"Close", route:"Open directions", fare:"Fare estimate requires a route service", about:"About", stay:"Stay", min:"min", indoor:"Indoor", rest:"Rest stop", phrases:"Local phrases", unavailable:"Some AI-generated descriptions may still be available only in English.", nextMove:"Getting there", moveWalk:"walk", moveTaxi:"by taxi", moveBus:"by bus", ready:"Something changed?", rain:"Rain", closed:"Closed", hungry:"Hungry", tired:"Tired", confirm:"Report this place closed and look for an alternative?", yesClosed:"Yes, find another", cancel:"Cancel", noCandidates:"No other places are available. Your current plan is unchanged.", replanError:"Couldn't re-plan. Your current plan is unchanged.", replanLoading:"Re-planning your day…", retry:"Retry", dismiss:"Dismiss", last:"This is your final stop.", error:"Something went wrong.", notfound:"We couldn't find this plan.", lock:"more stops in your full day", unlock:"Unlock full day", new:"New", noStops:"There are no stops yet.", endPreview:"That's the end of your preview", endDay:"Day complete 🎉", finish:"Thanks for exploring Jeju at your pace.", indoorPlan:"Indoor plan", easyPace:"Easy pace" },
  zh: { whyStop:"为你推荐的理由", noPhoto:"暂无实景照片", lockedFeature:"高级版专属功能", stops:"个地点", dayTitle:"你的济州市一日游", preview:"预览", premium:"高级版", itinerary:"你的专属行程", mapTitle:"你的旅行路线", timeline:"行程时间线", start:"开始旅行", map:"地图", hideMap:"收起地图", now:"正在游览", next:"接下来", earlier:"已完成", done:"已完成，下一站", back:"返回行程", current:"当前地点", top:"返回顶部", jump:"跳转到当前地点", driver:"给司机看", driverTitle:"请出示给司机", driverHint:"请向出租车司机出示此地址", copy:"复制韩文地址", copied:"地址已复制", close:"关闭", route:"打开导航", fare:"预计车费需连接路线服务", about:"关于", stay:"停留", min:"分钟", indoor:"室内", rest:"休息站", phrases:"实用韩语", unavailable:"部分 AI 生成的说明可能仍需查看英文原文。", nextMove:"前往方式", moveWalk:"步行", moveTaxi:"出租车", moveBus:"公交", ready:"计划有变化？", rain:"下雨", closed:"关门", hungry:"饿了", tired:"累了", confirm:"此地点已关闭，重新推荐吗？", yesClosed:"是的，换一个", cancel:"取消", noCandidates:"暂无符合条件的其他地点。原计划不变。", replanError:"无法重新规划，原计划不变。", replanLoading:"重新规划行程中…", retry:"重试", dismiss:"关闭", last:"这是最后一站。", error:"发生了错误。", notfound:"无法找到此行程。", lock:"个地点待解锁", unlock:"解锁完整行程", new:"新推荐", noStops:"当前没有行程地点。", endPreview:"预览已结束", endDay:"行程完成 🎉", finish:"感谢你按自己的步调探索济州。", indoorPlan:"室内行程", easyPace:"轻松模式" },
  ja: { whyStop:"この場所を選んだ理由", noPhoto:"現地写真は準備中", lockedFeature:"プレミアム限定", stops:"スポット", dayTitle:"済州市で過ごす一日", preview:"プレビュー", premium:"プレミアム", itinerary:"あなた専用の旅程", mapTitle:"旅のルート", timeline:"旅のタイムライン", start:"旅を始める", map:"地図", hideMap:"地図を閉じる", now:"現在のスポット", next:"次のスポット", earlier:"訪問済み", done:"完了、次のスポット", back:"旅程に戻る", current:"現在のスポット", top:"ページ上部へ", jump:"現在地へジャンプ", driver:"運転手に見せる", driverTitle:"運転手に見せてください", driverHint:"タクシー運転手にこの韓国語の住所を見せてください", copy:"韓国語の住所をコピー", copied:"住所をコピーしました", close:"閉じる", route:"経路を開く", fare:"予想料金は経路API接続後に表示", about:"詳細", stay:"滞在", min:"分", indoor:"屋内", rest:"休憩", phrases:"韓国語フレーズ", unavailable:"AIによる一部の詳しい説明は英語原文で表示される場合があります。", nextMove:"移動案内", moveWalk:"徒歩", moveTaxi:"タクシー", moveBus:"バス", ready:"予定が変わりましたか？", rain:"雨", closed:"休業", hungry:"空腹", tired:"疲れた", confirm:"休業中として報告し、代わりの場所を探しますか？", yesClosed:"別の場所を探す", cancel:"キャンセル", noCandidates:"代替スポットがありません。元の旅程を維持します。", replanError:"再計画できませんでした。元の旅程を維持します。", replanLoading:"旅程を再計画中…", retry:"再試行", dismiss:"閉じる", last:"これが最後のスポットです。", error:"エラーが発生しました。", notfound:"このプランは見つかりません。", lock:"スポットをもっと見る", unlock:"全旅程をアンロック", new:"新しい", noStops:"スポットがありません。", endPreview:"プレビューはここまで", endDay:"旅が完了しました 🎉", finish:"済州の旅をお楽しみいただきありがとう。", indoorPlan:"屋内プラン", easyPace:"ゆったりプラン" },
  ko: { whyStop:"추천 이유", noPhoto:"등록된 현장 사진이 없어요", lockedFeature:"프리미엄 전용", stops:"개 장소", dayTitle:"나만의 제주 여행 코스", preview:"미리보기", premium:"프리미엄", itinerary:"오늘의 맞춤 여행", mapTitle:"여행 동선", timeline:"시간별 일정", start:"여행 시작하기", map:"지도", hideMap:"지도 닫기", now:"지금 여행 중", next:"다음 장소", earlier:"방문 완료", done:"이 장소 완료 · 다음으로", back:"내 코스로 돌아가기", current:"현재 장소", top:"맨 위로", jump:"현재 장소로", driver:"택시기사에게 보여주기", driverTitle:"택시기사 안내", driverHint:"아래 한국어 주소를 기사님께 보여 주세요", copy:"한국어 주소 복사", copied:"주소 복사 완료", close:"닫기", route:"길찾기 열기", fare:"실시간 택시요금 연동 전", about:"상세 정보", stay:"체류", min:"분", indoor:"실내", rest:"휴식", phrases:"현지 회화", unavailable:"AI가 자유롭게 생성한 일부 설명은 아직 영어 원문으로 표시될 수 있어요.", nextMove:"다음 장소까지", moveWalk:"도보", moveTaxi:"택시", moveBus:"버스", ready:"여행 중 변경 사항이 있나요?", rain:"비가 와요", closed:"휴업이에요", hungry:"배고파요", tired:"피곤해요", confirm:"이 장소가 휴업했나요? 대체 장소를 찾아드릴까요?", yesClosed:"네, 다른 곳 추천", cancel:"취소", noCandidates:"대체 장소가 없어요. 기존 일정은 유지됩니다.", replanError:"일정을 다시 만들지 못했어요. 기존 일정은 유지됩니다.", replanLoading:"남은 여행을 다시 계획하고 있어요…", retry:"재시도", dismiss:"닫기", last:"오늘의 마지막 장소예요.", error:"문제가 발생했어요.", notfound:"여행 코스를 찾을 수 없어요.", lock:"개 장소 더 보기", unlock:"전체 일정 확인", new:"새로운 추천", noStops:"아직 여행지가 없어요.", endPreview:"미리보기 일정이 끝났어요", endDay:"여행 완료 🎉", finish:"나만의 속도로 제주를 즐겨주셔서 고마워요.", indoorPlan:"실내 중심", easyPace:"여유로운 코스" },
} as const;
