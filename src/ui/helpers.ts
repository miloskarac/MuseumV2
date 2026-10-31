import { HELPERS, helperText as t } from '../content/helpers';
import { MAP_SITES } from '../content/world-map';
import { helperActive, helperPurchaseStatus } from '../game/helpers';
import type { HelperPlaySave } from '../game/helpers';
import { siteOwned, travelBusy } from '../game/world-map';
import { carriedFinds, storedFinds } from '../game/storage';
import { storageText } from '../content/storage';
export function createHelperUi(root: HTMLElement, actions: { open(): void; buy(): void; assign(id: string | null): void }, preview = false) {
  const button = document.createElement('button'); button.id = 'open-helper'; button.className = 'bag-button';
  button.textContent = t.title; button.onclick = actions.open; root.querySelector('.masthead')!.append(button);
  const view = document.createElement('section'); view.id = 'helper-view'; view.hidden = true;
  view.innerHTML = `<p id="helper-purchase-status"></p><button id="hire-helper">${t.hire} · ${HELPERS.cost}</button>
    <div id="helper-assignments"><p>${t.reassign}</p>${MAP_SITES.filter(s => s.playable).map(site =>
      `<article><strong>${site.title}</strong><button data-helper-site="${site.id}">${t.assign}</button></article>`).join('')}
    <button id="unassign-helper">${t.unassign}</button></div>`;
  const dialog = root.querySelector('dialog')!; dialog.querySelector('#activity-hint')!.after(view);
  view.querySelector<HTMLButtonElement>('#hire-helper')!.onclick = actions.buy;
  view.querySelector<HTMLButtonElement>('#unassign-helper')!.onclick = () => actions.assign(null);
  view.querySelectorAll<HTMLButtonElement>('[data-helper-site]').forEach(b => b.onclick = () => actions.assign(b.dataset.helperSite!));
  const panel = document.createElement('section'); panel.id = 'helper-progress'; panel.className = 'helper-progress'; panel.hidden = true;
  panel.innerHTML = `<strong></strong><progress max="1" aria-label="${t.progress}"></progress><span></span>`;
  const badge = document.createElement('div'); badge.className = 'helper-preview'; badge.textContent = t.preview;
  root.querySelector('.stage')!.append(panel); if (preview) root.querySelector('.stage')!.append(badge);
  let recovered = false;
  return {
    recovered(value: boolean) { recovered = value; },
    update(save: HelperPlaySave, active: boolean, blocked: boolean, otherActivity: boolean, moving: boolean) {
      const helper = save.helpers.owned[0], status = helperPurchaseStatus(save), busy = travelBusy(save);
      button.disabled = blocked || otherActivity || busy; view.hidden = !active;
      if (active) {
        dialog.querySelector('#activity-title')!.textContent = t.title;
        dialog.querySelector('#activity-hint')!.textContent = recovered ? t.recovered : t.hint;
        dialog.querySelector('#activity-close')!.textContent = t.close;
        view.querySelector('#helper-purchase-status')!.textContent = t[status];
        const buy = view.querySelector<HTMLButtonElement>('#hire-helper')!; buy.hidden = !!helper; buy.disabled = blocked || status !== 'ready';
        (view.querySelector('#helper-assignments') as HTMLElement).hidden = !helper;
        for (const b of view.querySelectorAll<HTMLButtonElement>('[data-helper-site]')) {
          b.disabled = blocked || busy || !siteOwned(save, b.dataset.helperSite!) || helper?.siteId === b.dataset.helperSite;
          b.textContent = helper?.siteId === b.dataset.helperSite ? t.assigned : t.assign;
        }
        view.querySelector<HTMLButtonElement>('#unassign-helper')!.disabled = blocked || busy || !helper?.siteId;
      }
      panel.hidden = !helper || save.room !== 'excavation';
      if (!helper) return;
      const working = !blocked && !otherActivity && helperActive(save), task = helper.task;
      panel.querySelector('strong')!.textContent = !helper.siteId ? t.unassigned : !working ? t.paused : moving || task && helper.phase !== 'digging' ? t.walking : task ? t.digging : t.idle;
      if (working && 'custody' in save && carriedFinds(save).length) panel.querySelector('strong')!.textContent = storageText.carrying;
      else if (working && !task && 'custody' in save && storedFinds(save).length) panel.querySelector('strong')!.textContent = storageText.waiting;
      const progress = panel.querySelector('progress')!; progress.hidden = !task; progress.value = task ? task.work / task.required : 0;
      panel.querySelector('span')!.textContent = task ? `${Math.round(task.work / task.required * 100)}%` : '';
    },
    dispose() { button.remove(); view.remove(); panel.remove(); badge.remove(); },
  };
}
