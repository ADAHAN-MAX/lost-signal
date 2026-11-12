export class Input {
  down = new Set<string>();
  pressed = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  mouseL = false;
  mouseR = false;
  clickL = false;
  clickR = false;
  wheel = 0;
  enabled = true;
  private handlers: [EventTarget, string, EventListener][] = [];

  constructor(private canvas: HTMLCanvasElement, private viewW: () => number, private viewH: () => number) {
    const on = (t: EventTarget, ev: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      t.addEventListener(ev, fn, opts);
      this.handlers.push([t, ev, fn]);
    };
    on(window, 'keydown', ((e: KeyboardEvent) => {
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    }) as EventListener);
    on(window, 'keyup', ((e: KeyboardEvent) => { this.down.delete(e.code); }) as EventListener);
    on(window, 'blur', () => { this.down.clear(); this.mouseL = false; this.mouseR = false; });
    on(canvas, 'mousemove', ((e: MouseEvent) => this.updateMouse(e)) as EventListener);
    on(canvas, 'mousedown', ((e: MouseEvent) => {
      this.updateMouse(e);
      if (e.button === 0) { this.mouseL = true; this.clickL = true; }
      if (e.button === 2) { this.mouseR = true; this.clickR = true; }
    }) as EventListener);
    on(window, 'mouseup', ((e: MouseEvent) => {
      if (e.button === 0) this.mouseL = false;
      if (e.button === 2) this.mouseR = false;
    }) as EventListener);
    on(canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    on(canvas, 'wheel', ((e: WheelEvent) => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }) as EventListener, { passive: false });
  }

  private updateMouse(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = ((e.clientX - r.left) / r.width) * this.viewW();
    this.mouseY = ((e.clientY - r.top) / r.height) * this.viewH();
  }

  key(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  hit(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  endFrame(): void {
    this.pressed.clear();
    this.clickL = false;
    this.clickR = false;
    this.wheel = 0;
  }

  reset(): void {
    this.down.clear();
    this.pressed.clear();
    this.mouseL = this.mouseR = false;
  }

  destroy(): void {
    for (const [t, ev, fn] of this.handlers) t.removeEventListener(ev, fn);
    this.handlers = [];
  }
}
