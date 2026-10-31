import { screenDirection } from '../game/navigation.ts';
import type { RoomId } from '../game/navigation.ts';

const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

export function createKeyboard() {
  const pressed = new Set<string>();
  const clear = () => pressed.clear();
  const keydown = (event: KeyboardEvent) => {
    if (!movementCodes.has(event.code) || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button, [contenteditable]')) return;
    event.preventDefault();
    // After blur/transition, a held key must be released before it moves again.
    if (!event.repeat) pressed.add(event.code);
  };
  const keyup = (event: KeyboardEvent) => pressed.delete(event.code);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  return {
    clear,
    direction: (room: RoomId = 'museum') => screenDirection(
      Number(pressed.has('KeyD') || pressed.has('ArrowRight')) - Number(pressed.has('KeyA') || pressed.has('ArrowLeft')),
      Number(pressed.has('KeyW') || pressed.has('ArrowUp')) - Number(pressed.has('KeyS') || pressed.has('ArrowDown')),
      room,
    ),
    dispose: () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      clear();
    },
  };
}
