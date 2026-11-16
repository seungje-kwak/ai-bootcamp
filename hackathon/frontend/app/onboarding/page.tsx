"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { V9Header } from "@/components/V9Header";
import { api, ApiError } from "@/lib/api";
import type { Category, UserProfileInput } from "@/lib/types";
import { useLocale } from "@/lib/i18n";
import { useV6Copy } from "@/lib/v6-copy";

const INTERESTS: {value:Category;icon:string}[] = [
  {value:"nature",icon:"🌿"},{value:"market",icon:"🧺"},{value:"cafe",icon:"☕"},
  {value:"food",icon:"🥢"},{value:"culture",icon:"🏛️"},{value:"photo",icon:"📷"},
];
type Draft = {interests:Category[];fitness_level?:1|2|3;max_walk_min?:10|20|30;avoid_slopes:boolean;condition_today?:"great"|"normal"|"tired";diet?:"none"|"vegan"|"vegetarian"|"halal";startTime:string;endTime:string};
type Status = "idle"|"loading"|"error"|"nocandidates";
const toMinutes=(s:string)=>{const [h,m]=s.split(":").map(Number);return h*60+m;};
const fmt=(n:number)=>`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
const TIMES=Array.from({length:48},(_,i)=>fmt(i*30));
function Choice({selected,onClick,children}: {selected:boolean;onClick:()=>void;children:React.ReactNode}) {
  return <button type="button" aria-pressed={selected} className={`v9-choice ${selected?"is-selected":""}`} onClick={onClick}>{children}<span className="v9-choice-tick" aria-hidden="true">{selected?"✓":""}</span></button>;
}

export default function Onboarding(){
  const router=useRouter();
  const {locale}=useLocale();
  const c=useV6Copy(locale);
  const [step,setStep]=useState(0);
  const [d,setD]=useState<Draft>({interests:[],avoid_slopes:false,startTime:"11:00",endTime:"16:00"});
  const [status,setStatus]=useState<Status>("idle");
  const inflight=useRef(false);
  const minutes=toMinutes(d.endTime)-toMinutes(d.startTime);
  const valid=[d.interests.length>0,d.fitness_level!=null&&d.max_walk_min!=null,d.condition_today!=null,d.diet!=null,minutes>=240&&minutes<=1020];
  const plannedMinutes=minutes>=480?480:240;
  const setPreset=(length:number)=>{
    const start=toMinutes(d.startTime);
    if(start+length>=1440){setD({...d,startTime:length===480?"10:00":"11:00",endTime:length===480?"18:00":"15:00"});return;}
    setD({...d,endTime:fmt(start+length)});
  };
  const setNow=()=>{
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
    const h=Number(parts.find(x=>x.type==="hour")?.value??"0")%24;
    const m=Number(parts.find(x=>x.type==="minute")?.value??"0");
    const next=Math.ceil((h*60+m)/30)*30;
    if(next+240>1439){setStatus("error");return;}
    setStatus("idle");setD({...d,startTime:fmt(next),endTime:fmt(next+240)});
  };
  async function submit(){
    if(inflight.current||!valid.every(Boolean))return;
    inflight.current=true;setStatus("loading");
    const profile:UserProfileInput={interests:d.interests,fitness_level:d.fitness_level!,max_walk_min:d.max_walk_min!,avoid_slopes:d.avoid_slopes,condition_today:d.condition_today!,diet:d.diet!,duration:minutes>=480?"full_day":"half_day"};
    try {
      const course=await api.createCourse(profile,d.startTime);
      try{localStorage.setItem(`mypace-window:${course.id}`,JSON.stringify({start:d.startTime,end:d.endTime,availableMinutes:minutes,plannedMinutes}));}catch{/* optional */}
      router.push(`/course/${course.id}`);
    }catch(e){inflight.current=false;setStatus(e instanceof ApiError&&e.code==="NO_CANDIDATES"?"nocandidates":"error");}
  }
  return <main className="v9-site v9-onboarding">
    <V9Header />
    {status==="loading"?<div className="v9-onboarding-loading"><div className="spinner"/><h1>{({ko:"제주 여행 코스를 만들고 있어요…",en:"Planning your Jeju day…",zh:"正在规划济州之旅…",ja:"済州島の旅程を作成中…"})[locale]}</h1></div>:
    <div className="v9-onboarding-inner">
      <div className="v9-step-head"><span>{c.personalize}</span><span>{String(step+1).padStart(2,"0")} / 05</span></div>
      <div className="v9-progress"><span style={{width:`${(step+1)*20}%`}}/></div>
      <h1 className="v9-form-title">{c.stepTitles[step]}</h1>
      <p className="v9-form-desc">{c.stepDescs[step]}</p>
      <section className="v9-form-content" aria-label={c.stepTitles[step]}>
        {step===0&&<div className="v9-choices v9-interests">{INTERESTS.map((o,i)=><Choice key={o.value} selected={d.interests.includes(o.value)} onClick={()=>setD({...d,interests:d.interests.includes(o.value)?d.interests.filter(x=>x!==o.value):[...d.interests,o.value]})}><span className="v9-choice-symbol">{o.icon}</span><span>{c.interest[i]}</span></Choice>)}</div>}
        {step===1&&<div className="v9-fields-stack">
          <h2 className="v9-field-label">{c.fitness}</h2><div className="v9-choices v9-single">{([1,2,3] as const).map((v,i)=><Choice key={v} selected={d.fitness_level===v} onClick={()=>setD({...d,fitness_level:v})}><span className="v9-choice-symbol">{["🌤️","🚶","🥾"][i]}</span>{c.fitnessChoices[i]}</Choice>)}</div>
          <h2 className="v9-field-label">{c.walk}</h2><div className="v9-pills">{([10,20,30] as const).map((v,i)=><button key={v} type="button" className={d.max_walk_min===v?"is-selected":""} onClick={()=>setD({...d,max_walk_min:v})}>{c.walkChoices[i]}</button>)}</div>
          <label className="v9-checkline"><span>{c.avoid}</span><input type="checkbox" checked={d.avoid_slopes} onChange={e=>setD({...d,avoid_slopes:e.target.checked})}/></label>
        </div>}
        {step===2&&<div className="v9-choices v9-single">{(["great","normal","tired"] as const).map((v,i)=><Choice key={v} selected={d.condition_today===v} onClick={()=>setD({...d,condition_today:v})}><span className="v9-choice-symbol">{["😊","🙂","🥱"][i]}</span>{c.condition[i]}</Choice>)}</div>}
        {step===3&&<div className="v9-choices v9-single">{(["none","vegan","vegetarian","halal"] as const).map((v,i)=><Choice key={v} selected={d.diet===v} onClick={()=>setD({...d,diet:v})}><span className="v9-choice-symbol">{["🍽️","🥬","🌱","☪️"][i]}</span>{c.diet[i]}</Choice>)}</div>}
        {step===4&&<div className="v9-time-panel">
          <div className="v9-time-presets"><button type="button" onClick={setNow}>{c.now}</button><button type="button" onClick={()=>setPreset(240)}>{c.four}</button><button type="button" onClick={()=>setPreset(480)}>{c.eight}</button></div>
          <div className="v9-time-cards"><label><span>{c.start}</span><select value={d.startTime} onChange={e=>setD({...d,startTime:e.target.value})}>{TIMES.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label><span>{c.end}</span><select value={d.endTime} onChange={e=>setD({...d,endTime:e.target.value})}>{TIMES.map(v=><option key={v} value={v}>{v}</option>)}</select></label></div>
          <div className={`v9-time-summary ${!valid[4]?"is-warning":""}`} role="status">{minutes<=0?c.invalid:minutes<240?c.short:minutes>1020?c.tooLate:<><strong>{c.timeSummary}: {d.startTime} — {d.endTime}</strong><span>{Math.floor(minutes/60)}h {minutes%60?`${minutes%60}m`:""} · {plannedMinutes/60}h {({ko:"서버 생성 코스",en:"server-generated plan",zh:"服务端生成行程",ja:"サーバー生成の旅程"})[locale]}</span></>}</div>
          <p className="v9-policy">{c.timePolicy}</p>
        </div>}
      </section>
      {status==="error"&&<div role="alert" className="v9-form-error"><p>{({ko:"연결된 서버에서 코스를 생성하지 못했어요. 서버 실행 상태를 확인해 주세요.",en:"Could not create a course. Check the connected server.",zh:"无法生成行程，请检查服务器连接。",ja:"旅程を作成できません。サーバー接続をご確認ください。"})[locale]}</p><button type="button" onClick={()=>setStatus("idle")}>{({ko:"확인",en:"OK",zh:"确认",ja:"確認"})[locale]}</button></div>}
      {status==="nocandidates"&&<div role="alert" className="v9-form-error"><p>{({ko:"조건에 맞는 장소가 부족해요. 선택을 바꿔주세요.",en:"Not enough matching places. Adjust your choices.",zh:"符合条件的地点不足，请调整选择。",ja:"条件に合うスポットが足りません。"})[locale]}</p><button type="button" onClick={()=>{setStatus("idle");setStep(0)}}>{c.back}</button></div>}
      <div className="v9-step-actions"><button type="button" className="v9-outline" onClick={()=>step===0?router.push("/"):setStep(step-1)}>{c.back}</button><button type="button" className="v9-primary" disabled={!valid[step]} onClick={()=>step===4?submit():setStep(step+1)}>{step===4?c.create:c.next}</button></div>
      <p className="v9-fineprint v9-onboard-footnote">{c.simulation}</p>
    </div>}
  </main>;
}
