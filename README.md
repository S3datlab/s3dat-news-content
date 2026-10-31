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
- `review/<date>-<slug>` or `review/<topic>`: work waiting for review. Open a pull request into
  `main`; do not merge it yourself.

## Rules that never change

- English copy on the site; every claim backed by a primary source linked in the story.
- No video-generation models, stock footage, templates or music. Banners come from the engine.
- No logos, real people or product screenshots in generated images; company names appear as text.
- Never commit secrets, tokens or personal data.
- Large media is temporary in git: once the publishing pipeline exists, videos and images move to
  S3DAT's media storage and only the story text and banner spec stay here.
