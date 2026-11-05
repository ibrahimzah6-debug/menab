"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import { IconCheckSmall, IconGlobe, IconLogout, IconSettings } from "./icons";

// Languages in the menu. English and Arabic are complete; the others are planned and shown as coming soon.
// English and Arabic are written by hand; the others are translated by Gemini the first time
// someone picks them (see src/lib/i18n/translate.ts).
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
  { code: "am", name: "አማርኛ" },
  { code: "ur", name: "اردو" },
  { code: "hi", name: "हिन्दी" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "tr", name: "Türkçe" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "zh", name: "中文" },
];

function usePopup() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  const props = {
    ref,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    },
    onBlur: (e: React.FocusEvent) => {
      if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
    },
  };
  return { open, setOpen, props };
}

const popup = "absolute z-40 bg-surface border border-line-strong rounded-md p-1 m-0 list-none";

export function LanguageMenu({ locale, label, soon, compact, placement = "up" }: { locale: string; label: string; soon: string; compact: boolean; placement?: "up" | "down" }) {
  const { open, setOpen, props } = usePopup();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  return (
    <div className="relative" {...props}>
      <button
        type="button"
        className="mn-nav-item flex items-center gap-1.5 h-9 px-2.5 rounded-md text-ink-muted hover:bg-tint-2 hover:text-ink border border-line"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <IconGlobe size={17} />
        {!compact && <span className="data uppercase">{locale}</span>}
      </button>
      {(pending || note) && (
        <span role="status" className={`absolute ${placement === "down" ? "top-full mt-2 end-0" : "bottom-full mb-2 start-0"} z-40 whitespace-nowrap text-[12px] bg-surface border border-line rounded-md px-2.5 py-1.5`}>
          {pending ? soon : note}
        </span>
      )}
      {open && (
        <ul role="listbox" aria-label={label} className={`${popup} ${placement === "down" ? "top-full mt-2 end-0" : "bottom-full mb-2 start-0"} w-[260px] max-h-[360px] overflow-y-auto`} style={{ boxShadow: "var(--shadow-float)" }}>
          {LANGUAGES.map((l) => {
            const current = l.code === locale;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={current}
                  lang={l.code}
                  className={`w-full flex items-center gap-2 px-2.5 h-9 rounded-sm text-start small ${current ? "bg-tint-3 font-medium" : "hover:bg-tint-2"}`}
                  onClick={() => {
                    setOpen(false);
                    setNote(undefined);
                    if (!current)
                      start(async () => {
                        const res = await setLocale(l.code);
                        setNote(res.error);
                      });
                  }}
                >
                  <span className="grow truncate">{l.name}</span>
                  {current && <IconCheckSmall size={15} />}
                  <span className="data text-[11px] px-1.5 rounded-sm bg-tint-2 uppercase">{l.code}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PersonMenu({
  person,
  email,
  role,
  photo,
  compact,
  labels,
}: {
  person: string;
  email?: string;
  role: string;
  photo?: string;
  compact: boolean;
  labels: { settings: string; signOut: string; account: string; usage: string; help: string; language: string };
}) {
  const { open, setOpen, props } = usePopup();
  const item = "flex items-center gap-2.5 px-2.5 h-9 rounded-sm small hover:bg-tint-2 text-start w-full";
  const avatar = (size: number) => (
    <span className="rounded-full bg-tint-3 grid place-items-center font-medium shrink-0 overflow-hidden" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : person.slice(0, 1).toUpperCase()}
    </span>
  );
  return (
    <div className={`relative ${compact ? "" : "grow min-w-0"}`} {...props}>
      <button
        type="button"
        className="mn-nav-item w-full flex items-center gap-2 px-1.5 h-10 rounded-md hover:bg-tint-2 text-start"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.account}
        title={compact ? person : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {avatar(28)}
        {!compact && (
          <span className="flex flex-col min-w-0">
            <span className="small truncate" dir="auto">{person}</span>
            <span className="text-[12px] text-ink-faint">{role}</span>
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className={`${popup} bottom-full mb-2 start-0 w-[248px]`} style={{ boxShadow: "var(--shadow-float)" }}>
          {email && (
            <div className="px-2.5 py-2 flex items-center gap-2.5 border-b border-line mb-1">
              {avatar(32)}
              <span className="flex flex-col min-w-0">
                <span className="small font-medium truncate" dir="auto">{person}</span>
                <span className="text-[12px] text-ink-faint truncate" dir="ltr" style={{ textAlign: "start" }}>{email}</span>
              </span>
            </div>
          )}
          <Link role="menuitem" href="/settings" className={item}>
            <IconSettings size={16} />
            {labels.settings}
          </Link>
          <Link role="menuitem" href="/settings?s=usage" className={item}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
            {labels.usage}
          </Link>
          <Link role="menuitem" href="/settings?s=language" className={item}>
            <IconGlobe size={16} />
            {labels.language}
          </Link>
          <Link role="menuitem" href="/settings?s=help" className={item}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" /></svg>
            {labels.help}
          </Link>
          <form action="/auth/signout" method="post" className="border-t border-line mt-1 pt-1">
            <button role="menuitem" className={item}>
              <IconLogout size={16} />
              {labels.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
