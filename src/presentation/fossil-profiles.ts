import type { ROOM1_PARTS } from '../content/exhibit.ts';
import { ERYOPS_PROFILES } from './eryops-profiles.ts';

export type FossilGroup = typeof ROOM1_PARTS[number]['id'];
export type Point = [number, number];
export type FossilFacet = { points: Point[]; tone: 'bone' | 'shade' | 'recess' };

// Authored convex facets in a 24 × 14 work-tray coordinate system. The same
// silhouettes drive canvas cleaning and shallow, solid Babylon excavation meshes.
// Shape references: docs/references/dig-sites/{skull,Spine,tail,front-legs,
// rere lags,ribs}.png. Deliberately simplified; not a scientific reconstruction.
function profile(id: FossilGroup): FossilFacet[] {
  const facets: FossilFacet[] = [];
  const polygon = (points: Point[], tone: FossilFacet['tone'] = 'bone') => facets.push({ points, tone });
  const oval = (x: number, y: number, rx: number, ry: number, tone: FossilFacet['tone'] = 'bone') => {
    polygon(Array.from({ length: 8 }, (_, i) => [x + Math.cos(i * Math.PI / 4) * rx, y + Math.sin(i * Math.PI / 4) * ry]), tone);
  };
  const shaft = (a: Point, b: Point, start: number, end = start * 0.65, tone: FossilFacet['tone'] = 'bone') => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / length, ny = (b[0] - a[0]) / length;
    polygon([[a[0] + nx * start, a[1] + ny * start], [b[0] + nx * end, b[1] + ny * end],
      [b[0] - nx * end, b[1] - ny * end], [a[0] - nx * start, a[1] - ny * start]], tone);
  };
  if (id === 'walchia-whole') {
    // Original stylized plant impression, shared by excavation, cleaning and
    // the small museum slab. Replace this profile when final artwork is approved.
    shaft([3, 10], [21, 4], 0.24, 0.10, 'recess');
    for (let i = 0; i < 5; i++) {
      const x = 6 + i * 2.8, y = 9 - i * 0.93;
      for (const side of [-1, 1]) {
        const end: Point = [x + 2.1, y + side * (3.1 - i * 0.2)];
        shaft([x, y], end, 0.15, 0.04, 'recess');
        for (let n = 1; n <= 4; n++) {
          const t = n / 5, px = x + (end[0] - x) * t, py = y + (end[1] - y) * t;
          shaft([px, py], [px + 0.9, py + side * 0.28], 0.13, 0.01, 'shade');
          shaft([px, py], [px - 0.5, py + side * 0.7], 0.13, 0.01, 'shade');
        }
      }
    }
    return facets;
  }
  if (id === 'trilobite-whole') {
    // Stylized dorsal shell: cephalon, articulated thorax and fused tail shield.
    // Three longitudinal lobes, rather than three head/body/tail sections.
    polygon([[8, 1.2], [16, 1.2], [17.3, 2.4], [17.3, 11.7], [15.7, 12.8], [8.2, 12.8], [6.7, 11.4], [6.7, 2.7]], 'shade');
    oval(12, 9.8, 2.7, 1.75, 'bone');
    for (let i = 7; i >= 0; i--) {
      const y = 4.1 + i * 0.7, width = 3.2 - i * 0.1;
      polygon([[12 - width, y], [12, y - 0.28], [12, y + 0.35], [12 - width + 0.25, y + 0.53]]);
      polygon([[12, y - 0.28], [12 + width, y], [12 + width - 0.25, y + 0.53], [12, y + 0.35]]);
      oval(12, y + 0.05, 0.8 - i * 0.02, 0.35, 'shade');
    }
    oval(12, 3.2, 3.3, 1.8);
    oval(12, 3.2, 1.1, 1.35, 'shade');
    oval(10.25, 3.1, 0.35, 0.42, 'recess');
    oval(13.75, 3.1, 0.35, 0.42, 'recess');
  } else if (id === 'skull') {
    // Tall posterior skull, sloping long snout, separate low jaw and tooth gap.
    polygon([[5, 8.7], [4.9, 7.6], [5.5, 6.5], [9.4, 5.3], [10.6, 8.65]]);
    polygon([[9.4, 5.3], [12.2, 4], [13, 8.6], [10.6, 8.65]]);
    polygon([[10.2, 5.2], [12.1, 3.3], [14.6, 3.2], [16.5, 3.8], [17.7, 5.2], [18.8, 7.8], [18.5, 8.7], [12.2, 8.6]]);
    polygon([[5.2, 9.5], [10, 10], [10.2, 11], [5.4, 10.4]]);
    polygon([[10, 10], [14.8, 9.5], [15.4, 10.6], [10.2, 11]]);
    polygon([[14.8, 9.5], [18.5, 8.8], [18.4, 9.6], [15.4, 10.6]]);
    polygon([[6.1, 7.1], [9.4, 5.7], [11.5, 5.1], [10.5, 7.1]], 'shade');
    oval(13.7, 5.8, 1.18, 1.25, 'recess');
    oval(17, 7, 0.7, 1, 'recess');
    oval(6.7, 7.7, 0.47, 0.35, 'recess');
    for (let i = 0; i < 15; i++) {
      const x = 5.5 + i * 0.76;
      const length = i === 3 || i === 4 ? 1 : 0.42;
      polygon([[x, 8.6], [x + 0.43, 8.6], [x + 0.2, 8.6 + length]]);
    }
  } else if (id === 'spine-sail') {
    for (let i = 0; i < 18; i++) {
      const x = 4 + i * 0.94, y = 11.1 - Math.sin(i / 17 * Math.PI) * 0.65;
      const height = 0.8 + Math.pow(Math.sin(i / 17 * Math.PI), 0.85) * 7.6;
      shaft([x, y - 0.15], [x - 0.32, y - height * 0.42], 0.15, 0.12);
      shaft([x - 0.32, y - height * 0.42], [x + 0.28, y - height], 0.12, 0.035);
      oval(x, y, 0.44, 0.36);
      polygon([[x - 0.2, y], [x, y - 0.28], [x + 0.22, y], [x, y + 0.12]], 'shade');
    }
  } else if (id === 'tail') {
    for (let i = 0; i < 28; i++) {
      const t = i / 27, x = 2.7 + t * 18.6, y = 4.1 + 5.4 * t + Math.sin(t * Math.PI) * 0.7;
      const size = 0.7 * (1 - t) + 0.1;
      if (i < 23) {
        shaft([x, y], [x - size * 0.3, y - size * 1.2], size * 0.25, size * 0.12);
        polygon([[x - size * 0.5, y + size * 0.25], [x + size * 0.9, y + size * 0.4], [x + size * 0.65, y + size * 1.35]]);
      }
      oval(x, y, 0.35 - t * 0.12, size * 0.55);
      if (i < 19) shaft([x - 0.11, y - size * 0.25], [x + 0.12, y + size * 0.25], 0.055, 0.04, 'shade');
    }
  } else if (id === 'ribs') {
    for (let i = 0; i < 11; i++) {
      const x = 3.5 + i * 1.45, length = 5.4 + Math.sin(i / 10 * Math.PI) * 1.4;
      for (const offset of [0.25, 0]) {
        const points: Point[] = [[x, 3.3 + offset], [x + 0.65, 4.7 + offset], [x + 1, 6.5 + offset], [x + 0.8, 3.3 + length - 0.6], [x + 0.15, 3.3 + length]];
        for (let j = 0; j < points.length - 1; j++) shaft(points[j], points[j + 1], 0.15 - j * 0.025, 0.12 - j * 0.025, offset ? 'shade' : 'bone');
      }
    }
  } else {
    const hind = id === 'hind-legs';
    // Two articulated limbs: a shoulder blade vs. a broad pelvis, opposing bends,
    // paired lower bones and a spread of five small segmented digits.
    for (const offset of [-2.2, 1.8]) {
      const p = (x: number, y: number): Point => [x + offset, y];
      if (hind) {
        polygon([p(9, 3), p(11.1, 2.6), p(12.5, 3.2), p(12.2, 5.2), p(10.5, 6), p(9.2, 5.1)]);
        oval(11 + offset, 4.9, 0.42, 0.52, 'recess');
      } else {
        polygon([p(11, 2), p(12, 2), p(12.6, 3.5), p(12.5, 5.2), p(11.2, 6), p(10.6, 4.6)]);
        polygon([p(11.1, 2.5), p(11.45, 2.4), p(11.35, 5.2), p(10.9, 4.5)], 'shade');
      }
      const hip = p(11.3, 5.5), knee = p(hind ? 13.7 : 9.6, 7.9), ankle = p(hind ? 12.3 : 11.3, 10.1);
      shaft(hip, knee, hind ? 0.43 : 0.33, hind ? 0.32 : 0.25);
      shaft([hip[0] - 0.12, hip[1]], [knee[0] - 0.1, knee[1]], 0.09, 0.07, 'shade');
      oval(knee[0], knee[1], 0.32, 0.23);
      shaft([knee[0] - 0.19, knee[1] + 0.22], [ankle[0] - 0.23, ankle[1]], 0.17, 0.12);
      shaft([knee[0] + 0.28, knee[1] + 0.12], [ankle[0] + 0.25, ankle[1]], 0.12, 0.09);
      oval(ankle[0], ankle[1], 0.46, 0.22);
      for (let toe = 0; toe < 5; toe++) {
        const spread = toe - 2, start: Point = [ankle[0] + spread * 0.17, ankle[1] + 0.19];
        const middle: Point = [ankle[0] + spread * 0.42, ankle[1] + 0.63];
        const end: Point = [ankle[0] + spread * 0.6, ankle[1] + 0.88 + (2 - Math.abs(spread)) * 0.16];
        shaft(start, middle, 0.1, 0.07); shaft(middle, end, 0.07, 0.025);
      }
    }
  }
  return facets;
}

export const FOSSIL_PROFILES: Record<FossilGroup, FossilFacet[]> = {
  ...ERYOPS_PROFILES,
  skull: profile('skull'), 'spine-sail': profile('spine-sail'), ribs: profile('ribs'),
  'front-legs': profile('front-legs'), 'hind-legs': profile('hind-legs'), tail: profile('tail'),
  'trilobite-whole': profile('trilobite-whole'),
  'walchia-whole': profile('walchia-whole'),
};

export function drawFossilProfile(context: CanvasRenderingContext2D, id: FossilGroup) {
  context.save();
  context.lineJoin = 'round'; context.lineWidth = 0.035;
  for (const facet of FOSSIL_PROFILES[id]) {
    context.fillStyle = { bone: '#f6edd3', shade: '#d4c29b', recess: '#53665a' }[facet.tone];
    context.strokeStyle = facet.tone === 'recess' ? '#bcae89' : '#c5b68d';
    context.beginPath();
    facet.points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath(); context.fill(); context.stroke();
  }
  context.restore();
}
