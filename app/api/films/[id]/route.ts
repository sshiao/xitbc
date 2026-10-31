import { NextResponse } from "next/server";
import { comfyErrorMessage } from "../../../../lib/comfy";
import { continueFilm, readFilm } from "../../../../lib/film";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const film = await readFilm((await params).id);
  return film ? NextResponse.json(film) : NextResponse.json({ error: "Unknown film." }, { status: 404 });
}

// Films a finished storyboard.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await continueFilm((await params).id), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: comfyErrorMessage(error) }, { status: 400 });
  }
}
