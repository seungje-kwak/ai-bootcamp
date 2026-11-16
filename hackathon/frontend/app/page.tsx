"use client";

import Link from "next/link";
import { V9Header } from "@/components/V9Header";
import { useLocale } from "@/lib/i18n";
import { useV6Copy } from "@/lib/v6-copy";

const ICONS = ["🌿", "🕰️", "🗺️", "☂️"];

export default function Landing() {
  const { locale } = useLocale();
  const c = useV6Copy(locale);
  return <main className="v9-site v9-home">
    <V9Header />
    <section className="v9-hero" aria-labelledby="v9-home-title">
      {/* 3D illustration; never presented as a photograph of a real place. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="v9-hero-image" src="/images/jeju-3d-hero.webp" alt="" aria-hidden="true" />
      <div className="v9-hero-content">
        <p className="v9-eyebrow">YOUR PRIVATE AI TRAVEL GUIDE</p>
        <h1 id="v9-home-title"><span>{c.hero1}</span><span>{c.hero2}</span></h1>
        <p className="v9-hero-description">{c.heroDesc}</p>
        <Link href="/onboarding" className="v9-primary v9-hero-start">{c.begin}</Link>
        <p className="v9-fineprint">{c.homeFoot}</p>
      </div>
    </section>
    <section className="v9-guides" aria-labelledby="v9-guides-title">
      <div className="v9-guides-heading">
        <p className="v9-eyebrow">DISCOVER MY PACE JEJU</p>
        <h2 id="v9-guides-title">{c.guideTitle}</h2>
        <p>{c.guideIntro}</p>
      </div>
      <div className="v9-guide-grid">
        {c.guide.map((title,i)=><article key={title} className="v9-guide-card">
          <span className="v9-guide-icon" aria-hidden="true">{ICONS[i]}</span>
          <h3>{title}</h3><p>{c.guideDesc[i]}</p>
        </article>)}
      </div>
      <div className="v9-guide-how">{c.guideHow}</div>
      <div className="v9-guide-cta"><Link href="/onboarding" className="v9-primary">{c.begin}</Link></div>
    </section>
    <footer className="v9-footer"><span>MY PACE, MY JEJU</span><span>YOUR LOCAL COMPANION</span></footer>
  </main>;
}
