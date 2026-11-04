import Image from "next/image";
import Link from "next/link";
import { IconMic } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { StageBar } from "@/components/stage/stage-bar";
import { StatusChip, type OutputStatus } from "@/components/status-chip";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { stagesFor } from "@/lib/stages";

// Keeps "$0.62" in reading order inside Arabic text.
const money = (v: string) => `\u2066${v}\u2069`;

// The stage screen layout every project stage uses, filled with sample content.
// Real projects and outputs arrive in M2 to M4.

const SCRIPT: { time: string; picture: string; tag: "AI" | "Shoot"; sound: string; ar?: boolean }[] = [
  { time: "00:00", picture: "Wide, sunset over a Riyadh street. Cars rush home.", tag: "AI", sound: "VO: كل يوم في رمضان، نفس السباق قبل الأذان.", ar: true },
  { time: "00:05", picture: "Kitchen, close-up. A timer on the wall reads 4 minutes. The mother checks three pots at once.", tag: "Shoot", sound: "SFX: sizzling, a ticking clock." },
  { time: "00:12", picture: "Her daughter slides the Ninja air fryer forward. One button.", tag: "Shoot", sound: "البنت: يمه، خليها علي.", ar: true },
  { time: "00:20", picture: "The family sits as the adhan begins. Steam rises from the dish.", tag: "Shoot", sound: "Adhan, soft music rises." },
  { time: "00:26", picture: "Product and logo on the table.", tag: "Shoot", sound: "VO: نينجا. وقتك لأهلك.", ar: true },
];

export default async function StagePreview() {
  const { locale, t } = await getI18n();
  const s = t.stage;
  const stages = stagesFor("hybrid", s.names);
  const outputs: { key: keyof typeof s.outputs; status: OutputStatus }[] = [
    { key: "directions", status: "approved" },
    { key: "meeting", status: "approved" },
    { key: "script", status: "ready" },
    { key: "treatment", status: "generating" },
    { key: "mood", status: "waiting" },
    { key: "approval", status: "waiting" },
  ];
  const openKey = "script";

  return (
    <div className="min-h-screen flex flex-col bg-ground">
      <header className="flex flex-wrap items-center gap-4 px-6 py-3.5 bg-surface border-b border-line">
        <Link href="/" aria-label="Menab">
          <Image src="/brand/menab-logo-ink.png" alt="Menab" width={81} height={28} priority style={{ height: 28, width: "auto" }} />
        </Link>
        <span className="text-line-strong" aria-hidden="true">/</span>
        <span className="text-[15px] font-medium">Ninja Ramadan ad</span>
        <span className="mn-chip mn-chip--ready">{s.paths.hybrid}</span>
        <span className="mn-chip mn-chip--waiting">{s.sample}</span>
        <span className="grow" />
        <span className="mn-label" lang={locale === "ar" ? undefined : "en"}>
          {fill(s.spent, { spent: money("$0.62"), balance: money("$17.78") })}
        </span>
        <LangSwitch to={locale === "ar" ? "en" : "ar"} label={t.langSwitch} ariaLabel={t.langSwitchLabel} />
      </header>

      <div className="px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
        <StageBar stages={stages} current={1} label={s.stagesLabel} />
        <div className="mn-stagebar" role="group" aria-label={s.viewLabel}>
          <span className="mn-stage mn-stage--current" aria-current="true">{s.page}</span>
          <span className="mn-stage" aria-disabled="true" title={s.boardLater}>{s.board}</span>
        </div>
      </div>

      <main className="flex-1 w-full box-border px-6 pb-6 flex flex-wrap gap-4 items-start">
        <nav
          aria-label={s.outputsLabel}
          className="flex-[0_0_246px] max-w-[246px] min-w-0 bg-ground-deep border border-line rounded-lg p-3 flex flex-col gap-1"
        >
          <span className="mn-label p-2">{fill(s.outputsCount, { n: 2, count: outputs.length })}</span>
          {outputs.map((o) => {
            const open = o.key === openKey;
            const quiet = o.status === "waiting";
            return (
              <a
                key={o.key}
                href={`#${o.key}`}
                aria-current={open ? "page" : undefined}
                className={`flex justify-between items-center gap-2 p-2.5 rounded-md text-[14px] ${
                  open ? "font-medium bg-surface border border-line" : "border border-transparent"
                } ${quiet ? "text-ink-muted" : ""}`}
              >
                {s.outputs[o.key]}
                <StatusChip status={o.status} label={t.status[o.status]} />
              </a>
            );
          })}
        </nav>

        <section aria-label={s.outputs.script} className="flex-[999_1_560px] min-w-0 bg-surface border border-line rounded-lg flex flex-col">
          <div className="px-6 py-5 border-b border-line flex flex-wrap items-center gap-3">
            <div className="grow flex flex-col gap-1">
              <span className="mn-label" lang="en"><bdi>09 Script · 30 sec · v2</bdi></span>
              <h1 className="m-0 text-[24px] leading-[30px] font-semibold">The last minute before iftar</h1>
            </div>
            <button className="mn-btn mn-btn--ghost mn-btn--sm">{s.versions}</button>
            <button className="mn-btn mn-btn--secondary mn-btn--sm">{s.edit}</button>
            <button className="mn-btn mn-btn--secondary mn-btn--sm">
              {s.regenerate} <span className="mn-btn__cost" dir="ltr">$0.02</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px] leading-[22px]">
              <thead>
                <tr>
                  <th scope="col" className="mn-label text-start px-6 py-3 w-[72px]">{s.time}</th>
                  <th scope="col" className="mn-label text-start px-4 py-3">{s.picture}</th>
                  <th scope="col" className="mn-label text-start ps-4 pe-6 py-3">{s.sound}</th>
                </tr>
              </thead>
              <tbody>
                {SCRIPT.map((row) => (
                  <tr key={row.time} className="border-t border-line align-top">
                    <td className="data px-6 py-3.5 text-ink-muted" dir="ltr">{row.time}</td>
                    <td className="px-4 py-3.5" lang="en" dir="ltr" style={{ textAlign: "start" }}>
                      {row.picture} <span className="mn-label" lang="en">{row.tag}</span>
                    </td>
                    <td className="ps-4 pe-6 py-3.5" dir={row.ar ? "rtl" : "ltr"} lang={row.ar ? "ar" : "en"}>
                      {row.sound}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside aria-label={s.assistant} className="flex-[0_1_314px] max-w-[314px] min-w-0 bg-surface border border-line rounded-lg p-4 flex flex-col gap-3.5">
          <div className="flex justify-between items-center">
            <h2 className="m-0 text-[16px] font-medium">{s.assistant}</h2>
            <span className="mn-label">{fill(s.sees, { what: `${s.outputs.script} v2` })}</span>
          </div>
          <p className="m-0 text-[14px] leading-[22px] text-ink-muted" lang="en" dir="ltr" style={{ textAlign: "start" }}>
            I tagged each line AI or Shoot from your hybrid path. Want the daughter&apos;s line in English for the second cut?
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="mn-label">{s.model}</span>
            <button className="mn-btn mn-btn--secondary mn-btn--sm justify-between">
              Claude <span className="mn-btn__cost">{s.default}</span>
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prompt" className="mn-label">{s.prompt}</label>
            <textarea
              id="prompt"
              rows={4}
              lang="en"
              dir="ltr"
              className="w-full box-border resize-y border border-line-control rounded-md p-2.5 bg-surface text-ink text-[13px] leading-[20px]"
              defaultValue="30 second Ramadan script for Ninja, Saudi family, kitchen before iftar, warm and calm, Arabic VO in Saudi dialect, product hero at the end."
            />
          </div>
          <form className="flex gap-2 items-center border-t border-line pt-3.5">
            <label htmlFor="ask" className="sr-only">{s.askLabel}</label>
            <input
              id="ask"
              placeholder={s.ask}
              className="grow min-w-0 h-9 border border-line-control rounded-full px-3.5 bg-surface text-ink text-[13px]"
            />
            <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm px-2.5" aria-label={s.voice}>
              <IconMic size={16} />
            </button>
          </form>
        </aside>
      </main>

      <footer className="sticky bottom-0 bg-surface border-t border-line px-6 py-3.5 flex flex-wrap gap-3 items-center">
        <span className="text-[14px] text-ink-muted">{fill(s.footer, { n: 2, total: stages.length, cost: money("$0.30") })}</span>
        <span className="grow" />
        <button className="mn-btn mn-btn--primary">{fill(s.approve, { n: 2 })}</button>
      </footer>
    </div>
  );
}
