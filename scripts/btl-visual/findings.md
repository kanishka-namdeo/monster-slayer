# BTL-visual — Battle System Visual Verification (Task BTL-visual, retry)

Method: one Playwright run (chromium headless, 480×900, `http://localhost:3100`) driving the real
game via `window.__game.press/release` + `startBattle(...)`; every frame is a native 160×144
canvas `toDataURL` PNG captured mid-battle. State dump per shot in `out/trace.json` /
`out/trace-a2.json`. Pixel proofs via sharp region-diffs (`out/pixel-analysis.json`). VLM
(glm-5v-turbo, 4× nearest-neighbor upscales in `out/vlm/`) for eyeball-level review.

Scenarios: A/A2 = drowner L3 (menus, item menu, steel hit, HP drain, counter, faint, victory, done),
B = leshen L8 boss (IGNI flash, AARD shake, AXII, sign-kill softlock + zombie-turn escape),
C = wolf L4 (monster counter no-lunge pixel proof, QUEN, swallow), D = defeat → gameover.

---

## Confirmed defects (evidence: `scripts/btl-visual/out/…`)

### 1. CRITICAL — Sign-kill softlock: battle wedges in `phase='sign'` with victory queued
Setting `monHp=1` and casting IGNI kills the leshen but `castSign` returns after `queueVictory()`
without `flush()` — no message ever plays; the screen stays on the SIGN submenu with a dead boss.
Softlock JSON (`out/softlock-state.json`, after 2 s):
`{mode:"battle", phase:"sign", monHp:0, monDead:true, faintT:-13, nMsgs:3, msgs:["IGNI! A torrent of flame!","LESHEN is scorched for 12!","LESHEN collapses into the mud!"], afterQueue:"victory", doneResult:null}`.
Evidence: `034_B_SOFTLOCK_stuck.png` (frozen submenu over 0-HP boss), `035_B_after_B_escape.png`.

### 2. Zombie-turn after escaping the softlock
Pressing B (back to menu) → FIGHT→steel re-flushes the STALE queue: the pre-softlock messages
replay from the start — the IGNI flash fires again over the already-dead leshen, then
"LESHEN takes 17 damage!" lands on a corpse, and "collapses into the mud!" prints a second time
(duplicate victory message). Evidence: `036_B_zombie_turn_msg1.png` (flash replaying, `curAnim=flash animT=303, faintT=603` in trace), `037_B_zombie_turn_msg2.png`, msgs list in `out/trace.json` shot 036.

### 3. Monster attacks have NO lunge / no attack animation (pixel-proof)
During the wolf's counter ("WOLF uses BITE!", playerhit anim, 6 frames @150 ms across the whole
attack window): **0 of 3024 pixels changed** in the monster region (x104–159, y0–53) between every
consecutive frame pair AND vs. the pre-attack menu frame. The monster is 100 % static while it
attacks; only the message text (75 px full-frame) and the player's blink change. Evidence:
`043–048_C_monatk_00..05.png`, `out/pixel-analysis.json`. (Contrast: the player DOES lunge —
468 px (25 %) of the player region change when the 6 px lunge window `animT>300` is active:
`201_A2_hit_00.png` vs `207_A2_drain_00.png`.)

### 4. IGNI flash is invisible over the enemy panel (pixel-proof)
Flash frame vs. pre-cast menu: enemy-panel background (PAPER over PAPER) = **0 changed pixels**
(strip x100–108 y0–51: the only 18 changed px are at y52–53 = ground band/shadow; top strip
y0–3 x100–159 = 0/240). Meanwhile the dark sky region changes 2037/2037 px (100 %) and the
leshen sprite is 62.9 % washed toward white — so the flash reads as a full-screen blink that does
NOT touch the area where the enemy stands. The flash is also a single static veil (0 flicker:
`017` vs `019` sky diff = 0). Evidence: `016_B_menu_boss.png`, `018/019_B_igni_flash_01/02.png`, `out/pixel-analysis.json`.

### 5. QUEN / AXII / potions have zero VFX
Between cast frames the ENTIRE battlefield (x2–157, y0–99) changes **0 of 15600 pixels** for
QUEN, AXII and SWALLOW — only the message box types. QUEN's only representation is a bare
`QUEN` text label under the STA bar (VLM: *"the word QUEN appears without a label or icon —
unclear if it's a buff"*). No shield shimmer, no hex overlay, no heal sparkle; the HP bar just
refills silently behind the text. Evidence: `050–052_C_quen_cast_00..02.png`,
`053_C_quen_label.png`, `031–033_B_axii_00..02.png`, `054–056_C_item_swallow_00..02.png`.

### 6. Item menu: rows beyond 3 are not drawn and the cursor becomes INVISIBLE
With 4 usable items (`inv={swallow:2,thunder:1,honey:1,insectoil:1}`) the menu draws only 3 item
rows + BACK. At `itemIdx=3` (Insect Oil actually selected) the 4th item's row is missing AND the
cursor is drawn nowhere — no visual selection exists on screen (VLM: *"no visible cursor on any
row"*). No scrolling. Evidence: `008_A_item_idx3_invisible_row4.png` (vs. `007` idx0 and `009` idx4=BACK).
Code: `battle.ts:761` `list.slice(0,3)` + cursor only for `itemIdx<3` or `itemIdx>=list.length`.

### 7. Monster sprite vanishes BEFORE the damage/collapse messages (dead frames)
The KO sink/blink (`faintT=720 ms`) starts the instant the killing blow is queued and usually
expires during the preceding "You draw STEEL!" typing message — so "DROWNER takes X damage."
and "collapses into the mud!" play over an EMPTY enemy panel; the slash streaks strike nothing
(VLM on `010`: *"three vertical lines 'III' instead of a Drowner sprite"*). The enemy HP bar also
finishes draining to 0 before the damage message appears. Evidence: `010_A_hit_00.png`
(`faintT=-13` while msg = "DROWNER takes 18 damage."), `221_A2_faint_04.png` → `222_A2_victory_msg_collapse.png`
(sprite already gone; region diff 0.86 % = only the replayed streaks).

### 8. Player back sprite floats with no platform
The witcher back-sprite (32×32 at y58–90) hangs over the plain dark battlefield background with
only a 28×2 detached shadow bar at y88 — no ground plane under him. Flagged by VLM on every
framing: *"player sprite floating entirely above the ground line with a large gap"*; the
drowner/wolf also read as floating above their contact shadow. Evidence: `004_A_menu.png`,
`053_C_quen_label.png`, VLM outputs.

### 9. Gameover screen is bare and its 2nd line is near-invisible
No "GAME OVER" title: the defeat screen is a black canvas with "You black out..." (PAPER, 144 px
of text) and, after 1.5 s, "The world smells of iron." drawn in C.DARK (shade 48) on the C.INK
background (shade 15) — 226 text pixels total, barely legible (VLM: *"nearly invisible"*; the
claimed right-edge clipping is FALSE — line ends at x138). Transition frames are pure black.
Evidence: `064–068_D_gameover_00..final.png`, pixel shade histogram, `engine.ts:1584–1592`.

### 10. Minor: HP/STA bars use label-dependent, inconsistent origins
Enemy HP bar x8–88 (80 px, inside its own box), player HP/STA bars x84–150 (66 px) — the two HP
gauges neither share an x-origin nor a width; VLM repeatedly flags the bars as low-contrast/hard
to read. Evidence: `004_A_menu.png` (`battle.ts:711,717,718`).

### 11. Minor: menu prompt wraps with leading spaces
"Steel, silver, sign or brew?" wraps as `Steel,` / `silver, sign or` / `brew?` — VLM notes the
leading-space misalignment of lines 2–3. Evidence: `004_A_menu.png`.

### 12. Corroborated (audit, now visible): stun text has no state and no HUD
Leshen's ROOT GRASP prints "You cannot move!" but there is no stun mechanic and no status icons
anywhere in the battle HUD (the only status text is the QUEN label). The softlock JSON also shows
stale `curMsg` ("LESHEN stares at nothing, hexed.") frozen on screen during the wedge.

## Things that DO work (visual)
Intro slide-in + encounter flash/fade (000–003), 2×2 menu with cursor, sign submenu grid
(+2 nav quirk confirmed: down from IGNI = QUEN), steel-hit streaks + monster blink + player
6 px lunge, animated HP drain (218_A2_faint_01.png: dispMonHp 2.9→0 with sink anim), AARD
screen-shake, msg box typing/▼ marker, victory XP messages, defeat→gameover chain, respawn.

## Repro scripts
- `scripts/btl-visual/btl-capture.cjs` (scenarios A/B/C/D), `btl-capture2.cjs` (A retry),
  `btl-analyze.cjs` (pixel proofs). Dev server was `npx next dev -p 3100`.
