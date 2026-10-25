// Karten. Eine Karte besteht aus Kontrollpunkten der Route (werden geglättet),
// festen Bauplätzen, optionaler Deko (Teiche) und dem Namen des Wellensatzes.
// Weltkoordinaten: 1280 × 720, unabhängig von der Bildschirmgröße.
//
// Gebaut wird frei auf einem Raster (siehe config/terrain.js); bebaubar ist alles außer Wegen,
// Wasser, Bastion und Hindernissen. `spots` sind die früheren festen Bauplätze – sie dienen nur
// noch der Übernahme alter Spielstände.
// `advanced`: Zusätze für den fortgeschrittenen Modus – Flüsse (Brücken entstehen automatisch, wo
// eine Route sie kreuzt), weitere Teiche und eigene Hindernisanzahlen (überschreiben MODES.scatter).

export const WORLD = { width: 1280, height: 720 }

export const MAPS = [
  {
    id: 'gruenental',
    name: 'Grünental',
    subtitle: 'Ein gewundener Pfad durch Wiesen und Wälder',
    difficultyHint: 'Einstieg',
    theme: 'meadow',
    waves: 'classic',
    hpMult: 0.92,
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
    advanced: {
      rivers: [{ points: [[650, -20], [640, 110], [690, 250], [680, 420], [740, 560], [760, 740]], width: 30 }],
      scatter: { tree: 40, stones: 14, rock: 8, wall: 4, cliff: 2 },
    },
    palette: { grass: '#5d8f45', grassDark: '#4b7a38', grassLight: '#76a956', path: '#cda96b', pathEdge: '#7c5d36' },
  },
  {
    id: 'felsenpass',
    name: 'Felsenpass',
    subtitle: 'Kurzer, steiniger Weg – wenig Zeit zum Reagieren',
    difficultyHint: 'Fortgeschritten',
    theme: 'rock',
    waves: 'classic',
    hpMult: 1.15,
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
    advanced: { scatter: { tree: 22, stones: 16, rock: 12, cliff: 9, wall: 1 } },
    palette: { grass: '#7d8a5a', grassDark: '#66724a', grassLight: '#97a36d', path: '#bfae8c', pathEdge: '#6a5d48' },
  },
  {
    id: 'sumpfgabel',
    name: 'Sumpfgabel',
    subtitle: 'Zwei Pfade durch den Nebelsumpf vereinen sich vor der Bastion',
    difficultyHint: 'Zwei Eingänge',
    theme: 'swamp',
    waves: 'classic',
    hpMult: 0.9,
    pathWidth: 42,
    seed: 41,
    unlock: { map: 'felsenpass', wave: 10 },
    // Beide Wege teilen sich ab der Gabelung (560, 360) dieselben Punkte
    paths: [
      [[-50, 110], [120, 110], [260, 150], [360, 240], [450, 330], [560, 360],
        [680, 350], [780, 260], [900, 190], [1020, 220], [1080, 330], [1040, 450], [960, 540], [1020, 630], [1140, 630], [1190, 540]],
      [[-50, 620], [130, 610], [260, 560], [370, 470], [460, 390], [560, 360],
        [680, 350], [780, 260], [900, 190], [1020, 220], [1080, 330], [1040, 450], [960, 540], [1020, 630], [1140, 630], [1190, 540]],
    ],
    base: { x: 1190, y: 480 },
    spots: [
      { x: 190, y: 200 }, { x: 370, y: 150 }, { x: 190, y: 520 }, { x: 380, y: 580 },
      { x: 300, y: 360 }, { x: 470, y: 250 }, { x: 480, y: 470 }, { x: 660, y: 290 },
      { x: 760, y: 190 }, { x: 960, y: 300 }, { x: 1140, y: 370 }, { x: 980, y: 420 },
      { x: 670, y: 430 }, { x: 1080, y: 510 }, { x: 1010, y: 120 },
    ],
    ponds: [{ x: 140, y: 360, rx: 90, ry: 50 }, { x: 760, y: 560, rx: 110, ry: 45 }, { x: 620, y: 90, rx: 70, ry: 35 }],
    advanced: {
      ponds: [{ x: 880, y: 430, rx: 45, ry: 30 }, { x: 330, y: 40, rx: 60, ry: 25 }, { x: 560, y: 650, rx: 70, ry: 30 }],
      scatter: { tree: 42, stones: 10, rock: 5, cliff: 0, wall: 2 },
    },
    palette: { grass: '#4f6b45', grassDark: '#3d5536', grassLight: '#678555', path: '#9c8a62', pathEdge: '#5a4a32' },
  },
  {
    id: 'frostgipfel',
    name: 'Frostgipfel',
    subtitle: 'Serpentinen durch den verschneiten Bergwald',
    difficultyHint: 'Lange Serpentinen',
    theme: 'snow',
    waves: 'classic',
    hpMult: 1.45,
    pathWidth: 42,
    seed: 57,
    unlock: { map: 'sumpfgabel', wave: 10 },
    path: [
      [180, -50], [180, 70], [260, 120], [600, 120], [1000, 115], [1130, 170], [1130, 260], [1040, 310],
      [650, 310], [260, 315], [150, 370], [150, 450], [260, 500], [650, 500], [1000, 500], [1120, 560],
      [1080, 640], [900, 660], [720, 655],
    ],
    base: { x: 640, y: 650 },
    spots: [
      { x: 650, y: 200 }, { x: 280, y: 210 }, { x: 410, y: 210 }, { x: 530, y: 210 },
      { x: 1010, y: 210 }, { x: 780, y: 220 }, { x: 1000, y: 390 }, { x: 270, y: 400 },
      { x: 760, y: 400 }, { x: 390, y: 410 }, { x: 520, y: 410 }, { x: 640, y: 410 },
      { x: 880, y: 410 }, { x: 990, y: 570 }, { x: 840, y: 580 },
    ],
    ponds: [{ x: 60, y: 640, rx: 70, ry: 35, ice: true }],
    advanced: {
      rivers: [{ points: [[1290, 380], [1180, 400], [1120, 470], [1200, 560], [1290, 600]], width: 26, frozen: true }],
      scatter: { tree: 40, stones: 10, rock: 8, cliff: 8, wall: 0 },
    },
    palette: { grass: '#e6edf2', grassDark: '#c9d6df', grassLight: '#f7fafc', path: '#b9a891', pathEdge: '#7d6c58' },
  },
  {
    id: 'wuestenschlucht',
    name: 'Wüstenschlucht',
    subtitle: 'Eine Spirale durch den Sand – die Bastion liegt mittendrin',
    difficultyHint: 'Meister',
    theme: 'desert',
    waves: 'classic',
    hpMult: 1.9,
    pathWidth: 42,
    seed: 73,
    unlock: { map: 'frostgipfel', wave: 10 },
    path: [
      [-50, 70], [300, 62], [700, 60], [1100, 66], [1200, 130], [1215, 350], [1200, 580], [1120, 650],
      [700, 655], [250, 650], [110, 600], [95, 400], [110, 250], [200, 205], [600, 205], [960, 210],
      [1060, 260], [1065, 400], [1010, 500], [700, 515], [400, 510], [300, 470], [290, 400], [360, 360],
      [520, 360], [600, 360],
    ],
    base: { x: 680, y: 360 },
    spots: [
      { x: 300, y: 132 }, { x: 560, y: 132 }, { x: 820, y: 132 }, { x: 1080, y: 175 },
      { x: 1140, y: 330 }, { x: 1135, y: 500 }, { x: 880, y: 585 }, { x: 560, y: 585 },
      { x: 250, y: 580 }, { x: 195, y: 440 }, { x: 195, y: 300 }, { x: 420, y: 430 },
      { x: 560, y: 440 }, { x: 850, y: 300 }, { x: 860, y: 450 },
    ],
    ponds: [{ x: 860, y: 370, rx: 55, ry: 30, oasis: true }],
    advanced: { scatter: { tree: 16, stones: 16, rock: 8, cliff: 4, wall: 8 } },
    palette: { grass: '#e2c58f', grassDark: '#cfa96b', grassLight: '#f0dcae', path: '#b98d58', pathEdge: '#8a6236' },
  },
]

export const getMap = (id) => MAPS.find((m) => m.id === id) || MAPS[0]
