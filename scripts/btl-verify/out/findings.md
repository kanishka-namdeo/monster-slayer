# BTL-verify findings (post-fix verification run)

Run: 2026-09-17T23:28:23.074Z — production server http://localhost:3000, headless chromium 480x900, native 160x144 canvas.
PNGs: V-prefixed files in this directory (c1_*/c2_*/... tags). Poll log: c1_poll_log.json.

## 1. Sign-kill softlock — FIXED
- Repro: startBattle('leshen',8,true) boss; msgs=[]; monHp=1; castSign('igni') (witcher initiative, pure sign-kill path).
- Reached mode='world': **true** at t=8215ms (within 10s: true).
- Phase timeline (300ms polls): ["msg",null] — never 'sign'; the queue drained straight through to battle end (battle nulled in the same tick as finish('victory')).
- Track at 'collapses into the mud!' line: **victory** (pre-fix: never left 'finalboss' / msgs never drained).
- Mode log tail: ["creation","intro","world","dialog","world","battle","world","dialog"] (leshen victory: world -> ending notice dialog).

## 2. Monster attack lunge — FIXED
- wolf L4, monFirst=true; playerAttack('steel') triggers preempt monAct; 6 frames 120ms apart per round (wolf move choice is random: retry until an attack move).
- Rounds: [{"round":0,"msgDuring":"WOLF uses BITE!","maxChangedPx":544}].
- Passing round consecutive-pair diffs: [{"pair":"0->1","changedPx":544},{"pair":"1->2","changedPx":544},{"pair":"2->3","changedPx":0},{"pair":"3->4","changedPx":0},{"pair":"4->5","changedPx":0}]; msg during capture: "WOLF uses BITE!".
- Max changed px: **544** (threshold >100; pre-fix: 0 across the entire wolf counter).

## 3. IGNI flash over enemy panel — FIXED
- drowner L3; msgs=[]; castSign('igni'); 7 frames 70ms apart (flash half-cycle); region x100-160 y0-52 (PAPER panel).
- Consecutive diffs: [{"pair":"0->1","changedPx":3089},{"pair":"1->2","changedPx":144},{"pair":"2->3","changedPx":144},{"pair":"3->4","changedPx":3096},{"pair":"4->5","changedPx":0},{"pair":"5->6","changedPx":0}]; max **3105** px (threshold >200; pre-fix: 0).

## 4. Item menu scroll — FIXED
- inv = swallow/thunder/honey/insectoil (4 rows). After 3x 'down': itemIdx=3, scrollStart=1, visible rows ["THUNDERBOLT x1","WHITE HONEY x1","INSECTOID OIL x1"].
- Row-4 INK text px (y118-130, x12-110): **256** (pre-fix: row not drawn).
- Cursor INK px in row-4 cursor slot: **16** (pre-fix: invisible).
- Scroll ↑ indicator DARK px (blink, 2 shots): 0 / 10.

## 5. QUEN VFX — FIXED
- phase='menu'; msgs=[]; castSign('quen'); player region x0-60 y50-96 vs pre-cast baseline.
- baseline->100ms: **48** px; baseline->300ms: **48** px; 100ms->300ms: 0 px. quenTurns=3. (pre-fix: 0 px battlefield-wide.)

## 6. Gameover redesign — FIXED
- leshen L8 boss, php=2, defeat via monster turn; reached gameover in 7910ms (action retries due to monster heal-at-full-HP rolls: 1); shot at gameoverT=2383.2000000000044ms (music 'gameover'; respawn after >2600ms -> {"mode":"dialog","track":"inn"}).
- Title band bright px: **548**; monster sprite band px: **888**;
  'You black out...' px: **144**; 'The world smells of iron.' px: **154**; PRESS A px: 358.
- (Pre-fix: no title, 2nd line near-invisible C.DARK-on-C.INK.)

## Verdicts
1. FIXED 2. FIXED 3. FIXED 4. FIXED 5. FIXED 6. FIXED
