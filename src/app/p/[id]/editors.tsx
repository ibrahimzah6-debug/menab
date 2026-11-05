"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MicButton } from "@/components/mic-button";
import { saveBriefIdea, saveOutputEdit, writeBriefDocuments } from "./actions";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

type EditCopy = { edit: string; save: string; cancel: string; saved: string; oneLine: string };

// A document with an Edit button. Editing saves a new version; the old one is kept.
export function EditableDoc({
  projectId,
  number,
  content,
  labels,
  copy,
  canEdit,
  children,
}: {
  projectId: string;
  number: number;
  content: Json;
  labels: Record<string, string>;
  copy: EditCopy;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Json>(content);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();

  if (!editing) {
    return (
      <div className="flex flex-col gap-4">
        {canEdit && content && (
          <div className="flex justify-end -mt-2">
            <button
              type="button"
              className="mn-btn mn-btn--secondary mn-btn--sm"
              onClick={() => {
                setDraft(structuredClone(content));
                setEditing(true);
              }}
            >
              {copy.edit}
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field value={draft} onChange={setDraft} labels={labels} copy={copy} />
      {error && <p role="alert" className="small m-0">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={() => setEditing(false)} disabled={pending}>
          {copy.cancel}
        </button>
        <button
          type="button"
          className="mn-btn mn-btn--primary mn-btn--sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveOutputEdit(projectId, number, draft);
              setError(res.error);
              if (!res.error) {
                setEditing(false);
                router.refresh();
              }
            })
          }
        >
          {copy.save}
        </button>
      </div>
    </div>
  );
}

// Builds an editor from the document's own shape: text boxes for text, one line per item
// for lists, and small tables for lists of rows.
function Field({ value, onChange, labels, copy, name }: { value: Json; onChange: (v: Json) => void; labels: Record<string, string>; copy: EditCopy; name?: string }) {
  if (typeof value === "string") {
    return (
      <textarea
        className="mn-input"
        dir="auto"
        style={{ height: value.length > 120 ? 120 : 64, paddingTop: 8, resize: "vertical" }}
        value={value}
        aria-label={name ? labels[name] ?? name : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (typeof value === "number") {
    return <input className="mn-input" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={name} />;
  }
  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === "string")) {
      return (
        <div className="flex flex-col gap-1">
          <textarea
            className="mn-input"
            dir="auto"
            style={{ height: Math.max(64, value.length * 26 + 20), paddingTop: 8, resize: "vertical" }}
            value={(value as string[]).join("\n")}
            onChange={(e) => onChange(e.target.value.split("\n"))}
            aria-label={name}
          />
          <span className="text-[12px] text-ink-faint">{copy.oneLine}</span>
        </div>
      );
    }
    const rows = value as { [k: string]: Json }[];
    const cols = rows.length ? Object.keys(rows[0]) : [];
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse small">
          <thead>
            <tr>{cols.map((c) => <th key={c} className="mn-label text-start py-1 pe-2">{labels[c] ?? c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c} className="py-1 pe-2 align-top">
                    <input
                      className="mn-input"
                      dir="auto"
                      value={String(r[c] ?? "")}
                      aria-label={`${labels[c] ?? c} ${i + 1}`}
                      onChange={(e) => {
                        const next = rows.map((x) => ({ ...x }));
                        next[i][c] = typeof r[c] === "number" ? Number(e.target.value) : e.target.value;
                        onChange(next);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="flex flex-col gap-3">
        {Object.entries(value).map(([k, v]) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="mn-label">{labels[k] ?? k}</span>
            <Field value={v} name={k} labels={labels} copy={copy} onChange={(nv) => onChange({ ...value, [k]: nv })} />
          </label>
        ))}
      </div>
    );
  }
  return null;
}

// Edit the idea and story beats directly on the brief panel.
export function BriefIdeaEditor({
  projectId,
  logline,
  story,
  copy,
}: {
  projectId: string;
  logline: string;
  story: string[];
  copy: EditCopy & { idea: string; story: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(logline);
  const [b, setB] = useState(story.join("\n"));
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button type="button" className="text-[12px] text-ink-muted underline self-start" onClick={() => setOpen(true)}>
        {copy.edit}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="mn-label">{copy.idea}</span>
        <textarea className="mn-input" dir="auto" style={{ height: 84, paddingTop: 8 }} value={a} onChange={(e) => setA(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="mn-label">{copy.story}</span>
        <textarea className="mn-input" dir="auto" style={{ height: 110, paddingTop: 8 }} value={b} onChange={(e) => setB(e.target.value)} />
        <span className="text-[12px] text-ink-faint">{copy.oneLine}</span>
      </label>
      <div className="flex gap-2 justify-end">
        <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={() => setOpen(false)} disabled={pending}>{copy.cancel}</button>
        <button
          type="button"
          className="mn-btn mn-btn--primary mn-btn--sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await saveBriefIdea(projectId, a, b.split("\n"));
              setOpen(false);
              router.refresh();
            })
          }
        >
          {copy.save}
        </button>
      </div>
    </div>
  );
}

// "Tell Menab what to change": revises the documents from one instruction, cost shown first.
export function ChangeBox({
  projectId,
  copy,
  cost,
  disabled,
  mic,
  onApply,
}: {
  projectId: string;
  copy: { label: string; placeholder: string; apply: string; working: string };
  cost: string;
  disabled?: boolean;
  mic?: { start: string; stop: string; working: string; blocked: string };
  // Another way to apply the change (the Creative stage streams its steps); default: stage 1 documents.
  onApply?: (text: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="change-box" className="mn-label">{copy.label}</label>
        {mic && <MicButton projectId={projectId} labels={mic} size={28} onText={(t) => setText((x) => (x.trim() ? `${x.trim()} ${t}` : t))} />}
      </div>
      <textarea
        id="change-box"
        dir="auto"
        className="w-full box-border resize-y border border-line-control rounded-md p-2.5 bg-surface text-ink text-[13px] leading-[20px]"
        rows={3}
        placeholder={copy.placeholder}
        value={text}
        disabled={disabled || pending}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p role="alert" className="small m-0">{error}</p>}
      <button
        type="button"
        className="mn-btn mn-btn--secondary mn-btn--sm justify-between w-full"
        disabled={disabled || pending || !text.trim()}
        onClick={() => {
          setTimeout(() => router.refresh(), 1500);
          start(async () => {
            const res = onApply ? await onApply(text) : await writeBriefDocuments(projectId, text);
            setError(res.error);
            if (!res.error) setText("");
            router.refresh();
          });
        }}
      >
        <span className={pending ? "mn-dots" : ""}>{pending ? copy.working : copy.apply}</span>
        <span className="mn-btn__cost">{cost}</span>
      </button>
    </div>
  );
}
