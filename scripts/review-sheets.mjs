// Makes review sheets of a film for the evaluator: a strip of frames for every shot,
// one frame per second of the whole film, small copies of the stills, and a facts file.
// Usage: node scripts/review-sheets.mjs <film id>

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const id = process.argv[2];
if (!id) throw new Error("Usage: node scripts/review-sheets.mjs <film id>");
const dir = join(process.cwd(), ".films", id);
const film = JSON.parse(readFileSync(join(dir, "film.json"), "utf8"));
const ffmpeg = process.env.FFMPEG_PATH || join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
const out = join(dir, "review");
mkdirSync(out, { recursive: true });

function run(args) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-y", ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim().split("\n").slice(-3).join(" | "));
  return result.stderr;
}

const made = [];
for (const [index, name] of [film.cast, film.poster, ...film.shots.map((shot) => shot.still)].entries()) {
  if (!name) continue;
  const target = join(out, index === 0 ? "cast.jpg" : index === 1 ? "title-card.jpg" : `still-${index - 1}.jpg`);
  run(["-i", join(dir, name), "-vf", "scale=960:-2", "-q:v", "3", target]);
  made.push(target);
}

const facts = { title: film.title, request: film.request, storyboardOnly: film.storyboardOnly, shots: film.shots.map((shot) => shot.label), warnings: film.warnings };
if (film.final && existsSync(join(dir, film.final))) {
  const video = join(dir, film.final);
  film.timeline.forEach((span, index) => {
    const length = span.end - span.start - 0.2;
    const target = join(out, span.label === "Title" ? "film-title.jpg" : `shot-${index + 1}.jpg`);
    run(["-ss", (span.start + 0.1).toFixed(2), "-t", length.toFixed(2), "-i", video, "-vf", `fps=5/${length.toFixed(2)},scale=480:-2,tile=5x1:padding=4:color=black`, "-frames:v", "1", target]);
    made.push(target);
  });
  const seconds = Math.ceil(film.timeline[film.timeline.length - 1].end);
  const target = join(out, "overview.jpg");
  run(["-i", video, "-vf", `fps=1,scale=320:-2,tile=7x${Math.ceil(seconds / 7)}:padding=3:color=black`, "-frames:v", "1", target]);
  made.push(target);
  const loudness = run(["-i", video, "-af", "ebur128", "-f", "null", "-"]).match(/I:\s+(-?[\d.]+) LUFS/g)?.pop();
  Object.assign(facts, { timeline: film.timeline, seconds, score: Boolean(film.music), loudness });
}
writeFileSync(join(out, "facts.json"), JSON.stringify(facts, null, 2));
console.log([...made, join(out, "facts.json")].join("\n"));
