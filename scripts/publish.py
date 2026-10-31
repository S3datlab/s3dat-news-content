#!/usr/bin/env python3
"""Publish one validated story, or --withdraw SLUG, using only Python's stdlib.

--social SLUG --wide FILE --tall FILE uploads a published story's social cuts, which Buffer
fetches from news.s3dat.com when scripts/social.py posts them.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

# Shared vector: secret s3dat-test-secret; timestamp 1793404800;
# body b'{"action":"withdraw","slug":"test-story"}'
# HMAC = 67f31d62a1e064ac2128d8e537daf22a524a8652c2a1d7acf798c3a23c53b5cd
def sign(secret: str, timestamp: str, body: bytes) -> str:
    message = f"{timestamp}.{hashlib.sha256(body).hexdigest()}".encode("utf-8")
    return "v1=" + hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def multipart(folder: Path) -> tuple[bytes, str]:
    story = json.loads((folder / "story.json").read_text(encoding="utf-8"))
    story["video"] = {key: story["video"][key] for key in ("width", "height", "titleInVideo")}
    fields = [
        ("story", None, "application/json", json.dumps(story, ensure_ascii=False, separators=(",", ":")).encode("utf-8")),
        ("banner", "banner.mp4", "video/mp4", (folder / "banner.mp4").read_bytes()),
        ("poster", "poster.webp", "image/webp", (folder / "poster.webp").read_bytes()),
    ]
    boundary = "s3dat-" + secrets.token_hex(24)
    while any(boundary.encode("ascii") in data for _, _, _, data in fields):
        boundary = "s3dat-" + secrets.token_hex(24)
    chunks = []
    for name, filename, content_type, data in fields:
        disposition = f'Content-Disposition: form-data; name="{name}"'
        if filename:
            disposition += f'; filename="{filename}"'
        chunks.append(f"--{boundary}\r\n{disposition}\r\nContent-Type: {content_type}\r\n\r\n".encode("ascii"))
        chunks.extend((data, b"\r\n"))
    chunks.append(f"--{boundary}--\r\n".encode("ascii"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def social_envelope(slug: str, kind: str, video: bytes) -> bytes:
    # The header travels inside the signed bytes, so a signature cannot be reused for another story.
    header = json.dumps({"slug": slug, "kind": kind}, separators=(",", ":"))
    return b"S3DAT-SOCIAL-1\n" + header.encode("utf-8") + b"\n" + video


class NoRedirect(urllib.request.HTTPRedirectHandler):
    # Never forward a signed publication to a different endpoint.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def send(secret: str, url: str, body: bytes, content_type: str, timeout: int = 60) -> int:
    """POST signed bytes; prints the JSON answer and returns the HTTP status (0 on transport error)."""
    timestamp = str(int(time.time()))
    target = urlsplit(url)
    request = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": content_type,
        # Cloudflare's browser integrity check rejects the default Python-urllib agent (error 1010).
        "User-Agent": "S3DAT-News-Publisher/1.0 (+https://news.s3dat.com/about)",
        # Astro checks Origin on multipart POSTs before dispatching the signed endpoint.
        "Origin": f"{target.scheme}://{target.netloc}",
        "X-S3DAT-Timestamp": timestamp,
        "X-S3DAT-Signature": sign(secret, timestamp, body),
    })
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=timeout) as response:
            status, payload = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, payload = error.code, error.read()
    try:
        print(json.dumps(json.loads(payload), ensure_ascii=False, indent=2))
    except (ValueError, UnicodeDecodeError):
        print(f"Endpoint returned HTTP {status} with a non-JSON response", file=sys.stderr)
        return 0
    return status


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("story_dir", nargs="?", type=Path)
    group.add_argument("--withdraw", metavar="SLUG")
    group.add_argument("--social", metavar="SLUG")
    parser.add_argument("--wide", type=Path, help="16:9 social cut (with --social)")
    parser.add_argument("--tall", type=Path, help="9:16 social cut (with --social)")
    args = parser.parse_args()
    secret = os.environ.get("NEWS_INGEST_SECRET")
    if not secret:
        print("NEWS_INGEST_SECRET is required", file=sys.stderr)
        return 1
    url = os.environ.get("NEWS_INGEST_URL", "https://s3dat.com/api/news/ingest")
    slug = args.withdraw or args.social
    try:
        if slug is not None and (len(slug) > 90 or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug, re.ASCII)):
            raise ValueError("Invalid slug")
        if args.social:
            # Same host as the ingest endpoint, sibling path.
            social_url = url.rsplit("/", 1)[0] + "/social-media"
            failed = 0
            for kind, path in (("wide", args.wide), ("tall", args.tall)):
                if path is None or not path.is_file():
                    print(f"No {kind} social cut for {slug}; skipped")
                    continue
                status = send(secret, social_url, social_envelope(slug, kind, path.read_bytes()), "application/octet-stream", timeout=180)
                failed += status != 200
            return 1 if failed else 0
        if args.withdraw:
            body = json.dumps({"action": "withdraw", "slug": args.withdraw}, separators=(",", ":")).encode("utf-8")
            content_type = "application/json"
        else:
            body, content_type = multipart(args.story_dir)
        return 0 if send(secret, url, body, content_type) == 200 else 1
    except (OSError, ValueError, KeyError, TypeError, urllib.error.URLError):
        # Transport errors can contain credential-bearing URLs. Keep diagnostics safe.
        print("Publication failed: check input files, endpoint and connectivity", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
