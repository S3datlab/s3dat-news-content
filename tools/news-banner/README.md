# S3DAT News banner engine

Every story on news.s3dat.com gets one moving banner. The look and motion are fixed in
`s3dat_banner.py`; each story only supplies words, colours and two AI images. Do not redesign
the banner per story and do not hand-animate it: run the engine.

## Output (checked by the engine)

- `banner.mp4`: 1080×608, 30 fps, 8.0 s, H.264 yuv420p, no audio, seamless loop, at most 1.6 MB.
- `poster.webp`: the frame at 1.45 s (headline fully landed), used before the video plays and
  for visitors with reduced motion or Save-Data.
- `sheet.jpg` (with `--sheet`): 16 frames for review.

```
python3 s3dat_banner.py spec.json --out banner.mp4 --poster poster.webp --sheet sheet.jpg
```

Needs Python 3.10+, numpy, Pillow and ffmpeg with libx264. Fonts (Geist, Geist Mono, SIL OFL 1.1)
are in `fonts/`.

## Timeline

| Time | Beat | What happens |
| --- | --- | --- |
| 0.0–1.5 s | Slam | Background pushes in; the headline slams in large and centred, with a flash on impact. |
| 1.5–2.1 s | Dock | The headline shrinks into a lower-left lockup and stays there. |
| 2.1–4.5 s | Story | The hero object rises on the right; company chips pop in above the headline. |
| 4.5–5.0 s | Burst | A light ring bursts from the hero. |
| 5.0–7.3 s | Payoff | Colour shifts; the stat counts up next to the hero. |
| 7.3–8.0 s | Out | Everything clears so the loop restarts cleanly. |

## spec.json

```json
{
  "title": ["CODEX LIMITS", "DOUBLED"],
  "accent_line": 1,
  "kicker": "NEWS · DEV TOOLS",
  "entities": ["OPENAI"],
  "versus": false,
  "stat": { "value": "2×", "label": "WORK & CODEX QUOTA" },
  "palette": { "deep": "#03201b", "mid": "#17b38a", "light": "#a5f6d9" },
  "assets": { "background": "background.png", "hero": "hero.png" }
}
```

| Field | Rule |
| --- | --- |
| `title` | 1–3 lines, ideally ≤ 14 characters per line (hard limit 16), uppercase. It is the banner headline, not the article headline: short, concrete, names the company or product when that is the news. Must be true to the sources: no "KILLS", "DESTROYS", "SHOCKING", no question-bait. |
| `accent_line` | Index of the line drawn in the topic colour: the twist ("DOUBLED", "GOES OPEN", "LEAVES BETA"). |
| `kicker` | `KIND · TOPIC`, e.g. `ANALYSIS · AGENTS`, `NEWS · MODELS`, `EXPLAINED · RESEARCH`. |
| `entities` | 0–3 company or product names exactly as they write them, uppercase (`OPENAI`, `ANTHROPIC`, `GOOGLE`, `MISTRAL`, `NVIDIA`). Text only, never logos. |
| `versus` | `true` only when the story is a genuine head-to-head between exactly two entities; adds "VS". |
| `stat` | Optional. One number that appears in the sources (`2×`, `$150M`, `1M TOKENS`, `41%`) and a label of up to 28 characters. Numbers count up. Leave it out if there is no clear number. |
| `palette` | The story's topic palette (table below). Do not invent colours. |
| `assets.background` | 16:9 AI image (see below). Required. |
| `assets.hero` | Transparent PNG of one object (see below). Recommended. |

### Topic palettes

| Topic | deep | mid | light |
| --- | --- | --- | --- |
| Models | `#06122e` | `#2f6bff` | `#9fd8ff` |
| Agents | `#140b33` | `#7b5cff` | `#d6c6ff` |
| Dev Tools | `#03201b` | `#17b38a` | `#a5f6d9` |
| Research | `#261204` | `#ff8a2a` | `#ffd6a3` |
| Hardware | `#04181f` | `#1fb6d6` | `#b8f2ff` |
| Policy | `#26080e` | `#ff4d6a` | `#ffbac6` |
| Apps | `#23071f` | `#e04fd0` | `#ffc6f6` |

The engine also duotones the background into the palette, so every banner sits in the same world.

## AI images ($imagegen)

Both images: no text, no letters, no logos or trademarks, no real people or faces of real people,
no screenshots of real products, no watermarks. Depict the idea, not a brand.

**Background (16:9, landscape).** Cinematic, high-end product-film look, dark overall, one clear
light source, rich depth. Keep the left 55% calm and darker (the headline sits there) and put the
visual interest right of centre. Template:

> Cinematic wide 16:9 scene, dark premium studio lighting, [SUBJECT AS METAPHOR], subject placed
> right of centre, calm dark negative space on the left, volumetric light, shallow depth of field,
> high detail, photographic 3D render, no text, no logos, no people.

**Hero object (transparent PNG).** One isolated object that stands for the story, centred, full
object visible, soft studio light, glossy 3D render, transparent background. Examples: a glowing
chip, a key made of light, a robotic hand, a stack of translucent cards, a browser-window-shaped
glass slab, a server tower, a scale of justice made of glass.

> Single [OBJECT], isolated on a transparent background, premium glossy 3D render, soft studio
> lighting, subtle rim light in [TOPIC LIGHT COLOUR], centred, entire object visible, no text,
> no logos.

## Review checklist (before handing over)

1. The engine report says `seconds` 8.0, `width` 1080, `height` 608 and `bytes` ≤ 1,600,000.
2. Look at `sheet.jpg`: the headline is never cut off, spelled right, and readable on the
   background; the hero never covers the headline; company names are spelled exactly right.
3. The headline and the stat are supported by the story's sources.
4. Nothing in the images resembles a real logo, a real person or a real product screenshot.
5. Deliver `banner.mp4`, `poster.webp`, `sheet.jpg`, `spec.json` and both source images.

Not allowed: video-generation models (Kling and similar), stock footage or templates, music.
