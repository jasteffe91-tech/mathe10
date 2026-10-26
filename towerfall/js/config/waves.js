// Wellen. Eine Welle besteht aus Gruppen, die parallel starten:
//   type      Gegnertyp (siehe enemies.js)
//   count     Anzahl
//   interval  Sekunden zwischen zwei Gegnern der Gruppe
//   delay     Sekunden nach Wellenbeginn, bevor die Gruppe startet
//   hp        zusätzlicher Lebenspunkte-Faktor für diese Gruppe (Standard 1)
// intro: Gegnertyp (oder 'elite'), der in dieser Welle zum ersten Mal auftaucht – das Spiel erklärt
// ihn beim Wellenstart. Neue Fähigkeiten kommen schrittweise: Stampfen des Ogers (5), Geist (6), Harpyie (7),
// Berserker (8), Runenhexer (11), Elite (13). Die Schwierigkeit steigt über Mischung, Fähigkeiten und Abstände, nicht nur über Leben.

const g = (type, count, interval, delay = 0, hp = 1) => ({ type, count, interval, delay, hp })
// Elite-Gruppe: mehr Leben und Panzerung, doppelte Belohnung, goldener Rand (siehe balance.js)
const elite = (type, count, interval, delay = 0) => ({ ...g(type, count, interval, delay), elite: true })

export const WAVE_SETS = {
  classic: [
    /* 1 */ { groups: [g('grunt', 8, 1.2)] },
    /* 2 */ { groups: [g('grunt', 12, 1.0), g('runner', 4, 0.8, 9)] },
    /* 3 */ { groups: [g('runner', 10, 0.7), g('grunt', 10, 1.0, 4)] },
    /* 4 */ { groups: [g('grunt', 10, 0.9), g('armored', 4, 2.6, 5)] },
    /* 5 */ { title: 'Der Ogerhäuptling', intro: 'ogre', groups: [g('grunt', 10, 0.9), g('ogre', 1, 0, 6), g('runner', 6, 0.6, 10)] },
    /* 6 */ { intro: 'wraith', groups: [g('swarm', 18, 0.25), g('wraith', 6, 1.2, 3), g('swarm', 14, 0.25, 10)] },
    /* 7 */ { intro: 'harpy', groups: [g('armored', 6, 2.0), g('harpy', 4, 1.4, 3), g('runner', 10, 0.55, 6)] },
    /* 8 */ { intro: 'berserker', groups: [g('grunt', 12, 0.7), g('berserker', 5, 2.2, 3), g('healer', 2, 4, 6), g('armored', 4, 2, 10)] },
    /* 9 */ { groups: [g('swarm', 28, 0.2), g('wraith', 6, 1, 3), g('runner', 12, 0.45, 6)] },
    /* 10 */ { title: 'Rückkehr des Häuptlings', groups: [g('armored', 6, 2.2), g('ogre', 1, 0, 6, 1.4), g('berserker', 4, 2, 9), g('healer', 2, 3, 12)] },
    /* 11 */ { intro: 'hexer', groups: [g('runner', 16, 0.4), g('hexer', 2, 4, 4), g('swarm', 22, 0.2, 6)] },
    /* 12 */ { groups: [g('armored', 8, 1.6), g('wraith', 8, 1, 3), g('harpy', 6, 1, 6), g('healer', 3, 3.5, 8)] },
    /* 13 */ { intro: 'elite', groups: [g('grunt', 20, 0.5), elite('armored', 3, 3, 4), g('berserker', 6, 1.8, 8), g('runner', 12, 0.4, 12)] },
    /* 14 */ { groups: [g('swarm', 45, 0.15), g('hexer', 3, 3, 3), g('wraith', 8, 0.9, 7)] },
    /* 15 */ { title: 'Die Ogerbrüder', groups: [g('ogre', 2, 9, 0, 1.2), g('armored', 8, 2), g('hexer', 2, 5, 5), g('swarm', 26, 0.25, 8)] },
    /* 16 */ { groups: [g('armored', 10, 1.3), g('healer', 4, 2.5, 3), g('berserker', 8, 1.4, 5), g('harpy', 8, 0.9, 8), g('runner', 12, 0.35, 11)] },
    /* 17 */ { groups: [g('swarm', 50, 0.12), g('wraith', 12, 0.8, 3), elite('armored', 5, 2.4, 8)] },
    /* 18 */ { groups: [g('grunt', 24, 0.4), g('armored', 12, 1.2, 3), g('hexer', 4, 3, 5), g('healer', 5, 2.5, 7), g('berserker', 6, 1.5, 10)] },
    /* 19 */ { groups: [g('runner', 20, 0.3), elite('armored', 6, 1.8, 2), g('wraith', 10, 0.8, 4), g('harpy', 10, 0.8, 6), g('healer', 6, 2, 8), g('swarm', 30, 0.15, 10), g('hexer', 3, 4, 12)] },
    /* 20 */ { title: 'Der Schattentitan', groups: [elite('armored', 6, 1.8), g('titan', 1, 0, 8), g('wraith', 8, 1, 10), g('healer', 5, 2.5, 12), g('hexer', 3, 4, 14), g('ogre', 2, 6, 20, 1.2)] },
  ],
}
