'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

/**
 * Persistente Speicherung in einer SQLite-Datei (Standard: ./data/evaluation.db).
 * Gespeichert werden ausschließlich: Antworten, optionale Klassenbezeichnung,
 * Abgabedatum (nur Tag, keine Uhrzeit), ein zufälliges Abgabe-Token gegen Doppelspeicherung.
 * Keine IP-Adressen, keine Namen, keine Geräte- oder Browserdaten.
 */
function openDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'evaluation.db');
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      submission_token TEXT NOT NULL UNIQUE,
      submitted_on TEXT NOT NULL,
      class_label TEXT,
      answers TEXT NOT NULL,
      form_version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `);

  const stmts = {
    insert: db.prepare(`INSERT INTO responses (id, submission_token, submitted_on, class_label, answers, form_version)
                        VALUES (@id, @submission_token, @submitted_on, @class_label, @answers, @form_version)`),
    byToken: db.prepare('SELECT id FROM responses WHERE submission_token = ?'),
    all: db.prepare('SELECT id, submitted_on, class_label, answers FROM responses ORDER BY id'),
    count: db.prepare('SELECT COUNT(*) AS n FROM responses'),
    deleteOne: db.prepare('DELETE FROM responses WHERE id = ?'),
    deleteAll: db.prepare('DELETE FROM responses'),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    delSetting: db.prepare('DELETE FROM settings WHERE key = ?'),
    addSession: db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)'),
    getSession: db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?'),
    delSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
    delAllSessions: db.prepare('DELETE FROM sessions'),
  };

  const api = {
    file,
    raw: db,
    /** Speichert eine Antwort. Gibt {id, duplicate} zurück; bei bekanntem Token wird nichts doppelt gespeichert. */
    saveResponse({ token, classLabel, answers, formVersion = 1 }) {
      const tx = db.transaction(() => {
        const existing = stmts.byToken.get(token);
        if (existing) return { id: existing.id, duplicate: true };
        const id = crypto.randomUUID();
        stmts.insert.run({
          id,
          submission_token: token,
          submitted_on: new Date().toISOString().slice(0, 10),
          class_label: classLabel || null,
          answers: JSON.stringify(answers),
          form_version: formVersion,
        });
        return { id, duplicate: false };
      });
      return tx();
    },
    /** Alle Antworten. Sortierung nach zufälliger ID – bewusst nicht chronologisch (Anonymität). */
    listResponses() {
      return stmts.all.all().map((r) => ({
        id: r.id,
        submittedOn: r.submitted_on,
        classLabel: r.class_label,
        answers: JSON.parse(r.answers),
      }));
    },
    countResponses() {
      return stmts.count.get().n;
    },
    deleteResponse(id) {
      return stmts.deleteOne.run(id).changes > 0;
    },
    deleteAllResponses() {
      const n = stmts.deleteAll.run().changes;
      // Speicherplatz tatsächlich freigeben, damit gelöschte Inhalte nicht in der Datei verbleiben.
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.exec('VACUUM');
      return n;
    },
    importResponses(list) {
      const tx = db.transaction((items) => {
        let added = 0;
        for (const r of items) {
          const token = r.submissionToken || crypto.randomUUID();
          if (stmts.byToken.get(token)) continue;
          stmts.insert.run({
            id: r.id || crypto.randomUUID(),
            submission_token: token,
            submitted_on: r.submittedOn || new Date().toISOString().slice(0, 10),
            class_label: r.classLabel || null,
            answers: JSON.stringify(r.answers || {}),
            form_version: r.formVersion || 1,
          });
          added++;
        }
        return added;
      });
      return tx(list);
    },
    getSetting(key, fallback = null) {
      const row = stmts.getSetting.get(key);
      return row ? JSON.parse(row.value) : fallback;
    },
    setSetting(key, value) {
      if (value === null || value === undefined) stmts.delSetting.run(key);
      else stmts.setSetting.run(key, JSON.stringify(value));
    },
    addSession(tokenHash, expiresAt) {
      stmts.purgeSessions.run(Date.now());
      stmts.addSession.run(tokenHash, expiresAt);
    },
    getSession(tokenHash) {
      const row = stmts.getSession.get(tokenHash);
      if (!row) return null;
      if (row.expires_at < Date.now()) {
        stmts.delSession.run(tokenHash);
        return null;
      }
      return row;
    },
    deleteSession(tokenHash) {
      stmts.delSession.run(tokenHash);
    },
    deleteAllSessions() {
      stmts.delAllSessions.run();
    },
    close() {
      db.close();
    },
  };
  return api;
}

module.exports = { openDatabase };
