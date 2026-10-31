# Story format

One folder per story: `stories/YYYY/MM/DD/<slug>/`

| File | Content |
| --- | --- |
| `story.json` | The story (schema below). |
| `spec.json` | Banner spec for engine 2, `tools/news-banner-v2` (see its README). |
| Asset files | The cut-outs, art and logo files named in `spec.json`, at most 1.6 MB together. |
| `banner.mp4`, `poster.webp` | Rendered by GitHub Actions. Do not commit them for engine-2 stories. |

## story.json

```json
{
  "slug": "codex-limits-doubled",
  "kind": "story",
  "topic": "dev-tools",
  "title": "OpenAI doubles Work and Codex limits on Pro plans",
  "titleAccent": "doubles",
  "dek": "One sentence that tells the reader what happened and why it matters.",
  "publishedAt": "2026-10-31T09:00:00Z",
  "whatHappened": ["Short factual sentence.", "Another one."],
  "whyItMatters": ["Why a developer or user should care."],
  "take": ["S3DAT's own reading, clearly opinion, one to three sentences."],
  "openQuestions": ["What is not known yet."],
  "sources": [
    { "title": "Release notes, 29 October", "publisher": "OpenAI", "url": "https://..." }
  ],
  "video": { "width": 1080, "height": 608, "titleInVideo": true },
  "corrections": []
}
```

| Field | Rule |
| --- | --- |
| `slug` | Lowercase words joined by hyphens, unique, no dates. |
| `kind` | `story` (daily news), `analysis` (longer reading with comparison and sector impact) or `explained` (evergreen explainer). |
| `topic` | One of `models`, `agents`, `dev-tools`, `research`, `hardware`, `policy`, `apps`. Must match the banner palette. |
| `title` | The article headline, sentence case, accurate, no clickbait. The banner headline in `spec.json` is its short uppercase form. |
| `titleAccent` | Optional words of `title` to highlight. |
| `dek` | One sentence, 140–200 characters. |
| `publishedAt` | ISO 8601 in UTC. |
| `whatHappened` | Facts only, each backed by a source. |
| `whyItMatters` | Impact for developers, companies or users. |
| `take` | Opinion, labelled as such on the site. |
| `openQuestions` | Optional. Say what is unknown instead of guessing. |
| `sources` | At least one primary source (the company, paper, filing or documentation). |
| `video.titleInVideo` | `true` for engine banners (the headline is drawn in the video). |
| `corrections` | `[{ "date": "...", "note": "..." }]` when a published fact changes. |
