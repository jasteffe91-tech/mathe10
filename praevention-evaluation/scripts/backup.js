'use strict';
/**
 * Erstellt eine konsistente Sicherungskopie der Datenbank (auch im laufenden Betrieb).
 *   npm run backup                 → backups/evaluation-JJJJ-MM-TT-HHMM.db
 *   npm run backup -- ziel.db
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const src = path.join(dataDir, 'evaluation.db');
if (!fs.existsSync(src)) { console.error(`Keine Datenbank gefunden: ${src}`); process.exit(1); }
const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16).replace(/-(\d\d)-(\d\d)$/, '-$1$2');
const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'backups', `evaluation-${ts}.db`));
fs.mkdirSync(path.dirname(target), { recursive: true });
const db = new Database(src, { readonly: true });
db.backup(target).then(() => { db.close(); console.log(`Sicherung erstellt: ${target}`); })
  .catch((e) => { console.error('Sicherung fehlgeschlagen:', e.message); process.exit(1); });
