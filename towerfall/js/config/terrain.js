// Gelände, Hindernisse und Spielmodi – rein datengetrieben.
//
// Wichtig: „bebaubar“ und „für Gegner passierbar“ sind getrennte Eigenschaften.
//   Weg     – nicht bebaubar, passierbar
//   Wasser  – nicht bebaubar, nicht passierbar (außer über Brücken)
//   Klippe  – nicht bebaubar, nicht passierbar, blockiert Sicht und Geschosse
//
// Gegner laufen auf festen Routen (siehe game/path.js). Wegzellen sind nie bebaubar und Hindernisse
// entstehen nie auf ihnen – trotzdem prüft game/routes.js nach jeder Änderung, dass alle Routen
// passierbar bleiben.

export const CELL = 32 // Kantenlänge einer Rasterzelle in Weltpixeln (Welt: 1280 × 720 → 40 × 22 Zellen)

// Grundlegende Geländearten einer Zelle
export const TERRAIN = {
  grass: { name: 'Bauland', buildable: true, walkable: false },
  path: { name: 'Weg', buildable: false, walkable: true, reason: 'Auf dem Weg der Gegner kann nicht gebaut werden.' },
  bridge: { name: 'Brücke', buildable: false, walkable: true, reason: 'Brücken müssen frei bleiben.' },
  water: { name: 'Wasser', buildable: false, walkable: false, reason: 'Im Wasser kann nicht gebaut werden.' },
  base: { name: 'Bastion', buildable: false, walkable: true, reason: 'Hier steht die Bastion.' },
  outside: { name: 'Außerhalb der Bauzone', buildable: false, walkable: false, reason: 'Außerhalb der Bauzone – zu weit vom Weg entfernt.' },
}

// Hindernisse (Kartenobjekte). Kosten pro belegter Zelle; removable: false = dauerhaft.
// blocksSight/blocksProjectiles: Türme können nicht durch sie hindurch zielen.
export const OBSTACLES = {
  stones: {
    name: 'Steine', walkable: true, blocksSight: false, blocksProjectiles: false,
    removable: true, costPerCell: 10, effort: 'gering',
  },
  tree: {
    name: 'Baum', walkable: false, blocksSight: false, blocksProjectiles: false,
    removable: true, costPerCell: 25, effort: 'mittel',
  },
  rock: {
    name: 'Felsbrocken', walkable: false, blocksSight: false, blocksProjectiles: false,
    removable: true, costPerCell: 22, effort: 'hoch',
  },
  wall: {
    name: 'Ruinenmauer', walkable: false, blocksSight: true, blocksProjectiles: true,
    removable: true, costPerCell: 35, effort: 'hoch',
  },
  cliff: {
    name: 'Klippe', walkable: false, blocksSight: true, blocksProjectiles: true,
    removable: false, costPerCell: 0, effort: 'nicht möglich',
  },
}

// Spielmodi. Beide nutzen dasselbe System; sie unterscheiden sich nur in diesen Regeln.
//   scatter      – wie viele Hindernisse je Art zufällig (aber je Karte immer gleich) verteilt werden
//   maxBuildDistance – Bauzone: nur Zellen bis zu diesem Abstand (px) von einem Weg sind bebaubar
//   features     – kartenspezifische Gelände-Extras (Flüsse, Klippen, Ruinen) aus maps.js einschalten
export const MODES = {
  normal: {
    id: 'normal',
    name: 'Normal',
    description: 'Übersichtliches Gelände mit wenigen Hindernissen – Fokus auf Turmwahl und Aufstellung.',
    scatter: { tree: 14, stones: 6, rock: 3 },
    maxBuildDistance: Infinity,
    features: false,
    clearCostMult: 1,
    startGoldBonus: 0,
    scoreMult: 1,
  },
  advanced: {
    id: 'advanced',
    name: 'Fortgeschritten',
    description: 'Flüsse, Klippen, Ruinen und dichter Wald. Bauland ist knapp – Räumen kostet Gold.',
    scatter: { tree: 38, stones: 14, rock: 9, cliff: 5, wall: 3 },
    maxBuildDistance: 200,
    features: true,
    clearCostMult: 1,
    startGoldBonus: 60,   // Startkapital fürs Räumen
    scoreMult: 1.3,
  },
}
