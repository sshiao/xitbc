import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Comfy, comfy, Forbidden, InsufficientCredits, MissingCredentials, Unauthorized } from "@comfyorg/sdk";
import { clipWorkflow, imageWorkflow, scoreWorkflow, type Graph } from "./requests";
import { clean, QUALITIES, type FormatId, type QualityId } from "./xitbc";

export type Media = { bytes: Uint8Array; type: string };

export type ImageInput = { prompt: string; width: number; height: number; seed: number; quality: QualityId; refs: Media[] };
export type ClipInput = { still: Media; prompt: string; seconds: number; quality: QualityId; format: FormatId; seed: number };
export type ScoreInput = { video: Media; prompt: string; seed: number };

function apiKey() {
  const key = process.env.COMFY_API_KEY?.trim();
  if (!key) throw new Error("COMFY_API_KEY is not configured.");
  return key;
}

function client() {
  return new Comfy({ apiKey: apiKey(), clientInfo: "xitbc" });
}

export function hasApiKey() {
  return Boolean(process.env.COMFY_API_KEY?.trim());
}

export function extension(type: string) {
  const known: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
    "video/mp4": "mp4", "audio/flac": "flac", "audio/x-flac": "flac", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
  };
  return known[type] ?? type.split("/")[1]?.replace(/[^a-z0-9]/g, "") ?? "bin";
}

async function template(name: "image" | "clip" | "score") {
  return JSON.parse(await readFile(join(process.cwd(), "workflows", `${name}.api.json`), "utf8")) as Graph;
}

function asset(api: Comfy, media: Media, name: string) {
  return api.assets.fromBytes(media.bytes, { filename: `${name}.${extension(media.type)}`, contentType: media.type });
}

// Submits the graph, waits for it, and downloads what its "save" node made.
// The same key authenticates the partner nodes inside the workflow.
async function run(api: Comfy, graph: Graph): Promise<Media> {
  const job = await api.run(api.workflows.fromJson(graph), { apiKey: apiKey(), timeoutMs: 20 * 60_000 });
  const output = job.getOutputs("save")[0] ?? job.outputs[0];
  if (!output) throw new Error(`Comfy job ${job.id} finished without an output.`);
  return { bytes: await output.toBytes(), type: output.contentType };
}

export async function comfyImage(input: ImageInput): Promise<Media> {
  const api = client();
  return run(api, imageWorkflow(await template("image"), {
    prompt: input.prompt,
    width: input.width,
    height: input.height,
    seed: input.seed,
    node: QUALITIES[input.quality].imageNode,
    refs: input.refs.map((ref, index) => asset(api, ref, `ref${index + 1}`)),
  }));
}

export async function comfyClip(input: ClipInput): Promise<Media> {
  const api = client();
  return run(api, clipWorkflow(await template("clip"), { ...input, still: asset(api, input.still, "still") }));
}

export async function comfyScore(input: ScoreInput): Promise<Media> {
  const api = client();
  return run(api, scoreWorkflow(await template("score"), { ...input, video: asset(api, input.video, "rough") }));
}

// Casting notes: Claude on Comfy Router looks at the casting image and writes down the star's look.
export const NOTES_MODEL = "anthropic/claude-sonnet-5-5";

export async function comfyDescribe(image: Media, prompt: string): Promise<string> {
  comfy.config({ credentials: apiKey() });
  const result = await comfy.models.run(NOTES_MODEL, {
    max_tokens: 300,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.type, data: Buffer.from(image.bytes).toString("base64") } },
        { type: "text", text: prompt },
      ],
    }],
  }, { timeoutMs: 120_000 });
  const content = result.kind === "json" ? (result.data as { content?: { type: string; text?: string }[] }).content : undefined;
  const text = content?.find((block) => block.type === "text")?.text;
  if (!text?.trim()) throw new Error("The vision model returned no casting notes.");
  return clean(text, 600);
}

// A retry cannot fix these.
export function isFinal(error: unknown) {
  return error instanceof InsufficientCredits || error instanceof Unauthorized || error instanceof MissingCredentials || error instanceof Forbidden;
}

export function comfyErrorMessage(error: unknown): string {
  if (error instanceof InsufficientCredits) return "Your Comfy account is out of credits. Add credits at platform.comfy.org and try again.";
  if (error instanceof Unauthorized || error instanceof MissingCredentials) return "Comfy did not accept the API key. Check COMFY_API_KEY in .env.local.";
  if (error instanceof Error && /free tier/i.test(error.message)) {
    return "Comfy Cloud API access needs a paid Comfy Cloud plan on the workspace that owns this API key. Credits alone are not enough. See comfy.org/cloud/pricing.";
  }
  return error instanceof Error && error.message ? error.message : "Comfy could not finish the job. Try again.";
}
