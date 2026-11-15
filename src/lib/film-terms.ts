// The standard choices for shots, characters and locations, in English and Arabic. The English
// name is what is saved, so the AI and every screen read the same words. Anything else can still
// be typed with "Other".

export type TermKind = "size" | "angle" | "movement" | "lens" | "intExt" | "dayNight" | "castMade" | "placeMade";
export type Term = { id: string; en: string; ar: string; note?: { en: string; ar: string }; also?: string[] };

export const TERMS: Record<TermKind, Term[]> = {
  size: [
    { id: "Extreme wide", en: "Extreme wide", ar: "واسعة جداً", also: ["ews", "ews", "extreme long shot", "els"] },
    { id: "Wide", en: "Wide", ar: "واسعة", also: ["ws", "long shot", "ls", "wide shot", "establishing"] },
    { id: "Full", en: "Full", ar: "كاملة", also: ["full shot", "fs"] },
    { id: "Medium wide", en: "Medium wide", ar: "متوسطة واسعة", also: ["mws", "cowboy"] },
    { id: "Medium", en: "Medium", ar: "متوسطة", also: ["ms", "mid shot", "medium shot"] },
    { id: "Medium close-up", en: "Medium close-up", ar: "متوسطة قريبة", also: ["mcu"] },
    { id: "Close-up", en: "Close-up", ar: "قريبة", also: ["cu", "close up", "closeup"] },
    { id: "Extreme close-up", en: "Extreme close-up", ar: "قريبة جداً", also: ["ecu", "xcu", "extreme close up"] },
    { id: "Insert", en: "Insert", ar: "تفصيلية", also: ["insert shot", "detail"] },
    { id: "Over the shoulder", en: "Over the shoulder", ar: "من فوق الكتف", also: ["ots", "over-the-shoulder"] },
    { id: "Two shot", en: "Two shot", ar: "لقطة لشخصين", also: ["two-shot", "2 shot"] },
    { id: "POV", en: "Point of view", ar: "منظور الشخصية", also: ["pov", "point of view"] },
  ],
  angle: [
    { id: "Eye level", en: "Eye level", ar: "مستوى العين", also: ["eye-level"] },
    { id: "Low angle", en: "Low angle", ar: "زاوية منخفضة", also: ["low"] },
    { id: "High angle", en: "High angle", ar: "زاوية عالية", also: ["high"] },
    { id: "Top down", en: "Top down", ar: "من الأعلى", also: ["overhead", "bird's eye", "birds eye", "top-down"] },
    { id: "Dutch", en: "Dutch angle", ar: "مائلة", also: ["dutch angle", "canted", "tilted"] },
    { id: "Ground level", en: "Ground level", ar: "من الأرض", also: ["worm's eye", "worms eye", "ground"] },
  ],
  movement: [
    { id: "Static", en: "Static", ar: "ثابتة", also: ["locked off", "still", "tripod"] },
    { id: "Pan", en: "Pan", ar: "بان أفقي", also: ["pan left", "pan right"] },
    { id: "Tilt", en: "Tilt", ar: "تلت عمودي", also: ["tilt up", "tilt down"] },
    { id: "Push in", en: "Push in", ar: "اقتراب", also: ["push-in", "dolly in", "slow push"] },
    { id: "Pull out", en: "Pull out", ar: "ابتعاد", also: ["pull-out", "dolly out", "pull back"] },
    { id: "Dolly", en: "Dolly", ar: "دولي", also: [] },
    { id: "Tracking", en: "Tracking", ar: "تتبّع", also: ["track", "follow", "trucking"] },
    { id: "Crane", en: "Crane", ar: "كرين", also: ["jib", "boom"] },
    { id: "Handheld", en: "Handheld", ar: "محمولة باليد", also: ["hand held", "hand-held"] },
    { id: "Gimbal", en: "Gimbal", ar: "جيمبل", also: ["steadicam", "stabilized"] },
    { id: "Drone", en: "Drone", ar: "درون", also: ["aerial"] },
    { id: "Zoom", en: "Zoom", ar: "زووم", also: ["zoom in", "zoom out"] },
    { id: "Orbit", en: "Orbit", ar: "دوران حول الشخص", also: ["arc", "360"] },
  ],
  lens: [
    { id: "14mm", en: "14mm", ar: "14mm", note: { en: "Ultra wide", ar: "واسعة جداً" } },
    { id: "24mm", en: "24mm", ar: "24mm", note: { en: "Wide", ar: "واسعة" } },
    { id: "35mm", en: "35mm", ar: "35mm", note: { en: "Natural wide", ar: "واسعة طبيعية" } },
    { id: "50mm", en: "50mm", ar: "50mm", note: { en: "Like the eye", ar: "مثل العين" } },
    { id: "85mm", en: "85mm", ar: "85mm", note: { en: "Portrait", ar: "بورتريه" } },
    { id: "100mm macro", en: "100mm macro", ar: "100mm ماكرو", note: { en: "Tiny details", ar: "تفاصيل صغيرة" }, also: ["macro", "100mm"] },
    { id: "135mm", en: "135mm", ar: "135mm", note: { en: "Telephoto", ar: "تيليفوتو" } },
  ],
  intExt: [
    { id: "INT", en: "Interior", ar: "داخلي", also: ["interior", "int."] },
    { id: "EXT", en: "Exterior", ar: "خارجي", also: ["exterior", "ext."] },
  ],
  dayNight: [
    { id: "DAY", en: "Day", ar: "نهار" },
    { id: "NIGHT", en: "Night", ar: "ليل" },
    { id: "DUSK", en: "Dusk", ar: "غروب", also: ["sunset", "golden hour", "evening"] },
    { id: "DAWN", en: "Dawn", ar: "فجر", also: ["sunrise", "morning"] },
  ],
  castMade: [
    { id: "cast", en: "Cast an actor", ar: "ممثل حقيقي" },
    { id: "ai", en: "AI character", ar: "شخصية AI" },
  ],
  placeMade: [
    { id: "real", en: "Real place to scout", ar: "مكان حقيقي نستكشفه" },
    { id: "ai", en: "AI place", ar: "مكان AI" },
  ],
};

// Finds the standard choice a written value means ("CU", "close up" and "Close-up" are one).
export function findTerm(kind: TermKind, value: string | null | undefined): Term | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return undefined;
  return TERMS[kind].find((t) => [t.id, t.en, t.ar, ...(t.also ?? [])].some((x) => x.toLowerCase() === v));
}

// The allowed words, for the AI's instructions.
export const termList = (kind: TermKind) => TERMS[kind].map((t) => t.id).join(", ");
