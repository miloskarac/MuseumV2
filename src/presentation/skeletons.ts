import { buildFossil, FOSSIL_ANCHORS } from './fossil';
import { buildEryops, ERYOPS_ANCHORS } from './eryops';
import type { XYZ } from './shapes';

export const SKELETONS = {
  dimetrodon: { build: buildFossil, anchors: FOSSIL_ANCHORS as Record<string, XYZ> },
  eryops: { build: buildEryops, anchors: ERYOPS_ANCHORS },
};
export type SkeletonId = keyof typeof SKELETONS;
