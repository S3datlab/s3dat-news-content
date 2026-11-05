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
KINDS = ("brief", "story", "analysis", "explained")
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
    format2 = story.get("format") == 2
    if story.get("format") not in (None, 1, 2):
        errors.append("format must be 1 or 2")
    for key, low, high in (() if format2 else (("whatHappened", 1, 8), ("whyItMatters", 1, 6), ("take", 1, 4), ("openQuestions", 0, 4))):
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
            if "date" in source and calendar_date(source.get("date")) is None:
                errors.append(f"{path}.date must be a YYYY-MM-DD date")
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
    published = timestamp(story.get("publishedAt"))
    if format2:
        errors.extend(validate_format2(story))
    elif published is not None and published >= FORMAT2_CUTOVER:
        errors.append('stories published from 31 October 2026 09:00 UTC must use the S3DAT story format ("format": 2); see stories/README.md')
    return errors


# ---------------------------------------------------------------- S3DAT story format (format 2)
FORMAT2_CUTOVER = dt.datetime(2026, 10, 31, 9, 0, tzinfo=dt.timezone.utc)
MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december"
# Phrases that make copy read like generated text. Lower-case, matched on word boundaries.
BANNED = [
    "delve", "delves", "delving", "landscape", "game-changer", "game changer", "game-changing", "it's worth noting",
    "it is worth noting", "worth noting", "notably", "remains to be seen", "pave the way", "paves the way",
    "paving the way", "underscore", "underscores", "underscoring", "a testament", "tapestry", "realm", "navigate the",
    "navigating the", "in today's", "seamless", "seamlessly", "robust", "leverage", "leverages", "leveraging", "unlock",
    "unlocks", "unlocking", "revolutionary", "revolutionize", "revolutionise", "groundbreaking", "ground-breaking",
    "cutting-edge", "transformative", "pivotal", "crucial", "in conclusion", "overall,", "moreover", "furthermore",
    "a significant step", "highlights the importance", "ever-evolving", "fast-paced", "harness the power",
    "the future of", "at the end of the day", "in the world of", "dive into", "deep dive", "elevate", "empower",
    "empowers", "supercharge", "next-level", "it is important to note", "importantly,", "in summary", "a myriad",
]
BANNED_RE = re.compile(r"(?<![\w-])(" + "|".join(re.escape(b) for b in sorted(BANNED, key=len, reverse=True)) + r")(?![\w-])", re.IGNORECASE)
PROCESS_RE = re.compile(r"\b(?:checked|verified|accessed|retrieved)\s+(?:on\s+)?(?:" + MONTHS + r"|\d{1,2}\s+(?:" + MONTHS + r"))|\bcomparison (?:as of|checked)\b", re.IGNORECASE)
WORDS = {"brief": (100, 320), "story": (250, 650), "analysis": (600, 1300), "explained": (450, 1500)}
BODY = {"brief": (1, 2), "story": (2, 5), "analysis": (3, 8), "explained": (3, 10)}
# From here on there are no briefs, and a story carries more context (EDITORIAL.md).
DEPTH_CUTOVER = dt.datetime(2026, 11, 1, 18, 0, tzinfo=dt.timezone.utc)
DEPTH_WORDS = {"story": (450, 900)}
# Bluesky allows 300 characters; its post is social.short, a blank line and the story link.
BLUESKY_LIMIT = 300


def calendar_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        return None


def sentences(text):
    parts = re.split(r"(?<=[.!?])[\"”’)]?\s+(?=[A-Z0-9“\"(])", text.strip())
    return [p for p in parts if p.strip()]


def word_count(text):
    return len(re.findall(r"[A-Za-z0-9$€£%][\w$€£%.,'’/-]*", text))


# Every story published from here on carries its social copy and voice-over script.
SOCIAL_CUTOVER = dt.datetime(2026, 11, 1, 4, 0, tzinfo=dt.timezone.utc)
HASHTAG = re.compile(r"[A-Za-z][A-Za-z0-9]{1,29}")
# From here on every story carries 3-5 hashtags of its own, most important first (SOCIAL.md).
HASHTAG_CUTOVER = dt.datetime(2026, 11, 2, 18, 0, tzinfo=dt.timezone.utc)
# Tags that would fit any story reach nobody in particular.
FILLER_TAGS = {
    "ai", "artificialintelligence", "ainews", "technews", "tech", "technology", "news", "innovation",
    "future", "trending", "viral", "fyp", "foryou", "foryoupage", "breaking", "update", "update2026",
    "s3dat", "s3datnews",
}
EMOJI = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF]")
# Fish Audio S2 reads [bracket] cues as delivery directions. The house set suits a news read:
# one tone per sentence at most, no laughs, sighs or shouting.
CUE = re.compile(r"\[([^\[\]]*)\]")
CUES = {"calm", "confident", "curious", "serious", "concerned", "surprised", "matter-of-fact", "warm", "wry",
        "thoughtful", "skeptical", "measured", "upbeat", "emphasis", "break", "long-break", "pause"}
# Social formulas that make an account read like a bot, on top of BANNED.
SOCIAL_BANNED = [
    "breaking", "big news", "huge news", "here's why", "here is why", "here's what", "here is what", "why it matters",
    "why this matters", "what this means", "what you need to know", "everything you need to know", "let's",
    "buckle up", "stay tuned", "you won't believe", "mind-blowing", "this changes everything", "a new era",
    "the race is on", "heats up", "makes waves", "takes aim", "doubles down", "set to", "poised to", "unveils",
    "unveiled", "unleash", "unleashes", "just dropped", "in a move", "thread", "game on", "big moment",
]
# Calls to act that the platforms push down as engagement bait, and that read like a bot (SOCIAL.md).
BAIT = [
    "what do you think", "what are your thoughts", "thoughts?", "let us know", "let me know", "comment below",
    "drop a comment", "tag a friend", "tag someone", "share this", "like if",
    "double tap", "follow us", "follow for", "comment yes", "agree?", "who else", "sound off",
]
BAIT_RE = re.compile(r"(?<![\w-])(" + "|".join(re.escape(b) for b in sorted(BAIT, key=len, reverse=True)) + r")", re.IGNORECASE)
# From here on every story carries a hook, our take and the key facts people save (SOCIAL.md).
SOCIAL_V2_CUTOVER = dt.datetime(2026, 11, 3, 9, 0, tzinfo=dt.timezone.utc)
SOCIAL_BANNED_RE = re.compile(r"(?<![\w-])(" + "|".join(re.escape(b) for b in sorted(SOCIAL_BANNED, key=len, reverse=True)) + r")(?![\w-])", re.IGNORECASE)
STORIES = Path(__file__).resolve().parent.parent / "stories"


def spoken_words(text):
    return re.findall(r"[a-z0-9$%]+(?:['’][a-z]+)?", CUE.sub(" ", text).lower().replace("’", "'"))


# The voice says numbers as words ("$600M" is "six hundred million dollars"), so the hook and the
# start of the voice-over are compared without them.
NUMBER_WORDS = set("""zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen
sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million
billion trillion dollars dollar percent euros pounds point and a half""".split())


def said_alike(hook, voice):
    """Whether the voice-over's first sentences say the hook (numbers may be spelled out)."""
    n = max(1, len(sentences(hook.strip())))
    opening = " ".join(sentences(CUE.sub(" ", voice).strip())[:n])
    words = lambda t: [w for w in spoken_words(t) if not re.search(r"\d", w) and w not in NUMBER_WORDS]
    return words(hook) == words(opening)


def opener(text, n=3):
    words = re.findall(r"[a-z0-9']+", CUE.sub(" ", text).lower())
    return tuple(words[:n]) if len(words) >= n else None


def recent_social(story, limit=10):
    """The social blocks of the stories published just before this one, newest first."""
    mine = timestamp(story.get("publishedAt"))
    found = []
    for path in STORIES.glob("*/*/*/*/story.json"):
        try:
            other = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        when = timestamp(other.get("publishedAt")) if isinstance(other, dict) else None
        if not when or other.get("slug") == story.get("slug") or (mine and when >= mine):
            continue
        if isinstance(other.get("social"), dict):
            found.append((when, other["social"]))
    return [s for _, s in sorted(found, key=lambda x: x[0], reverse=True)[:limit]]


def validate_social(story, published):
    errors = []
    social = story.get("social")
    if social is None:
        if published is not None and published >= SOCIAL_CUTOVER:
            errors.append("social is required: hook, voiceover, short, long, take, keyFacts and hashtags (see SOCIAL.md)")
        return errors
    if not isinstance(social, dict):
        return ["social must be an object"]
    v2 = published is not None and published >= SOCIAL_V2_CUTOVER
    question = social.get("question")
    if question is not None and check_text(question, "social.question", 20, 110, errors):
        if not question.rstrip().endswith("?") or question.count("?") != 1:
            errors.append("social.question is one question and ends with ?")
    options = social.get("options")
    if options is not None:
        if question is None:
            errors.append("social.options needs a social.question")
        elif not isinstance(options, list) or not 2 <= len(options) <= 3 or not all(isinstance(o, str) and 1 <= len(o.strip()) <= 18 for o in options):
            errors.append("social.options lists two or three short answers, up to 18 characters each")
    vo = social.get("voiceover")
    if check_text(vo, "social.voiceover", 60, 360, errors):
        cues = [c.strip().lower() for c in CUE.findall(vo)]
        for cue in cues:
            base = re.sub(r"^(slightly|a little)\s+", "", cue)
            if base not in CUES:
                errors.append(f"social.voiceover: [{cue}] is not a house cue; use one of {', '.join(sorted(CUES))}")
        if len(cues) > 4:
            errors.append(f"social.voiceover has {len(cues)} cues; keep at most four")
        if re.search(r"\[|\]", CUE.sub("", vo)):
            errors.append("social.voiceover has an unmatched [ or ]")
        n = word_count(CUE.sub(" ", vo))
        high = 38 if v2 else 36
        if not 26 <= n <= high:
            errors.append(f"social.voiceover must be 26–{high} spoken words, cues not counted, so it fits the 15-second video (found {n})")
        if re.search(r"https?://|www\.|\b[a-z0-9-]+\.(com|ai|io|org)\b", vo, re.IGNORECASE):
            errors.append("social.voiceover is read aloud: no links or domains")
        hook = social.get("hook")
        if isinstance(hook, str) and hook.strip():
            if not said_alike(hook, vo):
                errors.append("social.voiceover opens with the hook, word for word, so the reel can show it as it is spoken")
        if "?" in vo:
            last = sentences(CUE.sub(" ", vo).strip())[-1:]
            if question is None or vo.count("?") != 1 or not (last and last[0].rstrip().endswith("?")):
                errors.append("social.voiceover may ask one question, the social.question, and only at its end")
    for key, low, high in (("short", 60, 240), ("long", 300, 1500), ("hook", 20, 70), ("take", 60, 260)):
        text = social.get(key)
        if text is None and key in ("hook", "take"):
            if v2:
                errors.append(f"social.{key} is required from 3 November 2026 09:00 UTC (SOCIAL.md)")
            continue
        if check_text(text, f"social.{key}", low, high, errors):
            if re.search(r"https?://|www\.", text):
                errors.append(f"social.{key} must not contain links; the story link is added when posting")
            if EMOJI.search(text):
                errors.append(f"social.{key} must not contain emoji")
            if "#" in text:
                errors.append(f"social.{key} must not contain hashtags; list them in social.hashtags")
            room = BLUESKY_LIMIT - len(f"\n\nhttps://news.s3dat.com/stories/{story.get('slug', '')}")
            if key == "short" and published is not None and published >= DEPTH_CUTOVER and len(text) > room:
                errors.append(f"social.short must be at most {room} characters so it fits Bluesky with the story link (found {len(text)})")
            if "[" in text or "]" in text:
                errors.append(f"social.{key} is read, not spoken: no [cues]")
    hook, take = social.get("hook"), social.get("take")
    if isinstance(hook, str) and isinstance(story.get("title"), str) and spoken_words(hook) == spoken_words(story["title"]):
        errors.append("social.hook repeats the title; give the stake a stranger would stop for")
    if isinstance(take, str):
        if re.match(r"\s*our (?:read|take)\b", take, re.IGNORECASE):
            errors.append('social.take: leave out "Our read:"; the posts add it')
        if not re.search(r"\b(?:we|we're|we've|we'd|our|us)\b", take.replace("’", "'"), re.IGNORECASE):
            errors.append('social.take is our position: say it with "we"')
    facts = social.get("keyFacts")
    if facts is None:
        if v2:
            errors.append("social.keyFacts is required from 3 November 2026 09:00 UTC: 3–5 exact facts worth saving (SOCIAL.md)")
    elif not isinstance(facts, list) or not 3 <= len(facts) <= 5 or not all(isinstance(f, str) and 12 <= len(f.strip()) <= 80 for f in facts):
        errors.append("social.keyFacts lists 3–5 facts of 12–80 characters each")
    else:
        if sum(bool(re.search(r"\d", f)) for f in facts) < 2:
            errors.append("social.keyFacts: at least two lines carry a number (a price, a limit, a date, a version)")
        for i, f in enumerate(facts):
            if re.search(r"https?://|www\.|#", f) or EMOJI.search(f) or "?" in f or "!" in f:
                errors.append(f"social.keyFacts[{i}] is a plain fact: no links, hashtags, emoji, questions or exclamation marks")
    if "priority" in social and (type(social["priority"]) is not int or not 1 <= social["priority"] <= 5):
        errors.append("social.priority must be a whole number from 1 to 5 (how much the story is worth a video; 1 and 2 never get one)")
    tags = social.get("hashtags", [])
    strict = published is not None and published >= HASHTAG_CUTOVER
    low, high = (3, 5) if strict else (0, 5)
    if not isinstance(tags, list) or not low <= len(tags) <= high or not all(isinstance(t, str) and HASHTAG.fullmatch(t) for t in tags):
        errors.append(f"social.hashtags must list {low}–{high} tags of letters and digits, without #, most important first")
    elif strict:
        lowered = [t.lower() for t in tags]
        for tag in tags:
            if tag.lower() in FILLER_TAGS:
                errors.append(f"social.hashtags: #{tag} fits any story; use tags about this one (the product, the company, the field)")
        if len(set(lowered)) != len(lowered):
            errors.append("social.hashtags lists the same tag twice")
    texts = {key: social.get(key) for key in ("hook", "voiceover", "short", "long", "take", "question")}
    if isinstance(facts, list):
        texts["keyFacts"] = " ".join(f for f in facts if isinstance(f, str))
    if isinstance(options, list):
        texts["options"] = " ".join(o for o in options if isinstance(o, str))
    for key, text in texts.items():
        if not isinstance(text, str):
            continue
        for phrase in dict.fromkeys(m.group(0).lower() for m in BANNED_RE.finditer(text)):
            errors.append(f'social.{key}: "{phrase}" reads like generated copy; say it plainly')
        for phrase in dict.fromkeys(m.group(0).lower() for m in SOCIAL_BANNED_RE.finditer(text)):
            errors.append(f'social.{key}: "{phrase}" is a social-media formula; state the news instead')
        for phrase in dict.fromkeys(m.group(0).lower() for m in BAIT_RE.finditer(text)):
            errors.append(f'social.{key}: "{phrase}" is engagement bait; give people something to answer instead')
        if "?" in text and key not in ("voiceover", "question"):
            errors.append(f"social.{key}: no questions; the one question goes in social.question")
        if "!" in text:
            errors.append(f"social.{key}: no exclamation marks")
    short, long = social.get("short"), social.get("long")
    if isinstance(short, str) and isinstance(long, str) and opener(short, 6) and opener(short, 6) == opener(long, 6):
        errors.append("social.long starts like social.short; write it for its own readers")
    # A recognisable voice, not a template: no opening the last ten posts already used.
    recent = recent_social(story)
    for key in ("hook", "voiceover", "short", "long", "take"):
        text = social.get(key)
        mine = opener(text) if isinstance(text, str) else None
        if mine and any(isinstance(r.get(key), str) and opener(r[key]) == mine for r in recent):
            errors.append(f'social.{key} opens with "{" ".join(mine)}" like a recent post; vary the opening')
    return errors


def validate_format2(story):
    errors = []
    kind = story.get("kind")
    title = story.get("title") if isinstance(story.get("title"), str) else ""
    if len(title) > 90:
        errors.append("title must be at most 90 characters")
    if "?" in title:
        errors.append("title must not be a question")
    if re.search(r",\s+but\b", title, re.IGNORECASE):
        errors.append('title must not use the "X, but Y" pattern; put the caveat in the story')
    event = calendar_date(story.get("eventDate"))
    published = timestamp(story.get("publishedAt"))
    if event is None:
        errors.append("eventDate must be the YYYY-MM-DD date of the announcement or event")
    elif published is not None:
        if event > published.date():
            errors.append("eventDate cannot be after publishedAt")
        # Freshness applies to what we publish from the cutover on; converted older stories keep their dates.
        elif kind in ("brief", "story") and published >= FORMAT2_CUTOVER and (published.date() - event).days > 2:
            errors.append(f"news older than two days cannot be a {kind}: publish it as analysis or explained, or skip it")
    lede = story.get("lede")
    if check_text(lede, "lede", 80, 600, errors):
        ls = sentences(lede)
        if not 2 <= len(ls) <= 3:
            errors.append(f"lede must be two or three sentences (found {len(ls)})")
        if ls and word_count(ls[0]) > 35:
            errors.append("the lede's first sentence must be at most 35 words")
        if not re.search(r"\d|" + MONTHS + r"|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|yesterday", lede, re.IGNORECASE):
            errors.append("the lede must say when it happened")
    facts = story.get("facts", [])
    need_facts = kind != "explained"
    if not isinstance(facts, list) or not (3 if need_facts else 0) <= len(facts) <= 6:
        errors.append(f"facts must contain {'3' if need_facts else '0'}–6 items")
        facts = []
    for i, fact in enumerate(facts):
        if not isinstance(fact, dict):
            errors.append(f"facts[{i}] must be an object")
            continue
        check_text(fact.get("label"), f"facts[{i}].label", 1, 28, errors)
        check_text(fact.get("value"), f"facts[{i}].value", 1, 120, errors)
    if need_facts and facts and not any(isinstance(f, dict) and re.search(r"\d", str(f.get("value", ""))) for f in facts):
        errors.append("at least one fact must carry a number (a date, price, size or count)")
    body = story.get("body", [])
    low, high = BODY.get(kind, (1, 10))
    if not isinstance(body, list) or not low <= len(body) <= high:
        errors.append(f"a {kind} needs {low}–{high} body paragraphs")
        body = []
    for i, para in enumerate(body):
        if not isinstance(para, dict):
            errors.append(f"body[{i}] must be an object")
            continue
        check_text(para.get("text"), f"body[{i}].text", 40, 1400, errors)
        if "heading" in para:
            check_text(para.get("heading"), f"body[{i}].heading", 1, 90, errors)
        if kind == "explained" and not str(para.get("heading", "")).endswith("?"):
            errors.append(f"explained body[{i}] needs a question as its heading")
        if re.search(r"(^|\n)\s*([-*•]|\d+\.)\s|\*\*|##", str(para.get("text", ""))):
            errors.append(f"body[{i}] must be prose: no bullets or markdown")
    note = story.get("buildersNote")
    if note is not None:
        check_text(note, "buildersNote", 40, 500, errors)
    our = story.get("ourRead")
    if our is not None:
        check_text(our, "ourRead", 120, 1200, errors)
    sources = story.get("sources") if isinstance(story.get("sources"), list) else []
    claims = story.get("claims", [])
    if not isinstance(claims, list) or len(claims) > 6:
        errors.append("claims must contain 0–6 items")
        claims = []
    for i, claim in enumerate(claims):
        if not isinstance(claim, dict):
            errors.append(f"claims[{i}] must be an object")
            continue
        check_text(claim.get("text"), f"claims[{i}].text", 10, 240, errors)
        if claim.get("status") not in ("confirmed", "claimed", "unclear"):
            errors.append(f"claims[{i}].status must be confirmed, claimed or unclear")
        if "source" in claim and (type(claim["source"]) is not int or not 0 <= claim["source"] < len(sources)):
            errors.append(f"claims[{i}].source must index a source")
        if claim.get("status") == "confirmed" and "source" not in claim:
            errors.append(f"claims[{i}] is confirmed, so it must point to its source")
    cmp = story.get("comparison")
    if cmp is not None:
        cols = cmp.get("columns") if isinstance(cmp, dict) else None
        rows = cmp.get("rows") if isinstance(cmp, dict) else None
        if not isinstance(cols, list) or not 3 <= len(cols) <= 5 or not isinstance(rows, list) or not 2 <= len(rows) <= 6:
            errors.append("comparison needs 3–5 columns and 2–6 rows")
        else:
            for r, row in enumerate(rows):
                if not isinstance(row, list) or len(row) != len(cols) or not all(isinstance(c, str) and len(c) <= 80 for c in row):
                    errors.append(f"comparison.rows[{r}] must have {len(cols)} text cells of at most 80 characters")
    watching = story.get("watching", [])
    if not isinstance(watching, list) or len(watching) > 3:
        errors.append("watching must contain 0–3 items")
        watching = []
    # What each kind must carry.
    if kind == "brief" and (our is not None or cmp is not None):
        errors.append("a brief has no ourRead or comparison")
    deep = published is not None and published >= DEPTH_CUTOVER
    if kind == "brief" and deep:
        errors.append("briefs are retired from 1 November 2026 18:00 UTC: write a story or an analysis, or skip the news")
    if kind == "story" and deep and (note is None or len(claims) < 2):
        errors.append("a story needs a buildersNote and at least two claims")
    elif kind == "story" and note is None and len(claims) < 2:
        errors.append("a story needs a buildersNote or at least two claims")
    if kind == "analysis":
        if cmp is None:
            errors.append("an analysis needs a comparison table")
        if len(claims) < 2:
            errors.append("an analysis needs at least two claims")
        if our is None:
            errors.append("an analysis needs ourRead")
        if not watching:
            errors.append("an analysis needs 1–3 watching items")
    # House style on the prose a reader sees.
    prose = [("lede", lede)] + [(f"body[{i}]", p.get("text")) for i, p in enumerate(body) if isinstance(p, dict)]
    prose += [("buildersNote", note), ("ourRead", our)] + [(f"watching[{i}]", w) for i, w in enumerate(watching)]
    prose += [(f"facts[{i}].value", f.get("value")) for i, f in enumerate(facts) if isinstance(f, dict)]
    prose += [("title", title), ("dek", story.get("dek"))]
    all_text = " ".join(str(t) for _, t in prose if isinstance(t, str))
    for path, text in prose:
        if not isinstance(text, str):
            continue
        for m in BANNED_RE.finditer(text):
            errors.append(f'{path}: "{m.group(0)}" reads like generated copy; say it plainly')
        if PROCESS_RE.search(text):
            errors.append(f"{path}: research notes such as \"checked October 31\" belong in sources, not in the story")
    spoken = " ".join(str(t) for p, t in prose if isinstance(t, str) and not p.startswith("facts") and p not in ("title", "dek"))
    lengths = [word_count(x) for x in sentences(spoken)]
    if lengths:
        if max(lengths) > 40:
            errors.append(f"a sentence has {max(lengths)} words; keep every sentence under 40")
        if sum(lengths) / len(lengths) > 24:
            errors.append(f"sentences average {sum(lengths) / len(lengths):.0f} words; aim for 15–22")
    hedges = len(re.findall(r"\brather than\b|,\s*not\s|\bnot just\b|\bnot only\b", all_text, re.IGNORECASE))
    if hedges > 3:
        errors.append(f'{hedges} "rather than / not X" constructions; say what it is, keep at most three')
    body_text = " ".join(str(p.get("text", "")) for p in body if isinstance(p, dict))
    advice = len(re.findall(r"\bwe would\b|\bwe'd\b|\bour (?:suggested|proposed|recommended)\b|\bteams should\b|\bdevelopers should\b", body_text, re.IGNORECASE))
    if advice > 2:
        errors.append(f'the body gives advice {advice} times ("we would", "teams should"...); report in the body, advise in buildersNote or ourRead')
    for i, src in enumerate(sources):
        if isinstance(src, dict) and PROCESS_RE.search(str(src.get("title", ""))):
            errors.append(f"sources[{i}].title: drop the research note; the date field records when")
    errors.extend(validate_social(story, published))
    words = word_count(spoken)
    lo, hi = (DEPTH_WORDS if deep else WORDS).get(kind) or WORDS.get(kind, (100, 1500))
    if not lo <= words <= hi:
        errors.append(f"a {kind} runs {lo}–{hi} words of prose (found {words})")
    return errors


def validate_vibes(spec):
    if "vibes" not in spec:
        return []
    vibes = spec["vibes"]
    if not isinstance(vibes, dict):
        return ["spec.vibes must be an object"]
    errors = []
    if type(vibes.get("banner")) is not bool:
        errors.append("spec.vibes.banner must be boolean")
    if "reel" in vibes and type(vibes["reel"]) is not bool:
        errors.append("spec.vibes.reel must be boolean")
    for key in sorted(vibes.keys() - {"banner", "reel"}):
        errors.append(f"spec.vibes has unknown key {key!r}")
    return errors


def validate_spec(spec, story):
    errors = []
    if not isinstance(spec, dict):
        return ["spec must be an object"]
    errors.extend(validate_vibes(spec))
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


TEMPLATES = ("paper", "ink", "brand", "collage", "versus", "portrait", "data", "poster", "cinematic", "cutout", "monolith")
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


def svg_backdrop(svg: str) -> bool:
    """True when an SVG starts with an opaque <rect> covering its whole canvas (a backdrop, not
    part of the mark): the templates tint the logo, which turns that rect into a solid square."""
    root = re.search(r"<svg\b[^>]*>", svg, re.I)
    if not root:
        return False
    num = lambda v: float(re.match(r"\s*([\d.]+)", v).group(1)) if v and re.match(r"\s*[\d.]+", v) else None
    attr = lambda tag, k: (re.search(rf"\b{k}\s*=\s*[\x22\x27]([^\x22\x27]*)", tag) or [None, None])[1]
    box = attr(root.group(0), "viewBox")
    if box and len(box.replace(",", " ").split()) == 4:
        x0, y0, w, h = (float(v) for v in box.replace(",", " ").split())
    else:
        x0, y0, w, h = 0.0, 0.0, num(attr(root.group(0), "width")), num(attr(root.group(0), "height"))
    first = re.search(r"<(?!svg\b|\?|!|defs\b|title\b|desc\b|/)(\w+)\b[^>]*>", svg[root.end():], re.I)
    if not first or first.group(1).lower() != "rect":
        return False
    tag = first.group(0)
    fill = (attr(tag, "fill") or (re.search(r"fill\s*:\s*([^;\x22\x27]+)", attr(tag, "style") or "") or [None, ""])[1] or "black").strip().lower()
    if fill in ("none", "transparent") or (num(attr(tag, "opacity")) == 0) or (num(attr(tag, "fill-opacity")) == 0):
        return False
    full = lambda v, size: v is not None and (v.strip() == "100%" or (size and num(v) is not None and num(v) >= size * 0.98))
    at = lambda v, o: v is None or num(v) is None or abs(num(v) - o) <= 1
    return full(attr(tag, "width"), w) and full(attr(tag, "height"), h) and at(attr(tag, "x"), x0) and at(attr(tag, "y"), y0)


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
    errors = validate_vibes(spec)
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
            path = check_asset(folder, brand["logo"], f"{label}.logo", (".svg", ".png", ".webp"), 300_000, sources, errors)
            if path is not None and path.suffix.lower() == ".svg" and svg_backdrop(path.read_text(errors="replace")):
                errors.append(f"{label}.logo {brand['logo']} has a filled background rectangle covering the whole "
                              "logo; remove it (a tinted logo would render as a solid square)")
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
        poses = cut.get("poses", [])
        if poses and cut.get("role") != "hero":
            errors.append(f"{label}.poses is only for the hero")
        elif not isinstance(poses, list) or len(poses) > 2:
            errors.append(f"{label}.poses must list at most 2 extra pose files")
        else:
            for j, pose in enumerate(poses):
                pp = check_asset(folder, pose, f"{label}.poses[{j}]", (".png", ".webp"), 900_000, sources, errors)
                if pp and not has_alpha(pp):
                    errors.append(f"{label}.poses[{j}] must have a transparent background")
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
        "monolith": (bool(brands) and isinstance(brands[0], dict) and ("icon" in brands[0] or str(brands[0].get("logo", "")).lower().endswith(".svg")), "a vector logo (icon or .svg) for its first brand"),
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


def validate_media(folder, spec):
    errors = []
    vibes = spec.get("vibes") if isinstance(spec, dict) else None
    vibes_banner = isinstance(vibes, dict) and vibes.get("banner") is True
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
            avg_rate = Fraction(video.get("avg_frame_rate", "0/1"))
            frame_rate = Fraction(video.get("r_frame_rate", "0/1"))
            if vibes_banner:
                if frame_rate != avg_rate or not Fraction("23.976") <= avg_rate <= 30:
                    errors.append("banner.mp4 must be constant 23.976–30 fps (r_frame_rate == avg_frame_rate)")
            elif avg_rate != 30 or frame_rate != 30:
                errors.append("banner.mp4 must be 30 fps")
            duration = float(info.get("format", {}).get("duration", video.get("duration", "nan")))
            if vibes_banner:
                if not 3.0 <= duration <= 12.0:
                    errors.append(f"banner.mp4 must last 3.0–12.0 s (got {duration})")
            elif not 7.95 <= duration <= 8.05:
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
            errors.extend(validate_media(folder, spec))
        print(f"{'FAIL' if errors else 'PASS'} {folder}")
        for error in errors:
            print(f"  - {error}")
        failed += bool(errors)
    print(f"\n{len(args.story_dirs) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
