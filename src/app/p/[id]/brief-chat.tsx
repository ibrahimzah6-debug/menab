"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconMic, IconPlus } from "@/components/icons";
import { MenabLoader } from "@/components/menab-loader";
import { browserClient } from "@/lib/supabase/client";
import { startWavRecorder, type WavRecorder } from "@/lib/wav-recorder";
import { chooseTextModel, prepareUpload } from "./actions";
import { ReplyFeedback } from "./reply-feedback";

type Msg = {
  id: string;
  role: "user" | "assistant";
  kind: "text" | "voice";
  content: string;
  audio_seconds: number | null;
  attachments?: { name: string; mime: string }[];
  steps?: { events: StepEvent[]; seconds: number; model: string } | null;
};

type StepEvent = { t: string; [k: string]: unknown };

type Copy = {
  placeholder: string;
  voice: string;
  stopSend: string;
  send: string;
  voiceNote: string;
  thinking: string;
  listening: string;
  start: string;
  micBlocked: string;
  attach: string;
  removeFile: string;
  model: string;
  photos: string;
  files: string;
  connectors: string;
  soon: string;
  recording: string;
  fields: Record<string, string>;
  rate: { good: string; bad: string; why: string; send: string; thanks: string };
  steps: {
    read: string;
    readFiles: string;
    readVoice: string;
    call: string;
    retry: string;
    switch: string;
    fields: string;
    path: string;
    save: string;
    slow: string;
    lost: string;
    memory: string;
    skip: string;
    stopped: string;
    summary: string;
    count: string;
    stop: string;
  };
};
const fillIn = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

type ModelOption = { id: string; name: string; price: string };
type Upload = { name: string; mime: string; path?: string; failed?: boolean };

const ArrowUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
const Stop = () => <span aria-hidden="true" className="block w-2.5 h-2.5 rounded-[2px] bg-current" />;
const Photo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
);
const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
);
const Plug = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" /></svg>
);

// One step of Menab's work in plain words.
function stepText(e: StepEvent, copy: Copy, paths: Record<string, string>) {
  const sep = typeof document !== "undefined" && document.documentElement.dir === "rtl" ? "، " : ", ";
  switch (e.t) {
    case "read":
      return e.voice ? copy.steps.readVoice : Number(e.files) > 0 ? fillIn(copy.steps.readFiles, { n: Number(e.files) }) : copy.steps.read;
    case "call":
      return fillIn(copy.steps.call, { model: String(e.model) });
    case "retry":
      return fillIn(copy.steps.retry, { model: String(e.model) });
    case "switch":
      return fillIn(copy.steps.switch, { from: String(e.from), to: String(e.to) });
    case "skip":
      return fillIn(copy.steps.skip, { from: String(e.from), to: String(e.to) });
    case "fields":
      return fillIn(copy.steps.fields, { fields: (e.keys as string[]).map((k) => copy.fields[k] ?? k).join(sep) });
    case "path":
      return fillIn(copy.steps.path, { path: paths[String(e.path)] ?? String(e.path) });
    case "memory":
      return fillIn(copy.steps.memory, { items: (e.items as string[]).join(sep) });
    case "save":
      return copy.steps.save;
    case "slow":
      return copy.steps.slow;
    default:
      return null;
  }
}

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted shrink-0" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}><path d="M3 4.5l3 3 3-3" /></svg>
);

// What Menab is doing, on one line whose words change; press it to see every step.
// After the reply it stays above the answer as a short summary that opens the same list.
function StepsLine({ events, live, summary, copy, paths }: { events: StepEvent[]; live: boolean; summary?: string; copy: Copy; paths: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const lines = events.map((e) => stepText(e, copy, paths)).filter((x): x is string => Boolean(x));
  const head = live ? lines[lines.length - 1] ?? copy.thinking : summary ?? fillIn(copy.steps.count, { n: lines.length });
  return (
    <div className="flex flex-col gap-2" role={live ? "status" : undefined} aria-live={live ? "polite" : undefined}>
      <button type="button" className="self-start flex items-center gap-2.5 small text-start text-ink-muted hover:text-ink" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {live ? <span className="mn-pulse shrink-0" aria-hidden="true" /> : <Check />}
        <span className={live ? "text-ink" : ""} dir="auto">{head}</span>
        {lines.length > 0 && <Chevron open={open} />}
      </button>
      {open && lines.length > 0 && (
        <ol className="m-0 ms-1.5 ps-4 border-s border-line list-none flex flex-col gap-1.5">
          {lines.map((x, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px] text-ink-muted" dir="auto">
              {live && i === lines.length - 1 ? <span className="mn-pulse shrink-0" aria-hidden="true" style={{ width: 8, height: 8 }} /> : <Check />}
              <span>{x}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

async function* readLines(res: Response) {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as StepEvent;
  }
  if (buffer.trim()) yield JSON.parse(buffer) as StepEvent;
}

async function upload(projectId: string, kind: "file" | "voice", blob: Blob, name: string) {
  const prep = await prepareUpload(projectId, kind, name, blob.type, blob.size);
  if (prep.error || !prep.path || !prep.token) throw new Error(prep.error ?? "Upload failed");
  const { error } = await browserClient().storage.from("media").uploadToSignedUrl(prep.path, prep.token, blob, { contentType: blob.type });
  if (error) throw new Error("Upload failed. Try again.");
  return prep.path;
}

// The brief chat. Messages scroll; the reply box stays at the bottom. Files on the left;
// model, voice and send on the right. Costs sit in the model list and button tooltips.
export function BriefChat({
  projectId,
  messages,
  copy,
  cost,
  canEdit,
  models,
  model,
  paths,
}: {
  paths: Record<string, string>;
  projectId: string;
  messages: Msg[];
  copy: Copy;
  cost: string;
  canEdit: boolean;
  models: ModelOption[];
  model: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [voice, setVoice] = useState<{ path: string; seconds: number } | undefined>();
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [busy, setBusy] = useState<"text" | "voice" | null>(null);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const stopRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [, start] = useTransition();
  const [rec, setRec] = useState<WavRecorder | null>(null);
  const [menu, setMenu] = useState<"plus" | "model" | null>(null);
  const [current, setCurrent] = useState(model);
  const endRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll only the messages, never the page around them.
    const list = endRef.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, pendingText, busy, steps.length]);

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []).slice(0, 5 - uploads.length);
    picked.forEach((f) => {
      setUploads((u) => [...u, { name: f.name, mime: f.type }]);
      upload(projectId, "file", f, f.name)
        .then((path) => setUploads((u) => u.map((x) => (x.name === f.name && !x.path ? { ...x, path } : x))))
        .catch((e) => {
          setError(e.message);
          setUploads((u) => u.map((x) => (x.name === f.name && !x.path ? { ...x, failed: true } : x)));
        });
    });
  };

  const send = () => {
    const value = text.trim();
    const ready = uploads.filter((u) => u.path) as Required<Pick<Upload, "path" | "name" | "mime">>[];
    if ((!value && !ready.length) || busy || uploads.some((u) => !u.path && !u.failed)) return;
    const sentUploads = uploads;
    const sentVoice = voice;
    setText("");
    setUploads([]);
    setVoice(undefined);
    setPendingText(value || ready.map((f) => f.name).join(", "));
    setBusy("text");
    setError(undefined);
    setSteps([]);
    const restore = (message: string) => {
      setError(message);
      setText(value);
      setUploads(sentUploads);
      setVoice(sentVoice);
    };
    const controller = new AbortController();
    stopRef.current = controller;
    const slow = setTimeout(() => setSteps((x) => [...x, { t: "slow" }]), 25_000);
    (async () => {
      let finished = false;
      try {
        const res = await fetch(`/p/${projectId}/brief`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value, files: ready.map((f) => ({ path: f.path, name: f.name, mime: f.mime })), voice: sentVoice }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(copy.steps.lost);
        for await (const e of readLines(res)) {
          if (e.t === "done") finished = true;
          else if (e.t === "error") {
            finished = true;
            restore(String(e.message));
          } else setSteps((x) => [...x.filter((y) => y.t !== "slow"), e]);
        }
        if (!finished) restore(copy.steps.lost);
      } catch (e) {
        if (controller.signal.aborted) restore(copy.steps.stopped);
        else restore(e instanceof Error && e.message ? e.message : copy.steps.lost);
      } finally {
        clearTimeout(slow);
        stopRef.current = null;
        setBusy(null);
        setPendingText(null);
        setSteps([]);
        start(() => router.refresh());
      }
    })();
  };

  const startRecording = async () => {
    setError(undefined);
    try {
      setRec(await startWavRecorder());
    } catch {
      setError(copy.micBlocked);
    }
  };

  // Stop, upload, and let the words stream into the reply box to check before sending.
  const stopRecording = async () => {
    if (!rec) return;
    const r = rec;
    setRec(null);
    setBusy("voice");
    setError(undefined);
    const before = text.trim();
    const controller = new AbortController();
    stopRef.current = controller;
    let heard = "";
    try {
      const { blob, seconds } = await r.stop();
      // Save a copy and turn it into text at the same time; short notes go straight to the
      // speech model without waiting for the copy.
      const saving = upload(projectId, "voice", blob, "voice-note.wav");
      saving.catch(() => {});
      const direct = blob.size < 4 * 1024 * 1024;
      const res = await fetch(`/p/${projectId}/voice`, {
        method: "POST",
        headers: { "Content-Type": direct ? "audio/wav" : "application/json" },
        body: direct ? blob : JSON.stringify({ path: await saving }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(copy.micBlocked);
      for await (const e of readLines(res)) {
        if (e.t === "text") {
          heard += String(e.d);
          setText(before ? `${before} ${heard.trimStart()}` : heard.trimStart());
        } else if (e.t === "error") throw new Error(String(e.message));
      }
      if (!heard.trim()) throw new Error(copy.micBlocked);
      setVoice({ path: await saving, seconds });
    } catch (e) {
      if (controller.signal.aborted) setText(before);
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      stopRef.current = null;
      setBusy(null);
    }
  };

  const iconBtn = "w-9 h-9 grid place-items-center rounded-full transition-colors disabled:opacity-40";
  const currentModel = models.find((m) => m.id === current) ?? models[0];
  const closeOnBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenu(null);
  };

  return (
    <section className="flex-1 min-w-0 min-h-0 bg-surface border border-line rounded-lg flex flex-col">
      <div className="relative flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6">
        {messages.length === 0 && !pendingText && <p className="body text-ink-muted m-0 max-w-[560px]">{copy.start}</p>}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="self-end max-w-[78%] bg-surface-raised border border-line rounded-lg px-4 py-3 flex flex-col gap-2">
              <p className="body m-0 whitespace-pre-wrap" dir="auto">{m.content}</p>
              {(m.kind === "voice" || (m.attachments?.length ?? 0) > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {m.kind === "voice" && (
                    <span className="mn-chip mn-chip--waiting">
                      <IconMic size={12} />
                      {copy.voiceNote}
                    </span>
                  )}
                  {m.attachments?.map((a, i) => (
                    <span key={i} className="mn-chip mn-chip--waiting max-w-[220px] truncate">{a.name}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={m.id} className="flex flex-col gap-2 max-w-[78%]">
              {m.steps?.events?.length ? (
                <StepsLine events={m.steps.events} live={false} summary={fillIn(copy.steps.summary, { s: m.steps.seconds, model: m.steps.model })} copy={copy} paths={paths} />
              ) : null}
              <p className="body m-0 whitespace-pre-wrap" dir="auto">{m.content}</p>
              {canEdit && <ReplyFeedback projectId={projectId} messageId={m.id} c={copy.rate} />}
            </div>
          ),
        )}
        {pendingText && (
          <div className="self-end max-w-[78%] bg-surface-raised border border-line rounded-lg px-4 py-3 opacity-70">
            <p className="body m-0 whitespace-pre-wrap" dir="auto">{pendingText}</p>
          </div>
        )}
        {busy === "text" && <StepsLine events={steps} live copy={copy} paths={paths} />}
        <div ref={endRef} />
      </div>

      {canEdit && (
        <div className="shrink-0 m-3 mt-0 border border-line-control rounded-xl bg-surface flex flex-col focus-within:border-ink transition-colors">
          {uploads.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-3">
              {uploads.map((f, i) => (
                <span key={i} className={`mn-chip ${f.failed ? "mn-chip--failed" : "mn-chip--ready"} max-w-[220px]`}>
                  {!f.path && !f.failed && <span className="mn-chip__icon" style={{ border: "1.5px solid var(--line-strong)", borderTopColor: "var(--ink)", borderRadius: "50%", width: 10, height: 10, animation: "mn-spin .9s linear infinite" }} aria-hidden="true" />}
                  <span className="truncate">{f.name}</span>
                  <button type="button" aria-label={`${copy.removeFile} ${f.name}`} className="text-ink-muted hover:text-ink" onClick={() => setUploads(uploads.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="small m-0 mx-3 mt-3 px-3 py-2 rounded-md bg-tint-2 text-ink" dir="auto">
              {error}
            </p>
          )}
          {rec ? (
            <div className="px-4 py-4 flex items-center gap-3" role="status">
              <span className="mn-pulse" aria-hidden="true" />
              <span className="small text-ink-muted">{copy.recording}</span>
            </div>
          ) : busy === "voice" && !text ? (
            <div className="px-4 py-4"><MenabLoader label={copy.listening} /></div>
          ) : (
            <textarea
              readOnly={busy === "voice"}
              rows={2}
              value={text}
              dir="auto"
              aria-label={copy.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={copy.placeholder}
              className="w-full resize-none bg-transparent border-0 outline-none text-ink body px-4 pt-3.5 pb-1 max-h-[200px]"
            />
          )}
          <div className="flex items-center gap-1 px-2 pb-2">
            <input ref={photoRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={fileRef} type="file" multiple accept="application/pdf" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

            {/* "+" menu */}
            <div className="relative" onBlur={closeOnBlur} onKeyDown={(e) => e.key === "Escape" && setMenu(null)}>
              <button type="button" className={`${iconBtn} text-ink-muted hover:bg-tint-2 hover:text-ink`} aria-label={copy.attach} aria-haspopup="menu" aria-expanded={menu === "plus"} title={copy.attach} disabled={Boolean(busy || rec)} onClick={() => setMenu(menu === "plus" ? null : "plus")}>
                <IconPlus size={18} />
              </button>
              {menu === "plus" && (
                <div role="menu" className="absolute z-30 bottom-full mb-2 start-0 w-[220px] bg-surface border border-line-strong rounded-md p-1" style={{ boxShadow: "var(--shadow-float)" }}>
                  <button role="menuitem" type="button" className="w-full flex items-center gap-2 px-2.5 h-9 rounded-sm small hover:bg-tint-2 text-start" onClick={() => { setMenu(null); photoRef.current?.click(); }}>
                    <Photo />{copy.photos}
                  </button>
                  <button role="menuitem" type="button" className="w-full flex items-center gap-2 px-2.5 h-9 rounded-sm small hover:bg-tint-2 text-start" onClick={() => { setMenu(null); fileRef.current?.click(); }}>
                    <FileIcon />{copy.files}
                  </button>
                  <div className="w-full flex items-center gap-2 px-2.5 h-9 rounded-sm small text-ink-faint" aria-disabled="true">
                    <Plug />{copy.connectors}<span className="ms-auto text-[11px]">{copy.soon}</span>
                  </div>
                </div>
              )}
            </div>
            <span className="grow" />

            {/* Model, chosen right here */}
            <div className="relative" onBlur={closeOnBlur} onKeyDown={(e) => e.key === "Escape" && setMenu(null)}>
              <button
                type="button"
                className="h-9 px-3 rounded-full small text-ink-muted hover:bg-tint-2 hover:text-ink flex items-center gap-1 whitespace-nowrap"
                aria-haspopup="listbox"
                aria-expanded={menu === "model"}
                aria-label={copy.model}
                onClick={() => setMenu(menu === "model" ? null : "model")}
              >
                <span lang="en">{currentModel?.name}</span>
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4.5l3 3 3-3" /></svg>
              </button>
              {menu === "model" && (
                <ul role="listbox" aria-label={copy.model} className="absolute z-30 bottom-full mb-2 end-0 w-[min(300px,85vw)] bg-surface border border-line-strong rounded-md p-1 m-0 list-none" style={{ boxShadow: "var(--shadow-float)" }}>
                  {models.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={m.id === current}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 h-10 rounded-sm text-start small ${m.id === current ? "bg-tint-3 font-medium" : "hover:bg-tint-2"}`}
                        onClick={() => {
                          setCurrent(m.id);
                          setMenu(null);
                          start(async () => {
                            await chooseTextModel(projectId, m.id);
                            router.refresh();
                          });
                        }}
                      >
                        <span lang="en">{m.name}</span>
                        <span className="text-[12px] text-ink-faint">{m.price}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {rec ? (
              <button type="button" className={`${iconBtn} bg-primary text-on-primary`} aria-label={copy.stopSend} title={copy.stopSend} onClick={stopRecording}>
                <Stop />
              </button>
            ) : (
              <button type="button" className={`${iconBtn} text-ink-muted hover:bg-tint-2 hover:text-ink`} aria-label={copy.voice} title={copy.voice} onClick={startRecording} disabled={Boolean(busy)}>
                <IconMic size={18} />
              </button>
            )}
            {!rec && busy && (
              <button type="button" className={`${iconBtn} bg-primary text-on-primary`} aria-label={copy.steps.stop} title={copy.steps.stop} onClick={() => stopRef.current?.abort()}>
                <Stop />
              </button>
            )}
            {!rec && !busy && (
              <button
                type="button"
                className={`${iconBtn} bg-primary text-on-primary`}
                aria-label={copy.send}
                title={`${copy.send} · ${cost}`}
                onClick={send}
                disabled={(!text.trim() && !uploads.some((u) => u.path)) || Boolean(busy) || uploads.some((u) => !u.path && !u.failed)}
              >
                <ArrowUp />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
