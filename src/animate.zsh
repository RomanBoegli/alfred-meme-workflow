#!/bin/zsh
# Converts a video (e.g. a Telegram .webm sticker) into an animated image and
# keeps its transparency: animated WebP when img2webp is installed, else GIF.
# Needs ffmpeg. Prints the path of the file it wrote.
#
#   animate.zsh <input> <output path without extension>

set -e
input=$1 output=$2
path=(/opt/homebrew/bin /usr/local/bin $path)

command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 1; }

probe() {
  ffprobe -v error -select_streams v:0 -show_entries stream=$1 -of csv=p=0 "$input"
}

# ffmpeg's native VP8/VP9 decoders drop the alpha channel, libvpx keeps it
decoder=()
case $(probe codec_name) in
  vp9) decoder=(-c:v libvpx-vp9) ;;
  vp8) decoder=(-c:v libvpx) ;;
esac

fps=$(probe avg_frame_rate)
(( ${fps%/*} > 0 && ${fps#*/} > 0 )) || fps=30/1
filters="scale='min(512,iw)':-2:flags=lanczos"
if (( ${fps%/*} > 30 * ${fps#*/} )); then
  filters="fps=30,$filters"
  fps=30/1
fi

if command -v img2webp >/dev/null; then
  frames=$(mktemp -d)
  trap 'rm -rf "$frames"' EXIT
  ffmpeg -v error $decoder -i "$input" -t 10 -an -vf "$filters" -pix_fmt rgba "$frames/%04d.png"
  img2webp -loop 0 -lossy -q 80 -d $(( 1000 * ${fps#*/} / ${fps%/*} )) "$frames"/*.png -o "$output.webp" >/dev/null 2>&1
  echo "$output.webp"
else
  ffmpeg -v error -y $decoder -i "$input" -t 10 -an \
    -filter_complex "[0:v]$filters,split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128" \
    -loop 0 "$output.gif"
  echo "$output.gif"
fi
