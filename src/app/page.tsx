'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '@/game/engine';
import { audio } from '@/game/audio';

const KEYMAP: Record<string, string> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
  z: 'a', Z: 'a', ' ': 'a',
  x: 'b', X: 'b', Escape: 'b', Backspace: 'b',
  Enter: 'start',
  Shift: 'select',
};

function DPadButton({
  label, area, onDown, onUp, className = '',
}: {
  label: string;
  area: string;
  onDown: (b: string) => void;
  onUp: (b: string) => void;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      className={`absolute bg-zinc-800 select-none touch-none active:bg-black active:translate-y-[1px] ${className}`}
      style={{ gridArea: area }}
      onPointerDown={(e) => { e.preventDefault(); onDown(label); }}
      onPointerUp={() => onUp(label)}
      onPointerLeave={() => onUp(label)}
      onPointerCancel={() => onUp(label)}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = new Game();
    gameRef.current = game;
    // debug/testing hook
    (window as unknown as { __game?: Game }).__game = game;

    const down = (e: KeyboardEvent) => {
      const btn = KEYMAP[e.key];
      if (btn) {
        e.preventDefault();
        game.press(btn);
        if (btn === 'select') setSoundOn(audio.enabled);
      }
    };
    const up = (e: KeyboardEvent) => {
      const btn = KEYMAP[e.key];
      if (btn) { e.preventDefault(); game.release(btn); }
    };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(60, t - last);
      last = t;
      game.frame(dt, ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      audio.stopMusic();
      gameRef.current = null;
    };
  }, []);

  const press = useCallback((b: string) => {
    gameRef.current?.press(b);
    if (b === 'select') setSoundOn(audio.enabled);
  }, []);
  const release = useCallback((b: string) => {
    gameRef.current?.release(b);
  }, []);

  const btn = (b: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); press(b); },
    onPointerUp: () => release(b),
    onPointerLeave: () => release(b),
    onPointerCancel: () => release(b),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <main className="min-h-screen flex flex-col items-center bg-zinc-950 text-zinc-200 py-8 px-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% -10%, rgba(139,172,15,0.14), transparent 55%)' }}>
      {/* header */}
      <header className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-[#9bbc0f] drop-shadow-[0_0_12px_rgba(139,172,15,0.35)]">
          MONSTER SLAYER
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2">
          A Game Boy style witcher tale &middot; Dark fantasy RPG &middot; Green Edition
        </p>
      </header>

      {/* ============ THE DEVICE ============ */}
      <div className="w-full max-w-[430px]">
        <div className="rounded-t-2xl rounded-b-[34px] rounded-bl-[64px] bg-[#c8c4bb] shadow-[0_24px_60px_rgba(0,0,0,0.65),inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-4px_10px_rgba(0,0,0,0.12)] border border-[#b3aea4] p-4 pb-7">
          {/* screen bezel */}
          <div className="rounded-lg bg-[#454351] px-4 pt-3 pb-4 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] border-b-4 border-[#37353f]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#d5425a] shadow-[0_0_6px_rgba(213,66,90,0.9)]" />
                <span className="text-[7px] tracking-[0.18em] text-[#b7b4c2] font-semibold">BATTERY</span>
              </div>
              <span className="text-[7px] tracking-[0.14em] text-[#b7b4c2] font-semibold hidden sm:inline">
                DOT MATRIX WITH STEREO SOUND
              </span>
              <span className="text-[7px] text-[#b7b4c2] font-semibold">01</span>
            </div>
            <div className="rounded-[4px] overflow-hidden border-2 border-[#20202a] bg-[#0f380f]">
              <canvas
                ref={canvasRef}
                width={160}
                height={144}
                className="block w-full h-auto"
                style={{ imageRendering: 'pixelated', aspectRatio: '160 / 144' }}
                aria-label="Monster Slayer game screen"
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-[8px] text-[#8f8c9c] font-bold tracking-wider">SERPENTSOFT&#8482;</span>
              <span className="text-[8px] text-[#8f8c9c] tracking-wider">{soundOn ? '\u266A ON' : 'SOUND OFF'}</span>
            </div>
          </div>

          {/* brand line */}
          <div className="my-3 px-1 flex items-center gap-2">
            <span className="text-[13px] font-black italic text-[#37353f] tracking-tight">MONSTER SLAYER</span>
            <span className="text-[8px] text-[#6b675f] font-bold self-end pb-0.5">GREEN EDITION</span>
          </div>

          {/* controls row */}
          <div className="flex items-start justify-between mt-1 px-2">
            {/* D-PAD */}
            <div
              className="relative grid grid-cols-3 grid-rows-3 w-[104px] h-[104px] touch-none"
              style={{ gridTemplateAreas: `'. up .' 'left mid right' '. down .'` }}
            >
              <DPadButton label="up" area="up" onDown={press} onUp={release}
                className="rounded-t-md border border-black/40 [clip-path:polygon(14%_100%,86%_100%,100%_0,0_0)]" />
              <DPadButton label="down" area="down" onDown={press} onUp={release}
                className="rounded-b-md border border-black/40 [clip-path:polygon(0_100%,100%_100%,86%_0,14%_0)]" />
              <DPadButton label="left" area="left" onDown={press} onUp={release}
                className="rounded-l-md border border-black/40 [clip-path:polygon(0_0,100%_14%,100%_86%,0_100%)]" />
              <DPadButton label="right" area="right" onDown={press} onUp={release}
                className="rounded-r-md border border-black/40 [clip-path:polygon(100%_0,0_14%,0_86%,100%_100%)]" />
              <div className="rounded-full bg-zinc-800 border border-black/50 m-auto w-7 h-7 shadow-[inset_0_2px_3px_rgba(255,255,255,0.25)]"
                style={{ gridArea: 'mid' }} />
            </div>

            {/* A / B */}
            <div className="flex gap-5 -rotate-[22deg] translate-y-3 mr-1 select-none">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  aria-label="B button"
                  className="w-12 h-12 rounded-full bg-[#8b2f5f] border-b-4 border-[#5e1f40] active:border-b-0 active:translate-y-[3px] active:bg-[#7a2952] touch-none shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
                  {...btn('b')}
                >
                  <span className="text-[11px] font-bold text-[#5e1f40]">B</span>
                </button>
                <span className="text-[8px] font-bold text-[#6b675f]">RUN/BACK</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  aria-label="A button"
                  className="w-12 h-12 rounded-full bg-[#8b2f5f] border-b-4 border-[#5e1f40] active:border-b-0 active:translate-y-[3px] active:bg-[#7a2952] touch-none shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
                  {...btn('a')}
                >
                  <span className="text-[11px] font-bold text-[#5e1f40]">A</span>
                </button>
                <span className="text-[8px] font-bold text-[#6b675f]">TALK/OK</span>
              </div>
            </div>
          </div>

          {/* start/select */}
          <div className="flex justify-center gap-6 mt-6 -rotate-[22deg] select-none">
            <div className="flex flex-col items-center gap-1">
              <button aria-label="Select"
                className="w-14 h-4 rounded-full bg-[#8a8778] border-b-2 border-[#5f5d53] active:translate-y-[2px] touch-none"
                {...btn('select')} />
              <span className="text-[8px] font-bold text-[#6b675f] rotate-[22deg]">SELECT</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button aria-label="Start"
                className="w-14 h-4 rounded-full bg-[#8a8778] border-b-2 border-[#5f5d53] active:translate-y-[2px] touch-none"
                {...btn('start')} />
              <span className="text-[8px] font-bold text-[#6b675f] rotate-[22deg]">START</span>
            </div>
          </div>

          {/* speaker grille */}
          <div className="flex justify-end mt-4 pr-3" aria-hidden>
            <div className="grid grid-cols-2 gap-[7px] rotate-[-25deg]">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="block w-[26px] h-[4px] rounded-full bg-[#a5a198] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* controls legend */}
      <section className="w-full max-w-[430px] mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <h2 className="text-xs font-bold tracking-widest text-zinc-400 mb-3">WITCHER&apos;S MANUAL</h2>
        <ul className="space-y-1.5 text-[11px] text-zinc-400">
          <li><b className="text-zinc-200">Arrows / WASD</b> &mdash; move &middot; <b className="text-zinc-200">hold B</b> to run</li>
          <li><b className="text-zinc-200">Z / Space</b> &mdash; A: talk, confirm, read the board</li>
          <li><b className="text-zinc-200">X</b> &mdash; B: cancel &middot; <b className="text-zinc-200">Enter</b> &mdash; START: menu</li>
          <li><b className="text-zinc-200">Shift</b> &mdash; SELECT: sound on/off</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-zinc-800 text-[11px] text-zinc-500 leading-relaxed">
          Take contracts from the notice board. Steel cuts beasts, silver cuts monsters.
          Anoint blades with oils, brew potions (mind your toxicity), and mind the reeds &mdash; the tall grass of the Continent.
        </div>
      </section>

      <footer className="mt-6 text-[10px] text-zinc-600 text-center max-w-[430px]">
        A fan-made homage to The Witcher and classic monster-catching handhelds. Not affiliated with CD Projekt Red or Nintendo.
      </footer>
    </main>
  );
}
