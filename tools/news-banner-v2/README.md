# S3DAT News banner engine v2

Every story gets one 8-second banner: 1080×608, 30 fps, H.264, no audio, at most 1.6 MB, plus a
WebP poster. The banner is built from HTML templates and rendered frame by frame in Chrome. No
video models, no stock media.

**The big headline is the only text in a banner.** No `S3DAT NEWS`, no topic or kind labels
(`ANALYSIS · DEV TOOLS`), no company name chips, no dates. The logo, the colours and the
illustration have to tell the reader who the story is about before they read a word.

You do not render or commit video. Commit `story.json`, `spec.json` and the asset files; GitHub
Actions renders the banner, checks it and publishes the story. Engine v1 (`tools/news-banner`) is
retired: stories published from 31 October 2026 12:00 UTC on must use engine 2.

## Story folder

```
stories/YYYY/MM/DD/<slug>/
  story.json        the story (see stories/README.md), with "titleInVideo": true
  spec.json         the banner spec (below)
  hero.webp         the illustrated hero cut-out (transparent background)
  prop-1.webp ...   up to three prop cut-outs (transparent background)
  art.jpg           a generated scene, only for the cinematic template
  <brand>.svg       a logo file, only when simple-icons has no icon for the brand
```

Never commit `banner.mp4`, `poster.webp` or review sheets. Keep all assets of one story under
1.6 MB together (aim for 600 KB): they stay in the repository for good.

## spec.json

```json
{
  "engine": 2,
  "template": "cutout",
  "headline": ["TESLA SHARES", "SLIDE 12%", "AFTER DELIVERY MISS"],
  "accent": 1,
  "brands": [{ "name": "Tesla", "icon": "tesla" }],
  "cutouts": [
    { "src": "hero.webp", "role": "hero" },
    { "src": "prop-1.webp", "role": "prop" },
    { "src": "prop-2.webp", "role": "prop" }
  ],
  "mood": "down",
  "stat": { "value": "-12%", "label": "in one session" },
  "seed": 3,
  "sources": {
    "hero.webp": "generated",
    "prop-1.webp": "generated",
    "prop-2.webp": "generated"
  }
}
```

| Field | Rule |
| --- | --- |
| `engine` | Always `2`. |
| `template` | One of the ten templates below. |
| `headline` | 1–3 uppercase lines, at most 22 characters each (aim for 16). The short form of the story title. Shorter lines are drawn bigger. |
| `accent` | Index of the line that carries the news (the number, the verb, the verdict). It gets the colour or highlight. |
| `brands` | 1–2 companies. Each has `name` and either `icon` (a [simple-icons](https://simpleicons.org) slug) or `logo` (a file in the folder). Optional `color` (`#rrggbb`) overrides the brand colour. |
| `cutouts` | 0–4 transparent images: at most one `hero`, the rest `prop`. |
| `mood` | How the hero acts: `up` (bounce: launches, records, wins), `down` (slump: losses, cuts, outages), `shock` (shake: surprises, rulings, leaks), `calm` (float: everything else). |
| `stat` | Optional key number from a source: `value` at most 10 characters with a digit (`$4.2B`, `38%`, `1T`), `label` at most 28. |
| `art` | Optional generated scene for `cinematic`. |
| `bg` | Optional field colour for `cutout`: `white`, `black`, `brand` or `pop`. Leave it out to let the seed choose. |
| `seed` | Any integer. Changes small choices (colours, entry paths). Use a different one per story. |
| `sources` | Every asset file mapped to `"generated"` (made with image generation) or the https URL it was downloaded from. |

## Templates

| Template | Look | Needs | Use for |
| --- | --- | --- | --- |
| `cutout` | Flat colour field, the hero and props as die-cut stickers acting out the mood, logo sticker. Hard colour cut halfway. | hero cut-out | Default for people-led and company stories. |
| `portrait` | The hero in a tall tinted panel next to a large headline; sides swap halfway. | hero cut-out | Executives, interviews, moves, statements. |
| `collage` | Sticker pile of cut-outs, logo tile and stat tile on paper; headline with a serif accent. | cut-outs or art | Roundups, several actors, deals. |
| `versus` | Diagonal split in both brand colours; logos collide; VS sticker; headline band. | two brands | Lawsuits, rivalries, head-to-head launches. Only when there really are two sides. |
| `data` | White graph paper; the number counts up; a chart line rises or falls with the mood. | stat | Funding, revenue, benchmarks, prices, share moves. |
| `poster` | Each headline word slams in full-frame on alternating colours, then a stacked poster with a scrolling band. | — | Big, simple headlines; policy; verdicts. |
| `paper` | Off-white editorial page; the logo inside a drawn ring; a brand-colour panel wipes in. | — | Product and model releases. |
| `brand` | The brand colour fills the frame; a giant logo turns behind a wide headline; black wipe. | — | Company announcements. |
| `ink` | Pure black; letters flicker on; the logo glows; a glitch cut to a centred layout. | — | Security, outages, infrastructure, research. |
| `cinematic` | A generated scene, full bleed, with a slow push and a second shot; label-strip headline. | art | Explainers and analysis with a strong scene. |

Rotation: never use the template of the previous story, and at most two of any template among the
last ten. Look at the last three published stories before choosing. Prefer templates with a hero
cut-out: they make the subject recognisable at a glance.

## Logos

1. Use `icon` when [simple-icons](https://simpleicons.org) has the brand (it gives the official
   colour too). Examples: `google`, `googlegemini`, `meta`, `nvidia`, `apple`, `tesla`, `x`,
   `anthropic`, `claude`, `mistralai`, `deepseek`, `perplexity`, `huggingface`, `github`,
   `samsung`, `intel`, `amd`, `newyorktimes`. The engine also carries `openai`, `microsoft`,
   `amazon`, `aws`, `ibm` and `oracle` in `logos/` (sources in `logos/manifest.json`).
2. Otherwise download the official SVG from the company's press or brand page, or from Wikimedia
   Commons, save it as `<brand>.svg` and put the page URL in `sources`. Prefer the symbol mark
   over a long wordmark.
3. **Never draw, generate or alter a logo with an image model.** Generated logos are wrong in
   small ways that readers notice. Keep logos out of generated images entirely; the engine places
   the real one.

## Cut-outs with ChatGPT image generation

One hero and up to three props per story, all in the same style.

- **Hero:** the person or thing the story is about. Well-known public figures may appear only as
  a clearly illustrated caricature, never photorealistic and never as a fake photograph. Their
  expression must match what was reported (shares fell: glum; record launch: beaming). No
  humiliation beyond the news, no violence or sexual content, no crimes or acts that are not in
  the story, no private people, no children. If the image model declines, use an object hero
  (the product, the building, a falling arrow).
- **Props:** concrete objects from the story: a car, a GPU, a gavel, a contract, coins, a chart
  arrow, a phone.
- **Style:** bold flat editorial illustration, thick dark outlines, four or five flat colours,
  clean shapes. Avoid glossy 3D renders, neon glow, circuit boards, holograms and glowing
  brains: that is the "AI art" look we do not use.
- **No text** of any kind inside generated images: no letters, numbers or logos.
- **Transparent background.** Ask for it in the prompt. If the result still has a background,
  remove it before committing; the validator rejects images without transparency.
- **Size:** longest side at most 1200 px, PNG or WebP with alpha, at most 900 KB each. Convert
  large PNGs to WebP (`quality 85`).

Prompt pattern (one image per prompt):

```
<subject> <pose and expression>, bold flat editorial illustration, thick dark outline,
flat colours <three or four colours>, simple clean shapes, full figure with margin around it,
isolated on a transparent background, no text, no letters, no numbers, no logos
```

Example for a Tesla share drop: hero "Elon Musk caricature sitting on the floor, head in his
hands, sad", props "a red sports car with a dent", "a red downward arrow", "a cracked gold coin".

## Art (cinematic only)

A generated scene that shows the story, 1280×720 or larger, JPEG at most 500 KB, no text and no
logos. A specific place or object in clear light, not an abstract tech wallpaper.

## Preview locally

```
cd tools/news-banner-v2 && npm ci
# contact sheet of chosen moments, no video:
CHROME_CHANNEL=chrome node render.mjs ../../stories/YYYY/MM/DD/<slug> --frames 0.6,1.5,3,4.8,6,7.5 --sheet /tmp/sheet.jpg
# full render:
CHROME_CHANNEL=chrome node render.mjs ../../stories/YYYY/MM/DD/<slug> --out /tmp/banner.mp4 --poster /tmp/poster.webp
python3 ../../scripts/validate.py --spec-only ../../stories/YYYY/MM/DD/<slug>
```

Without Chrome installed, run `npx playwright-core install chromium` once and leave out
`CHROME_CHANNEL`. `--template <name>` previews another template without editing the spec.

## What GitHub Actions does

On every push to `main` that touches `stories/`, the publish workflow validates the spec,
renders the banner with this engine, validates the video and poster, publishes the story and
keeps the rendered files as the run artifact `banners-<run id>` for 14 days. The published video
is also at the `banner` URL on the story page.
