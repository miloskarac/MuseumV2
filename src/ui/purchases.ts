import type { HelperPlaySave } from '../game/helpers';
import type { TicketSave } from '../game/visitors';
import { PURCHASES, purchaseDefinition, purchaseText as t } from '../content/purchases';
import { purchaseStatus, remainingPurchaseCost } from '../game/purchases';
import { purchaseAt } from '../game/purchase-payments';
import type { Point } from '../game/navigation';
import type { MuseumSave } from '../game/purchases';
import type { TravelSave } from '../game/world-map';

export function createPurchaseUi(root: HTMLElement, select: (id: string) => void, buy: () => void) {
  const stage = root.querySelector<HTMLElement>('.stage')!, dialog = root.querySelector('dialog')!;
  const badge = document.createElement('span'); badge.className = 'purchase-qa'; badge.textContent = t.qa;
  root.querySelector('.masthead')!.append(badge);
  const markers = PURCHASES.map(offer => {
    const button = document.createElement('button'); button.className = 'purchase-marker';
    button.dataset.purchase = offer.id; button.hidden = true;
    button.innerHTML = `<span>${offer.kind === 'expansion' ? t.expansion : t.stand}</span><strong>● ${offer.cost}</strong>`;
    button.setAttribute('aria-label', `${offer.title} · ${offer.cost}`);
    button.onclick = () => select(offer.id); stage.append(button); return button;
  });
  const view = document.createElement('section'); view.id = 'purchase-view'; view.hidden = true;
  view.innerHTML = '<div class="purchase-preview" aria-hidden="true">＋</div><p id="purchase-reason" role="status"></p><button id="buy-purchase"></button>';
  dialog.querySelector('#activity-hint')!.after(view);
  const reason = view.querySelector<HTMLElement>('#purchase-reason')!;
  const button = view.querySelector<HTMLButtonElement>('#buy-purchase')!; button.onclick = buy;
  const payment = document.createElement('div'); payment.className = 'purchase-payment'; payment.hidden = true;
  payment.setAttribute('role', 'status'); stage.append(payment);
  let completeUntil = 0;
  return {
    completed() { completeUntil = performance.now() + 1800; },
    update(save: MuseumSave | TravelSave | TicketSave | HelperPlaySave, selected: string | null, active: boolean, blocked: boolean,
      position: Point, otherActivity: boolean) {
      for (const marker of markers) {
        const offer = purchaseDefinition(marker.dataset.purchase!)!, remaining = remainingPurchaseCost(save, offer.id);
        const number = marker.querySelector('strong')!, label = `● ${remaining}`;
        if (number.textContent !== label) number.textContent = label;
        marker.setAttribute('aria-label', `${offer.title} · ${t.remaining} ${remaining}`);
        marker.classList.toggle('part-paid', remaining < offer.cost);
      }
      const paying = 'payments' in save ? purchaseAt(save, position) : null;
      payment.hidden = save.room !== 'museum' || blocked || otherActivity || !paying && performance.now() >= completeUntil;
      if (!payment.hidden) {
        const status = paying ? purchaseStatus(save, paying) : null;
        payment.textContent = !paying ? t.bought : status === 'ready' || status === 'insufficient'
          ? `${save.economy.coins > 0 ? t.paying : t.needCoins} · ${t.remaining.toLowerCase()} ${remainingPurchaseCost(save, paying)}`
          : status && status !== 'unknown' ? t[status] : '';
      }
      view.hidden = !active;
      if (!active || !selected) return;
      const offer = purchaseDefinition(selected)!;
      const status = purchaseStatus(save, selected);
      dialog.querySelector('#activity-title')!.textContent = offer.title;
      dialog.querySelector('#activity-hint')!.textContent = offer.hint;
      dialog.querySelector('#activity-close')!.textContent = t.close;
      const remaining = remainingPurchaseCost(save, selected);
      button.textContent = `${t.buy} · ${remaining}`; button.disabled = blocked || status !== 'ready';
      reason.textContent = status === 'ready' ? '' : status === 'unknown' ? ''
        : status === 'insufficient' ? `${t.insufficient} (${remaining - save.economy.coins})` : t[status];
    },
    place(labels: { id: string; point: { x: number; y: number } }[], blocked: boolean) {
      const stageBox = stage.getBoundingClientRect();
      const portal = root.querySelector('.portal-label')!.getBoundingClientRect();
      markers.forEach(button => {
        const label = labels.find(label => label.id === button.dataset.purchase);
        button.hidden = !label; button.disabled = blocked;
        if (!label) return;
        const half = button.offsetWidth / 2 + 6;
        const x = Math.max(half, Math.min(stage.clientWidth - half, label.point.x));
        let y = Math.max(button.offsetHeight + 6, Math.min(stage.clientHeight - 65, label.point.y));
        // Keep the exit instruction legible when the scene shrinks on narrow windows.
        if (x + half > portal.left - stageBox.left && x - half < portal.right - stageBox.left
          && y > portal.top - stageBox.top && y - button.offsetHeight < portal.bottom - stageBox.top) {
          y = portal.top - stageBox.top - 8;
        }
        button.style.left = `${x}px`; button.style.top = `${y}px`;
      });
    },
    dispose() { markers.forEach(button => button.remove()); payment.remove(); view.remove(); badge.remove(); },
  };
}
