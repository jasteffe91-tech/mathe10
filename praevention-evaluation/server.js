'use strict';
const path = require('path');
const fs = require('fs');

// Optionale .env-Datei im Programmordner laden (Node ≥ 20.12)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);
const { createApp } = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));

const { app, db, auth } = createApp({ dataDir: DATA_DIR });

const server = app.listen(PORT, HOST, () => {
  console.log(`Evaluation läuft auf http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  Fragebogen:          /`);
  console.log(`  Administration:      /admin`);
  console.log(`  Datenbank:           ${db.file}`);
  if (!auth.configured) {
    console.warn('  ACHTUNG: Kein Administrationspasswort eingerichtet. Bitte `npm run set-password` ausführen oder ADMIN_PASSWORD_HASH setzen.');
  } else {
    console.log(`  Passwortquelle:      ${auth.source}`);
  }
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
