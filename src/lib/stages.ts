import type { Dictionary } from "@/lib/i18n/dictionaries";

export type Path = "ai" | "production" | "hybrid" | "none";

// Stages that do not apply to the path are hidden: AI shows 6, production and hybrid show 7.
export function stagesFor(path: Path, names: Dictionary["stage"]["names"]) {
  const look = path === "production" ? names.development : names.look;
  const make =
    path === "ai" ? names.generate
    : path === "production" ? names.shoot
    : path === "hybrid" ? names.generateAndShoot
    : names.generateOrShoot;
  const all = [
    names.brief,
    names.creative,
    look,
    ...(path === "ai" || path === "none" ? [] : [names.preproduction]),
    make,
    names.edit,
    names.deliver,
  ];
  return all;
}
