import { PlanetRenderer, makeStars, fitCanvas, Star } from './planet';
import { drawText } from './font';
import { getAssets, Assets } from './art/assets';
import { Particles } from './particles';
import { audio } from './audio';
import { clamp, lerp } from './constants';

const CREDITS: [string, string][] = [
  ['LOST SIGNAL', 'title'],
  ['10 DAYS', 'sub'],
  ['', ''],
  ['A PIXEL-ART SURVIVAL STORY', 'head'],
  ['', ''],
  ['GAME DESIGN & CODE', 'head'],
  ['Built with Claude', 'name'],
  ['', ''],
  ['PIXEL ART', 'head'],
  ['Hand-coded, pixel by pixel', 'name'],
  ['', ''],
  ['MUSIC & SOUND', 'head'],
  ['Synthesized live with Web Audio', 'name'],
  ['', ''],
  ['STARRING', 'head'],
  ['The Captain', 'name'],
  ['B-07, Loyal Companion Robot', 'name'],
  ['The Creatures of Kepler-186f', 'name'],
  ['', ''],
  ['SPECIAL THANKS', 'head'],
  ['Everyone who answered the signal', 'name'],
  ['', ''],
  ['', ''],
  ['THANK YOU FOR PLAYING', 'title2'],
];

/** Ending cutscene: lift-off, departure, B-07's last line, credits. */
export class EndingScene {
  private ctx: CanvasRenderingContext2D;
  private W = 640;
  private H = 360;
  private t = 0;
  private raf = 0;
  private last = performance.now();
  private dead = false;
  private planet = new PlanetRenderer(90);
  private stars: Star[] = makeStars(240);
  private parts = new Particles();
  private assets: Assets = getAssets();
  finished = false;

  constructor(private canvas: HTMLCanvasElement, private onFinished: () => void) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    audio.setMusic('ending');
    audio.setAmbient(0, 0);
    this.raf = requestAnimationFrame(this.frame);
  }

  resize(): void {
    const s = fitCanvas(this.canvas, 360, 480, 860);
    this.W = s.W;
    this.H = s.H;
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    if (this.dead) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    this.parts.update(dt);
    this.draw();
    if (!this.finished && this.t > 50) { this.finished = true; this.onFinished(); }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(): void {
    const { ctx, W, H, t } = this;
    ctx.imageSmoothingEnabled = false;
    if (t < 7) this.liftoff(t);
    else if (t < 15) this.departure(t);
    else this.credits(t);
    if (t < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - t})`; ctx.fillRect(0, 0, W, H); }
    for (const edge of [7, 15]) if (Math.abs(t - edge) < 0.5) { ctx.fillStyle = `rgba(0,0,0,${1 - Math.abs(t - edge) / 0.5})`; ctx.fillRect(0, 0, W, H); }
  }

  private liftoff(t: number): void {
    const { ctx, W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c2a78');
    g.addColorStop(1, '#ffb08a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(this.assets.skyPlanet, Math.round(W * 0.08), 30);
    ctx.globalAlpha = 1;
    this.assets.mountains.forEach((layer, i) => {
      const y = H - 180 + i * 26;
      for (let x = -((i * 200) % layer.width); x < W; x += layer.width) ctx.drawImage(layer, Math.round(x), y);
      ctx.fillStyle = ['#2b2357', '#1f1942', '#151130'][i];
      ctx.fillRect(0, y + layer.height - 1, W, H);
    });
    // peak silhouette with the beacon
    ctx.fillStyle = '#0d0a1f';
    ctx.beginPath();
    ctx.moveTo(W * 0.35, H);
    ctx.lineTo(W * 0.48, H - 90);
    ctx.lineTo(W * 0.58, H - 90);
    ctx.lineTo(W * 0.72, H);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(111,243,255,0.3)';
    ctx.fillRect(Math.round(W * 0.5), 0, 3, H - 104);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.assets.beaconOn, Math.round(W * 0.5 - 26), H - 90 - 44);
    // shuttle lifts off
    const k = clamp((t - 1.5) / 5, 0, 1);
    const sx = W * 0.53 - 36 + k * k * 120;
    const sy = H - 90 - 40 - k * k * (H + 60) + (t < 1.5 ? Math.sin(t * 10) : 0);
    if (t > 1) {
      for (let i = 0; i < 3; i++) this.parts.add({ x: sx + 16 + Math.random() * 40, y: sy + 40, vx: (Math.random() - 0.5) * 40, vy: 80 + Math.random() * 80, max: 0.7, color: ['#ffe08a', '#ff9b3d', '#6ff3ff'][i], glow: true, fade: true, size: 2 });
      if (k < 0.3) for (let i = 0; i < 3; i++) this.parts.add({ x: W * 0.53 + (Math.random() - 0.5) * 80, y: H - 92, vx: (Math.random() - 0.5) * 120, vy: -10 - Math.random() * 20, max: 1.5, color: '#8a7aa8', fade: true, size: 3 });
    }
    this.parts.draw(ctx, 0, 0);
    ctx.drawImage(this.assets.shuttle, Math.round(sx), Math.round(sy));
    if (t > 0.5 && t < 1.6) this.cue('lift', () => audio.play('rumble'));
    drawText(ctx, 'DAY 10 - RESCUE', W / 2, 24, { align: 'center', scale: 2, color: '#ffe08a', alpha: clamp(t - 1, 0, 1) });
  }

  private cues = new Set<string>();
  private cue(n: string, fn: () => void): void {
    if (!this.cues.has(n)) { this.cues.add(n); fn(); }
  }

  private departure(t: number): void {
    const { ctx, W, H } = this;
    const k = (t - 7) / 8;
    ctx.fillStyle = '#04020c';
    ctx.fillRect(0, 0, W, H);
    for (const s of this.stars) {
      const x = ((s.x - t * 0.01 * s.z) % 1 + 1) % 1;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.tw);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x * W), Math.round(s.y * H), s.z === 3 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
    const pc = this.planet.render(t * 0.01);
    const ps = lerp(2.2, 0.9, k);
    const pw = pc.width * ps;
    ctx.drawImage(pc, Math.round(W * 0.28 - pw / 2), Math.round(H * 0.55 - pw / 2), Math.round(pw), Math.round(pw));
    const sx = lerp(W * 0.45, W * 0.9, k), sy = lerp(H * 0.55, H * 0.35, k);
    if (Math.random() < 0.9) this.parts.add({ x: sx, y: sy + 4, vx: -60, vy: 10, max: 0.6, color: '#6ff3ff', glow: true, fade: true, size: 2 });
    this.parts.draw(ctx, 0, 0);
    const sc = lerp(0.5, 0.25, k);
    const sh = this.assets.shuttle;
    ctx.drawImage(sh, Math.round(sx - (sh.width * sc) / 2), Math.round(sy - (sh.height * sc) / 2), Math.round(sh.width * sc), Math.round(sh.height * sc));
    drawText(ctx, 'THE CAPTAIN IS GOING HOME.', W / 2, H - 46, { align: 'center', scale: 2, color: '#e8e6f2', alpha: clamp(t - 8, 0, 1) });
    if (t > 10.5) {
      const line = 'B-07: "Captain... do you think anyone else heard the signal?"';
      const n = Math.floor(clamp((t - 10.5) * 22, 0, line.length));
      drawText(ctx, line.slice(0, n), W / 2, H - 24, { align: 'center', color: '#43d9ff' });
    }
  }

  private credits(t: number): void {
    const { ctx, W, H } = this;
    ctx.fillStyle = '#04020c';
    ctx.fillRect(0, 0, W, H);
    for (const s of this.stars) {
      const y = ((s.y + t * 0.01 * s.z) % 1 + 1) % 1;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(s.x * W), Math.round(y * H), 1, 1);
    }
    ctx.globalAlpha = 1;
    const scroll = (t - 15) * 26;
    const lastY = H + (CREDITS.length - 1) * 22 - scroll;
    const stop = lastY < H / 2;
    CREDITS.forEach(([text, kind], i) => {
      let y = H + i * 22 - scroll;
      if (stop) y += H / 2 - lastY;
      if (y < -30 || y > H + 30) return;
      const style = kind === 'title' ? { scale: 4, color: '#f2ecff' } : kind === 'sub' ? { scale: 2, color: '#43d9ff' }
        : kind === 'head' ? { scale: 1, color: '#ffe08a' } : kind === 'title2' ? { scale: 2, color: '#ffe08a' } : { scale: 1, color: '#c8c3e8' };
      drawText(ctx, text, W / 2, Math.round(y), { align: 'center', ...style });
    });
    if (stop && !this.finished) { this.finished = true; this.onFinished(); }
  }
}
