// The Menab mark drawn as its three folded parts. While Menab AI works, the parts
// appear one after another and fade, instead of a spinner. Still for reduced motion.
export function MenabLoader({ size = 28, label }: { size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <svg width={size * 1.73} height={size} viewBox="0 0 595 343" aria-hidden="true" className="mn-loader">
        <polygon points="0,112 72,72 135,112 135,270 0,305" />
        <polygon points="74,62 172,4 405,138 405,272 136,102" />
        <polygon points="355,72 486,2 562,8 595,56 595,268 466,343 466,160" />
      </svg>
      {label && <span className="small text-ink-muted">{label}</span>}
    </span>
  );
}
