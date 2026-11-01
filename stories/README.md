# Story format

One folder per story: `stories/YYYY/MM/DD/<slug>/`

| File | Content |
| --- | --- |
| `story.json` | The story (schema below). |
| `spec.json` | Banner spec for engine 2, `tools/news-banner-v2` (see its README). |
| Asset files | The cut-outs, art and logo files named in `spec.json`, at most 1.6 MB together. |
| `banner.mp4`, `poster.webp` | Rendered by GitHub Actions. Do not commit them for engine-2 stories. |

## story.json — the S3DAT story format (`"format": 2`)

Every story published from 31 October 2026 09:00 UTC uses this format. Read `EDITORIAL.md`
for how to write it; `scripts/validate.py` enforces both the structure and the house style.

A story is a lede, a spec sheet and prose, plus the parts its kind calls for:

| Field | Rule |
| --- | --- |
| `format` | Always `2`. |
| `slug` | Lowercase words joined by hyphens, unique, no dates. |
| `kind` | `story`, `analysis` or `explained` (table below). `brief` is retired from 1 November 2026 18:00 UTC. |
| `topic` | One of `models`, `agents`, `dev-tools`, `research`, `hardware`, `policy`, `apps`. |
| `title` | The headline: sentence case, at most 90 characters, an active verb, no question, no "X, but Y". |
| `titleAccent` | Optional words of `title` to highlight. |
| `dek` | One sentence, 60–260 characters, for cards, feeds and search results. Not repeated on the page. |
| `eventDate` | `YYYY-MM-DD` of the announcement or event. A `story` must be at most two days old. |
| `publishedAt` | When we publish, ISO 8601 in UTC. |
| `lede` | Two or three sentences of prose. The first (at most 35 words) says who did what and when; the next says why it matters. |
| `facts` | The spec sheet: 3–6 `{ "label", "value" }` pairs (labels up to 28 characters, values up to 120). At least one value carries a number. |
| `body` | Prose paragraphs `{ "heading"?, "text" }`. No bullets or markdown. |
| `buildersNote` | What this changes for people who build software: a concrete action, cost or risk, 40–500 characters. |
| `claims` | Key claims and how far they are established: `{ "text", "status", "source" }` with status `confirmed` (a primary document shows it; needs `source`), `claimed` (the company says so) or `unclear`. `source` is the index in `sources`. |
| `comparison` | A table: `{ "caption", "columns": ["", "A", "B", "C"], "rows": [["Price", "...", "...", "..."]] }`, 3–5 columns, 2–6 rows, cells up to 80 characters. |
| `ourRead` | Our opinion, one paragraph (120–1200 characters), ending with what would change our mind. |
| `watching` | 1–3 concrete, dated things we will check next. |
| `sources` | 1–8 `{ "title", "publisher", "url", "date" }`; primary sources first; `date` is `YYYY-MM-DD`. |
| `social` | The copy and voice-over for social media: `{ "voiceover", "short", "long", "hashtags", "priority" }`. The voice-over may carry Fish Audio delivery cues such as `[matter-of-fact]`. Rules and the house voice in `SOCIAL.md`; required from 1 November 2026 04:00 UTC. |
| `video.titleInVideo` | `true` (the banner carries the headline). |
| `corrections` | `[{ "date": "...", "note": "..." }]` when a published fact changes. |

| Kind | Prose words | Body paragraphs | Must also have |
| --- | --- | --- | --- |
| `brief` | retired | | Not accepted from 1 November 2026 18:00 UTC. |
| `story` | 450–900 | 2–5 | facts, a `buildersNote` and at least two `claims`. |
| `analysis` | 600–1300 | 3–8 | facts, `comparison`, 2+ `claims`, `ourRead`, 1–3 `watching`. |
| `explained` | 450–1500 | 3–10, each with a question as its heading | facts optional. |

Prose words count the lede, body, builder's note and our read.

### Example (a `story`)

```json
{
  "format": 2,
  "slug": "meta-commercial-terms-cma-probe",
  "kind": "story",
  "topic": "policy",
  "title": "UK competition regulator opens a case into Meta's business terms",
  "titleAccent": "opens a case",
  "dek": "The CMA will examine whether Meta's terms let it reuse publishers' website content, including for AI features, without giving them a choice.",
  "eventDate": "2026-10-30",
  "publishedAt": "2026-10-31T04:06:54Z",
  "lede": "Britain's Competition and Markets Authority opened a formal investigation on October 30 into Meta's commercial terms for businesses. The regulator wants to know whether those terms let Meta reuse publishers' website content, including for AI features, without a real choice.",
  "facts": [
    {
      "label": "Regulator",
      "value": "UK Competition and Markets Authority"
    },
    {
      "label": "Company",
      "value": "Meta"
    },
    {
      "label": "Opened",
      "value": "30 Oct 2026"
    },
    {
      "label": "Question",
      "value": "Possible abuse of a dominant position"
    },
    {
      "label": "Next step",
      "value": "Information gathering until January 2027"
    },
    {
      "label": "Finding so far",
      "value": "None. No breach established"
    }
  ],
  "body": [
    {
      "text": "The concern is specific. Meta's revised terms for businesses could let the company use content from publishers' websites in its own products, AI features included. According to the CMA, publishers would not get to choose whether that reuse happens."
    },
    {
      "heading": "Meta has already pressed pause",
      "text": "Meta paused the revised terms on October 28 to consult the industry, the CMA says. It had already delayed their introduction once. The pause does not end the case: the regulator will still assess whether Meta holds a dominant position and whether the terms abuse it."
    },
    {
      "heading": "What happens next",
      "text": "The official timetable puts information gathering first and runs it until January 2027. The CMA says those dates may move. Opening a case is not a finding, and the regulator has said plainly that no infringement has been established."
    },
    {
      "text": "For publishers, the case tests a trade-off many already live with. They reach readers through a platform, and they accept whatever reuse the platform's contract allows. A decision against Meta could strengthen their hand in those negotiations."
    }
  ],
  "buildersNote": "If your product takes in content through platform partnerships, check where your rights come from: the platform's contract or the publisher's consent. This case turns on exactly that difference, and the answer may change which platform data you can use for AI.",
  "claims": [
    {
      "text": "The CMA opened a competition-law investigation into Meta's business terms on 30 October 2026",
      "status": "confirmed",
      "source": 0
    },
    {
      "text": "Meta paused the revised terms on 28 October to consult the industry",
      "status": "confirmed",
      "source": 0
    },
    {
      "text": "The terms allow AI reuse of publisher content without a choice: this is the regulator's concern, not a finding",
      "status": "unclear",
      "source": 1
    }
  ],
  "watching": [
    "The CMA case page, which schedules the end of information gathering for January 2027."
  ],
  "sources": [
    {
      "title": "CMA opens investigation into Meta's commercial terms, October 30, 2026",
      "publisher": "Competition and Markets Authority",
      "url": "https://www.gov.uk/government/news/cma-opens-investigation-into-metas-commercial-terms--2",
      "date": "2026-10-30"
    },
    {
      "title": "Meta commercial terms case, opened October 30, 2026",
      "publisher": "Competition and Markets Authority",
      "url": "https://www.gov.uk/cma-cases/suspected-abuse-of-a-dominant-position-in-relation-to-metas-commercial-terms",
      "date": "2026-10-30"
    }
  ],
  "video": {
    "width": 1080,
    "height": 608,
    "titleInVideo": true
  },
  "corrections": []
}
```

## The first format

The stories published before 31 October 2026 09:00 UTC used lists (`whatHappened`,
`whyItMatters`, `take`, `openQuestions`) and no `format` field. The site still renders them.
To convert one, replace those fields with the format 2 fields above and add `"format": 2`.
