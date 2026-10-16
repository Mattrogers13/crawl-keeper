#!/bin/bash
# Clone (or update) reference material into sources/ (gitignored).
# Run this yourself after creating a repo from the template; Claude treats
# sources/ as read-only reference.
#
# - sdk: Owlbear Rodeo SDK source (MIT). docs.owlbear.rodeo blocks bots, so
#   this is the API reference Claude can actually read.
# - sdk-tutorials: official tutorials (MIT). Last updated Feb 2023, older
#   than SDK 3.x: check anything you copy against the SDK source.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p sources
for repo in sdk sdk-tutorials; do
  if [ -d "sources/$repo/.git" ]; then
    git -C "sources/$repo" pull --ff-only --quiet
  else
    git clone --depth 1 --quiet "https://github.com/owlbear-rodeo/$repo.git" "sources/$repo"
  fi
  echo "sources/$repo @ $(git -C "sources/$repo" log -1 --format='%h %cs')"
done
echo "npm SDK version: $(node -p "require('./node_modules/@owlbear-rodeo/sdk/package.json').version" 2>/dev/null || echo 'run npm install first')"
