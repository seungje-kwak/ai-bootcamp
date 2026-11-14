"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JejuMap } from "@/components/JejuMap";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { MoveInfo, StopCard } from "@/components/StopCard";
import { api } from "@/lib/api";
import { type Area, DEFAULT_AREA_ID, type Place } from "@/lib/types";
import { useCourse } from "@/lib/useCourse";

// 6.3 Result page
export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { course, state, reload } = useCourse(id);
  const [places, setPlaces] = useState<Place[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const areaId = course ? (course.user_profile.area_id ?? DEFAULT_AREA_ID) : null;

  useEffect(() => {
    api.areas().then((r) => setAreas(r.areas)).catch(() => setAreas([])); // area name only; failure is fine
  }, []);

  useEffect(() => {
    if (!areaId) return;
    // Only the places of the traveler's area. Markers only; failure is fine.
    api.places(areaId).then((r) => setPlaces(r.places)).catch(() => setPlaces([]));
  }, [areaId]);

  if (state.kind === "loading") return <CourseSkeleton />;
  if (state.kind === "notfound")
    return <MessageScreen title="We couldn't find this plan." action={<NewPlanLink />} />;
  if (state.kind === "error" || !course)
    return (
      <MessageScreen title="Something went wrong." action={<PrimaryButton onClick={reload}>Retry</PrimaryButton>} />
    );

  const area = areas.find((a) => a.id === areaId);

  return (
    <main className="pb-28">
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-sea">
            MyPace Jeju
          </Link>
          {course.tier === "free" ? (
            <span className="rounded-full bg-tangerine-soft text-[#a4520a] px-2.5 py-0.5 text-xs font-bold">Preview</span>
          ) : (
            <span className="rounded-full bg-sea-soft text-sea px-2.5 py-0.5 text-xs font-bold">Premium</span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold">Your day in {area ? area.name_en : "Jeju"}</h1>
        <p className="text-muted">{course.total_items} stops</p>
      </header>

      <section className="px-4">
        <JejuMap
          items={course.items}
          places={places}
          center={area && { lat: area.center_lat, lng: area.center_lng }}
        />
      </section>

      <section className="px-4 mt-5">
        {course.items.length === 0 ? (
          <MessageScreen title="No stops in this plan yet." action={<NewPlanLink />} />
        ) : (
          course.items.map((it) => (
            <div key={it.order}>
              <MoveInfo item={it} />
              <StopCard item={it} tier={course.tier} diet={course.user_profile.diet} />
            </div>
          ))
        )}

        {course.locked_count > 0 && (
          <Link
            href={`/course/${course.id}/purchase`}
            className="mt-4 block rounded-2xl border-2 border-dashed border-tangerine bg-tangerine-soft p-5 text-center"
          >
            <p className="text-2xl" aria-hidden>
              🔒
            </p>
            <p className="mt-1 font-bold">
              {course.locked_count} more {course.locked_count === 1 ? "stop" : "stops"} in your full day
            </p>
            <span className="mt-3 inline-block rounded-xl bg-tangerine px-5 py-2.5 font-semibold text-white">
              Unlock full day
            </span>
          </Link>
        )}
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="mx-auto max-w-[430px] bg-white/95 backdrop-blur border-t border-line px-4 py-3">
          <Link
            href={`/course/${course.id}/trip`}
            className="block w-full rounded-2xl bg-sea py-3.5 text-center font-semibold text-white"
          >
            Start my day
          </Link>
        </div>
      </div>
    </main>
  );
}
