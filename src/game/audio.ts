// ============================================================
// Chiptune audio: SFX + looping music (Web Audio, square waves)
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

type Note = [string | 0, number]; // note (0=rest) + beats

interface Track {
  bpm: number;
  loop: boolean;
  mel: Note[];
  bass: Note[];
  melWave?: OscillatorType;
}

function T(bpm: number, loop: boolean, mel: string, bass: string, melWave: OscillatorType = 'square'): Track {
  const parse = (s: string): Note[] =>
    (s.split(',').filter(Boolean) as string[]).map((n) => {
      const [p, d] = n.split(':');
      return [p === 'R' ? 0 : p, parseFloat(d || '1')] as Note;
    });
  return { bpm, loop, mel: parse(mel), bass: parse(bass), melWave };
}

const TRACKS: Record<string, Track> = {
  title: T(96, true,
    'E4:1,G4:1,B4:1,E5:1,D5:0.5,B4:0.5,G4:1,A4:1,B4:1,C5:1,B4:0.5,A4:0.5,G4:1,E4:1,G4:1,A4:1,B4:2,R:1,' +
    'E4:1,G4:1,B4:1,E5:1,D5:0.5,B4:0.5,G4:1,A4:1,B4:1,C5:1,A4:0.5,G4:0.5,E4:1,E4:1,R:1,R:2',
    'E2:2,B2:2,A2:2,E2:2,G2:2,D3:2,E2:2,E2:2,E2:2,B2:2,A2:2,E2:2,C3:2,B2:2,E2:2,E2:2'),
  town: T(112, true,
    'C4:0.5,E4:0.5,G4:1,E4:0.5,F4:0.5,A4:1,G4:0.5,E4:0.5,C4:1,D4:0.5,F4:0.5,A4:1,G4:2,' +
    'C4:0.5,E4:0.5,G4:1,E4:0.5,F4:0.5,A4:1,B4:0.5,A4:0.5,G4:1,E4:0.5,D4:0.5,C4:2,R:1',
    'C3:2,F3:2,G3:2,C3:2,F3:2,G3:1,G3:1,C3:2,C3:2,F3:2,G3:2,C3:2,G3:1,G3:1,C3:2,C3:1,R:1'),
  field: T(126, true,
    'A3:0.5,C4:0.5,E4:1,A4:1,G4:0.5,E4:0.5,C4:1,E4:1,D4:0.5,F4:0.5,A4:1,G4:2,' +
    'A3:0.5,C4:0.5,E4:1,A4:1,B4:0.5,A4:0.5,G4:1,E4:1,F4:0.5,E4:0.5,D4:1,E4:2,R:1',
    'A2:2,E3:2,F3:2,G3:2,A2:2,E3:2,F3:2,E3:2,A2:2,E3:2,F3:2,G3:2,D3:2,E3:2,A2:2,A2:1,R:1'),
  eerie: T(72, true,
    'E4:2,G4:1,B4:2,A4:1,G4:2,E4:3,D4:2,E4:1,G4:2,F4:1,E4:4,R:1',
    'E2:4,C3:3,D3:3,E2:4,B2:2,C3:3,E2:3,R:2'),
  battle: T(150, true,
    'A3:0.5,A3:0.5,C4:0.5,A3:0.5,E4:0.5,D4:0.5,C4:0.5,B3:0.5,A3:0.5,A3:0.5,C4:0.5,A3:0.5,G4:0.5,E4:0.5,D4:0.5,C4:0.5,' +
    'F4:0.5,F4:0.5,E4:0.5,D4:0.5,E4:0.5,D4:0.5,C4:0.5,B3:0.5,A3:0.5,C4:0.5,E4:0.5,A4:1,G4:1,E4:1,C4:1',
    'A2:1,A2:1,A2:1,A2:1,F2:1,F2:1,G2:1,G2:1,A2:1,A2:1,A2:1,A2:1,F2:1,G2:1,A2:1,A2:1'),
  boss: T(160, true,
    'D4:0.5,D4:0.5,F4:0.5,D4:0.5,A4:0.5,G4:0.5,F4:0.5,E4:0.5,D4:0.5,D4:0.5,F4:0.5,D4:0.5,B4:0.5,A4:0.5,G4:0.5,F4:0.5,' +
    'E4:0.5,E4:0.5,G4:0.5,E4:0.5,C5:0.5,B4:0.5,A4:0.5,G4:0.5,F4:1,E4:1,D4:1,C4:1,D4:2,R:1',
    'D2:1,D2:1,D2:1,D2:1,C2:1,C2:1,D2:1,D2:1,D2:1,D2:1,D2:1,D2:1,F2:1,C2:1,D2:1,D2:1'),
  victory: T(140, false,
    'G4:0.5,A4:0.5,B4:1,D5:1,G5:1.5,E5:0.5,D5:1,B4:1,G4:2',
    'G2:1,D3:1,G2:1,D3:1,G2:1,D3:1,G2:1,D3:1'),
};

class AudioSys {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true;
  private trackName = '';
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private melIdx = 0; private bassIdx = 0;
  private melTime = 0; private bassTime = 0;
  private noiseBuf: AudioBuffer | null = null;
  private sfxLast: Record<string, number> = {};

  ensure() {
    if (this.ctx) return;
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
    } catch { /* audio unavailable */ }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) { this.stopMusic(); return; }
    this.ensure();
  }

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

  private noise(t: number, dur: number, vol: number, freq: number) {
    if (!this.ctx || !this.master || !this.noiseBuf || !this.enabled) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1;
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
    // throttle identical sfx
    if (now - (this.sfxLast[name] ?? -1) < 0.03) return;
    this.sfxLast[name] = now;
    const t = now + 0.001;
    switch (name) {
      case 'blip': this.osc('square', 720, t, 0.05, 0.06); break;
      case 'confirm': this.osc('square', 880, t, 0.05, 0.06); this.osc('square', 1318, t + 0.05, 0.07, 0.06); break;
      case 'cancel': this.osc('square', 440, t, 0.05, 0.05); this.osc('square', 294, t + 0.05, 0.07, 0.05); break;
      case 'text': this.osc('square', 850 + Math.random() * 150, t, 0.018, 0.03); break;
      case 'hit': this.osc('square', 200, t, 0.08, 0.09, 90); this.noise(t, 0.06, 0.05, 900); break;
      case 'strong': this.osc('square', 150, t, 0.14, 0.11, 60); this.noise(t, 0.1, 0.07, 500); break;
      case 'fire': this.noise(t, 0.25, 0.09, 1600); this.osc('sawtooth', 300, t, 0.2, 0.04, 90); break;
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

  playMusic(name: string) {
    if (this.trackName === name) return;
    this.stopMusic();
    if (!TRACKS[name]) return;
    this.ensure();
    if (!this.ctx || !this.enabled) { this.trackName = name; return; }
    this.trackName = name;
    this.melIdx = 0; this.bassIdx = 0;
    this.melTime = this.ctx.currentTime + 0.05;
    this.bassTime = this.melTime;
    this.schedTimer = setInterval(() => this.schedule(), 90);
    this.schedule();
  }

  stopMusic() {
    if (this.schedTimer) clearInterval(this.schedTimer);
    this.schedTimer = null;
    this.trackName = '';
  }

  get currentTrack() { return this.trackName; }

  private schedule() {
    if (!this.ctx || !this.enabled || !this.trackName) return;
    const tr = TRACKS[this.trackName];
    if (!tr) return;
    const spb = 60 / tr.bpm;
    const horizon = this.ctx.currentTime + 0.25;
    let guard = 0;
    while (this.melTime < horizon && guard++ < 64) {
      const [note, beats] = tr.mel[this.melIdx];
      const dur = beats * spb;
      if (note) this.osc(tr.melWave || 'square', NOTE_FREQ[note] ?? 440, this.melTime, Math.max(0.05, dur * 0.9), 0.045);
      this.melTime += dur;
      this.melIdx++;
      if (this.melIdx >= tr.mel.length) {
        if (!tr.loop) { this.stopMusic(); return; }
        this.melIdx = 0;
      }
    }
    guard = 0;
    while (this.bassTime < horizon && guard++ < 64) {
      const [note, beats] = tr.bass[this.bassIdx];
      const dur = beats * spb;
      if (note) this.osc('triangle', NOTE_FREQ[note] ?? 110, this.bassTime, Math.max(0.05, dur * 0.95), 0.075);
      this.bassTime += dur;
      this.bassIdx++;
      if (this.bassIdx >= tr.bass.length) {
        if (!tr.loop) return;
        this.bassIdx = 0;
      }
    }
  }
}

export const audio = new AudioSys();
