import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { SKELETONS } from './skeletons';
import type { SkeletonId } from './skeletons';
import { shapes } from './shapes';
import type { JourneyState } from '../game/journey';

// A close view of the actual exhibit geometry, not a second skeleton drawing.
export function createAssemblyPreview(canvas: HTMLCanvasElement, markers: HTMLElement[], id: SkeletonId) {
  const recipe = SKELETONS[id];
  const engine = new Engine(canvas, true);
  engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 2));
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString('#dce6d8ff');
  const camera = new FreeCamera('assembly-camera', new Vector3(0.1, 3.7, -9), scene);
  camera.setTarget(new Vector3(0, 2, 0));
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA; camera.inputs.clear();
  const fill = new HemisphericLight('assembly-fill', new Vector3(0, 1, 0), scene); fill.intensity = 0.78;
  fill.groundColor = Color3.FromHexString('#9eae9d'); fill.specular = Color3.Black();
  const key = new DirectionalLight('assembly-key', new Vector3(-0.5, -1, 0.8), scene); key.intensity = 0.28;
  const material = (name: string, color: string) => {
    const mat = new StandardMaterial(name, scene); mat.diffuseColor = Color3.FromHexString(color);
    mat.specularColor = Color3.Black(); return mat;
  };
  const bone = material('assembly-ivory', '#ead9af'), dark = material('assembly-recess', '#53665a');
  const mount = material('assembly-mount', '#52776c');
  const ghost = material('assembly-guide', '#6e8f84'); ghost.alpha = 0.17; ghost.disableDepthWrite = true;
  const selectedGhost = material('assembly-selected-guide', '#d8a43e'); selectedGhost.alpha = 0.55;
  const shape = shapes(scene, () => {});
  shape.beveledBox('assembly-base', [6.9, 0.09, 2.9], [0, 0.84, 0], mount);
  const fossil = recipe.build(shape, bone, dark, mount, 0, 0);
  const groups = Object.entries(fossil.groups).map(([id, meshes]) => {
    const root = new TransformNode(`assembly-${id}`, scene);
    const materials = new Map<StandardMaterial, StandardMaterial>();
    const originals = meshes.map(mesh => {
      mesh.parent = root;
      const original = mesh.material as StandardMaterial;
      if (!materials.has(original)) materials.set(original, original.clone(`${original.name}-${id}`));
      return materials.get(original)!;
    });
    return { id, meshes, originals, root, elapsed: 1 };
  });
  let placed = new Set<string>(), selected: string | null = null, visible = false;
  function appearance() {
    for (const group of groups) group.meshes.forEach((mesh, i) => {
      mesh.material = placed.has(group.id) ? group.originals[i] : selected === group.id ? selectedGhost : ghost;
    });
  }
  function resize() {
    if (!visible || !canvas.clientWidth || !canvas.clientHeight) return;
    engine.resize();
    const aspect = canvas.clientWidth / canvas.clientHeight, halfHeight = Math.max(1.85, 3.65 / aspect);
    camera.orthoTop = halfHeight; camera.orthoBottom = -halfHeight;
    camera.orthoLeft = -halfHeight * aspect; camera.orthoRight = halfHeight * aspect;
    scene.render();
    for (const marker of markers) {
      const anchor = recipe.anchors[marker.dataset.target!];
      const p = Vector3.Project(new Vector3(...anchor), Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(canvas.clientWidth, canvas.clientHeight));
      marker.style.left = `${p.x}px`; marker.style.top = `${p.y}px`;
    }
  }
  function render() {
    if (document.hidden) return;
    for (const group of groups) {
      group.elapsed = Math.min(1, group.elapsed + Math.min(engine.getDeltaTime() / 1000, 0.05) / 0.55);
      const remaining = 1 - group.elapsed;
      group.root.position.y = remaining * remaining * 0.28;
      for (const mat of group.originals) mat.emissiveColor.set(remaining * 0.32, remaining * 0.22, remaining * 0.04);
    }
    scene.render();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  return {
    show(next: boolean) {
      visible = next;
      if (next) { resize(); engine.runRenderLoop(render); }
      else { engine.stopRenderLoop(render); for (const group of groups) { group.elapsed = 1; group.root.position.y = 0; } }
    },
    update(state: JourneyState, animate = false) {
      for (const group of groups) if (animate && !placed.has(group.id) && state.placed.includes(group.id)) group.elapsed = 0;
      placed = new Set(state.placed); appearance();
    },
    select(id: string | null) { selected = id; appearance(); },
    dispose() { observer.disconnect(); engine.stopRenderLoop(render); scene.dispose(); engine.dispose(); },
  };
}
