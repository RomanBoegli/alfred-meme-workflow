#!/bin/zsh
# Run Script action: puts the selected meme on the clipboard and, if enabled
# in the workflow configuration, pastes it into the frontmost app.

/usr/bin/osascript "${0:A:h}/copy.applescript" "$1" >/dev/null || exit 1

if [[ "$auto_paste" == (1|true) ]]; then
  sleep 0.15
  /usr/bin/osascript -e 'tell application "System Events" to keystroke "v" using command down'
fi
