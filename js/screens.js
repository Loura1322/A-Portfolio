import * as THREE from 'three';

/* ═══════════════════════════════════════════════
   LIVE SCREENS — canvas-texture painters with a
   shared CRT post-processing pipeline so every
   screen reads like real glass + phosphor.
   ═══════════════════════════════════════════════ */

const MONO = "'JetBrains Mono', Consolas, monospace";

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ── CRT FX PIPELINE ──────────────────────────────────
   Pre-baked overlays (noise + grille) for speed, then
   per-frame: scanlines, vignette, grain, flicker,
   glass reflection. Text itself uses crtText() for
   phosphor glow + chromatic fringe.                    */

const noiseCanvas = (() => {
  const c = makeCanvas(160, 160);
  const x = c.getContext('2d');
  const img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
})();

const grilleCanvas = (() => {
  const c = makeCanvas(3, 4);
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,60,60,0.05)'; x.fillRect(0, 0, 1, 4);
  x.fillStyle = 'rgba(60,255,90,0.05)'; x.fillRect(1, 0, 1, 4);
  x.fillStyle = 'rgba(80,120,255,0.05)'; x.fillRect(2, 0, 1, 4);
  return c;
})();

/* static overlays (grille + scanlines + vignette) pre-baked per size */
const overlayCache = new Map();

function getOverlay(W, H, scanlineGap, scanlineAlpha, vignette) {
  const key = `${W}x${H}|${scanlineGap}|${scanlineAlpha}|${vignette}`;
  if (overlayCache.has(key)) return overlayCache.get(key);

  const c = makeCanvas(W, H);
  const x = c.getContext('2d');

  // grille
  x.save();
  x.globalAlpha = 0.6;
  x.fillStyle = x.createPattern(grilleCanvas, 'repeat');
  x.fillRect(0, 0, W, H);
  x.restore();

  // scanlines
  x.fillStyle = `rgba(0,0,0,${scanlineAlpha})`;
  for (let y = 0; y < H; y += scanlineGap) x.fillRect(0, y, W, 1);

  // vignette
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,6,${vignette})`);
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);

  overlayCache.set(key, c);
  return c;
}

function applyScreenFX(ctx, W, H, t, opts = {}) {
  const {
    scanlineGap = 3, scanlineAlpha = 0.13,
    vignette = 0.34, grain = 0.05,
    reflection = true,
  } = opts;

  // baked static layer — single blit
  ctx.drawImage(getOverlay(W, H, scanlineGap, scanlineAlpha, vignette), 0, 0);

  // rolling refresh band (very subtle, slow)
  const bandY = ((t * 40) % (H + 220)) - 110;
  const band = ctx.createLinearGradient(0, bandY - 90, 0, bandY + 90);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(210,235,255,0.016)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - 90, W, 180);

  // film grain — deterministic phase, changes 5×/s (no per-frame static storm)
  ctx.save();
  ctx.globalAlpha = grain;
  ctx.globalCompositeOperation = 'overlay';
  const seed = Math.floor(t * 5);
  ctx.translate(-((seed * 97) % 160), -((seed * 53) % 160));
  ctx.fillStyle = ctx.createPattern(noiseCanvas, 'repeat');
  ctx.fillRect(0, 0, W + 160, H + 160);
  ctx.restore();

  // flicker — barely-there brightness wobble
  const flick = 0.006 * Math.sin(t * 47) + 0.004 * Math.sin(t * 8.3);
  ctx.fillStyle = flick > 0
    ? `rgba(200,225,255,${flick})` : `rgba(0,0,20,${-flick})`;
  ctx.fillRect(0, 0, W, H);

  // glass reflection: diagonal sheen + room-light blob
  if (reflection) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sheen = ctx.createLinearGradient(0, 0, W * 0.7, H);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0.028)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    sheen.addColorStop(0.58, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
    const blob = ctx.createRadialGradient(W * 0.12, H * 0.85, 0, W * 0.12, H * 0.85, W * 0.3);
    blob.addColorStop(0, 'rgba(0,240,255,0.05)');
    blob.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/** phosphor-glow text with chromatic fringe */
function crtText(ctx, text, x, y, color, size, blur = 14) {
  ctx.save();
  ctx.font = `600 ${size}px ${MONO}`;
  // chromatic fringe (subtle)
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#ff3844';
  ctx.fillText(text, x - 0.8, y);
  ctx.fillStyle = '#2ee8ff';
  ctx.fillText(text, x + 0.8, y);
  // phosphor glow
  ctx.globalAlpha = 0.42;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  // crisp core
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ── MAIN SCREEN · terminal: name → skills → namjoo ──── */

export function createMainScreen() {
  const W = 1024, H = 600;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const texture = toTexture(canvas);

  const script = [
    { kind: 'cmd', text: 'whoami' },
    { kind: 'out', text: 'MORTEZA VAEZI', cls: 'name' },
    { kind: 'cmd', text: '' },
  ];

  const COLORS = {
    cmd: '#d8e2ec', name: '#ffd866', ok: '#37e6a0',
    dim: '#7d8aa0', link: '#00f0ff', music: '#ff7bd2', bar: '#37e6a0',
  };

  const PROMPT = 'morteza@devcave ~ $ ';
  let lineIdx = 0;
  let charCount = 0;
  let pause = 0;       // short beat between lines
  let done = false;    // typed once on first load — then stays put
  let blink = 0;

  function drawLine(l, y) {
    if (l.kind === 'cmd') {
      ctx.font = `500 26px ${MONO}`;
      ctx.fillStyle = '#6b7a90';
      ctx.fillText(PROMPT, 46, y);
      ctx.fillStyle = COLORS.cmd;
      ctx.fillText(l.text, 46 + ctx.measureText(PROMPT).width, y);
    } else if (l.cls === 'name') {
      crtText(ctx, l.text, 46, y, COLORS.name, 42, 18);
    } else if (l.kind === 'bar') {
      const label = l.text + ' '.repeat(Math.max(0, 27 - l.text.length));
      ctx.font = `500 22px ${MONO}`;
      ctx.fillStyle = '#aab8cc';
      ctx.fillText(label, 78, y);
      const filled = Math.round((l.pct / 100) * 12);
      const cells = '█'.repeat(filled) + '░'.repeat(12 - filled);
      ctx.fillStyle = COLORS.bar;
      ctx.fillText(cells, 78 + ctx.measureText(label).width + 14, y);
      ctx.fillStyle = '#e8f0ff';
      ctx.fillText(String(l.pct), 78 + ctx.measureText(label).width + 14 +
        ctx.measureText(cells).width + 16, y);
    } else {
      const size = l.cls === 'music' ? 27 : 24;
      ctx.font = `500 ${size}px ${MONO}`;
      ctx.fillStyle = COLORS[l.cls] || '#fff';
      ctx.fillText(l.text, l.cls === 'dim' ? 78 : 46, y);
    }
    ctx.font = `500 26px ${MONO}`;
  }

  function draw(t) {
    // background + window chrome — lit enough to read as "on"
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#131c28');
    bg.addColorStop(1, '#0d141d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#10161f';
    ctx.fillRect(0, 0, W, 46);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(30 + i * 30, 23, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#3d4a5c';
    ctx.font = `15px ${MONO}`;
    ctx.fillText('morteza@devcave: ~/portfolio', 130, 29);

    ctx.font = `500 26px ${MONO}`;
    let y = 118;
    for (let i = 0; i < lineIdx; i++) {
      drawLine(script[i], y);
      y += script[i].kind === 'bar' ? 40 : 48;
    }

    // current line
    if (lineIdx < script.length) {
      const l = script[lineIdx];
      if (l.kind === 'cmd') {
        ctx.font = `500 26px ${MONO}`;
        ctx.fillStyle = '#6b7a90';
        ctx.fillText(PROMPT, 46, y);
        const shown = l.text.slice(0, Math.floor(charCount));
        ctx.fillStyle = '#7fdce8';
        ctx.fillText(shown, 46 + ctx.measureText(PROMPT).width, y);
        if (Math.floor(blink * 2.4) % 2 === 0) {
          ctx.fillStyle = '#9fd8e8';
          ctx.fillRect(46 + ctx.measureText(PROMPT).width +
            ctx.measureText(shown).width + 5, y - 20, 11, 24);
        }
      } else if (l.kind === 'bar') {
        drawLine({ ...l, text: l.text.slice(0, Math.floor(charCount)) }, y);
      }
    } else if (Math.floor(blink * 2.4) % 2 === 0) {
      ctx.fillStyle = '#9fd8e8';
      ctx.fillRect(50, y - 20, 11, 24);
    }

    // inner screen-edge shadow (panel inset)
    const edge = ctx.createLinearGradient(0, 0, 0, 26);
    edge.addColorStop(0, 'rgba(0,0,0,0.4)');
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 46, W, 26);

    applyScreenFX(ctx, W, H, t, { scanlineAlpha: 0.08, vignette: 0.2, grain: 0.04 });
    texture.needsUpdate = true;
  }

  function update(t, dt) {
    blink += dt;
    if (pause > 0) { pause -= dt; return; }

    // typed once on first load — afterwards only the cursor keeps blinking
    if (lineIdx >= script.length) { draw(t); return; }

    const l = script[lineIdx];
    if (l.kind === 'cmd') {
      charCount += dt * 6.5;   // slow, visible fake-typing
      if (charCount >= l.text.length) {
        if (l.text === '') { done = true; }
        else { pause = 0.35; }
        charCount = 0;
        lineIdx++;
      }
    } else {
      lineIdx++;
      pause = l.cls === 'name' ? 1.1 : 0.5;
    }
    draw(t);
  }

  draw(0);
  return { texture, update, state: () => ({ lineIdx, charCount, done }) };
}

/* ── TABLET · namjoo music player ────────────────────── */

export function createTabletScreen(albumImage) {
  const W = 512, H = 728;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const texture = toTexture(canvas);

  const TRACKS = [
    ['Magnetism', 'Kabin · 2024', '3:56'],
    ['Oula', 'Oula · 2022', '4:31'],
    ['Odd Time Rock', 'Odd Time Rock · 2021', '3:48'],
  ];
  let trackIdx = 0;
  let pos = 47; // seconds into track
  const DUR = 236;
  const eq = Array.from({ length: 9 }, () => Math.random());
  let acc = 0;

  function parseDur(str) {
    const [m, s] = str.split(':').map(Number);
    return m * 60 + s;
  }

  function draw(t) {
    const [title, meta, durStr] = TRACKS[trackIdx];
    const dur = parseDur(durStr);

    // bg
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#232c3d');
    bg.addColorStop(1, '#151b28');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // status bar
    ctx.font = `600 17px ${MONO}`;
    ctx.fillStyle = '#b9c8dd';
    ctx.fillText('23:47', 24, 34);
    ctx.fillText('100%', W - 78, 34);
    ctx.fillStyle = '#37e6a0';
    ctx.fillRect(W - 34, 22, 5, 12);
    ctx.fillRect(W - 27, 25, 5, 9);

    // album art (real cover once loaded)
    const ax = 56, ay = 66, as = W - 112;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    if (albumImage && albumImage.complete && albumImage.naturalWidth) {
      ctx.drawImage(albumImage, ax, ay, as, as);
    } else {
      const ph = ctx.createLinearGradient(ax, ay, ax + as, ay + as);
      ph.addColorStop(0, '#2a3348');
      ph.addColorStop(1, '#1a2231');
      ctx.fillStyle = ph;
      ctx.fillRect(ax, ay, as, as);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.strokeRect(ax - 0.5, ay - 0.5, as + 1, as + 1);

    // track info
    ctx.font = `bold 28px ${MONO}`;
    ctx.fillStyle = '#f4f8fd';
    ctx.fillText(title, 40, ay + as + 52);
    ctx.font = `16px ${MONO}`;
    ctx.fillStyle = '#9fb0c7';
    ctx.fillText(`Mohsen Namjoo  ·  ${meta}`, 40, ay + as + 80);

    // progress bar
    const py = ay + as + 112;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(40, py, W - 80, 5);
    const k = pos / dur;
    const grad = ctx.createLinearGradient(40, 0, W - 40, 0);
    grad.addColorStop(0, '#c084fc');
    grad.addColorStop(1, '#22e6ff');
    ctx.fillStyle = grad;
    ctx.fillRect(40, py, (W - 80) * k, 5);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(40 + (W - 80) * k, py + 2.5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = '#9fb0c7';
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    ctx.fillText(fmt(pos), 40, py + 26);
    const rt = fmt(dur - pos);
    ctx.fillText(rt, W - 40 - ctx.measureText(rt).width, py + 26);

    // equalizer
    const ex = 40, ey = py + 56, ew = W - 80;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(ex, ey, ew, 54);
    const bw = ew / eq.length;
    eq.forEach((v, i) => {
      const h = 6 + v * 42;
      const g = ctx.createLinearGradient(0, ey + 54 - h, 0, ey + 54);
      g.addColorStop(0, '#22e6ff');
      g.addColorStop(1, '#c084fc');
      ctx.fillStyle = g;
      ctx.fillRect(ex + i * bw + 5, ey + 54 - h, bw - 10, h);
    });

    // controls
    const cy = ey + 96;
    ctx.fillStyle = '#d5deeb';
    // prev
    ctx.beginPath();
    ctx.moveTo(W / 2 - 62, cy - 12); ctx.lineTo(W / 2 - 62, cy + 12);
    ctx.lineTo(W / 2 - 38, cy); ctx.closePath(); ctx.fill();
    ctx.fillRect(W / 2 - 68, cy - 12, 5, 24);
    // next
    ctx.beginPath();
    ctx.moveTo(W / 2 + 62, cy - 12); ctx.lineTo(W / 2 + 62, cy + 12);
    ctx.lineTo(W / 2 + 38, cy); ctx.closePath(); ctx.fill();
    ctx.fillRect(W / 2 + 63, cy - 12, 5, 24);
    // play/pause
    ctx.fillStyle = '#f4f8fd';
    if (Math.floor(t) % 4 !== 3) {
      ctx.fillRect(W / 2 - 14, cy - 14, 9, 28);
      ctx.fillRect(W / 2 + 5, cy - 14, 9, 28);
    } else {
      ctx.beginPath();
      ctx.moveTo(W / 2 - 10, cy - 15); ctx.lineTo(W / 2 + 15, cy);
      ctx.lineTo(W / 2 - 10, cy + 15); ctx.closePath(); ctx.fill();
    }

    // volume
    const vy = cy + 42;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(40, vy, W - 80, 4);
    ctx.fillStyle = '#b9c8dd';
    ctx.fillRect(40, vy, (W - 80) * 0.72, 4);

    applyScreenFX(ctx, W, H, t, { vignette: 0.3, scanlineAlpha: 0.07, grain: 0.035 });
    texture.needsUpdate = true;
  }

  function update(t, dt) {
    pos += dt;
    const dur = parseDur(TRACKS[trackIdx][2]);
    if (pos >= dur) {
      pos = 0;
      trackIdx = (trackIdx + 1) % TRACKS.length;
    }
    acc += dt;
    if (acc > 0.12) {
      acc = 0;
      for (let i = 0; i < eq.length; i++) {
        const target = 0.35 + 0.65 * Math.abs(Math.sin(t * (2.1 + i * 0.7) + i * 1.7));
        eq[i] += (target - eq[i]) * 0.4;
      }
    }
    draw(t);
  }

  draw(0);
  return { texture, update };
}

/* ── POSTERS — fallback art if album images fail ─────── */

export function posterJS() {
  const c = makeCanvas(512, 720);
  const x = c.getContext('2d');
  x.fillStyle = '#0b0e16';
  x.fillRect(0, 0, 512, 720);
  x.fillStyle = 'rgba(0,240,255,0.08)';
  for (let i = 20; i < 512; i += 34) for (let j = 20; j < 720; j += 34) x.fillRect(i, j, 2.5, 2.5);
  x.font = `bold 190px ${MONO}`;
  x.fillStyle = '#00f0ff';
  x.shadowColor = 'rgba(0,240,255,0.8)';
  x.shadowBlur = 42;
  x.fillText('</>', 66, 380);
  x.shadowBlur = 0;
  x.font = `bold 34px ${MONO}`;
  x.fillStyle = '#e8f0ff';
  x.fillText('JAVASCRIPT', 96, 500);
  x.font = `18px ${MONO}`;
  x.fillStyle = '#7d8aa0';
  x.fillText('est. 1995 · still winning', 116, 540);
  x.strokeStyle = 'rgba(0,240,255,0.35)';
  x.lineWidth = 3;
  x.strokeRect(14, 14, 484, 692);
  return toTexture(c);
}

export function posterGit() {
  const c = makeCanvas(512, 720);
  const x = c.getContext('2d');
  x.fillStyle = '#0a0c12';
  x.fillRect(0, 0, 512, 720);
  const nodes = [[90, 560], [180, 480], [270, 500], [360, 400], [450, 430], [200, 330], [330, 250], [420, 160]];
  x.strokeStyle = '#a855f7';
  x.lineWidth = 7;
  x.shadowColor = 'rgba(168,85,247,0.8)';
  x.shadowBlur = 22;
  x.beginPath();
  x.moveTo(nodes[0][0], nodes[0][1]);
  nodes.slice(1).forEach(n => x.lineTo(n[0], n[1]));
  x.stroke();
  x.shadowBlur = 0;
  nodes.forEach((n, i) => {
    x.fillStyle = i % 2 ? '#00f0ff' : '#37e6a0';
    x.beginPath();
    x.arc(n[0], n[1], 13, 0, Math.PI * 2);
    x.fill();
  });
  x.font = `bold 40px ${MONO}`;
  x.fillStyle = '#e8f0ff';
  x.fillText('GIT LOG', 150, 100);
  x.font = `17px ${MONO}`;
  x.fillStyle = '#7d8aa0';
  x.fillText('--commit everything', 152, 138);
  return toTexture(c);
}

export function posterReact() {
  const c = makeCanvas(512, 720);
  const x = c.getContext('2d');
  x.fillStyle = '#0d0f1a';
  x.fillRect(0, 0, 512, 720);
  x.translate(256, 300);
  x.strokeStyle = '#61dafb';
  x.lineWidth = 11;
  x.shadowColor = 'rgba(97,218,251,0.75)';
  x.shadowBlur = 30;
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.ellipse(0, 0, 165, 64, (i * Math.PI) / 3, 0, Math.PI * 2);
    x.stroke();
  }
  x.fillStyle = '#61dafb';
  x.beginPath();
  x.arc(0, 0, 30, 0, Math.PI * 2);
  x.fill();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.shadowBlur = 0;
  x.font = `bold 44px ${MONO}`;
  x.fillStyle = '#e8f0ff';
  x.fillText('REACT', 172, 590);
  x.font = `17px ${MONO}`;
  x.fillStyle = '#7d8aa0';
  x.fillText('UI = f(state)', 186, 630);
  return toTexture(c);
}

/* ── WINDOW CITY + RAIN ─────────────────────────────── */

export function createCityView() {
  const W = 1024, H = 1024;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');

  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#020208');
  sky.addColorStop(0.55, '#0a1030');
  sky.addColorStop(0.8, '#1a1440');
  sky.addColorStop(1, '#2a1a4a');
  x.fillStyle = sky;
  x.fillRect(0, 0, W, H);

  x.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 140; i++) {
    const sx = Math.random() * W, sy = Math.random() * H * 0.55;
    x.globalAlpha = Math.random() * 0.7 + 0.15;
    x.fillRect(sx, sy, Math.random() > 0.9 ? 2.5 : 1.5, Math.random() > 0.9 ? 2.5 : 1.5);
  }
  x.globalAlpha = 1;

  const mg = x.createRadialGradient(760, 170, 10, 760, 170, 150);
  mg.addColorStop(0, 'rgba(220,230,255,0.95)');
  mg.addColorStop(0.12, 'rgba(200,215,255,0.5)');
  mg.addColorStop(1, 'rgba(150,170,255,0)');
  x.fillStyle = mg;
  x.fillRect(560, 0, 460, 340);
  x.fillStyle = '#e8edff';
  x.beginPath();
  x.arc(760, 170, 34, 0, Math.PI * 2);
  x.fill();

  x.fillStyle = '#0a0d1f';
  for (let bx = 0; bx < W; ) {
    const bw = 40 + Math.random() * 80;
    const bh = 120 + Math.random() * 220;
    x.fillRect(bx, H - bh, bw, bh);
    bx += bw + 6;
  }

  for (let bx = -20; bx < W + 20; ) {
    const bw = 70 + Math.random() * 110;
    const bh = 260 + Math.random() * 320;
    const by = H - bh;
    x.fillStyle = '#12152c';
    x.fillRect(bx, by, bw, bh);
    if (Math.random() > 0.6) {
      x.fillStyle = '#12152c';
      x.fillRect(bx + bw / 2 - 2, by - 40 - Math.random() * 50, 4, 60);
    }
    for (let wy = by + 16; wy < H - 20; wy += 26) {
      for (let wx = bx + 10; wx < bx + bw - 12; wx += 22) {
        if (Math.random() > 0.62) {
          x.fillStyle = Math.random() > 0.15 ? 'rgba(255,196,110,0.85)' : 'rgba(120,230,255,0.85)';
          x.fillRect(wx, wy, 10, 13);
        }
      }
    }
    bx += bw + 10;
  }

  const haze = x.createLinearGradient(0, H - 240, 0, H);
  haze.addColorStop(0, 'rgba(90,60,160,0)');
  haze.addColorStop(1, 'rgba(120,80,200,0.28)');
  x.fillStyle = haze;
  x.fillRect(0, H - 240, W, 240);

  return toTexture(c);
}

/* ── steam wisp: a soft-edged plume. A bare plane shows its rectangle at
      close range no matter how low the opacity goes. ── */
export function steamTexture() {
  const W = 64, H = 128;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');

  for (let i = 0; i < 3; i++) {
    const cxp = W / 2 + (i - 1) * 9;
    const g = x.createRadialGradient(cxp, H * 0.62, 0, cxp, H * 0.62, W * 0.46);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }

  // taper it away at the very top and bottom so nothing ends on a hard line
  const fade = x.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.25, 'rgba(0,0,0,0)');
  fade.addColorStop(0.8, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = fade;
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';

  return toTexture(c);
}

/* ── glass sheen: the angled reflection streaks + grime that make a window
      pane read as a real surface rather than an empty hole ── */
export function createGlassSheen() {
  const W = 512, H = 320;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');

  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);

  // two broad diagonal reflection bands, the wide one trailing the bright one
  x.save();
  x.translate(W * 0.5, H * 0.5);
  x.rotate(-0.62);
  for (const [off, w, a] of [[-150, 66, 0.34], [-38, 132, 0.12], [124, 26, 0.2]]) {
    const grad = x.createLinearGradient(off - w, 0, off + w, 0);
    grad.addColorStop(0, 'rgba(150,190,255,0)');
    grad.addColorStop(0.5, `rgba(176,206,255,${a})`);
    grad.addColorStop(1, 'rgba(150,190,255,0)');
    x.fillStyle = grad;
    x.fillRect(off - w, -H, w * 2, H * 2);
  }
  x.restore();

  // faint bloom hugging the frame, where glass always catches the most light
  const edge = x.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, 'rgba(150,180,230,0.18)');
  edge.addColorStop(0.18, 'rgba(150,180,230,0)');
  edge.addColorStop(0.85, 'rgba(150,180,230,0)');
  edge.addColorStop(1, 'rgba(150,180,230,0.10)');
  x.fillStyle = edge;
  x.fillRect(0, 0, W, H);

  // dust and smudges so the reflection is not suspiciously clean
  for (let i = 0; i < 90; i++) {
    const r = 3 + Math.random() * 26;
    x.globalAlpha = 0.015 + Math.random() * 0.03;
    x.fillStyle = '#cddcf5';
    x.beginPath();
    x.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;

  return toTexture(c);
}

export function createRain() {
  const W = 512, H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const texture = toTexture(canvas);

  const drops = Array.from({ length: 110 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    len: 14 + Math.random() * 30,
    spd: 260 + Math.random() * 380,
    a: 0.08 + Math.random() * 0.16,
  }));

  function update(t, dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const d of drops) {
      d.y += d.spd * dt;
      d.x -= 30 * dt;
      if (d.y - d.len > H) { d.y = -20; d.x = Math.random() * W; }
      ctx.strokeStyle = `rgba(170,210,255,${d.a})`;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + 4, d.y - d.len);
      ctx.stroke();
    }
    texture.needsUpdate = true;
  }

  return { texture, update };
}

/* ── FLOOR WOOD PLANKS ──────────────────────────────── */

export function woodFloorTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const x = c.getContext('2d');
  x.fillStyle = '#241d19';
  x.fillRect(0, 0, S, S);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    const rh = S / rows;
    const shade = 30 + Math.random() * 22;
    x.fillStyle = `rgb(${shade + 14},${shade + 4},${shade})`;
    x.fillRect(0, r * rh, S, rh - 2);
    x.strokeStyle = 'rgba(0,0,0,0.25)';
    x.lineWidth = 1;
    for (let g = 0; g < 7; g++) {
      x.beginPath();
      const gy = r * rh + Math.random() * rh;
      x.moveTo(0, gy);
      x.bezierCurveTo(S * 0.3, gy + Math.random() * 4 - 2, S * 0.6, gy + Math.random() * 4 - 2, S, gy);
      x.stroke();
    }
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.fillRect(0, r * rh + rh - 3, S, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/* ── PERSIAN RUG — deep red, medallion, guarded borders ─ */

export function persianRugTexture() {
  const W = 1024, H = 768;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');

  const RED = '#93262f', RED_DK = '#6b1a22', CREAM = '#e8d9b0',
    NAVY = '#243459', GOLD = '#c9a24b', RUST = '#a85430';

  // mottled red field
  x.fillStyle = RED;
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,180,150,0.04)';
    const s = 2 + Math.random() * 5;
    x.fillRect(Math.random() * W, Math.random() * H, s, s);
  }

  // ── outer guard stripes ──
  const stripe = (inset, w, color) => {
    x.strokeStyle = color;
    x.lineWidth = w;
    x.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  };
  stripe(14, 6, NAVY);
  stripe(26, 3, CREAM);
  stripe(38, 14, NAVY);

  // main border band with repeating diamond motifs
  const bIn = 52, bW = 46;
  x.fillStyle = RED_DK;
  x.save();
  x.beginPath();
  x.rect(bIn, bIn, W - bIn * 2, H - bIn * 2);
  x.rect(bIn + bW, bIn + bW, W - (bIn + bW) * 2, H - (bIn + bW) * 2);
  x.fill('evenodd');
  x.restore();

  // motif diamonds along the band
  const drawDiamond = (cx, cy, r, color) => {
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(cx, cy - r); x.lineTo(cx + r * 0.7, cy);
    x.lineTo(cx, cy + r); x.lineTo(cx - r * 0.7, cy);
    x.closePath(); x.fill();
  };
  const step = 46;
  for (let px = bIn + bW / 2; px < W - bIn - bW / 2; px += step) {
    drawDiamond(px, bIn + bW / 2, 13, CREAM);
    drawDiamond(px, H - bIn - bW / 2, 13, CREAM);
    drawDiamond(px + step / 2, bIn + bW / 2, 7, GOLD);
    drawDiamond(px + step / 2, H - bIn - bW / 2, 7, GOLD);
  }
  for (let py = bIn + bW / 2; py < H - bIn - bW / 2; py += step) {
    drawDiamond(bIn + bW / 2, py, 13, CREAM);
    drawDiamond(W - bIn - bW / 2, py, 13, CREAM);
    drawDiamond(bIn + bW / 2, py + step / 2, 7, GOLD);
    drawDiamond(W - bIn - bW / 2, py + step / 2, 7, GOLD);
  }

  stripe(bIn + bW + 6, 3, CREAM);
  stripe(bIn + bW + 14, 8, RUST);
  // running-dog (zigzag) guard stripe
  const zg = bIn + bW + 26;
  x.strokeStyle = NAVY;
  x.lineWidth = 2.5;
  x.beginPath();
  for (let px = zg; px < W - zg; px += 12) {
    x.moveTo(px, zg + 5); x.lineTo(px + 6, zg + 13); x.lineTo(px + 12, zg + 5);
    x.moveTo(px, H - zg - 5); x.lineTo(px + 6, H - zg - 13); x.lineTo(px + 12, H - zg - 5);
  }
  for (let py = zg; py < H - zg; py += 12) {
    x.moveTo(zg + 5, py); x.lineTo(zg + 13, py + 6); x.lineTo(zg + 5, py + 12);
    x.moveTo(W - zg - 5, py); x.lineTo(W - zg - 13, py + 6); x.lineTo(W - zg - 5, py + 12);
  }
  x.stroke();
  stripe(zg + 20, 2, CREAM);

  // ── herati field: diamond lattice + boteh motifs ──
  const field = zg + 26;
  const cell = 58;
  x.strokeStyle = 'rgba(232,217,176,0.28)';
  x.lineWidth = 1.6;
  for (let gx = field - H; gx < W; gx += cell) {
    x.beginPath(); x.moveTo(gx, field); x.lineTo(gx + (H - field * 2) , H - field); x.stroke();
    x.beginPath(); x.moveTo(gx + (H - field * 2), field); x.lineTo(gx, H - field); x.stroke();
  }
  // small boteh (paisley) at lattice cells + tiny dots
  const boteh = (cx, cy, s, color) => {
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(cx, cy - s);
    x.quadraticCurveTo(cx + s, cy - s * 0.4, cx + s * 0.35, cy + s * 0.55);
    x.quadraticCurveTo(cx + s * 0.1, cy + s * 0.9, cx, cy + s);
    x.quadraticCurveTo(cx - s * 0.9, cy + s * 0.2, cx, cy - s);
    x.fill();
  };
  const dot = (cx, cy, color) => {
    x.fillStyle = color;
    x.beginPath(); x.arc(cx, cy, 2.4, 0, Math.PI * 2); x.fill();
  };
  for (let row = 0; row < 9; row++) {
    for (let colI = 0; colI < 13; colI++) {
      const fx = field + 24 + colI * cell * 0.5 + (row % 2) * cell * 0.25;
      const fy = field + 24 + row * 42;
      if (fx < field + 8 || fx > W - field - 8 || fy > H - field - 8) continue;
      // keep the medallion zone clearer
      const dm = Math.hypot(fx - W / 2, (fy - H / 2) * 1.15);
      if (dm < 235) continue;
      if ((row + colI) % 3 === 0) boteh(fx, fy, 8, Math.random() > 0.5 ? CREAM : '#7aa5c9');
      else if ((row + colI) % 3 === 1) dot(fx, fy, GOLD);
      else dot(fx, fy, 'rgba(232,217,176,0.55)');
    }
  }

  // ── corner spandrels (lachak) ──
  const spandrel = (cx, cy, flipX, flipY) => {
    x.save();
    x.translate(cx, cy);
    x.scale(flipX, flipY);
    x.fillStyle = NAVY;
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(120, 10, 150, 150);
    x.lineTo(60, 150);
    x.quadraticCurveTo(52, 70, 0, 58);
    x.closePath();
    x.fill();
    drawDiamond(78, 78, 22, CREAM);
    drawDiamond(78, 78, 11, RED);
    x.restore();
  };
  const m = bIn + bW + 26;
  spandrel(m, m, 1, 1);
  spandrel(W - m, m, -1, 1);
  spandrel(m, H - m, 1, -1);
  spandrel(W - m, H - m, -1, -1);

  // ── central medallion (toranj) ──
  const cx = W / 2, cy = H / 2;
  // pendants
  x.strokeStyle = CREAM;
  x.lineWidth = 3;
  [[cx, cy - 175, cx, cy - 245], [cx, cy + 175, cx, cy + 245]].forEach(([x1, y1, x2, y2]) => {
    x.beginPath();
    x.moveTo(x1, y1); x.lineTo(x2, y2);
    x.stroke();
    drawDiamond(x2, y2, 16, GOLD);
  });
  // layered diamonds
  const medallion = (r, color, rot = 0) => {
    x.save();
    x.translate(cx, cy);
    x.rotate(rot);
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(0, -r); x.lineTo(r * 0.72, 0); x.lineTo(0, r); x.lineTo(-r * 0.72, 0);
    x.closePath();
    x.fill();
    x.restore();
  };
  medallion(170, NAVY);
  medallion(150, RED_DK, 0.18);
  medallion(122, NAVY, 0);
  medallion(100, CREAM, -0.15);
  medallion(74, RED);
  medallion(40, GOLD);
  drawDiamond(cx, cy, 18, RED_DK);

  // delicate field vines between medallion and corners
  x.strokeStyle = 'rgba(227,211,172,0.35)';
  x.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    x.beginPath();
    const vx = 150 + i * 60;
    x.moveTo(vx, 130);
    x.bezierCurveTo(vx + 30, 260, vx - 30, 380, vx, 520);
    x.stroke();
    const vx2 = W - (150 + i * 60);
    x.beginPath();
    x.moveTo(vx2, H - 130);
    x.bezierCurveTo(vx2 - 30, H - 260, vx2 + 30, H - 380, vx2, H - 520);
    x.stroke();
  }

  // wool grain + wear
  for (let i = 0; i < 5200; i++) {
    x.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,220,180,0.045)';
    x.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6 + Math.random() * 2);
  }
  // fringe hint at edges
  x.fillStyle = CREAM;
  for (let px = 8; px < W; px += 7) {
    x.fillRect(px, 2, 3, 8);
    x.fillRect(px, H - 10, 3, 8);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ── CERTIFICATE FRAME ──────────────────────────────── */

export function certificateTexture() {
  const c = makeCanvas(512, 640);
  const x = c.getContext('2d');
  x.fillStyle = '#e9e4d8';
  x.fillRect(0, 0, 512, 640);
  x.strokeStyle = '#8a7a55';
  x.lineWidth = 10;
  x.strokeRect(24, 24, 464, 592);
  x.fillStyle = '#2c2a24';
  x.textAlign = 'center';
  x.font = `bold 30px ${MONO}`;
  x.fillText('B.Sc. COMPUTER', 256, 200);
  x.fillText('ENGINEERING', 256, 240);
  x.font = `18px ${MONO}`;
  x.fillText('— awarded to —', 256, 310);
  x.font = `italic 44px Georgia`;
  x.fillText('Morteza Vaezi', 256, 370);
  x.font = `16px ${MONO}`;
  x.fillStyle = '#6a6353';
  x.fillText('summa cum caffeine · 2019', 256, 430);
  x.beginPath();
  x.arc(256, 510, 44, 0, Math.PI * 2);
  x.fillStyle = '#b3934a';
  x.fill();
  x.fillStyle = '#efe9dc';
  x.font = `bold 26px ${MONO}`;
  x.fillText('MV', 256, 520);
  return toTexture(c);
}

