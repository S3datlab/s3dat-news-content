#!/usr/bin/env python3
"""Post a story to the Buffer channels in two groups (SOCIAL.md).

  now   X, Threads, Bluesky, Mastodon, Facebook, LinkedIn, Pinterest and Substack: the 16:9 cut,
        shared the moment the story is published (.github/workflows/publish.yml)
  reel  Instagram (and YouTube Shorts or TikTok if connected): the 9:16 cut. Four or five times a
        day .github/workflows/reel.yml picks the strongest story and posts it

  python scripts/social.py --story SLUG --group now|reel [--dry-run] [--force]
  python scripts/social.py --pick      choose the story for the next reel; writes slug= and folder=
                                       to $GITHUB_OUTPUT (empty when nothing is worth a video)
  python scripts/social.py --cancel SLUG
                                       delete the story's posts from Buffer (a withdrawn story)
  python scripts/social.py --dry-run --offline [--group now|reel]
                                       print the posts for sample channels, no API key
  python scripts/social.py --channels  list the Buffer channels and Pinterest boards (read-only)

--pick takes the strongest live story of the last 24 hours that has no reel yet, by the writer's
social.priority (1-5; 1 and 2 never get a reel), then analysis before story and explained, then
the newest: priority 4-5 four hours after the last reel, priority 3 only after six, at most five
reels in 24 hours. Each posting is recorded in social/posted/<slug>.json (SOCIAL_RECORDS overrides the
folder), so a story goes to each group once unless --force is given.

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
WINDOW = dt.timedelta(hours=24)  # how far back a reel looks for its story
# Four or five reels a day, the strongest stories only (SOCIAL.md): a priority 4-5 story once the
# last reel is 4 h old, a priority 3 story only after 6 h without one, never more than 5 in 24 h.
REEL_GAP = dt.timedelta(hours=4)
REEL_GAP_SOLID = dt.timedelta(hours=6)
REELS_PER_DAY = 5
RANK = {"analysis": 3, "story": 2, "explained": 2, "brief": 1}
WIDE = {"twitter", "threads", "bluesky", "mastodon", "substack", "facebook", "linkedin", "pinterest"}
TALL = {"instagram", "youtube", "tiktok"}
GROUPS = {"now": WIDE, "reel": TALL}
THUMB_MS = 2500  # a frame where the banner headline is fully on screen
# How many of the story's own hashtags (social.hashtags, most important first) each channel shows.
# Hashtags are discovery on Mastodon, Instagram, TikTok and YouTube; a few help on LinkedIn, X and
# Bluesky; Threads takes one topic instead, and Facebook, Pinterest and Substack ignore them.
TAGS = {"mastodon": 5, "instagram": 5, "tiktok": 5, "youtube": 3, "linkedin": 3, "twitter": 2, "bluesky": 2}
# Character limits for the text (Mastodon reads its own from the channel). X counts 280 for
# accounts without Premium; Bluesky 300.
LIMITS = {"twitter": 280, "bluesky": 300, "threads": 500, "mastodon": 500}


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
        priority = social.get("priority") if type(social.get("priority")) is int else 3
        found.append({"slug": story["slug"], "title": story.get("title", ""), "kind": story.get("kind", "story"), "priority": priority,
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


def reel_times() -> list[dt.datetime]:
    times = []
    for path in RECORDS.glob("*.json"):
        try:
            times.append(parse_time(json.loads(path.read_text(encoding="utf-8")).get("reel", {}).get("at")))
        except (OSError, ValueError, AttributeError):
            continue
    return sorted(t for t in times if t)


def lowest_priority(at: dt.datetime, force: bool = False) -> int | None:
    """The lowest priority a reel may have now, or None when it is too soon for any."""
    times = reel_times()
    if force or not times:
        return 3
    if sum(t > at - WINDOW for t in times) >= REELS_PER_DAY:
        return None
    since = at - times[-1]
    return 3 if since >= REEL_GAP_SOLID else 4 if since >= REEL_GAP else None


def pick(candidates: list[dict], at: dt.datetime, lowest: int = 3) -> dict | None:
    """The live story of the last WINDOW most worth a reel, or None."""
    fresh = [s for s in candidates if at - WINDOW <= s["published"] <= at and s["priority"] >= max(3, lowest) and "reel" not in record(s["slug"])]
    fresh.sort(key=lambda s: (s["priority"], RANK.get(s["kind"], 1), s["published"]), reverse=True)
    for story in fresh:
        if reachable(story_url(story["slug"]), "GET"):
            return story
        warn(f"{story['slug']} is not live on the site; skipped")
    return None


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


def build(channel: dict, story: dict, group: str) -> dict | None:
    """The createPost input for one channel, or None when the channel is not in the group."""
    service, social, slug = channel["service"], story["social"], story["slug"]
    url, tags = story_url(slug), [t for t in social.get("hashtags", []) if isinstance(t, str)]
    short, long = social["short"].strip(), social["long"].strip()
    # The v2 fields (SOCIAL.md): the stake, our position, the facts people save, one real question.
    hook = (social.get("hook") or "").strip()
    take = f"Our read: {social['take'].strip()}" if social.get("take") else ""
    question = (social.get("question") or "").strip()
    facts = [f.strip() for f in social.get("keyFacts") or [] if isinstance(f, str) and f.strip()]
    label = os.environ.get("SOCIAL_AI_LABEL", "1") != "0"
    shape = "wide" if service in WIDE else "tall" if service in TALL else None
    if shape is None or service not in GROUPS[group]:
        return None
    video = {"url": media_url(slug, shape)}
    if service in ("instagram", "pinterest", "tiktok"):
        video["metadata"] = {"thumbnailOffset": THUMB_MS}
    post = {"channelId": channel["id"], "schedulingType": "automatic", "mode": "shareNow", "needsApproval": False,
            "assets": [{"video": video}]}
    hashtags = " ".join("#" + t for t in tags[: TAGS.get(service, 0)])
    read = f"Full story: {url}"
    limit = LIMITS.get(service)
    if service == "mastodon":
        limit = (channel.get("metadata") or {}).get("maxCharacters") or limit

    def fits(text: str) -> bool:
        # Mastodon and X count every link as 23 characters.
        size = len(text) - (len(url) - 23 if service in ("mastodon", "twitter") and url in text else 0)
        return limit is None or size <= limit

    def compose(*required: str, optional: tuple[str, ...] = ()) -> str:
        """The required paragraphs, then each optional one (take, question, link, hashtags) that fits."""
        text = "\n\n".join(p for p in required if p)
        for extra in optional:
            if extra and fits(f"{text}\n\n{extra}" if text else extra):
                text = f"{text}\n\n{extra}" if text else extra
        return text

    def listed(heading: str) -> str:
        """The key facts as a list under a heading, as many lines as fit."""
        text = heading
        for fact in facts:
            if fits(f"{text}\n· {fact}"):
                text = f"{text}\n· {fact}"
        return text if text != heading else ""

    def thread(*texts: str) -> list[dict]:
        """Buffer's thread: the first post carries the video, the replies text only."""
        items = [t for t in texts if t]
        return [{"text": t, "assets": post["assets"] if i == 0 else []} for i, t in enumerate(items)]

    opening = hook if hook and fits(f"{hook}\n\n{short}") else ""
    if service == "twitter":
        # X shows posts with links to fewer people: the news first, the facts people bookmark and
        # our read with the link in the replies.
        first = compose(opening, short, optional=(hashtags,))
        if take:
            post["text"] = first
            post["metadata"] = {"twitter": {"thread": thread(first, listed("Key facts:"), compose(take, optional=(question, read)))}}
        else:
            post["text"] = first
    elif service == "threads":
        # Threads ranks conversations: the question sits in the first post, the link in the reply.
        first = compose(opening, short, optional=(question,))
        post["text"] = first
        meta = {"topic": tags[0][:50]} if tags else {}
        if take:
            meta["thread"] = thread(first, compose(take, read))
        else:
            post["text"] = compose(short, read)
        if meta:
            post["metadata"] = {"threads": meta}
    elif service == "bluesky":
        # validate.py keeps social.short short enough for the bare link; the rest comes if it fits.
        first = compose(short, url, optional=(hashtags,))
        if not fits(first):
            first = short
        post["text"] = first
        if take:
            post["metadata"] = {"bluesky": {"thread": thread(first, compose(take, optional=(question,)))}}
    elif service == "mastodon":
        post["text"] = compose(short, optional=(take, read, hashtags))
    elif service == "substack":
        post["text"] = compose(long, take, read)
    elif service == "facebook":
        # A regular video post (the 16:9 cut), so the link in the text is clickable.
        post["text"] = compose(hook, long, take, question, read)
        post["metadata"] = {"facebook": {"type": "post"}}
    elif service == "instagram":
        # Instagram captions never link: the profile link carries readers to the site. The hook is
        # the line people see before "more".
        post["text"] = compose(hook, long, take, question, "Full story: link in bio.", hashtags)
        post["metadata"] = {"instagram": {"type": "reel", "shouldShareToFeed": True, "isAiGenerated": label}}
    elif service == "linkedin":
        # The link sits in the post (LinkedIn turns it into a clickable lnkd.in link). The hook and
        # the first lines show before "see more"; the list is what people skim.
        post["text"] = compose(hook, long, listed("Key facts:") if facts else "", take, question, read, hashtags)
    elif service == "pinterest":
        board_id = board(channel)
        if not board_id:
            return None
        post["text"] = short
        post["metadata"] = {"pinterest": {"title": story["title"][:100], "url": url, "boardServiceId": board_id}}
    elif service == "youtube":
        # The first three hashtags in the description show above the title.
        post["text"] = compose(long, take, read, hashtags)
        post["metadata"] = {"youtube": {"title": (hook or story["title"])[:100], "categoryId": "25", "privacy": "public",
                                        "madeForKids": False, "isAiGenerated": label}}
    elif service == "tiktok":
        post["text"] = compose(hook, short, question, "Full story: link in bio.", hashtags)
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
def output(**values: str) -> None:
    target = os.environ.get("GITHUB_OUTPUT")
    lines = "".join(f"{k}={v}\n" for k, v in values.items())
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(lines)
    print(lines, end="")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--story", metavar="SLUG", help="post this story")
    parser.add_argument("--group", choices=sorted(GROUPS), help="now (16:9 at publishing) or reel (9:16)")
    parser.add_argument("--pick", action="store_true", help="choose the story for the next reel")
    parser.add_argument("--cancel", metavar="SLUG", help="delete the story's Buffer posts")
    parser.add_argument("--dry-run", action="store_true", help="print the posts, send nothing, record nothing")
    parser.add_argument("--offline", action="store_true", help="with --dry-run: sample channels, no API key")
    parser.add_argument("--force", action="store_true", help="post even if the story already went to this group")
    parser.add_argument("--channels", action="store_true", help="list channels and Pinterest boards, read-only")
    args = parser.parse_args()
    at = now()
    candidates = stories()

    if args.pick:
        lowest = lowest_priority(at, args.force)
        if lowest is None:
            times = reel_times()
            print(f"Last reel at {iso(times[-1])}; {sum(t > at - WINDOW for t in times)} in the last 24 h; nothing picked.")
            output(slug="", folder="")
            return 0
        story = pick(candidates, at, lowest)
        if not story:
            print(f"No story of priority {lowest} or more worth a reel.")
            output(slug="", folder="")
            return 0
        print(f"Picked {story['slug']} ({story['kind']}, priority {story['priority']}, published {iso(story['published'])})")
        output(slug=story["slug"], folder=story["folder"])
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
        parser.error("use --story SLUG, --pick, --cancel SLUG or --channels")
    shape = "wide" if group == "now" else "tall"
    if not args.offline and not media_ready(story["slug"], (shape,)):
        print(f"{story['slug']}: the {shape} cut is not reachable on {SITE}", file=sys.stderr)
        return 1

    if args.offline:
        channels = [{"id": f"sample-{s}", "service": s, "name": s, "metadata": {"boards": [{"serviceId": "b1", "name": "S3DAT News"}]}}
                    for s in sorted(WIDE | TALL)]
    else:
        channels = buffer.channels()
    results, failed = {}, 0
    print(f"Posting {story['slug']} ({story['kind']}, published {iso(story['published'])}) to the {group} group")
    for channel in channels:
        name = f"{channel['service']}:{channel.get('displayName') or channel['name']}"
        if channel["service"] not in GROUPS[group]:
            continue
        if channel.get("isDisconnected") or channel.get("isLocked") or channel.get("isQueuePaused"):
            warn(f"{name} is disconnected, locked or paused; skipped")
            continue
        post = build(channel, story, group)
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
        meta = (post.get("metadata") or {}).get(channel["service"])
        if error and isinstance(meta, dict) and meta.get("thread"):
            # A thread Buffer refuses still goes out as its first post.
            warn(f"{story['slug']} on {name}: the thread failed ({error}); posting the first post alone")
            meta.pop("thread")
            if not meta:
                post.pop("metadata")
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
    data[group] = {"at": iso(at), "results": results}
    save_record(story["slug"], data)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
