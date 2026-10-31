# XitBC: X in the Big City

Put anyone in the big city. Add a photo of a friend, a pet or a toy, pick a city, and XitBC makes a short film of their day out: an arrival, the busy streets, a taste of the city, a landmark at golden hour and a rooftop finale, with a soundtrack and a title card.

XitBC is open source and runs on the Comfy Developer Platform. It was built for Comfy's [Open Source Higgsfield](https://comfy.org/events/) challenge. It is not affiliated with Higgsfield.

## What you get

- **A 22-second film** in five scenes, joined with one color grade, cut to a soundtrack, with the title over the last shot: "Maya in the Big City".
- **Any star.** Upload a photo, or just describe them: "a fluffy white sheep", "a girl in a yellow raincoat".
- **Five cities**, or any city you type: New York, Tokyo, Paris, London and San Francisco.
- **Two styles**: live action, or a 3D animated feature.
- **Two formats**: cinema 2.39:1 with black bars, or vertical 9:16 for phones.
- **Storyboard first.** See the casting image and all five scenes for about $0.30, then film the storyboard you like.

## How it works

```
photo or description
     │
     ▼
1. Casting      FLUX.2 draws one clean, full-body image of the star          workflows/image.api.json
     │
     ▼
2. Storyboard   FLUX.2 draws five scenes, each from the casting image         workflows/image.api.json
                (and the photo), so the star stays the same
     │
     ▼
3. Filming      LTX-2.5 animates each scene with a camera move and sound     workflows/clip.api.json
     │
     ▼
4. Score        ffmpeg grades and joins the clips and sets the title over    workflows/score.api.json
                the end of the finale; Sonilo writes music that fits the cut
     │
     ▼
5. Final cut    ffmpeg mixes the score over the clips' own sound             final.mp4
```

The story lives in `lib/xitbc.ts`. The film runs through one day: morning arrival, busy midday streets, an afternoon treat, a golden-hour landmark and a blue-hour rooftop. Each scene has its own lens, light, camera move and sound.

Every model runs as a Comfy workflow on Comfy Cloud, submitted from the server with `@comfyorg/sdk`:

| Step | Comfy node | Model |
| --- | --- | --- |
| Casting, storyboard | `Flux2ProImageNode`, `Flux2MaxImageNode` | FLUX.2 [pro], FLUX.2 [max] |
| Filming | `LtxApi25ImageToVideo` | LTX-2.5 Fast, LTX-2.5 Pro |
| Score | `SoniloVideoToMusic` | Sonilo video to music |

The server keeps each film in `.films/<id>/`: its state in `film.json`, and every image, clip and cut next to it. The page polls that state, so you watch the storyboard fill in and each shot get filmed.

## Run it

You need:

- [Node.js 22.6 or newer](https://nodejs.org/).
- A Comfy API key from [platform.comfy.org](https://platform.comfy.org/profile/api-keys).
- A [paid Comfy Cloud plan](https://www.comfy.org/cloud/pricing) on the workspace that owns the key. The Free tier has no API access.
- Credits for the partner nodes.

You do not need a GPU or ffmpeg: the `ffmpeg-static` package brings its own. The title card uses a serif font from your system: Didot on macOS, DejaVu Serif or Liberation Serif on Linux, or Georgia on Windows. To use another font, set `XITBC_TITLE_FONT` in `.env.local` to a `.ttf` or `.otf` file.

1. Get the code and make local settings:

   ```sh
   git clone https://github.com/sshiao/xitbc.git
   cd xitbc
   cp .env.example .env.local
   ```

2. Put your key in `.env.local` as `COMFY_API_KEY`. The server reads it. Never put it in a `NEXT_PUBLIC_` variable, and never commit `.env.local`.
3. Install and start the app:

   ```sh
   npm ci
   npm run dev
   ```

4. Open <http://localhost:3000>, add your star, pick a city, and select **Roll camera**. Or select **Storyboard first** to see the scenes before you pay for video.

A film takes about 5 to 8 minutes. To try the whole pipeline with no key and no credits, set `XITBC_MOCK=1` in `.env.local`. Mock mode makes every image and clip from your photo with ffmpeg, and then edits them for real.

XitBC needs a long-running Node server, because the server produces each film in the background. Run it locally or on a Node host. Serverless hosts stop the work when the request ends.

## Cost

These are list prices. Check your Comfy account for the exact charges.

| | Draft | Final |
| --- | --- | --- |
| Images | FLUX.2 [pro] | FLUX.2 [max] |
| Video | LTX-2.5 Fast, 720p | LTX-2.5 Pro, 1080p |
| Storyboard only | about $0.30 | about $0.72 |
| Whole film | about $3.65 | about $6.80 |

## How we judge "cinematic"

`eval/rubric.md` is the rubric we use to review films. It has seven parts: cinematography, light and color, camera and motion, the star, story, editing and pacing, and technical finish. Each part has a weight and a calibration scale. `node scripts/review-sheets.mjs <film id>` writes contact sheets of a film for a reviewer: a frame strip per shot, one frame per second, the stills and the title card.

## Change it

- **Cities, beats, styles and every prompt** are in `lib/xitbc.ts`. Add a city to `CITIES` and the page shows it.
- **The workflows** are in `workflows/`. Open one in ComfyUI, edit it, and export it with **Export (API)**. `lib/requests.ts` fills each workflow's nodes by id. Update it if you rename a node.
- **The edit** (grade, letterbox, title card, mix) is in `lib/edit.ts`.
- **The page** is `components/studio.tsx`, styled in `app/globals.css`.

## Project layout

| Path | What it holds |
| --- | --- |
| `app/api/films` | Starts a film, lists films, reads one film, films a storyboard, serves a film's files |
| `lib/xitbc.ts` | The story engine: beats, cities, styles and prompts |
| `lib/film.ts` | The producer that runs each film in the background |
| `lib/comfy.ts` | The Comfy SDK calls |
| `lib/edit.ts` | The ffmpeg edit |
| `lib/mock.ts` | Mock mode |
| `workflows/` | The three Comfy workflows in API format |
| `eval/rubric.md` | The review rubric |
| `scripts/review-sheets.mjs` | Contact sheets for a review |
| `test/` | Unit tests for the prompts, form checks, workflow graphs and edit |

Run the tests and the type check with `npm test`.

## Limits

- Photos up to 20 MB, PNG, JPEG or WebP. The page scales them to 1600 px before upload.
- The star can drift between scenes. A clear, well-lit photo of one subject keeps it closest.
- AI video can bend hands, crowds and signs. Watch the film before you post it.
- Comfy Cloud may run your jobs one at a time, so the storyboard fills in one scene at a time.

## License

MIT. See [`LICENSE`](LICENSE). Parts of the API routes come from Comfy Org's MIT-licensed [comfy-openjutsu](https://github.com/Comfy-Org/comfy-openjutsu) template. See [`THIRD_PARTY_NOTICES`](THIRD_PARTY_NOTICES). FLUX.2, LTX-2.5 and Sonilo have their own terms of use.
