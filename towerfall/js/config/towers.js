// Turmtypen. Jede Stufe enthält die vollständigen Werte dieser Stufe;
// `cost` ist bei Stufe 1 der Baupreis, danach der Preis der Verbesserung.
//
// Angriffsarten:
//   projectile – zielsuchendes Geschoss, trifft ein Ziel (optional mit Flächenwirkung)
//   shell      – Bogengeschoss, explodiert am Zielpunkt (Flächenschaden)
//   chain      – sofortiger Blitz, springt auf weitere Gegner über
//   instant    – sofortiger Treffer (Scharfschütze)
//   pierce     – gerades Geschoss, durchbohrt bis zu `pierceCount` Gegner auf seiner Linie
//   aura       – greift nicht an, verstärkt Türme in Reichweite (auraDamage, auraRate, auraRange)
//
// damageType: physical | explosive | magic | frost | poison – manche Gegner sind dagegen resistent
//   oder anfällig (siehe enemies.js `resist`), angezeigt im Infobereich und in der Anleitung.
// footprint: belegte Rasterzellen (w × h); rotatable: Grundfläche lässt sich um 90° drehen.
// spriteScale: Zeichengröße passend zur Grundfläche (rein optisch).
// Optional je Stufe: minRange (toter Winkel nahe am Turm), largeBonus (Zusatzschaden gegen große Gegner).

export const TOWERS = {
  arrow: {
    id: 'arrow',
    damageType: 'physical',
    footprint: { w: 1, h: 1 },
    spriteScale: 0.8,
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
    damageType: 'explosive',
    footprint: { w: 2, h: 2 },
    spriteScale: 1.35,
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
    damageType: 'frost',
    footprint: { w: 1, h: 1 },
    spriteScale: 0.8,
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
    damageType: 'magic',
    footprint: { w: 2, h: 2 },
    spriteScale: 1.3,
    name: 'Blitzturm',
    role: 'Kettenschaden',
    description: 'Ein Blitz springt von Gegner zu Gegner. Je dichter die Gruppe, desto mehr Treffer.',
    tip: 'Durchschlägt die Hälfte der Panzerung. Stark gegen Schwärme.',
    attack: 'chain',
    targetMode: 'first',
    color: '#9a6ad6',
    accent: '#ffe27a',
    levels: [
      { cost: 140, damage: 21, range: 120, rate: 0.85, chains: 3, chainRange: 85, chainFalloff: 0.8, armorPierce: 0.5 },
      { cost: 120, damage: 31, range: 128, rate: 0.95, chains: 4, chainRange: 90, chainFalloff: 0.82, armorPierce: 0.5 },
      { cost: 200, damage: 46, range: 138, rate: 1.05, chains: 6, chainRange: 95, chainFalloff: 0.85, armorPierce: 0.5 },
    ],
  },
  sniper: {
    id: 'sniper',
    damageType: 'physical',
    footprint: { w: 1, h: 1 },
    spriteScale: 0.82,
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
    damageType: 'poison',
    footprint: { w: 1, h: 1 },
    spriteScale: 0.8,
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
  ballista: {
    id: 'ballista',
    damageType: 'physical',
    footprint: { w: 2, h: 1, rotatable: true },
    spriteScale: 1,
    name: 'Speerschleuder',
    role: 'Durchschlag in einer Linie',
    description: 'Schießt schwere Speere, die alle Gegner auf ihrer Flugbahn durchbohren – auch weit hinter dem Ziel.',
    tip: 'Am stärksten an langen Geraden, wo Gegner hintereinander laufen.',
    attack: 'pierce',
    projectile: 'bolt',
    projectileSpeed: 720,
    targetMode: 'first',
    color: '#8c5a35',
    accent: '#d9d2c0',
    levels: [
      { cost: 130, damage: 28, range: 165, rate: 0.7, pierceCount: 5, armorPierce: 0.3 },
      { cost: 110, damage: 43, range: 175, rate: 0.75, pierceCount: 7, armorPierce: 0.3 },
      { cost: 190, damage: 64, range: 190, rate: 0.8, pierceCount: 10, armorPierce: 0.4 },
    ],
  },
  banner: {
    id: 'banner',
    footprint: { w: 2, h: 2 },
    spriteScale: 1.25,
    name: 'Kriegsbanner',
    role: 'Verstärkt Türme in der Nähe',
    description: 'Greift nicht selbst an. Türme in Reichweite machen mehr Schaden, feuern schneller und verlangsamen länger; auf Stufe 3 reichen sie auch weiter.',
    tip: 'Mitten in eine Gruppe starker Türme stellen. Mehrere Banner verstärken sich nicht gegenseitig.',
    attack: 'aura',
    targetMode: 'first',
    color: '#b23a3a',
    accent: '#f2c14e',
    levels: [
      { cost: 140, range: 140, auraDamage: 0.2, auraRate: 0.1, auraRange: 0 },
      { cost: 120, range: 155, auraDamage: 0.3, auraRate: 0.15, auraRange: 0 },
      { cost: 180, range: 170, auraDamage: 0.4, auraRate: 0.2, auraRange: 0.1 },
    ],
  },
  trebuchet: {
    id: 'trebuchet',
    damageType: 'explosive',
    footprint: { w: 3, h: 3 },
    spriteScale: 1,
    name: 'Tribok',
    role: 'Belagerung gegen große Gegner',
    description: 'Riesiges Wurfgeschütz: schleudert Felsbrocken über weite Distanz. Extraschaden gegen große Gegner (Eisenwachen, Berserker, Bosse), trifft aber nichts direkt vor sich.',
    tip: 'Braucht viel Platz (3 × 3). Mit Abstand zum Weg aufstellen – unter 80 px Entfernung kann er nicht zielen.',
    attack: 'shell',
    projectile: 'boulder',
    projectileSpeed: 280,
    arc: 90,
    targetMode: 'strong',
    color: '#7a5c3a',
    accent: '#b9b2a3',
    levels: [
      { cost: 240, damage: 75, range: 250, minRange: 80, rate: 0.28, splash: 40, largeBonus: 0.5 },
      { cost: 200, damage: 115, range: 270, minRange: 80, rate: 0.3, splash: 45, largeBonus: 0.6 },
      { cost: 320, damage: 175, range: 290, minRange: 80, rate: 0.33, splash: 50, largeBonus: 0.75 },
    ],
  },
}

// Reihenfolge im Baumenü (und Tastenkürzel 1–9)
export const TOWER_ORDER = ['arrow', 'cannon', 'frost', 'lightning', 'sniper', 'poison', 'ballista', 'banner', 'trebuchet']

// Grundfläche unter Berücksichtigung der Drehung (rot 1 = um 90° gedreht)
export function footprintOf(type, rot = 0) {
  const f = TOWERS[type].footprint
  return rot % 2 && f.rotatable ? { w: f.h, h: f.w } : { w: f.w, h: f.h }
}

export const TARGET_MODES = {
  first: { name: 'Vorderster', hint: 'Der Gegner, der der Bastion am nächsten ist' },
  last: { name: 'Hinterster', hint: 'Der Gegner, der zuletzt kam' },
  strong: { name: 'Stärkster', hint: 'Der Gegner mit den meisten Lebenspunkten' },
  close: { name: 'Nächster', hint: 'Der Gegner, der dem Turm am nächsten ist' },
}
export const TARGET_MODE_ORDER = ['first', 'last', 'strong', 'close']

// Schadensarten mit Namen und Symbol für die Anzeige
export const DAMAGE_TYPES = {
  physical: { name: 'Physisch', icon: '⚔', color: '#d9d2c0' },
  explosive: { name: 'Explosiv', icon: '✹', color: '#ffb347' },
  magic: { name: 'Magie', icon: '✦', color: '#b98cff' },
  frost: { name: 'Frost', icon: '❄', color: '#9fdcf6' },
  poison: { name: 'Gift', icon: '☠', color: '#8ee34f' },
}
