import type { DigSite } from '../content/journey.ts';

// One placement describes both the sloping silhouette and the dirt covering it.
// Coverage conservatively includes the full footprint, as for flat finds.
export function findBurial(site: DigSite, id: string) {
  const cells = site.cells.filter(cell => cell.discoveryId === id);
  const placement = site.burial?.[id];
  const { levels, floorY, tileSize } = site.grid;
  const layerHeight = -floorY / levels;
  if (placement && (!Number.isInteger(placement.topLayer) || !Number.isInteger(placement.bottomLayer)
    || placement.topLayer < 0 || placement.bottomLayer < placement.topLayer || placement.bottomLayer >= levels)) {
    throw new Error(`Invalid burial layers for ${id} in ${site.id}`);
  }
  const axis = placement?.axis ?? 'x';
  const start = Math.min(...cells.map(cell => cell[axis])) - tileSize / 2 + 0.09;
  const end = Math.max(...cells.map(cell => cell[axis])) + tileSize / 2 - 0.09;
  // Leave a little earth beneath each end. Unspecified finds retain their exact
  // original floor elevation. No placement or mesh state is saved.
  const depthAt = (coordinate: number) => placement
    ? placement.topLayer + 0.5 + (placement.bottomLayer - placement.topLayer)
      * Math.max(0, Math.min(1, (coordinate - start) / (end - start)))
    : levels - 0.035 / layerHeight;
  const coverage = cells.map(cell => ({ cell,
    firstLayer: Math.floor(depthAt(cell[axis] - tileSize / 2)),
    lastLayer: Math.floor(depthAt(cell[axis] + tileSize / 2)),
  }));
  return { coverage,
    heightAt: (x: number, z: number) => -depthAt(axis === 'x' ? x : z) * layerHeight,
  };
}

export function findIsExposed(dig: Record<string, number>, site: DigSite, id: string) {
  const { coverage } = findBurial(site, id);
  return coverage.length > 0 && coverage.every(({ cell, lastLayer }) =>
    (dig[cell.id] ?? 0) >= (lastLayer + 1) / site.grid.levels);
}
