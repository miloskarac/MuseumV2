import { ROOM1_PARTS, SLAB_PART, SPECIMEN_ID, exhibitDefinition, exhibitText as t } from '../content/exhibit';
import type { ExhibitId } from '../content/exhibit';
import type { SkeletonId } from '../presentation/skeletons';
import { exhibitComplete, inventory } from '../game/assembly';
import type { JourneyState } from '../game/journey';
import { FOSSIL_PROFILES } from '../presentation/fossil-profiles';
import type { FossilGroup } from '../presentation/fossil-profiles';
import { createAssemblyPreview } from '../presentation/assembly-preview';

export function groupPicture(id: string) {
  const facets = FOSSIL_PROFILES[id as FossilGroup] ?? [];
  return `<svg viewBox="0 0 24 14" aria-hidden="true">${facets.map(facet =>
    `<polygon points="${facet.points.map(p => p.join(',')).join(' ')}" fill="${{ bone: '#f6edd3', shade: '#d4c29b', recess: '#53665a' }[facet.tone]}"/>`).join('')}</svg>`;
}

export function createAssemblyUi(host: HTMLElement, place: (group: string, target: string) => boolean) {
  const view = document.createElement('section'); view.id = 'assembly-view'; view.hidden = true;
  view.innerHTML = `<div class="assembly-workbench"><div class="assembly-display">
    <div class="assembly-targets"><canvas id="assembly-canvas" aria-label="${t.assemblyPreview}"></canvas><div id="assembly-slab-preview" hidden>${groupPicture(SLAB_PART.id)}</div>${ROOM1_PARTS.map((group, i) =>
      `<button class="assembly-target" data-target="${group.id}" aria-label="${t.placeSlot}: ${group.label}" title="${group.label}">${i + 1}</button>`).join('')}</div>
    <p class="story-specimen-name">${t.name}</p><p id="assembly-count"></p></div>
    <aside class="assembly-tray"><h3>${t.partsTray}</h3><div class="assembly-parts">${ROOM1_PARTS.map((group, i) =>
      `<button data-group="${group.id}" aria-pressed="false"><b class="part-number">${i + 1}</b>${groupPicture(group.id)}<span>${group.label}</span></button>`).join('')}</div></aside></div>
    <p id="assembly-feedback" role="status"></p>`;
  host.append(view);
  let selected: string | null = null;
  let drag: { id: string; pointer: number; x: number; y: number; moved: boolean } | null = null;
  let suppressClick = false;
  let mode: 'assembly' | 'story' | null = null;
  let lastState: JourneyState | null = null;
  let exhibitId: ExhibitId = SPECIMEN_ID;
  let preview: ReturnType<typeof createAssemblyPreview> | null = null;
  let previewId: ExhibitId | null = null;
  const parts = [...view.querySelectorAll<HTMLButtonElement>('[data-group]')];
  const targets = [...view.querySelectorAll<HTMLButtonElement>('[data-target]')];
  const feedback = view.querySelector<HTMLElement>('#assembly-feedback')!;
  function select(id: string | null) {
    selected = id;
    parts.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.group === id)));
    targets.forEach(button => button.classList.toggle('selected', button.dataset.target === id));
    preview?.select(id);
    view.querySelector('#assembly-slab-preview')!.classList.toggle('selected', id === exhibitDefinition(exhibitId).parts[0]);
  }
  function attempt(target: string) {
    if (!selected) return;
    const accepted = place(selected, target);
    feedback.textContent = accepted ? t.placed : t.harmless;
    if (accepted) select(null);
  }
  for (const button of parts) {
    button.onclick = () => { if (suppressClick) { suppressClick = false; return; } select(button.dataset.group!); };
    button.onpointerdown = event => {
      if (event.button !== 0) return;
      suppressClick = false; select(button.dataset.group!);
      drag = { id: selected!, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      button.setPointerCapture(event.pointerId);
    };
    button.onpointermove = event => {
      if (!drag || drag.pointer !== event.pointerId) return;
      drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 8;
      if (drag.moved) { button.style.transform = `translate(${event.clientX - drag.x}px, ${event.clientY - drag.y}px)`; button.classList.add('dragging'); }
    };
    button.onpointerup = event => {
      if (!drag || drag.pointer !== event.pointerId) return;
      const moved = drag.moved;
      cancelDrag();
      if (!moved) return;
      suppressClick = true;
      // Distance to the target rectangle, with 28px forgiveness beyond its edge.
      const distances = targets.filter(target => !target.hidden && !target.disabled).map(target => {
        const b = target.getBoundingClientRect();
        return { target, distance: Math.hypot(Math.max(b.left - event.clientX, 0, event.clientX - b.right), Math.max(b.top - event.clientY, 0, event.clientY - b.bottom)) };
      }).sort((a, b) => a.distance - b.distance);
      // Small anatomical regions can overlap on narrow screens. Prefer the selected
      // part's valid snap zone, then fall back to a harmless wrong-target attempt.
      const nearest = distances.find(item => item.target.dataset.target === selected && item.distance <= 28) ?? distances[0];
      attempt(nearest && nearest.distance <= 28 ? nearest.target.dataset.target! : 'outside');
    };
    button.onpointercancel = cancelDrag;
    button.onlostpointercapture = cancelDrag;
  }
  targets.forEach(button => { button.onclick = () => attempt(button.dataset.target!); });
  function cancelDrag() {
    const previous = drag; drag = null;
    for (const button of parts) {
      button.style.transform = ''; button.classList.remove('dragging');
      if (previous && button.hasPointerCapture(previous.pointer)) button.releasePointerCapture(previous.pointer);
    }
  }
  window.addEventListener('blur', cancelDrag);
  document.addEventListener('visibilitychange', cancelDrag);
  return {
    show(next: typeof mode, id: ExhibitId = SPECIMEN_ID) {
      cancelDrag(); select(null); feedback.textContent = '';
      exhibitId = id;
      const whole = exhibitDefinition(id).mode === 'whole';
      view.classList.toggle('assembly-whole', whole);
      if (whole) view.querySelector('#assembly-slab-preview')!.innerHTML = groupPicture(exhibitDefinition(id).parts[0]);
      mode = next; view.hidden = !mode;
      view.querySelector<HTMLCanvasElement>('canvas')!.hidden = whole;
      view.querySelector<HTMLElement>('#assembly-slab-preview')!.hidden = !whole;
      view.classList.toggle('assembly-story', mode === 'story');
      view.querySelector('.story-specimen-name')!.textContent = exhibitDefinition(id).text.name;
      if (preview && previewId !== id) { preview.dispose(); preview = null; }
      if (mode && !whole && !preview) {
        const ids: readonly string[] = exhibitDefinition(id).parts;
        preview = createAssemblyPreview(view.querySelector<HTMLCanvasElement>('canvas')!, targets.filter(target => ids.includes(target.dataset.target!)), id as SkeletonId);
        previewId = id;
        if (lastState) preview.update(lastState);
      }
      preview?.show(!!mode && !whole);
    },
    update(state: JourneyState) {
      preview?.update(state, mode === 'assembly' && !!lastState);
      lastState = state;
      const exhibit = exhibitDefinition(exhibitId), ids: readonly string[] = exhibit.parts;
      const bag = inventory(state).filter(group => ids.includes(group.id));
      parts.forEach(button => {
        button.hidden = !bag.some(group => group.id === button.dataset.group);
        button.querySelector('.part-number')!.textContent = String(ids.indexOf(button.dataset.group!) + 1);
      });
      targets.forEach(button => {
        button.hidden = !ids.includes(button.dataset.target!);
        const placed = state.placed.includes(button.dataset.target!);
        button.disabled = placed; button.classList.toggle('placed', placed);
        button.textContent = placed ? '✓' : String(ids.indexOf(button.dataset.target!) + 1);
      });
      view.querySelector('#assembly-count')!.textContent = `${t.progress} · ${ids.filter(id => state.placed.includes(id)).length}/${ids.length}`;
      view.querySelector('#assembly-slab-preview')!.classList.toggle('placed', exhibit.parts.every(id => state.placed.includes(id)));
      if (!bag.length && !exhibitComplete(state, exhibitId)) feedback.textContent = exhibit.missing;
    },
    dispose() { cancelDrag(); preview?.dispose(); window.removeEventListener('blur', cancelDrag); document.removeEventListener('visibilitychange', cancelDrag); view.remove(); },
  };
}
