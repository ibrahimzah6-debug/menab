"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

type Copy = { email: string; password: string; submit: string; wrong: string };

export function LoginForm({ copy }: { copy: Copy }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="small text-ink-muted">{copy.email}</span>
        <input className="mn-input" type="email" name="email" autoComplete="email" required dir="ltr" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="small text-ink-muted">{copy.password}</span>
        <input className="mn-input" type="password" name="password" autoComplete="current-password" required dir="ltr" />
      </label>
      {state?.error && (
        <p role="alert" className="small m-0">{copy.wrong}</p>
      )}
      <button className="mn-btn mn-btn--primary justify-center" disabled={pending}>
        {copy.submit}
      </button>
    </form>
  );
}
