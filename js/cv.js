/* ═══════════════════════════════════════════════
   CV — reads live data straight from the page DOM,
   paginates it dynamically across A4 pages, snaps
   each page to PNG and packs into a PDF.
   Dark / light themes, lazy-loaded libs.
   ═══════════════════════════════════════════════ */

/* fallback only — real content is extracted from the site */
const FALLBACK = {
  name: 'Morteza Vaezi',
  role: 'Full-Stack JavaScript Developer',
  eyebrow: '// CURRICULUM_VITAE',
  tagline: 'I build fast, beautiful & scalable web apps — from pixel-perfect UIs to rock-solid APIs.',
  profile:
    "Full-stack developer (not an engineer!) studying mathematics, with 3+ years of experience turning messy problems into elegant software. From real-time dashboards to headless commerce, I own every layer of the stack — and I genuinely love each one.",
  education: [
    ['B.Sc. Mathematics', '2024 → now',
      'Imam Khomeini International University — currently studying mathematics at undergraduate level.'],
    ['Math–Physics Diploma', 'until 2024',
      'Shahid Beheshti High School — mathematics & physics track.'],
  ],
  languages: [
    ['Persian', 'native'],
    ['English', 'professional'],
  ],
};

/* ── live data extraction from the page ───────────── */

function squash(s) {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function extractCVData() {
  const d = {
    name: FALLBACK.name,
    role: FALLBACK.role,
    eyebrow: FALLBACK.eyebrow,
    tagline: FALLBACK.tagline,
    profile: FALLBACK.profile,
    contacts: [],
    stats: [['3+', 'years coding'], ['27', 'projects shipped']],
    experience: [],
    projects: [],
    skills: [],
    toolbox: [],
    education: FALLBACK.education.map((e) => [...e]),
    languages: FALLBACK.languages.map((l) => [...l]),
  };

  try {
    /* hero */
    const hero = document.querySelector('#hero');
    if (hero) {
      const v = (sel) => hero.querySelector(sel);
      if (v('h1')) d.name = squash(v('h1').textContent);
      if (v('.role')) d.role = squash(v('.role').textContent);
      if (v('.tagline')) d.tagline = squash(v('.tagline').innerHTML.replace(/<br\s*\/?>/gi, ' '));
      if (v('.eyebrow')) d.eyebrow = squash(v('.eyebrow').textContent);
    }

    /* about → profile + stats + location */
    const about = document.querySelector('#about');
    if (about) {
      const body = about.querySelector('.body');
      if (body) d.profile = squash(body.textContent);

      const stats = about.querySelectorAll('.stats li');
      if (stats.length) {
        d.stats = [...stats].map((li) => {
          const b = li.querySelector('b');
          const val = (b?.dataset.count ?? squash(b?.textContent) ?? '0') + (b?.dataset.suffix || '');
          return [val, squash(li.querySelector('span')?.textContent)];
        });
      }
      const meta = about.querySelector('.meta');
      if (meta) d.location = squash(meta.textContent.replace('⌖', ''));
    }

    /* contact → email + socials */
    const mail = document.querySelector('#contact a[href^="mailto:"]');
    if (mail) d.email = mail.getAttribute('href').replace(/^mailto:/i, '');
    const socials = [...document.querySelectorAll('#contact .socials a')]
      .map((a) => {
        try { return new URL(a.href).host + '/'; } catch { return squash(a.textContent); }
      });

    d.contacts = [d.email, d.location, socials.join('  ·  ')].filter(Boolean);

    /* experience → commit history */
    const commits = document.querySelectorAll('#commit-track .commit');
    if (commits.length) {
      d.experience = [...commits].map((c) => {
        const h3 = c.querySelector('h3');
        const em = h3?.querySelector('em');
        const year = squash(em?.textContent).replace(/^·\s*/, '');
        const title = h3 ? squash(h3.textContent.replace(em?.textContent ?? '', '')) : '';
        return [
          squash(c.querySelector('.hash')?.textContent) || '0000000',
          squash(c.querySelector('.branch')?.textContent) || null,
          title,
          year,
          squash(c.querySelector('p')?.textContent),
        ];
      });
    }

    /* projects */
    const prjs = document.querySelectorAll('#project-track .project');
    if (prjs.length) {
      d.projects = [...prjs].map((p) => [
        squash(p.querySelector('.p-num')?.textContent) || 'P.00',
        squash(p.querySelector('h3')?.textContent),
        squash(p.querySelector('header em')?.textContent),
        squash(p.querySelector('p')?.textContent),
        [...p.querySelectorAll('.tags li')].map((t) => squash(t.textContent)),
      ]);
    }

    /* skills */
    const groups = document.querySelectorAll('#skills .skill-group');
    if (groups.length) {
      d.skills = [...groups].map((g) => [
        squash(g.querySelector('h3')?.textContent),
        [...g.querySelectorAll('.skill')].map((s) => [
          squash(s.querySelector('span')?.textContent),
          parseInt(s.querySelector('b')?.textContent ?? '0', 10) || 0,
        ]),
      ]);
    }
    const chips = document.querySelectorAll('#skills .chip-cloud span');
    if (chips.length) d.toolbox = [...chips].map((c) => squash(c.textContent));
  } catch (err) {
    console.warn('[cv] live extraction incomplete, using fallbacks:', err);
  }

  return d;
}

/* ── themes ───────────────────────────────────────── */

const THEMES = {
  dark: {
    bg: 'linear-gradient(160deg, #11141f 0%, #07070d 100%)',
    canvasBg: '#07070d',
    panel: 'rgba(255,255,255,0.035)',
    ink: '#e8ecf1',
    name: '#ffffff',
    dim: '#8b93a3',
    faint: '#59616f',
    accent: '#00f0ff',
    accentSoft: 'rgba(0,240,255,0.12)',
    violet: '#a855f7',
    green: '#37e6a0',
    line: 'rgba(255,255,255,0.10)',
    barTrack: 'rgba(255,255,255,0.08)',
  },
  light: {
    bg: 'linear-gradient(160deg, #ffffff 0%, #e9eef5 100%)',
    canvasBg: '#f6f8fb',
    panel: 'rgba(15,25,45,0.045)',
    ink: '#1a2432',
    name: '#0b1220',
    dim: '#4d5866',
    faint: '#8b95a3',
    accent: '#0077a8',
    accentSoft: 'rgba(0,119,168,0.12)',
    violet: '#7c3aed',
    green: '#0d9668',
    line: 'rgba(10,20,40,0.14)',
    barTrack: 'rgba(10,20,40,0.10)',
  },
};

let currentTheme = 'dark';

export function setCVTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
}

/* ── tiny dom helpers ─────────────────────────────── */

function el(tag, style = {}, ...children) {
  const n = document.createElement(tag);
  Object.assign(n.style, style);
  for (const c of children) {
    if (c == null) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

const MONO = "'JetBrains Mono', ui-monospace, Consolas, monospace";
const SANS = "'Space Grotesk', system-ui, sans-serif";

const W = 1240;
const H = 1754;
const M = 30;    /* outer page margin           */
const PAD = 46;  /* inner content side padding  */
const GAP = 30;  /* column gap                  */

/* ── building blocks (margin-free, wrapped later) ─── */

function block(node, pad = 14) {
  const w = el('div', { paddingBottom: `${pad}px` });
  w.appendChild(node);
  return w;
}

function titleBlock(text, T) {
  const b = block(el('div', {
    fontFamily: MONO, fontSize: '13px', letterSpacing: '0.18em',
    color: T.accent, paddingBottom: '8px',
    borderBottom: `1px solid ${T.line}`,
    textShadow: `0 0 18px ${T.accentSoft}`,
  }, text), 16);
  b._title = true;
  return b;
}

function hashTag(hash, branch, T) {
  const row = el('div', { display: 'flex', gap: '8px', alignItems: 'center' });
  row.appendChild(el('span', {
    fontFamily: MONO, fontSize: '11px', color: T.green,
    background: T.panel, border: `1px solid ${T.line}`,
    padding: '2px 8px', borderRadius: '5px',
  }, hash));
  if (branch) {
    row.appendChild(el('span', {
      fontFamily: MONO, fontSize: '10.5px', color: T.violet,
      border: `1px solid ${T.violet}`, padding: '2px 8px', borderRadius: '99px',
    }, branch));
  }
  return row;
}

function commitItem([hash, branch, title, year, desc], T) {
  return el('div', {},
    hashTag(hash, branch, T),
    el('h3', {
      fontFamily: SANS, fontSize: '17px', fontWeight: '600', color: T.ink,
      margin: '7px 0 4px',
    }, title, el('em', {
      fontFamily: MONO, fontStyle: 'normal', fontSize: '12px',
      color: T.dim, marginLeft: '8px',
    }, `· ${year}`)),
    el('p', { fontFamily: SANS, fontSize: '13.5px', lineHeight: '1.55', color: T.dim }, desc));
}

function projectItem([num, title, year, desc, tags], T) {
  const head = el('div', { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' },
    el('span', { fontFamily: MONO, fontSize: '11px', color: T.accent, letterSpacing: '0.1em' }, num),
    el('span', { fontFamily: SANS, fontSize: '16px', fontWeight: '600', color: T.ink }, title),
    el('span', { fontFamily: MONO, fontSize: '11.5px', color: T.faint, marginLeft: 'auto' }, year));
  const tagRow = el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' });
  for (const t of tags) {
    tagRow.appendChild(el('span', {
      fontFamily: MONO, fontSize: '10px', color: T.dim,
      border: `1px solid ${T.line}`, borderRadius: '99px', padding: '2px 9px',
    }, t));
  }
  return el('div', {}, head,
    el('p', { fontFamily: SANS, fontSize: '13px', lineHeight: '1.5', color: T.dim }, desc),
    tagRow);
}

function skillGroup([group, bars], T) {
  const wrap = el('div', {},
    el('h3', {
      fontFamily: MONO, fontSize: '12px', fontWeight: '600',
      color: T.violet, margin: '4px 0 10px',
    }, group));
  for (const [label, pct] of bars) {
    const track = el('div', {
      flex: '1', height: '6px', borderRadius: '99px',
      background: T.barTrack, overflow: 'hidden', alignSelf: 'center',
    });
    track.appendChild(el('span', {
      display: 'block', width: `${pct}%`, height: '100%',
      borderRadius: '99px',
      background: `linear-gradient(90deg, ${T.accent}, ${T.violet})`,
    }));
    wrap.appendChild(el('div', { display: 'flex', gap: '12px', marginBottom: '11px' },
      el('span', { fontFamily: MONO, fontSize: '12px', color: T.ink, width: '218px', flexShrink: '0' }, label),
      track,
      el('span', { fontFamily: MONO, fontSize: '11px', color: T.accent, width: '26px', textAlign: 'right' }, String(pct))));
  }
  return wrap;
}

function educationItem([title, when, desc], T) {
  return el('div', {},
    el('div', { display: 'flex', alignItems: 'baseline', gap: '10px' },
      el('span', { fontFamily: SANS, fontSize: '14.5px', fontWeight: '600', color: T.ink }, title),
      el('em', { fontFamily: MONO, fontStyle: 'normal', fontSize: '11px', color: T.accent, marginLeft: 'auto' }, when)),
    el('p', { fontFamily: SANS, fontSize: '12.5px', color: T.dim, marginTop: '3px', lineHeight: '1.5' }, desc));
}

/* ── decorative frame ─────────────────────────────── */

function frameCorner(T, pos) {
  const s = {
    position: 'absolute', width: '18px', height: '18px',
    borderColor: T.accent, borderStyle: 'solid', borderWidth: '0',
  };
  if (pos.includes('t')) { s.top = '-1px'; s.borderTopWidth = '2px'; }
  if (pos.includes('b')) { s.bottom = '-1px'; s.borderBottomWidth = '2px'; }
  if (pos.includes('l')) { s.left = '-1px'; s.borderLeftWidth = '2px'; }
  if (pos.includes('r')) { s.right = '-1px'; s.borderRightWidth = '2px'; }
  return el('div', s);
}

/* ── page chrome (header / stats / footer) ────────── */

function roleLine(role, T) {
  const p = el('p', { fontFamily: MONO, fontSize: '19px', color: T.ink, marginBottom: '12px' });
  const i = role.indexOf('JavaScript');
  if (i >= 0) {
    p.append(role.slice(0, i));
    p.appendChild(el('span', { color: T.accent }, 'JavaScript'));
    p.append(role.slice(i + 'JavaScript'.length));
  } else {
    p.textContent = role;
  }
  return p;
}

function pageChrome(T, data, first) {
  const page = el('div', {
    position: 'relative', width: `${W}px`, height: `${H}px`,
    background: T.bg, color: T.ink,
    boxSizing: 'border-box', padding: `${M}px`,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden', flexShrink: '0',
  });

  const sheet = el('div', {
    position: 'relative', flex: '1', minHeight: '0',
    border: `1px solid ${T.line}`,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  });
  sheet.appendChild(el('div', {
    position: 'absolute', top: '5px', left: '5px', right: '5px', bottom: '5px',
    border: `1px solid ${T.line}`, opacity: '0.45', pointerEvents: 'none',
  }));
  sheet.appendChild(frameCorner(T, 'tl'));
  sheet.appendChild(frameCorner(T, 'tr'));
  sheet.appendChild(frameCorner(T, 'bl'));
  sheet.appendChild(frameCorner(T, 'br'));

  if (first) {
    /* ── full header ── */
    const header = el('div', {
      padding: `${PAD}px ${PAD}px 24px`,
      borderBottom: `1px solid ${T.line}`,
      position: 'relative',
    });
    header.appendChild(el('p', {
      fontFamily: MONO, fontSize: '13px', letterSpacing: '0.22em',
      color: T.accent, marginBottom: '10px',
    }, data.eyebrow));
    header.appendChild(el('h1', {
      fontFamily: SANS, fontSize: '54px', fontWeight: '700',
      lineHeight: '1.05', margin: '0 0 8px', color: T.name, letterSpacing: '-0.01em',
    }, data.name));
    header.appendChild(roleLine(data.role, T));
    header.appendChild(el('p', {
      fontFamily: SANS, fontSize: '14.5px', color: T.dim, maxWidth: '720px',
      lineHeight: '1.5', marginBottom: '18px',
    }, data.tagline));

    const contactRow = el('div', { display: 'flex', flexWrap: 'wrap', gap: '10px' });
    for (const c of data.contacts) {
      contactRow.appendChild(el('span', {
        fontFamily: MONO, fontSize: '11.5px', color: T.accent,
        background: T.accentSoft, border: `1px solid ${T.line}`,
        padding: '5px 12px', borderRadius: '6px',
      }, c));
    }
    header.appendChild(contactRow);

    header.appendChild(el('div', {
      position: 'absolute', top: `${PAD}px`, right: `${PAD}px`,
      fontFamily: MONO, fontSize: '11px', color: T.faint, textAlign: 'right',
      lineHeight: '1.8',
    },
      el('div', {}, 'morteza@devcave:~$'),
      el('div', { color: T.green }, '$ cat cv.pdf ▌')));
    sheet.appendChild(header);

    /* ── stats strip ── */
    const statsStrip = el('div', {
      display: 'flex', justifyContent: 'space-between', gap: '12px',
      padding: `18px ${PAD}px`,
      borderBottom: `1px solid ${T.line}`,
    });
    for (const [n, label] of data.stats) {
      statsStrip.appendChild(el('div', { textAlign: 'center', flex: '1' },
        el('div', {
          fontFamily: MONO, fontSize: '26px', fontWeight: '700',
          color: T.accent, textShadow: `0 0 22px ${T.accentSoft}`,
        }, n),
        el('div', { fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.08em', color: T.faint, marginTop: '3px' }, label.toUpperCase())));
    }
    sheet.appendChild(statsStrip);
  } else {
    /* ── slim continuation strip ── */
    sheet.appendChild(el('div', {
      padding: `16px ${PAD}px`,
      borderBottom: `1px solid ${T.line}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    },
      el('span', { fontFamily: MONO, fontSize: '12px', letterSpacing: '0.18em', color: T.accent }, data.eyebrow + ' · CONTINUED'),
      el('span', { fontFamily: SANS, fontSize: '15px', fontWeight: '700', color: T.name }, data.name)));
  }

  /* ── body columns ── */
  const bodyEl = el('div', {
    flex: '1', display: 'flex', gap: `${GAP}px`,
    padding: `24px ${PAD}px 0`, minHeight: '0', alignItems: 'flex-start',
  });
  const mainCol = el('div', { flex: '1.62', minWidth: '0' });
  const sideCol = el('div', { flex: '1', minWidth: '0' });
  bodyEl.appendChild(mainCol);
  bodyEl.appendChild(sideCol);
  sheet.appendChild(bodyEl);

  /* ── footer ── */
  const pageLabel = el('span', {}, '');
  const footer = el('div', {
    borderTop: `1px solid ${T.line}`,
    padding: '14px 0 0',
    margin: `0 ${PAD}px`,
    display: 'flex', justifyContent: 'space-between',
    fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.06em', color: T.faint,
  },
    el('span', {}, `© 2026 ${data.name.toUpperCase()}`),
    el('span', {}, 'morteza@devcave:~$ ./print_cv.sh --done ✓'),
    pageLabel);
  sheet.appendChild(el('div', { padding: '0 0 26px' }, footer));

  page.appendChild(sheet);
  page.appendChild(el('div', {
    position: 'absolute', left: '0', right: '0', bottom: '9px',
    textAlign: 'center', fontFamily: MONO, fontSize: '9.5px',
    letterSpacing: '0.3em', color: T.faint,
  }, '— A4 · 210 × 297 MM · MORTEZAVAEZI.DEV —'));

  return { page, bodyEl, mainCol, sideCol, pageLabel };
}

/* ── measurement + pagination ─────────────────────── */

function columnWidths() {
  const bodyInner = W - 2 * M - 2 - 2 * PAD;
  const mainW = Math.floor((bodyInner - GAP) * 1.62 / 2.62);
  return { mainW, sideW: bodyInner - GAP - mainW };
}

function measureAll(blocks, width) {
  const probe = el('div', {
    position: 'absolute', left: '-99999px', top: '0',
    width: `${width}px`, visibility: 'hidden',
  });
  document.body.appendChild(probe);
  for (const b of blocks) {
    probe.appendChild(b);
    b._h = Math.ceil(b.getBoundingClientRect().height);
    probe.removeChild(b);
  }
  probe.remove();
}

function fillColumn(blocks, budget) {
  const keep = [];
  let used = 0;
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (used + b._h <= budget || keep.length === 0) {
      keep.push(b);
      used += b._h;
      i++;
    } else break;
  }
  /* never leave a section title dangling at the bottom of a page */
  while (keep.length > 1 && keep[keep.length - 1]._title) {
    keep.pop();
    i--;
  }
  return { keep, rest: blocks.slice(i) };
}

function buildMainBlocks(T, data) {
  const blocks = [];
  blocks.push(titleBlock('// PROFILE', T));
  blocks.push(block(el('p', {
    fontFamily: SANS, fontSize: '14px', lineHeight: '1.65', color: T.dim,
  }, data.profile), 20));
  blocks.push(titleBlock('02 // GIT LOG --CAREER', T));
  for (const c of data.experience) blocks.push(block(commitItem(c, T), 14));
  blocks.push(titleBlock('04 // SELECTED_WORK', T));
  for (const p of data.projects) blocks.push(block(projectItem(p, T), 13));
  return blocks;
}

function buildSideBlocks(T, data) {
  const blocks = [];
  if (data.skills.length) {
    blocks.push(titleBlock('03 // STACK.JSON', T));
    for (const g of data.skills) blocks.push(block(skillGroup(g, T), 12));
  }
  if (data.toolbox.length) {
    blocks.push(titleBlock('{ TOOLBOX }', T));
    const chips = el('div', { display: 'flex', flexWrap: 'wrap', gap: '7px' });
    for (const t of data.toolbox) {
      chips.appendChild(el('span', {
        fontFamily: MONO, fontSize: '10.5px', color: T.dim,
        border: `1px solid ${T.line}`, borderRadius: '6px', padding: '4px 10px',
      }, t));
    }
    blocks.push(block(chips, 26));
  }
  blocks.push(titleBlock('// EDUCATION', T));
  for (const e of data.education) blocks.push(block(educationItem(e, T), 14));
  blocks.push(titleBlock('// LANGUAGES', T));
  const langs = el('div', {});
  for (const [lang, lvl] of data.languages) {
    langs.appendChild(el('div', { display: 'flex', marginBottom: '8px' },
      el('span', { fontFamily: SANS, fontSize: '13.5px', color: T.ink }, lang),
      el('span', { fontFamily: MONO, fontSize: '11.5px', color: T.faint, marginLeft: 'auto' }, lvl)));
  }
  blocks.push(block(langs, 0));
  return blocks;
}

function buildPages(holder, T, data) {
  const { mainW, sideW } = columnWidths();
  const mainBlocks = buildMainBlocks(T, data);
  const sideBlocks = buildSideBlocks(T, data);
  measureAll(mainBlocks, mainW);
  measureAll(sideBlocks, sideW);

  const pages = [];
  const labels = [];
  let m = mainBlocks;
  let s = sideBlocks;

  while ((m.length || s.length) && pages.length < 8) {
    const chrome = pageChrome(T, data, pages.length === 0);
    holder.appendChild(chrome.page);

    const budget = chrome.bodyEl.clientHeight - 24; /* minus body padding-top */
    const mf = fillColumn(m, budget);
    const sf = fillColumn(s, budget);
    for (const b of mf.keep) chrome.mainCol.appendChild(b);
    for (const b of sf.keep) chrome.sideCol.appendChild(b);

    labels.push(chrome.pageLabel);
    pages.push(chrome.page);
    m = mf.rest;
    s = sf.rest;
  }

  const total = String(pages.length).padStart(2, '0');
  labels.forEach((l, i) => {
    l.textContent = `PAGE ${String(i + 1).padStart(2, '0')} / ${total}`;
  });

  return pages;
}

/* ── lazy lib loading ─────────────────────────────── */

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let libsPromise = null;
function ensureLibs() {
  if (!libsPromise) {
    libsPromise = Promise.all([
      loadScript('js/lib/html-to-image.min.js'),
      loadScript('js/lib/jspdf.umd.min.js'),
    ]);
  }
  return libsPromise;
}

/* ── generate + download ──────────────────────────── */

export async function downloadCV(onProgress) {
  await ensureLibs();
  await document.fonts?.ready;

  const T = THEMES[currentTheme];
  const data = extractCVData();

  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:1240px;pointer-events:none;';
  document.body.appendChild(holder);

  const dataUrls = [];
  try {
    /* yield once so the PREPARING… label actually paints before DOM measuring */
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
    const pages = buildPages(holder, T, data);

    for (let i = 0; i < pages.length; i++) {
      onProgress?.(`RENDERING ${i + 1}/${pages.length}…`);
      /* double-rAF + timeout lets the status repaint before the blocking toPng */
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80))));

      const url = await window.htmlToImage.toPng(pages[i], {
        backgroundColor: T.canvasBg,
        cacheBust: false,
        width: W,
        height: H,
        canvasWidth: W * 2,   /* 300-dpi A4 */
        canvasHeight: H * 2,
        skipAutoScale: true,
      });
      if (!url || url === 'data:,') throw new Error('snapshot returned empty image');
      dataUrls.push(url);
    }
  } finally {
    holder.remove();
  }

  onProgress?.('PACKING PDF…');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  dataUrls.forEach((url, i) => {
    if (i) pdf.addPage();
    pdf.addImage(url, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  });
  pdf.save(`Morteza-Vaezi-CV-${currentTheme}.pdf`);
}

/* ── wire up the contact-section button ─────────────
   One button, three states:
   idle → choosing (DARK / LIGHT) → busy → idle     */

export function initCVButtons() {
  const btn = document.getElementById('cv-download');
  if (!btn) return;

  const IDLE_HTML = btn.innerHTML;
  let phase = 'idle';

  const renderIdle = () => {
    phase = 'idle';
    btn.disabled = false;
    btn.classList.remove('choosing', 'busy');
    btn.innerHTML = IDLE_HTML;
  };

  const renderChooser = () => {
    phase = 'choosing';
    btn.classList.add('choosing');
    btn.innerHTML =
      '<span class="cv-hint">THEME:</span>' +
      '<span class="cv-opt" data-t="dark">DARK ◐</span>' +
      '<span class="cv-sep"></span>' +
      '<span class="cv-opt" data-t="light">LIGHT ◑</span>' +
      '<span class="cv-cancel" title="Cancel">✕</span>';
  };

  const generate = async (theme) => {
    phase = 'busy';
    btn.disabled = true;
    btn.classList.remove('choosing');
    btn.classList.add('busy');
    btn.innerHTML = '<span class="cv-status">PREPARING…</span>';

    try {
      /* double-rAF ensures the PREPARING… label paints before the blocking work */
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80))));

      setCVTheme(theme);
      await downloadCV((msg) => { btn.innerHTML = `<span class="cv-status">${msg}</span>`; });
      btn.innerHTML = '<span class="cv-status ok">SAVED ✓</span>';
    } catch (err) {
      console.error('[cv] generation failed:', err);
      btn.innerHTML = '<span class="cv-status err">FAILED ✕ RETRY?</span>';
    } finally {
      setTimeout(renderIdle, 1800);
    }
  };

  btn.addEventListener('click', (e) => {
    if (phase === 'busy') return;

    if (phase === 'idle') {
      renderChooser();
      return;
    }

    /* phase === 'choosing' */
    const opt = e.target.closest('.cv-opt');
    const cancel = e.target.closest('.cv-cancel');

    if (cancel) { renderIdle(); return; }
    if (opt) generate(opt.dataset.t);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && phase === 'choosing') renderIdle();
  });
}
