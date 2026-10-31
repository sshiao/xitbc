"use client";

import { useEffect, useMemo, useState } from "react";
import { formatElapsed, preparePhoto } from "../lib/image";
import {
  CITIES, DEFAULT_REQUEST, FORMATS, MAX_CITY, MAX_DESCRIPTION, MAX_NAME, QUALITIES, STYLES,
  filmCost, filmTitle,
  type CityId, type FilmRequest, type FormatId, type QualityId, type StyleId,
} from "../lib/xitbc";

type Shot = { beat: string; label: string; seconds: number; status: string; still: string | null; clip: string | null };
type Film = {
  id: string;
  title: string;
  request: FilmRequest;
  storyboardOnly: boolean;
  stage: string;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  cast: string | null;
  poster: string | null;
  shots: Shot[];
  final: string | null;
  warnings: string[];
  error: string | null;
};
type Form = Omit<FilmRequest, "hasReference">;

const STAGES = [
  { id: "casting", label: "Casting" },
  { id: "storyboard", label: "Storyboard" },
  { id: "filming", label: "Filming" },
  { id: "scoring", label: "Score" },
  { id: "editing", label: "Final cut" },
];
const STARS = ["Maya", "a Sheep", "Grandma", "your Dog", "a Teddy Bear", "You"];

const fileUrl = (film: Film, name: string) => `/api/films/${film.id}/files/${name}`;
const busy = (film: Film | null) => Boolean(film && film.stage !== "done" && film.stage !== "failed");

async function errorFrom(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return new Error(body.error || fallback);
}

function useObjectUrl(file: Blob | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function Choice<T extends string>(props: { label: string; value: T; options: Record<T, { label: string; hint?: string }>; disabled: boolean; onChange: (value: T) => void }) {
  return (
    <fieldset className="field">
      <legend>{props.label}</legend>
      <div className="chips" role="radiogroup" aria-label={props.label}>
        {(Object.entries(props.options) as [T, { label: string; hint?: string }][]).map(([key, option]) => (
          <button type="button" key={key} role="radio" aria-checked={props.value === key} title={option.hint}
            className={`chip${props.value === key ? " on" : ""}`} disabled={props.disabled} onClick={() => props.onChange(key)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function StarTile(props: { preview?: string; disabled: boolean; onPick: (file: File | undefined) => void; onClear: () => void }) {
  const [over, setOver] = useState(false);
  if (props.preview) {
    return (
      <div className="tile filled">
        <img src={props.preview} alt="Your star" />
        <button type="button" className="tile-clear" aria-label="Remove the photo" disabled={props.disabled} onClick={props.onClear}>×</button>
      </div>
    );
  }
  return (
    <label className={`tile${over ? " over" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); setOver(false); props.onPick(event.dataTransfer.files?.[0]); }}>
      <input type="file" accept="image/*" disabled={props.disabled} onChange={(event) => props.onPick(event.target.files?.[0])} />
      <span className="tile-icon" aria-hidden>+</span>
      <span className="tile-label">Add a photo of your star</span>
      <span className="tile-hint">A person, a pet, a toy. Optional: you can describe them instead.</span>
    </label>
  );
}

function Hero() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % STARS.length), 1800);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section className="hero">
      <svg className="night" viewBox="0 0 600 260" aria-hidden>
        <defs>
          <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1030" /><stop offset=".7" stopColor="#2a1f5c" /><stop offset="1" stopColor="#b8476b" /></linearGradient>
        </defs>
        <rect width="600" height="260" fill="url(#dusk)" />
        {[[40, 120], [80, 170], [130, 90], [175, 200], [230, 140], [280, 110], [320, 210], [370, 150], [420, 180], [470, 100], [515, 190], [560, 130]].map(([x, h]) => (
          <g key={x}>
            <rect x={x} y={260 - h} width="38" height={h} fill="#0a0d1f" />
            {Array.from({ length: Math.floor(h / 22) }, (_, row) => (
              <rect key={row} x={x + 8 + ((row * 7) % 18)} y={270 - h + row * 22} width="5" height="7" fill="#ffd36b" opacity={(x + row) % 3 === 0 ? 0.9 : 0.25} />
            ))}
          </g>
        ))}
        <circle cx="298" cy="232" r="7" fill="#ffd36b" />
        <rect x="294" y="238" width="8" height="18" rx="3" fill="#ffd36b" />
      </svg>
      <h1><span className="hero-star" key={index}>{STARS[index]}</span> in the Big City</h1>
      <p>Pick a star and a city. XitBC casts them, draws a five-scene storyboard, films each scene, scores it, and cuts it into a short film with a title card.</p>
      <ol className="how">
        <li><b>1</b> Add your star</li>
        <li><b>2</b> Pick a city</li>
        <li><b>3</b> Get a 27-second film</li>
      </ol>
    </section>
  );
}

function Storyboard(props: { film: Film }) {
  const { film } = props;
  const vertical = film.request.format === "vertical";
  return (
    <div className={`board${vertical ? " vertical" : ""}`}>
      {film.shots.map((shot, index) => (
        <figure key={shot.beat} className={`shot ${shot.status}`}>
          <div className="shot-frame">
            {shot.still ? <img src={fileUrl(film, shot.still)} alt={shot.label} /> : <div className="shimmer" />}
            {shot.clip && (
              <video src={fileUrl(film, shot.clip)} muted loop playsInline preload="none" className="shot-clip"
                onMouseEnter={(event) => void event.currentTarget.play().catch(() => {})}
                onMouseLeave={(event) => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }} />
            )}
            {shot.status === "composing" && <span className="shot-badge">Composing…</span>}
            {shot.status === "filming" && <span className="shot-badge">Filming…</span>}
            {shot.status === "failed" && <span className="shot-badge bad">Failed</span>}
          </div>
          <figcaption><b>{index + 1}</b> {shot.label} <span>{shot.seconds} s</span></figcaption>
        </figure>
      ))}
    </div>
  );
}

function Stages(props: { film: Film }) {
  const { film } = props;
  const steps = film.storyboardOnly ? STAGES.slice(0, 2) : STAGES;
  const current = film.stage === "done" ? steps.length : steps.findIndex((step) => step.id === film.stage);
  return (
    <ol className="stages">
      {steps.map((step, index) => {
        const state = film.stage === "failed" && index === Math.max(0, current) ? "failed"
          : index < current || film.stage === "done" ? "done" : index === current ? "active" : "todo";
        return <li key={step.id} className={state}><span>{state === "done" ? "✓" : index + 1}</span>{step.label}</li>;
      })}
    </ol>
  );
}

export function Studio() {
  const [status, setStatus] = useState<{ configured: boolean; mock: boolean } | null>(null);
  const [form, setForm] = useState<Form>(() => {
    const { hasReference: _, ...rest } = DEFAULT_REQUEST;
    return rest;
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [film, setFilm] = useState<Film | null>(null);
  const [films, setFilms] = useState<Film[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(0);
  const photoUrl = useObjectUrl(photo);
  const working = busy(film) || sending;
  const title = filmTitle(form);

  useEffect(() => {
    fetch("/api/status").then((response) => response.json()).then(setStatus).catch(() => setStatus(null));
    void refreshFilms();
    const fromHash = () => {
      const id = new URLSearchParams(window.location.hash.slice(1)).get("film");
      if (id) void openFilm(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  useEffect(() => {
    if (!busy(film)) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/films/${film!.id}`);
        if (!response.ok) throw await errorFrom(response, "Could not check the film.");
        const next = await response.json() as Film;
        setFilm(next);
        if (!busy(next)) void refreshFilms();
      } catch (cause) {
        setError(true);
        setMessage(cause instanceof Error ? cause.message : "Could not check the film.");
      }
    }, 2000);
    return () => { window.clearInterval(tick); window.clearTimeout(poll); };
  }, [film]);

  // Paste a photo from the clipboard anywhere on the page.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (file && !working) void choosePhoto(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  async function refreshFilms() {
    try {
      const response = await fetch("/api/films");
      if (response.ok) setFilms(await response.json() as Film[]);
    } catch {
      // The gallery is a convenience. The page works without it.
    }
  }

  async function openFilm(id: string) {
    const response = await fetch(`/api/films/${id}`);
    if (!response.ok) return;
    setFilm(await response.json() as Film);
    setMessage(""); setError(false);
    window.history.replaceState(null, "", `#film=${id}`);
  }

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function choosePhoto(file: File | undefined) {
    setError(false); setMessage("");
    if (!file) { setPhoto(null); return; }
    try {
      setPhoto(await preparePhoto(file));
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : "Could not read that photo.");
    }
  }

  async function start(storyboardOnly: boolean) {
    if (working) return;
    setSending(true); setError(false); setMessage("");
    const body = new FormData();
    for (const [key, value] of Object.entries(form)) body.set(key, String(value));
    if (photo) body.set("photo", photo);
    if (storyboardOnly) body.set("storyboardOnly", "1");
    try {
      const response = await fetch("/api/films", { method: "POST", body });
      if (!response.ok) throw await errorFrom(response, "Could not start the film.");
      const next = await response.json() as Film;
      setFilm(next);
      setNow(Date.now());
      window.history.replaceState(null, "", `#film=${next.id}`);
      if (window.matchMedia("(max-width: 900px)").matches) document.querySelector(".stage")?.scrollIntoView({ behavior: "smooth" });
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : "Could not start the film.");
    } finally {
      setSending(false);
    }
  }

  async function filmIt() {
    if (!film) return;
    setSending(true); setError(false); setMessage("");
    try {
      const response = await fetch(`/api/films/${film.id}`, { method: "POST" });
      if (!response.ok) throw await errorFrom(response, "Could not film the storyboard.");
      setFilm(await response.json() as Film);
      setNow(Date.now());
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : "Could not film the storyboard.");
    } finally {
      setSending(false);
    }
  }

  function closeFilm() {
    setFilm(null); setMessage(""); setError(false);
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function share(current: Film) {
    if (!current.final) return;
    try {
      const blob = await (await fetch(fileUrl(current, current.final))).blob();
      const file = new File([blob], `${current.title}.mp4`, { type: "video/mp4" });
      const text = `${current.title}, made with XitBC, an open-source app on ComfyUI. #OpenSourceHiggsfield`;
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else { await navigator.clipboard.writeText(text); setError(false); setMessage("This browser cannot share files. Download the film. The caption is on your clipboard."); }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(true); setMessage("Could not share the film. Download it instead.");
    }
  }

  const filming = film?.shots.filter((shot) => shot.status === "filming").length ?? 0;
  const progress = !film ? "" : {
    casting: `Casting ${film.request.name}…`,
    storyboard: "Drawing the storyboard with FLUX.2…",
    filming: `LTX-2.5 is filming ${filming || "the"} shot${filming === 1 ? "" : "s"}…`,
    scoring: "Cutting the rough cut and writing the score with Sonilo…",
    editing: "Mixing the final cut…",
  }[film.stage] ?? "";
  const storyboardCost = 7 * QUALITIES[form.quality].imageCost;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><b>X</b>itBC</span>
        <span className="tagline">X in the Big City</span>
        <a className="topbar-link" href="https://github.com/sshiao/xitbc" target="_blank" rel="noreferrer">Source ↗</a>
      </header>

      {status && !status.configured && <p className="banner">Add your Comfy API key to <code>.env.local</code> as <code>COMFY_API_KEY</code>, then restart the app. The README has the steps.</p>}
      {status?.mock && <p className="banner mock">Mock mode: no Comfy calls. Every image and clip is made locally from your photo.</p>}

      <div className="layout">
        <aside className="panel">
          <StarTile preview={photoUrl} disabled={working} onPick={(file) => void choosePhoto(file)} onClear={() => void choosePhoto(undefined)} />
          <label className="field">
            <span className="legend">Star&apos;s name</span>
            <input value={form.name} maxLength={MAX_NAME} disabled={working} placeholder="Maya, Biscuit, Grandpa…" onChange={(event) => update("name", event.target.value)} />
          </label>
          <label className="field">
            <span className="legend">Describe them <em>optional</em></span>
            <input value={form.description} maxLength={MAX_DESCRIPTION} disabled={working} placeholder="a girl in a yellow raincoat, a fluffy white sheep…" onChange={(event) => update("description", event.target.value)} />
          </label>

          <fieldset className="field">
            <legend>City</legend>
            <div className="chips" role="radiogroup" aria-label="City">
              {([...Object.entries(CITIES).map(([id, city]) => [id, city.label]), ["custom", "Somewhere else"]] as [CityId, string][]).map(([id, label]) => (
                <button type="button" key={id} role="radio" aria-checked={form.city === id} className={`chip${form.city === id ? " on" : ""}`} disabled={working} onClick={() => update("city", id)}>{label}</button>
              ))}
            </div>
          </fieldset>
          {form.city === "custom" && (
            <input value={form.customCity} maxLength={MAX_CITY} disabled={working} placeholder="Rome, Seoul, Mexico City…" aria-label="City name" onChange={(event) => update("customCity", event.target.value)} />
          )}

          <Choice<StyleId> label="Style" value={form.style} options={STYLES} disabled={working} onChange={(value) => update("style", value)} />
          <Choice<FormatId> label="Format" value={form.format} options={FORMATS} disabled={working} onChange={(value) => update("format", value)} />
          <Choice<QualityId> label="Quality" value={form.quality} options={QUALITIES} disabled={working} onChange={(value) => update("quality", value)} />

          <p className="title-preview">{form.name.trim() ? title : "X in the Big City"}</p>
          <button type="button" className="run" disabled={!form.name.trim() || working || status?.configured === false} onClick={() => void start(false)}>
            {working ? "In production…" : "Roll camera"}
          </button>
          <button type="button" className="secondary" disabled={!form.name.trim() || working || status?.configured === false} onClick={() => void start(true)}>
            Storyboard first
          </button>
          <p className="note">{QUALITIES[form.quality].hint}. A full film costs about ${filmCost(form.quality).toFixed(2)}. A storyboard alone costs about ${storyboardCost.toFixed(2)}.</p>
        </aside>

        <main className="stage">
          {!film && <Hero />}

          {film && (
            <section className="production">
              <div className="production-head">
                <h1 className="film-title">{film.title}</h1>
                <button type="button" className="secondary small" disabled={working} onClick={closeFilm}>New film</button>
              </div>
              <Stages film={film} />

              {film.final && (
                <div className={`screen${film.request.format === "vertical" ? " vertical" : ""}`}>
                  <video key={film.final} src={fileUrl(film, film.final)} controls playsInline poster={film.poster ? fileUrl(film, film.poster) : undefined} />
                </div>
              )}

              <div className="cast-row">
                <figure className="cast">
                  {film.cast ? <img src={fileUrl(film, film.cast)} alt={`${film.request.name}, cast`} /> : <div className="shimmer" />}
                  <figcaption>Meet {film.request.name}</figcaption>
                </figure>
                <Storyboard film={film} />
              </div>

              {busy(film) && <p className="summary">{progress} {formatElapsed(now - film.createdAt)} elapsed. A storyboard takes about 3 minutes and a film about 5 to 8.</p>}
              {film.stage === "failed" && <p className="status error">{film.error}</p>}
              {film.warnings.length > 0 && <p className="status">{film.warnings.join(" ")}</p>}

              {film.stage === "done" && (
                <div className="actions">
                  {film.storyboardOnly ? (
                    <button type="button" className="run small" disabled={sending} onClick={() => void filmIt()}>
                      Film it (about ${(filmCost(film.request.quality) - storyboardCost).toFixed(2)})
                    </button>
                  ) : (
                    <>
                      {film.final && <a className="run small" href={fileUrl(film, film.final)} download={`${film.title}.mp4`}>Download film</a>}
                      {film.final && <button type="button" className="secondary small" onClick={() => void share(film)}>Share</button>}
                      {film.poster && <a className="secondary small" href={fileUrl(film, film.poster)} download={`${film.title} poster.png`}>Title card</a>}
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {message && <p className={`status${error ? " error" : ""}`} role="status">{message}</p>}

          {films.length > 0 && (
            <section className="gallery" aria-label="Recent films">
              <h2>Recent films</h2>
              <div className="gallery-row">
                {films.map((item) => (
                  <button type="button" key={item.id} className={`gallery-item${film?.id === item.id ? " on" : ""}`} disabled={working} onClick={() => void openFilm(item.id)}>
                    {item.poster || item.cast
                      ? <img src={fileUrl(item, (item.poster ?? item.cast)!)} alt="" />
                      : <span className="gallery-blank" />}
                    <span>{item.title}</span>
                    <small>{item.stage === "done" ? (item.storyboardOnly ? "Storyboard" : "Film") : item.stage === "failed" ? "Failed" : "In production"}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

