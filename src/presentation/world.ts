import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { shapes } from './shapes';
import { buildAssembledExhibit } from './assembled-exhibit';
import { buildExcavation } from './excavation';
import { buildDiscovery } from './discovery';
import { buildDigAnimation } from './dig-animation';
import { buildOutdoors } from './outdoors';
import { buildSlabExhibit } from './slab-exhibit';
import { buildMuseumExterior } from './museum-exterior';
import { DEPTH_COLORS, SITE_PLOTS, SITE, activeSite } from '../content/journey';
import type { DigSwing, JourneyState } from '../game/journey';
import { tutorialDismissed } from '../game/assembly';
import { groundHeight } from '../game/journey';
import type { CleanupPop } from '../game/site-completion';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ARRIVAL, BENCH, EXHIBIT_MARKER_RADIUS, PLANTS, PORTAL, PORTAL_RADIUS, START } from '../game/navigation';
import { museumLayout } from '../game/museum-layout';
import type { MuseumLayout } from '../game/museum-layout';
import type { Point, RoomId } from '../game/navigation';
import { cameraOffset } from '../content/view';
import { buildCashier, buildVisitors } from './visitors';
import type { VisitorPose } from '../game/visitor-simulation';
import { CASHIER, VISITOR_ENTRANCE } from '../content/visitors';
import { atCashier } from '../game/visitors';
import { buildHelper } from './helper';
import type { HelperPose } from '../game/helper-simulation';
import { buildStorageBox } from './storage';
import { storageAnchor } from '../content/storage';

export function createWorld(canvas: HTMLCanvasElement, separateCamps = false, helpersEnabled = false) {
  const engine = new Engine(canvas, true, { stencil: true });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  let scene: Scene;
  let camera: FreeCamera;
  let player: TransformNode;
  let playerBody: TransformNode;
  let legs: TransformNode[] = [];
  let walkingTime = 0;
  let currentRoom: RoomId = 'museum';
  let updateDiscovery: ReturnType<typeof buildDiscovery> | undefined;
  let updateOutdoors: ReturnType<typeof buildOutdoors> | undefined;
  let animateDig: ReturnType<typeof buildDigAnimation> | undefined;
  let journey: JourneyState | undefined;
  let updateAssembled: ((state: JourneyState) => void)[] = [];
  let updateSlab: ReturnType<typeof buildSlabExhibit> | undefined;
  let tutorialArrow: Mesh | undefined;
  let layout = museumLayout();
  let updateVisitors: ReturnType<typeof buildVisitors> | undefined;
  let updateTicketIncome: ReturnType<typeof buildCashier> | undefined;
  let updateHelper: ReturnType<typeof buildHelper> | undefined;
  let unavailableFinds: readonly string[] = [];

  function buildRoom(room: RoomId) {
    scene?.dispose();
    currentRoom = room;
    updateDiscovery = undefined;
    updateAssembled = [];
    updateSlab = undefined;
    updateOutdoors = undefined;
    updateVisitors = undefined;
    updateTicketIncome = undefined;
    updateHelper = undefined;
    animateDig = undefined;
    scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString('#e4eee9ff');
    scene.ambientColor = new Color3(0.13, 0.11, 0.08);
    const view = cameraOffset(room);
    camera = new FreeCamera('fixed-camera', new Vector3(view.x, view.y, view.z), scene);
    const centerX = room === 'museum' ? layout.floor.x : 0;
    const centerZ = room === 'museum' ? -2.8 : 0;
    camera.position.x += centerX;
    camera.position.z += centerZ;
    camera.setTarget(new Vector3(centerX, 0, centerZ));
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.minZ = 0.1;
    camera.maxZ = 100;
    camera.inputs.clear();

    const fill = new HemisphericLight('sky-light', new Vector3(0, 1, 0), scene);
    // Shared daylight keeps both rooms in the same world.
    fill.intensity = 0.76;
    fill.diffuse = Color3.FromHexString('#f1f8ff');
    fill.groundColor = Color3.FromHexString('#e0e5db');
    fill.specular = Color3.Black();
    const sun = new DirectionalLight('afternoon-sun', new Vector3(-0.7, -1.6, 0.7), scene);
    sun.position.set(8, 15, -9);
    sun.intensity = 0.48;
    sun.diffuse = Color3.FromHexString('#fff8e9');
    const shadows = new ShadowGenerator(2048, sun);
    shadows.useBlurExponentialShadowMap = true;
    // Preserve soft contact shadows around thin bones; broad fill keeps them readable.
    shadows.blurKernel = 16;
    shadows.normalBias = 0.015;
    shadows.bias = 0.0005;
    shadows.setDarkness(0.12);
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_HIGH;
    sun.autoCalcShadowZBounds = true;

    function material(name: string, hex: string, sheen = 0.04, power = 32) {
      const result = new StandardMaterial(name, scene);
      result.diffuseColor = Color3.FromHexString(hex);
      result.specularColor.set(sheen, sheen, sheen);
      result.specularPower = power;
      return result;
    }
    const cream = material('plaster', '#fff9e9');
    const grout = material('tile-grout', '#d2cfba');
    const tiles = ['#d5d5c6', '#dcdbcd', '#d1d1c1', '#d9d8c8'].map((hex, i) => material(`tile-${i}`, hex, 0.12, 48));
    const teal = material('painted-teal', '#379c94', 0.2, 48);
    const tealDark = material('teal-base', '#286c67', 0.1);
    const brass = material('soft-brass', '#d4ad64', 0.32, 64);
    const wood = material('warm-oak', '#c99560', 0.08);
    const dark = material('fossil-recess', '#515e55');
    const rim = material('pale-limestone', '#e9e7cf', 0.12, 48);
    const panel = material('panel-sage', '#9ebbb0');
    const bone = material('fossil-ivory', '#f5edd5');
    const greens = ['#639554', '#82ad63', '#a0bd74'].map((hex, i) => material(`leaf-${i}`, hex));
    const terracotta = material('terracotta', '#c18b66');
    const markerMaterial = material('travel-marker', '#449b80');
    markerMaterial.emissiveColor.set(0.09, 0.18, 0.1);
    const shape = shapes(scene, mesh => {
      if (!mesh.name.startsWith('floor')) shadows.addShadowCaster(mesh);
    });

    if (room === 'museum') {
      buildMuseumExterior(shape, material, layout.floor);
      if (layout.cashier) { updateTicketIncome = buildCashier(shape, material); updateVisitors = buildVisitors(scene, shape, material); }
      const { width, depth, x: centerX } = layout.floor;
      const left = centerX - width / 2;
      shape.box('floor-foundation', [width + 0.3, 0.35, depth + 0.3], [centerX, -0.22, 0], tealDark);
      shape.box('floor-grout', [width, 0.08, depth], [centerX, -0.035, 0], grout);
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          shape.box('floor-tile', [0.978, 0.035, 0.978], [x + left + 0.5, 0.018, z - depth / 2 + 0.5], tiles[(x * 3 + z * 7) % tiles.length]);
        }
      }
      // Only the far walls are tall, leaving the player's route visible.
      shape.box('back-wall', [width + 0.3, 2.3, 0.25], [centerX, 1.1, 6.05], cream);
      shape.box('side-wall', [0.25, 2.3, depth + 0.3], [left - 0.05, 1.1, 0], cream);
      shape.box('back-skirting', [width, 0.4, 0.13], [centerX, 0.2, 5.85], teal);
      shape.box('side-skirting', [0.13, 0.4, 12], [left + 0.15, 0.2, 0], teal);
      shape.box('back-trim', [width, 0.05, 0.18], [centerX, 0.43, 5.85], brass);
      shape.box('side-trim', [0.18, 0.05, 12], [left + 0.15, 0.43, 0], brass);
      shape.beveledBox('back-wall-cap', [width + 0.3, 0.14, 0.3], [centerX, 2.24, 6.05], rim);
      shape.beveledBox('side-wall-cap', [0.3, 0.14, 12.3], [left - 0.05, 2.24, 0], rim);
      for (const [index, x] of [-14.9, -10.8, -6.7, -2.6, 1.5].entries()) {
        if (x - 1.35 < left) continue;
        shape.beveledBox('wall-panel', [2.7, 1.12, 0.1], [x, 1.35, 5.88], rim);
        shape.box('panel-inset', [2.48, 0.9, 0.04], [x, 1.35, 5.81], panel);
        // Decorative shell/leaf motifs, not labeled specimens or extra exhibits.
        if (index === 1) {
          const spiral: [number, number, number][] = [];
          for (let i = 0; i <= 48; i++) {
            const angle = i / 48 * Math.PI * 4.5;
            const radius = 0.025 + i / 48 * 0.32;
            spiral.push([x + Math.cos(angle) * radius, 1.35 + Math.sin(angle) * radius, 5.765]);
          }
          shape.tube('shell-relief', spiral, 0.04, rim);
        } else {
          shape.tube('leaf-relief-stem', [[x - 0.65, 1.09, 5.765], [x + 0.65, 1.63, 5.765]], 0.035, rim);
          for (let i = 0; i < 5; i++) {
            const dx = -0.43 + i * 0.21;
            const y = 1.18 + i * 0.085;
            for (const side of [-1, 1]) {
              shape.tube('leaf-relief', [[x + dx, y, 5.765], [x + dx - 0.13, y + side * 0.18, 5.765]], 0.04, rim);
            }
          }
        }
      }

      updateAssembled = layout.assembled.map(stand => buildAssembledExhibit(scene, shape, material, stand));
      if (layout.slab) updateSlab = buildSlabExhibit(scene, shape, material);
      const purchaseGold = material('purchase-gold', '#e4b52b', 0.18);
      for (const spot of layout.purchases) {
        // An octagonal token distinguishes buying from round assembly markers.
        const token = MeshBuilder.CreateTorus(`purchase-marker-${spot.id}`, { diameter: 1.45, thickness: 0.12, tessellation: 8 }, scene);
        token.position.set(spot.x, 0.075, spot.z); token.material = purchaseGold; token.isPickable = false;
        const coin = shape.cylinder(`purchase-coin-${spot.id}`, 0.12, 0.6, 0.6, [spot.x, 0.65, spot.z], purchaseGold);
        coin.rotation.x = Math.PI / 2;
        shape.box('purchase-plus', [0.3, 0.07, 0.03], [spot.x, 0.65, spot.z - 0.08], cream);
        shape.box('purchase-plus', [0.07, 0.3, 0.03], [spot.x, 0.65, spot.z - 0.08], cream);
      }

      shape.box('bench-underframe', [BENCH.width - 0.16, 0.12, BENCH.depth - 0.1], [BENCH.x, 0.47, BENCH.z], tealDark);
      for (let i = 0; i < 3; i++) {
        shape.beveledBox('bench-slat', [BENCH.width, 0.15, BENCH.depth / 3 - 0.025], [BENCH.x, 0.56, BENCH.z + (i - 1) * BENCH.depth / 3], wood);
      }
      for (const side of [-1, 1]) {
        shape.box('bench-leg', [0.15, 0.5, 0.55], [BENCH.x + side * 0.85, 0.26, BENCH.z], tealDark);
      }
      for (const plant of PLANTS) {
        shape.cylinder('plant-pot', 0.6, 0.65, 0.9, [plant.x, 0.34, plant.z], terracotta);
        shape.cylinder('pot-rim', 0.12, 0.91, 0.94, [plant.x, 0.61, plant.z], rim);
        shape.cylinder('pot-soil', 0.05, 0.77, 0.77, [plant.x, 0.65, plant.z], dark);
        for (let i = 0; i < 5; i++) {
          const angle = i * Math.PI * 2 / 5;
          const leaf = MeshBuilder.CreateSphere('leaf', { diameterX: 0.24, diameterY: 0.95, diameterZ: 0.4, segments: 3 }, scene);
          leaf.position.set(plant.x + Math.cos(angle) * 0.23, 1.04, plant.z + Math.sin(angle) * 0.23);
          leaf.material = greens[i % greens.length];
          leaf.isPickable = false;
          leaf.receiveShadows = true;
          leaf.convertToFlatShadedMesh();
          shadows.addShadowCaster(leaf);
          leaf.rotation.z = -Math.cos(angle) * 0.42;
          leaf.rotation.x = Math.sin(angle) * 0.42;
        }
      }
    } else if (room === 'outdoors') {
      updateOutdoors = buildOutdoors(shape, material, { cream, teal, tealDark, brass, wood }, separateCamps ? journey?.activeSiteId : undefined);
    } else {
      const site = journey ? activeSite(journey) : SITE;
      buildExcavation(shape, material, { cream, rim, teal, tealDark, brass, wood, grout }, site);
      updateDiscovery = buildDiscovery(shape, bone, DEPTH_COLORS.map((hex, i) => material(`dig-soil-${i}`, hex, 0)), site);
      if (helpersEnabled) updateHelper = buildHelper(scene, shape, material);
    }

    if (helpersEnabled && room !== 'museum' && journey) buildStorageBox(shape, material, journey);
    const doorZ = 5.38;
    shape.box('door-shadow', [2.2, 2.3, 0.1], [PORTAL.x, 1.2, doorZ + 0.13], tealDark);
    for (const side of [-1, 1]) {
      shape.box('door-post', [0.22, 2.55, 0.3], [PORTAL.x + side * 1.18, 1.27, doorZ], wood);
    }
    shape.box('door-lintel', [2.58, 0.25, 0.35], [PORTAL.x, 2.58, doorZ], wood);
    shape.box('door-threshold', [2.35, 0.06, 0.6], [PORTAL.x, 0.07, doorZ - 0.18], brass);
    const ring = MeshBuilder.CreateTorus('travel-ring', { diameter: PORTAL_RADIUS * 2, thickness: 0.09, tessellation: 64 }, scene);
    ring.position.set(PORTAL.x, 0.075, PORTAL.z);
    ring.material = markerMaterial;
    ring.isPickable = false;
    tutorialArrow = shape.tube('travel-arrow', [[PORTAL.x - 0.24, 0.08, PORTAL.z - 0.1], [PORTAL.x, 0.08, PORTAL.z + 0.17], [PORTAL.x + 0.24, 0.08, PORTAL.z - 0.1]], 0.045, markerMaterial);

    player = new TransformNode('player', scene);
    playerBody = new TransformNode('player-body', scene);
    playerBody.parent = player;
    const skin = material('skin', '#efbd86');
    const shirt = material('explorer-jacket', '#dca443');
    const trousers = material('trousers', '#365c62');
    const shoes = material('shoes', '#544c40');
    const character = shapes(scene, mesh => { mesh.parent = playerBody; shadows.addShadowCaster(mesh); });
    character.ball('jacket', [0.55, 0.62, 0.39], [0, 0.82, 0], shirt);
    character.ball('head', [0.43, 0.46, 0.43], [0, 1.34, 0], skin);
    character.cylinder('hat-brim', 0.075, 0.66, 0.66, [0, 1.54, 0], brass);
    character.cylinder('hat-crown', 0.2, 0.43, 0.36, [0, 1.66, 0], shirt);
    character.box('backpack', [0.38, 0.4, 0.18], [0, 0.87, -0.24], terracotta);
    legs = [];
    const restingArms: Mesh[] = [];
    for (const side of [-1, 1]) {
      restingArms.push(character.ball('arm', [0.19, 0.48, 0.22], [side * 0.32, 0.8, 0], shirt));
      restingArms.push(character.ball('hand', [0.17, 0.19, 0.18], [side * 0.32, 0.56, 0.01], skin));
      const leg = new TransformNode('leg', scene);
      leg.parent = playerBody;
      leg.position.set(side * 0.15, 0.47, 0);
      const shin = character.ball('trouser-leg', [0.22, 0.4, 0.24], [0, -0.15, 0], trousers);
      shin.parent = leg;
      const shoe = character.ball('shoe', [0.23, 0.16, 0.34], [0, -0.36, 0.06], shoes);
      shoe.parent = leg;
      legs.push(leg);
    }
    const torso = new TransformNode('player-torso', scene);
    torso.parent = playerBody; torso.position.y = 0.65;
    // Lean from the hips without moving the legs or planted feet.
    for (const mesh of playerBody.getChildMeshes(true)) { mesh.parent = torso; mesh.position.y -= 0.65; }
    if (room === 'excavation') animateDig = buildDigAnimation(scene, shape, player, playerBody, torso, restingArms,
      { wood, metal: material('shovel-steel', '#82a6a9', 0.24), skin, shirt, soil: material('loose-earth', DEPTH_COLORS[0], 0) });
    const halo = MeshBuilder.CreateTorus('player-outline', { diameter: 0.82, thickness: 0.035, tessellation: 48 }, scene);
    halo.parent = player;
    halo.position.y = 0.07;
    halo.material = brass;
    halo.isPickable = false;
    walkingTime = 0;
    resize();
  }

  function resize() {
    engine.resize();
    if (!camera) return;
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const halfHeight = currentRoom === 'museum' ? Math.max(layout.camera.halfHeight, layout.camera.halfWidth / aspect) : Math.max(8.3, 11.5 / aspect);
    camera.orthoTop = halfHeight;
    camera.orthoBottom = -halfHeight;
    camera.orthoLeft = -halfHeight * aspect;
    camera.orthoRight = halfHeight * aspect;
  }

  function placePlayer(position: Point, direction: Point, moving: boolean, seconds: number) {
    const height = 0.04 + (currentRoom === 'excavation' && journey ? groundHeight(journey, position) : 0);
    const y = seconds > 0 ? Math.max(height, player.position.y - seconds * 3.5) : height;
    player.position.set(position.x, y, position.z);
    if (moving) {
      playerBody.rotation.y = Math.atan2(direction.x, direction.z);
      walkingTime += seconds * 10;
    } else if (currentRoom === 'museum' && layout.cashier && atCashier(position)) {
      playerBody.rotation.y = Math.atan2(CASHIER.x - position.x, CASHIER.z - position.z);
    }
    playerBody.position.y = moving ? Math.abs(Math.sin(walkingTime)) * 0.035 : 0;
    legs.forEach((leg, index) => { leg.rotation.x = moving ? Math.sin(walkingTime + index * Math.PI) * 0.4 : 0; });
  }

  function project(position: Vector3) {
    const point = Vector3.Project(position, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(canvas.clientWidth, canvas.clientHeight));
    return { x: point.x, y: point.y };
  }

  buildRoom('museum');
  placePlayer(START, { x: 0, z: -1 }, false, 0);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  return {
    engine,
    setMuseumLayout(next: MuseumLayout) {
      const changed = next.key !== layout.key; layout = next;
      if (changed && currentRoom === 'museum') buildRoom(currentRoom);
    },
    render: () => scene.render(),
    updateVisitors: (poses: VisitorPose[], seconds: number) => updateVisitors?.(poses, seconds),
    updateTicketIncome: (income: number) => updateTicketIncome?.(income),
    updateHelper: (pose: HelperPose | null, state: JourneyState, seconds: number) => updateHelper?.(pose, state, seconds),
    placePlayer,
    animateDig: (swing: DigSwing | null) => animateDig?.(swing, journey),
    animateCleanup: (pop: CleanupPop | null) => { if (journey) updateDiscovery?.(journey, pop, unavailableFinds); },
    updateJourney: (state: JourneyState, unavailable: readonly string[] = []) => { journey = state; unavailableFinds = unavailable; updateDiscovery?.(state, null, unavailable); updateOutdoors?.(state); updateAssembled.forEach(update => update(state)); updateSlab?.(state); tutorialArrow?.setEnabled(!tutorialDismissed(state)); },
    changeRoom: (room: RoomId, state?: JourneyState) => {
      if (state) journey = state;
      buildRoom(room);
      placePlayer(ARRIVAL, { x: 0, z: -1 }, false, 0);
    },
    labels: () => ({
      storage: helpersEnabled && journey && currentRoom !== 'museum' ? project(new Vector3(storageAnchor(journey).x, 1.45, storageAnchor(journey).z)) : null,
      cashier: currentRoom === 'museum' && layout.cashier ? project(new Vector3(CASHIER.x - 0.6, 1.65, CASHIER.z - 0.4)) : null,
      entrance: currentRoom === 'museum' && layout.cashier ? project(new Vector3(VISITOR_ENTRANCE.x, 2.65, VISITOR_ENTRANCE.z)) : null,
      portal: project(new Vector3(PORTAL.x, 2.95, 5.38)),
      exhibits: currentRoom === 'museum' ? layout.spots.map(spot => {
        const points = Array.from({ length: 32 }, (_, i) => {
          const angle = i * Math.PI / 16, radius = EXHIBIT_MARKER_RADIUS + 0.045;
          return project(new Vector3(spot.x + Math.cos(angle) * radius, 0.075, spot.z + Math.sin(angle) * radius));
        });
        const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
        return { id: spot.id, x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
      }) : [],
      sites: currentRoom === 'outdoors' ? SITE_PLOTS.filter(plot => !separateCamps || plot.id === journey?.activeSiteId).map(plot => ({ id: plot.id, point: project(new Vector3(plot.x, plot.playable ? 1.95 : 0.9, plot.z)) })) : [],
      purchases: currentRoom === 'museum' ? layout.purchases.map(spot => ({ id: spot.id, point: project(new Vector3(spot.x, 1.15, spot.z)) })) : [],
    }),
    dispose: () => { observer.disconnect(); scene.dispose(); engine.dispose(); },
  };
}
