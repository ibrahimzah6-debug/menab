"use client";

import { useEffect, useRef, useState } from "react";

// The website's 3D: isometric line drawings of real production objects (design-system/README.md,
// "Motion, 3D and teaching"): hairlines, dashed hidden edges, white and gray, one accent fill per
// drawing. The hero is the folded Menab "M"; each stage has its own small set, which draws itself
// in as the visitor scrolls. With reduced motion, the drawing simply appears.

type P = [number, number, number];
type Fill = "accent" | "ink" | "soft";
type Shape = { kind: "line"; points: P[]; hidden?: boolean; dashed?: boolean } | { kind: "face"; points: P[]; fill: Fill };

// Isometric projection: x runs right and down, z runs left and down, y runs up.
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const project = ([x, y, z]: P): [number, number] => [(x - z) * COS, (x + z) * SIN - y];

const line = (points: P[], o: { hidden?: boolean; dashed?: boolean } = {}): Shape => ({ kind: "line", points, ...o });
const face = (points: P[], fill: Fill): Shape => ({ kind: "face", points, fill });
const loop = (points: P[], o: { hidden?: boolean; dashed?: boolean } = {}): Shape => line([...points, points[0]], o);

// A box with its bottom corner at (x, y, z): visible edges solid, hidden ones dashed.
const box = (x: number, y: number, z: number, w: number, h: number, d: number, fill?: Fill, fillFace: "top" | "front" | "side" = "top"): Shape[] => {
  const a: P = [x, y, z], b: P = [x + w, y, z], c: P = [x + w, y, z + d], e: P = [x, y, z + d];
  const A: P = [x, y + h, z], B: P = [x + w, y + h, z], C: P = [x + w, y + h, z + d], E: P = [x, y + h, z + d];
  const faces = { top: [A, B, C, E], front: [b, c, C, B], side: [e, c, C, E] };
  return [
    ...(fill ? [face(faces[fillFace], fill)] : []),
    loop([A, B, C, E]),
    line([e, c, b]),
    line([b, B]),
    line([c, C]),
    line([e, E]),
    line([a, b], { hidden: true }),
    line([a, e], { hidden: true }),
    line([a, A], { hidden: true }),
  ];
};

// A flat panel standing up, facing the viewer (in the x-y plane at depth z).
const panel = (x: number, y: number, z: number, w: number, h: number, fill?: Fill): Shape[] => {
  const pts: P[] = [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]];
  return [...(fill ? [face(pts, fill)] : []), loop(pts)];
};

// A flat sheet lying down with text lines.
const sheet = (x: number, y: number, z: number, w: number, d: number, lines = 3, fill?: Fill): Shape[] => {
  const pts: P[] = [[x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d]];
  const out: Shape[] = [...(fill ? [face(pts, fill)] : []), loop(pts)];
  for (let i = 0; i < lines; i++) {
    const zz = z + d * (0.25 + (0.5 * i) / Math.max(1, lines - 1));
    out.push(line([[x + w * 0.15, y, zz], [x + w * (i === lines - 1 ? 0.55 : 0.85), y, zz]], { dashed: true }));
  }
  return out;
};

// A cylinder standing on its end (octagon), and one lying along x (a lens).
const ring = (cx: number, y: number, cz: number, r: number): P[] => Array.from({ length: 8 }, (_, i) => { const t = (i / 8) * Math.PI * 2; return [cx + r * Math.cos(t), y, cz + r * Math.sin(t)] as P; });
const cylinder = (cx: number, y: number, cz: number, r: number, h: number, fill?: Fill): Shape[] => {
  const top = ring(cx, y + h, cz, r), bottom = ring(cx, y, cz, r);
  return [...(fill ? [face(top, fill)] : []), loop(top), loop(bottom, { hidden: true }), line([bottom[1], top[1]]), line([bottom[5], top[5]], { hidden: true }), line([bottom[3], top[3]]), line([bottom[7], top[7]], { hidden: true })];
};
const lens = (x: number, cy: number, cz: number, r: number, len: number): Shape[] => {
  const ringX = (xx: number): P[] => Array.from({ length: 8 }, (_, i) => { const t = (i / 8) * Math.PI * 2; return [xx, cy + r * Math.cos(t), cz + r * Math.sin(t)] as P; });
  const a = ringX(x), b = ringX(x + len);
  return [loop(b), loop(a, { hidden: true }), line([a[0], b[0]]), line([a[2], b[2]], { hidden: true }), line([a[4], b[4]], { hidden: true }), line([a[6], b[6]]), face(b, "soft")];
};

// A tripod: three legs meeting under a point.
const tripod = (cx: number, top: number, cz: number, spread = 1.2): Shape[] =>
  [[cx + spread, 0, cz - spread * 0.4], [cx - spread * 0.4, 0, cz + spread], [cx - spread * 0.6, 0, cz - spread * 0.9]].map((foot) => line([[cx, top, cz], foot as P]));

// ---------- The hero: the folded Menab "M" ----------
// A strip folded three times: a left panel, a sloped band, a right panel. The band is filled.
const folded = (): Shape[] => {
  const d = 2.2, h = 3;
  const left: P[] = [[0, 0, 0], [0, h, 0], [0, h, d], [0, 0, d]];
  const band: P[] = [[0, h, 0], [3, 0.2, 0], [3, 0.2, d], [0, h, d]];
  const right: P[] = [[3, 0, 0], [3, h, 0], [3, h, d], [3, 0, d]];
  return [
    face(left, "soft"), loop(left),
    face(band, "ink"), loop(band),
    face(right, "soft"), loop(right),
    line([[0, 0, 0], [3, 0, 0]], { hidden: true }),
    line([[0, 0, d], [3, 0, d]], { hidden: true }),
    // The thickness of the strip, hinted on the near edges.
    line([[0, h, d], [0.18, h + 0.1, d]], { dashed: true }),
    line([[3, h, d], [3.18, h + 0.1, d]], { dashed: true }),
  ];
};

export const SCENES: Shape[][] = [
  folded(),

  // 1 Brief: a laptop with the brief chat, a microphone beside it, sound arcs rising.
  [
    ...box(0, 0, 0, 3.4, 0.16, 2.3, "soft"),
    ...(() => { const lid: P[] = [[0, 0.16, 0], [3.4, 0.16, 0], [3.4, 2.4, -0.9], [0, 2.4, -0.9]]; return [face(lid, "soft"), loop(lid), loop([[0.25, 0.3, -0.05], [3.15, 0.3, -0.05], [3.15, 2.25, -0.85], [0.25, 2.25, -0.85]], { dashed: true })]; })(),
    // Chat bubbles on the screen.
    face([[0.5, 1.9, -0.72], [2.0, 1.9, -0.72], [2.0, 1.45, -0.55], [0.5, 1.45, -0.55]], "ink"),
    loop([[0.5, 1.9, -0.72], [2.0, 1.9, -0.72], [2.0, 1.45, -0.55], [0.5, 1.45, -0.55]]),
    face([[1.4, 1.2, -0.45], [2.9, 1.2, -0.45], [2.9, 0.75, -0.28], [1.4, 0.75, -0.28]], "accent"),
    loop([[1.4, 1.2, -0.45], [2.9, 1.2, -0.45], [2.9, 0.75, -0.28], [1.4, 0.75, -0.28]]),
    // Microphone.
    ...cylinder(4.5, 0, 1.6, 0.42, 0.12, "soft"),
    line([[4.5, 0.12, 1.6], [4.5, 1.1, 1.6]]),
    ...cylinder(4.5, 1.1, 1.6, 0.26, 0.7, "ink"),
    line([[4.5, 1.1, 1.6], [4.5, 1.1, 1.6 + 0.26]], { dashed: true }),
    ...[0.5, 0.85, 1.2].map((r) => line(Array.from({ length: 7 }, (_, i) => { const t = -0.6 + (i / 6) * 1.2; return [4.5 + r * Math.sin(t), 1.5 + r * Math.cos(t) * 0.6 + 0.6, 1.6] as P; }), { dashed: true })),
  ],

  // 2 Creative: a presentation board on two legs with three direction cards, and the Menab AI cursor.
  [
    ...panel(0, 0.9, 0, 4.6, 2.9, "soft"),
    line([[0.4, 0, 0], [0.4, 0.9, 0]]), line([[4.2, 0, 0], [4.2, 0.9, 0]]),
    line([[0.4, 0, 0], [0.1, 0, 0.9]], { dashed: true }), line([[4.2, 0, 0], [3.9, 0, 0.9]], { dashed: true }),
    ...[0, 1, 2].flatMap((i) => panel(0.35 + i * 1.4, 1.25, -0.02, 1.2, 2.1, i === 1 ? "accent" : undefined)),
    ...[0, 1, 2].flatMap((i) => [line([[0.55 + i * 1.4, 2.95, -0.03], [1.35 + i * 1.4, 2.95, -0.03]], { dashed: true }), line([[0.55 + i * 1.4, 2.7, -0.03], [1.2 + i * 1.4, 2.7, -0.03]], { dashed: true }), line([[0.55 + i * 1.4, 2.45, -0.03], [1.3 + i * 1.4, 2.45, -0.03]], { dashed: true })]),
    // The cursor, writing on the middle card.
    face([[2.25, 1.6, -0.3], [2.25, 2.3, -0.3], [2.5, 2.05, -0.3], [2.75, 1.8, -0.3]], "ink"),
    loop([[2.25, 1.6, -0.3], [2.25, 2.3, -0.3], [2.5, 2.05, -0.3], [2.75, 1.8, -0.3]]),
  ],

  // 3 Look and characters: a storyboard on an easel, one frame drawn with a figure, a lamp beside it.
  [
    ...panel(0, 1.1, 0, 4.2, 3, "soft"),
    line([[0.3, 0, 0.1], [0.5, 1.1, 0]]), line([[3.9, 0, 0.1], [3.7, 1.1, 0]]), line([[2.1, 0, 1.3], [2.1, 1.6, 0.05]], { dashed: true }),
    ...[0, 1, 2].flatMap((i) => [0, 1].flatMap((j) => panel(0.3 + i * 1.3, 1.4 + (1 - j) * 1.4, -0.02, 1.15, 1.2))),
    face([[1.6, 2.8, -0.03], [2.75, 2.8, -0.03], [2.75, 4, -0.03], [1.6, 4, -0.03]], "accent"),
    // A figure in the filled frame: head and shoulders.
    loop(Array.from({ length: 8 }, (_, k) => { const t = (k / 8) * Math.PI * 2; return [2.17 + 0.22 * Math.cos(t), 3.55 + 0.22 * Math.sin(t), -0.05] as P; })),
    line([[1.75, 2.85, -0.05], [1.95, 3.25, -0.05], [2.4, 3.25, -0.05], [2.6, 2.85, -0.05]]),
    // Lamp.
    ...cylinder(5.1, 0, 1.4, 0.4, 0.1, "soft"), line([[5.1, 0.1, 1.4], [5.1, 2.6, 1.4]]),
    line([[5.1, 2.6, 1.4], [4.5, 3.3, 1.0]]), ...cylinder(4.5, 3.3, 1.0, 0.35, 0.3, "ink"),
    line([[4.3, 3.3, 1.0], [3.4, 2.4, 0.5]], { dashed: true }), line([[4.7, 3.3, 1.0], [4.2, 2.1, 0.3]], { dashed: true }),
  ],

  // 4 Pre-production: a clapperboard with its stick open, a calendar page and a stack of call sheets.
  [
    ...box(0, 0, 0, 3.2, 0.1, 0.1, undefined),
    ...box(0, 0, 0, 3.2, 2.2, 0.12, "soft", "front"),
    // The stick, open at an angle, with stripes.
    ...(() => { const s: P[] = [[0, 2.2, 0], [3.1, 3.3, 0], [3.1, 3.7, 0], [0, 2.6, 0]]; const out: Shape[] = [face(s, "ink"), loop(s)]; for (let i = 1; i < 6; i++) { const t = i / 6; out.push(line([[3.1 * t, 2.2 + 1.1 * t, 0], [3.1 * t - 0.25, 2.6 + 1.1 * (t - 0.08), 0]], { dashed: i % 2 === 0 })); } return out; })(),
    ...[0.4, 0.95, 1.5].map((y) => line([[0.3, y, -0.02], [2.2, y, -0.02]], { dashed: true })),
    // Calendar lying beside it, shoot days filled.
    ...sheet(3.9, 0, 0.3, 2.4, 1.8, 0, "soft"),
    ...[0, 1, 2, 3, 4, 5, 6].flatMap((i) => [0, 1, 2].map((j) => loop([[3.95 + i * 0.34, 0.01, 0.4 + j * 0.55], [4.25 + i * 0.34, 0.01, 0.4 + j * 0.55], [4.25 + i * 0.34, 0.01, 0.85 + j * 0.55], [3.95 + i * 0.34, 0.01, 0.85 + j * 0.55]], { dashed: true }))),
    face([[3.95 + 3 * 0.34, 0.02, 0.95], [4.25 + 4 * 0.34, 0.02, 0.95], [4.25 + 4 * 0.34, 0.02, 1.4], [3.95 + 3 * 0.34, 0.02, 1.4]], "accent"),
  ],

  // 5 Generate or shoot: a film camera on a tripod, a light on a stand, a film strip of frames.
  [
    ...tripod(1.8, 1.9, 1.3),
    ...box(0.9, 1.9, 0.8, 1.9, 1.1, 1.0, "soft", "side"),
    ...lens(2.8, 2.45, 1.3, 0.38, 0.9),
    // The two reels of a film camera.
    ...cylinder(1.3, 3.0, 1.3, 0.42, 0.18, "ink"), ...cylinder(2.2, 3.0, 1.3, 0.42, 0.18, "ink"),
    // Light on a stand, beam dashed toward the camera's subject.
    ...cylinder(5.4, 0, 0.2, 0.4, 0.08, "soft"), line([[5.4, 0.08, 0.2], [5.4, 3.4, 0.2]]),
    ...box(4.8, 3.2, -0.2, 0.9, 0.9, 0.8, "ink", "front"),
    line([[4.8, 3.3, 0.2], [3.6, 2.2, 1.2]], { dashed: true }), line([[4.8, 4.0, 0.2], [3.6, 3.0, 1.2]], { dashed: true }),
    // Film strip on the ground, one frame filled.
    ...sheet(-0.6, 0, 2.6, 4.2, 0.9, 0),
    ...[0, 1, 2, 3].map((i) => loop([[-0.4 + i * 1.05, 0.01, 2.75], [0.5 + i * 1.05, 0.01, 2.75], [0.5 + i * 1.05, 0.01, 3.35], [-0.4 + i * 1.05, 0.01, 3.35]], { dashed: i !== 2 })),
    face([[-0.4 + 2 * 1.05, 0.02, 2.75], [0.5 + 2 * 1.05, 0.02, 2.75], [0.5 + 2 * 1.05, 0.02, 3.35], [-0.4 + 2 * 1.05, 0.02, 3.35]], "accent"),
  ],

  // 6 Edit: a monitor on a stand showing a timeline, a keyboard in front.
  [
    ...cylinder(2.2, 0, 1.6, 0.9, 0.08, "soft"), line([[2.2, 0.08, 1.6], [2.2, 0.9, 1.6]]),
    ...box(0, 0.9, 1.3, 4.4, 2.6, 0.18, "soft", "front"),
    loop([[0.25, 1.1, 1.28], [4.15, 1.1, 1.28], [4.15, 3.3, 1.28], [0.25, 3.3, 1.28]], { dashed: true }),
    // Timeline tracks with clips, one filled.
    ...[0, 1].flatMap((t) => [0, 1, 2, 3].map((i) => loop([[0.45 + i * 0.92, 1.3 + t * 0.5, 1.26], [1.2 + i * 0.92 - (i === 1 ? 0.2 : 0), 1.3 + t * 0.5, 1.26], [1.2 + i * 0.92 - (i === 1 ? 0.2 : 0), 1.65 + t * 0.5, 1.26], [0.45 + i * 0.92, 1.65 + t * 0.5, 1.26]], { dashed: t === 1 }))),
    face([[0.45 + 0.92, 1.3, 1.25], [1.0 + 0.92, 1.3, 1.25], [1.0 + 0.92, 1.65, 1.25], [0.45 + 0.92, 1.65, 1.25]], "accent"),
    line([[1.9, 1.2, 1.24], [1.9, 2.4, 1.24]]),
    // The picture above the timeline.
    loop([[0.45, 2.5, 1.26], [3.95, 2.5, 1.26], [3.95, 3.15, 1.26], [0.45, 3.15, 1.26]]),
    // Keyboard.
    ...box(0.6, 0, 0.1, 3.0, 0.12, 0.9, "soft"),
    ...[0.2, 0.45, 0.7].map((z) => line([[0.8, 0.13, 0.1 + z], [3.4, 0.13, 0.1 + z]], { dashed: true })),
  ],

  // 7 Deliver: a box with the lid open, a play button rising out, a ribbon around it.
  [
    ...box(0, 0, 0, 3, 2, 2.2, "soft", "side"),
    ...(() => { const lid: P[] = [[0, 2, 2.2], [3, 2, 2.2], [3, 3.4, 3.1], [0, 3.4, 3.1]]; return [face(lid, "soft"), loop(lid)]; })(),
    line([[1.5, 0, 0], [1.5, 2, 0]], { dashed: true }), line([[1.5, 2, 0], [1.5, 2, 2.2]], { dashed: true }), line([[3, 0, 1.1], [3, 2, 1.1]], { dashed: true }),
    // The play button, floating up out of the box.
    loop(Array.from({ length: 8 }, (_, k) => { const t = (k / 8) * Math.PI * 2; return [1.5 + 0.9 * Math.cos(t), 3.4 + 0.9 * Math.sin(t), 1.1] as P; })),
    face([[1.2, 2.95, 1.1], [1.2, 3.85, 1.1], [2.0, 3.4, 1.1]], "accent"),
    loop([[1.2, 2.95, 1.1], [1.2, 3.85, 1.1], [2.0, 3.4, 1.1]]),
  ],
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
  // Fit and centre the drawing in the frame.
  const pts = shapes.flatMap((s) => s.points.map(project));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width * 0.82) / (maxX - minX || 1), (height * 0.82) / (maxY - minY || 1));
  const tx = width / 2 - ((minX + maxX) / 2) * scale, ty = height / 2 - ((minY + maxY) / 2) * scale;
  const d = (points: P[]) => points.map(project).map(([x, y], i) => `${i ? "L" : "M"}${(x * scale + tx).toFixed(1)} ${(y * scale + ty).toFixed(1)}`).join(" ");
  let n = 0;
  return (
    <svg key={key} viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-hidden="true" className="iso" style={{ overflow: "visible" }}>
      {shapes.map((s, i) => {
        if (s.kind === "face") {
          const fill = s.fill === "accent" ? "var(--accent)" : s.fill === "ink" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)";
          return <path key={i} d={d(s.points) + " Z"} fill={fill} stroke="none" className="iso-face" style={{ animationDelay: reduced ? "0s" : `${0.2 + i * 0.04}s` }} />;
        }
        const idx = n++;
        return (
          <path
            key={i}
            d={d(s.points)}
            fill="none"
            stroke={s.hidden ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.78)"}
            strokeWidth={s.hidden ? 1 : 1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.hidden || s.dashed ? "4 5" : undefined}
            pathLength={100}
            className={reduced ? undefined : "iso-line"}
            style={reduced ? undefined : { animationDelay: `${Math.min(idx * 0.045, 2)}s` }}
          />
        );
      })}
    </svg>
  );
}
