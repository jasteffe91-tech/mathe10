'use strict';
/**
 * Lädt fiktive Beispieldaten in eine Datenbank – NUR für Test/Vorschau.
 * Aufruf: DATA_DIR=./demo-data npm run demo
 */
const path = require('path');
const { openDatabase } = require('../src/db');
const { demoResponses } = require('./demo-data');

const dir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'demo-data'));
if (dir === path.resolve(path.join(__dirname, '..', 'data')) && process.argv[2] !== '--force') {
  console.error('Abbruch: Beispieldaten werden nicht in den Produktivordner ./data geschrieben. Nutze DATA_DIR=./demo-data.');
  process.exit(1);
}
const db = openDatabase(dir);
const added = db.importResponses(demoResponses());
db.setSetting('expected', 8);
console.log(`${added} fiktive Beispielantworten in ${db.file} gespeichert (erwartete Anzahl: 8).`);
db.close();
