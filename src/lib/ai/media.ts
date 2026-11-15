// How Menab asks Kie.ai for video clips, voice, music and talking avatars (docs.kie.ai, checked
// 15 Nov 2026). Prices are Kie.ai's "from" prices, shown before an action; the real cost of
// every job is read back from Kie.ai afterwards.

import type { Aspect } from "./images";

export type ClipModel = { id: string; name: string; perSecond: number; fixedSeconds?: number; note: { en: string; ar: string } };

// Video models Menab can drive from a keyframe today. Kling 3.0 was tested in M1.
export const CLIP_MODELS: ClipModel[] = [
  { id: "kling-3-0", name: "Kling 3.0", perSecond: 0.07, note: { en: "Reliable default, 3 to 15 sec", ar: "الافتراضي الثابت، من ٣ إلى ١٥ ثانية" } },
  { id: "seedance-2-5", name: "Seedance 2.5", perSecond: 0.085, note: { en: "Strong motion, references", ar: "حركة قوية ومراجع" } },
  { id: "veo-3-1-fast", name: "Veo 3.1 Fast", perSecond: 0.325 / 8, fixedSeconds: 8, note: { en: "Veo look, 8 sec clips", ar: "شكل Veo، مقاطع ٨ ثواني" } },
];
export const DEFAULT_CLIP_MODEL = "kling-3-0";
export const clipModel = (id: string) => CLIP_MODELS.find((m) => m.id === id) ?? CLIP_MODELS[0];
export const clipBackup = (id: string) => (id === "kling-3-0" ? "seedance-2-5" : "kling-3-0");

export const clipSeconds = (modelId: string, seconds: number) => {
  const m = clipModel(modelId);
  if (m.fixedSeconds) return m.fixedSeconds;
  const lo = m.id === "seedance-2-5" ? 4 : 3;
  const hi = m.id === "seedance-2-5" ? 12 : 15;
  return Math.max(lo, Math.min(hi, Math.round(seconds || 5)));
};
export const clipPrice = (modelId: string, seconds: number) => clipSeconds(modelId, seconds) * clipModel(modelId).perSecond;

export function clipRequest(modelId: string, prompt: string, keyframe: string, seconds: number, aspect: Aspect): { kieModel: string; input: Record<string, unknown> } {
  const d = clipSeconds(modelId, seconds);
  switch (modelId) {
    case "seedance-2-5":
      // Kie.ai: a task that starts from a first frame only accepts "adaptive".
      return { kieModel: "bytedance/seedance-2-5", input: { prompt, first_frame_url: keyframe, generate_audio: false, resolution: "720p", aspect_ratio: "adaptive", duration: d } };
    case "veo-3-1-fast":
      return { kieModel: "veo-3-1", input: { prompt, model: "veo3_fast", image_urls: [keyframe], generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO", aspect_ratio: aspect === "1:1" ? "16:9" : aspect, resolution: "720p", enable_translation: false } };
    default:
      return { kieModel: "kling-3.0/video", input: { prompt, image_urls: [keyframe], sound: false, duration: String(d), aspect_ratio: aspect, mode: "std", multi_shots: false } };
  }
}

// ElevenLabs Multilingual v2 on Kie.ai: speaks Arabic and English with any of these voices.
export type Voice = { id: string; name: string; gender: "m" | "f"; tone: string };
export const VOICES: Voice[] = [
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "m", tone: "Deep, warm, comforting" },
  { id: "LruHrtVF6PSyGItzMNHS", name: "Benjamin", gender: "m", tone: "Deep, calm narrator" },
  { id: "gs0tAILXbY5DNrJrsM6F", name: "Jeff", gender: "m", tone: "Classy, strong" },
  { id: "UgBBYS2sOqTuMpoF3BR0", name: "Mark", gender: "m", tone: "Natural conversation" },
  { id: "DTKMou8ccj1ZaWGBiotd", name: "Jamahal", gender: "m", tone: "Young, vibrant" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "m", tone: "Energetic social creator" },
  { id: "8JVbfL6oEdmuxKn5DK2C", name: "Johnny Kid", gender: "m", tone: "Serious, calm narrator" },
  { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", gender: "f", tone: "Professional, bright, warm" },
  { id: "5l5f8iK3YPeGga21rQIX", name: "Adeline", gender: "f", tone: "Feminine, conversational" },
  { id: "BZgkqPqms7Kj9ulSkVzn", name: "Eve", gender: "f", tone: "Authentic, energetic" },
  { id: "kPzsL2i3teMYv0FxEYQ6", name: "Brittney", gender: "f", tone: "Social media, youthful" },
  { id: "1wGbFxmAM3Fgw63G1zZJ", name: "Allison", gender: "f", tone: "Calm, soothing" },
  { id: "6aDn1KB0hjpdcocrUkmq", name: "Tiffany", gender: "f", tone: "Natural, welcoming" },
];
export const voicePreview = (id: string) => `https://static.aiquickdraw.com/elevenlabs/voice/${id}.mp3`;
export const DEFAULT_NARRATOR = "nPczCjzI2devNBz1zQrb";
export const VOICE_PER_1K = 0.03;
export const voicePrice = (text: string) => Math.max(1, text.length) / 1000 * VOICE_PER_1K;

export function voiceRequest(text: string, voice: string) {
  return { kieModel: "elevenlabs/text-to-speech-multilingual-v2", input: { text: text.slice(0, 5000), voice: VOICES.some((v) => v.id === voice) ? voice : DEFAULT_NARRATOR, stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1 } };
}

// Suno on Kie.ai: an instrumental track from the music feeling of the visual mood.
export const MUSIC_PRICE = 0.06;
export function musicRequest(style: string, title: string, avoid?: string) {
  return { kieModel: "ai-music-api/generate", input: { custom_mode: true, instrumental: true, model: "V6", style: style.slice(0, 1000), title: title.slice(0, 80), ...(avoid ? { negative_tags: avoid.slice(0, 200) } : {}) } };
}
