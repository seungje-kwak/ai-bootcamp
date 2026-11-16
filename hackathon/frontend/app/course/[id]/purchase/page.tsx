"use client";

import Link from "next/link";
import { V9Header } from "@/components/V9Header";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { PREMIUM_PRICE_LABEL } from "@/config/pricing";
import { api } from "@/lib/api";
import { travelMessages, useLocale } from "@/lib/i18n";
import { useCourse } from "@/lib/useCourse";

const purchaseCopy = {
  en:{ title:"Unlock your full day", free:"Free", current:"Current", description:"Course preview", upTo:"Up to 3 stops", once:"Demo checkout for this plan", full:"Full course", replan:"Unlimited re-planning", phrases:"Local phrase cards", offline:"Offline PDF (coming soon)", charge:"Demo payment. No real charge.", pay:"Continue demo", loading:"Processing…", failed:"Could not complete the demo. Nothing was charged.", success:"Your full itinerary is ready.", unlocked:"This plan is already unlocked.", see:"See my full day", selected:"You’re seeing", of:"of" },
  zh:{ title:"解锁完整行程", free:"免费", current:"当前", description:"行程预览", upTo:"最多3个地点", once:"此行程的演示支付", full:"完整行程", replan:"不限次数调整行程", phrases:"实用韩语卡片", offline:"离线PDF（即将推出）", charge:"演示支付，不会实际扣款。", pay:"继续演示", loading:"处理中…", failed:"演示未成功，没有扣款。", success:"完整行程已解锁。", unlocked:"此行程已解锁。", see:"查看完整行程", selected:"当前展示", of:"共" },
  ja:{ title:"旅程のすべてをアンロック", free:"無料", current:"現在", description:"旅程のプレビュー", upTo:"最大3スポット", once:"この旅程のデモ決済", full:"全スポット", replan:"何度でも再プラン", phrases:"韓国語フレーズカード", offline:"オフラインPDF（近日公開）", charge:"デモ決済です。実際の請求はありません。", pay:"デモを続ける", loading:"処理中…", failed:"デモ決済に失敗しました。請求はありません。", success:"全旅程を表示できます。", unlocked:"この旅程はすでにアンロック済みです。", see:"全旅程を見る", selected:"表示中", of:"全" },
  ko:{ title:"하루 전체 코스 열기", free:"무료", current:"현재", description:"코스 미리보기", upTo:"최대 3개 장소", once:"이 여행 코스의 데모 결제", full:"전체 여행 코스", replan:"횟수 제한 없는 일정 재구성", phrases:"한국어 현지 회화", offline:"오프라인 PDF (준비 중)", charge:"데모 결제입니다. 실제 비용은 청구되지 않아요.", pay:"데모 체험", loading:"처리 중…", failed:"데모 결제를 완료하지 못했어요. 실제 결제는 없었습니다.", success:"전체 여행 코스를 확인할 수 있어요.", unlocked:"이미 전체 코스를 이용 중이에요.", see:"전체 코스 보기", selected:"현재", of:"전체" },
} as const;

export default function PurchasePage() {
  const {id}=useParams<{id:string}>();
  const {course,setCourse,state,reload}=useCourse(id);
  const [pay,setPay]=useState<"idle"|"loading"|"done"|"error">("idle");
  const inFlight=useRef(false);
  const {locale}=useLocale();
  const tx=travelMessages[locale];
  const pc=purchaseCopy[locale];
  if(state.kind==="loading")return <CourseSkeleton/>;
  if(state.kind==="notfound")return <MessageScreen title={tx.notfound} action={<NewPlanLink/>}/>;
  if(state.kind==="error"||!course)return <MessageScreen title={tx.error} action={<PrimaryButton onClick={reload}>{tx.retry}</PrimaryButton>}/>;
  const see=<Link href={`/course/${course.id}`} className="rounded-2xl bg-sea text-white font-semibold py-3.5 px-6">{pc.see}</Link>;
  if(pay==="done")return <MessageScreen title={pc.success} action={see}/>;
  if(course.tier==="premium")return <MessageScreen title={pc.unlocked} action={see}/>;
  async function onPay(){ if(inFlight.current)return;inFlight.current=true;setPay("loading");try{setCourse(await api.purchase(id));setPay("done")}catch{setPay("error")}finally{inFlight.current=false} }
  return <main className="v9-site v9-purchase"><V9Header/><div className="max-w-[700px] mx-auto px-5 pt-8 pb-12">
    <Link href={`/course/${course.id}`} className="text-sm font-semibold text-sea">← {tx.back}</Link>
    <p className="course-head__eyebrow">MY PACE, MY JOURNEY</p>
    <h1 className="mt-3 text-4xl font-semibold leading-tight" style={{fontFamily:"Georgia,serif"}}>{pc.title}</h1>
    <p className="text-muted mt-3">{pc.selected} {course.items.length} {pc.of} {course.total_items} {tx.stops}</p>
    <div className="grid sm:grid-cols-2 gap-4 mt-8">
      <div className="rounded-2xl border border-line p-5"><div className="flex justify-between"><p className="text-lg font-bold">{pc.free}</p><p className="text-sm text-muted">{pc.current}</p></div><p className="text-muted mt-2">{pc.description}</p><p className="mt-6">✓ {pc.upTo}</p></div>
      <div className="rounded-2xl border-2 border-sea bg-sea-soft/40 p-5"><div className="flex justify-between gap-2"><p className="text-lg font-bold">{tx.premium}</p><p className="font-bold text-sea">{PREMIUM_PRICE_LABEL}</p></div><p className="text-sm text-muted mt-2">{pc.once}</p><ul className="mt-5 space-y-2 text-sm"><li>✓ {pc.full}</li><li>✓ {pc.replan}</li><li>✓ {pc.phrases}</li><li>✓ {pc.offline}</li></ul></div>
    </div>
    {pay==="error"&&<p className="mt-5 p-3 bg-tangerine-soft rounded-xl" role="alert">{pc.failed}</p>}
    <PrimaryButton className="w-full mt-8" onClick={onPay} disabled={pay==="loading"}>{pay==="loading"?pc.loading:pay==="error"?tx.retry:pc.pay}</PrimaryButton>
    <p className="text-center text-xs text-muted mt-3">{pc.charge}</p>
  </div></main>;
}
