import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_REQUEST } from "../lib/xitbc.ts";
import { clipWorkflow, imageWorkflow, readFilmRequest, scoreWorkflow, type Graph } from "../lib/requests.ts";

const load = (name: string) => JSON.parse(readFileSync(new URL(`../workflows/${name}.api.json`, import.meta.url), "utf8")) as Graph;
const image = load("image");
const clip = load("clip");
const score = load("score");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const base = { name: "Maya", description: "", city: "tokyo", customCity: "", style: "live-action", format: "cinema", quality: "draft" };

test("readFilmRequest reads a valid form", () => {
  const request = readFilmRequest(form(base), true);
  assert.deepEqual(request, { ...DEFAULT_REQUEST, name: "Maya", city: "tokyo", hasReference: true });
});

test("readFilmRequest rejects missing names, unknown options and blank custom cities", () => {
  assert.throws(() => readFilmRequest(form({ ...base, name: " " }), false), /name/);
  assert.throws(() => readFilmRequest(form({ ...base, city: "atlantis" }), false), /city/);
  assert.throws(() => readFilmRequest(form({ ...base, city: "custom" }), false), /city/);
  assert.throws(() => readFilmRequest(form({ ...base, style: "claymation" }), false), /style/);
});

const imageInput = { prompt: "p", width: 1536, height: 864, seed: 3, node: "Flux2MaxImageNode" };

test("imageWorkflow batches two references", () => {
  const graph = imageWorkflow(image, { ...imageInput, refs: ["cast.png", "photo.png"] });
  assert.equal(graph.ref1.inputs.image, "cast.png");
  assert.equal(graph.ref2.inputs.image, "photo.png");
  assert.deepEqual(graph.image.inputs.images, ["refs", 0]);
  assert.equal(graph.image.class_type, "Flux2MaxImageNode");
  assert.equal(graph.image.inputs.prompt_upsampling, false);
});

test("imageWorkflow drops the batch for one reference, and every reference for none", () => {
  const one = imageWorkflow(image, { ...imageInput, refs: ["cast.png"] });
  assert.deepEqual(one.image.inputs.images, ["ref1", 0]);
  assert.equal(one.ref2, undefined);
  assert.equal(one.refs, undefined);
  const none = imageWorkflow(image, { ...imageInput, refs: [] });
  assert.equal(none.ref1, undefined);
  assert.equal(none.image.inputs.images, undefined);
  assert.deepEqual(Object.keys(none).sort(), ["image", "save"]);
  assert.equal(image.ref1.inputs.image, "ref1.png", "the template stays unchanged");
});

test("clipWorkflow sets the MiniMax H3 model, prompt, length and size", () => {
  const graph = clipWorkflow(clip, { still: "s.png", prompt: "go", seconds: 5, quality: "final", format: "vertical", seed: 9 });
  assert.equal(graph.still.inputs.image, "s.png");
  assert.equal(graph.animate.class_type, "MinimaxHailuo03FirstLastFrameNode");
  assert.deepEqual(graph.animate.inputs.first_frame, ["still", 0]);
  assert.equal(graph.animate.inputs.model, "MiniMax H3");
  assert.equal(graph.animate.inputs["model.prompt"], "go");
  assert.equal(graph.animate.inputs["model.duration"], 5);
  assert.equal(graph.animate.inputs["model.resolution"], "2K");
  assert.equal(graph.animate.inputs.watermark, false);
  assert.equal(clipWorkflow(clip, { still: "s.png", prompt: "go", seconds: 4, quality: "draft", format: "cinema", seed: 1 }).animate.inputs["model.resolution"], "768P");
});

test("scoreWorkflow feeds the rough cut to Sonilo", () => {
  const graph = scoreWorkflow(score, { video: "rough.mp4", prompt: "uplifting", seed: 1 });
  assert.equal(graph.film.inputs.file, "rough.mp4");
  assert.equal(graph.score.class_type, "SoniloVideoToMusic");
  assert.deepEqual(graph.save.inputs.audio, ["score", 0]);
});
