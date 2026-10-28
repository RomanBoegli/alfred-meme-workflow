#!/bin/zsh
# Downloads a Telegram sticker pack into a staging folder via the Bot API.
# Static stickers are kept as WebP, video stickers are converted with
# animate.zsh (skipped without ffmpeg), animated .tgs (Lottie) are skipped.
# Writes <dest>/pack.json and prints a JSON summary.
#
#   telegram_token=… telegram.zsh <pack name> <dest folder>

name=$1 dest=$2
api="https://api.telegram.org/bot$telegram_token"
files="https://api.telegram.org/file/bot$telegram_token"
here=${0:A:h}
path=(/opt/homebrew/bin /usr/local/bin $path)

fail() {
  /usr/bin/jq -nc --arg e "$1" '{ok: false, error: $e}'
  exit 0
}

[[ -n "$telegram_token" ]] || fail "Set a Telegram bot token in Configure Workflow"

set_json=$(curl -sS --max-time 20 "$api/getStickerSet?name=$name" 2>&1) || fail "Could not reach Telegram: $set_json"
[[ $(/usr/bin/jq -r '.ok' <<<"$set_json" 2>/dev/null) == true ]] \
  || fail "Telegram: $(/usr/bin/jq -r '.description // "unexpected response"' <<<"$set_json" 2>/dev/null || echo "$set_json")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$dest"
can_convert=$(command -v ffmpeg >/dev/null && echo 1 || echo 0)

# index, file_id, kind, emoji
/usr/bin/jq -r '.result.stickers | to_entries[]
  | [.key, .value.file_id, (if .value.is_animated then "tgs" elif .value.is_video then "video" else "static" end), (.value.emoji // "")]
  | @tsv' <<<"$set_json" > "$tmp/stickers.tsv"

# 1. resolve file paths, 2. download, both in parallel
: > "$tmp/getfile.cfg"
while IFS=$'\t' read -r i id kind emoji; do
  [[ $kind == tgs || ( $kind == video && $can_convert == 0 ) ]] && continue
  print -r -- "url = \"$api/getFile?file_id=$id\"" >> "$tmp/getfile.cfg"
  print -r -- "output = \"$tmp/$i.json\"" >> "$tmp/getfile.cfg"
done < "$tmp/stickers.tsv"
curl -sS --max-time 60 -Z --parallel-max 8 -K "$tmp/getfile.cfg" 2>/dev/null

: > "$tmp/download.cfg"
for f in "$tmp"/<->.json(N); do
  file_path=$(/usr/bin/jq -r '.result.file_path // empty' "$f")
  [[ -n $file_path ]] || continue
  print -r -- "url = \"$files/$file_path\"" >> "$tmp/download.cfg"
  print -r -- "output = \"$tmp/${f:t:r}.${file_path:e}\"" >> "$tmp/download.cfg"
done
curl -sS --max-time 120 -Z --parallel-max 8 -K "$tmp/download.cfg" 2>/dev/null

stem=${(L)name}
stickers='{}'
added=0 skipped_tgs=0 skipped_video=0 failed=0
while IFS=$'\t' read -r i id kind emoji; do
  base="$dest/${stem}_$(printf %03d $i)"
  out=""
  case $kind in
    tgs) (( skipped_tgs++ )); continue ;;
    video)
      if (( ! can_convert )); then (( skipped_video++ )); continue; fi
      [[ -f "$tmp/$i.webm" ]] && out=$("$here/animate.zsh" "$tmp/$i.webm" "$base" 2>/dev/null) ;;
    static)
      src=("$tmp/$i".(webp|png)(N))
      if (( $#src )); then out="$base.${src[1]:e}"; mv "$src[1]" "$out"; fi ;;
  esac
  if [[ -n $out && -f $out ]]; then
    (( added++ ))
    stickers=$(/usr/bin/jq -c --arg f "${out:t}" --arg e "$emoji" '. + {($f): $e}' <<<"$stickers")
  else
    (( failed++ ))
  fi
done < "$tmp/stickers.tsv"

/usr/bin/jq -n --arg name "$name" --argjson set "$set_json" --argjson stickers "$stickers" \
  '{name: $name, title: $set.result.title, link: "https://t.me/addstickers/\($name)", stickers: $stickers}' > "$dest/pack.json"

/usr/bin/jq -nc --arg title "$(/usr/bin/jq -r '.result.title' <<<"$set_json")" \
  --argjson added $added --argjson tgs $skipped_tgs --argjson video $skipped_video --argjson failed $failed \
  '{ok: true, title: $title, added: $added, skipped_tgs: $tgs, skipped_video: $video, failed: $failed}'
