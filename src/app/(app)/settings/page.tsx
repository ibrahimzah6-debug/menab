import Link from "next/link";
import { cookies } from "next/headers";
import { CATALOG, DEFAULT_MODEL, DEFAULT_TEXT_MODEL, formatPrice, TEXT_MODELS, TRANSCRIBER, type ModelTask } from "@/lib/ai/catalog";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { workspaceUsage } from "@/lib/usage";
import { getCurrentMember } from "@/lib/workspace";
import { LanguageList, PasswordForm, ProfileForm, WorkspaceForm } from "./account-forms";
import { DefaultModel } from "./models";
import { ThemeChoice } from "./theme-choice";

const SECTIONS = ["account", "workspace", "appearance", "language", "models", "notifications", "usage", "help"] as const;
type Section = (typeof SECTIONS)[number];

// Settings with its own side list of sections, like Claude's: account first, then the
// workspace, how Menab looks and speaks, AI models, notices, usage and help.
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { locale, uiLocale, t } = await getI18n();
  const s = t.settings;
  const asked = (await searchParams).s;
  const section: Section = SECTIONS.includes(asked as Section) ? (asked as Section) : "account";
  const member = await getCurrentMember();
  const supabase = await createClient();
  const isolate = (x: string) => String.fromCharCode(0x2066) + x + String.fromCharCode(0x2069);
  const card = "bg-surface border border-line rounded-lg p-5 flex flex-col gap-4";
  const formCopy = { ...s };

  // Only what the open section needs.
  let photoUrl: string | undefined;
  if (section === "account" && member?.avatarPath) {
    try {
      const { data } = await createAdminClient().storage.from("media").createSignedUrl(member.avatarPath, 3600);
      photoUrl = data?.signedUrl;
    } catch {
      photoUrl = undefined;
    }
  }
  const saved =
    section === "models" && member ? (await supabase.from("model_settings").select("task, model_id").eq("workspace_id", member.workspace.id)).data ?? [] : [];
  const chosen = (task: ModelTask) => saved.find((r) => r.task === task)?.model_id ?? DEFAULT_MODEL[task];
  const chosenText = saved.find((r) => r.task === "text")?.model_id ?? DEFAULT_TEXT_MODEL;
  const notices =
    section === "notifications" && member
      ? (await supabase.from("notifications").select("id, title, body, created_at").eq("workspace_id", member.workspace.id).order("created_at", { ascending: false }).limit(12)).data ?? []
      : [];
  const usage = section === "usage" && member ? await workspaceUsage(member.workspace.id, 30) : null;
  const spent = usage ? usage.jobs.reduce((n, j) => n + Number(j.cost_usd ?? 0), 0) : 0;
  const themeCookie = (await cookies()).get("menab-theme")?.value;
  const theme = themeCookie === "dark" || themeCookie === "system" ? themeCookie : "light";

  const tasks: { task: ModelTask; label: string }[] = [
    { task: "image", label: s.image },
    { task: "video", label: s.video },
    { task: "voice", label: s.voiceModels },
  ];

  return (
    <div className="max-w-[1100px] flex flex-col gap-6">
      <h1 className="h1 m-0">{s.title}</h1>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <nav aria-label={s.title} className="w-full md:w-[220px] shrink-0 flex md:flex-col gap-0.5 overflow-x-auto">
          {SECTIONS.map((x) => (
            <Link
              key={x}
              href={`/settings?s=${x}`}
              aria-current={x === section ? "page" : undefined}
              className={`h-9 px-3 rounded-md flex items-center text-[14px] whitespace-nowrap ${x === section ? "bg-tint-3 text-ink font-medium" : "text-ink-muted hover:bg-tint-2 hover:text-ink"}`}
            >
              {s.sections[x]}
            </Link>
          ))}
        </nav>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <h2 className="h2 m-0">{s.sections[section]}</h2>

          {section === "account" && member && (
            <>
              <section className={card}>
                <ProfileForm name={member.fullName ?? ""} initial={(member.fullName || member.email).slice(0, 1).toUpperCase()} photoUrl={photoUrl} c={formCopy} />
              </section>
              <section className={card}>
                <div className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4 small">
                  <span className="text-ink-muted">{s.email}</span>
                  <span dir="ltr" style={{ textAlign: "start" }}>{member.email}</span>
                  <span className="text-ink-muted">{s.role}</span>
                  <span>{t.roles[member.role]} · {member.workspace.name}</span>
                </div>
                <p className="text-[12px] text-ink-faint m-0">{s.emailNote}</p>
              </section>
              <section className={card}>
                <h3 className="h3 m-0">{s.password}</h3>
                <PasswordForm c={formCopy} />
              </section>
            </>
          )}

          {section === "workspace" && member && (
            <section className={card}>
              <WorkspaceForm name={member.workspace.name} canEdit={member.role === "admin"} c={formCopy} />
              <p className="small text-ink-muted m-0">{member.role === "admin" ? s.workspaceNote : s.adminOnly}</p>
              <div>
                <Link href="/team" className="mn-btn mn-btn--secondary mn-btn--sm">{s.openTeam}</Link>
              </div>
            </section>
          )}

          {section === "appearance" && (
            <section className={card}>
              <p className="small text-ink-muted m-0">{s.appearanceBody}</p>
              <ThemeChoice current={theme} labels={s.themes} label={s.appearance} />
            </section>
          )}

          {section === "language" && (
            <section className={card}>
              <p className="small text-ink-muted m-0">{s.languageBody} {s.languagesNote}</p>
              <LanguageList current={uiLocale} label={s.language} preparing={t.frame.preparing} />
            </section>
          )}

          {section === "models" && (
            <>
              <section className={card}>
                <p className="small text-ink-muted m-0">{s.modelsBody}</p>
                <DefaultModel
                  task="text"
                  label={s.text}
                  value={chosenText}
                  canChange={member?.role === "admin"}
                  defaultLabel={s.defaultTag}
                  testedLabel={s.tested}
                  savedLabel={s.saved}
                  options={TEXT_MODELS.map((m, i) => ({
                    id: m.id,
                    rank: i + 1,
                    name: m.name,
                    note: m.goodFor[locale],
                    price: `${isolate(`$${m.usdPerMillionIn} / $${m.usdPerMillionOut}`)} ${locale === "ar" ? "لكل مليون رمز" : "per million tokens"}`,
                  }))}
                />
                {tasks.map(({ task, label }) => (
                  <DefaultModel
                    key={task}
                    task={task}
                    label={label}
                    value={chosen(task)}
                    canChange={member?.role === "admin"}
                    defaultLabel={s.defaultTag}
                    testedLabel={s.tested}
                    savedLabel={s.saved}
                    options={CATALOG[task].map((m, i) => ({
                      id: m.id,
                      rank: i + 1,
                      name: m.name,
                      note: m.goodFor[locale],
                      price: formatPrice(m, locale),
                      tested: m.tested,
                    }))}
                  />
                ))}
                <p className="small text-ink-muted m-0 border-t border-line pt-3">{fill(s.voiceBriefModel, { model: TRANSCRIBER.label })}</p>
              </section>
              {member?.role === "admin" && (
                <section className={card}>
                  <h3 className="h3 m-0">{s.providerTest}</h3>
                  <p className="small text-ink-muted m-0">{s.providerTestBody}</p>
                  <div>
                    <Link href="/provider-test" className="mn-btn mn-btn--secondary mn-btn--sm">{s.open}</Link>
                  </div>
                </section>
              )}
            </>
          )}

          {section === "notifications" && (
            <>
              <section className={card}>
                <p className="small text-ink-muted m-0">{s.notificationsBody}</p>
                <div className="flex items-center gap-3 small">
                  <span className="grow">{s.inApp}</span>
                  <span className="mn-chip mn-chip--ready">{s.inAppNote}</span>
                </div>
                <div className="flex items-center gap-3 small border-t border-line pt-3">
                  <span className="grow">{s.emailNotices}</span>
                  <span className="mn-chip mn-chip--waiting">{t.frame.soon}</span>
                </div>
              </section>
              <section className={card}>
                <h3 className="h3 m-0">{s.recent}</h3>
                {notices.length === 0 ? (
                  <p className="small text-ink-muted m-0">{s.noNotices}</p>
                ) : (
                  <ul className="m-0 p-0 list-none flex flex-col">
                    {notices.map((n, i) => (
                      <li key={n.id} className={`py-2.5 flex flex-col gap-0.5 ${i ? "border-t border-line" : ""}`}>
                        <span className="small font-medium" dir="auto">{n.title}</span>
                        {n.body && <span className="text-[12px] text-ink-muted line-clamp-2" dir="auto">{n.body}</span>}
                        <span className="text-[11px] text-ink-faint data">
                          {new Date(n.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {section === "usage" && (
            <section className={card}>
              <p className="small text-ink-muted m-0">{s.usageBody}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-line p-4 flex flex-col gap-1">
                  <span className="mn-label">{s.spent30}</span>
                  <span className="h2 data">{isolate(`$${spent.toFixed(2)}`)}</span>
                </div>
                <div className="rounded-md border border-line p-4 flex flex-col gap-1">
                  <span className="mn-label">{s.calls30}</span>
                  <span className="h2 data">{usage?.jobs.length ?? 0}</span>
                </div>
              </div>
              <div>
                <Link href="/credits" className="mn-btn mn-btn--secondary mn-btn--sm">{s.openCredits}</Link>
              </div>
            </section>
          )}

          {section === "help" && (
            <section className={card}>
              <p className="small text-ink-muted m-0">{s.helpBody}</p>
              {s.faq.map((x, i) => (
                <details key={i} className={`group ${i ? "border-t border-line pt-3" : ""}`}>
                  <summary className="body font-medium cursor-pointer list-none flex items-center gap-2">
                    <span className="grow">{x.q}</span>
                    <span className="text-ink-faint group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                  </summary>
                  <p className="small text-ink-muted m-0 mt-2">{x.a}</p>
                </details>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
