/* ═══════════════════════════════════════════════
   UI — loader boot sequence, section reveals,
   nav dots, stat counters.
   ═══════════════════════════════════════════════ */

const BOOT_LINES = [
  '[ ok ] mounting /dev/room .............. done',
  '[ ok ] spawning monitors x3 ........... done',
  '[ ok ] calibrating neon LEDs .......... done',
  '[ ok ] brewing coffee ................. 96%',
  '[ ok ] camera rig online',
  'welcome to the dev cave.',
];

export function runLoader() {
  const loaderEl = document.getElementById('loader');
  const logEl = document.getElementById('boot-log');
  const fill = document.getElementById('loader-fill');

  return new Promise((resolve) => {
    let li = 0, ci = 0;
    const start = performance.now();

    function tick() {
      const elapsed = performance.now() - start;

      if (li < BOOT_LINES.length) {
        const speed = 34; // chars per frame-ish
        for (let n = 0; n < speed && li < BOOT_LINES.length; n++) {
          ci++;
          if (ci >= BOOT_LINES[li].length) {
            logEl.textContent += BOOT_LINES[li] + '\n';
            li++; ci = 0;
            fill.style.width = `${Math.round((li / BOOT_LINES.length) * 100)}%`;
          }
        }
        if (li < BOOT_LINES.length && ci > 0) {
          logEl.textContent = BOOT_LINES.slice(0, li).join('\n') +
            (li ? '\n' : '') + BOOT_LINES[li].slice(0, ci);
        }
        requestAnimationFrame(tick);
      } else if (elapsed > 1500) {
        fill.style.width = '100%';
        setTimeout(() => {
          loaderEl.classList.add('done');
          resolve();
        }, 350);
      } else {
        requestAnimationFrame(tick);
      }
    }
    tick();
  });
}

/* ── nav dots ───────────────────────────────────────── */

const SECTION_LABELS = ['home', 'about', 'experience', 'skills', 'projects', 'contact'];

export function buildDots(onGoto) {
  const nav = document.getElementById('dots');
  SECTION_LABELS.forEach((label, i) => {
    const d = document.createElement('button');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.dataset.label = label;
    d.setAttribute('aria-label', label);
    d.addEventListener('click', () => onGoto(i));
    nav.appendChild(d);
  });
  return nav;
}

export function setDotsActive(idx) {
  document.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
}

/* ── panel activation + counters ────────────────────── */

const panels = [...document.querySelectorAll('.panel')];
let counted = new Set();

function animateCounters(section) {
  section.querySelectorAll('[data-count]').forEach((el) => {
    if (counted.has(el)) return;
    counted.add(el);
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const dur = 1400;
    const t0 = performance.now();

    (function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en') + (k === 1 ? suffix : '');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  });
}

export function activateSection(idx) {
  panels.forEach((p, i) => {
    p.classList.toggle('active', i === idx);
  });
  setDotsActive(idx);

  if (idx === 1) animateCounters(panels[1]);
}
