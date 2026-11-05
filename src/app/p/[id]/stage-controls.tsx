"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Path } from "@/lib/projects";
import { approveStage, choosePath, writeBriefDocuments, type Result } from "./actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const run = (fn: () => Promise<Result>, showProgress = false, thenGo?: string) => {
    // While Menab AI writes, redraw once so the steps show "Generating".
    if (showProgress) setTimeout(() => router.refresh(), 1500);
    start(async () => {
      const res = await fn();
      setError(res.error);
      // After an approval, open the next stage instead of staying on the approved page.
      if (!res.error && thenGo) router.push(thenGo);
      router.refresh();
    });
  };
  return { pending, error, run };
}

export function RewriteButton({ projectId, label, cost, disabled }: { projectId: string; label: string; cost: string; disabled?: boolean }) {
  const { pending, error, run } = useRun();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="mn-btn mn-btn--secondary mn-btn--sm justify-between w-full"
        disabled={disabled || pending}
        onClick={() => run(() => writeBriefDocuments(projectId), true)}
      >
        <span className={pending ? "mn-dots" : ""}>{label}</span>
        <span className="mn-btn__cost">{cost}</span>
      </button>
      {error && <p role="alert" className="small m-0">{error}</p>}
    </div>
  );
}

export function PathButtons({
  projectId,
  current,
  options,
  chosenLabel,
  disabled,
}: {
  projectId: string;
  current: Path | null;
  options: { path: Path; label: string }[];
  chosenLabel: string;
  disabled?: boolean;
}) {
  const { pending, error, run } = useRun();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => {
          const on = current === o.path;
          return (
            <button
              key={o.path}
              type="button"
              role="radio"
              aria-checked={on}
              className={`mn-btn mn-btn--sm ${on ? "mn-btn--primary" : "mn-btn--secondary"}`}
              disabled={disabled || pending}
              onClick={() => run(() => choosePath(projectId, o.path))}
            >
              {o.label}
              {on && <span className="sr-only"> ({chosenLabel})</span>}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="small m-0">{error}</p>}
    </div>
  );
}

export function StageFooter({
  projectId,
  stage,
  message,
  action,
  label,
  cost,
  busyLabel,
  disabled,
}: {
  projectId: string;
  stage: number;
  message: string;
  action: "write" | "approve" | null;
  label: string;
  cost?: string;
  busyLabel?: string;
  disabled?: boolean;
}) {
  const { pending, error, run } = useRun();
  return (
    <footer className="shrink-0 sticky bottom-0 bg-surface border-t border-line px-5 py-3 flex flex-wrap gap-3 items-center z-10">
      <span className="small text-ink-muted" role="status">
        {pending && busyLabel ? <span className="mn-dots">{busyLabel}</span> : error ?? message}
      </span>
      <span className="grow" />
      {action && (
        <button
          type="button"
          className="mn-btn mn-btn--primary"
          disabled={disabled || pending}
          onClick={() => run(() => (action === "write" ? writeBriefDocuments(projectId) : approveStage(projectId, stage)), action === "write", action === "approve" ? `/p/${projectId}` : undefined)}
        >
          {pending && <span className="mn-chip__icon" style={{ border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", width: 12, height: 12, animation: "mn-spin .9s linear infinite" }} aria-hidden="true" />}
          {label}
          {cost && <span className="mn-btn__cost">{cost}</span>}
        </button>
      )}
    </footer>
  );
}
