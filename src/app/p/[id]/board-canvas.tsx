"use client";

import { useEffect, useRef, useState } from "react";

const MIN = 0.4;
const MAX = 2;

// The board as a canvas: drag the empty space to move around, scroll to pan, and zoom with
// the buttons or Ctrl (Cmd on Mac) and the mouse wheel. Zooming scales the layout as it is;
// the columns never change. Cards stay editable inside it.
export function BoardCanvas({ children, labels }: { children: React.ReactNode; labels: { zoomIn: string; zoomOut: string; reset: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  // The canvas math runs left to right; the cards inside follow the page direction.
  const [rtl, setRtl] = useState(false);
  useEffect(() => setRtl(document.documentElement.dir === "rtl"), []);

  // Zoom around a point (the mouse, or the middle for the buttons), so what is under it stays put.
  const zoomTo = (next: number, cx?: number, cy?: number) => {
    const el = ref.current;
    if (!el) return;
    const z = Math.min(MAX, Math.max(MIN, Math.round(next * 100) / 100));
    const r = el.getBoundingClientRect();
    const x = cx ?? r.width / 2;
    const y = cy ?? r.height / 2;
    setPan((p) => ({ x: x - ((x - p.x) * z) / zoom, y: y - ((y - p.y) * z) / zoom }));
    setZoom(z);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        zoomTo(zoom * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
      } else {
        setPan((p) => ({ x: p.x - (e.shiftKey ? e.deltaY : e.deltaX), y: p.y - (e.shiftKey ? 0 : e.deltaY) }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea, input, button, a, select, .mn-card")) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
  };
  const end = () => {
    drag.current = null;
  };

  const btn = "w-8 h-8 grid place-items-center rounded-md hover:bg-tint-2 text-[16px]";
  return (
    <div
      ref={ref}
      className="mn-board relative flex-1 min-w-0 min-h-[420px] md:min-h-0 overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
      style={{ backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `${16 * zoom}px ${16 * zoom}px`, padding: 0 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute top-0 left-0 p-6 select-text"
        style={{ width: "100%", transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
      >
        <div className="relative flex flex-col gap-8" dir={rtl ? "rtl" : "ltr"}>{children}</div>
      </div>
      <div className="absolute bottom-3 end-3 flex items-center gap-0.5 bg-surface border border-line rounded-lg p-1" style={{ boxShadow: "var(--shadow-float)" }}>
        <button type="button" className={btn} aria-label={labels.zoomOut} title={labels.zoomOut} onClick={() => zoomTo(zoom - 0.1)}>−</button>
        <button type="button" className="h-8 px-2 rounded-md hover:bg-tint-2 mn-label" title={labels.reset} aria-label={labels.reset} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} lang="en">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className={btn} aria-label={labels.zoomIn} title={labels.zoomIn} onClick={() => zoomTo(zoom + 0.1)}>+</button>
      </div>
    </div>
  );
}
