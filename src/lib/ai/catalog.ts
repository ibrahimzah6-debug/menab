// The models users can choose from, ranked 1 to 10 per task, with the starting price on Kie.ai.
// Users never see a provider's full catalog. Ranks start from public reputation and are
// updated from our own test scores. Prices are "from" prices read from kie.ai/pricing on
// 4 Nov 2026; every job also records its real cost.

export type CatalogModel = {
  id: string; // stable id stored in settings
  name: string;
  provider: "kie.ai";
  kieModel: string;
  priceFrom: number | null; // USD; null when Kie.ai lists no price yet
  unit: "image" | "second" | "video" | "1k characters";
  goodFor: { en: string; ar: string };
  tested?: boolean; // ran in Menab's own provider test
};

export const IMAGE_MODELS: CatalogModel[] = [
  { id: "nano-banana-pro", name: "Nano Banana Pro", provider: "kie.ai", kieModel: "nano-banana-pro", priceFrom: 0.09, unit: "image", goodFor: { en: "Best overall, keeps characters consistent", ar: "الأفضل عموماً، يحافظ على ثبات الشخصيات" } },
  { id: "gpt-image-2", name: "GPT Image 2", provider: "kie.ai", kieModel: "gpt-image-2-image-to-image", priceFrom: 0.03, unit: "image", goodFor: { en: "Follows instructions, text in images", ar: "يلتزم بالتعليمات، والنص داخل الصور" } },
  { id: "nano-banana-2", name: "Nano Banana 2", provider: "kie.ai", kieModel: "nano-banana-2", priceFrom: 0.04, unit: "image", goodFor: { en: "Fast everyday frames, good value", ar: "إطارات يومية سريعة بسعر مناسب" }, tested: true },
  { id: "seedream-5-pro", name: "Seedream 5 Pro", provider: "kie.ai", kieModel: "seedream/5-pro-image-to-image", priceFrom: 0.03, unit: "image", goodFor: { en: "Photoreal people and products", ar: "أشخاص ومنتجات بشكل واقعي" } },
  { id: "flux-2-pro", name: "Flux 2 Pro", provider: "kie.ai", kieModel: "flux-2/pro-image-to-image", priceFrom: 0.025, unit: "image", goodFor: { en: "Sharp commercial look", ar: "مظهر إعلاني حاد" } },
  { id: "wan-2-7-image-pro", name: "Wan 2.7 Image Pro", provider: "kie.ai", kieModel: "wan/2-7-image-pro", priceFrom: 0.06, unit: "image", goodFor: { en: "Cinematic stills", ar: "لقطات سينمائية" } },
  { id: "grok-imagine-image-2", name: "Grok Imagine Image 2.0", provider: "kie.ai", kieModel: "grok-imagine-image-2-0/image-to-image", priceFrom: 0.02, unit: "image", goodFor: { en: "Quick ideas and moods", ar: "أفكار ومود سريع" } },
  { id: "ideogram-v3", name: "Ideogram V3", provider: "kie.ai", kieModel: "ideogram/v3-text-to-image", priceFrom: 0.0175, unit: "image", goodFor: { en: "Posters and lettering", ar: "بوسترات وخطوط" } },
  { id: "seedream-5-flash", name: "Seedream 5 Flash", provider: "kie.ai", kieModel: "seedream/5-flash-image-to-image", priceFrom: 0.0162, unit: "image", goodFor: { en: "Cheap drafts", ar: "مسودات رخيصة" } },
  { id: "flux-3-klein", name: "Flux 3 Klein", provider: "kie.ai", kieModel: "flux-3/klein-edit-image", priceFrom: 0.008, unit: "image", goodFor: { en: "Cheapest sketches for storyboards", ar: "أرخص اسكتشات للستوري بورد" } },
];

export const VIDEO_MODELS: CatalogModel[] = [
  { id: "veo-3-1", name: "Veo 3.1", provider: "kie.ai", kieModel: "veo-3-1:veo3", priceFrom: 1.275, unit: "video", goodFor: { en: "Premium, real motion and sound", ar: "الأعلى جودة، حركة وصوت واقعي" } },
  { id: "kling-4-0", name: "Kling 4.0", provider: "kie.ai", kieModel: "kling-4.0/keyframe-to-video", priceFrom: 0.085, unit: "second", goodFor: { en: "Newest Kling, strong people", ar: "أحدث كلينق، قوي في الأشخاص" } },
  { id: "seedance-2-5", name: "Seedance 2.5", provider: "kie.ai", kieModel: "bytedance/seedance-2-5", priceFrom: 0.085, unit: "second", goodFor: { en: "Long shots up to 30 sec, references", ar: "لقطات طويلة حتى ٣٠ ثانية ومراجع" } },
  { id: "kling-3-0", name: "Kling 3.0", provider: "kie.ai", kieModel: "kling-3.0/video", priceFrom: 0.07, unit: "second", goodFor: { en: "Reliable default, tested in Menab", ar: "خيار ثابت، مجرّب في مِناب" }, tested: true },
  { id: "veo-3-1-fast", name: "Veo 3.1 Fast", provider: "kie.ai", kieModel: "veo-3-1:veo3_fast", priceFrom: 0.325, unit: "video", goodFor: { en: "Veo look at a lower price", ar: "شكل Veo بسعر أقل" } },
  { id: "seedance-2-0", name: "Seedance 2.0", provider: "kie.ai", kieModel: "bytedance/seedance-2", priceFrom: 0.057, unit: "second", goodFor: { en: "Multi-shot consistency", ar: "ثبات عبر عدة لقطات" } },
  { id: "hailuo-2-3", name: "Hailuo 2.3 Pro", provider: "kie.ai", kieModel: "hailuo/2-3-image-to-video-pro", priceFrom: 0.15, unit: "video", goodFor: { en: "Expressive faces", ar: "تعابير وجه قوية" } },
  { id: "vidu-q4", name: "Vidu Q4", provider: "kie.ai", kieModel: "vidu-q4/image-to-video", priceFrom: 0.036, unit: "second", goodFor: { en: "Smooth camera moves", ar: "حركة كاميرا ناعمة" } },
  { id: "pixverse-v6", name: "PixVerse V6", provider: "kie.ai", kieModel: "pixverse/image-to-video", priceFrom: 0.02, unit: "second", goodFor: { en: "Social clips, effects", ar: "مقاطع سوشال ومؤثرات" } },
  { id: "veo-3-1-lite", name: "Veo 3.1 Lite", provider: "kie.ai", kieModel: "veo-3-1:veo3_lite", priceFrom: 0.175, unit: "video", goodFor: { en: "Cheapest Veo for previews", ar: "أرخص Veo للمعاينات" } },
];

export const VOICE_MODELS: CatalogModel[] = [
  { id: "elevenlabs-multilingual-v2", name: "ElevenLabs Multilingual v2", provider: "kie.ai", kieModel: "elevenlabs/text-to-speech-multilingual-v2", priceFrom: null, unit: "1k characters", goodFor: { en: "Natural Arabic and English voiceover", ar: "تعليق صوتي طبيعي عربي وإنجليزي" } },
  { id: "elevenlabs-turbo-2-5", name: "ElevenLabs Turbo 2.5", provider: "kie.ai", kieModel: "elevenlabs/text-to-speech-turbo-2-5", priceFrom: null, unit: "1k characters", goodFor: { en: "Fast drafts of the voiceover", ar: "مسودات سريعة للتعليق" } },
  { id: "gemini-tts", name: "Gemini 3.1 Flash TTS", provider: "kie.ai", kieModel: "gemini-3-1-flash-tts", priceFrom: null, unit: "1k characters", goodFor: { en: "Cheapest temp voice", ar: "أرخص صوت مؤقت" } },
];

export const CATALOG = { image: IMAGE_MODELS, video: VIDEO_MODELS, voice: VOICE_MODELS } as const;
export type ModelTask = keyof typeof CATALOG;

// Menab's defaults until a workspace picks its own.
export const DEFAULT_MODEL: Record<ModelTask, string> = {
  image: "nano-banana-2",
  video: "kling-3-0",
  voice: "elevenlabs-multilingual-v2",
};

// Writing models (briefs, scripts, documents), ranked. Prices per million tokens from Anthropic.
export type TextModel = {
  id: string;
  name: string;
  // Price per million tokens, used only for the estimate shown before an action.
  // The real cost of each call is read back from Kie.ai.
  usdPerMillionIn: number;
  usdPerMillionOut: number;
  provider: "kie-claude" | "kie-gpt";
  goodFor: { en: string; ar: string };
};

// Writing models, strongest first. All run through Kie.ai with one key.
export const TEXT_MODELS: TextModel[] = [
  { id: "claude-fable-5", name: "Claude Fable 5", usdPerMillionIn: 4, usdPerMillionOut: 20, provider: "kie-claude", goodFor: { en: "Strongest thinking, for the hardest briefs", ar: "أقوى تفكير، لأصعب البريفات" } },
  { id: "gpt-6-astra", name: "GPT 6 Astra", usdPerMillionIn: 10, usdPerMillionOut: 50, provider: "kie-gpt", goodFor: { en: "OpenAI's strongest, a second opinion on big ideas", ar: "أقوى نماذج OpenAI، رأي ثاني للأفكار الكبيرة" } },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", usdPerMillionIn: 1.6, usdPerMillionOut: 8, provider: "kie-claude", goodFor: { en: "Best balance for briefs, scripts and treatments", ar: "أفضل توازن للبريف والسكربت ورؤية المخرج" } },
  { id: "gpt-6-1-sol", name: "GPT 6.1 Sol", usdPerMillionIn: 2, usdPerMillionOut: 10, provider: "kie-gpt", goodFor: { en: "Strong all-rounder from OpenAI", ar: "نموذج قوي وشامل من OpenAI" } },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", usdPerMillionIn: 0.8, usdPerMillionOut: 4, provider: "kie-claude", goodFor: { en: "Fast and strong, half the price", ar: "سريع وقوي بنص السعر" } },
  { id: "gpt-6-1-terra", name: "GPT 6.1 Terra", usdPerMillionIn: 1, usdPerMillionOut: 5, provider: "kie-gpt", goodFor: { en: "Medium: good quality at a lower price", ar: "متوسط: جودة حلوة بسعر أقل" } },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", usdPerMillionIn: 0.06, usdPerMillionOut: 0.3, provider: "kie-claude", goodFor: { en: "Quick drafts for very little", ar: "مسودات سريعة بسعر بسيط" } },
  { id: "gpt-6-luna", name: "GPT 6 Luna", usdPerMillionIn: 0.1, usdPerMillionOut: 0.5, provider: "kie-gpt", goodFor: { en: "Lightest and cheapest", ar: "الأخف والأرخص" } },
];

export const DEFAULT_TEXT_MODEL = "claude-opus-5-5";

export function textModel(id: string | null | undefined) {
  // A model that left the list (like the Gemini writing models) falls back to the default.
  return TEXT_MODELS.find((m) => m.id === id) ?? TEXT_MODELS.find((m) => m.id === DEFAULT_TEXT_MODEL)!;
}
// Typical token use per action, to show the price before it runs.
export const TYPICAL_TOKENS = {
  briefTurn: { in: 4000, out: 1500 },
  stageOne: { in: 3000, out: 6000 },
  directions: { in: 4000, out: 3000 },
  // Script, treatment and visual mood together, written after a direction is chosen.
  creativeBuild: { in: 15000, out: 9000 },
  revise: { in: 6000, out: 3000 },
} as const;
export function estimateUsd(modelId: string, action: keyof typeof TYPICAL_TOKENS) {
  const m = textModel(modelId);
  const t = TYPICAL_TOKENS[action];
  return (t.in * m.usdPerMillionIn + t.out * m.usdPerMillionOut) / 1_000_000;
}


export const TRANSCRIBER = {
  provider: "kie.ai",
  model: "gemini-3-8-flash",
  label: "Gemini 3.5 Transcribe (Google, free tier)",
  // kie.ai/pricing lists "from $0.225 per million tokens"; used for both directions as an estimate.
  usdPerMillion: 0.225,
} as const;

export function formatPrice(m: CatalogModel, locale: "en" | "ar") {
  if (m.priceFrom == null) return locale === "ar" ? "السعر يظهر عند الربط" : "Price shown once connected";
  const n = m.priceFrom < 0.1 ? m.priceFrom.toFixed(3) : m.priceFrom.toFixed(2);
  const unit =
    locale === "ar"
      ? { image: "للصورة", second: "للثانية", video: "للمقطع", "1k characters": "لكل ١٠٠٠ حرف" }[m.unit]
      : { image: "per image", second: "per second", video: "per clip", "1k characters": "per 1k characters" }[m.unit];
  return `⁦$${n}⁩ ${unit}`;
}
