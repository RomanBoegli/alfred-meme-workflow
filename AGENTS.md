# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

Alfred 5.5+ workflow for searching and curating a personal meme collection. The repo root is the workflow folder (`info.plist`, `icon.png`, `src/`) and also the source of truth for the collection (`memes/` with `memes/index.yaml`). `bin/link` symlinks the repo into Alfred for daily use; `bin/build` produces a standalone `memes.alfredworkflow` with the memes bundled.

No dependencies beyond macOS 15+: `/bin/zsh`, `/usr/bin/osascript` (JavaScript for Automation and AppleScriptObjC). Don't introduce Homebrew tools, Python or Node.

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

Set `memes_dir` and `alfred_workflow_cache` to scratch folders when testing actions so the real collection is untouched. `osascript` calls `run()` automatically; to call internal functions, rename it first, e.g. `osascript -l JavaScript -e "$(sed 's/^function run(/function _run(/' src/memes.js); stringifyYaml(parseYaml(readText('memes/index.yaml')))"`.

## How it works

- **Search**: keyword `{var:keyword}` → Run Script `memes.js grid` → Grid View. The script returns `{"alfredworkflow": {"arg": <Script Filter JSON>, "config": {"columncount": N}}}`; the Grid View reads items from its argument and filters as the user types (against `match`). Grid modifiers: ↩ `src/copy.zsh`, ⌘ reveal, ⌥ copy path, ⌃ `act` (receives the file path; `act` treats paths inside the collection as "edit").
- **Manage**: keyword `{var:manage_keyword}` → Script Filter `memes.js menu`. Universal Action "Add to Memes" and a Hotkey (selection in macOS) pass file paths to `act`.
- **Guide/form**: `act` (Run Script) updates a session in `$alfred_workflow_cache/session.json` and prints `{"alfredworkflow": {"arg": <prefill>, "variables": {"next": "form" | "notify" | "none"}}}`. A Conditional on `{var:next}` calls the external trigger `form` (which opens the keyword-less Script Filter `memes.js form` with the prefill as query) or posts a notification.
- Session steps: `title → keywords → notes → source` when guided (new or unannotated files), then `overview`; `filename` and `remove` are reached from the overview.
- `index.yaml` is read and written by a small YAML-subset parser/emitter in `memes.js` (top-level map of filename → fields; scalars, flow/block lists, `|`/`>` blocks). Output is sorted by filename, case-insensitive. Unknown fields are preserved.

## Conventions

- Keywords describe emotion, reaction, situation and recognisable characters so a meme can be found without remembering its name.
- `bin/build` ships an explicit list (`info.plist icon.png README.md CHANGELOG.md LICENSE src memes`); add new top-level files there.
- `info.plist` is edited in Alfred's workflow editor or by hand; keep uids stable. Personal hotkeys are stripped by the `alfred-plist` git filter (see README).
- Bump `version` in `info.plist` and add a `CHANGELOG.md` entry for user-visible changes.
