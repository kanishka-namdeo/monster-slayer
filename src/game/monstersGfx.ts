// ============================================================
// Monster battle sprites — chunky 16x16 art upscaled 2x.
// Leshen boss: 24x24 upscaled 2x → 48x48.
// '.'=transparent 0=ink 1=dark 2=light 3=paper
// ============================================================
import { makeSprite, mirror } from './sprites';
import { PAL } from './constants';

function scaleUp(src: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = src.width * k;
  cv.height = src.height * k;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}

export const MONSTER_GFX: Record<string, HTMLCanvasElement> = {};

function buildMonsters() {
  // ---- DROWNER: hunched fish-fiend, side eyes, claws
  MONSTER_GFX.drowner = scaleUp(makeSprite(mirror([
    '.....000',
    '...00222',
    '..022232',
    '..022232',
    '..022222',
    '.0222332',
    '.0222222',
    '.0222222',
    '022.0222',
    '022.0222',
    '022.0222',
    '032.0222',
    '.3..0222',
    '.....022',
    '....0322',
    '.....00.',
  ], 8)), 2);

  // ---- GHOUL: bent skull-faced necrophage
  MONSTER_GFX.ghoul = scaleUp(makeSprite(mirror([
    '......00',
    '....0022',
    '...02222',
    '...20202',
    '...20202',
    '...22022',
    '....0232',
    '..00.022',
    '.0220112',
    '.0220112',
    '.0220112',
    '.0320022',
    '..3..022',
    '.....022',
    '....0322',
    '.....00.',
  ], 8)), 2);

  // ---- WOLF: side view, facing left (asymmetric, full rows)
  MONSTER_GFX.wolf = scaleUp(makeSprite([
    '................',
    '...00...........',
    '..0220..000.....',
    '..02200022200...',
    '...02222222220..',
    '...02032222220..',
    '....0222222220..',
    '00...022222220..',
    '0220.022222220..',
    '.0222222222200..',
    '..0222222222....',
    '...022022022....',
    '...02.02.020....',
    '...02.02.02.....',
    '...00.00.00.....',
    '................',
  ]), 2);

  // ---- WRAITH: floating hooded specter
  MONSTER_GFX.wraith = scaleUp(makeSprite(mirror([
    '.....000',
    '...00111',
    '..011110',
    '..013310',
    '..013010',
    '..011310',
    '..011110',
    '.0111111',
    '.0111111',
    '.0111211',
    '.0111111',
    '.0111121',
    '..011111',
    '..011011',
    '...01.01',
    '....3..3',
  ], 8)), 2);

  // ---- WATER HAG: bulbous swamp crone
  MONSTER_GFX.waterhag = scaleUp(makeSprite(mirror([
    '.....000',
    '....0111',
    '...01111',
    '..011011',
    '..010301',
    '..011011',
    '..011110',
    '.0111111',
    '.0111111',
    '01111111',
    '01111211',
    '01111111',
    '01111111',
    '03111111',
    '.3.01111',
    '...01100',
  ], 8)), 2);

  // ---- WEREWOLF: erect cursed beast
  MONSTER_GFX.werewolf = scaleUp(makeSprite(mirror([
    '...0.0..',
    '..011110',
    '..011110',
    '..013210',
    '..011210',
    '...01310',
    '.00.0110',
    '011.0111',
    '011.0111',
    '011.0111',
    '031.0111',
    '.3..0111',
    '....0111',
    '....0110',
    '...011.0',
    '...00..0',
  ], 8)), 2);

  // ---- LESHEN: antlered forest demon (24x24, half=12)
  MONSTER_GFX.leshen = scaleUp(makeSprite(mirror([
    '0....00.....',
    '00..0110....',
    '.0.01110....',
    '.00111100...',
    '..01111110..',
    '..01331110..',
    '..01301310..',
    '..01331110..',
    '..01111110..',
    '...0111110..',
    '...0111110..',
    '.000111110..',
    '01100111110.',
    '01100111110.',
    '01100111110.',
    '01100111110.',
    '03100111110.',
    '.3..0111110.',
    '....0111110.',
    '....0110110.',
    '....0110110.',
    '...0110.011.',
    '...0110..01.',
    '...0000..00.',
  ], 12)), 2);
}

let built = false;
export function ensureMonsterGfx() {
  if (built) return;
  built = true;
  buildMonsters();
}

// big portrait for title screen / victory
export function titleMonster(): HTMLCanvasElement {
  return MONSTER_GFX.leshen;
}

// palette for battle backdrop bands
export const BACKDROP = {
  inkTop: PAL[0],
  band: PAL[1],
};
