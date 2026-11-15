"use client";

import { useEffect, useRef, useState } from "react";
import { findTerm, TERMS, type TermKind } from "@/lib/film-terms";

// A choice from the standard film words, each with a small drawing, or "Other" to type.
// Read only, it shows the drawing and the word.

const FOV: Record<string, number> = { "14mm": 104, "24mm": 84, "35mm": 63, "50mm": 47, "85mm": 28, "100mm macro": 24, "135mm": 18 };

function Svg({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} className="shrink-0 text-ink-muted">
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

// A person in a frame, drawn bigger as the shot gets closer.
function Person({ scale, x = 11 }: { scale: number; x?: number }) {
  const head = 1.6 * scale;
  const y = 15 - 6.2 * scale;
  return (
    <>
      <circle cx={x} cy={y} r={head} />
      <path d={`M${x - 2.8 * scale} ${15} Q${x} ${y + head + 0.6 * scale} ${x + 2.8 * scale} ${15}`} />
    </>
  );
}

export function TermIcon({ kind, id }: { kind: TermKind; id: string }) {
  const frame = <rect x="1" y="1" width="20" height="14" rx="1.5" />;
  if (kind === "size") {
    const scale: Record<string, number> = { "Extreme wide": 0.45, Wide: 0.7, Full: 1, "Medium wide": 1.3, Medium: 1.6, "Medium close-up": 1.9, "Close-up": 2.3 };
    if (id === "Extreme close-up") return <Svg>{frame}<path d="M5 8 Q11 3 17 8 Q11 13 5 8Z" /><circle cx="11" cy="8" r="2" /></Svg>;
    if (id === "Insert") return <Svg>{frame}<rect x="7" y="5" width="8" height="6" rx="1" /></Svg>;
    if (id === "Over the shoulder") return <Svg>{frame}<Person scale={1.1} x={14} /><path d="M1 15 Q4 6 8 9 L8 15" /></Svg>;
    if (id === "Two shot") return <Svg>{frame}<Person scale={0.9} x={7.5} /><Person scale={0.9} x={14.5} /></Svg>;
    if (id === "POV") return <Svg>{frame}<path d="M4 8 Q11 2 18 8 Q11 14 4 8Z" /><circle cx="11" cy="8" r="1.6" /></Svg>;
    return <Svg>{frame}<Person scale={scale[id] ?? 1} /></Svg>;
  }
  if (kind === "angle") {
    const lines: Record<string, string> = {
      "Eye level": "M2 8 L18 8 M15 5.5 L18 8 L15 10.5",
      "Low angle": "M2 14 L17 4 M13.6 3.6 L17 4 L16 7.3",
      "High angle": "M2 2 L17 12 M16 8.7 L17 12 L13.6 12.4",
      "Top down": "M11 1 L11 14 M8.5 11.5 L11 14 L13.5 11.5",
      "Ground level": "M3 15 L14 2 M10.5 2.4 L14 2 L13.8 5.4",
    };
    if (id === "Dutch") return <Svg><path d="M3 4 L18 1.5 L19.5 12 L4.5 14.5Z" /></Svg>;
    return <Svg><circle cx="3" cy="8" r="0.1" /><path d={lines[id] ?? lines["Eye level"]} /></Svg>;
  }
  if (kind === "movement") {
    const p: Record<string, React.ReactNode> = {
      Static: <><rect x="6" y="3" width="10" height="7" rx="1" /><path d="M8 15 L11 10 L14 15" /></>,
      Pan: <path d="M2 8 H20 M5 5 L2 8 L5 11 M17 5 L20 8 L17 11" />,
      Tilt: <path d="M11 1 V15 M8 4 L11 1 L14 4 M8 12 L11 15 L14 12" />,
      "Push in": <><rect x="1" y="1" width="20" height="14" rx="1.5" /><rect x="7" y="5" width="8" height="6" /><path d="M3 3 L6.5 6.5 M19 3 L15.5 6.5" /></>,
      "Pull out": <><rect x="1" y="1" width="20" height="14" rx="1.5" /><rect x="7" y="5" width="8" height="6" /><path d="M6.5 4.5 L3 1.5 M15.5 4.5 L19 1.5" /></>,
      Dolly: <><path d="M3 9 H17 M14 6 L17 9 L14 12" /><circle cx="5" cy="14" r="1.2" /><circle cx="15" cy="14" r="1.2" /></>,
      Tracking: <><path d="M2 12 H20" strokeDasharray="2 2" /><path d="M3 6 H18 M15 3 L18 6 L15 9" /></>,
      Crane: <path d="M3 14 Q6 3 18 3 M15 1 L18 3 L15 5.5" />,
      Handheld: <path d="M2 8 Q4 5 6 8 T10 8 T14 8 T18 8 T20 7" />,
      Gimbal: <path d="M2 11 Q11 2 20 11 M17.5 8 L20 11 L16.5 11.8" />,
      Drone: <><rect x="8" y="6" width="6" height="4" rx="1" /><path d="M8 7 L4 4 M14 7 L18 4 M8 9 L4 12 M14 9 L18 12" /><circle cx="4" cy="4" r="1.5" /><circle cx="18" cy="4" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" /></>,
      Zoom: <><rect x="1" y="1" width="20" height="14" rx="1.5" /><rect x="5" y="4" width="12" height="8" /><rect x="8.5" y="6.5" width="5" height="3" /></>,
      Orbit: <><ellipse cx="11" cy="8" rx="9" ry="5" /><circle cx="11" cy="8" r="1.5" /><path d="M17 3.5 L20 4.5 L18.5 7" /></>,
    };
    return <Svg>{p[id] ?? p.Static}</Svg>;
  }
  if (kind === "lens") {
    const deg = FOV[id] ?? 47;
    const half = (deg / 2) * (Math.PI / 180);
    const len = 17;
    const dx = Math.cos(half) * len;
    const dy = Math.min(7, Math.sin(half) * len);
    return <Svg><path d={`M2 8 L${2 + dx} ${8 - dy} M2 8 L${2 + dx} ${8 + dy}`} /><path d={`M${2 + dx} ${8 - dy} Q${4 + dx} 8 ${2 + dx} ${8 + dy}`} /><circle cx="2" cy="8" r="1" /></Svg>;
  }
  if (kind === "intExt") {
    return id === "EXT" ? (
      <Svg><circle cx="15" cy="5" r="2.5" /><path d="M2 15 L8 6 L13 15 M11 12 L14 9 L19 15" /></Svg>
    ) : (
      <Svg><path d="M3 8 L11 2 L19 8 V15 H3Z M9 15 V10 H13 V15" /></Svg>
    );
  }
  if (kind === "dayNight") {
    if (id === "NIGHT") return <Svg><path d="M14 2 A6 6 0 1 0 18 11 A5 5 0 1 1 14 2Z" /></Svg>;
    if (id === "DUSK" || id === "DAWN") return <Svg><path d="M2 12 H20 M6 12 A5 5 0 0 1 16 12" /><path d={id === "DUSK" ? "M11 2 V5 M9.5 3.5 L11 5 L12.5 3.5" : "M11 5 V2 M9.5 3.5 L11 2 L12.5 3.5"} /></Svg>;
    return <Svg><circle cx="11" cy="8" r="3.5" /><path d="M11 1 V2.5 M11 13.5 V15 M4 8 H5.5 M16.5 8 H18 M6 3 L7 4 M15 12 L16 13 M16 3 L15 4 M7 12 L6 13" /></Svg>;
  }
  if (kind === "castMade") return id === "ai" ? <Svg><rect x="4" y="2" width="14" height="12" rx="2" /><circle cx="8.5" cy="7" r="1" /><circle cx="13.5" cy="7" r="1" /><path d="M8 10.5 H14" /></Svg> : <Svg><Person scale={1.4} /></Svg>;
  if (kind === "placeMade") return id === "ai" ? <Svg><rect x="2" y="2" width="18" height="12" rx="2" /><path d="M5 11 L9 6 L12 9 L14 7 L17 11Z" /></Svg> : <Svg><path d="M11 15 C6 9 5 7 5 5.5 A6 6 0 0 1 17 5.5 C17 7 16 9 11 15Z" /><circle cx="11" cy="5.5" r="2" /></Svg>;
  return null;
}

export function ChoiceField({
  kind,
  value,
  editable,
  lang,
  otherLabel,
  useLabel,
  label,
  onCommit,
  compact,
}: {
  kind: TermKind;
  value: string;
  editable: boolean;
  lang: "en" | "ar";
  otherLabel: string;
  useLabel: string;
  label: string;
  onCommit: (v: string) => void;
  compact?: boolean;
}) {
  const term = findTerm(kind, value);
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState(value);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // The list floats above the page, so a table that scrolls sideways does not cut it off.
  const [pos, setPos] = useState<React.CSSProperties>({});
  const place = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const rtl = document.documentElement.dir === "rtl";
    const below = window.innerHeight - r.bottom > 360 || r.top < 360;
    setPos({
      position: "fixed",
      ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
      ...(rtl ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.min(r.left, window.innerWidth - 248) }),
    });
  };
  useEffect(() => {
    if (!open) return;
    const away = () => { setOpen(false); setTyping(false); };
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setTyping(false); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setTyping(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", away, true); window.removeEventListener("resize", away); };
  }, [open]);

  const shown = (
    <span className="inline-flex items-center gap-1.5 min-w-0" title={term?.note ? term.note[lang] : undefined}>
      {term && <TermIcon kind={kind} id={term.id} />}
      <span className={compact ? "whitespace-nowrap" : ""} dir="auto">{term ? term[lang] : value || "–"}</span>
    </span>
  );
  if (!editable) return shown;

  return (
    <div ref={box} className="relative inline-block">
      <button ref={button} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${term ? term[lang] : value}`} onClick={() => { place(); setOpen((v) => !v); setDraft(value); }} className="rounded-sm px-1 -mx-1 py-0.5 hover:bg-tint-2 text-start">
        {shown}
      </button>
      {open && (
        <div className="z-50 w-[240px] bg-surface border border-line-strong rounded-md p-1" style={{ boxShadow: "var(--shadow-float)", ...pos }}>
          <ul role="listbox" aria-label={label} className="m-0 p-0 list-none max-h-[300px] overflow-y-auto">
            {TERMS[kind].map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={term?.id === t.id}
                  className={`w-full flex items-center gap-2 px-2 h-9 rounded-sm text-start small hover:bg-tint-2 ${term?.id === t.id ? "font-medium bg-tint-2" : ""}`}
                  onClick={() => { setOpen(false); if (t.id !== term?.id) onCommit(t.id); }}
                >
                  <TermIcon kind={kind} id={t.id} />
                  <span className="grow">{t[lang]}</span>
                  {t.note && <span className="text-[11px] text-ink-faint">{t.note[lang]}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line mt-1 pt-1">
            {typing ? (
              <form className="flex gap-1 p-1" onSubmit={(e) => { e.preventDefault(); setOpen(false); setTyping(false); if (draft.trim() && draft.trim() !== value) onCommit(draft.trim()); }}>
                <input autoFocus className="mn-input h-8 text-[13px]" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={otherLabel} dir="auto" />
                <button type="submit" className="mn-btn mn-btn--secondary mn-btn--sm">{useLabel}</button>
              </form>
            ) : (
              <button type="button" className="w-full px-2 h-9 rounded-sm text-start small text-ink-muted hover:bg-tint-2" onClick={() => setTyping(true)}>{otherLabel}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
