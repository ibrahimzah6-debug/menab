"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconMic, IconPlus } from "@/components/icons";
import { MenabLoader } from "@/components/menab-loader";
import { chooseTextModel, sendBriefMessage, sendVoiceNote } from "./actions";

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
};

type ModelOption = { id: string; name: string; price: string };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const ArrowUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
const Stop = () => <span aria-hidden="true" className="block w-2.5 h-2.5 rounded-[2px] bg-current" />;

// The brief chat. A quiet composer like Claude's: files on the left; model, voice and send on the right.
// Costs sit in each button's tooltip and in the model list, so the box stays clean.
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
  const [files, setFiles] = useState<File[]>([]);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [busy, setBusy] = useState<"text" | "voice" | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [, start] = useTransition();
  const [rec, setRec] = useState<{ recorder: MediaRecorder; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [modelOpen, setModelOpen] = useState(false);
  const [current, setCurrent] = useState(model);
  const chunks = useRef<Blob[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pendingText, busy]);
  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => setElapsed((Date.now() - rec.started) / 1000), 250);
    return () => clearInterval(id);
  }, [rec]);

  const send = () => {
    const value = text.trim();
    if ((!value && !files.length) || busy) return;
    const form = new FormData();
    form.append("text", value);
    files.forEach((f) => form.append("files", f));
    const sentFiles = files;
    setText("");
    setFiles([]);
    setPendingText(value || sentFiles.map((f) => f.name).join(", "));
    setBusy("text");
    setError(undefined);
    start(async () => {
      const res = await sendBriefMessage(projectId, form);
      setError(res.error);
      if (res.error) {
        setText(value);
        setFiles(sentFiles);
      }
      setBusy(null);
      setPendingText(null);
      router.refresh();
    });
  };

  const startRecording = async () => {
    setError(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recorder.start();
      setElapsed(0);
      setRec({ recorder, started: Date.now() });
    } catch {
      setError(copy.micBlocked);
    }
  };

  const stopAndSend = () => {
    if (!rec) return;
    const { recorder, started } = rec;
    const seconds = (Date.now() - started) / 1000;
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "voice-note");
      form.append("seconds", String(seconds));
      setBusy("voice");
      start(async () => {
        const res = await sendVoiceNote(projectId, form);
        setError(res.error);
        setBusy(null);
        router.refresh();
      });
    };
    recorder.stop();
    setRec(null);
  };

  const iconBtn = "w-9 h-9 grid place-items-center rounded-full transition-colors disabled:opacity-40";
  const currentModel = models.find((m) => m.id === current) ?? models[0];

  return (
    <section className="flex-1 min-w-0 bg-surface border border-line rounded-lg flex flex-col min-h-[560px]">
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
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
                      {m.audio_seconds ? mmss(m.audio_seconds) : copy.voiceNote}
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
        {busy && <MenabLoader size={18} label={busy === "voice" ? copy.listening : copy.thinking} />}
        <div ref={endRef} />
      </div>

      {canEdit && (
        <div className="m-3 mt-0 border border-line-control rounded-xl bg-surface flex flex-col focus-within:border-ink transition-colors">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-3">
              {files.map((f, i) => (
                <span key={i} className="mn-chip mn-chip--ready max-w-[220px]">
                  <span className="truncate">{f.name}</span>
                  <button type="button" aria-label={`${copy.removeFile} ${f.name}`} className="text-ink-muted hover:text-ink" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {rec ? (
            <div className="px-4 py-4 flex items-center gap-3" role="status">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" aria-hidden="true" />
              <span className="data">{mmss(elapsed)}</span>
            </div>
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
              className="w-full resize-none bg-transparent border-0 outline-none text-ink body px-4 pt-3.5 pb-1"
            />
          )}
          <div className="flex items-center gap-1 px-2 pb-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={(e) => {
                setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 5));
                e.target.value = "";
              }}
            />
            <button type="button" className={`${iconBtn} text-ink-muted hover:bg-tint-2 hover:text-ink`} aria-label={copy.attach} title={copy.attach} disabled={Boolean(busy || rec)} onClick={() => fileRef.current?.click()}>
              <IconPlus size={18} />
            </button>
            {error && <p role="alert" className="small m-0 px-2">{error}</p>}
            <span className="grow" />

            {/* Model, chosen right here */}
            <div
              className="relative"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setModelOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setModelOpen(false);
              }}
            >
              <button
                type="button"
                className="h-9 px-3 rounded-full small text-ink-muted hover:bg-tint-2 hover:text-ink flex items-center gap-1"
                aria-haspopup="listbox"
                aria-expanded={modelOpen}
                aria-label={copy.model}
                onClick={() => setModelOpen((v) => !v)}
              >
                <span lang="en">{currentModel?.name}</span>
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4.5l3 3 3-3" /></svg>
              </button>
              {modelOpen && (
                <ul role="listbox" aria-label={copy.model} className="absolute z-30 bottom-full mb-2 end-0 w-[280px] bg-surface border border-line-strong rounded-md p-1 m-0 list-none" style={{ boxShadow: "var(--shadow-float)" }}>
                  {models.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={m.id === current}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 h-10 rounded-sm text-start small ${m.id === current ? "bg-tint-3 font-medium" : "hover:bg-tint-2"}`}
                        onClick={() => {
                          setCurrent(m.id);
                          setModelOpen(false);
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
              <button type="button" className={`${iconBtn} bg-primary text-on-primary`} aria-label={copy.stopSend} title={copy.stopSend} onClick={stopAndSend}>
                <Stop />
              </button>
            ) : (
              <button type="button" className={`${iconBtn} text-ink-muted hover:bg-tint-2 hover:text-ink`} aria-label={copy.voice} title={`${copy.voice} · ${cost}`} onClick={startRecording} disabled={Boolean(busy)}>
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
                disabled={(!text.trim() && !files.length) || Boolean(busy)}
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
