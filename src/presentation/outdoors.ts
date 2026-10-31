import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SITE_PLOTS } from '../content/journey';
import type { Shapes, XYZ } from './shapes';
import type { JourneyState } from '../game/journey';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { siteAvailability } from '../game/journey';
import { mapSite } from '../content/world-map';

export function buildOutdoors(shape: Shapes, material: (name: string, hex: string, sheen?: number) => StandardMaterial,
  palette: { cream: StandardMaterial; teal: StandardMaterial; tealDark: StandardMaterial; brass: StandardMaterial; wood: StandardMaterial }, campId?: string) {
  const { cream, teal, tealDark, brass, wood } = palette;
  const theme = campId ? mapSite(campId) : undefined;
  const grass = material('clearing-grass', theme?.grass ?? '#a5bd83', 0);
  const trail = material('clearing-path', theme?.trail ?? '#dfcfa7', 0);
  const earth = material('plot-earth', theme?.earth ?? '#b99068', 0);
  const leaf = material('outdoor-leaves', theme?.leaf ?? '#6e985a', 0);
  const closures: { id: string; ring: Mesh; rail: Mesh }[] = [];
  shape.box('floor-outdoors-base', [16.3, 0.35, 12.3], [0, -0.22, 0], tealDark);
  shape.box('floor-outdoors-grass', [16, 0.08, 12], [0, -0.035, 0], grass);
  shape.beveledBox('floor-clearing', [13.9, 0.04, 10.1], [0, 0.013, -0.15], trail);
  for (const plot of SITE_PLOTS.filter(plot => !campId || plot.id === campId)) {
    shape.beveledBox(`plot-${plot.id}`, [2.8, 0.14, 2.4], [plot.x, 0.1, plot.z], wood);
    shape.box('plot-soil', [2.6, 0.05, 2.2], [plot.x, 0.19, plot.z], earth);
    for (const dx of [-1.15, 1.15]) for (const dz of [-0.95, 0.95]) {
      shape.box('survey-post', [0.09, plot.playable ? 1.35 : 0.52, 0.09], [plot.x + dx, plot.playable ? 0.75 : 0.35, plot.z + dz], wood);
    }
    if (plot.playable) {
      for (let stripe = 0; stripe < 6; stripe++) {
        const awning = shape.box('field-awning', [0.46, 0.1, 2.55], [plot.x - 1.15 + stripe * 0.46, 1.6, plot.z], stripe % 2 ? cream : teal);
        awning.rotation.x = -0.12;
      }
      shape.box('site-entry-dark', [1.65, 0.15, 1.2], [plot.x, 0.22, plot.z - 0.45], tealDark);
    } else {
      shape.box('locked-rail', [2.35, 0.13, 0.07], [plot.x, 0.65, plot.z - 0.96], tealDark);
      const lock = shape.beveledBox('site-lock', [0.34, 0.31, 0.1], [plot.x, 0.63, plot.z - 1.02], brass);
      lock.rotation.z = 0.06;
      shape.tube('lock-loop', [[plot.x - 0.1, 0.73, plot.z - 1.02], [plot.x - 0.1, 0.89, plot.z - 1.02], [plot.x + 0.1, 0.89, plot.z - 1.02], [plot.x + 0.1, 0.73, plot.z - 1.02]], 0.03, brass);
    }
    const ring: XYZ[] = [];
    for (let i = 0; i <= 40; i++) ring.push([plot.entrance.x + Math.cos(i / 40 * Math.PI * 2) * 0.62, 0.07, plot.entrance.z + Math.sin(i / 40 * Math.PI * 2) * 0.62]);
    const marker = shape.tube(`site-ring-${plot.id}`, ring, 0.04, plot.playable ? teal : brass);
    if (plot.playable) {
      const rail = shape.box(`completed-rail-${plot.id}`, [2.35, 0.13, 0.07], [plot.x, 0.65, plot.z - 0.96], tealDark);
      rail.setEnabled(false);
      closures.push({ id: plot.id, ring: marker, rail });
    }
  }
  // Trees stay beyond the existing walking bounds.
  for (const [x, z] of [[-7.95, 4.7], [-7.95, -3.9], [-3.7, 5.98], [1.3, 5.98]]) {
    shape.cylinder('tree-trunk', 1.2, 0.16, 0.13, [x, 0.65, z], wood);
    shape.beveledBox('tree-crown', [0.8, 0.9, 0.85], [x, 1.55, z], leaf).rotation.y = 0.4;
    shape.beveledBox('tree-crown-top', [0.62, 0.5, 0.65], [x, 2.14, z], leaf).rotation.y = -0.2;
  }
  if (theme?.id === 'eryops-dig') {
    for (const [x, z, size] of [[8.7, -3.2, 1.3], [8.7, 1.8, 1.1], [-5.2, 6.8, 1.5], [3.7, 6.8, 1]]) {
      shape.beveledBox('ochre-camp-rock', [size, size * 0.65, size], [x, size * 0.28, z], earth).rotation.y = 0.4;
    }
  }
  return (state: JourneyState) => {
    for (const { id, ring, rail } of closures) {
      const plot = SITE_PLOTS.find(plot => plot.id === id)!;
      const open = siteAvailability(state, plot.number) === 'open';
      ring.setEnabled(open); rail.setEnabled(!open);
    }
  };
}
