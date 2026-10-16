#!/bin/bash
# Render an SVG to a transparent PNG with headless Chrome. Use this for any
# image Owlbear draws on its canvas (manifest icon, item images): Owlbear
# can't use SVG there. ImageMagick drops stroked SVG paths, so use Chrome.
# Usage: scripts/render-png.sh art/logo.svg public/img/logo.png 256
# Then convert to WebP if it's an item image: cwebp -lossless -exact in.png -o out.webp
set -euo pipefail
src="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
out="$2"
size="${3:-256}"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/page.html" <<HTML
<html><body style="margin:0;background:transparent"><img src="file://$src" width="$size" height="$size"></body></html>
HTML
"$chrome" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 \
  --window-size="$size,$size" --screenshot="$tmp/out.png" "file://$tmp/page.html" 2>/dev/null
mv "$tmp/out.png" "$out"
echo "Wrote $out (${size}x${size})"
