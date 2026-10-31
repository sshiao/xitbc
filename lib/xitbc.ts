// The story engine of XitBC, "X in the Big City". It turns a star, a city and a style
// into a short film: one casting image, five storyboard stills for FLUX.2, five motion
// prompts for LTX-2.5, the title lines, and a music brief for Sonilo.

export type CityId = "new-york" | "tokyo" | "paris" | "london" | "san-francisco" | "custom";
export type StyleId = "live-action" | "animated";
export type FormatId = "cinema" | "vertical";
export type QualityId = "draft" | "final";
export type BeatId = "arrival" | "streets" | "delight" | "landmark" | "finale";
export type Seconds = 2 | 3 | 4 | 5 | 6 | 8 | 10;

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

// The film runs through one day: morning arrival, a busy midday, an afternoon treat,
// a golden-hour landmark, and a blue-hour finale on a rooftop. Each beat has its own
// shot size, action, eyeline and light, so the shots do not repeat one pose. The camera
// moves stay simple, because LTX-2.5 bends buildings and bystanders on big moves.
// The edit keeps each clip from "from" to "use" seconds. LTX-2.5 starts slowly from the still,
// so a late "from" cuts into the shot when the action is already moving.
export const BEATS: {
  id: BeatId;
  label: string;
  seconds: Seconds;
  from: number;
  use: number;
  shot: string;
  light: string;
  move: string;
  sound: string;
}[] = [
  {
    id: "arrival",
    label: "Arrival",
    seconds: 5,
    from: 0,
    use: 5,
    shot: "Wide shot from a low angle with a 24mm lens. {name} is {setting}, turned three-quarters toward the camera, eyes wide and smiling, looking up at the towers. Nothing covers the face.",
    light: "Early morning: the low sun between the towers lights {name}'s face and the upper floors warm gold, while the street stays in cool blue shade with a thin haze.",
    move: "{name} gazes up at the towers in wonder, then turns slowly to take in the street as a wide smile spreads across the face. The camera pushes in slowly and level, from the wide shot to a medium shot, with no tilt and no roll. Every building keeps exactly its shape and its place.",
    sound: "echoing city ambience, distant traffic and a gust of wind",
  },
  {
    id: "streets",
    label: "The streets",
    seconds: 4,
    from: 0,
    use: 3.4,
    shot: "Medium shot from the knees up, at eye level, with a 35mm lens and shallow depth of field. {name} is on the left third of the frame, {setting}, mid-stride and walking into the open space on the right, eyes up toward the buildings with a curious look.",
    light: "Bright midday sun with short, crisp shadows.",
    move: "The camera tracks sideways beside {name} in real time, not in slow motion, at {name}'s natural walking speed, as {name} walks on across the street and looks up at the buildings with a curious smile. Nobody walks between the camera and {name}.",
    sound: "crowd chatter, footsteps and car horns in the distance",
  },
  {
    id: "delight",
    label: "A taste of the city",
    seconds: 4,
    from: 0,
    use: 3.2,
    shot: "Medium close-up from the chest up, at eye level, with a 50mm lens and soft background bokeh. {name} is {setting}, eyes closed in delight, mid-laugh.",
    light: "Bright open shade on a sunny afternoon: soft daylight on the face, with the sunlit street glowing behind.",
    move: "{name} takes one bite, lowers it, chews and breaks into a delighted grin toward the person serving, who looks back at {name}, smiles and nods. The camera holds steady with a very slow push-in, and the street life carries on, softly out of focus, behind.",
    sound: "the sizzle and clatter of a food stall and nearby laughter",
  },
  {
    id: "landmark",
    label: "The landmark",
    seconds: 5,
    from: 1,
    use: 5,
    shot: "Medium-wide shot from a low angle with a 35mm lens, the landmark rising behind. {name} walks toward the camera, {setting}, mid-stride, glancing back over the shoulder and up at the landmark with a smile of wonder.",
    light: "Golden hour: a low warm sun from the side lights {name}'s face, against an amber sky with no blown-out white and long shadows.",
    move: "{name} walks slowly toward the camera, then slows, looks back over the shoulder and up at the landmark, and smiles in wonder. The camera holds steady and drifts slowly backward. Every cable, arch and edge of the landmark stays straight, smooth and unchanged.",
    sound: "wind and the distant hum of the city",
  },
  {
    id: "finale",
    label: "Rooftop finale",
    seconds: 6,
    from: 0,
    use: 6,
    shot: "Medium-wide shot from behind and to the side with a 35mm lens, the horizon in the upper third. {name} is {setting}, laughing toward the skyline with arms open wide in triumph.",
    light: "Blue hour: a deep blue sky and thousands of city lights glittering below, with warm string lights along the rooftop lighting {name} from the side.",
    move: "{name} laughs with both arms open wide, then slowly lowers them, rests both hands on the ledge and gazes out over the glittering skyline. The camera pushes in slowly at {name}'s eye level, with no crane move, no tilt and no roll, and {tower} stays fixed in its place. Nobody else is on the rooftop.",
    sound: "soft wind high above the city and a distant city hum",
  },
];

type CityPack = { label: string; name: string; tower: string; settings: Record<BeatId, string> };

export const CITIES: Record<Exclude<CityId, "custom">, CityPack> = {
  "new-york": {
    label: "New York",
    name: "New York City",
    tower: "the Empire State Building",
    settings: {
      arrival: "emerging from a subway entrance with green iron railings and green globe lamps, the spire of the Chrysler Building centered behind",
      streets: "crossing the avenue from left to right on a crosswalk whose white stripes run toward the camera, plain yellow taxis waiting at the stop line behind, brownstones and fire escapes beyond",
      delight: "taking the first bite of a warm pretzel at a plain brushed-steel street cart with no signs or lettering, under a blue and yellow umbrella, the vendor smiling across the cart, yellow taxis and brownstones softly out of focus behind",
      landmark: "on the Brooklyn Bridge promenade, beneath its stone tower with twin pointed Gothic arches and a web of diagonal cables",
      finale: "sitting on the parapet of a Midtown rooftop, with the Empire State Building glowing over the shoulder",
    },
  },
  tokyo: {
    label: "Tokyo",
    name: "Tokyo",
    tower: "Tokyo Skytree",
    settings: {
      arrival: "stepping out of the red-brick entrance of Tokyo Station toward the glass towers of Marunouchi",
      streets: "crossing the Shibuya Scramble among hundreds of people, the towers around the crossing washed in colored light",
      delight: "slurping a steaming bowl of ramen at a tiny counter in an alley lit by plain red paper lanterns",
      landmark: "under cherry blossoms beside a canal, with the red-and-white lattice of Tokyo Tower rising behind",
      finale: "sitting on the edge of a rooftop above a sea of neon, with Tokyo Skytree glowing over the shoulder",
    },
  },
  paris: {
    label: "Paris",
    name: "Paris",
    tower: "the Eiffel Tower",
    settings: {
      arrival: "stepping out of the grand arched hall of the Gare du Nord into the morning bustle",
      streets: "strolling up a cobblestone street in Montmartre past flower stalls and café terraces",
      delight: "biting into a flaky croissant at a sidewalk café table",
      landmark: "along the bank of the Seine, with the iron lattice of the Eiffel Tower rising behind",
      finale: "sitting on a zinc rooftop among chimney pots, with the Eiffel Tower sparkling over the shoulder",
    },
  },
  london: {
    label: "London",
    name: "London",
    tower: "Tower Bridge",
    settings: {
      arrival: "stepping off a red double-decker bus onto a busy street lined with white stone buildings",
      streets: "walking through the crowds and street performers under the glass roof of Covent Garden",
      delight: "sipping hot tea from a paper cup at a Borough Market stall",
      landmark: "on Westminster Bridge, with the gilded clock tower of Big Ben rising above",
      finale: "sitting on the edge of a rooftop terrace above the Thames, with Tower Bridge lit up over the shoulder",
    },
  },
  "san-francisco": {
    label: "San Francisco",
    name: "San Francisco",
    tower: "the Bay Bridge",
    settings: {
      arrival: "riding on the running board of a cable car as it crests a steep hill above the bay",
      streets: "walking under strings of red lanterns on a bustling Chinatown street",
      delight: "tearing into a sourdough bread bowl at Fisherman's Wharf as sea lions bark nearby",
      landmark: "at a hilltop viewpoint as fog rolls through the red towers of the Golden Gate Bridge",
      finale: "sitting on a rooftop ledge, with the lights of the Bay Bridge glowing over the shoulder",
    },
  },
};

export const CITY_IDS = [...Object.keys(CITIES), "custom"] as CityId[];

export const STYLES: Record<StyleId, { label: string; hint: string; still: string; motion: string; cast: string; grain: boolean }> = {
  "live-action": {
    label: "Live action",
    hint: "Looks like a real film",
    still: "A photorealistic live-action film still on 35mm film, shot with anamorphic lenses: soft contrast, natural skin tones, warm highlights, neutral shadows and subtle grain. The grade matches every other shot of the film, and only the color temperature follows the time of day.",
    motion: "Photorealistic live-action film footage.",
    cast: "a photorealistic photograph",
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
  videoModel: "LTX-2.5 (Fast)" | "LTX-2.5 (Pro)";
  imageCost: number;
  videoPerSecond: number;
}> = {
  draft: { label: "Draft", hint: "FLUX.2 [pro] + LTX-2.5 Fast, 720p", imageNode: "Flux2ProImageNode", videoModel: "LTX-2.5 (Fast)", imageCost: 0.05, videoPerSecond: 0.1287 },
  final: { label: "Final", hint: "FLUX.2 [max] + LTX-2.5 Pro, 1080p", imageNode: "Flux2MaxImageNode", videoModel: "LTX-2.5 (Pro)", imageCost: 0.12, videoPerSecond: 0.2431 },
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
      delight: `tasting a famous local street food of ${name} at a market stall`,
      landmark: `at the most famous landmark of ${name}`,
      finale: `sitting on a rooftop ledge, with the skyline of ${name} glowing over the shoulder`,
    },
  };
}

export function filmSeconds() {
  return BEATS.reduce((total, beat) => total + beat.use - beat.from, 0);
}

// An estimate in USD from list prices: six FLUX.2 images, the LTX-2.5 clips and the Sonilo score.
export function filmCost(quality: QualityId) {
  const preset = QUALITIES[quality];
  const clipSeconds = BEATS.reduce((total, beat) => total + beat.seconds, 0);
  return 6 * preset.imageCost + clipSeconds * preset.videoPerSecond + filmSeconds() * MUSIC_PER_SECOND;
}

function starLine(request: FilmRequest, source: "photo" | "cast", notes = "") {
  const name = starName(request);
  const description = clean(request.description, MAX_DESCRIPTION);
  if (source === "cast") {
    return [
      `The star is ${name}${description ? `, ${description}` : ""}.`,
      notes ? `${name}'s look never changes: ${notes}` : "",
      `Use the reference images only for ${name}'s identity and outfit: the same face, species, colors, markings, hair or fur, clothing and proportions. Keep the outfit exactly: no added sunglasses, hats, bags or jewelry, and no change of color.`,
      `Do not copy the pose from the references: ${name} is caught candidly in the moment and never looks at the camera. Show ${name} only once in the frame.`,
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

export function shotStillPrompt(request: FilmRequest, beat: BeatId, notes = "") {
  const spec = BEATS.find((item) => item.id === beat)!;
  const values = { name: starName(request), setting: cityPack(request).settings[beat] };
  return [
    STYLES[request.style].still,
    starLine(request, "cast", notes),
    fill(spec.shot, values),
    fill(spec.light, values),
    `Passers-by wear muted gray, navy, black and white, so nobody else wears ${values.name}'s colors.`,
    FORMATS[request.format].composition,
    NO_TEXT,
  ].join(" ");
}

export function shotMotionPrompt(request: FilmRequest, beat: BeatId, notes = "") {
  const spec = BEATS.find((item) => item.id === beat)!;
  const name = starName(request);
  return [
    "Use the provided start image as the first frame.",
    fill(spec.move, { name, tower: cityPack(request).tower }),
    `${name} keeps exactly the same face, colors and outfit in every frame${notes ? `: ${notes}` : "."}`,
    `${name} never looks into the lens.`,
    "The light stays as it is in the first frame.",
    `Sound: ${spec.sound}. No music and no speech.`,
    `${STYLES[request.style].motion} Smooth stabilized camera, natural motion blur, realistic physics. No text, no subtitles, no cuts.`,
  ].join(" ");
}

// Asked of a vision model about the casting image. Its answer goes into every scene prompt,
// so the star's outfit and accessories stay the same from shot to shot.
export function castNotesPrompt(request: FilmRequest) {
  const name = starName(request);
  return `This is the casting image of ${name}, the star of a short film. Describe ${name}'s fixed look so that an image model can draw exactly the same character in every scene: face, hair or fur, skin or coat colors, and every item of clothing and every accessory with its exact color, material and shape. Write one plain paragraph of at most 70 words. Leave out the pose, the facial expression, the background, the light and any opinion.`;
}

export function scorePrompt(request: FilmRequest) {
  return `An uplifting, adventurous cinematic score for a short film about ${starName(request)} exploring ${cityPack(request).name}: it opens with curious wonder, builds through playful energy, and ends in a soaring, triumphant finale.`;
}
