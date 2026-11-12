import { TILE } from './constants';
import { Body, moveBody, bodyBlocked } from './physics';
import { audio } from './audio';
import type { Game } from './Game';

export type CKind = 'glimmer' | 'crawler' | 'wing';
export type CState = 'idle' | 'walk' | 'chase' | 'windup' | 'attack' | 'dead' | 'flee';

export interface Creature {
  kind: CKind;
  body: Body;
  hp: number;
  facing: 1 | -1;
  state: CState;
  t: number;
  animT: number;
  cool: number;
  flash: number;
  hostile: boolean;
  noticed: boolean;
  hopT: number;
}

export function spawnCreature(kind: CKind, x: number, feetY: number): Creature {
  const size = kind === 'crawler' ? { w: 18, h: 11 } : kind === 'wing' ? { w: 14, h: 10 } : { w: 10, h: 9 };
  return {
    kind,
    body: { x: x - size.w / 2, y: feetY - size.h - 0.5, w: size.w, h: size.h, vx: 0, vy: 0, onGround: false, hitWallX: false },
    hp: kind === 'crawler' ? 4 : kind === 'wing' ? 3 : 1,
    facing: Math.random() < 0.5 ? 1 : -1,
    state: 'walk',
    t: Math.random() * 3,
    animT: 0,
    cool: 0,
    flash: 0,
    hostile: kind !== 'glimmer',
    noticed: false,
    hopT: Math.random() * 2,
  };
}

function ledgeAhead(g: Game, c: Creature): boolean {
  const b = c.body;
  const fx = c.facing === 1 ? b.x + b.w + 2 : b.x - 2;
  const fy = b.y + b.h + 4;
  return !g.world.solidAtPx(fx, fy) && !g.world.solidAtPx(fx, fy + TILE);
}

export function updateCreature(g: Game, c: Creature, dt: number): void {
  const b = c.body;
  const p = g.player;
  c.t += dt;
  c.animT += dt;
  c.cool = Math.max(0, c.cool - dt);
  c.flash = Math.max(0, c.flash - dt);
  if (c.state === 'dead') {
    b.vx *= 0.9;
    if (c.kind !== 'wing') { b.vy += 700 * dt; moveBody(g.world, b, dt); }
    else { b.vy += 300 * dt; b.y += b.vy * dt; }
    return;
  }
  const dx = p.cx - (b.x + b.w / 2);
  const dy = p.cy - (b.y + b.h / 2);
  const dist = Math.hypot(dx, dy);
  const playerOk = !p.dead && p.state !== 'respawn' && !g.cutscene;

  if (c.kind === 'glimmer') {
    // peaceful: wander and hop, flee when the player gets close
    const scared = playerOk && dist < 60;
    if (scared) c.facing = dx > 0 ? -1 : 1;
    c.hopT -= dt;
    if (b.onGround && c.hopT <= 0) {
      b.vy = scared ? -220 : -150;
      b.vx = c.facing * (scared ? 90 : 45);
      c.hopT = scared ? 0.35 : 0.8 + Math.random() * 1.5;
      if (Math.random() < 0.25) c.facing = c.facing === 1 ? -1 : 1;
    }
    if (b.onGround && c.hopT > 0.1) b.vx *= 0.8;
    b.vy = Math.min(400, b.vy + 700 * dt);
    moveBody(g.world, b, dt);
    if (b.hitWallX) c.facing = c.facing === 1 ? -1 : 1;
    return;
  }

  if (c.kind === 'crawler') {
    const sees = playerOk && dist < 9 * TILE && Math.abs(dy) < 5 * TILE && !g.sheltered;
    if (sees && !c.noticed) {
      c.noticed = true;
      audio.play('growl');
      g.onHostileNoticed();
    }
    if (!sees && dist > 14 * TILE) c.noticed = false;
    switch (c.state) {
      case 'idle':
      case 'walk': {
        if (c.noticed) { c.state = 'chase'; break; }
        b.vx = c.facing * 28;
        if (b.onGround && (b.hitWallX || ledgeAhead(g, c))) c.facing = c.facing === 1 ? -1 : 1;
        if (c.t > 3 + Math.random() * 4) { c.t = 0; c.state = c.state === 'walk' ? 'idle' : 'walk'; if (c.state === 'idle') b.vx = 0; }
        if (c.state === 'idle') b.vx = 0;
        break;
      }
      case 'chase': {
        if (!c.noticed) { c.state = 'walk'; break; }
        c.facing = dx > 0 ? 1 : -1;
        b.vx = c.facing * 78;
        if (b.onGround && b.hitWallX) b.vy = -270;
        if (dist < 26 && c.cool <= 0 && Math.abs(dy) < 20) { c.state = 'windup'; c.t = 0; b.vx = 0; }
        break;
      }
      case 'windup':
        b.vx = 0;
        if (c.t > 0.35) {
          c.state = 'attack'; c.t = 0;
          b.vx = c.facing * 170; b.vy = -120;
          audio.play('growl');
        }
        break;
      case 'attack':
        if (Math.abs(dx) < 18 && Math.abs(dy) < 18) p.damage(g, 12, b.x + b.w / 2);
        if (c.t > 0.35) { c.state = 'chase'; c.cool = 1.2; }
        break;
    }
    b.vy = Math.min(480, b.vy + 900 * dt);
    moveBody(g.world, b, dt, true);
    return;
  }

  // flying duskwing
  const sees = playerOk && dist < 13 * TILE && !g.sheltered;
  if (sees && !c.noticed) { c.noticed = true; g.onHostileNoticed(); }
  if (!sees) c.noticed = false;
  let tx: number, ty: number;
  if (c.state === 'attack') {
    tx = p.cx; ty = p.cy;
    if (c.t > 0.8 || dist < 10) { c.state = 'chase'; c.cool = 1.6; }
    if (dist < 14) p.damage(g, 8, b.x + b.w / 2);
  } else if (c.noticed) {
    c.state = 'chase';
    tx = p.cx + Math.cos(c.t * 1.5) * 50;
    ty = p.cy - 46 + Math.sin(c.t * 3) * 10;
    if (c.cool <= 0 && dist < 90) { c.state = 'attack'; c.t = 0; audio.play('growl'); }
  } else {
    c.state = 'walk';
    tx = b.x + c.facing * 40;
    ty = b.y + Math.sin(c.t) * 20;
    if (c.t > 4) { c.t = 0; c.facing = c.facing === 1 ? -1 : 1; }
  }
  const sp = c.state === 'attack' ? 190 : 85;
  const ang = Math.atan2(ty - b.y, tx - b.x);
  b.vx += (Math.cos(ang) * sp - b.vx) * Math.min(1, dt * 3);
  b.vy += (Math.sin(ang) * sp - b.vy) * Math.min(1, dt * 3);
  c.facing = b.vx >= 0 ? 1 : -1;
  const ox = b.x, oy = b.y;
  b.x += b.vx * dt;
  if (bodyBlocked(g.world, b)) { b.x = ox; b.vx *= -0.5; }
  b.y += b.vy * dt;
  if (bodyBlocked(g.world, b)) { b.y = oy; b.vy *= -0.5; }
}

export function hurtCreature(g: Game, c: Creature, dmg: number, fromX: number): void {
  if (c.state === 'dead') return;
  c.hp -= dmg;
  c.flash = 0.15;
  const dir = c.body.x + c.body.w / 2 > fromX ? 1 : -1;
  c.body.vx = dir * 180;
  c.body.vy = -160;
  c.noticed = true;
  audio.play('hit');
  g.particles.burst(c.body.x + c.body.w / 2, c.body.y + c.body.h / 2, c.kind === 'glimmer' ? '#6fffd0' : '#a04aff', 6, 70);
  if (c.hp <= 0) {
    c.state = 'dead';
    c.t = 0;
    audio.play('enemyDie');
    g.particles.burst(c.body.x + c.body.w / 2, c.body.y + c.body.h / 2, c.kind === 'glimmer' ? '#9effe6' : '#ff3d6e', 16, 90, { glow: true });
    g.onCreatureKilled(c);
  } else if (c.kind === 'crawler') {
    c.state = 'chase';
  } else if (c.kind === 'glimmer') {
    c.facing = dir;
  }
}

export function drawCreature(g: Game, c: Creature, ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const b = c.body;
  const cx = Math.round(b.x + b.w / 2 - camX);
  const fy = Math.round(b.y + b.h - camY);
  let img: HTMLCanvasElement;
  if (c.kind === 'glimmer') {
    const arr = c.facing === 1 ? g.assets.glimmer : g.assets.glimmerL;
    img = !b.onGround ? arr[2] : arr[Math.floor(c.animT * 3) % 2];
    ctx.globalAlpha = c.state === 'dead' ? Math.max(0, 1 - c.t * 2) : 1;
    ctx.drawImage(img, cx - 7, fy - 13);
  } else if (c.kind === 'crawler') {
    const set = c.facing === 1 ? g.assets.crawler : g.assets.crawlerL;
    if (c.state === 'windup' || c.state === 'attack') img = set.attack[c.state === 'windup' ? 0 : 1];
    else if (Math.abs(b.vx) > 5) img = set.walk[Math.floor(c.animT * (c.state === 'chase' ? 14 : 7)) % 4];
    else img = set.idle[Math.floor(c.animT * 2) % 2];
    if (c.state === 'dead') {
      ctx.globalAlpha = Math.max(0, 1 - c.t * 1.5);
      ctx.drawImage(img, 0, 0, 22, 14, cx - 11, fy - 7, 22, 7);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.drawImage(img, cx - 11, fy - 14);
  } else {
    const frames = g.assets.duskwing;
    img = c.state === 'attack' ? frames[2] : frames[Math.floor(c.animT * 10) % 3];
    ctx.save();
    ctx.globalAlpha = c.state === 'dead' ? Math.max(0, 1 - c.t * 1.5) : 1;
    if (c.facing === -1) {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -10, fy - 12);
    } else ctx.drawImage(img, cx - 10, fy - 12);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (c.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(img, c.kind === 'crawler' ? cx - 11 : cx - 7, c.kind === 'crawler' ? fy - 14 : fy - 13);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // glowing eyes in the dark
  if (c.hostile && c.state !== 'dead') {
    ctx.globalCompositeOperation = 'lighter';
    const ex = c.kind === 'crawler' ? cx + c.facing * 8 : cx + c.facing * 2;
    const ey = c.kind === 'crawler' ? fy - 9 : fy - 6;
    ctx.drawImage(g.assets.glow.red, ex - 10, ey - 10, 20, 20);
    ctx.globalCompositeOperation = 'source-over';
  }
}
