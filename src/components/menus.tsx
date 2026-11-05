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
  role,
  compact,
  labels,
}: {
  person: string;
  role: string;
  compact: boolean;
  labels: { settings: string; signOut: string; account: string };
}) {
  const { open, setOpen, props } = usePopup();
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
        <span className="w-7 h-7 rounded-full bg-tint-3 grid place-items-center text-[12px] font-medium shrink-0">
          {person.slice(0, 1).toUpperCase()}
        </span>
        {!compact && (
          <span className="flex flex-col min-w-0">
            <span className="small truncate" dir="auto">{person}</span>
            <span className="text-[12px] text-ink-faint">{role}</span>
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className={`${popup} bottom-full mb-2 start-0 w-[220px]`} style={{ boxShadow: "var(--shadow-float)" }}>
          <Link role="menuitem" href="/settings" className="flex items-center gap-2 px-2.5 h-9 rounded-sm small hover:bg-tint-2">
            <IconSettings size={16} />
            {labels.settings}
          </Link>
          <form action="/auth/signout" method="post">
            <button role="menuitem" className="w-full flex items-center gap-2 px-2.5 h-9 rounded-sm small hover:bg-tint-2 text-start">
              <IconLogout size={16} />
              {labels.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
