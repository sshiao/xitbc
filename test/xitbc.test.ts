import assert from "node:assert/strict";
import test from "node:test";
import {
  BEATS, CITIES, DEFAULT_REQUEST, FORMATS, QUALITIES, STYLES,
  castPrompt, cityPack, filmCost, filmSeconds, filmTitle, shotMotionPrompt, shotStillPrompt, starName, titleLines,
  type FilmRequest,
} from "../lib/xitbc.ts";

const maya: FilmRequest = { ...DEFAULT_REQUEST, name: "maya", description: "a girl in a yellow raincoat", hasReference: true };

test("the title capitalizes the star's name", () => {
  assert.equal(filmTitle(maya), "Maya in the Big City");
  assert.equal(starName({ name: "  " }), "X");
});

test("the film has five beats that LTX-2.5 can render", () => {
  assert.equal(BEATS.length, 5);
  for (const beat of BEATS) assert.ok([2, 3, 4, 5, 6, 8, 10].includes(beat.seconds));
  assert.equal(filmSeconds(), 5 + 3.4 + 3.2 + 4 + 6);
  for (const beat of BEATS) assert.ok(beat.from < beat.use && beat.use <= beat.seconds, `${beat.id} is cut inside its clip`);
});

test("every city has a setting for every beat", () => {
  for (const city of Object.values(CITIES)) {
    for (const beat of BEATS) assert.ok(city.settings[beat.id].length > 10, `${city.label} ${beat.id}`);
  }
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
  assert.match(shotStillPrompt(maya, "streets", notes), /Maya's look never changes: lemon-yellow raincoat/);
  assert.match(shotStillPrompt(maya, "streets", notes), /no added sunglasses/);
  assert.match(shotMotionPrompt(maya, "streets", notes), /in every frame: lemon-yellow raincoat/);
  assert.doesNotMatch(shotStillPrompt(maya, "streets"), /look never changes/);
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
  assert.ok(filmCost("draft") > 3 && filmCost("draft") < 5);
  assert.ok(Object.keys(STYLES).length === 2 && Object.keys(QUALITIES).length === 2);
});
