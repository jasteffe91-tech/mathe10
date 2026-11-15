'use strict';
/**
 * Legt das Passwort für den Administrationsbereich fest.
 * Gespeichert wird nur ein scrypt-Hash in <DATA_DIR>/admin-password.hash.
 *   npm run set-password             (interaktive Eingabe)
 *   npm run set-password -- --print  (nur Hash ausgeben, z. B. für ADMIN_PASSWORD_HASH beim Hosting)
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { hashPassword, MIN_PASSWORD_LENGTH } = require('../src/auth');

const printOnly = process.argv.includes('--print');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const origWrite = rl._writeToOutput;
    rl._writeToOutput = function (s) { if (rl.stdoutMuted && s !== question) rl.output.write('*'); else origWrite.call(rl, s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    rl.stdoutMuted = true;
  });
}

(async () => {
  let pw = process.env.NEW_ADMIN_PASSWORD;
  if (!pw) {
    pw = await ask(`Neues Passwort (mind. ${MIN_PASSWORD_LENGTH} Zeichen): `);
    const pw2 = await ask('Passwort wiederholen: ');
    if (pw !== pw2) { console.error('Die Passwörter stimmen nicht überein.'); process.exit(1); }
  }
  if (!pw || pw.length < MIN_PASSWORD_LENGTH) { console.error(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`); process.exit(1); }
  const hash = hashPassword(pw);
  if (printOnly) {
    console.log('\nADMIN_PASSWORD_HASH=' + hash);
    return;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'admin-password.hash');
  fs.writeFileSync(file, hash + '\n', { mode: 0o600 });
  // Bestehende Anmeldungen ungültig machen
  try {
    const { openDatabase } = require('../src/db');
    const db = openDatabase(dataDir); db.deleteAllSessions(); db.close();
  } catch { /* Datenbank noch nicht vorhanden */ }
  console.log(`Passwort-Hash gespeichert: ${file}`);
  console.log('Hinweis: Ist ADMIN_PASSWORD_HASH gesetzt, hat diese Umgebungsvariable Vorrang. Server ggf. neu starten.');
})();
