"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createProject } from "@/app/p/[id]/actions";
import { setSidebar, switchWorkspace } from "@/lib/preferences";
import { PersonMenu } from "./menus";
import {
  IconChart,
  IconBooks,
  IconCheckSmall,
  IconCoins,
  IconFolder,
  IconHome,
  IconPlus,
  IconSelector,
  IconSettings,
  IconSidebar,
  IconTemplate,
  IconUsers,
} from "./icons";

const ITEMS = [
  { href: "/", key: "home", Icon: IconHome },
  { href: "/projects", key: "projects", Icon: IconFolder },
  { href: "/libraries", key: "libraries", Icon: IconBooks },
  { href: "/templates", key: "templates", Icon: IconTemplate },
  { href: "/team", key: "team", Icon: IconUsers },
  { href: "/credits", key: "credits", Icon: IconCoins },
  { href: "/settings", key: "settings", Icon: IconSettings },
] as const;

type Labels = Record<(typeof ITEMS)[number]["key"], string> & {
  newProject: string;
  mainMenu: string;
  openMenu: string;
  closeMenu: string;
  workspaces: string;
  signOut: string;
  langSwitch: string;
  langSwitchLabel: string;
  viewerNote: string;
  owner: string;
  account: string;
  language: string;
  soon: string;
};

export function Sidebar({
  initialOpen,
  logo,
  mark,
  labels,
  workspaces,
  currentWorkspace,
  canCreate,
  person,
  role,
  isOwner,
}: {
  initialOpen: boolean;
  logo: React.ReactNode;
  mark: React.ReactNode;
  labels: Labels;
  locale: "en" | "ar";
  workspaces: { id: string; name: string }[];
  currentWorkspace: { id: string; name: string } | null;
  canCreate: boolean;
  person: string;
  role: string;
  isOwner?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [wsOpen, setWsOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const path = usePathname();
  const wsRef = useRef<HTMLDivElement>(null);
  // Close the workspace list when the page changes.
  useEffect(() => setWsOpen(false), [path]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    start(() => setSidebar(next));
  };

  const item = "mn-nav-item flex items-center gap-3 h-9 rounded-md text-[14px] whitespace-nowrap";

  return (
    <aside
      aria-label={labels.mainMenu}
      className={`shrink-0 h-screen sticky top-0 bg-ground-deep border-e border-line flex flex-col gap-3 py-3 transition-[width] duration-200 ${
        open ? "w-[256px] px-3" : "w-[60px] px-2 items-center"
      }`}
    >
      <div className={`flex items-center ${open ? "justify-between px-1" : "flex-col gap-3"}`}>
        <Link href="/" aria-label="Menab" className="flex items-center h-8">
          {open ? logo : mark}
        </Link>
        <button
          type="button"
          className="mn-btn mn-btn--ghost mn-btn--sm"
          style={{ padding: "0 8px" }}
          aria-label={open ? labels.closeMenu : labels.openMenu}
          aria-expanded={open}
          title={open ? labels.closeMenu : labels.openMenu}
          onClick={toggle}
        >
          <IconSidebar size={18} />
        </button>
      </div>

      {currentWorkspace && open && (
        <div
          ref={wsRef}
          className="relative"
          onKeyDown={(e) => {
            if (e.key === "Escape") setWsOpen(false);
          }}
          onBlur={(e) => {
            if (!wsRef.current?.contains(e.relatedTarget as Node)) setWsOpen(false);
          }}
        >
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 h-10 rounded-md border border-line bg-surface hover:border-line-strong text-start"
            aria-haspopup="listbox"
            aria-expanded={wsOpen}
            aria-label={labels.workspaces}
            onClick={() => setWsOpen((v) => !v)}
          >
            <span className="w-6 h-6 rounded-sm bg-primary text-on-primary grid place-items-center text-[12px] font-semibold shrink-0">
              {currentWorkspace.name.slice(0, 1)}
            </span>
            <span className="small font-medium grow truncate">{currentWorkspace.name}</span>
            <IconSelector size={16} className="text-ink-muted" />
          </button>
          {wsOpen && (
            <ul
              role="listbox"
              aria-label={labels.workspaces}
              className="absolute z-30 mt-1 w-full bg-surface border border-line-strong rounded-md p-1 m-0 list-none"
              style={{ boxShadow: "var(--shadow-float)" }}
            >
              <li className="mn-label px-2 py-1.5">{labels.workspaces}</li>
              {workspaces.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={w.id === currentWorkspace.id}
                    className="w-full flex items-center gap-2 px-2 h-9 rounded-sm hover:bg-tint-2 text-start small"
                    onClick={() => {
                      setWsOpen(false);
                      if (w.id === currentWorkspace.id) return;
                      start(async () => {
                        await switchWorkspace(w.id);
                        router.push("/");
                        router.refresh();
                      });
                    }}
                  >
                    <span className="grow truncate">{w.name}</span>
                    {w.id === currentWorkspace.id && <IconCheckSmall size={16} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {currentWorkspace &&
        (canCreate ? (
          <form action={createProject} className={open ? "" : "w-full flex justify-center"}>
            <button
              className={`mn-btn mn-btn--accent justify-center ${open ? "w-full" : ""}`}
              style={open ? undefined : { padding: 0, width: 40 }}
              aria-label={labels.newProject}
              title={labels.newProject}
            >
              <IconPlus size={16} />
              {open && labels.newProject}
            </button>
          </form>
        ) : (
          open && <p className="small text-ink-faint m-0 px-2">{labels.viewerNote}</p>
        ))}

      {currentWorkspace && (
        <nav className="flex flex-col gap-0.5 w-full">
          {ITEMS.map(({ href, key, Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href) || (key === "projects" && path.startsWith("/p/"));
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                title={open ? undefined : labels[key]}
                className={`${item} ${open ? "px-2.5" : "justify-center w-10 mx-auto"} ${
                  active ? "bg-tint-3 text-ink font-medium" : "text-ink-muted hover:bg-tint-2 hover:text-ink"
                }`}
              >
                <Icon size={18} />
                {open && labels[key]}
              </Link>
            );
          })}
          {isOwner && (
            <Link
              href="/owner"
              aria-current={path.startsWith("/owner") ? "page" : undefined}
              title={open ? undefined : labels.owner}
              className={`${item} ${open ? "px-2.5" : "justify-center w-10 mx-auto"} ${path.startsWith("/owner") ? "bg-tint-3 text-ink font-medium" : "text-ink-muted hover:bg-tint-2 hover:text-ink"}`}
            >
              <IconChart size={18} />
              {open && labels.owner}
            </Link>
          )}
        </nav>
      )}

      <span className="grow" />

      <div className={`flex gap-1.5 border-t border-line pt-3 ${open ? "items-center" : "flex-col items-center w-full"}`}>
        <PersonMenu person={person} role={role} compact={!open} labels={{ settings: labels.settings, signOut: labels.signOut, account: labels.account }} />
      </div>
    </aside>
  );
}
