// Reads the form the browser sends, and fills the three Comfy workflow templates.
// Nothing here talks to the network.

import {
  CITY_IDS, FORMATS, MAX_CITY, MAX_DESCRIPTION, MAX_NAME, QUALITIES, STYLES,
  clean,
  type CityId, type FilmRequest, type FormatId, type QualityId, type StyleId,
} from "./xitbc.ts";

export type Graph = Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } }>;

const MAX_SEED = 2 ** 32 - 1;

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function pick<T extends string>(form: FormData, field: string, allowed: readonly T[], what: string): T {
  const value = String(form.get(field) ?? "");
  if (!allowed.includes(value as T)) throw new Error(`Choose a supported ${what}.`);
  return value as T;
}

function text(form: FormData, field: string, max: number) {
  const value = form.get(field);
  return typeof value === "string" ? clean(value, max) : "";
}

export function readFilmRequest(form: FormData, hasReference: boolean): FilmRequest {
  const name = text(form, "name", MAX_NAME);
  if (!name) throw new Error("Give your star a name.");
  const city = pick<CityId>(form, "city", CITY_IDS, "city");
  const customCity = text(form, "customCity", MAX_CITY);
  if (city === "custom" && !customCity) throw new Error("Type the name of the city.");
  return {
    name,
    description: text(form, "description", MAX_DESCRIPTION),
    city,
    customCity,
    style: pick<StyleId>(form, "style", Object.keys(STYLES) as StyleId[], "style"),
    format: pick<FormatId>(form, "format", Object.keys(FORMATS) as FormatId[], "format"),
    quality: pick<QualityId>(form, "quality", Object.keys(QUALITIES) as QualityId[], "quality"),
    hasReference,
  };
}

export function seedFrom(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SEED ? value : randomSeed();
}

// Fills workflows/image.api.json: up to two LoadImage references -> FLUX.2 -> SaveImage.
// With one reference the batch node goes; with none, the references go too.
export function imageWorkflow(template: Graph, input: {
  prompt: string;
  width: number;
  height: number;
  seed: number;
  node: string;
  refs: unknown[];
}): Graph {
  const graph: Graph = structuredClone(template);
  graph.image.class_type = input.node;
  Object.assign(graph.image.inputs, {
    prompt: input.prompt,
    width: input.width,
    height: input.height,
    seed: input.seed,
    prompt_upsampling: false,
  });
  if (input.refs.length >= 2) {
    graph.ref1.inputs.image = input.refs[0];
    graph.ref2.inputs.image = input.refs[1];
  } else {
    delete graph.ref2;
    delete graph.refs;
    if (input.refs.length === 1) {
      graph.ref1.inputs.image = input.refs[0];
      graph.image.inputs.images = ["ref1", 0];
    } else {
      delete graph.ref1;
      delete graph.image.inputs.images;
    }
  }
  return graph;
}

// Fills workflows/clip.api.json: LoadImage -> LTX-2.5 image to video -> SaveVideo.
export function clipWorkflow(template: Graph, input: {
  still: unknown;
  prompt: string;
  seconds: number;
  quality: QualityId;
  format: FormatId;
  seed: number;
}): Graph {
  const graph: Graph = structuredClone(template);
  graph.still.inputs.image = input.still;
  Object.assign(graph.animate.inputs, {
    model: QUALITIES[input.quality].videoModel,
    "model.duration": String(input.seconds),
    "model.resolution": FORMATS[input.format].video[input.quality],
    "model.fps": "25",
    "model.generate_audio": true,
    prompt: input.prompt,
    seed: input.seed,
  });
  return graph;
}

// Fills workflows/score.api.json: LoadVideo -> Sonilo video to music -> SaveAudio.
export function scoreWorkflow(template: Graph, input: { video: unknown; prompt: string; seed: number }): Graph {
  const graph: Graph = structuredClone(template);
  graph.film.inputs.file = input.video;
  Object.assign(graph.score.inputs, { prompt: input.prompt, seed: input.seed });
  return graph;
}
