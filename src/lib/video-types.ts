// The video types approved by Ibrahim (docs/video-types.md, 15 Nov 2026). Menab suggests one
// from the brief conversation; the person can change it. Each type carries a recipe the AI
// follows in every stage, and the documents that do not apply to it are hidden.

export type VideoTypeGroup = "brand" | "social" | "business" | "creator" | "places" | "story" | "other";
export type VideoType = {
  id: string;
  en: string;
  ar: string;
  group: VideoTypeGroup;
  length: string;
  path: "ai" | "production" | "hybrid" | "any";
  soon?: boolean;
  // Outputs hidden for this type (13 characters, 14 wardrobe, 15 locations, 16 art direction,
  // 17 storyboard, 25 permits, 27 PPM booklet). "noPeople" hides 13 and 14 only when the brief
  // says no real people are on camera.
  hides?: number[];
  noPeople?: boolean;
  recipe: string;
};

export const GROUPS: Record<VideoTypeGroup, { en: string; ar: string }> = {
  brand: { en: "Brand and advertising", ar: "البراند والإعلانات" },
  social: { en: "Social and performance", ar: "السوشال والأداء" },
  business: { en: "Business and corporate", ar: "الأعمال والشركات" },
  creator: { en: "Creator and digital", ar: "صنّاع المحتوى والرقمي" },
  places: { en: "Places", ar: "الأماكن" },
  story: { en: "Story", ar: "القصص" },
  other: { en: "Other", ar: "أخرى" },
};

export const VIDEO_TYPES: VideoType[] = [
  {
    id: "brand_film", en: "Cinematic brand film", ar: "فيلم براند سينمائي", group: "brand", length: "60 to 120 sec, 16:9", path: "hybrid",
    recipe: "A story first, product second. Open on a human moment, build emotion, reveal the brand as the meaning of the story near the end. Cinematic lenses (35mm to 85mm), motivated light, slow deliberate moves, few words. Original score that builds. Avoid feature lists and hard selling.",
  },
  {
    id: "commercial", en: "Commercial (TV or online)", ar: "إعلان تلفزيوني أو أونلاين", group: "brand", length: "15, 30 or 60 sec plus cutdowns", path: "any",
    recipe: "One clear idea and one key message. Hook in the first 3 seconds, a turn in the middle, product and logo in the last 5 seconds with the line. Plan every cutdown so it still makes sense alone. Mix wide context, close product shots and a hero end card. Music and sound sting at the end.",
  },
  {
    id: "product", en: "Product video", ar: "فيديو منتج", group: "brand", length: "15 to 30 sec; 1:1, 9:16, 16:9", path: "hybrid", noPeople: true,
    recipe: "The product is the hero. Macro and close-up details, slow push-ins, turntable or orbit moves, clean light that shapes the material, one or two use moments. Show the key benefit visually. End on the product with logo. Rhythmic music, sound design on every detail.",
  },
  {
    id: "teaser", en: "Teaser or launch", ar: "تيزر وإطلاق", group: "brand", length: "6 to 15 sec, 9:16", path: "hybrid", noPeople: true,
    recipe: "Create curiosity, do not explain. Fragments, silhouettes, partial reveals, a date or a question at the end. Fast cuts, strong sound, one striking final image.",
  },
  {
    id: "occasion", en: "Occasion campaign (Ramadan, Eid, National Day, Founding Day)", ar: "حملة مناسبة", group: "brand", length: "30 to 60 sec plus cutdowns", path: "any",
    recipe: "Tie the brand to the feeling of the occasion with respect. Ramadan: family, generosity, iftar and suhoor moments, calm warm light. Eid: joy, new clothes, visits. National Day and Founding Day: pride, heritage, Saudi places, green and authentic historical details. Avoid clichés, avoid religious symbols used as decoration, keep dress and behaviour appropriate.",
  },
  {
    id: "ugc", en: "UGC ad", ar: "إعلان UGC", group: "social", length: "15 to 45 sec, 9:16", path: "hybrid", hides: [16, 25, 27],
    recipe: "Looks filmed by a real person on a phone. Hook in the first 2 seconds (a problem, a surprising claim or a reaction), then the problem, the product in use, the result, and a clear call to action. One creator talking to camera, natural home light, handheld, quick jump cuts, on-screen captions. Write 2 or 3 alternative hooks. Avoid polished studio looks.",
  },
  {
    id: "influencer", en: "Influencer collaboration", ar: "تعاون مع مؤثر", group: "social", length: "30 to 90 sec, 9:16", path: "production", hides: [16, 17, 27],
    recipe: "The creator speaks in their own voice and style. Give talking points, must-says and must-not-says rather than a word-for-word script. Natural integration of the product in their daily content, honest tone, clear disclosure that it is an ad.",
  },
  {
    id: "testimonial", en: "Testimonial or customer story", ar: "شهادة عميل", group: "social", length: "30 to 90 sec", path: "production", hides: [16],
    recipe: "Real people tell their own story. Interview setup (two cameras: medium and close-up), b-roll of their life and the product helping them. Structure: who they are, the problem, the change, the result in their words. No acted lines.",
  },
  {
    id: "tutorial", en: "Tutorial or product demo", ar: "شرح واستخدام المنتج", group: "social", length: "30 to 90 sec", path: "any", noPeople: true,
    recipe: "Show, step by step, how to use the product and what you get. Numbered steps on screen, top-down and close-up hands shots, clear before and after. Short and practical, one step per shot.",
  },
  {
    id: "series", en: "Social series", ar: "سلسلة سوشال", group: "social", length: "15 to 60 sec per episode", path: "any",
    recipe: "A recurring format with the same opening, the same structure and a recognisable look, so viewers know it in 2 seconds. Each episode stands alone. Plan the format once, then episodes.",
  },
  {
    id: "explainer", en: "Animated explainer", ar: "فيديو شرح موشن جرافيك", group: "business", length: "60 to 120 sec, 16:9", path: "ai", hides: [13, 14, 15],
    recipe: "Motion graphics that explain a service or idea simply. Structure: the problem, the solution, how it works in 3 steps, the benefit, the call to action. Clear voiceover, icons and simple shapes in the brand colours, one idea per scene.",
  },
  {
    id: "profile", en: "Company profile", ar: "فيلم تعريفي بالشركة", group: "business", length: "2 to 4 min, 16:9", path: "hybrid",
    recipe: "Who the company is, what it does, why it matters. Leadership and team interviews, facilities, work in progress, clients and numbers. Confident, credible tone, steady camera, drone where it adds scale.",
  },
  {
    id: "event", en: "Event coverage", ar: "تغطية فعالية", group: "business", length: "1 to 3 min plus short reels", path: "production", hides: [13, 14, 17],
    recipe: "Capture the energy and the key moments as they happen: arrivals, speakers, crowd reactions, details, short interviews. Plan a shot list of must-capture moments and a recap structure, plus vertical reels for the same day.",
  },
  {
    id: "recruitment", en: "Recruitment video", ar: "فيديو توظيف", group: "business", length: "60 to 90 sec", path: "hybrid",
    recipe: "Real employees show what it is like to work there: the team, the work, growth, culture. Authentic interviews and day-in-the-life b-roll, end with how to apply.",
  },
  {
    id: "training", en: "Training and internal", ar: "تدريب وتواصل داخلي", group: "business", length: "2 to 10 min", path: "any", hides: [16],
    recipe: "Clear learning goal, short chapters, one topic per chapter, a presenter or voiceover, on-screen key points and a summary at the end. Simple, calm, easy to follow.",
  },
  {
    id: "faceless", en: "Faceless page video", ar: "فيديو صفحة بدون وجه", group: "creator", length: "30 to 60 sec shorts, or 5 to 10 min", path: "ai", hides: [13, 14],
    recipe: "No presenter on screen. Strong hook in the first second, voiceover with captions, visuals that change every 2 to 3 seconds (AI scenes, hands-only, text on screen), a consistent visual style for the channel, a loop or a cliffhanger at the end.",
  },
  {
    id: "affiliate", en: "Affiliate and digital product promo", ar: "ترويج أفلييت ومنتجات رقمية", group: "creator", length: "15 to 45 sec, 9:16", path: "ai", hides: [13, 14],
    recipe: "Show the product working and the result quickly. Hook, the pain, the product, proof (screen, numbers, before and after), the offer and the link. Fast, captioned, honest claims only.",
  },
  {
    id: "app_demo", en: "App or website demo", ar: "عرض تطبيق أو موقع", group: "creator", length: "30 to 90 sec", path: "ai", hides: [13, 14, 15],
    recipe: "Screen recordings inside a device frame, cursor or finger highlights, zoom on the key actions, one feature per scene, voiceover and captions, end on the download or sign-up.",
  },
  {
    id: "clips", en: "Clips from a podcast or long video", ar: "مقاطع من بودكاست أو فيديو طويل", group: "creator", length: "15 to 60 sec, 9:16", path: "any", soon: true, hides: [13, 14, 15, 16, 17],
    recipe: "Find the strongest moments in the long video, reframe to vertical, add captions and a hook title.",
  },
  {
    id: "real_estate", en: "Real estate and project showcase", ar: "عرض عقاري ومشاريع", group: "places", length: "60 to 120 sec", path: "hybrid", noPeople: true,
    recipe: "Location and scale first (drone), then the lifestyle and the spaces: wide interiors with 14mm to 24mm, slow gimbal moves, golden hour exteriors, amenities, and the key facts on screen. End with the project name and contact.",
  },
  {
    id: "tourism", en: "Tourism and destination", ar: "سياحة ووجهات", group: "places", length: "60 to 120 sec", path: "hybrid",
    recipe: "Make people want to go. Landscapes and drone scale, local life, food, culture and experiences through the eyes of a traveller. Natural light, music-led edit, few words.",
  },
  {
    id: "documentary", en: "Short documentary or story", ar: "وثائقي أو قصة قصيرة", group: "story", length: "2 to 10 min", path: "hybrid",
    recipe: "Real story with a clear arc: the character, what they want, the obstacle, the change. Interviews, observational footage, archive where useful. Patient camera, natural sound.",
  },
  {
    id: "film", en: "Film", ar: "فيلم", group: "story", length: "10 min to 2 hours, scene by scene", path: "any", soon: true,
    recipe: "Built scene by scene: each scene has its own script part, shot list and storyboard.",
  },
  {
    id: "drama_series", en: "Series", ar: "مسلسل", group: "story", length: "Episodes, scene by scene", path: "any", soon: true,
    recipe: "Built episode by episode and scene by scene.",
  },
  {
    id: "other", en: "Other or not sure", ar: "أخرى أو مو متأكد", group: "other", length: "Any", path: "any",
    recipe: "Decide the best structure and look from the brief.",
  },
];

export const VIDEO_TYPE_IDS = VIDEO_TYPES.map((v) => v.id) as [string, ...string[]];

export const videoType = (id: string | null | undefined) => VIDEO_TYPES.find((v) => v.id === id);

// The outputs hidden for this project's type.
export function hiddenOutputs(brief: { video_type?: string | null; real_people?: string | null } | null | undefined): Set<number> {
  const v = videoType(brief?.video_type);
  const out = new Set<number>(v?.hides ?? []);
  if (v?.noPeople && brief?.real_people === "no") {
    out.add(13);
    out.add(14);
  }
  return out;
}

// The recipe added to the AI's instructions in every stage.
export function typeGuide(brief: { video_type?: string | null } | null | undefined) {
  const v = videoType(brief?.video_type);
  if (!v || v.id === "other") return "";
  return `\nVideo type: ${v.en} (usual length ${v.length}). How this type is made: ${v.recipe}`;
}

// For the brief conversation: the types the AI can pick.
export const typeChoicesForAi = () => VIDEO_TYPES.filter((v) => !v.soon).map((v) => `${v.id} (${v.en})`).join(", ");
