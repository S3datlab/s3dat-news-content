#!/usr/bin/env python3
"""Render engine-2 banners (banner.mp4 + poster.webp) into each story folder before publishing,
with the 16:9 social cut out/banners/<slug>-wide.mp4 (1920x1080, sound) from the same frames.

  python scripts/render.py FOLDER...          site banner, poster and wide cut
  python scripts/render.py --tall FOLDER...   the 9:16 cut out/banners/<slug>-tall.mp4 (15 s, voice)

publish.py uploads both cuts for scripts/social.py. The tall cut runs after the story is live,
and a failure there never blocks the story.

Folders whose spec.json is not engine 2 are skipped: they carry committed banners.
Needs Node 20+, ffmpeg, Chrome/Chromium and `npm ci` in tools/news-banner-v2.
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


def tall(folders):
    for name in folders:
        folder = Path(name)
        if not (folder / "banner.mp4").is_file():
            continue
        OUT.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(["node", str(ENGINE), str(folder), "--format", "social", "--out", str(OUT / f"{folder.name}-tall.mp4")], capture_output=True, text=True, timeout=3000)
        print(f"{'TALL FAILED' if result.returncode else 'TALL'} {folder} {result.stdout.strip()}")
        if result.returncode:
            print(result.stderr.strip()[-800:])
    return 0


def main(folders):
    if folders[:1] == ["--tall"]:
        return tall(folders[1:])
    failed = 0
    for name in folders:
        folder = Path(name)
        try:
            spec = json.loads((folder / "spec.json").read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            print(f"SKIP {folder}: spec.json unreadable ({error})")
            continue
        if not isinstance(spec, dict) or spec.get("engine") != 2:
            print(f"SKIP {folder}: not an engine 2 banner")
            continue
        OUT.mkdir(parents=True, exist_ok=True)
        wide = OUT / f"{folder.name}-wide.mp4"
        result = subprocess.run(["node", str(ENGINE), str(folder), "--social-out", str(wide)], capture_output=True, text=True, timeout=3000)
        print(f"{'FAIL' if result.returncode else 'RENDERED'} {folder} {result.stdout.strip()}")
        if result.returncode:
            print(result.stderr.strip()[-1200:])
            failed += 1
            continue
        # Copies named after the slug, kept as the workflow artifact.
        shutil.copyfile(folder / "banner.mp4", OUT / f"{folder.name}.mp4")
        shutil.copyfile(folder / "poster.webp", OUT / f"{folder.name}.webp")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
