"use client";

import { useState, useTransition } from "react";
import { sendFeedback } from "@/lib/feedback";

type C = { good: string; bad: string; why: string; send: string; thanks: string };

// Thumbs under a reply. A thumbs down asks what went wrong; both go to the development loop.
export function ReplyFeedback({ projectId, messageId, c }: { projectId: string; messageId: string; c: C }) {
  const [state, setState] = useState<"idle" | "asking" | "sent">("idle");
  const [, start] = useTransition();
  const btn = "w-7 h-7 grid place-items-center rounded-md text-ink-faint hover:text-ink hover:bg-tint-2";
  if (state === "sent") return <span className="text-[12px] text-ink-faint">{c.thanks}</span>;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-0.5">
        <button type="button" className={btn} aria-label={c.good} title={c.good} onClick={() => start(async () => { await sendFeedback({ kind: "up", messageId, projectId }); setState("sent"); })}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7" /></svg>
        </button>
        <button type="button" className={btn} aria-label={c.bad} title={c.bad} aria-expanded={state === "asking"} onClick={() => setState(state === "asking" ? "idle" : "asking")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 4H17" /></svg>
        </button>
      </div>
      {state === "asking" && (
        <form
          className="flex gap-2 max-w-[460px]"
          action={(f) => start(async () => { await sendFeedback({ kind: "down", messageId, projectId, text: String(f.get("why") ?? "") }); setState("sent"); })}
        >
          <input name="why" autoFocus dir="auto" maxLength={2000} placeholder={c.why} aria-label={c.why} className="mn-input grow" style={{ height: 32, fontSize: 13 }} />
          <button className="mn-btn mn-btn--secondary mn-btn--sm">{c.send}</button>
        </form>
      )}
    </div>
  );
}
