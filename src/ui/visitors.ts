import { visitorText as t } from '../content/visitors';
import { atCashier, ticketPrice, visitorCapacity } from '../game/visitors';
import { visitorCounts } from '../game/visitor-capacity';
import type { VisitorSave } from '../game/visitors';
import type { Point } from '../game/navigation';
export function createVisitorUi(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('.stage')!;
  const panel = document.createElement('section'); panel.className = 'cashier-panel'; panel.id = 'cashier-panel';
  panel.innerHTML = `<strong>${t.price} · <span id="ticket-price">0</span></strong><span id="ticket-increase" hidden>${t.increase}</span><p id="cashier-hint"></p><small id="visitor-count"></small>`;
  const marker = document.createElement('div'); marker.className = 'world-label cashier-label'; marker.textContent = t.cashier;
  const entrance = document.createElement('div'); entrance.className = 'world-label entrance-label'; entrance.textContent = t.entrance;
  const cash = document.createElement('div'); cash.id = 'cash-pickup-hint'; cash.className = 'world-label cash-label';
  stage.append(panel, marker, entrance, cash); let last = '', previousPrice = 0, cueUntil = 0;
  return {
    reset(save: VisitorSave) { previousPrice = ticketPrice(save); cueUntil = 0; last = ''; },
    update(save: VisitorSave, position: Point, blocked: boolean, point: Point | null, entrancePoint: Point | null, cashPoint: Point | null) {
      const price = ticketPrice(save), { waiting, admitted } = visitorCounts(save.visitors.visits), serving = atCashier(position);
      const capacity = visitorCapacity(save), full = admitted >= capacity.admitted;
      if (price > previousPrice) {
        cueUntil = performance.now() + 2500;
        panel.querySelector('#ticket-increase')!.textContent = `${t.increase} +${price - previousPrice}`;
      }
      previousPrice = price;
      panel.hidden = save.room !== 'museum'; marker.hidden = panel.hidden || !point;
      entrance.hidden = panel.hidden || !entrancePoint;
      const pending = 'pendingTicketRevenue' in save ? save.pendingTicketRevenue : 0;
      cash.hidden = panel.hidden || blocked || !cashPoint || pending <= 0;
      cash.textContent = t.collect;
      cash.setAttribute('aria-label', `${t.pending}: ${pending}. ${t.collect}.`);
      const key = `${price}:${waiting}:${admitted}:${capacity.waiting}:${capacity.admitted}:${serving}:${blocked}`;
      if (key !== last) {
        last = key; panel.querySelector('#ticket-price')!.textContent = `${price}`;
        panel.querySelector('#cashier-hint')!.textContent = !price ? t.first : full && waiting ? t.full : serving && !blocked ? waiting ? t.serving : t.welcome : t.approach;
        panel.querySelector('#visitor-count')!.textContent = price ? `${t.waiting} · ${waiting}/${capacity.waiting} · ${t.admitted} · ${admitted}/${capacity.admitted}` : '';
      }
      (panel.querySelector('#ticket-increase') as HTMLElement).hidden = performance.now() >= cueUntil;
      for (const [label, anchor] of [[marker, point], [entrance, entrancePoint], [cash, cashPoint]] as const) if (anchor) {
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
    dispose() { panel.remove(); marker.remove(); entrance.remove(); cash.remove(); },
  };
}
