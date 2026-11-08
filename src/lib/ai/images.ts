import "server-only";
import { IMAGE_MODELS } from "./catalog";

// How each image model in Menab's list is called on Kie.ai (docs.kie.ai/market/..., checked
// 8 Nov 2026). With reference photos (a library character or location in the shot) the model's
// image-to-image endpoint is used; without, its text-to-image endpoint. A model that only works
// from a reference returns null without one, and the backup draws the frame instead.

export type Aspect = "16:9" | "9:16" | "1:1";
export const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1"];
export type Style = "sketch" | "photo";

export const STYLE_PROMPT: Record<Style, string> = {
  sketch: "Storyboard frame drawn as a clean black and white pencil sketch: confident lines, simple grey shading, white paper, no colour, no text, no frame border.",
  photo: "Photo-real cinematic film still: natural skin texture, real light and shadows, shot on a cinema camera with a real lens, subtle film grain, not illustrated, not CGI, no text.",
};

const ideogramSize: Record<Aspect, string> = { "16:9": "landscape_16_9", "9:16": "portrait_16_9", "1:1": "square_hd" };

export function imageRequest(modelId: string, prompt: string, aspect: Aspect, refs: string[]): { kieModel: string; input: Record<string, unknown> } | null {
  const r = refs.slice(0, 4);
  switch (modelId) {
    case "nano-banana-pro":
      return { kieModel: "nano-banana-pro", input: { prompt, image_input: r, aspect_ratio: aspect, resolution: "1K", output_format: "jpg" } };
    case "nano-banana-2":
      return { kieModel: "nano-banana-2", input: { prompt, image_input: r, aspect_ratio: aspect, resolution: "1K", output_format: "jpg" } };
    case "gpt-image-2":
      return r.length
        ? { kieModel: "gpt-image-2-image-to-image", input: { prompt, input_urls: r, aspect_ratio: aspect } }
        : { kieModel: "gpt-image-2-text-to-image", input: { prompt, aspect_ratio: aspect } };
    case "seedream-5-pro":
      return r.length
        ? { kieModel: "seedream/5-pro-image-to-image", input: { prompt, image_urls: r, aspect_ratio: aspect, quality: "basic", output_format: "jpeg", nsfw_checker: true } }
        : { kieModel: "seedream/5-pro-text-to-image", input: { prompt, aspect_ratio: aspect, quality: "basic", output_format: "jpeg", nsfw_checker: true } };
    case "seedream-5-flash":
      return r.length ? { kieModel: "seedream/5-flash-image-to-image", input: { prompt, image_urls: r, aspect_ratio: aspect, size: "1K", output_format: "jpeg", nsfw_checker: true } } : null;
    case "flux-2-pro":
      return r.length
        ? { kieModel: "flux-2/pro-image-to-image", input: { prompt, input_urls: r, aspect_ratio: aspect, resolution: "1K", nsfw_checker: true } }
        : { kieModel: "flux-2/pro-text-to-image", input: { prompt, aspect_ratio: aspect, resolution: "1K", nsfw_checker: true } };
    case "wan-2-7-image-pro":
      return { kieModel: "wan/2-7-image-pro", input: { prompt, ...(r.length ? { input_urls: r } : {}), aspect_ratio: aspect } };
    case "grok-imagine-image-2":
      return r.length
        ? { kieModel: "grok-imagine-image-2-0/image-to-image", input: { prompt, image_urls: r, aspect_ratio: aspect } }
        : { kieModel: "grok-imagine-image-2-0/text-to-image", input: { prompt, aspect_ratio: aspect } };
    case "ideogram-v3":
      return { kieModel: "ideogram/v3-text-to-image", input: { prompt, rendering_speed: "BALANCED", style: "AUTO", expand_prompt: false, image_size: ideogramSize[aspect] } };
    case "flux-3-klein":
      return r.length
        ? { kieModel: "flux-3/klein-edit-image", input: { prompt, image_urls: r, aspect_ratio: aspect, resolution: "1K", output_format: "jpeg", num_images: 1, enhance_prompt: false } }
        : { kieModel: "flux-3/klein-text-to-image", input: { prompt, aspect_ratio: aspect, resolution: "1K", output_format: "jpeg", num_images: 1, enhance_prompt: false } };
    default:
      return null;
  }
}

// The backup when an image model fails or cannot draw a frame: the tested everyday model,
// or the photo-real one when the everyday model is the one that failed.
export function imageBackup(modelId: string) {
  return modelId === "nano-banana-2" ? "seedream-5-pro" : "nano-banana-2";
}

export function imageModel(id: string) {
  return IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS.find((m) => m.id === "nano-banana-2")!;
}
