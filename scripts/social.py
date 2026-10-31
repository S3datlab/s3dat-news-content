#!/usr/bin/env python3
"""Post one story to every connected Buffer channel; .github/workflows/social.yml runs it five
times a day, five hours apart (SOCIAL.md).

  python scripts/social.py --pick      choose the story; writes slug=, folder= and release= (the
                                       GitHub release holding Makima's cuts) to $GITHUB_OUTPUT
  (the workflow then fetches or renders its two social cuts and uploads them)
  python scripts/social.py --story SLUG [--dry-run] [--force]
                                       post it now and record it in social/state.json
  python scripts/social.py --dry-run --offline
                                       print the posts for sample channels, no API key

--pick reports publishing errors Buffer recorded for the previous post, then picks the
strongest story published in the last 12 hours that has not been posted, has a social block
and is live on news.s3dat.com: analysis first, then story and explained, then brief; newest
first; not the same lead company as the previous post when there is a choice. It picks nothing
within three hours of the last post, so a delayed or repeated run cannot post twice.

Posting goes through the Buffer GraphQL API:
  16:9 cut  X (no link), Threads, Bluesky, Mastodon, Substack
  9:16 cut  Facebook and Instagram reels, LinkedIn, Pinterest, and YouTube or TikTok if connected

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
STATE = ROOT / "social" / "state.json"
SITE = "https://news.s3dat.com"
API = "https://api.buffer.com"
AGENT = "S3DAT-News-Social/1.0 (+https://news.s3dat.com/about)"
MIN_GAP = dt.timedelta(hours=3)
WINDOW = dt.timedelta(hours=12)
RANK = {"analysis": 3, "story": 2, "explained": 2, "brief": 1}
WIDE = {"twitter", "threads", "bluesky", "mastodon", "substack"}
TALL = {"facebook", "instagram", "linkedin", "pinterest", "youtube", "tiktok"}
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


def release_tag(published: dt.datetime) -> str:
    """Makima uploads a story's social cuts to this GitHub release (SOCIAL.md)."""
    return "social-" + published.astimezone(dt.timezone.utc).strftime("%Y-%m-%d")


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


def media_ready(slug: str, tries: int = 4) -> bool:
    for attempt in range(tries):
        if reachable(media_url(slug, "wide")) and reachable(media_url(slug, "tall")):
            return True
        time.sleep(10 * (attempt + 1))
    return False


def pick(candidates: list[dict], state: dict, at: dt.datetime) -> dict | None:
    posted = {p["slug"] for p in state["posts"]}
    last_lead = state["posts"][-1].get("lead", "") if state["posts"] else ""
    fresh = [s for s in candidates if s["slug"] not in posted and at - WINDOW <= s["published"] <= at]
    fresh.sort(key=lambda s: (RANK.get(s["kind"], 1), s["published"]), reverse=True)
    # Same lead company as the previous post goes to the back of the line.
    fresh.sort(key=lambda s: bool(last_lead) and s["lead"] == last_lead)
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

    def errors_since(self, org: str, since: dt.datetime) -> list[dict]:
        data = self.call("""
          query($org: OrganizationId!, $since: DateTime!) {
            posts(first: 50, input: { organizationId: $org, filter: { status: [error], createdAt: { start: $since } } }) {
              edges { node { id channelService error { message } } }
            }
          }""", {"org": org, "since": iso(since)})
        return [e["node"] for e in data["posts"]["edges"]]


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


def build(channel: dict, story: dict) -> dict | None:
    """The createPost input for one channel, or None when the channel is skipped."""
    service, social, slug = channel["service"], story["social"], story["slug"]
    url, tags = story_url(slug), [t for t in social.get("hashtags", []) if isinstance(t, str)]
    short, long = social["short"].strip(), social["long"].strip()
    label = os.environ.get("SOCIAL_AI_LABEL", "1") != "0"
    shape = "wide" if service in WIDE else "tall" if service in TALL else None
    if shape is None:
        return None
    video = {"url": media_url(slug, shape)}
    if service in ("instagram", "pinterest", "tiktok"):
        video["metadata"] = {"thumbnailOffset": THUMB_MS}
    post = {"channelId": channel["id"], "schedulingType": "automatic", "mode": "shareNow", "assets": [{"video": video}]}
    hashtags = " ".join("#" + t for t in tags)
    if service == "twitter":
        # X ranks posts with links lower: the text carries the news, no link.
        post["text"] = short
    elif service in ("threads", "bluesky"):
        post["text"] = f"{short}\n\n{url}"
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


# ------------------------------------------------------------------ state
def load_state() -> dict:
    try:
        state = json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    state.setdefault("lastPostAt", None)
    state.setdefault("posts", [])
    return state


def save_state(state: dict) -> None:
    state["posts"] = state["posts"][-300:]
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def check_previous(buffer: Buffer, state: dict, at: dt.datetime) -> int:
    """Report errors Buffer recorded for the last post once it has had time to go out."""
    if not state["posts"]:
        return 0
    last = state["posts"][-1]
    sent = parse_time(last.get("at"))
    if last.get("checked") or not sent or at - sent < dt.timedelta(minutes=15) or not last.get("organizations"):
        return 0
    problems = []
    ids = {r.get("id") for r in last.get("results", {}).values()}
    for org in last["organizations"]:
        problems += [p for p in buffer.errors_since(org, sent - dt.timedelta(minutes=2)) if p["id"] in ids]
    last["checked"] = True
    last["publishErrors"] = [{"service": p["channelService"], "message": (p.get("error") or {}).get("message", "")} for p in problems]
    for p in last["publishErrors"]:
        warn(f"{last['slug']} failed on {p['service']}: {p['message']}")
    return len(problems)


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
    parser.add_argument("--pick", action="store_true", help="choose the next story for the workflow")
    parser.add_argument("--story", metavar="SLUG", help="post this story")
    parser.add_argument("--dry-run", action="store_true", help="print the posts, send nothing, keep the state")
    parser.add_argument("--offline", action="store_true", help="with --dry-run: sample channels, no API key")
    parser.add_argument("--force", action="store_true", help="ignore the three-hour guard and earlier posts")
    args = parser.parse_args()
    at = now()
    state = load_state()
    key = os.environ.get("BUFFER_API_KEY", "")
    if not key and not (args.dry_run and args.offline):
        print("BUFFER_API_KEY is required", file=sys.stderr)
        return 1
    buffer = Buffer(key) if key else None
    candidates = stories()

    if args.pick:
        failed = check_previous(buffer, state, at) if buffer else 0
        if failed:
            save_state(state)
        last = parse_time(state["lastPostAt"]) if state["lastPostAt"] else None
        if last and at - last < MIN_GAP and not args.force:
            print(f"Last post at {iso(last)}, less than {MIN_GAP} ago; nothing picked.")
            output(slug="", folder="", release="")
            return 0
        story = pick(candidates, state, at)
        if not story:
            print("No fresh story to post.")
            output(slug="", folder="", release="")
            return 0
        print(f"Picked {story['slug']} ({story['kind']}, published {iso(story['published'])})")
        output(slug=story["slug"], folder=story["folder"], release=release_tag(story["published"]))
        return 0

    if args.story:
        story = next((s for s in candidates if s["slug"] == args.story), None)
        if not story:
            print(f"{args.story}: no story with a social block", file=sys.stderr)
            return 1
        if any(p["slug"] == story["slug"] for p in state["posts"]) and not args.force:
            print(f"{story['slug']} was already posted; use --force to post it again", file=sys.stderr)
            return 1
    elif args.dry_run and args.offline:
        story = max(candidates, key=lambda s: s["published"], default=None)
        if not story:
            print("No story with a social block yet.")
            return 0
    else:
        parser.error("use --pick or --story SLUG")
    if not args.offline and not media_ready(story["slug"]):
        print(f"{story['slug']}: the social cuts are not reachable on {SITE}", file=sys.stderr)
        return 1

    if args.offline:
        channels = [{"id": f"sample-{s}", "service": s, "name": s, "metadata": {"boards": [{"serviceId": "b1", "name": "S3DAT News"}]}}
                    for s in sorted(WIDE | TALL)]
    else:
        channels = buffer.channels()
    results, organizations = {}, sorted({c.get("organizationId") for c in channels if c.get("organizationId")})
    failed = 0
    print(f"Posting {story['slug']} ({story['kind']}, published {iso(story['published'])})")
    for channel in channels:
        name = f"{channel['service']}:{channel.get('displayName') or channel['name']}"
        if channel.get("isDisconnected") or channel.get("isLocked") or channel.get("isQueuePaused"):
            warn(f"{name} is disconnected, locked or paused; skipped")
            continue
        post = build(channel, story)
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
        # Nothing went out (rate limit, outage): the next slot picks again.
        return 1
    state["lastPostAt"] = iso(at)
    state["posts"].append({"slug": story["slug"], "lead": story["lead"], "at": iso(at), "organizations": organizations,
                           "results": results, "checked": False})
    save_state(state)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
