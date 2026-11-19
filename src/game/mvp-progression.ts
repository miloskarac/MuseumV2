import { EXHIBITS, partsFor, exhibitsFor, ROOM1_EXHIBITS } from '../content/exhibit.ts';
import { standOffer } from '../content/purchases.ts';
import { PERMIAN_STAND_PLANS } from '../content/permian-progression.ts';
import { permianExhibitDefinition } from '../content/permian-museum.ts';
import { validRoomOwnership, ROOM_DEFINITIONS_V1 } from '../persistence/contracts/rooms-v1.ts';
import { eligiblePermianStand, permianSiteStatus } from './permian-progression.ts';
import { isPermianExhibitDisplayed, isPermianRoomComplete } from './permian-rooms.ts';
import type { PermianProgressDefinitions } from './permian-rooms.ts';
import type { PermianProgressionState } from './permian-progression.ts';
import type { MvpSave } from './mvp-economy.ts';
import type { Room1GameSave } from './room1-economy.ts';
type CurrentSave = MvpSave | Room1GameSave;

export const MVP_DEFINITIONS: PermianProgressDefinitions = {
  exhibits: EXHIBITS.map(e => ({ id: e.id, requiredPartIds: e.parts })),
  stands: PERMIAN_STAND_PLANS.filter(s => EXHIBITS.some(e => e.id === s.exhibitId)),
};
export const ROOM1_DEFINITIONS: PermianProgressDefinitions = {
  exhibits: ROOM1_EXHIBITS.map(e => ({ id: e.id, requiredPartIds: e.parts })),
  stands: PERMIAN_STAND_PLANS.filter(s => ROOM1_EXHIBITS.some(e => e.id === s.exhibitId)),
};
const definitionsFor = (save: CurrentSave) => save.version === 26 ? ROOM1_DEFINITIONS : MVP_DEFINITIONS;
export function mvpProgress(save: CurrentSave): PermianProgressionState {
  const owned = save.museum.owned.filter(o => save.museum.owned.filter(other => other.id === o.id).length === 1);
  const uniqueParts = new Set(save.placed).size === save.placed.length;
  const parts = uniqueParts ? save.placed.filter(id => {
    const part = partsFor(save).find(p => p.id === id);
    return part && save.collected.includes(part.discoveryId);
  }) : [];
  return { ownedRoomIds: validRoomOwnership(save.rooms) ? ROOM_DEFINITIONS_V1.filter(r => r.initiallyAvailable).map(r => r.id) : [],
    ownedStandIds: owned.map(o => o.id),
    purchasedSiteIds: save.world.owned.filter(o => o.id === 'eryops-dig').map(() => 'eryops-dig'),
    exhibits: exhibitsFor(save).map(e => ({ id: e.id, assembledPartIds: parts,
      displayedOnStandId: !['eryops', 'walchia'].includes(e.id) || save.world.owned.some(o => o.id === 'eryops-dig') ? `stand-${e.id}` : null })) };
}
export function mvpDisplays(save: CurrentSave) {
  const state = mvpProgress(save);
  if (!state.ownedRoomIds.includes('permian-room-1')) return [];
  return exhibitsFor(save).filter(e => isPermianExhibitDisplayed(e.id, { ...state, unlockedRoomIds: state.ownedRoomIds }, definitionsFor(save))).map(e => e.id);
}
export const nextMvpStand = (save: CurrentSave) => eligiblePermianStand(mvpProgress(save), definitionsFor(save))?.id;
export const mvpSiteEligible = (save: CurrentSave, id: string) => id === 'eryops-dig'
  && permianSiteStatus(id, mvpProgress(save), definitionsFor(save)) === 'eligible-for-purchase';
export const mvpTicketPrice = (save: CurrentSave) => mvpDisplays(save).reduce((sum, id) =>
  sum + (permianExhibitDefinition(id)?.size === 'large' ? 4 : 2), 0);
// Warn about a possible development-save dead end, without changing ownership,
// money or purchase order. Unexcavated coins may still make recovery possible;
// the player can keep the save and investigate instead of resetting it.
export function mvpNeedsRecoveryNotice(save: CurrentSave): boolean {
  const first = standOffer('dimetrodon');
  return !save.museum.owned.some(o => o.id === first.id) && mvpTicketPrice(save) === 0
    && save.economy.coins + save.pendingTicketRevenue + (save.payments.partial[first.id] ?? 0) < first.cost;
}
export function room1Complete(save: CurrentSave): boolean {
  const state = mvpProgress(save);
  if (!state.ownedRoomIds.includes('permian-room-1')) return false;
  return isPermianRoomComplete('permian-room-1', { ...state, unlockedRoomIds: state.ownedRoomIds }, definitionsFor(save));
}
export const room1CompletionTransition = (before: CurrentSave, after: CurrentSave) => !room1Complete(before) && room1Complete(after);
export function mvpProgressHint(save: CurrentSave): string {
  const displayed = mvpDisplays(save), next = exhibitsFor(save).find(e => !displayed.includes(e.id));
  if (room1Complete(save)) return 'Прва сала је завршена! Друга сала стиже касније.';
  if (!next) return 'Три фосила су изложена! Валхија стиже касније.';
  if (nextMvpStand(save)) return 'Стани у златни круг да купиш следеће постоље.';
  if (next.id === 'walchia') return 'Пронађи и очисти гранчицу у другом налазишту, па је постави на постоље за валхију.';
  return next.id === 'dimetrodon' ? 'Сложи диметродона. Он откључава постоље за трилобита.'
    : next.id === 'trilobite' ? 'Постави трилобита. Он откључава постоље за ериопса.'
      : save.world.owned.some(o => o.id === 'eryops-dig') ? 'Пронађи делове ериопса и сложи га на постољу.'
        : 'Постоље за ериопса је спремно! Отвори његово налазиште на карти.';
}
