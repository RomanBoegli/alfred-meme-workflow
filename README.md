# alfred-meme-workflow

Find a meme by name or mood in an [Alfred](https://www.alfredapp.com) thumbnail grid and paste it anywhere. Add, annotate and remove memes without leaving Alfred.

Requires Alfred 5.5+ with the Powerpack and macOS 15+. Optional: `ffmpeg` to turn videos and Telegram video stickers into animated memes (`brew install ffmpeg gifsicle`).

## Install

**[⬇ Download the latest release](https://github.com/RomanBoegli/alfred-meme-workflow/releases/latest/download/memes.alfredworkflow)** and double-click it. Alfred imports it with 160+ annotated memes to start with.

Or from the terminal:

```sh
curl -fsSL -o /tmp/memes.alfredworkflow https://github.com/RomanBoegli/alfred-meme-workflow/releases/latest/download/memes.alfredworkflow && open /tmp/memes.alfredworkflow
```

To update, install the new release the same way; your memes and their details are kept. They live in Alfred's workflow data folder (`~/Library/Application Support/Alfred/Workflow Data/ch.romanboegli.memes/memes`), or in any folder you pick as **Meme folder** in *Configure Workflow*.

**Curating the collection in this repo** (maintainers):

```sh
bin/link            # Alfred runs straight from the checkout; undo with: bin/link --unlink
```

Memes you add or edit then land in `memes/`, ready to commit.

## Use

| To… | Do |
|---|---|
| Find and copy a meme | `meme shocked` → `↩` → pick it → `↩`, then paste. Typos are fine (`meme shokced`) |
| Preview | `⇧` or `⌘Y` |
| Reveal in Finder / copy path | `⌘↩` / `⌥↩` |
| Edit its details | `⌃↩` in the grid, or `memes` → pick it |
| Remove it | `memes` → select it → `⌘↩` (file goes to the Trash) |
| Add new memes | Select images or short videos in Finder → `⌥⌘\` → **Add to Memes**, or `memes` → **Add the files selected in Finder** |
| Import a Telegram sticker pack | `memes https://t.me/addstickers/<pack>` → ↩, then pick stickers from the grid (`↩` one, `⌘↩` all) |
| Annotate files dropped into `memes/` by hand | `memes` → **Annotate … without details** |

Typos are forgiven in the words you type after `meme` before pressing `↩`; typing inside an open grid uses Alfred's own, exact filter.

Adding walks you through **title → keywords → notes → source**, then shows an overview where you can still change anything (including the filename) before saving. Keywords are comma-separated; `⇥` completes one already in use. The overview also offers **Cut out the subject**, which removes the background with macOS's built-in subject detection and saves a transparent PNG.

Animated memes are marked with ▶︎ in the grid. Videos (WebM, MP4, MOV) become animated GIFs with transparency kept, because animated WebP doesn't play in PowerPoint; switch to WebP in *Configure Workflow* if you prefer (needs `img2webp`). Telegram stickers start with their emoji as title and keywords (😂 → "face with tears of joy"); Lottie (`.tgs`) stickers are skipped. Importing needs a bot token: message [@BotFather](https://t.me/BotFather), send `/newbot`, and paste the token into *Configure Workflow*.

Copying puts the file *and* PNG image data on the clipboard, so pasting works in Slack and Mail as well as browsers and web apps. GIFs stay animated and WebP is converted.

## The index

Each meme's details live in [`memes/_index.yml`](memes/_index.yml). Search looks at the title, keywords and notes, so a good note (what's in the picture, when to use it) is what makes a meme findable:

```yaml
elmo_on_fire.gif:
  title: elmo on fire
  keywords: [everything is fine, fire, chaos, elmo]
  notes: Animated: Elmo with arms raised in front of hellfire. Chaos, everything is burning.
  source: https://giphy.com/...
  added: 2026-10-28
```

You can edit it by hand. Extra fields are kept and searchable. Comments other than the header are dropped when the workflow saves.

## Configure

In Alfred, open **Memes** and click *Configure Workflow* to set:

- the keywords (`meme`, `memes`)
- the number of grid columns
- auto-paste (needs Accessibility permission for Alfred)
- the animated format: GIF (default, works everywhere) or WebP
- the meme folder (empty means Alfred's workflow data folder, or `memes/` in a linked checkout)
- the Telegram bot token, for sticker imports (stored locally by Alfred, never committed)

To add memes with a hotkey, set one on the workflow's **Hotkey** trigger.

## Develop

| File | Purpose |
|---|---|
| `info.plist` | Workflow definition |
| `src/memes.js` | Grid, management menu, add/edit guide, YAML index |
| `src/copy.zsh`, `src/copy.applescript` | Clipboard and auto-paste |
| `src/telegram.zsh` | Downloads a sticker pack via the Bot API |
| `src/animate.zsh` | Video → animated GIF/WebP with transparency |
| `bin/build`, `bin/link`, `bin/release` | Package, link into Alfred, tag a release |
| `.github/workflows/release.yml` | Publishes `memes.alfredworkflow` for each `v*` tag |

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
