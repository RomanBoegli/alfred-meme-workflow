# Changelog

## 1.1.0

- Update check: the `memes` menu shows "Update available" when a newer release is on GitHub (checked at most once a day); `↩` installs it, keeping your memes. `memes update` checks right away.

## 1.0.0

First public release.

- `meme [query]` shows memes in Alfred's Grid View. The query is typo-tolerant and ranked by title, keywords and notes; animated memes are marked with ▶︎.
- `↩` copies the file plus PNG/GIF image data, so pasting works in chat apps, mail, browsers and Office. `⌘↩` reveals, `⌥↩` copies the path, `⌃↩` edits.
- Every meme has a title, keywords, notes, source and date in `memes/_index.yml`.
- `memes` manages the collection: add the Finder selection (or use the "Add to Memes" Universal Action or a hotkey) with a step-by-step guide, edit, remove, annotate files without details, clean up stale entries.
- "Cut out the subject" removes the background of a still image with macOS's built-in subject detection.
- Import Telegram sticker packs from a `t.me/addstickers/…` link; emoji become the starting title and keywords.
- Videos and video stickers become animated GIFs (or WebP) with transparency; needs `ffmpeg`.
- Installed workflows keep the collection in Alfred's workflow data folder, so it survives updates; a git checkout linked with `bin/link` uses its own `memes/`.
