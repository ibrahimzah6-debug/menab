import { IconCheck } from "@/components/icons";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { PLAN, phaseEstimateUsd, STEP_ORDER, type Step } from "@/lib/ai/provider-test-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";
import { kieBalance } from "./actions";
import { AutoCheck, NoteField, PhaseButton, RetryButton, ScoreSelect, StartButton } from "./controls";

// Finished files are copied to our storage inside these actions, which can take a while.
export const maxDuration = 60;

type Row = {
  id: string;
  run_number: number;
  step: Step;
  item_key: string;
  model: string;
  status: "waiting" | "generating" | "success" | "failed";
  fail_reason: string | null;
  cost_usd: number | null;
  seconds: number | null;
  file_path: string | null;
  mime_type: string | null;
  quality: number | null;
  consistency: number | null;
  arabic_text: number | null;
  notes: string | null;
  created_at: string;
};

const usd = (n: number) => `⁦$${n < 1 ? n.toFixed(3) : n.toFixed(2)}⁩`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function Chip({ status, label }: { status: Row["status"]; label: string }) {
  if (status === "success")
    return <span className="mn-chip mn-chip--ready"><IconCheck />{label}</span>;
  if (status === "generating")
    return <span className="mn-chip mn-chip--generating"><span className="mn-chip__icon" aria-hidden="true" />{label}</span>;
  if (status === "failed")
    return (
      <span className="mn-chip mn-chip--failed">
        <svg className="mn-chip__icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M6 3.2v3.3M6 8.6v.1" />
          <circle cx="6" cy="6" r="5" />
        </svg>
        {label}
      </span>
    );
  return <span className="mn-chip mn-chip--waiting">{label}</span>;
}

export default async function ProviderTestPage() {
  const { t } = await getI18n();
  const p = t.providerTest;
  const me = await getCurrentMember();
  if (!me || me.role !== "admin") {
    return <p className="body text-ink-muted">{p.adminOnly}</p>;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_test_items")
    .select("id, run_number, step, item_key, model, status, fail_reason, cost_usd, seconds, file_path, mime_type, quality, consistency, arabic_text, notes, created_at")
    .eq("workspace_id", me.workspace.id)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Row[];

  // Expiring links to our own copies, valid for one hour.
  const paths = rows.map((r) => r.file_path).filter((x): x is string => Boolean(x));
  const links = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await createAdminClient().storage.from("media").createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) links.set(s.path, s.signedUrl);
  }

  const balance = await kieBalance();
  const runs = [...new Set(rows.map((r) => r.run_number))].sort((a, b) => b - a);
  const pending = rows.filter((r) => r.status === "generating").length;

  // Score sheet, one line per model, across all runs.
  const models = [...new Set(rows.map((r) => r.model))];
  const sheet = models.map((model) => {
    const mine = rows.filter((r) => r.model === model && r.status !== "generating");
    const ok = mine.filter((r) => r.status === "success");
    return {
      model,
      jobs: mine.length,
      success: mine.length ? Math.round((ok.length / mine.length) * 100) : null,
      time: avg(ok.map((r) => Number(r.seconds)).filter(Number.isFinite)),
      cost: avg(ok.map((r) => Number(r.cost_usd)).filter((n) => Number.isFinite(n) && n > 0)),
      quality: avg(ok.map((r) => r.quality).filter((n): n is number => n != null)),
      consistency: avg(ok.map((r) => r.consistency).filter((n): n is number => n != null)),
      arabic: avg(ok.map((r) => r.arabic_text).filter((n): n is number => n != null)),
    };
  });

  const fmt = (n: number | null, d = 1) => (n == null ? "–" : n.toFixed(d));

  return (
    <div className="max-w-[1180px] flex flex-col gap-6">
      <AutoCheck active={pending > 0} />
      <div>
        <h1 className="h1 m-0 mb-2">{p.title}</h1>
        <p className="body text-ink-muted m-0 max-w-[720px]">{p.intro}</p>
      </div>

      <section className="bg-surface border border-line rounded-lg p-6 flex flex-wrap gap-6 items-start justify-between">
        <div className="max-w-[640px]">
          <h2 className="h3 m-0 mb-1">{p.briefTitle}</h2>
          <p className="small text-ink-muted m-0">{p.brief}</p>
        </div>
        <div className="flex flex-col gap-2 items-start">
          {balance.usd != null ? (
            <span className="mn-label">{p.balance}: <span lang="en">{usd(balance.usd)}</span></span>
          ) : (
            <p role="alert" className="small m-0 max-w-[320px]">{p.noKey}</p>
          )}
          <StartButton
            primary={runs.length === 0}
            label={`${runs.length ? p.startAgain : p.start} · ${fill(p.about, { cost: usd(phaseEstimateUsd("references")) })}`}
          />
        </div>
      </section>

      {pending > 0 && <p className="small m-0" role="status">{fill(p.working, { n: pending })}</p>}

      {sheet.length > 0 && (
        <section className="bg-surface border border-line rounded-lg overflow-x-auto">
          <h2 className="h3 m-0 px-6 pt-5">{p.sheet}</h2>
          <table className="w-full border-collapse text-[14px] leading-[22px] mt-3">
            <thead>
              <tr>
                {[p.sheetModel, p.sheetRuns, p.sheetSuccess, p.sheetTime, p.sheetCost, p.quality, p.consistency, p.arabicText].map((h) => (
                  <th key={h} scope="col" className="mn-label text-start px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.map((s) => (
                <tr key={s.model} className="border-t border-line">
                  <td className="px-4 py-2.5" lang="en">{s.model}</td>
                  <td className="px-4 py-2.5 data">{s.jobs}</td>
                  <td className="px-4 py-2.5 data">{s.success == null ? "–" : `${s.success}%`}</td>
                  <td className="px-4 py-2.5 data">{s.time == null ? "–" : `${Math.round(s.time)}s`}</td>
                  <td className="px-4 py-2.5 data">{s.cost == null ? "–" : usd(s.cost)}</td>
                  <td className="px-4 py-2.5 data">{fmt(s.quality)}</td>
                  <td className="px-4 py-2.5 data">{fmt(s.consistency)}</td>
                  <td className="px-4 py-2.5 data">{fmt(s.arabic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small text-ink-muted m-0 px-6 py-4">{p.passRule}</p>
        </section>
      )}

      {runs.map((run) => {
        const mine = rows.filter((r) => r.run_number === run);
        const done = (keys: string[]) => keys.every((k) => mine.some((r) => r.item_key === k && r.status === "success"));
        const started = (step: Step) => mine.some((r) => r.step === step);
        const refsDone = done(PLAN.filter((x) => x.step === "character" || x.step === "location").map((x) => x.key));
        const keysDone = done(PLAN.filter((x) => x.step === "keyframe").map((x) => x.key));
        return (
          <section key={run} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="h2 m-0 grow">{fill(p.run, { n: run })}</h2>
              <PhaseButton
                run={run}
                phase="keyframes"
                disabled={!refsDone || started("keyframe")}
                label={`${p.keyframes} · ${fill(p.about, { cost: usd(phaseEstimateUsd("keyframes")) })}`}
              />
              <PhaseButton
                run={run}
                phase="videos"
                disabled={!keysDone || started("video")}
                label={`${p.videos} · ${fill(p.about, { cost: usd(phaseEstimateUsd("videos")) })}`}
              />
            </div>
            {STEP_ORDER.filter((step) => mine.some((r) => r.step === step)).map((step) => (
              <div key={step} className="flex flex-col gap-3">
                <h3 className="mn-label m-0">{p.steps[step]}</h3>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                  {mine
                    .filter((r) => r.step === step)
                    .map((r) => {
                      const plan = PLAN.find((x) => x.key === r.item_key);
                      const link = r.file_path ? links.get(r.file_path) : undefined;
                      const isVideo = r.mime_type?.startsWith("video") || r.file_path?.endsWith(".mp4");
                      return (
                        <article key={r.id} className="bg-surface border border-line rounded-md p-3 flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="mn-label" lang="en">{r.item_key} · {r.model}</span>
                            <Chip status={r.status} label={p.status[r.status]} />
                          </div>
                          <p className="small m-0" lang="en">{plan?.title}</p>
                          <div className="aspect-video rounded-sm bg-tint-2 overflow-hidden">
                            {link && isVideo && <video src={link} controls playsInline className="w-full h-full object-contain bg-black" />}
                            {link && !isVideo && (
                              <a href={link} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={link} alt={`${r.item_key} ${plan?.title ?? ""}`} className="w-full h-full object-contain" />
                              </a>
                            )}
                          </div>
                          <div className="flex gap-4 small text-ink-muted">
                            <span>{p.cost}: <span className="data">{r.cost_usd != null ? usd(Number(r.cost_usd)) : "–"}</span></span>
                            <span>{p.time}: <span className="data">{r.seconds != null ? `${Math.round(Number(r.seconds))}s` : "–"}</span></span>
                          </div>
                          {r.fail_reason && (
                            <p className="small m-0" lang="en" dir="ltr" style={{ textAlign: "start" }}>{r.fail_reason}</p>
                          )}
                          {r.status === "failed" && <div><RetryButton id={r.id} label={p.retry} /></div>}
                          {r.status === "success" && (
                            <div className="flex flex-col gap-2 border-t border-line pt-3">
                              <ScoreSelect id={r.id} field="quality" value={r.quality} label={p.quality} emptyLabel={p.noScore} />
                              {r.step !== "location" && (
                                <ScoreSelect id={r.id} field="consistency" value={r.consistency} label={p.consistency} emptyLabel={p.noScore} />
                              )}
                              {r.item_key === "K3" || r.item_key === "V3" ? (
                                <ScoreSelect id={r.id} field="arabic_text" value={r.arabic_text} label={p.arabicText} emptyLabel={p.noScore} />
                              ) : null}
                              <NoteField id={r.id} value={r.notes} label={p.notes} />
                            </div>
                          )}
                        </article>
                      );
                    })}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
