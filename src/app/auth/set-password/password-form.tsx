"use client";

import { useActionState } from "react";
import { savePassword, type PasswordState } from "./actions";

type Copy = { password: string; confirm: string; submit: string; tooShort: string; mismatch: string; failed: string };

export function PasswordForm({ copy }: { copy: Copy }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(savePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="small text-ink-muted">{copy.password}</span>
        <input className="mn-input" type="password" name="password" autoComplete="new-password" minLength={8} required dir="ltr" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="small text-ink-muted">{copy.confirm}</span>
        <input className="mn-input" type="password" name="confirm" autoComplete="new-password" minLength={8} required dir="ltr" />
      </label>
      {state?.error && <p role="alert" className="small m-0">{copy[state.error]}</p>}
      <button className="mn-btn mn-btn--primary justify-center" disabled={pending}>{copy.submit}</button>
    </form>
  );
}
