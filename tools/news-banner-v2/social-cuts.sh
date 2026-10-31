#!/bin/sh
# Render one story's two social cuts with Firefox, for a machine where Chromium cannot start
# (Makima's cloud computer blocks the ptrace and socket calls Chromium needs; Firefox works once
# HOME is writable). The 9:16 cut has no voice: the social workflow adds it (SOCIAL.md).
#
#   tools/news-banner-v2/social-cuts.sh stories/YYYY/MM/DD/<slug> [out-dir]
#
# Writes <out-dir>/<slug>-wide.mp4 (1920x1080) and <out-dir>/<slug>-tall.mp4 (1080x1920, 15 s);
# out-dir defaults to /tmp/social-cuts. Needs Node 20+, ffmpeg and `npm ci` in this folder.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
story=$(cd "$1" && pwd)
slug=$(basename "$story")
out=${2:-/tmp/social-cuts}
mkdir -p "$out"
out=$(cd "$out" && pwd)

# Keep the Playwright browsers where they were installed, then give Firefox a writable home.
if [ "$(uname)" = Darwin ]; then cache="$HOME/Library/Caches"; else cache="${XDG_CACHE_HOME:-$HOME/.cache}"; fi
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$cache/ms-playwright}"
work=${SOCIAL_CUTS_HOME:-/tmp/social-cuts-home}
mkdir -p "$work/.config" "$work/.cache"
export HOME="$work" XDG_CONFIG_HOME="$work/.config" XDG_CACHE_HOME="$work/.cache" BROWSER=firefox MOZ_HEADLESS=1
unset FISH_API_KEY

cd "$here"
npx --no-install playwright-core install firefox >/dev/null
node render.mjs "$story" --format hd --out "$out/$slug-wide.mp4"
node render.mjs "$story" --format social --out "$out/$slug-tall.mp4"
