import { exhibitComplete } from '../game/assembly';
import { pendingDiscovery } from '../game/journey';
import { text } from '../content/prototype';
import { ARRIVAL, START, EXHIBIT_MARKER_RADIUS, destinationAt, movePlayer } from '../game/navigation';
import { activeSite, sitePlot, siteFront, SITE_PLOTS, journeyText as t } from '../content/journey';
import { ROOM1_EXHIBITS, exhibitDefinition } from '../content/exhibit';
import type { ExhibitId } from '../content/exhibit';
import { brush, collectFossil, stepDigging, digObstacles, freshJourney, isSiteComplete, nearDig, siteAvailability } from '../game/journey';
import { completionPhase, stepCompletion } from '../game/site-completion';
import type { CleanupPop } from '../game/site-completion';
import type { DigSwing, JourneyState } from '../game/journey';
import { createKeyboard } from '../input/keyboard';
import { SAVE_KEY } from '../persistence/save';
import { loadRoom1Game } from '../persistence/room1-game-save';
import { createRoom1Game } from '../game/room1-economy';
import { mvpProgressHint, mvpNeedsRecoveryNotice, room1CompletionTransition } from '../game/mvp-progression';
import { createRoomCompletionUi } from '../ui/room-completion';
import { collectNearbyTicketRevenue } from '../game/cash';
import { createPurchasePaymentSimulation } from '../game/purchase-payments';
import { buyUpgrade } from '../game/upgrades';
import { playerWalkRate, playerDigRate } from '../game/upgrade-stats';
import { WALK_SPEED } from '../game/navigation';
import { createUpgradeUi } from '../ui/upgrades';
import { carriedFinds, atStorage, canCleanStored, brushStored, collectStored, settleDeliveries } from '../game/storage';
import { ROOM1_DISCOVERIES } from '../content/journey';
import { createStorageUi } from '../ui/storage';
import { createVisitorSimulation } from '../game/visitor-simulation';
import { createVisitorUi } from '../ui/visitors';
import { createCommitter } from './commit';
import { createSaveSession } from '../persistence/session';
import { advanceMuseum, museumJourney, standAvailable, buyPurchase, placeOwnedGroup } from '../game/purchases';
import { travelTo, travelSpawn, travelBusy, buySite, campObstacles } from '../game/world-map';
import type { WorldLocation } from '../game/world-map';
import { createMapUi } from '../ui/world-map';
import type { PlaySave } from '../game/purchases';
import { museumLayout, safeMuseumPosition } from '../game/museum-layout';
import { PURCHASE_QA_KEY, PURCHASE_QA_LOCK } from '../persistence/museum-save';
import { WRITER_LOCK } from '../persistence/session';
import { standOffer, purchaseDefinition, purchaseText } from '../content/purchases';
import { createPurchaseUi } from '../ui/purchases';
import { createEconomyUi } from '../ui/economy';
import { economyText } from '../content/economy';
import { createWorld } from '../presentation/world';
import { createHud } from '../ui/hud';
import { createJourneyUi } from '../ui/journey';
import type { Panel } from '../ui/journey';
import { advanceSimulation } from '../game/simulation-speed';
import type { GameSpeed } from '../game/simulation-speed';
import { createDevelopmentSpeed } from '../ui/development-speed';
import { buyHelper, assignHelper, pauseHelper } from '../game/helpers';
import { createHelperSimulation } from '../game/helper-simulation';
import { HELPER_QA_KEY, HELPER_QA_LOCK } from '../persistence/helper-save';
import { createHelperUi } from '../ui/helpers';

export function startPrototype(root: HTMLElement): () => void {
  // The QA parameter selects a separate save; both modes use the completed economy loop.
  const purchasesEnabled = import.meta.env.DEV && new URLSearchParams(location.search).get('purchases') === '1';
  const helpersEnabled = import.meta.env.DEV && new URLSearchParams(location.search).get('helpers') === '1';
  const storageKey = helpersEnabled ? HELPER_QA_KEY : purchasesEnabled ? PURCHASE_QA_KEY : SAVE_KEY;
  const hud = createHud(root);
  const roomCompletionUi = createRoomCompletionUi(root);
  let world: ReturnType<typeof createWorld>;
  try {
    world = createWorld(hud.canvas, true, true);
  } catch (error) {
    console.error(error);
    hud.showError(text.unavailable);
    return () => root.replaceChildren();
  }
  const keyboard = createKeyboard();
  let state = freshJourney();
  let game: PlaySave = createRoom1Game(0);
  let layout = museumLayout(game);
  let selectedPurchase: string | null = null;
  let position = { ...START };
  let activity: Panel = null;
  let storedSelection: string | null = null;
  const unavailableFinds = () => 'custody' in game ? Object.keys(game.custody) : [];
  const manualFind = () => pendingDiscovery(state, unavailableFinds());
  const cleaningFind = () => storedSelection ? ROOM1_DISCOVERIES.find(f => f.id === storedSelection) : manualFind();
  let beforeReset: Panel = null;
  let recovery = false;
  let saveFailed = false;
  let swing: DigSwing | null = null;
  let cleanup: CleanupPop | null = null;
  let enteredExhibit: ExhibitId | null = null;
  let selectedExhibit: ExhibitId = 'dimetrodon';
  let gameSpeed: GameSpeed = 1;
  let conflict = false;
  const visitors = createVisitorSimulation();
  const purchasePayments = createPurchasePaymentSimulation();
  const helpers = createHelperSimulation();
  const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  // Access storage inside guarded calls: even the localStorage getter can throw.
  const storage = {
    getItem: (_key: string) => window.localStorage.getItem(storageKey),
    setItem: (_key: string, value: string) => window.localStorage.setItem(storageKey, value),
    removeItem: (_key: string) => window.localStorage.removeItem(storageKey),
  };
  function open(mode: Panel) {
    purchasePayments.reset();
    if (mode) checkpointHelperPause();
    if (mode !== 'cleaning' && mode !== 'reset') storedSelection = null;
    swing = null;
    world.animateDig(null);
    keyboard.clear(); activity = mode;
    roomCompletionUi.setBlocked(!!mode);
    world.placePlayer(position, { x: 0, z: -1 }, false, 0);
    ui.show(mode); ui.update(state, nearDig(state, position), position);
    updatePurchases();
    if (!mode) hud.canvas.focus({ preventScroll: true });
  }
  const canMutate = () => session.active() && !conflict && !recovery && committer.canMutate();
  function checkpointHelperPause() {
    if (!('helpers' in game) || !canMutate()) return;
    const next = pauseHelper(game);
    if (next !== game && committer.checkpoint(next)) { game = next; state = museumJourney(next); }
    committer.flush();
  }
  function updatePurchases() {
    if (game.version !== 13) purchaseUi?.update(game, selectedPurchase, activity === 'purchase', !canMutate(), position, !!activity);
    if ('world' in game) {
      mapUi?.update(game, activity === 'map', !canMutate(), !!activity);
      mapUi?.updateCamp(game);
    }
    if ('upgrades' in game) upgradeUi?.update(game, activity === 'upgrades', !canMutate(), !!activity);
    if ('helpers' in game) helperUi?.update(game, activity === 'helper', !canMutate(), !!activity, !!helpers.pose()?.moving);
    if ('custody' in game) storageUi?.update(game, position, activity === 'storage', !canMutate(), !!activity, world.labels().storage);
  }
  function publish(next: PlaySave, cashPickup = false) {
    const celebrate = next.version === 26 && (game.version === 25 || game.version === 26) && room1CompletionTransition(game, next);
    const earned = next.economy.coins - game.economy.coins;
    if (earned < 0) economyUi.clearGain();
    game = next; state = museumJourney(next);
    const nextLayout = museumLayout(game), changed = nextLayout.key !== layout.key;
    layout = nextLayout; world.setMuseumLayout(layout);
    if (state.room === 'museum' && changed) {
      const offer = selectedPurchase ? purchaseDefinition(selectedPurchase) : undefined;
      position = safeMuseumPosition(position, layout, layout.spots.find(spot => spot.id === offer?.exhibit));
      world.placePlayer(position, { x: 0, z: -1 }, false, 0);
    }
    economyUi.balance(game.economy.coins, earned, cashPickup);
    world.updateJourney(state, unavailableFinds());
    ui.update(state, nearDig(state, position), position);
    updatePurchases();
    if (celebrate) roomCompletionUi.show();
  }
  function accept(next: JourneyState, immediate = false, after = () => {}): boolean {
    if (!canMutate()) return false;
    if (next === state) return true;
    const candidate = advanceMuseum(game, next);
    if (candidate === game) return false;
    if (immediate) return committer.commit(candidate, saved => { publish(saved); after(); }) === 'saved';
    if (!committer.checkpoint(candidate)) return false;
    publish(candidate); after(); return true;
  }
  function restore(saved: PlaySave, restored: boolean) {
    roomCompletionUi.hide();
    purchasePayments.reset();
    storedSelection = null;
    let next = museumJourney(saved);
    cleanup = null;
    enteredExhibit = null;
    // Old completed saves may still name the pit room. Never reopen it.
    if (next.room === 'excavation' && isSiteComplete(next)) next = { ...next, room: 'outdoors' };
    state = next; game = { ...saved, room: next.room }; recovery = false;
    if ('visitors' in game) { visitors.reset(game); visitorUi.reset(game); }
    helpers.reset();
    if ('custody' in game) storageUi.reset(game);
    selectedPurchase = null; layout = museumLayout(game); world.setMuseumLayout(layout);
    economyUi.clearGain(); economyUi.balance(game.economy.coins);
    const site = activeSite(next);
    position = { ...(next.room === 'excavation' ? site.interaction
      : next.room === 'outdoors' && completionPhase(next) === 'exit' ? sitePlot(site).entrance
      : next.room === 'outdoors' && isSiteComplete(next) ? siteFront(site) : restored ? ARRIVAL : START) };
    if ('world' in game && restored) position = travelSpawn(game);
    world.changeRoom(state.room, state);
    world.placePlayer(position, { x: 0, z: -1 }, false, 0);
    world.updateJourney(state, unavailableFinds()); hud.setRoom(state.room);
    open(null);
  }
  function load() {
    if (!session.active() || conflict) return;
    const result = loadRoom1Game(storage, randomSeed());
    if (result.kind === 'ready') {
      helperUi?.recovered('unassigned' in result && result.unassigned);
      recovery = false; open(null); committer.enable();
      // Persist fresh seeds/manifests and migration before any play can earn money.
      const candidate = result.save.room === 'excavation' && isSiteComplete(museumJourney(result.save))
        ? { ...result.save, room: 'outdoors' as const } : result.save;
      committer.commit(candidate, saved => {
        restore(saved, result.restored);
        if (result.restored && mvpNeedsRecoveryNotice(candidate)) open('milestone');
      });
    }
    else {
      committer.block();
      recovery = true; open('recovery');
      if (result.kind === 'unavailable') ui.error(t.storageUnavailable);
    }
  }
  function assemble(id: ExhibitId) {
    if (!canMutate() || activity || state.room !== 'museum') return;
    if (!standAvailable(game, id)) { selectPurchase(standOffer(id).id); return; }
    enteredExhibit = id;
    selectedExhibit = id;
    ui.selectExhibit(id);
    if (committer.flush() !== 'failed') open(exhibitComplete(state, id) ? 'story' : 'assembly');
  }
  function selectPurchase(id: string) {
    if (!canMutate() || activity || state.room !== 'museum' || !layout.purchases.some(spot => spot.id === id)) return;
    if (committer.flush() === 'failed') return;
    selectedPurchase = id; open('purchase');
  }
  const ui = createJourneyUi(root, {
    discovery: () => manualFind(),
    cleaningDiscovery: () => cleaningFind(),
    assemble,
    place(group, target) {
      if (!canMutate() || activity !== 'assembly' || document.hidden || !document.hasFocus()) return false;
      if (!(exhibitDefinition(selectedExhibit).parts as readonly string[]).includes(group)) return false;
      const next = placeOwnedGroup(game, selectedExhibit, group, target);
      if (next.placed === state.placed) return false;
      return accept(next, true, () => { if (exhibitComplete(state, selectedExhibit)) open('story'); });
    },
    clean() {
      if (!canMutate() || activity || state.room !== 'excavation' || !manualFind()) return;
      if (committer.flush() !== 'failed') open('cleaning');
    },
    bag() { if (canMutate() && !activity && committer.flush() !== 'failed') open('bag'); },
    close() {
      if (activity === 'reset') open(beforeReset);
      else if (activity === 'cleaning' && storedSelection && canMutate() && committer.flush() !== 'failed') open('storage');
      else if (!recovery && canMutate() && committer.flush() !== 'failed') open(null);
    },
    reset() {
      if (!session.active() || conflict || activity === 'reset') return;
      beforeReset = activity; open('reset');
    },
    confirmReset() {
      if (!session.active() || conflict || activity !== 'reset') return;
      // Recovery may have blocked writes, but an explicit reset is still allowed.
      if (recovery) committer.enable();
      if (committer.reset()) {
        developmentSpeed?.reset(); recovery = false;
        helperUi?.recovered(false);
        committer.commit(createRoom1Game(randomSeed()), saved => restore(saved, false));
      } else ui.error(t.resetFailed);
    },
    retry() { if (!session.active() || conflict) return; if (recovery) load(); else committer.flush(); },
    collect() {
      if (activity !== 'cleaning' || !canMutate() || document.hidden || !document.hasFocus()) return;
      if (storedSelection && 'custody' in game) {
        const next = collectStored(game, storedSelection);
        if (next !== game) committer.commit(next, saved => { publish(saved); open('storage'); });
        return;
      }
      const find = manualFind();
      if (!find) return;
      const next = collectFossil(state, find.id);
      if (next === state) return;
      accept(next, true, () => open(manualFind() ? 'cleaning' : null));
    },
    brush(from, to) {
      if (activity !== 'cleaning' || !canMutate() || document.hidden || !document.hasFocus()) return;
      if (storedSelection && 'custody' in game) {
        const next = brushStored(game, storedSelection, from, to);
        if (next !== game && committer.checkpoint(next)) publish(next);
        return;
      }
      const find = manualFind();
      if (!find) return;
      const next = brush(state, from, to, find.id);
      accept(next);
    },
  });
  const purchaseUi = createPurchaseUi(root, selectPurchase, () => {
    if (!canMutate() || activity !== 'purchase' || game.version === 13 || !selectedPurchase
      || document.hidden || !document.hasFocus()) return;
    const candidate = buyPurchase(game, selectedPurchase);
    if (candidate === game) return;
    committer.commit(candidate, saved => {
      publish(saved);
      enteredExhibit = purchaseDefinition(selectedPurchase!)?.exhibit ?? null;
      open(null);
    });
  });
  function openMap() {
    if (!canMutate() || activity || !('world' in game) || travelBusy(game)) return;
    if (committer.flush() !== 'failed') open('map');
  }
  function travel(destination: WorldLocation) {
    if (!canMutate() || !('world' in game) || document.hidden || !document.hasFocus()) return;
    const candidate = travelTo(game, destination);
    if (candidate === game) return;
    committer.commit(candidate, saved => restore(saved, true));
  }
  const mapUi = createMapUi(root, {
    open: openMap,
    buy(id) {
      if (!canMutate() || activity !== 'map' || !('world' in game) || document.hidden || !document.hasFocus()) return;
      const candidate = buySite(game, id);
      if (candidate !== game) committer.commit(candidate, publish);
    },
    travel(id) { if (activity === 'map') travel(id === null ? { kind: 'hub' } : { kind: 'site-camp', siteId: id }); },
  });
  const helperUi = createHelperUi(root, {
    open() { if (canMutate() && !activity && 'world' in game && !travelBusy(game) && committer.flush() !== 'failed') open('helper'); },
    buy() {
      if (!canMutate() || activity !== 'helper' || !('helpers' in game) || document.hidden || !document.hasFocus()) return;
      const next = buyHelper(game); if (next !== game) committer.commit(next, publish);
    },
    assign(id) {
      if (!canMutate() || activity !== 'helper' || !('helpers' in game) || document.hidden || !document.hasFocus()) return;
      const next = assignHelper(game, id);
      if (next !== game) committer.commit(next, saved => { helpers.reset(); helperUi?.recovered(false); publish(saved); });
    },
  }, helpersEnabled || purchasesEnabled);
  const storageUi = createStorageUi(root, {
    open() {
      if (!canMutate() || activity || !('custody' in game) || !atStorage(game, position) || travelBusy(game)) return;
      if (committer.flush() !== 'failed') open('storage');
    },
    select(id) {
      if (!canMutate() || activity !== 'storage' || !('custody' in game) || !canCleanStored(game, id) || document.hidden || !document.hasFocus()) return;
      if (committer.flush() === 'failed') return;
      storedSelection = id; open('cleaning');
    },
  });
  const upgradeUi = createUpgradeUi(root, {
    open() {
      if (canMutate() && !activity && 'upgrades' in game && game.room === 'museum' && committer.flush() !== 'failed') open('upgrades');
    },
    buy(id) {
      if (!canMutate() || activity !== 'upgrades' || !('upgrades' in game) || document.hidden || !document.hasFocus()) return;
      const next = buyUpgrade(game, id); if (next !== game) committer.commit(next, publish);
    },
  });
  const committer = createCommitter<PlaySave>(storage, status => {
    saveFailed = status === 'failed'; ui.saveStatus(status);
    if (saveFailed) { purchasePayments.reset(); keyboard.clear(); swing = null; world.animateDig(null); }
  });
  const economyUi = createEconomyUi(root, () => { if (conflict) window.location.reload(); else session.acquire(); });
  const visitorUi = createVisitorUi(root);
  if (!purchasesEnabled) root.querySelector('.purchase-qa')?.remove();
  const session = createSaveSession(navigator.locks, status => {
    economyUi.session(status === 'active' ? null : status === 'waiting' ? economyText.waiting : economyText.unavailable);
    if (status === 'active') load();
    else { committer.block(); keyboard.clear(); }
  }, helpersEnabled ? HELPER_QA_LOCK : purchasesEnabled ? PURCHASE_QA_LOCK : WRITER_LOCK);
  const developmentSpeed = import.meta.env.DEV
    ? createDevelopmentSpeed(root, speed => { gameSpeed = speed; keyboard.clear(); }) : null;
  hud.setRoom(state.room);
  session.acquire();
  function suspend() { purchasePayments.reset(); keyboard.clear(); swing = null; world.animateDig(null); checkpointHelperPause(); committer.flush(); }
  function depositInterrupted() {
    if (!('custody' in game) || !canMutate()) return;
    const next = settleDeliveries(game); if (next !== game) committer.commit(next, publish);
  }
  function pagehide() { suspend(); depositInterrupted(); committer.block(); session.release(); }
  function pageshow() { if (!conflict) session.acquire(); }
  function externalSave(event: StorageEvent) {
    if (event.storageArea !== window.localStorage || (event.key !== storageKey && event.key !== null)) return;
    if (!session.active()) return;
    conflict = true; keyboard.clear(); swing = null; committer.block();
    economyUi.session(economyText.conflict);
  }
  window.addEventListener('blur', suspend);
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', pageshow);
  window.addEventListener('storage', externalSave);
  document.addEventListener('visibilitychange', suspend);
  let wasDigging = false;
  const stepSimulation = (seconds: number) => {
    let digging = false;
    if (!activity && canMutate() && !document.hidden && document.hasFocus()) {
      const phase = completionPhase(state);
      if (phase === 'cleanup' || phase === 'exit') {
        keyboard.clear(); swing = null; world.animateDig(null);
        const step = stepCompletion(state, position, seconds, cleanup, !saveFailed);
        const roomChanged = step.state.room !== state.room;
        const finish = () => {
          cleanup = step.pop;
          const moved = Math.hypot(step.position.x - position.x, step.position.z - position.z) > 0.0001;
          position = step.position;
          if (roomChanged) { world.changeRoom(state.room, state); hud.setRoom(state.room); }
          world.placePlayer(position, step.direction, moved, seconds); world.animateCleanup(cleanup);
        };
        if (step.state === state) finish(); else accept(step.state, true, finish);
      } else {
      const direction = keyboard.direction(state.room);
      const next = movePlayer(position, direction, seconds, state.room,
        state.room === 'museum' ? layout.obstacles : state.room === 'excavation' ? digObstacles(state)
          : 'world' in game ? campObstacles(state.activeSiteId) : undefined,
        state.room === 'museum' ? layout.bounds : undefined, WALK_SPEED * playerWalkRate(game));
      const moving = Math.hypot(next.x - position.x, next.z - position.z) > 0.0001;
      const previous = position;
      position = next;
      if ('pendingTicketRevenue' in game) {
        const collected = collectNearbyTicketRevenue(game, position, previous);
        if (collected !== game) committer.commit(collected, saved => publish(saved, true));
      }
      const plot = state.room === 'outdoors' ? SITE_PLOTS.find(plot => siteAvailability(state, plot.number) === 'open'
        && (!('world' in game) || plot.id === state.activeSiteId)
        && Math.hypot(position.x - plot.entrance.x, position.z - plot.entrance.z) <= 0.62) : undefined;
      const entry = sitePlot(activeSite(state)).entrance;
      const destination = destinationAt(position, state.room)
        ?? (plot ? 'excavation' : null);
      if (destination) {
        swing = null;
        keyboard.clear();
        if ('world' in game) {
          if (destination === 'excavation') travel({ kind: 'site-pit', siteId: plot!.id });
          else if (state.room === 'excavation') travel({ kind: 'site-camp', siteId: state.activeSiteId });
          else {
            // Opening the map from the sign must not retrigger on close.
            position = { ...ARRIVAL }; world.placePlayer(position, { x: 0, z: -1 }, false, 0); openMap();
          }
        } else {
        const nextState = { ...state, room: destination, activeSiteId: destination === 'excavation' ? plot!.id : state.activeSiteId };
        const arrival = destination === 'excavation' ? { ...activeSite(nextState).interaction }
          : state.room === 'excavation' ? { x: entry.x, z: entry.z - 1.15 } : { ...ARRIVAL };
        accept(nextState, true, () => {
          position = arrival; world.changeRoom(destination, state);
          world.placePlayer(position, { x: 0, z: -1 }, false, 0); hud.setRoom(destination);
        });
        }
      } else {
        world.placePlayer(position, direction, moving, seconds);
        const uncoveredBefore = manualFind()?.id;
        const step = stepDigging(state, position, seconds, swing, !moving && !direction.x && !direction.z, activeSite(state), playerDigRate(game));
        swing = step.swing;
        digging = !!swing;
        world.animateDig(swing);
        accept(step.state, step.hit, () => {
          if (manualFind()?.id && uncoveredBefore !== manualFind()?.id) open('cleaning');
        });
      }
      }
    } else {
      swing = null;
      world.animateDig(null);
    }
    if ('payments' in game) {
      const candidate = purchasePayments.step(game, position, seconds, !activity && canMutate() && !document.hidden && document.hasFocus());
      if (candidate !== game) {
        const built = candidate.museum.owned.find(item => !game || game.version === 13 || !game.museum.owned.some(old => old.id === item.id));
        committer.commit(candidate, saved => {
          publish(saved);
          if (built) {
            // Construction should not immediately interrupt the countdown with assembly.
            enteredExhibit = purchaseDefinition(built.id)?.exhibit ?? null;
            purchaseUi.completed();
          }
        });
      }
    }
    const atExhibit = state.room === 'museum' ? layout.spots.find(spot => Math.hypot(position.x - spot.x, position.z - spot.z) <= EXHIBIT_MARKER_RADIUS) : undefined;
    if (!atExhibit) enteredExhibit = null;
    else if (!exhibitComplete(state, atExhibit.id) && enteredExhibit !== atExhibit.id
      && !document.hidden && document.hasFocus()) assemble(atExhibit.id);
    ui.offerStory(!activity && canMutate() && atExhibit && exhibitComplete(state, atExhibit.id) ? atExhibit.id : null);
    if ('visitors' in game && !activity && canMutate() && !document.hidden && document.hasFocus() && state.room === 'museum') {
      const next = visitors.step(game, position, seconds);
      if (next !== game) committer.commit(next, publish);
      world.updateVisitors(visitors.poses(), seconds);
    }
    // Player commands run first. A changed target invalidates private helper
    // work before the helper can clear or settle a reward for that soil.
    if ('helpers' in game) {
      const enabled = !activity && canMutate() && !document.hidden && document.hasFocus();
      if (canMutate()) {
        const next = helpers.step(game, seconds, enabled);
        if (next !== game) {
          const oldTask = game.helpers.owned[0]?.task, newTask = next.helpers.owned[0]?.task;
          if (next.dig !== game.dig || oldTask?.id !== newTask?.id || 'custody' in next && 'custody' in game && next.custody !== game.custody) committer.commit(next, publish);
          else if (committer.checkpoint(next)) { game = next; state = museumJourney(next); }
        }
      }
      const pose = helpers.pose();
      if (pose && 'custody' in game) pose.carrying = carriedFinds(game).length > 0;
      world.updateHelper(enabled ? pose : pose ? { ...pose, moving: false, swing: null } : null, state, enabled ? seconds : 0);
    }
    if (wasDigging && !digging && !saveFailed) committer.flush();
    wasDigging = digging;
  };
  const frame = () => {
    advanceSimulation(world.engine.getDeltaTime() / 1000, gameSpeed, stepSimulation);
    ui.update(state, nearDig(state, position), position);
    updatePurchases();
    const needsStand = ROOM1_EXHIBITS.some(exhibit => !standAvailable(game, exhibit.id)
      && exhibit.parts.some(part => !state.placed.includes(part)));
    if (game.version !== 13 && state.room === 'museum' && !activity && layout.purchases.length && needsStand) {
      root.querySelector('#room-hint')!.textContent = purchaseText.hint;
    }
    if ((game.version === 25 || game.version === 26) && state.room === 'museum' && !activity)
      root.querySelector('#room-hint')!.textContent = mvpProgressHint(game);
    if ('pendingTicketRevenue' in game) world.updatePendingCash(game.pendingTicketRevenue);
    world.render();
    const labels = world.labels();
    if ('custody' in game) storageUi.update(game, position, activity === 'storage', !canMutate(), !!activity, labels.storage);
    if ('visitors' in game) {
      world.updateVisitors(visitors.poses(), 0);
      visitorUi.update(game, position, !!activity || !canMutate(), labels.cashier ? { x: labels.cashier.x, z: labels.cashier.y } : null,
        labels.entrance ? { x: labels.entrance.x, z: labels.entrance.y } : null,
        labels.cash ? { x: labels.cash.x, z: labels.cash.y } : null);
    }
    hud.placeLabels(labels); ui.placeSites(labels.sites);
    purchaseUi?.place(labels.purchases, !canMutate() || !!activity);
  };
  world.engine.runRenderLoop(frame);
  return () => {
    checkpointHelperPause(); depositInterrupted(); committer.flush(); committer.dispose(); session.dispose(); keyboard.dispose(); purchaseUi?.dispose(); mapUi?.dispose(); helperUi?.dispose(); storageUi.dispose(); upgradeUi.dispose(); visitorUi.dispose(); roomCompletionUi.dispose(); ui.dispose(); economyUi.dispose();
    window.removeEventListener('blur', suspend); window.removeEventListener('pagehide', pagehide);
    window.removeEventListener('pageshow', pageshow); window.removeEventListener('storage', externalSave);
    document.removeEventListener('visibilitychange', suspend);
    world.engine.stopRenderLoop(frame);
    world.dispose();
    root.replaceChildren();
  };
}
