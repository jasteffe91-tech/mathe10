import { TIMING } from '../config/gameConfig';
import { taskText } from '../math/mathTasks';
import type { MathChallenge } from '../math/mathChallenge';
import { LEVELS_PER_WORLD, levelId, type ProgressStore } from '../progress/saveData';
import { WORLD_NAMES, WORLD_THEMES, LEVEL_NAMES } from '../levels/catalog';
import { bossForWorld } from '../boss/bossConfig';
import { ICONS, type IconName } from './icons';

/**
 * DOM-Oberfläche: Menüs, HUD, Pause, Mathefenster, Abschlussbildschirme.
 * Sie kennt keine Spiellogik – alle Knöpfe melden nur eine Aktion an den GameController.
 */

export type UIAction =
  | { type: 'play' }
  | { type: 'worlds' }
  | { type: 'help' }
  | { type: 'back' }
  | { type: 'sound' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'menu' }
  | { type: 'next' }
  | { type: 'replay' }
  | { type: 'reset' }
  | { type: 'confirm-yes' }
  | { type: 'confirm-no' }
  | { type: 'math-revive' }
  | { type: 'math-restart' }
  | { type: 'rotate-ok' }
  | { type: 'stage'; world: number; kind: 'level' | 'boss'; index: number }
  | { type: 'help-mode'; on: boolean };

export type ScreenId = 'menu' | 'worlds' | 'help' | 'pause' | 'math' | 'complete' | 'gamecomplete' | 'confirm' | 'rotate';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} fehlt`);
  return el as T;
};

export interface CompleteSummary {
  title: string;
  /** Sterne dieses Levels: 'new' = gerade gesammelt, 'old' = früher gesammelt, 'none' = fehlt. */
  stars: ('new' | 'old' | 'none')[] | null;
  lines: { html: string; record?: boolean }[];
  nextLabel: string | null;
}

export class UI {
  private handler: (a: UIAction) => void = () => {};
  private screens: Record<ScreenId, HTMLElement>;
  private visible = new Set<ScreenId>();
  private toastTimer = 0;
  private readyTimer = 0;
  private lastLives = -1;
  private lastCoins = -1;
  private lastProgress = -1;
  private math: {
    challenge: MathChallenge;
    onDone: () => void;
    onSound: (correct: boolean) => void;
    busy: boolean;
    timer: number;
  } | null = null;
  readonly isTouch: boolean;

  constructor() {
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.screens = {
      menu: $('screen-menu'),
      worlds: $('screen-worlds'),
      help: $('screen-help'),
      pause: $('screen-pause'),
      math: $('screen-math'),
      complete: $('screen-complete'),
      gamecomplete: $('screen-gamecomplete'),
      confirm: $('dialog-confirm'),
      rotate: $('rotate-hint'),
    };
    this.fillIcons(document.body);
    this.buildPad();

    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!target || (target as HTMLButtonElement).disabled) return;
      const action = target.dataset.action as string;
      if (action === 'stage') {
        this.emit({
          type: 'stage',
          world: Number(target.dataset.world),
          kind: target.dataset.kind === 'boss' ? 'boss' : 'level',
          index: Number(target.dataset.index ?? 0),
        });
      } else {
        this.emit({ type: action } as UIAction);
      }
    });
    // Klicks auf HUD-Knöpfe dürfen keinen Sprung auslösen.
    $('btn-pause').addEventListener('pointerdown', (e) => e.stopPropagation());

    $<HTMLInputElement>('opt-help').addEventListener('change', (e) => {
      this.emit({ type: 'help-mode', on: (e.target as HTMLInputElement).checked });
    });

    // Mathefenster: Tastatur
    const input = $<HTMLInputElement>('math-input');
    if (this.isTouch) input.readOnly = true; // Bildschirmtastatur des Spiels statt der des Geräts
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 2);
      this.updateCheckButton();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) this.submitMath();
      }
    });
    $('math-check').addEventListener('click', () => this.submitMath());
    // Ziffern auch dann annehmen, wenn das Eingabefeld gerade nicht fokussiert ist.
    window.addEventListener('keydown', (e) => {
      if (!this.math || !this.visible.has('math') || document.activeElement === input) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        this.padPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        this.padPress('del');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) this.submitMath();
      }
    });
  }

  onAction(h: (a: UIAction) => void): void {
    this.handler = h;
  }

  private emit(a: UIAction): void {
    this.handler(a);
  }

  fillIcons(root: ParentNode): void {
    root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
      const name = el.dataset.icon as IconName;
      if (ICONS[name] && !el.firstChild) el.innerHTML = ICONS[name];
    });
  }

  // ---------------------------------------------------------------- Bildschirme

  show(id: ScreenId): void {
    this.screens[id].classList.remove('hidden');
    this.visible.add(id);
    // Fokus auf den ersten Knopf, damit Tastaturbedienung funktioniert (nicht beim Mathefenster).
    if (id !== 'math') {
      const first = this.screens[id].querySelector<HTMLElement>('.btn-play, .btn');
      first?.focus({ preventScroll: true });
    }
  }

  hide(id: ScreenId): void {
    this.screens[id].classList.add('hidden');
    this.visible.delete(id);
  }

  hideAll(): void {
    (Object.keys(this.screens) as ScreenId[]).forEach((id) => this.hide(id));
  }

  isVisible(id: ScreenId): boolean {
    return this.visible.has(id);
  }

  setSoundLabel(on: boolean): void {
    document.querySelectorAll<HTMLElement>('.btn-sound').forEach((b) => {
      const icon = b.querySelector<HTMLElement>('.sound-icon');
      const label = b.querySelector<HTMLElement>('.sound-label');
      if (icon) icon.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
      if (label) label.textContent = on ? 'Ton an' : 'Ton aus';
      b.setAttribute('aria-pressed', String(on));
    });
  }

  setHelpMode(on: boolean): void {
    $<HTMLInputElement>('opt-help').checked = on;
  }

  renderMenu(progress: ProgressStore): void {
    const d = progress.data;
    const trophies = d.bossesDefeated.length;
    $('menu-stats').innerHTML =
      `<span title="Münzen">${ICONS.coin}${d.totalCoins}</span>` +
      `<span title="Sterne">${ICONS.star}${progress.totalStars} / 36</span>` +
      `<span title="Boss-Trophäen">${ICONS.trophy}${trophies} / 4</span>`;
    const play = this.screens.menu.querySelector('.btn-play span:last-child');
    const started = Object.keys(d.levels).length > 0;
    if (play) play.textContent = started ? 'Weiterspielen' : 'Spielen';
  }

  renderWorlds(progress: ProgressStore): void {
    const list = $('world-list');
    list.innerHTML = '';
    for (let w = 0; w < 4; w++) {
      const unlocked = progress.isWorldUnlocked(w);
      const card = document.createElement('div');
      card.className = `world-card ${WORLD_THEMES[w]}${unlocked ? '' : ' locked'}`;
      let html = `<h3>${w + 1}. ${WORLD_NAMES[w]}</h3><div class="world-levels">`;
      for (let i = 0; i < LEVELS_PER_WORLD; i++) {
        const id = levelId(w, i);
        const rec = progress.record(id);
        const open = progress.isLevelUnlocked(w, i);
        const stars = [0, 1, 2].map((s) => (rec.stars.includes(s) ? ICONS.star : ICONS.starEmpty)).join('');
        html +=
          `<button class="lvl-btn${rec.completed ? ' done' : ''}" type="button" data-action="stage" data-world="${w}" data-kind="level" data-index="${i}"` +
          `${open ? '' : ' disabled'} aria-label="Level ${id}: ${LEVEL_NAMES[w][i]}" title="${LEVEL_NAMES[w][i]}">` +
          `<span>${open ? id : ICONS.lock}</span><span class="lvl-stars">${stars}</span></button>`;
      }
      const bossOpen = progress.isBossUnlocked(w);
      const beaten = progress.isBossDefeated(w);
      const boss = bossForWorld(w);
      html +=
        `<button class="lvl-btn boss${beaten ? ' done' : ''}" type="button" data-action="stage" data-world="${w}" data-kind="boss" data-index="0"` +
        `${bossOpen ? '' : ' disabled'} aria-label="Boss: ${boss.title}" title="${boss.title}">` +
        `<span>${bossOpen ? ICONS.crown : ICONS.lock}</span><span class="lvl-stars">Boss</span></button>`;
      html += '</div><div class="world-awards">';
      if (progress.hasWorldBadge(w)) html += `<span title="Welt-Abzeichen">${ICONS.badge}</span>`;
      if (beaten) html += `<span title="Boss-Trophäe">${ICONS.trophy}</span>`;
      html += `<span>${ICONS.star} ${progress.starsInWorld(w)}/9</span></div>`;
      if (!unlocked) html += `<div class="world-lock">${ICONS.lock}</div>`;
      card.innerHTML = html;
      list.appendChild(card);
    }
  }

  // ---------------------------------------------------------------- HUD

  showHud(show: boolean): void {
    $('hud').classList.toggle('hidden', !show);
    $('btn-jump').classList.toggle('hidden', !(show && this.isTouch));
  }

  setHudMode(mode: 'level' | 'boss'): void {
    $('hud-progress').classList.toggle('hidden', mode !== 'level');
    $('boss-bar').classList.toggle('hidden', mode !== 'boss');
    $('hud-energy').classList.toggle('hidden', mode !== 'boss');
  }

  setLabel(text: string): void {
    $('hud-label').textContent = text;
  }

  setLives(lives: number, max: number): void {
    if (lives === this.lastLives) return;
    const lost = this.lastLives > lives;
    this.lastLives = lives;
    const el = $('hud-hearts');
    let html = '';
    for (let i = 0; i < max; i++) {
      const cls = lost && i === lives ? ' class="lost"' : '';
      html += `<span${cls}>${i < lives ? ICONS.heart : ICONS.heartEmpty}</span>`;
    }
    el.innerHTML = html;
    el.setAttribute('aria-label', `${lives} von ${max} Herzen`);
  }

  setCoins(coins: number): void {
    if (coins === this.lastCoins) return;
    const bump = coins > this.lastCoins && this.lastCoins >= 0;
    this.lastCoins = coins;
    $('hud-coins').textContent = String(coins);
    if (bump) {
      const box = $('hud-coins').parentElement;
      if (box) {
        box.classList.remove('bump');
        void box.offsetWidth;
        box.classList.add('bump');
      }
    }
  }

  setProgress(p: number): void {
    const v = Math.round(p * 200) / 2;
    if (v === this.lastProgress) return;
    this.lastProgress = v;
    $('hud-progress-bar').style.width = `${v}%`;
  }

  setBoss(name: string, hp: number, maxHp: number): void {
    $('boss-name').textContent = name;
    let html = '';
    for (let i = 0; i < maxHp; i++) html += `<span class="${i < hp ? '' : 'gone'}"></span>`;
    $('boss-hp').innerHTML = html;
    $('boss-hp').setAttribute('aria-label', `Boss: ${hp} von ${maxHp}`);
  }

  setEnergy(energy: number, max: number): void {
    let html = '';
    for (let i = 0; i < max; i++) html += i < energy ? ICONS.bolt : ICONS.boltEmpty;
    $('hud-energy').innerHTML = html;
  }

  resetHudCache(): void {
    this.lastLives = -1;
    this.lastCoins = -1;
    this.lastProgress = -1;
  }

  /** Großer Text in der Mitte („Bereit?“, „Los!“). null = ausblenden. */
  ready(text: string | null, small = false): void {
    const el = $('ready-text');
    window.clearTimeout(this.readyTimer);
    if (!text) {
      el.classList.add('hidden');
      return;
    }
    el.textContent = text;
    el.classList.toggle('small', small);
    el.classList.remove('hidden');
    // Animation neu starten
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  flashReady(text: string, ms: number, small = false): void {
    this.ready(text, small);
    this.readyTimer = window.setTimeout(() => this.ready(null), ms);
  }

  startHint(show: boolean): void {
    const el = $('start-hint');
    el.textContent = this.isTouch ? 'Tippe zum Springen!' : 'Drücke LEERTASTE zum Springen!';
    el.classList.toggle('hidden', !show);
  }

  toast(text: string, ms = 2200): void {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ---------------------------------------------------------------- Mathefenster

  private buildPad(): void {
    const pad = $('math-pad');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'clear'];
    pad.innerHTML = keys
      .map((k) => {
        if (k === 'del') return `<button class="pad-btn del" type="button" data-key="del" aria-label="Löschen">${ICONS.backspace}</button>`;
        if (k === 'clear') return `<button class="pad-btn del" type="button" data-key="clear" aria-label="Alles löschen">C</button>`;
        return `<button class="pad-btn" type="button" data-key="${k}">${k}</button>`;
      })
      .join('');
    pad.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (b) this.padPress(b.dataset.key as string);
    });
  }

  private padPress(key: string): void {
    if (!this.math || this.math.busy) return;
    const input = $<HTMLInputElement>('math-input');
    if (key === 'del') input.value = input.value.slice(0, -1);
    else if (key === 'clear') input.value = '';
    else if (input.value.length < 2) input.value = (input.value === '0' ? '' : input.value) + key;
    input.classList.remove('wrong');
    this.updateCheckButton();
  }

  private updateCheckButton(): void {
    const input = $<HTMLInputElement>('math-input');
    $<HTMLButtonElement>('math-check').disabled = input.value.length === 0 || !!this.math?.busy;
  }

  openMath(opts: {
    challenge: MathChallenge;
    livesZero: boolean;
    boss: boolean;
    onSound: (correct: boolean) => void;
    onDone: () => void;
  }): void {
    this.math = { challenge: opts.challenge, onDone: opts.onDone, onSound: opts.onSound, busy: false, timer: 0 };
    $('math-title').textContent = opts.livesZero ? 'Oh nein! Alle Herzen sind weg.' : opts.boss ? 'Uff! Kurze Verschnaufpause.' : 'Autsch! Das war knapp.';
    $('math-sub').textContent = opts.livesZero
      ? 'Löse 3 Aufgaben – dann bekommst du ein neues Herz!'
      : 'Löse 3 Aufgaben, dann geht es weiter. Du schaffst das!';
    $('math-choice').classList.add('hidden');
    this.screens.math.querySelector('.math-body')?.classList.remove('hidden');
    this.renderMathTask();
    this.show('math');
    const input = $<HTMLInputElement>('math-input');
    if (!this.isTouch) window.setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  private renderMathTask(): void {
    if (!this.math) return;
    const c = this.math.challenge;
    $('math-count').textContent = `Aufgabe ${Math.min(c.solved + 1, c.total)} von ${c.total}`;
    $('math-dots').innerHTML = c.tasks
      .map((_, i) => `<span class="${i < c.solved ? 'done' : i === c.solved ? 'current' : ''}"></span>`)
      .join('');
    $('math-task').textContent = `Wie viel ist ${taskText(c.current)}?`;
    const input = $<HTMLInputElement>('math-input');
    input.value = '';
    input.classList.remove('wrong', 'right');
    const fb = $('math-feedback');
    fb.textContent = '';
    fb.className = 'math-feedback';
    this.updateCheckButton();
  }

  private submitMath(): void {
    const m = this.math;
    if (!m || m.busy) return;
    const input = $<HTMLInputElement>('math-input');
    const fb = $('math-feedback');
    const result = m.challenge.submit(input.value);
    if (result === 'invalid') {
      fb.textContent = 'Tippe eine Zahl von 0 bis 50.';
      fb.className = 'math-feedback try';
      return;
    }
    if (result === 'locked' || result === 'done') return;
    if (result === 'wrong') {
      m.onSound(false);
      fb.textContent = 'Noch nicht! Versuch es noch einmal.';
      fb.className = 'math-feedback try';
      input.classList.remove('wrong');
      void input.offsetWidth;
      input.classList.add('wrong');
      input.value = '';
      // Kurze Sperre gegen Dauerfeuer – keine Strafe.
      m.busy = true;
      this.updateCheckButton();
      m.timer = window.setTimeout(() => {
        m.busy = false;
        this.updateCheckButton();
        if (!this.isTouch) input.focus({ preventScroll: true });
      }, TIMING.mathWrongLockMs);
      return;
    }
    // richtig
    m.onSound(true);
    m.busy = true;
    const praise = ['Richtig! Super!', 'Richtig! Klasse!', 'Richtig! Toll gerechnet!'];
    fb.textContent = m.challenge.isComplete ? 'Super gerechnet!' : praise[m.challenge.solved % praise.length];
    fb.className = 'math-feedback good';
    input.classList.add('right');
    $('math-dots').children[m.challenge.solved - 1]?.classList.add('done');
    this.updateCheckButton();
    m.timer = window.setTimeout(() => {
      const complete = m.challenge.advance();
      m.busy = false;
      if (complete) {
        m.onDone();
      } else {
        this.renderMathTask();
        if (!this.isTouch) input.focus({ preventScroll: true });
      }
    }, TIMING.mathCorrectFeedbackMs);
  }

  /** Nach dem Lösen bei 0 Herzen: Weiterspielen oder Level neu starten. */
  showMathChoice(): void {
    this.screens.math.querySelector('.math-body')?.classList.add('hidden');
    $('math-title').textContent = 'Du hast ein neues Herz!';
    $('math-sub').textContent = '';
    $('math-choice').classList.remove('hidden');
    $('math-choice').querySelector<HTMLElement>('.btn-play')?.focus({ preventScroll: true });
  }

  closeMath(): void {
    if (this.math) window.clearTimeout(this.math.timer);
    this.math = null;
    $<HTMLInputElement>('math-input').blur();
    this.hide('math');
  }

  get mathOpen(): boolean {
    return this.math !== null;
  }

  // ---------------------------------------------------------------- Abschluss

  showComplete(s: CompleteSummary): void {
    $('complete-title').textContent = s.title;
    const starsEl = $('complete-stars');
    if (s.stars) {
      starsEl.classList.remove('hidden');
      starsEl.innerHTML = s.stars
        .map((st) => (st === 'none' ? ICONS.starEmpty : st === 'old' ? ICONS.star.replace('class="ico"', 'class="ico old"') : ICONS.star))
        .join('');
    } else {
      starsEl.innerHTML = ICONS.trophy + ICONS.badge;
    }
    $('complete-info').innerHTML = s.lines
      .map((l) => `<span class="row${l.record ? ' record' : ''}">${l.html}</span>`)
      .join('');
    const next = $<HTMLButtonElement>('btn-next');
    next.classList.toggle('hidden', !s.nextLabel);
    const label = next.querySelector('span:last-child');
    if (label && s.nextLabel) label.textContent = s.nextLabel;
    this.show('complete');
  }

  showGameComplete(progress: ProgressStore): void {
    $('final-trophies').innerHTML = [0, 1, 2, 3].map(() => ICONS.trophy).join('');
    $('final-info').innerHTML =
      `<span class="row">${ICONS.coin} ${progress.data.totalCoins} Münzen insgesamt</span>` +
      `<span class="row">${ICONS.star} ${progress.totalStars} von 36 Sternen</span>`;
    this.show('gamecomplete');
  }

  confirm(text: string, sub: string): void {
    $('confirm-text').textContent = text;
    $('confirm-sub').textContent = sub;
    this.show('confirm');
    this.screens.confirm.querySelector<HTMLElement>('[data-action="confirm-no"]')?.focus({ preventScroll: true });
  }
}
