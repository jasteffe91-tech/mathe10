import type { LevelDef, ThemeId } from '../game/types';
import { meadow1, meadow2, meadow3 } from './world1';
import { cave1, cave2, cave3 } from './world2';
import { clouds1, clouds2, clouds3 } from './world3';
import { volcano1, volcano2, volcano3 } from './world4';

export const WORLD_NAMES = ['Die grüne Wiese', 'Die Kristallhöhle', 'Die Wolkenwelt', 'Die Vulkaninsel'] as const;
export const WORLD_THEMES: ThemeId[] = ['meadow', 'cave', 'clouds', 'volcano'];

const FACTORIES: (() => LevelDef)[][] = [
  [meadow1, meadow2, meadow3],
  [cave1, cave2, cave3],
  [clouds1, clouds2, clouds3],
  [volcano1, volcano2, volcano3],
];

const cache = new Map<string, LevelDef>();

/** Leveldaten (werden einmal gebaut und dann wiederverwendet – sie sind unveränderlich). */
export function getLevel(world: number, index: number): LevelDef {
  const key = `${world}-${index}`;
  let lv = cache.get(key);
  if (!lv) {
    lv = FACTORIES[world][index]();
    cache.set(key, lv);
  }
  return lv;
}

export function allLevels(): LevelDef[] {
  return FACTORIES.flatMap((w, wi) => w.map((_, li) => getLevel(wi, li)));
}

export const LEVEL_NAMES: string[][] = FACTORIES.map((w, wi) => w.map((_, li) => getLevel(wi, li).name));
