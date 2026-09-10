#!/usr/bin/env bash
# Screenshots straight from a running Crumbs instance.
#
# Uses the ?a= deep link so no clicking is needed, and headless Chrome rather
# than a puppeteer dependency. Chrome writes the PNG and then declines to exit,
# so this waits for the file and kills it rather than blocking forever.
#
#   ./scripts/capture.sh                       # against localhost:3000
#   ./scripts/capture.sh https://your.vercel.app
set -u
BASE="${1:-http://localhost:3000}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/brand/screenshots"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME"; exit 1; }
mkdir -p "$OUT"

shot() { # name url width height
  local name="$1" url="$2" w="$3" h="$4"
  local prof; prof=$(mktemp -d)
  rm -f "$OUT/$name.png"
  "$CHROME" --headless --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$prof" --window-size="$w,$h" --virtual-time-budget=25000 \
    --screenshot="$OUT/$name.png" "$url" >/dev/null 2>&1 &
  local pid=$!
  for _ in $(seq 1 60); do
    [ -s "$OUT/$name.png" ] && break
    sleep 1
  done
  sleep 2
  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  rm -rf "$prof"
  if [ -s "$OUT/$name.png" ]; then
    echo "  $name.png  $(magick identify -format '%wx%h %b' "$OUT/$name.png")"
  else
    echo "  $name.png  FAILED"
  fi
}

echo "capturing from $BASE"
shot 01-portfolio "$BASE/?a=9QqQpr3N8skGNRvJsN3VzgLbgXFu4ipEtYNUz5qnvUvN" 1200 2000
shot 02-cook-name "$BASE/?a=moon.cook"                                     1200 1500
shot 03-empty     "$BASE/?a=2C6mxNStrf1Ebsdftwxfn2MvVyRtJWwregvZ7iDGnxpF"  1200 1000

# the submissions repo asks for <=1600px wide
for f in "$OUT"/*.png; do
  magick "$f" -resize '1600x>' -strip -define png:compression-level=9 "$f"
done
echo "done -> $OUT"
