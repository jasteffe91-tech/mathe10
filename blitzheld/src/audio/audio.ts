/**
 * Soundeffekte und eine leise Hintergrundmelodie, komplett mit Web Audio erzeugt –
 * keine Dateien, keine externen Dienste. Der AudioContext wird erst nach der ersten
 * Nutzeraktion gestartet, es gibt also nie automatisch Ton beim Öffnen der Seite.
 * Das Spiel hängt nie vom Ton ab: Fehlt Web Audio, bleibt einfach alles still.
 */

export type Sfx =
  | 'jump'
  | 'land'
  | 'coin'
  | 'star'
  | 'hurt'
  | 'stomp'
  | 'spring'
  | 'checkpoint'
  | 'correct'
  | 'wrong'
  | 'click'
  | 'bossWindup'
  | 'bossAttack'
  | 'bossHurt'
  | 'bossDefeated'
  | 'dodge'
  | 'levelComplete';

type Wave = OscillatorType;

interface Note {
  f: number;
  t: number;
  d: number;
  wave?: Wave;
  vol?: number;
  slide?: number;
}

const MELODIES: Record<string, number[][]> = {
  // Je Welt eine kleine Melodie: [Halbton relativ zu C5 oder null, Länge in Achteln]
  meadow: [[0, 1], [4, 1], [7, 1], [4, 1], [5, 1], [9, 1], [7, 2], [4, 1], [7, 1], [12, 1], [7, 1], [5, 1], [4, 1], [2, 2]],
  cave: [[0, 2], [3, 1], [7, 1], [10, 2], [7, 1], [3, 1], [5, 2], [8, 1], [12, 1], [10, 2], [7, 2]],
  clouds: [[7, 1], [12, 1], [11, 1], [7, 1], [9, 2], [4, 2], [5, 1], [9, 1], [12, 1], [9, 1], [7, 2], [2, 2]],
  volcano: [[0, 1], [0, 1], [3, 1], [5, 1], [7, 2], [5, 1], [3, 1], [0, 1], [-2, 1], [0, 2], [7, 1], [10, 1], [7, 2]],
  boss: [[0, 1], [3, 1], [0, 1], [5, 1], [0, 1], [6, 1], [5, 1], [3, 1], [0, 1], [3, 1], [7, 2], [5, 2]],
  menu: [[0, 1], [4, 1], [7, 1], [12, 1], [9, 1], [7, 1], [4, 2], [5, 1], [9, 1], [7, 1], [4, 1], [2, 2]],
};

const midi = (semi: number): number => 523.25 * Math.pow(2, semi / 12);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private soundOn: boolean;
  private musicOn: boolean;
  private musicTrack: string | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  /** Zählt abgespielte Effekte (für Tests). */
  readonly played: Sfx[] = [];

  constructor(sound: boolean, music: boolean) {
    this.soundOn = sound;
    this.musicOn = music;
  }

  /** Muss aus einer Nutzeraktion (Klick, Taste, Tipp) heraus aufgerufen werden. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      if (this.musicTrack) this.startMusicLoop();
    } catch {
      this.ctx = null;
    }
  }

  get enabled(): boolean {
    return this.soundOn;
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    this.musicOn = on;
    if (!on) this.stopMusicLoop();
    else if (this.musicTrack) this.startMusicLoop();
  }

  private tone(n: Note, out?: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + n.t;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.wave ?? 'square';
    osc.frequency.setValueAtTime(n.f, start);
    if (n.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, n.slide), start + n.d);
    const vol = n.vol ?? 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
    osc.connect(gain);
    gain.connect(out ?? this.master);
    osc.start(start);
    osc.stop(start + n.d + 0.05);
  }

  private noise(t: number, d: number, vol = 0.15, freq = 900): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const len = Math.floor(ctx.sampleRate * d);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(ctx.currentTime + t);
  }

  play(name: Sfx): void {
    this.played.push(name);
    if (this.played.length > 200) this.played.splice(0, 100);
    if (!this.soundOn || !this.ctx) return;
    switch (name) {
      case 'jump':
        this.tone({ f: 330, slide: 720, t: 0, d: 0.16, wave: 'square', vol: 0.12 });
        break;
      case 'land':
        this.noise(0, 0.08, 0.12, 500);
        break;
      case 'coin':
        this.tone({ f: 988, t: 0, d: 0.07, wave: 'square', vol: 0.1 });
        this.tone({ f: 1319, t: 0.06, d: 0.16, wave: 'square', vol: 0.1 });
        break;
      case 'star':
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone({ f: midi(s + 7), t: i * 0.06, d: 0.16, wave: 'triangle', vol: 0.16 }));
        break;
      case 'hurt':
        this.tone({ f: 520, slide: 130, t: 0, d: 0.45, wave: 'triangle', vol: 0.2 });
        this.noise(0, 0.25, 0.08, 1200);
        break;
      case 'stomp':
        this.tone({ f: 220, slide: 600, t: 0, d: 0.12, wave: 'square', vol: 0.14 });
        this.tone({ f: 880, t: 0.08, d: 0.1, wave: 'square', vol: 0.08 });
        break;
      case 'spring':
        this.tone({ f: 260, slide: 1200, t: 0, d: 0.3, wave: 'sine', vol: 0.22 });
        break;
      case 'checkpoint':
        [0, 7, 12].forEach((s, i) => this.tone({ f: midi(s), t: i * 0.09, d: 0.2, wave: 'triangle', vol: 0.18 }));
        break;
      case 'correct':
        [0, 4, 7, 12].forEach((s, i) => this.tone({ f: midi(s), t: i * 0.08, d: 0.22, wave: 'triangle', vol: 0.2 }));
        break;
      case 'wrong':
        this.tone({ f: 330, t: 0, d: 0.14, wave: 'sine', vol: 0.14 });
        this.tone({ f: 294, t: 0.13, d: 0.2, wave: 'sine', vol: 0.14 });
        break;
      case 'click':
        this.tone({ f: 660, t: 0, d: 0.05, wave: 'square', vol: 0.07 });
        break;
      case 'bossWindup':
        this.tone({ f: 110, slide: 220, t: 0, d: 0.6, wave: 'sawtooth', vol: 0.09 });
        break;
      case 'bossAttack':
        this.noise(0, 0.35, 0.14, 700);
        this.tone({ f: 180, slide: 90, t: 0, d: 0.3, wave: 'square', vol: 0.1 });
        break;
      case 'dodge':
        this.tone({ f: 784, t: 0, d: 0.08, wave: 'triangle', vol: 0.14 });
        this.tone({ f: 1175, t: 0.07, d: 0.12, wave: 'triangle', vol: 0.14 });
        break;
      case 'bossHurt':
        this.noise(0, 0.2, 0.18, 2000);
        this.tone({ f: 440, slide: 160, t: 0, d: 0.35, wave: 'square', vol: 0.14 });
        break;
      case 'bossDefeated':
        [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) =>
          this.tone({ f: midi(s), t: i * 0.11, d: 0.28, wave: i % 2 ? 'triangle' : 'square', vol: 0.16 }),
        );
        break;
      case 'levelComplete':
        [0, 4, 7, 12, 11, 12, 16].forEach((s, i) => this.tone({ f: midi(s), t: i * 0.1, d: 0.25, wave: 'square', vol: 0.13 }));
        break;
    }
  }

  /** Startet die Melodie einer Welt (oder 'menu'/'boss'). null = Stille. */
  music(track: string | null): void {
    if (this.musicTrack === track) return;
    this.musicTrack = track;
    this.stopMusicLoop();
    if (track) this.startMusicLoop();
  }

  private startMusicLoop(): void {
    if (!this.ctx || !this.musicOn || !this.musicTrack || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.noteIndex = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 120);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.musicTrack) return;
    const melody = MELODIES[this.musicTrack] ?? MELODIES.menu;
    const eighth = this.musicTrack === 'boss' ? 0.16 : 0.2;
    while (this.nextNoteTime < ctx.currentTime + 0.5) {
      const [semi, len] = melody[this.noteIndex % melody.length];
      const t = this.nextNoteTime - ctx.currentTime;
      this.tone({ f: midi(semi - 12), t, d: eighth * len * 0.9, wave: 'triangle', vol: 0.5 }, this.musicGain);
      if (this.noteIndex % 2 === 0) {
        this.tone({ f: midi(semi - 24), t, d: eighth * 0.8, wave: 'sine', vol: 0.35 }, this.musicGain);
      }
      this.nextNoteTime += eighth * len;
      this.noteIndex++;
    }
  }

  /** Tab im Hintergrund: Musik anhalten. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
}
