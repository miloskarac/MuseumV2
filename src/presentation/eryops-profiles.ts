import type { FossilFacet, Point } from './fossil-profiles';
import { ERYOPS_GROUPS } from '../content/exhibit.ts';

// Tray silhouettes follow the broad skull, short spinal processes and splayed
// limbs of the reference mount. They are stylized, not anatomical measurements.
function profile(id: string): FossilFacet[] {
  const facets: FossilFacet[] = [];
  const polygon = (points: Point[], tone: FossilFacet['tone'] = 'bone') => facets.push({ points, tone });
  const oval = (x: number, y: number, rx: number, ry: number, tone: FossilFacet['tone'] = 'bone') =>
    polygon(Array.from({ length: 8 }, (_, i) => [x + Math.cos(i * Math.PI / 4) * rx, y + Math.sin(i * Math.PI / 4) * ry]), tone);
  const shaft = (a: Point, b: Point, radius: number) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / length * radius, ny = (b[0] - a[0]) / length * radius;
    polygon([[a[0] + nx, a[1] + ny], [b[0] + nx * 0.7, b[1] + ny * 0.7], [b[0] - nx * 0.7, b[1] - ny * 0.7], [a[0] - nx, a[1] - ny]]);
  };
  if (id === 'eryops-skull') {
    polygon([[3.5, 5.4], [6.5, 2.5], [16.5, 2.2], [20, 4.2], [20, 9.8], [16.5, 11.8], [6.5, 11.5], [3.5, 8.6]]);
    polygon([[5, 5.8], [7.5, 3.6], [15.2, 3.4], [14.8, 5.3], [7.5, 6.2]], 'shade');
    polygon([[5, 8.2], [7.5, 7.8], [14.8, 8.7], [15.2, 10.6], [7.5, 10.4]], 'shade');
    for (const y of [4.6, 9.4]) oval(16.3, y, 1.3, 1, 'recess');
    for (const y of [5.5, 8.5]) oval(5.5, y, 0.4, 0.35, 'recess');
  } else if (id === 'eryops-spine' || id === 'eryops-tail') {
    const tail = id === 'eryops-tail', n = tail ? 24 : 17;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = 3 + 18 * t, y = 8 - Math.sin(t * Math.PI) * 0.6;
      const size = tail ? 1.3 * (1 - t) + 0.12 : 0.85;
      shaft([x, y - 0.1], [x - 0.15, y - size * 2.7], size * 0.22);
      oval(x, y, tail ? 0.35 : 0.47, size * 0.7);
      shaft([x, y], [x + 0.25, y + size], size * 0.23);
    }
  } else if (id === 'eryops-ribs') {
    for (let i = 0; i < 12; i++) {
      const x = 3.2 + i * 1.45, length = 5.4 + Math.sin(i / 11 * Math.PI) * 1.7;
      const points: Point[] = [[x, 3], [x + 0.9, 4.9], [x + 1.15, 6.6], [x + 0.7, 3 + length]];
      for (let j = 0; j < 3; j++) shaft(points[j], points[j + 1], 0.2 - j * 0.04);
    }
  } else {
    const hind = id === 'eryops-hind-legs';
    for (const offset of [-4.5, 4.5]) {
      const x = 12 + offset, knee = x + (hind ? 1.6 : -1.6), foot = x - 0.4;
      polygon([[x - 1, 2], [x + 0.8, 2], [x + 1.1, 4.2], [x, 5], [x - 0.8, 4.2]]);
      shaft([x, 4.5], [knee, 7.1], 0.5); oval(knee, 7.1, 0.48, 0.35);
      for (const side of [-1, 1]) shaft([knee + side * 0.22, 7.2], [foot + side * 0.25, 9.5], 0.17);
      oval(foot, 9.6, 0.65, 0.3);
      const digits = hind ? 5 : 4;
      for (let i = 0; i < digits; i++) {
        const spread = i - (digits - 1) / 2;
        shaft([foot + spread * 0.16, 9.8], [foot + spread * 0.5, 10.7], 0.1);
        shaft([foot + spread * 0.5, 10.7], [foot + spread * 0.7, 11.3], 0.075);
      }
    }
  }
  return facets;
}
export const ERYOPS_PROFILES = Object.fromEntries(ERYOPS_GROUPS.map(part => [part.id, profile(part.id)])) as Record<typeof ERYOPS_GROUPS[number]['id'], FossilFacet[]>;
