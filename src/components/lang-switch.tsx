"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";

export function LangSwitch({ to, label, ariaLabel }: { to: "en" | "ar"; label: string; ariaLabel: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="mn-btn mn-btn--ghost mn-btn--sm"
      aria-label={ariaLabel}
      lang={to}
      disabled={pending}
      onClick={() => start(async () => void (await setLocale(to)))}
    >
      {label}
    </button>
  );
}
