"use client";

import Link from "next/link";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useLocale } from "@/lib/i18n";
import { useV6Copy } from "@/lib/v6-copy";
import { LANDING_IMAGES, plainCta, splitSteps, useReveal, useScrolled } from "./shared";

/**
 * Landing: quiet editorial layout. Full-bleed cover with a thin serif wordmark,
 * a three-column index along the bottom of the cover, cream paper and hairlines below.
 */
export function LandingA() {
  const { locale, setLocale } = useLocale();
  const c = useV6Copy(locale);
  const scrolled = useScrolled(80);
  const ref = useReveal<HTMLElement>();
  const steps = splitSteps(c.guideHow);
  const cta = plainCta(c.begin);
  const gallery = [LANDING_IMAGES.culture, LANDING_IMAGES.food, LANDING_IMAGES.market, LANDING_IMAGES.hero];

  return (
    <main ref={ref} className="lp lpa">
      <header className={`lpa-bar ${scrolled ? "is-scrolled" : ""}`}>
        <span className="lpa-bar-tag">Not just a trip — a day at your pace</span>
        <Link href="/" className="lpa-bar-brand" aria-label="MyPace Jeju home">MyPace Jeju</Link>
        <div className="lpa-bar-right">
          <a href="#lpa-guide">Guide</a>
          <a href="#lpa-journey">Journey</a>
          <LanguageSelect value={locale} onChange={setLocale} />
        </div>
      </header>

      <Link href="/onboarding" className="lpa-float">
        <strong>{cta}</strong>
        <small>{c.guideIntro}</small>
      </Link>

      <section className="lpa-cover" aria-labelledby="lpa-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LANDING_IMAGES.hero} alt="" aria-hidden="true" />
        <div className="lpa-cover-center">
          <p className="lpa-wordmark" aria-hidden="true">MyPace Jeju</p>
          <p className="lpa-cover-tag">Your private AI travel guide</p>
          <h1 id="lpa-title">{c.hero1} {c.hero2}</h1>
        </div>
        <nav className="lpa-index" aria-label="Sections">
          <a href="#lpa-guide"><span>{c.guide[0]}</span><em>The Guide</em></a>
          <a href="#lpa-journey"><span>{c.guide[1]}</span><em>The Journey</em></a>
          <Link href="/onboarding"><span>{cta}</span><em>Begin</em></Link>
        </nav>
      </section>

      <section className="lpa-about">
        <p className="lpa-label" data-reveal>About the Guide</p>
        <h2 data-reveal>{c.guideTitle}</h2>
        <p className="lpa-about-desc" data-reveal>{c.heroDesc}</p>
        <Link href="/onboarding" className="lpa-outline" data-reveal>{cta}</Link>
      </section>

      <section id="lpa-guide" className="lpa-guide">
        <div className="lpa-guide-head" data-reveal>
          <div>
            <p className="lpa-label">Discover</p>
            <h2>{c.guideIntro}</h2>
          </div>
          <span className="lpa-count">01 <i>/ 0{c.guide.length}</i></span>
        </div>
        <div className="lpa-rail">
          {c.guide.map((title, i) => (
            <article key={title} className="lpa-card" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="lpa-card-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gallery[i % gallery.length]} alt="" loading="lazy" />
              </div>
              <p className="lpa-card-no">0{i + 1}</p>
              <h3>{title}</h3>
              <p>{c.guideDesc[i]}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="lpa-journey" className="lpa-journey">
        <p className="lpa-label" data-reveal>The Journey</p>
        <h2 data-reveal>{c.hero1}<br />{c.hero2}</h2>
        <ol className="lpa-steps">
          {steps.map((step, i) => (
            <li key={step} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="lpa-closing">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LANDING_IMAGES.culture} alt="" aria-hidden="true" loading="lazy" />
        <div data-reveal>
          <p className="lpa-closing-en">Private<br />Companion</p>
          <p className="lpa-closing-desc">{c.heroDesc}</p>
          <Link href="/onboarding" className="lpa-solid">{cta}</Link>
        </div>
      </section>

      <footer className="lpa-footer">
        <span className="lpa-footer-brand">MyPace Jeju</span>
        <p>{c.homeFoot}</p>
        <span>MY PACE, MY JEJU · YOUR LOCAL COMPANION</span>
      </footer>
    </main>
  );
}
