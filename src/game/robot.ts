import type { Game } from './Game';

export class Robot {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  t = 0;
  blinkT = 2;
  scanT = 0;
  active = true;
  bootT = 1; // 0 = offline, 1 = fully active
  target: { x: number; y: number } | null = null;

  update(g: Game, dt: number): void {
    this.t += dt;
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    this.scanT = Math.max(0, this.scanT - dt);
    if (!this.active) {
      this.vy += 400 * dt;
      this.y += this.vy * dt;
      const gy = g.world.groundY(Math.floor(this.x / 16)) * 16 - 6;
      if (this.y > gy) { this.y = gy; this.vy = 0; }
      return;
    }
    const p = g.player;
    const tx = this.target ? this.target.x : p.cx - p.facing * 20;
    const ty = this.target ? this.target.y : p.body.y - 10 + Math.sin(this.t * 2.2) * 3;
    const dx = tx - this.x, dy = ty - this.y;
    // critically damped follow
    const k = 9, d = 5.5;
    this.vx += (dx * k - this.vx * d) * dt;
    this.vy += (dy * k - this.vy * d) * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 260) { this.vx *= 260 / sp; this.vy *= 260 / sp; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 8) this.facing = this.vx > 0 ? 1 : -1;
    else this.facing = p.cx > this.x ? 1 : -1;
    if (Math.random() < dt * 4) g.particles.add({ x: this.x + (Math.random() - 0.5) * 2, y: this.y + 7, vy: 25, vx: (Math.random() - 0.5) * 10, max: 0.3, color: '#ff9b3d', glow: true, fade: true });
  }

  scan(): void {
    this.scanT = 1.6;
  }

  draw(g: Game, ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const frames = this.facing === 1 ? g.assets.robot : g.assets.robotL;
    const blink = this.blinkT < 0 || (!this.active) ? 1 : 0;
    const flame = Math.floor(this.t * 12) % 2;
    const bob = this.active ? Math.round(Math.sin(this.t * 3) * 1) : 0;
    const x = Math.round(this.x - 7 - camX), y = Math.round(this.y - 7 - camY + bob);
    if (!this.active || this.bootT < 1) {
      // booting flicker
      if (this.bootT > 0 && Math.random() < 0.5) ctx.globalAlpha = 0.6;
    }
    const img = frames[blink * 2 + (this.active ? flame : 0)];
    ctx.drawImage(img, x, y);
    ctx.globalAlpha = 1;
    // antenna light (alternating blink)
    if (this.active || this.bootT > 0) {
      const on = Math.floor(this.t * 2) % 2 === 0;
      ctx.fillStyle = this.scanT > 0 ? '#43d9ff' : on ? '#ff3d6e' : '#3dff8a';
      ctx.fillRect(x + (this.facing === 1 ? 6 : 7), y, 1, 1);
    }
    if (this.scanT > 0) {
      const sweep = Math.sin((1.6 - this.scanT) * 6) * 0.6;
      const ex = this.x + this.facing * 60, ey = this.y + 40 + sweep * 40;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(67,217,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(this.x - camX + this.facing * 3, this.y - camY);
      ctx.lineTo(ex - camX, ey - camY - 18);
      ctx.lineTo(ex - camX, ey - camY + 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(160,240,255,0.5)';
      ctx.fillRect(Math.round(ex - camX), Math.round(ey - camY - 18), 1, 36);
      ctx.restore();
    }
  }
}
