import { storageText as t } from '../content/storage';
import { ROOM1_DISCOVERIES } from '../content/journey';
import { groupPicture } from './assembly';
import { storedFinds, atStorage } from '../game/storage';
import type { StoragePlaySave } from '../game/storage';
import { cleaningProgress } from '../game/journey';
import { museumJourney } from '../game/purchases';
import type { Point } from '../game/navigation';
export function createStorageUi(root: HTMLElement, actions: { open(): void; select(id: string): void }) {
  const marker = document.createElement('button'); marker.id = 'open-storage'; marker.className = 'storage-marker'; marker.hidden = true; marker.onclick = actions.open;
  root.querySelector('.stage')!.append(marker);
  const view = document.createElement('section'); view.id = 'storage-view'; view.hidden = true;
  const dialog = root.querySelector('dialog')!; dialog.querySelector('#activity-hint')!.after(view);
  let last = '', previousSite = '', previousCount = 0, cueUntil = 0;
  return {
    reset(save: StoragePlaySave) { previousSite = save.activeSiteId; previousCount = storedFinds(save).length; cueUntil = 0; last = ''; },
    update(save: StoragePlaySave, position: Point, active: boolean, blocked: boolean, otherActivity: boolean, point?: { x: number; y: number } | null) {
      view.hidden = !active; marker.hidden = save.room === 'museum' || !point;
      const ids = storedFinds(save), near = atStorage(save, position);
      if (previousSite === save.activeSiteId && ids.length > previousCount) cueUntil = performance.now() + 2500;
      if (previousSite !== save.activeSiteId) cueUntil = 0;
      previousSite = save.activeSiteId; previousCount = ids.length;
      marker.textContent = `${performance.now() < cueUntil ? t.arrive : t.open} · ${ids.length}`; marker.disabled = blocked || otherActivity || !near;
      marker.title = near ? t.open : t.approach;
      if (point) {
        const stage = root.querySelector<HTMLElement>('.stage')!, half = marker.offsetWidth / 2 + 8;
        marker.style.left = `${Math.max(half, Math.min(stage.clientWidth - half, point.x))}px`;
        marker.style.top = `${Math.max(50, Math.min(stage.clientHeight - 100, point.y))}px`;
      }
      if (!active) { last = ''; return; }
      dialog.querySelector('#activity-title')!.textContent = t.title;
      dialog.querySelector('#activity-hint')!.textContent = t.hint;
      dialog.querySelector('#activity-close')!.textContent = t.close;
      const key = JSON.stringify([ids, save.cleaning, blocked]); if (last === key) return; last = key;
      view.replaceChildren();
      if (!ids.length) { const empty = document.createElement('p'); empty.textContent = t.empty; view.append(empty); }
      for (const id of ids) {
        const find = ROOM1_DISCOVERIES.find(f => f.id === id)!, progress = cleaningProgress(museumJourney(save), id);
        const row = document.createElement('article'); row.innerHTML = `${groupPicture(find.groupId)}<strong>${find.name}</strong>`;
        const button = document.createElement('button'); button.dataset.storedFind = id; button.disabled = blocked;
        button.textContent = progress === 1 ? t.ready : progress ? `${t.resume} · ${Math.round(progress * 100)}%` : t.clean;
        button.onclick = () => actions.select(id); row.append(button); view.append(row);
      }
    },
    dispose() { marker.remove(); view.remove(); },
  };
}
