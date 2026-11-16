import Link from "next/link";

// Wordmark plus a small mark: a route line that ends at a stop, over the sea colour.
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <rect width="28" height="28" rx="9" fill="var(--sea)" />
      <path
        d="M6.5 18.5c2.2-6.4 4.3-6.4 6-2.2 1.5 3.8 3.4 3.6 5.2-1.8"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.1 3.6"
      />
      <circle cx="19.4" cy="10.6" r="3" fill="var(--coral)" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

export function Brand({ href = "/", label }: { href?: string | null; label?: string }) {
  const inner = (
    <>
      <BrandMark />
      <span>
        MyPace <span className="brand__place">Jeju</span>
      </span>
    </>
  );
  if (!href) return <span className="brand">{inner}</span>;
  return (
    <Link href={href} className="brand" aria-label={label}>
      {inner}
    </Link>
  );
}
