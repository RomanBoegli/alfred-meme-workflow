# Changelog

## 2.2.0

- Fuzzy search: `meme shokced` still finds shocked memes; results are ranked by relevance (title, then keywords, then notes).
- Animated memes are marked with ▶︎ in the grid and match "animated".
- Video imports become GIF by default (animated WebP doesn't play in PowerPoint); WebP is a setting.
- Every meme has a description of what's in the picture and when to use it.
- The index is now `memes/_index.yml` (sorts first); an existing `index.yaml` is renamed automatically.

## 2.1.0

- Import Telegram sticker packs: paste a `t.me/addstickers/…` link after `memes`, pick stickers from a grid. Emoji become the starting title and keywords.
- Videos and video stickers become animated WebP (or GIF) with transparency (needs `ffmpeg`, `img2webp` for WebP).
- "Cut out the subject" removes the background of a still image (Vision, built into macOS).

## 2.0.0

- Memes are shown in Alfred's Grid View; type to filter.
- Each meme has a title, keywords, notes, source and date in `memes/index.yaml`, all searchable.
- Add images from Finder (Universal Action, hotkey or the `memes` keyword) with a step-by-step guide for their details.
- Edit or remove memes from the grid (`⌃↩`) or the `memes` keyword; annotate files without details; clean up entries whose file is gone.
- Clipboard holds the file plus PNG (and GIF) image data, so pasting works in browsers and web apps too; WebP is converted to PNG.
- Packaged as a self-contained workflow with the memes bundled; no Homebrew dependencies.
- Configurable keywords, grid columns, auto-paste and meme folder.
