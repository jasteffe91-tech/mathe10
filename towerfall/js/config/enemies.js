// Gegnertypen. hp = Lebenspunkte in Welle 1 (sie wachsen je Welle, siehe balance.js),
// speed = Pixel pro Sekunde, armor = fester Abzug je Treffer, damage = verlorene Leben am Ziel.
// resist: Anteil, um den eine Schadensart verringert wird (0,6 = nur 40 % Schaden; negativ = anfällig).
// flying: fliegt geradlinig vom Eingang zur Bastion (ignoriert Weg und Kurven); Bogengeschosse
//   (Kanone, Tribok, Gift) treffen keine Flieger.
// frenzy: zeitweise Raserei (schneller, immun gegen Verlangsamung).
// disrupt: Puls, der Türme in der Nähe kurz betäubt (kind 'hex' = Runenhexer, 'quake' = Stampfen der Bosse).
// hint: kurzer Hinweis beim ersten Auftauchen (Wellenvorschau und Meldung beim Wellenstart).
// Jede Fähigkeit hat eine sichtbare Kennzeichnung (siehe render/sprites.js) und steht in `description`.

export const ENEMIES = {
  grunt: {
    id: 'grunt',
    name: 'Plünderer',
    description: 'Ausgewogene Lebenspunkte und Geschwindigkeit.',
    hp: 40, speed: 58, armor: 0, reward: 5, damage: 1, radius: 11, lane: 7,
    color: '#b8573a',
  },
  runner: {
    id: 'runner',
    name: 'Flitzer',
    description: 'Wenig Leben, aber sehr schnell.',
    hp: 24, speed: 110, armor: 0, reward: 4, damage: 1, radius: 9, lane: 8,
    color: '#e0b43a',
  },
  armored: {
    id: 'armored',
    name: 'Eisenwache',
    description: 'Langsam und gepanzert. Pfeile prallen fast ab – Scharfschützen, Gift und Kanonen helfen.',
    hp: 150, speed: 36, armor: 5, reward: 12, damage: 2, radius: 14, lane: 4,
    color: '#8a929e',
  },
  swarm: {
    id: 'swarm',
    name: 'Schwärmer',
    description: 'Winzig und zahlreich. Anfällig für Flächen- und Kettenschaden.',
    hp: 12, speed: 78, armor: 0, reward: 1, damage: 1, radius: 6, lane: 12,
    color: '#8e4fc2',
  },
  healer: {
    id: 'healer',
    name: 'Schamane',
    description: 'Heilt Gegner in seiner Nähe. Zuerst ausschalten!',
    hp: 80, speed: 50, armor: 1, reward: 10, damage: 1, radius: 11, lane: 5,
    color: '#2fa79a',
    heal: { amount: 0.08, every: 2, radius: 85 },
  },
  harpy: {
    id: 'harpy',
    hint: 'Neu: Harpyie – fliegt geradeaus zur Bastion. Kanone, Tribok und Gift treffen sie nicht; stelle Pfeil-, Frost- oder Blitztürme an die Fluglinie (gestrichelt).',
    name: 'Harpyie',
    description: 'Fliegt auf direktem Weg zur Bastion statt den Weg entlang. Kanone, Tribok und Gift (Bogengeschosse) treffen sie nicht – Pfeile, Frost, Blitz, Speer und Scharfschütze schon.',
    hp: 45, speed: 48, armor: 0, reward: 7, damage: 1, radius: 10, lane: 14,
    color: '#7f6a9e',
    flying: true,
  },
  wraith: {
    id: 'wraith',
    hint: 'Neu: Geist – Pfeil, Speer und Scharfschütze machen nur 40 % Schaden. Blitz (+25 %), Kanone, Frost und Gift wirken voll.',
    name: 'Geist',
    description: 'Halb durchsichtig: Physischer Schaden (Pfeil, Speer, Scharfschütze) wirkt nur zu 40 %. Anfällig für Blitz (+25 %).',
    hp: 70, speed: 64, armor: 0, reward: 8, damage: 1, radius: 11, lane: 6,
    color: '#9fd8ff',
    resist: { physical: 0.6, magic: -0.25 },
  },
  berserker: {
    id: 'berserker',
    hint: 'Neu: Berserker – rote Aura = Raserei: schneller und immun gegen Frost. Setze auf Schaden statt Verlangsamung.',
    name: 'Berserker',
    description: 'Gerät alle 8 s für 3 s in Raserei (rote Aura): 45 % schneller und immun gegen Verlangsamung. Schaden hält ihn auf, Frost nicht.',
    hp: 120, speed: 52, armor: 2, reward: 10, damage: 2, radius: 12, lane: 5,
    color: '#c2452d',
    frenzy: { every: 8, duration: 3, speed: 1.45, first: 2.5 },
  },
  hexer: {
    id: 'hexer',
    hint: 'Neu: Runenhexer – violetter Ring = Lähm-Puls: betäubt Türme im Umkreis. Verteile Türme oder baue mit Abstand zum Weg.',
    name: 'Runenhexer',
    description: 'Kommt er einem Turm nahe, lädt er sich 1 s sichtbar auf (violetter Ring) und lähmt dann alle Türme im Umkreis von 100 px für 2,5 s (danach 6 s Pause). Türme mit Abstand zum Weg oder verteilte Türme bleiben unberührt.',
    hp: 95, speed: 46, armor: 1, reward: 14, damage: 1, radius: 11, lane: 4,
    color: '#6b3fa0',
    disrupt: { kind: 'hex', every: 6, charge: 1, duration: 2.5, radius: 100, first: 3 },
  },
  ogre: {
    id: 'ogre',
    hint: 'Neu: Ogerhäuptling – stampft, sobald Türme näher als 100 px sind (brauner Ring lädt auf): Sie sind 2,5 s betäubt. Türme mit etwas Abstand zum Weg bleiben verschont.',
    name: 'Ogerhäuptling',
    description: 'Boss: ruft Schwärmer herbei, wird bei wenig Leben wütend und stampft, sobald Türme in 100 px Nähe sind – sie sind dann 2,5 s betäubt (höchstens alle 10 s).',
    hp: 1100, speed: 30, armor: 3, reward: 120, damage: 8, radius: 22, lane: 0,
    color: '#a8322d',
    boss: true, slowResist: 0.5,
    summon: { type: 'swarm', count: 4, every: 7 },
    disrupt: { kind: 'quake', every: 10, charge: 0.8, duration: 2.5, radius: 100, first: 6 },
  },
  titan: {
    id: 'titan',
    name: 'Schattentitan',
    description: 'Endboss: schwer gepanzert, kaum zu verlangsamen, 25 % weniger physischer Schaden, schickt Flitzer voraus und betäubt Türme in 120 px Umkreis für 2,5 s (höchstens alle 10 s).',
    hp: 3800, speed: 26, armor: 6, reward: 400, damage: 15, radius: 28, lane: 0,
    color: '#4b2d78',
    boss: true, slowResist: 0.6,
    resist: { physical: 0.25 },
    summon: { type: 'runner', count: 3, every: 6 },
    disrupt: { kind: 'quake', every: 10, charge: 0.8, duration: 2.5, radius: 120, first: 4 },
  },
}

// Einführungstext für Elite-Gegner (Welle 13)
export const ELITE_HINT = 'Neu: Elite-Gegner (goldener Rand) – 60 % mehr Leben, +2 Panzerung, doppelte Belohnung. Panzerbrechende Türme (Scharfschütze, Speer, Kanone) lohnen sich.'

export const ENEMY_ORDER = ['grunt', 'runner', 'armored', 'swarm', 'healer', 'wraith', 'harpy', 'berserker', 'hexer', 'ogre', 'titan']
