"use client";

import Link from "next/link";
import { BottomBar } from "@/components/BottomBar";
import { Brand } from "@/components/Brand";
import { HeroArt } from "@/components/HeroArt";
import { Icon, type IconName } from "@/components/Icon";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useLocale } from "@/lib/i18n";

const FEATURE_ICONS: IconName[] = ["photo", "route", "taxi"];

// 6.1 Landing. One action (start planning); no data requests.
export default function Landing() {
  const { t } = useLocale();
  const L = t.landing;
  // Longest headline line, in characters. CSS sizes CJK headlines from it so no line wraps.
  const chars = Math.max(...L.titleLines.map((line) => Array.from(line).length));

  return (
    <main className="landing">
      <header className="landing__bar page">
        <Brand href={null} />
        <LanguageSelect variant="segmented" />
      </header>

      <div className="landing__grid page">
        <section className="landing__copy">
          <div className="landing__intro">
          <p className="landing__kicker">{L.kicker}</p>
          <h1 className="display landing__title" style={{ "--chars": chars } as React.CSSProperties}>
            {L.titleLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p className="landing__sub">{L.sub}</p>

          <div className="landing__cta">
            <Link className="btn btn-primary" href="/onboarding">
              {L.cta}
            </Link>
            <p className="fine">{L.ctaNote}</p>
          </div>
          </div>

          <h2 className="sr-only">{L.featuresTitle}</h2>
          <ul className="landing__features">
            {L.features.map((f, i) => (
              <li key={f.title} className="landing__feature">
                <span className="landing__feature-icon">
                  <Icon name={FEATURE_ICONS[i]} size={22} />
                </span>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <figure className="landing__art">
          <div className="landing__art-frame">
            <HeroArt label={L.artAlt} />
          </div>
          <div className="card landing__sample">
            <p className="label">{L.sampleLabel}</p>
            <ol>
              {L.sample.map((s, i) => (
                <li key={s.time}>
                  <span className="stop-no" aria-hidden="true">
                    {i + 1}
                  </span>
                  <time>{s.time}</time>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.name}</span>
                    <small>{s.note}</small>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <figcaption className="fine landing__caption">{L.artCaption}</figcaption>
        </figure>
      </div>

      <div className="landing__mobile-cta">
        <BottomBar>
          <Link className="btn btn-primary btn-block" href="/onboarding">
            {L.cta}
          </Link>
          <p className="fine mt-2 text-center">{L.ctaNote}</p>
        </BottomBar>
      </div>
    </main>
  );
}
