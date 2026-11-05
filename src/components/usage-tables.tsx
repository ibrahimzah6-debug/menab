import { textModel } from "@/lib/ai/catalog";
import type { ModelRow } from "@/lib/usage";

const iso = (x: string) => String.fromCharCode(0x2066) + x + String.fromCharCode(0x2069);
export const usd = (n: number) => iso(`$${n < 1 && n > 0 ? n.toFixed(3) : n.toFixed(2)}`);

export function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-1">
      <span className="mn-label">{label}</span>
      <span className="h2" dir="ltr" style={{ textAlign: "start" }}>{value}</span>
      {note && <span className="small text-ink-faint">{note}</span>}
    </div>
  );
}

export function ModelTable({ rows, h }: { rows: ModelRow[]; h: { model: string; calls: string; success: string; backups: string; time: string; cost: string; empty: string } }) {
  if (!rows.length) return <p className="small text-ink-muted m-0">{h.empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse small">
        <thead>
          <tr>{[h.model, h.calls, h.success, h.backups, h.time, h.cost].map((x) => <th key={x} className="mn-label text-start py-2 pe-4">{x}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model} className="border-t border-line">
              <td className="py-2 pe-4" lang="en">{textModel(r.model).id === r.model ? textModel(r.model).name : r.model}<span className="text-ink-faint ms-2">{r.provider}</span></td>
              <td className="py-2 pe-4 data">{r.calls}</td>
              <td className="py-2 pe-4 data">{Math.round((r.ok / r.calls) * 100)}%</td>
              <td className="py-2 pe-4 data">{r.backups}</td>
              <td className="py-2 pe-4 data">{r.avgSeconds == null ? "–" : `${Math.round(r.avgSeconds)}s`}</td>
              <td className="py-2 pe-4 data">{usd(r.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
