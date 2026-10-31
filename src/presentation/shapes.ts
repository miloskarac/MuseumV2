import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';

export type XYZ = [number, number, number];

export function shapes(scene: Scene, onMesh: (mesh: Mesh) => void) {
  function finish(mesh: Mesh, position: XYZ, material: Material) {
    mesh.position.set(...position);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    onMesh(mesh);
    return mesh;
  }
  return {
    // Solid low-poly plate. Outlines are authored convex facets, so a fan is exact.
    facet: (name: string, outline: [number, number][], thickness: number, position: XYZ, material: Material,
      elevation: (x: number, z: number) => number = () => 0) => {
      const positions: number[] = [], indices: number[] = [];
      const n = outline.length;
      const area = outline.reduce((sum, p, i) => {
        const q = outline[(i + 1) % n]; return sum + p[0] * q[1] - q[0] * p[1];
      }, 0);
      const points = area > 0 ? outline : [...outline].reverse();
      for (const y of [0, thickness]) for (const [x, z] of points) positions.push(x, y + elevation(x, z), z);
      for (let i = 1; i < n - 1; i++) indices.push(0, i, i + 1, n, n + i + 1, n + i);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        indices.push(i, n + i, j, j, n + i, n + j);
      }
      const data = new VertexData(), normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      data.positions = positions; data.indices = indices; data.normals = normals;
      const mesh = new Mesh(name, scene);
      data.applyToMesh(mesh); mesh.convertToFlatShadedMesh();
      return finish(mesh, position, material);
    },
    // Flat chamfers catch the key light without rounding away the low-poly silhouette.
    beveledBox: (name: string, size: XYZ, position: XYZ, material: Material) => {
      const [width, height, depth] = size;
      const bevel = Math.min(0.09, height / 3, width / 6, depth / 6);
      const positions: number[] = [];
      const indices: number[] = [];
      for (const [y, inset] of [
        [-height / 2, bevel], [-height / 2 + bevel, 0],
        [height / 2 - bevel, 0], [height / 2, bevel],
      ]) {
        const x = width / 2 - inset, z = depth / 2 - inset;
        const corner = Math.min(0.13, x / 3, z / 3);
        for (const [px, pz] of [
          [-x + corner, -z], [x - corner, -z], [x, -z + corner], [x, z - corner],
          [x - corner, z], [-x + corner, z], [-x, z - corner], [-x, -z + corner],
        ]) positions.push(px, y, pz);
      }
      for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 8; i++) {
        const a = ring * 8 + i, b = ring * 8 + (i + 1) % 8;
        indices.push(a, b, a + 8, b, b + 8, a + 8);
      }
      for (let i = 1; i < 7; i++) {
        indices.push(0, i + 1, i, 24, 24 + i, 24 + i + 1);
      }
      const data = new VertexData();
      data.positions = positions;
      data.indices = indices;
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      data.normals = normals;
      const mesh = new Mesh(name, scene);
      data.applyToMesh(mesh);
      mesh.convertToFlatShadedMesh();
      return finish(mesh, position, material);
    },
    roundedBox: (name: string, size: XYZ, position: XYZ, material: Material) => {
      const [width, height, depth] = size;
      const radius = Math.min(0.16, width / 4, depth / 4);
      const parts = [
        MeshBuilder.CreateBox(name, { width: width - radius * 2, height, depth }, scene),
        MeshBuilder.CreateBox(name, { width, height, depth: depth - radius * 2 }, scene),
      ];
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        const corner = MeshBuilder.CreateCylinder(name, { height, diameter: radius * 2, tessellation: 24 }, scene);
        corner.position.set(x * (width / 2 - radius), 0, z * (depth / 2 - radius));
        parts.push(corner);
      }
      const mesh = Mesh.MergeMeshes(parts, true)!;
      mesh.name = name;
      return finish(mesh, position, material);
    },
    box: (name: string, size: XYZ, position: XYZ, material: Material) => finish(
      MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene), position, material),
    ball: (name: string, size: XYZ, position: XYZ, material: Material) => finish(
      MeshBuilder.CreateSphere(name, { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments: 16 }, scene), position, material),
    cylinder: (name: string, height: number, bottom: number, top: number, position: XYZ, material: Material) => finish(
      MeshBuilder.CreateCylinder(name, { height, diameterBottom: bottom, diameterTop: top, tessellation: 24 }, scene), position, material),
    tube: (name: string, points: XYZ[], radius: number, material: Material) => finish(
      MeshBuilder.CreateTube(name, { path: points.map(point => new Vector3(...point)), radius, tessellation: 10, cap: 3 }, scene), [0, 0, 0], material),
  };
}

export type Shapes = ReturnType<typeof shapes>;
