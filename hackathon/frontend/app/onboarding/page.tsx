"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { V9Header } from "@/components/V9Header";
import { api, ApiError } from "@/lib/api";
import type { Area, Category, UserProfileInput } from "@/lib/types";
import { MESSAGES, useLocale } from "@/lib/i18n";
import { TRIP_TIME, endOptions, startOptions, toHHMM } from "@/lib/tripTime";
import { useV6Copy } from "@/lib/v6-copy";

const INTERESTS: {value:Category;icon:string}[] = [
  {value:"nature",icon:"🌿"},{value:"market",icon:"🧺"},{value:"cafe",icon:"☕"},
  {value:"food",icon:"🥢"},{value:"culture",icon:"🏛️"},{value:"photo",icon:"📷"},
];
type Draft = {interests:Category[];fitness_level?:1|2|3;max_walk_min?:10|20|30;avoid_slopes:boolean;condition_today?:"great"|"normal"|"tired";diet?:"none"|"vegan"|"vegetarian"|"halal";area_id?:string;startTime:string;endTime:string};
type AreaList={kind:"loading"}|{kind:"error"}|{kind:"ok";areas:Area[]};
const AREA_GROUPS:Area["group"][]=["jeju","seogwipo"];
const AREA_STEP=4, TIME_STEP=5, STEP_COUNT=6;
type Status = "idle"|"loading"|"error"|"nocandidates"|"badarea";
const toMinutes=(s:string)=>{const [h,m]=s.split(":").map(Number);return h*60+m;};
const fmt=(n:number)=>`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
function Choice({selected,onClick,children}: {selected:boolean;onClick:()=>void;children:React.ReactNode}) {
  return <button type="button" aria-pressed={selected} className={`v9-choice ${selected?"is-selected":""}`} onClick={onClick}>{children}<span className="v9-choice-tick" aria-hidden="true">{selected?"✓":""}</span></button>;
}

export default function Onboarding(){
  const router=useRouter();
  const {locale}=useLocale();
  const c=useV6Copy(locale);
  const O=MESSAGES[locale].onboarding;
  const [step,setStep]=useState(0);
  const [d,setD]=useState<Draft>({interests:[],avoid_slopes:false,startTime:"11:00",endTime:"16:00"});
  const [status,setStatus]=useState<Status>("idle");
  const inflight=useRef(false);
  const [areaList,setAreaList]=useState<AreaList>({kind:"loading"});
  const loadAreas=useCallback(async()=>{
    setAreaList({kind:"loading"});
    try{setAreaList({kind:"ok",areas:(await api.areas()).areas});}catch{setAreaList({kind:"error"});}
  },[]);
  useEffect(()=>{loadAreas();},[loadAreas]);
  const areas=areaList.kind==="ok"?areaList.areas:[];
  const area=areas.find(a=>a.id===d.area_id);
  const areaName=(a:Area)=>locale==="ko"?a.name_ko:a.name_en;
  const minutes=toMinutes(d.endTime)-toMinutes(d.startTime);
  const startMin=toMinutes(d.startTime), endMin=toMinutes(d.endTime);
  // Same limits as the backend (lib/tripTime.ts): start 08:00-16:00, end by 22:00, 2-10 hours.
  const timeError=endMin<=startMin?O.time.errOrder:startMin<TRIP_TIME.minStart||startMin>TRIP_TIME.maxStart?O.time.errStart:endMin>TRIP_TIME.maxEnd?O.time.errEnd:minutes<TRIP_TIME.minLength?O.time.errShort:minutes>TRIP_TIME.maxLength?O.time.errLong:null;
  const valid=[d.interests.length>0,d.fitness_level!=null&&d.max_walk_min!=null,d.condition_today!=null,d.diet!=null,area?.selectable===true,timeError===null];
  const plannedMinutes=minutes;
  const setPreset=(length:number)=>{
    const start=Math.max(TRIP_TIME.minStart,Math.min(toMinutes(d.startTime),TRIP_TIME.maxStart,TRIP_TIME.maxEnd-length));
    setD({...d,startTime:fmt(start),endTime:fmt(start+length)});
  };
  const setNow=()=>{
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
    const h=Number(parts.find(x=>x.type==="hour")?.value??"0")%24;
    const m=Number(parts.find(x=>x.type==="minute")?.value??"0");
    const next=Math.ceil((h*60+m)/30)*30;
    if(next<TRIP_TIME.minStart||next>TRIP_TIME.maxStart){setD({...d,startTime:toHHMM(TRIP_TIME.fallbackStart),endTime:toHHMM(TRIP_TIME.fallbackStart+TRIP_TIME.defaultLength)});return;}
    setStatus("idle");setD({...d,startTime:fmt(next),endTime:fmt(Math.min(next+TRIP_TIME.defaultLength,TRIP_TIME.maxEnd))});
  };
  async function submit(){
    if(inflight.current||!valid.every(Boolean)||!d.area_id)return;
    inflight.current=true;setStatus("loading");
    const profile:UserProfileInput={interests:d.interests,fitness_level:d.fitness_level!,max_walk_min:d.max_walk_min!,avoid_slopes:d.avoid_slopes,condition_today:d.condition_today!,diet:d.diet!};
    try {
      const course=await api.createCourse(profile,d.area_id,d.startTime,d.endTime);
      try{localStorage.setItem(`mypace-window:${course.id}`,JSON.stringify({start:d.startTime,end:d.endTime,availableMinutes:minutes,plannedMinutes}));}catch{/* optional */}
      router.push(`/course/${course.id}`);
    }catch(e){
      inflight.current=false;
      const code=e instanceof ApiError?e.code:null;
      if(code==="INVALID_AREA"){setD(prev=>({...prev,area_id:undefined}));setStatus("badarea");setStep(AREA_STEP);loadAreas();return;}
      setStatus(code==="NO_CANDIDATES"?"nocandidates":"error");
    }
  }
  const stepTitle=step===AREA_STEP?O.steps[AREA_STEP].title:c.stepTitles[step===TIME_STEP?4:step];
  const stepDesc=step===AREA_STEP?O.steps[AREA_STEP].sub:c.stepDescs[step===TIME_STEP?4:step];
  return <main className="v9-site v9-onboarding">
    <V9Header />
    {status==="loading"?<div className="v9-onboarding-loading"><div className="spinner"/><h1>{({ko:"제주 여행 코스를 만들고 있어요…",en:"Planning your Jeju day…",zh:"正在规划济州之旅…",ja:"済州島の旅程を作成中…"})[locale]}</h1></div>:
    <div className="v9-onboarding-inner">
      <div className="v9-step-head"><span>{c.personalize}</span><span>{String(step+1).padStart(2,"0")} / {String(STEP_COUNT).padStart(2,"0")}</span></div>
      <div className="v9-progress"><span style={{width:`${((step+1)/STEP_COUNT)*100}%`}}/></div>
      <h1 className="v9-form-title">{stepTitle}</h1>
      <p className="v9-form-desc">{stepDesc}</p>
      <section className="v9-form-content" aria-label={stepTitle}>
        {step===0&&<div className="v9-choices v9-interests">{INTERESTS.map((o,i)=><Choice key={o.value} selected={d.interests.includes(o.value)} onClick={()=>setD({...d,interests:d.interests.includes(o.value)?d.interests.filter(x=>x!==o.value):[...d.interests,o.value]})}><span className="v9-choice-symbol">{o.icon}</span><span>{c.interest[i]}</span></Choice>)}</div>}
        {step===1&&<div className="v9-fields-stack">
          <h2 className="v9-field-label">{c.fitness}</h2><div className="v9-choices v9-single">{([1,2,3] as const).map((v,i)=><Choice key={v} selected={d.fitness_level===v} onClick={()=>setD({...d,fitness_level:v})}><span className="v9-choice-symbol">{["🌤️","🚶","🥾"][i]}</span>{c.fitnessChoices[i]}</Choice>)}</div>
          <h2 className="v9-field-label">{c.walk}</h2><div className="v9-pills">{([10,20,30] as const).map((v,i)=><button key={v} type="button" className={d.max_walk_min===v?"is-selected":""} onClick={()=>setD({...d,max_walk_min:v})}>{c.walkChoices[i]}</button>)}</div>
          <label className="v9-checkline"><span>{c.avoid}</span><input type="checkbox" checked={d.avoid_slopes} onChange={e=>setD({...d,avoid_slopes:e.target.checked})}/></label>
        </div>}
        {step===2&&<div className="v9-choices v9-single">{(["great","normal","tired"] as const).map((v,i)=><Choice key={v} selected={d.condition_today===v} onClick={()=>setD({...d,condition_today:v})}><span className="v9-choice-symbol">{["😊","🙂","🥱"][i]}</span>{c.condition[i]}</Choice>)}</div>}
        {step===3&&<div className="v9-choices v9-single">{(["none","vegan","vegetarian","halal"] as const).map((v,i)=><Choice key={v} selected={d.diet===v} onClick={()=>setD({...d,diet:v})}><span className="v9-choice-symbol">{["🍽️","🥬","🌱","☪️"][i]}</span>{c.diet[i]}</Choice>)}</div>}
        {step===AREA_STEP&&areaList.kind==="loading"&&<p className="v9-form-desc" role="status">{O.area.loading}</p>}
        {step===AREA_STEP&&areaList.kind==="error"&&<div role="alert" className="v9-form-error"><p>{O.area.loadError}</p><button type="button" onClick={loadAreas}>{({ko:"다시 시도",en:"Retry",zh:"重试",ja:"再試行"})[locale]}</button></div>}
        {step===AREA_STEP&&areaList.kind==="ok"&&<div className="v9-fields-stack">
          {status==="badarea"&&<p role="alert" className="v9-form-error">{O.area.badArea}</p>}
          {AREA_GROUPS.map(group=><div key={group} role="group" aria-label={O.area.groups[group]}>
            <h2 className="v9-field-label">{O.area.groups[group]}</h2>
            <div className="v9-choices v9-single">{areas.filter(a=>a.group===group).map(a=><button key={a.id} type="button" disabled={!a.selectable} aria-pressed={d.area_id===a.id} className={`v9-choice ${d.area_id===a.id?"is-selected":""}`} onClick={()=>{setD({...d,area_id:a.id});if(status==="badarea")setStatus("idle");}}><span>{a.selectable?areaName(a):`${areaName(a)} · ${O.area.comingSoon}`}</span><span className="v9-choice-tick" aria-hidden="true">{d.area_id===a.id?"✓":""}</span></button>)}</div>
          </div>)}
        </div>}
        {step===TIME_STEP&&<div className="v9-time-panel">
          <div className="v9-time-presets"><button type="button" onClick={setNow}>{c.now}</button><button type="button" onClick={()=>setPreset(240)}>{c.four}</button><button type="button" onClick={()=>setPreset(480)}>{c.eight}</button></div>
          <div className="v9-time-cards"><label><span>{c.start}</span><select value={d.startTime} onChange={e=>setD({...d,startTime:e.target.value})}>{startOptions().map(toHHMM).map(v=><option key={v} value={v}>{v}</option>)}</select></label><label><span>{c.end}</span><select value={d.endTime} onChange={e=>setD({...d,endTime:e.target.value})}>{endOptions(startMin).map(toHHMM).map(v=><option key={v} value={v}>{v}</option>)}</select></label></div>
          <div className={`v9-time-summary ${timeError?"is-warning":""}`} role="status">{timeError??<><strong>{c.timeSummary}: {d.startTime} — {d.endTime}</strong><span>{Math.floor(minutes/60)}h {minutes%60?`${minutes%60}m`:""} · {O.time.fit}</span></>}</div>
          <p className="v9-policy">{O.time.why}</p>
        </div>}
      </section>
      {status==="error"&&<div role="alert" className="v9-form-error"><p>{({ko:"연결된 서버에서 코스를 생성하지 못했어요. 서버 실행 상태를 확인해 주세요.",en:"Could not create a course. Check the connected server.",zh:"无法生成行程，请检查服务器连接。",ja:"旅程を作成できません。サーバー接続をご確認ください。"})[locale]}</p><button type="button" onClick={()=>setStatus("idle")}>{({ko:"확인",en:"OK",zh:"确认",ja:"確認"})[locale]}</button></div>}
      {status==="nocandidates"&&<div role="alert" className="v9-form-error"><p>{({ko:"조건에 맞는 장소가 부족해요. 선택을 바꿔주세요.",en:"Not enough matching places. Adjust your choices.",zh:"符合条件的地点不足，请调整选择。",ja:"条件に合うスポットが足りません。"})[locale]}</p><button type="button" onClick={()=>{setStatus("idle");setStep(0)}}>{c.back}</button></div>}
      <div className="v9-step-actions"><button type="button" className="v9-outline" onClick={()=>step===0?router.push("/"):setStep(step-1)}>{c.back}</button><button type="button" className="v9-primary" disabled={!valid[step]} onClick={()=>step===TIME_STEP?submit():setStep(step+1)}>{step===TIME_STEP?c.create:c.next}</button></div>
      <p className="v9-fineprint v9-onboard-footnote">{c.simulation}</p>
    </div>}
  </main>;
}
