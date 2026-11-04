"use client";

import { useRef, useState } from "react";

export type PickerOption = { id: string; rank: number; name: string; note: string; price: string; tested?: boolean };

// A ranked dropdown: number 1 is the top-rated model for the task. Each line shows
// what the model is good at and its starting price, so the cost is clear before choosing.
export function ModelPicker({
  label,
  options,
  value,
  onChange,
  defaultLabel,
  testedLabel,
  disabled,
}: {
  label: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  defaultLabel: string;
  testedLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value) ?? options[0];

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 h-10 rounded-md bg-surface-raised border border-line text-start disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="data text-ink-faint w-5">{String(current.rank).padStart(2, "0")}</span>
        <span className="small font-medium grow truncate" lang="en">{current.name}</span>
        <span className="mn-label">{defaultLabel}</span>
        <span className="small text-ink-muted whitespace-nowrap">{current.price}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4.5l3 3 3-3" /></svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 w-full max-h-[360px] overflow-y-auto bg-surface border border-line-strong rounded-md p-1 m-0 list-none"
          style={{ boxShadow: "var(--shadow-float)" }}
        >
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={`w-full grid grid-cols-[24px_1fr_auto] gap-x-3 items-center text-start px-2 py-2 rounded-sm hover:bg-tint-2 ${o.id === value ? "bg-tint-3" : ""}`}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                <span className="data text-ink-faint">{String(o.rank).padStart(2, "0")}</span>
                <span className="flex flex-col min-w-0">
                  <span className="small font-medium truncate" lang="en">
                    {o.name}
                    {o.tested && <span className="mn-label ms-2">{testedLabel}</span>}
                  </span>
                  <span className="small text-ink-faint truncate">{o.note}</span>
                </span>
                <span className="small text-ink-muted whitespace-nowrap">{o.price}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
