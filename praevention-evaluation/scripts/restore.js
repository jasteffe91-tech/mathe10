'use strict';
/**
 * Spielt eine JSON-Datensicherung (Download „Datensicherung (JSON)“ im Admin-Bereich) wieder ein.
 * Bereits vorhandene Abgaben (gleiche ID/gleiches Token) werden nicht doppelt angelegt.
 *   npm run restore -- evaluation-sicherung-2026-11-15.json
 */
const fs = require('fs');
const path = require('path');
const { openDatabase } = require('../src/db');

const file = process.argv[2];
if (!file) { console.error('Bitte Pfad zur JSON-Sicherung angeben.'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (data.format !== 'praevention-evaluation-backup' || !Array.isArray(data.responses)) {
  console.error('Die Datei ist keine gültige Datensicherung dieser Anwendung.'); process.exit(1);
}
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const db = openDatabase(dataDir);
const existing = new Set(db.listResponses().map((r) => r.id));
const added = db.importResponses(data.responses.filter((r) => !existing.has(r.id)).map((r) => ({ ...r, submissionToken: 'restore-' + r.id })));
if (data.settings && data.settings.expected && !db.getSetting('expected')) db.setSetting('expected', data.settings.expected);
console.log(`${added} Abgaben wiederhergestellt (${data.responses.length} in der Sicherung).`);
db.close();
