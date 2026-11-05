"use client";

import { useTransition } from "react";
import { setTheme, type Theme } from "@/lib/preferences";

export function ThemeChoice({ current, labels, label }: { current: Theme; labels: Record<Theme, string>; label: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="mn-stagebar" role="radiogroup" aria-label={label}>
      {(["light", "dark", "system"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={current === v}
          disabled={pending}
          onClick={() => start(() => setTheme(v))}
          className={`mn-stage cursor-pointer border-0 ${current === v ? "mn-stage--current" : "bg-transparent"}`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}
