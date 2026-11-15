import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { frameImages, lookImages, lookKey } from "@/lib/frames";
import { hiddenOutputs } from "@/lib/video-types";
import { getMemberships } from "@/lib/workspace";

// Everything a branded document needs: the project, its stage 3 documents and pictures, and the
// company's brand kit. Without a brand kit, the neutral Menab kit is used (B25), never ZAH's.

export type Brand = { name: string; logo: string | null; accent: string; ink: string; paper: string; isMenab: boolean };
export type DeckCharacter = { name: string; role: string; age: string; look: string; personality: string; made_with: string; plan_a: string; plan_b: string; picture: string | null; wardrobe: { scene: string; outfit: string; continuity: string }[] };
export type DeckLocation = { name: string; int_ext: string; description: string; made_with: string; options: string[]; picture: string | null; dressing: string; props: string[] };
export type DeckFrame = { n: number; scene: string; size: string; angle: string; movement: string; lens: string; action: string; dialogue: string; seconds: number; picture: string | null };

const MENAB: Omit<Brand, "logo" | "name"> = { accent: "#141414", ink: "#141414", paper: "#FAF9F7", isMenab: true };
const HEX = /^#?([0-9a-f]{6})$/i;

// A brand colour dark or strong enough to read on white paper.
function usable(hex: string) {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return light < 0.72 ? `#${m[1].toUpperCase()}` : null;
}

export async function loadDeck(projectId: string) {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, workspace_id, name, client, brief, current_stage").eq("id", projectId).maybeSingle();
  if (!project) return null;
  const me = (await getMemberships()).find((m) => m.workspace.id === project.workspace_id);
  if (!me) return null;

  const [{ data: outs }, { data: kits }] = await Promise.all([
    supabase.from("outputs").select("id, number, status, current_version, updated_at").eq("project_id", projectId).in("number", [13, 14, 15, 16, 17]),
    supabase.from("brand_kits").select("name, logo_path, colors").eq("workspace_id", project.workspace_id).order("created_at", { ascending: true }).limit(1),
  ]);
  const withV = (outs ?? []).filter((o) => o.current_version > 0);
  const { data: versions } = withV.length ? await supabase.from("versions").select("output_id, version, content").in("output_id", withV.map((o) => o.id)) : { data: [] };
  const content = (n: number) => {
    const o = withV.find((x) => x.number === n);
    return o ? (versions?.find((v) => v.output_id === o.id && v.version === o.current_version)?.content as Record<string, unknown> | undefined) : undefined;
  };

  // Brand kit, or the neutral Menab kit.
  const kit = kits?.[0];
  let logo: string | null = null;
  if (kit?.logo_path && kit.logo_path.startsWith(`${project.workspace_id}/`) && !kit.logo_path.includes("..")) {
    try {
      logo = (await createAdminClient().storage.from("media").createSignedUrl(kit.logo_path, 3600)).data?.signedUrl ?? null;
    } catch {
      logo = null;
    }
  }
  const accent = (kit?.colors ?? []).map(usable).find(Boolean) ?? null;
  const brand: Brand = kit ? { name: kit.name, logo, accent: accent ?? MENAB.accent, ink: MENAB.ink, paper: "#FFFFFF", isMenab: false } : { name: me.workspace.name, logo: null, ...MENAB };

  const [frames, pictures] = await Promise.all([frameImages(projectId, project.workspace_id, supabase), lookImages(projectId, project.workspace_id, supabase)]);
  const hidden = hiddenOutputs(project.brief as { video_type?: string; real_people?: string });

  const wardrobe = ((content(14)?.wardrobe as { character: string; scene: string; outfit: string; continuity: string }[] | undefined) ?? []);
  const art = ((content(16)?.art as { set: string; dressing: string; props: string[] }[] | undefined) ?? []);
  const characters: DeckCharacter[] = hidden.has(13)
    ? []
    : ((content(13)?.characters as Omit<DeckCharacter, "picture" | "wardrobe">[] | undefined) ?? []).map((c) => ({
        ...c,
        picture: pictures[`character:${lookKey(c.name)}`]?.url ?? null,
        wardrobe: wardrobe.filter((w) => lookKey(w.character) === lookKey(c.name)),
      }));
  const locations: DeckLocation[] = hidden.has(15)
    ? []
    : ((content(15)?.locations as Omit<DeckLocation, "picture" | "dressing" | "props">[] | undefined) ?? []).map((l) => {
        const a = art.find((x) => lookKey(x.set) === lookKey(l.name));
        return { ...l, picture: pictures[`location:${lookKey(l.name)}`]?.url ?? null, dressing: a?.dressing ?? "", props: a?.props ?? [] };
      });
  const storyboard: DeckFrame[] = hidden.has(17)
    ? []
    : ((content(17)?.frames as Omit<DeckFrame, "picture">[] | undefined) ?? []).map((f) => ({ ...f, picture: frames[f.n]?.url ?? null }));

  const updated = (outs ?? []).map((o) => o.updated_at as string).sort().pop() ?? null;
  return { project, brand, characters, locations, storyboard, updated, hidden };
}
