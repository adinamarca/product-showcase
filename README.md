# product-showcase

A Claude Code skill that builds product sites with video and GIF walkthroughs of a web app, together with the **capture kit** the skill uses to record them.

The kit:
- **Records losslessly at 2×**, in slow motion, with a cursor that moves like a hand.
- **Produces files for the landing page:** AV1 and H.264 video, a WebP poster and a fallback GIF.
- **Produces files for email:** a cropped GIF and its first frame as a JPG.
- **Enforces file sizes:** every file has a size budget, and the run fails if any exceeds it.

## Installation

```bash
git clone git@github.com:adinamarca/product-showcase.git ~/.claude/skills/product-showcase
~/.claude/skills/product-showcase/kit/showcase.sh doctor
```

`doctor` checks for `ffmpeg`, `gifski`, `gifsicle` and `cwebp`, and installs Playwright and Chromium inside `kit/` (first run only). If any are missing:

- macOS: `brew install ffmpeg gifski gifsicle webp`
- Arch / CachyOS: `sudo pacman -S ffmpeg gifski gifsicle libwebp`

If your `ffmpeg` has no `libsvtav1`, the WebM (AV1) is skipped. The MP4 and the GIF still cover every browser.

## Usage

In Claude Code: `/product-showcase` (or ask for "a showcase of the app"). To use the kit by hand:

```bash
mkdir -p showcase && cp ~/.claude/skills/product-showcase/templates/* showcase/
cd showcase                       # edit showcase.config.mjs and scenes.mjs
KIT=~/.claude/skills/product-showcase/kit
$KIT/showcase.sh coverage         # screenshots of each page; fails if any shows an empty state
$KIT/showcase.sh record           # records every scene in every theme
$KIT/showcase.sh encode           # videos and GIFs, each within its size budget
$KIT/showcase.sh gallery          # dist/index.html (review) and dist/EMBED.md (snippets)
$KIT/showcase.sh all              # all four steps in a row
$KIT/showcase.sh record --theme dark 02-search   # one scene, one theme
$KIT/showcase.sh sheet dist/light/email/02-search.gif sheet.png   # grid of frames
```

## Example

`example/` contains a static demo app (sign-in, light and dark themes, a chart, search and a form) with its config and three scenes. Use it to test the kit end to end:

```bash
python3 -m http.server 8799 -d example/app &
cd example && ../kit/showcase.sh all      # ~5 min on an Apple Silicon Mac
open dist/index.html
```

## Layout

| Path | What it is |
|---|---|
| `SKILL.md` | The skill. Based on jezweb's, with capture and GIFs replaced by the kit |
| `kit/showcase.sh` | Entry point: `doctor`, `coverage`, `record`, `encode`, `gallery`, `all`, `sheet` |
| `kit/lib/config.mjs` | Loads `showcase.config.mjs` and defines the defaults (every key is commented) |
| `kit/lib/browser.mjs` | A Playwright context per theme, slow motion (CDP and Chart.js), a visible cursor, human-like `glide()`, smooth scrolling, `settle()` and the other helpers scenes receive as `h` |
| `kit/lib/recorder.mjs` | Records lossless 2× PNG frames and marks the email clip (`clipStart` / `clipEnd`) and capture pauses (`hold`) |
| `kit/bin/record.mjs` | Runs the scenes, with a shared session, one per scene, or none |
| `kit/bin/encode.mjs` | Encodes with ffmpeg, gifski, gifsicle and cwebp. When a file is over budget, it lowers quality step by step. Writes `dist/manifest.json` |
| `kit/bin/gallery.mjs` | Writes `dist/index.html` and `dist/EMBED.md` |
| `kit/bin/coverage.mjs` | Walks the configured pages, saves screenshots and fails on empty states |
| `kit/bin/contact-sheet.py` | Builds a grid of frames from a GIF (needs Pillow) |
| `templates/` | `showcase.config.mjs` and `scenes.mjs` to copy into a project |
| `example/` | Demo app with its config and scenes |

## License

MIT. `SKILL.md` is derived from [jezweb/claude-skills](https://github.com/jezweb/claude-skills), also MIT; see `NOTICE.md`.
