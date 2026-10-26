import { describe, expect, it } from 'vitest';
import { defaultSave, memoryStorage, ProgressStore, sanitize, SAVE_KEY } from '../../src/progress/saveData';

describe('Spielstand', () => {
  it('beginnt mit Welt 1, Level 1', () => {
    const p = new ProgressStore(memoryStorage());
    expect(p.data).toEqual(defaultSave());
    expect(p.nextStage()).toEqual({ world: 0, kind: 'level', index: 0 });
    expect(p.isLevelUnlocked(0, 0)).toBe(true);
    expect(p.isLevelUnlocked(0, 1)).toBe(false);
    expect(p.isBossUnlocked(0)).toBe(false);
    expect(p.isWorldUnlocked(1)).toBe(false);
  });

  it('geschaffte Level schalten das nächste Level und den Boss frei', () => {
    const p = new ProgressStore(memoryStorage());
    p.completeLevel('1-1', { coins: 20, starIds: [0, 2], time: 40 });
    expect(p.isLevelUnlocked(0, 1)).toBe(true);
    expect(p.nextStage()).toEqual({ world: 0, kind: 'level', index: 1 });
    p.completeLevel('1-2', { coins: 10, starIds: [], time: 50 });
    p.completeLevel('1-3', { coins: 10, starIds: [1], time: 50 });
    expect(p.isBossUnlocked(0)).toBe(true);
    expect(p.hasWorldBadge(0)).toBe(true);
    expect(p.nextStage()).toEqual({ world: 0, kind: 'boss' });
  });

  it('ein besiegter Boss schaltet die nächste Welt frei', () => {
    const p = new ProgressStore(memoryStorage());
    for (const id of ['1-1', '1-2', '1-3']) p.completeLevel(id, { coins: 1, starIds: [], time: 30 });
    const r = p.defeatBoss(0, 25);
    expect(r.unlockedWorld).toBe(1);
    expect(r.gameComplete).toBe(false);
    expect(p.isWorldUnlocked(1)).toBe(true);
    expect(p.isBossDefeated(0)).toBe(true);
    expect(p.nextStage()).toEqual({ world: 1, kind: 'level', index: 0 });
    const last = p.defeatBoss(3, 25);
    expect(last.gameComplete).toBe(true);
    expect(p.data.gameCompleted).toBe(true);
  });

  it('Bestleistungen und Sterne bleiben erhalten (Vereinigung über alle Läufe)', () => {
    const p = new ProgressStore(memoryStorage());
    expect(p.completeLevel('1-1', { coins: 30, starIds: [0], time: 45 })).toMatchObject({ newBestCoins: true, newBestTime: true, newStars: 1 });
    expect(p.completeLevel('1-1', { coins: 10, starIds: [2], time: 50 })).toMatchObject({ newBestCoins: false, newBestTime: false, newStars: 1 });
    const rec = p.record('1-1');
    expect(rec.bestCoins).toBe(30);
    expect(rec.bestTime).toBe(45);
    expect(rec.stars).toEqual([0, 2]);
    expect(p.data.totalCoins).toBe(40);
  });

  it('wird gespeichert und beim nächsten Start wieder geladen', () => {
    const storage = memoryStorage();
    const a = new ProgressStore(storage);
    a.completeLevel('1-1', { coins: 12, starIds: [1], time: 40 });
    a.setCheckpoint('1-2', 1);
    a.updateSettings({ sound: false, helpMode: true });
    const b = new ProgressStore(storage);
    expect(b.data).toEqual(a.data);
    expect(b.checkpointFor('1-2')).toBe(1);
    expect(b.checkpointFor('1-3')).toBe(-1);
    expect(JSON.parse(storage.getItem(SAVE_KEY) as string).levels['1-1'].bestCoins).toBe(12);
  });

  it('Zurücksetzen löscht den Fortschritt, behält aber Einstellungen', () => {
    const storage = memoryStorage();
    const p = new ProgressStore(storage);
    p.completeLevel('1-1', { coins: 12, starIds: [1], time: 40 });
    p.updateSettings({ sound: false });
    p.reset();
    expect(p.data.levels).toEqual({});
    expect(p.data.totalCoins).toBe(0);
    expect(p.data.settings.sound).toBe(false);
    expect(new ProgressStore(storage).data.levels).toEqual({});
  });

  it('kaputte oder manipulierte Daten führen nicht zum Absturz', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{kaputt');
    expect(new ProgressStore(storage).data).toEqual(defaultSave());
    const d = sanitize({
      version: 1,
      unlockedWorld: 99,
      totalCoins: -5,
      bossesDefeated: [0, 0, 7, 'x'],
      levels: { '1-1': { completed: true, stars: [0, 0, 99], bestCoins: 'viele' }, 'x-9': { completed: true } },
      checkpoint: { levelId: '9-9', index: 1 },
    });
    expect(d.unlockedWorld).toBe(3);
    expect(d.totalCoins).toBe(0);
    expect(d.bossesDefeated).toEqual([0]);
    expect(d.levels['1-1']).toEqual({ completed: true, stars: [0], bestCoins: 0, bestTime: 0 });
    expect(d.levels['x-9']).toBeUndefined();
    expect(d.checkpoint).toBeNull();
    expect(sanitize({ version: 2 })).toEqual(defaultSave());
  });

  it('der Checkpoint eines Levels wird beim Abschluss gelöscht', () => {
    const p = new ProgressStore(memoryStorage());
    p.setCheckpoint('1-1', 1);
    p.completeLevel('1-1', { coins: 1, starIds: [], time: 30 });
    expect(p.checkpointFor('1-1')).toBe(-1);
  });
});
