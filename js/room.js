import * as THREE from 'three';
import { mat, glowMat, box, cyl, sphere, plane, p, rand, pick, PALETTE as C } from './utils.js';
import {
  createCityView, createRain, createGlassSheen, woodFloorTexture, persianRugTexture,
  posterJS, posterReact, posterGit, certificateTexture,
} from './screens.js';
import { createBook } from './books.js';

/* Room bounds: x ∈ [-4, 4], z ∈ [-4, 2.6], height 2.8
   Desk wall = back (z=-4) · window = left (x=-4)
   Bed corner + project frames + shelf = right (x=+4)       */

export const ROOM = { W: 8, D: 6.6, H: 2.8 };

export function buildRoom(scene, liveScreens) {
  const room = new THREE.Group();
  scene.add(room);

  buildShell(room);
  buildWindow(room, liveScreens);
  buildAlbumWall(room);
  buildProjectWall(room);
  buildShelf(room);
  buildRug(room);
  buildBedCorner(room);
  buildPlant(room);
  buildLedStrips(room);

  return room;
}

/* ── shell: floor / walls / ceiling / baseboards ─────── */
function buildShell(room) {
  const { W, D, H } = ROOM;

  const floorTex = woodFloorTexture();
  const floor = plane(W, D, new THREE.MeshStandardMaterial({
    map: floorTex, roughness: 0.55, metalness: 0.08,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (D / 2) - 4);
  floor.receiveShadow = true;
  room.add(floor);

  const ceiling = box(W, 0.1, D, mat(0x0b0d13, 0.9));
  ceiling.position.set(0, H + 0.05, (D / 2) - 4);
  room.add(ceiling);

  const wallMat = mat(C.wallDark, 0.95);
  const back = box(W, H, 0.12, wallMat);
  back.position.set(0, H / 2, -4.06);
  const front = box(W, H, 0.12, mat(0x14161e, 0.95));
  front.position.set(0, H / 2, 2.66);
  const right = box(0.12, H, D, wallMat);
  right.position.set(4.06, H / 2, (D / 2) - 4);
  room.add(back, front, right);

  // left wall built around window opening (window w=2.4 h=1.5, sill y=0.9)
  const winW = 2.4, winH = 1.5, sillY = 0.9, cx = (D / 2) - 4;
  const segA = box(0.12, H, cx - winW / 2 - (-4), wallMat);
  segA.position.set(-4.06, H / 2, (-4 + (cx - winW / 2)) / 2);
  // from window's front edge (z = cx + winW/2) to the front wall (z = 2.6)
  const segB = box(0.12, H, 2.66 - (cx + winW / 2), wallMat);
  segB.position.set(-4.06, H / 2, (cx + winW / 2 + 2.66) / 2);
  const below = box(0.12, sillY, winW, wallMat);
  below.position.set(-4.06, sillY / 2, cx);
  const aboveH = H - (sillY + winH);
  const above = box(0.12, aboveH, winW, wallMat);
  above.position.set(-4.06, sillY + winH + aboveH / 2, cx);
  room.add(segA, segB, below, above);

  // accent panel behind desk
  const panel = box(3.6, 2.2, 0.03, mat(C.wallPanel, 0.85));
  panel.position.set(0, 1.35, -3.98);
  room.add(panel);

  // baseboards
  const bb = mat(0x0d0f16, 0.7);
  const bbBack = box(W, 0.12, 0.04, bb);
  bbBack.position.set(0, 0.06, -3.96);
  const bbRight = box(0.04, 0.12, D, bb);
  bbRight.position.set(3.96, 0.06, cx);
  const bbLeft = box(0.04, 0.12, D, bb);
  bbLeft.position.set(-3.96, 0.06, cx);
  room.add(bbBack, bbRight, bbLeft);
}

/* ── window: frame, glass, city view, rain ───────────── */
function buildWindow(room, liveScreens) {
  const cx = (ROOM.D / 2) - 4;
  const winW = 2.4, winH = 1.5, sillY = 0.9;

  const frameMat = mat(0x101218, 0.6, 0.3);
  /* The window sits in the LEFT wall (x = -4), so its width runs along Z and
     its depth along X. Parts are [spanZ, spanY, depthX, offsetZ, offsetY]. */
  const parts = [
    [winW + 0.16, 0.08, 0.18, 0, sillY - 0.04],                  // bottom rail
    [winW + 0.16, 0.08, 0.18, 0, sillY + winH + 0.04],           // top rail
    [0.08, winH, 0.18, -winW / 2 - 0.04, sillY + winH / 2],      // back jamb
    [0.08, winH, 0.18, winW / 2 + 0.04, sillY + winH / 2],       // front jamb
    [0.05, winH, 0.14, 0, sillY + winH / 2],                     // vertical mullion
    [winW, 0.05, 0.14, 0, sillY + winH / 2],                     // horizontal mullion
  ];
  for (const [spanZ, spanY, depthX, oz, oy] of parts) {
    const m = box(depthX, spanY, spanZ, frameMat);
    m.position.set(-4.02, oy, cx + oz);
    room.add(m);
  }
  const ledge = box(0.22, 0.05, winW + 0.3, mat(0x191c26, 0.6));
  ledge.position.set(-3.93, sillY - 0.07, cx);
  room.add(ledge);

  const city = plane(7.5, 7.5, new THREE.MeshBasicMaterial({ map: createCityView() }));
  city.rotation.y = Math.PI / 2;
  city.position.set(-5.4, 2.2, cx);
  room.add(city);

  /* Glass reads as glass only if it catches light. The pane itself stays
     nearly clear; the sheen plane on top of it supplies the angled reflection
     streaks and grime that tell the eye there is a surface there at all. */
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9db2d6, transparent: true, opacity: 0.13,
    roughness: 0.04, metalness: 0.0,
    clearcoat: 1.0, clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
  });
  const glassPane = plane(winW, winH, glass);
  glassPane.rotation.y = Math.PI / 2;
  glassPane.position.set(-3.97, sillY + winH / 2, cx);
  room.add(glassPane);

  const sheen = plane(winW, winH, new THREE.MeshBasicMaterial({
    map: createGlassSheen(), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sheen.rotation.y = Math.PI / 2;
  sheen.position.set(-3.955, sillY + winH / 2, cx);
  room.add(sheen);

  const rain = createRain();
  const rainPlane = plane(winW, winH, new THREE.MeshBasicMaterial({
    map: rain.texture, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  rainPlane.rotation.y = Math.PI / 2;
  rainPlane.position.set(-3.94, sillY + winH / 2, cx);
  room.add(rainPlane);
  liveScreens.push(rain);
}

/* ── MOHSEN NAMJOO albums — small, above the bed & lamp ─ */
function buildAlbumWall(room) {
  const frameMat = mat(0x0c0e14, 0.5, 0.2);
  const matBoard = mat(0xe6dfcf, 0.9); // cream passe-partout

  const loader = new THREE.TextureLoader();
  const fallbacks = [posterJS(), posterGit(), posterReact()];

  const albums = [
    // right wall, above the nightstand lamp — diagonal cluster
    ['assets/albums/odd-time-rock.jpg', 3.93, 1.72, -1.95, -Math.PI / 2],
    ['assets/albums/magnetism.jpg', 3.93, 2.02, -1.28, -Math.PI / 2],
    // back wall, centered above the headboard
    ['assets/albums/oula.jpg', 3.22, 2.02, -3.94, 0],
  ];

  albums.forEach(([src, x, y, z, ry], i) => {
    const g = new THREE.Group();
    const w = 0.44, h = 0.62; // small frames

    const fr = box(w + 0.06, h + 0.06, 0.03, frameMat);
    const mount = box(w - 0.015, h - 0.015, 0.011, matBoard);
    mount.position.z = 0.019;
    const artMat = new THREE.MeshStandardMaterial({
      map: fallbacks[i], roughness: 0.85,
      emissive: 0xffffff, emissiveMap: fallbacks[i], emissiveIntensity: 0.32,
    });
    const art = plane(w - 0.09, h - 0.09, artMat);
    art.position.z = 0.026;
    g.add(fr, mount, art);

    g.position.set(x, y, z);
    g.rotation.y = ry;
    room.add(g);

    // swap in the real cover once loaded; fall back silently on error
    loader.load(
      src,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        artMat.map = tex;
        artMat.emissiveMap = tex;
        artMat.needsUpdate = true;
      },
      undefined,
      () => { /* keep procedural fallback */ },
    );
  });
}

/* ── framed art posters on the back wall, behind the desk ── */
function buildProjectWall(room) {
  const loader = new THREE.TextureLoader();

  // all three are portrait ~9:16
  const posters = [
    ['assets/posters/poster-1.jpg', -2.42, 1.74, -3.94],
    ['assets/posters/poster-2.jpg', -1.52, 1.74, -3.94],
    ['assets/posters/poster-3.jpg', 2.18, 1.76, -3.94],
  ];
  const fw = 0.46, fh = 0.8;

  posters.forEach(([src, x, y, z]) => {
    const g = new THREE.Group();

    const fr = box(fw + 0.05, fh + 0.05, 0.03, mat(0x0b0d13, 0.5, 0.2));
    // lit a little from the front so the art reads in a dark room, but not
    // self-illuminated like the old neon panels were
    const artMat = new THREE.MeshStandardMaterial({
      color: 0x8d94a4, roughness: 0.86,
      emissive: 0xffffff, emissiveIntensity: 0.16,
    });
    const art = plane(fw, fh, artMat);
    art.position.z = 0.02;

    g.add(fr, art);
    g.position.set(x, y, z);
    room.add(g);

    loader.load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      artMat.map = tex;
      artMat.emissiveMap = tex;
      artMat.color.setHex(0xffffff);
      artMat.needsUpdate = true;
    });
  });
}

/* ── bookshelf on the right wall ─────────────────────── */
function buildShelf(room) {
  const g = new THREE.Group();
  const woodMat = mat(0x241a14, 0.8);
  const H = 2.1, W = 0.34, L = 1.7;
  const cz = 0.45;

  const s1 = box(0.04, H, L + W, woodMat);
  s1.position.set(4, H / 2, cz - W / 2);
  const s2 = box(0.04, H, L + W, woodMat);
  s2.position.set(4, H / 2, cz + W / 2);
  g.add(s1, s2);

  const backPanel = box(W, H, L, mat(0x191009, 0.9));
  backPanel.position.set(3.98, H / 2, cz);
  g.add(backPanel);

  const rows = 4;
  for (let i = 0; i <= rows; i++) {
    const plank = box(L, 0.045, W, woodMat);
    plank.position.set(4, 0.08 + i * ((H - 0.12) / rows), cz);
    g.add(plank);
  }

  const bookColors = [0x274a6d, 0x6d2746, 0x276d43, 0x6d5a27, 0x3a2d63, 0x8a3038, 0x1f6f74, 0xb0b6c4];
  let totalBooks = 0;
  const perRow = [];
  for (let r = 0; r < rows; r++) {
    let n = Math.floor(rand(9, 15));
    if (r === 1) n = 0;
    perRow.push(n);
    totalBooks += n;
  }
  const bookMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    totalBooks,
  );
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    let cursorZ = cz - L / 2 + 0.08;
    for (let b = 0; b < perRow[r]; b++) {
      const bw = rand(0.045, 0.085);
      const bh = rand(0.24, 0.38);
      dummy.position.set(4, 0.105 + r * ((H - 0.12) / rows) + bh / 2, cursorZ + bw / 2);
      dummy.scale.set(bh, bh, bw);
      dummy.updateMatrix();
      bookMesh.setMatrixAt(idx, dummy.matrix);
      col.setHex(pick(bookColors)).offsetHSL(0, 0, rand(-0.05, 0.05));
      bookMesh.setColorAt(idx, col);
      cursorZ += bw + 0.008;
      idx++;
    }
  }
  bookMesh.castShadow = true;
  g.add(bookMesh);

  const trophyGold = mat(0xd4af37, 0.35, 0.9);
  const cupBase = cyl(0.05, 0.07, 0.04, 20, trophyGold);
  cupBase.position.set(4, 0.36 + 0.11 * ((H - 0.12) / rows), cz - 0.25);
  const stem = cyl(0.014, 0.03, 0.09, 12, trophyGold);
  stem.position.copy(cupBase.position).y += 0.065;
  const cup = cyl(0.055, 0.032, 0.09, 18, trophyGold);
  cup.position.copy(cupBase.position).y += 0.14;
  g.add(cupBase, stem, cup);

  const pot = cyl(0.05, 0.038, 0.08, 12, mat(0x8a4b32, 0.9));
  pot.position.set(4, 0.36 + 0.11 * ((H - 0.12) / rows), cz + 0.3);
  for (let l = 0; l < 5; l++) {
    const leaf = sphere(0.035, 8, mat(0x2e7d4f, 0.9));
    leaf.scale.set(1, 0.5, 1.6);
    leaf.position.set(
      4 + rand(-0.03, 0.03),
      pot.position.y + 0.07,
      pot.position.z + rand(-0.03, 0.03),
    );
    leaf.rotation.set(rand(-0.5, 0.5), rand(0, Math.PI), rand(-0.5, 0.5));
    g.add(leaf);
  }
  g.add(pot);

  const certFrame = new THREE.Group();
  const cf = box(0.42, 0.54, 0.03, mat(0x0c0e14, 0.5));
  const cert = plane(0.36, 0.48, new THREE.MeshStandardMaterial({
    map: certificateTexture(), roughness: 0.9,
    emissive: 0xffffff, emissiveMap: certificateTexture(), emissiveIntensity: 0.18,
  }));
  cert.position.z = 0.02;
  certFrame.add(cf, cert);
  certFrame.position.set(3.93, 0.29, 1.65);
  certFrame.rotation.y = -Math.PI / 2;
  g.add(certFrame);

  room.add(g);
}

/* ── RED PERSIAN RUG under the desk zone ─────────────── */
function buildRug(room) {
  const tex = persianRugTexture();
  const rug = plane(3.0, 2.2, new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.98,
  }));
  rug.rotation.x = -Math.PI / 2;
  rug.rotation.z = 0.05;
  rug.position.set(0.15, 0.014, -2.15);
  rug.receiveShadow = true;
  room.add(rug);

  // subtle fringe shadow line so it sits into the floor
  const under = plane(3.06, 2.26, mat(0x0a0a0f, 1));
  under.rotation.x = -Math.PI / 2;
  under.rotation.z = 0.05;
  under.position.set(0.15, 0.008, -2.15);
  room.add(under);
}

/* ── BEDROOM CORNER · red bed + nightstand + wall shelf ─ */
function buildBedCorner(room) {
  const g = new THREE.Group();

  const frameWood = mat(0x2a1d14, 0.75);
  const RED = 0x8a1f2b, RED_DK = 0x631520, SHEET = 0xd8d4c8;

  // bed footprint: along right wall, headboard at back wall
  const bx = 3.22, bzHead = -3.72, bedL = 2.05, bedW = 1.18;

  /* ── platform frame: rails + tapered legs ── */
  const railY = 0.2, railH = 0.18;
  const railL = box(0.05, railH, bedL + 0.06, frameWood);
  railL.position.set(bx - bedW / 2 + 0.025, railY, bzHead + bedL / 2);
  const railR = railL.clone();
  railR.position.x = bx + bedW / 2 - 0.025;
  const railFoot = box(bedW, railH, 0.05, frameWood);
  railFoot.position.set(bx, railY, bzHead + bedL + 0.02);
  g.add(railL, railR, railFoot);

  for (const [ox, oz] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
    const leg = cyl(0.024, 0.034, 0.14, 10, frameWood);
    leg.position.set(
      bx + ox * (bedW / 2 - 0.07),
      0.07,
      bzHead + (oz === 0 ? 0.12 : bedL - 0.06),
    );
    g.add(leg);
  }

  /* ── channel-tufted headboard, slight recline ── */
  const hb = new THREE.Group();
  const hbH = 1.0, panelW = (bedW + 0.14) / 5;
  for (let i = 0; i < 5; i++) {
    const panel = box(panelW - 0.025, hbH - 0.08, 0.075, mat(0x33221a, 0.8));
    panel.position.set(-((bedW + 0.14) / 2) + panelW * (i + 0.5), hbH / 2 + 0.12, 0);
    hb.add(panel);
    if (i < 4) {
      const pipe = box(0.014, hbH - 0.14, 0.05, mat(RED_DK, 0.9));
      pipe.position.set(-((bedW + 0.14) / 2) + panelW * (i + 1), hbH / 2 + 0.12, 0.012);
      hb.add(pipe);
    }
  }
  const hbTop = box(bedW + 0.14, 0.07, 0.1, frameWood);
  hbTop.position.set(0, hbH + 0.14, 0);
  const hbBase = box(bedW + 0.14, 0.1, 0.09, frameWood);
  hbBase.position.set(0, 0.1, 0);
  hb.add(hbTop, hbBase);
  hb.position.set(bx, 0, bzHead - 0.07);
  hb.rotation.x = -0.055;
  hb.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(hb);

  /* ── mattress + quilted sheet ── */
  const mattress = box(bedW - 0.08, 0.17, bedL - 0.12, mat(SHEET, 0.95));
  mattress.position.set(bx, 0.375, bzHead + bedL / 2);
  g.add(mattress);
  const quilt = box(bedW - 0.1, 0.03, bedL - 0.16, mat(0xcfcaba, 0.98));
  quilt.position.set(bx, 0.47, bzHead + bedL / 2);
  g.add(quilt);

  /* ── red duvet: slab + fold + side drapes + creases ── */
  const duvetTop = 0.495;
  const duvet = box(bedW + 0.02, 0.09, bedL * 0.64, mat(RED, 0.98));
  duvet.position.set(bx, duvetTop, bzHead + bedL * 0.64);
  duvet.castShadow = true;
  g.add(duvet);

  // folded-back top edge
  const fold = box(bedW + 0.05, 0.05, 0.2, mat(RED_DK, 0.98));
  fold.position.set(bx, duvetTop + 0.045, bzHead + bedL * 0.35);
  fold.rotation.x = 0.1;
  g.add(fold);

  // side drapes hanging over both edges (two uneven layers per side)
  for (const side of [-1, 1]) {
    const dx = bx + side * (bedW / 2 + 0.008);
    const drape1 = box(0.035, 0.34, bedL * 0.6, mat(RED, 0.98));
    drape1.position.set(dx, duvetTop - 0.13, bzHead + bedL * 0.63);
    drape1.rotation.z = side * 0.03;
    const drape2 = box(0.028, 0.27, bedL * 0.5, mat(RED_DK, 0.98));
    drape2.position.set(dx + side * 0.014, duvetTop - 0.1, bzHead + bedL * 0.68);
    drape2.rotation.z = side * 0.05;
    drape2.rotation.y = side * 0.012;
    g.add(drape1, drape2);
  }

  // soft creases across the duvet
  for (let i = 0; i < 4; i++) {
    const crease = box(bedW + 0.03, 0.016, 0.045, mat(RED_DK, 0.98));
    crease.position.set(bx, duvetTop + 0.05, bzHead + bedL * (0.44 + i * 0.13));
    crease.rotation.set(0, rand(-0.03, 0.03), rand(-0.015, 0.015));
    g.add(crease);
  }

  // maroon throw across the foot + hanging tail
  const throwB = box(bedW + 0.09, 0.045, 0.4, mat(0x43101a, 0.95));
  throwB.position.set(bx, duvetTop + 0.075, bzHead + bedL * 0.88);
  throwB.rotation.z = 0.018;
  const tail = box(0.03, 0.3, 0.38, mat(0x43101a, 0.95));
  tail.position.set(bx - bedW / 2 - 0.012, duvetTop - 0.06, bzHead + bedL * 0.88);
  tail.rotation.z = -0.04;
  g.add(throwB, tail);

  /* ── rounded pillows leaning on the headboard ── */
  const pillowMat = mat(0xe8e2d2, 0.95);
  const p1 = sphere(0.16, 18, pillowMat);
  p1.scale.set(1.65, 0.55, 1.1);
  p1.position.set(bx - 0.25, 0.56, bzHead + 0.3);
  p1.rotation.set(0.32, 0.05, 0.04);
  const p2 = sphere(0.16, 18, pillowMat);
  p2.scale.set(1.65, 0.55, 1.1);
  p2.position.set(bx + 0.27, 0.56, bzHead + 0.3);
  p2.rotation.set(0.34, -0.07, -0.05);
  const accentPillow = sphere(0.14, 18, mat(0xa8553f, 0.95));
  accentPillow.scale.set(1.5, 0.5, 1.0);
  accentPillow.position.set(bx + 0.02, 0.58, bzHead + 0.52);
  accentPillow.rotation.set(0.4, 0.12, 0.06);
  p1.castShadow = p2.castShadow = true;
  g.add(p1, p2, accentPillow);

  // warm LED strip under the frame front edge (emissive only — light comes from the lamp)
  const underBed = box(bedW - 0.1, 0.015, 0.015, new THREE.MeshBasicMaterial({ color: 0xff9a5e }));
  underBed.position.set(bx, 0.09, bzHead + bedL - 0.02);
  g.add(underBed);

  /* ── nightstand + reading lamp ──
     Built in local space with the drawer face on +Z,
     then the whole group is rotated so drawers point
     at the window (-X world).                          */
  const ns = new THREE.Group();
  ns.position.set(3.6, 0, -1.32);
  ns.rotation.y = -Math.PI / 2;
  // softer brass — high metalness was spiking HDR specular blooms
  const brassMat = mat(0xc9a24b, 0.45, 0.6);

  // tapered legs (tops embedded into the body so no faces are coplanar)
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = cyl(0.016, 0.022, 0.094, 8, frameWood);
    leg.position.set(lx * 0.17, 0.049, lz * 0.18);
    leg.castShadow = true;
    ns.add(leg);
  }

  // body
  const nsBody = box(0.42, 0.40, 0.44, frameWood);
  nsBody.position.y = 0.29;
  nsBody.castShadow = true;
  ns.add(nsBody);

  // two drawer faces + groove + brass knobs (face on local +Z)
  for (const dy of [0.19, 0.39]) {
    const face = box(0.34, 0.155, 0.015, mat(0x241812, 0.8));
    face.position.set(0, dy, 0.2225);
    const knob = sphere(0.016, 10, brassMat);
    knob.position.set(0, dy, 0.242);
    ns.add(face, knob);
  }
  const groove = box(0.36, 0.044, 0.006, mat(0x120d09, 0.9));
  groove.position.set(0, 0.29, 0.2185);
  ns.add(groove);

  // top slab with a beading strip around its front edge
  const nsTop = box(0.46, 0.03, 0.48, mat(0x35251a, 0.7));
  nsTop.position.y = 0.505;
  nsTop.castShadow = true;
  // brass trim strip, a hair proud of the top-slab lip
  const beading = box(0.46, 0.012, 0.01, brassMat);
  beading.position.set(0, 0.493, 0.2405);
  ns.add(nsTop, beading);

  // bedside lamp — shade carries its own warm emissive so the lamp
  // itself visibly glows (dedicated material — never mutate cached mats)
  const lampBase = cyl(0.07, 0.09, 0.02, 16, mat(0x1a1c22, 0.5, 0.6));
  lampBase.position.set(0.08, 0.53, -0.08);
  const lampStem = cyl(0.012, 0.012, 0.26, 8, mat(0x1a1c22, 0.5, 0.6));
  lampStem.position.set(0.08, 0.67, -0.08);
  const lampShade = cyl(0.07, 0.11, 0.14, 16, new THREE.MeshStandardMaterial({
    color: 0x8a5a3a, roughness: 0.9, side: THREE.DoubleSide,
    emissive: 0xff9a4e, emissiveIntensity: 0.6,
  }));
  lampShade.position.set(0.08, 0.84, -0.08);
  const bulb = sphere(0.03, 10, new THREE.MeshBasicMaterial({ color: 0xffc98a }));
  bulb.position.set(0.08, 0.81, -0.08);
  const lampLight = new THREE.PointLight(0xffab5e, 1.25, 2.2, 2);
  lampLight.position.set(0.08, 0.82, -0.08);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  lampLight.shadow.camera.near = 0.05;
  lampLight.shadow.camera.far = 2.4;
  lampLight.shadow.bias = -0.004;
  lampLight.shadow.normalBias = 0.02;
  // bedside corner is fully static — bake the shadow map once so it can
  // never shimmer or flicker frame-to-frame (also saves 6 cube renders/frame)
  lampLight.shadow.autoUpdate = false;
  lampLight.shadow.needsUpdate = true;
  ns.add(lampBase, lampStem, lampShade, bulb, lampLight);

  // book stack on top: math + programming books with detailed covers
  const stackDefs = [
    { T: 0.032, color: 0x274a6d, title: 'Linear Algebra', author: 'Strang', motif: 'math', accent: '#00f0ff', x: -0.11, z: 0.02, ry: 0.10 },
    { T: 0.030, color: 0x6d2746, title: 'Clean Code', author: 'Martin', motif: 'code', accent: '#7cfc98', x: -0.115, z: 0.03, ry: -0.06 },
    { T: 0.028, color: 0x276d43, title: 'Algorithms', author: 'Cormen', motif: 'tree', accent: '#a855f7', x: -0.105, z: 0.01, ry: 0.14 },
  ];
  let stackY = 0.5215;   // epsilon above the top slab — no coplanar faces
  for (const def of stackDefs) {
    const b = createBook({ W: 0.20, D: 0.15, ...def });
    b.position.set(def.x, stackY + def.T / 2, def.z);
    b.rotation.y = def.ry;
    ns.add(b);
    stackY += def.T + 0.0012;   // air gap between stacked books — no z-fighting
  }

  g.add(ns);

  /* ── small wall shelf above the headboard ── */
  const shY = 1.95;
  for (let s = 0; s < 2; s++) {
    const plank = box(0.26, 0.035, 1.15, frameWood);
    plank.position.set(3.9, shY + s * 0.42, bzHead + 0.75);
    g.add(plank);
    // little brackets
    for (const oz of [-0.45, 0.45]) {
      const br = box(0.2, 0.03, 0.03, frameWood);
      br.position.set(3.86, shY + s * 0.42 - 0.03, bzHead + 0.75 + oz);
      br.rotation.z = 0.5;
      g.add(br);
    }
  }
  // detailed upright books on both shelves (math + programming titles)
  const shelfDefs = [
    // lower shelf
    { y: shY, z: bzHead + 0.43, H: 0.27, T: 0.055, color: 0x274a6d, title: 'Calculus', author: 'Stewart', motif: 'math' },
    { y: shY, z: bzHead + 0.505, H: 0.25, T: 0.05, color: 0x6d2746, title: 'Real Analysis', motif: 'math' },
    { y: shY, z: bzHead + 0.585, H: 0.28, T: 0.06, color: 0x276d43, title: 'Algorithms', author: 'Cormen', motif: 'tree' },
    { y: shY, z: bzHead + 0.665, H: 0.24, T: 0.05, color: 0x8a3038, title: 'Clean Code', motif: 'code', accent: '#7cfc98', lean: 0.08 },
    { y: shY, z: bzHead + 0.745, H: 0.26, T: 0.055, color: 0x1f6f74, title: 'Rust', motif: 'code', accent: '#f74c00' },
    { y: shY, z: bzHead + 0.82, H: 0.245, T: 0.048, color: 0x3a2d63, title: 'Python', motif: 'code', accent: '#ffd343', lean: -0.07 },
    { y: shY, z: bzHead + 0.90, H: 0.23, T: 0.05, color: 0x43101a, title: 'Number Theory', motif: 'math' },
    // upper shelf (kept clear of plant & candle at the far end)
    { y: shY + 0.42, z: bzHead + 0.41, H: 0.26, T: 0.055, color: 0x274a6d, title: 'Linear Algebra', motif: 'math' },
    { y: shY + 0.42, z: bzHead + 0.49, H: 0.28, T: 0.06, color: 0x6d5a27, title: 'Design Patterns', motif: 'code', accent: '#a855f7' },
    { y: shY + 0.42, z: bzHead + 0.575, H: 0.24, T: 0.05, color: 0x1f6f74, title: 'Haskell', motif: 'code', accent: '#c9a24b', lean: 0.09 },
    { y: shY + 0.42, z: bzHead + 0.65, H: 0.25, T: 0.05, color: 0x6d2746, title: 'Topology', motif: 'tree', lean: -0.11 },
  ];
  shelfDefs.forEach(def => {
    const b = createBook({
      W: 0.17, D: def.H, T: def.T,
      color: def.color, title: def.title, author: def.author || '',
      motif: def.motif, accent: def.accent || '#00f0ff',
    });
    const lean = def.lean || 0;
    b.rotation.x = -Math.PI / 2 + lean;
    b.position.set(
      3.9,
      // +1.2 mm lift keeps the book's bottom face off the plank — no z-fighting
      def.y + 0.0187 + (def.H / 2) * Math.cos(lean) + (def.T / 2) * Math.abs(Math.sin(lean)),
      def.z,
    );
    g.add(b);
  });

  // horizontal book pair on the lower shelf as a bookend
  const hBook1 = createBook({ W: 0.17, D: 0.22, T: 0.045, color: 0x3a2d63, title: 'Set Theory', motif: 'math', accent: '#00f0ff' });
  hBook1.position.set(3.88, shY + 0.0199 + 0.0225, bzHead + 1.02);
  const hBook2 = createBook({ W: 0.16, D: 0.20, T: 0.04, color: 0x8a3038, title: 'Logic', motif: 'math', accent: '#ffb86b' });
  hBook2.rotation.y = 0.18;
  hBook2.position.set(3.89, shY + 0.0199 + 0.045 + 0.0012 + 0.02, bzHead + 1.03);
  g.add(hBook1, hBook2);
  const miniPot = cyl(0.035, 0.026, 0.06, 10, mat(0x8a4b32, 0.9));
  miniPot.position.set(3.9, shY + 0.42 + 0.05, bzHead + 0.95);
  g.add(miniPot);
  for (let l = 0; l < 4; l++) {
    const leaf = sphere(0.028, 8, mat(0x2e7d4f, 0.9));
    leaf.scale.set(1, 0.6, 1.4);
    leaf.position.set(3.9 + rand(-0.02, 0.02), shY + 0.42 + 0.12, bzHead + 0.95 + rand(-0.02, 0.02));
    g.add(leaf);
  }
  const candle = cyl(0.02, 0.02, 0.09, 10, mat(0xe8e2d2, 0.8));
  candle.position.set(3.9, shY + 0.42 + 0.045, bzHead + 1.05);
  const flame = sphere(0.012, 8, new THREE.MeshBasicMaterial({ color: 0xffc060 }));
  flame.scale.set(1, 1.8, 1);
  flame.position.set(3.9, shY + 0.42 + 0.11, bzHead + 1.05);
  const candleLight = new THREE.PointLight(0xffb060, 0.5, 0.9, 2);
  candleLight.position.set(3.9, shY + 0.42 + 0.13, bzHead + 1.05);
  g.add(candle, flame, candleLight);

  room.add(g);
}

/* ── big corner plant (front-left) ───────────────────── */
function buildPlant(room) {
  const g = new THREE.Group();
  const pot = cyl(0.19, 0.14, 0.34, 16, mat(0x77452c, 0.85));
  pot.position.y = 0.17;
  const soil = cyl(0.165, 0.165, 0.03, 16, mat(0x1c130c, 1));
  soil.position.y = 0.33;
  g.add(pot, soil);

  const leafMat = mat(0x256b41, 0.85);
  const leafDark = mat(0x1b5232, 0.85);
  for (let i = 0; i < 9; i++) {
    const stemLen = rand(0.5, 1.05);
    const stem = cyl(0.012, 0.018, stemLen, 6, leafDark);
    const ang = (i / 9) * Math.PI * 2 + rand(-0.3, 0.3);
    const tilt = rand(0.25, 0.75);
    const sx = Math.cos(ang) * tilt * 0.42;
    const sz = Math.sin(ang) * tilt * 0.42;
    stem.position.set(sx * 0.5, 0.33 + stemLen / 2, sz * 0.5 - 0.02);
    stem.rotation.set(sz * 0.9, 0, -sx * 0.9);

    const leaf = sphere(0.13, 10, i % 2 ? leafMat : leafDark);
    leaf.scale.set(1, 0.28, 1.5);
    leaf.position.set(sx, 0.33 + stemLen + 0.02, sz - 0.02);
    leaf.rotation.set(rand(-0.4, 0.4), ang, rand(-0.4, 0.4));

    g.add(stem, leaf);
  }

  g.position.set(-3.25, 0, 1.7);
  room.add(g);
}

/* ── neon LED strips ─────────────────────────────────── */
export let ledStripMats = [];

function buildLedStrips(room) {
  const strip1Mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const strip1 = box(3.4, 0.02, 0.02, strip1Mat);
  strip1.position.set(0, 2.52, -3.93);
  const strip2Mat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
  const strip2 = box(0.02, 2.3, 0.02, strip2Mat);
  strip2.position.set(-3.92, 1.35, -3.9);
  const strip3Mat = new THREE.MeshBasicMaterial({ color: 0x0077ff });
  const strip3 = box(2.3, 0.02, 0.02, strip3Mat);
  strip3.position.set(0, 0.58, -3.44);

  room.add(strip1, strip2, strip3);
  ledStripMats = [strip1Mat, strip2Mat, strip3Mat];
}
