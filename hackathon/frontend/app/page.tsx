import Link from "next/link";

// 6.1 Landing — one button, no data requests.
export default function Landing() {
  return (
    <main className="min-h-[100dvh] flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/map/jeju-city-fallback.svg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/40 to-white" />
        <div className="relative px-6 pt-16">
          <p className="text-sm font-semibold tracking-wide text-sea">JEJU CITY · FOR SOLO TRAVELERS</p>
          <h1 className="mt-3 text-[42px] font-extrabold leading-[1.05]">
            MyPace
            <br />
            Jeju
          </h1>
        </div>
      </div>
      <div className="px-6 pb-10 pt-2">
        <p className="text-lg leading-relaxed">
          Tell us your taste and your pace. Get a Jeju City day built from real places with real photos, re-planned
          as your day changes.
        </p>
        <ul className="mt-5 space-y-2 text-[15px] text-muted">
          <li>📷 Real places, real photos, with sources</li>
          <li>🌧️ Rain or a closed door? Re-plan in one tap</li>
          <li>🚕 Korean cards for your taxi driver</li>
        </ul>
        <Link
          href="/onboarding"
          className="mt-8 block w-full rounded-2xl bg-sea py-4 text-center text-lg font-semibold text-white"
        >
          Plan my day
        </Link>
      </div>
    </main>
  );
}
