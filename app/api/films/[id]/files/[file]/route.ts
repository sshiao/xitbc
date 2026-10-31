import { readFile } from "node:fs/promises";
import { filePath } from "../../../../../../lib/film";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  mp4: "video/mp4", flac: "audio/flac", mp3: "audio/mpeg", wav: "audio/wav",
};

// Serves one file of a film. Browsers seek in video with Range requests, so those get a 206.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath(id, file));
  } catch {
    return Response.json({ error: "Unknown file." }, { status: 404 });
  }
  const type = TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream";
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Length": String(bytes.length) } });
  const start = range[1] ? Number(range[1]) : Math.max(0, bytes.length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
  if (start > end || start >= bytes.length) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } });
  }
  return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Content-Length": String(end - start + 1) },
  });
}
