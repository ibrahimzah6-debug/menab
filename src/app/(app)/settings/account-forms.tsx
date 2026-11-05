"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/components/menus";
import { setLocale } from "@/lib/i18n/actions";
import { browserClient } from "@/lib/supabase/client";
import { changePassword, prepareAvatarUpload, renameWorkspace, saveProfile, setAvatar } from "./actions";

type C = {
  photo: string;
  changePhoto: string;
  removePhoto: string;
  fullName: string;
  newPassword: string;
  passwordNote: string;
  changePassword: string;
  passwordSaved: string;
  save: string;
  saving: string;
  saved: string;
};

export function ProfileForm({ name, initial, photoUrl, c }: { name: string; initial: string; photoUrl?: string; c: C }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const [preview, setPreview] = useState<string | undefined>(photoUrl);
  const ref = useRef<HTMLInputElement>(null);

  const upload = (file?: File) => {
    if (!file) return;
    setNote(undefined);
    start(async () => {
      const prep = await prepareAvatarUpload(file.type, file.size);
      if (prep.error || !prep.path || !prep.token) return setNote(prep.error);
      const { error } = await browserClient().storage.from("media").uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
      if (error) return setNote("Upload failed. Try again.");
      const res = await setAvatar(prep.path);
      if (res.error) return setNote(res.error);
      setPreview(URL.createObjectURL(file));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-tint-3 grid place-items-center overflow-hidden text-[22px] font-medium shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt={c.photo} className="w-full h-full object-cover" /> : initial}
        </div>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm" disabled={pending} onClick={() => ref.current?.click()}>{c.changePhoto}</button>
        {preview && (
          <button type="button" className="small underline text-ink-muted hover:text-ink" disabled={pending} onClick={() => start(async () => { await setAvatar(null); setPreview(undefined); router.refresh(); })}>
            {c.removePhoto}
          </button>
        )}
      </div>
      <form
        className="flex flex-col gap-1.5 max-w-[420px]"
        action={(f) => start(async () => { const r = await saveProfile(String(f.get("name") ?? "")); setNote(r.error ?? c.saved); router.refresh(); })}
      >
        <label className="mn-label" htmlFor="full-name">{c.fullName}</label>
        <div className="flex gap-2">
          <input id="full-name" name="name" defaultValue={name} dir="auto" maxLength={120} className="mn-input grow" />
          <button className="mn-btn mn-btn--primary" disabled={pending}>{pending ? c.saving : c.save}</button>
        </div>
      </form>
      {note && <p className="small m-0" role="status">{note}</p>}
    </div>
  );
}

export function PasswordForm({ c }: { c: C }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  return (
    <form
      className="flex flex-col gap-1.5 max-w-[420px]"
      action={(f) =>
        start(async () => {
          const r = await changePassword(String(f.get("password") ?? ""));
          setNote(r.error ?? c.passwordSaved);
        })
      }
    >
      <label className="mn-label" htmlFor="new-password">{c.newPassword}</label>
      <div className="flex gap-2">
        <input id="new-password" name="password" type="password" minLength={8} required autoComplete="new-password" className="mn-input grow" dir="ltr" />
        <button className="mn-btn mn-btn--secondary" disabled={pending}>{c.changePassword}</button>
      </div>
      <span className="text-[12px] text-ink-faint">{c.passwordNote}</span>
      {note && <p className="small m-0" role="status">{note}</p>}
    </form>
  );
}

export function WorkspaceForm({ name, canEdit, c }: { name: string; canEdit: boolean; c: C & { workspaceName: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  return (
    <form
      className="flex flex-col gap-1.5 max-w-[420px]"
      action={(f) => start(async () => { const r = await renameWorkspace(String(f.get("name") ?? "")); setNote(r.error ?? c.saved); router.refresh(); })}
    >
      <label className="mn-label" htmlFor="ws-name">{c.workspaceName}</label>
      <div className="flex gap-2">
        <input id="ws-name" name="name" defaultValue={name} dir="auto" maxLength={120} disabled={!canEdit} className="mn-input grow" />
        {canEdit && <button className="mn-btn mn-btn--primary" disabled={pending}>{pending ? c.saving : c.save}</button>}
      </div>
      {note && <p className="small m-0" role="status">{note}</p>}
    </form>
  );
}

// Every language in one list. Ready languages switch at once; one still being prepared
// takes about a minute the first time.
export function LanguageList({ current, label, preparing }: { current: string; label: string; preparing: string }) {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2" role="radiogroup" aria-label={label} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {LANGUAGES.map((l) => {
          const on = current === l.code;
          return (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              lang={l.code}
              onClick={() => {
                if (on) return;
                setPicked(l.code);
                setError(undefined);
                start(async () => {
                  const r = await setLocale(l.code);
                  if (r.error) setError(r.error);
                  router.refresh();
                });
              }}
              className={`h-11 px-3 rounded-md border flex items-center gap-2 text-start ${on ? "border-ink bg-tint-2 font-medium" : "border-line hover:border-line-strong"}`}
            >
              <span className="grow truncate">{l.name}</span>
              <span className="mn-label" lang="en">{l.code.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
      {pending && picked && <p className="small text-ink-muted m-0" role="status">{preparing}</p>}
      {error && <p className="small m-0" role="alert">{error}</p>}
    </div>
  );
}
