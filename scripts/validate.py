#!/usr/bin/env python3
"""Validate publication inputs with Python 3.10+ stdlib and ffprobe."""
from __future__ import annotations

import argparse
import datetime as dt
from fractions import Fraction
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit

TOPICS = {
    "models": ("#06122e", "#2f6bff", "#9fd8ff"),
    "agents": ("#140b33", "#7b5cff", "#d6c6ff"),
    "dev-tools": ("#03201b", "#17b38a", "#a5f6d9"),
    "research": ("#261204", "#ff8a2a", "#ffd6a3"),
    "hardware": ("#04181f", "#1fb6d6", "#b8f2ff"),
    "policy": ("#26080e", "#ff4d6a", "#ffbac6"),
    "apps": ("#23071f", "#e04fd0", "#ffc6f6"),
}
KINDS = ("story", "analysis", "explained")
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*", re.ASCII)
ISO = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})", re.ASCII)


def valid_slug(value):
    return isinstance(value, str) and len(value) <= 90 and SLUG.fullmatch(value) is not None


def timestamp(value):
    if not isinstance(value, str) or not ISO.fullmatch(value):
        return None
    # datetime rejects invalid calendar dates; explicitly reject offset minutes >= 60.
    if value[-1] != "Z" and (int(value[-5:-3]) > 23 or int(value[-2:]) > 59):
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except (ValueError, OverflowError):
        return None


def check_text(value, path, minimum, maximum, errors):
    if not isinstance(value, str) or not minimum <= len(value) <= maximum or not value.strip():
        errors.append(f"{path} must be a non-empty string of {minimum}–{maximum} characters")
        return False
    return True


def validate_story(story):
    errors = []
    if not isinstance(story, dict):
        return ["story must be an object"]
    if not valid_slug(story.get("slug")):
        errors.append("slug must be lowercase hyphenated words, at most 90 characters")
    if story.get("kind") not in KINDS:
        errors.append("kind is invalid")
    if not isinstance(story.get("topic"), str) or story["topic"] not in TOPICS:
        errors.append("topic is invalid")
    if story.get("sample") is True:
        errors.append("sample stories cannot be published")
    check_text(story.get("title"), "title", 10, 160, errors)
    if "titleAccent" in story:
        if check_text(story["titleAccent"], "titleAccent", 1, 160, errors):
            if not isinstance(story.get("title"), str) or story["titleAccent"] not in story["title"]:
                errors.append("titleAccent must be a substring of title")
    check_text(story.get("dek"), "dek", 60, 260, errors)
    for key in ("publishedAt", "updatedAt"):
        if key == "updatedAt" and "updatedAt" not in story:
            continue  # optional: defaults to publishedAt on the site
        parsed = timestamp(story.get(key))
        if parsed is None:
            errors.append(f"{key} must be a valid ISO 8601 timestamp with timezone")
        elif key == "publishedAt" and parsed > dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=24):
            errors.append("publishedAt is more than 24 hours in the future")
    for key, low, high in (("whatHappened", 1, 8), ("whyItMatters", 1, 6), ("take", 1, 4), ("openQuestions", 0, 4)):
        value = story.get(key, [] if key == "openQuestions" else None)
        if not isinstance(value, list) or not low <= len(value) <= high:
            errors.append(f"{key} must contain {low}–{high} strings")
        else:
            for i, item in enumerate(value):
                check_text(item, f"{key}[{i}]", 1, 600, errors)
    sources = story.get("sources")
    if not isinstance(sources, list) or not 1 <= len(sources) <= 8:
        errors.append("sources must contain 1–8 objects")
    else:
        for i, source in enumerate(sources):
            path = f"sources[{i}]"
            if not isinstance(source, dict):
                errors.append(f"{path} must be an object")
                continue
            check_text(source.get("title"), f"{path}.title", 1, 200, errors)
            check_text(source.get("publisher"), f"{path}.publisher", 1, 100, errors)
            try:
                url = source.get("url")
                if not isinstance(url, str) or re.search(r"\s", url) or not re.match(r"https://", url, re.IGNORECASE):
                    raise ValueError()
                parsed = urlsplit(url)
                if parsed.scheme != "https" or not parsed.hostname or "\\" in url:
                    raise ValueError()
                parsed.port  # Reject malformed ports, as new URL does in the Worker.
            except ValueError:
                errors.append(f"{path}.url must be an HTTPS URL")
    corrections = story.get("corrections", [])
    if not isinstance(corrections, list):
        errors.append("corrections must be an array")
    else:
        for i, correction in enumerate(corrections):
            path = f"corrections[{i}]"
            if not isinstance(correction, dict):
                errors.append(f"{path} must be an object")
                continue
            if timestamp(correction.get("date")) is None:
                errors.append(f"{path}.date must be a valid ISO 8601 timestamp with timezone")
            check_text(correction.get("note"), f"{path}.note", 1, 400, errors)
    video = story.get("video")
    if not isinstance(video, dict) or video.get("width") != 1080 or video.get("height") != 608 or type(video.get("titleInVideo")) is not bool:
        errors.append("video must have width 1080, height 608 and boolean titleInVideo")
    return errors


def validate_spec(spec, story):
    errors = []
    if not isinstance(spec, dict):
        return ["spec must be an object"]
    lines = spec.get("title")
    if not isinstance(lines, list) or not 1 <= len(lines) <= 3:
        errors.append("spec.title must contain 1–3 lines")
    else:
        for i, line in enumerate(lines):
            if check_text(line, f"spec.title[{i}]", 1, 16, errors) and line != line.upper():
                errors.append(f"spec.title[{i}] must be uppercase")
    accent = spec.get("accent_line")
    if type(accent) is not int or not isinstance(lines, list) or not 0 <= accent < len(lines):
        errors.append("spec.accent_line must index a title line")
    topic = story.get("topic") if isinstance(story, dict) else None
    kind = story.get("kind") if isinstance(story, dict) else None
    if isinstance(topic, str) and topic in TOPICS:
        label = topic.replace("-", " ").upper()
        expected = label if kind == "story" else f"{str(kind).upper()} · {label}"
        if spec.get("kicker") != expected:
            errors.append(f"spec.kicker must equal {expected!r}")
        palette = dict(zip(("deep", "mid", "light"), TOPICS[topic]))
        if spec.get("palette") != palette:
            errors.append(f"spec.palette must equal the {topic} palette: {palette}")
    else:
        errors.append("spec palette/kicker cannot be checked without a valid story topic")
    entities = spec.get("entities")
    if not isinstance(entities, list) or len(entities) > 3:
        errors.append("spec.entities must contain 0–3 names")
    else:
        for i, entity in enumerate(entities):
            if not isinstance(entity, str) or not entity.strip() or entity != entity.upper():
                errors.append(f"spec.entities[{i}] must be a non-empty uppercase name")
    if type(spec.get("versus", False)) is not bool:
        errors.append("spec.versus must be boolean")
    elif spec.get("versus") is True and (not isinstance(entities, list) or len(entities) != 2):
        errors.append("spec.versus needs exactly two entities")
    stat, payoff = spec.get("stat"), spec.get("payoff")
    if stat is None and payoff is None:
        errors.append("spec needs a stat or payoff")
    if stat is not None:
        if not isinstance(stat, dict):
            errors.append("spec.stat must be an object")
        else:
            value = stat.get("value")
            if not isinstance(value, str) or not value.strip() or not re.search(r"[0-9]", value):
                errors.append("spec.stat.value must contain a number")
            check_text(stat.get("label"), "spec.stat.label", 1, 28, errors)
    if payoff is not None and check_text(payoff, "spec.payoff", 1, 14, errors):
        if not 1 <= len(payoff.split()) <= 3:
            errors.append("spec.payoff must contain 1–3 words")
    assets = spec.get("assets")
    if not isinstance(assets, dict) or not isinstance(assets.get("background"), str) or not assets["background"].strip():
        errors.append("spec.assets.background is required")
    return errors


TEMPLATES = ("paper", "ink", "brand", "collage", "versus", "portrait", "data", "poster", "cinematic", "cutout")
MOODS = ("up", "down", "shock", "calm")
FIELDS = ("white", "black", "brand", "pop")
ICON = re.compile(r"[a-z0-9]+", re.ASCII)
ASSET = re.compile(r"[a-z0-9][a-z0-9._-]{0,63}", re.ASCII)
HEX = re.compile(r"#[0-9a-fA-F]{6}", re.ASCII)
# Stories published before engine 2 keep their original banners; everything newer must use it.
ENGINE2_CUTOVER = dt.datetime(2026, 10, 31, 12, 0, tzinfo=dt.timezone.utc)


def has_alpha(path):
    data = path.read_bytes()[:64]
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return data[25] in (4, 6) or b"tRNS" in path.read_bytes()[:4096]
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        chunk = data[12:16]
        return chunk == b"VP8L" or (chunk == b"VP8X" and bool(data[20] & 0x10))
    return False


def check_asset(folder, name, label, kinds, maximum, sources, errors):
    if not isinstance(name, str) or not ASSET.fullmatch(name):
        errors.append(f"{label} must be a plain file name in the story folder")
        return None
    path = folder / name
    if path.suffix.lower() not in kinds:
        errors.append(f"{label} must be one of {', '.join(kinds)}")
    elif not path.is_file():
        errors.append(f"{label} {name} is missing")
    elif path.stat().st_size > maximum:
        errors.append(f"{label} {name} exceeds {maximum:,} bytes")
    else:
        source = sources.get(name) if isinstance(sources, dict) else None
        if source != "generated" and not (isinstance(source, str) and source.startswith("https://")):
            errors.append(f"spec.sources[{name!r}] must be \"generated\" or the https URL the file came from")
        return path
    return None


def validate_spec_v2(spec, story, folder):
    errors = []
    template = spec.get("template")
    if template not in TEMPLATES:
        errors.append(f"spec.template must be one of {', '.join(TEMPLATES)}")
    lines = spec.get("headline")
    if not isinstance(lines, list) or not 1 <= len(lines) <= 3:
        errors.append("spec.headline must contain 1–3 lines")
        lines = []
    for i, line in enumerate(lines):
        if check_text(line, f"spec.headline[{i}]", 1, 22, errors) and line != line.upper():
            errors.append(f"spec.headline[{i}] must be uppercase")
    accent = spec.get("accent", len(lines) - 1)
    if type(accent) is not int or not 0 <= accent < max(1, len(lines)):
        errors.append("spec.accent must index a headline line")
    sources = spec.get("sources", {})
    if not isinstance(sources, dict):
        errors.append("spec.sources must map each asset file to its source")
        sources = {}
    brands = spec.get("brands")
    if not isinstance(brands, list) or not 1 <= len(brands) <= 2:
        errors.append("spec.brands must contain 1–2 brands")
        brands = []
    for i, brand in enumerate(brands):
        label = f"spec.brands[{i}]"
        if not isinstance(brand, dict):
            errors.append(f"{label} must be an object")
            continue
        check_text(brand.get("name"), f"{label}.name", 1, 40, errors)
        if ("icon" in brand) == ("logo" in brand):
            errors.append(f"{label} needs exactly one of icon (a simple-icons slug) or logo (a file)")
        elif "icon" in brand and not (isinstance(brand["icon"], str) and ICON.fullmatch(brand["icon"])):
            errors.append(f"{label}.icon must be a simple-icons slug")
        elif "logo" in brand:
            check_asset(folder, brand["logo"], f"{label}.logo", (".svg", ".png", ".webp"), 300_000, sources, errors)
        if "color" in brand and not (isinstance(brand["color"], str) and HEX.fullmatch(brand["color"])):
            errors.append(f"{label}.color must be #rrggbb")
    cutouts = spec.get("cutouts", [])
    if not isinstance(cutouts, list) or len(cutouts) > 4:
        errors.append("spec.cutouts must contain 0–4 cut-outs")
        cutouts = []
    heroes = 0
    for i, cut in enumerate(cutouts):
        label = f"spec.cutouts[{i}]"
        if not isinstance(cut, dict) or cut.get("role", "prop") not in ("hero", "prop"):
            errors.append(f"{label} must be an object with role hero or prop")
            continue
        heroes += cut.get("role") == "hero"
        path = check_asset(folder, cut.get("src"), f"{label}.src", (".png", ".webp"), 900_000, sources, errors)
        if path and not has_alpha(path):
            errors.append(f"{label}.src must have a transparent background (PNG or WebP with alpha)")
    if heroes > 1:
        errors.append("spec.cutouts may have at most one hero")
    if "art" in spec:
        check_asset(folder, spec["art"], "spec.art", (".jpg", ".jpeg", ".webp"), 500_000, sources, errors)
    stat = spec.get("stat")
    if stat is not None:
        if not isinstance(stat, dict) or not isinstance(stat.get("value"), str) or not re.search(r"[0-9]", stat["value"]) or len(stat["value"]) > 10:
            errors.append("spec.stat.value must be a short string with a number (at most 10 characters)")
        elif "label" in stat:
            check_text(stat["label"], "spec.stat.label", 1, 28, errors)
    if "mood" in spec and spec["mood"] not in MOODS:
        errors.append(f"spec.mood must be one of {', '.join(MOODS)}")
    if "bg" in spec and spec["bg"] not in FIELDS:
        errors.append(f"spec.bg must be one of {', '.join(FIELDS)}")
    if "seed" in spec and (type(spec["seed"]) is not int or not 0 <= spec["seed"] < 1_000_000):
        errors.append("spec.seed must be an integer")
    needs = {
        "versus": (len(brands) == 2, "two brands"),
        "data": (stat is not None, "a stat"),
        "cinematic": ("art" in spec, "art"),
        "cutout": (heroes == 1, "a hero cut-out"),
        "portrait": (heroes == 1, "a hero cut-out"),
        "collage": (bool(cutouts) or "art" in spec, "cut-outs or art"),
    }
    if template in needs and not needs[template][0]:
        errors.append(f"template {template} needs {needs[template][1]}")
    total = sum((folder / name).stat().st_size for name in sources if isinstance(name, str) and ASSET.fullmatch(name) and (folder / name).is_file())
    if total > 1_600_000:
        errors.append(f"story assets total {total:,} bytes; keep them under 1,600,000")
    if isinstance(story, dict) and isinstance(story.get("video"), dict) and story["video"].get("titleInVideo") is not True:
        errors.append("engine 2 banners carry the headline: story.video.titleInVideo must be true")
    return errors


def probe(path):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise ValueError("ffprobe could not decode media")
    return json.loads(result.stdout)


def validate_media(folder):
    errors = []
    for name, maximum in (("banner.mp4", 1_600_000), ("poster.webp", 400_000)):
        path = folder / name
        if not path.is_file():
            errors.append(f"{name} is missing")
            continue
        if path.stat().st_size > maximum:
            errors.append(f"{name} exceeds {maximum:,} bytes ({path.stat().st_size:,})")
        with path.open("rb") as handle:
            header = handle.read(12)
        if name == "poster.webp" and not (header[:4] == b"RIFF" and header[8:12] == b"WEBP"):
            errors.append("poster.webp must be WebP")
        if name == "banner.mp4" and header[4:8] != b"ftyp":
            errors.append("banner.mp4 must be MP4")
        try:
            info = probe(path)
            streams = info.get("streams", [])
            videos = [s for s in streams if s.get("codec_type") == "video"]
            if len(videos) != 1:
                errors.append(f"{name} must have exactly one video/image stream")
                continue
            video = videos[0]
            if name == "poster.webp":
                if video.get("codec_name") != "webp":
                    errors.append("poster.webp must decode as WebP")
                continue
            if video.get("width") != 1080 or video.get("height") != 608:
                errors.append("banner.mp4 must be 1080×608")
            if video.get("codec_name") != "h264" or video.get("pix_fmt") != "yuv420p":
                errors.append("banner.mp4 must be H.264 yuv420p")
            if any(s.get("codec_type") == "audio" for s in streams):
                errors.append("banner.mp4 must have no audio track")
            if Fraction(video.get("avg_frame_rate", "0/1")) != 30 or Fraction(video.get("r_frame_rate", "0/1")) != 30:
                errors.append("banner.mp4 must be 30 fps")
            duration = float(info.get("format", {}).get("duration", video.get("duration", "nan")))
            if not 7.95 <= duration <= 8.05:
                errors.append(f"banner.mp4 must last 8.0 s ± 0.05 (got {duration})")
        except (OSError, ValueError, ZeroDivisionError, subprocess.TimeoutExpired) as error:
            errors.append(f"{name}: media inspection failed ({error})")
    return errors


def load_json(path, errors):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        errors.append(f"{path.name}: {error}")
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("story_dirs", nargs="+", type=Path)
    parser.add_argument("--spec-only", action="store_true", help="skip banner.mp4/poster.webp checks (before rendering)")
    args = parser.parse_args()
    failed = 0
    for folder in args.story_dirs:
        errors = []
        story = load_json(folder / "story.json", errors)
        spec = load_json(folder / "spec.json", errors)
        errors.extend(validate_story(story))
        if isinstance(spec, dict) and spec.get("engine") == 2:
            errors.extend(validate_spec_v2(spec, story, folder))
        else:
            published = timestamp(story.get("publishedAt")) if isinstance(story, dict) else None
            if published is not None and published >= ENGINE2_CUTOVER:
                errors.append('new stories must use banner engine 2 (spec.json "engine": 2)')
            errors.extend(validate_spec(spec, story))
        if not args.spec_only:
            errors.extend(validate_media(folder))
        print(f"{'FAIL' if errors else 'PASS'} {folder}")
        for error in errors:
            print(f"  - {error}")
        failed += bool(errors)
    print(f"\n{len(args.story_dirs) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
