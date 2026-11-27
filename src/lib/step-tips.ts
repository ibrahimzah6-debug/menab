// Tips shown above each step's assistant box: short requests the producer can send with one press,
// for this step and this video type. A tip with `file` opens the file picker (photos or PDFs).
// Written for the 5 main video types first (UGC, commercial, product, company profile, real
// estate); every other type gets the general tips of the step.

export type Tip = { label: string; text: string; file?: boolean };
type Bi = { en: string; ar: string; tEn: string; tAr: string; file?: boolean };

const tip = (en: string, ar: string, tEn: string, tAr: string, file?: boolean): Bi => ({ en, ar, tEn, tAr, file });

// Every video type, by output number.
const GENERAL: Record<number, Bi[]> = {
  3: [tip("Add reference files", "أضف ملفات مرجعية", "Use the attached files in the brief.", "استخدم الملفات المرفقة في البريف.", true), tip("Make it shorter", "اختصره", "Make the brief summary shorter and clearer.", "اختصر ملخص البريف وخلّه أوضح.")],
  4: [tip("Add a cutdown", "أضف نسخة مختصرة", "Add a 15 second cutdown in 9:16.", "أضف نسخة مختصرة ١٥ ثانية بمقاس 9:16.")],
  5: [tip("Explain the cost", "اشرح التكلفة", "Explain the cost range line by line.", "اشرح نطاق التكلفة بند بند.")],
  6: [tip("Move the deadline", "غيّر الموعد", "The deadline is now ", "الموعد النهائي صار ")],
  7: [tip("Bolder ideas", "أفكار أجرأ", "Make the three directions bolder and more different from each other.", "خلّ الاتجاهات الثلاثة أجرأ ومختلفة عن بعض أكثر."), tip("Add a reference", "أضف مرجع", "Use the attached reference in the directions.", "استخدم المرجع المرفق في الاتجاهات.", true)],
  9: [tip("Stronger hook", "افتتاحية أقوى", "Make the first 3 seconds a stronger hook.", "خلّ أول ٣ ثواني افتتاحية أقوى."), tip("Add a call to action", "أضف دعوة للشراء", "End with a clear call to action.", "اختم بدعوة واضحة للشراء."), tip("Saudi dialect", "لهجة سعودية", "Write the lines in natural Saudi dialect.", "اكتب الجمل بلهجة سعودية طبيعية.")],
  10: [tip("More visual", "أكثر بصرية", "Describe each shot more visually: light, colour and movement.", "وصّف كل لقطة بشكل بصري أكثر: الإضاءة واللون والحركة.")],
  11: [tip("Add a mood photo", "أضف صورة للمود", "Match the visual mood to the attached photos.", "طابق المود البصري مع الصور المرفقة.", true), tip("Warmer colours", "ألوان أدفأ", "Make the colours warmer.", "خلّ الألوان أدفأ.")],
  13: [tip("Add a character", "أضف شخصية", "Add a character: ", "أضف شخصية: "), tip("Younger main character", "شخصية رئيسية أصغر", "Make the main character younger, in their twenties.", "خلّ الشخصية الرئيسية أصغر، في العشرينات."), tip("Match a photo", "طابق صورة", "Describe the main character to match the attached photo.", "وصّف الشخصية الرئيسية تطابق الصورة المرفقة.", true)],
  14: [tip("Change an outfit", "غيّر لبس", "Change the outfit in scene 1 to ", "غيّر اللبس في المشهد ١ إلى "), tip("Same outfit everywhere", "نفس اللبس في الكل", "Keep the same outfit in every scene.", "خلّ نفس اللبس في كل المشاهد.")],
  15: [tip("Add a location photo", "أضف صورة موقع", "Describe the location to match the attached photos.", "وصّف الموقع يطابق الصور المرفقة.", true), tip("Add a location", "أضف موقع", "Add a location: ", "أضف موقع: ")],
  16: [tip("Add a prop", "أضف قطعة", "Add this prop to the scene: ", "أضف هذي القطعة للمشهد: ")],
  17: [tip("Change a frame", "غيّر فريم", "In frame 1, ", "في الفريم ١، ")],
  18: [tip("Add a close-up", "أضف لقطة قريبة", "Add a close-up of the product.", "أضف لقطة قريبة للمنتج."), tip("Fewer shots", "لقطات أقل", "Use fewer, longer shots.", "استخدم لقطات أقل وأطول.")],
  20: [tip("Lower the budget", "قلّل الميزانية", "Bring the total down by about 20% without losing quality.", "نزّل الإجمالي حوالي ٢٠٪ بدون ما تقل الجودة."), tip("Use our rates", "استخدم أسعارنا", "Use the rates in the attached file.", "استخدم الأسعار في الملف المرفق.", true)],
  22: [tip("Smaller crew", "طاقم أصغر", "Make the crew smaller for a one day shoot.", "صغّر الطاقم لتصوير يوم واحد.")],
  25: [tip("Add a drone", "أضف درون", "Add a drone shot and its GACA permit.", "أضف لقطة درون وتصريح GACA حقها.")],
  26: [tip("Lighter kit", "عدة أخف", "Make the equipment list lighter and cheaper.", "خلّ قائمة المعدات أخف وأرخص.")],
  31: [tip("One day only", "يوم واحد بس", "Fit the shoot into one day.", "خلّ التصوير في يوم واحد.")],
  34: [tip("Add product photos", "أضف صور المنتج", "These are photos of the product.", "هذي صور المنتج.", true), tip("Najdi voice", "صوت نجدي", "Make every voice speak natural Najdi Saudi dialect.", "خلّ كل الأصوات تتكلم لهجة نجدية طبيعية."), tip("Skip the narrator", "بدون راوي", "Skip the narrator voice.", "تجاوز صوت الراوي."), tip("Younger voice", "صوت أصغر", "Make the main character's voice sound younger.", "خلّ صوت الشخصية الرئيسية أصغر.")],
  37: [tip("Calmer voice", "صوت أهدأ", "Make the narrator calmer and slower.", "خلّ الراوي أهدأ وأبطأ."), tip("Remake line 1", "أعد الجملة ١", "Make the first voiceover line again.", "سوّ أول جملة تعليق من جديد.")],
  35: [tip("Product in hand", "المنتج في اليد", "In keyframe 1, put the product in her hand, label facing the camera.", "في الكي فريم ١، خلّ المنتج في يدها والملصق مقابل الكاميرا."), tip("Closer framing", "تكوين أقرب", "Make keyframe 1 a closer shot.", "خلّ الكي فريم ١ لقطة أقرب.")],
  36: [tip("Slower camera", "كاميرا أبطأ", "Make the camera move slower in shot 1 and make the video again.", "خلّ حركة الكاميرا أبطأ في اللقطة ١ وسوّ الفيديو من جديد."), tip("Fix the product", "صحّح المنتج", "The product looks wrong in shot 1. Keep it exactly like the product photos and make it again.", "المنتج طالع غلط في اللقطة ١. خلّه نفس صور المنتج بالضبط وسوّها من جديد.")],
  38: [tip("Calmer music", "موسيقى أهدأ", "Make the music calmer and make it again.", "خلّ الموسيقى أهدأ وسوّها من جديد."), tip("No music", "بدون موسيقى", "Skip the music.", "تجاوز الموسيقى.")],
  32: [tip("Earlier call", "استدعاء أبكر", "Start the crew call one hour earlier.", "قدّم موعد استدعاء الطاقم ساعة.")],
};

// Extra tips by video type, by output number.
const BY_TYPE: Record<string, Record<number, Bi[]>> = {
  ugc: {
    3: [tip("Add product photos", "أضف صور المنتج", "These are photos of the product. Use them in the brief.", "هذي صور المنتج. استخدمها في البريف.", true), tip("Add a hook line", "أضف جملة افتتاحية", "The hook line is: ", "الجملة الافتتاحية: ")],
    9: [tip("Talk like a creator", "كلام صانعة محتوى", "Write it like a creator talking to friends, first person, casual.", "اكتبه كأنها صانعة محتوى تكلم صديقاتها، بصيغة المتكلم وعفوي."), tip("Show the product early", "المنتج من البداية", "Show the product in the first 3 seconds.", "خلّ المنتج يطلع في أول ٣ ثواني.")],
    13: [tip("Creator's age and city", "عمرها ومدينتها", "The creator is in her twenties, from Riyadh.", "صانعة المحتوى في العشرينات من الرياض.")],
    34: [tip("Creator talks to camera", "تتكلم للكاميرا", "The creator speaks on camera with lip sync, in a casual Najdi voice.", "صانعة المحتوى تتكلم للكاميرا مع مزامنة الشفايف، بصوت نجدي عفوي.")],
    18: [tip("Product in hand", "المنتج في يدها", "Show the product in her hand in the opening shot.", "خلّ المنتج في يدها في أول لقطة.")],
  },
  commercial: {
    3: [tip("Add the brand guide", "أضف دليل العلامة", "Follow the attached brand guide.", "اتبع دليل العلامة المرفق.", true)],
    9: [tip("Add the tagline", "أضف الشعار", "End with the brand tagline: ", "اختم بشعار العلامة: ")],
    11: [tip("Brand colours", "ألوان العلامة", "Use the brand colours: ", "استخدم ألوان العلامة: ")],
  },
  product: {
    3: [tip("Add product photos", "أضف صور المنتج", "These are photos of the product. Use them in the brief.", "هذي صور المنتج. استخدمها في البريف.", true)],
    18: [tip("Packshot at the end", "لقطة المنتج بالنهاية", "End with a clean packshot of the product.", "اختم بلقطة نظيفة للمنتج."), tip("Show the details", "أظهر التفاصيل", "Add macro shots of the product details.", "أضف لقطات قريبة جدًا لتفاصيل المنتج.")],
  },
  profile: {
    3: [tip("Add the company profile", "أضف ملف الشركة", "Use the attached company profile.", "استخدم ملف الشركة المرفق.", true), tip("Add the logo", "أضف الشعار", "This is the company logo.", "هذا شعار الشركة.", true)],
    9: [tip("Add numbers", "أضف أرقام", "Add the company's key numbers: ", "أضف أرقام الشركة المهمة: ")],
    13: [tip("Add the CEO", "أضف الرئيس التنفيذي", "Add the CEO, who speaks to camera.", "أضف الرئيس التنفيذي يتكلم للكاميرا.")],
  },
  real_estate: {
    3: [tip("Add the floor plan", "أضف المخطط", "This is the floor plan. Use it in the brief.", "هذا المخطط. استخدمه في البريف.", true), tip("Add site photos", "أضف صور الموقع", "These are photos of the site.", "هذي صور الموقع.", true)],
    9: [tip("Walk-through order", "ترتيب الجولة", "Follow a walk-through order: entrance, living room, kitchen, bedrooms, view.", "امشِ بترتيب الجولة: المدخل، الصالة، المطبخ، الغرف، الإطلالة.")],
    15: [tip("Add the floor plan", "أضف المخطط", "Describe each room from the attached floor plan.", "وصّف كل غرفة من المخطط المرفق.", true), tip("Add room photos", "أضف صور الغرف", "Describe each room to match the attached photos.", "وصّف كل غرفة تطابق الصور المرفقة.", true)],
    34: [tip("Skip the product", "بدون منتج", "Skip the product section.", "تجاوز قسم المنتج."), tip("Calm narrator", "راوي هادي", "Make the narrator calm and premium, adult, Najdi.", "خلّ الراوي هادي وراقي، بالغ، نجدي.")],
    18: [tip("Slow camera moves", "حركة كاميرا بطيئة", "Use slow, smooth camera moves in every shot.", "استخدم حركة كاميرا بطيئة وسلسة في كل لقطة.")],
  },
};

export function tipsFor(n: number, videoType: string | null | undefined, lang: "en" | "ar"): Tip[] {
  const list = [...(BY_TYPE[videoType ?? ""]?.[n] ?? []), ...(GENERAL[n] ?? [])].slice(0, 5);
  return list.map((x) => ({ label: lang === "ar" ? x.ar : x.en, text: lang === "ar" ? x.tAr : x.tEn, file: x.file }));
}
