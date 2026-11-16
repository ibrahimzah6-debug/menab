"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LanguageMenu } from "@/components/menus";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Isometric } from "./isometric";

// The public website. The page follows expo.dev's structure (small headline, two buttons, a tile,
// a big rounded card with four steps that cycle every five seconds beside a line drawing, a grid
// of cards, a full footer with a theme switch) in Menab's colours: dark by default, with the
// cards in our surface colour. English and Arabic, mirrored.

type C = Dictionary["site"];
type Theme = "dark" | "light" | "auto";
const STEP_SCENES = [2, 3, 5, 7];
const STEP_MS = 5000;
const SOON = (topic: string) => `/soon?topic=${encodeURIComponent(topic)}`;

export function Welcome({ c, locale, uiLocale, langLabel, preparing }: { c: C; locale: "en" | "ar"; uiLocale: string; langLabel: string; preparing: string }) {
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
  const bodyClass = locale === "ar" ? "body-ar" : "body";

  return (
    <div data-theme={resolved} className="site" style={{ background: "var(--ground)", color: "var(--ink)", minHeight: "100vh" }}>
      <Nav c={c} uiLocale={uiLocale} langLabel={langLabel} preparing={preparing} />

      {/* Hero: small headline, two buttons, the tile, a short paragraph. */}
      <section className="site-wrap grid gap-10 items-center py-16 md:py-28 md:grid-cols-[1.1fr_auto_1fr]">
        <div className="flex flex-col gap-6">
          <h1 className="m-0" style={{ fontSize: "clamp(32px, 3.4vw, 44px)", lineHeight: 1.12, fontWeight: 600, letterSpacing: "-0.01em", maxWidth: 440 }} dir="auto">{c.hero.title}</h1>
          <div className="flex flex-wrap gap-2">
            <a href="/login?next=/start" className="site-btn site-btn--primary">{c.hero.start} <Arrow /></a>
            <a href={SOON("talk")} className="site-btn site-btn--soft">{c.hero.talk}</a>
          </div>
        </div>
        <div className="site-tile justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolved === "dark" ? "/brand/menab-mark-light.png" : "/brand/menab-mark-ink.png"} alt="" style={{ width: 84 }} />
        </div>
        <div className="flex flex-col gap-4 md:justify-self-end" style={{ maxWidth: 360 }}>
          <a href="#stage-5" className="inline-flex items-center gap-2 self-start rounded-full border px-1 py-1 pe-3 text-[13px]" style={{ borderColor: "var(--line)" }}>
            <span className="rounded-full px-2 py-0.5 text-[12px]" style={{ background: "var(--tint-2)" }}>{c.hero.newTag}</span>
            <span style={{ color: "var(--ink-muted)" }}>{c.hero.newText}</span>
            <Arrow />
          </a>
          <p className={`${bodyClass} m-0`} style={{ color: "var(--ink-muted)" }} dir="auto">{c.hero.text}</p>
        </div>
      </section>

      <p className="site-wrap mn-label text-center m-0 pb-14" style={{ color: "var(--ink-faint)", letterSpacing: "0.08em" }} dir="auto">{c.hero.trusted}</p>

      {/* The big card: four steps that cycle, with the drawing. */}
      <section className="site-wrap">
        <Blocks c={c.blocks} />
      </section>

      {/* How it works: the seven stages. */}
      <section id="how" className="site-wrap pt-24 md:pt-32">
        <div className="flex flex-col gap-3 mb-10 max-w-[640px]">
          <h2 className="site-h2" dir="auto">{c.how.title}</h2>
          <p className={`${bodyClass} m-0`} style={{ color: "var(--ink-muted)" }} dir="auto">{c.how.text}</p>
        </div>
        <ol className="m-0 p-0 list-none grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {c.how.stages.map((s, i) => (
            <li key={i} id={`stage-${i + 1}`} className="site-card p-6 flex flex-col gap-3" style={{ borderRadius: 20 }}>
              <span className="mn-label" lang="en" style={{ color: "var(--ink-faint)" }}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="h3 m-0" dir="auto">{s.name}</h3>
              <p className="small m-0" style={{ color: "var(--ink-muted)", lineHeight: "22px" }} dir="auto">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* What you get: the grid of cards. */}
      <section id="who" className="site-wrap pt-24 md:pt-32">
        <h2 className="site-h2 mb-10" dir="auto">{c.who.title}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {c.who.cards.map((x, i) => (
            <article key={i} id={`who-${i + 1}`} className="site-card p-8 flex flex-col gap-3 min-h-[200px]">
              <span className="mn-label" lang="en" style={{ color: "var(--ink-faint)" }}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="m-0" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2 }} dir="auto">{x.name}</h3>
              <p className={`${bodyClass} m-0`} style={{ color: "var(--ink-muted)" }} dir="auto">{x.text}</p>
            </article>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3 mt-4">
          {c.who.small.map((x, i) => (
            <article key={i} className="site-card p-6 flex flex-col gap-2">
              <h3 className="h3 m-0" dir="auto">{x.name}</h3>
              <p className="small m-0" style={{ color: "var(--ink-muted)", lineHeight: "22px" }} dir="auto">{x.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing. */}
      <section id="pricing" className="site-wrap pt-24 md:pt-32">
        <div className="site-card p-10 md:p-14 flex flex-col md:flex-row md:items-center gap-8">
          <div className="flex flex-col gap-3 grow">
            <h2 className="site-h2" dir="auto">{c.pricing.title}</h2>
            <p className={`${bodyClass} m-0`} style={{ color: "var(--ink-muted)", maxWidth: 560 }} dir="auto">{c.pricing.text}</p>
          </div>
          <a href={SOON("pricing")} className="site-btn site-btn--line self-start">{c.pricing.cta}</a>
        </div>
      </section>

      {/* Closing. */}
      <section className="site-wrap py-28 md:py-36 text-center flex flex-col items-center gap-6">
        <h2 className="m-0" style={{ fontSize: "clamp(28px, 3.2vw, 40px)", lineHeight: 1.15, fontWeight: 600, maxWidth: 720 }} dir="auto">{c.closing.title}</h2>
        <div className="flex flex-wrap gap-2 justify-center">
          <a href="/login?next=/start" className="site-btn site-btn--accent">{c.closing.start} <Arrow /></a>
          <a href={SOON("talk")} className="site-btn site-btn--soft">{c.closing.talk}</a>
        </div>
      </section>

      <Footer c={c} theme={theme} onTheme={pickTheme} uiLocale={uiLocale} langLabel={langLabel} preparing={preparing} />
    </div>
  );
}

function Arrow() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rtl:-scale-x-100"><path d="M2.5 7h9M7.5 3l4 4-4 4" /></svg>;
}

// ---------- Top bar ----------

function Nav({ c, uiLocale, langLabel, preparing }: { c: C; uiLocale: string; langLabel: string; preparing: string }) {
  const [open, setOpen] = useState<"product" | "solutions" | null>(null);
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
            <a key={i} href={hrefOf(i)} role="menuitem" onClick={() => setOpen(null)}>
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
      <a href="/login" className="site-btn site-btn--line site-btn--sm ms-2">{c.nav.login}</a>
      <a href="/login" className="site-btn site-btn--primary site-btn--sm ms-2">{c.nav.signup}</a>
    </header>
  );
}

// ---------- The big card ----------

function Blocks({ c }: { c: C["blocks"] }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [round, setRound] = useState(0);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) setPlaying(false);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => { setStep((s) => (s + 1) % c.steps.length); setRound((r) => r + 1); }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step, round, c.steps.length]);
  const go = (i: number) => { setStep(i); setRound((r) => r + 1); };
  return (
    <div className="site-card p-8 md:p-12 grid gap-10 md:grid-cols-[1fr_1.1fr] items-center" style={{ borderRadius: 32 }}>
      <div className="flex flex-col gap-8">
        <h2 className="site-h2" dir="auto">{c.title}</h2>
        <ol className="m-0 p-0 list-none flex flex-col">
          {c.steps.map((s, i) => (
            <li key={i} className={`site-step ${step === i ? "site-step--on" : ""}`}>
              <button type="button" className="site-step" onClick={() => go(i)} aria-current={step === i ? "step" : undefined}>
                <span className="site-step__title">
                  <span dir="auto">{i + 1}. {s.name}</span>
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
      <div className="site-art" style={{ aspectRatio: "13 / 10" }}>
        <Isometric scene={STEP_SCENES[step]} />
      </div>
    </div>
  );
}

// ---------- Footer ----------

function Footer({ c, theme, onTheme, uiLocale, langLabel, preparing }: { c: C; theme: Theme; onTheme: (t: Theme) => void; uiLocale: string; langLabel: string; preparing: string }) {
  const col = (title: string, items: { name: string; href: string }[]) => (
    <div className="flex flex-col gap-2">
      <span className="mn-label mb-1" style={{ color: "var(--ink-faint)" }}>{title}</span>
      {items.map((x, i) => <a key={i} href={x.href} className="small" style={{ color: "var(--ink-muted)", textDecoration: "none" }} dir="auto">{x.name}</a>)}
    </div>
  );
  return (
    <footer className="site-wrap pb-10 border-t pt-12" style={{ borderColor: "var(--line)" }}>
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/menab-logo-light.png" alt="Menab" style={{ height: 22, width: "fit-content" }} className="site-logo" />
          <div className="site-seg self-start" role="group" aria-label={c.footer.theme.label}>
            {(["light", "dark", "auto"] as Theme[]).map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => onTheme(t)}>{c.footer.theme[t]}</button>
            ))}
          </div>
          <LanguageMenu locale={uiLocale} label={langLabel} soon={preparing} compact={false} placement="up" />
        </div>
        {col(c.footer.product, c.nav.productItems.map((x, i) => ({ name: x.name, href: `#stage-${i + 1}` })))}
        {col(c.footer.solutions, c.nav.solutionItems.map((x, i) => ({ name: x.name, href: `#who-${i + 1}` })))}
        {col(c.footer.company, c.footer.companyItems.map((name, i) => ({ name, href: i === 1 ? "#pricing" : SOON(["about", "pricing", "talk", "blog"][i]) })))}
        {col(c.footer.legal, c.footer.legalItems.map((name, i) => ({ name, href: SOON(["terms", "privacy"][i]) })))}
      </div>
      <div className="flex items-center gap-4 mt-12 pt-6 border-t" style={{ borderColor: "var(--line)" }}>
        <span className="small" style={{ color: "var(--ink-faint)" }}>© 2026 {c.footer.copyright}</span>
        <span className="grow" />
        <span className="mn-label" lang="en" style={{ color: "var(--ink-faint)" }}>menab.si</span>
      </div>
    </footer>
  );
}
