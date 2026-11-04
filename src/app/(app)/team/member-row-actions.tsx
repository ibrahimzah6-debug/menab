"use client";

import { useState, useTransition } from "react";
import { changeRole, newInviteLink, removeMember, type InviteState, type TeamError } from "./actions";
import { CopyLink } from "./copy-link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/dictionaries";
import type { Role } from "@/lib/workspace";

type Props = {
  memberId: string;
  name: string;
  role: Role;
  canRelink: boolean;
  t: Dictionary["team"];
  roles: Dictionary["roles"];
};

export function RoleSelect({ memberId, name, role, t, roles, onError }: Omit<Props, "canRelink"> & { onError: (e?: TeamError) => void }) {
  const [pending, start] = useTransition();
  return (
    <select
      className="mn-select"
      aria-label={fill(t.changeRole, { name })}
      defaultValue={role}
      disabled={pending}
      onChange={(e) => {
        const next = e.currentTarget.value as Role;
        const el = e.currentTarget;
        start(async () => {
          const res = await changeRole(memberId, next);
          if (res.error) el.value = role;
          onError(res.error);
        });
      }}
    >
      {(["admin", "producer", "coordinator", "viewer"] as const).map((r) => (
        <option key={r} value={r}>{roles[r]}</option>
      ))}
    </select>
  );
}

export function MemberAdminCells(props: Props) {
  const { memberId, name, canRelink, t } = props;
  const [error, setError] = useState<TeamError | undefined>();
  const [link, setLink] = useState<InviteState>();
  const [pending, start] = useTransition();
  return (
    <>
      <td className="px-4 py-3 align-top">
        <RoleSelect {...props} onError={setError} />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex gap-1 justify-end flex-wrap">
          {canRelink && (
            <button
              type="button"
              className="mn-btn mn-btn--ghost mn-btn--sm"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await newInviteLink(memberId);
                setError(res?.error);
                setLink(res);
              })}
            >
              {t.newLink}
            </button>
          )}
          <button
            type="button"
            className="mn-btn mn-btn--ghost mn-btn--sm"
            disabled={pending}
            onClick={() => {
              if (!confirm(fill(t.removeConfirm, { name }))) return;
              start(async () => setError((await removeMember(memberId)).error));
            }}
          >
            {t.remove}
          </button>
        </div>
        {error && <p role="alert" className="small m-0 mt-2 text-end">{t[error]}</p>}
        {link?.link && (
          <div className="mt-2 min-w-[320px]">
            <CopyLink link={link.link} label={t.copy} copiedLabel={t.copied} title={fill(t.linkReady, { email: link.email ?? "" })} />
          </div>
        )}
      </td>
    </>
  );
}
