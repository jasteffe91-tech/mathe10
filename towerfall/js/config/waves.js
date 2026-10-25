// Wellen. Eine Welle besteht aus Gruppen, die parallel starten:
//   type      Gegnertyp (siehe enemies.js)
//   count     Anzahl
//   interval  Sekunden zwischen zwei Gegnern der Gruppe
//   delay     Sekunden nach Wellenbeginn, bevor die Gruppe startet
//   hp        zusätzlicher Lebenspunkte-Faktor für diese Gruppe (Standard 1)

const g = (type, count, interval, delay = 0, hp = 1) => ({ type, count, interval, delay, hp })

export const WAVE_SETS = {
  classic: [
    /* 1 */ { groups: [g('grunt', 8, 1.2)] },
    /* 2 */ { groups: [g('grunt', 12, 1.0), g('runner', 4, 0.8, 9)] },
    /* 3 */ { groups: [g('runner', 10, 0.7), g('grunt', 10, 1.0, 4)] },
    /* 4 */ { groups: [g('grunt', 10, 0.9), g('armored', 4, 2.6, 5)] },
    /* 5 */ { title: 'Der Ogerhäuptling', groups: [g('grunt', 10, 0.9), g('ogre', 1, 0, 6), g('runner', 6, 0.6, 10)] },
    /* 6 */ { groups: [g('swarm', 18, 0.25), g('grunt', 8, 1, 3), g('swarm', 18, 0.25, 9)] },
    /* 7 */ { groups: [g('armored', 7, 2.0), g('runner', 12, 0.55, 4)] },
    /* 8 */ { groups: [g('grunt', 16, 0.7), g('healer', 2, 4, 3), g('armored', 6, 2, 8)] },
    /* 9 */ { groups: [g('swarm', 30, 0.2), g('runner', 14, 0.45, 5)] },
    /* 10 */ { title: 'Rückkehr des Häuptlings', groups: [g('armored', 6, 2.2), g('ogre', 1, 0, 6, 1.4), g('healer', 2, 3, 8)] },
    /* 11 */ { groups: [g('runner', 20, 0.4), g('swarm', 24, 0.2, 4)] },
    /* 12 */ { groups: [g('armored', 10, 1.6), g('healer', 4, 3.5, 2)] },
    /* 13 */ { groups: [g('grunt', 24, 0.5), g('armored', 8, 1.8, 4), g('runner', 16, 0.4, 10)] },
    /* 14 */ { groups: [g('swarm', 50, 0.15), g('healer', 4, 3, 3)] },
    /* 15 */ { title: 'Die Ogerbrüder', groups: [g('ogre', 2, 9, 0, 1.2), g('armored', 8, 2), g('swarm', 30, 0.25, 6)] },
    /* 16 */ { groups: [g('armored', 14, 1.3), g('healer', 6, 2.5, 3), g('runner', 20, 0.35, 6)] },
    /* 17 */ { groups: [g('swarm', 60, 0.12), g('runner', 16, 0.35, 3), g('armored', 6, 2, 8)] },
    /* 18 */ { groups: [g('grunt', 30, 0.4), g('armored', 16, 1.2, 3), g('healer', 6, 2.5, 6)] },
    /* 19 */ { groups: [g('runner', 24, 0.3), g('armored', 18, 1.1, 2), g('healer', 8, 2, 4), g('swarm', 40, 0.15, 8)] },
    /* 20 */ { title: 'Der Schattentitan', groups: [g('armored', 10, 1.4), g('titan', 1, 0, 8), g('healer', 6, 2.5, 10), g('ogre', 2, 6, 20, 1.2)] },
  ],
}
