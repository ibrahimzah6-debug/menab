import Link from "next/link";
import { BRAIN, CATALOG, DEFAULT_MODEL, formatPrice, TRANSCRIBER, type ModelTask } from "@/lib/ai/catalog";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";
import { LangChoice } from "./lang-choice";
import { DefaultModel } from "./models";

export default async function SettingsPage() {
  const { locale, t } = await getI18n();
  const s = t.settings;
  const member = await getCurrentMember();

  const supabase = await createClient();
  const { data: saved } = member
    ? await supabase.from("model_settings").select("task, model_id").eq("workspace_id", member.workspace.id)
    : { data: [] };
  const chosen = (task: ModelTask) => saved?.find((r) => r.task === task)?.model_id ?? DEFAULT_MODEL[task];

  const tasks: { task: ModelTask; label: string }[] = [
    { task: "image", label: s.image },
    { task: "video", label: s.video },
    { task: "voice", label: s.voiceModels },
  ];

  return (
    <div className="max-w-[880px] flex flex-col gap-4">
      <h1 className="h1 m-0 mb-2">{s.title}</h1>

      <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-4">
        <div>
          <h2 className="h3 m-0 mb-1">{s.models}</h2>
          <p className="small text-ink-muted m-0">{s.modelsBody}</p>
        </div>
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
        <div className="border-t border-line pt-3 flex flex-col gap-1">
          <p className="small text-ink-muted m-0">{fill(s.brainModel, { model: BRAIN.label })}</p>
          <p className="small text-ink-muted m-0">{fill(s.voiceBriefModel, { model: TRANSCRIBER.label })}</p>
        </div>
      </section>

      <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
        <h2 className="h3 m-0">{s.language}</h2>
        <p className="small text-ink-muted m-0">{s.languageBody}</p>
        <LangChoice current={locale} english={s.english} arabic={s.arabic} label={s.language} />
      </section>

      {member?.role === "admin" && (
        <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
          <h2 className="h3 m-0">{s.providerTest}</h2>
          <p className="small text-ink-muted m-0">{s.providerTestBody}</p>
          <div>
            <Link href="/provider-test" className="mn-btn mn-btn--secondary mn-btn--sm">{s.open}</Link>
          </div>
        </section>
      )}

      {member && (
        <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-2">
          <h2 className="h3 m-0">{s.account}</h2>
          <p className="body m-0" dir="ltr" style={{ textAlign: "start" }}>{member.email}</p>
          <p className="small text-ink-muted m-0">{t.roles[member.role]} · {member.workspace.name}</p>
        </section>
      )}
    </div>
  );
}
