"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { PREMIUM_PRICE_LABEL } from "@/config/pricing";
import { api } from "@/lib/api";
import { useCourse } from "@/lib/useCourse";

// 6.5 Purchase (mock). No payment fields, ever (11.2).
export default function PurchasePage() {
  const { id } = useParams<{ id: string }>();
  const { course, setCourse, state, reload } = useCourse(id);
  const [pay, setPay] = useState<"idle" | "loading" | "done" | "error">("idle");
  const inFlight = useRef(false);

  if (state.kind === "loading") return <CourseSkeleton />;
  if (state.kind === "notfound")
    return <MessageScreen title="We couldn't find this plan." action={<NewPlanLink />} />;
  if (state.kind === "error" || !course)
    return (
      <MessageScreen title="Something went wrong." action={<PrimaryButton onClick={reload}>Retry</PrimaryButton>} />
    );

  const seeDay = (
    <Link href={`/course/${course.id}`} className="rounded-2xl bg-sea text-white font-semibold py-3.5 px-6">
      See my full day
    </Link>
  );
  if (pay === "done") return <MessageScreen title="You're all set." body="Your full day is unlocked." action={seeDay} />;
  if (course.tier === "premium") return <MessageScreen title="This plan is already unlocked." action={seeDay} />;

  async function onPay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPay("loading");
    try {
      setCourse(await api.purchase(id));
      setPay("done");
    } catch {
      setPay("error");
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <main className="px-5 pt-6 pb-10">
      <Link href={`/course/${course.id}`} className="text-sm font-semibold text-sea">
        ← Back to my plan
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Unlock your full day</h1>
      <p className="text-muted">
        You&apos;re seeing {course.items.length} of {course.total_items} stops.
      </p>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border border-line p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-lg font-bold">Free</p>
            <p className="text-muted">Current</p>
          </div>
          <p className="text-sm text-muted">Course preview</p>
          <ul className="mt-3 text-[15px]">
            <li>✓ Up to 3 stops</li>
          </ul>
        </div>

        <div className="rounded-2xl border-2 border-sea bg-sea-soft/40 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-lg font-bold">Premium</p>
            <p className="font-bold text-sea text-right">{PREMIUM_PRICE_LABEL}</p>
          </div>
          <p className="text-sm text-muted">One-time payment for this plan</p>
          <ul className="mt-3 space-y-1 text-[15px]">
            <li>✓ Full course</li>
            <li>✓ Unlimited re-planning</li>
            <li>✓ Local phrase cards</li>
            <li className="text-muted">
              ✓ Offline PDF <span className="ml-1 rounded bg-sand px-1.5 py-0.5 text-xs">Coming soon</span>
            </li>
          </ul>
        </div>
      </div>

      {pay === "error" && (
        <p role="alert" className="mt-5 rounded-xl bg-tangerine-soft border border-[#f6c99a] p-3 font-medium">
          Payment didn&apos;t go through. Nothing was charged.
        </p>
      )}

      <PrimaryButton className="mt-6 w-full text-lg" onClick={onPay} disabled={pay === "loading"}>
        {pay === "loading" ? "Processing…" : pay === "error" ? "Try again" : "Pay now"}
      </PrimaryButton>
      <p className="mt-2 text-center text-sm text-muted">Demo payment. No real charge.</p>
    </main>
  );
}
