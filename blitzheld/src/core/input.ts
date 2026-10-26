/**
 * Eine einzige Aktionstaste: Leertaste, Pfeil nach oben, W, Mausklick oder Tippen.
 * Tastendrücke werden gesammelt und von der Simulation pro Schritt abgeholt (consume),
 * damit auch sehr kurze Tipps zwischen zwei Bildern nicht verloren gehen.
 */

export interface InputSample {
  pressed: boolean;
  held: boolean;
}

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);

export class InputController {
  private pendingPress = false;
  private keysDown = new Set<string>();
  private pointersDown = new Set<number>();
  private enabled = false;
  private readonly cleanup: (() => void)[] = [];
  /** Wird bei jedem neuen Druck aufgerufen (z. B. für den Ton-Freischalter, Bosskampf). */
  onPress: (() => void) | null = null;
  /** Pause per Escape oder P. */
  onPause: (() => void) | null = null;
  /** Jeder Druck zählt (für Tests). */
  pressCount = 0;

  attach(target: HTMLElement): void {
    const keydown = (e: KeyboardEvent): void => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.enabled && !e.repeat) this.onPause?.();
        return;
      }
      if (!JUMP_KEYS.has(e.code)) return;
      // Leertaste und Pfeile sollen die Seite nicht scrollen und keine Buttons auslösen.
      if (this.enabled) e.preventDefault();
      if (e.repeat || !this.enabled) return;
      this.keysDown.add(e.code);
      this.press();
    };
    const keyup = (e: KeyboardEvent): void => {
      this.keysDown.delete(e.code);
    };
    const pointerdown = (e: PointerEvent): void => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      this.pointersDown.add(e.pointerId);
      this.press();
    };
    const pointerup = (e: PointerEvent): void => {
      this.pointersDown.delete(e.pointerId);
    };
    const blur = (): void => {
      this.keysDown.clear();
      this.pointersDown.clear();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    target.addEventListener('pointerdown', pointerdown);
    window.addEventListener('pointerup', pointerup);
    window.addEventListener('pointercancel', pointerup);
    window.addEventListener('blur', blur);
    this.cleanup.push(
      () => window.removeEventListener('keydown', keydown),
      () => window.removeEventListener('keyup', keyup),
      () => target.removeEventListener('pointerdown', pointerdown),
      () => window.removeEventListener('pointerup', pointerup),
      () => window.removeEventListener('pointercancel', pointerup),
      () => window.removeEventListener('blur', blur),
    );
  }

  /** Zusätzliche Sprungfläche (großer Touch-Knopf). */
  attachButton(el: HTMLElement): void {
    const down = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.enabled) return;
      this.pointersDown.add(e.pointerId);
      this.press();
    };
    el.addEventListener('pointerdown', down);
    this.cleanup.push(() => el.removeEventListener('pointerdown', down));
  }

  private press(): void {
    this.pendingPress = true;
    this.pressCount++;
    this.onPress?.();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.reset();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get held(): boolean {
    return this.keysDown.size > 0 || this.pointersDown.size > 0;
  }

  /** Liefert den Druck seit dem letzten Aufruf genau einmal. */
  consume(): InputSample {
    const pressed = this.pendingPress;
    this.pendingPress = false;
    return { pressed, held: this.held || pressed };
  }

  /** Verwirft gesammelte Drücke (z. B. nach dem Mathefenster). */
  reset(): void {
    this.pendingPress = false;
    this.keysDown.clear();
    this.pointersDown.clear();
  }

  destroy(): void {
    for (const c of this.cleanup) c();
    this.cleanup.length = 0;
  }
}
