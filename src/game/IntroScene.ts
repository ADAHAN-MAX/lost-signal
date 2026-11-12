import { PlanetRenderer, makeStars, fitCanvas, Star } from './planet';
import { drawText } from './font';
import { getAssets, Assets } from './art/assets';
import { Particles } from './particles';
import { audio } from './audio';
import { clamp, lerp } from './constants';

const DURATION = 19.5;

/** In-engine animated introduction (about 19 seconds). */
export class IntroScene {
  private ctx: CanvasRenderingContext2D;
  private W = 640;
  private H = 360;
  private t = 0;
  private raf = 0;
  private last = performance.now();
  private dead = false;
  private done = false;
  private planet = new PlanetRenderer(90);
  private stars: Star[] = makeStars(260);
  private parts = new Particles();
  private assets: Assets = getAssets();
  private cues = new Set<string>();
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(private canvas: HTMLCanvasElement, private onDone: () => void) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    audio.setMusic('intro');
    this.keyHandler = (e: KeyboardEvent) => { if (['Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); this.skip(); } };
    window.addEventListener('keydown', this.keyHandler);
    this.raf = requestAnimationFrame(this.frame);
  }

  resize(): void {
    const s = fitCanvas(this.canvas, 360, 480, 860);
    this.W = s.W;
    this.H = s.H;
  }

  skip(): void {
    if (this.done) return;
    this.done = true;
    audio.play('click');
    this.onDone();
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.keyHandler);
  }

  private cue(name: string, at: number, fn: () => void): void {
    if (this.t >= at && !this.cues.has(name)) { this.cues.add(name); fn(); }
  }

  private frame = (now: number) => {
    if (this.dead) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    this.parts.update(dt);
    this.draw();
    if (this.t >= DURATION && !this.done) { this.done = true; this.onDone(); }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(): void {
    const { ctx, W, H, t } = this;
    ctx.imageSmoothingEnabled = false;
    // cues
    this.cue('alarm', 5.0, () => audio.play('alarm'));
    this.cue('boom1', 6.8, () => { audio.play('explosion'); });
    this.cue('whoosh', 10.2, () => audio.play('whoosh'));
    this.cue('rumble', 11.5, () => audio.play('rumble'));
    this.cue('impact', 13.8, () => { audio.play('explosion'); audio.play('thunder'); });
    this.cue('music', 15, () => audio.setMusic('none'));

    let shake = 0;
    if (t > 5 && t < 10) shake = 1 + (t - 5) * 0.4;
    if (t > 10 && t < 13.8) shake = 2;
    if (t > 13.8 && t < 15) shake = 6 * (1 - (t - 13.8) / 1.2);
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));

    if (t < 10) this.drawSpace(t);
    else if (t < 15) this.drawEntry(t);
    else { ctx.fillStyle = '#000'; ctx.fillRect(-10, -10, W + 20, H + 20); }
    ctx.restore();

    // letterbox
    const lb = 30;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, lb);
    ctx.fillRect(0, H - lb, W, lb);

    // captions
    if (t < 5) {
      const s = 'YEAR 2187.';
      const n = Math.floor(clamp((t - 0.6) * 8, 0, s.length));
      drawText(ctx, s.slice(0, n), 24, H - 22, { scale: 2, color: '#e8e6f2' });
      if (t > 2.2) drawText(ctx, 'CARGO TRANSPORT ARES-7  //  APPROACHING KEPLER-186F', W - 16, 12, { align: 'right', color: '#8f88c0', alpha: clamp((t - 2.2) * 2, 0, 1) });
    } else if (t < 10) {
      if (Math.floor(t * 3) % 2 === 0) drawText(ctx, 'WARNING: NAVIGATION OVERRIDE', W / 2, H - 22, { align: 'center', scale: 2, color: '#ff3d56' });
      drawText(ctx, 'AUTOPILOT LOCKED ON UNKNOWN SIGNAL', W / 2, 12, { align: 'center', color: '#ff9b9b' });
    } else if (t < 15) {
      drawText(ctx, 'HULL TEMPERATURE CRITICAL', W / 2, 12, { align: 'center', color: '#ffb347', alpha: t < 13.8 ? 1 : 0 });
    } else {
      const s = '10 DAYS UNTIL RESCUE...';
      const n = Math.floor(clamp((t - 15.6) * 10, 0, s.length));
      const a = t > 18.6 ? 1 - (t - 18.6) / 0.9 : 1;
      drawText(ctx, s.slice(0, n), W / 2, H / 2 - 12, { align: 'center', scale: 3, color: '#ffe08a', alpha: clamp(a, 0, 1), shadow: '#3a2a00' });
    }

    // flash and fades
    if (t < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - t})`; ctx.fillRect(0, 0, W, H); }
    if (t > 13.8 && t < 15) {
      const k = (t - 13.8) / 1.2;
      ctx.fillStyle = k < 0.35 ? `rgba(255,255,255,${1 - k * 0.5})` : `rgba(${255 * (1 - k)},${255 * (1 - k)},${255 * (1 - k)},1)`;
      ctx.fillRect(0, 0, W, H);
    }
    if (t > 9.6 && t < 10.4) { ctx.fillStyle = `rgba(0,0,0,${1 - Math.abs(t - 10) / 0.4})`; ctx.fillRect(0, 0, W, H); }
  }

  private drawSpace(t: number): void {
    const { ctx, W, H } = this;
    ctx.fillStyle = '#04020c';
    ctx.fillRect(-10, -10, W + 20, H + 20);
    // cinematic slow push-in
    const zoom = 1 + t * 0.03;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    for (const s of this.stars) {
      const speed = t > 5 ? 0.02 + (t - 5) * 0.01 : 0.012;
      const x = ((s.x - t * speed * s.z) % 1 + 1) % 1;
      ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + s.tw));
      ctx.fillStyle = s.z === 3 ? '#c8e6ff' : '#ffffff';
      ctx.fillRect(Math.round(x * W), Math.round(s.y * H), s.z === 3 ? 2 : 1, 1);
      if (t > 6) ctx.fillRect(Math.round(x * W), Math.round(s.y * H), Math.round((t - 6) * s.z * 2), 1);
    }
    ctx.globalAlpha = 1;
    // planet growing on the right
    const pc = this.planet.render(t * 0.01);
    const ps = 1 + t * 0.06;
    const pw = pc.width * ps;
    ctx.drawImage(pc, Math.round(W * 0.72 - pw / 2 + (t > 5 ? -(t - 5) * 6 : 0)), Math.round(H * 0.5 - pw / 2), Math.round(pw), Math.round(pw));
    ctx.restore();

    // the ship
    const ship = this.assets.flyingShip;
    let x = lerp(-70, W * 0.32, clamp(t / 5, 0, 1));
    let y = H * 0.48 + Math.sin(t * 1.5) * 3;
    let rot = 0;
    if (t > 5) {
      const k = (t - 5) / 5;
      x = W * 0.32 + k * k * W * 0.4 + Math.sin(t * 30) * 1.5;
      y = H * 0.48 + k * k * 40;
      rot = Math.sin(t * 6) * 0.08 + k * 0.6;
    }
    // engine glow / exhaust
    if (Math.random() < 0.8) this.parts.add({ x: x - 30 + (t > 6.8 ? Math.random() * 12 : 0), y: y + 1 + (Math.random() - 0.5) * 3, vx: -90 - Math.random() * 30, vy: (Math.random() - 0.5) * 10, max: 0.5, color: t > 6.8 ? '#ff7a3d' : '#6ff3ff', glow: true, fade: true, size: 2 });
    if (t > 6.8) {
      if (Math.random() < 0.7) this.parts.add({ x: x - 4, y: y - 4, vx: -40 - Math.random() * 40, vy: -10 + Math.random() * 20, max: 1.4, color: Math.random() < 0.5 ? '#3a3552' : '#5a5070', fade: true, size: 3 });
      if (Math.random() < 0.3) this.parts.burst(x + (Math.random() - 0.5) * 30, y, '#ffcc66', 3, 80, { glow: true, grav: 0 });
    }
    if (t > 6.8 && t < 7.2) this.parts.burst(x - 10, y, '#ffb347', 20, 160, { glow: true, grav: 0 });
    this.parts.draw(ctx, 0, 0);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    ctx.drawImage(ship, -32, -13);
    ctx.restore();
    // red alert wash
    if (t > 5) {
      const a = (0.5 + 0.5 * Math.sin(t * 9)) * 0.28;
      ctx.fillStyle = `rgba(255,30,60,${a})`;
      ctx.fillRect(0, 0, W, H);
      // warning beacon lights in corners
      ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ff3d56' : '#5a0d1a';
      ctx.fillRect(8, 38, 10, 4);
      ctx.fillRect(W - 18, 38, 10, 4);
    }
  }

  private drawEntry(t: number): void {
    const { ctx, W, H } = this;
    const k = (t - 10) / 3.8; // 0..1 until impact
    // alien sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1048');
    g.addColorStop(0.7, '#7a3f9a');
    g.addColorStop(1, '#ff8a6b');
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    // camera pans down as the ship descends
    const camY = lerp(-60, 30, clamp(k, 0, 1));
    ctx.drawImage(this.assets.skyPlanet, Math.round(W * 0.6), Math.round(30 - camY * 0.2));
    const m = this.assets.mountains;
    m.forEach((layer, i) => {
      const y = Math.round(H - 200 + i * 30 - camY * (0.4 + i * 0.3) + 40);
      const ox = -((t * 10 * (i + 1)) % layer.width);
      for (let x = ox; x < W; x += layer.width) ctx.drawImage(layer, Math.round(x), y);
      ctx.fillStyle = ['#2b2357', '#1f1942', '#151130'][i];
      ctx.fillRect(0, y + layer.height - 1, W, H);
    });
    if (t < 13.8) {
      const sx = lerp(-40, W * 0.62, k);
      const sy = lerp(20, H * 0.66, k * k) - camY * 0.3;
      for (let i = 0; i < 4; i++) {
        this.parts.add({ x: sx + (Math.random() - 0.5) * 6, y: sy + (Math.random() - 0.5) * 6, vx: -60 - Math.random() * 40, vy: -30 - Math.random() * 30, max: 0.9, color: ['#ffe08a', '#ff9b3d', '#ff5a2d', '#4d3a5a'][i], glow: i < 3, fade: true, size: i === 3 ? 3 : 2 });
      }
      this.parts.draw(ctx, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.assets.glow.warm, Math.round(sx - 48), Math.round(sy - 48));
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff6d0';
      ctx.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 5, 4);
    } else {
      this.parts.draw(ctx, 0, 0);
    }
  }
}
