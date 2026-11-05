import { createProject } from "@/app/p/[id]/actions";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentMember } from "@/lib/workspace";
import { StartButton } from "./start-button";

const PRESETS = [
  { key: "ramadan", lengths: [30, 15, 6], ratios: ["16:9", "9:16"] },
  { key: "launch", lengths: [30, 15, 6], ratios: ["16:9", "9:16", "1:1"] },
  { key: "event", lengths: [60, 15], ratios: ["16:9", "9:16"] },
] as const;

// Document templates and the stage that writes each one (workflow-map.md).
const DOCS = [
  { key: "cps", stage: 1, m: "M2", ready: true },
  { key: "treatment", stage: 2, m: "M3", ready: false },
  { key: "budget", stage: 4, m: "M6", ready: false },
  { key: "ppm", stage: 4, m: "M6", ready: false },
  { key: "callsheet", stage: 4, m: "M6", ready: false },
] as const;

const iso = (x: string) => String.fromCharCode(0x2066) + x + String.fromCharCode(0x2069);

export default async function TemplatesPage() {
  const { t } = await getI18n();
  const tp = t.templates;
  const me = await getCurrentMember();
  const canCreate = Boolean(me && ["admin", "producer"].includes(me.role));

  return (
    <div className="max-w-[1100px] flex flex-col gap-8">
      <div>
        <h1 className="h1 m-0">{t.nav.templates}</h1>
        <p className="body text-ink-muted m-0 mt-1 max-w-[680px]">{tp.intro}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="mn-label m-0">{tp.projectTypes}</h2>
        <div className="bg-surface border border-line rounded-lg p-5 flex flex-wrap items-center gap-4">
          <div className="grow min-w-[240px]">
            <h3 className="h3 m-0">{tp.commercial}</h3>
            <p className="small text-ink-muted m-0 mt-1">{tp.commercialNote}</p>
          </div>
          <span className="small text-ink-faint">{tp.otherTypes}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="mn-label m-0">{tp.presets}</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {PRESETS.map((x) => (
            <form key={x.key} action={createProject} className="mn-card flex flex-col gap-3" style={{ padding: 20, width: "auto" }}>
              <input type="hidden" name="preset" value={x.key} />
              <span className="mn-label">{tp.commercial}</span>
              <h3 className="h3 m-0">{tp.preset[x.key].name}</h3>
              <p className="small text-ink-muted m-0 grow">{tp.preset[x.key].note}</p>
              <div className="flex flex-wrap gap-1.5">
                {x.lengths.map((n) => <span key={n} className="mn-chip mn-chip--waiting">{iso(fill(tp.length, { n }))}</span>)}
                {x.ratios.map((r) => <span key={r} className="mn-chip mn-chip--waiting data" lang="en">{iso(r)}</span>)}
              </div>
              {canCreate && <StartButton label={tp.use} busy={tp.starting} />}
            </form>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="mn-label m-0">{tp.documents}</h2>
          <p className="small text-ink-muted m-0 mt-1">{tp.documentsNote}</p>
        </div>
        <div className="bg-surface border border-line rounded-lg">
          {DOCS.map((d, i) => (
            <div key={d.key} className={`flex items-center gap-3 px-5 py-3 ${i ? "border-t border-line" : ""}`}>
              <span className="body grow">{tp.docs[d.key]}</span>
              <span className="small text-ink-muted">{fill(tp.docStage, { n: d.stage })}</span>
              {d.ready ? (
                <span className="mn-chip mn-chip--ready">{t.status.ready}</span>
              ) : (
                <span className="mn-chip mn-chip--waiting">{fill(tp.comesIn, { m: d.m })}</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
