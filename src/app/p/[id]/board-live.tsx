"use client";

import { useEffect, useRef, useState } from "react";

// The Menab AI cursor on the board (design-system mn-cursor, screens/StageBoard.png). It glides
// to the card being written and moves a little while it writes; with nothing being written it
// fades away. Motion only explains what the AI is doing, and is off for reduced motion.
export function BoardCursor({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const find = () => {
      const busy = box.querySelector<HTMLElement>("[data-ai-busy]");
      if (!busy) return setPos(null);
      const target = busy.querySelector<HTMLElement>("[data-ai-spot]") ?? busy;
      const b = box.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      // Positions are measured on screen and turned back into canvas units (the canvas may be zoomed).
      const scale = box.offsetWidth ? b.width / box.offsetWidth : 1;
      setPos({ x: (r.left - b.left + r.width * 0.72) / scale, y: (r.top - b.top + r.height * 0.58) / scale });
    };
    find();
    const id = setInterval(find, 600);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      ref={ref}
      className="mn-cursor mn-board-cursor"
      aria-hidden="true"
      style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, opacity: pos ? 1 : 0, zIndex: 5 }}
    >
      <svg className="mn-cursor__arrow" viewBox="0 0 16 16"><path d="M1 1l13 6-6 1.5L6.5 15z" /></svg>
      <span className="mn-cursor__tag">{label}</span>
    </div>
  );
}

// Text that types itself in when it has just been written; otherwise shown whole at once.
export function TypeIn({ text, fresh }: { text: string; fresh: boolean }) {
  const [shown, setShown] = useState(fresh ? 0 : text.length);
  useEffect(() => {
    if (!fresh || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const step = Math.max(1, Math.ceil(text.length / 60));
    const id = setInterval(() => setShown((n) => (n + step >= text.length ? (clearInterval(id), text.length) : n + step)), 22);
    return () => clearInterval(id);
  }, [text, fresh]);
  return (
    <span dir="auto" className={shown < text.length ? "mn-typing" : ""}>
      {text.slice(0, shown)}
    </span>
  );
}
