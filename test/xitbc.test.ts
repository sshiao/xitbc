import assert from "node:assert/strict";
import test from "node:test";
import {
  BEATS, CITIES, DEFAULT_REQUEST, FORMATS, QUALITIES, STYLES,
  PROP, castPrompt, cityPack, defaultScript, filmCost, filmSeconds, filmTitle, readScript, scriptPrompt, shotMotionPrompt, shotStillPrompt,
  starName, storyboardCost, titleLines,
  type FilmRequest, type PlaceId,
} from "../lib/xitbc.ts";

const maya: FilmRequest = { ...DEFAULT_REQUEST, name: "maya", description: "a girl in a yellow raincoat", hasReference: true };

test("the title capitalizes the star's name", () => {
  assert.equal(filmTitle(maya), "Maya in the Big City");
  assert.equal(starName({ name: "  " }), "X");
});

test("the chase has seven beats that MiniMax H3 can render, ending on the rooftop", () => {
  assert.deepEqual(BEATS.map((beat) => beat.id), ["arrival", "gust", "chase", "treat", "landmark", "spotted", "finale"]);
  for (const beat of BEATS) {
    assert.ok(Number.isInteger(beat.seconds) && beat.seconds >= 4 && beat.seconds <= 15, `${beat.id} is 4 to 15 seconds`);
    assert.ok(beat.from >= 0 && beat.from < beat.use && beat.use <= beat.seconds, `${beat.id} is cut inside its clip`);
  }
  assert.ok(Math.abs(filmSeconds() - 24.8) < 0.001);
});

test("every city has the five places the beats use", () => {
  const places: PlaceId[] = ["arrival", "streets", "delight", "landmark", "finale"];
  for (const city of Object.values(CITIES)) for (const place of places) assert.ok(city.settings[place].length > 10, `${city.label} ${place}`);
  for (const beat of BEATS) assert.ok(beat.place === null || places.includes(beat.place));
});

test("a custom city fills the generic beats", () => {
  const pack = cityPack({ city: "custom", customCity: " Rome " });
  assert.equal(pack.name, "Rome");
  assert.match(pack.settings.finale, /Rome/);
});

test("the cast prompt uses the photo when there is one", () => {
  assert.match(castPrompt(maya), /exact character from the reference image/);
  assert.doesNotMatch(castPrompt({ ...maya, hasReference: false }), /reference image/);
  assert.match(castPrompt({ ...maya, style: "animated" }), /3D animated feature film/);
});

test("each still prompt names the star, the setting, the light and the frame", () => {
  const prompt = shotStillPrompt(maya, "arrival");
  assert.match(prompt, /The star is Maya, a girl in a yellow raincoat/);
  assert.match(prompt, /subway entrance/);
  assert.match(prompt, /with a bright red balloon on a string/);
  assert.match(prompt, /Early morning/);
  assert.match(prompt, /ultra-wide 2\.39:1/);
  assert.match(prompt, /no billboards, signs, screens or written words/);
  assert.match(prompt, /only for Maya's identity and outfit/);
  assert.match(prompt, /never looks at the camera/);
  assert.doesNotMatch(prompt, /\{|\}/);
  assert.doesNotMatch(prompt, /in the Big City/, "a title in the prompt would show up as text in the image");
});

test("casting notes lock the look into every prompt", () => {
  const notes = "lemon-yellow raincoat, grey nylon daypack";
  assert.match(shotStillPrompt(maya, "chase", notes), /Maya's look never changes: lemon-yellow raincoat/);
  assert.match(shotStillPrompt(maya, "chase", notes), /no added sunglasses/);
  assert.match(shotMotionPrompt(maya, "chase", notes), /in every frame: lemon-yellow raincoat/);
  assert.doesNotMatch(shotStillPrompt(maya, "chase"), /look never changes/);
});

test("each motion prompt anchors the first frame and asks for sound without music", () => {
  for (const beat of BEATS) {
    const prompt = shotMotionPrompt(maya, beat.id);
    assert.match(prompt, /^Use the provided start image as the first frame\./);
    assert.match(prompt, /No music and no speech/);
    assert.match(prompt, /Maya never looks into the lens/);
    assert.doesNotMatch(prompt, /\{|\}/);
  }
});

test("the title card sets the title on two lines", () => {
  assert.deepEqual(titleLines(maya), ["Maya in the", "Big City"]);
  assert.deepEqual(titleLines({ name: "" }), ["X in the", "Big City"]);
});

test("the beats suit a star of any body", () => {
  for (const beat of BEATS) assert.doesNotMatch(`${beat.role} ${beat.shot} ${beat.frame} ${beat.move}`, /\b(arms?|hands?|knees|chest|laugh\w*|grin)\b/i, beat.id);
  for (const city of Object.values(CITIES)) assert.doesNotMatch(city.settings.finale, /sitting/);
});

test("an animal star keeps its own body in every still and clip", () => {
  const woolly: FilmRequest = { ...maya, name: "woolly", description: "a fluffy white sheep" };
  for (const beat of BEATS) {
    assert.match(shotStillPrompt(woolly, beat.id), /Woolly keeps exactly the body from the references: an animal or a toy never gets human hands/);
    assert.match(shotMotionPrompt(woolly, beat.id), /never gets human hands or a human pose/);
  }
});

test("the camera moves stay simple", () => {
  for (const beat of BEATS) assert.doesNotMatch(beat.move.replace("no crane move", ""), /crane|dollies out|orbit|whip/i);
  assert.match(BEATS.find((beat) => beat.id === "finale")!.move, /no crane move/);
});

test("every beat gives the star a different shot size", () => {
  const sizes = BEATS.map((beat) => beat.shot.split(" ")[0] + beat.shot.split(" ")[1]);
  assert.ok(new Set(sizes).size >= 4);
  assert.match(shotStillPrompt(maya, "finale"), /Empire State Building/);
  assert.match(shotStillPrompt(maya, "landmark"), /Gothic arches/);
});

test("image sizes are 32-pixel steps that the FLUX.2 node accepts", () => {
  for (const format of Object.values(FORMATS)) {
    for (const [width, height] of Object.values(format.still)) {
      assert.equal(width % 32, 0);
      assert.equal(height % 32, 0);
      assert.ok(width <= 2048 && height <= 2048);
    }
  }
});

test("the cost estimate grows with quality", () => {
  assert.ok(filmCost("final") > filmCost("draft"));
  assert.ok(filmCost("draft") > 4 && filmCost("draft") < 5);
  assert.equal(storyboardCost("draft"), 8 * QUALITIES.draft.imageCost, "the casting image and one still per beat");
  assert.ok(Object.keys(STYLES).length === 2 && Object.keys(QUALITIES).length === 2);
});

test("the built-in screenplay has one shot per beat, in order, with the balloon", () => {
  const script = defaultScript(maya);
  assert.equal(script.writer, "template");
  assert.deepEqual(script.shots.map((shot) => shot.beat), BEATS.map((beat) => beat.id));
  for (const shot of script.shots) assert.doesNotMatch(`${shot.frame} ${shot.move} ${shot.sound}`, /\{|\}/);
  assert.match(script.shots[1].frame, /gust tears a bright red balloon loose/);
  assert.match(script.shots[6].move, /the Empire State Building stays fixed/);
});

test("the screenwriter's brief lists every beat, the places and the answer format", () => {
  const brief = scriptPrompt({ ...maya, name: "woolly", description: "a fluffy white sheep" }, "a red knitted scarf");
  let last = -1;
  for (const beat of BEATS) {
    const at = brief.indexOf(`"${beat.id}":`);
    assert.ok(at > last, `${beat.id} comes in order`);
    last = at;
  }
  assert.match(brief, /The star is Woolly, a fluffy white sheep\. Woolly's look: a red knitted scarf/);
  assert.match(brief, new RegExp(PROP));
  assert.match(brief, /subway entrance/);
  assert.match(brief, /an animal stays on its legs and never gets hands/);
  assert.match(brief, /Answer with JSON only/);
  assert.doesNotMatch(brief, /\{(name|prop|setting|tower)\}/);
});

const answer = (shots: unknown[]) => `Here is the screenplay:\n\`\`\`json\n${JSON.stringify({ shots })}\n\`\`\``;
const written = BEATS.map((beat) => ({ beat: beat.id, frame: `  Woolly in the ${beat.id}   shot. `, move: "Woolly trots on.", sound: "a bleat" }));

test("readScript takes a full answer, even inside a code fence", () => {
  const script = readScript(answer(written));
  assert.ok(script);
  assert.equal(script.writer, "claude");
  assert.equal(script.shots[2].frame, "Woolly in the chase shot.");
  assert.equal(script.shots[6].sound, "a bleat");
});

test("readScript refuses a short, unordered or broken answer", () => {
  assert.equal(readScript(answer(written.slice(1))), null);
  assert.equal(readScript(answer([written[1], written[0], ...written.slice(2)])), null);
  assert.equal(readScript(answer(written.map((shot, index) => index === 3 ? { ...shot, move: " " } : shot))), null);
  assert.equal(readScript("no screenplay today"), null);
  assert.equal(readScript("{ not json }"), null);
});

test("a written screenplay flows into the still and motion prompts", () => {
  const script = readScript(answer(written))!;
  assert.match(shotStillPrompt(maya, "chase", "", script), /Woolly in the chase shot\./);
  assert.match(shotMotionPrompt(maya, "spotted", "", script), /Woolly trots on\. .*Sound: a bleat\. No music and no speech\./);
});
