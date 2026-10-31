# S3DAT News content

Private working repository for news.s3dat.com. Stories are researched and drafted by Makima
under S3DAT's editorial responsibility and reviewed before they go live.

| Path | What lives there |
| --- | --- |
| `EDITORIAL.md` | What we cover, sources, writing rules, workflow. Read before every run. |
| `tools/news-banner/` | The banner engine. Every story banner is rendered with it; read its README first. |
| `stories/` | One folder per story (format in `stories/README.md`). |

## Branches

- `main`: approved material only.
- Every pull request changing stories runs schema, banner-spec and media validation. Merging into
  `main` validates again, then publishes changed stories to news.s3dat.com through the signed ingest API.
  A manager can also run the Publish news stories workflow with a `story_dir` to retry a publication.
- `review/<date>-<slug>` or `review/<topic>`: work waiting for review. Open a pull request into
  `main`; do not merge it yourself.

## Rules that never change

- English copy on the site; every claim backed by a primary source linked in the story.
- No video-generation models, stock footage, templates or music. Banners come from the engine.
- No logos, real people or product screenshots in generated images; company names appear as text.
- Never commit secrets, tokens or personal data.
- Keep `banner.mp4` and `poster.webp` in each story folder as CI publication inputs. Publishing
  copies them to R2 for serving; removing git media needs a separate input-storage workflow.

## Publishing tools

Python 3.10+ and `ffprobe` are required. Run `python scripts/validate.py <story-dir>...` before review.
Stories need ISO timestamps in both `publishedAt` and `updatedAt` (use the publication time for both
on first publication). The media files remain in the story folder as CI publication inputs; the API
copies them to R2 for serving. Do not remove them while this pipeline reads them from git.

`python scripts/publish.py <story-dir>` publishes one story; `python scripts/publish.py --withdraw <slug>`
withdraws it. Set `NEWS_INGEST_SECRET` in the environment (repository secret in CI); `NEWS_INGEST_URL`
defaults to `https://s3dat.com/api/news/ingest` and may be overridden for local tests. Never commit secrets.
