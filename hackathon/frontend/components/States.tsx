"use client";

import Link from "next/link";
import { MAP_CONFIG } from "@/config/map";
import { MESSAGES, useLocale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";

// Loading: the shape of the course screen (facts, map, cards) so nothing jumps when data arrives.
export function CourseSkeleton() {
  const t = MESSAGES[useLocale().locale];
  return (
    <div className="page" aria-busy="true" aria-label={t.states.loading} style={{ paddingBlock: 24 }}>
      <div className="skeleton h-7 w-40 rounded-lg" />
      <div className="skeleton mt-8 h-10 w-3/4 max-w-[420px] rounded-xl" />
      <div className="skeleton mt-5 h-[76px] w-full rounded-card" />
      <div className="course__grid mt-6">
        <div className="grid gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton h-[200px]" />
              <div className="space-y-3 p-5">
                <div className="skeleton h-6 w-2/3 rounded-lg" />
                <div className="skeleton h-4 w-1/3 rounded-lg" />
                <div className="skeleton h-16 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
        <div className="course__side">
          <div className="card panel">
            <div className="skeleton w-full rounded-2xl" style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty, error and finished states. They always say what happened and offer the next step.
export function MessageScreen({
  title,
  body,
  action,
  icon = "info",
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  icon?: IconName;
}) {
  return (
    <main className="message">
      <div className="card message__box">
        <span className="message__icon">
          <Icon name={icon} size={28} />
        </span>
        <h1 className="display message__title">{title}</h1>
        {body && <p className="message__body">{body}</p>}
        {action && <div className="message__actions">{action}</div>}
      </div>
    </main>
  );
}

export function PrimaryButton({ children, className = "", type = "button", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} {...rest} className={`btn btn-primary ${className}`}>
      {children}
    </button>
  );
}

export function NewPlanLink({ label }: { label?: string }) {
  const t = MESSAGES[useLocale().locale];
  return (
    <Link href="/onboarding" className="btn btn-primary">
      {label ?? t.common.newPlan}
    </Link>
  );
}
