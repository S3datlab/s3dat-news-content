#!/usr/bin/env python3
"""Render engine-2 banners for publishing, or the social cuts of one story for posting.

  python scripts/render.py FOLDER...      banner.mp4 + poster.webp into each story folder (publish.yml)
  python scripts/render.py --social FOLDER
                                          out/social/<slug>-wide.mp4 (1920x1080, sound) and
                                          out/social/<slug>-tall.mp4 (1080x1920, 15 s, voice-over),
                                          (manual use; see SOCIAL.md for how the cuts are made)

Folders whose spec.json is not engine 2 or has vibes.banner true are skipped: they carry
committed banners.
Needs Node 20+, ffmpeg, Chrome/Chromium and `npm ci` in tools/news-banner-v2; the voice-over
needs FISH_API_KEY and FISH_VOICE_ID.
"""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ROOT / "tools" / "news-banner-v2" / "render.mjs"
OUT = ROOT / "out" / "banners"
SOCIAL = ROOT / "out" / "social"


def engine2_spec(folder: Path) -> dict | None:
    try:
        spec = json.loads((folder / "spec.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"SKIP {folder}: spec.json unreadable ({error})")
        return None
    if not isinstance(spec, dict) or spec.get("engine") != 2:
        print(f"SKIP {folder}: not an engine 2 banner")
        return None
    return spec


def vibes_banner(folder: Path, spec: dict) -> bool:
    vibes = spec.get("vibes")
    if isinstance(vibes, dict) and vibes.get("banner") is True:
        print(f"SKIP {folder}: Vibes banner committed")
        return True
    return False


def render(folder: Path, *extra: str) -> bool:
    result = subprocess.run(["node", str(ENGINE), str(folder), *extra], capture_output=True, text=True, timeout=3000)
    print(f"{'FAIL' if result.returncode else 'RENDERED'} {folder} {' '.join(extra)} {result.stdout.strip()}")
    if result.returncode:
        print(result.stderr.strip()[-1200:])
    return result.returncode == 0


def social(folder: Path) -> int:
    spec = engine2_spec(folder)
    if spec is None:
        return 1
    if vibes_banner(folder, spec):
        return 0
    SOCIAL.mkdir(parents=True, exist_ok=True)
    ok = render(folder, "--format", "hd", "--out", str(SOCIAL / f"{folder.name}-wide.mp4"))
    ok = render(folder, "--format", "social", "--out", str(SOCIAL / f"{folder.name}-tall.mp4")) and ok
    return 0 if ok else 1


def main(args: list[str]) -> int:
    if args[:1] == ["--social"]:
        return social(Path(args[1])) if len(args) == 2 else 2
    failed = 0
    for name in args:
        folder = Path(name)
        spec = engine2_spec(folder)
        if spec is None or vibes_banner(folder, spec):
            continue
        if not render(folder):
            failed += 1
            continue
        # Copies named after the slug, kept as the workflow artifact.
        OUT.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(folder / "banner.mp4", OUT / f"{folder.name}.mp4")
        shutil.copyfile(folder / "poster.webp", OUT / f"{folder.name}.webp")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
