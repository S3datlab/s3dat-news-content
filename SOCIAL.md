# S3DAT News on social media

Every story can leave the site as a video post on every channel connected to Buffer. You write
the copy in `story.json` (`social`, below) and render its two videos on your computer (below).
Five times a day the workflow `Post to social media` picks the best fresh story that has its
videos, adds the voice-over and posts it. Nobody posts by hand.

## The videos

Two cuts of every story, rendered with `tools/news-banner-v2`:

| Cut | Size | Length | Sound | Goes to |
| --- | --- | --- | --- | --- |
| Wide | 1920×1080 (16:9) | 8 s loop | the banner's soundtrack | X, Threads, Bluesky, Mastodon, Substack |
| Tall | 1080×1920 (9:16) | 15 s | voice-over over the soundtrack | Facebook, Instagram, LinkedIn, Pinterest (YouTube Shorts and TikTok when connected) |

- The wide cut is the site banner's layout rendered at full HD with its soundtrack.
- The tall cut: 0–8 s the banner in a 4:5 frame centred in the picture (the part every feed shows
  uncropped), 8–14 s up to three spec-sheet facts as full-screen cards (facts with numbers first),
  14–15 s the S3DAT News end card with `news.s3dat.com`.
- The voice is Ethan (Fish Audio, `FISH_VOICE_ID`), mixed over the soundtrack, which ducks under
  him; loudness is normalised to −14 LUFS.
- Buffer cannot take a file, only a public link, so at posting time the workflow uploads both
  cuts to `news.s3dat.com/news-media/news-social/<slug>/` (not shown on any page, deleted after
  30 days).

## Rendering the cuts (Makima)

The videos are rendered on Makima's computer, not in GitHub Actions (Actions minutes cost
money). The workflow posts only stories whose two cuts are in the GitHub pre-release
`social-YYYY-MM-DD` (the UTC date of `publishedAt`):

- `<slug>-wide.mp4`: `node render.mjs <story-dir> --format hd`
- `<slug>-tall.mp4`: `node render.mjs <story-dir> --format social`, without `FISH_API_KEY`; the
  workflow adds the voice-over with `--add-voice`.

`BROWSER=firefox` or `BROWSER=webkit` renders with another Playwright engine where Chromium
cannot start (Firefox frames match Chromium's; check a contact sheet first); `CHROME_ARGS`
passes extra Chromium flags. How the files reach the release is being worked out with Makima
(31 October 2026). Never commit the videos to the repository. GitHub renders them only when a
person runs the workflow with `render_here`.

## When we post

- Five slots a day, five hours apart, on every channel at once: 01:00, 06:00, 11:00, 16:00 and
  21:00 UTC (04:00, 09:00, 14:00, 19:00 and 00:00 in Istanbul). A day has 24 hours, so one gap is
  four. The slots reach the European morning, noon and evening and the US East Coast morning,
  afternoon and evening.
- Each slot picks the strongest story published in the last 12 hours that has not been posted:
  analysis first, then story and explained, then brief; the newest first; and not the same lead
  company as the previous post when there is a choice. Stories that miss the window are not
  posted later. Nothing is posted within three hours of the previous post.
- `social/state.json` records what went out, when, and any errors. Manual runs default to a dry
  run that only prints the posts.

## What each channel gets

| Channel | Video | Text | Link |
| --- | --- | --- | --- |
| X (@s3datlab) | wide | `short` | none: X shows posts with links to fewer people |
| Threads | wide | `short` + link; the first hashtag becomes the topic | in the post |
| Bluesky | wide | `short` + link | in the post |
| Mastodon | wide | `short` + link + hashtags | in the post |
| Substack Notes | wide | `long` + link | in the post |
| Facebook page | tall, as a reel | `long` | first comment (reel captions do not link) |
| Instagram | tall, as a reel shared to the feed | `long` + hashtags | none: Instagram captions do not link |
| LinkedIn page | tall | `long` | first comment (posts with links reach fewer people) |
| Pinterest | tall | headline as the title, `short` as the description | the pin opens the story |

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
| `short` | 60–240 characters. X, Threads, Bluesky, Mastodon and Pinterest. The link is added for you. |
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
