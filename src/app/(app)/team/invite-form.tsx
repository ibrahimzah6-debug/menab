"use client";

import { useActionState } from "react";
import { inviteMember, type InviteState } from "./actions";
import { CopyLink } from "./copy-link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/dictionaries";

export function InviteForm({ t, roles }: { t: Dictionary["team"]; roles: Dictionary["roles"] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, undefined);
  return (
    <section className="bg-surface border border-line rounded-lg p-6 flex flex-col gap-4">
      <div>
        <h2 className="h3 m-0 mb-1">{t.inviteTitle}</h2>
        <p className="small text-ink-muted m-0">{t.inviteBody}</p>
      </div>
      <form action={action} className="grid gap-4 md:grid-cols-[1fr_1fr_180px_auto] items-end">
        <label className="flex flex-col gap-1.5">
          <span className="small text-ink-muted">{t.name}</span>
          <input className="mn-input" name="full_name" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="small text-ink-muted">{t.email}</span>
          <input className="mn-input" name="email" type="email" required dir="ltr" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="small text-ink-muted">{t.role}</span>
          <select className="mn-input" name="role" defaultValue="coordinator">
            {(["admin", "producer", "coordinator", "viewer"] as const).map((r) => (
              <option key={r} value={r}>{roles[r]}</option>
            ))}
          </select>
        </label>
        <button className="mn-btn mn-btn--primary" disabled={pending}>{t.inviteSubmit}</button>
      </form>
      {state?.error && <p role="alert" className="small m-0">{t[state.error]}</p>}
      {state?.link && (
        <CopyLink link={state.link} label={t.copy} copiedLabel={t.copied} title={fill(t.linkReady, { email: state.email ?? "" })} />
      )}
    </section>
  );
}
