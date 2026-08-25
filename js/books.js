import * as THREE from 'three';

/* ═══════════════════════════════════════════════
   BOOKS — detailed procedural book builder.
   Cover / spine / page-edge canvas textures,
   math + programming cover motifs.

   Canonical orientation (flat, lying down):
     X = width (fore-edge points +X)
     Z = height of the cover
     Y = thickness
     spine on the -X face
   Stand a book upright with group.rotation.x = -PI/2
   → spine faces -X (out from the right wall).
   ═══════════════════════════════════════════════ */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const texCache = new Map();

/* modern flat-design typography */
const SANS = "'Helvetica Neue', 'Segoe UI', Arial, sans-serif";
const MONO = "'JetBrains Mono', Consolas, monospace";

/* ── page-edge texture: cream paper with fine streaks ── */
function pagesTexture() {
  const key = 'pages';
  if (texCache.has(key)) return texCache.get(key);
  const c = makeCanvas(128, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#cfc7b0';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * 128;
    x.strokeStyle = `rgba(120,105,80,${0.08 + Math.random() * 0.14})`;
    x.lineWidth = 0.7;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(128, y + (Math.random() - 0.5) * 3);
    x.stroke();
  }
  const grad = x.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(90,75,55,0.18)');
  grad.addColorStop(0.25, 'rgba(90,75,55,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

/* ── modern minimal motif painters (thin geometric line art) ── */
const motifs = {
  plain(x, W, H, accent) {
    x.strokeStyle = accent;
    x.globalAlpha = 0.85;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(W * 0.12, H * 0.72); x.lineTo(W * 0.88, H * 0.72);
    x.stroke();
    x.globalAlpha = 0.35;
    x.beginPath();
    x.moveTo(W * 0.12, H * 0.78); x.lineTo(W * 0.62, H * 0.78);
    x.stroke();
    x.globalAlpha = 1;
  },
  math(x, W, H, accent) {
    // dot grid
    x.fillStyle = accent;
    x.globalAlpha = 0.45;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        x.beginPath();
        x.arc(W * (0.16 + i * 0.13), H * (0.66 + j * 0.09), 2, 0, Math.PI * 2);
        x.fill();
      }
    }
    // smooth function curve over the grid
    x.globalAlpha = 0.9;
    x.strokeStyle = accent;
    x.lineWidth = 2.5;
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(W * 0.10, H * 0.84);
    x.quadraticCurveTo(W * 0.32, H * 0.58, W * 0.52, H * 0.74);
    x.quadraticCurveTo(W * 0.70, H * 0.88, W * 0.90, H * 0.64);
    x.stroke();
    // mono caption
    x.font = `11px ${MONO}`;
    x.textAlign = 'left';
    x.fillText('f(x) dx', W * 0.10, H * 0.94);
    x.globalAlpha = 1;
  },
  code(x, W, H, accent) {
    // minimal angle brackets
    x.strokeStyle = accent;
    x.globalAlpha = 0.95;
    x.lineWidth = 3;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(W * 0.34, H * 0.62); x.lineTo(W * 0.20, H * 0.72); x.lineTo(W * 0.34, H * 0.82);
    x.moveTo(W * 0.66, H * 0.62); x.lineTo(W * 0.80, H * 0.72); x.lineTo(W * 0.66, H * 0.82);
    x.stroke();
    // code bars + cursor
    const bars = [0.30, 0.44, 0.24];
    bars.forEach((bw, i) => {
      x.globalAlpha = 0.4;
      x.fillRect(W * 0.14, H * (0.87 + i * 0.035), W * bw, 3);
    });
    x.globalAlpha = 0.9;
    x.fillRect(W * 0.14 + W * 0.44 + 8, H * (0.87 + 2 * 0.035), 7, 3);
    x.globalAlpha = 1;
  },
  tree(x, W, H, accent) {
    x.strokeStyle = accent;
    x.lineWidth = 1.5;
    const node = (nx, ny, r, fill) => {
      x.beginPath();
      x.arc(nx, ny, r, 0, Math.PI * 2);
      if (fill) { x.fillStyle = accent; x.fill(); }
      else x.stroke();
    };
    const link = (a, b) => {
      x.beginPath();
      x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]);
      x.stroke();
    };
    const root = [W * 0.50, H * 0.68];
    const l = [W * 0.32, H * 0.80], r = [W * 0.68, H * 0.80];
    const ll = [W * 0.24, H * 0.92], lr = [W * 0.40, H * 0.92], rl = [W * 0.60, H * 0.92];
    link(root, l); link(root, r);
    link(l, ll); link(l, lr); link(r, rl);
    node(...root, 5, true);
    node(...l, 4, false); node(...r, 4, false);
    node(...ll, 3, true); node(...lr, 3, false); node(...rl, 3, true);
    x.globalAlpha = 1;
  },
};

/* ── cover texture: flat modern Swiss style ── */
function coverTexture({ bg, accent, title, author, motif }) {
  const key = `cover2|${bg}|${accent}|${title}|${author}|${motif}`;
  if (texCache.has(key)) return texCache.get(key);
  const W = 256, H = 200;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);

  // faint vertical depth so the flat colour still shades like a real cover
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  // accent tab, top-left
  x.fillStyle = accent;
  x.fillRect(20, 22, 42, 9);

  // title — bold sans, left-aligned, up to 2 lines
  // (kept under bloom threshold: near-white albedo + the close lamp light
  //  was pushing glyph pixels into the bloom pass = "glowing books")
  x.fillStyle = '#ddd8ce';
  x.textAlign = 'left';
  const titleSize = title.length > 12 ? 26 : 31;
  x.font = `800 ${titleSize}px ${SANS}`;
  const words = title.toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 12 && cur) {
      lines.push(cur.trim());
      cur = w;
    } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  lines.slice(0, 2).forEach((ln, i) => {
    x.fillText(ln, 20, 76 + i * 30);
  });

  // author — small mono tag tucked right under the title
  if (author) {
    x.font = `12px ${MONO}`;
    x.fillStyle = accent;
    x.fillText(author.toUpperCase(), 21, lines.length > 1 ? 120 : 98);
  }

  (motifs[motif] || motifs.plain)(x, W, H, accent);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

/* ── spine texture: flat colour strip, bold type, accent bar ── */
function spineTexture({ bg, accent, title }) {
  const key = `spine2|${bg}|${accent}|${title}`;
  if (texCache.has(key)) return texCache.get(key);
  const W = 256, H = 96;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);

  // solid accent bar at the foot of the spine
  x.fillStyle = accent;
  x.fillRect(0, 0, 12, H);

  // title along the spine length
  x.fillStyle = '#d9d4c8';
  x.font = `700 27px ${SANS}`;
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  let t = title.toUpperCase();
  if (x.measureText(t).width > W * 0.82) {
    do { t = t.slice(0, -1); } while (x.measureText(t + '…').width > W * 0.82 && t.length > 1);
    t += '…';
  }
  x.fillText(t, 28, H * 0.52);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

function stdMat(params) {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05, ...params });
}

/* ── main builder ──────────────────────────────────────
   opts: W, D (cover height), T (thickness),
         color (hex number), title, author,
         motif: 'plain' | 'math' | 'code' | 'tree'
         accent: css color for the motif art            */
export function createBook(opts = {}) {
  const {
    W = 0.19, D = 0.145, T = 0.03,
    color = 0x274a6d, title = 'UNTITLED', author = '',
    motif = 'plain', accent = '#00f0ff',
  } = opts;

  const g = new THREE.Group();
  const bgCss = '#' + new THREE.Color(color).getHexString();
  const darker = new THREE.Color(color).lerp(new THREE.Color(0x000000), 0.35);
  const darkerCss = '#' + darker.getHexString();

  const coverTex = coverTexture({ bg: bgCss, accent, title, author, motif });
  const spineTex = spineTexture({ bg: darkerCss, accent, title });
  const pTex = pagesTexture();

  // top face textured, rest plain
  const sideMat = stdMat({ map: pTex, roughness: 0.92 });
  const coverPlain = stdMat({ color: darker, roughness: 0.75 });
  const coverTop = stdMat({ map: coverTex, roughness: 0.72 });
  const topMats = [sideMat, sideMat, coverTop, coverPlain, sideMat, sideMat];

  const covT = 0.005;
  const topCover = new THREE.Mesh(new THREE.BoxGeometry(W, covT, D), topMats);
  topCover.position.y = T / 2 - covT / 2;
  const bottomCover = new THREE.Mesh(new THREE.BoxGeometry(W, covT, D), coverPlain);
  bottomCover.position.y = -T / 2 + covT / 2;
  g.add(topCover, bottomCover);

  // page block, shifted toward the fore-edge (+X)
  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.016, T - 0.012, D - 0.012),
    stdMat({ map: pTex }),
  );
  pages.position.x = 0.010;
  g.add(pages);

  // spine slab, slightly proud of the covers on every side (real
  // rounded-spine look AND avoids coplanar faces that z-fight)
  const spineOuter = stdMat({ map: spineTex, roughness: 0.75 });
  const spineMats = [coverPlain, spineOuter, coverPlain, coverPlain, coverPlain, coverPlain];
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.016, T + 0.004, D + 0.004), spineMats);
  spine.position.x = -W / 2 + 0.004;
  g.add(spine);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* ── open book lying face-down on a surface ── */
export function createOpenBook(opts = {}) {
  const {
    W = 0.24, D = 0.17, T = 0.024,
    color = 0x6d5a27, title = '', motif = 'math', accent = '#00f0ff',
  } = opts;

  const g = new THREE.Group();
  const bgCss = '#' + new THREE.Color(color).getHexString();
  const darker = new THREE.Color(color).lerp(new THREE.Color(0x000000), 0.35);
  const pTex = pagesTexture();
  const pageMat = stdMat({ map: pTex });
  const coverMat = stdMat({ map: coverTexture({ bg: bgCss, accent, title, author: '', motif }) });

  const halfW = W / 2 - 0.004;
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(halfW, T, D), pageMat);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(halfW + 0.006, 0.004, D + 0.006), coverMat);
    cover.position.y = -T / 2 - 0.003;
    half.add(block, cover);
    half.position.set(s * halfW / 2, T * 0.32, 0);
    half.rotation.z = -s * 0.24;
    g.add(half);
  }
  // spine ridge in the middle
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, T * 1.05, D), pageMat);
  ridge.position.y = T * 0.4;
  g.add(ridge);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
