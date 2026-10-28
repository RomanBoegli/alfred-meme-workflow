# alfred-meme-workflow

[Alfred](https://www.alfredapp.com) workflow to find a meme by name or mood in a thumbnail grid and paste it anywhere, and to grow and curate the collection without leaving Alfred.

Requires Alfred 5.5+ with the Powerpack and macOS 15 or later. No other dependencies.

## Install

To keep the collection in this repo (recommended if you add memes):

```sh
bin/link
```

This links the repo into Alfred. Memes you add or edit through the workflow land in `memes/` here, ready to commit.

To install a standalone copy with the current memes bundled, for example on another Mac:

```sh
bin/build
open memes.alfredworkflow
```

## Search

`meme` opens a grid of all memes. Type to filter by title, keywords or notes. `meme shocked` opens the grid already filtered.

Key combination        | Action
---------------------- | ------
`enter`                | Copy the meme to the clipboard
`cmd` + `enter`        | Reveal in Finder
`alt` + `enter`        | Copy the file path
`ctrl` + `enter`       | Edit its details
`shift` or `cmd` + `y` | Quick Look preview (GIFs animate)

The clipboard holds the file itself plus PNG image data (and GIF data for GIFs). Slack, Teams and Mail attach the original file; browsers, Google Docs and WhatsApp Web paste the image. WebP is converted to PNG on the fly.

## Manage the collection

### Add memes

Select one or more images in Finder, then either

- press Alfred's Universal Action hotkey (default `⌥⌘\`) and choose **Add to Memes**,
- press the workflow's hotkey (set one on the Hotkey trigger in Alfred), or
- type `memes` and choose **Add the files selected in Finder**.

A short guide then asks for each image's

1. **title** – shown in the grid, also used for the filename,
2. **keywords** – comma-separated; Alfred suggests keywords already in use, `tab` completes one,
3. **notes** – optional,
4. **source** – optional, e.g. a URL,

and shows an overview where you can still change anything, including the filename, before saving. The image is copied into the collection; the original stays where it was.

### Edit and remove

`memes` lists every meme; pick one to edit its details, or press `cmd` + `enter` to remove it. `ctrl` + `enter` in the grid does the same. Removing moves the file to the Trash and deletes its entry.

`memes` also offers to annotate images that were dropped into `memes/` without details and to remove index entries whose file is gone. If you leave a guide halfway, `memes` offers to continue it.

### The index

Details live in [`memes/index.yaml`](memes/index.yaml), one entry per file:

```yaml
elmo_on_fire.gif:
  title: elmo on fire
  keywords: [everything is fine, fire, chaos, burn, evil, elmo]
  notes: |
    For production incidents.
  source: https://giphy.com/...
  added: 2026-10-28
```

Edit it by hand if you like. Fields other than these are kept and searchable. Comments other than the header are not kept when the workflow saves.

## Configuration

Open the workflow in Alfred and click *Configure Workflow*:

- **Search keyword** (`meme`) and **Manage keyword** (`memes`)
- **Grid columns** – default 5
- **Auto-paste** – paste straight into the frontmost app after copying; Alfred needs Accessibility permission
- **Meme folder** – empty uses the memes next to the workflow; set it to use another folder, e.g. the `memes/` of a git checkout when you installed the standalone copy

## Development

File                    | Purpose
----------------------- | -------
`info.plist`            | Alfred workflow definition (objects, connections, configuration)
`src/memes.js`          | Grid items, management menu, add/edit guide, actions, `index.yaml` reader/writer
`src/copy.zsh`          | Copies the meme, optionally pastes
`src/copy.applescript`  | Writes file URL, PNG and GIF data to the clipboard
`bin/build`             | Builds `memes.alfredworkflow`
`bin/link`              | Links the repo into Alfred (`--unlink` to undo)

When the repo is linked, Alfred writes your hotkey into `info.plist`. A git filter keeps it out of commits; enable it once per clone:

```sh
git config filter.alfred-plist.clean  ./bin/info-plist-clean
git config filter.alfred-plist.smudge './bin/info-plist-smudge %f'
```
