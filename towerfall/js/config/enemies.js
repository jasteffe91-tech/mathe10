// Gegnertypen. hp = Lebenspunkte in Welle 1 (sie wachsen je Welle, siehe balance.js),
// speed = Pixel pro Sekunde, armor = fester Abzug je Treffer, damage = verlorene Leben am Ziel.

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
  ogre: {
    id: 'ogre',
    name: 'Ogerhäuptling',
    description: 'Boss: sehr viele Lebenspunkte, ruft Schwärmer herbei und wird bei wenig Leben wütend.',
    hp: 1100, speed: 30, armor: 3, reward: 120, damage: 8, radius: 22, lane: 0,
    color: '#a8322d',
    boss: true, slowResist: 0.5,
    summon: { type: 'swarm', count: 4, every: 7 },
  },
  titan: {
    id: 'titan',
    name: 'Schattentitan',
    description: 'Endboss: schwer gepanzert, kaum zu verlangsamen, schickt Flitzer voraus.',
    hp: 3800, speed: 26, armor: 6, reward: 400, damage: 15, radius: 28, lane: 0,
    color: '#4b2d78',
    boss: true, slowResist: 0.6,
    summon: { type: 'runner', count: 3, every: 6 },
  },
}

export const ENEMY_ORDER = ['grunt', 'runner', 'armored', 'swarm', 'healer', 'ogre', 'titan']
