/* ═══════════════════════════════════════════════
   PINNED LISTS — commit + project

   Pattern is identical for both sections:
   section gets taller by --pin-extra / --proj-pin-extra,
   its .pin-stage sticks to top while page scrolls through
   the extra stretch, and the extra pixels are mapped 1:1
   onto the inner track via translate3d.

   Nothing is hijacked — page keeps scrolling natively,
   so wheel/touch/scrollbar/dots all stay native.
   When the inner list fits (extra=0) the mechanism is
   a no-op: no height is added and camera doesn't hold.
   ═══════════════════════════════════════════════ */

export const PIN_SECTIONS = { commit: 2, project: 4 };

function createPin({ sectionId, boxId, trackId, cssVar }) {
  const section = document.getElementById(sectionId);
  const box = document.getElementById(boxId);
  const track = document.getElementById(trackId);

  let extra = 0;
  let applied = -1;

  function measure() {
    if (!section || !box || !track) return 0;
    extra = Math.max(0, Math.round(track.scrollHeight - box.clientHeight));
    section.style.setProperty(cssVar, `${extra}px`);
    applied = -1;
    return extra;
  }

  function setProgress(t) {
    if (!track || extra === 0) return;
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    if (Math.abs(clamped - applied) < 0.0005) return;
    applied = clamped;
    track.style.transform = `translate3d(0, ${-(clamped * extra).toFixed(2)}px, 0)`;
  }

  return { measure, setProgress, get extra() { return extra; } };
}

export const commitPin = createPin({
  sectionId: 'experience',
  boxId: 'commit-scroll',
  trackId: 'commit-track',
  cssVar: '--pin-extra',
});

export const projectPin = createPin({
  sectionId: 'projects',
  boxId: 'project-scroll',
  trackId: 'project-track',
  cssVar: '--proj-pin-extra',
});

/* legacy single-pin exports — kept for backwards compat */
export const PIN_SECTION = PIN_SECTIONS.commit;
export function measurePin() { return commitPin.measure(); }
export function setPinProgress(t) { commitPin.setProgress(t); }

/* multi-pin helpers */
export function measurePins() {
  return {
    commit: commitPin.measure(),
    project: projectPin.measure(),
  };
}

export function setPinsProgress(map) {
  if ('commit' in map) commitPin.setProgress(map.commit);
  if ('project' in map) projectPin.setProgress(map.project);
}
