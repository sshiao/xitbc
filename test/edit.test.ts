import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  barsArgs, calmestCorner, CORNERS, ffmpegPath, filterValue, finalMixArgs, frameArgs, grayArgs, GRID, letterboxBand, letterboxFilter,
  roughCutArgs, titleFilters, titleFont, titleLayout, type TitleText,
} from "../lib/edit.ts";

test("the letterbox keeps a 2.39:1 band inside 16:9", () => {
  assert.deepEqual(letterboxBand(1280, 720), { band: 536, top: 92 });
  assert.equal(letterboxFilter(1280, 720), "crop=1280:536:0:92,pad=1280:720:0:92:black");
  assert.equal(letterboxFilter(1920, 1080), "crop=1920:804:0:138,pad=1920:1080:0:138:black");
});

test("a wide still goes to LTX-2.5 between black bars in the same band", () => {
  const args = barsArgs({ source: "s.png", width: 1280, height: 720, out: "f.png" });
  assert.equal(args[args.indexOf("-vf") + 1], "scale=1280:536,setsar=1,pad=1280:720:0:92:black");
});

const clips = [
  { file: "a.mp4", start: 0, seconds: 5, audio: true },
  { file: "b.mp4", start: 1, seconds: 4, audio: false },
];

const text: TitleText = { lines: ["Maya in the", "Big City"], font: "/fonts/Didot.ttc", corner: "top-right" };

test("the rough cut joins every clip and sets the title over the finale", () => {
  const args = roughCutArgs({ clips, title: text, titleSeconds: 3.5, out: "rough.mp4", width: 1280, height: 720, letterbox: true, grain: true });
  const graph = args[args.indexOf("-filter_complex") + 1];
  assert.deepEqual(args.filter((arg, index) => args[index - 1] === "-i"), ["a.mp4", "b.mp4"]);
  assert.match(graph, /\[v0\]\[a0\]\[v1\]\[a1\]concat=n=2:v=1:a=1\[v\]\[a\]/);
  assert.match(graph, /\[1:v\]trim=start=1\.000:duration=4\.000/, "each clip is cut to its part");
  assert.match(graph, /aevalsrc=0:c=stereo:s=48000:d=4\.000/, "a clip with no sound gets silence");
  assert.match(graph, /noise=alls=4/);
  assert.match(graph, /crop=1280:536/);
  assert.doesNotMatch(graph, /xfade|zoompan|\[0:v\][^;]*drawtext/, "no freeze frame, no dissolve, and no title on the first shot");
  assert.match(graph, /\[1:v\][^;]*crop=1280:536:0:92,pad=1280:720:0:92:black,drawtext=fontfile=\/fonts\/Didot\.ttc:text=Maya in the:.*x=w-text_w-77:y=135:alpha=if\(lt\(t\\,0\.5\)/, "the title fades in on a fixed layer inside the band");
  assert.match(graph, /text=Big City:[^;]*y=206:[^;]*fade=t=out:st=3\.200:d=0\.8/, "the title and the finale fade out together");
  assert.equal(args[args.length - 1], "rough.mp4");
});

test("the title keeps clear of the edges and shrinks for long names", () => {
  for (const [width, height] of [[1920, 804], [1080, 1920]]) {
    for (const corner of CORNERS) {
      const box = titleLayout(text.lines, corner, width, height);
      assert.ok(box.left >= width * 0.05 && box.left + box.blockWidth <= width * 0.95, `${corner} stays inside the sides`);
      assert.ok(box.top >= height * 0.05 && box.top + box.block <= height * 0.95, `${corner} stays inside the top and bottom`);
    }
  }
  const long = titleLayout(["Bartholomew Fitzgerald in the", "Big City"], "top-left", 1920, 804);
  assert.ok(long.blockWidth <= 1920 * 0.41);
});

test("the title goes in the calmest, darkest corner", () => {
  const [cols, rows] = GRID;
  const busy = Uint8Array.from({ length: cols * rows }, (_, index) => ((index % cols) + Math.floor(index / cols)) % 2 ? 255 : 0);
  for (let row = 28; row < rows; row += 1) for (let col = 60; col < cols; col += 1) busy[row * cols + col] = 20;
  assert.equal(calmestCorner(busy, text.lines, 1920, 804), "bottom-right");
  const bright = new Uint8Array(cols * rows).fill(200);
  for (let row = 0; row < 27; row += 1) for (let col = 0; col < 48; col += 1) bright[row * cols + col] = 30;
  assert.equal(calmestCorner(bright, text.lines, 1920, 804), "top-left");
  assert.equal(calmestCorner(new Uint8Array(cols * rows), text.lines, 1920, 804), "top-left", "a tie keeps the first corner");
  const passing = new Uint8Array(cols * rows).fill(30);
  for (let row = 0; row < rows; row += 1) for (let col = 10; col < 14; col += 1) passing[row * cols + col] = 250;
  assert.equal(calmestCorner(Uint8Array.from([...passing, ...bright]), text.lines, 1920, 804), "top-right", "a tower that passes under one corner in an early frame rules it out");
});

test("a clip gives two gray frames a second, inside the band", () => {
  const args = grayArgs({ source: "f.mp4", out: "g.raw", clip: { from: 2.5, seconds: 3.5, width: 1920, height: 1080, letterbox: true } });
  assert.deepEqual(args.slice(0, 6), ["-ss", "2.500", "-t", "3.500", "-i", "f.mp4"]);
  assert.match(args[args.indexOf("-vf") + 1], /^fps=2,.*crop=1920:804:0:138,scale=96:54,format=gray$/);
});

test("the title card starts on the finale's last frame, inside the band", () => {
  assert.deepEqual(frameArgs({ source: "s.mp4", at: 5.96, width: 1920, height: 1080, letterbox: true, out: "p.png" }), [
    "-ss", "5.960", "-i", "s.mp4",
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,crop=1920:804:0:138",
    "-frames:v", "1", "-update", "1", "p.png",
  ]);
});

test("filter values escape the characters ffmpeg reads as syntax", () => {
  assert.equal(filterValue("Big City"), "Big City");
  assert.equal(filterValue("C:/Fonts/a.ttf"), "C\\\\:/Fonts/a.ttf");
  assert.equal(filterValue("a,b;[c]"), "a\\,b\\;\\[c\\]");
});

test("ffmpeg draws a title with any name", { skip: !titleFont() && "no title font on this machine" }, () => {
  const tricky: TitleText = { lines: ["O'Neil: 50% [x], y; z\\ in the", "Big City"], font: titleFont()!, corner: "bottom-left" };
  const result = spawnSync(ffmpegPath(), [
    "-hide_banner", "-f", "lavfi", "-i", "color=c=navy:s=640x268", "-vf", titleFilters(tricky, 640, 268, 0, [0.1, 0.2]), "-frames:v", "1", "-f", "null", "-",
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr.split("\n").slice(-4).join("\n"));
});

test("the rough cut works without a title card, grain or bars", () => {
  const args = roughCutArgs({ clips, title: null, titleSeconds: 4, out: "r.mp4", width: 720, height: 1280, letterbox: false, grain: false });
  const graph = args[args.indexOf("-filter_complex") + 1];
  assert.match(graph, /concat=n=2:v=1:a=1/);
  assert.doesNotMatch(graph, /noise=|pad=|zoompan/);
});

test("the final mix lays the score over the clips' sound", () => {
  const withScore = finalMixArgs({ rough: "r.mp4", music: "m.flac", seconds: 27.5, out: "f.mp4" });
  assert.match(withScore.join(" "), /amix=inputs=2/);
  assert.match(withScore.join(" "), /afade=t=out:st=25\.000:d=2\.5/);
  const without = finalMixArgs({ rough: "r.mp4", music: null, seconds: 27.5, out: "f.mp4" });
  assert.doesNotMatch(without.join(" "), /amix/);
  assert.match(without.join(" "), /loudnorm/);
});
