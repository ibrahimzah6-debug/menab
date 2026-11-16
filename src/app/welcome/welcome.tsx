"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Isometric } from "./isometric";

// The public website: dark and cinematic (design-system/README.md). The walkthrough teaches the
// way expo.dev does: the drawing on one side, the numbered stages on the other; scrolling to a
// stage, or pressing it, rebuilds the drawing and shows that stage's screen.

type C = Dictionary["site"];
const SCREENS = ["brief", "stageboard", "stagepage", "stagepage", "stageboard", "main", "main"];

export function Welcome({ c, locale }: { c: C; locale: "en" | "ar" }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const router = useRouter();
  const [pending, start] = useTransition();

  // The stage nearest the middle of the screen is the active one.
  useEffect(() => {
    const els = refs.current.filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(Number((hit.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const switchTo = (l: "en" | "ar") =>
    start(async () => {
      await setLocale(l);
      router.refresh();
    });

  return (
    <div data-theme="dark" className="site" style={{ background: "var(--ground)", color: "var(--ink)", minHeight: "100vh" }}>
      <header className="site-wrap flex items-center gap-2 md:gap-4 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/menab-logo-light.png" alt="Menab" style={{ height: 28 }} />
        <span className="grow" />
        <div className="flex items-center gap-1" role="group" aria-label="Language">
          {(["en", "ar"] as const).map((l) => (
            <button key={l} type="button" disabled={pending} aria-pressed={locale === l} onClick={() => locale !== l && switchTo(l)} className={`mn-btn mn-btn--ghost mn-btn--sm ${locale === l ? "text-ink" : ""}`} lang={l}>
              {l === "en" ? "EN" : "عربي"}
            </button>
          ))}
        </div>
        <a href="/login" className="mn-btn mn-btn--secondary mn-btn--sm">{c.login}</a>
      </header>

      <section className="site-wrap grid gap-10 items-center py-16 md:py-24 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-6">
          <span className="mn-label" style={{ color: "var(--ink-faint)" }}>{c.eyebrow}</span>
          <h1 className="display m-0" style={{ fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.06 }} dir="auto">{c.hero}</h1>
          <p className={`${locale === "ar" ? "body-ar" : "body"} m-0`} style={{ color: "var(--ink-muted)", maxWidth: 560 }}>{c.sub}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            <a href="/login" className="mn-btn" style={{ background: "var(--accent)", color: "var(--on-accent)", borderColor: "transparent" }}>{c.start}</a>
            <a href="#how" className="mn-btn mn-btn--secondary">{c.howTitle}</a>
          </div>
        </div>
        <div className="site-art" style={{ aspectRatio: "13 / 10" }}>
          <Isometric scene={0} />
        </div>
      </section>

      <section id="how" className="site-wrap py-16 md:py-24 border-t" style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-col gap-3 mb-12 max-w-[640px]">
          <h2 className="h1 m-0">{c.howTitle}</h2>
          <p className="body m-0" style={{ color: "var(--ink-muted)" }}>{c.howSub}</p>
        </div>
        <div className="grid gap-12 md:grid-cols-[1fr_1fr] items-start">
          <div className="md:sticky md:top-10 flex flex-col gap-6">
            <div className="site-art" style={{ aspectRatio: "13 / 10" }}>
              <Isometric scene={active + 1} />
            </div>
            <div className="site-screen" style={{ aspectRatio: "16 / 10" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={SCREENS[active]} src={`/screens/${SCREENS[active]}.jpg`} alt="" className={playing === active ? "site-screen__img site-screen__img--playing" : "site-screen__img"} />
              <div className="site-screen__bar">
                <span className="mn-label" lang="en">{String(active + 1).padStart(2, "0")} / {String(c.stages.length).padStart(2, "0")}</span>
                <span className="small grow truncate" dir="auto">{c.stages[active].name}</span>
                <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" aria-pressed={playing === active} onClick={() => setPlaying(playing === active ? null : active)}>
                  {playing === active ? c.pause : c.play}
                </button>
              </div>
            </div>
          </div>
          <ol className="m-0 p-0 list-none flex flex-col">
            {c.stages.map((s, i) => (
              <li key={i} ref={(el) => { refs.current[i] = el; }} data-i={i} className={`site-stage ${active === i ? "site-stage--on" : ""}`}>
                <button type="button" className="site-stage__btn" onClick={() => { setActive(i); setPlaying(i); refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                  <span className="mn-label site-stage__n" lang="en">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex flex-col gap-2 min-w-0">
                    <span className="h2" dir="auto">{s.name}</span>
                    <span className="body" style={{ color: "var(--ink-muted)" }} dir="auto">{s.lines[0]}<br />{s.lines[1]}</span>
                  </span>
                  <span className="site-stage__play" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z" /></svg>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="site-wrap py-16 md:py-24 border-t" style={{ borderColor: "var(--line)" }}>
        <h2 className="h1 m-0 mb-10">{c.waysTitle}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {c.ways.map((w, i) => (
            <article key={i} className="rounded-lg p-6 flex flex-col gap-3" style={{ border: "1px solid var(--line)", background: "var(--surface)" }}>
              <span className="mn-label" lang="en">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="h2 m-0" dir="auto">{w.name}</h3>
              <p className="body m-0" style={{ color: "var(--ink-muted)" }} dir="auto">{w.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-wrap py-16 md:py-24 border-t" style={{ borderColor: "var(--line)" }}>
        <h2 className="h1 m-0 mb-10">{c.proofTitle}</h2>
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {c.proof.map((x, i) => (
            <div key={i} className="flex gap-4">
              <span style={{ width: 2, background: "var(--line-strong)", borderRadius: 2, flexShrink: 0 }} />
              <div className="flex flex-col gap-1.5">
                <h3 className="h3 m-0" dir="auto">{x.name}</h3>
                <p className="body m-0" style={{ color: "var(--ink-muted)" }} dir="auto">{x.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="site-wrap py-20 md:py-28 border-t text-center flex flex-col items-center gap-5" style={{ borderColor: "var(--line)" }}>
        <h2 className="display m-0" style={{ fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.1, maxWidth: 760 }} dir="auto">{c.closing}</h2>
        <p className="small m-0" style={{ color: "var(--ink-faint)", maxWidth: 520 }}>{c.invite}</p>
        <a href="/login" className="mn-btn mn-btn--primary mt-2">{c.login}</a>
      </section>

      <footer className="site-wrap py-8 flex items-center gap-4 border-t" style={{ borderColor: "var(--line)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/menab-mark-light.png" alt="" style={{ height: 18 }} />
        <span className="small" style={{ color: "var(--ink-faint)" }}>{c.footer}</span>
        <span className="grow" />
        <span className="mn-label" lang="en" style={{ color: "var(--ink-faint)" }}>menab.si</span>
      </footer>
    </div>
  );
}
