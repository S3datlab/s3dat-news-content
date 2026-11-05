# S3DAT News editorial guide

Read this before every run. It applies to every story, banner and pull request in this repository.

## What we cover

AI and developer tooling, seen by a team that builds software: models, agents, dev tools,
research, hardware, policy and the apps people use. Not general tech news, not gossip, not
funding rounds unless they change what builders can do.

Every day, at least four pieces cover what the wider AI audience is talking about that day: the
big labs and platforms (OpenAI, Anthropic, Google, Meta, Apple, Microsoft, Nvidia, xAI, Mistral),
the apps people use, prices, lawsuits and rules. Small releases still have their place, but they
rarely earn a reel, and a day of only small releases leaves the social channels with nothing
people stop for (`SOCIAL.md`, priority).

## Cadence

- Look for news every hour, around the clock (24 runs a day). Publish at most one piece per
  run, and only when it is worth a full piece; space `publishedAt` at least an hour apart.
- Skip the hour when there is nothing worth a full piece. Volume is never the goal: one strong
  analysis beats three thin stories.
- Never present an old announcement as new. Put the announcement date in `eventDate`. A `story`
  must be at most two days old; anything older is an `analysis` or `explained` with a reason to
  exist today, or it is skipped. The site shows "Announced" next to "Published".

## Kinds

We do not publish short items. There are no briefs from 1 November 2026 18:00 UTC: a
development too small for a full story is skipped. Most pieces are analyses: what happened,
how it compares with the closest alternatives, and what it means for the sector and for people
who build software. The sections each kind needs are in `stories/README.md`.

| Kind | Use it for |
| --- | --- |
| `story` | One development of the day with full context: what changed, for whom, how it compares, a builder's note and a claim check. 450–900 words. |
| `analysis` | A development worth a deeper reading: a comparison table against the closest alternatives, a claim check, our read and what we are watching. |
| `explained` | The idea behind the news, evergreen: sections headed by the questions a reader would ask, a worked example, limits. |

## Sources

- Every fact in the lede, spec sheet and body must be traceable to a source in `sources`.
  Prefer primary sources: the company's post, paper, filing, documentation, release notes,
  court docket. Give each source its `date`.
- Disputes and `versus` stories cite both sides or a neutral record (for example the court
  docket), never only one party's blog.
- Numbers (benchmarks, prices, parameters, funding) come with who measured or claimed them.
- Company claims stay attributed ("Mistral says", "Google reports"); they are not our findings.
- The claim check sorts the key claims: `confirmed` when a primary document shows it (link it),
  `claimed` when only the company says so, `unclear` when it is not established. Put the
  uncertainty there, once, so the prose can speak plainly.

## Writing: the S3DAT voice

We write like a product team explaining the news to another product team: plain, specific,
numerate, a little dry. English only. The validator rejects copy that breaks the rules below.

1. **Lead with the news.** The lede's first sentence says who did what, and when. The second
   says why it matters to someone who builds or uses software. No scene-setting.
2. **Specific beats general.** Names, versions, dates, prices, limits, counts, with units.
   Not "much faster" but "2.3 times faster on SWE-bench, Google says".
3. **Short sentences.** 15–22 words on average, never 40. One idea per paragraph. Active voice.
4. **Say it once.** Caveats belong in the claim check. Do not hedge every sentence, and do not
   stack "rather than", "not X but Y", "not just" (three at most per story).
5. **No research notes in the copy.** "Checked October 31", "comparison as of" and similar go
   in the sources' dates, never in the text.
6. **No generated-sounding words.** delve, landscape, notably, worth noting, robust, seamless,
   leverage, unlock, crucial, pivotal, game-changer, paves the way, underscores, in today's,
   the future of, moreover, furthermore, in conclusion, and the rest of the list in
   `scripts/validate.py`. No hype, no clickbait, no rhetorical questions.
7. **Headlines** have a concrete subject and an active verb, a number when there is one, at
   most 90 characters, no question, and never "X, but Y". Vary their shape from story to story.
   `title` and the banner headline in `spec.json` say the same thing.
8. **The spec sheet** is what a reader would put in a table: who, what, when, price, limits,
   status. Values are short and exact; at least one is a number.
9. **The body reports; the boxes advise.** Body paragraphs explain what happened and what it
   means. Recommendations ("we would", "teams should") belong in the builder's note and our
   read; the body may carry at most two.
10. **The builder's note** gives an action or a number: "migrate before 1 December", "costs
   about $1,100 a month at 50,000 searches a day", "test it on the target phone". Never generic
   advice such as "teams should evaluate carefully".
11. **Our read** takes a position in one paragraph, says "we", and ends with what would change
    our mind. The site labels it as opinion.
12. **Paraphrase.** Never copy paragraphs from sources. At most one short quote per story, in
    quotation marks, attributed. No invented quotes, people, numbers, dates or links.
13. S3DAT's own products appear only when genuinely relevant, and the link is disclosed.

The social copy in `story.json` (`social`) follows `SOCIAL.md`: read it every run too. On social
media we also say what we think: every post carries a `hook`, our `take` and the `keyFacts`
people save, and about half carry a real `question`.

Before and after:

- Before: "That is a product-design tradeoff, not a universal accuracy ranking; the reported tests
  ran on a Mac, not an iPhone." After: "The creator tested both engines on a Mac. There are no
  iPhone numbers yet."
- Before: "Comparison checked October 31: OpenAI's documentation separates GPTBot from
  OAI-SearchBot." After: "OpenAI already runs two crawlers: GPTBot for training and
  OAI-SearchBot for search."

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

## Scene plan for the video (from 2026-11-05)
Every story commit also carries `scene.md` in the story folder, written by the rules in
`SCENES.md`: the stake, a physical real-world scene already in motion, the cast, one or two
attention ingredients, the logo surface, the banner moment, and for priority 4-5 the four reel
moments. It goes in the same commit as story.json and spec.json. Learn from the `health`
branch's METRICS.md which scenes and ingredients get watched, and vary them.
