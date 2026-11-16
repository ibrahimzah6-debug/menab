"use client";

import { useEffect, useRef, useState } from "react";

// The website's 3D: one isometric line drawing built from the folded Menab "M" as a box, in
// hairlines with dashed hidden edges and one filled face (design-system/README.md, "Motion, 3D
// and teaching"). Each stage rebuilds the drawing; the lines draw themselves in as the visitor
// scrolls, white and gray only. With reduced motion, the drawing simply appears.

type P = [number, number, number];
type Shape = { kind: "line"; points: P[]; hidden?: boolean; dashed?: boolean } | { kind: "face"; points: P[]; fill: "accent" | "ink" | "soft"; hidden?: boolean };

// Isometric projection: x to the right-down, z to the left-down, y up.
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const S = 34;
const project = ([x, y, z]: P): [number, number] => [(x - z) * COS * S, (x + z) * SIN * S - y * S];

const box = (x: number, y: number, z: number, w: number, h: number, d: number, fill?: "accent" | "ink" | "soft", top = true): Shape[] => {
  const a: P = [x, y, z], b: P = [x + w, y, z], c: P = [x + w, y, z + d], e: P = [x, y, z + d];
  const A: P = [x, y + h, z], B: P = [x + w, y + h, z], C: P = [x + w, y + h, z + d], E: P = [x, y + h, z + d];
  return [
    ...(fill && top ? [{ kind: "face" as const, points: [A, B, C, E], fill }] : []),
    { kind: "line", points: [A, B, C, E, A] },
    { kind: "line", points: [a, b, c] },
    { kind: "line", points: [b, B] },
    { kind: "line", points: [c, C] },
    { kind: "line", points: [a, A] },
    { kind: "line", points: [a, e, c], hidden: true },
    { kind: "line", points: [e, E], hidden: true },
  ];
};

// A flat card standing on the ground, facing the viewer's right side.
const card = (x: number, z: number, w: number, h: number, fill?: "accent" | "ink" | "soft"): Shape[] => {
  const pts: P[] = [[x, 0, z], [x + w, 0, z], [x + w, h, z], [x, h, z]];
  return [...(fill ? [{ kind: "face" as const, points: pts, fill }] : []), { kind: "line", points: [...pts, pts[0]] }];
};

// A sheet lying flat, with text lines.
const sheet = (x: number, y: number, z: number, w: number, d: number, lines = 3, fill?: "accent" | "ink" | "soft"): Shape[] => {
  const pts: P[] = [[x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d]];
  const out: Shape[] = [...(fill ? [{ kind: "face" as const, points: pts, fill }] : []), { kind: "line", points: [...pts, pts[0]] }];
  for (let i = 0; i < lines; i++) {
    const zz = z + d * (0.25 + (i * 0.5) / Math.max(1, lines - 1));
    out.push({ kind: "line", points: [[x + w * 0.15, y, zz], [x + w * (i === lines - 1 ? 0.55 : 0.85), y, zz]], dashed: true });
  }
  return out;
};

// The folded "M": three faces of a strip folded into a box corner. Stage 0 is the hero.
const folded = (fill: "accent" | "ink" | "soft" = "ink"): Shape[] => [
  { kind: "face", points: [[0, 0, 0], [0, 3, 0], [0, 3, 2.2], [0, 0, 2.2]], fill: "soft" },
  { kind: "line", points: [[0, 0, 0], [0, 3, 0], [0, 3, 2.2], [0, 0, 2.2], [0, 0, 0]] },
  { kind: "face", points: [[0, 3, 0], [3, 3, 0], [3, 3, 2.2], [0, 3, 2.2]], fill },
  { kind: "line", points: [[0, 3, 0], [3, 3, 0], [3, 3, 2.2], [0, 3, 2.2]] },
  { kind: "line", points: [[3, 3, 0], [3, 0, 0], [3, 0, 2.2], [3, 3, 2.2]] },
  { kind: "line", points: [[0, 0, 0], [3, 0, 0]], hidden: true },
  { kind: "line", points: [[0, 0, 2.2], [3, 0, 2.2]] },
  // The fold line of the M, drawn as a diagonal across the top face.
  { kind: "line", points: [[0.4, 3.02, 0.3], [2.6, 3.02, 1.9]], dashed: true },
];

export const SCENES: Shape[][] = [
  folded("ink"),
  // 1 Brief: the box open, a sheet rising out with text lines.
  [...box(0, 0, 0, 3, 1.4, 2.2, "soft"), ...sheet(0.5, 1.42, 0.4, 2, 1.5, 4, "accent"), { kind: "line", points: [[0.5, 1.42, 0.4], [0.5, 2.6, 0.4], [2.5, 2.6, 0.4], [2.5, 1.42, 0.4]], dashed: true }],
  // 2 Creative: three direction cards on the box.
  [...box(0, 0, 0, 3.2, 1, 2.2, "soft"), ...card(0.3, 0.5, 0.8, 1.8), ...card(1.2, 0.5, 0.8, 1.8, "accent"), ...card(2.1, 0.5, 0.8, 1.8), ...Array.from({ length: 3 }, (_, i) => ({ kind: "line" as const, points: [[0.45 + i * 0.9, 1.9, 0.5], [0.95 + i * 0.9, 1.9, 0.5]] as P[], dashed: true }))],
  // 3 Look and characters: a storyboard grid on the top face, one frame filled.
  [...box(0, 0, 0, 3.2, 1, 2.4, "soft"), ...[0, 1, 2].flatMap((i) => [0, 1].flatMap((j) => { const pts: P[] = [[0.25 + i, 1.02, 0.25 + j * 1], [1.05 + i, 1.02, 0.25 + j * 1], [1.05 + i, 1.02, 0.95 + j * 1], [0.25 + i, 1.02, 0.95 + j * 1]]; return [...(i === 1 && j === 0 ? [{ kind: "face" as const, points: pts, fill: "accent" as const }] : []), { kind: "line" as const, points: [...pts, pts[0]] }]; }))],
  // 4 Pre-production: a calendar plane with shoot days filled, and a clapper edge.
  [...box(0, 0, 0, 3.2, 0.8, 2.4, "soft"), ...[0, 1, 2, 3, 4, 5, 6].flatMap((i) => [0, 1, 2].flatMap((j) => { const x = 0.2 + i * 0.4, z = 0.3 + j * 0.6; const pts: P[] = [[x, 0.82, z], [x + 0.36, 0.82, z], [x + 0.36, 0.82, z + 0.55], [x, 0.82, z + 0.55]]; return [...((i === 3 || i === 4) && j === 1 ? [{ kind: "face" as const, points: pts, fill: "accent" as const }] : []), { kind: "line" as const, points: [...pts, pts[0]], dashed: !((i === 3 || i === 4) && j === 1) }]; })), { kind: "line", points: [[0, 0.82, -0.3], [3.2, 0.82, -0.3]], hidden: true }],
  // 5 Generate: a stack of frames rising, the top one filled, like a film strip.
  [...box(0, 0, 0, 3.2, 0.6, 2.4, "soft"), ...[0, 1, 2, 3].flatMap((i) => { const y = 0.62 + i * 0.55; const pts: P[] = [[0.6, y, 0.5], [2.6, y, 0.5], [2.6, y, 1.9], [0.6, y, 1.9]]; return [...(i === 3 ? [{ kind: "face" as const, points: pts, fill: "accent" as const }] : []), { kind: "line" as const, points: [...pts, pts[0]], hidden: i < 3 }]; }), { kind: "line", points: [[0.6, 0.62, 0.5], [0.6, 2.27, 0.5]] }, { kind: "line", points: [[2.6, 0.62, 0.5], [2.6, 2.27, 0.5]] }, { kind: "line", points: [[2.6, 0.62, 1.9], [2.6, 2.27, 1.9]] }],
  // 6 Edit: a timeline bar with clips along the front edge.
  [...box(0, 0, 0, 3.6, 0.6, 2.2, "soft"), ...[0, 0.9, 1.7, 2.6].map((x, i) => ({ kind: "face" as const, points: [[x + 0.1, 0.62, 1.4], [x + (i === 1 ? 0.7 : 0.8), 0.62, 1.4], [x + (i === 1 ? 0.7 : 0.8), 0.62, 1.9], [x + 0.1, 0.62, 1.9]] as P[], fill: i === 1 ? ("accent" as const) : ("soft" as const) })), ...[0, 0.9, 1.7, 2.6].map((x, i) => ({ kind: "line" as const, points: [[x + 0.1, 0.62, 1.4], [x + (i === 1 ? 0.7 : 0.8), 0.62, 1.4], [x + (i === 1 ? 0.7 : 0.8), 0.62, 1.9], [x + 0.1, 0.62, 1.9], [x + 0.1, 0.62, 1.4]] as P[] })), { kind: "line", points: [[0, 0.62, 0.6], [3.6, 0.62, 0.6]], dashed: true }, { kind: "line", points: [[1.3, 0.62, 0.3], [1.3, 0.62, 2.1]] }],
  // 7 Deliver: the closed box, lid filled, a ribbon line over it.
  [...box(0, 0, 0, 3, 2.2, 2.2, "accent"), { kind: "line", points: [[1.5, 0, 0], [1.5, 2.2, 0], [1.5, 2.2, 2.2]] }, { kind: "line", points: [[0, 2.2, 1.1], [3, 2.2, 1.1]] }],
];

export function Isometric({ scene, width = 520, height = 400 }: { scene: number; width?: number; height?: number }) {
  const shapes = SCENES[Math.max(0, Math.min(SCENES.length - 1, scene))];
  const [key, setKey] = useState(0);
  const [reduced, setReduced] = useState(false);
  const last = useRef(scene);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (last.current !== scene) {
      last.current = scene;
      setKey((k) => k + 1);
    }
  }, [scene]);
  // Centre the drawing.
  const pts = shapes.flatMap((s) => s.points.map(project));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const tx = width / 2 - cx, ty = height / 2 - cy;
  const d = (points: P[]) => points.map(project).map(([x, y], i) => `${i ? "L" : "M"}${(x + tx).toFixed(1)} ${(y + ty).toFixed(1)}`).join(" ");
  let n = 0;
  return (
    <svg key={key} viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-hidden="true" className="iso" style={{ overflow: "visible" }}>
      {shapes.map((s, i) => {
        if (s.kind === "face") {
          const fill = s.fill === "accent" ? "var(--accent)" : s.fill === "ink" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)";
          return <path key={i} d={d(s.points) + " Z"} fill={fill} stroke="none" className="iso-face" style={{ animationDelay: reduced ? "0s" : `${0.15 + i * 0.05}s` }} />;
        }
        const idx = n++;
        return (
          <path
            key={i}
            d={d(s.points)}
            fill="none"
            stroke={s.hidden ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.75)"}
            strokeWidth={s.hidden ? 1 : 1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.hidden || s.dashed ? "4 5" : undefined}
            pathLength={100}
            className={reduced ? undefined : "iso-line"}
            style={reduced ? undefined : { animationDelay: `${idx * 0.06}s` }}
          />
        );
      })}
    </svg>
  );
}
