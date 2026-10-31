import { NextResponse } from "next/server";
import { comfyErrorMessage } from "../../../lib/comfy";
import { createFilm, isConfigured, listFilms } from "../../../lib/film";
import { readFilmRequest } from "../../../lib/requests";
import { readImage } from "../../../lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listFilms());
}

export async function POST(request: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "COMFY_API_KEY is not configured." }, { status: 503 });
  let film: Awaited<ReturnType<typeof createFilm>>;
  try {
    const form = await request.formData();
    const upload = form.get("photo");
    const photo = upload instanceof File && upload.size > 0 ? readImage(upload, "the star's photo") : null;
    const filmRequest = readFilmRequest(form, photo !== null);
    film = await createFilm(
      filmRequest,
      photo ? { bytes: new Uint8Array(await photo.arrayBuffer()), type: photo.type } : null,
      form.get("storyboardOnly") === "1",
    );
  } catch (error) {
    return NextResponse.json({ error: comfyErrorMessage(error) }, { status: 400 });
  }
  return NextResponse.json(film, { status: 202 });
}
