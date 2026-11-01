// The edit: ffmpeg joins the five clips into one film, gives every shot the same grade,
// sets the title over the end of the finale, and mixes the Sonilo score over the clips' own sound.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function ffmpegPath() {
  return process.env.FFMPEG_PATH || join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

function spawnFfmpeg(args: string[]): Promise<{ code: number | null; log: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let log = "";
    child.stderr.on("data", (chunk: Buffer) => {
      log += chunk.toString();
      if (log.length > 200_000) log = log.slice(-100_000);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, log }));
  });
}

export async function runFfmpeg(args: string[]) {
  const { code, log } = await spawnFfmpeg(["-y", ...args]);
  if (code !== 0) throw new Error(`ffmpeg failed: ${log.trim().split("\n").slice(-3).join(" | ")}`);
  return log;
}

// With no output file, ffmpeg prints the input's duration and streams, then exits with code 1.
export async function probe(file: string): Promise<{ seconds: number; audio: boolean; width: number; height: number }> {
  const { log } = await spawnFfmpeg(["-i", file]);
  const duration = log.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const size = log.match(/Stream #\S+.*Video:.*?, (\d+)x(\d+)/);
  if (!duration && !size) throw new Error(`Could not read ${file}.`);
  return {
    seconds: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : 0,
    audio: /Stream #\S+.*Audio:/.test(log),
    width: size ? Number(size[1]) : 0,
    height: size ? Number(size[2]) : 0,
  };
}

// The 2.39:1 picture band inside a 16:9 frame, and the height of the black bar above it.
export function letterboxBand(width: number, height: number) {
  const band = Math.round(width / 2.39 / 2) * 2;
  return { band, top: Math.round((height - band) / 4) * 2 };
}

export function letterboxFilter(width: number, height: number) {
  const { band, top } = letterboxBand(width, height);
  return `crop=${width}:${band}:0:${top},pad=${width}:${height}:0:${top}:black`;
}

// Puts a 2.4:1 still between black bars in a 16:9 frame, so the video model keeps a letterboxed shot.
export function barsArgs(input: { source: string; width: number; height: number; out: string }): string[] {
  const { band, top } = letterboxBand(input.width, input.height);
  return ["-i", input.source, "-vf", `scale=${input.width}:${band},setsar=1,pad=${input.width}:${input.height}:0:${top}:black`, "-frames:v", "1", input.out];
}

// The title is set in a serif font from the system. XITBC_TITLE_FONT picks another .ttf or .otf file.
const TITLE_FONTS = [
  "/System/Library/Fonts/Supplemental/Didot.ttc",
  "/System/Library/Fonts/Supplemental/Baskerville.ttc",
  "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  "/usr/share/fonts/dejavu/DejaVuSerif.ttf",
  "/usr/share/fonts/TTF/DejaVuSerif.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
  "C:/Windows/Fonts/georgia.ttf",
];

export function titleFont() {
  const chosen = process.env.XITBC_TITLE_FONT?.trim();
  if (chosen) return existsSync(chosen) ? chosen : null;
  return TITLE_FONTS.find((file) => existsSync(file)) ?? null;
}

export const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type Corner = (typeof CORNERS)[number];
export type TitleText = { lines: string[]; font: string; corner: Corner };

// The title block in a picture of width x height pixels. It sits at least 6 percent inside
// the side edges and 8 percent inside the top and bottom, and no line is wider than 40 percent of the picture.
export function titleLayout(lines: string[], corner: Corner, width: number, height: number) {
  const longest = Math.max(...lines.map((line) => [...line].length));
  const size = Math.round(width * Math.min(width >= height ? 0.046 : 0.085, 0.8 / longest));
  const marginX = Math.round(width * 0.06);
  const marginY = Math.round(height * 0.08);
  const lead = Math.round(size * 1.2);
  const block = lead * (lines.length - 1) + Math.round(size * 1.25);
  const top = corner.startsWith("top") ? marginY : height - marginY - block;
  const blockWidth = Math.round(longest * size * 0.5);
  const left = corner.endsWith("left") ? marginX : width - marginX - blockWidth;
  return { size, marginX, top, left, lead, block, blockWidth };
}

// The size of the grayscale copy that calmestCorner reads.
export const GRID: [number, number] = [96, 54];

export type TitleClip = { from: number; seconds: number; width: number; height: number; letterbox: boolean };

// GRID-sized grayscale copies for calmestCorner: one of a picture, or two a second of a clip,
// cut to the picture band for cinema.
export function grayArgs(input: { source: string; out: string; clip?: TitleClip }): string[] {
  const gray = `scale=${GRID[0]}:${GRID[1]},format=gray`;
  if (!input.clip) return ["-i", input.source, "-vf", gray, "-frames:v", "1", "-f", "rawvideo", input.out];
  const { from, seconds, width: w, height: h, letterbox } = input.clip;
  const { band, top } = letterboxBand(w, h);
  const crop = letterbox ? `,crop=${w}:${band}:0:${top}` : "";
  return ["-ss", fixed(from), "-t", fixed(seconds), "-i", input.source, "-vf", `fps=2,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1${crop},${gray}`, "-f", "rawvideo", input.out];
}

// The corner where the title is easiest to read in every frame it shows on: the one with the least detail
// and the least light, so the title does not cover the star or the landmark. gray holds one or more GRID-sized frames.
export function calmestCorner(gray: Uint8Array, lines: string[], width: number, height: number): Corner {
  const [cols, rows] = GRID;
  const frames = Math.max(1, Math.floor(gray.length / (cols * rows)));
  let best: Corner = CORNERS[0];
  let lowest = Infinity;
  for (const corner of CORNERS) {
    const box = titleLayout(lines, corner, width, height);
    const [c0, c1] = [Math.floor((box.left / width) * cols), Math.ceil(((box.left + box.blockWidth) / width) * cols)];
    const [r0, r1] = [Math.floor((box.top / height) * rows), Math.ceil(((box.top + box.block) / height) * rows)];
    let detail = 0;
    let light = 0;
    let count = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      const at = (row: number, col: number) => gray[frame * cols * rows + Math.min(row, rows - 1) * cols + Math.min(col, cols - 1)];
      for (let row = Math.max(r0, 0); row < Math.min(r1, rows); row += 1) {
        for (let col = Math.max(c0, 0); col < Math.min(c1, cols); col += 1) {
          const value = at(row, col);
          detail += Math.abs(value - at(row, col + 1)) + Math.abs(value - at(row + 1, col));
          light += value;
          count += 1;
        }
      }
    }
    const score = (detail + 0.1 * light) / Math.max(count, 1);
    if (score < lowest) {
      lowest = score;
      best = corner;
    }
  }
  return best;
}

// Escapes a value for an ffmpeg filter graph: once for the filter's options, then once for the graph.
export function filterValue(value: string) {
  return value.replace(/[\\':]/g, "\\$&").replace(/[\\'[\],;]/g, "\\$&");
}

// Draws the title as a fixed layer, so a push-in on the picture does not move the text.
// offset is the height of the black bar above the picture. fade is when the text fades in, in seconds.
export function titleFilters(text: TitleText, width: number, height: number, offset = 0, fade: [number, number] | null = null) {
  const layout = titleLayout(text.lines, text.corner, width, height);
  const alpha = fade ? `:alpha=${filterValue(`if(lt(t,${fade[0]}),0,if(lt(t,${fade[1]}),(t-${fade[0]})/${fade[1] - fade[0]},1))`)}` : "";
  const x = text.corner.endsWith("left") ? String(layout.marginX) : `w-text_w-${layout.marginX}`;
  const shadow = Math.max(2, Math.round(layout.size / 32));
  return text.lines.map((line, index) => [
    `drawtext=fontfile=${filterValue(text.font)}`,
    `text=${filterValue(line)}`,
    "expansion=none",
    `fontsize=${layout.size}`,
    "fontcolor=0xF2DDB0",
    "shadowcolor=black@0.55",
    "shadowx=0",
    `shadowy=${shadow}`,
    // A faint dark edge keeps the letters readable over light patches.
    `borderw=${Math.max(1, Math.round(layout.size / 45))}`,
    "bordercolor=black@0.35",
    `x=${x}`,
    `y=${offset + layout.top + index * layout.lead}`,
  ].join(":") + alpha).join(",");
}

// The frame the finale ends on, cut to the picture band for cinema. It sets where the title goes,
// and with the title on it, it is the film's poster.
export function frameArgs(input: { source: string; at: number; width: number; height: number; letterbox: boolean; out: string }): string[] {
  const { width: w, height: h } = input;
  const { band, top } = letterboxBand(w, h);
  const crop = input.letterbox ? `,crop=${w}:${band}:0:${top}` : "";
  return ["-ss", fixed(input.at), "-i", input.source, "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1${crop}`, "-frames:v", "1", "-update", "1", input.out];
}

// The poster: the title card as an image, for the page and for downloads.
export function posterArgs(input: { plate: string; text: TitleText; width: number; height: number; out: string }): string[] {
  return ["-i", input.plate, "-vf", titleFilters(input.text, input.width, input.height), "-frames:v", "1", "-update", "1", input.out];
}

const GRADE = "eq=contrast=1.05:saturation=1.06:gamma=0.98,vignette=angle=PI/6";
const GRAIN = "noise=alls=4:allf=t";
const AUDIO = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";

// The edit keeps "seconds" of each clip, from "start" seconds in.
export type Clip = { file: string; start: number; seconds: number; audio: boolean };

const fixed = (value: number) => value.toFixed(3);

export function roughCutArgs(input: {
  clips: Clip[];
  title: TitleText | null;
  titleSeconds: number;
  out: string;
  width: number;
  height: number;
  letterbox: boolean;
  grain: boolean;
}): string[] {
  const { width: w, height: h, clips } = input;
  const bars = input.letterbox ? `,${letterboxFilter(w, h)}` : "";
  const look = input.grain ? `${GRADE},${GRAIN}` : GRADE;
  const { band, top } = letterboxBand(w, h);
  const filters: string[] = [];
  const segments: string[] = [];
  clips.forEach((clip, i) => {
    const last = i === clips.length - 1;
    // The title fades in over the end of the finale, above the moving picture, and both fade to black.
    const title = last && input.title
      ? `,${titleFilters(input.title, w, input.letterbox ? band : h, input.letterbox ? top : 0, [clip.seconds - input.titleSeconds, clip.seconds - input.titleSeconds + 0.8])}`
      : "";
    const fades = [
      i === 0 ? "fade=t=in:st=0:d=0.5" : "",
      last ? `fade=t=out:st=${fixed(clip.seconds - 0.8)}:d=0.8` : "",
    ].filter(Boolean).map((fade) => `,${fade}`).join("");
    const out = last ? 0.8 : 0.08;
    // Each clip is cut to its part in the edit, which can be shorter than what the video model made.
    filters.push(`[${i}:v]trim=start=${fixed(clip.start)}:duration=${fixed(clip.seconds)},setpts=PTS-STARTPTS,fps=25,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,${look}${bars}${title}${fades},format=yuv420p,settb=AVTB[v${i}]`);
    filters.push(clip.audio
      ? `[${i}:a]${AUDIO},atrim=start=${fixed(clip.start)}:duration=${fixed(clip.seconds)},asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st=${fixed(clip.seconds - out)}:d=${out}[a${i}]`
      : `aevalsrc=0:c=stereo:s=48000:d=${fixed(clip.seconds)},${AUDIO}[a${i}]`);
    segments.push(`[v${i}][a${i}]`);
  });
  const inputs = clips.flatMap((clip) => ["-i", clip.file]);
  filters.push(`${segments.join("")}concat=n=${segments.length}:v=1:a=1[v][a]`);
  return [
    ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "25",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    input.out,
  ];
}

// The score leads. The clips' own sound stays underneath at half volume.
export function finalMixArgs(input: { rough: string; music: string | null; seconds: number; out: string }): string[] {
  const loud = `loudnorm=I=-14:TP=-1.5:LRA=11,${AUDIO}`;
  const audio = input.music
    ? `[1:a]${AUDIO},afade=t=in:d=0.3,apad,atrim=0:${fixed(input.seconds)},afade=t=out:st=${fixed(input.seconds - 2.5)}:d=2.5[m];[0:a]volume=0.5[fx];[m][fx]amix=inputs=2:duration=first:normalize=0,${loud}[a]`
    : `[0:a]${loud}[a]`;
  return [
    "-i", input.rough,
    ...(input.music ? ["-i", input.music] : []),
    "-filter_complex", audio,
    "-map", "0:v", "-map", "[a]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    input.out,
  ];
}

// Fits a photo inside the casting frame on a light grey background, so two references batch cleanly.
export function fitArgs(input: { source: string; width: number; height: number; out: string }): string[] {
  return [
    "-i", input.source,
    "-vf", `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:color=0xD9D9D9,setsar=1`,
    "-frames:v", "1",
    input.out,
  ];
}
