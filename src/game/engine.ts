// ============================================================
// MONSTER SLAYER — game engine core
// Modes: boot,title,intro,world,dialog,board,menu,bag,quests,
//        bestiary,shop,battle,gameover,ending
// ============================================================
import { C, SCREEN_W, SCREEN_H, TILE, WALK_MS, RUN_MS, ENCOUNTER_RATE, BASE_STATS, SAVE_KEY, TOX_MAX } from './constants';
import { ensureSprites, TILES, TILE_KEY, PLAYER, NPCS } from './sprites';
import { ensureMonsterGfx, MONSTER_GFX } from './monstersGfx';
import { MAPS, tileAt, isBlocked, isEncounterTile } from './maps';
import type { MapDef } from './maps';
import { ITEMS, QUESTS, MONSTERS, xpForLevel, SCHOOLS, schoolById } from './data';
import { DIALOGUES } from './dialogue';
import type { DlgNode, DlgChoice } from './dialogue';
import { audio } from './audio';
import { Battle } from './battle';
import { drawWindow, drawDarkWindow, drawCursor, drawTitleText } from './render';
import { drawText, wrapText, paginateLines, textWidth } from './font';
import { updateOverlayMode, renderOverlayMode, pointerOverlay } from './engineMenus';

/** wrap width for dialog text: 23 chars from x=8, leaving room for the ▼ marker */
const DIALOG_WRAP_PX = 138;

export type Mode =
  | 'boot' | 'title' | 'creation' | 'intro' | 'world' | 'dialog' | 'board' | 'menu'
  | 'bag' | 'quests' | 'skills' | 'bestiary' | 'shop' | 'battle' | 'gameover' | 'ending';

export interface PlayerState {
  x: number; y: number; dir: 'up' | 'down' | 'left' | 'right';
  hp: number; maxHp: number; sta: number; maxSta: number;
  atk: number; def: number; lvl: number; xp: number;
  crowns: number; tox: number;
  swordLvl: number; armorLvl: number;
  school: string; skillPoints: number;
  oil: { specter: number; necro: number; beast: number; insectoid: number };
}

export interface QuestState { active: boolean; done: boolean; count: number }

interface NpcRuntime {
  id: string; x: number; y: number; hx: number; hy: number;
  sprite: string; wander?: number; dialogue: string;
  requires?: string; hideFlag?: string;
  moveT: number; waitT: number; bob: number;
}

interface PickupRuntime {
  id: string; x: number; y: number; item: string; requires?: string;
}

export class Game {
  mode: Mode = 'boot';
  time = 0;
  bootT = 0;

  // input
  held = new Set<string>();
  just = new Set<string>();

  // world
  map = 'village';
  player: PlayerState = {
    x: 10, y: 8, dir: 'down',
    hp: BASE_STATS.hp, maxHp: BASE_STATS.hp,
    sta: BASE_STATS.sta, maxSta: BASE_STATS.sta,
    atk: BASE_STATS.atk, def: BASE_STATS.def,
    lvl: 1, xp: 0, crowns: 25, tox: 0,
    swordLvl: 0, armorLvl: 0,
    school: 'serpent', skillPoints: 0,
    oil: { specter: 0, necro: 0, beast: 0, insectoid: 0 },
  };
  moving = false;
  moveT = 0;
  moveFrom = { x: 0, y: 0 };
  stepFrame = false;

  flags: Record<string, boolean> = {};
  quests: Record<string, QuestState> = {};
  inv: Record<string, number> = {};
  bestiary: Record<string, boolean> = {};
  kills: Record<string, number> = {};
  collected: Record<string, boolean> = {};
  npcs: NpcRuntime[] = [];
  pickups: PickupRuntime[] = [];

  // UI state
  menuIdx = 0; bagIdx = 0; questIdx = 0; bestIdx = 0; bestPage = 0;
  shopTab = 0; shopIdx = 0; boardIdx = 0; shopId = '';
  creationIdx = 0; skillsIdx = 0;
  introPage = 0; introChar = 0;
  titleIdx = 0; titleT = 0; titleStarted = false;
  endingPage = 0; endingT = 0;
  gameoverT = 0;
  mapBannerT = 0;
  medallionT = 0;
  fadeT = 0; fadeDir = 0; fadeCb: (() => void) | null = null;
  battle: Battle | null = null;
  postBattleNotice = '';
  afterDialogEnd: (() => void) | null = null;

  dialog: {
    tree: string;
    nodeId: string;
    node: DlgNode | null;
    charIdx: number;
    choiceIdx: number;
    choosing: boolean;
    notice: boolean;
    page: number;
  } | null = null;

  constructor() {
    ensureSprites();
    ensureMonsterGfx();
    for (const q of Object.keys(QUESTS)) this.quests[q] = { active: false, done: false, count: 0 };
    this.quests.q_intro.active = true;
    this.loadNpcs('village');
  }

  // ================= input =================
  press(btn: string) {
    this.held.add(btn);
    this.just.add(btn);
    audio.ensure();
  }
  release(btn: string) {
    this.held.delete(btn);
  }

  // ================= pointer / mouse input =================
  pointer = { x: -1, y: -1, inside: false };
  private walkPath: Array<'up' | 'down' | 'left' | 'right'> = [];
  private walkInteract = false;
  private autoDir: string | null = null;

  setPointer(x: number, y: number, inside: boolean) {
    this.pointer.x = x; this.pointer.y = y; this.pointer.inside = inside;
  }

  wheel(dy: number) {
    if (dy !== 0) this.just.add(dy < 0 ? 'up' : 'down');
  }

  cancelAutoWalk() {
    if (this.autoDir) { this.held.delete(this.autoDir); this.autoDir = null; }
    this.walkPath = [];
    this.walkInteract = false;
  }

  /** logical (160x144) camera origin — shared by render + pointer math */
  camera(): { camX: number; camY: number } {
    const def = this.mapDef;
    const mapW = def.rows[0].length * TILE;
    const mapH = def.rows.length * TILE;
    const pp = this.playerPixel();
    let camX = Math.round(pp.x - (SCREEN_W - TILE) / 2);
    let camY = Math.round(pp.y - (SCREEN_H - TILE) / 2);
    camX = Math.max(0, Math.min(mapW - SCREEN_W, camX));
    camY = Math.max(0, Math.min(mapH - SCREEN_H, camY));
    if (mapW < SCREEN_W) camX = -((SCREEN_W - mapW) / 2);
    if (mapH < SCREEN_H) camY = -((SCREEN_H - mapH) / 2);
    return { camX: Math.round(camX), camY: Math.round(camY) };
  }

  /** BFS path to a walkable goal tile (goal may hold an NPC); null if unreachable */
  private planPath(tx: number, ty: number): Array<'up' | 'down' | 'left' | 'right'> | null {
    const def = this.mapDef;
    const start = { x: this.player.x, y: this.player.y };
    if (start.x === tx && start.y === ty) return [];
    const W = def.rows[0].length;
    const H = def.rows.length;
    const key = (x: number, y: number) => `${x},${y}`;
    const prev = new Map<string, { x: number; y: number }>();
    const seen = new Set([key(start.x, start.y)]);
    const q: { x: number; y: number }[] = [start];
    while (q.length > 0) {
      const cur = q.shift()!;
      if (cur.x === tx && cur.y === ty) {
        const dirs: Array<'up' | 'down' | 'left' | 'right'> = [];
        let c = cur;
        while (!(c.x === start.x && c.y === start.y)) {
          const pt = prev.get(key(c.x, c.y))!;
          dirs.unshift(pt.x < c.x ? 'right' : pt.x > c.x ? 'left' : pt.y < c.y ? 'down' : 'up');
          c = pt;
        }
        return dirs;
      }
      const nbrs = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
      for (const [dx, dy] of nbrs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        if (isBlocked(def, nx, ny)) continue;
        if (this.npcAt(nx, ny) && !(nx === tx && ny === ty)) continue;
        seen.add(k);
        prev.set(k, cur);
        q.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  /** click in logical screen coords (160x144) */
  pointerClick(x: number, y: number, btn: 'a' | 'b') {
    switch (this.mode) {
      case 'title': this.titlePointer(x, y, btn); break;
      case 'creation': this.creationPointer(x, y, btn); break;
      case 'intro':
      case 'ending':
      case 'gameover':
        if (btn === 'a') this.just.add('a');
        break;
      case 'world': this.worldPointer(x, y, btn); break;
      case 'dialog': this.dialogPointer(x, y, btn); break;
      case 'battle': this.battle?.pointerClick(x, y, btn, this.input); break;
      default: pointerOverlay(this, x, y, btn); break;
    }
  }

  private titlePointer(x: number, y: number, btn: 'a' | 'b') {
    if (!this.titleStarted) {
      if (btn === 'a') this.just.add('a');
      return;
    }
    const hasSave = this.hasSave();
    const n = hasSave ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const ry = 120 + i * 11;
      if (x >= 46 && x <= 116 && y >= ry - 2 && y <= ry + 8) {
        this.titleIdx = i;
        if (btn === 'a') this.just.add('a');
        return;
      }
    }
  }

  private creationPointer(x: number, y: number, btn: 'a' | 'b') {
    if (btn === 'b') { this.just.add('b'); return; }
    for (let i = 0; i < SCHOOLS.length; i++) {
      const ry = 40 + i * 11;
      if (x >= 22 && x <= 96 && y >= ry - 2 && y <= ry + 8) {
        this.creationIdx = i;
        if (btn === 'a') this.just.add('a');
        return;
      }
    }
  }

  private worldPointer(x: number, y: number, btn: 'a' | 'b') {
    if (btn === 'b') {
      this.cancelAutoWalk();
      return; // B is a hold-to-run key; clicks don't map
    }
    const { camX, camY } = this.camera();
    const tx = Math.floor((x + camX) / TILE);
    const ty = Math.floor((y + camY) / TILE);
    const def = this.mapDef;
    const W = def.rows[0].length;
    const H = def.rows.length;
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    this.cancelAutoWalk();
    // NPC click: walk adjacent, then talk
    const npc = this.npcAt(tx, ty);
    if (npc) {
      const path = this.planPath(tx, ty);
      if (path) {
        this.walkPath = path.slice(0, -1);
        this.walkInteract = true;
        audio.sfx('blip');
      }
      return;
    }
    // blocked tile: just face it
    if (isBlocked(def, tx, ty) || (tx === this.player.x && ty === this.player.y)) {
      const dx = tx - this.player.x;
      const dy = ty - this.player.y;
      if (Math.abs(dx) >= Math.abs(dy)) this.player.dir = dx > 0 ? 'right' : 'left';
      else this.player.dir = dy > 0 ? 'down' : 'up';
      return;
    }
    const path = this.planPath(tx, ty);
    if (path && path.length > 0) {
      this.walkPath = path;
      this.walkInteract = false;
      audio.sfx('blip');
    }
  }

  private dialogPointer(x: number, y: number, btn: 'a' | 'b') {
    const d = this.dialog;
    if (!d) return;
    if (btn === 'b') { this.just.add('b'); return; }
    if (d.choosing && d.node?.choices) {
      const choices = d.node.choices.filter((c) => this.checkCond(c.cond));
      const n = choices.length;
      const ch = 12 * n + 12;
      const cy = 96 - ch - 2;
      for (let i = 0; i < n; i++) {
        const ry = cy + 6 + i * 12;
        if (x >= 14 && x <= 156 && y >= ry - 2 && y <= ry + 9) {
          d.choiceIdx = i;
          this.just.add('a');
          return;
        }
      }
      return;
    }
    this.just.add('a');
  }

  get input() {
    return { held: this.held, just: this.just };
  }

  // ================= map helpers =================
  get mapDef(): MapDef {
    return MAPS[this.map];
  }

  loadNpcs(map: string) {
    const def = MAPS[map];
    this.npcs = def.npcs.map((n) => ({
      ...n, hx: n.x, hy: n.y, moveT: 0, waitT: 500 + Math.random() * 1500, bob: Math.random() * 6,
    }));
    this.pickups = def.pickups.map((p) => ({ ...p }));
  }

  applyMapOverrides() {
    // thorns gate (north-west gap leads to Fangtooth Pass)
    const forest = MAPS.forest;
    if (this.flags.thornsCleared) {
      forest.rows[0] = 'vvppvvvvppvvvvvvvvvv';
    } else {
      forest.rows[0] = 'vvppvvvvzzvvvvvvvvvv';
    }
  }

  switchMap(to: string, tx: number, ty: number, dir?: string) {
    this.cancelAutoWalk();
    this.map = to;
    this.player.x = tx; this.player.y = ty;
    if (dir) this.player.dir = dir as PlayerState['dir'];
    this.moving = false;
    this.loadNpcs(to);
    this.applyMapOverrides();
    audio.playMusic(MAPS[to].music);
    this.mapBannerT = 2000;
    if (MAPS[to].encounters.length > 0) this.medallionT = 2600;
  }

  npcVisible(n: NpcRuntime): boolean {
    if (n.requires && !this.checkCond(n.requires)) return false;
    if (n.hideFlag && this.getFlag(n.hideFlag)) return false;
    return true;
  }

  npcAt(x: number, y: number): NpcRuntime | null {
    for (const n of this.npcs) {
      if (this.npcVisible(n) && n.x === x && n.y === y) return n;
    }
    return null;
  }

  blockedForPlayer(x: number, y: number): boolean {
    if (isBlocked(this.mapDef, x, y)) {
      // warp with unmet requirement?
      const w = this.mapDef.warps.find((w0) => w0.x === x && w0.y === y && w0.requires);
      if (w) return true;
      return true;
    }
    // edge warp tiles are walkable
    if (this.npcAt(x, y)) return true;
    return false;
  }

  // ================= flags & conditions =================
  getFlag(name: string): boolean {
    // derived quest flags
    const q = this.quests;
    switch (name) {
      case 'q_drownersActive': return !!q.q_drowners?.active;
      case 'q_drownersDone': return !!q.q_drowners?.done;
      case 'drownersReady': return (this.kills.drowner ?? 0) >= 3;
      case 'q_wolvesActive': return !!q.q_wolves?.active;
      case 'q_wolvesDone': return !!q.q_wolves?.done;
      case 'wolvesReady': return (this.kills.wolf ?? 0) >= 4;
      case 'q_wraithActive': return !!q.q_wraith?.active;
      case 'q_wraithDone': return !!q.q_wraith?.done;
      case 'q_herbsActive': return !!q.q_herbs?.active;
      case 'q_herbsDone': return !!q.q_herbs?.done;
      case 'herbsReady': return (this.inv.foolleaf ?? 0) >= 3;
      // Northern Reaches
      case 'q_passActive': return !!q.q_pass?.active;
      case 'q_passDone': return !!q.q_pass?.done;
      case 'barghestsReady': return (this.kills.barghest ?? 0) >= 3;
      case 'q_nekkersActive': return !!q.q_nekkers?.active;
      case 'q_nekkersDone': return !!q.q_nekkers?.done;
      case 'nekkersReady': return (this.kills.nekker ?? 0) >= 4;
      case 'q_fogActive': return !!q.q_fog?.active;
      case 'q_fogDone': return !!q.q_fog?.done;
      case 'fogReady': return (this.kills.foglet ?? 0) >= 2;
      case 'q_griffinActive': return !!q.q_griffin?.active;
      case 'q_griffinDone': return !!q.q_griffin?.done;
      case 'q_arachasActive': return !!q.q_arachas?.active;
      case 'q_arachasDone': return !!q.q_arachas?.done;
      case 'q_katakanActive': return !!q.q_katakan?.active;
      case 'q_katakanDone': return !!q.q_katakan?.done;
      case 'leshanDone': return !!this.flags.leshanDone;
      case 'contractsDone': return !!(q.q_drowners?.done && q.q_wolves?.done && q.q_wraith?.done);
      case 'mainStarted': return !!this.flags.mainStarted;
      case 'hasLocket': return (this.inv.locket ?? 0) > 0;
      case 'wraithChoiceMade': return !!(this.flags.wraithPeace || this.flags.wraithDestroy);
      default: return !!this.flags[name];
    }
  }

  checkCond(expr?: string): boolean {
    if (!expr || expr.trim() === '') return true;
    return expr.split('&').every((tok) => {
      tok = tok.trim();
      if (tok.startsWith('!')) return !this.getFlag(tok.slice(1));
      return this.getFlag(tok);
    });
  }

  // ================= actions =================
  runAction(codes?: string) {
    if (!codes) return;
    for (const code of codes.split(',')) {
      const c = code.trim();
      if (!c) continue;
      const [cmd, a, b] = c.split(':');
      switch (cmd) {
        case 'flag': this.flags[a] = true; break;
        case 'give': this.inv[a] = (this.inv[a] ?? 0) + parseInt(b || '1', 10); break;
        case 'take': {
          const n = parseInt(b || '1', 10);
          this.inv[a] = Math.max(0, (this.inv[a] ?? 0) - n);
          if (this.inv[a] === 0) delete this.inv[a];
          break;
        }
        case 'crowns': this.player.crowns += parseInt(a, 10); audio.sfx('coin'); break;
        case 'quest': {
          const q = this.quests[a];
          if (q && !q.done) { q.active = true; }
          break;
        }
        case 'questdone': {
          const q = this.quests[a];
          if (q) { q.active = false; q.done = true; }
          break;
        }
        case 'shop': this.shopId = a; this.shopTab = 0; this.shopIdx = 0; this.mode = 'shop'; audio.playMusic('shop'); break;
        case 'rest': {
          this.player.hp = this.player.maxHp;
          this.player.sta = this.player.maxSta;
          this.player.tox = 0;
          this.save();
          this.startNotice('You sleep like the dead. HP restored, veins purged. (Game saved)');
          break;
        }
        case 'heal': this.player.hp = this.player.maxHp; this.player.sta = this.player.maxSta; break;
        case 'battle': {
          const lvl = a === 'werewolf' ? 8 : a === 'leshen' ? 10 : a === 'griffin' ? 9 : a === 'arachas' ? 9 : a === 'katakan' ? 10 : 7;
          this.startBattle(a, lvl, true);
          break;
        }
        case 'board': this.mode = 'board'; this.boardIdx = 0; break;
        case 'end': this.afterDialogEnd = () => { this.mode = 'ending'; this.endingPage = 0; this.endingT = 0; audio.playMusic('ending'); }; break;
        case 'save': this.save(); break;
        case 'maxhp': {
          const n = parseInt(a, 10);
          this.player.maxHp += n; this.player.hp += n;
          break;
        }
        case 'xp': this.gainXp(parseInt(a, 10)); break;
      }
    }
  }

  gainXp(n: number) {
    this.player.xp += n;
    let leveled = false;
    while (this.player.lvl < 10 && this.player.xp >= xpForLevel(this.player.lvl + 1)) {
      this.player.lvl++;
      this.player.maxHp += 5; this.player.maxSta += 2;
      this.player.atk += 1; this.player.def += 1;
      this.player.hp = this.player.maxHp;
      this.player.sta = this.player.maxSta;
      leveled = true;
    }
    if (leveled) audio.sfx('levelup');
    return leveled;
  }

  // ================= dialog =================
  startDialog(treeId: string) {
    this.cancelAutoWalk();
    const tree = DIALOGUES[treeId];
    if (!tree) return;
    let entry = '';
    for (const [nodeId, node] of Object.entries(tree)) {
      if (node.entry && this.checkCond(node.cond)) { entry = nodeId; break; }
    }
    if (!entry || !tree[entry]) entry = tree.start ? 'start' : Object.keys(tree)[0];
    this.enterNode(treeId, entry);
  }

  enterNode(treeId: string, nodeId: string) {
    const tree = DIALOGUES[treeId];
    const node = tree?.[nodeId];
    if (!node) { this.dialog = null; this.finishDialog(); return; }
    this.dialog = { tree: treeId, nodeId, node, charIdx: 0, choiceIdx: 0, choosing: false, notice: false, page: 0 };
    this.runAction(node.action);
    const m: string = this.mode;
    if (m !== 'dialog' && m !== 'battle' && m !== 'shop' && m !== 'board' && m !== 'ending') {
      this.mode = 'dialog';
    }
  }

  startNotice(text: string, choices?: DlgChoice[], onEnd?: () => void) {
    const node: DlgNode = { text, choices, next: null };
    DIALOGUES.__notice = { start: node };
    this.afterDialogEnd = onEnd ?? null;
    this.dialog = { tree: '__notice', nodeId: 'start', node, charIdx: 0, choiceIdx: 0, choosing: false, notice: true, page: 0 };
    this.mode = 'dialog';
  }

  finishDialog() {
    const cb = this.afterDialogEnd;
    this.afterDialogEnd = null;
    this.dialog = null;
    if (this.mode === 'dialog') this.mode = 'world';
    if (cb) cb();
  }

  /** Wrap a dialog node's text into pages that fit the dialog box.
   *  Layout: box (2,96,156,48); speaker line + 3 text lines, or 4 text lines. */
  private dialogPages(node: DlgNode): { pages: string[][]; perPage: number } {
    const perPage = node.speaker ? 3 : 4;
    const lines = wrapText(node.text ?? '', DIALOG_WRAP_PX);
    return { pages: paginateLines(lines, perPage), perPage };
  }

  updateDialog(dt: number) {
    const d = this.dialog;
    if (!d || !d.node) { this.finishDialog(); return; }
    const node = d.node;
    const { pages } = this.dialogPages(node);
    const pageText = (pages[d.page] ?? []).join(' ');
    const J = this.just;

    if (!d.choosing) {
      if (d.charIdx < pageText.length) {
        const before = Math.floor(d.charIdx);
        d.charIdx = Math.min(pageText.length, d.charIdx + Math.max(1, Math.round(dt / 1000 * 30)));
        if (Math.floor(d.charIdx) > before && Math.floor(d.charIdx) % 2 === 0) audio.sfx('text');
        if (J.has('a') || J.has('b')) d.charIdx = pageText.length;
      } else if (d.page < pages.length - 1) {
        // more pages follow: A or B flips to the next page
        if (J.has('a') || J.has('b')) {
          audio.sfx('blip');
          d.page++;
          d.charIdx = 0;
        }
      } else if (node.choices && node.choices.length > 0) {
        d.choosing = true;
        d.choiceIdx = 0;
      } else {
        if (J.has('a')) {
          audio.sfx('confirm');
          if (node.next === null || node.next === undefined) {
            this.dialog = null;
            this.finishDialog();
          } else {
            this.enterNode(d.tree, node.next);
          }
        }
      }
      return;
    }

    // choosing
    const allChoices = node.choices!;
    const choices = allChoices.filter((c) => this.checkCond(c.cond));
    if (choices.length === 0) { this.dialog = null; this.finishDialog(); return; }
    if (J.has('up')) { d.choiceIdx = (d.choiceIdx + choices.length - 1) % choices.length; audio.sfx('blip'); }
    if (J.has('down')) { d.choiceIdx = (d.choiceIdx + 1) % choices.length; audio.sfx('blip'); }
    if (J.has('b')) {
      const hasCancel = choices.findIndex((c) => /back|leave|nothing|later|not yet|wait/i.test(c.label));
      audio.sfx('cancel');
      if (hasCancel >= 0) d.choiceIdx = hasCancel; else { d.choosing = false; return; }
    }
    if (J.has('a')) {
      const ch = choices[d.choiceIdx];
      audio.sfx('confirm');
      this.runAction(ch.action);
      if (ch.next) {
        this.enterNode(d.tree, ch.next);
      } else {
        this.dialog = null;
        this.finishDialog();
      }
    }
  }

  renderDialog(ctx: CanvasRenderingContext2D) {
    const d = this.dialog;
    if (!d || !d.node) return;
    const node = d.node;
    // world behind
    this.renderWorld(ctx);

    // dialog box (bottom of screen, 4 text lines or speaker + 3)
    const boxY = 96;
    drawWindow(ctx, 2, boxY, 156, 48);
    const { pages } = this.dialogPages(node);
    const pageLines = pages[Math.min(d.page, pages.length - 1)] ?? [];
    const shown = pageLines.join(' ').slice(0, Math.floor(d.charIdx));
    const shownLines = wrapText(shown, DIALOG_WRAP_PX);
    let ty = boxY + 5;
    if (node.speaker) {
      drawText(ctx, node.speaker, 8, ty, C.INK);
      ty += 11;
    }
    shownLines.forEach((l, i) => drawText(ctx, l, 8, ty + i * 11, C.INK));
    const pageDone = d.charIdx >= pageLines.join(' ').length;
    if (pageDone && !d.choosing && Math.floor(this.time / 300) % 2 === 0) {
      drawText(ctx, '▼', 149, boxY + 39, C.INK);
    }

    // choices
    if (d.choosing && node.choices) {
      const choices = node.choices.filter((c) => this.checkCond(c.cond));
      const n = choices.length;
      const ch = 12 * n + 12;
      const cy = 96 - ch - 2;
      drawWindow(ctx, 14, cy, 142, ch);
      choices.forEach((c, i) => {
        const y = cy + 6 + i * 12;
        drawText(ctx, c.label.slice(0, 21), 28, y, C.INK);
        if (i === d.choiceIdx) drawCursor(ctx, 20, y, C.INK);
      });
    }
  }

  // ================= battle glue =================
  startBattle(monId: string, lvl: number, boss = false) {
    this.cancelAutoWalk();
    this.bestiary[monId] = true;
    this.dialog = null;
    this.mode = 'battle';
    const isBoss = boss || !!MONSTERS[monId].boss;
    this.battle = new Battle(this, monId, lvl);
    if (isBoss) this.battle.boss = true;
    audio.playMusic(monId === 'leshen' ? 'finalboss' : isBoss ? 'boss' : 'battle');
  }

  countKill(id: string) {
    this.kills[id] = (this.kills[id] ?? 0) + 1;
  }

  /** dev/test helper: resolve current battle via a real killing blow */
  debugWinBattle() {
    const b = this.battle;
    if (!b) return false;
    b.monHp = 1;
    b.msgs = [];
    b.playerAttack('silver');
    return true;
  }

  giveItem(id: string, n: number) {
    this.inv[id] = (this.inv[id] ?? 0) + n;
  }

  onBattleEnd(result: 'victory' | 'defeat' | 'fled', monId: string) {
    const b = this.battle;
    this.battle = null;
    if (result === 'defeat') {
      this.mode = 'gameover';
      this.gameoverT = 0;
      audio.playMusic('gameover');
      return;
    }
    // quest progress notices
    let note = '';
    if (monId === 'drowner' && this.quests.q_drowners.active) {
      note = `Contract: ${(this.kills.drowner ?? 0) >= 3 ? '3' : this.kills.drowner}/3 drowners.`;
    }
    if (monId === 'wolf' && this.quests.q_wolves.active) {
      note = `Contract: ${(this.kills.wolf ?? 0) >= 4 ? '4' : this.kills.wolf}/4 wolves.`;
    }
    if (monId === 'barghest' && this.quests.q_pass.active) {
      note = `Contract: ${(this.kills.barghest ?? 0) >= 3 ? '3' : this.kills.barghest}/3 barghests.`;
    }
    if (monId === 'nekker' && this.quests.q_nekkers.active) {
      note = `Contract: ${(this.kills.nekker ?? 0) >= 4 ? '4' : this.kills.nekker}/4 nekkers.`;
    }
    if (monId === 'foglet' && this.quests.q_fog.active) {
      note = `Contract: ${(this.kills.foglet ?? 0) >= 2 ? '2' : this.kills.foglet}/2 foglets.`;
    }
    if (monId === 'griffin') {
      this.flags.griffinDone = true;
      note = 'The royal griffin falls from the ridge. The pass belongs to the carts again. Woy will want to hear this.';
    }
    if (monId === 'arachas') {
      this.flags.arachasDone = true;
      note = 'The Mother of the Bog is still at last. The reeds stand straighter. Old Kettle owes you coin.';
    }
    if (monId === 'katakan') {
      this.flags.katakanDone = true;
      note = 'The katakan crumbles to ash and old coins. Kaer Serpen breathes again. The pale witcher is waiting.';
    }
    if (monId === 'werewolf') {
      this.flags.werewolfDone = true;
      note = 'The cursed hunter is free of the moon. The path to the shrine is open.';
    }
    if (monId === 'wraith' && this.flags.wraithDestroy && !this.flags.wraithPaid) {
      this.flags.wraithPaid = true;
      this.player.crowns += 90;
      note = 'The weeping stops. A purse of 90 crowns waits at the inn. (The families thank you.)';
      audio.sfx('coin');
    }
    if (monId === 'leshen') {
      this.flags.leshenDone = true;
      this.mode = 'world';
      audio.playMusic(this.mapDef.music);
      this.startNotice(
        'The forest exhales. Crows scatter into a bright sky. The rot recedes from Hollow Creek.',
        undefined,
        () => { this.mode = 'ending'; this.endingPage = 0; this.endingT = 0; audio.playMusic('ending'); },
      );
      return;
    }
    this.mode = 'world';
    audio.playMusic(this.mapDef.music);
    if (note) this.startNotice(note);
  }

  // ================= save / load =================
  save() {
    try {
      const data = {
        v: 1, map: this.map,
        player: this.player,
        flags: this.flags,
        quests: this.quests,
        inv: this.inv,
        bestiary: this.bestiary,
        kills: this.kills,
        collected: this.collected,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      audio.sfx('save');
    } catch { /* storage unavailable */ }
  }

  hasSave(): boolean {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.map = d.map;
      Object.assign(this.player, d.player);
      this.flags = d.flags ?? {};
      this.quests = d.quests ?? this.quests;
      for (const q of Object.keys(QUESTS)) if (!this.quests[q]) this.quests[q] = { active: false, done: false, count: 0 };
      this.inv = d.inv ?? {};
      this.bestiary = d.bestiary ?? {};
      this.kills = d.kills ?? {};
      this.collected = d.collected ?? {};
      this.moving = false;
      if (this.player.oil && this.player.oil.insectoid === undefined) this.player.oil.insectoid = 0;
      if (!this.player.school) { this.player.school = 'serpent'; this.player.skillPoints = this.player.skillPoints ?? 0; }
      this.loadNpcs(this.map);
      this.applyMapOverrides();
      this.mode = 'world';
      this.mapBannerT = 2000;
      audio.playMusic(this.mapDef.music);
      return true;
    } catch {
      return false;
    }
  }

  newGame(schoolId = 'serpent') {
    const sc = schoolById(schoolId);
    this.map = 'village';
    this.player = {
      x: 10, y: 8, dir: 'down',
      hp: BASE_STATS.hp + sc.hp, maxHp: BASE_STATS.hp + sc.hp,
      sta: BASE_STATS.sta + sc.sta, maxSta: BASE_STATS.sta + sc.sta,
      atk: BASE_STATS.atk + sc.atk, def: BASE_STATS.def + sc.def,
      lvl: 1, xp: 0, crowns: 25, tox: 0,
      swordLvl: 0, armorLvl: 0,
      school: sc.id, skillPoints: 0,
      oil: { specter: 0, necro: 0, beast: 0, insectoid: 0 },
    };
    this.flags = {};
    this.inv = { swallow: 1 };
    if (sc.startItem) this.inv[sc.startItem] = (this.inv[sc.startItem] ?? 0) + 1;
    this.bestiary = {};
    this.kills = {};
    this.collected = {};
    for (const q of Object.keys(QUESTS)) this.quests[q] = { active: false, done: false, count: 0 };
    this.quests.q_intro.active = true;
    this.moving = false;
    this.loadNpcs('village');
    this.applyMapOverrides();
    this.mode = 'intro';
    this.introPage = 0;
    this.introChar = 0;
  }

  // ================= world update =================
  updateWorld(dt: number) {
    const p = this.player;
    const J = this.just;

    // auto-walk (mouse click-to-move)
    if (this.autoDir && this.moving) { this.held.delete(this.autoDir); this.autoDir = null; }
    if (!this.moving && this.walkPath.length > 0) {
      const dir = this.walkPath.shift()!;
      this.autoDir = dir;
      this.held.add(dir);
    } else if (!this.moving && this.walkPath.length === 0 && this.walkInteract) {
      this.walkInteract = false;
      this.just.add('a');
    }

    // select toggle
    if (J.has('select')) {
      audio.setEnabled(!audio.enabled);
      this.startNotice(audio.enabled ? 'SOUND ON.' : 'SOUND OFF.');
      return;
    }

    // menu
    if (J.has('start')) {
      this.mode = 'menu'; this.menuIdx = 0;
      audio.sfx('confirm');
      return;
    }

    // interaction
    if (J.has('a') && !this.moving) {
      const ahead = this.aheadTile();
      const npc = this.npcAt(ahead.x, ahead.y);
      if (npc) {
        audio.sfx('confirm');
        this.startDialog(npc.dialogue);
        return;
      }
      const t = tileAt(this.mapDef, ahead.x, ahead.y);
      // counters: look one further
      if (t === 'c') {
        const ahead2 = this.aheadTile(2);
        const npc2 = this.npcAt(ahead2.x, ahead2.y);
        if (npc2) {
          audio.sfx('confirm');
          this.startDialog(npc2.dialogue);
          return;
        }
      }
      this.interactTile(t, ahead.x, ahead.y);
      return;
    }

    // movement
    if (!this.moving) {
      let dir: 'up' | 'down' | 'left' | 'right' | null = null;
      if (this.held.has('up')) dir = 'up';
      else if (this.held.has('down')) dir = 'down';
      else if (this.held.has('left')) dir = 'left';
      else if (this.held.has('right')) dir = 'right';

      if (dir) {
        if (p.dir !== dir) {
          p.dir = dir;
        }
        const nx = p.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0);
        const ny = p.y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0);
        // requirement-gated warp (thorns)
        const warp = this.mapDef.warps.find((w) => w.x === nx && w.y === ny && w.requires);
        if (warp && !this.getFlag(warp.requires!)) {
          if (J.has('__stepnoise')) audio.sfx('cancel');
          if (!this.flags.__thornsHint) {
            this.flags.__thornsHint = true;
            this.startNotice('Impenetrable thorns block the north path. Something older than the village guards this way.');
          }
          return;
        }
        if (!this.blockedForPlayer(nx, ny)) {
          this.moving = true;
          this.moveT = 0;
          this.moveFrom = { x: p.x, y: p.y };
          p.x = nx; p.y = ny;
          this.stepFrame = !this.stepFrame;
          audio.sfx('step');
        }
      }
    } else {
      const run = this.held.has('b');
      const dur = run ? RUN_MS : WALK_MS;
      this.moveT += dt;
      if (this.moveT >= dur) {
        this.moving = false;
        this.onStepEnd();
      }
    }
  }

  aheadTile(dist = 1): { x: number; y: number } {
    const p = this.player;
    const dx = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0;
    const dy = p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0;
    return { x: p.x + dx * dist, y: p.y + dy * dist };
  }

  interactTile(t: string, x: number, y: number) {
    switch (t) {
      case 'B':
        audio.sfx('confirm');
        this.mode = 'board';
        this.boardIdx = 0;
        return;
      case 'u': this.startNotice('The well is deep and cold. A coin glints at the bottom. You leave it.'); return;
      case 'b': this.startNotice('Not your bed. Though the straw does look comfortable.'); return;
      case 'l': this.startNotice('Something bitter bubbles in the cauldron. It smells like regret and garlic.'); return;
      case 'a': this.startNotice("The anvil rings with Torv's fury. SPARKS fly like tiny orange crows."); return;
      case 'K': this.startNotice('Histories of the Northern wars. Every third page is a eulogy.'); return;
      case 's': this.startNotice('Dried herbs, unlabeled jars, one jar labeled DO NOT.'); return;
      case 'k': this.startNotice('Griffin-brand ale. There is probably no griffin in it. Probably.'); return;
      case 't': this.startNotice('Knife marks, candle wax, and old stains that are definitely wine.'); return;
      case 'g': case 'G':
        if (this.map === 'graveyard') this.startNotice('The soil here is fresh. Something shifted it from below.');
        else this.startNotice('Rest well, whoever you were.');
        return;
      case 'S': this.startNotice('Old stone. Older blood. The crows will not land on it.'); return;
      case 'T': this.startNotice('The trees lean in, listening. Your medallion itches.'); return;
      case 'P': this.startNotice('The pine groans without wind.'); return;
      case 'z': this.startNotice('Impenetrable thorns. They pulse like something alive.'); return;
      case 'o': case '~': this.startNotice('Dark water. Darker things under it, probably.'); return;
      case 'D': this.startNotice('The door is locked. Not everything in Hollow Creek is your business.'); return;
      default:
        if (x < 0 || y < 0) this.startNotice('Beyond lies the wilderness, and wilderness has teeth.');
        return;
    }
  }

  onStepEnd() {
    const p = this.player;
    // warps
    const w = this.mapDef.warps.find((w0) => w0.x === p.x && w0.y === p.y);
    if (w) {
      if (w.requires && !this.getFlag(w.requires)) return;
      audio.sfx('door');
      this.switchMap(w.to, w.tx, w.ty, w.dir);
      return;
    }
    // pickups
    for (const pk of this.pickups) {
      if (pk.x === p.x && pk.y === p.y && !this.collected[pk.id] && this.checkCond(pk.requires)) {
        this.collected[pk.id] = true;
        this.giveItem(pk.item, 1);
        audio.sfx('pickup');
        const it = ITEMS[pk.item];
        if (pk.item === 'foolleaf') {
          const n = this.inv.foolleaf ?? 0;
          this.startNotice(`Picked FOOL'S LEAF! (${Math.min(3, n)}/3 for Mira)`);
        } else {
          this.startNotice(`You found the ${it.name}. It is cold as the grave.`);
        }
        return;
      }
    }
    // fixed triggers
    if (this.map === 'deepforest') {
      if (!this.flags.werewolfDone && ((p.x === 8 && p.y === 6) || (p.x === 9 && p.y === 6))) {
        this.startDialog('wwintro');
        return;
      }
      if (this.flags.werewolfDone && !this.flags.leshenDone && ((p.x === 7 && p.y === 10) || (p.x === 8 && p.y === 10))) {
        this.startDialog('leshintro');
        return;
      }
    }
    if (this.map === 'fangs') {
      if (this.quests.q_griffin?.active && !this.flags.griffinDone && p.y <= 2 && p.x >= 9 && p.x <= 10) {
        this.startDialog('griffinintro');
        return;
      }
    }
    if (this.map === 'bog') {
      if (this.quests.q_arachas?.active && !this.flags.arachasDone && p.y <= 3 && p.x >= 16) {
        this.startDialog('arachasintro');
        return;
      }
    }
    if (this.map === 'ruins') {
      if (this.quests.q_katakan?.active && !this.flags.katakanDone && p.y <= 5 && p.x >= 8 && p.x <= 9) {
        this.startDialog('katakanintro');
        return;
      }
    }
    // encounters
    const t = tileAt(this.mapDef, p.x, p.y);
    if (isEncounterTile(t) && this.mapDef.encounters.length > 0) {
      if (Math.random() < ENCOUNTER_RATE) {
        const table = this.mapDef.encounters;
        const total = table.reduce((a, e) => a + e.weight, 0);
        let roll = Math.random() * total;
        let pick = table[0];
        for (const e of table) { roll -= e.weight; if (roll <= 0) { pick = e; break; } }
        const lvl = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
        audio.sfx('encounter');
        this.startBattle(pick.monster, lvl);
      }
    }
  }

  // npc wandering
  updateNpcs(dt: number) {
    for (const n of this.npcs) {
      if (!this.npcVisible(n)) continue;
      if (n.wander) {
        n.waitT -= dt;
        if (n.waitT <= 0 && !this.moving) {
          n.waitT = 1200 + Math.random() * 2200;
          const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]] as const;
          const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
          const nx = n.x + dx, ny = n.y + dy;
          const withinHome = Math.abs(nx - n.hx) <= n.wander && Math.abs(ny - n.hy) <= n.wander;
          const p = this.player;
          const notPlayer = !(nx === p.x && ny === p.y);
          if (withinHome && notPlayer && !this.blockedForPlayer(nx, ny) && !isEncounterTile(tileAt(this.mapDef, nx, ny))) {
            n.x = nx; n.y = ny;
          }
        }
      }
      n.bob += dt / 120;
    }
  }

  // ================= render: world =================
  playerPixel(): { x: number; y: number } {
    const p = this.player;
    if (this.moving) {
      const run = this.held.has('b');
      const dur = run ? RUN_MS : WALK_MS;
      const t = Math.min(1, this.moveT / dur);
      const fx = this.moveFrom.x * TILE, fy = this.moveFrom.y * TILE;
      const tx = p.x * TILE, ty = p.y * TILE;
      return { x: fx + (tx - fx) * t, y: fy + (ty - fy) * t };
    }
    return { x: p.x * TILE, y: p.y * TILE };
  }

  renderWorld(ctx: CanvasRenderingContext2D) {
    const def = this.mapDef;
    const pp = this.playerPixel();
    const { camX, camY } = this.camera();

    ctx.fillStyle = C.INK;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // tiles
    const animFrame = Math.floor(this.time / 450) % 2;
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(def.rows[0].length - 1, x0 + Math.ceil(SCREEN_W / TILE) + 1);
    const y1 = Math.min(def.rows.length - 1, y0 + Math.ceil(SCREEN_H / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = tileAt(def, tx, ty);
        let cv: HTMLCanvasElement | undefined;
        const key = TILE_KEY[ch] ?? (TILES[ch] ? ch : 'grass');
        const asset = TILES[key] as HTMLCanvasElement | HTMLCanvasElement[] | undefined;
        if (Array.isArray(asset)) cv = asset[animFrame];
        else cv = asset;
        if (!cv) cv = TILES.grass as HTMLCanvasElement;
        ctx.drawImage(cv, tx * TILE - camX, ty * TILE - camY);
      }
    }

    // pickups (sparkle)
    const blink = Math.floor(this.time / 240) % 2 === 0;
    for (const pk of this.pickups) {
      if (this.collected[pk.id] || !this.checkCond(pk.requires)) continue;
      const herb = TILES.herb as HTMLCanvasElement;
      ctx.drawImage(herb, pk.x * TILE - camX, pk.y * TILE - camY);
      if (blink) {
        ctx.fillStyle = C.PAPER;
        ctx.fillRect(pk.x * TILE - camX + 3, pk.y * TILE - camY + 3, 1, 1);
        ctx.fillRect(pk.x * TILE - camX + 12, pk.y * TILE - camY + 6, 1, 1);
        ctx.fillRect(pk.x * TILE - camX + 6, pk.y * TILE - camY + 12, 1, 1);
      }
    }

    // npcs
    for (const n of this.npcs) {
      if (!this.npcVisible(n)) continue;
      const spr = NPCS[n.sprite];
      if (!spr) continue;
      let oy = 0;
      if (n.sprite === 'ghost') oy = Math.round(Math.sin(n.bob) * 2);
      ctx.drawImage(spr, n.x * TILE - camX, n.y * TILE - camY + oy);
    }

    // player
    const frame = this.moving ? (this.stepFrame ? '1' : '0') : '0';
    const spr = PLAYER[`${this.player.dir}${frame}`] ?? PLAYER.down0;
    ctx.drawImage(spr, pp.x - camX, pp.y - camY);

    // dark tint for cursed places
    if (def.dark) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = C.INK;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.globalAlpha = 1;
    }

    // map banner
    if (this.mapBannerT > 0) {
      const a = Math.min(1, this.mapBannerT / 400);
      ctx.globalAlpha = a;
      drawDarkWindow(ctx, 2, 2, Math.min(156, textWidth(def.name) + 14), 16);
      drawText(ctx, def.name, 8, 6, C.PAPER);
      ctx.globalAlpha = 1;
    }

    // medallion hint
    if (this.medallionT > 0) {
      const a = Math.min(1, this.medallionT / 400);
      ctx.globalAlpha = a;
      drawText(ctx, 'Your medallion hums...', 4, SCREEN_H - 12, C.INK);
      ctx.globalAlpha = 1;
    }

    // mouse hover: blinking tile cursor (world mode only)
    if (this.pointer.inside && this.mode === 'world') {
      const htx = Math.floor((this.pointer.x + camX) / TILE);
      const hty = Math.floor((this.pointer.y + camY) / TILE);
      const hx = htx * TILE - camX;
      const hy = hty * TILE - camY;
      if (hx >= 0 && hy >= 0 && hx < SCREEN_W - TILE && hy < SCREEN_H - TILE) {
        ctx.globalAlpha = Math.floor(this.time / 250) % 2 === 0 ? 0.9 : 0.45;
        ctx.fillStyle = C.PAPER;
        ctx.fillRect(hx, hy, TILE, 1);
        ctx.fillRect(hx, hy + TILE - 1, TILE, 1);
        ctx.fillRect(hx, hy, 1, TILE);
        ctx.fillRect(hx + TILE - 1, hy, 1, TILE);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ================= fade =================
  startFade(cb: () => void) {
    this.fadeDir = 1;
    this.fadeT = 0;
    this.fadeCb = cb;
  }

  // ================= main frame =================
  frame(dt: number, ctx: CanvasRenderingContext2D) {
    this.time += dt;
    if (this.mapBannerT > 0) this.mapBannerT -= dt;
    if (this.medallionT > 0) this.medallionT -= dt;

    switch (this.mode) {
      case 'boot':
        this.bootT += dt;
        if (this.bootT > 1600) { this.mode = 'title'; this.titleT = 0; audio.playMusic('title'); }
        break;
      case 'title':
        this.titleT += dt;
        this.updateTitle();
        break;
      case 'creation':
        this.updateCreation();
        break;
      case 'intro':
        this.updateIntro(dt);
        break;
      case 'world':
        this.updateWorld(dt);
        this.updateNpcs(dt);
        break;
      case 'dialog':
        this.updateDialog(dt);
        this.updateNpcs(dt);
        break;
      case 'battle':
        if (this.battle) this.battle.update(dt, this.input);
        break;
      case 'gameover':
        this.gameoverT += dt;
        this.updateGameover();
        break;
      default:
        updateOverlayMode(this, dt);
        break;
    }

    this.render(ctx);

    // fade overlay
    if (this.fadeDir !== 0) {
      this.fadeT += dt * this.fadeDir;
      if (this.fadeT >= 300) {
        this.fadeT = 300;
        if (this.fadeDir === 1) {
          this.fadeDir = -1;
          if (this.fadeCb) { this.fadeCb(); this.fadeCb = null; }
        }
      }
      if (this.fadeT <= 0 && this.fadeDir === -1) { this.fadeDir = 0; this.fadeT = 0; }
      const alpha = Math.max(0, Math.min(1, this.fadeT / 300));
      if (alpha > 0) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = C.INK;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
        ctx.globalAlpha = 1;
      }
    }

    this.just.clear();
  }

  updateTitle() {
    const J = this.just;
    if (!this.titleStarted) {
      if (J.has('start') || J.has('a')) {
        audio.ensure();
        audio.playMusic('title');
        this.titleStarted = true;
        this.titleIdx = 0;
        audio.sfx('confirm');
      }
      return;
    }
    // menu: NEW GAME / CONTINUE
    const hasSave = this.hasSave();
    const n = hasSave ? 2 : 1;
    if (J.has('up')) { this.titleIdx = (this.titleIdx + n - 1) % n; audio.sfx('blip'); }
    if (J.has('down')) { this.titleIdx = (this.titleIdx + 1) % n; audio.sfx('blip'); }
    if (J.has('a') || J.has('start')) {
      audio.sfx('confirm');
      if (hasSave && this.titleIdx === 1) {
        if (this.load()) return;
      }
      this.mode = 'creation';
      this.creationIdx = 0;
    }
  }

  updateCreation() {
    const J = this.just;
    const n = SCHOOLS.length;
    if (J.has('up')) { this.creationIdx = (this.creationIdx + n - 1) % n; audio.sfx('blip'); }
    if (J.has('down')) { this.creationIdx = (this.creationIdx + 1) % n; audio.sfx('blip'); }
    if (J.has('b')) {
      audio.sfx('cancel');
      this.mode = 'title';
      this.titleIdx = 0;
      return;
    }
    if (J.has('a') || J.has('start')) {
      audio.sfx('confirm');
      this.newGame(SCHOOLS[this.creationIdx].id);
    }
  }

  renderCreation(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = C.INK;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawTitleText(ctx, 'CHOOSE YOUR', SCREEN_W / 2, 12, 1, C.PAPER);
    drawTitleText(ctx, 'SCHOOL', SCREEN_W / 2, 24, 1, C.PAPER);
    const listY = 40;
    SCHOOLS.forEach((s, i) => {
      const y = listY + i * 11;
      const sel = i === this.creationIdx;
      drawText(ctx, s.name, 36, y, sel ? C.PAPER : C.DARK);
      if (sel) drawCursor(ctx, 26, y, C.PAPER);
    });
    const sel = SCHOOLS[this.creationIdx];
    drawDarkWindow(ctx, 2, 100, 156, 42);
    wrapText(sel.blurb, 144).slice(0, 4).forEach((line, i) => {
      drawText(ctx, line, 6, 104 + i * 9, C.PAPER);
    });
    if (Math.floor(this.time / 400) % 2 === 0) {
      drawText(ctx, 'A: CHOOSE  B: BACK', 26, 92, C.LIGHT);
    }
  }

  updateIntro(dt: number) {
    const J = this.just;
    const scName = schoolById(this.player.school).name;
    const pages = [
      'The year is 1273. The war has burned the Northern kingdoms, and the roads crawl with everything war leaves behind.',
      'Only witchers walk toward the monsters. Mutants of dead Schools, two swords on their backs and none dug for them yet.',
      `You are VESK of the School of the ${scName}. Your medallion hums. Hollow Creek has posted work.`,
    ];
    const text = pages[this.introPage];
    if (this.introChar < text.length) {
      this.introChar = Math.min(text.length, this.introChar + Math.max(1, Math.round(dt / 1000 * 32)));
      if (J.has('a')) this.introChar = text.length;
    } else if (J.has('a')) {
      audio.sfx('confirm');
      this.introPage++;
      this.introChar = 0;
      if (this.introPage >= pages.length) {
        this.mode = 'world';
        this.mapBannerT = 2000;
        audio.playMusic(this.mapDef.music);
        this.startNotice('Hollow Creek. The notice BOARD by the well lists contracts. The ELDER keeps the coin.');
      }
    }
  }

  updateGameover() {
    if (this.gameoverT > 2600 || this.just.has('a')) {
      // respawn at inn
      this.player.crowns = Math.max(0, Math.floor(this.player.crowns * 0.9));
      this.player.hp = Math.max(1, Math.floor(this.player.maxHp / 2));
      this.player.sta = this.player.maxSta;
      this.player.tox = 0;
      this.switchMap('inn', 5, 7, 'up');
      this.mode = 'world';
      this.startNotice('Petra dragged you to a bed. Half your crowns bought the medicine. Try preparing next time - oils, potions, signs.');
    }
  }

  // ================= render dispatcher =================
  render(ctx: CanvasRenderingContext2D) {
    switch (this.mode) {
      case 'boot': this.renderBoot(ctx); break;
      case 'title': this.renderTitle(ctx); break;
      case 'creation': this.renderCreation(ctx); break;
      case 'intro': this.renderIntro(ctx); break;
      case 'world': this.renderWorld(ctx); break;
      case 'dialog': this.renderDialog(ctx); break;
      case 'battle': this.battle?.render(ctx); break;
      case 'gameover': this.renderGameover(ctx); break;
      default: renderOverlayMode(this, ctx); break;
    }
  }

  renderBoot(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = C.PAPER;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawTitleText(ctx, 'SERPENTSOFT', SCREEN_W / 2, 60, 2, C.INK);
    if (this.bootT > 500) drawText(ctx, 'presents', 58, 82, C.DARK);
  }

  renderTitle(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = C.INK;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    // frame deco
    ctx.fillStyle = C.DARK;
    ctx.fillRect(0, 0, SCREEN_W, 4);
    ctx.fillRect(0, SCREEN_H - 4, SCREEN_W, 4);

    drawTitleText(ctx, 'MONSTER', SCREEN_W / 2, 14, 3, C.PAPER);
    drawTitleText(ctx, 'SLAYER', SCREEN_W / 2, 38, 3, C.PAPER);
    drawTitleText(ctx, '* GREEN EDITION *', SCREEN_W / 2, 62, 1, C.LIGHT);

    // cycling monster
    const ids = ['drowner', 'ghoul', 'wolf', 'wraith', 'waterhag', 'werewolf', 'leshen'];
    const idx = Math.floor(this.titleT / 1100) % ids.length;
    const spr = MONSTER_GFX[ids[idx]];
    if (spr) {
      ctx.imageSmoothingEnabled = false;
      const blinkIn = (this.titleT % 1100) < 150;
      if (!blinkIn) ctx.drawImage(spr, SCREEN_W / 2 - spr.width / 2, 76);
    }

    if (!this.titleStarted) {
      if (Math.floor(this.titleT / 400) % 2 === 0) {
        drawText(ctx, 'PRESS START', 52, 126, C.PAPER);
      }
    } else {
      const hasSave = this.hasSave();
      const items = hasSave ? ['NEW GAME', 'CONTINUE'] : ['NEW GAME'];
      items.forEach((it, i) => {
        const y = 120 + i * 11;
        drawText(ctx, it, 60, y, C.PAPER);
        if (i === this.titleIdx) drawCursor(ctx, 50, y, C.PAPER);
      });
    }
  }

  renderIntro(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = C.INK;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const scName = schoolById(this.player.school).name;
    const pages = [
      'The year is 1273. The war has burned the Northern kingdoms, and the roads crawl with everything war leaves behind.',
      'Only witchers walk toward the monsters. Mutants of dead Schools, two swords on their backs and none dug for them yet.',
      `You are VESK of the School of the ${scName}. Your medallion hums. Hollow Creek has posted work.`,
    ];
    const text = pages[Math.min(this.introPage, pages.length - 1)];
    const shown = text.slice(0, Math.floor(this.introChar));
    const lines = wrapText(shown, 140);
    lines.slice(0, 7).forEach((l, i) => drawText(ctx, l, 10, 18 + i * 11, C.PAPER));
    if (this.introChar >= text.length && Math.floor(this.time / 300) % 2 === 0) {
      drawText(ctx, '▼', 146, 130, C.LIGHT);
    }
  }

  renderGameover(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = C.INK;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const t = Math.min(1, this.gameoverT / 500);
    if (t >= 1) {
      drawText(ctx, 'You black out...', 46, 60, C.PAPER);
      if (this.gameoverT > 1500) drawText(ctx, 'The world smells of iron.', 24, 80, C.DARK);
    }
  }
}
