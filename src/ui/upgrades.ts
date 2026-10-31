import { UPGRADES, upgradeText as t } from '../content/upgrades';
import { upgradeStatus } from '../game/upgrades';
import type { UpgradePlaySave } from '../game/upgrades';

function picture(icon: string) {
  const shovel = '<path d="M30 14h20v13H30z" fill="none" stroke="#94663c" stroke-width="5"/><path d="M40 27v27" stroke="#b7844d" stroke-width="7"/><path d="M27 50h26v13L40 75 27 63z" fill="#91b8bb" stroke="#335f64" stroke-width="3"/>';
  const boots = '<path d="M14 18h18v31l12 7v14H10V54h4zM48 12h18v31l12 7v14H44V48h4z" fill="#dcac55" stroke="#85613b" stroke-width="3"/><path d="M10 67h34M44 61h34M16 28h14M50 22h14" stroke="#335f64" stroke-width="5"/>';
  return `<svg viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="42" fill="#edf5ee"/>${icon === 'boots' ? boots : shovel}${icon === 'tools' ? '<circle cx="65" cy="28" r="17" fill="#528aa9"/><circle cx="65" cy="25" r="7" fill="#f1c89d"/><path d="M54 40q11-15 22 0" fill="#e3f0f4"/>' : ''}</svg>`;
}
export function createUpgradeUi(root: HTMLElement, actions: { open(): void; buy(id: string): void }) {
  const button = document.createElement('button'); button.id = 'open-upgrades'; button.className = 'bag-button';
  button.textContent = t.title; button.onclick = actions.open; root.querySelector('.masthead')!.append(button);
  const view = document.createElement('section'); view.id = 'upgrades-view'; view.hidden = true;
  view.innerHTML = UPGRADES.map(o => `<article class="upgrade-card" data-upgrade-card="${o.id}">
    ${picture(o.icon)}<div><strong>${o.title}</strong><p>${o.benefit}</p><p class="upgrade-status" aria-live="polite"></p></div>
    <button data-upgrade="${o.id}">${t.buy} · ${o.cost}</button></article>`).join('');
  const dialog = root.querySelector('dialog')!; dialog.querySelector('#activity-hint')!.after(view);
  view.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(b => b.onclick = () => actions.buy(b.dataset.upgrade!));
  let last = '';
  return {
    update(save: UpgradePlaySave, active: boolean, blocked: boolean, otherActivity: boolean) {
      button.hidden = save.room !== 'museum'; button.disabled = blocked || otherActivity; view.hidden = !active;
      if (!active) { last = ''; return; }
      dialog.querySelector('#activity-title')!.textContent = t.title;
      dialog.querySelector('#activity-hint')!.textContent = t.hint;
      dialog.querySelector('#activity-close')!.textContent = t.close;
      const statuses = UPGRADES.map(o => upgradeStatus(save, o.id)), key = `${blocked}:${statuses.join(',')}`;
      if (last === key) return; last = key;
      UPGRADES.forEach((o, i) => {
        const card = view.querySelector<HTMLElement>(`[data-upgrade-card="${o.id}"]`)!, status = statuses[i];
        card.classList.toggle('upgrade-owned', status === 'owned');
        card.querySelector('.upgrade-status')!.textContent = t[status];
        const buy = card.querySelector('button')!; buy.disabled = blocked || status !== 'ready';
        buy.textContent = status === 'owned' ? `✓ ${t.owned}` : `${t.buy} · ${o.cost}`;
      });
    },
    dispose() { button.remove(); view.remove(); },
  };
}
