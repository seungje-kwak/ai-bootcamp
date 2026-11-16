"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

type SavedWindow = {start:string; end:string; availableMinutes:number; plannedMinutes:number};
export function WindowSummary({ courseId }: {courseId:string}) {
  const [windowData, setWindowData] = useState<SavedWindow | null>(null);
  const { locale } = useLocale();
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`mypace-window:${courseId}`);
      if (!raw) return;
      const parsed: SavedWindow = JSON.parse(raw);
      if (/^\d{2}:\d{2}$/.test(parsed.start) && /^\d{2}:\d{2}$/.test(parsed.end) && Number.isFinite(parsed.plannedMinutes)) setWindowData(parsed);
    } catch { /* unavailable, hide optional summary */ }
  }, [courseId]);
  if (!windowData) return null;
  const { start, end, availableMinutes, plannedMinutes } = windowData;
  const flexible = Math.max(0, availableMinutes - plannedMinutes);
  const format = (min:number) => min%60 ? `${Math.floor(min/60)}h ${min%60}m` : `${min/60}h`;
  const text = ({ko:`여행 가능 ${format(availableMinutes)} · 생성 코스 약 ${format(plannedMinutes)} · 여유 ${format(flexible)}`,en:`Available ${format(availableMinutes)} · ~${format(plannedMinutes)} itinerary · ${format(flexible)} flexible`,zh:`可用 ${format(availableMinutes)} · 已规划约 ${format(plannedMinutes)} · 弹性 ${format(flexible)}`,ja:`利用可能 ${format(availableMinutes)} · 約 ${format(plannedMinutes)} の旅程 · 余裕 ${format(flexible)}`})[locale];
  return <div className="gpt-window-banner"><span className="gpt-window-icon" aria-hidden="true">◷</span><div><strong>{start} — {end} <span style={{fontWeight:500,fontSize:12}}>KST</span></strong><small>{text}</small></div></div>;
}
