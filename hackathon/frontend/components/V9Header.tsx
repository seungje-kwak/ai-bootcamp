"use client";

import Link from "next/link";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useLocale } from "@/lib/i18n";

/** V6 reference branding, shared across every real Next.js route. */
export function V9Header() {
  const { locale, setLocale } = useLocale();
  return (
    <header className="v9-header">
      <Link href="/" className="v9-brand" aria-label="MyPace Jeju home">
        MyPace <strong>Jeju</strong><small>YOUR LOCAL COMPANION</small>
      </Link>
      <nav className="v9-languages" aria-label="Choose language"><LanguageSelect value={locale} onChange={setLocale}/></nav>
    </header>
  );
}
