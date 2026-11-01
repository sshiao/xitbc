// Mock mode (XITBC_MOCK=1) makes every image, clip and score with ffmpeg instead of Comfy.
// The whole pipeline, edit included, then runs offline and costs nothing.

import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClipInput, ImageInput, Media } from "./comfy";
import { runFfmpeg } from "./edit";
import { FORMATS } from "./xitbc";

export const MOCK = process.env.XITBC_MOCK === "1";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let counter = 0;

async function scratch(dir: string, extension: string) {
  counter += 1;
  return join(dir, `mock-${Date.now()}-${counter}.${extension}`);
}

export async function mockImage(dir: string, input: ImageInput): Promise<Media> {
  await pause(800);
  const out = await scratch(dir, "png");
  const fit = `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:color=0x1B2138`;
  if (input.refs[0]) {
    const source = await scratch(dir, "png");
    await writeFile(source, input.refs[0].bytes);
    await runFfmpeg(["-i", source, "-vf", fit, "-frames:v", "1", out]);
    await rm(source, { force: true });
  } else {
    await runFfmpeg(["-f", "lavfi", "-i", `gradients=s=${input.width}x${input.height}:c0=0x1B2138:c1=0xFF8A3D:x0=0:y0=0:x1=${input.width}:y1=${input.height}`, "-frames:v", "1", out]);
  }
  return take(out, "image/png");
}

async function take(file: string, type: string): Promise<Media> {
  const bytes = new Uint8Array(await readFile(file));
  await rm(file, { force: true });
  return { bytes, type };
}

export async function mockClip(dir: string, input: ClipInput): Promise<Media> {
  await pause(1500);
  const [width, height] = FORMATS[input.format].video[input.quality].split("x").map(Number);
  const source = await scratch(dir, "png");
  const out = await scratch(dir, "mp4");
  await writeFile(source, input.still.bytes);
  const frames = input.seconds * 25;
  await runFfmpeg([
    "-i", source,
    "-f", "lavfi", "-i", `anoisesrc=color=brown:amplitude=0.04:d=${input.seconds}`,
    "-filter_complex", `[0:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},zoompan=z='min(zoom+0.001,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=25,format=yuv420p[v]`,
    "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-t", String(input.seconds),
    out,
  ]);
  await rm(source, { force: true });
  return take(out, "video/mp4");
}

// Mock mode has no music: the edit then keeps the clips' own sound.
export async function mockScore(): Promise<Media | null> {
  await pause(500);
  return null;
}

export async function mockDescribe(): Promise<string> {
  return "";
}

// Mock mode has no screenwriter: the film uses the built-in screenplay.
export async function mockWrite(): Promise<string> {
  return "";
}
