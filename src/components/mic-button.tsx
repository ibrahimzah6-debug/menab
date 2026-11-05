"use client";

import { useRef, useState } from "react";
import { IconMic } from "@/components/icons";
import { startWavRecorder, type WavRecorder } from "@/lib/wav-recorder";

// A microphone for any text box: press to talk, press again to stop, and the words are added
// to the box (Google's free Gemini 3.5 Transcribe). Used where speaking is quicker than typing.
export function MicButton({
  onText,
  projectId,
  labels,
  size = 32,
}: {
  onText: (text: string) => void;
  projectId?: string;
  labels: { start: string; stop: string; working: string; blocked: string };
  size?: number;
}) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [error, setError] = useState<string | undefined>();
  const rec = useRef<WavRecorder | null>(null);
  const abort = useRef<AbortController | null>(null);

  const start = async () => {
    setError(undefined);
    try {
      rec.current = await startWavRecorder();
      setState("rec");
    } catch {
      setError(labels.blocked);
    }
  };

  const stop = async () => {
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    setState("busy");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { blob } = await r.stop();
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "audio/wav", ...(projectId ? { "x-project": projectId } : {}) },
        body: blob,
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!res.ok || !body?.text) throw new Error(body?.error ?? labels.blocked);
      onText(body.text.trim());
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setState("idle");
    }
  };

  const label = state === "rec" ? labels.stop : state === "busy" ? labels.working : labels.start;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => (state === "idle" ? start() : state === "rec" ? stop() : abort.current?.abort())}
        className={`grid place-items-center rounded-full shrink-0 transition-colors ${state === "rec" ? "bg-primary text-on-primary" : "text-ink-muted hover:bg-tint-2 hover:text-ink border border-line"}`}
        style={{ width: size, height: size }}
      >
        {state === "rec" ? (
          <span aria-hidden="true" className="block w-2.5 h-2.5 rounded-[2px] bg-current" />
        ) : state === "busy" ? (
          <span className="mn-pulse" aria-hidden="true" style={{ width: 8, height: 8 }} />
        ) : (
          <IconMic size={16} />
        )}
      </button>
      {state === "rec" && <span className="text-[12px] text-ink-muted" role="status">{labels.stop}</span>}
      {error && <span className="text-[12px]" role="alert">{error}</span>}
    </span>
  );
}
