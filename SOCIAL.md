# S3DAT News on social media

Every story leaves the site as a 15-second vertical video with a voice-over, and Buffer posts it to
the channels that suit its kind. You write the copy in `story.json` (`social`, below); GitHub
Actions renders the video and hands the posts to Buffer. Nobody posts by hand.

## The video

- 1080×1920 (9:16), 15 seconds, H.264 with AAC sound, rendered by `tools/news-banner-v2`.
- 0–8 s: the story's banner in a 4:5 frame centred in the vertical picture, clear of the captions
  and buttons each app draws at the edges.
- 8–14 s: up to three spec-sheet facts as full-screen cards (facts with numbers first).
- 14–15 s: the S3DAT News end card with `news.s3dat.com`.
- Sound: the voice-over (Fish Audio) over a quiet synthesised bed and effects on the cuts; the
  bed ducks under the voice. Loudness is normalised to −14 LUFS.
- The run artifact holds it as `<slug>-social.mp4`.

## What you write: `social` in story.json

```json
"social": {
  "voiceover": "Britain's competition regulator has opened a case into Meta's business terms. Can Meta reuse publishers' content for AI without a real choice? Meta has paused the terms, and no breach has been found.",
  "short": "The UK's competition regulator opened a case into Meta's business terms on 30 October: can Meta reuse publishers' content for AI without giving them a choice?",
  "long": "Britain's Competition and Markets Authority opened a formal investigation into Meta's commercial terms for businesses on 30 October. ...",
  "hashtags": ["AI", "Meta", "Competition"]
}
```

| Field | Rule |
| --- | --- |
| `voiceover` | 26–36 words, written to be heard: short sentences, no links, no abbreviations a voice would stumble on, numbers as people say them. It must stand alone; the viewer may not read anything else. |
| `short` | 60–240 characters for X, Threads, Bluesky and Mastodon. The news in one or two sentences. The link is added automatically. |
| `long` | 300–1500 characters for LinkedIn, Facebook, Instagram, Pinterest and Substack: the lede, why it matters, one concrete number. No link (it goes in the first comment or bio). |
| `hashtags` | 0–4 tags, letters and digits only, without `#`. Topic and company names, never filler (#AI is fine, #innovation is not). |

The house style of `EDITORIAL.md` applies here too: no generated-sounding words, no emoji, no hype,
no questions as bait. `scripts/validate.py` checks all of it. Required for stories published from
1 November 2026 04:00 UTC.

## Where each story goes

| Channel | What goes there | Text | Most per day |
| --- | --- | --- | --- |
| X (@s3datlab) | Every story, right after publishing | `short` + link | no cap |
| Threads | Every story, right after publishing | `short` + link | no cap |
| Bluesky | Every story, right after publishing | `short` + link | no cap |
| Mastodon | Every story, right after publishing | `short` + link + hashtags | no cap |
| Facebook page | Stories and analyses | `long`, link in the first comment | 3 |
| Instagram (Reels) | Analyses, and stories with a hero cut-out | `long` + hashtags; "link in bio" | 2 |
| LinkedIn page | Analyses and explainers | `long`, link in the first comment | 2 |
| Pinterest | Analyses and explainers | title + `short`, pin links to the story | 1 |
| Substack (Notes) | The day's analysis | `long` + link | 1 |

Briefs go only to the fast networks (X, Threads, Bluesky, Mastodon). Fast networks post at once;
the others go into Buffer's queue at fixed times (Istanbul time): LinkedIn 11:00 and 16:00,
Facebook 12:00, 17:00 and 21:00, Instagram 13:00 and 20:00, Pinterest 21:00, Substack 18:00. Those
slots reach European mornings and the US East Coast morning. When a channel's daily cap is full,
the story skips that channel rather than piling up for the next day.

## Corrections and withdrawals

A published post is never edited silently. If a story is corrected, the correction note on the
site is the record; for a material error, post a short correction on the same channels. A
withdrawn story has its scheduled posts removed from Buffer.
