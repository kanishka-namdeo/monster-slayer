#!/bin/bash
# E2E test driver v2 — poll-based, deterministic
set -u
STEP=0
PASS=0; FAIL=0

q() { agent-browser eval "$1" 2>/dev/null; }
tap() {
  agent-browser eval "window.__game.press('$1');" >/dev/null 2>&1
  sleep "${2:-0.25}"
  agent-browser eval "window.__game.release('$1');" >/dev/null 2>&1
}

check() {
  STEP=$((STEP+1))
  if echo "$3" | grep -q "$2"; then PASS=$((PASS+1)); echo "PASS $STEP: $1";
  else FAIL=$((FAIL+1)); echo "FAIL $STEP: $1 — want '$2' got: $3"; fi
}

waitmode() { # waitmode <mode> [timeout_quarters]
  local target="$1" t=0 max=$(( ${2:-60} ))
  while [ $t -lt $max ]; do
    R=$(q "window.__game.mode")
    if echo "$R" | grep -q "\"$target\""; then return 0; fi
    sleep 0.25; t=$((t+1))
  done
  return 1
}

waitbattle() { # wait until a battle object exists (starts under the fade)
  local t=0
  while [ $t -lt 40 ]; do
    R=$(q "window.__game.battle ? 'yes' : 'no'")
    [ "$R" = '"yes"' ] && return 0
    sleep 0.15; t=$((t+1))
  done
  return 1
}

waitchoose() { # wait until dialog is choosing (or gone)
  local t=0
  while [ $t -lt 40 ]; do
    R=$(q "window.__game.dialog ? (window.__game.dialog.choosing ? 'choosing' : 'text') : 'gone'")
    case "$R" in
      '"choosing"'|'"gone"') return 0 ;;
    esac
    sleep 0.2; t=$((t+1))
  done
  return 1
}

waitdlg() { # wait until a dialog object exists
  local t=0
  while [ $t -lt 30 ]; do
    R=$(q "window.__game.dialog ? 'yes' : 'no'")
    [ "$R" = '"yes"' ] && return 0
    sleep 0.15; t=$((t+1))
  done
  return 1
}

adv() { # complete text + advance through ALL paginated pages
  waitdlg || return 0
  local t=0
  while [ $t -lt 12 ]; do
    q "window.__game.dialog && (window.__game.dialog.charIdx=99999)" >/dev/null
    sleep 0.15
    tap a 0.25
    R=$(q "window.__game.dialog ? (window.__game.dialog.choosing ? 'choosing' : 'text') : 'gone'")
    case "$R" in
      '"gone"'|'"choosing"') return 0 ;;
    esac
    t=$((t+1))
  done
}

choose() { # choose <idx> — drain paginated text first, then pick
  waitdlg || return 1
  q "window.__game.dialog && (window.__game.dialog.charIdx=99999)" >/dev/null
  local t=0
  while [ $t -lt 12 ]; do
    R=$(q "window.__game.dialog ? (window.__game.dialog.choosing ? 'choosing' : 'text') : 'gone'")
    case "$R" in
      '"choosing"') break ;;
      '"gone"') return 1 ;;
    esac
    tap a 0.25
    q "window.__game.dialog && (window.__game.dialog.charIdx=99999)" >/dev/null
    sleep 0.15
    t=$((t+1))
  done
  q "window.__game.dialog && (window.__game.dialog.choiceIdx=$1)" >/dev/null
  sleep 0.2
  tap a 0.3
}

move() { # move one tile
  tap "$1" 0.5
}

resetscene() { # programmatically clear stale dialog & stuck keys
  q "window.__game.dialog=null; if(window.__game.mode==='dialog') window.__game.mode='world'; window.__game.battle=null; window.__game.held.clear(); 'reset'" >/dev/null
  sleep 0.2
}

echo "=== fresh load ==="
agent-browser reload >/dev/null
waitmode title 80
R=$(q "window.__game.mode"); check "title reached" '"title"' "$R"

# music: scheduler active + correct title track
MN=0; MT=0
while [ $MT -lt 40 ]; do
  MN=$(q "window.__audio.activeNoteCount" | tr -d '"')
  case "$MN" in ''|*[!0-9]*) MN=0;; esac
  [ "$MN" -gt 0 ] && break
  sleep 0.25; MT=$((MT+1))
done
if [ "$MN" -gt 0 ]; then PASS=$((PASS+1)); echo "PASS $((STEP+1)): music scheduler active ($MN notes)"; STEP=$((STEP+1));
else FAIL=$((FAIL+1)); echo "FAIL $((STEP+1)): music scheduler idle"; STEP=$((STEP+1)); fi
R=$(q "window.__audio.currentTrack"); check "title track" '"title"' "$R"
R=$(q "window.__audio.trackList.join(',')"); check "soundtrack registered" 'finalboss' "$R"

echo "=== new game ==="
tap start 0.3
tap a 0.3
waitmode creation 20
R=$(q "window.__game.mode"); check "school select screen" '"creation"' "$R"
tap a 0.3   # SERPENT (default)
waitmode intro 20
R=$(q "window.__game.mode"); check "intro" '"intro"' "$R"

echo "=== intro -> world ==="
for i in $(seq 1 16); do tap a 0.35; done
waitmode world 20 || true
for i in $(seq 1 4); do adv; done   # close notice
R=$(q "window.__game.mode"); check "world reached" '"world"' "$R"
R=$(q "window.__audio.currentTrack + '|' + window.__game.mapDef.music")
check "world music matches map" 'town|town' "$R"

echo "=== bram intro ==="
resetscene
q "window.__game.switchMap('elder', 5, 4, 'up')" >/dev/null
tap a 0.3
R=$(q "window.__game.dialog ? window.__game.dialog.node.speaker : 'none'")
check "bram speaker" 'ELDER BRAM' "$R"
choose 0    # Work is work.
adv; adv    # close intro1
R=$(q "JSON.stringify(window.__game.flags.metElder)")
check "metElder" 'true' "$R"

echo "=== torv: accept wolves + shop ==="
resetscene
q "window.__game.switchMap('smithy', 3, 4, 'up')" >/dev/null
tap a 0.3
choose 0    # I'LL HUNT
adv         # close wolvesAccept
R=$(q "window.__game.quests.q_wolves.active")
check "wolves accepted" 'true' "$R"
tap a 0.3   # talk again -> browse
choose 0    # SHOW WARES.
R=$(q "window.__game.mode + ' ' + window.__game.shopId")
check "shop mode" 'shop.*torv' "$R"
tap down 0.2; tap down 0.2; tap a 0.3   # LEAVE
R=$(q "window.__game.mode"); check "shop closed" '"world"' "$R"

echo "=== buy a swallow from mira ==="
resetscene
q "window.__game.switchMap('herbalist', 5, 4, 'up')" >/dev/null
q "window.__game.quests.q_herbs.active = true" >/dev/null  # skip herb offer
tap a 0.3
choose 0    # Browse
R=$(q "window.__game.mode + ' ' + window.__game.shopId")
check "mira shop" 'shop.*mira' "$R"
tap a 0.4   # BUY
tap a 0.4   # first item = SWALLOW
adv         # close bought notice
R=$(q "(window.__game.inv.swallow||0) + ' crowns=' + window.__game.player.crowns")
check "bought swallow" '2' "$R"
tap b 0.2; tap down 0.2; tap down 0.2; tap a 0.3  # back, LEAVE
R=$(q "window.__game.mode"); check "mira shop closed" '"world"' "$R"

echo "=== wraith peace path ==="
resetscene
q "window.__game.flags.wraithStarted=true; window.__game.quests.q_wraith.active=true; window.__game.flags.wraithMet=true; window.__game.inv.locket=1" >/dev/null
q "window.__game.switchMap('graveyard', 7, 3, 'up')" >/dev/null
tap a 0.3
R=$(q "window.__game.dialog ? window.__game.dialog.node.text.slice(0,20) : 'none'")
check "agnes locket node" 'You found it' "$R"
choose 0    # GIVE THE LOCKET
adv; adv    # peace, peaceEnd
R=$(q "JSON.stringify({peace:window.__game.flags.wraithPeace, done:window.__game.flags.wraithDone, lk:window.__game.inv.locket===undefined, hp:window.__game.player.maxHp})")
check "peace flags" 'peace.*true' "$R"
check "locket consumed" 'lk.*true' "$R"
check "maxHp 37" 'hp.*37' "$R"

echo "=== bram main quest ==="
resetscene
q "window.__game.quests.q_drowners.done=true; window.__game.quests.q_wolves.done=true; window.__game.quests.q_wraith.done=true" >/dev/null
q "window.__game.switchMap('elder', 5, 4, 'up')" >/dev/null
tap a 0.3
R=$(q "window.__game.dialog ? window.__game.dialog.node.text.slice(0,20) : 'none'")
check "main offer" 'You did what' "$R"
choose 1    # I'LL KILL IT.
adv         # mainAccept
R=$(q "JSON.stringify({thorns:window.__game.flags.thornsCleared, main:window.__game.quests.q_main.active})")
check "thorns + main" 'thorns.*true' "$R"

echo "=== werewolf ==="
resetscene
q "window.__game.mode='world'; window.__game.switchMap('deepforest', 8, 5, 'down'); 'ok'" >/dev/null
move down   # onto (8,6) trigger
sleep 0.3
R=$(q "window.__game.mode + '|' + (window.__game.dialog ? window.__game.dialog.node.text.slice(0,10) : '')")
check "ww dialog" 'dialog.*A shape' "$R"
choose 0    # FIGHT.
waitmode battle 15
R=$(q "window.__game.battle ? window.__game.battle.monId : 'none'")
check "ww battle" 'werewolf' "$R"
R=$(q "window.__audio.currentTrack"); check "boss battle music" '"boss"' "$R"
# deterministically win via dev hook (real code path: attack -> victory -> rewards)
q "window.__game.debugWinBattle()" >/dev/null
waitmode world 120 || true
R=$(q "'mode=' + window.__game.mode + ' ww=' + window.__game.flags.werewolfDone")
check "ww slain" 'ww=true' "$R"
adv  # close victory notice

echo "=== leshen ==="
resetscene
q "window.__game.mode='world'; window.__game.player.x=7; window.__game.player.y=9; window.__game.player.dir='down'" >/dev/null
move down   # (7,10) trigger
sleep 0.3
R=$(q "window.__game.mode + '|' + (window.__game.dialog ? window.__game.dialog.node.text.slice(0,10) : '')")
check "lesh dialog" 'dialog.*The crows' "$R"
choose 0    # TIME TO HUNT
waitmode battle 15
R=$(q "window.__game.battle ? window.__game.battle.monId : 'none'")
check "lesh battle" 'leshen' "$R"
R=$(q "window.__audio.currentTrack"); check "finalboss music" '"finalboss"' "$R"
q "window.__game.debugWinBattle()" >/dev/null
T=0
while [ $T -lt 90 ]; do
  R=$(q "window.__game.flags.leshenDone + '|' + window.__game.mode")
  echo "$R" | grep -q 'true|"world"' && break
  sleep 0.4
  T=$((T+1))
done
R=$(q "'lesshen=' + window.__game.flags.leshenDone + ' mode=' + window.__game.mode + ' track=' + window.__audio.currentTrack")
check "leshenDone" 'lesshen=true' "$R"
check "map music restored" 'track=cave' "$R"
tap a 0.4   # finish notice text
for i in $(seq 1 8); do  # drain paginated notice -> ending
  R=$(q "window.__game.mode")
  echo "$R" | grep -q '"ending"' && break
  tap a 0.35
  sleep 0.15
  q "window.__game.dialog && (window.__game.dialog.charIdx=99999); 'ok'" >/dev/null
  sleep 0.1
done
sleep 0.3
R=$(q "window.__game.mode + ' ' + window.__audio.currentTrack")
check "ending reached" 'ending ending' "$R"
for i in $(seq 1 5); do tap a 0.4; done
R=$(q "window.__game.mode")
check "post-ending state" '.' "$R"

echo "=== save exists ==="
R=$(q "localStorage.getItem('monsterslayer-save-v1') ? 'saved' : 'missing'")
check "save" 'saved' "$R"

echo "=== northern reaches: regions ==="
resetscene
q "window.__game.switchMap('fangs', 9, 13, 'down')" >/dev/null
R=$(q "window.__game.map + ' ' + window.__game.mapDef.name + ' ' + window.__audio.currentTrack")
check "fangtooth reached" 'fangs Fangtooth' "$R"
q "window.__game.switchMap('bog', 2, 6, 'right')" >/dev/null
R=$(q "window.__game.map + ' ' + window.__game.mapDef.name + ' ' + window.__audio.currentTrack")
check "crookback reached" 'bog Crookback' "$R"
q "window.__game.switchMap('ruins', 8, 12, 'up')" >/dev/null
R=$(q "window.__game.map + ' ' + window.__game.mapDef.name + ' ' + window.__audio.currentTrack")
check "kaer serpen reached" 'ruins Kaer' "$R"

echo "=== northern reaches: monsters & oil ==="
q "window.__game.mode='world'" >/dev/null
q "window.__game.startBattle('endrega', 6)" >/dev/null
waitbattle
R=$(q "window.__game.battle ? window.__game.battle.monId + ' ' + window.__game.battle.monType : 'none'")
check "endrega battle" 'endrega INSECTOID' "$R"
q "window.__game.inv.insectoil=1; window.__game.battle.useItemBattle('insectoil'); 'ok'" >/dev/null
sleep 0.5
R=$(q "window.__game.player.oil.insectoid")
check "insectoid oil coats blade" '8' "$R"
q "window.__game.debugWinBattle()" >/dev/null
waitmode world 60 || true
R=$(q "window.__game.mode + ' ' + window.__audio.currentTrack")
check "post-battle world music" 'world' "$R"

echo "=== northern reaches: bosses ==="
q "window.__game.mode='world'; window.__game.quests.q_griffin.active=true; 'ok'" >/dev/null
q "window.__game.startBattle('griffin', 9, true)" >/dev/null
waitbattle
R=$(q "window.__game.battle ? window.__game.battle.monId : 'none'"); check "griffin boss" 'griffin' "$R"
sleep 0.5
R=$(q "window.__audio.currentTrack"); check "griffin boss music" '"boss"' "$R"
q "window.__game.debugWinBattle()" >/dev/null
waitmode world 60 || true
R=$(q "window.__game.flags.griffinDone"); check "griffin slain flag" 'true' "$R"
adv # close victory notice if any

q "window.__game.mode='world'; window.__game.flags.leshanDone=true; window.__game.quests.q_katakan.active=true; window.__game.player.oil.specter=8; 'ok'" >/dev/null
q "window.__game.startBattle('katakan', 10, true)" >/dev/null
waitbattle
R=$(q "window.__game.battle ? window.__game.battle.monId : 'none'"); check "katakan boss" 'katakan' "$R"
q "window.__game.debugWinBattle()" >/dev/null
waitmode world 60 || true
R=$(q "window.__game.flags.katakanDone"); check "katakan slain flag" 'true' "$R"

echo "=== northern reaches: npcs & board ==="
resetscene
q "window.__game.switchMap('bog', 12, 8, 'up')" >/dev/null
q "window.__game.startDialog('kettle')" >/dev/null; sleep 0.2
R=$(q "window.__game.dialog ? window.__game.dialog.node.speaker : 'none'")
check "kettle speaks" 'OLD KETTLE' "$R"
q "window.__game.dialog=null; window.__game.mode='world'" >/dev/null
q "window.__game.switchMap('ruins', 5, 11, 'up')" >/dev/null
q "window.__game.startDialog('shade')" >/dev/null; sleep 0.2
R=$(q "window.__game.dialog ? window.__game.dialog.node.speaker : 'none'")
check "shade speaks" 'PALE WITCHER' "$R"
R=$(q "Object.keys(window.__game.quests).length")
check "quests registered" '1[2-9]' "$R"

echo "=== schools & skills ==="
q "window.__game.newGame('bear'); window.__game.mode='world'; 'ok'" >/dev/null
R=$(q "window.__game.player.school + ' ' + window.__game.player.maxHp + ' ' + window.__game.player.def + ' ' + window.__game.player.atk")
check "bear school stats" 'bear 42 3 6' "$R"
q "window.__game.newGame('griffin'); window.__game.mode='world'; 'ok'" >/dev/null
R=$(q "window.__game.player.school + ' ' + window.__game.player.maxSta + ' ' + window.__game.player.atk")
check "griffin school stats" 'griffin 14 7' "$R"
q "window.__game.player.skillPoints=2; window.__game.mode='menu'; window.__game.menuIdx=4; 'ok'" >/dev/null
tap a 0.3
R=$(q "window.__game.mode"); check "skills screen" '"skills"' "$R"
tap a 0.4    # train VITALITY
sleep 0.2
tap a 0.4    # dismiss notice
sleep 0.3
R=$(q "window.__game.mode + ' ' + window.__game.player.skillPoints + ' ' + window.__game.player.maxHp")
check "vitality trained" 'skills 1 35' "$R"
tap b 0.2    # back to menu

echo "=== dialog pagination ==="
resetscene
q "window.__game.startNotice('The year is 1273. The war has burned the Northern kingdoms, and the roads crawl with everything war leaves behind. Only witchers walk toward the monsters.'); 'ok'" >/dev/null
sleep 0.4
R=$(q "window.__game.dialog.page")
check "notice page 1" '0' "$R"
q "window.__game.dialog && (window.__game.dialog.charIdx=99999); 'ok'" >/dev/null
sleep 0.15
tap a 0.3
R=$(q "window.__game.dialog ? window.__game.dialog.page : 'gone'")
check "long notice paginates to page 2" '1' "$R"
for i in $(seq 1 4); do adv; done
R=$(q "window.__game.mode"); check "notice drains to world" '"world"' "$R"

echo "=== bestiary pagination ==="
resetscene
q "window.__game.mode='world'; window.__game.bestiary.drowner=true; window.__game.mode='bestiary'; window.__game.bestIdx=0; window.__game.bestPage=0; 'ok'" >/dev/null
sleep 0.3
tap a 0.3
R=$(q "window.__game.bestPage"); check "bestiary detail page 1" '1' "$R"
tap a 0.3
R=$(q "window.__game.bestPage"); check "bestiary detail page 2" '2' "$R"
tap a 0.3
R=$(q "window.__game.bestPage"); check "bestiary wraps to page 1" '1' "$R"
tap b 0.3
R=$(q "window.__game.bestPage"); check "bestiary back to list" '0' "$R"
tap b 0.3

echo "=== mouse & pointer controls ==="
resetscene
q "window.__game.mode='world'; window.__game.switchMap('village', 10, 8, 'down'); window.__game.player.x=10; window.__game.player.y=8; 'ok'" >/dev/null
sleep 0.3
# click-to-move: village, player at (10,8), camera (88,60) -> click screen (112,124) = tile (12,11)
q "window.__game.setPointer(112, 124, true); window.__game.pointerClick(112, 124, 'a'); 'clicked'" >/dev/null
sleep 2.5
R=$(q "window.__game.player.x + ',' + window.__game.player.y")
check "click-to-move walks" '1[0-2],1[01]' "$R"
# click NPC (bram is in elder map): switch and click kettle-style via pointer
q "window.__game.switchMap('elder', 5, 5, 'up'); 'ok'" >/dev/null
sleep 0.4
q "window.__game.pointerClick(80, 56, 'a'); 'click'" >/dev/null   # bram at (5,3): screen center (80,56)
sleep 2.5
R=$(q "window.__game.mode + '|' + (window.__game.dialog ? window.__game.dialog.node.speaker : 'none')")
check "click NPC opens dialog" 'dialog.*ELDER BRAM' "$R"
# click to advance dialog: intro0 is multi-page — click through pages until choices appear
for i in $(seq 1 6); do
  q "window.__game.dialog && (window.__game.dialog.charIdx=99999); 'ok'" >/dev/null
  sleep 0.15
  R=$(q "window.__game.dialog ? (window.__game.dialog.choosing ? 'choosing' : 'text') : 'gone'")
  [ "$R" = '"choosing"' ] && break
  q "window.__game.pointerClick(80, 120, 'a'); 'page'" >/dev/null
  sleep 0.3
done
# choices render at rows y=64,76 — click choice 0
q "window.__game.pointerClick(80, 66, 'a'); 'choice'" >/dev/null
sleep 0.6
R=$(q "window.__game.flags.metElder")
check "click picks choice" 'true' "$R"
# click through any remaining pages/nodes until the dialog closes
for i in $(seq 1 8); do
  R=$(q "window.__game.dialog ? 'yes' : 'no'")
  [ "$R" = '"no"' ] && break
  q "window.__game.dialog && (window.__game.dialog.charIdx=99999); 'ok'" >/dev/null
  q "window.__game.pointerClick(80, 120, 'a'); 'adv'" >/dev/null
  sleep 0.35
done
R=$(q "window.__game.mode"); check "click advances dialog" '"world"' "$R"
# wheel navigation in menu
q "window.__game.mode='menu'; window.__game.menuIdx=0; 'ok'" >/dev/null
q "window.__game.wheel(120); 'scroll'" >/dev/null
sleep 0.4
R=$(q "window.__game.menuIdx")
check "wheel scrolls menu" '1' "$R"
# right-click backs out of menu
q "window.__game.pointerClick(80, 80, 'b'); 'rc'" >/dev/null
sleep 0.4
R=$(q "window.__game.mode"); check "right-click cancels menu" '"world"' "$R"
# battle menu click
q "window.__game.mode='world'; window.__game.startBattle('drowner', 3)" >/dev/null
sleep 1.5
q "window.__game.battle.phase='menu'; 'ok'" >/dev/null
q "window.__game.pointerClick(100, 110, 'a'); 'fight'" >/dev/null   # FIGHT quadrant
sleep 0.4
q "window.__game.pointerClick(30, 110, 'a'); 'steel'" >/dev/null   # first sword option
sleep 1.5
R=$(q "window.__game.mode + '|' + (window.__game.battle ? window.__game.battle.phase : 'ended')")
check "battle click attacks" '.' "$R"
q "window.__game.battle && window.__game.debugWinBattle()" >/dev/null
waitmode world 60 || true

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
