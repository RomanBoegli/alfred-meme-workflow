# alfred-meme-workflow

Find a meme by name or mood in an [Alfred](https://www.alfredapp.com) thumbnail grid and paste it anywhere. Add, annotate and remove memes without leaving Alfred.

Requires Alfred 5.5+ with the Powerpack and macOS 15+. Optional: `ffmpeg` (plus `img2webp` from `webp`) to turn videos and Telegram video stickers into animated memes: `brew install ffmpeg webp`.

## Install

**Linked to this repo** (recommended if you curate the collection):

```sh
bin/link            # undo with: bin/link --unlink
```

Alfred uses the repo directly, so memes you add or edit land in `memes/`, ready to commit.

**Standalone** (memes bundled, e.g. for another Mac):

```sh
bin/build && open memes.alfredworkflow
```

Then disable any older meme workflow that uses the `meme` keyword.

## Use

| To… | Do |
|---|---|
| Find and copy a meme | `meme` or `meme shocked` → pick it → `↩`, then paste |
| Preview | `⇧` or `⌘Y` |
| Reveal in Finder / copy path | `⌘↩` / `⌥↩` |
| Edit its details | `⌃↩` in the grid, or `memes` → pick it |
| Remove it | `memes` → select it → `⌘↩` (file goes to the Trash) |
| Add new memes | Select images or short videos in Finder → `⌥⌘\` → **Add to Memes**, or `memes` → **Add the files selected in Finder** |
| Import a Telegram sticker pack | `memes https://t.me/addstickers/<pack>` → ↩, then pick stickers from the grid (`↩` one, `⌘↩` all) |
| Annotate files dropped into `memes/` by hand | `memes` → **Annotate … without details** |

Adding walks you through **title → keywords → notes → source**, then shows an overview where you can still change anything (including the filename) before saving. Keywords are comma-separated; `⇥` completes one already in use. The overview also offers **Cut out the subject**, which removes the background with macOS's built-in subject detection and saves a transparent PNG.

Videos (WebM, MP4, MOV) become animated WebP, or GIF without `img2webp`, with transparency kept. Telegram stickers start with their emoji as title and keywords (😂 → "face with tears of joy"); Lottie (`.tgs`) stickers are skipped. Importing needs a bot token: message [@BotFather](https://t.me/BotFather), send `/newbot`, and paste the token into *Configure Workflow*.

Copying puts the file *and* PNG image data on the clipboard, so pasting works in Slack and Mail as well as browsers and web apps. GIFs stay animated and WebP is converted.

## The index

Each meme's details live in [`memes/index.yaml`](memes/index.yaml):

```yaml
elmo_on_fire.gif:
  title: elmo on fire
  keywords: [everything is fine, fire, chaos, elmo]
  notes: For production incidents.
  source: https://giphy.com/...
  added: 2026-10-28
```

You can edit it by hand. Extra fields are kept and searchable. Comments other than the header are dropped when the workflow saves.

## Configure

In Alfred, open **Memes** and click *Configure Workflow* to set:

- the keywords (`meme`, `memes`)
- the number of grid columns
- auto-paste (needs Accessibility permission for Alfred)
- the meme folder (empty means the folder next to the workflow)
- the Telegram bot token, for sticker imports (stored locally by Alfred, never committed)

To add memes with a hotkey, set one on the workflow's **Hotkey** trigger.

## Develop

| File | Purpose |
|---|---|
| `info.plist` | Workflow definition |
| `src/memes.js` | Grid, management menu, add/edit guide, YAML index |
| `src/copy.zsh`, `src/copy.applescript` | Clipboard and auto-paste |
| `src/telegram.zsh` | Downloads a sticker pack via the Bot API |
| `src/animate.zsh` | Video → animated WebP/GIF with transparency |
| `bin/build`, `bin/link` | Package / link into Alfred |

A linked repo gets your hotkey written into `info.plist`. Keep it out of commits with:

```sh
git config filter.alfred-plist.clean  ./bin/info-plist-clean
git config filter.alfred-plist.smudge './bin/info-plist-smudge %f'
```

See [AGENTS.md](AGENTS.md) for how it works internally.
