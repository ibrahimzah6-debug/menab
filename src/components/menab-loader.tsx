// While Menab AI works: one dot that gently grows and fades, like Claude's and ChatGPT's.
export function MenabLoader({ label }: { size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5" role="status" aria-live="polite">
      <span className="mn-pulse" aria-hidden="true" />
      {label && <span className="small text-ink-muted">{label}</span>}
    </span>
  );
}
