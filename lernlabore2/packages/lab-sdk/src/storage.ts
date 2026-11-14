// Lokaler Zwischenspeicher im Browser (IndexedDB) für
//  * die Warteschlange noch nicht bestätigter Speicherungen (überlebt Neustarts)
//  * eine Kopie des zuletzt geladenen Lernstands (für Neuladen ohne Internet)
// Fällt IndexedDB aus (z. B. sehr alte Browser), wird im Arbeitsspeicher
// gepuffert – dann gehen Offline-Änderungen beim Schließen verloren; das SDK
// meldet dies ehrlich über `persistent = false`.
import type { LabCache, QueueItem } from './types';

export interface LocalStore {
  readonly persistent: boolean;
  add(item: QueueItem): Promise<void>;
  list(endpoint: string, participantKey: string): Promise<QueueItem[]>;
  remove(id: string): Promise<void>;
  putCache(c: LabCache): Promise<void>;
  getCache(key: string): Promise<LabCache | null>;
  deleteCache(key: string): Promise<void>;
  pruneCaches(maxAgeMs: number): Promise<void>;
}

export class MemoryStore implements LocalStore {
  readonly persistent: boolean = false;
  private queue = new Map<string, QueueItem>();
  private cache = new Map<string, LabCache>();
  async add(item: QueueItem) { this.queue.set(item.id, structuredClone(item)); }
  async list(endpoint: string, key: string) {
    return [...this.queue.values()].filter((i) => i.endpoint === endpoint && i.participantKey === key)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map((i) => structuredClone(i));
  }
  async remove(id: string) { this.queue.delete(id); }
  async putCache(c: LabCache) { this.cache.set(c.key, structuredClone(c)); }
  async getCache(key: string) { const c = this.cache.get(key); return c ? structuredClone(c) : null; }
  async deleteCache(key: string) { this.cache.delete(key); }
  async pruneCaches(maxAgeMs: number) {
    const limit = new Date(Date.now() - maxAgeMs).toISOString();
    for (const [k, c] of this.cache) if (c.savedAt < limit) this.cache.delete(k);
  }
}

const DB_NAME = 'lernlabor-sdk';
const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IndexedDbStore implements LocalStore {
  readonly persistent = true;
  private dbp: Promise<IDBDatabase>;

  constructor(factory: IDBFactory = indexedDB) {
    this.dbp = new Promise((resolve, reject) => {
      const open = factory.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('queue')) {
          const q = db.createObjectStore('queue', { keyPath: 'id' });
          q.createIndex('by_participant', ['endpoint', 'participantKey']);
        }
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error('IndexedDB blockiert'));
    });
  }

  static async create(factory?: IDBFactory): Promise<LocalStore> {
    try {
      const f = factory ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined);
      if (!f) return new MemoryStore();
      const s = new IndexedDbStore(f);
      await s.dbp;
      return s;
    } catch {
      return new MemoryStore();
    }
  }

  private async tx(store: string, mode: IDBTransactionMode) {
    const db = await this.dbp;
    return db.transaction(store, mode).objectStore(store);
  }

  async add(item: QueueItem) { await req((await this.tx('queue', 'readwrite')).put(item)); }
  async list(endpoint: string, key: string) {
    const s = await this.tx('queue', 'readonly');
    const items = (await req(s.index('by_participant').getAll([endpoint, key]))) as QueueItem[];
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
  async remove(id: string) { await req((await this.tx('queue', 'readwrite')).delete(id)); }
  async putCache(c: LabCache) { await req((await this.tx('cache', 'readwrite')).put(c)); }
  async getCache(key: string) { return ((await req((await this.tx('cache', 'readonly')).get(key))) as LabCache) ?? null; }
  async deleteCache(key: string) { await req((await this.tx('cache', 'readwrite')).delete(key)); }
  async pruneCaches(maxAgeMs: number) {
    const limit = new Date(Date.now() - maxAgeMs).toISOString();
    const s = await this.tx('cache', 'readwrite');
    const all = (await req(s.getAll())) as LabCache[];
    for (const c of all) if (c.savedAt < limit) await req(s.delete(c.key));
  }
}
