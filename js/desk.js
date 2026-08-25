import * as THREE from 'three';
import { mat, glowMat, box, cyl, sphere, torus, plane, p, rand, PALETTE as C } from './utils.js';
import { createMainScreen, createTabletScreen, steamTexture } from './screens.js';

/* Single-monitor setup: main monitor + tablet + boom mic.
   Desk against back wall (z=-4). Screens face +Z.        */

export function buildDesk(scene, liveScreens, albumImages) {
  const desk = new THREE.Group();
  scene.add(desk);

  const anim = { fans: [], steam: [], keyboardGlow: null };

  buildDeskFurniture(desk);
  buildMainMonitor(desk, liveScreens);
  buildSpeakers(desk);
  buildTablet(desk, liveScreens, albumImages);
  buildKeyboard(desk);
  anim.keyboardGlow = keyboardGlow;
  buildMouse(desk);
  buildHeadphones(desk);
  buildMug(desk, anim);
  buildBoomMic(desk);
  buildPCTower(desk, anim);
  buildChair(desk);
  buildDeskLamp(desk);

  return anim;
}

/** cylinder strut between two points */
function strut(a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r, r, len, 10);
  const m = new THREE.Mesh(geo, material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  return m;
}

/* ── desk + legs + riser ─────────────────────────────── */
function buildDeskFurniture(desk) {
  const topMat = mat(0x1b1e27, 0.5, 0.15);
  const legMat = mat(0x101218, 0.45, 0.55);

  const top = box(2.7, 0.055, 0.78, topMat);
  top.position.set(0, 0.75, -3.56);
  top.castShadow = true;
  desk.add(top);

  const lLeg = box(0.05, 0.72, 0.7, legMat);
  lLeg.position.set(-1.28, 0.36, -3.56);
  const rLeg = lLeg.clone();
  rLeg.position.x = 1.28;
  desk.add(lLeg, rLeg);

  const bar = box(2.5, 0.07, 0.05, legMat);
  bar.position.set(0, 0.14, -3.62);
  desk.add(bar);

  const riser = box(1.6, 0.09, 0.3, mat(0x151820, 0.6));
  riser.position.set(0.28, 0.82, -3.74);
  desk.add(riser);

  const strip = box(0.16, 0.04, 0.06, mat(0x0c0d12, 0.7));
  strip.position.set(0.9, 0.79, -3.35);
  desk.add(strip);

  /* LED strip stuck to the wall behind the desk —
     soft even wash across the desktop, low intensity */
  const seamGlowMat = new THREE.MeshBasicMaterial({ color: 0x1ec8dc });
  const seamStrip = box(2.9, 0.014, 0.016, seamGlowMat);
  seamStrip.position.set(0, 0.88, -3.92);
  desk.add(seamStrip);

  const seamWash = new THREE.RectAreaLight(0x2ad4e6, 1.5, 2.9, 0.06);
  seamWash.position.set(0, 0.88, -3.9);
  seamWash.lookAt(0, 0.72, -3.1);   // throws down + forward across the desk
  desk.add(seamWash);

  // faint halo on the wall right above the strip
  const seamWallLight = new THREE.PointLight(0x1ec8dc, 0.45, 2.0, 2);
  seamWallLight.position.set(0, 0.98, -3.8);
  desk.add(seamWallLight);
}

/* ── monitor shell with live canvas screen ───────────── */
function makeMonitor(w, h, texture, neckH, bezel = 0.015) {
  const g = new THREE.Group();

  const shell = box(w + bezel * 2, h + bezel * 2, 0.03, mat(C.screenBezel, 0.35, 0.4));
  shell.position.y = neckH + h / 2;
  g.add(shell);

  const screenMat = new THREE.MeshBasicMaterial({ map: texture });
  const screen = plane(w, h, screenMat);
  screen.position.set(0, neckH + h / 2, 0.0165);
  g.add(screen);

  // slim stand: flat wide base + narrow neck
  const base = box(0.32, 0.014, 0.16, mat(0x14151c, 0.4, 0.55));
  base.position.set(0, 0.007, -0.02);
  const neck = box(0.045, neckH, 0.024, mat(0x14151c, 0.4, 0.55));
  neck.position.set(0, neckH / 2 + 0.014, -0.03);
  const neckTaper = box(0.06, 0.02, 0.05, mat(0x14151c, 0.4, 0.55));
  neckTaper.position.set(0, neckH + 0.02, -0.02);
  g.add(base, neck, neckTaper);

  // brand dot + power LED on the bottom bezel
  const brand = box(0.026, 0.006, 0.004, mat(0x2a2d36, 0.4, 0.5));
  brand.position.set(0, neckH + h + bezel / 2, 0.016);
  const powerLed = sphere(0.0035, 8, glowMat(0x37e6a0));
  powerLed.position.set(w / 2 + bezel - 0.03, neckH + h + bezel / 2, 0.017);

  g.add(brand, powerLed);

  return g;
}

/* ── MAIN monitor — the name screen ──────────────────── */
export let mainScreenCenter = new THREE.Vector3(0, 1.18, -3.66);

function buildMainMonitor(desk, liveScreens) {
  const scr = createMainScreen();
  liveScreens.push(scr);

  const w = 1.08, h = 0.62, neckH = 0.15;
  const mon = makeMonitor(w, h, scr.texture, neckH);

  mon.position.set(0.28, 0.865, -3.72);
  mon.rotation.y = 0.045;
  mon.rotation.x = -0.03;
  desk.add(mon);

  const glowLight = new THREE.PointLight(0x9fd8ff, 0.85, 1.9, 2);
  glowLight.position.set(0.28, 1.16, -3.3);
  desk.add(glowLight);

  mainScreenCenter = new THREE.Vector3(0.28, 0.865 + neckH + h * 0.42, -3.68);
}

/* ── small studio speakers flanking the monitor ──────── */
function buildSpeakers(desk) {
  const shellMat = mat(0x14161d, 0.65, 0.1);
  const coneMat = mat(0x0c0d12, 0.9);
  const ringMat = glowMat(0x00f0ff);

  function speaker(x) {
    const g = new THREE.Group();
    const body = box(0.13, 0.21, 0.1, shellMat);
    body.position.y = 0.105;
    const baffle = box(0.115, 0.195, 0.008, mat(0x0e1016, 0.8));
    baffle.position.set(0, 0.105, 0.051);
    // woofer + tweeter
    const woofer = cyl(0.038, 0.038, 0.012, 20, coneMat);
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(0, 0.07, 0.056);
    const wooferRing = torus(0.038, 0.004, 6, 22, ringMat);
    wooferRing.position.copy(woofer.position);
    const tweeter = cyl(0.016, 0.016, 0.01, 16, coneMat);
    tweeter.rotation.x = Math.PI / 2;
    tweeter.position.set(0, 0.16, 0.056);
    const led = box(0.008, 0.008, 0.004, ringMat);
    led.position.set(0, 0.015, 0.056);
    g.add(body, baffle, woofer, wooferRing, tweeter, led);
    return g;
  }

  const sl = speaker(-0.44);
  sl.position.set(-0.44, 0.865, -3.76);
  sl.rotation.y = 0.22;
  const sr = speaker(0.98);
  sr.position.set(0.98, 0.865, -3.76);
  sr.rotation.y = -0.22;
  desk.add(sl, sr);
}

/* ── TABLET · namjoo player on a foldable stand ──────── */
function buildTablet(desk, liveScreens, albumImages) {
  const scr = createTabletScreen(albumImages.magnetism);
  liveScreens.push(scr);

  const g = new THREE.Group();
  const W = 0.24, H = 0.34;

  const body = box(W, H, 0.012, mat(0x2b2f39, 0.3, 0.65));
  const screen = plane(W - 0.028, H - 0.028, new THREE.MeshBasicMaterial({ map: scr.texture }));
  screen.position.z = 0.0072;
  const cameraDot = sphere(0.004, 8, glowMat(0x334455));
  cameraDot.position.set(0, H / 2 - 0.016, 0.008);
  const homeDot = sphere(0.004, 8, mat(0x3a3f4b, 0.4, 0.5));
  homeDot.position.set(0, -H / 2 + 0.012, 0.008);

  g.add(body, screen, cameraDot, homeDot);

  // foldable stand: two struts + cross bar
  const standMat = mat(0x101218, 0.45, 0.5);
  const strutL = strut(new THREE.Vector3(-0.075, -0.03, 0), new THREE.Vector3(-0.09, -0.15, 0.08), 0.005, standMat);
  const strutR = strut(new THREE.Vector3(0.075, -0.03, 0), new THREE.Vector3(0.09, -0.15, 0.08), 0.005, standMat);
  const crossBar = box(0.21, 0.013, 0.013, standMat);
  crossBar.position.set(0, -0.15, 0.08);
  g.add(strutL, strutR, crossBar);

  g.position.set(-0.85, 0.94, -3.46);
  g.rotation.set(-0.46, 0.38, 0);
  desk.add(g);
}

/* ── keyboard — 60% board with sculpted keycaps & legends ── */
let keyboardGlow;

const KB = {
  U: 0.0395,        // 1 unit of key pitch
  GAP: 0.0062,      // gap between neighbouring caps
  CAP_H: 0.0135,    // keycap height
  INSET: 0.0034,    // top taper, in absolute units (same on wide keys)
  WIDTH_U: 15,      // a 60% board is 15u wide
  ROWS: 5,
};

/* per-row sculpt: caps tilt toward the typist and dish downward in the middle,
   the way a Cherry-profile set does. [tiltX, lift] */
const ROW_SCULPT = [
  [0.150, 0.0035],  // number row (back)
  [0.080, 0.0012],
  [0.000, 0.0000],  // home row — the low point of the dish
  [-0.055, 0.0012],
  [-0.095, 0.0030], // modifier row (front)
];

/* [label, widthInUnits, kind] — kind: undefined = alpha, 'mod', 'accent' */
const KEY_ROWS = [
  [['esc', 1, 'accent'], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1],
   ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['⌫', 2, 'mod']],
  [['tab', 1.5, 'mod'], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1],
   ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5, 'mod']],
  [['caps', 1.75, 'mod'], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1],
   ['J', 1], ['K', 1], ['L', 1], [';', 1], ['’', 1], ['⏎', 2.25, 'mod']],
  [['shift', 2.25, 'mod'], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1],
   ['M', 1], [',', 1], ['.', 1], ['/', 1], ['shift', 2.75, 'mod']],
  [['ctrl', 1.25, 'mod'], ['alt', 1.25, 'mod'], ['⌘', 1.25, 'mod'], ['', 6.25],
   ['⌘', 1.25, 'mod'], ['fn', 1.25, 'mod'], ['≡', 1.25, 'mod'], ['ctrl', 1.25, 'mod']],
];

/** tapered keycap: full-size footprint, smaller top face, flat-shaded */
function keycapGeo(w, d, h, inset) {
  const x0 = w / 2, z0 = d / 2;
  const x1 = Math.max(x0 - inset, x0 * 0.4);
  const z1 = z0 - inset;
  const V = [
    [-x0, 0, -z0], [x0, 0, -z0], [x0, 0, z0], [-x0, 0, z0],
    [-x1, h, -z1], [x1, h, -z1], [x1, h, z1], [-x1, h, z1],
  ];
  // each quad is wound CCW as seen from outside
  const quads = [
    [7, 6, 5, 4], [0, 1, 2, 3], [3, 2, 6, 7],
    [1, 0, 4, 5], [2, 1, 5, 6], [0, 3, 7, 4],
  ];
  const pos = [];
  for (const [a, b, c, e] of quads) {
    for (const idx of [a, b, c, a, c, e]) pos.push(...V[idx]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** one canvas holding all five rows of legends, drawn at true key pitch */
function keyLegendTexture() {
  const CELL = 64;                                   // px per key unit
  const c = document.createElement('canvas');
  c.width = KB.WIDTH_U * CELL;
  c.height = KB.ROWS * CELL;
  const x = c.getContext('2d');

  x.textAlign = 'center';
  x.textBaseline = 'middle';

  KEY_ROWS.forEach((row, r) => {
    let cursor = 0;
    for (const [label, wU] of row) {
      if (label) {
        const cxp = (cursor + wU / 2) * CELL;
        const cyp = r * CELL + CELL / 2;
        // wide modifiers get their legend tucked to the left, like real caps
        const wide = wU >= 1.75;
        x.font = `600 ${label.length > 2 ? 19 : 25}px "JetBrains Mono", monospace`;
        x.fillStyle = '#cbd4e0';
        x.fillText(label, wide ? cursor * CELL + 26 : cxp, cyp);
      }
      cursor += wU;
    }
  });

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function buildKeyboard(desk) {
  const g = new THREE.Group();
  const { U, GAP, CAP_H, INSET, WIDTH_U } = KB;
  const boardW = WIDTH_U * U;          // 0.5925
  const boardD = KB.ROWS * U;          // 0.1975

  /* ── case: bottom tray + raised bezel lip ── */
  const caseMat = mat(0x15171e, 0.45, 0.4);
  const plateMat = mat(0x0b0c11, 0.55, 0.5);

  const tray = box(boardW + 0.038, 0.019, boardD + 0.036, caseMat);
  tray.position.y = -0.0095;
  g.add(tray);

  // switch plate the caps sit on — reads as dark space between the keys
  const plate = box(boardW + 0.004, 0.004, boardD + 0.004, plateMat);
  plate.position.y = 0.002;
  g.add(plate);

  // bezel lip: back/front/left/right, rising to just under the cap tops
  const lipH = 0.011;
  const lipY = lipH / 2;
  const lipBack = box(boardW + 0.038, lipH, 0.018, caseMat);
  lipBack.position.set(0, lipY, -boardD / 2 - 0.009);
  const lipFront = box(boardW + 0.038, lipH * 0.7, 0.018, caseMat);
  lipFront.position.set(0, lipH * 0.35, boardD / 2 + 0.009);
  const lipL = box(0.018, lipH, boardD + 0.036, caseMat);
  lipL.position.set(-boardW / 2 - 0.009, lipY, 0);
  const lipR = lipL.clone();
  lipR.position.x = boardW / 2 + 0.009;
  g.add(lipBack, lipFront, lipL, lipR);

  // rubber feet
  const footMat = mat(0x08090c, 0.95);
  for (const fx of [-1, 1]) {
    for (const fz of [-1, 1]) {
      const foot = cyl(0.008, 0.008, 0.006, 8, footMat);
      foot.position.set(fx * (boardW / 2 - 0.02), -0.021, fz * (boardD / 2 - 0.015));
      g.add(foot);
    }
  }

  // USB-C port in the back lip
  const port = box(0.019, 0.005, 0.006, mat(0x05060a, 0.6, 0.3));
  port.position.set(0, 0.004, -boardD / 2 - 0.016);
  g.add(port);

  /* ── keycaps ── */
  const capMat = mat(0x2f343d, 0.62);        // alphas
  const modMat = mat(0x21252d, 0.6);         // modifiers, a shade darker
  const cap1uGeo = keycapGeo(U - GAP, U - GAP, CAP_H, INSET);

  // every 1u alpha shares one instanced mesh; wide caps need their own geometry
  const alphaCount = KEY_ROWS.flat().filter(([, w, k]) => w === 1 && !k).length;
  const alphaMesh = new THREE.InstancedMesh(cap1uGeo, capMat, alphaCount);
  const dummy = new THREE.Object3D();
  let ai = 0;

  KEY_ROWS.forEach((row, r) => {
    const [tilt, lift] = ROW_SCULPT[r];
    const rowZ = (r - (KB.ROWS - 1) / 2) * U;
    let cursor = 0;

    for (const [label, wU, kind] of row) {
      const keyX = (cursor + wU / 2 - WIDTH_U / 2) * U;
      cursor += wU;

      dummy.position.set(keyX, 0.004 + lift, rowZ);
      dummy.rotation.set(tilt, 0, 0);
      dummy.updateMatrix();

      if (wU === 1 && !kind) {
        alphaMesh.setMatrixAt(ai++, dummy.matrix);
      } else {
        const geo = wU === 1 ? cap1uGeo
          : keycapGeo(wU * U - GAP, U - GAP, CAP_H, INSET);
        // accent cap is tinted, not blown out — kept under the bloom threshold
        // so its legend stays readable
        const m = new THREE.Mesh(geo, kind === 'accent' ? glowMat(0x0f8ea0) : modMat);
        m.applyMatrix4(dummy.matrix);
        g.add(m);
      }

      // homing bumps on F and J
      if (label === 'F' || label === 'J') {
        const bump = box(0.008, 0.0012, 0.0022, capMat);
        bump.position.set(keyX, 0.004 + lift + CAP_H, rowZ + 0.009);
        bump.rotation.x = tilt;
        g.add(bump);
      }
    }
  });
  alphaMesh.instanceMatrix.needsUpdate = true;
  g.add(alphaMesh);

  /* ── legends: one decal strip per row, sharing the row's tilt & lift so the
        text stays glued to the cap tops instead of floating over them ── */
  const legendTex = keyLegendTexture();
  KEY_ROWS.forEach((_, r) => {
    const [tilt, lift] = ROW_SCULPT[r];
    const tex = legendTex.clone();
    tex.needsUpdate = true;
    tex.offset.set(0, (KB.ROWS - 1 - r) / KB.ROWS);
    tex.repeat.set(1, 1 / KB.ROWS);

    const strip = plane(boardW, U, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0.9,
    }));
    strip.rotation.x = -Math.PI / 2 + tilt;
    strip.position.set(0, 0.004 + lift + CAP_H + 0.0007, (r - (KB.ROWS - 1) / 2) * U);
    g.add(strip);
  });

  // caps-lock indicator
  const led = box(0.005, 0.002, 0.005, glowMat(0x37e6a0));
  led.position.set(-boardW / 2 + 0.012, 0.006, -boardD / 2 - 0.004);
  g.add(led);

  // underglow — barely on, just a hint at the back edge
  keyboardGlow = new THREE.MeshBasicMaterial({ color: 0x00b8cc });
  const under = box(0.6, 0.005, 0.014, keyboardGlow);
  under.position.set(0, -0.019, -0.1);
  g.add(under);

  g.position.set(0.24, 0.79, -3.28);
  g.rotation.x = 0.06;
  desk.add(g);

  // visible cable curving to the riser
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.5, 0.802, -3.37),
    new THREE.Vector3(0.56, 0.79, -3.5),
    new THREE.Vector3(0.5, 0.83, -3.66),
    new THREE.Vector3(0.42, 0.875, -3.72),
  ]);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(cableCurve, 20, 0.005, 6),
    mat(0x0d0e13, 0.6),
  );
  desk.add(cable);
}

/* ── mouse — lighter body, glowing strip, stitched pad ── */
function buildMouse(desk) {
  const pad = box(0.34, 0.005, 0.27, mat(0x11131a, 0.95));
  pad.position.set(0.98, 0.779, -3.25);
  pad.rotation.y = -0.12;
  desk.add(pad);
  // pad stitching
  const stitch = box(0.345, 0.006, 0.275, mat(0x2c313d, 0.9));
  stitch.position.copy(pad.position);
  stitch.position.y -= 0.0008;
  stitch.rotation.y = -0.12;
  desk.add(stitch);

  const body = sphere(0.048, 18, mat(0xb9bfc9, 0.5, 0.1));
  body.scale.set(0.72, 0.42, 1.15);
  body.position.set(0.97, 0.81, -3.26);
  body.rotation.y = -0.12;
  desk.add(body);

  // button split line
  const split = box(0.002, 0.004, 0.055, mat(0x6a707c, 0.6));
  split.position.set(0.966, 0.836, -3.235);
  split.rotation.y = -0.12;
  desk.add(split);

  // side RGB strip
  const sideGlow = box(0.002, 0.008, 0.075, glowMat(0x00f0ff));
  sideGlow.position.set(0.938, 0.805, -3.26);
  sideGlow.rotation.y = -0.12;
  desk.add(sideGlow);

  // wheel recessed in a dark well
  const wheelWell = box(0.016, 0.008, 0.038, mat(0x1a1d24, 0.7));
  wheelWell.position.set(0.962, 0.832, -3.305);
  wheelWell.rotation.y = -0.12;
  const wheel = cyl(0.007, 0.007, 0.014, 12, glowMat(0x00f0ff));
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0.962, 0.838, -3.305);
  desk.add(wheelWell, wheel);
}

/* ── headphones — on the desk, bright & detailed ─────── */
function buildHeadphones(desk) {
  const g = new THREE.Group();

  const rodMat = mat(0x2a2d36, 0.4, 0.6);
  const basePlate = cyl(0.09, 0.105, 0.018, 20, rodMat);
  const baseGlow = torus(0.095, 0.003, 6, 24, glowMat(0x00f0ff));
  baseGlow.rotation.x = Math.PI / 2;
  baseGlow.position.y = 0.012;
  const rod = cyl(0.009, 0.009, 0.3, 8, rodMat);
  rod.position.y = 0.155;
  const hook = box(0.055, 0.016, 0.022, rodMat);
  hook.position.set(0, 0.3, 0.012);

  // band: outer shell + inner cushion
  const bandMat = mat(0x3a3f4b, 0.5);
  const band = torus(0.082, 0.015, 10, 26, bandMat);
  band.rotation.z = Math.PI;
  band.position.y = 0.3;
  const cushion = torus(0.058, 0.014, 8, 20, mat(0x565d6b, 0.8));
  cushion.rotation.z = Math.PI;
  cushion.position.y = 0.318;
  cushion.scale.set(1, 0.55, 1);

  // yokes connecting band to cups
  const yokeMat = mat(0x2a2d36, 0.4, 0.6);
  const yokeL = box(0.008, 0.055, 0.014, yokeMat);
  yokeL.position.set(-0.082, 0.255, 0);
  yokeL.rotation.z = 0.15;
  const yokeR = yokeL.clone();
  yokeR.position.x = 0.082;
  yokeR.rotation.z = -0.15;

  // cups: light shells + dark mesh face + orange accent rings
  const cupShell = mat(0x4a505e, 0.45, 0.25);
  const cupMesh = mat(0x14161c, 0.7);
  const ringMat = glowMat(0xff9d5c);
  const cupL = new THREE.Group();
  const shellL = cyl(0.046, 0.052, 0.03, 20, cupShell);
  shellL.rotation.z = Math.PI / 2;
  const meshL = cyl(0.04, 0.046, 0.014, 20, cupMesh);
  meshL.rotation.z = Math.PI / 2;
  meshL.position.x = -0.02;
  const ringL = torus(0.048, 0.005, 8, 24, ringMat);
  ringL.rotation.y = Math.PI / 2;
  cupL.add(shellL, meshL, ringL);
  cupL.position.set(-0.085, 0.215, 0);
  const cupR = cupL.clone();
  cupR.position.x = 0.085;
  cupR.rotation.y = Math.PI;

  g.add(basePlate, baseGlow, rod, hook, band, cushion, yokeL, yokeR, cupL, cupR);
  g.position.set(-1.08, 0.778, -3.6);
  g.rotation.y = 0.3;
  desk.add(g);
}

/* ── coffee mug + steam ──────────────────────────────── */
function buildMug(desk, anim) {
  const g = new THREE.Group();

  /* Lathed profile so the mug is genuinely hollow with a wall thickness —
     the old solid cylinder left the coffee disc floating on a closed top. The
     path runs up the outside, over the lip, then back down the inside. */
  const ceramic = mat(0xb9bfc9, 0.38, 0.02);
  const profile = [
    [0.000, 0.000], [0.036, 0.000], [0.039, 0.003],   // base + foot
    [0.0405, 0.016], [0.0425, 0.048], [0.0435, 0.082],
    [0.0432, 0.093], [0.0425, 0.0955],                // outer wall to the rim
    [0.0385, 0.0958],                                 // over the lip
    [0.0378, 0.092], [0.0372, 0.05], [0.0355, 0.016], // inner wall
    [0.031, 0.007], [0.000, 0.006],                   // inner floor
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const mug = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 28),
    // DoubleSide so the inner wall is not culled when you see into the cup
    new THREE.MeshStandardMaterial({
      color: 0xb9bfc9, roughness: 0.38, metalness: 0.02, side: THREE.DoubleSide,
    }),
  );
  mug.castShadow = true;

  // coffee sits down inside the cup, not level with the rim
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.0368, 28),
    mat(0x2a1a10, 0.22, 0.0, { emissive: 0x140b05, emissiveIntensity: 0.4 }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.072;

  /* C-shaped handle: a 270° arc rotated so its gap faces the mug wall, with
     both ends buried in the ceramic rather than a ring through the body */
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.026, 0.0058, 10, 22, Math.PI * 1.5),
    ceramic,
  );
  handle.position.set(0.058, 0.052, 0);
  handle.rotation.z = -Math.PI * 0.75;
  handle.castShadow = true;

  g.add(mug, coffee, handle);
  g.position.set(-0.35, 0.778, -3.32);
  desk.add(g);

  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xcad8e8, map: steamTexture(), transparent: true, opacity: 0.06,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = 0; i < 3; i++) {
    const s = plane(0.05, 0.12, steamMat.clone());
    s.position.set(-0.35, 0.86, -3.32);
    desk.add(s);
    anim.steam.push({ mesh: s, phase: i * 2.1 });
  }
}

/* ── BOOM-ARM MICROPHONE · clamped right, faces chair ── */
function buildBoomMic(desk) {
  const g = new THREE.Group();
  const metal = mat(0x191b22, 0.4, 0.6);
  const darkMetal = mat(0x101218, 0.45, 0.55);

  /* desk clamp at the right edge */
  const clampTop = box(0.06, 0.02, 0.09, darkMetal);
  clampTop.position.set(0, 0.045, -0.02);
  const clampBottom = box(0.06, 0.02, 0.09, darkMetal);
  clampBottom.position.set(0, -0.02, -0.02);
  const clampScrew = cyl(0.008, 0.008, 0.05, 10, metal);
  clampScrew.rotation.x = Math.PI / 2;
  clampScrew.position.set(0.045, 0.012, -0.02);
  const clampKnob = cyl(0.016, 0.016, 0.014, 12, metal);
  clampKnob.rotation.x = Math.PI / 2;
  clampKnob.position.set(0.075, 0.012, -0.02);
  const post = box(0.03, 0.14, 0.03, darkMetal);
  post.position.set(0, 0.11, -0.02);
  g.add(clampTop, clampBottom, clampScrew, clampKnob, post);

  /* boom arms — clamp → elbow → mic (front-right of the monitor,
     below the name line so the hero closeup stays clean) */
  const clampPivot = new THREE.Vector3(0, 0.17, -0.02);
  const elbow = new THREE.Vector3(-0.36, 0.56, 0.08);
  const micAnchor = new THREE.Vector3(-0.6, 0.36, 0.18);

  const lower = strut(clampPivot, elbow, 0.009, metal);
  g.add(lower);
  // broadcast spring along the lower arm
  for (let s = 0; s < 4; s++) {
    const k = 0.25 + s * 0.17;
    const springP = new THREE.Vector3().lerpVectors(clampPivot, elbow, k);
    const spring = torus(0.016, 0.0022, 6, 14, metal);
    spring.position.copy(springP);
    spring.quaternion.copy(lower.quaternion);
    spring.rotateX(Math.PI / 2);
    g.add(spring);
  }
  const elbowBall = sphere(0.016, 12, darkMetal);
  elbowBall.position.copy(elbow);
  g.add(elbowBall);

  const upper = strut(elbow, micAnchor, 0.008, metal);
  g.add(upper);

  /* mic assembly at the anchor — faces the chair (+Z) */
  const mic = new THREE.Group();
  mic.position.copy(micAnchor);

  // shock mount rings + elastic bands
  const mountRing = torus(0.052, 0.004, 8, 26, darkMetal);
  mountRing.rotation.x = Math.PI / 2.6;
  const mountRing2 = torus(0.052, 0.004, 8, 26, darkMetal);
  mountRing2.rotation.x = Math.PI / 2.6;
  mountRing2.position.y = -0.075;
  for (let s = 0; s < 6; s++) {
    const ang = (s / 6) * Math.PI * 2;
    const band = strut(
      new THREE.Vector3(Math.cos(ang) * 0.052, 0, Math.sin(ang) * 0.02),
      new THREE.Vector3(Math.cos(ang) * 0.052, -0.075, Math.sin(ang) * 0.02),
      0.0018,
      mat(0x2a2d36, 0.8),
    );
    mic.add(band);
  }

  // body + grille capsule
  const bodyMat = mat(0x23262e, 0.35, 0.7);
  const micBody = cyl(0.032, 0.036, 0.11, 20, bodyMat);
  const grilleMat = mat(0x0c0d12, 0.7, 0.4);
  const grille = cyl(0.037, 0.037, 0.055, 20, grilleMat);
  grille.position.y = 0.078;
  const grilleCap = cyl(0.037, 0.028, 0.014, 20, bodyMat);
  grilleCap.position.y = 0.112;
  const brandRing = torus(0.034, 0.003, 6, 20, glowMat(0x00f0ff));
  brandRing.rotation.x = Math.PI / 2;
  brandRing.position.y = 0.045;

  mic.add(mountRing, mountRing2, micBody, grille, grilleCap, brandRing);

  // pop filter on a small gooseneck, sitting between mic and chair
  const gooseneck = strut(
    new THREE.Vector3(0, -0.02, 0.03),
    new THREE.Vector3(0, 0.05, 0.14),
    0.004,
    mat(0x14151c, 0.5, 0.5),
  );
  const popFilter = cyl(0.052, 0.052, 0.006, 22, mat(0x1b2b26, 0.95));
  popFilter.rotation.x = Math.PI / 2.6;
  popFilter.position.set(0, 0.05, 0.15);
  const pfRing = torus(0.052, 0.004, 6, 24, mat(0x101218, 0.5, 0.4));
  pfRing.rotation.x = Math.PI / 2.6;
  pfRing.position.copy(popFilter.position);
  mic.add(gooseneck, popFilter, pfRing);

  // tilt mic slightly down toward the chair
  mic.rotation.x = -0.18;
  g.add(mic);

  /* XLR cable drooping from the mic down the arm to the desk */
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(micAnchor.x, micAnchor.y - 0.09, micAnchor.z + 0.02),
    new THREE.Vector3(micAnchor.x - 0.04, micAnchor.y - 0.24, micAnchor.z + 0.05),
    new THREE.Vector3(elbow.x + 0.04, elbow.y - 0.34, elbow.z + 0.08),
    new THREE.Vector3(0.62, 0.79, -3.44),
    new THREE.Vector3(0.42, 0.79, -3.5),
  ]);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(cableCurve, 40, 0.0045, 6),
    mat(0x0a0b10, 0.6),
  );
  g.add(cable);

  g.position.set(1.32, 0.778, -3.7);
  g.rotation.y = 0.06;
  desk.add(g);
}

/* ── PC TOWER · tempered glass · RGB fans ────────────── */
/* cool-side RGB only — the old hot pink fought the room's cyan/violet key light */
const FAN_HUES = [0x00f0ff, 0x0077ff, 0xa855f7];

/** one RGB case fan: square frame, hub, pitched blades, lit ring */
function buildFan(r, hue, anim, framed = true) {
  const g = new THREE.Group();
  const frameMat = mat(0x14161d, 0.6);
  const ringMat = new THREE.MeshBasicMaterial({ color: hue });

  if (framed) {
    const s = r * 2.2, t = 0.009;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const bar = box(dx ? t : s, dy ? t : s, 0.02, frameMat);
      bar.position.set(dx * (s / 2 - t / 2), dy * (s / 2 - t / 2), 0);
      g.add(bar);
    }
  }

  const ring = torus(r, 0.0055, 8, 24, ringMat);
  const hub = cyl(r * 0.3, r * 0.3, 0.016, 12, mat(0x1b1e26, 0.5, 0.2));
  hub.rotation.x = Math.PI / 2;

  const blades = new THREE.Group();
  const bladeMat = mat(0x272c37, 0.55, 0.1);
  for (let b = 0; b < 9; b++) {
    const blade = box(r * 0.36, r * 0.86, 0.005, bladeMat);
    blade.position.y = r * 0.53;
    blade.rotation.y = 0.55;                 // pitch, about the radial axis
    const holder = new THREE.Group();
    holder.add(blade);
    holder.rotation.z = (b / 9) * Math.PI * 2;
    blades.add(holder);
  }

  g.add(ring, hub, blades);
  anim.fans.push({ spinner: blades, ringMat });
  return g;
}

/* ── PC tower — mesh-front mid-tower, glass side panel, visible build ──
   Local axes: X = width (-X is the front), Y = height, Z = depth
   (+Z is the tempered-glass side facing the room).                      */
function buildPCTower(desk, anim) {
  const g = new THREE.Group();
  const W = 0.24, H = 0.52, D = 0.46;
  const T = 0.006;                       // panel thickness
  const FOOT = 0.022;
  const y0 = FOOT;                       // case floor
  const cy = y0 + H / 2;                 // case centre height

  const steel = mat(0x101219, 0.42, 0.55);
  const steelDark = mat(0x0a0b10, 0.5, 0.4);
  /* Interior parts carry a little emissive of their own. A point light inside
     a box this small either hotspots whatever it touches or leaves the rest
     black, so the RGB ambience is baked in and the lights only add falloff. */
  const pcb = mat(0x121d21, 0.72, 0.1, { emissive: 0x0c2b33, emissiveIntensity: 0.55 });

  /* ── chassis panels ── */
  // -Z side panel: thin in Z, spanning width and height (not box(T,H,D) —
  // that is a YZ-plane panel and would slice straight through the build)
  const sideSolid = box(W, H, T, steel);
  sideSolid.position.set(0, cy, -D / 2);
  const top = box(W, T, D, steel);
  top.position.set(0, y0 + H, 0);
  const bottom = box(W, T, D, steelDark);
  bottom.position.set(0, y0, 0);
  const back = box(T, H, D, steel);                 // +X back
  back.position.set(W / 2, cy, 0);
  sideSolid.castShadow = top.castShadow = back.castShadow = true;
  g.add(sideSolid, top, back, bottom);

  // vent slots milled into the top panel
  for (let i = 0; i < 7; i++) {
    const slot = box(W * 0.62, 0.002, 0.012, steelDark);
    slot.position.set(0, y0 + H + 0.002, -D / 2 + 0.07 + i * 0.05);
    g.add(slot);
  }

  /* ── front: fine mesh panel with an air gap down each edge ── */
  const meshMat = mat(0x0c0d12, 0.85, 0.15);
  const front = box(T, H - 0.02, D - 0.05, meshMat);
  front.position.set(-W / 2, cy, 0);
  g.add(front);
  for (let i = 0; i < 26; i++) {
    const perf = box(0.001, 0.004, D - 0.09, mat(0x05060a, 0.9));
    perf.position.set(-W / 2 - 0.0035, y0 + 0.03 + i * 0.018, 0);
    g.add(perf);
  }

  /* ── tempered glass side panel (+Z), with visible standoff screws ── */
  const glass = box(W - 0.012, H - 0.014, 0.006, new THREE.MeshPhysicalMaterial({
    color: 0x1a2735, transparent: true, opacity: 0.17,
    roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04,
  }));
  glass.position.set(0, cy, D / 2);
  g.add(glass);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const screw = cyl(0.005, 0.005, 0.004, 8, mat(0x2a2f3a, 0.35, 0.8));
      screw.rotation.x = Math.PI / 2;
      screw.position.set(sx * (W / 2 - 0.016), cy + sy * (H / 2 - 0.018), D / 2 + 0.002);
      g.add(screw);
    }
  }

  /* ── motherboard on the -Z wall, standing off the tray ── */
  const mobo = box(W - 0.05, 0.3, 0.004, pcb);
  mobo.position.set(-0.005, cy + 0.06, -D / 2 + 0.018);
  g.add(mobo);

  // chipset + M.2 heatsinks
  const chipset = box(0.05, 0.05, 0.006, mat(0x1c212b, 0.45, 0.5));
  chipset.position.set(0.03, cy - 0.02, -D / 2 + 0.024);
  const m2 = box(0.09, 0.018, 0.005, mat(0x191d26, 0.4, 0.5));
  m2.position.set(-0.02, cy + 0.005, -D / 2 + 0.024);
  g.add(chipset, m2);

  // rear I/O shield
  const ioShield = box(0.004, 0.05, 0.13, mat(0x2b303b, 0.35, 0.75));
  ioShield.position.set(W / 2 - 0.004, cy + 0.15, -D / 2 + 0.075);
  g.add(ioShield);

  /* ── CPU tower cooler: fin stack + fan ── */
  const finMat = mat(0x464e59, 0.35, 0.85, { emissive: 0x123c47, emissiveIntensity: 0.5 });
  for (let i = 0; i < 16; i++) {
    const fin = box(0.075, 0.0016, 0.075, finMat);
    fin.position.set(-0.015, cy + 0.075 + i * 0.0062, -D / 2 + 0.075);
    g.add(fin);
  }
  for (const hx of [-0.022, 0, 0.022]) {
    const pipe = cyl(0.004, 0.004, 0.1, 8, mat(0x6b5236, 0.3, 0.9));
    pipe.position.set(-0.015 + hx, cy + 0.075, -D / 2 + 0.042);
    g.add(pipe);
  }
  const cpuFan = buildFan(0.032, FAN_HUES[1], anim);
  cpuFan.rotation.y = -Math.PI / 2;
  cpuFan.position.set(-0.058, cy + 0.122, -D / 2 + 0.075);
  g.add(cpuFan);

  /* ── RAM: four sticks with lit diffusers ── */
  for (let i = 0; i < 4; i++) {
    const stick = box(0.008, 0.075, 0.005, mat(0x15181f, 0.5, 0.3));
    stick.position.set(0.052 + i * 0.011, cy + 0.115, -D / 2 + 0.05);
    const lit = box(0.008, 0.007, 0.005, new THREE.MeshBasicMaterial({
      color: i % 2 ? 0x00f0ff : 0xa855f7,
    }));
    lit.position.set(0.052 + i * 0.011, cy + 0.155, -D / 2 + 0.05);
    g.add(stick, lit);
  }

  /* ── GPU: shroud, twin fans, backplate, sag ── */
  const gpu = new THREE.Group();
  const shroud = box(0.052, 0.03, 0.26,
    mat(0x1d2029, 0.4, 0.45, { emissive: 0x2a123f, emissiveIntensity: 0.45 }));
  const backplate = box(0.004, 0.036, 0.26,
    mat(0x14161d, 0.35, 0.7, { emissive: 0x1d0f2b, emissiveIntensity: 0.4 }));
  backplate.position.x = -0.029;
  gpu.add(shroud, backplate);
  for (const fz of [-0.062, 0.062]) {
    const gf = buildFan(0.021, FAN_HUES[2], anim, false);
    gf.rotation.x = -Math.PI / 2;
    gf.position.set(0, 0.017, fz);
    gpu.add(gf);
  }
  const gpuLogo = box(0.001, 0.006, 0.07, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
  gpuLogo.position.set(0.027, 0.004, 0.02);
  gpu.add(gpuLogo);
  gpu.position.set(-0.005, cy - 0.055, -D / 2 + 0.16);
  gpu.rotation.x = 0.012;                  // the traditional sag
  g.add(gpu);

  // GPU support bracket
  const brace = box(0.01, 0.055, 0.012, mat(0x1e222b, 0.5, 0.3));
  brace.position.set(-0.005, cy - 0.098, -D / 2 + 0.27);
  g.add(brace);

  /* ── PSU shroud along the floor, with a cable pass-through ── */
  const shroudTop = box(W - 2 * T, 0.004, D - 0.05, mat(0x0c0e13, 0.6, 0.25));
  shroudTop.position.set(0, y0 + 0.1, 0.01);
  g.add(shroudTop);
  const psuVent = box(0.05, 0.003, 0.05, steelDark);
  psuVent.position.set(-0.04, y0 + 0.103, 0.03);
  g.add(psuVent);

  /* ── braided cables from the shroud grommet up to the board ── */
  const cableMat = mat(0x0b0c11, 0.75);
  for (const [sz, ez, off] of [[0.06, -0.02, 0.0], [0.075, 0.02, 0.012]]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02 + off, y0 + 0.105, sz),
      new THREE.Vector3(0.05 + off, y0 + 0.17, sz - 0.03),
      new THREE.Vector3(0.055 + off, y0 + 0.28, ez + 0.03),
      new THREE.Vector3(0.03 + off, y0 + 0.33, ez),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0045, 6), cableMat));
  }

  /* ── front intake stack, seen through the glass ── */
  for (let f = 0; f < 3; f++) {
    const fan = buildFan(0.038, FAN_HUES[f], anim);
    fan.rotation.y = -Math.PI / 2;
    fan.position.set(-W / 2 + 0.028, y0 + 0.155 + f * 0.105, 0.02);
    g.add(fan);
  }

  // rear exhaust
  const exhaust = buildFan(0.034, FAN_HUES[1], anim);
  exhaust.rotation.y = Math.PI / 2;
  exhaust.position.set(W / 2 - 0.022, cy + 0.155, -D / 2 + 0.075);
  g.add(exhaust);

  /* ── front I/O + power button on the top edge of the front panel ── */
  const power = cyl(0.006, 0.006, 0.003, 10, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
  power.position.set(-W / 2 + 0.03, y0 + H + 0.002, D / 2 - 0.05);
  g.add(power);
  for (let i = 0; i < 2; i++) {
    const usb = box(0.016, 0.003, 0.008, mat(0x05060a, 0.6, 0.3));
    usb.position.set(-W / 2 + 0.055 + i * 0.024, y0 + H + 0.002, D / 2 - 0.05);
    g.add(usb);
  }

  /* ── vertical RGB light bar down the front edge ── */
  const barMat = new THREE.MeshBasicMaterial({ color: 0x0a7d8c });
  const bar = box(0.004, H - 0.09, 0.006, barMat);
  bar.position.set(-W / 2 - 0.002, cy, D / 2 - 0.012);
  g.add(bar);

  /* ── feet ── */
  for (const fx of [-1, 1]) {
    for (const fz of [-1, 1]) {
      const foot = box(0.03, FOOT, 0.035, mat(0x08090c, 0.9));
      foot.position.set(fx * (W / 2 - 0.02), FOOT / 2, fz * (D / 2 - 0.03));
      g.add(foot);
    }
  }

  /* Interior lighting: the fans' RGB is what makes a glass-panel build
     readable, so the key light lives INSIDE the case, not out in front of it.
     Two lights only — one cyan up by the cooler, one violet down on the GPU. */
  // decay 1, not 2 — inverse-square inside a 24cm box is all hotspot and no fill
  const coreLight = new THREE.PointLight(0x3ad8ea, 0.42, 0.85, 1);
  coreLight.position.set(-0.04, cy + 0.05, 0.06);
  g.add(coreLight);

  const gpuLight = new THREE.PointLight(0xa855f7, 0.26, 0.6, 1);
  gpuLight.position.set(-0.04, cy - 0.06, 0.06);
  g.add(gpuLight);

  /* No external spill light. A point light out in front of the glass paints a
     bright pool on the floor and reads as a lamp sitting next to the case —
     the glow belongs to the emissive front bar and the interior only. */

  g.position.set(1.78, 0, -3.62);
  // angled so the glass panel faces back toward the desk/camera — turned the
  // other way the build is hidden behind the case's own front panel
  g.rotation.y = -0.46;
  desk.add(g);
}

/* ── gaming chair ────────────────────────────────────── */
function buildChair(desk) {
  const g = new THREE.Group();
  const fabric = mat(0x191b22, 0.85);
  const accentFabric = mat(0x232733, 0.8);
  const plastic = mat(0x0e0f14, 0.5, 0.3);

  const seat = box(0.48, 0.09, 0.46, fabric);
  seat.position.y = 0.47;
  seat.castShadow = true;
  // seat side bolsters + front piping
  const seatBolL = box(0.06, 0.075, 0.42, accentFabric);
  seatBolL.position.set(-0.225, 0.5, 0.01);
  seatBolL.rotation.z = -0.12;
  const seatBolR = seatBolL.clone();
  seatBolR.position.x = 0.225;
  seatBolR.rotation.z = 0.12;
  const seatPipe = box(0.46, 0.016, 0.016, mat(0x00b8cc, 0.6));
  seatPipe.position.set(0, 0.47, -0.215);

  const back = box(0.46, 0.72, 0.09, fabric);
  back.position.set(0, 0.88, 0.235);
  back.rotation.x = 0.12;
  back.castShadow = true;
  // racing backrest wings
  const backBolL = box(0.075, 0.6, 0.13, accentFabric);
  backBolL.position.set(-0.2, 0.9, 0.2);
  backBolL.rotation.set(0.12, 0, -0.14);
  const backBolR = backBolL.clone();
  backBolR.position.x = 0.2;
  backBolR.rotation.z = 0.14;

  const stripeL = box(0.05, 0.6, 0.012, accentFabric);
  stripeL.position.set(-0.17, 0.88, 0.185);
  stripeL.rotation.x = 0.12;
  const stripeR = stripeL.clone();
  stripeR.position.x = 0.17;

  // headrest + wings
  const pillow = box(0.26, 0.13, 0.06, accentFabric);
  pillow.position.set(0, 1.22, 0.27);
  pillow.rotation.x = 0.16;
  const wingL = box(0.05, 0.16, 0.055, fabric);
  wingL.position.set(-0.16, 1.21, 0.26);
  wingL.rotation.set(0.16, 0, -0.2);
  const wingR = wingL.clone();
  wingR.position.x = 0.16;
  wingR.rotation.z = 0.2;

  const lumbar = box(0.34, 0.12, 0.05, accentFabric);
  lumbar.position.set(0, 0.72, 0.19);
  lumbar.rotation.x = 0.12;

  const armL = box(0.07, 0.05, 0.34, plastic);
  armL.position.set(-0.29, 0.63, 0.02);
  const armLSupport = box(0.05, 0.12, 0.05, plastic);
  armLSupport.position.set(-0.29, 0.55, -0.08);
  const armR = armL.clone(); armR.position.x = 0.29;
  const armRSupport = armLSupport.clone(); armRSupport.position.x = 0.29;

  const lift = cyl(0.028, 0.028, 0.24, 12, plastic);
  lift.position.y = 0.32;
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const leg = box(0.05, 0.035, 0.3, plastic);
    const legHolder = new THREE.Group();
    leg.position.z = 0.15;
    legHolder.add(leg);
    legHolder.position.y = 0.055;
    legHolder.rotation.y = ang;
    const caster = sphere(0.032, 10, plastic);
    caster.position.set(Math.sin(ang) * 0.28, 0.032, Math.cos(ang) * 0.28);
    g.add(legHolder, caster);
  }

  g.add(seat, seatBolL, seatBolR, seatPipe,
    back, backBolL, backBolR, stripeL, stripeR,
    pillow, wingL, wingR, lumbar, armL, armR, armLSupport, armRSupport, lift);

  g.position.set(0.15, 0, -2.5);
  g.rotation.y = 0.35;
  desk.add(g);
}

/* ── articulated desk lamp (left side now) ───────────── */
function buildDeskLamp(desk) {
  const g = new THREE.Group();
  const metal = mat(0x15171e, 0.4, 0.6);

  const clampBase = box(0.09, 0.03, 0.07, metal);
  const joint1 = sphere(0.02, 10, metal);
  joint1.position.y = 0.03;

  const arm1 = box(0.025, 0.28, 0.025, metal);
  arm1.position.set(0.045, 0.16, 0);
  arm1.rotation.z = -0.3;

  const elbow = sphere(0.02, 10, metal);
  elbow.position.set(0.126, 0.29, 0);

  const arm2 = box(0.025, 0.26, 0.025, metal);
  arm2.position.set(0.2, 0.395, 0.02);
  arm2.rotation.z = -0.85;

  const head = cyl(0.055, 0.03, 0.09, 16, metal);
  head.position.set(0.31, 0.445, 0.04);
  head.rotation.z = 2.2;

  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x8a6135 });
  const bulb = cyl(0.042, 0.042, 0.01, 16, bulbMat);
  bulb.position.set(0.332, 0.422, 0.04);
  bulb.rotation.z = 2.2;

  g.add(clampBase, joint1, arm1, elbow, arm2, head, bulb);
  g.position.set(-1.22, 0.778, -3.78);
  g.rotation.y = -0.5;   // head reaches over the desk from the left

  const light = new THREE.SpotLight(0xffc27a, 2.6, 3.2, 0.55, 0.65, 2);
  light.position.set(-0.88, 1.16, -3.5);
  light.target.position.set(0.32, 0.76, -3.18);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.02;

  desk.add(g, light, light.target);
}
