import { activeSite, sitePlot } from './journey.ts';
import type { Point, RoomId } from '../game/navigation.ts';
// A box on the rear apron is accessible through the ladder; camps retain access
// after pit closure. Both are views of the same site's finite inventory.
export function storageAnchor(state: { activeSiteId: string; room: RoomId }): Point {
  const site = activeSite(state);
  return state.room === 'excavation' ? { x: site.interaction.x + 1.5, z: site.interaction.z + 0.2 }
    : { x: sitePlot(site).x + 2.3, z: sitePlot(site).z + 0.2 };
}
export const storageApproach = (state: { activeSiteId: string; room: RoomId }): Point => {
  const box = storageAnchor(state); return state.room === 'excavation' ? { x: box.x - 0.7, z: box.z } : { x: box.x, z: box.z - 1 };
};
export const storageText = {
  title: 'Кутија са фосилима', hint: 'Изабери фосил. Очисти га и стави у торбу.',
  open: 'Отвори кутију', empty: 'Кутија је празна. Помоћник ће овде донети фосиле.',
  clean: 'Очисти', resume: 'Настави чишћење', ready: 'Спремно за торбу', close: 'Затвори',
  carrying: 'Помоћник носи фосил', waiting: 'Фосили чекају у кутији.',
  arrive: 'Фосил је стигао у кутију!', approach: 'Приђи кутији са фосилима.',
};
