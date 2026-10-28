# alfred-meme-workflow

A fast meme browser for your own collection. Find a meme by name or mood in an [Alfred](https://www.alfredapp.com) thumbnail grid and paste it anywhere. Add, annotate and remove memes without leaving Alfred.

Requires Alfred 5.5+ with the Powerpack and macOS 15+. Optional: `ffmpeg` to turn videos into animated memes (`brew install ffmpeg gifsicle`).

## Install

1. **[⬇ Download the latest release](https://github.com/RomanBoegli/alfred-meme-workflow/releases/latest/download/memes.alfredworkflow)** and double-click it.
2. Alfred asks for your **Meme folder**: point it at the folder with your memes, or at an empty one.
3. No memes yet? `memes` → **Add the starter collection** adds 160 curated memes with notes. Memes you already have are never overwritten.

To update, install the new release the same way. Your memes and their details stay in your folder.

**Curating the starter collection** (maintainers): `bin/link` makes Alfred run straight from the checkout (undo with `bin/link --unlink`). Set *Meme folder* to the repo's `memes/`, and memes you add or edit land there, ready to commit. Every release ships `memes/` as the starter collection.

## Use

| To… | Do |
|---|---|
| Find and copy a meme | `meme shocked` → `↩` → pick it → `↩`, then paste. Typos are fine (`meme shokced`) |
| Preview | `⇧` or `⌘Y` |
| Reveal in Finder / copy path | `⌘↩` / `⌥↩` |
| Edit its details | `⌃↩` in the grid, or `memes` → pick it |
| Remove it | `memes` → select it → `⌘↩` (file goes to the Trash) |
| Add new memes | Select images or short videos in Finder → `⌥⌘\` → **Add to Memes**, or `memes` → **Add the files selected in Finder** |
| Annotate files dropped into the folder by hand | `memes` → **Annotate … without details** |

Typos are forgiven in the words you type after `meme` before pressing `↩`; typing inside an open grid uses Alfred's own, exact filter.

Adding walks you through **title → keywords → notes → source**, then shows an overview where you can still change anything (including the filename) before saving. Keywords are comma-separated; `⇥` completes one already in use. The overview also offers **Cut out the subject**, which removes the background with macOS's built-in subject detection and saves a transparent PNG.

Animated memes are marked with ▶︎ in the grid. Videos (WebM, MP4, MOV) become animated GIFs with transparency kept, because animated WebP doesn't play in PowerPoint; switch to WebP in *Configure Workflow* if you prefer (needs `img2webp`).

Copying puts the file *and* PNG image data on the clipboard, so pasting works in Slack and Mail as well as browsers and web apps. GIFs stay animated and WebP is converted.

## The index

Each meme's details live in `_index.yml` inside your meme folder (see the starter collection's [`memes/_index.yml`](memes/_index.yml)). Search looks at the title, keywords and notes, so a good note (what's in the picture, when to use it) is what makes a meme findable:

```yaml
elmo_on_fire.gif:
  title: elmo on fire
  keywords: [everything is fine, fire, chaos, elmo]
  notes: Elmo with arms raised in front of hellfire. Chaos, everything is burning.
  source: https://giphy.com/...
  added: 2026-10-28
```

You can edit it by hand. Extra fields are kept and searchable. Comments other than the header are dropped when the workflow saves.

## Configure

In Alfred, open **Memes** and click *Configure Workflow* to set:

- the meme folder
- the keywords (`meme`, `memes`)
- the number of grid columns
- auto-paste (needs Accessibility permission for Alfred)
- the animated format: GIF (default, works everywhere) or WebP

To add memes with a hotkey, set one on the workflow's **Hotkey** trigger.

## Develop

| File | Purpose |
|---|---|
| `info.plist` | Workflow definition |
| `src/memes.js` | Grid, management menu, add/edit guide, starter collection, YAML index |
| `src/copy.zsh`, `src/copy.applescript` | Clipboard and auto-paste |
| `src/animate.zsh` | Video → animated GIF/WebP with transparency |
| `memes/` | The starter collection |
| `bin/build`, `bin/link`, `bin/release` | Package, link into Alfred, tag a release |
| `.github/workflows/release.yml` | Publishes `memes.alfredworkflow` and `memes-starter.zip` for each `v*` tag |

### Releasing

Add a `## x.y.z` section to `CHANGELOG.md`, then:

```sh
bin/release x.y.z                       # sets the version in info.plist, commits, tags
git push && git push origin vx.y.z      # GitHub Actions builds and publishes the release
```

A linked repo gets your hotkey written into `info.plist`. Keep it out of commits with:

```sh
git config filter.alfred-plist.clean  ./bin/info-plist-clean
git config filter.alfred-plist.smudge './bin/info-plist-smudge %f'
```

See [AGENTS.md](AGENTS.md) for how it works internally.
