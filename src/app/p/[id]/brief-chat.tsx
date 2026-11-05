"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconMic, IconPlus } from "@/components/icons";
import { MenabLoader } from "@/components/menab-loader";
import { browserClient } from "@/lib/supabase/client";
import { startWavRecorder, type WavRecorder } from "@/lib/wav-recorder";
import { chooseTextModel, prepareUpload, sendBriefMessage, transcribeVoice } from "./actions";

type Msg = {
  id: string;
  role: "user" | "assistant";
  kind: "text" | "voice";
  content: string;
  audio_seconds: number | null;
  attachments?: { name: string; mime: string }[];
};

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
};

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
}: {
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
  }, [messages.length, pendingText, busy]);

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
    start(async () => {
      const res = await sendBriefMessage(projectId, {
        text: value,
        files: ready.map((f) => ({ path: f.path, name: f.name, mime: f.mime })),
        voice: sentVoice,
      });
      setError(res.error);
      if (res.error) {
        setText(value);
        setUploads(sentUploads);
        setVoice(sentVoice);
      }
      setBusy(null);
      setPendingText(null);
      router.refresh();
    });
  };

  const startRecording = async () => {
    setError(undefined);
    try {
      setRec(await startWavRecorder());
    } catch {
      setError(copy.micBlocked);
    }
  };

  // Stop, upload, and put the words in the reply box to check before sending.
  const stopRecording = async () => {
    if (!rec) return;
    const r = rec;
    setRec(null);
    setBusy("voice");
    try {
      const { blob, seconds } = await r.stop();
      const path = await upload(projectId, "voice", blob, "voice-note.wav");
      const res = await transcribeVoice(projectId, path);
      if (res.error || !res.text) throw new Error(res.error ?? copy.micBlocked);
      setText((t) => (t.trim() ? `${t.trim()} ${res.text}` : res.text!));
      setVoice({ path, seconds });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
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
            <p key={m.id} className="body m-0 whitespace-pre-wrap max-w-[78%]" dir="auto">{m.content}</p>
          ),
        )}
        {pendingText && (
          <div className="self-end max-w-[78%] bg-surface-raised border border-line rounded-lg px-4 py-3 opacity-70">
            <p className="body m-0 whitespace-pre-wrap" dir="auto">{pendingText}</p>
          </div>
        )}
        {busy === "text" && <MenabLoader label={copy.thinking} />}
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
          {rec ? (
            <div className="px-4 py-4 flex items-center gap-3" role="status">
              <span className="mn-pulse" aria-hidden="true" />
              <span className="small text-ink-muted">{copy.recording}</span>
            </div>
          ) : busy === "voice" ? (
            <div className="px-4 py-4"><MenabLoader label={copy.listening} /></div>
          ) : (
            <textarea
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
            {error && <p role="alert" className="small m-0 px-2 truncate">{error}</p>}
            <span className="grow" />

            {/* Model, chosen right here */}
            <div className="relative" onBlur={closeOnBlur} onKeyDown={(e) => e.key === "Escape" && setMenu(null)}>
              <button
                type="button"
                className="h-9 px-3 rounded-full small text-ink-muted hover:bg-tint-2 hover:text-ink flex items-center gap-1"
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
            {!rec && (
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
