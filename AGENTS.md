# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

Alfred 5.5+ workflow for searching and curating a personal meme collection. The repo root is the workflow folder (`info.plist`, `icon.png`, `src/`) and also the source of truth for the collection (`memes/` with `memes/_index.yml`). `bin/link` symlinks the repo into Alfred for daily use; `bin/build` produces a standalone `memes.alfredworkflow` with the memes bundled; pushing a `v*` tag (see `bin/release`) makes `.github/workflows/release.yml` publish it as a GitHub release. Installed copies (no `.git` next to `info.plist`) seed `$alfred_workflow_data/memes` from the bundled memes once and use that, so the collection survives updates.

Core features need nothing beyond macOS 15+: `/bin/zsh`, `/usr/bin/osascript` (JavaScript for Automation and AppleScriptObjC), `/usr/bin/jq`, `curl`. `ffmpeg` (plus optional `gifsicle`, `img2webp`) is only used for video → animated image (`src/animate.zsh`); everything must keep working without them. Don't introduce Python or Node.

## Common commands

```sh
bin/build                                              # build memes.alfredworkflow
bin/link                                               # symlink repo into Alfred
osascript -l JavaScript src/memes.js grid shocked      # grid items
osascript -l JavaScript src/memes.js menu              # management menu
osascript -l JavaScript src/memes.js act '{"cmd":"edit","file":"fish.webp"}'
osascript -l JavaScript src/memes.js form ''           # current form screen
./src/copy.zsh memes/elmo_on_fire.gif                  # clipboard action
plutil -lint info.plist
```

Set `memes_dir` and `alfred_workflow_cache` to scratch folders when testing actions so the real collection is untouched. `osascript` calls `run()` automatically; to call internal functions, rename it first, e.g. `osascript -l JavaScript -e "$(sed 's/^function run(/function _run(/' src/memes.js); stringifyYaml(parseYaml(readText('memes/_index.yml')))"`.

## How it works

- **Search**: keyword `{var:keyword}` → Run Script `memes.js grid` → Grid View. The script returns `{"alfredworkflow": {"arg": <Script Filter JSON>, "config": {"columncount": N}}}`; the Grid View reads items from its argument and filters as the user types (against `match`). Grid modifiers: ↩ `src/copy.zsh`, ⌘ reveal, ⌥ copy path, ⌃ `act` (receives the file path; `act` treats paths inside the collection as "edit").
- **Manage**: keyword `{var:manage_keyword}` → Script Filter `memes.js menu`. Universal Action "Add to Memes" and a Hotkey (selection in macOS) pass file paths to `act`.
- **Guide/form**: `act` (Run Script) updates a session in `$alfred_workflow_cache/session.json` and prints `{"alfredworkflow": {"arg": <prefill>, "variables": {"next": "form" | "notify" | "none"}}}`. A Conditional on `{var:next}` calls the external trigger `form` (which opens the keyword-less Script Filter `memes.js form` with the prefill as query) or posts a notification.
- Session steps: `title → keywords → notes → source` when guided (new or unannotated files), then `overview`; `filename` and `remove` are reached from the overview.
- **Sticker packs**: `memes <t.me/addstickers link>` → `act import` runs `src/telegram.zsh`, which downloads into `$alfred_workflow_data/stickers/<pack>/` with a `pack.json` (title, link, emoji per file) and prints a JSON summary. `next: pack` routes to Run Script `memes.js pack <dir>` → a second Grid View (↩ `act` with the sticker path, ⌘ `memes.js addall`). Stickers in a pack folder start a guided session prefilled from their emoji, are moved (not copied) into the collection on save, and saving returns to the pack grid.
- **Cut-out**: `cutOut()` uses `VNGenerateForegroundInstanceMaskRequest` via the ObjC bridge; the result is a PNG in the cache that replaces the image on save (edit mode trashes the original).
- **Search**: `search()` ranks memes by `score()`: every query word must match some word of the title (weight 1), keywords (0.9), notes (0.6) or filename/extra fields (0.5); `wordScore()` accepts exact > prefix > substring > 1–2 typos (Damerau-Levenshtein, also against word prefixes). Typing inside the Grid View is Alfred's own exact filter on `match`.
- **Updates**: `updateItems()` compares `alfred_workflow_version` with the latest GitHub release of `REPO` (cached a day in `latest-release.json` in the cache folder, 2 s timeout, silent when offline). `act update` downloads the `.alfredworkflow` asset and `open`s it. Skipped in git checkouts.
- `_index.yml` is read and written by a small YAML-subset parser/emitter in `memes.js` (top-level map of filename → fields; scalars, flow/block lists, `|`/`>` blocks). Output is sorted by filename, case-insensitive. Unknown fields are preserved.

## Conventions

- Every meme gets `notes` describing what's in the picture and when to use it, plus `keywords` for emotion, reaction, situation and recognisable characters, so it can be found without remembering its name. Don't add "animated"/"gif" keywords; animation is detected.
- `bin/build` ships an explicit list (`info.plist icon.png README.md CHANGELOG.md LICENSE src memes`); add new top-level files there.
- `info.plist` is edited in Alfred's workflow editor or by hand; keep uids stable. Personal hotkeys are stripped by the `alfred-plist` git filter (see README).
- Bump `version` in `info.plist` and add a `CHANGELOG.md` entry for user-visible changes.
