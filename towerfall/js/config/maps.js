// Karten. Eine Karte besteht aus Kontrollpunkten der Route (werden geglättet),
// festen Bauplätzen, optionaler Deko (Teiche) und dem Namen des Wellensatzes.
// Weltkoordinaten: 1280 × 720, unabhängig von der Bildschirmgröße.
//
// Bauplatz-Hinweise (kurve, weit, engpass) berechnet das Spiel aus der Geometrie
// (siehe spotHint in game/game.js); ein Bauplatz kann sie mit `tag: '…'` überschreiben.

export const WORLD = { width: 1280, height: 720 }

export const MAPS = [
  {
    id: 'gruenental',
    name: 'Grünental',
    subtitle: 'Ein gewundener Pfad durch Wiesen und Wälder',
    difficultyHint: 'Einstieg',
    waves: 'classic',
    hpMult: 1,
    pathWidth: 44,
    seed: 7,
    path: [
      [-50, 120], [110, 118], [260, 130], [350, 210], [330, 330], [220, 390], [130, 470],
      [160, 590], [290, 640], [440, 610], [520, 500], [540, 360], [590, 230], [700, 140],
      [840, 140], [930, 230], [920, 360], [860, 470], [890, 590], [1010, 640], [1120, 590], [1165, 480],
    ],
    base: { x: 1180, y: 430 },
    spots: [
      { x: 206, y: 185 }, { x: 393, y: 154 }, { x: 232, y: 561 }, { x: 108, y: 391 },
      { x: 405, y: 325 }, { x: 415, y: 549 }, { x: 597, y: 418 }, { x: 563, y: 561 },
      { x: 755, y: 194 }, { x: 707, y: 71 }, { x: 977, y: 179 }, { x: 823, y: 395 },
      { x: 971, y: 405 }, { x: 993, y: 573 }, { x: 803, y: 557 }, { x: 1180, y: 619 },
      { x: 1080, y: 470 },
    ],
    ponds: [{ x: 1100, y: 70, rx: 90, ry: 40 }, { x: 70, y: 660, rx: 60, ry: 30 }],
    palette: { grass: '#5d8f45', grassDark: '#4b7a38', grassLight: '#76a956', path: '#cda96b', pathEdge: '#7c5d36' },
  },
  {
    id: 'felsenpass',
    name: 'Felsenpass',
    subtitle: 'Kurzer, steiniger Weg – wenig Zeit zum Reagieren',
    difficultyHint: 'Fortgeschritten',
    waves: 'classic',
    hpMult: 1,
    pathWidth: 42,
    seed: 23,
    unlock: { map: 'gruenental', wave: 10 },
    path: [
      [640, -50], [640, 90], [560, 170], [400, 180], [250, 230], [200, 340], [290, 430],
      [470, 430], [640, 400], [800, 420], [930, 500], [930, 600], [800, 650], [640, 610], [560, 560],
    ],
    base: { x: 540, y: 560 },
    spots: [
      { x: 691, y: 135 }, { x: 481, y: 242 }, { x: 289, y: 357 }, { x: 166, y: 229 },
      { x: 399, y: 501 }, { x: 565, y: 345 }, { x: 737, y: 340 }, { x: 846, y: 514 },
      { x: 1009, y: 526 }, { x: 686, y: 558 }, { x: 440, y: 620 }, { x: 955, y: 420 },
      { x: 304, y: 136 },
    ],
    ponds: [{ x: 1120, y: 150, rx: 110, ry: 55 }],
    palette: { grass: '#7d8a5a', grassDark: '#66724a', grassLight: '#97a36d', path: '#bfae8c', pathEdge: '#6a5d48' },
  },
]

export const getMap = (id) => MAPS.find((m) => m.id === id) || MAPS[0]
