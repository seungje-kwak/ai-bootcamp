import Link from "next/link";
import { MAP_CONFIG } from "@/config/map";

export function CourseSkeleton() {
  return (
    <div className="p-4 space-y-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-6 w-48 rounded" />
      <div className="skeleton w-full rounded-2xl" style={{ aspectRatio: String(MAP_CONFIG.aspectRatio) }} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-line overflow-hidden">
          <div className="skeleton h-40" />
          <div className="p-4 space-y-2">
            <div className="skeleton h-5 w-2/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageScreen({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-[70dvh] flex flex-col items-center justify-center text-center px-8 gap-4">
      <p className="text-xl font-bold">{title}</p>
      {body && <p className="text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`rounded-2xl bg-sea text-white font-semibold py-3.5 px-6 disabled:opacity-40 disabled:cursor-not-allowed active:brightness-95 ${className}`}
    >
      {children}
    </button>
  );
}

export function NewPlanLink({ label = "Plan a new day" }: { label?: string }) {
  return (
    <Link href="/onboarding" className="rounded-2xl bg-sea text-white font-semibold py-3.5 px-6">
      {label}
    </Link>
  );
}
