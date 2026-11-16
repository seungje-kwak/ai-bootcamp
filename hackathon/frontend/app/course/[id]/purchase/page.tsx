"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { LanguageSelect } from "@/components/LanguageSelect";
import { CourseSkeleton, MessageScreen, NewPlanLink, PrimaryButton } from "@/components/States";
import { PREMIUM_PRICE_AMOUNT } from "@/config/pricing";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useCourse } from "@/lib/useCourse";

// 6.5 Purchase (mock). No payment details are collected (11.2).
export default function PurchasePage() {
  const { id } = useParams<{ id: string }>();
  const { course, setCourse, state, reload } = useCourse(id);
  const [pay, setPay] = useState<"idle" | "loading" | "done" | "error">("idle");
  const inFlight = useRef(false);
  const { t } = useLocale();
  const P = t.purchase;

  if (state.kind === "loading") return <CourseSkeleton />;
  if (state.kind === "notfound") {
    return <MessageScreen icon="alert" title={t.states.notFound} body={t.states.notFoundBody} action={<NewPlanLink />} />;
  }
  if (state.kind === "error" || !course) {
    return (
      <MessageScreen
        icon="alert"
        title={t.states.error}
        body={t.states.errorBody}
        action={<PrimaryButton onClick={reload}>{t.common.retry}</PrimaryButton>}
      />
    );
  }

  const seeFull = (
    <Link href={`/course/${course.id}`} className="btn btn-primary">
      {P.seeFull}
    </Link>
  );
  if (pay === "done") return <MessageScreen icon="check" title={P.success} body={P.successBody} action={seeFull} />;
  if (course.tier === "premium") return <MessageScreen icon="check" title={P.already} action={seeFull} />;

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
    <main className="pb-14">
      <header className="topbar page" style={{ maxWidth: 820 }}>
        <Brand label={t.common.home} />
        <LanguageSelect />
      </header>

      <div className="page" style={{ maxWidth: 820 }}>
        <Link href={`/course/${course.id}`} className="text-link inline-flex min-h-[44px] items-center gap-1.5 text-[15px]">
          <Icon name="arrowLeft" size={17} />
          {t.trip.backToPlan}
        </Link>
        <h1 className="display course__title">{P.title}</h1>
        <p className="mt-3 text-muted">{P.seeing(course.items.length, course.total_items)}</p>

        <div className="plans">
          <section className="card plan" aria-label={P.free}>
            <div className="plan__head">
              <h2 className="plan__name">{P.free}</h2>
              <span className="chip">{P.current}</span>
            </div>
            <p className="mt-1 text-[15px] text-muted">{P.freeDesc}</p>
            <ul>
              {P.freeItems.map((x) => (
                <li key={x}>
                  <Icon name="check" size={18} />
                  {x}
                </li>
              ))}
            </ul>
          </section>

          <section className="card plan plan--premium" aria-label={P.premium}>
            <div className="plan__head">
              <h2 className="plan__name">{P.premium}</h2>
              <p className="plan__price">
                {PREMIUM_PRICE_AMOUNT}
                <small>{P.perPlan}</small>
              </p>
            </div>
            <p className="mt-1 text-[15px] text-muted">{P.premiumDesc}</p>
            <ul>
              {P.premiumItems.map((x) => (
                <li key={x}>
                  <Icon name="check" size={18} />
                  {x}
                </li>
              ))}
              <li>
                <Icon name="check" size={18} />
                <span>
                  {P.offline} <span className="chip ml-1">{P.comingSoon}</span>
                </span>
              </li>
            </ul>
          </section>
        </div>

        {pay === "error" && (
          <p className="notice notice-error mt-6" role="alert">
            <Icon name="alert" size={20} />
            {P.failed}
          </p>
        )}
        <PrimaryButton className="btn-block mt-7" onClick={onPay} disabled={pay === "loading"}>
          {pay === "loading" && <span className="spinner spinner-sm" aria-hidden="true" />}
          {pay === "loading" ? P.paying : pay === "error" ? t.common.retry : P.pay}
        </PrimaryButton>
        <p className="fine mt-3 text-center">{P.demoNote}</p>
      </div>
    </main>
  );
}
