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

Follow `tools/news-banner/README.md`. Every story gets one engine banner. No video models, stock
media, templates, logos or real people.

## Workflow

1. Research, pick the story, verify sources and dates.
2. Write `story.json` and `spec.json`, generate the two images, render with the engine
   (`--sheet`), run the review checklist.
3. Put the files in `stories/YYYY/MM/DD/<slug>/` on a branch `review/YYYY-MM-DD-<slug>` and open
   a pull request into `main`. Never merge it yourself.
4. In the pull request description list: the sources you checked, the engine report JSON and
   the checklist result.

## Corrections

If a published fact turns out wrong, open a pull request that fixes the story and adds an entry
to `corrections` with the date and what changed. Never silently rewrite a published story.
