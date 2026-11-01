import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Comfy, comfy, Forbidden, InsufficientCredits, JobFailed, MissingCredentials, Unauthorized, type Job } from "@comfyorg/sdk";
import { clipWorkflow, imageWorkflow, scoreWorkflow, type Graph } from "./requests";
import { clean, QUALITIES, type FormatId, type QualityId } from "./xitbc";

export type Media = { bytes: Uint8Array; type: string };

export type ImageInput = { prompt: string; width: number; height: number; seed: number; quality: QualityId; refs: Media[] };
// "job" resumes a clip that an earlier attempt already submitted, and "onSubmit" hears the new job's id.
export type ClipInput = {
  still: Media; prompt: string; seconds: number; quality: QualityId; format: FormatId; seed: number;
  job?: string; onSubmit?: (job: string) => Promise<void>;
};
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

// A MiniMax H3 clip can wait in the Comfy Cloud queue for many minutes.
const WAIT_MS = 45 * 60_000;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Waits for a job and downloads what its "save" node made. A network error while waiting
// or downloading does not lose the job: after a pause, the wait starts again on the same job.
async function finish(api: Comfy, id: string, submitted?: Job): Promise<Media> {
  let job = submitted;
  let last: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      job ??= await api.jobs.get(id);
      await job.wait(WAIT_MS);
      await job.result();
      const output = job.getOutputs("save")[0] ?? job.outputs[0];
      if (!output) throw new JobFailed(`Comfy job ${id} finished without an output.`);
      return { bytes: await output.toBytes(), type: output.contentType };
    } catch (error) {
      if (isFinal(error) || error instanceof JobFailed || (error instanceof Error && error.name === "TimeoutError")) throw error;
      last = error;
      job = undefined;
      await pause(15_000 * (attempt + 1));
    }
  }
  throw last;
}

// Submits the graph and waits for it. The same key authenticates the partner nodes inside the workflow.
async function run(api: Comfy, graph: Graph, onSubmit?: (job: string) => Promise<void>): Promise<Media> {
  const job = await api.submit(api.workflows.fromJson(graph), { apiKey: apiKey() });
  await onSubmit?.(job.id);
  return finish(api, job.id, job);
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
  if (input.job) return finish(api, input.job);
  return run(api, clipWorkflow(await template("clip"), { ...input, still: asset(api, input.still, "still") }), input.onSubmit);
}

export async function comfyScore(input: ScoreInput): Promise<Media> {
  const api = client();
  return run(api, scoreWorkflow(await template("score"), { ...input, video: asset(api, input.video, "rough") }));
}

// Claude on Comfy Router writes the casting notes from the casting image, and the screenplay.
// Its thinking counts against max_tokens, so both budgets leave room for it.
export const CLAUDE_MODEL = "anthropic/claude-sonnet-5-5";

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

async function askClaude(content: Block[], maxTokens: number): Promise<string> {
  comfy.config({ credentials: apiKey() });
  const result = await comfy.models.run(CLAUDE_MODEL, { max_tokens: maxTokens, messages: [{ role: "user", content }] }, { timeoutMs: 180_000 });
  const blocks = result.kind === "json" ? (result.data as { content?: { type: string; text?: string }[] }).content : undefined;
  return blocks?.find((block) => block.type === "text")?.text?.trim() ?? "";
}

export async function comfyDescribe(image: Media, prompt: string): Promise<string> {
  const text = await askClaude([
    { type: "image", source: { type: "base64", media_type: image.type, data: Buffer.from(image.bytes).toString("base64") } },
    { type: "text", text: prompt },
  ], 1500);
  if (!text) throw new Error("The vision model returned no casting notes.");
  return clean(text, 600);
}

export async function comfyWrite(prompt: string): Promise<string> {
  const text = await askClaude([{ type: "text", text: prompt }], 8000);
  if (!text) throw new Error("The screenwriter returned no screenplay.");
  return text;
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
