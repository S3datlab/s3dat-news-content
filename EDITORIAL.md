# S3DAT News editorial guide

Read this before every run. It applies to every story, banner and pull request in this repository.

## What we cover

AI and developer tooling, seen by a team that builds software: models, agents, dev tools,
research, hardware, policy and the apps people use. Not general tech news, not gossip, not
funding rounds unless they change what builders can do.

## Cadence

- About one story per hour while there is real news, up to roughly ten a day. Space
  `publishedAt` an hour apart.
- Skip the hour when there is nothing worth adding. Volume is never the goal.
- Never present an old announcement as new. Check the original date; if a story resurfaces,
  either skip it or say clearly when it was first announced.

## Kinds

| Kind | Use it for | Must contain |
| --- | --- | --- |
| `story` | One development of the day | What happened (sourced facts), why it matters (2–4 concrete points), the S3DAT take (2–3 sentences), open questions when something is unknown. |
| `analysis` | A development worth a deeper reading | Everything in `story`, plus a dated, sourced comparison with the closest competitors or alternatives, and what it means for the sector (developers, companies, users). |
| `explained` | An idea behind the news | Plain explanation, a worked example, limits and common misunderstandings. |

## Sources

- Every fact in `whatHappened` must be traceable to a source in `sources`. Prefer primary
  sources: the company's post, paper, filing, documentation, release notes, court docket.
- Disputes and `versus` stories cite both sides or a neutral record (for example the court
  docket), never only one party's blog.
- Numbers (benchmarks, prices, parameters, funding) come with who measured or claimed them.
- Company claims stay attributed ("Mistral says", "Google reports"); they are not our findings.

## Writing

- English, plain and specific. Short sentences. No hype words ("revolutionary", "game-changing",
  "insane"), no clickbait, no questions as headlines.
- `title` is accurate and sentence case. The banner headline in `spec.json` is its short
  uppercase form and must say the same thing.
- `take` is our own reading: what this changes, who wins or loses, how it compares, what to
  watch next. Write it directly; the site already labels it "The S3DAT take", so do not start
  with "Our view".
- Paraphrase; never copy paragraphs from sources. At most one short quote per story, in
  quotation marks, attributed.
- No invented quotes, people, numbers, dates or links. If something is uncertain, put it in
  `openQuestions`.
- S3DAT's own products appear only when genuinely relevant, and the link is disclosed.

## Banners

Follow `tools/news-banner-v2/README.md`. Every story gets one banner from engine 2, rendered by
GitHub Actions. The big headline is the only text in it; the real logo, the brand colours and an
illustrated cut-out make the subject clear at a glance. No video models and no stock media. Real
people appear only as clearly illustrated caricatures, never photorealistic. Logos are never
generated.

## Workflow (approved for publishing on 31 October 2026)

Committing a story to `main` publishes it to news.s3dat.com automatically.

1. Research, pick the story, verify sources and dates. Skip the hour if nothing deserves a story.
2. Write `story.json` and `spec.json` (engine 2), choose a template that differs from the last
   published story, generate the cut-outs (and art for `cinematic`), and if you can, preview with
   `render.mjs --frames` and run `python3 scripts/validate.py --spec-only <folder>`.
3. Set `publishedAt` to the current time in UTC.
4. Commit `story.json`, `spec.json` and the asset files named in `spec.json` to `main` in
   `stories/YYYY/MM/DD/<slug>/`, one commit per story, message `Publish: <title>`. Never commit
   `banner.mp4`, `poster.webp` or sheets: GitHub Actions renders them.
5. Check that the "Publish news stories" run for your commit succeeds and that the story opens at
   `https://news.s3dat.com/stories/<slug>`. If the run fails, read the log, fix and commit again.
   The rendered banner is in the run artifact `banners-<run id>` and on the story page; use it for
   the daily social delivery.
6. Never change or remove someone else's story. Withdrawing a story is Sedat's decision.

## Corrections

If a published fact turns out wrong, open a pull request that fixes the story and adds an entry
to `corrections` with the date and what changed. Never silently rewrite a published story.
