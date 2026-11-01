// Makes a film through the running app, waits for it, then writes its review sheets.
//
//   node scripts/film.mjs new --name Maya --description "a girl in a yellow raincoat" --city tokyo [--storyboard] [--photo star.jpg]
//   node scripts/film.mjs continue <film id>
//   node scripts/film.mjs redraw <film id> <shot number, 1 to 5>
//
// Options for "new": --name, --description, --city, --custom-city, --style, --format, --quality, --photo, --storyboard.
// Set XITBC_URL to reach an app that is not on http://localhost:3000.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const base = process.env.XITBC_URL ?? "http://localhost:3000";
const [command, ...rest] = process.argv.slice(2);

function options(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index].replace(/^--/, "");
    if (key === "storyboard") values.storyboard = true;
    else values[key] = args[(index += 1)];
  }
  return values;
}

async function start() {
  const values = options(rest);
  const form = new FormData();
  const fields = { name: values.name, description: values.description ?? "", city: values.city ?? "new-york", customCity: values["custom-city"] ?? "", style: values.style ?? "live-action", format: values.format ?? "cinema", quality: values.quality ?? "draft" };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  if (values.storyboard) form.set("storyboardOnly", "1");
  if (values.photo) form.set("photo", new File([readFileSync(values.photo)], basename(values.photo), { type: values.photo.endsWith(".png") ? "image/png" : "image/jpeg" }));
  const response = await fetch(`${base}/api/films`, { method: "POST", body: form });
  const film = await response.json();
  if (!response.ok) throw new Error(film.error ?? `The app answered ${response.status}.`);
  return film.id;
}

async function resume(id) {
  const response = await fetch(`${base}/api/films/${id}`, { method: "POST" });
  const film = await response.json();
  if (!response.ok) throw new Error(film.error ?? `The app answered ${response.status}.`);
  return film.id;
}

async function redraw(id, shot) {
  const response = await fetch(`${base}/api/films/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redraw: Number(shot) - 1 }) });
  const film = await response.json();
  if (!response.ok) throw new Error(film.error ?? `The app answered ${response.status}.`);
  return film.id;
}

const id = command === "new" ? await start() : command === "continue" ? await resume(rest[0]) : command === "redraw" ? await redraw(rest[0], rest[1]) : null;
if (!id) throw new Error('Use "new", "continue <film id>" or "redraw <film id> <shot number>".');
console.log(`film ${id}`);

const started = Date.now();
let last = "";
for (;;) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const film = await (await fetch(`${base}/api/films/${id}`)).json();
  const line = `${film.stage} ${film.shots.map((shot) => shot.status[0]).join("")}`;
  if (line !== last) console.log(`${Math.round((Date.now() - started) / 1000)}s ${line}`);
  last = line;
  if (film.stage === "failed") throw new Error(film.error);
  if (film.stage === "done") {
    for (const warning of film.warnings) console.log(`warning: ${warning}`);
    break;
  }
}
const sheets = spawnSync(process.execPath, ["scripts/review-sheets.mjs", id], { encoding: "utf8" });
process.stdout.write(sheets.stdout);
if (sheets.status !== 0) throw new Error(sheets.stderr);
