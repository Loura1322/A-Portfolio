import * as THREE from 'three';
import { buildRoom, ledStripMats } from './room.js';
import { buildDesk } from './desk.js';
import { setupEffects, onResize } from './effects.js';
import { CameraRig, initSmoothScroll } from './scroll.js';
import { runLoader, buildDots, activateSection } from './ui.js';
import { initCVButtons } from './cv.js';

/* ── environment flags ─────────────────────────────────── */

const isSmall = window.matchMedia('(max-width: 720px)').matches;

/* ── renderer / scene / camera ─────────────────────────── */

const canvas = document.getElementById('webgl');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isSmall,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !isSmall;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.08,
  60,
);

/* ── album art (real covers, used by tablet + posters) ─── */

const albumImages = {
  magnetism: new Image(),
  oula: new Image(),
  oddTimeRock: new Image(),
};
albumImages.magnetism.src = 'assets/albums/magnetism.jpg';
albumImages.oula.src = 'assets/albums/oula.jpg';
albumImages.oddTimeRock.src = 'assets/albums/odd-time-rock.jpg';

/* ── world ─────────────────────────────────────────────── */

const liveScreens = [];   // { update(t, dt) } — canvas painters
buildRoom(scene, liveScreens);
const deskAnim = buildDesk(scene, liveScreens, albumImages);
window.__scene = scene;          // debug handle
window.__dbg = {                 // debug handle
  isReady: () => appReady,
  mainScreen: () => liveScreens.find(s => s.state)?.state?.(),
  camProgress: () => rig.target,
  camera: () => camera,
  rig: () => rig,
  scrollMap: () => scrollMap.anchors(),
  recalc: () => recalcScrollMap(),
};

const { composer, bloom } = setupEffects(scene, camera, renderer);
if (isSmall) bloom.strength = 0.45;

const rig = new CameraRig(camera, window.innerWidth / window.innerHeight);
rig.onSectionChange = activateSection;

const scrollMap = initSmoothScroll(rig);
const { recalc: recalcScrollMap } = scrollMap;
buildDots((i) => {
  scrollMap.scrollToSection(i);
});

/* ── animation loop (single GSAP ticker) ───────────────── */

const clock = new THREE.Clock();
let frame = 0;
let appReady = false;   // live screens start after the loader finishes

const LED_BASES = [new THREE.Color(0x00f0ff), new THREE.Color(0xa855f7), new THREE.Color(0x0077ff)];

gsap.ticker.add(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  frame++;

  rig.update(t, dt);

  // PC fans spin forever
  for (const fan of deskAnim.fans) fan.spinner.rotation.z += dt * 14;

  if (frame % 3 === 0) {
    // mug steam rise
    for (const s of deskAnim.steam) {
      const k = ((s.phase += 0.006) % 2) / 2;
      s.mesh.position.y = 0.876 + k * 0.16;   // starts just above the mug rim
      s.mesh.material.opacity = 0.06 * Math.sin(k * Math.PI);
    }
    // neon breathing
    ledStripMats.forEach((m, i) => {
      const pulse = 0.72 + 0.28 * Math.sin(t * 1.4 + i * 2.1);
      m.color.copy(LED_BASES[i]).multiplyScalar(0.35 + 0.65 * pulse);
    });
    if (deskAnim.keyboardGlow) {
      // almost off — a faint hint only
      deskAnim.keyboardGlow.color.setHex(0x00b8cc).multiplyScalar(0.16 + 0.06 * Math.sin(t * 2.3));
    }
  }

  // live screens at ~1/3 rate — only after boot (typing starts post-loader)
  if (appReady && frame % 3 === 0) {
    for (const scr of liveScreens) scr.update(t, dt * 3);
  }

  composer.render();
});

/* ── resize (debounced — rebuilds camera path + scroll map) ── */

let resizeTimer = null;
window.addEventListener('resize', () => {
  onResize(renderer, composer, camera);
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    rig.setAspectRatio(window.innerWidth / window.innerHeight);
    recalcScrollMap();
  }, 150);
});

/* ── boot ──────────────────────────────────────────────── */

history.scrollRestoration = 'manual';
window.addEventListener('pageshow', (e) => {
  if (e.persisted) recalcScrollMap();
  else window.scrollTo(0, 0);
});
const navEntry = performance.getEntriesByType('navigation')[0];
if (!navEntry || navEntry.type !== 'back_forward') {
  window.scrollTo(0, 0);
}

// the webfonts land after first paint and reflow the commit list —
// re-measure so the pinned stretch matches the final layout.
// use a single coordinated recalc after BOTH fonts and loader are ready
// so anchors never shift mid-way through a dot navigation.
const fontsReady = document.fonts?.ready ?? Promise.resolve();
const loaderPromise = runLoader();

Promise.all([fontsReady, loaderPromise]).then(() => {
  appReady = true;
  recalcScrollMap();
  activateSection(rig.activeSection);
});
// keep a lightweight early recalc for fonts that resolve before loader,
// but debounced so it cannot hijack an in-flight programmatic scroll
let fontsRecalcTimer = null;
fontsReady.then(() => {
  clearTimeout(fontsRecalcTimer);
  fontsRecalcTimer = setTimeout(() => {
    if (!appReady) recalcScrollMap();
  }, 80);
});

/* ── cv download + theme toggle ────────────────────────── */
initCVButtons();
