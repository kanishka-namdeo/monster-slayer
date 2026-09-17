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
  // ---- DROWNER: hunched fish-fiend, glinting eyes, dark belly band
  MONSTER_GFX.drowner = scaleUp(makeSprite(mirror([
    '.....000',
    '...00222',
    '..022222',
    '..023322',
    '..022222',
    '..022202',
    '..022222',
    '.0221111',
    '.0221111',
    '.0222222',
    '022.0222',
    '022.0222',
    '023.0222',
    '.3..0222',
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

  // ---- WATER HAG: bulbous swamp crone with hooked arms and ragged hem
  MONSTER_GFX.waterhag = scaleUp(makeSprite(mirror([
    '.....000',
    '....0111',
    '...01111',
    '..011011',
    '..013301',
    '..011110',
    '..011110',
    '.0111111',
    '.01.0111',
    '.01.0111',
    '.3..0111',
    '01111111',
    '01111111',
    '03110111',
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
  ], 12), 24, 24), 2);

  // ---- NEKKER: hunched swamp imp with a huge mouth
  MONSTER_GFX.nekker = scaleUp(makeSprite(mirror([
    '.....000',
    '....0222',
    '...02222',
    '..023022',
    '..022222',
    '..022222',
    '.0222222',
    '.0222222',
    '..023333',
    '..023030',
    '..023333',
    '..022222',
    '..022222',
    '..02.020',
    '..00.000',
    '........',
  ], 8)), 2);

  // ---- ENDREGA: segmented venom-spraying insectoid
  MONSTER_GFX.endrega = scaleUp(makeSprite(mirror([
    '...0..0.',
    '...0222.',
    '..022222',
    '..023032',
    '..022222',
    '...0110.',
    '..021112',
    '.0211112',
    '..021112',
    '.0211112',
    '..021112',
    '..021112',
    '...2111.',
    '...0.0..',
    '..0...0.',
    '........',
  ], 8)), 2);

  // ---- FOGLET: mist-cloaked deceiver, hollow eyes, ground-fog hem, hanging lantern
  {
    const f = makeSprite(mirror([
      '....0000',
      '...02222',
      '..022022',
      '..022022',
      '...02222',
      '..022222',
      '..022222',
      '..022322',
      '..022222',
      '...02222',
      '...0.222',
      '..2..022',
      '.2...022',
      '.222.022',
      '2222..0.',
      '..22....',
    ], 8), 16, 16);
    const g = f.getContext('2d')!;
    // the false lantern it uses to lure travelers
    g.fillStyle = PAL[0];
    g.fillRect(13, 10, 1, 1);
    g.fillRect(12, 11, 1, 2); g.fillRect(14, 11, 1, 2);
    g.fillRect(13, 13, 1, 1);
    g.fillStyle = PAL[3];
    g.fillRect(13, 11, 1, 2);
    MONSTER_GFX.foglet = scaleUp(f, 2);
  }

  // ---- NOONWRAITH: sun-haloed specter bride (continuous sun-disk halo)
  MONSTER_GFX.noonwraith = scaleUp(makeSprite(mirror([
    '..333333',
    '...000..',
    '..02222.',
    '..023032',
    '..022222',
    '..022222',
    '...02222',
    '..022222',
    '..022222',
    '..022222',
    '..0.2222',
    '..2..022',
    '.2...022',
    '......02',
    '.....2.0',
    '........',
  ], 8)), 2);

  // ---- ROTFIEND: bloated carrion-eater, 3D ribcage, toxic gas flanks
  MONSTER_GFX.rotfiend = scaleUp(makeSprite(mirror([
    '.....000',
    '....0222',
    '...02222',
    '...02302',
    '...02222',
    '3...0222',
    '.3.02222',
    '..010101',
    '.0222222',
    '..010101',
    '.0222222',
    '..022222',
    '...02222',
    '...02.20',
    '..0.00.0',
    '........',
  ], 8)), 2);

  // ---- BARGHEST: ember-eyed spectral hound (side view), ember mane, open jaw
  MONSTER_GFX.barghest = scaleUp(makeSprite([
    '................',
    '...0.0..........',
    '..0110..000.....',
    '0.01100013300...',
    '0..01313131310..',
    '...01031111110..',
    '....0111111110..',
    '00...011111110..',
    '0110.011111110..',
    '.0111111111100..',
    '..0111111111....',
    '...011011011....',
    '...01.01.010....',
    '...01.01.01.....',
    '...00.00.00.....',
    '................',
  ]), 2);

  // ---- ARACHAS: armored bog spider matriarch (24x24, half=12) — fangs + silk
  MONSTER_GFX.arachas = scaleUp(makeSprite(mirror([
    '............',
    '.....0..0...',
    '....0.0.0.0.',
    '....0..0..0.',
    '...0..020..0',
    '..0..0220..0',
    '..0.022222.0',
    '.0..0222220.',
    '.0.022232220',
    '0..022002222',
    '0.0222222222',
    '0.0221222222',
    '.02211222112',
    '.02222222222',
    '..0222222222',
    '...022222220',
    '....0222222.',
    '.....022220.',
    '......0220..',
    '.......00...',
    '.......02...',
    '........2...',
    '............',
    '............',
  ], 12), 24, 24), 2);

  // ---- ROYAL GRIFFIN: wings spread over the pass (24x24, half=12) — beaked
  MONSTER_GFX.griffin = scaleUp(makeSprite(mirror([
    '..........00',
    '.........011',
    '........0111',
    '........0131',
    '.......01113',
    '.......01113',
    '..00...01113',
    '.0220..01111',
    '022220.01111',
    '021221001111',
    '022222201111',
    '021212011111',
    '.02220111111',
    '.02101111111',
    '..0011111111',
    '...011111111',
    '...011111111',
    '....01111111',
    '....011.011.',
    '....011.011.',
    '....00..011.',
    '.....0...00.',
    '............',
    '............',
  ], 12), 24, 24), 2);

  // ---- KATAKAN: bat-faced higher vampire (24x24, half=12)
  MONSTER_GFX.katakan = scaleUp(makeSprite(mirror([
    '.0..........',
    '.00....000..',
    '.020..02220.',
    '.022.022220.',
    '.0220222320.',
    '..020222220.',
    '..0.022220..',
    '.00.011110..',
    '.020.011110.',
    '0220.0111110',
    '0222.0111110',
    '022201111111',
    '.02201111111',
    '.02201111111',
    '..0011111111',
    '...011111111',
    '..0.01111111',
    '.00..0111111',
    '.0.0.0111111',
    '.....0111110',
    '.....011110.',
    '....011.011.',
    '....00..00..',
    '............',
  ], 12), 24, 24), 2);
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
