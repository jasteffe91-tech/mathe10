import type { Rect } from './types';

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function inset(r: Rect, by: number): Rect {
  return { x: r.x + by, y: r.y + by, w: Math.max(1, r.w - 2 * by), h: Math.max(1, r.h - 2 * by) };
}

/** Kreis (Mittelpunkt, Radius) gegen Rechteck. */
export function circleHitsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Einfaches räumliches Raster entlang der x-Achse. Level sind lang und flach,
 * daher reicht eine Einteilung in senkrechte Streifen.
 */
export class XBuckets {
  private readonly buckets: number[][];
  constructor(
    private readonly size: number,
    length: number,
  ) {
    const n = Math.max(1, Math.ceil(length / size) + 4);
    this.buckets = Array.from({ length: n }, () => []);
  }

  private index(x: number): number {
    return Math.min(this.buckets.length - 1, Math.max(0, Math.floor(x / this.size) + 1));
  }

  insert(id: number, x0: number, x1: number): void {
    const a = this.index(Math.min(x0, x1));
    const b = this.index(Math.max(x0, x1));
    for (let i = a; i <= b; i++) this.buckets[i].push(id);
  }

  /** Schreibt alle Objekte, die den Bereich [x0, x1] berühren könnten, genau einmal nach out. */
  query(x0: number, x1: number, seen: Uint32Array, stamp: number, out: number[]): number[] {
    out.length = 0;
    const a = this.index(x0);
    const b = this.index(x1);
    for (let i = a; i <= b; i++) {
      const bucket = this.buckets[i];
      for (let k = 0; k < bucket.length; k++) {
        const id = bucket[k];
        if (seen[id] === stamp) continue;
        seen[id] = stamp;
        out.push(id);
      }
    }
    return out;
  }
}
