# S3DAT News on social media

Every story leaves the site as a video post on the channels connected to Buffer, in two groups.
You write the copy in `story.json` (`social`, below); nobody posts by hand.

- **Now:** the moment a story is published, `publish.yml` renders its 16:9 cut and shares it on
  X, Threads, Bluesky and Mastodon.
- **Planned:** every night at 03:00 Istanbul time the render PC picks the five strongest stories
  of the day, renders their 9:16 cut with the voice-over and schedules them in Buffer for the
  coming day, four hours apart, on Facebook, Instagram, LinkedIn, Pinterest and Substack.

## The videos

Two cuts of a story, rendered with `tools/news-banner-v2`:

| Cut | Size | Length | Sound | Rendered by | Goes to |
| --- | --- | --- | --- | --- | --- |
| Wide | 1920×1080 (16:9) | 8 s loop | the banner's soundtrack | GitHub, when the story is published | X, Threads, Bluesky, Mastodon; Substack |
| Tall | 1080×1920 (9:16) | 15 s | voice-over over the soundtrack | the render PC, at night, for the five planned stories | Facebook, Instagram, LinkedIn, Pinterest (YouTube Shorts and TikTok when connected) |

- The wide cut is the site banner's layout rendered at full HD with its soundtrack.
- The tall cut: 0–8 s the banner in a 4:5 frame centred in the picture (the part every feed shows
  uncropped), 8–14 s up to three spec-sheet facts as full-screen cards (facts with numbers first),
  14–15 s the S3DAT News end card with `news.s3dat.com`.
- The voice is Ethan (Fish Audio, `FISH_VOICE_ID`), mixed over the soundtrack, which ducks under
  him; loudness is normalised to −14 LUFS.
- Buffer cannot take a file, only a public link, so both cuts are uploaded to
  `news.s3dat.com/news-media/news-social/<slug>/` (not shown on any page, deleted after 30 days).
  Never commit the videos.

## Now: the 16:9 cut at publishing

`publish.yml`, after a story is published: if it has a `social` block, is at most 12 hours old
and has not been shared, it renders `--format hd`, uploads it (`publish.py --social --wide`) and
runs `social.py --story <slug> --group now`. The result is committed to
`social/posted/<slug>.json`. A failure here leaves the story published; the workflow
`Post to social media` can share it by hand.

## Planned: the render PC at night

The render PC (Windows, RTX GPU) wakes at 03:00 Istanbul time and, for this job:

1. `python scripts/social.py --select` picks the five strongest live stories of the last 30 hours
   that are not planned yet (analysis first, then story and explained; the newest first; one
   lead company at most twice) and gives each a time: 09:00, 13:00, 17:00, 21:00 and 01:00
   Istanbul.
2. For each, it renders the tall cut (`render.mjs --format social`, voice included) and uploads it
   (`publish.py --social --tall`).
3. `social.py --story <slug> --group planned --at <time>` schedules it in Buffer.
4. It goes back to sleep. Buffer posts at the planned times on its own.

The PC keeps its own records (`SOCIAL_RECORDS`). If it misses a night, the next run plans the
newest stories again. For a withdrawn story, run `social.py --cancel <slug>` on the PC (planned
posts) and delete the shared posts in Buffer.

## What each channel gets

| Channel | Group | Video | Text | Link |
| --- | --- | --- | --- | --- |
| X (@s3datlab) | now | wide | `short` | none: X shows posts with links to fewer people |
| Threads | now | wide | `short` + link; the first hashtag becomes the topic | in the post |
| Bluesky | now | wide | `short` + link (300 characters in all) | in the post |
| Mastodon | now | wide | `short` + link + hashtags | in the post |
| Substack Notes | planned | wide | `long` + link | in the post |
| Facebook page | planned | tall, as a reel | `long` | first comment (reel captions do not link) |
| Instagram | planned | tall, as a reel shared to the feed | `long` + hashtags | none: Instagram captions do not link |
| LinkedIn page | planned | tall | `long` | first comment (posts with links reach fewer people) |
| Pinterest | planned | tall | headline as the title, `short` as the description | the pin opens the story |

Instagram and YouTube posts carry the platforms' AI disclosure, because the voice-over is
synthetic (`SOCIAL_AI_LABEL=0` turns it off).

## What you write: `social` in story.json

```json
"social": {
  "voiceover": "[matter-of-fact] Britain's competition regulator has opened a case into Meta's business terms. [break] The question is whether Meta can reuse publishers' content for AI without giving them a real choice. Meta has paused the terms.",
  "short": "Britain's competition regulator opened a case into Meta's business terms on 30 October: the issue is whether Meta can reuse publishers' content for AI without giving them a choice.",
  "long": "Britain's Competition and Markets Authority opened a formal investigation into Meta's commercial terms for businesses on 30 October. ...",
  "hashtags": ["Meta", "Competition", "AI"]
}
```

| Field | Rule |
| --- | --- |
| `voiceover` | 26–36 spoken words (cues not counted), written to be heard. It must stand alone. |
| `short` | 60–240 characters, and short enough for Bluesky with the link (300 in all). X, Threads, Bluesky, Mastodon and Pinterest. The link is added for you. |
| `long` | 300–1500 characters. Facebook, Instagram, LinkedIn and Substack. No link. |
| `hashtags` | 0–4 tags, letters and digits only, without `#`: companies and topics (#OpenAI, #Robotics), never filler (#innovation, #tech). |

`scripts/validate.py` checks every rule below. Required for stories published from 1 November
2026 04:00 UTC.

## How we sound

We are the S3DAT News Desk: people who build software, writing for people who build software.
Calm, exact, a little dry. We sound like the colleague who read the filing so you did not have
to, and tells you in two sentences what it says and what it changes. Never like a brand account,
never like a press release, never like a bot.

1. **The news comes first.** Who did what, in the first eight words. "Mistral released the Large
   4 weights", not "Big day for open models".
2. **One detail that proves we read the source.** A number, a date, a price, the name of the
   document, the exact limit. One is enough; three is a spec sheet.
3. **Then what it changes, plainly.** Say it without a label: no "why it matters", "here's why",
   "what this means".
4. **Say what is still open.** An honest unknown is our hook: "The company has not said when it
   reaches Europe." Never a teaser question, never "stay tuned".
5. **Plain verbs.** released, opened, cut, raised, paused, sued, shipped. Not unveils, unleashes,
   is set to, takes aim, doubles down, heats up.
6. **No emoji, no exclamation marks, no questions, no "Breaking", no all-caps words.**
7. **Vary the shape.** One sentence or two; start with the company, the number, the regulator or
   the product. The validator rejects an opening that one of the last ten posts used.
8. **`short` is the whole post for most readers.** It must make sense with no video and no link.
9. **`long` is written for its own readers,** not `short` with more words: the news, the detail,
   the consequence, then what is still open, in two or three short paragraphs. No headings, no
   bullet lists.

| Instead of | Write |
| --- | --- |
| Breaking: Mistral unveils a game-changing 1T model! Here's why it matters for devs | Mistral released the Large 4 weights: 1 trillion parameters, 49 billion active per token. The NVFP4 files alone are about 610 GB, so most teams will rent it before they host it. |
| Is your editor safe? Huge security news for Cursor users. | Cursor flagged two malicious copies of the Claude Code extension, 2.1.312 and 2.1.313, in its marketplace. Removing the extension is not enough: the payload can leave SSH keys behind. |
| GitHub just dropped Copilot Fusion and the AI coding race heats up! | Copilot Fusion now picks the model for each task in VS Code, JetBrains and the CLI. GitHub bills each model it calls; Fusion itself costs nothing extra. |

## The voice-over

Ethan reads it: a curious explainer. Write the way a person talks.

- Short sentences, contractions where natural ("it's", "they've"), no parentheses.
- Numbers the way people say them: "one trillion parameters", "about six hundred gigabytes".
- Spell out what a voice would trip on: "robots dot T X T", "G P U".
- No links or domains; the end card shows `news.s3dat.com`.

Fish Audio S2 reads `[cues]` in the text as directions for the delivery; they are not spoken.
Use at most four, from the house set:

| Cue | Use |
| --- | --- |
| `[matter-of-fact]` `[calm]` `[measured]` `[serious]` | the default tones for news; open the first sentence with one |
| `[curious]` `[thoughtful]` `[skeptical]` `[wry]` | the open question or the twist at the end |
| `[concerned]` `[surprised]` `[upbeat]` `[warm]` `[confident]` | only when the news really is worrying, surprising or good |
| `[emphasis]` | right before the one word that carries the story |
| `[break]` `[pause]` `[long-break]` | a beat between the news and what it changes |

`slightly` may precede a tone: `[slightly skeptical]`. One tone per sentence, at the start of it.
No laughs, sighs, gasps or shouting.

```text
[matter-of-fact] OpenAI says it will honor one shared robots dot T X T signal for AI training. [break] Publishers would set a single rule instead of one per company. [curious] Whether Google and Anthropic follow is still open.
```

## Corrections and withdrawals

A published post is never edited silently. If a story is corrected, the correction note on the
site is the record; for a material error, post a short correction on the same channels. A
withdrawn story is not posted, and its scheduled posts are removed from Buffer.
