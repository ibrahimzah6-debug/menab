"use client";

import { useEffect, useState } from "react";

// The right panel: Brief and Assistant as two clear tabs at the top. The tab bar stays put and
// only the open tab scrolls, so switching never jumps around. The choice is kept per view.
export function PanelTabs({ tabs, initial, storageKey }: { tabs: { key: string; label: string; node: React.ReactNode }[]; initial: string; storageKey: string }) {
  const [active, setActive] = useState(initial);
  const keys = tabs.map((t) => t.key).join(",");
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved && keys.split(",").includes(saved)) setActive(saved);
    } catch {
      // Storage blocked: keep the default.
    }
  }, [storageKey, keys]);
  const pick = (key: string) => {
    setActive(key);
    try {
      sessionStorage.setItem(storageKey, key);
    } catch {
      // Not remembered.
    }
  };
  return (
    <div className="flex flex-col md:min-h-0 md:h-full">
      <div className="mn-stagebar shrink-0 mb-3" role="tablist" style={{ width: "100%" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => pick(t.key)}
            className={`mn-stage flex-1 justify-center border-0 cursor-pointer ${active === t.key ? "mn-stage--current" : "bg-transparent"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={active !== t.key} className="md:min-h-0 md:flex-1 md:overflow-y-auto flex flex-col gap-4">
          {t.node}
        </div>
      ))}
    </div>
  );
}
