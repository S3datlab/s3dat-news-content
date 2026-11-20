# S3DAT product posts on X, LinkedIn and Instagram

Read this before writing product posts. Sedat's decision, 21 November 2026: besides the one news
piece a day (`EDITORIAL.md`), our X, LinkedIn and Instagram accounts post about the S3DAT products
that are live: **S3 Browser** and **S3 Brain**. The goal is followers who use AI tools every day,
and downloads.

## Cadence

- One product post a day, at 15:00 UTC (10:00 in New York, 18:00 in Istanbul), on all three
  channels. The news piece goes out in the morning, so the two never compete.
- About four S3 Browser posts and three S3 Brain posts a week. Never the same product three days
  in a row.
- `.github/workflows/products.yml` posts the oldest due file of `products/queue/` once a day and
  records it in `social/products/`. Keep at least seven days queued; the workflow posts nothing
  when the queue is empty.

## What we say

S3 Browser's lead story is **the Mac browser built for AI agents**: Claude Code and Codex connect
in setup with the user's own account, work in background tabs with a space's sign-ins or in private
tabs, ask once per site before running page code, and never touch the user's window. About half of
the S3 Browser posts use this angle. The rest show the browser itself, always tied to a real
situation:

| Pillar | Product | Example situation |
| --- | --- | --- |
| Agents that browse with you | S3 Browser | "Let Claude Code research in background tabs while you keep working" |
| One window, separate lives | S3 Browser | Two accounts on the same site in Work and Personal spaces |
| Private by design | S3 Browser | No telemetry, no account, no password vault |
| Day-two details | S3 Browser | Split view, reader view, video notes, research board, importing from Chrome |
| New session, same thread | S3 Brain | Claude Code and Codex share one memory; no re-explaining the project |
| Memory you can check | S3 Brain | Sources, proposals vs decisions vs outcomes, correct or forget |
| Your rules | S3 Brain | Per-tool access, masked credentials, local-only projects, a new Mac |

Each post: one situation the reader recognises in the first line, the one or two features that
solve it, then where to get it ("Free for Mac" and the link on X and LinkedIn; "Download at
s3dat.com" on Instagram).

## Rules

1. **Only what the product does today.** Every claim must be on the product page
   (https://s3dat.com/products/s3-browser, https://s3dat.com/products/s3-brain) or in the public
   release notes (github.com/S3datlab/S3-Browser-Releases, github.com/S3datlab/S3-Brain-Releases).
   List them in `sources`. No invented numbers, users, reviews, quotes or roadmap promises.
2. **Praise with facts, not adjectives.** "Asks you once per site before running page code", not
   "the most secure browser ever". No "revolutionary", "game-changer", "unleash", no emoji walls,
   no "Follow us" or "Thoughts?" (`social.py --product-check` rejects them).
3. **We are the company.** Write as S3DAT ("we built"), never as one person, and never name an AI
   as the writer.
4. **No knocking competitors by name.** Compare with "most browsers" or "every new AI session" at
   most.
5. Requirements stay true: S3 Browser is free for Apple silicon Macs on macOS 15.4 or later; S3
   Brain is free for personal use on macOS 14 or later, Apple silicon.

## The queue file

`products/queue/YYYY-MM-DD-<name>.json` (the date is the earliest day it may go out, UTC):

```json
{
  "date": "2026-11-22",
  "product": "s3-browser",
  "image": "products/media/2026-11-22-s3-browser-agents.png",
  "alt": "What the image shows, for screen readers (10-400 characters)",
  "x": ["first post with the image (280 max, links count 23)", "reply", "reply with the link"],
  "linkedin": "200-2800 characters, link and 2-3 hashtags at the end",
  "instagram": "150-2000 characters, no links, 5 hashtags at the end",
  "sources": ["https://s3dat.com/products/s3-browser"]
}
```

- **X:** a thread of two or three posts. The first carries the image and the situation; the link
  goes in the last reply (X shows posts with links to fewer people).
- **LinkedIn:** the situation, the features as a short list, the requirements and the link.
- **Instagram:** a feed image post; no links in captions, so it ends with "Download at s3dat.com".

## The image

Every post has a 1080×1350 card: product icon and name, a short kicker, the headline (at most
about eight words) and a real product screenshot. Never a mock-up or a generated picture of the
app.

1. Write `products/cards/<same name>.json`:
   `{"product", "kicker", "headline", "shot", "fit": "cover"|"contain", "out"}`. `shot` is a file
   in `tools/product-card/assets/` (real screenshots copied from the S3DAT.com site repository,
   `src/assets/products/`); use `contain` for the small S3 Brain panels.
2. Render: `node tools/product-card/render.mjs products/cards/<name>.json` (set `CHROMIUM_PATH`
   when Playwright's Chromium is not installed).
3. Check: `python3 scripts/social.py --product-check`, and look at the PNG.
4. Commit the queue file, the card file and the PNG together: `Products: queue <name>`. This
   repository is public, so Buffer reads the image from its raw GitHub URL.
