"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { V9Header } from "@/components/V9Header";
import { JejuMap } from "@/components/JejuMap";
import { QuickNavigator } from "@/components/QuickNavigator";
import { WindowSummary } from "@/components/WindowSummary";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { MoveInfo, StopCard } from "@/components/StopCard";
import { api } from "@/lib/api";
import { useLocale, travelMessages } from "@/lib/i18n";
import { useV6Copy } from "@/lib/v6-copy";
import type { Place } from "@/lib/types";
import { useCourse } from "@/lib/useCourse";

export default function CoursePage() {
  const { id } = useParams<{id:string}>();
  const { course, state, reload } = useCourse(id);
  const [places, setPlaces] = useState<Place[]>([]);
  const { locale } = useLocale();
  const tx=travelMessages[locale];
  const c=useV6Copy(locale);
  useEffect(()=>{api.places().then(r=>setPlaces(r.places)).catch(()=>setPlaces([]));},[]);
  if(state.kind==="loading")return <CourseSkeleton/>;
  if(state.kind==="notfound")return <MessageScreen title={tx.notfound} action={<NewPlanLink/>}/>;
  if(state.kind==="error"||!course)return <MessageScreen title={tx.error} action={<PrimaryButton onClick={reload}>{tx.retry}</PrimaryButton>}/>;
  return <main className="v9-site v9-course" id="course-top">
    <V9Header/>
    <div className="v9-route-grid">
      <section className="v9-map-column" aria-label={tx.mapTitle}>
        <div className="v9-map-panel">
          <div className="v9-map-heading"><p className="v9-eyebrow">JEJU ISLAND</p><h2>{c.mapTitle}</h2><small>{c.mapSub}</small></div>
          <JejuMap items={course.items} places={places}/>
          <div className="v9-map-footer"><span>{c.mapFoot}</span><a href="https://map.kakao.com/?q=%EC%A0%9C%EC%A3%BC%EB%8F%84" target="_blank" rel="noopener noreferrer">{c.kakaoMap}</a></div>
        </div>
      </section>
      <section className="v9-route-content" aria-label={tx.timeline}>
        <p className="v9-eyebrow">YOUR PERSONAL ITINERARY</p>
        <h1>{c.routeTitle}</h1>
        <p className="v9-route-intro">{c.routeIntro}</p>
        <div className="v9-route-tags"><span>◷ {course.items[0]?.start_time??"—"}</span><span>{c.sample}</span><span>{course.items.length} {tx.stops}</span></div>
        <WindowSummary courseId={course.id}/>
        {course.items.length===0?<MessageScreen title={tx.noStops} action={<NewPlanLink/>}/>:course.items.map(it=><div key={it.order} className="v9-stop-stack"><MoveInfo item={it}/><StopCard item={it} tier={course.tier} diet={course.user_profile.diet}/></div>)}
        {course.locked_count>0&&<Link href={`/course/${course.id}/purchase`} className="v9-upgrade"><strong>{course.locked_count} {tx.lock}</strong><span>{tx.unlock} ↗</span></Link>}
        <div className="v9-transport-help"><h2>🚕 {c.travelHelp}</h2><p>{c.fareHelp}</p><div className="v9-transport-metrics"><span>{c.fare}<strong>{c.notConnected}</strong></span><span>{c.eta}<strong>{c.notConnected}</strong></span><span>{c.distance}<strong>{c.notConnected}</strong></span></div><p className="v9-fineprint">{c.fareNotice}</p></div>
        <div className="v9-route-actions"><Link href="/onboarding" className="v9-outline">{c.edit}</Link><Link href={`/course/${course.id}/trip`} className="v9-primary">{c.tripStart}</Link></div>
      </section>
    </div>
    <QuickNavigator currentStopId={course.items.length?`stop-${course.items[0].order}`:undefined}/>
  </main>;
}
