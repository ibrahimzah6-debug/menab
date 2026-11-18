"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// The film in the hero: Menab in about 36 seconds, six scenes of six seconds, drawn in code like
// the scenes in the big card, with no frame or background. A bar under it shows the six scenes, jumps to one when pressed,
// and a button pauses it. The problem (paying again
// and again for AI tries), the steps, approving so nothing is made twice, the price first,
// choosing the model, and the close. In each scene the sentence comes first, then the card, then
// the last line. It loops,
// and stays on the first scene for people who turn motion off.

type I = Dictionary["site"]["intro"];
// The first scene is longer: it shows the same problem for AI videos, shoots and hybrid videos.
const SCENE_MS = [12000, 6000, 6000, 6000, 6000, 6000];
const VARIANT_MS = 4000;
const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export function Intro({ c, stages, approved }: { c: I; stages: string[]; approved: string }) {
  const [scene, setScene] = useState(0);
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(true);
  const count = 6;
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => { setScene((s) => (s + 1) % count); setRound((r) => r + 1); }, SCENE_MS[scene]);
    return () => clearTimeout(t);
  }, [playing, scene, round]);
  const go = (i: number) => { setScene(i); setRound((r) => r + 1); };

  return (
    <div className="site-film" role="region" aria-label={c.label}>
      <div className="site-film__stage" key={round}>
        {scene === 0 && <Problem c={c} playing={playing} />}
        {scene === 1 && <Steps c={c} stages={stages} approved={approved} />}
        {scene === 2 && <Approve c={c} />}
        {scene === 3 && <Price c={c} />}
        {scene === 4 && <Models c={c} />}
        {scene === 5 && <Close c={c} />}
      </div>
      <div className="site-film__bar">
        <button type="button" className="site-film__play" aria-label={playing ? c.pause : c.play} aria-pressed={!playing} onClick={() => setPlaying((p) => !p)}>
          {playing
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="0.8" /><rect x="7" y="1.5" width="3" height="9" rx="0.8" /></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" /></svg>}
        </button>
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" className="site-film__seg" aria-label={`${i + 1}`} aria-current={scene === i ? "step" : undefined} onClick={() => go(i)}>
            <i className={i < scene ? "done" : i === scene ? (playing ? "run" : "run paused") : ""} key={i === scene ? round : undefined} style={{ "--run": `${SCENE_MS[i] / 1000}s` } as CSSProperties} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <p className="site-film__title mk-in" style={d(0)} dir="auto">{children}</p>;
}

function Check() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>;
}

function Lock() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><rect x="2.5" y="5.5" width="7" height="5" rx="1" /><path d="M4 5.5V4a2 2 0 014 0v1.5" /></svg>;
}

// 1. Paying again and again: first for AI videos, then shoots, then hybrid videos. Everything
// shows at once; then the word and the bills change together.
function Problem({ c, playing }: { c: I; playing: boolean }) {
  const [v, setV] = useState(0);
  const n = c.problem.variants.length;
  useEffect(() => {
    if (!playing || v >= n - 1) return;
    const t = setTimeout(() => setV((x) => x + 1), VARIANT_MS);
    return () => clearTimeout(t);
  }, [playing, v, n]);
  const x = c.problem.variants[v];
  return (
    <div className="site-film__scene">
      <p className="site-film__title mk-in" style={d(0)} dir="auto">
        {c.problem.before} <span className="site-film__word" key={v}>{x.word}</span>{c.problem.after}
      </p>
      <div className="mk-panel mk-in" style={d(0)}>
        <ul className="mk-list" key={v}>
          {x.rows.map((r, i) => (
            <li key={i} className="mk-in site-film__row" style={d(v ? 0.15 + i * 0.12 : 0)}>
              <span className="mk-text grow" dir="auto">{r.name}</span>
              <span className="mk-text site-film__money" dir="auto">{r.value}</span>
            </li>
          ))}
          <li className="mk-in site-film__row site-film__row--total" style={d(v ? 0.6 : 0)}>
            <span className="mk-text grow" dir="auto">{x.total}</span>
            <span className="mk-big" dir="auto">{x.totalValue}</span>
          </li>
        </ul>
      </div>
      <p className="site-film__note mk-in" style={d(0)} dir="auto">{c.problem.note}</p>
    </div>
  );
}

// 2. One step at a time.
function Steps({ c, stages, approved }: { c: I; stages: string[]; approved: string }) {
  return (
    <div className="site-film__scene">
      <Title>{c.steps.title}</Title>
      <div className="mk-panel mk-in" style={d(0.9)}>
        <ul className="mk-list">
          {stages.map((s, i) => (
            <li key={i} className="mk-in" style={d(1.1 + i * 0.1)}>
              <span className="mk-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="mk-text grow" dir="auto">{s}</span>
              <span className="mk-tag mk-in" style={d(1.8 + i * 0.4)}><Check />{approved}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// 3. Approve, so nothing is made twice.
function Approve({ c }: { c: I }) {
  return (
    <div className="site-film__scene">
      <Title>{c.approve.title}</Title>
      <div className="mk-panel mk-in" style={d(0.9)}>
        <span className="mk-label">{c.approve.doc}</span>
        <div className="mk-doc"><i style={{ width: "90%" }} /><i style={{ width: "75%" }} /><i style={{ width: "82%" }} /><i style={{ width: "60%" }} /></div>
        <div className="flex items-center gap-3">
          <span className="site-film__btn mk-press" style={d(2)}>{c.approve.button}</span>
          <span className="mk-status grow">
            <span className="mk-in mk-done" style={d(2.5)}><Lock />{c.approve.locked}</span>
          </span>
        </div>
      </div>
      <div className="mk-panel mk-in" style={d(3.4)}>
        <div className="flex items-center gap-3">
          <span className="mk-label grow">{c.approve.next}</span>
          <span className="mk-small">{c.approve.nextNote}</span>
        </div>
        <div className="mk-frames">
          {[0, 1, 2, 3].map((n) => <div key={n} className="mk-frame-pic mk-in" style={{ ...d(3.8 + n * 0.2), background: "var(--mk-sky)" }} />)}
        </div>
      </div>
    </div>
  );
}

// 4. The price before every action.
function Price({ c }: { c: I }) {
  return (
    <div className="site-film__scene">
      <Title>{c.price.title}</Title>
      <div className="mk-panel mk-in" style={d(0.9)}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="site-film__btn mk-press" style={d(1.9)}>{c.price.action}</span>
          <span className="mk-tag">{c.price.cost}</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="mk-text grow" dir="auto">{c.price.balance}</span>
          <span className="mk-status" style={{ width: 80, height: 26 }}>
            <span className="mk-out mk-big" style={d(2.4)}>{c.price.before}</span>
            <span className="mk-in mk-big" style={d(2.4)}>{c.price.after}</span>
          </span>
        </div>
      </div>
      <p className="site-film__note mk-in" style={d(3.6)} dir="auto"><Check /> {c.price.free}</p>
    </div>
  );
}

// 5. Choose the model for each job.
function Models({ c }: { c: I }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="site-film__scene">
      <Title>{c.models.title}</Title>
      <div className="mk-panel mk-in" style={d(0.9)}>
        <ul className="mk-list">
          {c.models.rows.map((r, i) => {
            const k = (tick + i) % r.options.length;
            return (
              <li key={i} className="mk-in site-film__row" style={d(1.2 + i * 0.3)}>
                <span className="mk-text grow" dir="auto">{r.name}</span>
                <span className="site-film__select" key={k}>
                  <span className="mk-in" style={d(0)}>{r.options[k]}</span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3" /></svg>
                </span>
                {r.prices && <span className="mk-tag site-film__price" key={`p${k}`}><span className="mk-in" style={d(0)}>{r.prices[k]}</span></span>}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="site-film__note mk-in" style={d(3.6)} dir="auto">{c.models.note}</p>
    </div>
  );
}

// 6. The close: words only.
function Close({ c }: { c: I }) {
  return (
    <div className="site-film__scene site-film__scene--close">
      <p className="site-film__title site-film__title--close mk-in" style={d(0.2)} dir="auto">{c.close.title}</p>
      <p className="site-film__note mk-in" style={d(1)} dir="auto">{c.close.text}</p>
    </div>
  );
}
