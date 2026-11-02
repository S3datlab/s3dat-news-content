# S3DAT News on social media

Every story leaves the site as a video post on the channels connected to Buffer, in two groups.
You write the copy in `story.json` (`social`, below); nobody posts by hand.

- **Now:** the moment a story is published, `publish.yml` renders its 16:9 cut and shares it on
  X, Threads, Bluesky, Mastodon, Facebook, LinkedIn, Pinterest and Substack.
- **Reel:** about every five hours (five a day) `reel.yml` picks the story of the last 24 hours most worth a video,
  renders its 9:16 cut with the voice-over and posts it to Instagram (and YouTube Shorts or TikTok
  when connected). Instagram is the one channel that needs the vertical video.

## The videos

| Cut | Size | Length | Sound | Rendered | Goes to |
| --- | --- | --- | --- | --- | --- |
| Wide | 1920×1080 (16:9) | 8 s loop | the banner's soundtrack | by `publish.yml`, with the story | every channel but Instagram |
| Tall | 1080×1920 (9:16) | 15 s | voice-over over the soundtrack | by `reel.yml`, for the picked story | Instagram Reels (YouTube Shorts, TikTok) |

- The wide cut is the site banner's layout rendered at full HD with its soundtrack.
- The tall cut (`tools/news-banner-v2/social.js`): the 16:9 banner plays as a card near the top;
  behind it the same banner runs scaled up and blurred, so the frame takes its colours from the
  video. Below it the voice-over is set as kinetic type, one phrase at a time, words lighting up
  as they are spoken; numbers and `[emphasis]` words sit on a pill in the brand colour. It ends on
  the S3DAT News sign-off with `news.s3dat.com`. Everything stays in the Reels safe zone.
- The voice is Ethan (Fish Audio, `FISH_VOICE_ID`), mixed over the soundtrack, which ducks under
  him; loudness is normalised to −14 LUFS.
- Buffer cannot take a file, only a public link, so both cuts are uploaded to
  `news.s3dat.com/news-media/news-social/<slug>/` (not shown on any page, deleted after 30 days).
  Never commit the videos.

## Now: the 16:9 cut at publishing

After a story is published, if it has a `social` block, is at most 12 hours old and has not been
shared, `publish.yml` renders `--format hd`, uploads it (`publish.py --social --wide`) and runs
`social.py --story <slug> --group now`. The result is committed to `social/posted/<slug>.json`. A
failure here leaves the story published; the workflow `Post to social media` can share it by hand.

## Reel: the 9:16 cut about every five hours

Every hour at :41, and after every publish run (GitHub delays scheduled runs and drops some, on
2 November seven hours of them, so fixed slots went missing) `reel.yml` runs `social.py --pick`: the live story of the last 24 hours without a reel, highest
`social.priority` first, then analysis before story and explained, then the newest. Stories with
priority 1 or 2 never get a reel; when nothing qualifies, nothing is posted. It renders the tall
cut, uploads it and runs `social.py --story <slug> --group reel`. A reel goes out only once the
previous one is 4 h 30 min old, so the hourly checks give one every 4.5 to 5.5 hours, five a day.

For a withdrawn story, run `social.py --cancel <slug>` with `BUFFER_API_KEY` (it deletes the posts
recorded in `social/posted/<slug>.json`).

## What each channel gets

Every post ends the same way, in this order: the story link ("Full story: <link>"), a follow line
and the story's own hashtags. A part that does not fit the channel's limit is left out.

| Channel | Group | Video | Text | Link | Hashtags |
| --- | --- | --- | --- | --- | --- |
| X (@s3datlab) | now | wide | `short` + "Follow @s3datlab…" | none: X shows posts with links to fewer people | first 2 |
| Threads | now | wide | `short` + link + follow line | in the post | none; the first tag becomes the topic |
| Bluesky | now | wide | `short` + link (300 characters in all), follow line if it fits | in the post | first 2, if they fit |
| Mastodon | now | wide | `short` + link + follow line | in the post | all 5 |
| Facebook page | now | wide, as a video post | `long` + link + follow line | in the post | none |
| LinkedIn page | now | wide | `long` + link + follow line | in the post (LinkedIn turns it into a clickable lnkd.in link) | first 3 |
| Pinterest | now | wide | headline as the title, `short` as the description | the pin opens the story | none |
| Substack Notes | now | wide | `long` + link + follow line | in the post | none |
| Instagram | reel | tall, as a reel shared to the feed | `long` + "Follow for daily AI news. Full story: link in bio." | none: captions do not link; the profile link does | all 5 |
| YouTube Shorts | reel | tall | `long` + link + "Subscribe…" | in the description | first 3 (shown above the title) |
| TikTok | reel | tall | `short` + "…link in bio." | none: captions do not link | all 5 |

The posts have two jobs: bring readers to news.s3dat.com and win followers. Keep the profile link
of Instagram and TikTok on https://news.s3dat.com.

Instagram and YouTube posts carry the platforms' AI disclosure, because the voice-over is
synthetic (`SOCIAL_AI_LABEL=0` turns it off).

## What you write: `social` in story.json

```json
"social": {
  "voiceover": "[matter-of-fact] Britain's competition regulator has opened a case into Meta's business terms. [break] The question is whether Meta can reuse publishers' content for AI without giving them a real choice. Meta has paused the terms.",
  "short": "Britain's competition regulator opened a case into Meta's business terms on 30 October: the issue is whether Meta can reuse publishers' content for AI without giving them a choice.",
  "long": "Britain's Competition and Markets Authority opened a formal investigation into Meta's commercial terms for businesses on 30 October. ...",
  "hashtags": ["Meta", "CMA", "CompetitionLaw", "Publishers", "AIRegulation"],
  "priority": 4
}
```

| Field | Rule |
| --- | --- |
| `voiceover` | 26–36 spoken words (cues not counted), written to be heard. It must stand alone. |
| `short` | 60–240 characters, and short enough for Bluesky with the link (300 in all). X, Threads, Bluesky, Mastodon and Pinterest. The link is added for you. |
| `long` | 300–1500 characters. Facebook, Instagram, LinkedIn and Substack. No link. |
| `hashtags` | 3–5 tags about this story, most important first, letters and digits only, without `#`. First the product or company the story is about (#Claude, #Gemini, #Anthropic), then the field the story belongs to (#AIAgents, #CodingAgents, #OpenWeights, #AIRegulation). People follow these tags, so each one should be a tag the people who care about this story actually follow. Never tags that fit any story (#AI, #AINews, #Tech, #Innovation): the validator rejects them. Channels take tags from the front of the list (X 2, LinkedIn 3, Instagram 5), so order matters. Required from 2 November 2026 18:00 UTC. |
| `priority` | 1–5: how much the story is worth a 15-second video for people who scroll Instagram. 5 = the story of the day, 3 = solid, 1–2 = never a reel. Most stories are 3; give 4 or 5 sparingly. |

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
