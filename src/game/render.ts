// ============================================================
// Render helpers: GB windows, text, bars, menus
// ============================================================
import { PAL, C } from './constants';
import { drawText, textWidth, GLYPH_H } from './font';

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Classic GB window: paper fill + ink border + inner accent line */
export function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  px(ctx, x, y, w, h, C.INK);
  px(ctx, x + 1, y + 1, w - 2, h - 2, C.PAPER);
  // subtle inner accent (dotted)
  ctx.fillStyle = C.LIGHT;
  for (let i = x + 3; i < x + w - 3; i += 2) ctx.fillRect(i, y + 2, 1, 1);
  for (let i = x + 3; i < x + w - 3; i += 2) ctx.fillRect(i, y + h - 3, 1, 1);
}

/** dark window (menus on world) */
export function drawDarkWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  px(ctx, x, y, w, h, C.INK);
  px(ctx, x + 1, y + 1, w - 2, h - 2, C.DARK);
  ctx.fillStyle = C.LIGHT;
  for (let i = x + 3; i < x + w - 3; i += 2) ctx.fillRect(i, y + 2, 1, 1);
}

export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, color: string = C.INK) {
  drawText(ctx, '►', x, y, color);
}

/** Right-aligned single line of text; `rightX` is the last pixel column used. */
export function drawTextRight(ctx: CanvasRenderingContext2D, text: string, rightX: number, y: number, color: string = PAL[0]) {
  drawText(ctx, text, rightX - textWidth(text), y, color);
}

export function drawContinue(ctx: CanvasRenderingContext2D, x: number, y: number, visible: boolean) {
  if (visible) drawText(ctx, '▼', x, y, C.INK);
}

/** HP bar with frame. Label is drawn to the LEFT of the bar, vertically
 *  centered, so glyphs are never overdrawn by the bar fill. */
export function drawBar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number,
  label?: string,
) {
  let bx = x;
  let bw = w;
  if (label) {
    drawText(ctx, label, x, y, C.INK);
    bx = x + textWidth(label) + 4;
    bw = w - (bx - x);
  }
  px(ctx, bx, y, bw, 7, C.INK);
  px(ctx, bx + 1, y + 1, bw - 2, 5, C.PAPER);
  const r = Math.max(0, Math.min(1, ratio));
  const fw = Math.round((bw - 4) * r);
  if (fw > 0) {
    const color = r > 0.5 ? C.DARK : r > 0.25 ? C.LIGHT : C.INK;
    px(ctx, bx + 2, y + 2, fw, 3, color);
  }
}

/** menu list inside a window */
export function drawMenuList(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  items: string[], index: number, opts: { dark?: boolean; rowH?: number } = {},
) {
  if (opts.dark) drawDarkWindow(ctx, x, y, w, h);
  else drawWindow(ctx, x, y, w, h);
  const rh = opts.rowH ?? 11;
  items.forEach((it, i) => {
    const iy = y + 5 + i * rh;
    const color = opts.dark ? C.PAPER : C.INK;
    if (i === index) drawCursor(ctx, x + 5, iy, color);
    drawText(ctx, it, x + 13, iy, color);
  });
}

/** big title text: draws each glyph then pixel-doubles via temp canvas */
export function drawTitleText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, k: number, color: string) {
  const w = (text.length * 6 - 1) * k;
  let x = Math.round(cx - w / 2);
  for (const ch of text) {
    const cv = document.createElement('canvas');
    cv.width = 5; cv.height = 7;
    const g = cv.getContext('2d')!;
    drawText(g, ch, 0, 0, color);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, 0, 0, 5, 7, x, y, 5 * k, 7 * k);
    x += 6 * k;
  }
}

/** word count helper */
export function lineH() {
  return GLYPH_H + 3;
}
