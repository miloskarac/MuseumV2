import { EXHIBITS, SPECIMEN_ID, SLAB_PART, exhibitDefinition, exhibitText as e } from '../content/exhibit';
import type { ExhibitId } from '../content/exhibit';
import { inventory, exhibitComplete, tutorialDismissed } from '../game/assembly';
import { pendingDiscovery } from '../game/journey';
import { createAssemblyUi, groupPicture } from './assembly';
import { drawFossilProfile } from '../presentation/fossil-profiles';
import { DISCOVERY, SITE, activeSite, SITE_PLOTS, journeyText as t } from '../content/journey';
import { cleaningProgress, isClean, isCollected, isSiteComplete, siteAvailability } from '../game/journey';
import type { BrushPoint, JourneyState } from '../game/journey';
import type { Point } from '../game/navigation';
import { completionPhase } from '../game/site-completion';
import type { SaveStatus } from '../persistence/save';
import { ANIMAL_ILLUSTRATIONS, illustrationText } from '../content/animal-illustrations';

export type Panel = 'cleaning' | 'bag' | 'recovery' | 'reset' | 'assembly' | 'whole' | 'story' | 'purchase' | 'map' | 'helper' | 'storage' | 'upgrades' | null;
type Actions = {
  discovery?: (state: JourneyState) => ReturnType<typeof pendingDiscovery>;
  cleaningDiscovery?: (state: JourneyState) => ReturnType<typeof pendingDiscovery>;
  assemble: (id: ExhibitId) => void; place: (group: string, target: string) => boolean;
  clean: () => void; collect: () => void; bag: () => void; close: () => void; reset: () => void;
  confirmReset: () => void; retry: () => void; brush: (from: BrushPoint, to: BrushPoint) => void;
};

export function createJourneyUi(root: HTMLElement, actions: Actions) {
  const bag = document.createElement('button');
  bag.id = 'bag-button'; bag.className = 'bag-button'; bag.textContent = `${t.bag} · 0`;
  root.querySelector('.masthead')!.append(bag);
  const stage = root.querySelector('.stage')!;
  const panel = document.createElement('section');
  panel.className = 'dig-panel'; panel.hidden = true;
  panel.innerHTML = `<strong id="dig-title"></strong><p id="dig-hint"></p>`;
  stage.append(panel);
  const cleanButton = document.createElement('button');
  cleanButton.id = 'clean-button'; cleanButton.className = 'clean-fossil-button';
  cleanButton.textContent = t.clean; cleanButton.hidden = true;
  stage.append(cleanButton);
  const siteLabels = SITE_PLOTS.map(plot => {
    const label = document.createElement('div'); label.className = 'world-label site-label';
    label.id = `label-${plot.id}`; label.hidden = true; stage.append(label); return label;
  });
  const saveBar = document.createElement('div');
  saveBar.className = 'save-bar';
  saveBar.innerHTML = `<span id="save-status" role="status"></span><button id="retry-save" hidden>${t.retry}</button><button id="reset-button" class="quiet-button">${t.reset}</button>`;
  stage.append(saveBar);
  const about = document.createElement('button');
  about.id = 'about-fossil'; about.className = 'about-fossil-button';
  about.textContent = e.about; about.hidden = true;
  stage.append(about);
  let offeredStory: ExhibitId | null = null;
  function offerStory(id: ExhibitId | null) {
    offeredStory = id;
    about.hidden = !id;
    if (id) about.setAttribute('aria-label', `${e.about}: ${exhibitDefinition(id).text.name}`);
  }
  about.onclick = () => { if (offeredStory) actions.assemble(offeredStory); };
  const dialog = document.createElement('dialog');
  dialog.className = 'journey-dialog'; dialog.setAttribute('aria-labelledby', 'activity-title');
  dialog.innerHTML = `<p id="story-era" hidden>${e.storyEra}</p><h2 id="activity-title"></h2><p id="activity-hint"></p>
    <section id="cleaning-view" hidden>
      <canvas class="cleaning-canvas" id="cleaning-canvas" width="720" height="420" aria-label="${t.cleanHint}"></canvas>
      <aside class="cleaning-details"><span class="brush-tag">${t.brushLabel}</span><h3>${DISCOVERY.name}</h3>
      <p id="cleaning-progress-label" role="status"></p>
      <progress id="cleaning-progress" max="1" aria-label="${t.cleanProgress}"></progress>
      <p class="gentle-note">${t.cleanSafe}</p>
      <button id="collect-fossil" disabled>${t.collect}</button></aside>
    </section>
    <ul id="bag-list" hidden></ul><p id="dialog-error" role="alert" hidden></p>
    <p id="activity-save-status" role="status"></p><button id="activity-retry-save" hidden>${t.retry}</button>
    <div class="dialog-actions">
      <button id="activity-close"></button><button id="recovery-retry" hidden>${t.retry}</button>
      <button id="recovery-reset" hidden class="quiet-button">${t.reset}</button>
      <button id="confirm-reset" hidden class="danger-button">${t.confirmReset}</button>
    </div>`;
  root.append(dialog);
  const assembly = createAssemblyUi(dialog, actions.place);
  const story = document.createElement('section'); story.id = 'story-view'; story.hidden = true;
  dialog.append(story);
  const whole = document.createElement('section'); whole.id = 'whole-view'; whole.hidden = true;
  whole.innerHTML = `<div class="whole-preview">${groupPicture(SLAB_PART.id)}<p></p></div>`;
  const comparison = document.createElement('div'); comparison.className = 'story-comparison';
  const animal = document.createElement('figure'); animal.id = 'story-animal'; animal.hidden = true;
  animal.innerHTML = `<img id="story-animal-image" alt=""><figcaption>${illustrationText.title}</figcaption>`;
  comparison.append(dialog.querySelector('#assembly-view')!, whole, animal);
  dialog.insertBefore(comparison, story);
  let selectedExhibit: ExhibitId = SPECIMEN_ID;
  const exhibitButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-exhibit]')];
  exhibitButtons.forEach(button => { button.onclick = () => actions.assemble(button.dataset.exhibit as ExhibitId); });

  const find = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const cleanCanvas = find<HTMLCanvasElement>('#cleaning-canvas');
  const context = cleanCanvas.getContext('2d')!;
  let active: Panel = null;
  let pointer: number | null = null;
  let previous: BrushPoint | null = null;
  let lastState: JourneyState | null = null;
  let lastNear: boolean | null = null;
  let lastPlot = '';
  let lastMask: number[] | undefined;
  let lastCollected = false;
  let lastFind = "";
  let lastMode: Panel = null;
  let saveStatus: SaveStatus = 'idle';
  const stopStroke = () => {
    if (pointer !== null && cleanCanvas.hasPointerCapture(pointer)) cleanCanvas.releasePointerCapture(pointer);
    pointer = null; previous = null;
  };
  bag.onclick = actions.bag;
  find('#clean-button').onclick = actions.clean;
  find('#collect-fossil').onclick = () => { stopStroke(); actions.collect(); };
  find('#reset-button').onclick = actions.reset;
  find('#retry-save').onclick = actions.retry;
  find('#activity-retry-save').onclick = actions.retry;
  find('#activity-close').onclick = actions.close;
  find('#recovery-retry').onclick = actions.retry;
  find('#recovery-reset').onclick = actions.reset;
  find('#confirm-reset').onclick = actions.confirmReset;
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (active !== 'recovery') actions.close(); });
  function stroke(event: PointerEvent) {
    if (active !== 'cleaning' || pointer !== event.pointerId || document.hidden || !document.hasFocus()) return;
    const bounds = cleanCanvas.getBoundingClientRect();
    const style = getComputedStyle(cleanCanvas);
    const left = parseFloat(style.borderLeftWidth), right = parseFloat(style.borderRightWidth);
    const top = parseFloat(style.borderTopWidth), bottom = parseFloat(style.borderBottomWidth);
    const point = { x: (event.clientX - bounds.left - left) / (bounds.width - left - right),
      y: (event.clientY - bounds.top - top) / (bounds.height - top - bottom) };
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) { previous = null; return; }
    actions.brush(previous ?? point, point);
    previous = point;
  }
  cleanCanvas.onpointerdown = event => {
    if (event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId; previous = null;
    cleanCanvas.setPointerCapture(pointer); stroke(event);
  };
  cleanCanvas.onpointermove = event => { if (event.buttons & 1) stroke(event); else stopStroke(); };
  cleanCanvas.onpointerup = stopStroke;
  cleanCanvas.onpointercancel = stopStroke;
  cleanCanvas.onlostpointercapture = stopStroke;
  window.addEventListener('blur', stopStroke);
  document.addEventListener('visibilitychange', stopStroke);
  function showSaveStatus(status: SaveStatus) {
    saveStatus = status;
    const message = status === 'failed' ? t.saveFailed : status === 'saved' ? t.saved : status === 'pending' ? t.saving : '';
    find('#save-status').textContent = message;
    find('#retry-save').hidden = status !== 'failed';
    const inActivity = active === 'cleaning' || active === 'bag' || active === 'assembly' || active === 'whole' || active === 'story' || active === 'purchase' || active === 'map' || active === 'helper' || active === 'storage' || active === 'upgrades';
    find('#activity-save-status').textContent = inActivity ? message : '';
    find('#activity-retry-save').hidden = !inActivity || status !== 'failed';
    saveBar.classList.toggle('save-error', status === 'failed');
  }

  function drawCleaning(state: JourneyState) {
    const find = actions.cleaningDiscovery ? actions.cleaningDiscovery(state) : pendingDiscovery(state);
    const id = find?.id ?? DISCOVERY.id;
    const w = cleanCanvas.width, h = cleanCanvas.height;
    const { columns, rows } = DISCOVERY.cleaning;
    context.clearRect(0, 0, w, h);
    context.fillStyle = '#3d5b50'; context.fillRect(0, 0, w, h);
    // Artwork only: the existing full-tray dirt mask and brush rules stay intact.
    context.save(); context.scale(w / columns, h / rows);
    drawFossilProfile(context, find?.groupId ?? 'spine-sail');
    if (!isCollected(state, id)) {
      const cleaned = new Set(state.cleaning[id] ?? []);
      // Dirt is its own overlay over the intact fossil, across the entire tray.
      for (let index = 0; index < columns * rows; index++) if (!cleaned.has(index)) {
        const x = index % columns, y = Math.floor(index / columns);
        context.fillStyle = '#b38e5e';
        context.fillRect(x, y, 1.01, 1.01);
        context.fillStyle = index % 3 ? '#c7a779' : '#9e7a50';
        context.beginPath(); context.ellipse(x + 0.25 + index % 3 * 0.19, y + 0.45, 0.07, 0.045, 0, 0, Math.PI * 2); context.fill();
      }
    }
    context.restore();
  }

  return {
    selectExhibit(id: ExhibitId) { selectedExhibit = id; },
    show(mode: Panel) {
      offerStory(null);
      stopStroke(); active = mode; lastState = null;
      const exhibit = exhibitDefinition(selectedExhibit), storyText = exhibit.text;
      assembly.show(mode === 'assembly' || exhibit.mode === 'assembled' && mode === 'story' ? mode : null, selectedExhibit);
      story.hidden = mode !== 'story';
      whole.hidden = mode !== 'story' || exhibit.mode !== 'whole';
      animal.hidden = mode !== 'story';
      if (mode === 'story') {
        const illustration = ANIMAL_ILLUSTRATIONS[selectedExhibit];
        const image = animal.querySelector('img')!;
        image.src = illustration.image; image.alt = illustration.alt;
        find('#story-era').textContent = storyText.storyEra;
        whole.querySelector('p')!.textContent = storyText.name;
        story.innerHTML = `<div class="story-facts">${storyText.storyFacts.map(fact => `<section><h3>${fact.title}</h3><p>${fact.text}</p></section>`).join('')}</div><p class="story-observe">${storyText.storyObserve}</p>
          <details class="story-image-credit"><summary>${illustrationText.credit}</summary><p>${illustration.note}</p>
          <p>${illustrationText.author}: ${illustration.author} · <a href="${illustration.source}" target="_blank" rel="noopener noreferrer">${illustrationText.source}</a> · <a href="${illustration.licenseUrl}" target="_blank" rel="noopener noreferrer">${illustration.license}</a></p></details>`;
      }
      dialog.classList.toggle('is-assembly', mode === 'assembly' || mode === 'story');
      dialog.classList.toggle('is-story', mode === 'story');
      find('#story-era').hidden = mode !== 'story';
      dialog.classList.toggle('is-cleaning', mode === 'cleaning');
      const actionHost = mode === 'cleaning' ? find('.cleaning-details') : dialog;
      for (const selector of ['#activity-save-status', '#activity-retry-save', '.dialog-actions']) actionHost.append(find(selector));
      showSaveStatus(saveStatus);
      find('#dialog-error').hidden = true;
      if (mode && !dialog.open) dialog.showModal();
      if (!mode && dialog.open) dialog.close();
      find('#cleaning-view').hidden = mode !== 'cleaning';
      find('#bag-list').hidden = mode !== 'bag';
      find('#recovery-retry').hidden = mode !== 'recovery';
      find('#recovery-reset').hidden = mode !== 'recovery';
      find('#confirm-reset').hidden = mode !== 'reset';
      find('#activity-close').hidden = mode === 'recovery';
      if (mode) {
        find('#activity-title').textContent = mode === 'whole' ? t.slabUnknown : mode === 'assembly' ? exhibit.mode === 'whole' ? t.placeWhole : e.assemble : mode === 'story' ? storyText.storyTitle : mode === 'cleaning' ? t.cleanTitle : mode === 'bag' ? t.bag : mode === 'recovery' ? t.recoveryTitle : t.resetTitle;
        find('#activity-hint').textContent = mode === 'whole' ? t.slabMissing : mode === 'assembly' ? e.instruction : mode === 'story' ? storyText.storyIntro : mode === 'cleaning' ? t.cleanHint : mode === 'bag' ? '' : mode === 'recovery' ? t.recovery : t.resetHint;
        find('#activity-close').textContent = mode === 'story' ? e.backToMuseum : mode === 'cleaning' ? t.leave : mode === 'bag' || mode === 'assembly' || mode === 'whole' ? t.closeBag : t.cancel;
        find(mode === 'recovery' ? '#recovery-retry' : '#activity-close').focus();
        if (mode === 'story') dialog.scrollTop = 0;
      }
    },
    update(state: JourneyState, nearby: boolean, position: Point) {
      const nearPlot = state.room === 'outdoors' ? SITE_PLOTS.find(plot => Math.hypot(position.x - plot.entrance.x, position.z - plot.entrance.z) < 1.1) : undefined;
      if (lastState === state && lastNear === nearby && lastPlot === (nearPlot?.id ?? '')) return;
      lastState = state; lastNear = nearby; lastPlot = nearPlot?.id ?? '';
      const manual = actions.discovery ? actions.discovery(state) : pendingDiscovery(state);
      const discovery = active === 'cleaning' && actions.cleaningDiscovery ? actions.cleaningDiscovery(state) : manual, id = discovery?.id ?? DISCOVERY.id;
      const collected = isCollected(state, id), cleaned = cleaningProgress(state, id);
      const bagGroups = inventory(state);
      assembly.update(state);
      for (const button of exhibitButtons) {
        const exhibit = exhibitDefinition(button.dataset.exhibit as ExhibitId);
        const count = exhibit.parts.filter(id => state.placed.includes(id)).length;
        button.setAttribute('aria-label', `${count === exhibit.parts.length ? `${e.card}: ${exhibit.text.name}` : exhibit.mode === 'whole' ? t.slabUnknown : e.assemble} · ${e.progress} ${count}/${exhibit.parts.length}`);
        button.dataset.state = count === exhibit.parts.length ? 'complete' : count ? 'partial' : 'empty';
      }
      const hint = root.querySelector('#room-hint')!;
      const allComplete = EXHIBITS.every(exhibit => exhibitComplete(state, exhibit.id));
      const site = activeSite(state);
      const collectedHere = site.requiredDiscoveryIds.filter(id => state.collected.includes(id)).length;
      const exploreGoal = state.closedSites.includes(SITE.id) ? t.eryopsSite : t.outdoorsHint;
      const goal = state.room === 'museum' ? allComplete ? t.allDone : bagGroups.some(g => g.id === SLAB_PART.id) ? t.slabReady
        : bagGroups.length ? e.approach : exploreGoal
        : state.room === 'outdoors' ? allComplete ? t.allDone : bagGroups.length ? t.returnFinds : exploreGoal
        : `${t.approach} (${collectedHere}/${site.requiredDiscoveryIds.length})`;
      hint.textContent = `${tutorialDismissed(state) ? '' : '➜ '}${goal}`;
      hint.classList.toggle('tutorial-arrow', !tutorialDismissed(state));
      bag.textContent = `${t.bag} · ${bagGroups.length}`;
      panel.hidden = state.room !== 'outdoors';
      const uncovered = !!manual;
      find('#clean-button').hidden = !uncovered || state.room !== 'excavation';
      find('#clean-button').textContent = cleaned > 0 ? t.resume : t.clean;
      SITE_PLOTS.forEach((plot, i) => {
        const status = siteAvailability(state, plot.number);
        siteLabels[i].innerHTML = `<strong>${t.siteName} ${plot.number}</strong><span>${status === 'open' ? t.enter : status === 'complete' ? 'Завршено' : 'Није доступно'}</span>`;
      });
      if (state.room === 'outdoors') {
        find('#dig-title').textContent = nearPlot ? `${t.siteName} ${nearPlot.number}` : isSiteComplete(state) ? t.siteComplete : 'Налазишта';
        find('#dig-hint').textContent = nearPlot && !nearPlot.playable
          ? siteAvailability(state, nearPlot.number) === 'future-purchase' ? t.futurePurchase : t.lockedSite
          : nearPlot && siteAvailability(state, nearPlot.number) === 'locked' ? t.siteLocked
          : nearPlot && siteAvailability(state, nearPlot.number) === 'complete' ? t.closedSite : completionPhase(state) === 'exit' ? t.leavingSite : goal;
      }
      if (active === 'cleaning') {
        const ready = isClean(state, id);
        find('.cleaning-details h3').textContent = discovery?.name ?? DISCOVERY.name;
        find<HTMLButtonElement>('#collect-fossil').disabled = !ready || collected;
        find('#activity-title').textContent = ready ? t.cleaned : t.cleanTitle;
        find('#activity-hint').textContent = ready ? t.cleanedHint : t.cleanHint;
        find<HTMLProgressElement>('#cleaning-progress').value = cleaned;
        find('#cleaning-progress-label').textContent = `${t.cleanProgress} · ${Math.round(cleaned * 100)}%`;
        const mask = state.cleaning[id];
        if (mask !== lastMask || collected !== lastCollected || lastMode !== active || lastFind !== id) drawCleaning(state);
        lastMask = mask; lastCollected = collected; lastFind = id;
      }
      if (active === 'bag') {
        find('#bag-list').replaceChildren();
        for (const group of bagGroups) {
          const item = document.createElement('li');
          item.dataset.bagGroup = group.id;
          const owner = EXHIBITS.find(exhibit => (exhibit.parts as readonly string[]).includes(group.id))!;
          const number = owner.mode === 'assembled' ? (owner.parts as readonly string[]).indexOf(group.id) + 1 : 0;
          item.innerHTML = `${number ? `<b class="part-number" aria-hidden="true">${number}</b>` : ''}${groupPicture(group.id)}<span>${group.label}</span>`;
          find('#bag-list').append(item);
        }
        find('#activity-hint').textContent = bagGroups.length ? t.returnFinds : allComplete ? t.allDone : exploreGoal;
      }
      lastMode = active;
    },
    saveStatus: showSaveStatus,
    offerStory,
    placeSites(labels: { id: string; point: { x: number; y: number } }[]) {
      SITE_PLOTS.forEach((plot, i) => {
        const label = labels.find(label => label.id === plot.id); siteLabels[i].hidden = !label;
        if (label) { siteLabels[i].style.left = `${label.point.x}px`; siteLabels[i].style.top = `${label.point.y}px`; }
      });
    },
    error(message: string) { find('#dialog-error').textContent = message; find('#dialog-error').hidden = false; },
    dispose() { assembly.dispose(); exhibitButtons.forEach(button => button.remove()); whole.remove(); story.remove(); stopStroke(); window.removeEventListener('blur', stopStroke); document.removeEventListener('visibilitychange', stopStroke); dialog.remove(); panel.remove(); cleanButton.remove(); saveBar.remove(); about.remove(); bag.remove(); siteLabels.forEach(label => label.remove()); },
  };
}
