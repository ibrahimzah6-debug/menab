"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBooks, IconCoins, IconFolder, IconHome, IconSettings, IconTemplate, IconUsers } from "./icons";

const ITEMS = [
  { href: "/", key: "home", Icon: IconHome },
  { href: "/projects", key: "projects", Icon: IconFolder },
  { href: "/libraries", key: "libraries", Icon: IconBooks },
  { href: "/templates", key: "templates", Icon: IconTemplate },
  { href: "/team", key: "team", Icon: IconUsers },
  { href: "/credits", key: "credits", Icon: IconCoins },
  { href: "/settings", key: "settings", Icon: IconSettings },
] as const;

export type NavKey = (typeof ITEMS)[number]["key"];

export function SideNav({ labels, menuLabel }: { labels: Record<NavKey, string>; menuLabel: string }) {
  const path = usePathname();
  return (
    <nav aria-label={menuLabel} className="flex md:flex-col gap-1 overflow-x-auto">
      {ITEMS.map(({ href, key, Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-3 h-10 rounded-md text-[14px] whitespace-nowrap ${
              active ? "bg-surface border border-line font-medium text-ink" : "text-ink-muted border border-transparent hover:bg-tint-2"
            }`}
          >
            <Icon size={20} />
            {labels[key]}
          </Link>
        );
      })}
    </nav>
  );
}
