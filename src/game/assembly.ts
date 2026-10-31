import { ALL_PARTS, SPECIMEN_ID, exhibitDefinition } from '../content/exhibit.ts';
import type { ExhibitId } from '../content/exhibit.ts';
import type { JourneyState } from './journey.ts';

export const inventory = (state: JourneyState) => ALL_PARTS.filter(group =>
  state.collected.includes(group.discoveryId) && !state.placed.includes(group.id));
export const exhibitComplete = (state: JourneyState, id: ExhibitId = SPECIMEN_ID) => exhibitDefinition(id).parts.every(part => state.placed.includes(part));
export const tutorialDismissed = (state: JourneyState) => state.placed.length > 0;

// Both pointer drop and click-then-click submit this same command.
export function placeGroup(state: JourneyState, groupId: string, targetId: string): JourneyState {
  if (state.room !== 'museum' || groupId !== targetId || !inventory(state).some(group => group.id === groupId)) return state;
  return { ...state, placed: [...state.placed, groupId] };
}
