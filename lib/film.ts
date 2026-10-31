// Produces a film in the background and keeps its state in .films/<id>/film.json,
// next to every file it makes. The page polls that state.

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { comfyClip, comfyDescribe, comfyErrorMessage, comfyImage, comfyScore, extension, hasApiKey, isFinal, type ClipInput, type ImageInput, type Media, type ScoreInput } from "./comfy";
import {
  barsArgs, calmestCorner, finalMixArgs, fitArgs, frameArgs, grayArgs, posterArgs, probe, roughCutArgs, runFfmpeg, titleFont,
  type TitleClip, type TitleText,
} from "./edit";
import { MOCK, mockClip, mockDescribe, mockImage, mockScore } from "./mock";
import { randomSeed } from "./requests";
import {
  BEATS, CAST_SIZE, FORMATS, STYLES, TITLE_SECONDS,
  castNotesPrompt, castPrompt, filmTitle, scorePrompt, shotMotionPrompt, shotStillPrompt, titleLines,
  type BeatId, type FilmRequest,
} from "./xitbc";

export const FILMS_DIR = join(process.cwd(), ".films");
const STALE_MS = 25 * 60_000;

export type Stage = "casting" | "storyboard" | "filming" | "scoring" | "editing" | "done" | "failed";
export type ShotStatus = "waiting" | "composing" | "filming" | "done" | "failed";

export type Film = {
  id: string;
  title: string;
  request: FilmRequest;
  storyboardOnly: boolean;
  stage: Stage;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  reference: string | null;
  cast: string | null;
  castNotes: string | null;
  poster: string | null;
  shots: { beat: BeatId; label: string; seconds: number; status: ShotStatus; still: string | null; clip: string | null }[];
  rough: string | null;
  music: string | null;
  final: string | null;
  timeline: { label: string; start: number; end: number }[];
  warnings: string[];
  error: string | null;
};

type Engine = {
  describe(image: Media, prompt: string): Promise<string>;
  image(input: ImageInput): Promise<Media>;
  clip(input: ClipInput): Promise<Media>;
  score(input: ScoreInput): Promise<Media | null>;
};

export function isConfigured() {
  return MOCK || hasApiKey();
}

function engineFor(dir: string): Engine {
  if (MOCK) return { describe: () => mockDescribe(), image: (input) => mockImage(dir, input), clip: (input) => mockClip(dir, input), score: () => mockScore() };
  return { describe: comfyDescribe, image: comfyImage, clip: comfyClip, score: comfyScore };
}

const ID = /^[a-z0-9]{6,16}-[a-f0-9]{6}$/;
const FILE = /^[a-z0-9-]+\.(png|jpg|jpeg|webp|mp4|flac|mp3|wav)$/;

function dirOf(id: string) {
  if (!ID.test(id)) throw new Error("Unknown film.");
  return join(FILMS_DIR, id);
}

export function filePath(id: string, name: string) {
  if (!FILE.test(name)) throw new Error("Unknown file.");
  return join(dirOf(id), name);
}

async function save(film: Film) {
  film.updatedAt = Date.now();
  const target = join(dirOf(film.id), "film.json");
  const temp = `${target}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(temp, JSON.stringify(film, null, 2));
  await rename(temp, target);
}

const active = (film: Film) => film.stage !== "done" && film.stage !== "failed";

export async function readFilm(id: string): Promise<Film | null> {
  try {
    const film = JSON.parse(await readFile(join(dirOf(id), "film.json"), "utf8")) as Film;
    // A film whose producer stopped, for example when the server restarted, stays failed.
    if (active(film) && Date.now() - film.updatedAt > STALE_MS) {
      film.stage = "failed";
      film.error = "Production stopped before the film was finished. Start it again.";
      await save(film);
    }
    return film;
  } catch {
    return null;
  }
}

export async function listFilms(limit = 12): Promise<Film[]> {
  let ids: string[] = [];
  try {
    ids = (await readdir(FILMS_DIR)).filter((id) => ID.test(id));
  } catch {
    return [];
  }
  const films = await Promise.all(ids.map(readFilm));
  return films.filter((film): film is Film => film !== null).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

async function retry<T>(task: () => Promise<T>, tries = 2): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      last = error;
      if (isFinal(error)) break;
    }
  }
  throw last;
}

export async function createFilm(request: FilmRequest, reference: Media | null, storyboardOnly: boolean): Promise<Film> {
  const id = `${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
  const dir = dirOf(id);
  await mkdir(dir, { recursive: true });
  const film: Film = {
    id,
    title: filmTitle(request),
    request,
    storyboardOnly,
    stage: "casting",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    finishedAt: null,
    reference: null,
    cast: null,
    castNotes: null,
    poster: null,
    shots: BEATS.map((beat) => ({ beat: beat.id, label: beat.label, seconds: beat.seconds, status: "waiting", still: null, clip: null })),
    rough: null,
    music: null,
    final: null,
    timeline: [],
    warnings: [],
    error: null,
  };
  if (reference) {
    film.reference = `reference.${extension(reference.type)}`;
    await writeFile(join(dir, film.reference), reference.bytes);
  }
  await save(film);
  void produce(film);
  return film;
}

// Films a storyboard-only film from the stills it already has.
export async function continueFilm(id: string): Promise<Film> {
  const film = await readFilm(id);
  if (!film) throw new Error("Unknown film.");
  if (!film.storyboardOnly || film.stage !== "done") throw new Error("Only a finished storyboard can be filmed.");
  film.storyboardOnly = false;
  film.stage = "filming";
  film.finishedAt = null;
  for (const shot of film.shots) shot.status = "waiting";
  await save(film);
  void produce(film);
  return film;
}

async function produce(film: Film) {
  try {
    await stages(film);
  } catch (error) {
    film.stage = "failed";
    film.error = comfyErrorMessage(error);
    await save(film).catch(() => {});
  }
}

async function stages(film: Film) {
  const dir = dirOf(film.id);
  const engine = engineFor(dir);
  const request = film.request;
  const [width, height] = FORMATS[request.format].still[request.quality];
  const read = async (name: string): Promise<Media> => ({
    bytes: new Uint8Array(await readFile(join(dir, name))),
    type: name.endsWith(".png") ? "image/png" : name.endsWith(".mp4") ? "video/mp4" : "image/jpeg",
  });
  const write = async (name: string, media: Media) => {
    await writeFile(join(dir, name), media.bytes);
    return name;
  };

  // 1. Casting: one clean, full-body image of the star that every shot refers to.
  let fitted: Media | null = null;
  if (film.reference) {
    await runFfmpeg(fitArgs({ source: join(dir, film.reference), width: CAST_SIZE[0], height: CAST_SIZE[1], out: join(dir, "reference-fit.png") }));
    fitted = await read("reference-fit.png");
  }
  let cast: Media;
  if (film.cast) {
    cast = await read(film.cast);
  } else {
    film.stage = "casting";
    await save(film);
    cast = await retry(() => engine.image({ prompt: castPrompt(request), width: CAST_SIZE[0], height: CAST_SIZE[1], seed: randomSeed(), quality: request.quality, refs: fitted ? [fitted] : [] }));
    film.cast = await write("cast.png", cast);
  }
  if (film.castNotes === null || film.castNotes === undefined) {
    try {
      film.castNotes = await retry(() => engine.describe(cast, castNotesPrompt(request)));
    } catch (error) {
      film.castNotes = "";
      film.warnings.push(`No casting notes: ${comfyErrorMessage(error)}`);
    }
    await save(film);
  }
  const notes = film.castNotes;

  // 2. Storyboard and filming. Each shot goes to LTX-2.5 as soon as its still is ready.
  if (film.stage === "casting") film.stage = "storyboard";
  await save(film);
  const refs = fitted ? [cast, fitted] : [cast];
  const results = await Promise.allSettled(film.shots.map(async (shot, index) => {
    let still: Media;
    if (shot.still) {
      still = await read(shot.still);
    } else {
      shot.status = "composing";
      await save(film);
      still = await retry(() => engine.image({ prompt: shotStillPrompt(request, shot.beat, notes), width, height, seed: randomSeed(), quality: request.quality, refs }));
      shot.still = await write(`shot-${index + 1}.png`, still);
    }
    // A shot that already has its clip is not filmed again.
    if (film.storyboardOnly || shot.clip) {
      shot.status = "done";
      await save(film);
      return;
    }
    shot.status = "filming";
    film.stage = "filming";
    await save(film);
    // A cinema still goes to LTX-2.5 between black bars, so the edit can crop back to the same band.
    let first = still;
    if (FORMATS[request.format].letterbox) {
      await runFfmpeg(barsArgs({ source: join(dir, shot.still), ...size(film), out: join(dir, `shot-${index + 1}-frame.png`) }));
      first = await read(`shot-${index + 1}-frame.png`);
    }
    const clip = await retry(() => engine.clip({ still: first, prompt: shotMotionPrompt(request, shot.beat, notes), seconds: shot.seconds, quality: request.quality, format: request.format, seed: randomSeed() }));
    shot.clip = await write(`shot-${index + 1}.mp4`, clip);
    shot.status = "done";
    await save(film);
  }));
  const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failure) {
    film.shots.forEach((shot) => { if (shot.status !== "done") shot.status = "failed"; });
    throw failure.reason;
  }
  if (film.storyboardOnly) {
    // A storyboard's title card uses the finale still. Filming remakes it from the finale's last frame.
    await titleCard(dir, film, film.shots[film.shots.length - 1].still!);
    film.stage = "done";
    film.finishedAt = Date.now();
    await save(film);
    return;
  }

  // 3. Rough cut: one grade for every shot, black bars for cinema, and the title over the end of the finale.
  film.stage = "scoring";
  await save(film);
  // Each clip is cut to the part its beat uses, which can be shorter than what LTX-2.5 made.
  const clips = await Promise.all(film.shots.map(async (shot) => {
    const found = await probe(join(dir, shot.clip!));
    const beat = BEATS.find((item) => item.id === shot.beat);
    const start = Math.min(beat?.from ?? 0, found.seconds / 2);
    return { file: join(dir, shot.clip!), audio: found.audio, start, seconds: Math.min(found.seconds, beat?.use ?? found.seconds) - start };
  }));
  // The poster is the frame the finale ends on. The title's corner must stay clear for as long as
  // the title is on screen, so it is chosen from frames across that time.
  const finale = clips[clips.length - 1];
  const end = finale.start + finale.seconds;
  const frame = { ...size(film), letterbox: FORMATS[request.format].letterbox };
  await runFfmpeg(frameArgs({ source: finale.file, at: Math.max(0, end - 0.04), ...frame, out: join(dir, "title-plate.png") }));
  const title = await titleCard(dir, film, "title-plate.png", finale.file, { from: Math.max(finale.start, end - TITLE_SECONDS), seconds: Math.min(TITLE_SECONDS, finale.seconds), ...frame });
  let start = 0;
  film.timeline = film.shots.map((shot, index) => {
    const end = Math.round((start + clips[index].seconds) * 1000) / 1000;
    const span = { label: shot.label, start, end };
    start = end;
    return span;
  });
  const seconds = start;
  // The title shows over the end of the finale.
  if (title) film.timeline.push({ label: "Title", start: Math.max(0, seconds - TITLE_SECONDS), end: seconds });
  await runFfmpeg(roughCutArgs({
    clips,
    title,
    titleSeconds: TITLE_SECONDS,
    out: join(dir, "rough.mp4"),
    ...size(film),
    letterbox: FORMATS[request.format].letterbox,
    grain: STYLES[request.style].grain,
  }));
  film.rough = "rough.mp4";

  // 4. Score: Sonilo writes music to fit the rough cut. The film still finishes without it.
  try {
    const music = await retry(async () => engine.score({ video: await read("rough.mp4"), prompt: scorePrompt(request), seed: randomSeed() }));
    if (music) film.music = await write(`music.${extension(music.type)}`, music);
  } catch (error) {
    film.warnings.push(`No score: ${comfyErrorMessage(error)}`);
  }

  // 5. Final mix.
  film.stage = "editing";
  await save(film);
  await runFfmpeg(finalMixArgs({ rough: join(dir, "rough.mp4"), music: film.music ? join(dir, film.music) : null, seconds, out: join(dir, "final.mp4") }));
  film.final = "final.mp4";
  film.stage = "done";
  film.finishedAt = Date.now();
  await save(film);
}

// Sets the title over a picture in its calmest corner and saves it as the poster. With a clip,
// the corner is chosen from that clip's frames instead. The film carries on without a title card when this fails.
async function titleCard(dir: string, film: Film, plate: string, source?: string, clip?: TitleClip): Promise<TitleText | null> {
  const font = titleFont();
  if (!font) {
    film.warnings.push("No title card: no title font was found. Set XITBC_TITLE_FONT to a .ttf or .otf file.");
    return null;
  }
  try {
    const lines = titleLines(film.request);
    const { width, height } = await probe(join(dir, plate));
    await runFfmpeg(grayArgs({ source: source ?? join(dir, plate), out: join(dir, "title-gray.raw"), clip }));
    const gray = new Uint8Array(await readFile(join(dir, "title-gray.raw")));
    await rm(join(dir, "title-gray.raw"), { force: true });
    const text: TitleText = { lines, font, corner: calmestCorner(gray, lines, width, height) };
    await runFfmpeg(posterArgs({ plate: join(dir, plate), text, width, height, out: join(dir, "poster.png") }));
    film.poster = "poster.png";
    await save(film);
    return text;
  } catch (error) {
    film.warnings.push(`No title card: ${comfyErrorMessage(error)}`);
    return null;
  }
}

function size(film: Film) {
  const [width, height] = FORMATS[film.request.format].video[film.request.quality].split("x").map(Number);
  return { width, height };
}
