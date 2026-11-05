"use client";

import { useState, useTransition } from "react";
import { MicButton } from "@/components/mic-button";
import { sendFeedback } from "@/lib/feedback";

type C = { title: string; body: string; placeholder: string; idea: string; bug: string; send: string; thanks: string };

// Ideas and problems go straight into Menab's development list (owner dashboard).
export function SuggestForm({ c, mic }: { c: C; mic: { start: string; stop: string; working: string; blocked: string } }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"idea" | "bug">("idea");
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  if (sent) return <p className="small m-0" role="status">{c.thanks}</p>;
  return (
    <form
      className="flex flex-col gap-3"
      action={(f) =>
        start(async () => {
          const r = await sendFeedback({ kind, text: String(f.get("text") ?? ""), page: "settings/help" });
          if (r.error) setNote(r.error);
          else setSent(true);
        })
      }
    >
      <div className="mn-stagebar" role="radiogroup" aria-label={c.title}>
        {(["idea", "bug"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`mn-stage border-0 cursor-pointer ${kind === k ? "mn-stage--current" : "bg-transparent"}`}>
            {c[k]}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <MicButton labels={mic} onText={(t) => setText((x) => (x.trim() ? `${x.trim()} ${t}` : t))} />
      </div>
      <textarea name="text" value={text} onChange={(e) => setText(e.target.value)} required rows={3} maxLength={2000} dir="auto" placeholder={c.placeholder} aria-label={c.title} className="mn-input" style={{ height: "auto", paddingTop: 8, paddingBottom: 8 }} />
      <div className="flex items-center gap-3">
        <button className="mn-btn mn-btn--primary" disabled={pending}>{c.send}</button>
        {note && <span className="small" role="alert">{note}</span>}
      </div>
    </form>
  );
}
