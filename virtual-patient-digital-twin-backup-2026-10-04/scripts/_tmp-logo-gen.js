/* One-off generator: builds the Sushruta Labs caduceus logo as SVG.
 * Produces assets/icons/logo.svg (full, with wordmark) and
 * assets/icons/logo-mark.svg (emblem only, for the header). */
const fs = require('fs');
const path = require('path');

const W = 850, H = 1030, cx = 425;

/* Catmull-Rom -> cubic Bézier for a smooth centreline. */
function smoothPath(pts) {
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) +
      ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
  }
  return d;
}

/* Snake centreline: a rearing head hook flowing into a double helix. */
const A = 118, YTOP = 374, YBOT = 930, PERIODS = 2;
const head = [
  [275, 272], [250, 296], [258, 328], [294, 344],
  [338, 356], [382, 366], [418, 372], [cx, YTOP]
];
const sine = [];
const N = 140;
for (let i = 1; i <= N; i++) {
  const t = i / N;
  sine.push([cx + A * Math.sin(2 * Math.PI * PERIODS * t), YTOP + t * (YBOT - YTOP)]);
}
const snakeA = head.concat(sine);
const snakeB = snakeA.map((p) => [W - p[0], p[1]]);
const dA = smoothPath(snakeA);
const dB = smoothPath(snakeB);

const CORRIDOR = 48;   // transparent gap cut around each snake
const SNAKE_W = 30;    // visible snake thickness

const wings = `
      <path d="M407 148 C352 98 252 82 152 98 C92 108 42 106 6 102 C22 140 46 164 80 168 C98 196 134 206 170 196 C192 226 238 234 274 220 C302 244 350 246 388 230 Z"/>
      <path d="M407 148 C352 98 252 82 152 98 C92 108 42 106 6 102 C22 140 46 164 80 168 C98 196 134 206 170 196 C192 226 238 234 274 220 C302 244 350 246 388 230 Z" transform="translate(850,0) scale(-1,1)"/>`;

const body = `
    <g mask="url(#slGap)">
      <circle cx="425" cy="58" r="44"/>
      <rect x="407" y="96" width="36" height="848"/>
      ${wings}
      <path d="M425 1018 L393 948 L457 948 Z"/>
    </g>
    <path d="${dA}" fill="none" stroke="#000" stroke-width="${SNAKE_W}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${dB}" fill="none" stroke="#000" stroke-width="${SNAKE_W}" stroke-linecap="round" stroke-linejoin="round"/>`;

const defs = `
  <defs>
    <mask id="slGap" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <path d="${dA}" fill="none" stroke="#000" stroke-width="${CORRIDOR}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${dB}" fill="none" stroke="#000" stroke-width="${CORRIDOR}" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>`;

const FONT = "'Segoe UI', Sohne, Inter, system-ui, Arial, Helvetica, sans-serif";

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sushruta Labs caduceus">
${defs}
  <g fill="#000000">${body}
  </g>
</svg>
`;

const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sushruta Labs">
${defs}
  <g fill="#000000">${body}
  </g>
  <g fill="#000000" font-family="${FONT}" font-weight="700" font-size="72">
    <text x="284" y="580" text-anchor="end" textLength="278" lengthAdjust="spacingAndGlyphs">Sushruta</text>
    <text x="566" y="580" text-anchor="start" textLength="150" lengthAdjust="spacingAndGlyphs">Labs</text>
  </g>
</svg>
`;

const out = path.resolve(__dirname, '..', 'assets', 'icons');
fs.writeFileSync(path.join(out, 'logo-mark.svg'), markSvg);
fs.writeFileSync(path.join(out, 'logo.svg'), fullSvg);
console.log('logo-mark.svg bytes:', markSvg.length);
console.log('logo.svg bytes:', fullSvg.length);
console.log('snakeA path chars:', dA.length);
