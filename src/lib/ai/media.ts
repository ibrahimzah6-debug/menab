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
  // Kie.ai: Pro is 1080p at 20.2 credits a second, Standard is 720p at 10.1. Tested 19 Nov 2026:
  // Pro made a 6.6 second talking clip in about 4 minutes. Infinitalk failed on Kie's side
  // (it could not fetch even Kie's own example files), so it is not offered.
  { id: "kling-avatar", name: "Kling AI Avatar Pro", perSecond: 0.101, min: 1, max: 60, talking: true, note: { en: "Best lip-sync, 1080p", ar: "أفضل مزامنة شفايف، 1080p" } },
  { id: "kling-avatar-std", name: "Kling AI Avatar Standard", perSecond: 0.0505, min: 1, max: 60, talking: true, note: { en: "Same lip-sync, 720p, half the price", ar: "نفس المزامنة، 720p، بنص السعر" } },
];
export const DEFAULT_CLIP_MODEL = "kling-3-0";
// Shots where a character speaks on camera use this, with the shot's dialogue line.
export const DEFAULT_TALKING_MODEL = "kling-avatar";
export const clipModel = (id: string) => CLIP_MODELS.find((m) => m.id === id) ?? CLIP_MODELS[0];
export const clipBackup = (id: string) =>
  id === "kling-avatar" ? "kling-avatar-std" : id === "kling-avatar-std" ? "kling-avatar" : id === "kling-3-0" ? "kling-4-0-flash" : "kling-3-0";

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
    case "kling-avatar-std":
      return audio ? { kieModel: "kling/ai-avatar-standard", input: { image_url: keyframe, audio_url: audio, prompt } } : null;
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
// Gemini 3.8 voices, each with a plain description so anyone can choose without knowing the names.
export type Voice = { id: string; name: string; gender: "m" | "f"; tone: string; desc: { en: string; ar: string } };
const v = (id: string, gender: "m" | "f", tone: string, en: string, ar: string): Voice => ({ id, name: id, gender, tone, desc: { en, ar } });
export const VOICES: Voice[] = [
  v("Kore", "f", "Firm", "Confident young woman, clear. Good for content creators and ads", "شابة واثقة وواضحة. مناسبة لصانعات المحتوى والإعلانات"),
  v("Leda", "f", "Youthful", "Young, light and fresh. Good for girls and young women", "صوت شبابي خفيف. مناسب للبنات والشابات"),
  v("Laomedeia", "f", "Upbeat", "Cheerful and energetic. Good for lively ads", "مرحة ونشيطة. مناسبة للإعلانات الحماسية"),
  v("Zephyr", "f", "Bright", "Bright and friendly. Good for brands and social posts", "مشرقة وودودة. مناسبة للعلامات والسوشال"),
  v("Autonoe", "f", "Bright", "Bright and clear. Good for explaining a product", "مشرقة وواضحة. مناسبة لشرح منتج"),
  v("Aoede", "f", "Breezy", "Relaxed and easy. Good for lifestyle and daily routines", "مرتاحة وسلسة. مناسبة لنمط الحياة والروتين"),
  v("Callirrhoe", "f", "Easy-going", "Casual, like a friend talking. Good for UGC", "عفوية كأنها صديقة تتكلم. مناسبة لمحتوى المستخدمين"),
  v("Sulafat", "f", "Warm", "Warm and caring. Good for mothers and family ads", "دافئة وحنونة. مناسبة للأمهات وإعلانات العائلة"),
  v("Despina", "f", "Smooth", "Smooth and elegant. Good for beauty and luxury", "ناعمة وأنيقة. مناسبة للجمال والفخامة"),
  v("Vindemiatrix", "f", "Gentle", "Gentle and calm. Good for care and wellness", "لطيفة وهادئة. مناسبة للعناية والصحة"),
  v("Achernar", "f", "Soft", "Soft and quiet. Good for intimate, slow moments", "ناعمة وهادية. مناسبة للحظات الهادئة"),
  v("Erinome", "f", "Clear", "Clear and steady. Good for instructions and narration", "واضحة وثابتة. مناسبة للشرح والتعليق"),
  v("Pulcherrima", "f", "Forward", "Direct and bold. Good for strong calls to action", "مباشرة وجريئة. مناسبة للدعوة القوية للشراء"),
  v("Gacrux", "f", "Mature", "Mature woman, 40s and up. Good for experts and older women", "امرأة ناضجة، أربعين وفوق. مناسبة للخبيرات والكبار"),
  v("Puck", "m", "Upbeat", "Cheerful young man. Good for fun, lively ads", "شاب مرح. مناسب للإعلانات الخفيفة والحماسية"),
  v("Sadachbia", "m", "Lively", "Young and lively. Good for boys and young men", "شبابي ونشيط. مناسب للأولاد والشباب"),
  v("Fenrir", "m", "Excitable", "Excited and fast. Good for sports and offers", "متحمس وسريع. مناسب للرياضة والعروض"),
  v("Achird", "m", "Friendly", "Friendly and open. Good for everyday characters", "ودود وقريب. مناسب للشخصيات اليومية"),
  v("Zubenelgenubi", "m", "Casual", "Casual, like a friend talking. Good for UGC", "عفوي كأنه صديق يتكلم. مناسب لمحتوى المستخدمين"),
  v("Umbriel", "m", "Easy-going", "Relaxed and calm. Good for lifestyle", "مرتاح وهادي. مناسب لنمط الحياة"),
  v("Algieba", "m", "Smooth", "Smooth and warm. Good for premium brands", "ناعم ودافئ. مناسب للعلامات الراقية"),
  v("Iapetus", "m", "Clear", "Clear and plain. Good for explaining", "واضح وبسيط. مناسب للشرح"),
  v("Charon", "m", "Informative", "Trustworthy narrator. Good for voiceovers", "راوي موثوق. مناسب للتعليق الصوتي"),
  v("Rasalgethi", "m", "Informative", "Informative and steady. Good for documentaries", "معلوماتي وثابت. مناسب للوثائقيات"),
  v("Sadaltager", "m", "Knowledgeable", "Knowledgeable, like an expert. Good for doctors and specialists", "خبير ومطّلع. مناسب للأطباء والمختصين"),
  v("Schedar", "m", "Even", "Even and balanced. Good for corporate films", "متزن وهادي. مناسب للأفلام المؤسسية"),
  v("Orus", "m", "Firm", "Firm and confident man. Good for strong brands", "رجل حازم وواثق. مناسب للعلامات القوية"),
  v("Alnilam", "m", "Firm", "Deep and firm. Good for serious messages", "عميق وحازم. مناسب للرسائل الجادة"),
  v("Enceladus", "m", "Breathy", "Soft and breathy. Good for emotional moments", "ناعم وهامس. مناسب للحظات العاطفية"),
  v("Algenib", "m", "Gravelly", "Older, rough voice. Good for fathers and grandfathers", "صوت أكبر وخشن. مناسب للآباء والأجداد"),
];
export const DEFAULT_NARRATOR = "Charon";
export const isVoice = (id: string | undefined) => Boolean(id && VOICES.some((x) => x.id === id));

// How the person speaks: the dialect. Saudi first.
export const DIALECTS = [
  { id: "najdi", en: "Saudi, Najdi (Riyadh)", ar: "سعودي نجدي (الرياض)", prompt: "natural Saudi Najdi dialect as spoken in Riyadh, not Modern Standard Arabic, not Egyptian" },
  { id: "hijazi", en: "Saudi, Hijazi (Jeddah)", ar: "سعودي حجازي (جدة)", prompt: "natural Saudi Hijazi dialect as spoken in Jeddah, not Modern Standard Arabic, not Egyptian" },
  { id: "eastern", en: "Saudi, Eastern (Dammam)", ar: "سعودي شرقاوي (الدمام)", prompt: "natural Saudi Eastern Province dialect as spoken in Dammam, close to Gulf Arabic, not Modern Standard Arabic" },
  { id: "southern", en: "Saudi, Southern (Abha)", ar: "سعودي جنوبي (أبها)", prompt: "natural southern Saudi dialect as spoken in Abha, not Modern Standard Arabic" },
  { id: "gulf", en: "Gulf (UAE, Kuwait)", ar: "خليجي (الإمارات، الكويت)", prompt: "natural Gulf Arabic dialect, not Modern Standard Arabic" },
  { id: "msa", en: "Modern Standard Arabic", ar: "فصحى", prompt: "clear Modern Standard Arabic (fusha), with a Saudi accent" },
  { id: "egyptian", en: "Egyptian", ar: "مصري", prompt: "natural Egyptian Arabic as spoken in Cairo" },
  { id: "levantine", en: "Levantine", ar: "شامي", prompt: "natural Levantine Arabic" },
  { id: "english", en: "English", ar: "إنجليزي", prompt: "natural, clear English" },
  { id: "saudi-english", en: "English, Saudi accent", ar: "إنجليزي بلكنة سعودية", prompt: "English with a light, natural Saudi accent" },
  { id: "amharic", en: "Amharic", ar: "أمهري", prompt: "natural Ethiopian Amharic as spoken in Addis Ababa" },
  { id: "urdu", en: "Urdu", ar: "أوردو", prompt: "natural Urdu" },
  { id: "french", en: "French", ar: "فرنسي", prompt: "natural French" },
];
export const isDialect = (id: string | undefined) => Boolean(id && DIALECTS.some((d) => d.id === id));
export function defaultDialect(language: string | null | undefined) {
  const l = (language ?? "").toLowerCase();
  if (l.includes("hijaz") || l.includes("حجاز")) return "hijazi";
  if (l.includes("gulf") || l.includes("خليج")) return "gulf";
  if (l.includes("egypt") || l.includes("مصر")) return "egyptian";
  if (l.includes("saudi") || l.includes("سعود") || l.includes("arab") || l.includes("عرب")) return "najdi";
  if (l.includes("amhar")) return "amharic";
  if (l.includes("urdu")) return "urdu";
  if (l.includes("french")) return "french";
  return "english";
}
export const dialectPrompt = (id: string) => (DIALECTS.find((d) => d.id === id) ?? DIALECTS[0]).prompt;
export function dialectFor(language: string | null | undefined) {
  return dialectPrompt(defaultDialect(language));
}

// The age the voice should sound. Gemini voices are adult; a child or a teen is asked for in words.
export const AGES = [
  { id: "child", en: "Child (6 to 11)", ar: "طفل (٦ إلى ١١)", prompt: "a child about 8 years old, with a child's high, light voice" },
  { id: "teen", en: "Teen (12 to 17)", ar: "مراهق (١٢ إلى ١٧)", prompt: "a teenager about 15 years old" },
  { id: "young", en: "Young adult (18 to 30)", ar: "شاب (١٨ إلى ٣٠)", prompt: "a young adult in their twenties" },
  { id: "adult", en: "Adult (30 to 50)", ar: "بالغ (٣٠ إلى ٥٠)", prompt: "an adult around 40" },
  { id: "older", en: "Older (50 and up)", ar: "كبير (٥٠ وفوق)", prompt: "an older person in their sixties" },
];
export const isAge = (id: string | undefined) => Boolean(id && AGES.some((a) => a.id === id));
export function guessAge(text: string | undefined) {
  const s = (text ?? "").toLowerCase();
  if (/(child|kid|boy\b|girl\b|طفل|طفلة|ولد صغير|بنت صغيرة)/.test(s)) return "child";
  if (/(teen|مراهق|مراهقة)/.test(s)) return "teen";
  if (/(old|elder|grand|senior|مسن|كبير في السن|جد|جدة)/.test(s)) return "older";
  const n = Number(s.match(/\d{1,2}/)?.[0] ?? NaN);
  if (n) return n < 12 ? "child" : n < 18 ? "teen" : n < 31 ? "young" : n < 51 ? "adult" : "older";
  return "young";
}

// The full instruction Gemini reads before a line: who speaks, in which dialect, and how.
export function voiceStyle(o: { female: boolean; age: string; dialect: string; how: string; narrator?: boolean }) {
  const age = (AGES.find((a) => a.id === o.age) ?? AGES[2]).prompt;
  const who = o.narrator ? `A ${o.female ? "female" : "male"} voiceover narrator, ${age}` : `A ${o.female ? "female" : "male"} speaker: ${age}`;
  return `${who}. Speak in ${dialectPrompt(o.dialect)}. ${o.how}`.trim().slice(0, 600);
}

// About $0.002 for a short line (0.32 credits measured), more for long ones.
export const voicePrice = (text: string) => Math.max(0.002, (Math.max(1, text.length) / 1000) * 0.012);

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
  if (female && /(creator|influencer|blogger|ugc|صانعة|مؤثرة|بلوقر|مدونة)/.test(`${p} ${text}`)) return pick(["Kore"]);
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
