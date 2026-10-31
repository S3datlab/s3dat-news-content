#!/usr/bin/env python3
"""Render engine-2 banners (banner.mp4 + poster.webp) into each story folder before publishing.

Folders whose spec.json is not engine 2 are skipped: they carry committed banners.
Needs Node 20+, ffmpeg, Chrome/Chromium and `npm ci` in tools/news-banner-v2.
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys

ENGINE = Path(__file__).resolve().parent.parent / "tools" / "news-banner-v2" / "render.mjs"


def main(folders):
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
        result = subprocess.run(["node", str(ENGINE), str(folder)], capture_output=True, text=True, timeout=600)
        print(f"{'FAIL' if result.returncode else 'RENDERED'} {folder} {result.stdout.strip()}")
        if result.returncode:
            print(result.stderr.strip()[-1200:])
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
