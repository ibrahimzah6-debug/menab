// Film crew departments, in the order a call sheet lists them, in English and Arabic.
export const DEPARTMENTS: { id: string; en: string; ar: string }[] = [
  { id: "direction", en: "Direction", ar: "الإخراج" },
  { id: "production", en: "Production", ar: "الإنتاج" },
  { id: "camera", en: "Camera", ar: "الكاميرا" },
  { id: "lighting", en: "Lighting and grip", ar: "الإضاءة والمعدات" },
  { id: "sound", en: "Sound", ar: "الصوت" },
  { id: "art", en: "Art", ar: "الديكور" },
  { id: "wardrobe", en: "Wardrobe", ar: "الأزياء" },
  { id: "makeup", en: "Hair and makeup", ar: "الشعر والمكياج" },
  { id: "cast", en: "Cast", ar: "الممثلين" },
  { id: "drone", en: "Drone", ar: "الدرون" },
  { id: "transport", en: "Transport", ar: "النقل" },
  { id: "catering", en: "Catering", ar: "الضيافة" },
  { id: "safety", en: "Safety and medic", ar: "السلامة والإسعاف" },
  { id: "post", en: "Post-production", ar: "ما بعد الإنتاج" },
];
export const department = (id: string | null | undefined) => DEPARTMENTS.find((d) => d.id === id);
