// The story engine of XitBC, "X in the Big City". It turns a star, a city and a style
// into a short film: one casting image, a seven-shot screenplay, seven storyboard stills
// for FLUX.2, seven motion prompts for MiniMax H3, the title lines, and a music brief for Sonilo.

export type CityId = "new-york" | "tokyo" | "paris" | "london" | "san-francisco" | "custom";
export type StyleId = "live-action" | "animated";
export type FormatId = "cinema" | "vertical";
export type QualityId = "draft" | "final";
export type BeatId = "arrival" | "gust" | "chase" | "treat" | "landmark" | "catch" | "finale";
// The five iconic places each city offers the screenwriter.
export type PlaceId = "arrival" | "streets" | "delight" | "landmark" | "finale";

export type FilmRequest = {
  name: string;
  description: string;
  city: CityId;
  customCity: string;
  style: StyleId;
  format: FormatId;
  quality: QualityId;
  hasReference: boolean;
};

export const MAX_NAME = 24;
export const MAX_DESCRIPTION = 140;
export const MAX_CITY = 60;

// The film is a chase through one day. The star arrives in the morning, a gust steals
// the star's prop, and the star chases it through the streets, past a kind stranger and
// across the landmark, catches it on a rooftop at dusk and holds it there at blue hour. A screenwriter
// (Claude on Comfy Router) writes each shot for the star and the city. The text in each
// beat below is the fallback for when that does not work. The actions suit any star,
// whether a person, a pet or a toy, and the camera moves stay simple.
// The edit keeps each clip from "from" to "use" seconds. The video model starts slowly
// from the still, so a late "from" cuts into the shot when the action is already moving.
export const BEATS: {
  id: BeatId;
  label: string;
  seconds: number;
  from: number;
  use: number;
  place: PlaceId | null;
  role: string;
  balloon: string;
  look: string;
  // Added to every motion prompt of the beat, after the screenwriter's move.
  camera: string;
  shot: string;
  light: string;
  frame: string;
  move: string;
  sound: string;
}[] = [
  {
    id: "arrival",
    label: "Arrival",
    seconds: 4,
    from: 0.3,
    use: 3.5,
    place: "arrival",
    role: "{name} arrives in the city, wide-eyed with wonder, holding {prop} by its long white string.",
    balloon: "{name} holds the long white string of {prop}, in the mouth if {name} is an animal.",
    look: "the towers above",
    camera: "The camera holds steady at {name}'s eye level.",
    shot: "Wide shot from a low angle with a 24mm lens, {name} in three-quarter view with the head turned up toward the towers.",
    light: "Early morning: the low sun shines down the avenue onto {name}'s face and body, exposed for {name}, with the upper floors warm gold and a thin haze.",
    frame: "{name} is {setting}, holding {prop} by its string, eyes wide, looking up at the towers.",
    move: "{name} steps forward toward the camera and gazes up at the towers in wonder. The camera holds steady at {name}'s eye level. Every building keeps exactly its shape and its place.",
    sound: "echoing city ambience and distant traffic",
  },
  {
    id: "gust",
    label: "The gust",
    seconds: 4,
    from: 0,
    use: 3.2,
    place: "arrival",
    role: "A hard gust of wind tears the string away from {name}, {prop} flies off, and {name} reacts with shock.",
    balloon: "{name} still holds the string of {prop}, pulled taut by a rising wind. Nobody else is close to {name}.",
    look: "{prop} as it flies off",
    camera: "The camera tilts up to follow {prop} as it rises.",
    shot: "Medium shot at {name}'s eye level with a 35mm lens.",
    light: "Bright morning sun with long, crisp shadows.",
    frame: "{name} is on the sidewalk outside, holding the string of {prop} as the wind rises and leaves start to blow.",
    move: "In the first second a hard gust whips {name} sideways and tears the string away. {prop} rises fast and leaves the top of the frame, and {name} lifts the head after it in shock. The camera tilts up after the balloon. Paper and leaves blow across the sidewalk.",
    sound: "a sudden whoosh of wind and startled passers-by",
  },
  {
    id: "chase",
    label: "The chase",
    seconds: 4,
    from: 0.6,
    use: 2.8,
    place: "streets",
    role: "{name} dashes after {prop} through a busy street, and passers-by stop and stare.",
    balloon: "{prop} is loose and out of reach: it floats high and far ahead of {name}, in the upper right of the frame, and its string trails free, touching nothing and no one.",
    look: "{prop} ahead",
    camera: "The camera moves sideways with {name} at running speed, so the street slides past behind {name}, and {name} closes the distance to {prop}.",
    shot: "Fast tracking shot from the side at {name}'s eye level with a 24mm lens and shallow depth of field, {name} in profile in the left half of the frame, running flat out to the right toward the balloon in the upper right of the frame.",
    light: "Bright midday sun with short shadows.",
    frame: "{name} is {setting}, running flat out in mid-stride with every foot off the ground, eyes on {prop} ahead, while passers-by stop and stare.",
    move: "{name} runs flat out after {prop}, head low and eyes up, in real time and not in slow motion, and passers-by step aside and turn to stare. The camera tracks alongside {name} at full running speed.",
    sound: "car horns, quick footsteps and surprised voices",
  },
  {
    id: "treat",
    label: "A kind stranger",
    seconds: 4,
    from: 0.3,
    use: 2.7,
    place: "delight",
    role: "The chase pauses for a moment of kindness: someone offers {name} a local treat and points up at {prop}, still drifting in the sky.",
    balloon: "{prop} is a small red dot far down the avenue, high in the sky.",
    look: "the treat and the person offering it",
    camera: "The person serving points down the avenue after {prop}, and {name} turns the head to follow the hand. The camera holds steady.",
    shot: "Medium close-up at {name}'s eye level with a 50mm lens and soft background bokeh, {name} at true life size next to the person serving.",
    light: "Bright open shade on a sunny afternoon: soft daylight on the face, with the sunlit street glowing behind.",
    frame: "{name} is {setting}, catching a breath, eyes closed in pure delight.",
    move: "{name} takes the treat in one bite and hurries off to the right after {prop}, out of the frame, as the person serving smiles and points after it. The camera holds steady.",
    sound: "the sizzle and clatter of a food stall",
  },
  {
    id: "landmark",
    label: "The landmark",
    seconds: 4,
    from: 0.5,
    use: 3,
    place: "landmark",
    role: "{prop} drifts past the landmark, and {name} runs across it in pursuit.",
    balloon: "{prop} is loose and far out of reach: it floats high near the top of the landmark, ahead of {name}, its string trailing free.",
    look: "{prop} ahead",
    camera: "{name} keeps the back to the camera and never turns the head or the body toward it. The camera tracks behind {name} at running speed, wide enough to keep the landmark in view.",
    shot: "Medium-wide tracking shot from behind {name}, at the height of {name}'s back, with a 35mm lens: {name} runs away from the camera toward the landmark rising ahead.",
    light: "Golden hour: a low warm sun from the side lights {name}'s face, against an amber sky with no blown-out white and long shadows.",
    frame: "{name} is {setting}, running away from the camera toward the landmark after {prop}, head raised toward it, one eye and the side of the face in view.",
    move: "{name} keeps running toward the landmark after {prop} and does not turn around. The camera tracks behind {name} at the same speed. Every cable, arch and edge of the landmark stays straight and unchanged.",
    sound: "wind and the distant hum of the city",
  },
  {
    id: "catch",
    label: "The catch",
    seconds: 5,
    from: 0.2,
    use: 4.6,
    place: null,
    role: "At dusk, {name} finds {prop} caught on the railing at the edge of a rooftop and grabs its string, in the mouth if {name} is an animal.",
    balloon: "The trailing string of {prop} hangs just out of {name}'s reach above the railing at the edge of the roof.",
    look: "the string of {prop}",
    camera: "{name} lunges and catches the string, and {prop} stops with a jerk just above.",
    shot: "Medium shot from a low angle with a 35mm lens, {name} in three-quarter view, the face turned up into the last light.",
    light: "Dusk: the last orange light on the rooftops and the first windows glowing.",
    frame: "{name} is at the edge of a rooftop at dusk, stretching up toward the string of {prop}, which hangs just out of reach.",
    move: "{name} lunges up and catches the string with a happy cry. Slow push-in on {name}'s face.",
    sound: "a quiet rooftop, distant traffic and a happy cry",
  },
  {
    id: "finale",
    label: "Rooftop finale",
    seconds: 7,
    from: 0,
    use: 6,
    place: "finale",
    role: "On the rooftop at blue hour, {name} holds {prop} by its string, in the mouth if {name} is an animal, and gazes at the skyline in triumph.",
    balloon: "{name} holds the string of {prop}, which floats just above {name}, fully inside the frame.",
    look: "the glittering skyline",
    camera: "The camera holds completely still.",
    shot: "Medium-wide shot from the side with a 35mm lens, the horizon in the upper third, {name} in the left half of the frame and open sky on the right. Nobody else is on the rooftop.",
    light: "Blue hour: a deep blue sky and thousands of city lights glittering below, with warm string lights along the rooftop lighting {name} from the side.",
    frame: "{name} is {setting}, in three-quarter view with a face full of joy, holding the string of {prop}. Nobody else is on the rooftop.",
    move: "{name} lifts the head toward the glittering skyline, still holding the string of {prop}, and shows pure joy. The camera holds completely still, so {prop} stays fully inside the frame, and {tower} stays fixed in its place.",
    sound: "soft wind high above the city and a distant city hum",
  },
];

type CityPack = { label: string; name: string; tower: string; settings: Record<PlaceId, string> };

export const CITIES: Record<Exclude<CityId, "custom">, CityPack> = {
  "new-york": {
    label: "New York",
    name: "New York City",
    tower: "the Empire State Building",
    settings: {
      arrival: "emerging from a subway entrance with green iron railings, green globe lamps and no station sign, the spire of the Chrysler Building centered behind",
      streets: "crossing the avenue from left to right on a crosswalk whose white stripes run toward the camera, plain yellow taxis waiting at the stop line behind, brownstones and fire escapes beyond",
      delight: "taking the first bite of a warm pretzel that the smiling vendor holds out across a plain street cart with bare, polished steel sides and no signs or lettering, under a blue and yellow umbrella, yellow taxis and brownstones softly out of focus behind",
      landmark: "on the Brooklyn Bridge promenade, beneath its stone tower with twin pointed Gothic arches and a web of diagonal cables",
      finale: "perched on the parapet of a Midtown rooftop, with the Empire State Building glowing over the shoulder",
    },
  },
  tokyo: {
    label: "Tokyo",
    name: "Tokyo",
    tower: "Tokyo Skytree",
    settings: {
      arrival: "stepping out of the red-brick entrance of Tokyo Station toward the glass towers of Marunouchi",
      streets: "crossing the Shibuya Scramble among hundreds of people, the towers around the crossing washed in colored light",
      delight: "leaning over a steaming bowl of ramen that the smiling cook sets down at a tiny counter in an alley lit by plain red paper lanterns",
      landmark: "under cherry blossoms beside a canal, with the red-and-white lattice of Tokyo Tower rising behind",
      finale: "perched on the edge of a rooftop above a sea of neon, with Tokyo Skytree glowing over the shoulder",
    },
  },
  paris: {
    label: "Paris",
    name: "Paris",
    tower: "the Eiffel Tower",
    settings: {
      arrival: "stepping out of the grand arched hall of the Gare du Nord into the morning bustle",
      streets: "strolling up a cobblestone street in Montmartre past flower stalls and café terraces",
      delight: "taking a bite of a flaky croissant that a smiling waiter holds out at a sidewalk café table",
      landmark: "along the bank of the Seine, with the iron lattice of the Eiffel Tower rising behind",
      finale: "perched on a zinc rooftop among chimney pots, with the Eiffel Tower sparkling over the shoulder",
    },
  },
  london: {
    label: "London",
    name: "London",
    tower: "Tower Bridge",
    settings: {
      arrival: "stepping off a red double-decker bus onto a busy street lined with white stone buildings",
      streets: "walking through the crowds and street performers under the glass roof of Covent Garden",
      delight: "breathing in the steam of a hot tea that a smiling stallholder sets down at a Borough Market stall",
      landmark: "on Westminster Bridge, with the gilded clock tower of Big Ben rising above",
      finale: "perched on the edge of a rooftop terrace above the Thames, with Tower Bridge lit up over the shoulder",
    },
  },
  "san-francisco": {
    label: "San Francisco",
    name: "San Francisco",
    tower: "the Bay Bridge",
    settings: {
      arrival: "riding on the running board of a cable car as it crests a steep hill above the bay",
      streets: "walking under strings of red lanterns on a bustling Chinatown street",
      delight: "taking a bite of a sourdough bread bowl that a smiling vendor holds out at Fisherman's Wharf as sea lions bark nearby",
      landmark: "at a hilltop viewpoint as fog rolls through the red towers of the Golden Gate Bridge",
      finale: "perched on a rooftop ledge, with the lights of the Bay Bridge glowing over the shoulder",
    },
  },
};

export const CITY_IDS = [...Object.keys(CITIES), "custom"] as CityId[];

export const STYLES: Record<StyleId, { label: string; hint: string; still: string; motion: string; cast: string; grain: boolean }> = {
  "live-action": {
    label: "Live action",
    hint: "Looks like a real film",
    still: "A photorealistic live-action film still on 35mm film, shot with anamorphic lenses: soft contrast, natural skin tones, warm highlights, neutral shadows and subtle grain. Natural textures throughout: real skin, hair, fur and fleece with separate fibers, never a felt, plush or clay look. The grade matches every other shot of the film, and only the color temperature follows the time of day.",
    motion: "Photorealistic live-action film footage.",
    cast: "a photorealistic photograph on a cinema camera, with natural textures: real skin, hair, fur and fleece with separate fibers, never a felt, plush or clay look,",
    grain: true,
  },
  animated: {
    label: "Animated",
    hint: "Like a 3D animated feature",
    still: "A frame from a modern 3D animated feature film: appealing stylized character design, soft global illumination and a detailed, lively city. One rich color palette runs through the whole film, and only the color temperature follows the time of day.",
    motion: "3D animated feature film animation with expressive character acting.",
    cast: "a character render from a modern 3D animated feature film",
    grain: false,
  },
};

export const FORMATS: Record<FormatId, {
  label: string;
  hint: string;
  still: Record<QualityId, [number, number]>;
  video: Record<QualityId, string>;
  composition: string;
  letterbox: boolean;
}> = {
  // Cinema stills are drawn at 2.4:1, then sit between black bars in the 16:9 video.
  cinema: {
    label: "Cinema 2.39:1",
    hint: "Widescreen, with black bars",
    still: { draft: [1536, 640], final: [2048, 864] },
    video: { draft: "1280x720", final: "1920x1080" },
    composition: "An ultra-wide 2.39:1 anamorphic film frame.",
    letterbox: true,
  },
  vertical: {
    label: "Vertical 9:16",
    hint: "For phones and reels",
    still: { draft: [864, 1536], final: [1152, 2048] },
    video: { draft: "720x1280", final: "1080x1920" },
    composition: "A vertical 9:16 frame for a phone screen, with the star in the middle of the frame.",
    letterbox: false,
  },
};

export const QUALITIES: Record<QualityId, {
  label: string;
  hint: string;
  imageNode: "Flux2ProImageNode" | "Flux2MaxImageNode";
  videoModel: "MiniMax H3";
  videoResolution: "768P" | "2K";
  imageCost: number;
  videoPerSecond: number;
}> = {
  draft: { label: "Draft", hint: "FLUX.2 [pro] + MiniMax H3, 768p", imageNode: "Flux2ProImageNode", videoModel: "MiniMax H3", videoResolution: "768P", imageCost: 0.05, videoPerSecond: 0.1287 },
  final: { label: "Final", hint: "FLUX.2 [max] + MiniMax H3, 2K", imageNode: "Flux2MaxImageNode", videoModel: "MiniMax H3", videoResolution: "2K", imageCost: 0.12, videoPerSecond: 0.1859 },
};

export const CAST_SIZE: [number, number] = [768, 1024];
// The title fades in over this many seconds at the end of the finale.
export const TITLE_SECONDS = 3.5;
const MUSIC_PER_SECOND = 0.009;

export const DEFAULT_REQUEST: FilmRequest = {
  name: "",
  description: "",
  city: "new-york",
  customCity: "",
  style: "live-action",
  format: "cinema",
  quality: "draft",
  hasReference: false,
};

export function clean(text: string, max: number) {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export function starName(request: Pick<FilmRequest, "name">) {
  const name = clean(request.name, MAX_NAME);
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "X";
}

export function filmTitle(request: Pick<FilmRequest, "name">) {
  return titleLines(request).join(" ");
}

// The title card sets the title on two lines.
export function titleLines(request: Pick<FilmRequest, "name">): [string, string] {
  return [`${starName(request)} in the`, "Big City"];
}

export function cityPack(request: Pick<FilmRequest, "city" | "customCity">): CityPack {
  if (request.city !== "custom") return CITIES[request.city];
  const name = clean(request.customCity, MAX_CITY) || "the big city";
  return {
    label: name,
    name,
    tower: `the skyline of ${name}`,
    settings: {
      arrival: `stepping out of the main station of ${name} into its busiest square`,
      streets: `walking down the most crowded street in ${name} among locals and market stalls`,
      delight: `tasting a famous local street food of ${name} that a smiling vendor holds out at a market stall`,
      landmark: `at the most famous landmark of ${name}`,
      finale: `perched on a rooftop ledge, with the skyline of ${name} glowing over the shoulder`,
    },
  };
}

export function filmSeconds() {
  return BEATS.reduce((total, beat) => total + beat.use - beat.from, 0);
}

// The casting image and one still for each beat.
export function storyboardCost(quality: QualityId) {
  return (BEATS.length + 1) * QUALITIES[quality].imageCost;
}

// An estimate in USD from list prices: the FLUX.2 storyboard, the MiniMax H3 clips and the Sonilo score.
export function filmCost(quality: QualityId) {
  const clipSeconds = BEATS.reduce((total, beat) => total + beat.seconds, 0);
  return storyboardCost(quality) + clipSeconds * QUALITIES[quality].videoPerSecond + filmSeconds() * MUSIC_PER_SECOND;
}

// Filming one shot again also scores the film again.
export function refilmCost(quality: QualityId, seconds: number) {
  return seconds * QUALITIES[quality].videoPerSecond + filmSeconds() * MUSIC_PER_SECOND;
}

// What the star chases. It is not part of the outfit, so the outfit lock does not draw it
// back on the star in the shots where it is gone.
export const PROP = "a bright red balloon";

// One shot of the screenplay: the first frame as a still photo, what happens during the clip, and its sound.
export type ScriptShot = { beat: BeatId; frame: string; move: string; sound: string };
export type Script = { writer: "claude" | "template"; shots: ScriptShot[] };

// The built-in screenplay: the fallback text of each beat, filled in for this star and city.
export function defaultScript(request: FilmRequest): Script {
  const city = cityPack(request);
  return {
    writer: "template",
    shots: BEATS.map((beat) => {
      const values = { name: starName(request), prop: PROP, tower: city.tower, setting: beat.place ? city.settings[beat.place] : "" };
      return { beat: beat.id, frame: fill(beat.frame, values), move: fill(beat.move, values), sound: beat.sound };
    }),
  };
}

// The screenwriter's brief. Claude writes each shot of the chase for this star and city.
export function scriptPrompt(request: FilmRequest, notes = "") {
  const name = starName(request);
  const description = clean(request.description, MAX_DESCRIPTION);
  const city = cityPack(request);
  const beats = BEATS.map((beat, index) => {
    const values = { name, prop: PROP };
    return `${index + 1}. "${beat.id}": ${fill(beat.role, values)} The balloon: ${sentence(fill(beat.balloon, values))} ${name} looks at ${fill(beat.look, values)}. Light: ${fill(beat.light, values)}`;
  });
  return [
    `You write the screenplay of a ${Math.round(filmSeconds())}-second ${request.style === "animated" ? "3D animated" : "live-action"} short film. The star is ${name}${description ? `, ${description}` : ""}.${notes ? ` ${name}'s look: ${notes}` : ""}`,
    `The film is a playful chase through one day in ${city.name}, in ${BEATS.length} shots of about 3 seconds each, in this order:\n${beats.join("\n")}`,
    `The balloon is the same in every shot: ${PROP} on a long white string, matte and never glowing. Use these places in ${city.name} where they fit:\n${Object.values(city.settings).map((place) => `- ${place}`).join("\n")}`,
    `Rules for every shot: one clear action that takes about 3 seconds. ${name} moves only as ${name}'s own body allows: an animal stays on its legs and never gets hands. In every move, ${name} shows the feeling with one clear physical reaction: for an animal, the ears, head, tail or a sound, and for a person, the face and body. Passers-by react to ${name} with surprise or delight, and they wear muted gray, navy, black and white. There are no signs, screens or written words. Nobody looks into the lens.`,
    `Answer with JSON only, with no other text: {"shots": [{"beat": "arrival", "frame": "...", "move": "...", "sound": "..."}]}, with one shot for each beat, in order.`,
    `"frame": the first frame as a still photo, in at most 45 words: where ${name} is, the pose, where ${name} looks, where the balloon is, and what the people around do. Keep the balloon exactly as the beat says. No camera words.`,
    `"move": what happens during the shot and how the camera moves, in at most 45 words. In the last shot the camera holds still and the balloon stays fully inside the frame. Use only simple camera moves: a still camera, a slow push-in, a tracking shot at ${name}'s speed or a slow tilt. Never a crane, an orbit or a whip pan.`,
    `"sound": the natural sounds of the shot in at most 12 words. ${name} may make ${name}'s own sounds. No music and no speech.`,
  ].join("\n\n");
}

// Reads the screenwriter's answer. A missing, extra or out-of-order shot gives null,
// and the film then uses defaultScript.
export function readScript(text: string): Script | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let answer: { shots?: unknown };
  try {
    answer = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(answer.shots) || answer.shots.length !== BEATS.length) return null;
  const shots: ScriptShot[] = [];
  for (const [index, beat] of BEATS.entries()) {
    const shot = answer.shots[index] as Partial<Record<keyof ScriptShot, unknown>> | null;
    const [frame, move, sound] = [shot?.frame, shot?.move, shot?.sound].map((field) => typeof field === "string" ? clean(field, 400) : "");
    if (shot?.beat !== beat.id || !frame || !move || !sound) return null;
    shots.push({ beat: beat.id, frame, move, sound: clean(sound, 120) });
  }
  return { writer: "claude", shots };
}

// An animal or a toy keeps its own body. Without this, an image model gives a sheep hands to hold its food.
const BODY = (name: string) => `${name} keeps exactly the body and size from the references: an animal or a toy never gets human hands, a human pose or a human grin, and its feet never hold anything.`;

function starLine(request: FilmRequest, source: "photo" | "cast", notes = "") {
  const name = starName(request);
  const description = clean(request.description, MAX_DESCRIPTION);
  if (source === "cast") {
    return [
      `The star is ${name}${description ? `, ${description}` : ""}.`,
      notes ? `${name}'s look never changes: ${notes}` : "",
      `Use the reference images only for ${name}'s identity and outfit: the same face, species, colors, markings, hair or fur, clothing and proportions. Keep the outfit exactly: no added sunglasses, hats, bags or jewelry, and no change of color.`,
      `Do not copy the pose from the references: ${name} is caught candidly in the moment and never looks at the camera. Show ${name} only once in the frame.`,
      BODY(name),
    ].filter(Boolean).join(" ");
  }
  if (request.hasReference) {
    return `The subject is ${name}${description ? `, ${description}` : ""}: the exact character from the reference image. Keep the same face, species, colors, markings, hair or fur, clothing and proportions.`;
  }
  return `The subject is ${name}${description ? `, ${description}` : ""}.`;
}

const NO_TEXT = "The scene has no billboards, signs, screens or written words: shop fronts show only warm light through their windows. No captions, no watermark, no title text.";

export function castPrompt(request: FilmRequest) {
  return [
    `A character reference portrait: ${STYLES[request.style].cast} of a single full-body figure.`,
    starLine(request, "photo"),
    "The whole body is visible, in a relaxed three-quarter pose, on a plain light grey studio backdrop with soft, even light.",
    "No text.",
  ].join(" ");
}

function fill(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function scriptShot(script: Script, beat: BeatId) {
  const shot = script.shots.find((item) => item.beat === beat);
  if (!shot) throw new Error(`The screenplay has no "${beat}" shot.`);
  return shot;
}

export function shotStillPrompt(request: FilmRequest, beat: BeatId, notes = "", script = defaultScript(request)) {
  const spec = BEATS.find((item) => item.id === beat)!;
  const name = starName(request);
  const values = { name, prop: PROP };
  return [
    STYLES[request.style].still,
    starLine(request, "cast", notes),
    fill(spec.shot, { name }),
    scriptShot(script, beat).frame,
    sentence(fill(spec.balloon, values)),
    "The balloon is matte, never glowing, with one long white string, and lit only by the light around it.",
    `${name} looks at ${fill(spec.look, values)}, never into the lens.`,
    fill(spec.light, { name }),
    `Passers-by wear muted gray, navy, black and white, so nobody else wears ${name}'s colors.`,
    FORMATS[request.format].composition,
    NO_TEXT,
  ].join(" ");
}

export function shotMotionPrompt(request: FilmRequest, beat: BeatId, notes = "", script = defaultScript(request)) {
  const spec = BEATS.find((item) => item.id === beat)!;
  const shot = scriptShot(script, beat);
  const name = starName(request);
  const values = { name, prop: PROP };
  return [
    "Use the provided start image as the first frame.",
    shot.move,
    fill(spec.camera, { ...values, tower: cityPack(request).tower }),
    `At the start of the shot: ${fill(spec.balloon, values)}`,
    `${name} keeps exactly the same face, colors and outfit in every frame${notes ? `: ${notes}` : "."}`,
    `For the whole shot, ${name}'s eyes stay on ${fill(spec.look, values)}, never on the lens.`,
    BODY(name),
    "The light and the exposure stay as they are in the first frame.",
    `Sound: ${shot.sound}. No music and no speech.`,
    `${STYLES[request.style].motion} Smooth stabilized camera, natural motion blur, realistic physics. No text, no subtitles, no cuts.`,
  ].join(" ");
}

// Asked of a vision model about the casting image. Its answer goes into every scene prompt,
// so the star's outfit and accessories stay the same from shot to shot.
export function castNotesPrompt(request: FilmRequest) {
  const name = starName(request);
  return `This is the casting image of ${name}, the star of a short film. Describe ${name}'s fixed look so that an image model can draw exactly the same character in every scene: face, hair or fur, skin or coat colors, and every item of clothing and every accessory with its exact color, material and shape. Give ${name}'s size next to an adult person, for example "its back reaches an adult's hip". Write one plain paragraph of at most 80 words. Leave out the pose, the facial expression, the background, the light, whether the image is a photo or a render, and any opinion.`;
}

export function scorePrompt(request: FilmRequest) {
  return `A playful, uplifting cinematic score for a short film about ${starName(request)} chasing a runaway red balloon through ${cityPack(request).name}: it opens with curious wonder, turns into a bouncy, comic chase, and ends in a soaring, triumphant finale.`;
}
