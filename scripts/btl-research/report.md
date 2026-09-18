# BTL-research — GB / Gen-1-Pokémon-Style Battle Systems: Research Report

Task ID: BTL-research · RESEARCH-ONLY. Context: BTL-audit of our Witcher GB RPG (160×144, 4-shade, chiptune; FIGHT/ITEM/SIGN menus; BEAST/NECROPHAGE/SPECTER/CURSED/INSECTOID; known gaps: no turn order, no monster lunge, flavor-only stun, binary sword matrix, sign-kill softlock).

Method: 7 fresh web searches + mining of the prior attempt's cached fetches (29 search JSONs + full Bulbapedia/DragonflyCave page text) + primary-source verification against the **pret/pokered disassembly** (actual Gen-1 code: `engine/battle/core.asm`, `animations.asm`, `hp_bar.asm`, `dl_print_text.asm`). All timings below are at 60 fps Game Boy frame rate unless noted.

---

## 1) FULL-TURN SEQUENCE (canonical Gen-1 order, with timings)

**Battle start**
1. Overworld → encounter trigger: screen flash (see §2), battle music starts. (~0.5 s)
2. Both sprites **slide in simultaneously as black silhouettes** (inverted palette `%11100100`), player back-pic from the left edge, enemy from the right, **2 px/frame over ~72 frames (~1.2 s)**, then real palettes applied, then `Delay3` (~3-frame settle). [pokered `SlidePlayerAndEnemySilhouettesOnScreen`]
3. "Wild X appeared!" — text types out (fast text = 1 char/frame), enemy **cry** plays during/after. (~1 s incl. hold)
4. "Go! Y!" — player back-pic already on screen; cry. Menu (FIGHT/PKMN/ITEM/RUN) draws; **input waits indefinitely**.

**Each round**
5. Player picks an action (move / item / switch). Item & switch always resolve **before** the enemy's move this turn; the enemy then still takes its move. Move execution order = Speed (see §3). Ties: 50/50 random.
6. "Y used MOVE!" types out (~0.3–0.5 s). Message prints **before** the animation.
7. Move animation plays (~30–60 frames; projectiles/flash/shake — §2).
8. Damage applies; **HP bar drains** while the hit sprite blinks (see §2). Low-HP (≤ ~20 %) beep loop.
9. Result messages, in this order: **"A critical hit!"** (Gen 1 prints it *after* damage is dealt) → "It's super effective!" / "It's not very effective…" → secondary-effect text ("X's ATTACK fell!"). Each types out + short hold; A/B advances.
10. If enemy survives: "Enemy X used MOVE!" → its animation → player-side hit feedback → player HP drain → messages. Back to 5 (menu).
11. If enemy fainted: "Enemy X fainted!" + faint anim + faint cry/sfx → **victory fanfare** (~1.5–2 s, input blocked) → "Y gained N EXP Points!" + EXP-bar fill animation → fade back to overworld.
12. End-of-turn residuals (poison/burn/leech seed ticks: 1/16 max HP in Gen 1) print + apply after both moves, before the next menu.
13. Player faint: "Y fainted!" → (last mon) "You have no more POKéMON that can fight!" → whiteout screen → heal point. Run: "Got away safely!" (instant end) / "Can't escape!" → **enemy gets a free move**.

**Key overlap rule:** messages and animations are strictly serialized per actor (msg → anim → damage/drain → msg), never concurrent; only the *sprite blink during HP drain* overlaps the bar animation.

---

## 2) ANIMATION SPEC TABLE (Gen-1-verified params → our game)

| Moment | Gen-1 treatment (verified) | Recommended params for us |
|---|---|---|
| Encounter transition | repeated palette flash before battle screen | 3× (2 f invert → 2 f white), ~12–24 f total. We already have flash+fade — keep |
| Entrance | **silhouette slide-in, both sprites, 2 px/f, ~72 f (~1.2 s), then palette + settle Delay3** [core.asm] | keep our slide-in; add inverted-palette (silhouette) phase + 2-palette-frame fill-in for authenticity; ~0.8–1.2 s |
| Text typing | 1 char/frame fast (60 cps), 1/5 frame medium (12 cps); **A/B held skips letter delay** [dl_print_text.asm] | our 28 cps fine; **add B-hold skip** (missing per audit) |
| Attack lunge | Gen 1 has *no* sprite lunge for basic attacks (uses frame-block VFX instead); nudge-lunge is a later-gen convention | add: 2 f anticipation (−2 px back) → 6–8 px toward foe over 4–6 f ease-out → hold 2 f → recover 4–6 f. ~14 f (~0.23 s). Applies to player AND **monster attacks** (fills audit gap) |
| Move VFX | frame-block projectiles: 1–2 px blobs crossing at 2–4 px/f, beams, dust, 30–60 f total | per-sign: Igni = cone blobs + palette flicker (fire), Aard = radial dust + shake, Quen = ring draw on player, Axii = enemy glyph blink; 30–45 f each |
| Hit flash | `AnimationFlashScreen`: **invert BGP 2 f → all-white BGP 2 f → restore** (4 f total) [animations.asm] | 2 f invert (swap our 4 shades) → 2 f brightest → restore; for enemy hits use palette-invert, not pure white, so it's visible over PAPER backdrop (fixes washed-out Igni flash) |
| Target blink (player hits enemy) | `AnimationBlinkMon`: **6 cycles of 5 f hidden / 5 f shown = 60 f (~1 s)**, plays while HP drains [animations.asm] | keep 4–6 blink cycles (2–3 f hidden/3 f shown) concurrent with HP drain; cheap and authentic |
| Screen shake (enemy hits player / heavy moves) | generic post-hit anim table: enemy damaging move no side-effect → **vertical shake 8 steps**; with side-effect → horizontal **b=8**; light → **b=2**; slow variants 3–6 steps; **1 px amplitude per step, 2 f/step** [animations.asm AnimationTypePointerTable] | ±1 px (we do ±1–2 ok), 8–16 f, 2 f per step; vertical for light hits, horizontal for heavy; play *after* move VFX |
| HP bar drain | `UpdateHPBar_AnimateHPBar`: steps **1 HP per iteration, 2 frames per bar tick**, `Delay3` settle at end; low-HP beep during [hp_bar.asm] | adaptive: 1 HP/2 f for ≤40 HP deltas else 2–4 HP/f (≈0.5–0.8 s full bar); keep tick SFX; we have animated drain — verify rate + add end-settle 3 f |
| Faint | Gen 1: bar empties + **sprite erased with blank-rect wipe + sfx** (no sink; sink is Gen 3+) | our sink 8–16 px + blink + fade reads better — keep (mark as deliberate modernization); cheap authentic alt: 2-frame blank wipe + descending cry |
| Victory | faint msg → **fanfare jingle blocks input ~1.5–2 s** → EXP msg + bar fill → fade out | keep music; add "VICTORY!" msg card + 20–30 f hold + fade-to-map transition (audit gap) |
| Critical hit | text-only message after damage | msg "A critical hit!" after drain; optional 1 extra hit-blink |
| Status application | e.g. "X was poisoned!" text after move anim; no VFX in Gen 1 | 2–3 blink cycles on afflicted sprite + small status icon in HUD (audit gap: monster-side status indicators) |

---

## 3) MECHANICS CHECKLIST (Gen 1 → Witcher adaptation)

| Mechanic | Gen 1 (verified) | Adapt as (one-liner) |
|---|---|---|
| **Turn order** | Items/switch resolve first, then moves by current Speed; equal Speed = random 50/50; **no priority moves exist in Gen 1** (Quick Attack is Gen 2+); paralysis quarters Speed | Add SPD stat to player + monsters; potions/oils resolve before enemy move (signs do NOT); ties random; boss trait "always acts first" optional |
| **Damage** | `((((2×L/5 + 2) × Power × Atk/Def) ÷ 50) + 2) × STAB(1.5) × typeChart × rand(217–255)/255`, floor, min 1, cap 999 [core.asm `RandomizeDamage`; dragonflycave] | `((2×L/5+2)×Power×ATK/DEF)/50 + 2` with multiplicative DEF (drop our subtractive def), × sword-tier (0.75/1.0/1.25/1.5 vs monster class — replaces binary matrix) × oil (+0.5, STAB-analog, decays) × rand(217–255)/255, cap 99 |
| **Crit** | T = ⌊baseSpeed/2⌋, chance = T/256 (≈8 % slow / ≈20 % fast, cap 255/256); high-crit moves ×8 T; crit = **attacker level doubled** in formula (~1.5–1.95×) and ignores stat mods; Focus Energy bug ÷4 [core.asm `CriticalHitTest`; Bulbapedia] | chance = ⌊SPD/2⌋/256 (level 1–10 → ~4–12 %); silver "swift" attacks = high-crit ×4–8; crit ×1.6 fine at our scale |
| **Accuracy** | hit if rand(0–255) < scaled accuracy; **even 100 % moves = 255/256 (~99.6 %) — the 1/256 miss glitch** [core.asm; Glitch City Wiki] | keep most attacks auto-hit; optional 1/256 whiff only as easter egg; Axii-hex sets enemy accuracy 200/256; blind (INSECTOID spit) sets player 200/256 for 2–3 turns |
| **Flee** | auto-succeed if playerSpeed ≥ enemySpeed; else `Odds = ⌊PSpd×32 ÷ ((ESpd÷4) mod 256)⌋ + 30×attempts` (Gen 1 form; = ⌊PSpd×128/ESpd⌋ + 30×attempts), escape if rand(0–255) < Odds, cap 255 auto; **failed run wastes the turn (enemy attacks); attempts reset on attacking; never vs trainers** [core.asm `TryRunningFromBattle`; Bulbapedia Escape] | same formula with SPD (replaces our current one); bosses = trainer battles, "Can't escape!"; attempts reset when we attack |
| **Status** | PAR: 25 % can't move + Speed ÷4; BRN: ½ Attack + 1/16 maxHP/turn; PSN: 1/16 maxHP/turn; SLP 1–7 turns; FRZ permanent until fire; confusion 33 % self-hit [dragonflycave status-ailments] | Aard-stun → skip enemy turn(s) (25 %→ fail-per-turn PAR-style, 1–3 t); Necrophage venom → 1/16 maxHP ×3–5 t; SPECTER curse (Axii-hex) → enemy damage −50 % (burn-analog) or 33 % self-hit 1 turn; monster ROOT GRASP/SPIN WEB → **real player-stun state: skip player's next menu turn** (fixes flavor-only gap) |
| **Rewards** | wild EXP = baseExp × enemyLevel ÷ 7 (÷ participants); faint → fanfare → EXP msg + bar fill; no items from wild mons | keep XP/drop/crowns/quest flags; use `floor(baseXP × monLevel / 7)`; fanfare blocks input 1.5 s; EXP bar fill anim after |
| **Enemy AI** | wild = random valid move; trainer AI scores moves (power × effectiveness, status bonuses) [pokered trainer_ai] | wild random; boss = Gen-1-style scoring (pick best expected damage; heal/buff when low); final boss 2-phase |

---

## 4) STATE-MACHINE RULES (anti-wedge, from Gen-1 structure + FSM literature)

1. **Single message queue, single producer discipline.** Gen 1 is a linear script: `msg → anim → apply damage → faint-check → msgs → next actor`, where the faint/victory check runs after *every* damage application. Port this as one `applyDamageAndCheck(actor)` used by FIGHT/SIGN/ITEM/poison ticks — no per-caller early returns.
2. **No early return past a queue write.** Our audit's critical bug (sign kills call `queueVictory(); return;` without `flush()`) violates the invariant. Rule: `queueVictory()` itself flushes/enters `msg` phase, or every call site must fall through to `flush()`. Add an assertion: *after any command dispatch, phase ∈ {menu, msg, done}, and if the queue is non-empty then phase === 'msg'*.
3. **Every branch must reach an input-accepting state.** Enumerate: menu, msg, done. After a continuation (`afterQueue` callback) runs, it must either push ≥ 1 message (stay `msg`), set `menu`, or set `done` — never leave phase unchanged with empty queue. Covers the zombie-`monTurn` case too: **guard `monHp > 0` at turn start** (Gen 1 checks "fainted" before each action).
4. **One animation at a time per actor**; animations may only overlap the HP-drain blink. Never queue a second animation from inside a continuation — push it as a message-type step instead (prevents double-trigger sfx/audio bugs like our doubled 'encounter').
5. **Watchdog fallback (defense in depth):** in battle `update()`, if phase is not in the enum, or `phase==='msg'` with empty queue for > N frames, force `phase='menu'` (log it). A turn-based battle can always safely accept the menu.
6. **Idempotent end-states:** `finish()`/victory/defeat must be callable twice without double rewards (guard with a `resolved` flag) — fixes the duplicate "collapses into the mud!" + damage-on-dead-monster symptom from the audit.

---

## 5) SOURCES

Primary (disassembly — parameters quoted from code):
- https://github.com/pret/pokered — `engine/battle/core.asm` (`RandomizeDamage` rand 217–255/255; `CriticalHitTest` baseSpeed/2; `TryRunningFromBattle` flee formula; `SlidePlayerAndEnemySilhouettesOnScreen`), `engine/battle/animations.asm` (`AnimationTypePointerTable` shake/blink table, `AnimationFlashScreen`, `AnimationBlinkMon`), `engine/battle/hp_bar.asm` (`UpdateHPBar_AnimateHPBar` 2 f/tick), `engine/battle/dl_print_text.asm` (`PrintLetterDelay`), `engine/battle/trainer_ai.asm`
- https://bulbapedia.bulbagarden.net/wiki/Critical_hit — Gen I threshold table, level-doubling, Focus Energy bug
- https://bulbapedia.bulbagarden.net/wiki/Escape — Gen I/II odds formula + auto-escape rule
- https://bulbapedia.bulbagarden.net/wiki/List_of_battle_animations_by_index_number_in_Generation_I — animation conventions
- https://bulbapedia.bulbagarden.net/wiki/List_of_battle_glitches_in_Generation_I — 255/256 accuracy cap
- https://glitchcity.wiki/wiki/1_in_256_miss_glitch — 1/256 miss
- https://www.dragonflycave.com/mechanics/battle · /battling-basics · /status-ailments — turn order, damage, status ticks

Design/FSM:
- https://gamedev.stackexchange.com (turn-based combat software design) · https://gameprogrammingpatterns.com/state.html · https://theliquidfire.com (Tactics RPG state machine) · https://paths.grasp.study (combat FSM) · https://gamedev.net (FSM turn-based)
- https://gameworldobserver.com/2022/12/02/how-to-design-turn-based-combat-system-untamed-tactics — turn-based design tips
- https://gbstudiocentral.com (Let's Build an RPG battle series) · https://kalanakila.itch.io (GB Studio battle template) · https://www.smogon.com/ RBY mechanics guide (cached in prior attempt s15)
- Witcher-flavored: https://www.scribd.com/document/712302307/Signs-Overhaul (sign stamina/effect rebalance), https://forum.gamemaker.io/index.php?threads/86092 (skill/spell systems)

Local artifacts: `scripts/btl-research/searches/` (s1–s29 web-search JSONs, p_*.json page fetches, pokered asm extracts).
