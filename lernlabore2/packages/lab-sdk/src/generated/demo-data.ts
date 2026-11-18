// AUTOMATISCH ERZEUGT von scripts/generate-demo-data.mjs – nicht von Hand ändern.
// Fiktive Demonstrationsdaten ohne Namen.
import type { LabManifest } from '../types';

export interface DemoDataset {
  group: { id: string; label: string; kind: 'demo' };
  participants: { id: string; pseudonym: string; code: string }[];
  answers: Record<string, Record<string, string | null>[]>;
  labs: LabManifest[];
}

export const DEMO_DATA: DemoDataset = {
  "group": {
    "id": "d0000000-0000-4000-8000-000000000001",
    "label": "DEMO – Fortbildung (fiktiv)",
    "kind": "demo"
  },
  "participants": [
    {
      "id": "d0000000-0000-4000-8000-000000000101",
      "pseudonym": "D-7KQP",
      "code": "TEST-HAUS-2345"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000102",
      "pseudonym": "D-3MXR",
      "code": "TEST-BAUM-2346"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000103",
      "pseudonym": "D-9TBA",
      "code": "TEST-BERG-2347"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000104",
      "pseudonym": "D-4FZW",
      "code": "TEST-WAND-2348"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000105",
      "pseudonym": "D-8NPC",
      "code": "TEST-SAND-2349"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000106",
      "pseudonym": "D-2HJV",
      "code": "TEST-STAR-2352"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000107",
      "pseudonym": "D-6RSY",
      "code": "TEST-ZAHN-2353"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000108",
      "pseudonym": "D-5GDE",
      "code": "TEST-HUND-2354"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000109",
      "pseudonym": "D-3WKA",
      "code": "TEST-RABE-2355"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000110",
      "pseudonym": "D-7VBM",
      "code": "TEST-ENTE-2356"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000111",
      "pseudonym": "D-9CXH",
      "code": "TEST-MAUS-2357"
    },
    {
      "id": "d0000000-0000-4000-8000-000000000112",
      "pseudonym": "D-4PTN",
      "code": "TEST-HASE-2358"
    }
  ],
  "answers": {
    "physik-entdecker": [
      {
        "m1-vermutung": "steil",
        "m2-versuch": null,
        "m3-auswertung": "steil",
        "e1-vermutung": "kreis",
        "e2-versuch": null,
        "e3-auswertung": "kreis"
      },
      {
        "m1-vermutung": "flach",
        "m2-versuch": null,
        "m3-auswertung": "steil",
        "e1-vermutung": "batterie",
        "e2-versuch": null,
        "e3-auswertung": "kreis"
      },
      {
        "m1-vermutung": "mittel",
        "m2-versuch": null,
        "m3-auswertung": "gleich",
        "e1-vermutung": "kreis"
      },
      {
        "m1-vermutung": "steil",
        "m2-versuch": null,
        "m3-auswertung": "steil",
        "e1-vermutung": "weiss-nicht",
        "e2-versuch": null
      },
      {
        "m1-vermutung": "steil",
        "m2-versuch": null
      },
      {
        "m1-vermutung": "flach",
        "m2-versuch": null,
        "m3-auswertung": "flach",
        "e1-vermutung": "kabel",
        "e2-versuch": null,
        "e3-auswertung": "muede"
      },
      {
        "m1-vermutung": "steil",
        "m2-versuch": null,
        "m3-auswertung": "steil",
        "e1-vermutung": "kreis",
        "e2-versuch": null,
        "e3-auswertung": "kreis"
      },
      {
        "m1-vermutung": "mittel"
      },
      {
        "m1-vermutung": "steil",
        "m2-versuch": null,
        "m3-auswertung": "steil"
      },
      {
        "m1-vermutung": "flach",
        "m2-versuch": null,
        "m3-auswertung": "steil",
        "e1-vermutung": "kreis",
        "e2-versuch": null,
        "e3-auswertung": "batterie-aus"
      }
    ]
  },
  "labs": [
    {
      "id": "physik-entdecker",
      "version": "1.0",
      "title": "Physik-Entdecker: Bewegung und Strom",
      "subject": "Physik / Sachunterricht",
      "audience": "Klasse 4 (9–10 Jahre)",
      "tasks": [
        {
          "task_id": "m1-vermutung",
          "section": "Mechanik: Die rollende Kugel",
          "title": "Vermutung: Auf welcher Rampe rollt die Kugel am schnellsten nach unten?",
          "kind": "choice",
          "graded": false,
          "options": [
            {
              "value": "flach",
              "label": "Auf der flachen Rampe"
            },
            {
              "value": "mittel",
              "label": "Auf der mittleren Rampe"
            },
            {
              "value": "steil",
              "label": "Auf der steilen Rampe"
            }
          ]
        },
        {
          "task_id": "m2-versuch",
          "section": "Mechanik: Die rollende Kugel",
          "title": "Versuch: Kugel auf drei Rampen rollen lassen",
          "kind": "simulation"
        },
        {
          "task_id": "m3-auswertung",
          "section": "Mechanik: Die rollende Kugel",
          "title": "Auswertung: Was hast du beobachtet?",
          "kind": "choice",
          "graded": true,
          "options": [
            {
              "value": "steil",
              "label": "Auf der steilen Rampe war die Kugel am schnellsten unten."
            },
            {
              "value": "flach",
              "label": "Auf der flachen Rampe war die Kugel am schnellsten unten."
            },
            {
              "value": "gleich",
              "label": "Die Kugel war auf allen Rampen gleich schnell unten."
            }
          ],
          "solution": {
            "correct": [
              "steil"
            ]
          }
        },
        {
          "task_id": "e1-vermutung",
          "section": "Strom: Bring die Lampe zum Leuchten!",
          "title": "Vermutung: Was braucht die Lampe, damit sie leuchtet?",
          "kind": "choice",
          "graded": false,
          "options": [
            {
              "value": "batterie",
              "label": "Nur eine Batterie"
            },
            {
              "value": "kreis",
              "label": "Einen geschlossenen Kreis aus Batterie, Kabeln und Lampe"
            },
            {
              "value": "kabel",
              "label": "Nur ein Kabel"
            },
            {
              "value": "weiss-nicht",
              "label": "Ich weiß es noch nicht"
            }
          ]
        },
        {
          "task_id": "e2-versuch",
          "section": "Strom: Bring die Lampe zum Leuchten!",
          "title": "Versuch: Stromkreis schließen und öffnen",
          "kind": "simulation"
        },
        {
          "task_id": "e3-auswertung",
          "section": "Strom: Bring die Lampe zum Leuchten!",
          "title": "Auswertung: Warum leuchtet die Lampe nur manchmal?",
          "kind": "choice",
          "graded": true,
          "options": [
            {
              "value": "kreis",
              "label": "Die Lampe leuchtet nur, wenn der Weg für den Strom rundherum geschlossen ist."
            },
            {
              "value": "muede",
              "label": "Die Lampe braucht manchmal eine Pause."
            },
            {
              "value": "batterie-aus",
              "label": "Die Batterie schaltet sich von selbst aus."
            }
          ],
          "solution": {
            "correct": [
              "kreis"
            ]
          }
        }
      ]
    },
    {
      "id": "beispiel-labor",
      "version": "1.0",
      "title": "Beispiel-Labor: Schwimmt oder sinkt?",
      "subject": "Physik",
      "audience": "Vorlage für neue Lernlabore",
      "tasks": [
        {
          "task_id": "a1-vermutung",
          "section": "Schwimmen und Sinken",
          "title": "Vermutung: Schwimmt ein Apfel?",
          "kind": "choice",
          "options": [
            {
              "value": "schwimmt",
              "label": "Er schwimmt."
            },
            {
              "value": "sinkt",
              "label": "Er sinkt."
            }
          ]
        },
        {
          "task_id": "a2-begruendung",
          "section": "Schwimmen und Sinken",
          "title": "Begründung in eigenen Worten",
          "kind": "text"
        }
      ]
    }
  ]
};
