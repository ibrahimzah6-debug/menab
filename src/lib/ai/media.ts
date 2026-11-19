// How Menab asks Kie.ai for video clips, voice, music and talking avatars (docs.kie.ai, checked
// 19 Nov 2026). Prices are Kie.ai's prices at the resolution Menab uses, shown before an action;
// the real cost of every job is read back from Kie.ai afterwards.

import type { Aspect } from "./images";

// "talking" models move the lips to a voice line (lip-sync); they need the shot's dialogue audio.
export type ClipModel = { id: string; name: string; perSecond: number; min: number; max: number; fixedSeconds?: number; talking?: boolean; note: { en: string; ar: string } };

// Video models Menab drives from a keyframe (the shot's first picture). Kling 3.0 was tested in M1.
export const CLIP_MODELS: ClipModel[] = [
  { id: "kling-3-0", name: "Kling 3.0", perSecond: 0.0755, min: 3, max: 15, note: { en: "Reliable default, 720p", ar: "الافتراضي الثابت، 720p" } },
  { id: "kling-4-0", name: "Kling 4.0", perSecond: 0.1425, min: 3, max: 30, note: { en: "Newest Kling, best detail, up to 30 sec", ar: "أحدث Kling، أدق تفاصيل، حتى ٣٠ ثانية" } },
  { id: "kling-4-0-flash", name: "Kling 4.0 Flash", perSecond: 0.085, min: 3, max: 20, note: { en: "Kling 4.0 quality, faster and cheaper", ar: "جودة Kling 4.0، أسرع وأرخص" } },
  { id: "seedance-2-5", name: "Seedance 2.5", perSecond: 0.315, min: 4, max: 12, note: { en: "Strong motion, 720p", ar: "حركة قوية، 720p" } },
  { id: "seedance-2-5-flash", name: "Seedance 2.5 Flash", perSecond: 0.0575, min: 4, max: 30, note: { en: "Fast drafts, 480p", ar: "مسودات سريعة، 480p" } },
  { id: "veo-3-1-fast", name: "Veo 3.1 Fast", perSecond: 0.05, min: 8, max: 8, fixedSeconds: 8, note: { en: "Google Veo look, 8 sec", ar: "شكل Google Veo، ٨ ثواني" } },
  { id: "veo-3-1", name: "Veo 3.1 Quality", perSecond: 0.25, min: 8, max: 8, fixedSeconds: 8, note: { en: "Google's top quality, 8 sec", ar: "أعلى جودة من Google، ٨ ثواني" } },
  { id: "gemini-omni-1-2", name: "Gemini Omni 1.2 Flash", perSecond: 0.07, min: 3, max: 15, note: { en: "Google's newest, natural motion", ar: "الأحدث من Google، حركة طبيعية" } },
  { id: "wan-3-0", name: "Wan 3.0", perSecond: 0.08, min: 2, max: 30, note: { en: "Good value, 720p", ar: "سعر مناسب، 720p" } },
  { id: "grok-imagine-1-5", name: "Grok Imagine 1.5", perSecond: 0.03, min: 1, max: 15, note: { en: "Cheap quick ideas", ar: "أفكار سريعة ورخيصة" } },
  { id: "pixverse-v6", name: "PixVerse V6", perSecond: 0.04, min: 1, max: 15, note: { en: "Stylised, uses the frame as a reference", ar: "طابع فني، يستخدم الصورة كمرجع" } },
  { id: "kling-avatar", name: "Kling AI Avatar Pro", perSecond: 0.0505, min: 1, max: 60, talking: true, note: { en: "Talking to camera, lip-sync", ar: "يتكلم للكاميرا، مزامنة الشفايف" } },
  { id: "infinitalk", name: "Infinitalk", perSecond: 0.015, min: 1, max: 60, talking: true, note: { en: "Cheaper lip-sync, 480p", ar: "مزامنة شفايف أرخص، 480p" } },
];
export const DEFAULT_CLIP_MODEL = "kling-3-0";
// Shots where a character speaks on camera use this, with the shot's dialogue line.
export const DEFAULT_TALKING_MODEL = "kling-avatar";
export const clipModel = (id: string) => CLIP_MODELS.find((m) => m.id === id) ?? CLIP_MODELS[0];
export const clipBackup = (id: string) =>
  id === "kling-avatar" ? "infinitalk" : id === "infinitalk" ? "kling-avatar" : id === "kling-3-0" ? "kling-4-0-flash" : "kling-3-0";

export const clipSeconds = (modelId: string, seconds: number) => {
  const m = clipModel(modelId);
  if (m.fixedSeconds) return m.fixedSeconds;
  return Math.max(m.min, Math.min(m.max, Math.round(seconds || 5)));
};
export const clipPrice = (modelId: string, seconds: number) => clipSeconds(modelId, seconds) * clipModel(modelId).perSecond;

export function clipRequest(modelId: string, prompt: string, keyframe: string, seconds: number, aspect: Aspect, audio?: string | null): { kieModel: string; input: Record<string, unknown> } | null {
  const d = clipSeconds(modelId, seconds);
  const wide = aspect === "1:1" ? "1:1" : aspect;
  switch (modelId) {
    case "kling-avatar":
      return audio ? { kieModel: "kling/ai-avatar-pro", input: { image_url: keyframe, audio_url: audio, prompt } } : null;
    case "infinitalk":
      return audio ? { kieModel: "infinitalk/from-audio", input: { image_url: keyframe, audio_url: audio, prompt, resolution: "480p", seed: Math.floor(Math.random() * 1_000_000) } } : null;
    case "kling-4-0":
      return { kieModel: "kling-4.0/keyframe-to-video", input: { prompt: `${prompt}\n\nREFERENCES: @first_frame is the exact opening frame.`, first_frame_url: keyframe, duration: d, resolution: "720p" } };
    case "kling-4-0-flash":
      return { kieModel: "kling-4.0/flash-keyframe-to-video", input: { prompt: `${prompt}\n\nREFERENCES: @first_frame is the exact opening frame.`, first_frame_url: keyframe, duration: d, resolution: "720p", aspect_ratio: wide } };
    case "seedance-2-5":
      // Kie.ai: a task that starts from a first frame only accepts "adaptive".
      return { kieModel: "bytedance/seedance-2-5", input: { prompt, first_frame_url: keyframe, generate_audio: false, resolution: "720p", aspect_ratio: "adaptive", duration: d } };
    case "seedance-2-5-flash":
      return { kieModel: "bytedance/seedance-2-5-flash", input: { prompt, first_frame_url: keyframe, generate_audio: false, resolution: "480p", aspect_ratio: "adaptive", duration: d } };
    case "veo-3-1-fast":
    case "veo-3-1":
      return { kieModel: "veo-3-1", input: { prompt, model: modelId === "veo-3-1" ? "veo3" : "veo3_fast", image_urls: [keyframe], generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO", aspect_ratio: aspect === "1:1" ? "16:9" : aspect, resolution: "720p", enable_translation: false } };
    case "gemini-omni-1-2":
      return { kieModel: "google/gemini-omni-flash-1-2", input: { prompt, first_frame_url: keyframe, duration: d, aspect_ratio: aspect === "1:1" ? "auto" : aspect, resolution: "720p" } };
    case "wan-3-0":
      return { kieModel: "wan/3-0-video", input: { prompt, first_frame_url: keyframe, resolution: "720P", aspect_ratio: "adaptive", duration: d, audio: false } };
    case "grok-imagine-1-5":
      return { kieModel: "grok-imagine-video-1-5-preview", input: { prompt, image_urls: [keyframe], aspect_ratio: wide, resolution: "720p", duration: d, enable_audio: false } };
    case "pixverse-v6":
      return { kieModel: "pixverse-v6/reference-to-video", input: { prompt, image_references: [{ image_url: keyframe }], duration: d, quality: "720p", aspect_ratio: wide, generate_audio_switch: false } };
    default:
      return { kieModel: "kling-3.0/video", input: { prompt, image_urls: [keyframe], sound: false, duration: String(d), aspect_ratio: wide, mode: "std", multi_shots: false } };
  }
}

// ---------- Voices ----------

// Main voice model: Google Gemini 3.8 Flash TTS on Kie.ai. It speaks over 100 languages (Arabic
// with Saudi dialects, Amharic, Urdu, English, French ...), each line with a style written in
// plain words ("a young Riyadh woman, Najdi dialect, warm and casual"). Tested 19 Nov 2026: a
// natural Saudi accent and natural Amharic. These are its 30 voices with a known tone.
export type Voice = { id: string; name: string; gender: "m" | "f"; tone: string };
export const VOICES: Voice[] = [
  { id: "Sulafat", name: "Sulafat", gender: "f", tone: "Warm" },
  { id: "Leda", name: "Leda", gender: "f", tone: "Youthful" },
  { id: "Laomedeia", name: "Laomedeia", gender: "f", tone: "Upbeat" },
  { id: "Aoede", name: "Aoede", gender: "f", tone: "Breezy" },
  { id: "Callirrhoe", name: "Callirrhoe", gender: "f", tone: "Easy-going" },
  { id: "Zephyr", name: "Zephyr", gender: "f", tone: "Bright" },
  { id: "Autonoe", name: "Autonoe", gender: "f", tone: "Bright" },
  { id: "Kore", name: "Kore", gender: "f", tone: "Firm" },
  { id: "Despina", name: "Despina", gender: "f", tone: "Smooth" },
  { id: "Erinome", name: "Erinome", gender: "f", tone: "Clear" },
  { id: "Achernar", name: "Achernar", gender: "f", tone: "Soft" },
  { id: "Vindemiatrix", name: "Vindemiatrix", gender: "f", tone: "Gentle" },
  { id: "Gacrux", name: "Gacrux", gender: "f", tone: "Mature" },
  { id: "Pulcherrima", name: "Pulcherrima", gender: "f", tone: "Forward" },
  { id: "Achird", name: "Achird", gender: "m", tone: "Friendly" },
  { id: "Puck", name: "Puck", gender: "m", tone: "Upbeat" },
  { id: "Sadachbia", name: "Sadachbia", gender: "m", tone: "Lively" },
  { id: "Fenrir", name: "Fenrir", gender: "m", tone: "Excitable" },
  { id: "Zubenelgenubi", name: "Zubenelgenubi", gender: "m", tone: "Casual" },
  { id: "Umbriel", name: "Umbriel", gender: "m", tone: "Easy-going" },
  { id: "Algieba", name: "Algieba", gender: "m", tone: "Smooth" },
  { id: "Iapetus", name: "Iapetus", gender: "m", tone: "Clear" },
  { id: "Charon", name: "Charon", gender: "m", tone: "Informative" },
  { id: "Rasalgethi", name: "Rasalgethi", gender: "m", tone: "Informative" },
  { id: "Sadaltager", name: "Sadaltager", gender: "m", tone: "Knowledgeable" },
  { id: "Schedar", name: "Schedar", gender: "m", tone: "Even" },
  { id: "Orus", name: "Orus", gender: "m", tone: "Firm" },
  { id: "Alnilam", name: "Alnilam", gender: "m", tone: "Firm" },
  { id: "Enceladus", name: "Enceladus", gender: "m", tone: "Breathy" },
  { id: "Algenib", name: "Algenib", gender: "m", tone: "Gravelly" },
];
export const DEFAULT_NARRATOR = "Charon";
export const isVoice = (id: string | undefined) => Boolean(id && VOICES.some((v) => v.id === id));

// About $0.002 for a short line (0.32 credits measured), more for long ones.
export const voicePrice = (text: string) => Math.max(0.002, (Math.max(1, text.length) / 1000) * 0.012);

// The dialect and manner a line is spoken in, from the project language.
export function dialectFor(language: string | null | undefined) {
  const l = (language ?? "").toLowerCase();
  if (l.includes("saudi") || l.includes("سعود")) return "natural Saudi dialect as spoken in Riyadh (Najdi), not Modern Standard Arabic, not Egyptian";
  if (l.includes("gulf") || l.includes("خليج")) return "natural Gulf Arabic dialect, not Modern Standard Arabic";
  if (l.includes("arab") || l.includes("عرب")) return "natural Saudi Arabic as spoken in Riyadh, not Egyptian";
  if (l.includes("amhar")) return "natural Ethiopian Amharic as spoken in Addis Ababa";
  if (l.includes("urdu")) return "natural Urdu";
  if (l.includes("french")) return "natural French";
  return "natural, clear English";
}

// A voice that fits a character: women and men by the words that describe them, then the tone
// by their personality. A suggestion only; anyone can pick another.
export function suggestVoice(c: { name?: string; role?: string; look?: string; personality?: string; age?: string }): string {
  const text = `${c.name ?? ""} ${c.role ?? ""} ${c.look ?? ""} ${c.age ?? ""}`.toLowerCase();
  // Name and role first ("Abu Faisal", "father"), then the look. Whole words only, so "father" never reads as "her".
  const who = `${c.name ?? ""} ${c.role ?? ""}`.toLowerCase();
  const maleRe = /\b(man|men|boy|male|father|dad|husband|brother|son|uncle|grandfather|he|his|him|mr)\b|(^|\s)(أبو|ابو|رجل|ولد|شاب|أب|زوج|أخ|عم|خال|جد|السيد)(\s|$)/;
  const femaleRe = /\b(woman|women|girl|female|mother|mom|wife|lady|sister|daughter|aunt|grandmother|she|her|mrs|ms)\b|(^|\s)(أم|ام|امرأة|فتاة|بنت|سيدة|زوجة|أخت|عمة|خالة|جدة|صانعة|طالبة|موظفة|مذيعة|ممثلة|شابة)(\s|$)/;
  const female = maleRe.test(who) ? false : femaleRe.test(who) || /ة(\s|$)/.test(who) ? true : !maleRe.test(text) && femaleRe.test(text);
  const p = `${c.personality ?? ""} ${c.role ?? ""}`.toLowerCase();
  const pick = (list: string[]) => list.find((id) => isVoice(id)) ?? (female ? "Sulafat" : "Achird");
  if (/(energ|excit|lively|حماس|نشيط|نشيطة)/.test(p)) return pick(female ? ["Laomedeia"] : ["Puck"]);
  if (/(young|youth|teen|شاب|شابة|مراهق)/.test(`${p} ${text}`)) return pick(female ? ["Leda"] : ["Sadachbia"]);
  if (/(calm|soft|gentle|هاد|هادئ|هادئة|ناعم)/.test(p)) return pick(female ? ["Vindemiatrix"] : ["Umbriel"]);
  if (/(serious|expert|doctor|professional|جاد|خبير|دكتور|طبيب|مهني)/.test(p)) return pick(female ? ["Kore"] : ["Charon"]);
  if (/(casual|friend|عفوي|عفوية|صديق|قريب|قريبة)/.test(p)) return pick(female ? ["Callirrhoe"] : ["Zubenelgenubi"]);
  return female ? "Sulafat" : "Achird";
}

export function voiceRequest(text: string, voice: string, style: string) {
  return {
    kieModel: "google/gemini-3-8-flash-tts",
    input: {
      speakers: [{ speaker_id: "Speaker 1", voice_name: isVoice(voice) ? voice : DEFAULT_NARRATOR }],
      dialogue_turns: [{ speaker_id: "Speaker 1", text: text.slice(0, 5000), style: style.slice(0, 600) }],
    },
  };
}

// Backup voice when Gemini fails: ElevenLabs Multilingual v2 (English-accented in Arabic).
export function voiceBackupRequest(text: string, voice: string) {
  const female = VOICES.find((v) => v.id === voice)?.gender === "f";
  return { kieModel: "elevenlabs/text-to-speech-multilingual-v2", input: { text: text.slice(0, 5000), voice: female ? "hpp4J3VqNfWAUOO0d1Us" : "nPczCjzI2devNBz1zQrb", stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1 } };
}

// Suno on Kie.ai: an instrumental track from the music feeling of the visual mood.
export const MUSIC_PRICE = 0.06;
export function musicRequest(style: string, title: string, avoid?: string) {
  return { kieModel: "ai-music-api/generate", input: { custom_mode: true, instrumental: true, model: "V6", style: style.slice(0, 1000), title: title.slice(0, 80), ...(avoid ? { negative_tags: avoid.slice(0, 200) } : {}) } };
}
