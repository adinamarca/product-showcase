#!/usr/bin/env bash
# Entry point of the showcase kit. Run it from the folder that holds your
# showcase.config.mjs (or pass --config).
#
#   showcase.sh doctor                     # check tools, install Playwright + Chromium
#   showcase.sh coverage [theme ...]       # screenshots of coverage.pages, fail on empty states
#   showcase.sh record [--theme dark] [scene ...]
#   showcase.sh encode [theme] [scene ...]
#   showcase.sh gallery                    # dist/index.html + dist/EMBED.md
#   showcase.sh all [--theme dark] [scene ...]   # coverage → record → encode → gallery
#   showcase.sh sheet <gif> <out.png> [n]  # contact sheet of a GIF
set -euo pipefail

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cmd="${1:-help}"
[[ $# -gt 0 ]] && shift

ensure_node_modules() {
  if [[ ! -d "$KIT/node_modules/playwright" ]]; then
    echo "→ Installing the kit's Node dependencies (once)" >&2
    (cd "$KIT" && npm install --no-fund --no-audit --loglevel=error)
  fi
}

case "$cmd" in
  doctor)
    missing=()
    for tool in node npm ffmpeg gifski gifsicle cwebp; do
      command -v "$tool" >/dev/null || missing+=("$tool")
    done
    if ((${#missing[@]})); then
      echo "✗ Missing: ${missing[*]}" >&2
      echo "  macOS: brew install node ffmpeg gifski gifsicle webp" >&2
      echo "  Arch/CachyOS: sudo pacman -S nodejs npm ffmpeg gifski gifsicle libwebp" >&2
      exit 1
    fi
    ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libsvtav1 \
      || echo "! ffmpeg has no libsvtav1: the AV1 WebM will be skipped (MP4 + GIF still work)"
    ensure_node_modules
    (cd "$KIT" && npx playwright install chromium)
    python3 -c 'import PIL' 2>/dev/null || echo "· Optional: pip install pillow (only for 'sheet')"
    echo "✓ Ready"
    ;;
  coverage|record|encode|gallery)
    ensure_node_modules
    node "$KIT/bin/$cmd.mjs" "$@"
    ;;
  all)
    ensure_node_modules
    # Split --config/--theme from the scene names for each step.
    config=(); theme=(); scenes=()
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --config) config=(--config "$2"); shift ;;
        --theme) theme=("$2"); shift ;;
        *) scenes+=("$1") ;;
      esac
      shift
    done
    node "$KIT/bin/coverage.mjs" ${config[@]+"${config[@]}"} ${theme[@]+"${theme[@]}"}
    node "$KIT/bin/record.mjs" ${config[@]+"${config[@]}"} ${theme[@]+--theme "${theme[@]}"} ${scenes[@]+"${scenes[@]}"}
    node "$KIT/bin/encode.mjs" ${config[@]+"${config[@]}"} ${theme[@]+"${theme[@]}"} ${scenes[@]+"${scenes[@]}"}
    node "$KIT/bin/gallery.mjs" ${config[@]+"${config[@]}"}
    echo "✓ Open dist/index.html to review"
    ;;
  sheet)
    python3 "$KIT/bin/contact-sheet.py" "$@"
    ;;
  *)
    sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
    [[ "$cmd" == help || "$cmd" == -h || "$cmd" == --help ]] || exit 1
    ;;
esac
