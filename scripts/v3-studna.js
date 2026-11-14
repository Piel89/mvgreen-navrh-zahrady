// Ukázkový projekt v3 – zahrada se studnou (bez AI, bez placení). Z jednoho modelu v metrech vzniká:
// kalibrace fotky, půdorys, plán promítnutý do fotky, osazovací plán, výkaz výměr, rozpočet a harmonogram.
// node scripts/v3-studna.js <výstupní složka>
const fs = require('fs'), path = require('path');
global.window = {};
require('../mvgreen-navrh-zahrady/assets/v2/plants-catalog.js');
require('../mvgreen-navrh-zahrady/assets/v2/kb.js');
const G = require('../mvgreen-navrh-zahrady/assets/v3/geo.js');
const P = require('../mvgreen-navrh-zahrady/assets/v3/planting.js');
const cat = {}; window.MVGreenPlantsV2.forEach(p => { cat[p.key] = p; });
const KB = window.MVGreenKB, out = process.argv[2] || '.';
const IW = 2000, IH = 924;                              // souřadnice bodů níže = fotka zmenšená na 2000 × 924
const n = p => [p[0] / IW, p[1] / IH];

// 1) KALIBRACE: zákazník ťukne 4 rohy upravované plochy (vpředu vlevo, vpředu vpravo, vzadu vpravo,
//    vzadu vlevo) – roh vpředu vpravo je mimo záběr, leží na prodloužení plotu a hrany dlažby.
// rohy na ZEMI (pata plotu, ne jeho horní hrana – jinak záhony „visí“ v půlce plotu; patří do návodu pro zákazníka)
const corners = [[100, 862], [2088, 661], [900, 382], [195, 345]].map(n);
// Rozměry: ukázka. Šířka a hloubka zvolené tak, aby přístřešek se studnou vyšel 2,3 m široký (typický).
let W = 16, D = 14;
let cal = G.calibrate(corners, W, D);
const wellW = () => { const a = G.apply(cal.toGround, n([690, 447])), b = G.apply(cal.toGround, n([815, 447])); return Math.hypot(a[0] - b[0], a[1] - b[1]); };
const k = 2.3 / wellW(); W = +(W * k).toFixed(1); D = +(D * k).toFixed(1);
cal = G.calibrate(corners, W, D);
const g = p => G.apply(cal.toGround, n(p)).map(v => +v.toFixed(2));

// 2) PŮDORYS (v nástroji ho navrhne AI architekt a zkontroluje program; tady podle náčrtu, který se majiteli líbil)
const plan = {
  style: 'prirodni', W, D,
  existing: [
    { kind: 'paving', name: 'Zámková dlažba (stávající)', line: [g([100, 862]), g([1690, 700]), g([2088, 661])] },
    { kind: 'building', name: 'Přístřešek se studnou', poly: (function () { const a = g([690, 447]), b = g([815, 447]), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * 2.3, ny = dx / l * 2.3, s = ny < 0 ? -1 : 1; return [a, b, [b[0] + s * nx, b[1] + s * ny], [a[0] + s * nx, a[1] + s * ny]].map(p => p.map(v => +v.toFixed(2))); })() },  // zadní rohy nejsou vidět → čtverec 2,3 m od přední hrany
    { kind: 'wall', name: 'Skalní stěna (stávající)', line: [g([120, 840]), g([215, 600]), g([225, 400])] },
    { kind: 'fence', name: 'Dřevěný plot (stávající)', line: [g([900, 382]), g([1890, 615]), g([2088, 661])] },
    { kind: 'fence', name: 'Drátěný plot (stávající)', line: [g([195, 345]), g([625, 352])] }
  ],
  wall: { name: 'Nová opěrná zídka z přírodního kamene, v. 0,5 m', height: 0.5, line: [g([240, 640]), g([360, 576]), g([505, 505]), g([660, 452])] },
  path: { name: 'Cesta z plochých kamenů v trávníku, š. 1,1 m', width: 1.1, line: [g([985, 770]), g([935, 650]), g([860, 560]), g([790, 487]), g([752, 452])] },
  beds: [
    { name: 'Záhon 1 – pás nad novou zídkou', band: 2.4, light: 'slunce', wet: 'normal', place: 'zed' },
    { name: 'Záhon 2 – u studny', poly: [g([828, 452]), g([852, 418]), g([985, 424]), g([1050, 458]), g([940, 480])], light: 'polostin', wet: 'normal', place: 'zed' }
  ],
  trees: [{ key: 'amelanchier-lamarckii', at: g([330, 455]) }, { key: 'amelanchier-lamarckii', at: g([470, 425]) }]
};
// Záhon 1: pás 2,4 m za novou zídkou (směrem dozadu), ne celý roh zahrady – zbytek je trávník
(function () {
  const L = plan.wall.line, off = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    let nx = -dy / l, ny = dx / l; if (ny < 0) { nx = -nx; ny = -ny; }   // dozadu = rostoucí y
    off.push([L[i][0] + nx * 2.4, L[i][1] + ny * 2.4]);
  }
  const bed = plan.beds[0]; bed.poly = L.concat(off.reverse()).map(p => [Math.max(0.3, +p[0].toFixed(2)), +p[1].toFixed(2)]);
})();
// Záhon 3: lem 0,9 m podél dřevěného plotu (odsazení od plotu směrem do zahrady), od studny k dlažbě
(function () {
  const a = g([1120, 434]), b = g([1840, 603]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const inward = (nx * (W / 2 - a[0]) + ny * (D / 2 - a[1])) > 0 ? 1 : -1, o = 0.9 * inward;
  plan.beds.push({ name: 'Záhon 3 – lem u plotu', poly: [a, b, [b[0] + nx * o, b[1] + ny * o], [a[0] + nx * o, a[1] + ny * o]].map(p => p.map(v => +v.toFixed(2))), light: 'slunce', wet: 'sucho', place: 'cesta' });
})();
// okraj u zdi/plotu = „záda“ záhonu (vysoké rostliny tam): hrana blíž ke stávajícímu plotu/zdi
const lines = plan.existing.filter(e => e.line && e.kind !== 'paving').map(e => e.line).concat([plan.wall.line]);
plan.beds.forEach(b => {
  b.back = [];
  b.poly.forEach((q, i) => { const r = b.poly[(i + 1) % b.poly.length], m = [(q[0] + r[0]) / 2, (q[1] + r[1]) / 2]; if (lines.some(l => l.some((p, j) => j && G.segDist(m, l[j - 1], p) < 0.9))) b.back.push(i); });
  // u záhonu 1 je záda plot a skála, ne nová zídka (ta je vpředu, nízká)
});
// záda záhonu 1 = zadní hrana pásu (vysoké rostliny dozadu, k zídce nízké)
plan.beds[0].back = [plan.wall.line.length];

// 3) VÝSADBA podle místa
const beds = plan.beds.map((b, i) => {
  const A = P.axis(b.poly), depth = A.s1 - A.s0, mod = P.choose(Object.assign({}, b, { depth }), { style: plan.style });
  const lay = P.layout(b, mod, cat, 21 + i);
  lay.plants = lay.plants.filter(p => !plan.trees.some(t => Math.hypot(t.at[0] - p.x, t.at[1] - p.y) < 0.6));
  return Object.assign(b, { module: mod, lay, area: G.polyArea(b.poly), perim: G.polyPerim(b.poly), depth, length: A.t1 - A.t0 });
});
const legend = [], idx = {};
const addL = (key, where) => { if (!idx[key]) { idx[key] = { key, n: 0, where: {}, num: legend.length + 1 }; legend.push(idx[key]); } idx[key].n++; idx[key].where[where] = (idx[key].where[where] || 0) + 1; };
plan.trees.forEach(t => addL(t.key, 'Solitéry v záhonu 1'));
beds.forEach((b, i) => b.lay.plants.forEach(p => addL(p.key, 'Záhon ' + (i + 1))));

// 4) VÝMĚRY a ROZPOČET (kb.js) – vše z půdorysu, žádný odhad AI
const lineLen = l => l.reduce((s, p, i) => i ? s + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0, 0);
const pathLen = lineLen(plan.path.line), wallLen = lineLen(plan.wall.line);
const bedArea = beds.reduce((s, b) => s + b.area, 0), wellA = G.polyArea(plan.existing[1].poly);
const lawn = W * D - bedArea - pathLen * plan.path.width - wellA;
const PRICE = { perennial: 95, grass: 120, lowgrass: 85, shrub: 280, conifer: 450, tree: 1490, bulb: 12 };
// solitéry (vzrostlé, 150–200 cm) jsou dražší než běžný keř v kontejneru
const SOLO = new Set(plan.trees.map(t => t.key));
const plantsForKB = legend.map(l => ({ name: cat[l.key].name, count: l.n, kind: cat[l.key].kind, price: SOLO.has(l.key) ? 1290 : (PRICE[cat[l.key].kind] || 95) }));
const model = { beds: beds.map(b => ({ area: b.area, perimeter: b.perim })), gravel: [], paving: [], stepping: [{ area: pathLen * plan.path.width }], paths: [], walls: [{ length: wallLen, height: plan.wall.height }], steps: [],
  lawn: lawn * 0.45, lawnRegen: lawn * 0.55, lawnExtra: 0, finish: { paving: 'kamen', mulch: 'kura', edge: 'plast' } };
const est = KB.estimate(model, plantsForKB);

// 5) data pro stránku
const toPx = p => { const q = G.apply(cal.toPhoto, p); return [+(q[0]).toFixed(5), +(q[1]).toFixed(5)]; };
const data = {
  W, D, corners, H: cal.toPhoto, Hg: cal.toGround,
  plan: { existing: plan.existing, wall: plan.wall, path: plan.path, trees: plan.trees.map(t => ({ at: t.at, key: t.key, num: idx[t.key].num, h: 4, r: 1.6, color: '#6E9A4F' })),
    beds: beds.map((b, i) => ({ name: b.name, poly: b.poly, module: b.module.name, why: b.module.why, area: +b.area.toFixed(1), depth: +b.depth.toFixed(1), length: +b.length.toFixed(1), light: b.light, wet: b.wet,
      plants: b.lay.plants.map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), num: idx[p.key].num, layer: p.layer, r: cat[p.key].spon / 2, h: cat[p.key].height, c: cat[p.key].flower || cat[p.key].leaf, leaf: cat[p.key].leaf, k: cat[p.key].kind, ev: !!cat[p.key].evergreen })),
      counts: Object.entries(b.lay.counts).map(([key, c]) => ({ num: idx[key].num, name: cat[key].name, n: c })) })) },
  legend: legend.map(l => ({ num: l.num, name: cat[l.key].name, latin: cat[l.key].latin, n: l.n, where: Object.entries(l.where).map(([w, c]) => w + ': ' + c).join(', '), color: cat[l.key].flower || cat[l.key].leaf, bloom: cat[l.key].bloom, height: cat[l.key].height, spon: cat[l.key].spon, kind: cat[l.key].kind, price: SOLO.has(l.key) ? 1290 : (PRICE[cat[l.key].kind] || 95) })),
  quantities: { lawn: +lawn.toFixed(0), beds: +bedArea.toFixed(1), path: +(pathLen * plan.path.width).toFixed(1), pathLen: +pathLen.toFixed(1), wall: +wallLen.toFixed(1), well: +wellA.toFixed(1) },
  estimate: est
};
fs.writeFileSync(path.join(out, 'studna-v3.json'), JSON.stringify(data));
console.log('Rozměry ukázky:', W, '×', D, 'm · studna', wellW().toFixed(2), 'm');
console.log('Cesta', pathLen.toFixed(1), 'm · zídka', wallLen.toFixed(1), 'm · záhony', bedArea.toFixed(1), 'm² · trávník', lawn.toFixed(0), 'm²');
beds.forEach((b, i) => console.log(`Záhon ${i + 1}: ${b.area.toFixed(1)} m², hloubka ${b.depth.toFixed(1)} → ${b.module.name}: ` + Object.entries(b.lay.counts).map(([key, c]) => cat[key].name + ' ×' + c).join(', ')));
console.log('Rozpočet:', est.totals.total, 'Kč ·', est.totals.hours, 'h ·', est.weekends.length, 'víkendů');
