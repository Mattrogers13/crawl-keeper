#!/bin/bash
S=/private/tmp/claude-501/-Users-matthewrogers-claude-projects-obr-crawl-keeper/05a7ed64-8e38-496a-8e55-0f5a841d0f39/scratchpad/ui-review
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
name=$1; h=${2:-600}
"$C" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=600,$h --screenshot="$S/shots/$name.png" "http://127.0.0.1:8765/$name.html" >/dev/null 2>&1
magick "$S/shots/$name.png" -crop 800x$((h*2))+0+0 +repage "$S/shots/$name.png"
echo "$S/shots/$name.png"
