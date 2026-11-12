import { TILE, VIEW_H, DAY_SECONDS, START_TIME, REACH, clamp, lerp } from './constants';
import { World, LOC, WorldObject } from './world';
import { T, TILE_DEFS, isSolid } from './tiles';
import { Input } from './input';
import { Particles } from './particles';
import { Inventory, ITEMS, RECIPES, Recipe } from './items';
import { Player } from './player';
import { Robot } from './robot';
import { Creature, spawnCreature, updateCreature, drawCreature, hurtCreature, CKind } from './creatures';
import { Story, DAYS } from './story';
import { Hud } from './hud';
import { getAssets, Assets } from './art/assets';
import { drawBackground, drawBackTiles, drawTiles, drawLighting, drawObject } from './render';
import { audio } from './audio';
import { readSave, writeSave, clearSave, SaveData } from './save';
import { drawText } from './font';

export type GameEvent =
  | { type: 'overlay'; value: 'none' | 'inventory' | 'pause' }
  | { type: 'inventory' }
  | { type: 'ending' }
  | { type: 'saved' };

interface Drop { x: number; y: number; vx: number; vy: number; id: string; n: number; t: number }
type CutKind = 'wake' | 'sos' | 'death' | 'sleep' | 'rescue';
interface Cutscene { kind: CutKind; t: number; step: number }

export interface InvSnapshot {
  slots: ({ id: string; count: number } | null)[];
  selected: number;
  recipes: { id: string; out: string; qty: number; needs: Record<string, number>; can: boolean; locked: boolean }[];
  day: number;
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W = 640;
  H = VIEW_H;
  assets: Assets;
  world!: World;
  input: Input;
  particles = new Particles();
  inv = new Inventory();
  player = new Player();
  robot = new Robot();
  creatures: Creature[] = [];
  drops: Drop[] = [];
  story = new Story();
  hud = new Hud();
  objState: Record<string, number> = {};
  time = START_TIME;
  elapsed = 0;
  camX = 0;
  camY = 0;
  shakeAmt = 0;
  shakeT = 0;
  paused = false;
  overlay: 'none' | 'inventory' | 'pause' = 'none';
  cutscene: Cutscene | null = null;
  fade = 0;
  letterbox = 0;
  hudHidden = false;
  sheltered = false;
  oxygenZone: string | null = null;
  lightningFlash = 0;
  storm = { scheduled: false, active: false, startsIn: 0, remaining: 0, intensity: 0, windForce: 0, exposedPush: false };
  rescueT = 0;
  private shelterTimer = 0;
  private spawnT = 3;
  private saveTimer = 20;
  private hintCd: Record<string, number> = {};
  private lastHint = -99;
  private mining: { tx: number; ty: number; p: number; snd: number } | null = null;
  private attackCd = 0;
  private placeCd = 0;
  private useCd = 0;
  private holdE = 0;
  private chirpT = 5;
  private nightWarned = -1;
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private undergroundHinted = false;
  private objFlashT = 0;

  constructor(canvas: HTMLCanvasElement, mode: 'new' | 'continue', private onEvent: (e: GameEvent) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.assets = getAssets();
    this.input = new Input(canvas, () => this.W, () => this.H);
    this.resize();
    const save = mode === 'continue' ? readSave() : null;
    if (save) this.loadFrom(save);
    else this.newGame();
    this.snapCamera();
    this.last = performance.now();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------- setup ----------------
  private newGame(): void {
    clearSave();
    const seed = (Math.random() * 1e9) | 0;
    this.world = new World(seed);
    this.inv.add('multitool', 1);
    this.inv.add('ration', 2);
    this.inv.add('o2refill', 1);
    const gy = this.world.groundY(LOC.spawnX);
    this.player.placeAt(LOC.spawnX * TILE + 8, gy * TILE);
    this.robot.x = (LOC.shipX + 8) * TILE;
    this.robot.y = this.world.groundY(LOC.shipX + 8) * TILE - 6;
    this.robot.active = false;
    this.robot.bootT = 0;
    this.time = START_TIME;
    this.startCutscene('wake');
  }

  private loadFrom(s: SaveData): void {
    this.world = new World(s.seed);
    this.world.applyDiffs(s.diffs);
    this.objState = { ...s.objectState };
    this.story.load(s.story);
    this.inv.load(s.inventory);
    this.inv.selected = s.selected ?? 0;
    this.time = s.time;
    const p = this.player;
    p.hp = s.player.hp; p.o2 = s.player.o2; p.hunger = s.player.hunger; p.energy = s.player.energy; p.maxO2 = s.player.maxO2;
    p.body.x = s.player.x; p.body.y = s.player.y;
    // never resume inside terrain
    if (this.bodyStuck()) {
      const tx = Math.floor(p.cx / TILE);
      p.placeAt(tx * TILE + 8, this.world.groundY(tx) * TILE);
    }
    this.robot.x = p.cx; this.robot.y = p.body.y - 10;
    if (this.story.day === 6 && !this.story.flags.stormSurvived) { this.storm.scheduled = true; this.storm.startsIn = 25; }
    if ((this.objState.beacon ?? 0) >= 1 && !this.story.flags.shuttleLanded) this.rescueT = Number(this.story.flags.rescueT ?? 0);
    this.hud.banner(`DAY ${this.story.day}`, DAYS[this.story.day - 1].title, 2.6);
    if (this.story.day === 1 && !this.story.flags.sosDone && (this.objState.transmitter ?? 0) >= 2) this.story.flags.sosDone = true;
  }

  private respawnColumn(): number {
    const px = Math.floor(this.player.cx / TILE);
    const opts = [LOC.spawnX];
    if ((this.objState.terminal ?? 0) >= 1) opts.push(LOC.terminalX - 2);
    if ((this.objState.beacon ?? 0) >= 1) opts.push(LOC.peakX - 2);
    opts.sort((a, b) => Math.abs(a - px) - Math.abs(b - px));
    return opts[0];
  }

  nearestHostile(): { x: number; y: number } | null {
    let best: Creature | null = null;
    let bd = 1e9;
    for (const c of this.creatures) {
      if (!c.hostile || c.state === 'dead') continue;
      const d = Math.abs(c.body.x - this.player.cx);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { x: best.body.x + best.body.w / 2, y: best.body.y } : null;
  }

  private onVisibility = () => {
    if (document.hidden && this.overlay === 'none' && !this.destroyed) this.openOverlay('pause');
  };

  private bodyStuck(): boolean {
    const b = this.player.body;
    for (let y = Math.floor(b.y / TILE); y <= Math.floor((b.y + b.h) / TILE); y++)
      for (let x = Math.floor(b.x / TILE); x <= Math.floor((b.x + b.w) / TILE); x++) if (this.world.solid(x, y)) return true;
    return false;
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const cw = parent ? parent.clientWidth : window.innerWidth;
    const ch = parent ? parent.clientHeight : window.innerHeight;
    const aspect = cw / Math.max(1, ch);
    this.W = Math.round(clamp(VIEW_H * aspect, 480, 860));
    this.H = VIEW_H;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const scale = Math.min(cw / this.W, ch / this.H);
    this.canvas.style.width = `${Math.floor(this.W * scale)}px`;
    this.canvas.style.height = `${Math.floor(this.H * scale)}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    document.removeEventListener('visibilitychange', this.onVisibility);
    audio.setAmbient(0, 0);
  }

  // ---------------- helpers used by other modules ----------------
  say(text: string, speaker = 'B-07', blocking = false): void {
    this.hud.say(text, speaker, blocking);
    if (speaker === 'B-07') audio.play('robot');
  }

  shake(amount: number, dur: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeT = Math.max(this.shakeT, dur);
  }

  dayLight(): number {
    const t = this.time;
    if (t < 0.05) return lerp(0.6, 1, t / 0.05);
    if (t < 0.55) return 1;
    if (t < 0.65) return lerp(1, 0.2, (t - 0.55) / 0.1);
    if (t < 0.95) return 0.2;
    return lerp(0.2, 0.6, (t - 0.95) / 0.05);
  }

  ambientLight(): number {
    return this.dayLight() * (1 - this.storm.intensity * 0.45);
  }

  nightFactor(): number {
    return clamp((1 - this.dayLight()) / 0.8, 0, 1);
  }

  duskFactor(): number {
    return Math.max(0, 1 - Math.abs(this.time - 0.6) / 0.06);
  }

  isNight(): boolean {
    return this.time >= 0.62 && this.time < 0.97;
  }

  clockText(): string {
    const hours = (5 + this.time * 24) % 24;
    const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  objFlashColor(): string {
    return this.objFlashT > 0 && Math.floor(this.objFlashT * 8) % 2 === 0 ? '#3dff8a' : '#5a4a9a';
  }

  rescueRemaining(): number {
    return 60 - this.rescueT;
  }

  private hint(key: string, text: string, cd: number, urgent = false): void {
    const now = this.elapsed;
    if ((this.hintCd[key] ?? -999) > now) return;
    if (!urgent && now - this.lastHint < 8) return;
    if (this.hud.queue.length > 1) return;
    this.hintCd[key] = now + cd;
    this.lastHint = now;
    this.say(text);
  }

  // ---------------- callbacks ----------------
  onObjectiveDone(): void {
    audio.play('complete');
    this.objFlashT = 1.2;
    this.saveGame();
  }

  onDayComplete(): void {
    const d = this.story.def;
    for (const l of d.complete) this.say(l);
    if (this.story.day < 10) this.hud.banner('OBJECTIVES COMPLETE', `DAY ${this.story.day} - ${d.title}`, 2.8, '#3dff8a');
    this.saveGame();
  }

  onPlayerDeath(): void {
    this.startCutscene('death');
  }

  onCreatureKilled(c: Creature): void {
    if (c.hostile) this.story.flags.kills = Number(this.story.flags.kills ?? 0) + 1;
    if (Math.random() < (c.kind === 'glimmer' ? 0.9 : 0.5)) this.spawnDrop(c.body.x + c.body.w / 2, c.body.y, 'organic', 1);
    if (c.kind === 'wing' && Math.random() < 0.4) this.spawnDrop(c.body.x, c.body.y, 'crystal', 1);
  }

  onHostileNoticed(): void {
    this.hint('hostile', 'Hostile lifeform detected! Watch out, Captain.', 40, true);
  }

  // ---------------- main loop ----------------
  private frame = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) this.update(dt);
    this.render();
    this.input.endFrame();
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    this.elapsed += dt;
    const inp = this.input;
    // overlays
    if (!this.cutscene && !this.player.dead) {
      if (inp.hit('Escape')) { this.openOverlay('pause'); return; }
      if (inp.hit('KeyI', 'Tab')) { this.openOverlay('inventory'); return; }
    } else if (inp.hit('Escape')) { this.openOverlay('pause'); return; }

    // blocking dialogue advance
    if (this.hud.blocking && (inp.hit('Space', 'Enter', 'KeyE') || inp.clickL)) {
      this.hud.advance();
      audio.play('click');
      inp.clickL = false;
      inp.pressed.delete('KeyE');
      inp.pressed.delete('Space');
    }

    this.hud.update(dt);
    this.objFlashT = Math.max(0, this.objFlashT - dt);
    this.updateTime(dt);
    if (this.cutscene) this.updateCutscene(dt);
    const controls = !this.cutscene && !this.hud.blocking && !this.player.dead;
    this.player.tool = this.currentTool();
    this.player.update(this, dt, controls);
    if (controls) this.handleActions(dt);
    else { this.mining = null; this.hud.prompt = null; this.hud.progress = null; }
    this.robot.update(this, dt);
    this.updateCreatures(dt);
    this.updateDrops(dt);
    this.particles.update(dt);
    this.updateEnvironment(dt);
    if (!this.cutscene || this.cutscene.kind === 'sos') this.survival(dt);
    this.storyChecks();
    if (!this.cutscene || this.cutscene.kind === 'sos') this.story.update(this);
    this.updateCamera(dt);
    this.updateAudio();
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 25; if (!this.cutscene && !this.player.dead) this.saveGame(); }
  }

  private updateTime(dt: number): void {
    if (this.cutscene && (this.cutscene.kind === 'wake' || this.cutscene.kind === 'death')) return;
    let speed = 1 / DAY_SECONDS;
    if (this.story.day === 9 && this.isNight() && !this.story.flags.survived9) speed *= 0.45;
    if (this.story.day === 1 && !this.story.flags.sosDone) speed *= 0.5;
    if (this.story.day === 10 && (this.objState.beacon ?? 0) >= 1) speed = 0;
    this.time += dt * speed;
    if (this.time >= 0.5 && this.nightWarned !== this.story.day && this.time < 0.6) {
      this.nightWarned = this.story.day;
      if (this.story.day === 1) this.hint('night', 'Captain, night is approaching. We should build a shelter.', 60, true);
      else if (!this.sheltered) this.hint('night', 'Captain, night is approaching. We should get to a shelter.', 60, true);
    }
    if (this.time >= 1) {
      this.time -= 1;
      this.onDawn();
    }
  }

  private onDawn(): void {
    const s = this.story;
    if (s.day === 9 && !s.flags.survived9 && !this.player.dead) {
      s.flags.survived9 = true;
      s.update(this);
    }
    if (s.dayComplete && s.day < 10) {
      this.newDay();
    } else if (s.day < 10) {
      const cur = s.current();
      this.say(`A new morning, Captain - but rescue only comes if we keep going. Next: ${cur ? cur.text(this) : 'our objective'}.`);
      this.hud.banner(`DAY ${s.day}`, `${s.def.title} - CONTINUED`, 2.6);
    }
    // creatures of the night retreat
    for (const c of this.creatures) if (c.hostile && Math.abs(c.body.x - this.player.cx) > 14 * TILE) c.state = 'dead';
  }

  private newDay(): void {
    const s = this.story;
    s.day++;
    s.objIndex = 0;
    s.dayComplete = false;
    const d = s.def;
    this.hud.banner(`DAY ${s.day}`, d.title, 3.4, s.day === 10 ? '#ffe08a' : '#ffffff');
    audio.play('complete');
    for (const l of d.intro) this.say(l);
    if (s.day === 6) { this.storm.scheduled = true; this.storm.startsIn = 45; }
    if (s.day === 9) this.storm.scheduled = false;
    this.saveGame();
  }

  private openOverlay(o: 'inventory' | 'pause'): void {
    this.overlay = o;
    this.paused = true;
    this.mining = null;
    this.input.reset();
    audio.play('click');
    this.onEvent({ type: 'overlay', value: o });
  }

  closeOverlay(): void {
    this.overlay = 'none';
    this.paused = false;
    this.input.reset();
    this.last = performance.now();
    this.onEvent({ type: 'overlay', value: 'none' });
  }

  // ---------------- cutscenes ----------------
  private startCutscene(kind: CutKind): void {
    this.cutscene = { kind, t: 0, step: 0 };
    if (kind === 'wake') {
      this.player.state = 'lying';
      this.hudHidden = true;
      this.letterbox = 1;
      this.fade = 1;
      const tx = this.world.objects.find((o) => o.id === 'transmitter')!;
      this.camX = tx.tx * TILE - this.W / 2;
      this.camY = tx.ty * TILE - this.H * 0.6;
    }
  }

  private updateCutscene(dt: number): void {
    const c = this.cutscene!;
    c.t += dt;
    const p = this.player;
    switch (c.kind) {
      case 'wake': {
        this.fade = Math.max(0, 1 - c.t / 1.5);
        if (c.step === 0 && c.t > 3.8) { c.step = 1; p.state = 'getup'; audio.play('land'); }
        if (c.step === 1 && c.t > 5.0) {
          c.step = 2;
          p.state = 'idle';
          this.robot.active = true;
          this.robot.vy = -60;
          audio.play('robot');
          this.particles.burst(this.robot.x, this.robot.y, '#43d9ff', 12, 60, { glow: true });
        }
        if (c.step >= 2) this.robot.bootT = Math.min(1, this.robot.bootT + dt);
        if (c.step === 2 && c.t > 6.6) {
          c.step = 3;
          this.say("Captain, we've crashed on an unknown planet. Our ship is badly damaged.", 'B-07', true);
        }
        if (c.step === 3 && this.hud.queue.length === 0) {
          c.step = 4;
          c.t = 6.6;
        }
        if (c.step === 4 && c.t > 7.4) {
          c.step = 5;
          this.say('We need to send an SOS signal to Earth!', 'B-07', true);
        }
        if (c.step === 5 && this.hud.queue.length === 0) {
          this.cutscene = null;
          this.hudHidden = false;
          this.hud.banner('MISSION 01: SEND SOS', 'FIND THE DAMAGED TRANSMITTER', 3.4, '#ffe08a');
          this.say('Use [A]/[D] to move and [W] or [SPACE] to jump. Follow the marker - the transmitter landed east of the ship.');
          this.saveGame();
        }
        break;
      }
      case 'sos': {
        if (c.step === 0) { c.step = 1; audio.play('transmit'); this.shake(2, 1); this.hudHidden = true; }
        this.letterbox = Math.min(1, this.letterbox + dt * 2);
        const tx = this.world.objects.find((o) => o.id === 'transmitter')!;
        if (Math.random() < 0.6) this.particles.add({ x: tx.tx * TILE + 4 + (Math.random() - 0.5) * 4, y: tx.ty * TILE - 50, vy: -160 - Math.random() * 60, max: 1.4, color: '#6ff3ff', glow: true, fade: true, size: 2 });
        if (c.step === 1 && c.t > 1.2) { c.step = 2; audio.play('sos'); }
        if (c.step === 2 && c.t > 3.4) { c.step = 3; this.say('Signal is away... Waiting for a reply.'); }
        if (c.step === 3 && c.t > 7) {
          c.step = 4;
          this.robot.scan();
          this.say('Captain! Confirmation from the Earth relay - a rescue mission is on its way! They expect to arrive in ten days.');
          this.hud.banner('SOS SIGNAL SENT', undefined, 3.2, '#6ff3ff');
        }
        if (c.step === 4 && c.t > 10.6) { c.step = 5; this.hud.banner('RESCUE ETA: 10 DAYS', 'SURVIVE UNTIL THEY ARRIVE', 3.6, '#ffe08a'); }
        if (c.step === 5 && c.t > 13.5) {
          this.story.flags.sosDone = true;
          this.cutscene = null;
          this.hudHidden = false;
        }
        break;
      }
      case 'death': {
        if (c.t > 1.8) this.fade = Math.min(1, (c.t - 1.8) / 0.6);
        if (c.step === 0 && c.t > 2.6) {
          c.step = 1;
          const sx = this.respawnColumn();
          p.placeAt(sx * TILE + 8, this.world.groundY(sx) * TILE);
          p.state = 'respawn';
          p.respawnT = 0;
          p.hp = 70; p.o2 = Math.max(p.o2, p.maxO2 * 0.8); p.hunger = Math.max(p.hunger, 50); p.energy = Math.max(p.energy, 60);
          p.invuln = 3;
          this.creatures = this.creatures.filter((cr) => Math.abs(cr.body.x - p.cx) > 20 * TILE);
          this.snapCamera();
          audio.play('transmit');
        }
        if (c.step === 1) this.fade = Math.max(0, 1 - (c.t - 2.6) / 0.6);
        if (c.step === 1 && c.t > 3.4) {
          this.cutscene = null;
          this.say('Vital signs restored. The ship\'s med-bay patched you up. Please be more careful, Captain.');
        }
        break;
      }
      case 'sleep': {
        if (c.step === 0) { this.fade = Math.min(1, c.t / 1); if (c.t >= 1) { c.step = 1; this.time = 0.9999; } }
        else if (c.step === 1) {
          const p2 = this.player;
          p2.energy = 100; p2.hp = Math.min(100, p2.hp + 25); p2.hunger = Math.max(0, p2.hunger - 12);
          c.step = 2;
        } else {
          this.fade = Math.max(0, 1 - (c.t - 1.2) / 1);
          if (c.t > 2.2) this.cutscene = null;
        }
        break;
      }
      case 'rescue': {
        this.letterbox = Math.min(1, this.letterbox + dt);
        this.hudHidden = true;
        if (c.step === 0) { c.step = 1; this.say("It's here! The shuttle has landed. Let's go home, Captain.", 'B-07'); audio.setMusic('ending'); }
        if (c.t > 3.5) this.fade = Math.min(1, (c.t - 3.5) / 1.5);
        if (c.t > 5.2 && c.step === 1) {
          c.step = 2;
          clearSave();
          this.onEvent({ type: 'ending' });
        }
        break;
      }
    }
  }

  // ---------------- player actions ----------------
  private currentTool(): 'multitool' | 'pickaxe' {
    const s = this.inv.selectedItem();
    if (s && (s.id === 'pickaxe' || s.id === 'multitool')) return s.id;
    return this.inv.bestTool();
  }

  private handleActions(dt: number): void {
    const inp = this.input;
    const p = this.player;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.placeCd = Math.max(0, this.placeCd - dt);
    this.useCd = Math.max(0, this.useCd - dt);
    for (let i = 1; i <= 9; i++) if (inp.hit(`Digit${i}`)) { this.inv.selected = i - 1; audio.play('click'); }
    if (inp.wheel) this.inv.selected = (this.inv.selected + inp.wheel + 9) % 9;

    const sel = this.inv.selectedItem();
    const def = sel ? ITEMS[sel.id] : null;
    const mwx = inp.mouseX + this.camX, mwy = inp.mouseY + this.camY;
    const tx = Math.floor(mwx / TILE), ty = Math.floor(mwy / TILE);
    const inReach = Math.hypot(tx * TILE + 8 - p.cx, ty * TILE + 8 - p.cy) <= REACH;
    if (Math.abs(mwx - p.cx) > 3) { /* face the cursor while working */ }

    // consumables & blocks
    if (def && (def.kind === 'consumable') && (inp.clickL || inp.clickR) && this.useCd <= 0) {
      this.useConsumable(def.id);
      this.useCd = 0.4;
    } else if (def && def.kind === 'block' && (inp.mouseL || inp.mouseR || inp.clickL || inp.clickR) && this.placeCd <= 0) {
      if (inReach && this.tryPlace(tx, ty, def.id)) { this.placeCd = 0.14; p.action('use', 0.2); p.facing = mwx > p.cx ? 1 : -1; }
      else if (inp.clickL || inp.clickR) { /* invalid placement */ }
      this.mining = null;
    } else if ((inp.mouseL || inp.clickL) && (!def || def.kind !== 'block')) {
      // attack creatures first
      let attacked = false;
      if (this.attackCd <= 0) {
        const target = this.creatures.find((c) => c.state !== 'dead' && (
          (mwx > c.body.x - 6 && mwx < c.body.x + c.body.w + 6 && mwy > c.body.y - 6 && mwy < c.body.y + c.body.h + 6 && Math.hypot(c.body.x - p.cx, c.body.y - p.cy) < REACH) ||
          (Math.abs(c.body.x + c.body.w / 2 - (p.cx + p.facing * 14)) < 16 && Math.abs(c.body.y + c.body.h / 2 - p.cy) < 18 && inp.clickL)
        ));
        if (target) {
          p.facing = target.body.x + target.body.w / 2 > p.cx ? 1 : -1;
          hurtCreature(this, target, this.player.tool === 'pickaxe' ? 2 : 1, p.cx);
          this.attackCd = 0.38;
          p.action('mine', 0.3);
          this.player.energy -= 1;
          attacked = true;
          this.mining = null;
        }
      }
      if (!attacked && this.attackCd <= 0.2) this.mineTile(dt, tx, ty, inReach);
    } else {
      this.mining = null;
    }

    // interaction
    this.updateInteraction(dt);
  }

  private mineTile(dt: number, tx: number, ty: number, inReach: boolean): void {
    const p = this.player;
    const t = this.world.get(tx, ty);
    const def = TILE_DEFS[t];
    if (!inReach || t === T.AIR || def.hardness === Infinity) { this.mining = null; return; }
    if (def.needsPickaxe && p.tool !== 'pickaxe') {
      this.mining = null;
      if (this.input.clickL) { audio.play('error'); this.hint('pickaxe', "That's too hard for the multitool. We need a pickaxe - craft one with [I].", 20, true); }
      return;
    }
    if (!this.mining || this.mining.tx !== tx || this.mining.ty !== ty) this.mining = { tx, ty, p: 0, snd: 0 };
    const speed = (p.tool === 'pickaxe' ? 2.2 : 1) * (p.energy <= 1 ? 0.5 : 1);
    this.mining.p += (dt * speed) / def.hardness;
    this.mining.snd -= dt;
    p.facing = tx * TILE + 8 > p.cx ? 1 : -1;
    p.action('mine', 0.2);
    p.energy -= 1.1 * dt;
    if (this.mining.snd <= 0) {
      this.mining.snd = 0.2;
      audio.play('mine');
      this.particles.burst(tx * TILE + 8, ty * TILE + 8, def.particle, 3, 50);
    }
    if (this.mining.p >= 1) {
      this.breakTile(tx, ty);
      this.mining = null;
    }
  }

  private breakTile(tx: number, ty: number): void {
    const t = this.world.get(tx, ty);
    const def = TILE_DEFS[t];
    this.world.set(tx, ty, T.AIR);
    audio.play('break');
    this.particles.burst(tx * TILE + 8, ty * TILE + 8, def.particle, 10, 80);
    if (def.glow) this.particles.burst(tx * TILE + 8, ty * TILE + 8, '#e0c3ff', 6, 60, { glow: true });
    const d = def.drop;
    if (d && Math.random() < (d.chance ?? 1)) this.spawnDrop(tx * TILE + 8, ty * TILE + 8, d.id, d.min + Math.floor(Math.random() * (d.max - d.min + 1)));
    // fell trees
    if (t === T.TRUNK) {
      let y = ty - 1;
      while (this.world.get(tx, y) === T.TRUNK) {
        this.world.set(tx, y, T.AIR);
        this.spawnDrop(tx * TILE + 8, y * TILE + 8, 'organic', 1);
        this.particles.burst(tx * TILE + 8, y * TILE + 8, '#5b3a6b', 5, 60);
        y--;
      }
      for (let yy = y - 3; yy <= y + 2; yy++) for (let xx = tx - 3; xx <= tx + 3; xx++) {
        if (this.world.get(xx, yy) === T.LEAVES) {
          this.world.set(xx, yy, T.AIR);
          this.particles.burst(xx * TILE + 8, yy * TILE + 8, '#3fa3a0', 3, 40);
          if (Math.random() < 0.3) this.spawnDrop(xx * TILE + 8, yy * TILE + 8, 'organic', 1);
        }
      }
    }
    // unsupported plants / lamps above fall off
    const above = this.world.get(tx, ty - 1);
    if (above === T.PLANT || above === T.TRUNK) this.breakTile(tx, ty - 1);
  }

  private tryPlace(tx: number, ty: number, id: string): boolean {
    const w = this.world;
    const cur = w.get(tx, ty);
    if (cur !== T.AIR && cur !== T.PLANT) return false;
    const tile = ITEMS[id].tile!;
    if (isSolid(tile)) {
      const overlaps = (b: { x: number; y: number; w: number; h: number }) =>
        b.x < tx * TILE + TILE && b.x + b.w > tx * TILE && b.y < ty * TILE + TILE && b.y + b.h > ty * TILE;
      if (overlaps(this.player.body)) return false;
      if (this.creatures.some((c) => c.state !== 'dead' && overlaps(c.body))) return false;
    }
    const supported = [w.get(tx - 1, ty), w.get(tx + 1, ty), w.get(tx, ty - 1), w.get(tx, ty + 1)].some((n) => n !== T.AIR && n !== T.PLANT) || w.back[ty * w.w + tx] === 1;
    if (!supported) return false;
    if (!this.inv.remove(id, 1)) return false;
    w.set(tx, ty, tile);
    audio.play('place');
    this.particles.burst(tx * TILE + 8, ty * TILE + 8, TILE_DEFS[tile].particle, 5, 40);
    if (tile === T.WALL) this.story.flags.wallsPlaced = Number(this.story.flags.wallsPlaced ?? 0) + 1;
    if (tile === T.LIGHT) this.story.flags.lightsPlaced = Number(this.story.flags.lightsPlaced ?? 0) + 1;
    this.shelterTimer = 0;
    this.emitInv();
    return true;
  }

  private useConsumable(id: string): void {
    const p = this.player;
    if (id === 'ration') { p.hunger = Math.min(100, p.hunger + 35); audio.play('eat'); this.hud.toast('+35 FOOD', 'ration'); }
    if (id === 'o2refill') { p.o2 = Math.min(p.maxO2, p.o2 + 50); audio.play('whoosh'); this.hud.toast('+50 OXYGEN', 'o2refill'); }
    if (id === 'repairkit') { p.hp = Math.min(100, p.hp + 45); audio.play('craft'); this.hud.toast('+45 HEALTH', 'repairkit'); }
    this.inv.remove(id, 1);
    p.action('use', 0.3);
    this.particles.burst(p.cx, p.cy, '#9effe6', 8, 40, { glow: true });
    this.emitInv();
  }

  // ---------------- interaction ----------------
  private interactTarget(): { kind: 'obj'; o: WorldObject } | { kind: 'sleep' } | null {
    const p = this.player;
    let best: WorldObject | null = null;
    let bd = 1e9;
    for (const o of this.world.objects) {
      if (o.kind === 'ship') continue;
      if (o.kind === 'blackbox' && this.story.flags.blackbox) continue;
      if ((o.kind === 'crate' || o.kind === 'debris' || o.kind === 'datapad') && this.objState[o.id]) continue;
      const cx = o.tx * TILE + o.w / 2 - (o.kind === 'transmitter' || o.kind === 'beacon' ? 10 : o.kind === 'relay' ? 5 : 0);
      const cy = o.ty * TILE - Math.min(o.h, 24) / 2;
      const dx = Math.abs(cx - p.cx), dy = Math.abs(cy - p.cy);
      if (dx < o.w / 2 + 28 && dy < 34) {
        const d = dx + dy;
        if (d < bd) { bd = d; best = o; }
      }
    }
    if (best) return { kind: 'obj', o: best };
    // light source for sleeping
    const ptx = Math.floor(p.cx / TILE), pty = Math.floor(p.cy / TILE);
    for (let y = pty - 2; y <= pty + 2; y++) for (let x = ptx - 2; x <= ptx + 2; x++) {
      if (this.world.get(x, y) === T.LIGHT && this.sheltered) return { kind: 'sleep' };
    }
    return null;
  }

  private promptFor(o: WorldObject): string {
    const st = this.objState[o.id] ?? 0;
    switch (o.kind) {
      case 'debris': return '[E] SEARCH DEBRIS';
      case 'transmitter':
        if (st === 0) return this.inv.count('metal') >= 3 && this.inv.count('crystal') >= 2 ? '[HOLD E] REPAIR TRANSMITTER' : '[E] INSPECT TRANSMITTER';
        if (st === 1) return '[E] SEND SOS SIGNAL';
        return '[E] CHECK SIGNAL';
      case 'relay': return this.story.day >= 4 && !this.story.flags.relayDecoded ? '[E] DECODE RELAY' : '[E] EXAMINE RELAY';
      case 'terminal': return st ? '[E] READ STATION LOGS' : '[E] RESTORE POWER (3 CRYSTALS)';
      case 'blackbox': return '[E] RECOVER FLIGHT RECORDER';
      case 'crate': return '[E] OPEN CRATE';
      case 'datapad': return '[E] READ DATAPAD';
      case 'beacon':
        if (st) return '';
        return this.story.day >= 10 && this.inv.has('beaconcore') ? '[E] INSTALL BEACON CORE' : '[E] EXAMINE LANDING PAD';
      default: return '[E] INTERACT';
    }
  }

  private updateInteraction(dt: number): void {
    const target = this.interactTarget();
    const inp = this.input;
    this.hud.progress = null;
    if (!target) { this.hud.prompt = null; this.holdE = 0; return; }
    if (target.kind === 'sleep') {
      this.hud.prompt = this.isNight() ? '[E] SLEEP UNTIL DAWN' : null;
      if (this.isNight() && inp.hit('KeyE')) this.trySleep();
      return;
    }
    const o = target.o;
    const prompt = this.promptFor(o);
    this.hud.prompt = prompt || null;
    const st = this.objState[o.id] ?? 0;
    // hold-to-repair transmitter
    if (o.kind === 'transmitter' && st === 0 && this.inv.count('metal') >= 3 && this.inv.count('crystal') >= 2) {
      if (inp.key('KeyE')) {
        this.holdE += dt;
        this.player.action('interact', 0.2);
        this.hud.progress = Math.min(1, this.holdE / 1.8);
        if (Math.random() < 0.4) this.particles.burst(o.tx * TILE, o.ty * TILE - 20, '#ffe08a', 2, 50, { glow: true });
        if (Math.floor(this.holdE * 6) !== Math.floor((this.holdE - dt) * 6)) audio.play('mine');
        if (this.holdE >= 1.8) {
          this.holdE = 0;
          this.inv.remove('metal', 3);
          this.inv.remove('crystal', 2);
          this.objState.transmitter = 1;
          this.story.flags.foundTransmitter = true;
          audio.play('power');
          this.shake(2, 0.3);
          this.particles.burst(o.tx * TILE, o.ty * TILE - 30, '#6ff3ff', 20, 80, { glow: true });
          this.say('Transmitter repaired! Press [E] to send the SOS.');
          this.emitInv();
        }
      } else this.holdE = 0;
      return;
    }
    if (inp.hit('KeyE')) this.interact(o);
  }

  private interact(o: WorldObject): void {
    const st = this.objState[o.id] ?? 0;
    const p = this.player;
    p.action('interact', 0.4);
    p.facing = o.tx * TILE + o.w / 2 > p.cx ? 1 : -1;
    const ox = o.tx * TILE + o.w / 2, oy = o.ty * TILE - o.h / 2;
    switch (o.kind) {
      case 'debris':
        this.objState[o.id] = 1;
        audio.play('break');
        this.spawnDrop(ox, oy, 'metal', 2);
        if (Math.random() < 0.5) this.spawnDrop(ox, oy, 'stone', 1);
        this.particles.burst(ox, oy, '#c3c9da', 10, 70);
        break;
      case 'transmitter':
        if (st === 0) {
          this.story.flags.foundTransmitter = true;
          this.robot.scan();
          this.say(`Repairs need 3 metal scraps (${this.inv.count('metal')}) and 2 energy crystals (${this.inv.count('crystal')}).`);
        } else if (st === 1) {
          this.objState.transmitter = 2;
          this.startCutscene('sos');
        } else {
          this.say(`Signal holding steady. Rescue ETA: ${Math.max(0, 10 - this.story.day + 1)} days.`);
        }
        break;
      case 'relay':
        if (this.story.day >= 4 && !this.story.flags.relayDecoded) {
          this.story.flags.relayDecoded = true;
          this.robot.scan();
          audio.play('transmit');
          this.shake(2, 0.5);
          this.particles.burst(ox, oy, '#b46cff', 24, 90, { glow: true });
          this.say('Decoding... It\'s a looped human distress call, rebroadcast through this alien structure.', 'B-07');
          this.say('"...Kepler Outpost... power failing... do not answer the beacon..." Coordinates attached. Far east.', 'SIGNAL');
        } else {
          this.robot.scan();
          this.say(this.story.flags.relayDecoded ? 'The relay is quiet now. It keeps pointing east, toward the station.' : 'An ancient alien structure. It\'s dormant... for now.');
        }
        break;
      case 'terminal':
        if (!st) {
          if (this.inv.count('crystal') >= 3) {
            this.inv.remove('crystal', 3);
            this.objState.terminal = 1;
            audio.play('power');
            this.shake(3, 0.6);
            const L = LOC.stationL, g = this.world.surface[L + 5];
            for (const x of [L + 4, L + 14, L + 24]) if (this.world.get(x, g - 8) === T.AIR) this.world.set(x, g - 8, T.LIGHT);
            this.say('Power restored! Life support is coming online.');
            this.emitInv();
          } else {
            audio.play('error');
            this.say(`The generator needs 3 energy crystals. You have ${this.inv.count('crystal')}.`);
          }
        } else {
          this.say('LOG 214: The relay keeps amplifying the beacon. Ships hear a safe harbor... and fly straight into the storms.', 'STATION AI');
          this.say('LOG 220: Evacuation complete. The beacon could not be shut down. To anyone who finds this: I am sorry.', 'STATION AI');
        }
        break;
      case 'blackbox':
        this.story.flags.blackbox = true;
        this.inv.add('blackbox', 1);
        audio.play('pickup');
        this.particles.burst(ox, oy, '#ff7a3d', 14, 60, { glow: true });
        this.say('Playing back the final minutes... ARES-7 autopilot locked onto an unknown navigation beacon.', 'B-07');
        this.say('"Override rejected. Override rejected. Navigation slaved to external signal..."', 'FLIGHT REC.');
        this.say('The station\'s beacon pulled us down, Captain. Its lost signal is the reason we crashed. It wasn\'t an accident.', 'B-07');
        this.emitInv();
        break;
      case 'crate': {
        this.objState[o.id] = 1;
        audio.play('pickup');
        const loot: [string, number][] = o.id === 'cacheCrate' ? [['crystal', 3], ['repairkit', 1], ['o2refill', 2]] : o.id === 'stationCrate1' ? [['metal', 4], ['ration', 2]] : [['o2refill', 1], ['crystal', 2], ['metal', 2]];
        for (const [id, n] of loot) this.spawnDrop(ox, oy, id, n);
        this.particles.burst(ox, oy, '#e8c547', 10, 60, { glow: true });
        break;
      }
      case 'datapad': {
        this.objState[o.id] = 1;
        audio.play('click');
        const logs: Record<string, string[]> = {
          logShip: ['CAPTAIN\'S LOG, ARES-7: Cargo run to Kepler colony. Crew in cryo. Picked up an odd beacon near Kepler-186f... probably nothing.'],
          logStation: ['DR. OKAFOR: The crystals resonate with the relay. Every time it pulses, the storms get worse. We should never have powered the beacon.'],
          logCache: ['UNSIGNED: I hid supplies down here for whoever comes next. The creatures fear light. Build walls. Wait for dawn.'],
        };
        for (const l of logs[o.id] ?? ['Corrupted data.']) this.say(l, 'DATAPAD');
        break;
      }
      case 'beacon':
        if (st) break;
        if (this.story.day >= 10 && this.inv.has('beaconcore')) {
          this.inv.remove('beaconcore', 1);
          this.objState.beacon = 1;
          this.rescueT = 0;
          audio.play('power');
          this.shake(4, 0.8);
          this.particles.burst(ox, oy - 20, '#6ff3ff', 30, 120, { glow: true });
          this.say('Beacon online! The shuttle is descending. Hold this position, Captain - the creatures are drawn to the signal!');
          this.emitInv();
        } else if (this.story.day >= 10) {
          this.say('This is the landing zone. We need a Beacon Core - craft one with [I].');
        } else {
          this.say('A flat summit. The rescue shuttle could land here... when the time comes.');
        }
        break;
    }
  }

  private trySleep(): void {
    const s = this.story;
    if (s.def.noSleep && !s.dayComplete) { this.say("We can't sleep now, Captain. Stay alert!"); return; }
    if (!s.dayComplete) {
      const cur = s.current();
      this.say(`Not yet - we still need to: ${cur ? cur.text(this) : 'finish today\'s work'}.`);
      return;
    }
    if (s.day >= 10) return;
    this.startCutscene('sleep');
  }

  // ---------------- systems ----------------
  private survival(dt: number): void {
    const p = this.player;
    if (p.dead || p.state === 'respawn') return;
    // shelter / life-support zones
    this.shelterTimer -= dt;
    if (this.shelterTimer <= 0) {
      this.shelterTimer = 0.4;
      this.sheltered = this.checkShelter();
    }
    const ship = this.world.objects.find((o) => o.id === 'ship')!;
    const shipCx = ship.tx * TILE + ship.w / 2;
    const ptx = Math.floor(p.cx / TILE), pty = Math.floor(p.cy / TILE);
    const inStation = (this.objState.terminal ?? 0) >= 1 && this.world.back[pty * this.world.w + ptx] === 1;
    const nearShip = Math.abs(p.cx - shipCx) < 7 * TILE && Math.abs(p.cy - ship.ty * TILE) < 5 * TILE;
    this.oxygenZone = this.sheltered ? 'shelter' : inStation ? 'station' : nearShip ? 'ship' : null;

    // storm exposure
    const exposed = this.storm.active && !this.sheltered && !inStation && !nearShip && this.skyAbove(p);
    this.storm.exposedPush = exposed;
    this.storm.windForce = exposed ? -260 * this.storm.intensity : 0;

    const o2Drain = 0.55 * (exposed ? 2.5 : 1);
    if (this.oxygenZone) p.o2 = Math.min(p.maxO2, p.o2 + 12 * dt);
    else p.o2 = Math.max(0, p.o2 - o2Drain * dt);
    p.hunger = Math.max(0, p.hunger - 0.2 * dt);
    const still = Math.abs(p.body.vx) < 5 && p.actionT <= 0;
    let e = -0.08;
    if (this.isNight() && !this.sheltered && !inStation) e -= 0.1;
    if (still && p.hunger > 15) e += 2.4;
    if (this.sheltered || inStation) e += 3;
    p.energy = clamp(p.energy + e * dt, 0, 100);
    if (p.o2 <= 0) p.hp -= 5 * dt;
    if (p.hunger <= 0) p.hp -= 1 * dt;
    if (exposed) { p.hp -= 2.5 * dt; if (Math.random() < dt * 3) this.particles.burst(p.cx, p.cy, '#ff9b6b', 2, 40); }
    if (p.hunger > 40 && p.o2 > 20 && p.lastHurt > 4 && !exposed) p.hp = Math.min(100, p.hp + 0.6 * dt);
    if (p.hp <= 0) { p.hp = 0; p.die(this); }

    // contextual warnings
    if (p.o2 / p.maxO2 < 0.25 && !this.oxygenZone) this.hint('o2', 'Oxygen low! Head back to the ship, a lit shelter, or use an Oxygen Refill.', 35, true);
    if (p.hunger < 22) this.hint('hunger', 'Your hunger is critical. Eat a Ration - craft them from organic material.', 60, true);
    if (p.hp < 30) this.hint('hp', 'Suit integrity is low! Use a repair kit or rest somewhere safe.', 45, true);
    if (p.energy < 14) this.hint('energy', "You're exhausted, Captain. Stand still for a moment to recover, or sleep in a shelter.", 70);
    if (exposed) this.hint('exposed', "You're exposed to the storm! Get under cover - a roof over your head!", 12, true);
    if (!this.undergroundHinted && pty > this.world.surface[ptx] + 8) {
      this.undergroundHinted = true;
      this.hint('cave', "It's dark down here. Your helmet lamp only reaches so far - light sources help. Crystals glow in the deep.", 999, true);
    }
  }

  private skyAbove(p: Player): boolean {
    const x0 = Math.floor(p.body.x / TILE), x1 = Math.floor((p.body.x + p.body.w) / TILE);
    const y = Math.floor(p.body.y / TILE);
    for (let x = x0; x <= x1; x++) if (this.world.top[x] > y) return true;
    return false;
  }

  private checkShelter(): boolean {
    const w = this.world, p = this.player;
    const sx = Math.floor(p.cx / TILE), sy = Math.floor((p.body.y + 4) / TILE);
    if (w.solid(sx, sy)) return false;
    const seen = new Set<number>();
    const stack = [sy * w.w + sx];
    let lit = false;
    while (stack.length) {
      const k = stack.pop()!;
      if (seen.has(k)) continue;
      seen.add(k);
      if (seen.size > 220) return false;
      const x = k % w.w, y = Math.floor(k / w.w);
      if (y < w.top[x]) return false; // open to the sky
      if (x <= 1 || x >= w.w - 2) return false;
      if (w.tiles[k] === T.LIGHT) lit = true;
      const nb = [k - 1, k + 1, k - w.w, k + w.w];
      for (const n of nb) if (!seen.has(n) && !isSolid(w.tiles[n])) stack.push(n);
    }
    return lit;
  }

  private storyChecks(): void {
    const s = this.story;
    if (s.day === 1 && !s.flags.foundTransmitter) {
      const tx = this.world.objects.find((o) => o.id === 'transmitter')!;
      if (Math.abs(this.player.cx - (tx.tx * TILE)) < 3 * TILE) s.flags.foundTransmitter = true;
    }
    if (this.inv.has('pickaxe')) s.flags.hadPickaxe = true;
    // rescue defense
    if ((this.objState.beacon ?? 0) >= 1 && !s.flags.shuttleLanded && !this.player.dead) {
      this.rescueT += this.lastDt;
      s.flags.rescueT = Math.floor(this.rescueT);
      if (this.rescueT >= 60) {
        s.flags.shuttleLanded = true;
        s.update(this);
        this.startCutscene('rescue');
      }
    }
  }

  private lastDt = 0;

  private updateEnvironment(dt: number): void {
    this.lastDt = dt;
    const st = this.storm;
    if (st.scheduled && !st.active && !this.story.flags.stormSurvived && this.story.day === 6 && !this.cutscene) {
      st.startsIn -= dt;
      if (st.startsIn <= 0) {
        st.active = true;
        st.remaining = 100;
        audio.play('thunder');
        this.shake(3, 1);
        this.hud.banner('STORM WARNING', 'GET UNDER COVER', 2.6, '#ff9b6b');
      }
    }
    if (st.active) {
      st.remaining -= dt;
      st.intensity = Math.min(1, st.intensity + dt * 0.3);
      if (st.remaining <= 0) {
        st.active = false;
        st.scheduled = false;
        if (!this.player.dead) this.story.flags.stormSurvived = true;
        else { st.scheduled = true; st.startsIn = 20; }
      }
      if (Math.random() < dt * 0.25) { this.lightningFlash = 1; audio.play('thunder'); this.shake(2, 0.4); }
    } else st.intensity = Math.max(0, st.intensity - dt * 0.25);
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3);
    // storm debris particles
    if (st.intensity > 0.05) {
      const n = Math.floor(st.intensity * 9);
      for (let i = 0; i < n; i++) {
        this.particles.add({ x: this.camX + this.W + 10, y: this.camY + Math.random() * this.H, vx: -380 - Math.random() * 200, vy: 40 + Math.random() * 60, max: 2.2, color: Math.random() < 0.3 ? '#c9a0ff' : '#8a7aa8', size: Math.random() < 0.3 ? 2 : 1 });
      }
    }
    // ambient fireflies / spores
    if (Math.random() < dt * 3 * (0.3 + this.nightFactor())) {
      this.particles.add({ x: this.camX + Math.random() * this.W, y: this.camY + Math.random() * this.H, vx: (Math.random() - 0.5) * 8, vy: -4 - Math.random() * 6, max: 3 + Math.random() * 2, color: Math.random() < 0.5 ? '#9effe6' : '#ff8ae6', glow: true, fade: true });
    }
    // alien chirps in the daytime, growls at night
    this.chirpT -= dt;
    if (this.chirpT <= 0) {
      this.chirpT = 4 + Math.random() * 8;
      if (!this.isNight()) audio.alienChirp();
    }
    // spawning
    this.spawnT -= dt;
    if (this.spawnT <= 0 && !this.cutscene) {
      this.spawnT = this.story.day === 9 && this.isNight() ? 2.5 : (this.objState.beacon ?? 0) >= 1 ? 2.2 : 4.5;
      this.trySpawn();
    }
  }

  private trySpawn(): void {
    const s = this.story;
    const p = this.player;
    const hostiles = this.creatures.filter((c) => c.hostile && c.state !== 'dead').length;
    const glims = this.creatures.filter((c) => !c.hostile && c.state !== 'dead').length;
    const night = this.isNight();
    const ptx = Math.floor(p.cx / TILE), pty = Math.floor(p.cy / TILE);
    const underground = pty > this.world.surface[ptx] + 6;
    const defending = (this.objState.beacon ?? 0) >= 1 && !s.flags.shuttleLanded;
    let cap = 0;
    if (s.day >= 3 && !this.storm.active) {
      if (night) cap = s.day === 9 ? 11 : 2 + Math.floor(s.day * 0.5);
      else if (s.day === 3 && !s.dayComplete) cap = 3;
      if (underground) cap = Math.max(cap, 2);
      if (defending) cap = 7;
    }
    if (hostiles < cap) {
      const kind: CKind = (s.day >= 4 && (night || defending) && Math.random() < 0.35) ? 'wing' : 'crawler';
      this.spawnNear(kind, underground && !defending);
    }
    if (!night && !this.storm.active && glims < 5 && !underground && Math.random() < 0.6) this.spawnNear('glimmer', false);
    // despawn far creatures
    this.creatures = this.creatures.filter((c) => Math.abs(c.body.x - p.cx) < 60 * TILE);
  }

  private spawnNear(kind: CKind, cave: boolean): void {
    const p = this.player;
    const w = this.world;
    for (let attempt = 0; attempt < 8; attempt++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const tx = Math.floor(p.cx / TILE) + dir * (22 + Math.floor(Math.random() * 14));
      if (tx < 4 || tx > w.w - 5) continue;
      let feet = -1;
      if (cave) {
        const pty = Math.floor(p.cy / TILE);
        for (let y = pty - 8; y < pty + 10; y++) {
          if (!w.solid(tx, y) && !w.solid(tx, y - 1) && w.solid(tx, y + 1) && y > w.top[tx]) { feet = (y + 1) * TILE; break; }
        }
      } else {
        const gy = w.groundY(tx);
        if (!w.solid(tx, gy - 1) && !w.solid(tx, gy - 2)) feet = gy * TILE;
      }
      if (feet < 0) continue;
      if (kind === 'wing') feet -= 4 * TILE;
      // never spawn on top of the player or inside the station
      if (Math.abs(tx * TILE - p.cx) < 18 * TILE) continue;
      if (w.back[Math.floor(feet / TILE - 1) * w.w + tx] === 1) continue;
      this.creatures.push(spawnCreature(kind, tx * TILE + 8, feet));
      return;
    }
  }

  private updateCreatures(dt: number): void {
    for (const c of this.creatures) updateCreature(this, c, dt);
    this.creatures = this.creatures.filter((c) => !(c.state === 'dead' && c.t > 1.2));
  }

  spawnDrop(x: number, y: number, id: string, n: number): void {
    for (let i = 0; i < n; i++) {
      this.drops.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -80 - Math.random() * 60, id, n: 1, t: 0 });
    }
  }

  private updateDrops(dt: number): void {
    const p = this.player;
    const keep: Drop[] = [];
    for (const d of this.drops) {
      d.t += dt;
      const dx = p.cx - d.x, dy = p.cy - d.y;
      const dist = Math.hypot(dx, dy);
      if (d.t > 0.35 && dist < 80 && !p.dead) {
        d.vx += (dx / dist) * 900 * dt;
        d.vy += (dy / dist) * 900 * dt;
        d.vx *= 0.9; d.vy *= 0.9;
      } else {
        d.vy += 500 * dt;
      }
      d.x += d.vx * dt;
      if (this.world.solidAtPx(d.x, d.y)) { d.x -= d.vx * dt; d.vx *= -0.3; }
      d.y += d.vy * dt;
      if (this.world.solidAtPx(d.x, d.y + 3) && d.vy > 0 && !(d.t > 0.35 && dist < 80)) { d.y = Math.floor((d.y + 3) / TILE) * TILE - 3; d.vy = 0; d.vx *= 0.8; }
      if (d.t > 0.35 && dist < 10 && !p.dead) {
        const left = this.inv.add(d.id, d.n);
        if (left === 0) {
          audio.play('pickup');
          this.hud.toast(`+1 ${ITEMS[d.id].name}`, d.id);
          this.emitInv();
          continue;
        }
      }
      if (d.t < 300) keep.push(d);
    }
    this.drops = keep;
  }

  private updateCamera(dt: number): void {
    const c = this.cutscene;
    const p = this.player;
    let tx = p.cx + p.facing * 22 - this.W / 2;
    let ty = p.cy - this.H * 0.55;
    if (c && c.kind === 'wake') {
      const k = clamp((c.t - 0.5) / 3.5, 0, 1);
      const e = k * k * (3 - 2 * k);
      const trans = this.world.objects.find((o) => o.id === 'transmitter')!;
      tx = lerp(trans.tx * TILE - this.W / 2, p.cx - this.W / 2, e);
      ty = lerp(trans.ty * TILE - this.H * 0.75, p.cy - this.H * 0.55, e);
      this.camX = tx; this.camY = ty;
    } else if (c && c.kind === 'sos') {
      const trans = this.world.objects.find((o) => o.id === 'transmitter')!;
      tx = trans.tx * TILE - this.W / 2;
      ty = trans.ty * TILE - this.H * 0.7 - Math.min(40, c.t * 8);
    }
    const k = c && c.kind === 'wake' ? 1 : 1 - Math.exp(-dt * 6);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.camX = clamp(this.camX, 0, this.world.w * TILE - this.W);
    this.camY = clamp(this.camY, -80, this.world.h * TILE - this.H);
    if (!c || c.kind !== 'sos') this.letterbox = Math.max(0, this.letterbox - dt * 1.5);
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT <= 0) this.shakeAmt = 0;
  }

  private snapCamera(): void {
    const p = this.player;
    this.camX = clamp(p.cx - this.W / 2, 0, this.world.w * TILE - this.W);
    this.camY = clamp(p.cy - this.H * 0.55, -80, this.world.h * TILE - this.H);
  }

  private updateAudio(): void {
    const p = this.player;
    const ptx = Math.floor(p.cx / TILE), pty = Math.floor(p.cy / TILE);
    const surface = pty <= this.world.surface[ptx] + 2;
    audio.setAmbient(surface ? 1 : 0.25, this.storm.intensity * (surface ? 1 : 0.4));
    if (this.cutscene?.kind === 'rescue') return;
    const defending = (this.objState.beacon ?? 0) >= 1;
    if (this.storm.active || defending || (this.story.day === 9 && this.isNight())) audio.setMusic('tense');
    else audio.setMusic(this.isNight() ? 'night' : 'day');
  }

  // ---------------- rendering ----------------
  private render(): void {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.imageSmoothingEnabled = false;
    let sx = 0, sy = 0;
    if (this.shakeT > 0) { sx = (Math.random() - 0.5) * 2 * this.shakeAmt; sy = (Math.random() - 0.5) * 2 * this.shakeAmt; }
    const camX = Math.round(this.camX + sx), camY = Math.round(this.camY + sy);
    drawBackground(this, ctx);
    drawBackTiles(this, ctx, camX, camY);
    // objects sit between the cave/station back walls and the terrain
    for (const o of this.world.objects) {
      const ox = o.tx * TILE - camX;
      if (ox > W + 40 || ox + o.w < -40) continue;
      drawObject(this, ctx, o, camX, camY);
    }
    drawTiles(this, ctx, camX, camY);
    if (this.mining) {
      const st = Math.min(3, Math.floor(this.mining.p * 4));
      ctx.drawImage(this.assets.crack[st], this.mining.tx * TILE - camX, this.mining.ty * TILE - camY);
    }
    // shuttle (rescue)
    if ((this.objState.beacon ?? 0) >= 1) this.drawShuttle(ctx, camX, camY);
    for (const d of this.drops) {
      const bob = Math.sin(this.elapsed * 6 + d.x) * 1;
      ctx.drawImage(this.assets.icons[d.id], 0, 0, 16, 16, Math.round(d.x - 5 - camX), Math.round(d.y - 8 + bob - camY), 10, 10);
    }
    for (const c of this.creatures) drawCreature(this, c, ctx, camX, camY);
    this.player.draw(this, ctx, camX, camY);
    this.robot.draw(this, ctx, camX, camY);
    this.particles.draw(ctx, camX, camY);
    drawLighting(this, ctx, camX, camY);
    if (this.lightningFlash > 0) {
      ctx.fillStyle = `rgba(230,220,255,${this.lightningFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    // cursor / reach indicator
    if (!this.cutscene && !this.player.dead && !this.paused) this.drawCursor(ctx, camX, camY);
    this.drawWaypoint(ctx, camX, camY);
    // letterbox
    if (this.letterbox > 0) {
      const h = Math.round(26 * this.letterbox);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, h);
      ctx.fillRect(0, H - h, W, h);
    }
    this.hud.draw(this, ctx);
    if (this.player.dead && this.cutscene?.kind === 'death' && this.cutscene.t > 0.8 && this.cutscene.t < 2.6) {
      drawText(ctx, 'SIGNAL LOST', W / 2, H / 2 - 10, { align: 'center', scale: 3, color: '#ff5a6e' });
      drawText(ctx, 'B-07 IS DRAGGING YOU BACK TO THE SHIP...', W / 2, H / 2 + 20, { align: 'center', color: '#c8c3e8' });
    }
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
      ctx.fillRect(0, 0, W, H);
      if (this.cutscene?.kind === 'sleep' && this.fade > 0.8) drawText(ctx, 'SLEEPING...', W / 2, H / 2, { align: 'center', scale: 2, color: '#c8c3e8' });
    }
  }

  private drawShuttle(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const b = this.world.objects.find((o) => o.id === 'beacon')!;
    const k = clamp(this.rescueT / 60, 0, 1);
    const e = 1 - Math.pow(1 - k, 2);
    const x = b.tx * TILE + 16 - 36;
    const y = lerp(b.ty * TILE - 520, b.ty * TILE - 96, e);
    const sx = Math.round(x - camX), sy = Math.round(y - camY + Math.sin(this.elapsed * 2) * 2);
    ctx.drawImage(this.assets.shuttle, sx, sy);
    ctx.globalCompositeOperation = 'lighter';
    for (const fx of [15, 53]) {
      const fl = 6 + Math.random() * 8;
      ctx.fillStyle = 'rgba(255,170,80,0.8)';
      ctx.fillRect(sx + fx, sy + 40, 3, Math.round(fl));
      ctx.drawImage(this.assets.glow.cyan, sx + fx - 22, sy + 30);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawCursor(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const inp = this.input;
    const mwx = inp.mouseX + camX, mwy = inp.mouseY + camY;
    const tx = Math.floor(mwx / TILE), ty = Math.floor(mwy / TILE);
    const p = this.player;
    const inReach = Math.hypot(tx * TILE + 8 - p.cx, ty * TILE + 8 - p.cy) <= REACH;
    const t = this.world.get(tx, ty);
    const sel = this.inv.selectedItem();
    const placing = sel && ITEMS[sel.id].kind === 'block';
    if (!inReach) return;
    let col = 'rgba(255,255,255,0.7)';
    if (!placing && t !== T.AIR) {
      const d = TILE_DEFS[t];
      if (d.hardness === Infinity || (d.needsPickaxe && p.tool !== 'pickaxe')) col = 'rgba(255,80,100,0.8)';
    }
    if (!placing && t === T.AIR) return;
    if (placing && t !== T.AIR && t !== T.PLANT) col = 'rgba(255,80,100,0.6)';
    const x = tx * TILE - camX, y = ty * TILE - camY;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
    if (placing && (t === T.AIR || t === T.PLANT)) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.assets.tiles[ITEMS[sel!.id].tile!][0], x, y);
      ctx.globalAlpha = 1;
    }
  }

  private drawWaypoint(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (this.hudHidden || this.cutscene) return;
    const o = this.story.current();
    const tgt = o?.target?.(this);
    if (!tgt) return;
    const sx = tgt.x - camX, sy = tgt.y - camY;
    const W = this.W, H = this.H;
    const dist = Math.round(Math.hypot(tgt.x - this.player.cx, tgt.y - this.player.cy) / TILE);
    const bob = Math.round(Math.sin(this.elapsed * 5) * 2);
    if (sx > 20 && sx < W - 20 && sy > 20 && sy < H - 40) {
      // on-screen marker
      const y = sy - 30 + bob;
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(Math.round(sx) - 3, y, 7, 2);
      ctx.fillRect(Math.round(sx) - 2, y + 2, 5, 2);
      ctx.fillRect(Math.round(sx) - 1, y + 4, 3, 2);
      ctx.fillRect(Math.round(sx), y + 6, 1, 1);
      return;
    }
    const cx = W / 2, cy = H / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const ex = clamp(cx + Math.cos(ang) * 1000, 24, W - 24);
    const ey = clamp(cy + Math.sin(ang) * 1000, 90, H - 50);
    ctx.save();
    ctx.translate(Math.round(ex), Math.round(ey));
    ctx.rotate(ang);
    ctx.fillStyle = '#0b0816';
    ctx.fillRect(-2, -5, 12, 11);
    ctx.fillStyle = '#ffe08a';
    for (let i = 0; i < 5; i++) ctx.fillRect(i * 2, -4 + i, 2, 9 - i * 2);
    ctx.restore();
    drawText(ctx, `${dist}M`, Math.round(ex - Math.cos(ang) * 16), Math.round(ey - Math.sin(ang) * 14) - 3, { align: 'center', color: '#ffe08a' });
  }

  // ---------------- save / UI API ----------------
  saveGame(): void {
    if (this.player.dead) return;
    const p = this.player;
    const data: SaveData = {
      version: 1,
      seed: this.world.seed,
      day: this.story.day,
      time: this.time,
      player: { x: p.body.x, y: p.body.y, hp: p.hp, o2: p.o2, hunger: p.hunger, energy: p.energy, maxO2: p.maxO2 },
      inventory: this.inv.serialize(),
      selected: this.inv.selected,
      story: this.story.serialize(),
      diffs: [...this.world.diffs.entries()],
      objectState: { ...this.objState },
      savedAt: Date.now(),
    };
    if (writeSave(data)) this.onEvent({ type: 'saved' });
  }

  private emitInv(): void {
    this.onEvent({ type: 'inventory' });
  }

  snapshot(): InvSnapshot {
    return {
      slots: this.inv.serialize(),
      selected: this.inv.selected,
      day: this.story.day,
      recipes: RECIPES.map((r: Recipe) => ({
        id: r.id, out: r.out, qty: r.qty, needs: r.needs,
        locked: (r.minDay ?? 0) > this.story.day,
        can: this.inv.canCraft(r) && (r.minDay ?? 0) <= this.story.day && !(r.out === 'suitupgrade' && this.story.flags.suitUpgraded) && !(r.out === 'pickaxe' && this.inv.has('pickaxe')),
      })),
    };
  }

  craft(id: string): boolean {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return false;
    if ((r.minDay ?? 0) > this.story.day || !this.inv.canCraft(r)) { audio.play('error'); return false; }
    if (r.out === 'suitupgrade' && this.story.flags.suitUpgraded) return false;
    if (r.out === 'pickaxe' && this.inv.has('pickaxe')) return false;
    for (const [k, n] of Object.entries(r.needs)) this.inv.remove(k, n);
    if (r.out === 'suitupgrade') {
      this.story.flags.suitUpgraded = true;
      this.player.maxO2 = 150;
      this.player.o2 = 150;
    } else {
      const left = this.inv.add(r.out, r.qty);
      if (left > 0) this.spawnDrop(this.player.cx, this.player.cy, r.out, left);
    }
    if (r.out === 'beaconcore') this.story.flags.craftedCore = true;
    if (r.out === 'repairkit') this.story.flags.craftedRepair = true;
    audio.play('craft');
    this.emitInv();
    return true;
  }

  swapSlots(a: number, b: number): void {
    this.inv.swap(a, b);
    this.emitInv();
  }

  selectSlot(i: number): void {
    if (i >= 0 && i < 9) this.inv.selected = i;
    this.emitInv();
  }
}
