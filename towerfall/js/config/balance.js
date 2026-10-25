// Zentrale Balancing-Werte. Alles, was das Spielgefühl bestimmt, steht hier
// (zusammen mit towers.js, enemies.js und waves.js) – nicht verstreut im Code.

export const BALANCE = {
  startGold: 260,
  sellRefund: 0.7,              // Anteil des investierten Goldes beim Verkauf
  wavePause: 14,                // Sekunden Pause zwischen zwei Wellen
  earlyCallGoldPerSecond: 1.5,  // Bonus je übersprungener Pausensekunde
  overlapCallBonus: 10,         // Bonus, wenn die nächste Welle während einer laufenden gerufen wird
  waveBonusBase: 12,            // Gold für eine überstandene Welle …
  waveBonusPerWave: 2,          // … plus je Wellennummer
  minDamageRatio: 0.15,         // Panzerung kann einen Treffer höchstens auf 15 % drücken
  hpGrowthLinear: 0.085,        // Lebenspunkte wachsen je Welle linear …
  hpGrowthQuad: 0.0035,         // … und leicht quadratisch
  enemyHpMult: 1.25,             // globaler Faktor (gleicht die freie Platzierung auf dem Raster aus)
  enrageThreshold: 0.35,        // Bosse werden unter 35 % Leben wütend …
  enrageSpeed: 1.35,            // … und laufen schneller
  bossHealFactor: 0.25,         // Heiler heilen Bosse nur zu einem Viertel
  bossGrowthShare: 0.5,         // Bosse wachsen nur mit der Hälfte des Lebenspunkte-Zuwachses
  retargetRadius: 70,           // Pfeile suchen sich ein neues Ziel, wenn ihres vorher fällt
  maxSlow: 0.7,                 // Verlangsamung wirkt höchstens zu 70 % – Gegner bleiben nie ganz stehen
  largeEnemyRadius: 14,         // ab diesem Radius gilt ein Gegner als „groß“ (Tribok-Bonus)
  moveCostRatio: 0.1,           // Versetzen kostet 10 % des investierten Goldes …
  moveCostMin: 5,               // … mindestens 5 Gold
  elite: { hpMult: 1.6, armorBonus: 2, rewardMult: 2 },  // Elite-Gegner (goldener Rand)
  // Flieger brauchen mindestens diesen Anteil der Zeit, die ein Plünderer (58 px/s) für den Fußweg
  // braucht – sonst wären sie auf Karten mit kurzer Luftlinie (Felsenpass) kaum aufzuhalten
  flightTimeShare: 0.5,
  flightReferenceSpeed: 58,
  score: { killFactor: 10, waveFactor: 100, lifeFactor: 150 },
}

export const DIFFICULTIES = {
  easy: {
    id: 'easy', name: 'Entspannt', lives: 30, hpMult: 0.8, startGoldBonus: 60, scoreMult: 0.6,
    description: 'Mehr Leben und Startgold, schwächere Gegner.',
  },
  normal: {
    id: 'normal', name: 'Normal', lives: 20, hpMult: 1, startGoldBonus: 0, scoreMult: 1,
    description: 'Die vorgesehene Herausforderung.',
  },
  hard: {
    id: 'hard', name: 'Hart', lives: 10, hpMult: 1.25, startGoldBonus: -20, scoreMult: 1.6,
    description: 'Wenig Spielraum für Fehler.',
  },
}

// Simulation: feste Schrittweite, damit das Spiel bei 30, 60 oder 144 FPS gleich abläuft.
export const SIM = {
  step: 1 / 60,
  maxStepsPerFrame: 16,
  maxFrameTime: 0.25,
  speeds: [1, 2, 3],
}

export function hpScaleForWave(waveNumber, difficulty, boss = false) {
  const n = waveNumber - 1
  const growth = BALANCE.hpGrowthLinear * n + BALANCE.hpGrowthQuad * n * n
  return (1 + growth * (boss ? BALANCE.bossGrowthShare : 1)) * difficulty.hpMult * BALANCE.enemyHpMult
}
