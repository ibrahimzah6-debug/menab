import { ASPECTS, type Aspect } from "@/lib/ai/images";

// The frame shape a project is made in, decided once from the brief's formats: vertical for
// Instagram, TikTok, Snapchat, Stories, Reels and Shorts; square for 1:1; wide otherwise. Every
// later step (storyboard, keyframes, video shots) starts from it unless someone picks another.
export function aspectFromBrief(brief: { formats?: unknown; platforms?: unknown } | null | undefined): Aspect {
  const list = [brief?.formats, brief?.platforms].flatMap((x) => (Array.isArray(x) ? x : typeof x === "string" ? [x] : [])).map((x) => String(x).toLowerCase());
  const first = list[0] ?? "";
  const pick = (s: string): Aspect | null => {
    if (/9\s*:\s*16|vertical|reels?|stories|story|tiktok|snapchat|shorts|عمودي/.test(s)) return "9:16";
    if (/1\s*:\s*1|square|مربع/.test(s)) return "1:1";
    if (/16\s*:\s*9|youtube|tv|cinema|website|landscape|أفقي/.test(s)) return "16:9";
    if (/instagram/.test(s)) return "9:16";
    return null;
  };
  return pick(first) ?? list.map(pick).find(Boolean) ?? "16:9";
}

export function projectAspect(chosen: string | undefined | null, brief: Parameters<typeof aspectFromBrief>[0]): Aspect {
  return ASPECTS.includes(chosen as Aspect) ? (chosen as Aspect) : aspectFromBrief(brief);
}
