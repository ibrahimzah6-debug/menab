// The M1 provider test: what to generate, on which model, from which references.
// The brief behind these prompts is in docs/provider-test-brief.md.

export type Step = "character" | "location" | "keyframe" | "video";

export type ModelDef = {
  label: string;
  providerModel: string;
  // Rough price before running, from kie.ai/pricing. The real cost is read back from Kie after each job.
  estimateUsd: number;
  build: (prompt: string, refs: string[]) => Record<string, unknown>;
};

export const IMAGE_MODEL: ModelDef = {
  label: "Nano Banana 2",
  providerModel: "nano-banana-2",
  estimateUsd: 0.04,
  build: (prompt, refs) => ({
    prompt,
    image_input: refs,
    aspect_ratio: "16:9",
    resolution: "1K",
    output_format: "png",
  }),
};

export const VIDEO_MODELS: ModelDef[] = [
  {
    label: "Kling 3.0",
    providerModel: "kling-3.0/video",
    estimateUsd: 0.4,
    build: (prompt, refs) => ({
      prompt,
      image_urls: refs.slice(0, 1),
      sound: false,
      duration: "5",
      aspect_ratio: "16:9",
      mode: "std",
      multi_shots: false,
    }),
  },
  {
    label: "Seedance 2.5",
    providerModel: "bytedance/seedance-2-5",
    estimateUsd: 0.6,
    build: (prompt, refs) => ({
      prompt,
      first_frame_url: refs[0],
      generate_audio: false,
      resolution: "720p",
      aspect_ratio: "16:9",
      duration: 5,
    }),
  },
  {
    label: "Veo 3.1 Fast",
    providerModel: "veo-3-1",
    estimateUsd: 0.35,
    build: (prompt, refs) => ({
      prompt,
      model: "veo3_fast",
      image_urls: refs.slice(0, 1),
      generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      aspect_ratio: "16:9",
      resolution: "720p",
      enable_translation: false,
    }),
  },
];

const STYLE =
  "Photorealistic commercial still, shot on a cinema camera, warm tungsten and golden hour light, soft contrast, natural skin tones, Saudi setting. No text unless asked.";

export type PlanItem = { key: string; step: Step; title: string; prompt: string; uses: string[] };

export const PLAN: PlanItem[] = [
  {
    key: "C1",
    step: "character",
    title: "Umm Faisal, the mother",
    uses: [],
    prompt: `Character reference sheet of one Saudi woman in her mid 40s, warm kind face, light laugh lines, wearing a loose deep green house dress and a soft beige headscarf loosely framing her face. Front view and three quarter view side by side, full body and close-up, plain light gray background, even studio light. ${STYLE}`,
  },
  {
    key: "C2",
    step: "character",
    title: "Noura, the daughter",
    uses: [],
    prompt: `Character reference sheet of one Saudi woman in her early 20s, confident calm expression, wearing a cream colored modest long dress and a light gray headscarf. Front view and three quarter view side by side, full body and close-up, plain light gray background, even studio light. ${STYLE}`,
  },
  {
    key: "L1",
    step: "location",
    title: "Family kitchen in Riyadh",
    uses: [],
    prompt: `Empty modern Saudi family kitchen in a Riyadh villa, late afternoon. Warm wood cabinets, cream stone counter, three pots on the stove, a round wall clock, a window with sunlight coming in, dates and a dallah coffee pot on the counter. Wide shot, no people. ${STYLE}`,
  },
  {
    key: "L2",
    step: "location",
    title: "Riyadh street at sunset",
    uses: [],
    prompt: `A wide Riyadh street at sunset during Ramadan, cars with headlights heading home, palm trees along the road, Ramadan crescent lights on lamp posts, the Kingdom Centre tower far in the distance against an orange sky. No people in focus. ${STYLE}`,
  },
  {
    key: "K1",
    step: "keyframe",
    title: "Street at sunset, wide",
    uses: ["L2"],
    prompt: `Use the reference image as the location. Wide establishing shot of this exact Riyadh street at sunset, low angle, cars streaming home, sun touching the horizon. ${STYLE}`,
  },
  {
    key: "K2",
    step: "keyframe",
    title: "Mother checks three pots",
    uses: ["C1", "L1"],
    prompt: `Use the first reference image for the woman and the second for the kitchen. Medium close-up of this exact woman at this exact stove, lifting a lid to check one of three pots, steam rising, the round wall clock behind her shows almost 6 o'clock. Busy but loving expression. ${STYLE}`,
  },
  {
    key: "K3",
    step: "keyframe",
    title: "Daughter places the air fryer",
    uses: ["C2", "L1"],
    prompt: `Use the first reference image for the young woman and the second for the kitchen. Medium shot of this exact young woman in this exact kitchen, sliding a matte black air fryer with a copper ring around its single button onto the counter, smiling. Next to it stands the product box with large clear Arabic text "دلة هوم" and smaller text "رمضان كريم". The Arabic letters must be correct and readable. ${STYLE}`,
  },
  {
    key: "V1",
    step: "video",
    title: "Street at sunset, push in",
    uses: ["K1"],
    prompt: "Slow cinematic push in down the street. Cars move steadily toward camera, headlights glowing, palm leaves sway gently, the sun sinks slightly. Smooth, stable camera.",
  },
  {
    key: "V2",
    step: "video",
    title: "Mother at the stove, handheld",
    uses: ["K2"],
    prompt: "Gentle handheld close-up. The woman lifts the lid, steam rises, she glances up at the clock and back to the pot. Natural motion, her face stays the same throughout.",
  },
  {
    key: "V3",
    step: "video",
    title: "Daughter presses the button, dolly in",
    uses: ["K3"],
    prompt: "Slow dolly in. The young woman slides the air fryer forward and presses the single copper button, the button light turns on, she smiles at someone off camera. The box and its text stay still.",
  },
];

export const STEP_ORDER: Step[] = ["character", "location", "keyframe", "video"];

// Characters and locations run together as one phase.
export type Phase = "references" | "keyframes" | "videos";

export function itemsForPhase(phase: Phase) {
  if (phase === "references") return PLAN.filter((p) => p.step === "character" || p.step === "location");
  if (phase === "keyframes") return PLAN.filter((p) => p.step === "keyframe");
  return PLAN.filter((p) => p.step === "video");
}

export function modelsForStep(step: Step) {
  return step === "video" ? VIDEO_MODELS : [IMAGE_MODEL];
}

export function phaseEstimateUsd(phase: Phase) {
  return itemsForPhase(phase).reduce(
    (sum, item) => sum + modelsForStep(item.step).reduce((s, m) => s + m.estimateUsd, 0),
    0,
  );
}

export function findModel(providerModel: string) {
  return [IMAGE_MODEL, ...VIDEO_MODELS].find((m) => m.providerModel === providerModel);
}
