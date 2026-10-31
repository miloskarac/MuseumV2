import { text } from '../content/prototype';
import type { RoomId } from '../game/navigation';
import { EXHIBIT_SPOTS } from '../game/navigation';

type LabelPoint = { x: number; y: number };

export function createHud(root: HTMLElement) {
  root.innerHTML = `
    <header class="masthead">
      <div><p class="eyebrow">${text.title}</p><h1>${text.subtitle}</h1></div>
      <p class="room-badge" aria-live="polite" id="room-name"></p>
    </header>
    <main class="stage">
      <canvas tabindex="0" aria-label="${text.canvas}" aria-describedby="controls"></canvas>
      <div class="world-label portal-label" aria-hidden="true"></div>
      ${EXHIBIT_SPOTS.map(spot => `<button id="${spot.buttonId}" data-exhibit="${spot.id}" class="exhibit-marker" hidden></button>`).join('')}
      <p class="error-message" role="alert" hidden></p>
    </main>
    <footer>
      <p class="room-hint" id="room-hint" aria-live="polite"></p>
      <p class="controls" id="controls"><span aria-hidden="true">↑ ↓ ← →</span> ${text.controls}</p>
    </footer>`;
  const canvas = root.querySelector('canvas')!;
  const portal = root.querySelector<HTMLElement>('.portal-label')!;
  const exhibits = [...root.querySelectorAll<HTMLButtonElement>('[data-exhibit]')];
  const place = (element: HTMLElement, point: LabelPoint) => {
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
  };
  return {
    canvas,
    setRoom: (room: RoomId) => {
      root.querySelector('#room-name')!.textContent = text[room];
      root.querySelector('#room-hint')!.textContent = room === 'museum' ? text.museumHint : room === 'outdoors' ? text.outdoorsHint : text.excavationHint;
      portal.textContent = room === 'museum' ? text.toSite : room === 'outdoors' ? text.toMuseum : text.toOutdoors;
      canvas.setAttribute('aria-label', `${text[room]}. ${text.controls}`);
      exhibits.forEach(exhibit => { exhibit.hidden = room !== 'museum'; });
    },
    placeLabels: (labels: { portal: LabelPoint; exhibits: (LabelPoint & { id: string; width: number; height: number })[] }) => {
      const inset = portal.offsetWidth / 2 + 8;
      place(portal, { ...labels.portal, x: Math.max(inset, Math.min(canvas.clientWidth - inset, labels.portal.x)) });
      exhibits.forEach(button => { button.hidden = !labels.exhibits.some(label => label.id === button.dataset.exhibit); });
      for (const label of labels.exhibits) {
        const exhibit = exhibits.find(button => button.dataset.exhibit === label.id)!;
        place(exhibit, label);
        exhibit.style.width = `${label.width}px`;
        exhibit.style.height = `${label.height}px`;
      }
    },
    showError: (message: string) => {
      const error = root.querySelector<HTMLElement>('.error-message')!;
      error.textContent = message;
      error.hidden = false;
      portal.hidden = true;
      exhibits.forEach(exhibit => { exhibit.hidden = true; });
    },
  };
}
