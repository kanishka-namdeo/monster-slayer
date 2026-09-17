// ============================================================
// Battle system: Pokémon-style turn battles, witcher flavor
// ============================================================
import { MONSTERS, SIGNS, ITEMS, xpForLevel, schoolById } from './data';
import type { MonType } from './data';
import { MONSTER_GFX } from './monstersGfx';
import { PLAYER } from './sprites';
import { drawWindow, drawBar, drawCursor } from './render';
import { drawText, wrapText } from './font';
import { C } from './constants';
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
  anim?: 'monhit' | 'playerhit' | 'shake' | 'flash';
  sfx?: string;
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

  phase: 'intro' | 'menu' | 'fight' | 'sign' | 'item' | 'msg' | 'done' = 'intro';
  menuIdx = 0; subIdx = 0; itemIdx = 0;
  msgs: Msg[] = [];
  curMsg = '';
  curAnim: Msg['anim'] | null = null;
  curSfx = '';
  charIdx = 0; msgHold = 0;
  afterQueue: 'monTurn' | 'roundEnd' | 'menu' | 'victory' | 'defeat' | 'fled' | 'done-victory' = 'menu';
  pendingRewards = false;

  introT = 0;
  animT = 0;
  shakeT = 0;
  tick = 0;
  time = 0;
  doneResult: 'victory' | 'defeat' | 'fled' | null = null;

  constructor(public host: BattleHost, monId: string, lvl: number) {
    const def = MONSTERS[monId];
    this.monId = monId;
    this.monName = def.name;
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

    this.msgs = [{ text: APPEAR[monId] ?? `A ${def.name} appears!`, sfx: 'encounter' }];
    this.afterQueue = 'menu';
  }

  get oilActive(): boolean {
    const t = this.monType;
    const o = this.host.player.oil;
    return (t === 'NECROPHAGE' && o.necro > 0) || (t === 'SPECTER' && o.specter > 0) || (t === 'BEAST' && o.beast > 0) || (t === 'INSECTOID' && o.insectoid > 0);
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

  // ---------------- turn construction ----------------

  playerAttack(sword: 'steel' | 'silver') {
    const m = this.host.player;
    let mult = 1;
    if (sword === 'steel') mult = this.monType === 'BEAST' ? 1 : 0.7;
    else mult = this.monType === 'BEAST' ? 0.7 : 1;
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
    const crit = Math.random() < 0.09;
    let dmg = Math.round(this.patk * this.atkBuff * this.atkDownMul * mult * this.variance() * (crit ? 1.6 : 1));
    dmg = Math.max(1, dmg - this.monDef);
    this.monHp = Math.max(0, this.monHp - dmg);
    this.msgs.push({
      text: crit ? `A clean cut! ${this.monName} takes ${dmg}!` : `${this.monName} takes ${dmg} damage.`,
      anim: 'monhit', sfx: crit ? 'strong' : 'hit',
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
    this.psta -= cost;
    if (id === 'igni') {
      let dmg = 6 + this.plvl * 2 + Math.floor(Math.random() * 3);
      if (this.monType === 'CURSED') dmg = Math.round(dmg * 1.5);
      this.monHp = Math.max(0, this.monHp - dmg);
      this.msgs.push({ text: 'IGNI! A torrent of flame!', anim: 'flash', sfx: 'fire' });
      this.msgs.push({ text: `${this.monName} is scorched for ${dmg}!`, anim: 'monhit' });
      if (this.monHp <= 0) { this.queueVictory(); return; }
    } else if (id === 'aard') {
      const dmg = 3 + this.plvl;
      this.monHp = Math.max(0, this.monHp - dmg);
      const stun = Math.random() < 0.35;
      this.msgs.push({ text: 'AARD! A shockwave slams the foe!', anim: 'shake', sfx: 'strong' });
      if (stun) { this.monStun = 1; this.msgs.push({ text: `${this.monName} is staggered!` }); }
      if (this.monHp <= 0) { this.queueVictory(); return; }
    } else if (id === 'quen') {
      this.quenTurns = 3;
      this.quenAmt = 4 + this.plvl * 2;
      this.msgs.push({ text: 'QUEN! A witcher\'s shield shimmers.', sfx: 'shield' });
    } else if (id === 'axii') {
      const hex = Math.random() < 0.45;
      this.monHp = Math.max(0, this.monHp - 2);
      this.msgs.push({ text: 'AXII! You fix the foe with a hex.', sfx: 'hex' });
      if (hex) { this.monHex = 1; this.msgs.push({ text: `${this.monName} stands confused!` }); }
      if (this.monHp <= 0) { this.queueVictory(); return; }
    }
    this.afterQueue = 'monTurn';
    this.flush();
  }

  useItemBattle(id: string) {
    const it = ITEMS[id];
    if (!it || !(this.host.inv[id] > 0)) return;
    if (it.kind === 'potion') {
      if (id === 'swallow') {
        this.php = Math.min(this.pmaxHp, this.php + 25);
        this.ptox = Math.min(9, this.ptox + 3);
        this.msgs.push({ text: 'You drink SWALLOW. Wounds knit shut!', sfx: 'heal' });
      } else if (id === 'thunder') {
        this.atkBuff = 1.5;
        this.ptox = Math.min(9, this.ptox + 3);
        this.msgs.push({ text: 'You drink THUNDERBOLT. Muscles burn!', sfx: 'heal' });
      } else if (id === 'honey') {
        this.ptox = 0; this.poison = 0; this.atkBuff = 1; this.atkDownMul = 1; this.defDownMul = 1;
        this.msgs.push({ text: 'WHITE HONEY purges your veins.', sfx: 'heal' });
      }
      this.host.inv[id]--;
    } else if (it.kind === 'oil') {
      if (id === 'specteroil') this.host.player.oil.specter = 8;
      if (id === 'necrooil') this.host.player.oil.necro = 8;
      if (id === 'beastoil') this.host.player.oil.beast = 8;
      if (id === 'insectoil') this.host.player.oil.insectoid = 8;
      this.host.inv[id]--;
      this.msgs.push({ text: `You coat your blade: ${it.name}!`, sfx: 'shield' });
    }
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
    const chance = 0.55 + this.plvl * 0.03 - this.monLvl * 0.02;
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
    this.msgs.push({ text: `${this.monName} collapses into the mud!`, sfx: 'faint', anim: 'monhit' });
    this.afterQueue = 'victory';
  }

  // ---------------- enemy turn & effects ----------------

  monTurn() {
    const def = MONSTERS[this.monId];
    if (this.monStun > 0) {
      this.monStun = 0;
      this.msgs.push({ text: `${this.monName} is still reeling!` });
    } else if (this.monHex > 0) {
      this.monHex = 0;
      this.msgs.push({ text: `${this.monName} stares at nothing, hexed.` });
    } else {
      // pick move
      let pool = def.moves;
      if (this.monHp < this.monMaxHp * 0.35) pool = def.moves.map((m) => (m.effect === 'heal' ? { ...m, weight: m.weight * 4 } : m));
      const total = pool.reduce((a, m) => a + m.weight, 0);
      let roll = Math.random() * total;
      let move = pool[0];
      for (const m of pool) { roll -= m.weight; if (roll <= 0) { move = m; break; } }

      if (move.effect === 'heal') {
        const amt = Math.min(this.monMaxHp - this.monHp, 10 + this.monLvl);
        this.monHp += amt;
        this.msgs.push({ text: `${this.monName} uses ${move.name}! Regenerates ${amt}!`, sfx: 'heal' });
      } else if (move.effect === 'atkup') {
        this.monAtkBuff = Math.min(2, this.monAtkBuff + 1);
        this.msgs.push({ text: `${this.monName} HOWLS! Its fury rises!`, sfx: 'poison' });
      } else if (move.effect === 'stun') {
        this.dealToPlayer(move, true);
      } else {
        this.dealToPlayer(move, false);
      }
    }
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
        this.msgs.push({ text: `${this.monName} uses ${move.name}! QUEN absorbs ${dmg}!`, sfx: 'shield' });
        return;
      } else {
        dmg -= this.quenAmt;
        this.quenTurns = 0; this.quenAmt = 0;
        this.msgs.push({ text: `QUEN shatters! ${move.name} punches through!`, sfx: 'shield' });
      }
    } else {
      this.msgs.push({ text: `${this.monName} uses ${move.name}!`, anim: 'playerhit', sfx: 'hit' });
    }
    this.php = Math.max(0, this.php - dmg);
    this.msgs.push({ text: `You take ${dmg} damage.`, anim: 'playerhit' });
    if (move.effect === 'poison') { this.poison = 3; this.msgs.push({ text: 'The wound festers... POISONED!', sfx: 'poison' }); }
    if (move.effect === 'atkdown') { this.atkDownMul = 0.75; this.msgs.push({ text: 'Your grip weakens!' }); }
    if (move.effect === 'defdown') { this.defDownMul = 0.75; this.msgs.push({ text: 'You stagger, guard open!' }); }
    if (isStunMove) { this.msgs.push({ text: 'Roots bind your boots! You cannot move!' }); }
    if (this.php <= 0) {
      this.msgs.push({ text: 'You fall to one knee... The world goes dark.', sfx: 'faint' });
      this.afterQueue = 'defeat';
    }
  }
  roundEnd() {
    // poison
    if (this.poison > 0) {
      this.php = Math.max(0, this.php - 2);
      this.poison--;
      this.msgs.push({ text: 'Poison burns your veins. -2 HP', sfx: 'poison' });
      if (this.php <= 0) {
        this.msgs.push({ text: 'The venom wins... Darkness.', sfx: 'faint' });
        this.afterQueue = 'defeat';
        this.flush();
        return;
      }
    }
    // toxicity
    if (this.ptox > 6) {
      this.php = Math.max(0, this.php - 1);
      this.msgs.push({ text: 'Toxicity gnaws at you. -1 HP', sfx: 'poison' });
      if (!this.toxWarned) { this.toxWarned = true; this.msgs.push({ text: 'Too many potions! Drink WHITE HONEY or rest!' }); }
      if (this.php <= 0) {
        this.msgs.push({ text: 'The toxins win... Darkness.', sfx: 'faint' });
        this.afterQueue = 'defeat';
        this.flush();
        return;
      }
    }
    // sta regen & quen tick
    this.psta = Math.min(this.pmaxSta, this.psta + 1);
    if (this.quenTurns > 0) this.quenTurns--;
    this.afterQueue = 'menu';
    if (this.msgs.length === 0) this.phase = 'menu';
    else this.flush();
  }

  // ---------------- victory ----------------

  buildRewards() {
    const def = MONSTERS[this.monId];
    const p = this.host.player;
    audio.playMusic('victory');
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
      this.msgs.push({ text: `LEVEL UP! You are now level ${p.lvl}!`, sfx: 'levelup' });
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

  // ---------------- update ----------------

  update(dt: number, input: InputState) {
    this.time += dt;
    this.tick += dt;
    if (this.animT > 0) this.animT -= dt;
    const J = input.just;
    const press = (b: string) => J.has(b);

    if (this.phase === 'intro') {
      this.introT += dt;
      if (this.introT > 700) { this.phase = 'msg'; this.startNextMsg(); }
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
      if (press('up')) { this.subIdx = (this.subIdx + n - 1) % n; audio.sfx('blip'); }
      if (press('down')) { this.subIdx = (this.subIdx + 1) % n; audio.sfx('blip'); }
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
      const speed = 28; // chars per second
      const full = this.curMsg.length;
      if (this.charIdx < full) {
        let adv = Math.max(1, Math.round(dt / 1000 * speed));
        const before = Math.floor(this.charIdx);
        this.charIdx = Math.min(full, this.charIdx + adv);
        if (Math.floor(this.charIdx) > before && Math.floor(this.charIdx) % 2 === 0) audio.sfx('text');
        if (press('a') || press('b')) this.charIdx = full;
      } else {
        this.msgHold += dt;
        if (this.msgHold > 480 || press('a')) {
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
    this.curSfx = m.sfx ?? '';
    this.charIdx = 0;
    this.msgHold = 0;
    if (this.curAnim) this.animT = 420;
    if (this.curSfx) audio.sfx(this.curSfx);
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

    // monster sprite (top right)
    const spr = MONSTER_GFX[this.monId];
    if (spr) {
      let mx = 116, my = 18;
      if (this.phase === 'intro') {
        const t = Math.min(1, this.introT / 500);
        mx = 116 + Math.round((1 - t) * 60);
      }
      const hide = this.animT > 0 && this.curAnim === 'monhit' && Math.floor(this.time / 70) % 2 === 0;
      if (!hide) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spr, mx + ox, my + oy);
      }
    }

    // player back sprite (bottom left, scaled 2x)
    const hideP = this.animT > 0 && this.curAnim === 'playerhit' && Math.floor(this.time / 70) % 2 === 0;
    if (!hideP) {
      ctx.imageSmoothingEnabled = false;
      const pspr = PLAYER.up0;
      ctx.drawImage(pspr, 14 + ox, 58 + oy, 32, 32);
    }

    if (this.curAnim === 'flash' && this.animT > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = C.PAPER;
      ctx.fillRect(0, 0, W, 96);
      ctx.globalAlpha = 1;
    }

    // enemy info box
    drawWindow(ctx, 4, 4, 76, 26);
    drawText(ctx, this.monName.slice(0, 12), 8, 9, C.INK);
    drawText(ctx, `L${this.monLvl}`, 66, 9, C.INK);
    drawBar(ctx, 8, 18, 68, this.monHp / this.monMaxHp, 'HP');

    // player info box
    drawWindow(ctx, 80, 66, 76, 30);
    drawText(ctx, 'VESK', 84, 71, C.INK);
    drawText(ctx, `L${this.plvl}`, 140, 71, C.INK);
    drawBar(ctx, 90, 80, 60, this.php / this.pmaxHp, 'HP');
    drawBar(ctx, 90, 88 - 3 + 3, 60, this.psta / this.pmaxSta);
    drawText(ctx, 'STA', 84, 85, C.INK);
    if (this.quenTurns > 0) drawText(ctx, 'QUEN', 84, 90, C.DARK);
    if (this.poison > 0) drawText(ctx, 'PSN', 120, 90, C.DARK);
    if (this.ptox > 6) drawText(ctx, 'TOX', 140, 90, C.INK);

    // bottom UI
    if (this.phase === 'menu') {
      drawWindow(ctx, 2, 100, 72, 42);
      const lines = wrapText('Steel, silver, sign or brew?', 62);
      lines.slice(0, 3).forEach((l, i) => drawText(ctx, l, 7, 106 + i * 10, C.INK));
      drawWindow(ctx, 76, 100, 82, 42);
      const items = ['FIGHT', 'ITEM', 'SIGN', 'RUN'];
      const pos = [[84, 107], [128, 107], [84, 125], [128, 125]];
      items.forEach((it, i) => {
        drawText(ctx, it, pos[i][0] + 8, pos[i][1], C.INK);
        if (this.menuIdx === i) drawCursor(ctx, pos[i][0], pos[i][1], C.INK);
      });
    } else if (this.phase === 'fight' || this.phase === 'sign' || this.phase === 'item') {
      // submenu full width
      drawWindow(ctx, 2, 100, 156, 42);
      if (this.phase === 'fight') {
        const items = ['STEEL SWORD - for beasts of flesh', 'SILVER SWORD - for monsters'];
        items.forEach((it, i) => {
          drawText(ctx, it, 12, 107 + i * 13, C.INK);
          if (this.subIdx === i) drawCursor(ctx, 5, 107 + i * 13, C.INK);
        });
        drawText(ctx, 'B: back', 100, 132, C.DARK);
      } else if (this.phase === 'sign') {
        SIGNS.forEach((s, i) => {
          const y = 105 + i * 9;
          const label = `${s.name} (${s.cost})`;
          drawText(ctx, label, 12, y, this.psta >= s.cost ? C.INK : C.DARK);
          if (this.subIdx === i) drawCursor(ctx, 5, y, C.INK);
        });
        const y = 105 + SIGNS.length * 9;
        drawText(ctx, 'BACK', 12, y, C.INK);
        if (this.subIdx === SIGNS.length) drawCursor(ctx, 5, y, C.INK);
      } else {
        const list = this.battleItemList();
        if (list.length === 0) {
          drawText(ctx, 'Your pockets are empty.', 8, 108, C.INK);
        }
        list.slice(0, 3).forEach((it, i) => {
          const y = 105 + i * 9;
          drawText(ctx, it.label.slice(0, 22), 12, y, C.INK);
          if (this.itemIdx === i) drawCursor(ctx, 5, y, C.INK);
        });
        const y = 105 + Math.min(3, list.length) * 9;
        drawText(ctx, 'BACK', 12, y, C.INK);
        if (this.itemIdx >= list.length) drawCursor(ctx, 5, y, C.INK);
        drawText(ctx, 'B: back', 108, 132, C.DARK);
      }
    } else {
      // message box
      drawWindow(ctx, 2, 100, 156, 42);
      const shown = this.curMsg.slice(0, Math.floor(this.charIdx));
      const lines = wrapText(shown, 146);
      lines.slice(0, 3).forEach((l, i) => drawText(ctx, l, 8, 106 + i * 11, C.INK));
      if (this.charIdx >= this.curMsg.length && this.msgs.length === 1 && Math.floor(this.time / 300) % 2 === 0) {
        drawText(ctx, '▼', 146, 132, C.INK);
      }
    }

    // anim timer decay
    if (this.animT > 0) this.animT = Math.max(0, this.animT);
  }
}
