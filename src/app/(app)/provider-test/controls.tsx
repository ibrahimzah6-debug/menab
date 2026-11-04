"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Phase } from "@/lib/ai/provider-test-plan";
import { checkProgress, retryItem, saveNote, saveScore, startNewRun, startPhase, type ActionResult } from "./actions";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const res = await fn();
      setError(res.error);
      router.refresh();
    });
  return { pending, error, run };
}

export function StartButton({ label, primary }: { label: string; primary?: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={`mn-btn ${primary ? "mn-btn--primary" : "mn-btn--secondary"} mn-btn--sm`}
        disabled={pending}
        onClick={() => run(() => startNewRun())}
      >
        {label}
      </button>
      {error && <p role="alert" className="small m-0">{error}</p>}
    </div>
  );
}

export function PhaseButton({ run: runNumber, phase, label, disabled }: { run: number; phase: Phase; label: string; disabled?: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="mn-btn mn-btn--secondary mn-btn--sm"
        disabled={disabled || pending}
        onClick={() => run(() => startPhase(runNumber, phase))}
      >
        {label}
      </button>
      {error && <p role="alert" className="small m-0">{error}</p>}
    </div>
  );
}

export function RetryButton({ id, label }: { id: string; label: string }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={pending} onClick={() => run(() => retryItem(id))}>
        {label}
      </button>
      {error && <p role="alert" className="small m-0">{error}</p>}
    </>
  );
}

// While jobs run, ask Kie for news every 8 seconds and redraw the page.
export function AutoCheck({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      await checkProgress();
      router.refresh();
    };
    const id = setInterval(tick, 8000);
    tick();
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active, router]);
  return null;
}

export function ScoreSelect({
  id,
  field,
  value,
  label,
  emptyLabel,
}: {
  id: string;
  field: "quality" | "consistency" | "arabic_text";
  value: number | null;
  label: string;
  emptyLabel: string;
}) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center justify-between gap-2 small">
      <span className="text-ink-muted">{label}</span>
      <select
        className="mn-select"
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(e) => {
          const v = e.currentTarget.value;
          start(async () => {
            await saveScore(id, field, v === "" ? null : Number(v));
          });
        }}
      >
        <option value="">{emptyLabel}</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  );
}

export function NoteField({ id, value, label }: { id: string; value: string | null; label: string }) {
  const [, start] = useTransition();
  return (
    <label className="flex flex-col gap-1 small">
      <span className="text-ink-muted">{label}</span>
      <textarea
        className="mn-input"
        style={{ height: 56, paddingTop: 8, resize: "vertical" }}
        defaultValue={value ?? ""}
        maxLength={2000}
        onBlur={(e) => {
          const v = e.currentTarget.value;
          if (v !== (value ?? "")) start(async () => void (await saveNote(id, v)));
        }}
      />
    </label>
  );
}
