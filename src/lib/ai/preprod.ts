import "server-only";
import { z } from "zod";
import { MENAB, lessons, remembered } from "./brain";
import { structured, type Step } from "./brain-core";
import { typeGuide } from "@/lib/video-types";

// Stage 4, Pre-production (workflow-map.md, outputs 20 to 32; production and hybrid paths).
// Three calls side by side: budget with equipment; crew needs with permit data; the shooting
// schedule with call sheets. The PPM booklet (27) is assembled from earlier documents, and the
// PPM meeting (28) is the client's sign-off. Crew ID numbers are never part of any prompt: the
// AI writes roles and names only, and IDs are added when a PDF is built.

const Money = z.number().describe("Saudi riyals, no currency sign");

export const Budget = z.object({
  budget: z.object({
    currency: z.literal("SAR"),
    sections: z
      .array(
        z.object({
          name: z.string().describe("Pre-production, Crew, Cast, Camera and lenses, Lighting and grip, Sound, Art and props, Wardrobe and makeup, Locations and permits, Transport and catering, Post-production, Insurance and safety"),
          items: z.array(z.object({ item: z.string(), qty: z.number(), unit: z.string().describe("day, person day, item, flat"), days: z.number(), rate: Money, total: Money })),
        }),
      )
      .describe("Every line the production needs for this brief, path and shot list, at realistic Riyadh market rates"),
    contingency_pct: z.number().describe("Usually 10"),
    fee_pct: z.number().describe("Production company fee, usually 15 to 20"),
    vat_pct: z.literal(15),
    notes: z.string().describe("Assumptions: shoot days, crew size, what is not included"),
  }),
  equipment: z
    .array(z.object({ department: z.string(), item: z.string(), qty: z.number(), notes: z.string().describe("Why it is needed: the shots or lenses that use it") }))
    .describe("Camera, lenses, lighting, grip, sound, drone and special rigs from the shot list"),
});
export type Budget = z.infer<typeof Budget>;

export const CrewPermits = z.object({
  crew_needs: z
    .array(z.object({ department: z.string().describe("direction, production, camera, lighting, sound, art, wardrobe, makeup, cast, drone, transport, catering, safety, post"), role: z.string(), count: z.number(), days: z.number() }))
    .describe("Every role the shoot needs, by department"),
  permits: z.object({
    purpose: z.string().describe("What the filming is for, as written on a GAMR filming permit"),
    type: z.enum(["video", "photo", "video and photo"]),
    locations: z.array(z.object({ region: z.string(), city: z.string(), place: z.string(), public_place: z.boolean(), needs_venue_approval: z.boolean().describe("Filming inside a private venue needs its written approval") })),
    drone: z.boolean().describe("True if any shot uses a drone: then a GACA permit and a registered drone are needed"),
    dates: z.string().describe("Shoot dates or range"),
    checklist: z.array(z.string()).describe("What to prepare: GAMR filming permit (online, about 500 SAR, 1 day), venue letters, GACA drone permit, crew GAMR registration"),
  }),
});
export type CrewPermits = z.infer<typeof CrewPermits>;

export const Schedule = z.object({
  schedule: z.array(
    z.object({
      day: z.number(),
      date: z.string().describe("Date, or 'Day 1' if not known"),
      sets: z.array(z.object({ time: z.string(), set: z.string(), scene: z.string(), int_ext: z.enum(["INT", "EXT"]), day_night: z.enum(["DAY", "NIGHT", "DUSK", "DAWN"]), shots: z.array(z.number()), cast: z.array(z.string()), props: z.array(z.string()), prep_minutes: z.number() })),
    }),
  ),
  call_sheets: z.array(
    z.object({
      day: z.number(),
      date: z.string(),
      crew_call: z.string(),
      client_call: z.string(),
      first_roll: z.string(),
      meals: z.string().describe("Breakfast, lunch or iftar times"),
      wrap: z.string(),
      sunrise: z.string(),
      sunset: z.string(),
      weather: z.string().describe("Expected weather, or 'Check the day before'"),
      locations: z.array(z.object({ name: z.string(), address: z.string(), map_link: z.string().describe("A Google Maps search link for the address"), parking: z.string(), contact: z.string() })),
      nearest_hospital: z.string(),
      safety: z.array(z.string()).describe("First aid on outdoor sets, site clean-up, labour-hour rules, heat safety, drone safety if used"),
    }),
  ),
});
export type Schedule = z.infer<typeof Schedule>;

type Ctx = { brief: unknown; path: string | null; language: string; modelId: string; plan: unknown; memory?: string[]; rules?: string[]; onStep?: (s: Step) => void; signal?: AbortSignal };

const system = (c: Ctx) => `${MENAB}\n${remembered(c.memory)}${lessons(c.rules)}`;
const base = (c: Ctx) =>
  `Brief: ${JSON.stringify(c.brief)}${typeGuide(c.brief as { video_type?: string })}\nPath: ${c.path ?? "production"}\nApproved plan (CPS, script, characters, wardrobe, locations, art direction, shot list): ${JSON.stringify(c.plan)}\nThis is a shoot in Saudi Arabia: follow GAMR and Saudi Film Commission rules, Sunday to Saturday weeks, Riyadh market rates in SAR. Write in: ${c.language}.`;
const ask = (what: string, instruction?: string, current?: unknown) =>
  instruction ? `Revise the ${what} with this change from the producer: "${instruction}". Keep the rest.\nCurrent: ${JSON.stringify(current)}` : `Write the ${what}.`;
const opts = (c: Ctx, maxTokens: number) => ({ effort: "low" as const, maxTokens, onStep: c.onStep, signal: c.signal, timeoutMs: 150_000 });

export function writeBudget(c: Ctx, instruction?: string, current?: unknown) {
  return structured(c.modelId, system(c), [{ role: "user", content: `${ask("budget and quote, and the equipment list", instruction, current)} Price every line; totals are qty x days x rate.\n\n${base(c)}` }], Budget, opts(c, 9000));
}

export function writeCrewPermits(c: Ctx, instruction?: string, current?: unknown) {
  return structured(c.modelId, system(c), [{ role: "user", content: `${ask("crew needs and the filming permit data", instruction, current)} Names and ID numbers of people are added by the producer, never by you.\n\n${base(c)}` }], CrewPermits, opts(c, 6000));
}

export function writeSchedule(c: Ctx, instruction?: string, current?: unknown) {
  return structured(c.modelId, system(c), [{ role: "user", content: `${ask("shooting schedule and one call sheet per shoot day", instruction, current)} Group shots by set to save moves; put exteriors at the right light.\n\n${base(c)}` }], Schedule, opts(c, 10000));
}

// Totals are recomputed by Menab, never trusted from the model.
export function budgetTotals(b: Budget["budget"]) {
  const lines = b.sections.flatMap((s) => s.items.map((i) => ({ ...i, total: Math.round((Number(i.qty) || 0) * (Number(i.days) || 1) * (Number(i.rate) || 0)) })));
  const subtotal = lines.reduce((n, i) => n + i.total, 0);
  const contingency = Math.round((subtotal * (Number(b.contingency_pct) || 0)) / 100);
  const fee = Math.round(((subtotal + contingency) * (Number(b.fee_pct) || 0)) / 100);
  const beforeVat = subtotal + contingency + fee;
  const vat = Math.round((beforeVat * 15) / 100);
  return { subtotal, contingency, fee, beforeVat, vat, total: beforeVat + vat };
}

export function fixBudget(d: Budget): Budget {
  return {
    ...d,
    budget: { ...d.budget, sections: d.budget.sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, total: Math.round((Number(i.qty) || 0) * (Number(i.days) || 1) * (Number(i.rate) || 0)) })) })) },
  };
}
