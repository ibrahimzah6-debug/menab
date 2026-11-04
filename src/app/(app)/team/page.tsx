import { StatusChip } from "@/components/status-chip";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember, type Role } from "@/lib/workspace";
import { InviteForm } from "./invite-form";
import { MemberAdminCells } from "./member-row-actions";

export default async function TeamPage() {
  const { t } = await getI18n();
  const me = await getCurrentMember();
  if (!me) return null;
  const isAdmin = me.role === "admin";

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("id, user_id, email, full_name, role, status")
    .eq("workspace_id", me.workspace.id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-[1040px] flex flex-col gap-6">
      <div className="mb-6">
        <h1 className="h1 m-0 mb-2">{t.team.title}</h1>
        <p className="body text-ink-muted m-0">{fill(t.team.intro, { workspace: me.workspace.name })}</p>
      </div>

      {isAdmin && <InviteForm t={t.team} roles={t.roles} />}

      <section className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full border-collapse text-[14px] leading-[22px]">
          <thead>
            <tr>
              <th scope="col" className="mn-label text-start px-4 py-3">{t.team.name}</th>
              <th scope="col" className="mn-label text-start px-4 py-3">{t.team.email}</th>
              <th scope="col" className="mn-label text-start px-4 py-3">{t.team.status}</th>
              <th scope="col" className="mn-label text-start px-4 py-3">{t.team.role}</th>
              {isAdmin && <th scope="col" className="px-4 py-3"><span className="sr-only">{t.team.remove}</span></th>}
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => {
              const self = m.user_id === me.userId;
              const name = m.full_name || m.email;
              return (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-3 align-top">
                    {name}
                    {self && <span className="mn-label ms-2">{t.team.you}</span>}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted"><span dir="ltr">{m.email}</span></td>
                  <td className="px-4 py-3 align-top">
                    <StatusChip status={m.status} label={t.status[m.status as "invited" | "active"]} />
                  </td>
                  {isAdmin ? (
                    <MemberAdminCells
                      memberId={m.id}
                      name={name}
                      role={m.role as Role}
                      invited={m.status === "invited"}
                      t={t.team}
                      roles={t.roles}
                    />
                  ) : (
                    <td className="px-4 py-3 align-top">{t.roles[m.role as Role]}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        {(["admin", "producer", "coordinator", "viewer"] as const).map((r) => (
          <p key={r} className="small text-ink-muted m-0">
            <span className="font-medium text-ink">{t.roles[r]}:</span> {t.team.roleHelp[r]}
          </p>
        ))}
      </section>
    </div>
  );
}
