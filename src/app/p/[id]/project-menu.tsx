"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteProject } from "./actions";

type C = { menu: string; delete: string; confirmTitle: string; confirmBody: string; confirm: string; cancel: string; deleting: string };

// The project's own menu (⋯ in the project bar). For now: delete the project, after a clear
// confirmation. Only Admins and Producers see it.
export function ProjectMenu({ projectId, name, c }: { projectId: string; name: string; c: C }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" style={{ padding: "0 10px" }} aria-label={c.menu} title={c.menu} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true" className="text-[18px] leading-none">⋯</span>
      </button>
      {open && (
        <div role="menu" className="absolute z-40 top-full mt-1 end-0 w-[200px] bg-surface border border-line-strong rounded-md p-1" style={{ boxShadow: "var(--shadow-float)" }}>
          <button role="menuitem" type="button" className="w-full text-start px-2.5 h-9 rounded-sm small hover:bg-tint-2" onClick={() => { setOpen(false); setAsking(true); }}>
            {c.delete}
          </button>
        </div>
      )}
      {asking && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={c.confirmTitle}>
          <div className="absolute inset-0 bg-black/30" onClick={() => !pending && setAsking(false)} aria-hidden="true" />
          <div className="relative w-full max-w-[420px] bg-surface border border-line rounded-lg p-5 flex flex-col gap-3" style={{ boxShadow: "var(--shadow-float)" }}>
            <h2 className="h3 m-0" dir="auto">{c.confirmTitle.replace("{name}", name)}</h2>
            <p className="small text-ink-muted m-0">{c.confirmBody}</p>
            {error && <p className="small m-0" role="alert">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="mn-btn mn-btn--ghost" disabled={pending} onClick={() => setAsking(false)}>{c.cancel}</button>
              <button
                type="button"
                className="mn-btn mn-btn--primary"
                disabled={pending}
                onClick={() => start(async () => { const r = await deleteProject(projectId); if (r?.error) setError(r.error); })}
              >
                {pending ? c.deleting : c.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
