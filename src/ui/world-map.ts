import type { HelperPlaySave } from '../game/helpers';
import type { TicketSave } from '../game/visitors';
import { MAP_SITES, mapSite, mapText as t } from '../content/world-map';
import { siteOwned, sitePurchaseStatus, travelBusy } from '../game/world-map';
import type { TravelSave } from '../game/world-map';

function picture(site: typeof MAP_SITES[number]) {
  return `<svg viewBox="0 0 240 100" aria-hidden="true"><path fill="${site.grass}" d="M0 0h240v100H0z"/>
    <path fill="${site.trail}" d="M0 85 100 30 240 60v40H0z"/><path fill="${site.earth}" d="m66 58 65-22 46 24-65 24z"/>
    <path fill="#275953" d="m112 84 65-24v10l-65 23-46-25V58z"/>
    <path stroke="#765a3b" stroke-width="4" d="M69 32v34m102-34v35"/>
    <path fill="#fff3cf" d="m60 30 59-21 62 24-65 23z"/><path fill="#458f87" d="m82 22 11-4 62 24-12 4zm25-9 12-4 62 24-13 4z"/>
    <path fill="${site.leaf}" d="m12 42 17-33 17 33zm175-10 16-30 18 30z"/>
    ${site.playable ? '' : '<text x="120" y="72" text-anchor="middle" font-size="44" fill="#fff">?</text>'}</svg>`;
}
export function createMapUi(root: HTMLElement, actions: { open(): void; buy(id: string): void; travel(id: string | null): void }) {
  const dialog = root.querySelector('dialog')!;
  const button = document.createElement('button'); button.id = 'open-map'; button.className = 'bag-button';
  button.textContent = t.title; button.onclick = actions.open; root.querySelector('.masthead')!.append(button);
  const view = document.createElement('section'); view.id = 'map-view'; view.hidden = true;
  view.innerHTML = `<div class="map-home"><div><strong>${t.museum}</strong><p>${t.home}</p></div><button data-travel="hub">${t.museum}</button></div>
    <div class="map-cards">${MAP_SITES.map(site => `<article data-map-site="${site.id}">${picture(site)}<div class="map-card-body">
    <p class="map-period">${site.period}</p><h3>${site.title}</h3><p>${site.difficulty}</p>
    <p class="map-status" role="status"></p><button data-site-buy="${site.id}"></button>
    <button data-travel="${site.id}">${t.travel}</button></div></article>`).join('')}</div>`;
  dialog.querySelector('#activity-hint')!.after(view);
  view.querySelectorAll<HTMLButtonElement>('[data-travel]').forEach(b => b.onclick = () => actions.travel(b.dataset.travel === 'hub' ? null : b.dataset.travel!));
  view.querySelectorAll<HTMLButtonElement>('[data-site-buy]').forEach(b => b.onclick = () => actions.buy(b.dataset.siteBuy!));
  let lastKey = '';
  return {
    update(save: TravelSave | TicketSave | HelperPlaySave, active: boolean, blocked: boolean, otherActivity: boolean) {
      const busy = travelBusy(save);
      button.disabled = blocked || busy || otherActivity;
      button.title = busy ? t.busy : t.title;
      view.hidden = !active; dialog.classList.toggle('is-map', active);
      if (!active) return;
      dialog.querySelector('#activity-title')!.textContent = t.title;
      dialog.querySelector('#activity-hint')!.textContent = busy ? t.busy : t.hint;
      dialog.querySelector('#activity-close')!.textContent = t.close;
      const key = `${save.economy.coins}:${save.world.owned.length}:${save.closedSites.join()}:${save.placed.join()}:${blocked}:${busy}`;
      if (key === lastKey) return; lastKey = key;
      view.querySelector<HTMLButtonElement>('[data-travel="hub"]')!.disabled = blocked || busy;
      for (const site of MAP_SITES) {
        const card = view.querySelector<HTMLElement>(`[data-map-site="${site.id}"]`)!;
        const owned = siteOwned(save, site.id), status = sitePurchaseStatus(save, site.id);
        card.querySelector('.map-status')!.textContent = owned ? save.closedSites.includes(site.id) ? t.exhausted : t.owned
          : status === 'insufficient' ? `${t.insufficient}: ${site.cost - save.economy.coins}` : t[status];
        const buy = card.querySelector<HTMLButtonElement>('[data-site-buy]')!;
        buy.hidden = owned || !site.playable; buy.disabled = blocked || status !== 'ready';
        buy.textContent = `${t.buy} · ${site.cost}`;
        const travel = card.querySelector<HTMLButtonElement>('[data-travel]')!;
        travel.hidden = !owned; travel.disabled = blocked || busy;
      }
    },
    updateCamp(save: TravelSave | TicketSave | HelperPlaySave) {
      if (save.room !== 'excavation') root.querySelector('.portal-label')!.textContent = t.title;
      if (save.room === 'outdoors') {
        root.querySelector('#room-name')!.textContent = mapSite(save.activeSiteId)!.title;
        root.querySelector('#dig-title')!.textContent = mapSite(save.activeSiteId)!.title;
        root.querySelector('#dig-hint')!.textContent = travelBusy(save) ? t.busy : save.closedSites.includes(save.activeSiteId) ? t.closed : t.camp;
        root.querySelector('#room-hint')!.textContent = travelBusy(save) ? t.busy : save.closedSites.includes(save.activeSiteId) ? t.closed : t.camp;
      }
    },
    dispose() { button.remove(); view.remove(); },
  };
}
