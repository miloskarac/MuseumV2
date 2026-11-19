import { createMvpSave } from './mvp-economy.ts';
import type { MvpSave } from './mvp-economy.ts';
export type Room1GameSave = Omit<MvpSave, 'version'> & { version: 26 };
// A newly introduced find reopens the existing pit, retaining every excavated
// column, reward claim and receipt. No stand, part, money or helper is granted.
export const migrateRoom1Game = (save: MvpSave): Room1GameSave => ({ ...save, version: 26,
  closedSites: save.closedSites.filter(id => id !== 'eryops-dig') });
export const createRoom1Game = (seed: number) => migrateRoom1Game(createMvpSave(seed));
