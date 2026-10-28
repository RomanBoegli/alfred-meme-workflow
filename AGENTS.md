# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

Alfred 5.5+ workflow for browsing and curating your own meme collection. The repo root is the workflow folder (`info.plist`, `icon.png`, `src/`). The collection lives in the folder the user picks as `memes_dir` (required in Configure Workflow; 1.x installs fall back to `$alfred_workflow_data/memes`), with its details in `_index.yml` there. `memes/` in this repo is the starter collection: `bin/build` produces `memes.alfredworkflow` (code only) and `memes-starter.zip` (`memes/`), and pushing a `v*` tag (see `bin/release`) makes `.github/workflows/release.yml` publish both as a GitHub release. `bin/link` symlinks the repo into Alfred for development; point `memes_dir` at the repo's `memes/` to curate the starter collection.

Core features need nothing beyond macOS 15+: `/bin/zsh`, `/usr/bin/osascript` (JavaScript for Automation and AppleScriptObjC), `/usr/bin/jq`, `curl`. `ffmpeg` (plus optional `gifsicle`, `img2webp`) is only used for video → animated image (`src/animate.zsh`); everything must keep working without them. Don't introduce Python or Node.

## Common commands

```sh
bin/build                                              # build memes.alfredworkflow
bin/link                                               # symlink repo into Alfred
memes_dir=$PWD/memes osascript -l JavaScript src/memes.js grid shocked   # grid items
osascript -l JavaScript src/memes.js menu              # management menu
memes_dir=$PWD/memes osascript -l JavaScript src/memes.js act '{"cmd":"edit","file":"fish.webp"}'
osascript -l JavaScript src/memes.js form ''           # current form screen
./src/copy.zsh memes/elmo_on_fire.gif                  # clipboard action
plutil -lint info.plist
osascript -e 'tell application id "com.runningwithcrayons.Alfred" to reload workflow "ch.romanboegli.memes"'  # after editing info.plist; Alfred doesn't watch the symlinked checkout
```

Set `memes_dir` and `alfred_workflow_cache` to scratch folders when testing actions so the real collection is untouched. `osascript` calls `run()` automatically; to call internal functions, rename it first, e.g. `osascript -l JavaScript -e "$(sed 's/^function run(/function _run(/' src/memes.js); stringifyYaml(parseYaml(readText('memes/_index.yml')))"`.

## How it works

- **Search**: keyword `{var:keyword}` → Run Script `memes.js grid` → Grid View. The script returns `{"alfredworkflow": {"arg": <Script Filter JSON>, "config": {"columncount": N}}}`; the Grid View reads items from its argument and filters as the user types (against `match`). Grid modifiers: ↩ `src/copy.zsh`, ⌘ reveal, ⌥ copy path, ⌃ `act` (receives the file path; `act` treats paths inside the collection as "edit").
- **Manage**: keyword `{var:manage_keyword}` → Script Filter `memes.js menu`. Universal Action "Add to Memes" and a Hotkey (selection in macOS) pass file paths to `act`.
- **Guide/form**: `act` (Run Script) updates a session in `$alfred_workflow_cache/session.json` and prints `{"alfredworkflow": {"arg": <prefill>, "variables": {"next": "form" | "notify" | "none"}}}`. A Conditional on `{var:next}` calls the external trigger `form` (which opens the keyword-less Script Filter `memes.js form` with the prefill as query) or posts a notification.
- Session steps: `title → keywords → notes → source` when guided (new or unannotated files), then `overview`; `filename` and `remove` are reached from the overview.
- **Meme folder**: `memesDir()` is `memes_dir` (created if missing), else the legacy data folder, else `''`; then `noFolder()` replaces every screen with "Choose your meme folder", whose `act configure` opens `alfredpreferences://navigateto/workflows>workflow>{uid}>userconfig>memes_dir`.
- **Starter collection**: `act starter` downloads `memes-starter.zip` from the latest release (`STARTER_URL`, overridable with the `starter_url` env var for tests), copies images the folder doesn't have and adds their index entries if missing. Existing files and entries are never touched. Offered in the manage menu (first when the folder is empty).
- **Cut-out**: `cutOut()` uses `VNGenerateForegroundInstanceMaskRequest` via the ObjC bridge; the result is a PNG in the cache that replaces the image on save (edit mode trashes the original).
- **Search**: `search()` ranks memes by `score()`: every query word must match some word of the title (weight 1), keywords (0.9), notes (0.6) or filename/extra fields (0.5); `wordScore()` accepts exact > prefix > substring > 1–2 typos (Damerau-Levenshtein, also against word prefixes). Typing inside the Grid View is Alfred's own exact filter on `match`.
- No self-update: the Alfred Gallery forbids it. Users install new releases themselves.
- `_index.yml` is read and written by a small YAML-subset parser/emitter in `memes.js` (top-level map of filename → fields; scalars, flow/block lists, `|`/`>` blocks). Output is sorted by filename, case-insensitive. Unknown fields are preserved.

## Conventions

- Every meme gets `notes` describing what's in the picture and when to use it, plus `keywords` for emotion, reaction, situation and recognisable characters, so it can be found without remembering its name. Don't add "animated"/"gif" keywords; animation is detected.
- `bin/build` ships an explicit list (`info.plist icon.png README.md CHANGELOG.md LICENSE src`); add new top-level files there. Memes never go into the `.alfredworkflow`.
- Keep the workflow Gallery-ready: no self-updating, no installing or downloading software, keywords of 3+ characters, icon ≥ 256 px.
- `info.plist` is edited in Alfred's workflow editor or by hand; keep uids stable. Personal hotkeys are stripped by the `alfred-plist` git filter (see README).
- Bump `version` in `info.plist` and add a `CHANGELOG.md` entry for user-visible changes.
