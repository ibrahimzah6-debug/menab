"use client";

import { useFormStatus } from "react-dom";

export function StartButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="mn-btn mn-btn--secondary justify-center" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}
