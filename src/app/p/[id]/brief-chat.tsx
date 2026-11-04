"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconMic } from "@/components/icons";
import { sendBriefMessage, sendVoiceNote } from "./actions";

type Msg = { id: string; role: "user" | "assistant"; kind: "text" | "voice"; content: string; audio_seconds: number | null };

type Copy = {
  reply: string;
  placeholder: string;
  voice: string;
  stopSend: string;
  recording: string;
  send: string;
  ai: string;
  voiceNote: string;
  thinking: string;
  listening: string;
  start: string;
  micBlocked: string;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function BriefChat({
  projectId,
  messages,
  copy,
  cost,
  canEdit,
}: {
  projectId: string;
  messages: Msg[];
  copy: Copy;
  cost: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [busy, setBusy] = useState<"text" | "voice" | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [, start] = useTransition();
  const [rec, setRec] = useState<{ recorder: MediaRecorder; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

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
    if (!value || busy) return;
    setText("");
    setPendingText(value);
    setBusy("text");
    setError(undefined);
    start(async () => {
      const res = await sendBriefMessage(projectId, value);
      setError(res.error);
      if (res.error) setText(value);
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
      recorder.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
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

  return (
    <section className="flex-1 min-w-0 bg-surface border border-line rounded-lg flex flex-col min-h-[560px]">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {messages.length === 0 && !pendingText && (
          <p className="body text-ink-muted m-0 max-w-[560px]">{copy.start}</p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="self-end max-w-[78%] bg-surface-raised border border-line rounded-lg px-4 py-3">
              <p className="body m-0 whitespace-pre-wrap" dir="auto">{m.content}</p>
              {m.kind === "voice" && (
                <span className="mn-label mt-2 block">
                  {copy.voiceNote}
                  {m.audio_seconds ? ` · ${mmss(m.audio_seconds)}` : ""}
                </span>
              )}
            </div>
          ) : (
            <div key={m.id} className="max-w-[78%] flex flex-col gap-1">
              <span className="mn-label">{copy.ai}</span>
              <p className="body m-0 whitespace-pre-wrap" dir="auto">{m.content}</p>
            </div>
          ),
        )}
        {pendingText && (
          <div className="self-end max-w-[78%] bg-surface-raised border border-line rounded-lg px-4 py-3 opacity-70">
            <p className="body m-0 whitespace-pre-wrap" dir="auto">{pendingText}</p>
          </div>
        )}
        {busy && (
          <p className="small text-ink-muted m-0 flex items-center gap-2" role="status">
            <span className="mn-chip mn-chip--generating"><span className="mn-chip__icon" aria-hidden="true" />{busy === "voice" ? copy.listening : copy.thinking}</span>
          </p>
        )}
        <div ref={endRef} />
      </div>

      {canEdit && (
        <div className="m-3 mt-0 border border-line-control rounded-lg p-3 flex flex-col gap-2">
          <label htmlFor="brief-reply" className="mn-label">{copy.reply}</label>
          <textarea
            id="brief-reply"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={copy.placeholder}
            dir="auto"
            className="w-full resize-none bg-transparent border-0 outline-none text-ink body p-0"
            disabled={Boolean(rec)}
          />
          <div className="flex items-center gap-2 flex-wrap">
            {rec ? (
              <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm" onClick={stopAndSend}>
                <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-ink" />
                {copy.stopSend} · <span className="data">{mmss(elapsed)}</span>
              </button>
            ) : (
              <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm" onClick={startRecording} disabled={Boolean(busy)}>
                <IconMic size={16} />
                {copy.voice}
                <span className="mn-btn__cost">{cost}</span>
              </button>
            )}
            <span className="grow" />
            {error && <p role="alert" className="small m-0">{error}</p>}
            <button type="button" className="mn-btn mn-btn--primary mn-btn--sm" onClick={send} disabled={!text.trim() || Boolean(busy) || Boolean(rec)}>
              {copy.send}
              <span className="mn-btn__cost">{cost}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
