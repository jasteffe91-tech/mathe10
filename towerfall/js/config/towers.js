// Turmtypen. Jede Stufe enthält die vollständigen Werte dieser Stufe;
// `cost` ist bei Stufe 1 der Baupreis, danach der Preis der Verbesserung.
//
// Angriffsarten:
//   projectile – zielsuchendes Geschoss, trifft ein Ziel (optional mit Flächenwirkung)
//   shell      – Bogengeschoss, explodiert am Zielpunkt (Flächenschaden)
//   chain      – sofortiger Blitz, springt auf weitere Gegner über
//   instant    – sofortiger Treffer (Scharfschütze)

export const TOWERS = {
  arrow: {
    id: 'arrow',
    name: 'Pfeilturm',
    role: 'Schnelle Grundverteidigung',
    description: 'Günstig und schnell. Viele kleine Treffer – stark gegen leichte Gegner, schwach gegen Panzerung.',
    tip: 'Ideal als erste Verteidigung und gegen Flitzer.',
    attack: 'projectile',
    projectile: 'arrow',
    projectileSpeed: 640,
    targetMode: 'first',
    color: '#7da447',
    accent: '#e3c77d',
    levels: [
      { cost: 70, damage: 8, range: 140, rate: 2.4 },
      { cost: 65, damage: 12, range: 150, rate: 2.8 },
      { cost: 120, damage: 18, range: 165, rate: 3.3 },
    ],
  },
  cannon: {
    id: 'cannon',
    name: 'Kanonenturm',
    role: 'Flächenschaden',
    description: 'Langsame, schwere Kugeln, die beim Einschlag alle Gegner im Umkreis treffen.',
    tip: 'Mit einem Frostturm davor bleiben ganze Gruppen im Explosionsradius.',
    attack: 'shell',
    projectile: 'ball',
    projectileSpeed: 380,
    arc: 46,
    targetMode: 'first',
    color: '#6f7480',
    accent: '#2b2f36',
    levels: [
      { cost: 120, damage: 30, range: 130, rate: 0.55, splash: 55 },
      { cost: 110, damage: 48, range: 135, rate: 0.6, splash: 62 },
      { cost: 190, damage: 76, range: 145, rate: 0.65, splash: 70 },
    ],
  },
  frost: {
    id: 'frost',
    name: 'Frostturm',
    role: 'Verlangsamung',
    description: 'Eissplitter verlangsamen Gegner im Trefferbereich. Macht kaum Schaden, aber andere Türme treffen länger.',
    tip: 'Bevorzugt Gegner, die noch nicht verlangsamt sind.',
    attack: 'projectile',
    projectile: 'shard',
    projectileSpeed: 500,
    targetMode: 'first',
    targetPreference: 'unslowed',
    color: '#78c4e6',
    accent: '#e8f7ff',
    levels: [
      { cost: 90, damage: 3, range: 120, rate: 1.1, slow: 0.4, slowDuration: 1.6, splash: 38 },
      { cost: 80, damage: 5, range: 130, rate: 1.2, slow: 0.5, slowDuration: 1.9, splash: 45 },
      { cost: 140, damage: 8, range: 145, rate: 1.35, slow: 0.6, slowDuration: 2.2, splash: 55 },
    ],
  },
  lightning: {
    id: 'lightning',
    name: 'Blitzturm',
    role: 'Kettenschaden',
    description: 'Ein Blitz springt von Gegner zu Gegner. Je dichter die Gruppe, desto mehr Treffer.',
    tip: 'Durchschlägt die Hälfte der Panzerung. Stark gegen Schwärme.',
    attack: 'chain',
    targetMode: 'first',
    color: '#9a6ad6',
    accent: '#ffe27a',
    levels: [
      { cost: 140, damage: 16, range: 120, rate: 0.85, chains: 3, chainRange: 85, chainFalloff: 0.8, armorPierce: 0.5 },
      { cost: 120, damage: 24, range: 128, rate: 0.95, chains: 4, chainRange: 90, chainFalloff: 0.82, armorPierce: 0.5 },
      { cost: 200, damage: 36, range: 138, rate: 1.05, chains: 6, chainRange: 95, chainFalloff: 0.85, armorPierce: 0.5 },
    ],
  },
  sniper: {
    id: 'sniper',
    name: 'Scharfschützenturm',
    role: 'Einzelziel auf große Distanz',
    description: 'Enorme Reichweite und schwere Treffer, die jede Panzerung durchschlagen. Sehr langsam.',
    tip: 'Zielt standardmäßig auf den stärksten Gegner – perfekt gegen Bosse.',
    attack: 'instant',
    targetMode: 'strong',
    color: '#4f6b4a',
    accent: '#c9b37a',
    levels: [
      { cost: 160, damage: 85, range: 300, rate: 0.38, armorPierce: 1 },
      { cost: 140, damage: 140, range: 330, rate: 0.42, armorPierce: 1 },
      { cost: 230, damage: 230, range: 370, rate: 0.48, armorPierce: 1 },
    ],
  },
  poison: {
    id: 'poison',
    name: 'Giftschleuderer',
    role: 'Schaden über Zeit',
    description: 'Schleudert Giftbeutel, die alle Gegner im Umkreis vergiften. Gift ignoriert Panzerung.',
    tip: 'Bevorzugt unvergiftete Gegner. Stark gegen zähe Gegner und Bosse.',
    attack: 'shell',
    projectile: 'glob',
    projectileSpeed: 340,
    arc: 38,
    targetMode: 'first',
    targetPreference: 'unpoisoned',
    color: '#5aa83f',
    accent: '#b6ff6a',
    levels: [
      { cost: 110, damage: 4, range: 135, rate: 0.75, splash: 45, poisonDps: 9, poisonDuration: 4 },
      { cost: 95, damage: 6, range: 142, rate: 0.8, splash: 52, poisonDps: 16, poisonDuration: 4.5 },
      { cost: 170, damage: 9, range: 150, rate: 0.85, splash: 60, poisonDps: 28, poisonDuration: 5 },
    ],
  },
}

// Reihenfolge im Baumenü (und Tastenkürzel 1–6)
export const TOWER_ORDER = ['arrow', 'cannon', 'frost', 'lightning', 'sniper', 'poison']

export const TARGET_MODES = {
  first: { name: 'Vorderster', hint: 'Der Gegner, der der Bastion am nächsten ist' },
  last: { name: 'Hinterster', hint: 'Der Gegner, der zuletzt kam' },
  strong: { name: 'Stärkster', hint: 'Der Gegner mit den meisten Lebenspunkten' },
  close: { name: 'Nächster', hint: 'Der Gegner, der dem Turm am nächsten ist' },
}
export const TARGET_MODE_ORDER = ['first', 'last', 'strong', 'close']
