import { GAME_SPEEDS } from '../game/simulation-speed';
import type { GameSpeed } from '../game/simulation-speed';

export function createDevelopmentSpeed(root: HTMLElement, onChange: (speed: GameSpeed) => void) {
  const control = document.createElement('div');
  control.className = 'development-speed';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Брзина игре за тестирање');
  control.innerHTML = `<span>Тест · брзина</span>${GAME_SPEEDS.map(speed =>
    `<button type="button" data-speed="${speed}" aria-pressed="${speed === 1}">×${speed}</button>`).join('')}`;
  root.querySelector('.masthead')!.append(control);
  const buttons = [...control.querySelectorAll<HTMLButtonElement>('button')];
  const select = (speed: GameSpeed) => {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === speed)));
    onChange(speed);
  };
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    select(GAME_SPEEDS[index]);
    root.querySelector<HTMLCanvasElement>('canvas')!.focus({ preventScroll: true });
  }));
  return { reset: () => select(1) };
}
