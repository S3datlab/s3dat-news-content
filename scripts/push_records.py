#!/usr/bin/env python3
"""Push the committed posting records (social/posted/*.json) to main, retrying three times.

  python scripts/push_records.py

Two writers can record the same story at once (the Oracle server's "now" group and the reel
workflow's "reel" group), which makes `git pull --rebase` stop on an add/add conflict in the same
file. Such a file is merged key by key (one side's groups plus the other's); if both sides wrote
the same group differently, or anything else conflicts, the rebase is aborted and the next try
starts over. Exit 0 pushed, 1 not pushed.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path


def git(*args: str, check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=check)


def rebasing() -> bool:
    top = Path(git("rev-parse", "--git-dir").stdout.strip())
    return (top / "rebase-merge").exists() or (top / "rebase-apply").exists()


def merge_records() -> bool:
    """Resolve a stopped rebase whose only conflicts are posting records. True when it finished."""
    for _ in range(10):  # one round per stopped commit
        files = git("diff", "--name-only", "--diff-filter=U").stdout.split()
        if not files or not all(re.fullmatch(r"social/posted/[\w.-]+\.json", f) for f in files):
            print("conflict outside the posting records:", files, file=sys.stderr)
            return False
        for f in files:
            side = lambda n: json.loads(git("show", f":{n}:{f}", check=True).stdout)
            merged, theirs = side(2), side(3)
            for key, value in theirs.items():
                if key in merged and merged[key] != value:
                    print(f"{f}: both sides wrote {key!r} differently", file=sys.stderr)
                    return False
                merged[key] = value
            Path(f).write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
            git("add", f, check=True)
            print(f"merged posting record {f}: {', '.join(merged)}")
        if git("-c", "core.editor=true", "rebase", "--continue").returncode == 0 and not rebasing():
            return True
    return False


def main() -> int:
    for attempt in range(3):
        if attempt:
            time.sleep(10)
        pulled = git("pull", "--rebase", "-q", "origin", "main")
        if pulled.returncode and not (rebasing() and merge_records()):
            print(pulled.stderr.strip(), file=sys.stderr)
            if rebasing():
                git("rebase", "--abort")
            continue
        if git("push", "-q", "origin", "HEAD:main").returncode == 0:
            return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
