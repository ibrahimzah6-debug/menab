"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// The scenes inside the big card: small animated copies of Menab's own screens, one per way to
// make a video (AI, shoot, hybrid). Plain HTML and CSS, so they stay sharp, cost nothing to load
// and mirror in Arabic. Each scene plays once in about four seconds; the card remounts it on
// every step so it plays again.

type M = Dictionary["site"]["ways"]["mock"];
const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export function Mockup({ way, m }: { way: number; m: M }) {
  return (
    <div className="mk" aria-hidden="true">
      {way === 0 && <AiScene m={m} />}
      {way === 1 && <ShootScene m={m} />}
      {way === 2 && <HybridScene m={m} />}
    </div>
  );
}

function Panel({ label, children, style, className = "" }: { label: string; children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={`mk-panel mk-in ${className}`} style={style}>
      <span className="mk-label">{label}</span>
      {children}
    </div>
  );
}

function Check() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>;
}

function Status({ wait, done, at }: { wait: string; done: string; at: number }) {
  return (
    <span className="mk-status">
      <span className="mk-out" style={d(at)}><span className="mk-spin" />{wait}</span>
      <span className="mk-in mk-done" style={d(at)}><Check />{done}</span>
    </span>
  );
}

// Four tiny storyboard pictures, drawn in gray.
function Frame({ n }: { n: number }) {
  const sky = "var(--mk-sky)";
  const ink = "var(--mk-ink)";
  return (
    <svg viewBox="0 0 80 45" preserveAspectRatio="xMidYMid slice" className="mk-frame-art">
      <rect width="80" height="45" fill={sky} />
      {n === 0 && (
        <g fill={ink}>
          <circle cx="58" cy="24" r="7" opacity=".5" />
          <rect x="6" y="22" width="7" height="23" /><rect x="15" y="14" width="6" height="31" /><rect x="23" y="26" width="9" height="19" />
          <rect x="34" y="18" width="5" height="27" /><rect x="41" y="28" width="10" height="17" /><rect x="66" y="25" width="8" height="20" />
        </g>
      )}
      {n === 1 && (
        <g fill={ink}>
          <rect x="34" y="10" width="12" height="27" rx="2" />
          <rect x="37" y="6" width="6" height="5" rx="1" />
          <path d="M8 45c6-10 14-12 24-11v11z M72 45c-6-10-14-12-24-11v11z" opacity=".6" />
        </g>
      )}
      {n === 2 && (
        <g fill={ink}>
          <rect x="6" y="32" width="68" height="3" />
          <circle cx="22" cy="19" r="5" /><path d="M14 32c0-6 4-8 8-8s8 2 8 8z" />
          <circle cx="40" cy="21" r="4" opacity=".7" /><path d="M33 32c0-5 3-7 7-7s7 2 7 7z" opacity=".7" />
          <circle cx="58" cy="19" r="5" /><path d="M50 32c0-6 4-8 8-8s8 2 8 8z" />
        </g>
      )}
      {n === 3 && (
        <g fill="none" stroke={ink} strokeWidth="1.4">
          <path d="M0 45L36 18M80 45L44 18M40 45v-4M40 36v-4M40 28v-3M40 22v-2" />
          <path d="M0 18h80" opacity=".5" />
        </g>
      )}
    </svg>
  );
}

function AiScene({ m }: { m: M }) {
  return (
    <div className="mk-scene">
      <div className="mk-row">
        <Panel label={m.brief} style={{ ...d(0.1), flex: 1.6 }}>
          <p className="mk-text">{m.briefText}</p>
        </Panel>
        <Panel label={m.cost} style={{ ...d(0.6), flex: 1 }}>
          <p className="mk-big">{m.costValue}</p>
        </Panel>
      </div>
      <Panel label={m.storyboard} style={d(1)}>
        <div className="mk-frames">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="mk-frame mk-in" style={d(1.3 + n * 0.25)}>
              <div className="mk-frame-pic">
                <Frame n={n} />
                <span className="mk-play mk-in" style={d(3 + n * 0.2)}><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2.5 1.5v7l6-3.5z" /></svg></span>
              </div>
              <span className="mk-small">{m.shot} {n + 1}</span>
              <span className="mk-bar"><i style={d(1.7 + n * 0.25)} /></span>
              <Status wait={m.making} done={m.approved} at={3 + n * 0.2} />
            </div>
          ))}
        </div>
      </Panel>
      <div className="mk-row">
        {[m.voice, m.music].map((label, k) => (
          <Panel key={k} label={label} style={{ ...d(3.4 + k * 0.3), flex: 1 }}>
            <div className="mk-wave">
              {Array.from({ length: 28 }, (_, i) => (
                <i key={i} style={{ ...d(3.6 + k * 0.3 + i * 0.03), height: `${20 + Math.round(70 * Math.abs(Math.sin(i * (k ? 0.9 : 0.55) + k)))}%` }} />
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function ShootScene({ m }: { m: M }) {
  return (
    <div className="mk-scene">
      <div className="mk-row">
        <Panel label={m.callSheet} style={{ ...d(0.1), flex: 1.5 }}>
          <dl className="mk-dl">
            <dt>{m.crewCall}</dt><dd>{m.crewCallValue}</dd>
            <dt>{m.location}</dt><dd>{m.locationValue}</dd>
          </dl>
          <span className="mk-label mt-2">{m.crew}</span>
          <ul className="mk-list">
            {m.roles.map((r, i) => (
              <li key={i} className="mk-in" style={d(0.8 + i * 0.3)}>
                <span className="mk-avatar" />
                <span className="mk-text grow">{r}</span>
                <span className="mk-tag mk-in" style={d(1.6 + i * 0.35)}><Check />{m.registered}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="flex flex-col gap-3" style={{ flex: 1 }}>
          <Panel label={m.permit} style={d(0.5)}>
            <div className="mk-doc">
              <i style={{ width: "80%" }} /><i style={{ width: "60%" }} /><i style={{ width: "70%" }} />
            </div>
            <Status wait={m.waiting} done={m.approved} at={3.2} />
          </Panel>
          <Panel label={m.schedule} style={d(0.9)}>
            <div className="mk-gantt">
              {[[0, 45], [30, 40], [55, 35], [20, 60]].map(([s, w], i) => (
                <span key={i}><i className="mk-grow" style={{ ...d(1.4 + i * 0.25), marginInlineStart: `${s}%`, width: `${w}%` }} /></span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function HybridScene({ m }: { m: M }) {
  const pick = [0, 1, 1, 0];
  return (
    <div className="mk-scene">
      <Panel label={m.shotList} style={d(0.1)}>
        <ul className="mk-list mk-list--shots">
          {m.shots.map((s, i) => (
            <li key={i} className="mk-in" style={d(0.4 + i * 0.25)}>
              <span className="mk-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="mk-thumb"><Frame n={[0, 1, 2, 3][i]} /></span>
              <span className="mk-text grow">{s}</span>
              <span className="mk-switch">
                {[m.ai, m.shoot].map((x, j) => (
                  <span key={j} className={pick[i] === j ? "mk-pick" : ""} style={pick[i] === j ? d(1.8 + i * 0.4) : undefined}>{x}</span>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mk-total mk-in" style={d(3.6)}><Check />{m.total}</p>
      </Panel>
    </div>
  );
}
