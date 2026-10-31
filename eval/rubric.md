# XitBC film review rubric

A reviewer scores one film, or one storyboard, against this rubric. Every review starts fresh: the reviewer does not see earlier scores.

## What the reviewer gets

`node scripts/review-sheets.mjs <film id>` writes these files to `.films/<film id>/review/`:

| File | What it shows |
| --- | --- |
| `cast.jpg` | The casting image: the star every shot refers to |
| `still-1.jpg` … `still-5.jpg` | The five storyboard stills, in story order |
| `title-card.jpg` | The title card |
| `shot-1.jpg` … `shot-5.jpg` | Films only: five frames from each shot of the final cut, left to right in time |
| `film-title.jpg` | Films only: five frames from the title card in the final cut |
| `overview.jpg` | Films only: one frame per second of the whole film, read left to right, top to bottom |
| `facts.json` | The brief: star, city, style, format, shot names, timeline, loudness, warnings |

## The seven parts

Score each part from 0 to 10 in steps of 0.5.

| Part | Weight | What a 9.5 or higher looks like |
| --- | --- | --- |
| Cinematography | 20% | Every frame is composed with intent: clear subject, depth and layering, leading lines, and a lens and shot size that fit the beat. Shot sizes vary across the film. |
| Light and color | 15% | Light is motivated and beautiful. The grade is consistent from shot to shot. The day's arc, from morning to blue hour, reads clearly. |
| Camera and motion | 15% | Films only. Camera moves are smooth and purposeful. The star, people and traffic move naturally, with no warping, melting, flicker or sliding feet. |
| The star | 15% | The same character in every shot: face, hair or fur, colors, outfit and proportions. An expressive, believable performance that sells each beat. |
| Story | 15% | A clear arc: arrival, discovery, delight, wonder, triumph. It feels like a glorious adventure and lands an emotional payoff. The city is unmistakable. |
| Editing and pacing | 10% | Films only. The rhythm builds, cuts land on motion or story beats, and the title card closes the film with weight. |
| Technical finish | 10% | No AI artifacts: no extra or fused limbs, no duplicated star, no garbled text, logos or signs, no impossible physics. The letterbox is clean and the title is spelled right. |

For a storyboard, leave Camera and motion and Editing and pacing out, and scale the other five weights up to 100%.

## Calibration

| Score | Means |
| --- | --- |
| 5 | Typical AI video: generic framing, visible artifacts, a weak or missing story |
| 7 | Good social content: pleasant, mostly clean, but clearly AI and clearly a template |
| 8.5 | Impressive: looks professional, with only small flaws a viewer might notice |
| 9.5 | Indistinguishable from the opening of a high-end feature film or a premium commercial |
| 10 | Flawless |

Do not round up. A single obvious artifact, such as a garbled sign or a sixth finger, caps Technical finish at 7.

## The answer

The reviewer answers with JSON only:

```json
{
  "kind": "storyboard or film",
  "scores": { "cinematography": 0, "light": 0, "motion": null, "star": 0, "story": 0, "editing": null, "technical": 0 },
  "overall": 0,
  "verdict": "Two sentences on what works and what holds the film back.",
  "fixes": [
    { "where": "shot 3, title card, or all", "problem": "What is wrong, as specifically as possible", "fix": "A concrete change to the prompt, framing, light or edit" }
  ]
}
```

`overall` is the weighted mean of the scored parts. `fixes` lists at most six fixes, the most valuable first.
