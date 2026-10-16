#!/bin/bash
# SessionStart hook (.claude/settings.json). While BRIEF.md still says
# "Status: DRAFT", open it for editing (Sublime Text, else VS Code, else the
# default app) and tell Claude the brief isn't filled in yet. Once it says
# "Status: DONE" this does nothing.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0
[ -f BRIEF.md ] && grep -q '^Status: DRAFT' BRIEF.md || exit 0

if [ -d "/Applications/Sublime Text.app" ]; then
  open -a "Sublime Text" BRIEF.md
elif [ -d "/Applications/Visual Studio Code.app" ]; then
  open -a "Visual Studio Code" BRIEF.md
else
  open BRIEF.md
fi

msg="BRIEF.md is still a draft and was opened for editing. Don't build features until it says Status: DONE; then read it and ask follow-ups one at a time (see CLAUDE.md)."
jq -n --arg m "$msg" '{
  systemMessage: "Opened BRIEF.md: fill it in, set Status: DONE, then tell Claude.",
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: $m }
}'
