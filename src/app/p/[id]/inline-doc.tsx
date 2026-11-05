"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StageOneDocs } from "@/lib/ai/brain";
import { saveBriefIdea, saveOutputEdit } from "./actions";

type DocCopy = {
  insight: string;
  keyMessage: string;
  tone: string;
  platforms: string;
  deliverables: string;
  deliverable: string;
  duration: string;
  ratio: string;
  platform: string;
  aiScenes: string;
  shootScenes: string;
  costRange: string;
  timeRange: string;
  milestones: string;
  from: string;
  to: string;
  phase: string;
  phases: { pre: string; production: string; post: string };
  kickoff: string;
  notWritten: string;
  failed: string;
};

// Text that looks like normal text and becomes editable when clicked. Changes are saved
// when you click away, as a new version; the earlier version is kept.
export function InlineText({
  value,
  onCommit,
  editable,
  className = "",
  multiline = true,
  label,
}: {
  value: string;
  onCommit: (v: string) => void;
  editable: boolean;
  className?: string;
  multiline?: boolean;
  label: string;
}) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [v]);
  if (!editable) return <span className={`whitespace-pre-wrap ${className}`} dir="auto">{value}</span>;
  return (
    <textarea
      ref={ref}
      rows={1}
      dir="auto"
      aria-label={label}
      value={v}
      onChange={(e) => setV(multiline ? e.target.value : e.target.value.replace(/\n/g, " "))}
      onBlur={() => {
        if (v.trim() !== value.trim()) onCommit(v);
      }}
      className={`w-full resize-none overflow-hidden bg-transparent border-0 rounded-sm px-1 -mx-1 outline-none hover:bg-tint-1 focus:bg-tint-2 focus:ring-1 focus:ring-line-strong text-inherit ${className}`}
      style={{ font: "inherit", color: "inherit" }}
    />
  );
}

function useSave(projectId: string, number: number) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const save = (content: unknown) =>
    start(async () => {
      const res = await saveOutputEdit(projectId, number, content);
      setNote(res.error);
      router.refresh();
    });
  return { pending, note, save };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 items-start">
      <span className="small text-ink-muted pt-0.5">{label}</span>
      <div className="small">{children}</div>
    </div>
  );
}

export function InlineDoc({
  projectId,
  n,
  content,
  d,
  editable,
  savedNote,
}: {
  projectId: string;
  n: number;
  content: unknown;
  d: DocCopy;
  editable: boolean;
  savedNote: string;
}) {
  const { pending, note, save } = useSave(projectId, n);
  const status = (pending || note) && <p className="text-[12px] text-ink-faint m-0" role="status">{pending ? savedNote : note}</p>;

  if (n === 3) {
    const c = content as StageOneDocs["summary"];
    const set = (patch: Partial<typeof c>) => save({ ...c, ...patch });
    return (
      <div className="flex flex-col gap-3 max-w-[760px]">
        <h2 className="h3 m-0"><InlineText label={d.insight} value={c.title} editable={editable} multiline={false} onCommit={(v) => set({ title: v })} /></h2>
        {c.paragraphs.map((x, i) => (
          <div key={i} className="body mn-prose">
            <InlineText label={`${i + 1}`} value={x} editable={editable} onCommit={(v) => set({ paragraphs: c.paragraphs.map((y, j) => (j === i ? v : y)) })} />
          </div>
        ))}
        {status}
      </div>
    );
  }
  if (n === 4) {
    const c = content as StageOneDocs["strategy"];
    const set = (patch: Partial<typeof c>) => save({ ...c, ...patch });
    return (
      <div className="flex flex-col gap-4 max-w-[860px]">
        <Row label={d.insight}><InlineText label={d.insight} value={c.insight} editable={editable} onCommit={(v) => set({ insight: v })} /></Row>
        <Row label={d.keyMessage}><InlineText label={d.keyMessage} value={c.key_message} editable={editable} onCommit={(v) => set({ key_message: v })} /></Row>
        <Row label={d.tone}><InlineText label={d.tone} value={c.tone} editable={editable} onCommit={(v) => set({ tone: v })} /></Row>
        <Row label={d.platforms}><InlineText label={d.platforms} value={c.platforms.join(", ")} editable={editable} multiline={false} onCommit={(v) => set({ platforms: v.split(",").map((x) => x.trim()).filter(Boolean) })} /></Row>
        <div>
          <h3 className="mn-label m-0 mb-2">{d.deliverables}</h3>
          <table className="w-full border-collapse small">
            <thead>
              <tr>{[d.deliverable, d.duration, d.ratio, d.platform].map((h) => <th key={h} className="mn-label text-start py-2 pe-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {c.deliverables.map((x, i) => {
                const setRow = (patch: Partial<typeof x>) => set({ deliverables: c.deliverables.map((y, j) => (j === i ? { ...y, ...patch } : y)) });
                return (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="py-2 pe-3"><InlineText label={d.deliverable} value={x.name} editable={editable} multiline={false} onCommit={(v) => setRow({ name: v })} /></td>
                    <td className="py-2 pe-3 data"><InlineText label={d.duration} value={String(x.duration_seconds)} editable={editable} multiline={false} onCommit={(v) => setRow({ duration_seconds: Number(v.replace(/[^0-9.]/g, "")) || x.duration_seconds })} /></td>
                    <td className="py-2 pe-3 data"><InlineText label={d.ratio} value={x.ratio} editable={editable} multiline={false} onCommit={(v) => setRow({ ratio: v })} /></td>
                    <td className="py-2 pe-3"><InlineText label={d.platform} value={x.platform} editable={editable} multiline={false} onCommit={(v) => setRow({ platform: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {status}
      </div>
    );
  }
  if (n === 5) {
    const c = content as StageOneDocs["pathway"];
    const set = (patch: Partial<typeof c>) => save({ ...c, ...patch });
    return (
      <div className="flex flex-col gap-2 max-w-[860px]">
        <div className="body mb-2"><InlineText label={d.insight} value={c.reason} editable={editable} onCommit={(v) => set({ reason: v })} /></div>
        <Row label={d.aiScenes}><InlineText label={d.aiScenes} value={c.ai_scenes.join("\n")} editable={editable} onCommit={(v) => set({ ai_scenes: v.split("\n").map((x) => x.trim()).filter(Boolean) })} /></Row>
        <Row label={d.shootScenes}><InlineText label={d.shootScenes} value={c.shoot_scenes.join("\n")} editable={editable} onCommit={(v) => set({ shoot_scenes: v.split("\n").map((x) => x.trim()).filter(Boolean) })} /></Row>
        <Row label={d.costRange}><InlineText label={d.costRange} value={c.cost_range} editable={editable} onCommit={(v) => set({ cost_range: v })} /></Row>
        <Row label={d.timeRange}><InlineText label={d.timeRange} value={c.time_range} editable={editable} onCommit={(v) => set({ time_range: v })} /></Row>
        {status}
      </div>
    );
  }
  if (n === 6) {
    const c = content as { cps: StageOneDocs["cps"]; kickoff_notes: string[] };
    const setMs = (i: number, patch: Partial<StageOneDocs["cps"]["milestones"][number]>) =>
      save({ ...c, cps: { ...c.cps, milestones: c.cps.milestones.map((y, j) => (j === i ? { ...y, ...patch } : y)) } });
    return (
      <div className="flex flex-col gap-4">
        <table className="w-full border-collapse small">
          <thead>
            <tr>{[d.milestones, d.from, d.to, d.phase].map((h) => <th key={h} className="mn-label text-start py-2 pe-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {c.cps.milestones.map((m, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="py-2 pe-3"><InlineText label={d.milestones} value={m.name} editable={editable} multiline={false} onCommit={(v) => setMs(i, { name: v })} /></td>
                <td className="py-2 pe-3 data" dir="ltr"><InlineText label={d.from} value={m.start} editable={editable} multiline={false} onCommit={(v) => setMs(i, { start: v })} /></td>
                <td className="py-2 pe-3 data" dir="ltr"><InlineText label={d.to} value={m.end} editable={editable} multiline={false} onCommit={(v) => setMs(i, { end: v })} /></td>
                <td className="py-2 pe-3"><span className="mn-chip mn-chip--waiting">{d.phases[m.phase]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="small text-ink-muted">
          <InlineText label={d.kickoff} value={c.cps.note} editable={editable} onCommit={(v) => save({ ...c, cps: { ...c.cps, note: v } })} />
        </div>
        {c.kickoff_notes.length > 0 && (
          <div>
            <h3 className="mn-label m-0 mb-2">{d.kickoff}</h3>
            <div className="body">
              <InlineText label={d.kickoff} value={c.kickoff_notes.join("\n")} editable={editable} onCommit={(v) => save({ ...c, kickoff_notes: v.split("\n").map((x) => x.trim()).filter(Boolean) })} />
            </div>
          </div>
        )}
        {status}
      </div>
    );
  }
  return null;
}

// The idea and story beats on the brief panel, edited in place.
export function InlineIdea({
  projectId,
  logline,
  story,
  editable,
  labels,
}: {
  projectId: string;
  logline: string;
  story: string[];
  editable: boolean;
  labels: { idea: string; story: string };
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const commit = (a: string, b: string[]) =>
    start(async () => {
      await saveBriefIdea(projectId, a, b);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="body font-medium">
        <InlineText label={labels.idea} value={logline} editable={editable} onCommit={(v) => commit(v, story)} />
      </div>
      {story.length > 0 && (
        <div className="small">
          <InlineText label={labels.story} value={story.map((x, i) => `${i + 1}. ${x}`).join("\n")} editable={editable} onCommit={(v) => commit(logline, v.split("\n").map((x) => x.replace(/^\s*\d+[.)-]\s*/, "")))} />
        </div>
      )}
    </div>
  );
}

// The main line of a card on the board, edited in place: the idea, the summary's opening,
// the key message or the reason for the path. Other details open on the page.
export function BoardCardText({
  projectId,
  n,
  content,
  logline,
  story,
  fallback,
  editable,
  label,
}: {
  projectId: string;
  n: number;
  content: unknown;
  logline: string;
  story: string[];
  fallback: string;
  editable: boolean;
  label: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const { save } = useSave(projectId, n);
  const c = (content ?? {}) as Record<string, unknown>;
  let value = fallback;
  let commit: ((v: string) => void) | null = null;
  if (n === 1 && logline) {
    value = logline;
    commit = (v) =>
      start(async () => {
        await saveBriefIdea(projectId, v, story);
        router.refresh();
      });
  } else if (n === 3 && Array.isArray(c.paragraphs)) {
    const paragraphs = c.paragraphs as string[];
    value = paragraphs[0] ?? "";
    commit = (v) => save({ ...c, paragraphs: [v, ...paragraphs.slice(1)] });
  } else if (n === 4 && typeof c.key_message === "string") {
    value = c.key_message;
    commit = (v) => save({ ...c, key_message: v });
  } else if (n === 5 && typeof c.reason === "string") {
    value = c.reason;
    commit = (v) => save({ ...c, reason: v });
  }
  return <InlineText label={label} value={value} editable={editable && commit !== null} onCommit={(v) => commit?.(v)} />;
}
