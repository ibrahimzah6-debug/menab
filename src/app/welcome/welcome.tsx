"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LanguageMenu } from "@/components/menus";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Intro } from "./intro";
import { Mockup } from "./mockups";

// The public website. The page follows expo.dev's structure (small headline, two buttons, a tile,
// a big rounded card whose steps cycle beside an animated scene, a grid of cards, a full footer
// with a theme switch) in Menab's colours: a black page in dark, with the cards in our surface
// colour. English and Arabic, mirrored. The language menu lives in the top bar only.

type C = Dictionary["site"];
type Theme = "dark" | "light" | "auto";
const STEP_MS = 6000;
const SOON = (topic: string) => `/soon?topic=${encodeURIComponent(topic)}`;

export function Welcome({ c, uiLocale, langLabel, preparing }: { c: C; uiLocale: string; langLabel: string; preparing: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");
  useEffect(() => {
    let saved: Theme = "dark";
    try {
      const v = localStorage.getItem("menab-site-theme");
      if (v === "light" || v === "dark" || v === "auto") saved = v;
    } catch {
      // No storage: dark.
    }
    setTheme(saved);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setResolved(theme === "auto" ? (mq.matches ? "dark" : "light") : theme);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  const pickTheme = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem("menab-site-theme", t);
    } catch {
      // No storage.
    }
  };

  return (
    <div data-theme={resolved} className="site" style={{ background: "var(--ground)", color: "var(--ink)", minHeight: "100vh" }}>
      <Nav c={c} uiLocale={uiLocale} langLabel={langLabel} preparing={preparing} />

      {/* Hero: fills the first screen. The words on one side, the logo tile with its burst on the
          other. On a phone everything is centred and the tile comes first. */}
      <section className="site-wrap site-hero">
        <div className="site-hero__copy">
          <h1 className="site-h1" dir="auto">{c.hero.title}</h1>
          <div className="site-hero__buttons">
            <a href="/login?next=/start" className="site-btn site-btn--primary">{c.hero.start} <Arrow /></a>
            <a href={SOON("talk")} className="site-btn site-btn--soft">{c.hero.talk}</a>
          </div>
          <a href="#stage-5" onClick={() => openStage(4)} className="site-pill">
            <span className="site-pill__tag">{c.hero.newTag}</span>
            <span dir="auto">{c.hero.newText}</span>
            <Arrow size={12} />
          </a>
          <p className="site-hero__text" dir="auto">{c.hero.text}</p>
        </div>
        <div className="site-hero__art">
          <Intro c={c.intro} stages={c.how.stages.map((s) => s.name)} approved={c.ways.mock.approved} burst={<Burst />} />
        </div>
      </section>

      <p className="site-wrap site-trusted" dir="auto">{c.hero.trusted}</p>

      {/* The big card: the three ways to make a video, each with its scene. */}
      <section className="site-wrap">
        <Ways c={c.ways} />
      </section>

      {/* How it works: the seven stages. The Product menu opens a stage here. */}
      <How c={c.how} />

      {/* What you get: one card per kind of team. */}
      <section id="who" className="site-wrap site-section">
        <h2 className="site-h2 site-h2--section" dir="auto">{c.who.title}</h2>
        <div className="site-grid site-grid--2">
          {c.who.cards.map((x, i) => (
            <article key={i} id={`who-${i + 1}`} className="site-card site-card--big">
              <span className="site-num" lang="en">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="site-h2" dir="auto">{x.name}</h3>
              <p className="site-text" dir="auto">{x.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Why Menab. */}
      <section className="site-wrap site-section">
        <h2 className="site-h2 site-h2--section" dir="auto">{c.proof.title}</h2>
        <div className="site-grid site-grid--4">
          {c.proof.items.map((x, i) => (
            <article key={i} className="site-card site-card--small">
              <h3 className="site-h3" dir="auto">{x.name}</h3>
              <p className="site-text" dir="auto">{x.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing. */}
      <section id="pricing" className="site-wrap site-section">
        <div className="site-card site-card--big site-pricing">
          <div className="flex flex-col gap-4 grow">
            <h2 className="site-h2" dir="auto">{c.pricing.title}</h2>
            <p className="site-text" style={{ maxWidth: 560 }} dir="auto">{c.pricing.text}</p>
          </div>
          <a href={SOON("pricing")} className="site-btn site-btn--line self-start">{c.pricing.cta}</a>
        </div>
      </section>

      {/* Closing. */}
      <section className="site-wrap site-closing">
        <h2 className="site-h1 site-h1--closing" dir="auto">{c.closing.title}</h2>
        <div className="site-hero__buttons justify-center">
          <a href="/login?next=/start" className="site-btn site-btn--accent">{c.closing.start} <Arrow /></a>
          <a href={SOON("talk")} className="site-btn site-btn--soft">{c.closing.talk}</a>
        </div>
      </section>

      <Footer c={c} theme={theme} onTheme={pickTheme} />
    </div>
  );
}

function Arrow({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:-scale-x-100"><path d="M2.5 7h9M7.5 3l4 4-4 4" /></svg>;
}

// The burst of fine lines and dots behind the logo tile. Fixed numbers (no randomness at load),
// so the picture is the same on every visit and on the server.
const BURST = (() => {
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const lines: { x1: number; y1: number; x2: number; y2: number; o: number }[] = [];
  const dots: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < 300; i++) {
    const a = rnd() * Math.PI * 2;
    const r1 = 112 + rnd() * 50;
    const r2 = r1 + 30 + rnd() * rnd() * 150;
    const cos = Math.cos(a), sin = Math.sin(a);
    lines.push({ x1: 328 + cos * r1, y1: 328 + sin * r1, x2: 328 + cos * r2, y2: 328 + sin * r2, o: 0.12 + rnd() * 0.3 });
    if (rnd() < 0.8) { const rd = r1 + rnd() * (r2 - r1 + 20); dots.push({ x: 328 + cos * rd, y: 328 + sin * rd, r: 0.8 + rnd() * 1.3, o: 0.35 + rnd() * 0.5 }); }
  }
  const f = (n: number) => Math.round(n * 10) / 10;
  return { lines: lines.map((l) => ({ x1: f(l.x1), y1: f(l.y1), x2: f(l.x2), y2: f(l.y2), o: f(l.o * 100) / 100 })), dots: dots.map((d) => ({ x: f(d.x), y: f(d.y), r: f(d.r), o: f(d.o * 100) / 100 })) };
})();

function Burst() {
  return (
    <svg className="site-burst" viewBox="0 0 656 656" fill="none">
      {BURST.lines.map((l, i) => <line key={i} {...l} stroke="currentColor" strokeWidth="0.5" opacity={l.o} />)}
      {BURST.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" opacity={d.o} />)}
    </svg>
  );
}

// ---------- Top bar ----------

function Nav({ c, uiLocale, langLabel, preparing }: { c: C; uiLocale: string; langLabel: string; preparing: string }) {
  const [open, setOpen] = useState<"product" | "solutions" | null>(null);
  const [mobile, setMobile] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const Menu = ({ id, label, items, hrefOf }: { id: "product" | "solutions"; label: string; items: { name: string; note: string }[]; hrefOf: (i: number) => string }) => (
    <div className="relative" onMouseEnter={() => setOpen(id)} onMouseLeave={() => setOpen((v) => (v === id ? null : v))}>
      <button type="button" className="site-nav__link" aria-haspopup="menu" aria-expanded={open === id} onClick={() => setOpen((v) => (v === id ? null : id))}>
        {label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3" /></svg>
      </button>
      {open === id && (
        <div className="site-menu" role="menu">
          {items.map((x, i) => (
            <a key={i} href={hrefOf(i)} role="menuitem" onClick={() => { setOpen(null); if (id === "product") openStage(i); }}>
              <span dir="auto">{x.name}</span>
              <small dir="auto">{x.note}</small>
            </a>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <header className="site-wrap site-nav" ref={box}>
      <Link href="/" className="flex items-center me-3" aria-label="Menab">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/menab-logo-light.png" alt="Menab" style={{ height: 24 }} className="site-logo" />
      </Link>
      <nav className="hidden md:flex items-center gap-1" aria-label="Site">
        <Menu id="product" label={c.nav.product} items={c.nav.productItems} hrefOf={(i) => `#stage-${i + 1}`} />
        <Menu id="solutions" label={c.nav.solutions} items={c.nav.solutionItems} hrefOf={(i) => `#who-${i + 1}`} />
        <a href={SOON("templates")} className="site-nav__link">{c.nav.templates}</a>
        <a href="#pricing" className="site-nav__link">{c.nav.pricing}</a>
        <a href={SOON("enterprise")} className="site-nav__link">{c.nav.enterprise}</a>
        <a href={SOON("blog")} className="site-nav__link">{c.nav.blog}</a>
      </nav>
      <span className="grow" />
      <LanguageMenu locale={uiLocale} label={langLabel} soon={preparing} compact placement="down" />
      <a href="/login" className="site-btn site-btn--line site-btn--sm ms-2 site-desk">{c.nav.login}</a>
      <a href="/login" className="site-btn site-btn--primary site-btn--sm ms-2 site-desk">{c.nav.signup}</a>
      <button type="button" className="site-burger site-phone ms-2" aria-label={c.nav.menu} aria-expanded={mobile} onClick={() => setMobile((v) => !v)}>
        {mobile
          ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M3 6h10M3 10h10" /></svg>}
      </button>
      {mobile && (
        <div className="site-mobile site-phone">
          <span className="site-num">{c.nav.product}</span>
          {c.nav.productItems.map((x, i) => <a key={i} href={`#stage-${i + 1}`} onClick={() => { setMobile(false); openStage(i); }} dir="auto">{x.name}</a>)}
          <span className="site-num">{c.nav.solutions}</span>
          {c.nav.solutionItems.map((x, i) => <a key={i} href={`#who-${i + 1}`} onClick={() => setMobile(false)} dir="auto">{x.name}</a>)}
          <span className="site-num" />
          <a href={SOON("templates")}>{c.nav.templates}</a>
          <a href="#pricing" onClick={() => setMobile(false)}>{c.nav.pricing}</a>
          <a href={SOON("enterprise")}>{c.nav.enterprise}</a>
          <a href={SOON("blog")}>{c.nav.blog}</a>
          <div className="flex flex-col gap-2 mt-4">
            <a href="/login" className="site-btn site-btn--primary justify-center">{c.nav.signup}</a>
            <a href="/login" className="site-btn site-btn--line justify-center">{c.nav.login}</a>
          </div>
        </div>
      )}
    </header>
  );
}

// ---------- The big card ----------

function Ways({ c }: { c: C["ways"] }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => { setStep((s) => (s + 1) % c.steps.length); setRound((r) => r + 1); }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step, round, c.steps.length]);
  const go = (i: number) => { setStep(i); setRound((r) => r + 1); };
  return (
    <div className="site-card site-ways">
      <div className="flex flex-col gap-10">
        <h2 className="site-h2" dir="auto">{c.title}</h2>
        <ol className="m-0 p-0 list-none flex flex-col">
          {c.steps.map((s, i) => (
            <li key={i} className={`site-step ${step === i ? "site-step--on" : ""}`}>
              <button type="button" className="site-step" onClick={() => go(i)} aria-current={step === i ? "step" : undefined}>
                <span className="site-step__title">
                  <span dir="auto">{s.name}</span>
                  {step === i && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={playing ? c.pause : c.play}
                      aria-pressed={!playing}
                      className={`site-ring ${playing ? "site-ring--running" : "site-ring--running site-ring--paused"}`}
                      onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setPlaying((p) => !p); } }}
                    >
                      <svg key={round} viewBox="0 0 34 34" fill="none" strokeWidth="1.5"><circle className="track" cx="17" cy="17" r="15" /><circle className="bar" cx="17" cy="17" r="15" pathLength={100} transform="rotate(-90 17 17)" strokeLinecap="round" /></svg>
                      {playing ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" style={{ position: "relative" }}><rect x="2" y="1.5" width="3" height="9" rx="0.8" /><rect x="7" y="1.5" width="3" height="9" rx="0.8" /></svg> : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" style={{ position: "relative" }}><path d="M3 1.5v9l7.5-4.5z" /></svg>}
                    </span>
                  )}
                </span>
                <span className="site-step__text" dir="auto">{s.text}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="site-art" key={round}>
        <Mockup way={step} m={c.mock} />
      </div>
    </div>
  );
}

// ---------- How it works ----------

// The Product menu and the footer open a stage with this event; a link to #stage-N does too.
function openStage(i: number) {
  window.dispatchEvent(new CustomEvent("site-stage", { detail: i }));
}

function How({ c }: { c: C["how"] }) {
  const [on, setOn] = useState(0);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const show = (i: number, scroll: boolean) => {
      if (i < 0 || i >= c.stages.length) return;
      setOn(i);
      if (scroll) box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const fromHash = (scroll: boolean) => {
      const m = /^#stage-(\d+)$/.exec(window.location.hash);
      if (m) show(Number(m[1]) - 1, scroll);
    };
    fromHash(true);
    const onHash = () => fromHash(true);
    const onEvent = (e: Event) => show((e as CustomEvent<number>).detail, true);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("site-stage", onEvent);
    return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("site-stage", onEvent); };
  }, [c.stages.length]);
  const s = c.stages[on];
  return (
    <section id="how" ref={box} className="site-wrap site-section" style={{ scrollMarginTop: 24 }}>
      <div className="site-section__head">
        <h2 className="site-h2 site-h2--section" dir="auto">{c.title}</h2>
        <p className="site-text" dir="auto">{c.text}</p>
      </div>
      <div className="site-card site-how">
        <ol className="m-0 p-0 list-none flex flex-col gap-1" role="tablist" aria-label={c.title}>
          {c.stages.map((x, i) => (
            <li key={i}>
              <button type="button" role="tab" aria-selected={on === i} className="site-stage" onClick={() => setOn(i)}>
                <span className="mn-label" lang="en">{String(i + 1).padStart(2, "0")}</span>
                <span dir="auto">{x.name}</span>
              </button>
            </li>
          ))}
        </ol>
        <div key={on} role="tabpanel" className="site-stage-panel">
          <span className="site-num" lang="en">{String(on + 1).padStart(2, "0")} / {String(c.stages.length).padStart(2, "0")}</span>
          <h3 className="site-h2" dir="auto">{s.name}</h3>
          <div className="flex flex-col gap-2 max-w-[520px]">
            {s.lines.map((l, i) => <p key={i} className="site-text" style={i ? undefined : { color: "var(--ink)" }} dir="auto">{l}</p>)}
          </div>
          <div className="flex flex-col gap-3 mt-auto">
            <span className="site-num">{c.makes}</span>
            <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
              {s.outputs.map((o, i) => <li key={i} className="site-chip" dir="auto">{o}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Footer ----------

function Footer({ c, theme, onTheme }: { c: C; theme: Theme; onTheme: (t: Theme) => void }) {
  const col = (title: string, items: { name: string; href: string; stage?: number }[]) => (
    <div className="flex flex-col gap-3">
      <span className="site-foot-h" dir="auto">{title}</span>
      {items.map((x, i) => <a key={i} href={x.href} onClick={x.stage === undefined ? undefined : () => openStage(x.stage!)} className="site-foot-a" dir="auto">{x.name}</a>)}
    </div>
  );
  return (
    <footer className="site-wrap pb-10 border-t pt-12" style={{ borderColor: "var(--line)" }}>
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/menab-logo-light.png" alt="Menab" style={{ height: 22, width: "fit-content" }} className="site-logo" />
        </div>
        {col(c.footer.product, c.nav.productItems.map((x, i) => ({ name: x.name, href: `#stage-${i + 1}`, stage: i })))}
        {col(c.footer.solutions, c.nav.solutionItems.map((x, i) => ({ name: x.name, href: `#who-${i + 1}` })))}
        {col(c.footer.company, c.footer.companyItems.map((name, i) => ({ name, href: i === 1 ? "#pricing" : SOON(["about", "pricing", "talk", "blog"][i]) })))}
        {col(c.footer.legal, c.footer.legalItems.map((name, i) => ({ name, href: SOON(["terms", "privacy"][i]) })))}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-12 pt-6 border-t" style={{ borderColor: "var(--line)" }}>
        <span className="small" style={{ color: "var(--ink-faint)" }}>© 2026 {c.footer.copyright}</span>
        <span className="grow" />
        <div className="site-seg" role="group" aria-label={c.footer.theme.label}>
          {(["light", "dark", "auto"] as Theme[]).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} onClick={() => onTheme(t)}>{c.footer.theme[t]}</button>
          ))}
        </div>
        <span className="mn-label" lang="en" style={{ color: "var(--ink-faint)" }}>menab.si</span>
      </div>
    </footer>
  );
}
