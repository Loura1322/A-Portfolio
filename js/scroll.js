import * as THREE from 'three';
import { mainScreenCenter } from './desk.js';
import { PIN_SECTIONS, measurePins, setPinsProgress } from './pin.js';

/* ═══════════════════════════════════════════════
   CAMERA RIG — scroll-driven cinematic path with
   responsive framing.

   Every stop has a desktop keyframe + a `portrait`
   keyframe. The two are softly blended based on the
   viewport aspect ratio, curves are rebuilt on resize,
   and fov is compensated so horizontal coverage holds
   across aspect ratios.
   ═══════════════════════════════════════════════ */

export const SECTION_COUNT = 6;

const STOPS = [
  { // 0 · HERO — tight on the name screen
    pos: new THREE.Vector3(0.16, 1.21, -2.96),
    look: new THREE.Vector3(0.28, 1.29, -3.72),
    fov: 50,
    portrait: {
      pos: new THREE.Vector3(0.26, 1.5, -2.0),
      look: new THREE.Vector3(0.27, 1.33, -3.72),
      fov: 60,
    },
  },
  { // 1 · ABOUT — pulled-back 3/4 of the whole setup
    pos: new THREE.Vector3(-2.05, 1.85, -0.75),
    look: new THREE.Vector3(0.45, 1.02, -3.55),
    fov: 55,
    portrait: {
      pos: new THREE.Vector3(-2.6, 1.95, 0.15),
      look: new THREE.Vector3(0.45, 1.0, -3.5),
      fov: 64,
    },
  },
  { // 2 · EXPERIENCE — low angle from behind the chair, mic foreground
    pos: new THREE.Vector3(-1.15, 1.32, -1.5),
    look: new THREE.Vector3(0.38, 1.24, -3.66),
    fov: 55,
    portrait: {
      pos: new THREE.Vector3(-1.55, 1.36, -0.85),
      look: new THREE.Vector3(0.38, 1.24, -3.66),
      fov: 63,
    },
  },
  { // 3 · SKILLS — over-the-shoulder from the right of the chair
    pos: new THREE.Vector3(0.82, 1.36, -2.12),
    look: new THREE.Vector3(0.16, 1.25, -3.7),
    fov: 55,
    portrait: {
      pos: new THREE.Vector3(1.1, 1.42, -1.62),
      look: new THREE.Vector3(0.16, 1.25, -3.7),
      fov: 63,
    },
  },
  { // 4 · PROJECTS — cozy bed corner: lamp glow + albums + rug
    pos: new THREE.Vector3(0.3, 2.0, 2.3),
    look: new THREE.Vector3(1.1, 0.7, -2.9),
    fov: 58,
    portrait: {
      pos: new THREE.Vector3(0.55, 2.15, 2.45),
      look: new THREE.Vector3(1.1, 0.6, -2.9),
      fov: 68,
    },
  },
  { // 5 · CONTACT — full-room wide sweep, right (bed) → left (window)
    pos: new THREE.Vector3(0, 2.3, 2.45),
    look: new THREE.Vector3(-0.8, 0.9, -2.6),
    fov: 68,
    portrait: { // portrait favours the window — bed can't fit a narrow frame
      pos: new THREE.Vector3(0.7, 1.75, 2.1),
      look: new THREE.Vector3(-2.7, 1.35, -1.3),
      fov: 76,
    },
  },
];

const HOLD = 0.36;
const REF_ASPECT = 2.0;          // aspect the desktop keyframes were tuned at

function smoothstep(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export class CameraRig {
  constructor(camera, aspect = 2.0) {
    this.camera = camera;
    this.progress = 0;
    this.target = 0;
    this.activeSection = 0;
    this.onSectionChange = null;

    this.stops = [];
    this.curves = [];
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();

    this.setAspectRatio(aspect);

    camera.position.copy(this.stops[0].pos);
    camera.lookAt(this.stops[0].look);
  }

  /** blend desktop/portrait keyframes for the current aspect + rebuild path */
  setAspectRatio(aspect) {
    this.aspect = aspect;
    const blend = 1 - smoothstep(0.9, 1.4, aspect);   // 0 = desktop, 1 = portrait

    this.stops = STOPS.map((s) => {
      const p = s.portrait;
      return {
        pos: s.pos.clone().lerp(p.pos, blend),
        look: s.look.clone().lerp(p.look, blend),
        fov: THREE.MathUtils.lerp(s.fov, p.fov, blend),
      };
    });

    // swooping bezier per segment (control point lifted + alternating side)
    this.curves = [];
    for (let i = 0; i < this.stops.length - 1; i++) {
      const a = this.stops[i].pos, b = this.stops[i + 1].pos;
      const ctrl = a.clone().lerp(b, 0.5);
      const dir = b.clone().sub(a);
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      ctrl.addScaledVector(side, i % 2 ? 0.5 : -0.5);
      ctrl.y += 0.32;
      this.curves.push(new THREE.QuadraticBezierCurve3(a, ctrl, b));
    }
  }

  setProgress(p01) {
    this.target = THREE.MathUtils.clamp(p01, 0, 1);
  }

  update(t, dt) {
    const k = 1 - Math.exp(-dt * 4.2);
    this.progress += (this.target - this.progress) * k;

    const N = this.stops.length;
    const segLen = 1 / (N - 1);
    const p = THREE.MathUtils.clamp(this.progress, 0, 1);

    let i = Math.min(Math.floor(p / segLen), N - 2);
    let local = (p - i * segLen) / segLen;

    const h = HOLD;
    let eased;
    if (local < h) eased = 0;
    else if (local > 1 - h) eased = 1;
    else {
      const x = (local - h) / (1 - 2 * h);
      eased = x * x * (3 - 2 * x);
    }

    this.curves[i].getPoint(eased, this._pos);
    this._look.lerpVectors(this.stops[i].look, this.stops[i + 1].look, eased);

    // per-stop fov + horizontal-coverage compensation for the live aspect
    let fov = THREE.MathUtils.lerp(this.stops[i].fov, this.stops[i + 1].fov, eased);
    const half = THREE.MathUtils.degToRad(fov) / 2;
    const comp = THREE.MathUtils.radToDeg(Math.atan(Math.tan(half) * (REF_ASPECT / this.aspect)));
    fov = THREE.MathUtils.clamp(fov + (comp - fov) * 0.55, 45, 92);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // idle breathing
    const swayX = Math.sin(t * 0.45) * 0.007;
    const swayY = Math.sin(t * 0.72) * 0.005;
    const swayLX = Math.sin(t * 0.3) * 0.012;

    this.camera.position.set(this._pos.x + swayX, this._pos.y + swayY, this._pos.z);
    this.camera.lookAt(this._look.x + swayLX, this._look.y, this._look.z);

    let nearest = 0, bestDist = Infinity;
    for (let s = 0; s < N; s++) {
      const d = Math.abs(this.target - s / (N - 1));
      if (d < bestDist) { bestDist = d; nearest = s; }
    }
    if (nearest !== this.activeSection) {
      this.activeSection = nearest;
      this.onSectionChange?.(nearest);
    }
  }
}

/* ── smooth scrolling plumbing (Lenis + GSAP ticker) ── */

export function initSmoothScroll(rig) {
  /* eslint-disable no-undef */
  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({
    duration: 1.35,
    easing: (x) => Math.min(1, 1.001 - Math.pow(2, -10 * x)),
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  window.__lenis = lenis; // debug/testing handle

  /* ── section-aware scroll map ──────────────────────────
     Panels are no longer all one viewport tall: the pinned
     experience section owns an extra stretch of scroll that
     must NOT move the camera. So instead of the flat
     scrollY / maxScroll ratio we build an anchor table —
     each section gets a scroll range [y0, y1] over which the
     camera progress stays put, and the camera only travels
     between one section's y1 and the next one's y0.        */

  const panels = [...document.querySelectorAll('.panel')];
  let anchors = [];

  function buildAnchors() {
    const pins = measurePins();

    anchors = panels.map((el, i) => {
      const y0 = el.offsetTop;
      let extra = 0;
      if (i === PIN_SECTIONS.commit) extra = pins.commit;
      if (i === PIN_SECTIONS.project) extra = pins.project;
      return {
        y0,
        y1: y0 + extra,
        p: i / (SECTION_COUNT - 1),
      };
    });
  }

  /** scroll position that frames section `i` — used by dots & [data-goto] */
  function sectionScrollY(i) {
    return anchors[i]?.y0 ?? 0;
  }

  /** camera progress for a given scroll offset */
  function cameraProgress(y) {
    const last = anchors.length - 1;

    if (y <= anchors[0].y0) return anchors[0].p;
    if (y >= anchors[last].y1) return anchors[last].p;

    for (let i = 0; i <= last; i++) {
      const a = anchors[i];

      // inside a section's hold range — camera parked
      if (y <= a.y1) return a.p;

      // in the gap between this section and the next — camera travels
      const b = anchors[i + 1];
      if (b && y < b.y0) {
        const k = (y - a.y1) / (b.y0 - a.y1);
        return a.p + (b.p - a.p) * k;
      }
    }
    return anchors[last].p;
  }

  /* pin progress per-section — 0..1 through each pinned stretch,
     so each list stays parked at the bottom once you scroll past */
  function pinProgresses(y) {
    const out = {};
    for (const [key, idx] of Object.entries(PIN_SECTIONS)) {
      const a = anchors[idx];
      const span = a ? a.y1 - a.y0 : 0;
      out[key] = span > 0 ? (y - a.y0) / span : 0;
    }
    return out;
  }

  buildAnchors();

  gsap.ticker.add(() => {
    const y = window.scrollY;
    rig.setProgress(cameraProgress(y));
    setPinsProgress(pinProgresses(y));
  });

  /* ── snap-to-section ───────────────────────────────────
     Sections are only ever half-crossed while the user is mid-flick. Once the
     scroll goes quiet in one of the travel gaps we finish the trip for them,
     so the camera always comes to rest on a framed stop and the reveal
     choreography never plays half-way.

     Ranges that a section *owns* (the pinned commit list) are left alone —
     snapping there would yank the list out from under whoever is reading it. */

  const SNAP_IDLE = 140;    // ms of quiet before we take over
  const SNAP_AHEAD = 0.2;   // committed to the next stop after 20% of the gap

  let snapTimer = null;
  let releaseTimer = null;
  let snapping = false;
  let programmaticUntil = 0; // guard: dot navigation owns the scroll for a while
  let lastY = window.scrollY;
  let dir = 1;

  function trySnap() {
    if (snapping) return;
    if (performance.now() < programmaticUntil) return;
    const y = window.scrollY;

    // already parked on a stop (or inside the pinned stretch) — nothing to do
    for (const a of anchors) {
      if (y >= a.y0 - 1 && y <= a.y1 + 1) return;
    }

    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (y <= a.y1 || y >= b.y0) continue;

      const k = (y - a.y1) / (b.y0 - a.y1);
      // a nudge in the travel direction is enough; a nudge against it rewinds
      const forward = dir > 0 ? k > SNAP_AHEAD : k > 1 - SNAP_AHEAD;
      const target = forward ? b.y0 : a.y1;
      const duration = 0.7 + Math.abs(forward ? 1 - k : k) * 0.6;

      snapping = true;
      lenis.scrollTo(target, {
        duration,
        easing: (x) => 1 - Math.pow(1 - x, 3),
        onComplete: () => { snapping = false; },
      });
      // Lenis drops onComplete when the user grabs the scroll back mid-flight,
      // so make sure the flag can never latch on
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => { snapping = false; }, duration * 1000 + 260);
      return;
    }
  }

  lenis.on('scroll', ({ scroll }) => {
    if (Math.abs(scroll - lastY) > 0.5) dir = scroll > lastY ? 1 : -1;
    lastY = scroll;
    if (snapping) return;
    clearTimeout(snapTimer);
    snapTimer = setTimeout(trySnap, SNAP_IDLE);
  });

  function doProgrammaticScroll(target) {
    const dist = Math.abs(target - window.scrollY);
    const duration = Math.min(2.8, Math.max(0.9, 0.9 + (dist / 1800) * 0.9));
    programmaticUntil = performance.now() + duration * 1000 + 350;
    snapping = true;
    clearTimeout(snapTimer);
    lenis.scrollTo(target, {
      duration,
      easing: (x) => 1 - Math.pow(1 - x, 3),
      onComplete: () => { snapping = false; },
    });
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { snapping = false; }, duration * 1000 + 260);
  }

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      buildAnchors();
      const idx = Number(el.dataset.goto);
      const target = anchors[idx]?.y0 ?? 0;
      doProgrammaticScroll(target);
    });
  });

  function scrollToSection(idx) {
    buildAnchors();
    const target = anchors[idx]?.y0 ?? 0;
    doProgrammaticScroll(target);
  }

  return {
    lenis,
    sectionScrollY,
    scrollToSection,
    recalc: buildAnchors,
    anchors: () => anchors,
    cancelSnap: () => clearTimeout(snapTimer),
  };
}
