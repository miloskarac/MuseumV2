import { PERMIAN_SITE_IDS } from './permian-progression.ts';
import type { PermianSiteId } from './permian-progression.ts';

// Future-only balancing metadata. No live grid, damage calculation or save dependency.
export const PERMIAN_MATERIAL_CANDIDATES = { 'loose-soil': 1, 'packed-soil': 2, 'resistant-soil': 3 } as const;
export type PermianMaterialId = keyof typeof PERMIAN_MATERIAL_CANDIDATES;
export type PermianDifficultyPlan = {
  readonly siteId: PermianSiteId;
  readonly layers: number;
  readonly groups: readonly { readonly materialId: PermianMaterialId; readonly multiplier: number }[];
};
const layerCounts = [1, 2, 3, 3, 4, 4, 5, 5] as const;
export const PERMIAN_DIFFICULTY_PLANS: readonly PermianDifficultyPlan[] = PERMIAN_SITE_IDS.map((siteId, i) => ({
  siteId, layers: layerCounts[i],
  groups: ([{ materialId: 'loose-soil', multiplier: 1 }, { materialId: 'packed-soil', multiplier: 1.35 },
    { materialId: 'resistant-soil', multiplier: 1.7 }] as const).slice(0, Math.ceil(layerCounts[i] / 2)),
}));
export function validPermianDifficulty(plan: PermianDifficultyPlan): boolean {
  return PERMIAN_SITE_IDS.includes(plan.siteId) && Number.isInteger(plan.layers) && plan.layers >= 1 && plan.layers <= 5
    && plan.groups.length === Math.ceil(plan.layers / 2)
    && plan.groups.every((group, i) => Object.hasOwn(PERMIAN_MATERIAL_CANDIDATES, group.materialId)
      && Number.isFinite(group.multiplier) && group.multiplier > 0
      && (i === 0 || group.materialId !== plan.groups[i - 1].materialId && group.multiplier !== plan.groups[i - 1].multiplier));
}
// Zero-based layer index: 0/1 share group 0; 2/3 share group 1; 4 uses group 2.
export function permianLayerCandidate(plan: PermianDifficultyPlan, layer: number) {
  if (!validPermianDifficulty(plan) || !Number.isInteger(layer) || layer < 0 || layer >= plan.layers) return undefined;
  const group = plan.groups[Math.floor(layer / 2)];
  return { ...group, resistance: PERMIAN_MATERIAL_CANDIDATES[group.materialId] };
}
