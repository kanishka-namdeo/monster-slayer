#!/bin/bash
# ============================================================
# MONSTER SLAYER — media production
# webm (MediaRecorder capture) -> normalized MP4, chapter clips,
# trailer GIF. All cuts derived from marks.json timestamps.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/out"

THREADS=1   # container has 2 cores / 4GB — keep ffmpeg single-threaded

echo "=== 1/3 full playthrough MP4 (loudness-normalized) ==="
ffmpeg -y -threads $THREADS -hide_banner -loglevel error -i playthrough.webm \
  -vf "format=yuv420p" \
  -c:v libx264 -preset medium -crf 21 -profile:v high -level 4.1 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:a aac -b:a 128k -ar 44100 \
  -movflags +faststart \
  playthrough-full.mp4
echo "full: $(du -h playthrough-full.mp4 | cut -f1)"

echo "=== 2/3 chapter clips ==="
# read marks from json (node one-liner)
read -r OFFSET CH1E CH2E CH3E CH4E CH5E <<<"$(node -e '
const m = require("./marks.json").marks;
const get = (n) => m.find((x) => x.name === n).t;
const off = get("start");
const vals = [off, get("world"), get("swamp"), get("graveyard"), get("oldewood"), get("end")]
  .map((t) => Math.max(0, t - off).toFixed(2));
console.log(vals.join(" "));
')"

clip() { # clip <start> <end> <name>
  local s=$1 e=$2 name=$3
  local dur
  dur=$(node -e "console.log(($e - $s).toFixed(2))")
  ffmpeg -y -threads $THREADS -hide_banner -loglevel error \
    -ss "$s" -i playthrough-full.mp4 -t "$dur" \
    -c:v libx264 -preset medium -crf 21 -profile:v high -level 4.1 \
    -c:a aac -b:a 128k -movflags +faststart \
    "chapter-$name.mp4"
  echo "chapter-$name.mp4: $(du -h "chapter-$name.mp4" | cut -f1) [$s -> $e]"
}

clip 0        "$CH1E" "1-title-and-intro"
clip "$CH1E"  "$CH2E" "2-hollow-creek"
clip "$CH2E"  "$CH3E" "3-first-hunt"
clip "$CH3E"  "$CH4E" "4-the-weeping-widow"
clip "$CH4E"  "$CH5E" "5-heart-of-oldewood"

echo "=== 3/3 trailer GIF ==="
# highlight segments (from the normalized full)
seg() { # seg <start> <dur> <idx>
  ffmpeg -y -threads $THREADS -hide_banner -loglevel error \
    -ss "$1" -i playthrough-full.mp4 -t "$2" \
    -vf "fps=12,scale=480:432:flags=neighbor,format=rgb24" \
    "gifseg-$3.mp4"
}
# title, first steps & board, swamp battle + igni, moral choice, werewolf, leshen, ending
LESHEN_MARK=$(node -e 'const m=require("./marks.json").marks;console.log((m.find(x=>x.name==="leshen").t - m.find(x=>x.name==="start").t).toFixed(2))')
ENDING_MARK=$(node -e 'const m=require("./marks.json").marks;console.log((m.find(x=>x.name==="ending").t - m.find(x=>x.name==="start").t).toFixed(2))')
BATTLE_MARK=$(node -e 'const m=require("./marks.json").marks;console.log((m.find(x=>x.name==="battle1").t - m.find(x=>x.name==="start").t).toFixed(2))')
CHOICE_MARK=$(node -e 'const m=require("./marks.json").marks;console.log((m.find(x=>x.name==="moral-choice").t - m.find(x=>x.name==="start").t).toFixed(2))')
WW_MARK=$(node -e 'const m=require("./marks.json").marks;console.log((m.find(x=>x.name==="werewolf").t - m.find(x=>x.name==="start").t).toFixed(2))')

seg 0.5        5 1        # title screen
seg "$BATTLE_MARK" 6 2    # swamp encounter + fight
seg "$CHOICE_MARK" 5 3    # the moral choice
seg "$WW_MARK"  5 4       # werewolf
seg "$LESHEN_MARK" 6 5    # leshen finale
seg "$ENDING_MARK" 4 6    # ending

printf "file 'gifseg-1.mp4'\nfile 'gifseg-2.mp4'\nfile 'gifseg-3.mp4'\nfile 'gifseg-4.mp4'\nfile 'gifseg-5.mp4'\nfile 'gifseg-6.mp4'\n" > giflist.txt
ffmpeg -y -threads $THREADS -hide_banner -loglevel error -f concat -safe 0 -i giflist.txt -c copy gif-concat.mp4
ffmpeg -y -threads $THREADS -hide_banner -loglevel error -i gif-concat.mp4 \
  -vf "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  trailer.gif
echo "trailer.gif: $(du -h trailer.gif | cut -f1)"

rm -f gifseg-*.mp4 giflist.txt gif-concat.mp4 test10.mp4 probe.webm 2>/dev/null || true
echo "=== DONE ==="
ls -la *.mp4 *.gif 2>/dev/null || ls -la
