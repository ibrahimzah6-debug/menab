"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MicButton } from "@/components/mic-button";
import { browserClient } from "@/lib/supabase/client";
import type { Tip } from "@/lib/step-tips";
import { prepareUpload, saveBriefIdea, saveOutputEdit, writeBriefDocuments } from "./actions";
import type { StepFile } from "./creative-run";

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
// Tips and the attach labels for a step's assistant box.
export type StepBox = { tips: Tip[]; attach: { add: string; remove: string; tips: string } };

// The assistant box of a step: tips for this step and video type, a text box with the mic, photos
// or PDFs to attach, and one button that shows the price before the AI changes the step.
export function ChangeBox({
  projectId,
  copy,
  cost,
  disabled,
  mic,
  tips = [],
  attach,
  onApply,
}: {
  projectId: string;
  copy: { label: string; placeholder: string; apply: string; working: string };
  cost: string;
  disabled?: boolean;
  mic?: { start: string; stop: string; working: string; blocked: string };
  tips?: Tip[];
  attach?: { add: string; remove: string; tips: string };
  // Another way to apply the change (the Creative stage streams its steps); default: stage 1 documents.
  onApply?: (text: string, files: StepFile[]) => Promise<{ error?: string }> | void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<StepFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const picker = useRef<HTMLInputElement>(null);
  const addText = (x: string) => setText((v) => (v.trim() ? `${v.trim()} ${x}` : x));
  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    const added: StepFile[] = [];
    for (const file of Array.from(list).slice(0, 5 - files.length)) {
      const prep = await prepareUpload(projectId, "file", file.name, file.type, file.size);
      if (!prep.path || !prep.token) {
        setError(prep.error);
        continue;
      }
      const { error: e } = await browserClient().storage.from("media").uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
      if (e) {
        setError(e.message);
        continue;
      }
      added.push({ path: prep.path, name: file.name, mime: file.type });
    }
    setFiles((f) => [...f, ...added]);
    setUploading(false);
  };
  const ready = Boolean(text.trim() || files.length);
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="change-box" className="mn-label">{copy.label}</label>
        {mic && <MicButton projectId={projectId} labels={mic} size={28} onText={addText} />}
      </div>
      {tips.length > 0 && attach && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={attach.tips}>
          {tips.map((x) => (
            <button
              key={x.label}
              type="button"
              className="mn-btn mn-btn--secondary mn-btn--sm"
              disabled={disabled || pending}
              onClick={() => {
                addText(x.text);
                if (x.file) picker.current?.click();
              }}
            >
              {x.file && <span aria-hidden="true">+ </span>}{x.label}
            </button>
          ))}
        </div>
      )}
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
      {attach && (
        <div className="flex flex-wrap items-center gap-1.5">
          {files.map((f) => (
            <span key={f.path} className="mn-chip max-w-full">
              <span className="truncate max-w-[180px]" dir="auto">{f.name}</span>
              <button type="button" aria-label={`${attach.remove}: ${f.name}`} title={attach.remove} onClick={() => setFiles((l) => l.filter((y) => y.path !== f.path))}>✕</button>
            </span>
          ))}
          {files.length < 5 && (
            <label className={`mn-btn mn-btn--ghost mn-btn--sm ${uploading || disabled || pending ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
              <span aria-hidden="true">+ </span>{uploading ? copy.working : attach.add}
              <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      )}
      {error && <p role="alert" className="small m-0">{error}</p>}
      <button
        type="button"
        className="mn-btn mn-btn--secondary mn-btn--sm justify-between w-full"
        disabled={disabled || pending || uploading || !ready}
        onClick={() => {
          const sent = files;
          start(async () => {
            const res = onApply ? await onApply(text, sent) : await writeBriefDocuments(projectId, text);
            setError(res?.error);
            if (!res?.error) {
              setText("");
              setFiles([]);
            }
            if (!onApply) router.refresh();
          });
        }}
      >
        <span className={pending ? "mn-dots" : ""}>{pending ? copy.working : copy.apply}</span>
        <span className="mn-btn__cost">{cost}</span>
      </button>
    </div>
  );
}
