"use client";

import { useState } from "react";

export function CopyLink({ link, label, copiedLabel, title }: { link: string; label: string; copiedLabel: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 p-4 rounded-md bg-ground-deep border border-line" role="status">
      <span className="small font-medium">{title}</span>
      <div className="flex gap-2 items-center">
        <input className="mn-input data" readOnly value={link} dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label={title} />
        <button
          type="button"
          className="mn-btn mn-btn--secondary mn-btn--sm"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? copiedLabel : label}
        </button>
      </div>
    </div>
  );
}
