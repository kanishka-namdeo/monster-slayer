// ============================================================
// MONSTER SLAYER — 4-channel Game Boy chiptune engine
// Authentic DMG palette: CH1/CH2 pulse (12.5/25/50/75% duty),
// CH3 wave (bass), CH4 noise (drums). Original soundtrack.
// ============================================================

const NOTE_FREQ: Record<string, number> = {};
(() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let oct = 1; oct <= 7; oct++) {
    for (let i = 0; i < 12; i++) {
      const midi = (oct + 1) * 12 + i;
      NOTE_FREQ[`${names[i]}${oct}`] = 440 * Math.pow(2, (midi - 69) / 12);
    }
  }
})();

type Duty = 0.125 | 0.25 | 0.5 | 0.75;

interface PNote {
  p: string | 0; // note name or 0 for rest
  beats: number;
  vib?: boolean; // vibrato
}

/** Parse "E4:1,G4:0.5v,R:2,B3:2s" into notes */
function P(s: string): PNote[] {
  return s
    .split(',')
    .filter(Boolean)
    .map((tok) => {
      const m = /^([A-G]#?\d|R):(\d+(?:\.\d+)?)(v?)$/.exec(tok);
      if (!m) return { p: 0, beats: 1 } as PNote;
      return { p: m[1] === 'R' ? 0 : m[1], beats: parseFloat(m[2]), vib: m[3] === 'v' } as PNote;
    });
}

interface TrackSpec {
  bpm: number;
  loop: boolean;
  p1?: string; p1Duty?: Duty;   // CH1 lead
  p2?: string; p2Duty?: Duty;   // CH2 harmony
  bass?: string;                // CH3 wave bass
  drums?: string;               // CH4 16th-note grid: K kick S snare H hat . rest
}

interface Track {
  bpm: number;
  loop: boolean;
  p1?: PNote[]; p1Duty?: Duty;
  p2?: PNote[]; p2Duty?: Duty;
  bass?: PNote[];
  drums?: string;
}

function T(s: TrackSpec): Track {
  return {
    bpm: s.bpm, loop: s.loop,
    p1: s.p1 ? P(s.p1) : undefined, p1Duty: s.p1Duty,
    p2: s.p2 ? P(s.p2) : undefined, p2Duty: s.p2Duty,
    bass: s.bass ? P(s.bass) : undefined,
    drums: s.drums,
  };
}

// ------------------------------------------------------------
// ORIGINAL SOUNDTRACK — "The Green Edition OST"
// Every track is an original composition in the dark-fantasy
// GB idiom. 16-step drum grids loop per bar.
// ------------------------------------------------------------

// ===== TITLE — "The Witcher's Road" (E minor, 84 BPM) =====
const TITLE_P1 =
  'E4:1.5,G4:0.5,B4:2,E5:1.5,D5:0.5,B4:2,' +
  'G4:1,A4:1,B4:1.5,A4:0.5,G4:2,E4:2,' +
  'A4:1.5,B4:0.5,C5:2,B4:1,A4:1,G4:2,' +
  'F#4:1,G4:1,A4:1,F#4:1,E4:3,R:1,' +
  'E4:1.5,G4:0.5,B4:2,E5:1.5,D5:0.5,B4:2,' +
  'G4:1,A4:1,B4:1.5,A4:0.5,G4:2,A4:1,B4:1,' +
  'C5:1.5,B4:0.5,A4:2,G4:1,E4:1,F#4:2,' +
  'E4:2,B3:2,E4:3,R:1';

// ===== TOWN — "Hollow Creek" (C major, 104 BPM) =====
const TOWN_P1 =
  'C5:0.5,D5:0.5,E5:1,G5:0.5,E5:0.5,D5:1,' +
  'C5:1,A4:1,G4:2,' +
  'A4:0.5,B4:0.5,C5:1,E5:0.5,D5:0.5,C5:1,' +
  'D5:1,B4:1,G4:2,' +
  'E5:0.5,G5:0.5,A5:1,G5:0.5,E5:0.5,G5:1,' +
  'A5:1,F5:1,D5:2,' +
  'G5:0.5,E5:0.5,C5:1,D5:0.5,E5:0.5,F5:1,' +
  'E5:1,D5:1,C5:2,' +
  'C5:0.5,D5:0.5,E5:1,G5:0.5,E5:0.5,D5:1,' +
  'C5:1,A4:1,G4:2,' +
  'A4:0.5,B4:0.5,C5:1,E5:0.5,D5:0.5,C5:1,' +
  'D5:1,B4:1,G4:2,' +
  'C6:1,B5:0.5,A5:0.5,G5:1,E5:1,' +
  'F5:1,A5:1,G5:2,' +
  'E5:0.5,C5:0.5,D5:0.5,E5:0.5,F5:0.5,G5:0.5,A5:1,' +
  'G5:3,R:1';

// ===== INN — "The Sleeping Griffin" (G major, 138 BPM) =====
const INN_P1 =
  'D5:0.75,E5:0.25,D5:0.5,B4:0.5,G4:0.5,A4:0.5,B4:0.5,C5:0.5,' +
  'D5:0.75,E5:0.25,D5:0.5,B4:0.5,G4:1,A4:1,' +
  'B4:0.75,C5:0.25,D5:0.5,D5:0.5,E5:0.5,F#5:0.5,G5:1,' +
  'A5:0.5,G5:0.5,F#5:0.5,E5:0.5,D5:2,' +
  'G5:0.75,F#5:0.25,G5:0.5,E5:0.5,D5:0.5,B4:0.5,G5:1,' +
  'A5:1,F#5:1,D5:2,' +
  'E5:0.75,F#5:0.25,G5:0.5,A5:0.5,B5:0.5,A5:0.5,G5:0.5,F#5:0.5,' +
  'G5:2,D5:1,B4:1,' +
  'D5:0.75,E5:0.25,D5:0.5,B4:0.5,G4:0.5,A4:0.5,B4:0.5,C5:0.5,' +
  'D5:0.75,E5:0.25,D5:0.5,B4:0.5,G4:1,A4:1,' +
  'B4:0.5,C5:0.5,D5:0.5,E5:0.5,F#5:0.5,G5:0.5,A5:0.5,B5:0.5,' +
  'G5:3,R:1';

// ===== SWAMP — "Mirelow" (D dorian, 66 BPM) =====
const SWAMP_P1 =
  'D4:2,F4:2,E4:1,F4:1,E4:2,D4:2,C4:2,D4:4,' +
  'A4:2,G4:2,F4:1,E4:1,D4:2,E4:2,F4:2,D4:4,' +
  'D5:1.5,C5:0.5,A4:2,G4:1,F4:1,E4:2,F4:2,A4:2,D4:4,' +
  'R:2,D4:1,E4:1,F4:2,E4:2,D4:2,C4:1,D4:1,D4:4';

// ===== FOREST — "Oldewood Path" (D minor, 126 BPM) =====
const FOREST_P1 =
  'D5:0.5,E5:0.5,F5:1,A5:1,G5:0.5,F5:0.5,' +
  'E5:1,C5:1,D5:2,' +
  'F5:0.5,G5:0.5,A5:1,D6:1,C6:0.5,A5:0.5,' +
  'A5:1,G5:1,F5:2,' +
  'E5:0.5,F5:0.5,G5:1,Bb5:1,A5:0.5,G5:0.5,' +
  'F5:1,E5:1,D5:2,' +
  'A4:0.5,C5:0.5,D5:1,F5:1,E5:0.5,D5:0.5,' +
  'C5:1,A4:1,D5:2,' +
  'A5:0.5,Bb5:0.5,C6:1,D6:1,C6:0.5,A5:0.5,' +
  'Bb5:1,G5:1,A5:2,' +
  'G5:0.5,A5:0.5,Bb5:1,D6:1,C6:0.5,Bb5:0.5,' +
  'A5:1,F5:1,E5:2,' +
  'D5:0.5,E5:0.5,F5:1,A5:1,G5:0.5,F5:0.5,' +
  'E5:1,C5:1,D5:2,' +
  'F5:1,A5:1,C6:2,' +
  'D6:3,R:1';

// ===== GRAVEYARD — "Weeping Graves" (A minor, 58 BPM) =====
const GRAVE_P1 =
  'A4:3v,R:1,G4:2v,E4:2v,F4:3v,R:1,E4:4v,' +
  'D5:2v,C5:2v,B4:3v,R:1,C5:2,A4:2v,E4:4v,' +
  'A4:1.5v,C5:0.5,E5:2v,D5:2v,C5:1v,B4:1v,A4:2v,G4:2,A4:4v';

// ===== BATTLE — "Steel & Silver" (A phrygian, 152 BPM) =====
const BATTLE_P1 =
  'A4:0.5,A4:0.25,A4:0.25,C5:0.5,B4:0.5,A4:0.5,G4:0.5,A4:1,' +
  'E5:0.5,D5:0.5,C5:0.5,Bb4:0.5,A4:1,G4:1,' +
  'F5:0.5,E5:0.5,D5:0.5,C5:0.5,D5:1,C5:1,' +
  'Bb4:0.5,A4:0.5,G4:0.5,A4:0.5,A4:2,' +
  'A4:0.5,C5:0.5,E5:0.5,A5:0.5,G5:1,E5:1,' +
  'F5:0.5,E5:0.5,D5:0.5,Bb4:0.5,A4:2,' +
  'C5:0.5,D5:0.5,E5:0.5,F5:0.5,E5:0.5,D5:0.5,C5:0.5,' +
  'Bb4:0.5,G4:0.5,A4:3';

// ===== BOSS — "Moonblood" (D minor, 160 BPM) =====
const BOSS_P1 =
  'D4:0.25,D4:0.25,D4:0.5,F4:0.5,A4:1,G4:0.5,F4:0.5,E4:0.5,' +
  'D4:0.5,E4:0.5,F4:0.5,G4:0.5,A4:2,' +
  'A4:0.25,A4:0.25,A4:0.5,C5:0.5,D5:1,C5:0.5,Bb4:0.5,A4:0.5,' +
  'G4:0.5,A4:0.5,Bb4:0.5,A4:0.5,G4:2,' +
  'D5:0.5,C5:0.5,Bb4:0.5,A4:0.5,G4:0.5,F4:0.5,E4:0.5,F4:0.5,' +
  'G4:0.5,F4:0.5,E4:0.5,F4:0.5,D4:2,' +
  'A4:0.5,F4:0.5,D5:0.5,A4:0.5,F5:1.5,D5:0.5,' +
  'A4:0.5,G4:0.5,F4:0.5,E4:0.5,D4:2';

// ===== FINAL BOSS — "Heart of Oldewood" (E minor, 168 BPM) =====
const FINAL_P1 =
  'E4:0.25,E4:0.25,E4:0.25,E4:0.25,G4:0.5,B4:0.5,E5:0.5,D5:0.5,B4:0.5,C5:0.5,A4:0.5,' +
  'B4:0.5,A4:0.5,G4:0.5,F#4:0.5,E4:1,F#4:1,' +
  'E5:0.25,E5:0.25,E5:0.25,E5:0.25,D5:0.5,B4:0.5,C5:0.5,A4:0.5,G4:0.5,F#4:0.5,' +
  'E4:0.5,G4:0.5,B4:0.5,E5:0.5,B4:1,A4:1,' +
  'C5:0.5,C#5:0.5,D5:1,F5:0.5,E5:0.5,D5:1,' +
  'B4:0.5,C5:0.5,D5:0.5,E5:0.5,F5:2,' +
  'G5:0.5,F#5:0.5,E5:0.5,D5:0.5,C5:0.5,B4:0.5,C5:0.5,A4:0.5,' +
  'B4:0.5,A4:0.5,G4:0.5,F#4:0.5,E4:2';

// ===== ENDING — "The Serpentine Path" (E minor -> G major, 92 BPM) =====
const ENDING_P1 =
  'E4:1.5,G4:0.5,B4:2,E5:1.5,D5:0.5,B4:2,' +
  'G4:1,A4:1,B4:1.5,A4:0.5,G4:2,E4:2,' +
  'A4:1.5,B4:0.5,C5:2,B4:1,A4:1,G4:2,' +
  'F#4:1,G4:1,A4:1,F#4:1,E4:3,R:1,' +
  'G4:1.5,A4:0.5,B4:2,C5:1.5,B4:0.5,A4:2,' +
  'G4:1,A4:1,B4:1.5,A4:0.5,G4:2,D5:2,' +
  'E5:1.5,D5:0.5,B4:2,G4:1,A4:1,B4:2,' +
  'G4:2,F#4:2,G4:3v,R:1';

// ===== SHOP — "Crowns & Curiosities" (F major, 118 BPM) =====
const SHOP_P1 =
  'F5:0.5,A5:0.5,C6:1,A5:0.5,G5:0.5,F5:1,' +
  'G5:0.5,A5:0.5,Bb5:1,A5:0.5,G5:0.5,F5:1,' +
  'C6:0.5,Bb5:0.5,A5:0.5,G5:0.5,F5:1,D5:1,' +
  'C6:1,A5:0.5,F5:0.5,F5:2,' +
  'F5:0.25,F5:0.25,F5:0.5,A5:0.5,C6:0.5,D6:0.5,C6:0.5,A5:0.5,F5:0.5,' +
  'G5:0.5,Bb5:0.5,D6:1,C6:0.5,A5:0.5,F5:1,' +
  'A5:0.5,G5:0.5,F5:0.5,E5:0.5,F5:2,' +
  'C6:1,F5:1,F5:2';

// ===== CAVE — "Beneath the Roots" (C minor, 60 BPM) =====
const CAVE_P1 =
  'C5:2,D#5:1,R:1,C5:2,G4:2,A#4:2,C5:2,G4:4,' +
  'D#5:2,F5:1,R:1,D#5:2,C5:2,A#4:1,C5:1,D#5:2,C5:4,' +
  'R:2,C5:1,D#5:1,G5:2,D#5:2,F5:2,D#5:2,C5:4,' +
  'R:3,G4:1,A#4:2,C5:2,G4:2,D#4:2,C5:4';

// ===== helpers for repeated cells =====
function arp(root: string, third: string, fifth: string): string {
  return `${root}:0.5,${third}:0.5,${fifth}:0.5,${third}:0.5`;
}
function cell(s: string, n: number): string {
  return Array(n).fill(s).join(',');
}

const TRACKS: Record<string, Track> = {
  // ---- title screen / intro ----
  title: T({
    bpm: 84, loop: true, p1Duty: 0.25, p2Duty: 0.125,
    p1: TITLE_P1,
    p2:
      'B3:2,E4:2,B3:2,E4:2,G3:2,C4:2,G3:2,C4:2,A3:2,C4:2,A3:2,C4:2,B3:2,D#4:2,B3:2,D#4:2,' +
      'B3:2,E4:2,B3:2,E4:2,G3:2,C4:2,G3:2,C4:2,A3:2,C4:2,B3:2,D#4:2,E3:2,B3:2,E3:2,B3:2',
    bass:
      'E2:2,B2:2,E2:2,B2:2,C3:2,G2:2,C3:2,G2:2,A2:2,E2:2,A2:2,E2:2,B2:2,F#2:2,B2:2,F#2:2,' +
      'E2:2,B2:2,E2:2,B2:2,C3:2,G2:2,C3:2,G2:2,A2:2,E2:2,B2:2,F#2:2,E2:2,B2:2,E2:4',
    drums: 'K...............K...............',
  }),

  // ---- Hollow Creek village ----
  town: T({
    bpm: 104, loop: true, p1Duty: 0.5, p2Duty: 0.25,
    p1: TOWN_P1,
    p2:
      cell(arp('C4', 'E4', 'G4'), 2) + cell(arp('C4', 'E4', 'G4'), 2) +
      cell(arp('F4', 'A4', 'C5'), 2) + cell(arp('C4', 'E4', 'G4'), 2) +
      cell(arp('G4', 'B4', 'D5'), 2) + cell(arp('G4', 'B4', 'D5'), 2) +
      cell(arp('C4', 'E4', 'G4'), 2) + cell(arp('C4', 'E4', 'G4'), 2) +
      cell(arp('C4', 'E4', 'G4'), 2) + cell(arp('F4', 'A4', 'C5'), 2) +
      cell(arp('D4', 'F4', 'A4'), 2) + cell(arp('G4', 'B4', 'D5'), 2) +
      cell(arp('F4', 'A4', 'C5'), 2) + cell(arp('G4', 'B4', 'D5'), 2) +
      cell(arp('C4', 'E4', 'G4'), 2) + cell(arp('C4', 'E4', 'G4'), 2),
    bass:
      cell('C3:0.5,G3:0.5', 4) + cell('C3:0.5,G3:0.5', 4) +
      cell('F3:0.5,C4:0.5', 4) + cell('C3:0.5,G3:0.5', 4) +
      cell('G3:0.5,D4:0.5', 4) + cell('G3:0.5,D4:0.5', 4) +
      cell('C3:0.5,G3:0.5', 4) + cell('C3:0.5,G3:0.5', 4) +
      cell('C3:0.5,G3:0.5', 4) + cell('F3:0.5,C4:0.5', 4) +
      cell('D3:0.5,A3:0.5', 4) + cell('G3:0.5,D4:0.5', 4) +
      cell('F3:0.5,C4:0.5', 4) + cell('G3:0.5,D4:0.5', 4) +
      cell('C3:0.5,G3:0.5', 4) + cell('C3:0.5,G3:0.5', 4),
    drums: 'K.H.H.H.S.H.H.H.',
  }),

  // ---- The Sleeping Griffin inn ----
  inn: T({
    bpm: 138, loop: true, p1Duty: 0.5, p2Duty: 0.25,
    p1: INN_P1,
    p2:
      'G3:2,B3:2,B3:2,E4:2,C4:2,E4:2,A3:2,D4:2,' +
      'G3:2,B3:2,B3:2,E4:2,C4:2,E4:2,A3:2,D4:2,' +
      'G3:2,B3:2,B3:2,E4:2,C4:2,E4:2,A3:2,D4:2,' +
      'G3:2,B3:2,C4:2,E4:2,A3:2,D4:2,G3:2,B3:2',
    bass:
      cell('G2:0.5,D3:0.5', 4) + cell('E2:0.5,B2:0.5', 4) +
      cell('C3:0.5,G2:0.5', 4) + cell('D3:0.5,A2:0.5', 4) +
      cell('G2:0.5,D3:0.5', 4) + cell('E2:0.5,B2:0.5', 4) +
      cell('C3:0.5,G2:0.5', 4) + cell('D3:0.5,A2:0.5', 4) +
      cell('G2:0.5,D3:0.5', 4) + cell('E2:0.5,B2:0.5', 4) +
      cell('C3:0.5,G2:0.5', 4) + cell('D3:0.5,A2:0.5', 4) +
      cell('G2:0.5,D3:0.5', 4) + cell('C3:0.5,G2:0.5', 4) +
      cell('D3:0.5,A2:0.5', 4) + cell('G2:0.5,D3:0.5', 4),
    drums: 'K.H.S.H.K.H.S.H.',
  }),

  // ---- Mirelow Swamp ----
  swamp: T({
    bpm: 66, loop: true, p1Duty: 0.125, p2Duty: 0.25,
    p1: SWAMP_P1,
    p2: 'D3:4,C3:4,D3:4,D3:4,D3:4,C3:4,D3:4,D3:4,D3:4,C3:4,D3:4,D3:4,C3:4,D3:4,D3:4,D3:4',
    bass: 'D2:4,C2:4,D2:4,D2:4,D2:4,C2:4,D2:4,D2:4,D2:4,C2:4,D2:4,D2:4,C2:4,D2:4,D2:4,D2:4',
  }),

  // ---- Oldewood forest ----
  forest: T({
    bpm: 126, loop: true, p1Duty: 0.25, p2Duty: 0.125,
    p1: FOREST_P1,
    p2:
      cell(arp('D4', 'F4', 'A4'), 2) + cell(arp('Bb3', 'D4', 'F4'), 2) +
      cell(arp('F3', 'A3', 'C4'), 2) + cell(arp('C4', 'E4', 'G4'), 2) +
      cell(arp('D4', 'F4', 'A4'), 2) + cell(arp('Bb3', 'D4', 'F4'), 2) +
      cell(arp('C4', 'E4', 'G4'), 2) + cell(arp('D4', 'F4', 'A4'), 2) +
      cell(arp('D4', 'F4', 'A4'), 2) + cell(arp('Bb3', 'D4', 'F4'), 2) +
      cell(arp('F3', 'A3', 'C4'), 2) + cell(arp('C4', 'E4', 'G4'), 2) +
      cell(arp('D4', 'F4', 'A4'), 2) + cell(arp('Bb3', 'D4', 'F4'), 2) +
      cell(arp('C4', 'E4', 'G4'), 2) + cell(arp('D4', 'F4', 'A4'), 2),
    bass:
      cell('D3:0.5,A2:0.5', 4) + cell('Bb2:0.5,F3:0.5', 4) +
      cell('F2:0.5,C3:0.5', 4) + cell('C3:0.5,G2:0.5', 4) +
      cell('D3:0.5,A2:0.5', 4) + cell('Bb2:0.5,F3:0.5', 4) +
      cell('C3:0.5,G2:0.5', 4) + cell('D3:0.5,A2:0.5', 4) +
      cell('D3:0.5,A2:0.5', 4) + cell('Bb2:0.5,F3:0.5', 4) +
      cell('F2:0.5,C3:0.5', 4) + cell('C3:0.5,G2:0.5', 4) +
      cell('D3:0.5,A2:0.5', 4) + cell('Bb2:0.5,F3:0.5', 4) +
      cell('C3:0.5,G2:0.5', 4) + cell('D3:0.5,A2:0.5', 4),
    drums: 'K.H.S.HHK.H.S.HH',
  }),

  // ---- Weeping Graves ----
  graveyard: T({
    bpm: 58, loop: true, p1Duty: 0.125, p2Duty: 0.25,
    p1: GRAVE_P1,
    p2: 'A3:4,E3:4,F3:4,E3:4,A3:4,E3:4,F3:4,E3:4,A3:4,E3:4,F3:4,E3:4',
    bass: 'A2:4,E2:4,F2:4,E2:4,A2:4,E2:4,F2:4,E2:4,A2:4,E2:4,F2:2,E2:2,A2:4',
  }),

  // ---- random encounters ----
  battle: T({
    bpm: 152, loop: true, p1Duty: 0.5, p2Duty: 0.25,
    p1: BATTLE_P1,
    p2:
      cell('A3:0.5,E4:0.5', 8) + cell('A3:0.5,E4:0.5', 8) +
      cell('F3:0.5,C4:0.5', 8) + cell('F3:0.5,C4:0.5', 8) +
      cell('A3:0.5,E4:0.5', 8) + cell('A3:0.5,E4:0.5', 8) +
      cell('Bb3:0.5,F4:0.5', 8) + cell('A3:0.5,E4:0.5', 8),
    bass:
      cell('A2:0.5', 7) + 'G2:0.5,' + cell('A2:0.5', 8) +
      cell('F2:0.5', 7) + 'E2:0.5,' + cell('F2:0.5', 8) +
      cell('A2:0.5', 7) + 'G2:0.5,' + cell('A2:0.5', 8) +
      cell('Bb2:0.5', 4) + cell('A2:0.5', 4),
    drums: 'K.K.S.H.K.K.S.H.',
  }),

  // ---- boss fights (werewolf etc.) ----
  boss: T({
    bpm: 160, loop: true, p1Duty: 0.75, p2Duty: 0.25,
    p1: BOSS_P1,
    p2:
      cell('D3:0.5,A3:0.5', 8) + cell('D3:0.5,A3:0.5', 8) +
      cell('Bb2:0.5,F3:0.5', 8) + cell('C3:0.5,G3:0.5', 8) +
      cell('D3:0.5,A3:0.5', 8) + cell('Bb2:0.5,F3:0.5', 8) +
      cell('G2:0.5,D3:0.5', 8) + cell('A2:0.5,E3:0.5', 8),
    bass:
      cell('D2:0.5', 8) + cell('D2:0.5', 8) +
      cell('Bb2:0.5', 8) + cell('C2:0.5', 8) +
      cell('D2:0.5', 8) + cell('Bb2:0.5', 8) +
      cell('G2:0.5', 8) + cell('A2:0.5', 8),
    drums: 'K...S..KK...S.K.',
  }),

  // ---- the Leshen ----
  finalboss: T({
    bpm: 168, loop: true, p1Duty: 0.75, p2Duty: 0.5,
    p1: FINAL_P1,
    p2:
      cell(arp('E4', 'G4', 'B4'), 2) + cell(arp('C4', 'E4', 'G4'), 2) +
      cell(arp('A3', 'C4', 'E4'), 2) + cell(arp('B3', 'D#4', 'F#4'), 2) +
      cell(arp('E4', 'G4', 'B4'), 2) + cell(arp('C4', 'E4', 'G4'), 2) +
      cell(arp('D4', 'F#4', 'A4'), 2) + cell(arp('B3', 'D#4', 'F#4'), 2),
    bass:
      cell('E2:0.5', 8) + cell('C2:0.5', 8) +
      cell('A2:0.5', 8) + cell('B2:0.5', 8) +
      cell('E2:0.5', 8) + cell('C2:0.5', 8) +
      cell('D2:0.5', 8) + cell('B2:0.5', 8),
    drums: 'K.K.S.K.K.K.S.KK',
  }),

  // ---- post-battle fanfare ----
  victory: T({
    bpm: 140, loop: false, p1Duty: 0.5, p2Duty: 0.25,
    p1: 'G4:0.25,G4:0.25,G4:0.25,C5:1,B4:0.5,C5:0.5,D5:3',
    p2: 'E4:0.75,E4:1,G4:1,B4:3.25',
    bass: 'C3:1.5,G2:1.5,C3:1,G2:2',
    drums: 'K.......S.......K...S...',
  }),

  // ---- defeat sting ----
  gameover: T({
    bpm: 90, loop: false, p1Duty: 0.25, p2Duty: 0.125,
    p1: 'E4:1,D4:1,C4:1,B3:2,A3:3,R:2',
    p2: 'C4:1,B3:1,A3:1,G3:2,A3:3,R:2',
    bass: 'A2:2,G2:2,F2:2,E2:4',
  }),

  // ---- credits ----
  ending: T({
    bpm: 92, loop: true, p1Duty: 0.25, p2Duty: 0.125,
    p1: ENDING_P1,
    p2:
      'G3:2,B3:2,E4:2,B3:2,C4:2,G3:2,B3:4,' +
      'A3:2,C4:2,A3:2,C4:2,B3:2,D#4:2,E4:4,' +
      'G3:2,B3:2,A3:2,C4:2,G3:2,B3:2,B3:2,D4:2,' +
      'C4:2,G3:2,D4:2,B3:2,B3:2,D4:2,G3:4',
    bass:
      'E2:2,B2:2,E2:2,B2:2,C3:2,G2:2,B2:2,F#2:2,' +
      'A2:2,E2:2,A2:2,E2:2,B2:2,F#2:2,E2:2,E2:2,' +
      'G2:2,D3:2,G2:2,D3:2,A2:2,E3:2,A2:2,D3:2,' +
      'C3:2,G2:2,D3:2,B2:2,G2:2,D3:2,G2:4',
    drums: 'H...H...H...H...',
  }),

  // ---- browsing wares ----
  shop: T({
    bpm: 118, loop: true, p1Duty: 0.5, p2Duty: 0.25,
    p1: SHOP_P1,
    p2:
      'A3:1,C4:1,F4:1,C4:1,A3:1,C4:1,F4:1,C4:1,' +
      'Bb3:1,D4:1,F4:1,D4:1,C4:1,E4:1,G4:1,E4:1,' +
      'A3:1,C4:1,F4:1,C4:1,A3:1,D4:1,F4:1,D4:1,' +
      'Bb3:1,D4:1,F4:1,D4:1,C4:1,E4:1,G4:1,E4:1',
    bass:
      'F3:2,C3:2,F3:2,C3:2,Bb2:2,F3:2,C3:2,G2:2,' +
      'F3:2,C3:2,D3:2,A2:2,Bb2:2,F3:2,C3:2,G2:2',
    drums: 'K.H.S.H.K.H.S.H.',
  }),

  // ---- the forest heart / dark places ----
  cave: T({
    bpm: 60, loop: true, p1Duty: 0.125, p2Duty: 0.25,
    p1: CAVE_P1,
    p2: 'C4:4,C4:4,G3:4,G3:4,A#3:4,A#3:4,G3:4,G3:4,C4:4,C4:4,D#4:4,D#4:4,F4:4,D#4:4,C4:4,C4:4',
    bass: 'C2:8,C2:8,A#1:8,G2:8,C2:8,C2:8,F2:8,C2:8',
  }),
};

// legacy aliases (older save states / map fields)
TRACKS.field = TRACKS.forest;
TRACKS.eerie = TRACKS.graveyard;

type ChanKey = 'p1' | 'p2' | 'bass' | 'drums';

interface ChanState {
  idx: number;
  time: number;
  done: boolean;
}

class AudioSys {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true;
  private trackName = '';
  private pendingOn = '';
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private chans: Partial<Record<ChanKey, ChanState>> = {};
  private dutyCache = new Map<Duty, PeriodicWave>();
  private noiseBuf: AudioBuffer | null = null;
  private sfxLast: Record<string, number> = {};
  private active = 0; // notes currently scheduled (diagnostics / e2e)

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // start a pending track if the context is runnable
      if (this.trackName && this.enabled && this.ctx.state === 'running') {
        const n = this.trackName;
        this.startTrack(n);
      }
    } catch { /* audio unavailable */ }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.pendingOn = this.trackName;
      this.stopMusic();
      return;
    }
    this.ensure();
    if (this.pendingOn) {
      const n = this.pendingOn;
      this.pendingOn = '';
      this.playMusic(n);
    }
  }

  // ---------------- SFX (unchanged behavior) ----------------
  private osc(type: OscillatorType, freq: number, t: number, dur: number, vol: number, slideTo?: number) {
    if (!this.ctx || !this.master || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noiseAt(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || !this.master || !this.noiseBuf || !this.enabled) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  sfx(name: string) {
    this.ensure();
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - (this.sfxLast[name] ?? -1) < 0.03) return;
    this.sfxLast[name] = now;
    const t = now + 0.001;
    switch (name) {
      case 'blip': this.osc('square', 720, t, 0.05, 0.06); break;
      case 'confirm': this.osc('square', 880, t, 0.05, 0.06); this.osc('square', 1318, t + 0.05, 0.07, 0.06); break;
      case 'cancel': this.osc('square', 440, t, 0.05, 0.05); this.osc('square', 294, t + 0.05, 0.07, 0.05); break;
      case 'text': this.osc('square', 850 + Math.random() * 150, t, 0.018, 0.03); break;
      case 'hit': this.osc('square', 200, t, 0.08, 0.09, 90); this.noiseAt(t, 0.06, 0.05, 900); break;
      case 'strong': this.osc('square', 150, t, 0.14, 0.11, 60); this.noiseAt(t, 0.1, 0.07, 500); break;
      case 'fire': this.noiseAt(t, 0.25, 0.09, 1600); this.osc('sawtooth', 300, t, 0.2, 0.04, 90); break;
      case 'shield': this.osc('triangle', 520, t, 0.12, 0.08); this.osc('triangle', 780, t + 0.06, 0.12, 0.06); break;
      case 'hex': this.osc('sine', 660, t, 0.2, 0.07, 220); break;
      case 'heal': [660, 880, 1174].forEach((f, i) => this.osc('triangle', f, t + i * 0.07, 0.1, 0.07)); break;
      case 'coin': this.osc('square', 1235, t, 0.05, 0.06); this.osc('square', 1568, t + 0.05, 0.09, 0.06); break;
      case 'faint': this.osc('square', 420, t, 0.35, 0.08, 60); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.osc('square', f, t + i * 0.09, 0.12, 0.07)); break;
      case 'encounter': this.osc('square', 220, t, 0.09, 0.09, 660); this.osc('square', 660, t + 0.1, 0.12, 0.09, 220); break;
      case 'step': this.osc('triangle', 140, t, 0.03, 0.025); break;
      case 'door': this.osc('triangle', 300, t, 0.1, 0.06, 200); break;
      case 'pickup': [784, 1047, 1319].forEach((f, i) => this.osc('square', f, t + i * 0.05, 0.07, 0.06)); break;
      case 'poison': this.osc('sawtooth', 220, t, 0.2, 0.04, 140); break;
      case 'stun': this.osc('square', 1100, t, 0.15, 0.07, 500); break;
      case 'save': [659, 880].forEach((f, i) => this.osc('triangle', f, t + i * 0.08, 0.12, 0.07)); break;
    }
  }

  // ---------------- music ----------------
  playMusic(name: string) {
    if (!TRACKS[name]) return;
    if (this.trackName === name && this.schedTimer) return;
    this.stopMusic();
    this.ensure();
    if (!this.ctx || !this.enabled) { this.trackName = name; return; }
    this.startTrack(name);
  }

  private startTrack(name: string) {
    if (!this.ctx) return;
    const tr = TRACKS[name];
    if (!tr) return;
    this.trackName = name;
    const t0 = this.ctx.currentTime + 0.06;
    this.chans = {};
    (['p1', 'p2', 'bass', 'drums'] as ChanKey[]).forEach((k) => {
      if (tr[k]) this.chans[k] = { idx: 0, time: t0, done: false };
    });
    if (this.schedTimer) clearInterval(this.schedTimer);
    this.schedTimer = setInterval(() => this.schedule(), 60);
    this.schedule();
  }

  stopMusic() {
    if (this.schedTimer) clearInterval(this.schedTimer);
    this.schedTimer = null;
    this.chans = {};
    this.trackName = '';
  }

  get currentTrack() { return this.trackName; }
  get trackList() { return Object.keys(TRACKS); }
  get activeNoteCount() { return this.active; }

  private dutyWave(d: Duty): PeriodicWave | null {
    if (!this.ctx) return null;
    const hit = this.dutyCache.get(d);
    if (hit) return hit;
    const N = 32;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d);
    }
    const w = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    this.dutyCache.set(d, w);
    return w;
  }

  /** one melodic note on a pulse/wave channel */
  private tone(key: 'p1' | 'p2' | 'bass', note: PNote, tr: Track, t: number, dur: number) {
    if (!this.ctx || !this.master || !this.enabled) return;
    const vol = key === 'p1' ? 0.05 : key === 'p2' ? 0.034 : 0.075;
    const o = this.ctx.createOscillator();
    if (key === 'bass') {
      o.type = 'triangle';
    } else {
      const w = this.dutyWave(key === 'p1' ? (tr.p1Duty ?? 0.5) : (tr.p2Duty ?? 0.25));
      if (w) o.setPeriodicWave(w);
      else o.type = 'square';
    }
    o.frequency.value = NOTE_FREQ[note.p as string] ?? 440;
    const g = this.ctx.createGain();
    const gate = Math.max(0.05, Math.min(0.92, dur * 0.88));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, gate - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0008, t + gate);
    o.connect(g); g.connect(this.master);
    // vibrato (CH1/CH2 only, marked notes)
    if (note.vib && key !== 'bass') {
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 5.2;
      const lg = this.ctx.createGain();
      lg.gain.value = 14; // cents
      lfo.connect(lg); lg.connect(o.detune);
      lfo.start(t); lfo.stop(t + gate + 0.05);
    }
    this.active++;
    o.onended = () => { this.active = Math.max(0, this.active - 1); };
    o.start(t); o.stop(t + gate + 0.03);
  }

  private drumKick(t: number) { this.osc('square', 130, t, 0.09, 0.11, 38); }
  private drumSnare(t: number) { this.noiseAt(t, 0.09, 0.055, 1400); }
  private drumHat(t: number) { this.noiseAt(t, 0.03, 0.026, 6200, 'highpass'); }

  private schedule() {
    if (!this.ctx || !this.enabled || !this.trackName) return;
    const tr = TRACKS[this.trackName];
    if (!tr || !this.schedTimer) return;
    const spb = 60 / tr.bpm;
    const horizon = this.ctx.currentTime + 0.3;

    for (const key of ['p1', 'p2', 'bass'] as const) {
      const notes = tr[key];
      const st = this.chans[key];
      if (!notes || !st || st.done) continue;
      let guard = 0;
      while (st.time < horizon && guard++ < 64) {
        const n = notes[st.idx];
        const dur = n.beats * spb;
        if (n.p) this.tone(key, n, tr, st.time, dur);
        st.time += dur;
        st.idx++;
        if (st.idx >= notes.length) {
          if (!tr.loop) { st.done = true; break; }
          st.idx = 0;
        }
      }
    }

    if (tr.drums) {
      const st = this.chans.drums;
      if (st && !st.done) {
        const stepDur = spb / 4;
        let guard = 0;
        while (st.time < horizon && guard++ < 128) {
          const chr = tr.drums[st.idx];
          if (chr === 'K') this.drumKick(st.time);
          else if (chr === 'S') this.drumSnare(st.time);
          else if (chr === 'H') this.drumHat(st.time);
          st.time += stepDur;
          st.idx++;
          if (st.idx >= tr.drums.length) {
            if (!tr.loop) { st.done = true; break; }
            st.idx = 0;
          }
        }
      }
    }

    if (!tr.loop) {
      const keys = (['p1', 'p2', 'bass', 'drums'] as ChanKey[]).filter((k) => tr[k]);
      if (keys.length > 0 && keys.every((k) => this.chans[k]?.done)) {
        this.stopMusic();
      }
    }
  }
}

export const audio = new AudioSys();
