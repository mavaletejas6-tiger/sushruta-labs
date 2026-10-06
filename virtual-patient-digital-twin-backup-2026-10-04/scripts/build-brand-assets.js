/* build-brand-assets.js — generates the Sushruta Labs brand SVGs.
 *
 * Reconstructed from the supplied caduceus artwork (navy #1D3F7F on transparent):
 *   assets/images/sushruta-labs-mark.svg        emblem only            (header, favicon)
 *   assets/images/sushruta-labs-horizontal.svg  emblem + wordmark      (top-right corner)
 *   assets/images/sushruta-labs-logo.svg        emblem + split wordmark (matches the artwork)
 *
 * Why a generator rather than hand-edited files: the geometry is all parametric
 * (helix amplitude, wing sweep, staff width), so tweaks stay consistent across the
 * three lockups instead of drifting apart.
 *
 * Run:  node scripts/build-brand-assets.js
 */
const fs = require('fs');
const path = require('path');

const NAVY = '#1D3F7F';
const FONT = "'Poppins','Montserrat','Segoe UI',Arial,Helvetica,sans-serif";

/* ------------------------------------------------------------------ helpers */
const fmt = (n) => Math.round(n * 100) / 100;

/* Catmull-Rom through the points -> cubic beziers, for the serpent's smooth
 * centreline. Plain cubic control points would pinch on a sine this dense. */
function smoothPath(pts) {
  let d = 'M' + fmt(pts[0][0]) + ' ' + fmt(pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += 'C' + fmt(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + fmt(p1[1] + (p2[1] - p0[1]) / 6) +
      ' ' + fmt(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + fmt(p2[1] - (p3[1] - p1[1]) / 6) +
      ' ' + fmt(p2[0]) + ' ' + fmt(p2[1]);
  }
  return d;
}

/* ----------------------------------------------------------------- geometry */
/* Canonical art space: 940 x 1120, staff centred on CX. The wings span the full
 * width and the spear tip the full height, so this box is the artwork bounds. */
const CX = 470;

/* Serpent geometry. Fewer, looser turns than a literal helix: at header size a
 * tight coil collapses into a spring-like blob, and the reference reads as three
 * broad sweeps. AMP is wide enough that the strands separate cleanly at the top. */
const S_TOP = 356, S_BOT = 1004, AMP = 150, PERIODS = 2.5;
const SNAKE_W = 30;    // visible strand thickness
const CORRIDOR = 52;   // knockout width behind the strands (creates the white outline)
const CROSS_GAP = 16;  // white gap where strand A passes over strand B

/* Head sits up and to the left of the staff, tilted, as in the artwork. */
const HEAD = { cx: 286, cy: 330, rx: 44, ry: 31, rot: -26 };

/* Double helix: two centrelines 180 deg out of phase. They meet at the top and
 * again at the tail, which is what makes it read as one double-ended serpent. */
function helix(phase) {
  const pts = [], N = 180;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([CX + AMP * Math.sin(2 * Math.PI * PERIODS * t + phase),
      S_TOP + t * (S_BOT - S_TOP)]);
  }
  return pts;
}

/* Strand A carries the head, so it starts with a neck sweeping in from the left. */
const NECK = [[HEAD.cx + 20, HEAD.cy - 14], [350, 322], [412, 344]];
const strandA = NECK.concat(helix(0).slice(1));
const strandB = helix(Math.PI);
const dA = smoothPath(strandA);
const dB = smoothPath(strandB);

/* Right wing; the left is the same path mirrored, so only one is authored.
 * Built as an explicit scallop chain rather than a generated arc so the feathers
 * keep the artwork's stepped profile. The band is deliberately thin (about a
 * quarter of its span) and carries five lobes: a thicker wing reads as a solid
 * blob at header size and swallows the individual feathers entirely. */
const WING_R = [
  'M476,158',                                  // shoulder, meets the staff
  'C552,118 668,100 812,110',                  // leading edge sweeping out to the tip
  'C884,116 924,134 940,152',                  // tip, rounded over
  'C916,182 884,196 852,192',                  // underside, back inward
  'C848,222 800,234 772,214',                  // feather 1 (deepest)
  'C762,244 712,254 686,232',                  // feather 2
  'C672,260 622,268 598,246',                  // feather 3
  'C580,272 530,278 508,256',                  // feather 4
  'C496,272 484,214 476,158 Z'                 // back to the shoulder
].join(' ');

/* ---------------------------------------------------------------- assembly */
/* Two masks do the visual work:
 *   gap   - knocks a white corridor out of the staff/wings so the serpent reads
 *           as being in front of them instead of merging into one blob.
 *   underA- knocks a corridor out of strand B wherever strand A crosses it, which
 *           is what makes the pair read as an interwoven double helix. */
const UNDER_W = SNAKE_W + CROSS_GAP;

function defs(id) {
  return `
  <defs>
    <mask id="${id}gap" maskUnits="userSpaceOnUse" x="-4" y="-4" width="948" height="1128">
      <rect x="-4" y="-4" width="948" height="1128" fill="#fff"/>
      <path d="${dA}" fill="none" stroke="#000" stroke-width="${CORRIDOR}" stroke-linecap="round"/>
      <path d="${dB}" fill="none" stroke="#000" stroke-width="${CORRIDOR}" stroke-linecap="round"/>
    </mask>
    <mask id="${id}under" maskUnits="userSpaceOnUse" x="-4" y="-4" width="948" height="1128">
      <rect x="-4" y="-4" width="948" height="1128" fill="#fff"/>
      <path d="${dA}" fill="none" stroke="#000" stroke-width="${UNDER_W}" stroke-linecap="round"/>
    </mask>
  </defs>`;
}

/* Orb + staff + spear tip + both wings, with the serpent corridor cut out. */
function body(id) {
  return `
  <g fill="${NAVY}" mask="url(#${id}gap)">
    <circle cx="${CX}" cy="60" r="52"/>
    <path d="M${CX - 15},96 h30 v944 h-30 Z"/>
    <path d="M${CX - 15},1040 L${CX},1118 L${CX + 15},1040 Z"/>
    <path d="${WING_R}"/>
    <path d="${WING_R}" transform="translate(940,0) scale(-1,1)"/>
  </g>`;
}

/* Both strands on top. A is drawn solid; B is masked by `under` so A cuts a
 * white gap through it wherever the two cross. */
function serpent(id) {
  return `
  <g fill="${NAVY}" stroke="${NAVY}">
    <path d="${dA}" fill="none" stroke-width="${SNAKE_W}" stroke-linecap="round"/>
    <path d="${dB}" fill="none" stroke-width="${SNAKE_W}" stroke-linecap="round" mask="url(#${id}under)"/>
    <ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}"
      transform="rotate(${HEAD.rot} ${HEAD.cx} ${HEAD.cy})" stroke="none"/>
  </g>`;
}

function svg(vb, id, inner, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${label}">
  <title>${label}</title>${defs(id)}
${body(id)}${serpent(id)}${inner}
</svg>
`;
}

/* Emblem only - the header mark and the favicon source. */
const markSvg = svg('-2 -2 944 1124', 'm', '', 'Sushruta Labs');

/* Full lockup with the split wordmark, matching the supplied artwork: the
 * serpent occupies the wings' width, so the words sit beside the staff at
 * mid-height rather than underneath it. */
const wordText = (x, y, anchor, len) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" textLength="${len}" lengthAdjust="spacingAndGlyphs">`;
const logoSvg = svg('-2 -2 944 1124', 'l',
  `
  <g fill="${NAVY}" font-family="${FONT}" font-weight="700" font-size="74">
    ${wordText(306, 596, 'end', 300)}Sushruta</text>
    ${wordText(634, 596, 'start', 168)}Labs</text>
  </g>`,
  'Sushruta Labs');

/* Horizontal lockup for the short wide header slot: the wordmark goes beside
 * the emblem rather than through it, since there is no vertical room. */
const H_W = 372, H_H = 100, EM_H = 92, EM_W = EM_H * (928 / 1124);
const WORD_X = EM_W + 20;
const horizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${H_W} ${H_H}" role="img" aria-label="Sushruta Labs">
  <title>Sushruta Labs</title>${defs('h')}
  <g transform="translate(${(H_H - EM_H) / 2 + 2},${(H_H - EM_H) / 2}) scale(${EM_H / 1124})">
${body('h')}${serpent('h')}
  </g>
  <text x="${WORD_X}" y="${H_H / 2}" fill="${NAVY}" font-family="${FONT}" font-weight="700"
    font-size="40" textLength="${H_W - WORD_X - 4}" lengthAdjust="spacingAndGlyphs"
    dominant-baseline="central">Sushruta Labs</text>
</svg>
`;

/* -------------------------------------------------------------------- write */
const out = path.resolve(__dirname, '..', 'assets', 'images');
fs.mkdirSync(out, { recursive: true });
const files = {
  'sushruta-labs-mark.svg': markSvg,
  'sushruta-labs-logo.svg': logoSvg,
  'sushruta-labs-horizontal.svg': horizontalSvg,
};
for (const [name, data] of Object.entries(files)) {
  fs.writeFileSync(path.join(out, name), data);
  console.log(`${name.padEnd(30)} ${data.length} bytes`);
}