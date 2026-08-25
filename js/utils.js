import * as THREE from 'three';

/* shared geometry/material helpers to keep draw setup light */

const _mats = new Map();

export function mat(color, roughness = 0.85, metalness = 0.0, extra = {}) {
  const key = `${color}|${roughness}|${metalness}|${JSON.stringify(extra)}`;
  if (!_mats.has(key)) {
    _mats.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
  }
  return _mats.get(key);
}

export function glowMat(color, intensity = 1) {
  const key = `glow|${color}|${intensity}`;
  if (!_mats.has(key)) {
    _mats.set(key, new THREE.MeshBasicMaterial({ color }));
  }
  return _mats.get(key);
}

export function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

export function cyl(rTop, rBot, h, seg, material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
}

export function sphere(r, seg, material) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material);
}

export function torus(r, tube, seg, tubSeg, material) {
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, seg, tubSeg), material);
}

export function plane(w, h, material) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
}

/** position helper: p(mesh, x, y, z, rx?, ry?, rz?) */
export function p(obj, x, y, z, rx = 0, ry = 0, rz = 0) {
  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  return obj;
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const PALETTE = {
  bg: 0x07070d,
  wallDark: 0x171a23,
  wallPanel: 0x1c202c,
  floorWood: 0x2a2320,
  metalDark: 0x22242b,
  metalBlack: 0x121318,
  plasticBlack: 0x14151a,
  screenBezel: 0x0a0b10,
  accent: 0x00f0ff,
  violet: 0xa855f7,
  warm: 0xffb066,
};
