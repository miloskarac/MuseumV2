import { UPGRADE_EFFECTS } from '../content/upgrades.ts';
import type { UpgradeId } from '../content/upgrades.ts';
export type UpgradeReceipt = { id: 'boots' | 'shovel'; paid: number } | { id: 'helper-tools'; paid: number; helperId: 'helper-1' };
export type UpgradeState = { version: 1; owned: UpgradeReceipt[] };
type WithUpgrades = { version: number; upgrades?: UpgradeState };
export const ownsUpgrade = (save: WithUpgrades, id: UpgradeId) => save.upgrades?.owned.some(r => r.id === id) ?? false;
export const playerWalkRate = (save: WithUpgrades) => ownsUpgrade(save, 'boots') ? UPGRADE_EFFECTS.walk : 1;
export const playerDigRate = (save: WithUpgrades) => ownsUpgrade(save, 'shovel') ? UPGRADE_EFFECTS.shovel : 1;
export const helperWorkRate = (save: WithUpgrades) => ownsUpgrade(save, 'helper-tools') ? UPGRADE_EFFECTS.helper : 1;
