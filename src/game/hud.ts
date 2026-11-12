import { drawText, wrap, measure } from './font';
import { ITEMS } from './items';
import { clamp } from './constants';
import type { Game } from './Game';

export interface Line {
  speaker: string;
  text: string;
  t: number;
  dur: number;
  blocking: boolean;
}

interface Banner {
  text: string;
  sub?: string;
  t: number;
  dur: number;
  color: string;
}

interface Toast {
  text: string;
  icon?: string;
  t: number;
}

export class Hud {
  queue: Line[] = [];
  banners: Banner[] = [];
  toasts: Toast[] = [];
  prompt: string | null = null;
  progress: number | null = null;
  objFlash = 0;

  say(text: string, speaker = 'B-07', blocking = false): void {
    // skip exact duplicates already queued
    if (this.queue.some((l) => l.text === text)) return;
    // keep B-07 current: drop stale, not-yet-shown hints when the queue backs up
    while (this.queue.length >= 4) {
      const i = this.queue.findIndex((l, k) => k > 0 && !l.blocking);
      if (i < 0) break;
      this.queue.splice(i, 1);
    }
    this.queue.push({ speaker, text, t: 0, dur: 2.4 + text.length * 0.045, blocking });
  }

  banner(text: string, sub?: string, dur = 3.2, color = '#ffffff'): void {
    if (this.banners.length >= 2) this.banners.splice(1);
    this.banners.push({ text, sub, t: 0, dur, color });
  }

  toast(text: string, icon?: string): void {
    const ex = this.toasts.find((t) => t.icon === icon && icon && t.t < 1.5);
    if (ex && icon) {
      const m = ex.text.match(/^\+(\d+) (.*)$/);
      const m2 = text.match(/^\+(\d+) (.*)$/);
      if (m && m2 && m[2] === m2[2]) { ex.text = `+${Number(m[1]) + Number(m2[1])} ${m[2]}`; ex.t = 0; return; }
    }
    this.toasts.push({ text, icon, t: 0 });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  get blocking(): boolean {
    return this.queue.length > 0 && this.queue[0].blocking;
  }

  advance(): void {
    const l = this.queue[0];
    if (!l) return;
    const shown = Math.floor(l.t * 45);
    if (shown < l.text.length) l.t = l.text.length / 45 + 0.01;
    else this.queue.shift();
  }

  update(dt: number): void {
    const l = this.queue[0];
    if (l) {
      l.t += dt;
      if (!l.blocking && l.t > l.dur) this.queue.shift();
      if (l.blocking && l.t > l.dur + 4) this.queue.shift();
    }
    if (this.banners.length) {
      this.banners[0].t += dt;
      if (this.banners[0].t > this.banners[0].dur) this.banners.shift();
    }
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 2.6);
    this.objFlash = Math.max(0, this.objFlash - dt);
  }

  draw(g: Game, ctx: CanvasRenderingContext2D): void {
    const W = g.W, H = g.H;
    const p = g.player;
    const a = g.assets;
    if (!g.hudHidden) {
      // ---------- top-left: day + stats ----------
      panel(ctx, 6, 6, 140, 70);
      const isNight = g.isNight();
      drawText(ctx, `DAY ${Math.min(g.story.day, 10)}/10`, 12, 11, { color: '#ffe08a', scale: 1 });
      // sun / moon icon
      ctx.fillStyle = isNight ? '#c9e6ff' : '#ffd36b';
      ctx.fillRect(74, 11, 6, 6);
      if (isNight) { ctx.fillStyle = '#1a1433'; ctx.fillRect(77, 10, 4, 4); }
      drawText(ctx, g.clockText(), 86, 11, { color: '#c8c3e8' });
      // day progress bar
      ctx.fillStyle = '#120e22';
      ctx.fillRect(12, 21, 128, 2);
      ctx.fillStyle = isNight ? '#6a5acd' : '#ffd36b';
      ctx.fillRect(12, 21, Math.round(128 * g.time), 2);
      bar(ctx, 12, 28, 'HP', p.hp / 100, '#ff4d6d', '#5a1626');
      bar(ctx, 12, 39, 'O2', p.o2 / p.maxO2, '#43d9ff', '#123c4f', p.o2 / p.maxO2 < 0.25 && Math.floor(g.elapsed * 4) % 2 === 0);
      bar(ctx, 12, 50, 'FOOD', p.hunger / 100, '#ffa53d', '#4f2e12', p.hunger < 20 && Math.floor(g.elapsed * 3) % 2 === 0);
      bar(ctx, 12, 61, 'NRG', p.energy / 100, '#f5e663', '#4a4512');
      if (g.oxygenZone) drawText(ctx, '+O2', 116, 39, { color: '#9ef0ff' });
      if (g.sheltered) drawText(ctx, 'SAFE', 116, 61, { color: '#3dff8a' });

      // ---------- top-right: mission ----------
      const def = g.story.def;
      const lines: { text: string; done: boolean; current: boolean }[] = [];
      def.objectives.forEach((o, i) => {
        const done = i < g.story.objIndex || g.story.dayComplete;
        lines.push({ text: o.text(g), done, current: i === g.story.objIndex && !g.story.dayComplete });
      });
      const wrapped: { t: string; done: boolean; current: boolean; first: boolean }[] = [];
      for (const l of lines) wrap(l.text, 31).forEach((w, j) => wrapped.push({ t: w, done: l.done, current: l.current, first: j === 0 }));
      const pw = 214;
      const ph = 22 + wrapped.length * 10 + (g.story.dayComplete ? 12 : 0);
      const px0 = W - pw - 6;
      panel(ctx, px0, 6, pw, ph, g.objFlashColor());
      drawText(ctx, def.mission, px0 + 6, 11, { color: '#ffe08a' });
      wrapped.forEach((l, i) => {
        const y = 24 + i * 10;
        if (l.first) {
          ctx.fillStyle = l.done ? '#3dff8a' : l.current ? '#ffffff' : '#5c5680';
          ctx.fillRect(px0 + 7, y + 1, 5, 5);
          if (!l.done) { ctx.fillStyle = '#1a1433'; ctx.fillRect(px0 + 8, y + 2, 3, 3); }
        }
        drawText(ctx, l.t, px0 + 16, y, { color: l.done ? '#6fae8a' : l.current ? '#ffffff' : '#7d76a8' });
      });
      if (g.story.dayComplete) {
        const nightText = g.story.day >= 10 ? '' : g.isNight() ? 'DAY COMPLETE - SLEEP OR WAIT FOR DAWN' : 'DAY COMPLETE - SURVIVE UNTIL DAWN';
        drawText(ctx, nightText, px0 + 6, 24 + wrapped.length * 10 + 2, { color: '#3dff8a' });
      }

      // ---------- hotbar ----------
      const slots = 9, sw = 22;
      const hx = Math.round(W / 2 - (slots * sw) / 2);
      const hy = H - 30;
      for (let i = 0; i < slots; i++) {
        const s = g.inv.slots[i];
        const x = hx + i * sw;
        const sel = i === g.inv.selected;
        ctx.fillStyle = sel ? '#ffe08a' : '#120e22';
        ctx.fillRect(x, hy, sw - 2, sw - 2);
        ctx.fillStyle = sel ? '#3a2f6b' : 'rgba(30,24,60,0.85)';
        ctx.fillRect(x + 1, hy + 1, sw - 4, sw - 4);
        if (s) {
          ctx.drawImage(a.icons[s.id], x + 2, hy + 2);
          if (s.count > 1) drawText(ctx, String(s.count), x + sw - 3, hy + sw - 9, { align: 'right', color: '#ffffff' });
        }
        drawText(ctx, String(i + 1), x + 2, hy - 1, { color: sel ? '#ffe08a' : '#6d6699', shadow: null });
      }
      const sel = g.inv.selectedItem();
      if (sel) drawText(ctx, ITEMS[sel.id].name, W / 2, hy - 11, { align: 'center', color: '#e8e6f2' });

      // ---------- toasts ----------
      this.toasts.forEach((t, i) => {
        const y = H - 48 - i * 12 - Math.min(8, t.t * 20);
        const alpha = t.t > 2 ? 1 - (t.t - 2) / 0.6 : 1;
        ctx.globalAlpha = clamp(alpha, 0, 1);
        if (t.icon && a.icons[t.icon]) ctx.drawImage(a.icons[t.icon], 8, y - 5);
        drawText(ctx, t.text, 28, y, { color: '#e8ffe8' });
        ctx.globalAlpha = 1;
      });

      // ---------- prompt / progress ----------
      if (this.prompt && !this.blocking) {
        const tw = measure(this.prompt) + 10;
        const x = Math.round(W / 2 - tw / 2), y = H - 66;
        panel(ctx, x, y, tw, 14);
        drawText(ctx, this.prompt, W / 2, y + 4, { align: 'center', color: '#ffe08a' });
      }
      if (this.progress !== null) {
        const x = Math.round(W / 2 - 40), y = H - 78;
        ctx.fillStyle = '#120e22'; ctx.fillRect(x, y, 80, 6);
        ctx.fillStyle = '#43d9ff'; ctx.fillRect(x + 1, y + 1, Math.round(78 * this.progress), 4);
      }
    }

    // ---------- dialogue ----------
    const l = this.queue[0];
    if (l) {
      const bw = Math.min(420, W - 40), bh = 46;
      const bx = Math.round(W / 2 - bw / 2), by = g.hudHidden ? H - bh - 22 : H - bh - 74;
      panel(ctx, bx, by, bw, bh, '#43d9ff');
      if (l.speaker === 'B-07') ctx.drawImage(a.portrait, bx + 6, by + 9);
      const tx = l.speaker === 'B-07' ? bx + 40 : bx + 10;
      drawText(ctx, l.speaker, tx, by + 6, { color: l.speaker === 'B-07' ? '#43d9ff' : '#ffe08a' });
      const shown = l.text.slice(0, Math.floor(l.t * 45));
      const maxChars = Math.floor((bw - (tx - bx) - 8) / 6);
      wrap(shown, maxChars).slice(0, 3).forEach((ln, i) => drawText(ctx, ln, tx, by + 17 + i * 9, { color: '#e8e6f2' }));
      if (l.blocking && shown.length >= l.text.length && Math.floor(g.elapsed * 2) % 2 === 0) {
        drawText(ctx, 'SPACE >', bx + bw - 8, by + bh - 10, { align: 'right', color: '#ffe08a' });
      }
    }

    // ---------- banners ----------
    const b = this.banners[0];
    if (b) {
      const k = b.t < 0.4 ? b.t / 0.4 : b.t > b.dur - 0.5 ? (b.dur - b.t) / 0.5 : 1;
      ctx.globalAlpha = clamp(k, 0, 1);
      const y = Math.round(H * 0.32);
      ctx.fillStyle = 'rgba(8,5,20,0.55)';
      ctx.fillRect(0, y - 10, W, b.sub ? 52 : 36);
      ctx.fillStyle = '#43d9ff';
      ctx.fillRect(0, y - 10, W, 1);
      ctx.fillRect(0, y + (b.sub ? 41 : 25), W, 1);
      const sc = measure(b.text, 3) > W - 20 ? 2 : 3;
      drawText(ctx, b.text, W / 2, y, { align: 'center', scale: sc, color: b.color, shadow: '#1b0f3a' });
      if (b.sub) drawText(ctx, b.sub, W / 2, y + 28, { align: 'center', scale: 1, color: '#ffe08a' });
      ctx.globalAlpha = 1;
    }
  }
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent = '#5a4a9a'): void {
  ctx.fillStyle = '#0b0816';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = 'rgba(22,16,46,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y + 1, w, 1);
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, v: number, col: string, bg: string, blink = false): void {
  drawText(ctx, label, x, y, { color: blink ? '#ffffff' : '#a8a0d0' });
  const bx = x + 28, w = 70;
  ctx.fillStyle = '#0b0816';
  ctx.fillRect(bx - 1, y - 1, w + 2, 9);
  ctx.fillStyle = bg;
  ctx.fillRect(bx, y, w, 7);
  const fw = Math.round(w * clamp(v, 0, 1));
  ctx.fillStyle = blink ? '#ffffff' : col;
  ctx.fillRect(bx, y, fw, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(bx, y, fw, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 10; i < w; i += 10) ctx.fillRect(bx + i, y, 1, 7);
}
