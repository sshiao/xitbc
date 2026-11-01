import { NextResponse } from "next/server";
import { comfyErrorMessage } from "../../../../lib/comfy";
import { continueFilm, readFilm, redrawShot } from "../../../../lib/film";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const film = await readFilm((await params).id);
  return film ? NextResponse.json(film) : NextResponse.json({ error: "Unknown film." }, { status: 404 });
}

// Films a finished storyboard. With { "redraw": n }, it draws still n (from 0) again instead.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const body = await request.json().catch(() => ({})) as { redraw?: unknown };
    const film = Number.isInteger(body.redraw) ? await redrawShot(id, body.redraw as number) : await continueFilm(id);
    return NextResponse.json(film, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: comfyErrorMessage(error) }, { status: 400 });
  }
}
