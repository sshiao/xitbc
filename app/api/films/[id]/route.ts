import { NextResponse } from "next/server";
import { comfyErrorMessage } from "../../../../lib/comfy";
import { continueFilm, readFilm, redrawShot, refilmShot } from "../../../../lib/film";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const film = await readFilm((await params).id);
  return film ? NextResponse.json(film) : NextResponse.json({ error: "Unknown film." }, { status: 404 });
}

// Films a finished storyboard, or resumes a failed film. With { "redraw": n }, it draws still n
// (from 0) of a storyboard again instead. With { "refilm": n or [n, ...] }, it films those shots of a
// finished film again, and { "redraw": [...] } next to it also draws their stills again.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const body = await request.json().catch(() => ({})) as { redraw?: unknown; refilm?: unknown };
    const list = (value: unknown) => ([] as unknown[]).concat(value ?? []).filter((item): item is number => Number.isInteger(item));
    const film = body.refilm !== undefined ? await refilmShot(id, list(body.refilm), list(body.redraw))
      : Number.isInteger(body.redraw) ? await redrawShot(id, body.redraw as number)
      : await continueFilm(id);
    return NextResponse.json(film, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: comfyErrorMessage(error) }, { status: 400 });
  }
}
