// ============================================================
// Battle system: Pokémon-style turn battles, witcher flavor
// v2 — initiative & turn order, real status effects, deferred
// message-gated FX (bars drain / faints play when their line
// lands, not when the queue is built), full animation pass.
// ============================================================
import { MONSTERS, SIGNS, ITEMS, xpForLevel, schoolById } from './data';
import type { MonType } from './data';
import { MONSTER_GFX } from './monstersGfx';
import { PLAYER } from './sprites';
import { drawWindow, drawBar, drawCursor, drawTextRight } from './render';
import { drawText, wrapText, textWidth } from './font';
import { C, CRIT_RATE, RUN_BASE } from './constants';
import { audio } from './audio';

export interface InputState {
  held: Set<string>;
  just: Set<string>;
}

export interface BattleHost {
  inv: Record<string, number>;
  player: {
    hp: number; maxHp: number; sta: number; maxSta: number;
    atk: number; def: number; lvl: number; xp: number; tox: number;
    swordLvl: number; armorLvl: number;
    school: string; skillPoints: number;
    oil: { specter: number; necro: number; beast: number; insectoid: number };
  };
  countKill(id: string): void;
  giveItem(id: string, n: number): void;
  onBattleEnd(result: 'victory' | 'defeat' | 'fled', monId: string): void;
}

const APPEAR: Record<string, string> = {
  drowner: 'A DROWNER claws up from the mire!',
  ghoul: 'A GHOUL rises, hungry for graves!',
  wolf: 'A WOLF prowls from the brush!',
  waterhag: 'A WATER HAG surges from the swamp!',
  wraith: 'The air freezes... A WRAITH weeps awake!',
  werewolf: 'A WEREWOLF bares its yellowed fangs!',
  leshen: 'The LESHEN speaks in a murder of crows!',
  nekker: 'A NEKKER shrieks - and the reeds answer!',
  endrega: 'An ENDREGA rears, mandibles dripping!',
  foglet: 'A false lantern gutters... A FOGLET steps out of the mist!',
  noonwraith: 'The sun dims. A NOONWRAITH burns where the bride fell!',
  rotfiend: 'A ROTFIEND waddles close, bloated with grave gas!',
  barghest: 'A BARGHEST lopes down the scree, embers for eyes!',
  arachas: 'The bone-wall unfolds! The ARACHAS was the nest!',
  griffin: 'Wings like torn sailcloth! The ROYAL GRIFFIN dives!',
  katakan: 'The KATAKAN smiles with a dead witcher\'s face!',
};

interface Msg {
  text: string;
  anim?: 'monhit' | 'playerhit' | 'shake' | 'flash' | 'quen' | 'hex' | 'heal' | 'oil' | 'monheal';
  sfx?: string;
  /** deferred effects, fired when this line STARTS displaying */
  hpTo?: number;    // monster HP bar target
  phpTo?: number;   // player HP bar target
  staTo?: number;    // player STA bar target
  fx?: 'faint' | 'playerfaint';
}

/** linear approach for smooth HP drain */
function approach(cur: number, target: number, step: number): number {
  if (cur < target) return Math.min(target, cur + step);
  if (cur > target) return Math.max(target, cur - step);
  return cur;
}

export class Battle {
  monId: string;
  monName: string;
  monHp: number; monMaxHp: number;
  monAtk: number; monDef: number; monLvl: number;
  monType: MonType;
  boss: boolean; immune: boolean;
  monStun = 0; monHex = 0; monAtkBuff = 0;

  php: number; pmaxHp: number; psta: number; pmaxSta: number;
  patk: number; pdef: number; plvl: number; ptox: number;
  poison = 0; atkBuff = 1; atkDownMul = 1; defDownMul = 1;
  quenTurns = 0; quenAmt = 0;
  toxWarned = false;
  pStun = 0;                        // roots/web: player loses next turn
  monFirst = false;                 // initiative: monster strikes first this round

  phase: 'intro' | 'menu' | 'fight' | 'sign' | 'item' | 'msg' | 'done' = 'intro';
  menuIdx = 0; subIdx = 0; itemIdx = 0;
  msgs: Msg[] = [];
  curMsg = '';
  curAnim: Msg['anim'] | null = null;
  charIdx = 0; msgHold = 0;
  afterQueue: 'monTurn' | 'roundEnd' | 'menu' | 'victory' | 'defeat' | 'fled' | 'done-victory' = 'menu';

  introT = 0;
  animT = 0;
  time = 0;
  doneResult: 'victory' | 'defeat' | 'fled' | null = null;
  resolved = false;

  // presentation state — bars chase msg-gated targets, not live values,
  // so damage lands when the line about it lands (Gen-1 sequencing)
  dispMonHp = 0; dispPhp = 0; dispSta = 0;
  barMonHp = 0; barPhp = 0; barPsta = 0;
  faintT = 0; faintStarted = false;    // enemy faint: sink + blink + fade
  pFaintT = 0; pFaintStarted = false;  // player KO: sink + blink
  monDead = false;

  constructor(public host: BattleHost, monId: string, lvl: number) {
    const def = MONSTERS[monId];
    this.monId = monId;
    this.monName = def.battleName ?? def.name;
    this.monLvl = lvl;
    // scale stats by level delta over base level assumption (base lvl ~ stats given)
    const lvScale = 1 + Math.max(0, lvl - 4) * 0.08;
    this.monMaxHp = Math.round(def.hp * lvScale);
    this.monHp = this.monMaxHp;
    this.monAtk = Math.round(def.atk * lvScale);
    this.monDef = def.def;
    this.monType = def.type;
    this.boss = !!def.boss;
    this.immune = !!def.immuneToPlain;

    const p = host.player;
    this.php = p.hp; this.pmaxHp = p.maxHp;
    this.psta = p.sta; this.pmaxSta = p.maxSta;
    this.patk = p.atk + p.swordLvl * 3;
    this.pdef = p.def + p.armorLvl * 2;
    this.plvl = p.lvl;
    this.ptox = p.tox;

    this.dispMonHp = this.monMaxHp; this.barMonHp = this.monMaxHp;
    this.dispPhp = this.php; this.barPhp = this.php;
    this.dispSta = this.psta; this.barPsta = this.psta;

    this.rollInitiative();
    this.msgs = [{ text: APPEAR[monId] ?? `A ${def.name} appears!`, sfx: 'encounter' }];
    this.afterQueue = 'menu';
    // type the APPEAR line while the combatants slide in
    this.startNextMsg();
  }

  // ---------------- initiative ----------------

  playerSpeed(): number {
    const sc = this.host.player.school;
    let s = 6 + Math.floor(this.plvl / 3);
    if (sc === 'cat') s += 3;
    else if (sc === 'wolf' || sc === 'griffin') s += 1;
    else if (sc === 'bear') s -= 1;
    return s;
  }

  rollInitiative() {
    const mspd = MONSTERS[this.monId].spd ?? 6;
    const pspd = this.playerSpeed();
    this.monFirst = mspd > pspd || (mspd === pspd && Math.random() < 0.5);
  }

  variance() {
    return 0.85 + Math.random() * 0.3;
  }

  battleItemList(): { id: string; label: string }[] {
    const out: { id: string; label: string }[] = [];
    for (const [id, n] of Object.entries(this.host.inv)) {
      if (n <= 0) continue;
      const it = ITEMS[id];
      if (!it) continue;
      if (it.kind === 'potion' || it.kind === 'oil') out.push({ id, label: `${it.name} x${n}` });
    }
    return out;
  }

  /** scrolling window for the battle ITEM menu (3 visible rows) */
  itemWindow(): { list: { id: string; label: string }[]; start: number } {
    const list = this.battleItemList();
    const vis = 3;
    let start = 0;
    if (list.length > vis) start = Math.max(0, Math.min(this.itemIdx, list.length - vis));
    return { list, start };
  }

  // ---------------- turn construction ----------------

  /** The monster's action this turn: move selection + resolution as msgs.
   *  Sets no continuation — callers route on the aftermath. */
  monAct() {
    const def = MONSTERS[this.monId];
    if (this.monStun > 0) {
      this.monStun = 0;
      this.msgs.push({ text: `${this.monName} is still reeling!` });
    } else if (this.monHex > 0) {
      this.monHex = 0;
      this.msgs.push({ text: `${this.monName} stares at nothing, hexed.` });
    } else {
      // pick move — healing is off the table at full HP (never "Regenerates 0!")
      let pool = def.moves.filter((m) => this.monHp < this.monMaxHp || m.effect !== 'heal');
      if (pool.length === 0) pool = def.moves;
      if (this.monHp < this.monMaxHp * 0.35) pool = pool.map((m) => (m.effect === 'heal' ? { ...m, weight: m.weight * 4 } : m));
      const total = pool.reduce((a, m) => a + m.weight, 0);
      let roll = Math.random() * total;
      let move = pool[0];
      for (const m of pool) { roll -= m.weight; if (roll <= 0) { move = m; break; } }

      if (move.effect === 'heal') {
        const amt = Math.min(this.monMaxHp - this.monHp, 10 + this.monLvl);
        this.monHp += amt;
        this.msgs.push({ text: `${this.monName} uses ${move.name}! Regenerates ${amt}!`, sfx: 'heal', anim: 'monheal', hpTo: this.monHp });
      } else if (move.effect === 'atkup') {
        this.monAtkBuff = Math.min(2, this.monAtkBuff + 1);
        this.msgs.push({ text: `${this.monName} HOWLS! Its fury rises!`, sfx: 'poison' });
      } else if (move.effect === 'stun') {
        this.dealToPlayer(move, true);
      } else {
        this.dealToPlayer(move, false);
      }
    }
  }

  playerAttack(sword: 'steel' | 'silver') {
    // initiative: a faster foe strikes before the blade comes out
    if (this.monFirst && this.monHp > 0) this.monAct();
    if (this.php <= 0) { this.afterQueue = 'defeat'; this.flush(); return; }

    const m = this.host.player;
    let mult = 1;
    if (sword === 'steel') mult = this.monType === 'BEAST' ? 1.25 : 0.75;
    else mult = this.monType === 'BEAST' ? 0.75 : 1.25;
    // oil
    if (this.monType === 'NECROPHAGE' && m.oil.necro > 0) mult *= 1.5;
    if (this.monType === 'SPECTER' && m.oil.specter > 0) mult *= 1.5;
    if (this.monType === 'BEAST' && m.oil.beast > 0) mult *= 1.5;
    if (this.monType === 'INSECTOID' && m.oil.insectoid > 0) mult *= 1.5;

    this.msgs.push({ text: sword === 'steel' ? 'You draw STEEL!' : 'You draw SILVER!' });
    if (this.immune && this.monType === 'SPECTER' && m.oil.specter === 0) {
      this.msgs.push({ text: `The blade passes through the ${this.monName}! It needs SPECTER OIL!`, anim: 'monhit', sfx: 'cancel' });
      this.afterQueue = 'monTurn';
      this.flush();
      return;
    }
    const crit = Math.random() < CRIT_RATE;
    let dmg = Math.round(this.patk * this.atkBuff * this.atkDownMul * mult * this.variance() * (crit ? 1.6 : 1));
    dmg = Math.max(1, dmg - this.monDef);
    this.monHp = Math.max(0, this.monHp - dmg);
    let tier = '';
    if (mult > 1.15) tier = sword === 'steel' ? 'Steel bites true! ' : 'Silver bites deep! ';
    else if (mult < 0.85) tier = sword === 'steel' ? 'Steel glances off! ' : 'Silver barely marks it! ';
    this.msgs.push({
      text: crit ? `${tier}A clean cut! ${this.monName} takes ${dmg}!` : `${tier}${this.monName} takes ${dmg} damage.`,
      anim: 'monhit', sfx: crit ? 'strong' : 'hit', hpTo: this.monHp,
    });
    if (this.monHp <= 0) this.queueVictory();
    else this.afterQueue = 'monTurn';
    this.flush();
  }

  castSign(id: string) {
    const s = SIGNS.find((x) => x.id === id)!;
    const cost = Math.max(1, s.cost - (schoolById(this.host.player.school).signDiscount ?? 0));
    if (this.psta < cost) {
      this.msgs.push({ text: 'Not enough STAMINA!', sfx: 'cancel' });
      this.afterQueue = 'menu';
      this.flush();
      return;
    }
    // initiative: a faster foe strikes before the sign forms
    if (this.monFirst && this.monHp > 0) this.monAct();
    if (this.php <= 0) { this.afterQueue = 'defeat'; this.flush(); return; }

    this.psta -= cost;
    let slain = false;
    if (id === 'igni') {
      let mult = 1;
      if (this.monType === 'CURSED') mult = 1.5;
      else if (this.monType === 'INSECTOID') mult = 1.3;
      else if (this.monType === 'NECROPHAGE') mult = 1.2;
      let dmg = Math.round((6 + this.plvl * 2 + Math.floor(Math.random() * 3)) * mult);
      this.monHp = Math.max(0, this.monHp - dmg);
      this.msgs.push({ text: 'IGNI! A torrent of flame!', anim: 'flash', sfx: 'fire', staTo: this.psta });
      const burn = mult > 1 ? (this.monType === 'CURSED' ? 'The curse sears! ' : this.monType === 'INSECTOID' ? 'The chitin scorches! ' : 'The dead flesh sears! ') : '';
      this.msgs.push({ text: `${burn}${this.monName} is scorched for ${dmg}!`, anim: 'monhit', hpTo: this.monHp });
      slain = this.monHp <= 0;
    } else if (id === 'aard') {
      const dmg = 3 + this.plvl;
      this.monHp = Math.max(0, this.monHp - dmg);
      const stun = Math.random() < 0.35;
      this.msgs.push({ text: 'AARD! A shockwave slams the foe!', anim: 'shake', sfx: 'strong', staTo: this.psta });
      if (stun) { this.monStun = 1; this.msgs.push({ text: `${this.monName} is staggered!`, sfx: 'stun' }); }
      this.msgs.push({ text: `${this.monName} reels for ${dmg}!`, anim: 'monhit', hpTo: this.monHp });
      slain = this.monHp <= 0;
    } else if (id === 'quen') {
      this.quenTurns = 3;
      this.quenAmt = 4 + this.plvl * 2;
      this.msgs.push({ text: 'QUEN! A witcher\'s shield shimmers.', sfx: 'shield', anim: 'quen', staTo: this.psta });
    } else if (id === 'axii') {
      const hex = Math.random() < 0.45;
      this.monHp = Math.max(0, this.monHp - 2);
      this.msgs.push({ text: 'AXII! You fix the foe with a hex.', sfx: 'hex', anim: 'hex', staTo: this.psta });
      if (hex) { this.monHex = 1; this.msgs.push({ text: `${this.monName} stands confused!` }); }
      if (this.monHp > 0) this.msgs.push({ text: `${this.monName} shudders, 2 damage.`, hpTo: this.monHp });
      slain = this.monHp <= 0;
    }
    // every path funnels through one exit — the sign-kill softlock is gone
    if (slain) this.queueVictory();
    else this.afterQueue = 'monTurn';
    this.flush();
  }

  useItemBattle(id: string) {
    const it = ITEMS[id];
    if (!it || !(this.host.inv[id] > 0)) return;
    if (it.kind === 'potion') {
      if (id === 'swallow') {
        if (this.php >= this.pmaxHp) {
          this.msgs.push({ text: 'You are already whole. Save it.', sfx: 'cancel' });
          this.afterQueue = 'menu';
          this.flush();
          return;
        }
        this.php = Math.min(this.pmaxHp, this.php + 25);
        this.ptox = Math.min(9, this.ptox + 3);
        this.msgs.push({ text: 'You drink SWALLOW. Wounds knit shut!', sfx: 'heal', anim: 'heal', phpTo: this.php });
      } else if (id === 'thunder') {
        this.atkBuff = 1.5;
        this.ptox = Math.min(9, this.ptox + 3);
        this.msgs.push({ text: 'You drink THUNDERBOLT. Muscles burn!', sfx: 'heal', anim: 'heal' });
      } else if (id === 'honey') {
        this.ptox = 0; this.poison = 0; this.atkBuff = 1; this.atkDownMul = 1; this.defDownMul = 1;
        this.msgs.push({ text: 'WHITE HONEY purges your veins.', sfx: 'heal', anim: 'heal' });
      }
      this.host.inv[id]--;
    } else if (it.kind === 'oil') {
      if (id === 'specteroil') this.host.player.oil.specter = 8;
      if (id === 'necrooil') this.host.player.oil.necro = 8;
      if (id === 'beastoil') this.host.player.oil.beast = 8;
      if (id === 'insectoil') this.host.player.oil.insectoid = 8;
      this.host.inv[id]--;
      this.msgs.push({ text: `You coat your blade: ${it.name}!`, sfx: 'shield', anim: 'oil' });
    }
    // items always resolve before the foe (Gen-1 item priority)
    this.afterQueue = 'monTurn';
    this.flush();
  }

  tryRun() {
    if (this.boss) {
      this.msgs.push({ text: 'There is no running from this!', sfx: 'cancel' });
      this.afterQueue = 'monTurn';
      this.flush();
      return;
    }
    const chance = RUN_BASE + this.plvl * 0.03 - this.monLvl * 0.02;
    if (Math.random() < chance) {
      this.msgs.push({ text: 'You melt into the reeds. Gone.', sfx: 'cancel' });
      this.afterQueue = 'fled';
      this.flush();
    } else {
      this.msgs.push({ text: 'The beast cuts off your retreat!', sfx: 'cancel' });
      this.afterQueue = 'monTurn';
      this.flush();
    }
  }

  queueVictory() {
    this.monDead = true;
    // the faint animation + fanfare fire when this line is READ, not now
    this.msgs.push({ text: `${this.monName} collapses into the mud!`, sfx: 'faint', fx: 'faint' });
    this.afterQueue = 'victory';
  }

  // ---------------- enemy turn & effects ----------------

  monTurn() {
    // zombie guard: a dead foe never takes a turn
    if (this.monHp <= 0) {
      this.afterQueue = 'victory';
      this.buildRewards();
      return;
    }
    this.monAct();
    this.afterQueue = this.php <= 0 ? 'defeat' : 'roundEnd';
    this.flush();
  }

  dealToPlayer(move: { name: string; mult: number; effect?: string }, isStunMove: boolean) {
    let dmg = Math.round(this.monAtk * (1 + 0.3 * this.monAtkBuff) * move.mult * this.variance());
    dmg = Math.max(1, dmg - Math.round(this.pdef * this.defDownMul));
    // QUEN
    if (this.quenTurns > 0) {
      if (this.quenAmt >= dmg) {
        this.quenAmt -= dmg;
        this.msgs.push({ text: `${this.monName} uses ${move.name}! QUEN absorbs ${dmg}!`, sfx: 'shield', anim: 'quen' });
        return;
      } else {
        dmg -= this.quenAmt;
        this.quenTurns = 0; this.quenAmt = 0;
        this.msgs.push({ text: `QUEN shatters! ${move.name} punches through!`, sfx: 'shield', anim: 'shake' });
      }
    } else {
      this.msgs.push({ text: `${this.monName} uses ${move.name}!`, anim: 'playerhit', sfx: 'hit' });
    }
    this.php = Math.max(0, this.php - dmg);
    this.msgs.push({ text: `You take ${dmg} damage.`, anim: 'playerhit', phpTo: this.php });
    if (move.effect === 'poison') { this.poison = 3; this.msgs.push({ text: 'The wound festers... POISONED!', sfx: 'poison' }); }
    if (move.effect === 'atkdown') { this.atkDownMul = 0.75; this.msgs.push({ text: 'Your grip weakens!' }); }
    if (move.effect === 'defdown') { this.defDownMul = 0.75; this.msgs.push({ text: 'You stagger, guard open!' }); }
    if (isStunMove) {
      this.pStun = 1;
      this.msgs.push({ text: 'Roots bind your boots! You cannot move!', sfx: 'stun' });
    }
    if (this.php <= 0) {
      this.msgs.push({ text: 'You fall to one knee... The world goes dark.', sfx: 'faint', fx: 'playerfaint' });
    }
  }

  roundEnd() {
    // bound by roots/web: the next turn is the monster's
    if (this.pStun > 0) {
      this.pStun = 0;
      this.msgs.push({ text: 'You tear free of the roots!' });
      this.afterQueue = 'monTurn';
      this.flush();
      return;
    }
    // poison
    if (this.poison > 0) {
      this.php = Math.max(0, this.php - 2);
      this.poison--;
      this.msgs.push({ text: 'Poison burns your veins. -2 HP', sfx: 'poison', phpTo: this.php });
      if (this.php <= 0) {
        this.msgs.push({ text: 'The venom wins... Darkness.', sfx: 'faint', fx: 'playerfaint' });
        this.afterQueue = 'defeat';
        this.flush();
        return;
      }
    }
    // toxicity
    if (this.ptox > 6) {
      this.php = Math.max(0, this.php - 1);
      this.msgs.push({ text: 'Toxicity gnaws at you. -1 HP', sfx: 'poison', phpTo: this.php });
      if (!this.toxWarned) { this.toxWarned = true; this.msgs.push({ text: 'Too many potions! Drink WHITE HONEY or rest!' }); }
      if (this.php <= 0) {
        this.msgs.push({ text: 'The toxins win... Darkness.', sfx: 'faint', fx: 'playerfaint' });
        this.afterQueue = 'defeat';
        this.flush();
        return;
      }
    }
    // sta regen & quen tick (silent: no msg, bar follows directly)
    this.psta = Math.min(this.pmaxSta, this.psta + 1);
    this.barPsta = this.psta;
    if (this.quenTurns > 0) this.quenTurns--;
    // next round's initiative
    this.rollInitiative();
    this.afterQueue = 'menu';
    if (this.msgs.length === 0) this.phase = 'menu';
    else this.flush();
  }

  // ---------------- victory ----------------

  buildRewards() {
    const def = MONSTERS[this.monId];
    const p = this.host.player;
    this.msgs.push({ text: `You slew the ${this.monName}!`, sfx: 'levelup' });
    this.host.countKill(this.monId);
    p.xp += def.xp;
    this.msgs.push({ text: `+${def.xp} XP earned.` });
    if (def.drop && Math.random() < def.drop.chance) {
      this.host.giveItem(def.drop.item, 1);
      this.msgs.push({ text: `Looted ${ITEMS[def.drop.item].name}!`, sfx: 'coin' });
    }
    // level ups
    while (p.lvl < 10 && p.xp >= xpForLevel(p.lvl + 1)) {
      p.lvl++;
      p.maxHp += 5; p.maxSta += 2; p.atk += 1; p.def += 1;
      p.skillPoints = (p.skillPoints ?? 0) + 1;
      this.php = p.maxHp; this.pmaxHp = p.maxHp;
      this.psta = p.maxSta; this.pmaxSta = p.maxSta;
      this.patK_up();
      this.msgs.push({ text: `LEVEL UP! You are now level ${p.lvl}!`, sfx: 'levelup', phpTo: this.php, staTo: this.psta });
      this.msgs.push({ text: 'HP+5 STA+2 ATK+1 DEF+1. +1 SKILL POINT - train in the menu!' });
    }
    this.afterQueue = 'done-victory';
    this.flush();
  }

  patK_up() {
    const p = this.host.player;
    this.patk = p.atk + p.swordLvl * 3;
    this.pdef = p.def + p.armorLvl * 2;
  }

  // ---------------- pointer (mouse) ----------------
  pointerClick(x: number, y: number, btn: 'a' | 'b', input: InputState) {
    const J = input.just;
    if (this.phase === 'intro') { this.introT += 999; return; }
    if (btn === 'b') { J.add('b'); return; }
    if (this.phase === 'msg') { J.add('a'); return; }
    if (this.phase === 'menu') {
      if (x >= 76 && x <= 158 && y >= 100 && y <= 142) {
        const row = y < 121 ? 0 : 1;
        const col = x < 116 ? 0 : 1;
        const idx = row * 2 + col;
        if (this.menuIdx === idx) J.add('a');
        else { this.menuIdx = idx; audio.sfx('blip'); }
      }
      return;
    }
    if (this.phase === 'fight') {
      for (let i = 0; i < 2; i++) {
        const ry = 107 + i * 15;
        if (x >= 2 && x <= 158 && y >= ry - 3 && y <= ry + 9) {
          if (this.subIdx === i) J.add('a');
          else { this.subIdx = i; audio.sfx('blip'); }
          return;
        }
      }
      return;
    }
    if (this.phase === 'sign') {
      // 2x2 grid: IGNI/AARD top, QUEN/AXII bottom, BACK last row
      if (y >= 104 && y <= 131 && x >= 2 && x <= 158) {
        const idx = (y >= 115 ? 2 : 0) + (x >= 76 ? 1 : 0);
        if (this.subIdx === idx) J.add('a');
        else { this.subIdx = idx; audio.sfx('blip'); }
        return;
      }
      if (y >= 131 && y <= 142 && x >= 2 && x <= 158) {
        if (this.subIdx >= SIGNS.length) J.add('a');
        else { this.subIdx = SIGNS.length; audio.sfx('blip'); }
      }
      return;
    }
    if (this.phase === 'item') {
      const { list, start } = this.itemWindow();
      const vis = Math.min(3, list.length);
      for (let i = 0; i < vis; i++) {
        const ry = 105 + i * 9;
        if (x >= 2 && x <= 158 && y >= ry - 3 && y <= ry + 9) {
          const idx = start + i;
          if (this.itemIdx === idx) J.add('a');
          else { this.itemIdx = idx; audio.sfx('blip'); }
          return;
        }
      }
      const by = 105 + vis * 9;
      if (x >= 2 && x <= 158 && y >= by - 3 && y <= by + 9) {
        if (this.itemIdx >= list.length) J.add('a');
        else { this.itemIdx = list.length; audio.sfx('blip'); }
      }
      return;
    }
  }

  // ---------------- update ----------------

  /** shared message typing (used by intro slide-in and msg phases) */
  typeUpdate(dt: number, input: InputState) {
    const speed = 28; // chars per second
    const full = this.curMsg.length;
    if (this.charIdx < full) {
      const adv = Math.max(1, Math.round(dt / 1000 * speed));
      const before = Math.floor(this.charIdx);
      this.charIdx = Math.min(full, this.charIdx + adv);
      if (Math.floor(this.charIdx) > before && Math.floor(this.charIdx) % 2 === 0) audio.sfx('text');
      if (input.just.has('a') || input.just.has('b')) this.charIdx = full;
    }
  }

  update(dt: number, input: InputState) {
    this.time += dt;
    if (this.animT > 0) this.animT -= dt;
    if (this.faintT > 0) this.faintT -= dt;
    if (this.pFaintT > 0) this.pFaintT -= dt;
    // bars drain toward the msg-gated targets (full bar in ~0.8-1.1s)
    const mrate = Math.max(18, this.monMaxHp / 0.9);
    const prate = Math.max(14, this.pmaxHp / 1.0);
    const srate = Math.max(6, this.pmaxSta / 0.6);
    this.dispMonHp = approach(this.dispMonHp, this.barMonHp, mrate * dt / 1000);
    this.dispPhp = approach(this.dispPhp, this.barPhp, prate * dt / 1000);
    this.dispSta = approach(this.dispSta, this.barPsta, srate * dt / 1000);
    const J = input.just;
    const press = (b: string) => J.has(b);

    if (this.phase === 'intro') {
      this.introT += dt;
      this.typeUpdate(dt, input);
      if (this.introT > 700) { this.phase = 'msg'; this.msgHold = 0; }
      return;
    }

    if (this.phase === 'menu') {
      if (press('right') || press('left')) { this.menuIdx ^= 1; audio.sfx('blip'); }
      if (press('down') || press('up')) { this.menuIdx ^= 2; audio.sfx('blip'); }
      if (press('a')) {
        audio.sfx('confirm');
        if (this.menuIdx === 0) { this.phase = 'fight'; this.subIdx = 0; }
        else if (this.menuIdx === 1) { this.phase = 'item'; this.itemIdx = 0; }
        else if (this.menuIdx === 2) { this.phase = 'sign'; this.subIdx = 0; }
        else this.tryRun();
      }
      return;
    }

    if (this.phase === 'fight') {
      const items = ['STEEL SWORD', 'SILVER SWORD'];
      if (press('up')) { this.subIdx = (this.subIdx + items.length - 1) % items.length; audio.sfx('blip'); }
      if (press('down')) { this.subIdx = (this.subIdx + 1) % items.length; audio.sfx('blip'); }
      if (press('b')) { this.phase = 'menu'; audio.sfx('cancel'); return; }
      if (press('a')) {
        audio.sfx('confirm');
        this.playerAttack(this.subIdx === 0 ? 'steel' : 'silver');
      }
      return;
    }

    if (this.phase === 'sign') {
      const n = SIGNS.length + 1;
      if (press('up')) { this.subIdx = (this.subIdx + n - 2) % n; audio.sfx('blip'); }
      if (press('down')) { this.subIdx = (this.subIdx + 2) % n; audio.sfx('blip'); }
      if (press('left')) { this.subIdx = (this.subIdx + n - 1) % n; audio.sfx('blip'); }
      if (press('right')) { this.subIdx = (this.subIdx + 1) % n; audio.sfx('blip'); }
      if (press('b')) { this.phase = 'menu'; audio.sfx('cancel'); return; }
      if (press('a')) {
        if (this.subIdx >= SIGNS.length) { this.phase = 'menu'; audio.sfx('cancel'); return; }
        audio.sfx('confirm');
        this.castSign(SIGNS[this.subIdx].id);
      }
      return;
    }

    if (this.phase === 'item') {
      const list = this.battleItemList();
      const n = list.length + 1;
      if (press('up') && n > 1) { this.itemIdx = (this.itemIdx + n - 1) % n; audio.sfx('blip'); }
      if (press('down') && n > 1) { this.itemIdx = (this.itemIdx + 1) % n; audio.sfx('blip'); }
      if (press('b')) { this.phase = 'menu'; audio.sfx('cancel'); return; }
      if (press('a')) {
        if (this.itemIdx >= list.length || list.length === 0) { this.phase = 'menu'; audio.sfx('cancel'); return; }
        audio.sfx('confirm');
        this.useItemBattle(list[this.itemIdx].id);
      }
      return;
    }

    if (this.phase === 'msg') {
      this.typeUpdate(dt, input);
      if (this.charIdx >= this.curMsg.length) {
        this.msgHold += dt;
        // intermediate lines flow at reading pace; the final line of a chain
        // lingers a little longer (A or B always skips ahead)
        const isLast = this.msgs.length === 1;
        if (this.msgHold > (isLast ? 1400 : 900) || press('a') || press('b')) {
          this.msgs.shift();
          if (this.msgs.length === 0) {
            this.drainQueue();
          } else {
            this.startNextMsg();
          }
        }
      }
      return;
    }
  }

  startNextMsg() {
    if (this.msgs.length === 0) { this.drainQueue(); return; }
    const m = this.msgs[0];
    this.curMsg = m.text;
    this.curAnim = m.anim ?? null;
    this.charIdx = 0;
    this.msgHold = 0;
    // deferred effects fire when the line is READ
    if (m.hpTo !== undefined) this.barMonHp = m.hpTo;
    if (m.phpTo !== undefined) this.barPhp = m.phpTo;
    if (m.staTo !== undefined) this.barPsta = m.staTo;
    if (m.fx === 'faint') { this.faintStarted = true; this.faintT = 720; audio.playMusic('victory'); }
    if (m.fx === 'playerfaint') { this.pFaintStarted = true; this.pFaintT = 600; }
    if (this.curAnim) this.animT = this.curAnim === 'flash' ? 500 : 420;
    if (m.sfx) audio.sfx(m.sfx);
  }

  flush() {
    this.phase = 'msg';
    this.startNextMsg();
  }

  drainQueue() {
    switch (this.afterQueue) {
      case 'monTurn': this.monTurn(); break;
      case 'roundEnd': this.roundEnd(); break;
      case 'menu': this.phase = 'menu'; break;
      case 'victory': this.buildRewards(); break;
      case 'defeat': this.finish('defeat'); break;
      case 'fled': this.finish('fled'); break;
      case 'done-victory': this.finish('victory'); break;
      default: this.phase = 'menu';
    }
  }

  finish(result: 'victory' | 'defeat' | 'fled') {
    if (this.resolved) return;   // idempotent: no double exits
    this.resolved = true;
    this.doneResult = result;
    this.phase = 'done';
    // write back player state
    const p = this.host.player;
    p.hp = result === 'defeat' ? 0 : Math.max(1, this.php);
    p.sta = this.psta;
    p.tox = this.ptox;
    // oil battles tick
    if (result !== 'defeat') {
      p.oil.specter = Math.max(0, p.oil.specter - 1);
      p.oil.necro = Math.max(0, p.oil.necro - 1);
      p.oil.beast = Math.max(0, p.oil.beast - 1);
      p.oil.insectoid = Math.max(0, p.oil.insectoid - 1);
    }
    this.host.onBattleEnd(result, this.monId);
  }

  // ---------------- render ----------------

  render(ctx: CanvasRenderingContext2D) {
    const W = 160, H = 144;
    // backdrop
    ctx.fillStyle = C.DARK;
    ctx.fillRect(0, 0, W, H);
    // enemy backdrop card (Gen-1 style): a bright panel so DARK-filled
    // monsters (leshen, katakan...) read against it, not against the sky
    ctx.fillStyle = C.PAPER;
    ctx.fillRect(100, 0, 60, 52);
    ctx.fillStyle = C.INK;
    ctx.fillRect(99, 0, 1, 52);
    // ground bands
    ctx.fillStyle = C.LIGHT;
    ctx.fillRect(0, 52, W, 8);
    ctx.fillStyle = C.PAPER;
    ctx.fillRect(0, 60, W, 4);

    let ox = 0, oy = 0;
    if (this.animT > 0 && this.curAnim === 'shake') {
      ox = Math.round(Math.sin(this.time / 18) * 2);
      oy = Math.round(Math.cos(this.time / 12));
    }

    // monster sprite (top right) — one shared feet line at y=51 (the top of
    // the ground bands): mobs 32px at y=20, bosses 48px at y=4 flush right.
    // (y>=56 is forbidden: the player info box covers x80-155 from y56 down.)
    const spr = MONSTER_GFX[this.monId];
    if (spr) {
      const boss = spr.width > 40;
      const baseX = boss ? 110 : 116;
      const baseY = boss ? 4 : 20;
      let mx = baseX, my = baseY;
      if (this.phase === 'intro') {
        const t = Math.min(1, this.introT / 500);
        mx = baseX + Math.round((1 - t) * 60);
      }
      // attack lunge: anticipation -> strike toward the player -> recover
      let lgx = 0, lgy = 0;
      if (this.animT > 0 && this.curAnim === 'playerhit') {
        const t = 420 - this.animT;
        if (t < 90) { lgx = 2; lgy = -1; }
        else if (t < 210) { const k = (t - 90) / 120; lgx = Math.round(2 - 9 * k); lgy = Math.round(-1 + 5 * k); }
        else if (t < 300) { lgx = -7; lgy = 4; }
        else { const k = Math.min(1, (t - 300) / 120); lgx = Math.round(-7 * (1 - k)); lgy = Math.round(4 * (1 - k)); }
      }
      mx += lgx; my += lgy;
      // hit blink only around the impact window
      let skip = this.animT > 0 && this.curAnim === 'monhit' && this.animT < 260 && Math.floor(this.time / 70) % 2 === 0;
      let alpha = 1;
      let sink = 0;
      if (this.monDead && this.faintStarted) {
        if (this.faintT <= 0) skip = true;                 // gone for good
        else {
          sink = Math.floor((720 - this.faintT) / 45);      // sinks 1px / 45ms
          if (Math.floor(this.faintT / 80) % 2 === 0) skip = true;
          if (this.faintT < 200) alpha = this.faintT / 200; // final fade-out
        }
      }
      if (!skip) {
        // contact shadow on the ground band, a little wider than the sprite
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = C.INK;
        ctx.fillRect(mx - 2 + ox, 52 + oy, spr.width + 4, 2);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spr, mx + ox, my + oy + sink);
        ctx.globalAlpha = 1;
      }
      // slash streaks over the foe at the moment of impact
      if (this.curAnim === 'monhit' && this.animT < 210 && this.animT > 60) {
        ctx.fillStyle = C.INK;
        ctx.fillRect(mx + 6 + ox, 26 + oy, 1, 8);
        ctx.fillRect(mx + 11 + ox, 22 + oy, 1, 10);
        ctx.fillRect(mx + 16 + ox, 26 + oy, 1, 8);
      }
      // AXII hex: orbiting dots around the monster's head
      if (this.animT > 0 && this.curAnim === 'hex') {
        ctx.fillStyle = C.INK;
        const cx = mx + spr.width / 2, cy = my + 4;
        for (let i = 0; i < 3; i++) {
          const a = this.time / 140 + (i * Math.PI * 2) / 3;
          ctx.fillRect(Math.round(cx + Math.cos(a) * 14), Math.round(cy + Math.sin(a) * 5), 2, 2);
        }
      }
      // monster regen: rising sap-sparkles
      if (this.animT > 0 && this.curAnim === 'monheal') {
        const t = 420 - this.animT;
        for (let i = 0; i < 6; i++) {
          const px = mx + 4 + ((i * 13 + Math.floor(t / 80) * 7) % Math.max(8, spr.width - 8));
          const py = 46 - ((Math.floor(t / 70) + i * 3) % 30);
          ctx.fillStyle = i % 2 ? C.LIGHT : C.PAPER;
          ctx.fillRect(px, py, 2, 2);
        }
      }
    }

    // player back sprite (bottom left, scaled 2x) — platform, slide-in,
    // attack lunge, hit shake, KO sink
    const pFaintHide = this.pFaintStarted && this.pFaintT <= 0;
    const hideP = !pFaintHide
      && this.animT > 0 && this.curAnim === 'playerhit' && this.animT < 260 && Math.floor(this.time / 70) % 2 === 0;
    const pHidden = pFaintHide || hideP;
    if (!pHidden) {
      // attack lunge with anticipation arc
      let lunge = 0;
      if (this.animT > 0 && this.curAnim === 'monhit') {
        const t = 420 - this.animT;
        if (t < 90) lunge = -2;
        else if (t < 210) lunge = Math.round(-2 + 10 * ((t - 90) / 120));
        else if (t < 300) lunge = 8;
        else lunge = Math.round(8 * (1 - (t - 300) / 120));
      }
      // hit knockback shake
      let py2 = 0;
      if (this.animT > 0 && this.curAnim === 'playerhit') py2 = Math.round(Math.sin(this.time / 14) * 2);
      // KO sink + fade
      let psink = 0, palpha = 1;
      if (this.pFaintStarted) {
        psink = Math.floor((600 - Math.max(0, this.pFaintT)) / 50);
        if (this.pFaintT < 160 && this.pFaintT > 0) palpha = this.pFaintT / 160;
      }
      // ground platform (Gen-1 ledge) under the witcher
      ctx.fillStyle = C.LIGHT;
      ctx.fillRect(10 + ox, 86 + oy, 40, 2);
      ctx.fillRect(12 + ox, 88 + oy, 36, 2);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = C.INK;
      ctx.fillRect(12 + ox, 90 + oy, 36, 1);
      ctx.globalAlpha = 1;
      // slide-in from the left during the intro
      let px2 = 14;
      if (this.phase === 'intro') {
        const t = Math.min(1, this.introT / 500);
        px2 = 14 - Math.round((1 - t) * 44);
      }
      ctx.globalAlpha = palpha;
      ctx.imageSmoothingEnabled = false;
      const pspr = PLAYER.up0;
      ctx.drawImage(pspr, px2 + ox + lunge, 58 + oy + py2 + psink, 32, 32);
      ctx.globalAlpha = 1;
      // QUEN: bracket shield, pulsing while it holds
      if (this.quenTurns > 0) {
        const pulse = (this.animT > 0 && this.curAnim === 'quen') || Math.floor(this.time / 300) % 2 === 0;
        if (pulse) {
          ctx.fillStyle = C.LIGHT;
          // four corner brackets around the witcher
          ctx.fillRect(px2 - 4 + lunge, 56, 2, 6); ctx.fillRect(px2 - 4 + lunge, 56, 6, 2);
          ctx.fillRect(px2 + 38 + lunge, 56, 2, 6); ctx.fillRect(px2 + 34 + lunge, 56, 6, 2);
          ctx.fillRect(px2 - 4 + lunge, 88, 2, 6); ctx.fillRect(px2 - 4 + lunge, 92, 6, 2);
          ctx.fillRect(px2 + 38 + lunge, 88, 2, 6); ctx.fillRect(px2 + 34 + lunge, 92, 6, 2);
        }
      }
      // potion heal: rising plus-sparkles
      if (this.animT > 0 && this.curAnim === 'heal') {
        const t = 420 - this.animT;
        for (let i = 0; i < 4; i++) {
          const sx = 16 + i * 9 + ((i * 5) % 4);
          const sy = 84 - ((Math.floor(t / 90) + i * 2) % 26);
          ctx.fillStyle = i % 2 ? C.LIGHT : C.PAPER;
          ctx.fillRect(sx + 1, sy, 4, 1);
          ctx.fillRect(sx + 2, sy - 1, 2, 3);
        }
      }
      // oil: a glint sweeping down the blade
      if (this.animT > 0 && this.curAnim === 'oil') {
        const t = 420 - this.animT;
        const gx = 8 + Math.round((t / 420) * 44);
        ctx.fillStyle = C.PAPER;
        ctx.fillRect(gx, 62, 2, 4);
        ctx.fillRect(gx + 1, 64, 2, 4);
        ctx.fillStyle = C.LIGHT;
        ctx.fillRect(gx + 2, 66, 2, 4);
      }
    }

    // IGNI: palette-invert flicker over the field + chunky fire over the foe
    if (this.curAnim === 'flash' && this.animT > 0) {
      const on = Math.floor(this.animT / 70) % 2 === 0;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = on ? C.INK : C.PAPER;
      ctx.fillRect(0, 0, W, 96);
      ctx.globalAlpha = 1;
      // flames rising across the monster
      if (spr) {
        const t = 500 - this.animT;
        const fx0 = spr.width > 40 ? 110 : 116;
        for (let i = 0; i < 12; i++) {
          const ph = Math.floor(t / 80) + i;
          const px = fx0 + ((i * 37 + ph * 23) % spr.width);
          const py = 46 - ((ph * 7 + i * 11) % 34);
          ctx.fillStyle = i % 3 === 0 ? C.PAPER : i % 3 === 1 ? C.LIGHT : C.DARK;
          ctx.fillRect(px, py, 2, 3);
        }
      }
    }

    // enemy info box (name left, level + status right-aligned)
    drawWindow(ctx, 4, 4, 92, 26);
    const st = this.monStun > 0 ? ' STN' : this.monHex > 0 ? ' HEX' : this.monAtkBuff > 0 ? ' UP' : '';
    const lvlTxt = `L${this.monLvl}${st}`;
    const lvlX = 90 - textWidth(lvlTxt);
    const nameMax = Math.max(4, Math.floor((lvlX - 8 - 4) / 6));
    drawText(ctx, this.monName.slice(0, nameMax), 8, 9, C.INK);
    drawTextRight(ctx, lvlTxt, 90, 9, C.INK);
    drawText(ctx, 'HP', 8, 19, C.INK);
    drawBar(ctx, 24, 19, 64, this.dispMonHp / this.monMaxHp);

    // player info box (fixed bar column so HP/STA tracks align)
    drawWindow(ctx, 80, 56, 76, 40);
    drawText(ctx, 'VESK', 84, 59, C.INK);
    drawTextRight(ctx, `L${this.plvl}`, 150, 59, C.INK);
    drawText(ctx, 'HP', 84, 68, C.INK);
    drawBar(ctx, 102, 68, 48, this.dispPhp / this.pmaxHp);
    drawText(ctx, 'STA', 84, 78, C.INK);
    drawBar(ctx, 102, 78, 48, this.dispSta / this.pmaxSta);
    // status tags (compact, stop before the frame edge)
    let sx = 84;
    const tag = (on: boolean, txt: string) => {
      if (!on || sx > 128) return;
      drawText(ctx, txt, sx, 87, C.DARK);
      sx += textWidth(txt) + 4;
    };
    tag(this.quenTurns > 0, 'QUN');
    tag(this.poison > 0, 'PSN');
    tag(this.ptox > 6, 'TOX');
    tag(this.atkBuff > 1, 'FUR');
    tag(this.atkDownMul < 1 || this.defDownMul < 1, 'WEK');
    tag(this.pStun > 0, 'ROT');

    // bottom UI
    if (this.phase === 'menu') {
      drawWindow(ctx, 2, 100, 72, 42);
      const lines = wrapText('Steel, silver, sign or brew?', 62);
      lines.slice(0, 3).forEach((l, i) => drawText(ctx, l, 7, 106 + i * 10, C.INK));
      drawWindow(ctx, 76, 100, 82, 42);
      const items = ['FIGHT', 'ITEM', 'SIGN', 'RUN'];
      const pos = [[80, 107], [124, 107], [80, 125], [124, 125]];
      items.forEach((it, i) => {
        drawText(ctx, it, pos[i][0] + 8, pos[i][1], C.INK);
        if (this.menuIdx === i) drawCursor(ctx, pos[i][0], pos[i][1], C.INK);
      });
    } else if (this.phase === 'fight' || this.phase === 'sign' || this.phase === 'item') {
      // submenu full width
      drawWindow(ctx, 2, 100, 156, 42);
      if (this.phase === 'fight') {
        const items = ['STEEL SWORD - beasts', 'SILVER SWORD - monsters'];
        items.forEach((it, i) => {
          drawText(ctx, it, 12, 107 + i * 15, C.INK);
          if (this.subIdx === i) drawCursor(ctx, 5, 107 + i * 15, C.INK);
        });
        drawText(ctx, 'B: back', 108, 132, C.DARK);
      } else if (this.phase === 'sign') {
        // 2x2 sign grid + BACK, all inside the window
        const disc = schoolById(this.host.player.school).signDiscount ?? 0;
        const pos: [number, number][] = [[12, 108], [80, 108], [12, 121], [80, 121]];
        SIGNS.forEach((s, i) => {
          const cost = Math.max(1, s.cost - disc);
          const label = `${s.name} (${cost})`;
          drawText(ctx, label, pos[i][0] + 8, pos[i][1], this.psta >= cost ? C.INK : C.DARK);
          if (this.subIdx === i) drawCursor(ctx, pos[i][0], pos[i][1], C.INK);
        });
        drawText(ctx, 'BACK', 20, 133, C.INK);
        if (this.subIdx >= SIGNS.length) drawCursor(ctx, 12, 133, C.INK);
        drawText(ctx, 'B: back', 108, 133, C.DARK);
      } else {
        // item list with a 3-row scrolling window — the cursor is always visible
        const { list, start } = this.itemWindow();
        if (list.length === 0) {
          drawText(ctx, 'Your pockets are empty.', 8, 108, C.INK);
        }
        list.slice(start, start + 3).forEach((it, i) => {
          const y = 105 + i * 9;
          drawText(ctx, it.label.slice(0, 22), 12, y, C.INK);
          if (this.itemIdx === start + i) drawCursor(ctx, 5, y, C.INK);
        });
        const by = 105 + Math.min(3, list.length) * 9;
        drawText(ctx, 'BACK', 12, by, C.INK);
        if (this.itemIdx >= list.length) drawCursor(ctx, 5, by, C.INK);
        drawText(ctx, 'B: back', 108, 132, C.DARK);
        const blink = Math.floor(this.time / 300) % 2 === 0;
        if (blink && start > 0) drawText(ctx, '↑', 148, 105, C.DARK);
        if (blink && start + 3 < list.length) drawText(ctx, '↓', 148, 121, C.DARK);
      }
    } else {
      // message box (4 lines, wrap leaves room for the ▼ marker)
      drawWindow(ctx, 2, 100, 156, 42);
      const shown = this.curMsg.slice(0, Math.floor(this.charIdx));
      const lines = wrapText(shown, 138);
      lines.slice(0, 4).forEach((l, i) => drawText(ctx, l, 8, 103 + i * 10, C.INK));
      if (this.charIdx >= this.curMsg.length && Math.floor(this.time / 300) % 2 === 0) {
        drawText(ctx, '▼', 149, 133, C.INK);
      }
    }

  }
}
