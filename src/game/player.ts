import { TILE, clamp } from './constants';
import { Body, moveBody } from './physics';
import { audio } from './audio';
import type { Game } from './Game';

export type PState =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'mine' | 'use'
  | 'interact' | 'hurt' | 'dead' | 'respawn' | 'lying' | 'getup';

export class Player {
  body: Body = { x: 0, y: 0, w: 10, h: 22, vx: 0, vy: 0, onGround: false, hitWallX: false };
  facing: 1 | -1 = 1;
  hp = 100;
  o2 = 100;
  hunger = 100;
  energy = 100;
  maxO2 = 100;
  state: PState = 'idle';
  animT = 0;
  stateT = 0;
  invuln = 0;
  coyote = 0;
  jumpBuf = 0;
  actionT = 0; // remaining time of a one-shot action animation (mine/use/interact)
  actionKind: 'mine' | 'use' | 'interact' | null = null;
  hurtT = 0;
  landT = 0;
  stepT = 0;
  lastHurt = 99;
  peakVy = 0;
  deathAngle = 0;
  respawnT = 0;
  tool: 'multitool' | 'pickaxe' = 'multitool';

  get cx(): number { return this.body.x + this.body.w / 2; }
  get cy(): number { return this.body.y + this.body.h / 2; }
  get feetY(): number { return this.body.y + this.body.h; }
  get dead(): boolean { return this.state === 'dead'; }

  placeAt(px: number, feetY: number): void {
    this.body.x = px - this.body.w / 2;
    this.body.y = feetY - this.body.h - 0.01;
    this.body.vx = 0;
    this.body.vy = 0;
  }

  damage(g: Game, amount: number, fromX?: number): void {
    if (this.invuln > 0 || this.dead || this.state === 'respawn' || g.cutscene) return;
    this.hp -= amount;
    this.invuln = 0.9;
    this.hurtT = 0.3;
    this.lastHurt = 0;
    if (fromX !== undefined) {
      const dir = this.cx < fromX ? -1 : 1;
      this.body.vx = dir * 170;
      this.body.vy = -170;
    }
    g.shake(3, 0.2);
    audio.play('hurt');
    g.particles.burst(this.cx, this.cy, '#ff5a6e', 8, 60);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(g);
    }
  }

  die(g: Game): void {
    if (this.dead) return;
    this.state = 'dead';
    this.stateT = 0;
    this.deathAngle = 0;
    this.body.vx = 0;
    audio.play('explosion');
    g.onPlayerDeath();
  }

  /** controls = whether the player may act this frame */
  update(g: Game, dt: number, controls: boolean): void {
    const inp = g.input;
    const b = this.body;
    this.animT += dt;
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.actionT = Math.max(0, this.actionT - dt);
    this.lastHurt += dt;

    if (this.state === 'dead') {
      this.deathAngle = Math.min(Math.PI / 2, this.stateT > 0.35 ? (this.stateT - 0.35) * 4 : 0);
      b.vx *= 0.9;
      b.vy += 900 * dt;
      moveBody(g.world, b, dt);
      return;
    }
    if (this.state === 'respawn') {
      this.respawnT += dt;
      if (this.respawnT > 1.1) this.state = 'idle';
      return;
    }
    if (this.state === 'lying' || this.state === 'getup') {
      b.vx = 0;
      b.vy += 900 * dt;
      moveBody(g.world, b, dt);
      return;
    }

    let move = 0;
    if (controls) {
      if (inp.key('KeyA', 'ArrowLeft')) move -= 1;
      if (inp.key('KeyD', 'ArrowRight')) move += 1;
    }
    const tired = this.energy < 12;
    const sprint = controls && inp.key('ShiftLeft', 'ShiftRight') && !tired && move !== 0;
    const maxSpeed = (sprint ? 150 : 88) * (tired ? 0.75 : 1) * (g.storm.exposedPush ? 0.85 : 1);
    const accel = b.onGround ? 1500 : 950;
    if (move !== 0) {
      b.vx += move * accel * dt;
      if (Math.abs(b.vx) > maxSpeed) b.vx = Math.sign(b.vx) * Math.max(maxSpeed, Math.abs(b.vx) - 2200 * dt);
      this.facing = move > 0 ? 1 : -1;
    } else {
      const f = (b.onGround ? 1700 : 500) * dt;
      b.vx = Math.abs(b.vx) <= f ? 0 : b.vx - Math.sign(b.vx) * f;
    }
    if (g.storm.windForce) b.vx += g.storm.windForce * dt;
    if (sprint) this.energy -= 6 * dt;

    // jump with coyote time and buffering
    this.coyote = b.onGround ? 0.1 : Math.max(0, this.coyote - dt);
    if (controls && inp.hit('KeyW', 'Space', 'ArrowUp')) this.jumpBuf = 0.12;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      b.vy = -315;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.energy -= 0.8;
      audio.play('jump');
      g.particles.burst(this.cx, this.feetY, '#8c7aae', 4, 30);
    }
    if (!inp.key('KeyW', 'Space', 'ArrowUp') && b.vy < -120) b.vy *= 0.6;

    b.vy = Math.min(520, b.vy + 950 * dt);
    const wasGround = b.onGround;
    const vyBefore = b.vy;
    moveBody(g.world, b, dt, true);
    if (!wasGround && b.onGround) {
      this.landT = 0.12;
      audio.play('land');
      g.particles.burst(this.cx, this.feetY, '#8c7aae', 6, 40);
      if (vyBefore > 440) this.damage(g, Math.round((vyBefore - 440) * 0.15));
    }
    // keep inside world horizontally
    b.x = clamp(b.x, 2 * TILE, (g.world.w - 2) * TILE - b.w);

    // footsteps
    if (b.onGround && Math.abs(b.vx) > 20) {
      this.stepT -= dt * (Math.abs(b.vx) / 80);
      if (this.stepT <= 0) {
        audio.play('step');
        this.stepT = 0.32;
        if (Math.abs(b.vx) > 120) g.particles.burst(this.cx - this.facing * 4, this.feetY, '#6b4a80', 2, 20);
      }
    }

    // choose animation state
    let s: PState;
    if (this.hurtT > 0) s = 'hurt';
    else if (this.actionT > 0 && this.actionKind) s = this.actionKind;
    else if (!b.onGround) s = b.vy < 0 ? 'jump' : 'fall';
    else if (this.landT > 0) s = 'land';
    else if (Math.abs(b.vx) > 110) s = 'run';
    else if (Math.abs(b.vx) > 8) s = 'walk';
    else s = 'idle';
    if (s !== this.state) { this.state = s; this.stateT = 0; }
  }

  action(kind: 'mine' | 'use' | 'interact', dur = 0.25): void {
    if (this.actionKind !== kind || this.actionT <= 0) this.animT = 0;
    this.actionKind = kind;
    this.actionT = dur;
  }

  draw(g: Game, ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const A = this.facing === 1 ? g.assets.astro : g.assets.astroL;
    const x = Math.round(this.cx - 12 - camX);
    const y = Math.round(this.feetY - 24 - camY);
    let img: HTMLCanvasElement;
    const fr = (arr: HTMLCanvasElement[], fps: number) => arr[Math.floor(this.animT * fps) % arr.length];
    switch (this.state) {
      case 'walk': img = fr(A.walk, 10); break;
      case 'run': img = fr(A.run, 14); break;
      case 'jump': img = A.jump[0]; break;
      case 'fall': img = A.fall[0]; break;
      case 'land': img = A.land[0]; break;
      case 'mine': img = fr(this.tool === 'pickaxe' ? A.mine_pickaxe : A.mine_multitool, 14); break;
      case 'use': img = fr(A.use, 10); break;
      case 'interact': img = fr(A.interact, 6); break;
      case 'hurt': img = A.hurt[0]; break;
      case 'getup': img = A.kneel[0]; break;
      default: img = fr(A.idle, 2.5);
    }
    if (this.state === 'dead' || this.state === 'lying') {
      const ang = this.state === 'lying' ? Math.PI / 2 : this.deathAngle;
      const base = this.state === 'dead' && this.stateT < 0.35 ? A.kneel[0] : A.idle[0];
      ctx.save();
      ctx.translate(Math.round(this.cx - camX), Math.round(this.feetY - camY));
      ctx.rotate(-ang * this.facing);
      ctx.drawImage(base, -12, -24);
      ctx.restore();
      if (this.state === 'dead' && this.stateT > 0.9 && Math.floor(this.stateT * 8) % 2 === 0) {
        g.particles.add({ x: this.cx + (Math.random() - 0.5) * 16, y: this.feetY - 4, vy: -20, max: 0.6, color: '#43d9ff', glow: true, fade: true });
      }
      return;
    }
    if (this.state === 'respawn') {
      const k = Math.min(1, this.respawnT / 0.8);
      const h = Math.round(24 * k);
      ctx.drawImage(img, 0, 24 - h, 24, h, x, y + 24 - h, 24, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(111,243,255,${0.5 * (1 - k)})`;
      ctx.fillRect(x + 6, y - 80, 12, 104);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0) ctx.globalAlpha = 0.5;
    ctx.drawImage(img, x, y);
    ctx.globalAlpha = 1;
  }
}
