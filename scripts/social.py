#!/usr/bin/env python3
"""Post a story to the Buffer channels in two groups (SOCIAL.md).

  now      X, Threads, Bluesky, Mastodon: the 16:9 cut, shared the moment the story is published
           (.github/workflows/publish.yml runs it after publishing)
  planned  Facebook, Instagram, LinkedIn, Pinterest (and YouTube or TikTok if connected) with the
           9:16 cut, Substack with the 16:9 cut: the render PC schedules five stories a day at
           fixed times every night

  python scripts/social.py --story SLUG --group now [--dry-run] [--force]
  python scripts/social.py --select [--count 5]
                                       print the stories to plan tonight as JSON: the strongest
                                       unplanned stories of the last 30 hours, each with its time
  python scripts/social.py --story SLUG --group planned --at ISO-TIME [--dry-run] [--force]
  python scripts/social.py --cancel SLUG
                                       delete the story's posts from Buffer (a withdrawn story)
  python scripts/social.py --dry-run --offline [--group now|planned]
                                       print the posts for sample channels, no API key
  python scripts/social.py --channels  list the Buffer channels and Pinterest boards (read-only)

Each posting is recorded in social/posted/<slug>.json (SOCIAL_RECORDS overrides the folder; the
render PC keeps its own), so a story goes to each group once unless --force is given.

BUFFER_API_KEY is required except with --offline. PINTEREST_BOARD picks the board by name or
id (default: the first board whose name contains "s3dat" or "news"). SOCIAL_AI_LABEL=0 turns
off the AI disclosure on Instagram and YouTube (the voice-over is synthetic).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
RECORDS = Path(os.environ.get("SOCIAL_RECORDS") or ROOT / "social" / "posted")
SITE = "https://news.s3dat.com"
API = "https://api.buffer.com"
AGENT = "S3DAT-News-Social/1.0 (+https://news.s3dat.com/about)"
# The PC plans once a night from the stories published since the night before, with some overlap.
WINDOW = dt.timedelta(hours=30)
ISTANBUL = dt.timezone(dt.timedelta(hours=3))
SLOTS = (9, 13, 17, 21, 25)  # Istanbul hours of the planned posts; 25 is 01:00 the next night
RANK = {"analysis": 3, "story": 2, "explained": 2, "brief": 1}
WIDE = {"twitter", "threads", "bluesky", "mastodon", "substack"}
TALL = {"facebook", "instagram", "linkedin", "pinterest", "youtube", "tiktok"}
GROUPS = {"now": {"twitter", "threads", "bluesky", "mastodon"},
          "planned": {"facebook", "instagram", "linkedin", "pinterest", "youtube", "tiktok", "substack"}}
THUMB_MS = 2500  # a frame where the banner headline is fully on screen


def now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_time(value) -> dt.datetime | None:
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def iso(moment: dt.datetime) -> str:
    return moment.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def warn(message: str) -> None:
    print(f"::warning::{message}" if os.environ.get("GITHUB_ACTIONS") else f"WARNING {message}")


# ------------------------------------------------------------------ stories
def stories() -> list[dict]:
    found = []
    for path in sorted((ROOT / "stories").glob("*/*/*/*/story.json")):
        try:
            story = json.loads(path.read_text(encoding="utf-8"))
            spec = json.loads((path.parent / "spec.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        published = parse_time(story.get("publishedAt"))
        social = story.get("social")
        if not published or not isinstance(social, dict):
            continue
        brands = spec.get("brands") if isinstance(spec, dict) else None
        lead = str(brands[0].get("name") or brands[0].get("icon") or "").lower() if brands and isinstance(brands[0], dict) else ""
        found.append({"slug": story["slug"], "title": story.get("title", ""), "kind": story.get("kind", "story"),
                      "published": published, "social": social, "lead": lead,
                      "folder": str(path.parent.relative_to(ROOT))})
    return found


def media_url(slug: str, kind: str) -> str:
    return f"{SITE}/news-media/news-social/{slug}/{kind}.mp4"


def story_url(slug: str) -> str:
    return f"{SITE}/stories/{slug}"


def reachable(url: str, method: str = "HEAD") -> bool:
    request = urllib.request.Request(url, method=method, headers={"User-Agent": AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status == 200
    except (urllib.error.URLError, OSError):
        return False


def media_ready(slug: str, shapes: tuple[str, ...] = ("wide", "tall"), tries: int = 4) -> bool:
    for attempt in range(tries):
        if all(reachable(media_url(slug, shape)) for shape in shapes):
            return True
        if attempt + 1 < tries:
            time.sleep(10 * (attempt + 1))
    return False


def slots(at: dt.datetime) -> list[dt.datetime]:
    """The planned posting times of the coming day, all after `at`."""
    day = at.astimezone(ISTANBUL).replace(hour=0, minute=0, second=0, microsecond=0)
    if at.astimezone(ISTANBUL).hour >= SLOTS[0]:
        day += dt.timedelta(days=1)
    return [(day + dt.timedelta(hours=h)).astimezone(dt.timezone.utc) for h in SLOTS]


def select(candidates: list[dict], at: dt.datetime, count: int) -> list[dict]:
    """The strongest live stories of the last WINDOW not planned yet; one lead company at most twice."""
    fresh = [s for s in candidates if at - WINDOW <= s["published"] <= at and "planned" not in record(s["slug"])]
    fresh.sort(key=lambda s: (RANK.get(s["kind"], 1), s["published"]), reverse=True)
    chosen, leads = [], {}
    for story in fresh:
        if len(chosen) == count:
            break
        if story["lead"] and leads.get(story["lead"], 0) >= 2:
            continue
        if not reachable(story_url(story["slug"]), "GET"):
            warn(f"{story['slug']} is not live on the site; skipped")
            continue
        chosen.append(story)
        leads[story["lead"]] = leads.get(story["lead"], 0) + 1
    return chosen


# ------------------------------------------------------------------ Buffer
class Buffer:
    def __init__(self, key: str):
        self.key = key

    def call(self, query: str, variables: dict | None = None) -> dict:
        body = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
        request = urllib.request.Request(API, data=body, method="POST", headers={
            "Authorization": f"Bearer {self.key}", "Content-Type": "application/json", "User-Agent": AGENT})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read())
        except urllib.error.HTTPError as error:
            detail = error.read()[:300].decode("utf-8", "replace")
            raise RuntimeError(f"Buffer API returned HTTP {error.code}: {detail}") from None
        if payload.get("errors"):
            raise RuntimeError("Buffer API error: " + "; ".join(e.get("message", "?") for e in payload["errors"]))
        return payload["data"]

    def channels(self) -> list[dict]:
        orgs = self.call("query { account { organizations { id name } } }")["account"]["organizations"]
        found = []
        for org in orgs:
            found += self.call("""
              query($org: OrganizationId!) {
                channels(input: { organizationId: $org }) {
                  id name displayName service isDisconnected isLocked isQueuePaused
                  metadata {
                    ... on PinterestMetadata { boards { serviceId name } }
                    ... on MastodonMetadata { maxCharacters }
                  }
                }
              }""", {"org": org["id"]})["channels"]
            for channel in found:
                channel.setdefault("organizationId", org["id"])
        return found

    def create(self, post: dict) -> tuple[str | None, str | None]:
        data = self.call("""
          mutation($input: CreatePostInput!) {
            createPost(input: $input) {
              ... on PostActionSuccess { post { id } }
              ... on MutationError { message }
            }
          }""", {"input": post})["createPost"]
        return (data["post"]["id"], None) if "post" in data else (None, data.get("message", "unknown error"))

    def delete(self, post_id: str) -> str | None:
        data = self.call("""
          mutation($input: DeletePostInput!) {
            deletePost(input: $input) {
              ... on DeletePostSuccess { id }
              ... on MutationError { message }
            }
          }""", {"input": {"id": post_id}})["deletePost"]
        return None if "id" in data else data.get("message", "unknown error")


# ------------------------------------------------------------------ posts
def board(channel: dict) -> str | None:
    boards = (channel.get("metadata") or {}).get("boards") or []
    wanted = os.environ.get("PINTEREST_BOARD", "").strip().lower()
    for b in boards:
        if wanted and wanted in (b["serviceId"].lower(), b["name"].lower()):
            return b["serviceId"]
    if not wanted:
        for b in boards:
            if re.search(r"s3dat|news", b["name"], re.IGNORECASE):
                return b["serviceId"]
    warn("no Pinterest board for S3DAT News (boards: " + ", ".join(b["name"] for b in boards) + "); set PINTEREST_BOARD")
    return None


def build(channel: dict, story: dict, group: str, due: dt.datetime | None = None) -> dict | None:
    """The createPost input for one channel, or None when the channel is not in the group."""
    service, social, slug = channel["service"], story["social"], story["slug"]
    url, tags = story_url(slug), [t for t in social.get("hashtags", []) if isinstance(t, str)]
    short, long = social["short"].strip(), social["long"].strip()
    label = os.environ.get("SOCIAL_AI_LABEL", "1") != "0"
    shape = "wide" if service in WIDE else "tall" if service in TALL else None
    if shape is None or service not in GROUPS[group]:
        return None
    video = {"url": media_url(slug, shape)}
    if service in ("instagram", "pinterest", "tiktok"):
        video["metadata"] = {"thumbnailOffset": THUMB_MS}
    post = {"channelId": channel["id"], "schedulingType": "automatic", "mode": "shareNow", "needsApproval": False,
            "assets": [{"video": video}]}
    if due:
        post["mode"], post["dueAt"] = "customScheduled", iso(due)
    hashtags = " ".join("#" + t for t in tags)
    if service == "twitter":
        # X ranks posts with links lower: the text carries the news, no link.
        post["text"] = short
    elif service in ("threads", "bluesky"):
        post["text"] = f"{short}\n\n{url}"
        if service == "bluesky" and len(post["text"]) > 300:
            # Bluesky allows 300 characters; validate.py keeps new stories within it.
            post["text"] = short
        if service == "threads" and tags:
            post["metadata"] = {"threads": {"topic": tags[0][:50]}}
    elif service == "mastodon":
        post["text"] = f"{short}\n\n{url}" + (f"\n\n{hashtags}" if hashtags else "")
        limit = (channel.get("metadata") or {}).get("maxCharacters") or 500
        if len(short) + 2 + 23 + (len(hashtags) + 2 if hashtags else 0) > limit:
            post["text"] = f"{short}\n\n{url}"
    elif service == "substack":
        post["text"] = f"{long}\n\n{url}"
    elif service == "facebook":
        # Links in reel captions are not clickable; the first comment carries it.
        post["text"] = long
        post["metadata"] = {"facebook": {"type": "reel", "firstComment": f"Full story: {url}"}}
    elif service == "instagram":
        post["text"] = long + (f"\n\n{hashtags}" if hashtags else "")
        post["metadata"] = {"instagram": {"type": "reel", "shouldShareToFeed": True, "isAiGenerated": label}}
    elif service == "linkedin":
        post["text"] = long
        post["metadata"] = {"linkedin": {"firstComment": f"Full story: {url}"}}
    elif service == "pinterest":
        board_id = board(channel)
        if not board_id:
            return None
        post["text"] = short
        post["metadata"] = {"pinterest": {"title": story["title"][:100], "url": url, "boardServiceId": board_id}}
    elif service == "youtube":
        post["text"] = f"{long}\n\n{url}"
        post["metadata"] = {"youtube": {"title": story["title"][:100], "categoryId": "25", "privacy": "public",
                                        "madeForKids": False, "isAiGenerated": label}}
    elif service == "tiktok":
        post["text"] = short + (f"\n\n{hashtags}" if hashtags else "")
    return post


# ------------------------------------------------------------------ records
def record(slug: str) -> dict:
    try:
        data = json.loads((RECORDS / f"{slug}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def save_record(slug: str, data: dict) -> None:
    RECORDS.mkdir(parents=True, exist_ok=True)
    (RECORDS / f"{slug}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# ------------------------------------------------------------------ main
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--story", metavar="SLUG", help="post this story")
    parser.add_argument("--group", choices=sorted(GROUPS), help="now (16:9 at publishing) or planned (scheduled)")
    parser.add_argument("--at", metavar="ISO-TIME", help="with --group planned: when Buffer posts it")
    parser.add_argument("--select", action="store_true", help="print tonight's stories to plan as JSON")
    parser.add_argument("--count", type=int, default=len(SLOTS), help="with --select: how many (default 5)")
    parser.add_argument("--cancel", metavar="SLUG", help="delete the story's Buffer posts")
    parser.add_argument("--dry-run", action="store_true", help="print the posts, send nothing, record nothing")
    parser.add_argument("--offline", action="store_true", help="with --dry-run: sample channels, no API key")
    parser.add_argument("--force", action="store_true", help="post even if the story already went to this group")
    parser.add_argument("--channels", action="store_true", help="list channels and Pinterest boards, read-only")
    args = parser.parse_args()
    at = now()
    candidates = stories()

    if args.select:
        times = slots(at)
        chosen = select(candidates, at, min(args.count, len(times)))
        print(json.dumps([{"slug": s["slug"], "folder": s["folder"], "kind": s["kind"], "at": iso(t)}
                          for s, t in zip(chosen, times)], indent=2))
        return 0

    key = os.environ.get("BUFFER_API_KEY", "")
    if not key and not (args.dry_run and args.offline):
        print("BUFFER_API_KEY is required", file=sys.stderr)
        return 1
    buffer = Buffer(key) if key else None
    if args.channels:
        for c in buffer.channels():
            state_note = "disconnected" if c.get("isDisconnected") else "locked" if c.get("isLocked") else "paused" if c.get("isQueuePaused") else "ok"
            print(f"{c['service']:<10} {c.get('displayName') or c['name']:<24} {state_note}")
            if c["service"] == "pinterest":
                boards = (c.get("metadata") or {}).get("boards") or []
                print("           boards: " + (", ".join(b["name"] for b in boards) or "none"))
                if boards:
                    print("           posting to: " + str(next((b["name"] for b in boards if b["serviceId"] == board(c)), None)))
        return 0

    if args.cancel:
        data, failed = record(args.cancel), 0
        for group, entry in data.items():
            for name, result in (entry.get("results") or {}).items():
                if not result.get("id"):
                    continue
                error = buffer.delete(result["id"])
                print(f"  {'FAIL' if error else 'deleted'} {group} {name}" + (f": {error}" if error else ""))
                failed += bool(error)
        if not data:
            print(f"{args.cancel}: no recorded posts in {RECORDS}")
        return 1 if failed else 0

    group = args.group or "now"
    due = parse_time(args.at) if args.at else None
    if group == "planned" and not args.offline and (not due or due <= at):
        parser.error("--group planned needs --at with a future ISO time")
    if args.story:
        story = next((s for s in candidates if s["slug"] == args.story), None)
        if not story:
            print(f"{args.story}: no story with a social block", file=sys.stderr)
            return 1
        if group in record(story["slug"]) and not args.force:
            print(f"{story['slug']} already went to the {group} group; use --force to post it again")
            return 0
    elif args.dry_run and args.offline:
        story = max(candidates, key=lambda s: s["published"], default=None)
        if not story:
            print("No story with a social block yet.")
            return 0
    else:
        parser.error("use --story SLUG, --select, --cancel SLUG or --channels")
    shapes = ("wide",) if group == "now" else ("wide", "tall")
    if not args.offline and not media_ready(story["slug"], shapes):
        print(f"{story['slug']}: the {'/'.join(shapes)} cut is not reachable on {SITE}", file=sys.stderr)
        return 1

    if args.offline:
        channels = [{"id": f"sample-{s}", "service": s, "name": s, "metadata": {"boards": [{"serviceId": "b1", "name": "S3DAT News"}]}}
                    for s in sorted(WIDE | TALL)]
    else:
        channels = buffer.channels()
    results, failed = {}, 0
    when = f"for {iso(due)}" if due else "now"
    print(f"Posting {story['slug']} ({story['kind']}, published {iso(story['published'])}) to the {group} group {when}")
    for channel in channels:
        name = f"{channel['service']}:{channel.get('displayName') or channel['name']}"
        if channel["service"] not in GROUPS[group]:
            continue
        if channel.get("isDisconnected") or channel.get("isLocked") or channel.get("isQueuePaused"):
            warn(f"{name} is disconnected, locked or paused; skipped")
            continue
        post = build(channel, story, group, due)
        if post is None:
            print(f"  skip {name}")
            continue
        if args.dry_run:
            print(f"\n--- {name}\n{json.dumps(post, indent=2, ensure_ascii=False)}")
            continue
        try:
            post_id, error = buffer.create(post)
        except RuntimeError as exc:
            post_id, error = None, str(exc)
        results[name] = {"id": post_id, "error": error}
        print(f"  {'ok  ' if post_id else 'FAIL'} {name}" + (f": {error}" if error else ""))
        if error:
            warn(f"{story['slug']} on {name}: {error}")
            failed += 1
    if args.dry_run:
        return 0
    if not any(r["id"] for r in results.values()):
        # Nothing went out (rate limit, outage): nothing is recorded, so a later run can try again.
        return 1
    data = record(story["slug"])
    data[group] = {"at": iso(at), **({"dueAt": iso(due)} if due else {}), "results": results}
    save_record(story["slug"], data)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
