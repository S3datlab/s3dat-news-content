#!/usr/bin/env python3
"""Collect the comments on our Mastodon and Bluesky posts and bring each one to Sedat with a
draft reply (SOCIAL.md, Replies). Nothing here ever posts a reply.

  python scripts/replies.py            collect new comments, open and update their GitHub issues
                                       (.github/workflows/replies.yml: hourly, and on every push
                                       to replies/)
  python scripts/replies.py --check    check the drafts in replies/drafts (Makima runs this before
                                       she commits one)
  python scripts/replies.py --dry-run  collect and print; write nothing, open no issues

A comment is a post by someone else that answers one of ours, anywhere in the threads of our
posts from the last seven days. Each one is written once to replies/inbox/<platform>-<id>.json,
with the conversation above it and the story it belongs to. Makima answers it in
replies/drafts/<the same name>: {"draft": "...", "note": "..."} or {"skip": "reason"}.

Every comment gets an issue labelled "reply" (assigned to REPLY_ASSIGNEE): the comment, our post
and the story; the draft follows as an issue comment. Sedat posts the reply from Buffer's
Community tab, and once our reply shows up the issue closes itself. A skipped comment's issue is
closed as not planned; reopen it to answer anyway. Mastodon and Bluesky are read from their
public APIs, without keys; the other channels' comments are in Buffer only.

The issues need GITHUB_TOKEN and GITHUB_REPOSITORY (both set in GitHub Actions).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from validate import BAIT_RE, BANNED_RE, EMOJI  # noqa: E402  (the house style, shared)

INBOX = ROOT / "replies" / "inbox"
DRAFTS = ROOT / "replies" / "drafts"
AGENT = "S3DAT-News-Replies/1.0 (+https://news.s3dat.com/about)"
MASTODON = os.environ.get("MASTODON_ACCOUNT") or "s3dat@mastodon.social"
BLUESKY = os.environ.get("BLUESKY_HANDLE") or "s3datlab.bsky.social"
BLUESKY_API = "https://public.api.bsky.app/xrpc"
WINDOW = dt.timedelta(days=7)  # how old a post of ours can be for its comments to be collected
# Mastodon allows 500 characters and counts a link as 23; Bluesky 300. A Mastodon reply leaves
# room for the @mention of the person it answers.
LIMITS = {"mastodon": 500, "bluesky": 300}
NAMES = {"mastodon": "Mastodon", "bluesky": "Bluesky"}
LABEL = "reply"
STORY_LINK = re.compile(r"news\.s3dat\.com/stories/([a-z0-9]+(?:-[a-z0-9]+)*)")
MARKER = re.compile(r"<!-- (reply|draft|skip):?([\w.-]*) -->")
# Stock openers that make a reply read like a help desk.
OPENER = re.compile(r"^\s*(?:(?:great|good|excellent|interesting|fair) (?:question|point)|thanks? (?:you )?for"
                    r"|thank you|appreciate)", re.IGNORECASE)


def now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_time(value) -> dt.datetime | None:
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except ValueError:
        return None


def iso(moment: dt.datetime) -> str:
    return moment.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def warn(message: str) -> None:
    print(f"::warning::{message}" if os.environ.get("GITHUB_ACTIONS") else f"WARNING {message}")


def get(url: str, params: dict | None = None) -> dict | list:
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            if error.code < 500 and error.code != 429:
                raise RuntimeError(f"{url.split('?')[0]} returned HTTP {error.code}") from None
            failure = error
        except (urllib.error.URLError, OSError) as error:
            failure = error
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"{url.split('?')[0]}: {failure}")


def plain(markup: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", markup)
    text = re.sub(r"</p>\s*<p>", "\n\n", text)
    return html.unescape(re.sub(r"<[^>]+>", "", text)).strip()


def story_of(*posts) -> str | None:
    for post in posts:
        found = STORY_LINK.search(json.dumps(post))
        if found:
            return found.group(1)
    return None


def story_title(slug: str | None) -> str | None:
    for path in (ROOT / "stories").glob(f"*/*/*/{slug}/story.json") if slug else ():
        try:
            return json.loads(path.read_text(encoding="utf-8")).get("title")
        except (OSError, ValueError):
            return None
    return None


def length(text: str, platform: str) -> int:
    if platform == "mastodon":
        text = re.sub(r"https?://\S+", "x" * 23, text)
    return len(text)


# ------------------------------------------------------------------ the networks
# Each reader returns the comments it found and {comment key: url of our reply} for the comments
# we have already answered.
def mastodon() -> tuple[list[dict], dict[str, str]]:
    user, host = MASTODON.split("@")
    base = f"https://{host}/api/v1"
    me = get(f"{base}/accounts/lookup", {"acct": user})["id"]
    since, roots, max_id = now() - WINDOW, [], None
    while True:
        params = {"limit": 40, "exclude_replies": "true", "exclude_reblogs": "true"}
        if max_id:
            params["max_id"] = max_id
        page = get(f"{base}/accounts/{me}/statuses", params)
        fresh = [s for s in page if (parse_time(s["created_at"]) or since) >= since]
        roots += fresh
        if len(fresh) < len(page) or not page:
            break
        max_id = page[-1]["id"]
    comments, answered = [], {}
    for root in roots:
        if not root.get("replies_count"):
            continue
        statuses = {root["id"]: root}
        for status in get(f"{base}/statuses/{root['id']}/context")["descendants"]:
            statuses[status["id"]] = status
        for status in statuses.values():
            parent = statuses.get(status.get("in_reply_to_id"))
            if not parent:
                continue
            mine, to_us = status["account"]["id"] == me, parent["account"]["id"] == me
            if mine and not to_us:
                answered[f"mastodon-{parent['id']}"] = status["url"]
            if mine or not to_us:
                continue
            chain, step = [], parent
            while step:
                chain.insert(0, step)
                step = statuses.get(step.get("in_reply_to_id"))
            author = status["account"]["acct"]
            comments.append({
                "platform": "mastodon", "id": status["id"], "url": status["url"], "author": author,
                "name": status["account"].get("display_name") or author, "at": iso(parse_time(status["created_at"])),
                "text": plain(status["content"]),
                "story": story_of(*[s for s in chain if s["account"]["id"] == me]),
                "thread": [{"author": s["account"]["acct"], "ours": s["account"]["id"] == me, "url": s["url"],
                            "text": plain(s["content"])} for s in chain],
                "limit": LIMITS["mastodon"] - len(author.split("@")[0]) - 2,
            })
    return comments, answered


def bluesky() -> tuple[list[dict], dict[str, str]]:
    me = get(f"{BLUESKY_API}/app.bsky.actor.getProfile", {"actor": BLUESKY})["did"]
    since, roots, cursor = now() - WINDOW, [], None
    while True:
        params = {"actor": me, "limit": 50, "filter": "posts_no_replies"}
        if cursor:
            params["cursor"] = cursor
        page = get(f"{BLUESKY_API}/app.bsky.feed.getAuthorFeed", params)
        old = False
        for item in page.get("feed", []):
            post = item["post"]
            if item.get("reason") or post["author"]["did"] != me:  # reposts and the pinned post
                continue
            if (parse_time(post["record"].get("createdAt")) or since) < since:
                old = True
                break
            roots.append(post)
        cursor = page.get("cursor")
        if old or not cursor:
            break

    def link(post: dict) -> str:
        return f"https://bsky.app/profile/{post['author']['handle']}/post/{post['uri'].rsplit('/', 1)[1]}"

    comments, answered = [], {}

    def walk(node: dict, chain: list[dict]) -> None:
        parent = node["post"]
        chain = chain + [parent]
        for reply in node.get("replies") or []:
            post = reply.get("post")
            if not post:  # deleted or blocked
                continue
            mine, to_us = post["author"]["did"] == me, parent["author"]["did"] == me
            if mine and not to_us:
                answered[f"bluesky-{parent['uri'].rsplit('/', 1)[1]}"] = link(post)
            if not mine and to_us:
                author = post["author"]["handle"]
                at = parse_time(post["record"].get("createdAt")) or parse_time(post.get("indexedAt")) or now()
                comments.append({
                    "platform": "bluesky", "id": post["uri"].rsplit("/", 1)[1], "url": link(post), "author": author,
                    "name": post["author"].get("displayName") or author, "at": iso(at),
                    "text": post["record"].get("text", "").strip(),
                    "story": story_of(*[p["record"] for p in chain if p["author"]["did"] == me]),
                    "thread": [{"author": p["author"]["handle"], "ours": p["author"]["did"] == me, "url": link(p),
                                "text": p["record"].get("text", "").strip()} for p in chain],
                    "limit": LIMITS["bluesky"],
                })
            walk(reply, chain)

    for root in roots:
        if root.get("replyCount"):
            walk(get(f"{BLUESKY_API}/app.bsky.feed.getPostThread",
                     {"uri": root["uri"], "depth": 20, "parentHeight": 0})["thread"], [])
    return comments, answered


def collect(dry_run: bool) -> dict[str, str]:
    found, answered = [], {}
    for name, reader in (("Mastodon", mastodon), ("Bluesky", bluesky)):
        try:
            comments, done = reader()
        except (RuntimeError, KeyError, ValueError) as error:  # one network down must not stop the other
            warn(f"{name}: {error}")
            continue
        found += comments
        answered.update(done)
    for comment in found:
        key = f"{comment['platform']}-{comment['id']}"
        path = INBOX / f"{key}.json"
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if answered.get(key) and not data.get("answered"):
                data["answered"] = answered[key]
                if not dry_run:
                    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            continue
        comment["answered"] = answered.get(key)
        comment["collected"] = iso(now())
        state = "already answered" if comment["answered"] else "new"
        print(f"{NAMES[comment['platform']]} @{comment['author']} ({state}): {comment['text'][:100]}")
        if not dry_run:
            INBOX.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(comment, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return answered


# ------------------------------------------------------------------ drafts
def problems(draft: object, comment: dict) -> list[str]:
    if not isinstance(draft, dict):
        return ["must be a JSON object"]
    found = [f'unknown field "{k}"' for k in draft if k not in ("draft", "skip", "note")]
    text, skip, note = draft.get("draft"), draft.get("skip"), draft.get("note")
    if (text is None) == (skip is None):
        return found + ['needs exactly one of "draft" and "skip"']
    if note is not None and not isinstance(note, str):
        found.append('"note" must be text')
    if skip is not None:
        if not isinstance(skip, str) or not 3 <= len(skip.strip()) <= 200:
            found.append('"skip" must give the reason in up to 200 characters')
        return found
    if not isinstance(text, str) or not text.strip():
        return found + ['"draft" must be text']
    size, limit = length(text, comment.get("platform", "")), comment.get("limit", 300)
    if size > limit:
        found.append(f"{size} characters, the limit is {limit}")
    if text.lstrip().startswith("@"):
        found.append("starts with a mention; Buffer adds the @mention when Sedat replies")
    if OPENER.search(text):
        found.append("opens with a stock phrase; answer first")
    if "!" in text or EMOJI.search(text):
        found.append('no "!" or emoji')
    if re.search(r"(?<![\w/])#[A-Za-z]", text):
        found.append("no hashtags in a reply")
    if len(re.findall(r"https?://", text)) > 1:
        found.append("one link at most, the source that answers the question")
    for pattern, what in ((BAIT_RE, "engagement bait"), (BANNED_RE, "house-style phrase")):
        match = pattern.search(text)
        if match:
            found.append(f'{what} "{match.group(0)}"')
    return found


def check() -> int:
    errors = []
    for path in sorted(DRAFTS.glob("*.json")):
        inbox = INBOX / path.name
        if not inbox.exists():
            errors.append(f"{path.name}: no comment at replies/inbox/{path.name}")
            continue
        try:
            draft = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as error:
            errors.append(f"{path.name}: not valid JSON ({error})")
            continue
        errors += [f"{path.name}: {p}" for p in problems(draft, json.loads(inbox.read_text(encoding="utf-8")))]
    for line in errors:
        print(line)
    print(f"{len(list(DRAFTS.glob('*.json')))} drafts checked, {len(errors)} problems")
    return 1 if errors else 0


# ------------------------------------------------------------------ GitHub issues
class GitHub:
    def __init__(self, token: str, repo: str):
        self.token, self.repo = token, repo

    def call(self, method: str, path: str, body: dict | None = None):
        request = urllib.request.Request(
            f"https://api.github.com/repos/{self.repo}{path}", method=method,
            data=json.dumps(body).encode("utf-8") if body is not None else None,
            headers={"Authorization": f"Bearer {self.token}", "Accept": "application/vnd.github+json",
                     "X-GitHub-Api-Version": "2022-11-28", "User-Agent": AGENT})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read() or b"null")
        except urllib.error.HTTPError as error:
            detail = error.read()[:300].decode("utf-8", "replace")
            raise RuntimeError(f"GitHub {method} {path} returned HTTP {error.code}: {detail}") from None

    def issues(self) -> dict[str, dict]:
        found, page = {}, 1
        while True:
            batch = self.call("GET", f"/issues?labels={LABEL}&state=all&per_page=100&page={page}")
            for issue in batch:
                marker = MARKER.search(issue.get("body") or "")
                if marker and marker.group(1) == "reply":
                    found[marker.group(2)] = issue
            if len(batch) < 100:
                return found
            page += 1

    def markers(self, number: int) -> set[str]:
        found, page = set(), 1
        while True:
            batch = self.call("GET", f"/issues/{number}/comments?per_page=100&page={page}")
            for comment in batch:
                found |= {f"{m.group(1)}:{m.group(2)}".rstrip(":") for m in MARKER.finditer(comment.get("body") or "")}
            if len(batch) < 100:
                return found
            page += 1

    def label(self) -> None:
        try:
            self.call("POST", "/labels", {"name": LABEL, "color": "17b38a", "description": "A comment waiting for our reply"})
        except RuntimeError as error:
            if "HTTP 422" not in str(error):  # 422: it already exists
                raise


def safe(text: str) -> str:
    # Handles in someone's comment must not @mention GitHub users of the same name.
    return text.replace("@", "@\u200b")


def quote(text: str) -> str:
    return "\n".join("> " + line if line else ">" for line in safe(text).splitlines())


def when(value: str) -> str:
    moment = parse_time(value)
    return f"{moment.day} {moment:%b %Y, %H:%M} UTC" if moment else value


def issue_text(key: str, comment: dict) -> tuple[str, str]:
    network, title = NAMES[comment["platform"]], story_title(comment.get("story"))
    lines = [f"<!-- reply:{key} -->",
             f"`@{comment['author']}` replied on {network}, {when(comment['at'])} ([open]({comment['url']})):", "",
             quote(comment["text"]), "", "Above it:", ""]
    for post in comment["thread"]:
        lines += [f"{'**S3DAT**' if post['ours'] else '`@' + post['author'] + '`'} ([open]({post['url']})):", quote(post["text"]), ""]
    if comment.get("story"):
        lines.append(f"Story: https://news.s3dat.com/stories/{comment['story']}")
    lines += ["", f"Makima drafts the reply in her next run (`replies/drafts/{key}.json`); it appears below. "
              "Post the text you approve from Buffer's Community tab: this issue closes itself once our reply "
              "shows up."]
    return f"{network} · {comment['author']} · {title or comment['thread'][0]['text']}"[:120], "\n".join(lines)


def issues(answered: dict[str, str]) -> None:
    token, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        print("GITHUB_TOKEN or GITHUB_REPOSITORY is not set; no issues opened.")
        return
    github, assignee = GitHub(token, repo), os.environ.get("REPLY_ASSIGNEE", "").strip()
    known, labelled = github.issues(), False
    for path in sorted(INBOX.glob("*.json")):
        key, comment = path.stem, json.loads(path.read_text(encoding="utf-8"))
        done = comment.get("answered") or answered.get(key)
        issue = known.get(key)
        if not issue:
            if done:  # answered before it reached an issue
                continue
            if not labelled:
                github.label()
                labelled = True
            title, body = issue_text(key, comment)
            issue = github.call("POST", "/issues", {"title": title, "body": body, "labels": [LABEL],
                                                    **({"assignees": [assignee]} if assignee else {})})
            print(f"Opened issue #{issue['number']} for {key}")
        if issue["state"] != "open":
            continue
        number = issue["number"]
        if done:
            github.call("POST", f"/issues/{number}/comments", {"body": f"<!-- answered -->\nAnswered: {done}"})
            github.call("PATCH", f"/issues/{number}", {"state": "closed", "state_reason": "completed"})
            print(f"Closed issue #{number}: answered")
            continue
        draft_path = DRAFTS / path.name
        if not draft_path.exists():
            continue
        try:
            draft = json.loads(draft_path.read_text(encoding="utf-8"))
        except ValueError:
            warn(f"{draft_path.name} is not valid JSON")
            continue
        found, seen = problems(draft, comment), github.markers(number)
        if isinstance(draft, dict) and isinstance(draft.get("skip"), str):
            if "skip" not in seen:
                github.call("POST", f"/issues/{number}/comments", {"body": "<!-- skip -->\nMakima suggests no reply: "
                            f"{safe(draft['skip'])}\n\nReopen this issue to answer anyway."})
                github.call("PATCH", f"/issues/{number}", {"state": "closed", "state_reason": "not_planned"})
                print(f"Closed issue #{number}: skipped")
            continue
        text = draft.get("draft") if isinstance(draft, dict) else None
        if not isinstance(text, str):
            warn(f"{draft_path.name}: " + "; ".join(found))
            continue
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:10]
        if f"draft:{digest}" in seen:
            continue
        body = [f"<!-- draft:{digest} -->",
                f"Draft reply ({length(text, comment['platform'])} of {comment['limit']} characters):", "",
                "````text", text.strip(), "````"]
        if isinstance(draft.get("note"), str) and draft["note"].strip():
            body += ["", f"Makima's note: {safe(draft['note'].strip())}"]
        if found:
            body += ["", "Problems: " + "; ".join(found) + "."]
        github.call("POST", f"/issues/{number}/comments", {"body": "\n".join(body)})
        print(f"Posted the draft to issue #{number}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="check the drafts, collect nothing")
    parser.add_argument("--dry-run", action="store_true", help="collect and print; write nothing")
    args = parser.parse_args()
    if args.check:
        return check()
    answered = collect(args.dry_run)
    if not args.dry_run:
        issues(answered)
    return 0


if __name__ == "__main__":
    sys.exit(main())
