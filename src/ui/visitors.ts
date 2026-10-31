import { visitorText as t } from '../content/visitors';
import { atCashier, ticketPrice } from '../game/visitors';
import type { VisitorSave } from '../game/visitors';
import type { Point } from '../game/navigation';
export function createVisitorUi(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('.stage')!;
  const panel = document.createElement('section'); panel.className = 'cashier-panel'; panel.id = 'cashier-panel';
  panel.innerHTML = `<strong>${t.price} · <span id="ticket-price">0</span></strong><span id="ticket-increase" hidden>${t.increase}</span><p id="cashier-hint"></p><small id="visitor-count"></small>`;
  const marker = document.createElement('div'); marker.className = 'world-label cashier-label'; marker.textContent = t.cashier;
  const entrance = document.createElement('div'); entrance.className = 'world-label entrance-label'; entrance.textContent = t.entrance;
  stage.append(panel, marker, entrance); let last = '', previousPrice = 0, cueUntil = 0;
  return {
    reset(save: VisitorSave) { previousPrice = ticketPrice(save); cueUntil = 0; last = ''; },
    update(save: VisitorSave, position: Point, blocked: boolean, point: Point | null, entrancePoint: Point | null) {
      const price = ticketPrice(save), waiting = save.visitors.visits.filter(v => !v.paid).length, serving = atCashier(position);
      if (price > previousPrice) cueUntil = performance.now() + 2500;
      previousPrice = price;
      panel.hidden = save.room !== 'museum'; marker.hidden = panel.hidden || !point;
      entrance.hidden = panel.hidden || !entrancePoint;
      const key = `${price}:${waiting}:${serving}:${blocked}`;
      if (key !== last) {
        last = key; panel.querySelector('#ticket-price')!.textContent = `${price}`;
        panel.querySelector('#cashier-hint')!.textContent = !price ? t.first : serving && !blocked ? waiting ? t.serving : t.welcome : t.approach;
        panel.querySelector('#visitor-count')!.textContent = price ? `${t.waiting} · ${waiting}/3` : '';
      }
      (panel.querySelector('#ticket-increase') as HTMLElement).hidden = performance.now() >= cueUntil;
      for (const [label, anchor] of [[marker, point], [entrance, entrancePoint]] as const) if (anchor) {
        const half = label.offsetWidth / 2 + 8;
        label.style.left = `${Math.max(half, Math.min(stage.clientWidth - half, anchor.x))}px`;
        label.style.top = `${Math.max(45, Math.min(stage.clientHeight - 65, anchor.z))}px`;
      }
      if (!marker.hidden && !entrance.hidden) {
        const x = parseFloat(marker.style.left), y = parseFloat(marker.style.top);
        const ex = parseFloat(entrance.style.left), ey = parseFloat(entrance.style.top);
        const gap = (marker.offsetWidth + entrance.offsetWidth) / 2 + 8;
        if (Math.abs(x - ex) < gap && ey > y - marker.offsetHeight - 8 && y > ey - entrance.offsetHeight - 8) {
          // Keep both signs readable when the expanded hall is fitted to a narrow screen.
          if (x - gap >= entrance.offsetWidth / 2 + 8) entrance.style.left = `${x - gap}px`;
          else entrance.style.top = `${Math.max(45, y - marker.offsetHeight - 8)}px`;
        }
      }
    },
    dispose() { panel.remove(); marker.remove(); entrance.remove(); },
  };
}
