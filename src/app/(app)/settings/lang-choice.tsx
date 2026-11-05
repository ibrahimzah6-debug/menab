"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";

export function LangChoice({ current, english, arabic, label }: { current: "en" | "ar"; english: string; arabic: string; label: string }) {
  const [pending, start] = useTransition();
  const options = [
    { value: "en" as const, text: english },
    { value: "ar" as const, text: arabic },
  ];
  return (
    <div className="mn-stagebar" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          lang={o.value}
          disabled={pending}
          onClick={() => start(async () => void (await setLocale(o.value)))}
          className={`mn-stage cursor-pointer border-0 ${current === o.value ? "mn-stage--current" : "bg-transparent"}`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}
