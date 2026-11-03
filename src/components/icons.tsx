// Outline icons, 1.5px stroke, after Tabler Icons. Colored by the text next to them.
type P = { size?: number; className?: string };
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconHome = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 12H3l9-9 9 9h-2" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" /></svg>
);
export const IconFolder = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2" /></svg>
);
export const IconBooks = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 4h4v16H5z" /><path d="M9 4h4v16H9z" /><path d="M5 8h4M9 16h4" /><path d="M13.8 4.5l4-1 3.5 15.5-4 1z" /></svg>
);
export const IconTemplate = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="4" width="16" height="4" rx="1" /><rect x="4" y="12" width="6" height="8" rx="1" /><path d="M14 12h6M14 16h6M14 20h6" /></svg>
);
export const IconUsers = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" /></svg>
);
export const IconCoins = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v4c0 1.66 2.69 3 6 3s6-1.34 6-3V7" /><path d="M3 11v4c0 1.66 2.69 3 6 3 1.4 0 2.69-.24 3.71-.64" /><path d="M15 13c0-1.66 2.69-3 6-3" /></svg>
);
export const IconSettings = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M10.33 4.32c.43-1.76 2.93-1.76 3.35 0a1.72 1.72 0 0 0 2.57 1.07c1.54-.94 3.31.83 2.37 2.37a1.72 1.72 0 0 0 1.06 2.57c1.76.43 1.76 2.93 0 3.35a1.72 1.72 0 0 0-1.07 2.57c.94 1.54-.83 3.31-2.37 2.37a1.72 1.72 0 0 0-2.57 1.06c-.43 1.76-2.93 1.76-3.35 0a1.72 1.72 0 0 0-2.57-1.07c-1.54.94-3.31-.83-2.37-2.37a1.72 1.72 0 0 0-1.06-2.57c-1.76-.43-1.76-2.93 0-3.35a1.72 1.72 0 0 0 1.07-2.57c-.94-1.54.83-3.31 2.37-2.37 1 .61 2.3.07 2.57-1.06z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconPlus = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMic = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg className={className ?? "mn-chip__icon"} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
);
