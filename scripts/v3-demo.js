// Ukázka v3 (bez AI, bez placení): půdorys zahrady se studnou → kompozice podle místa → osazovací plán v SVG.
// node scripts/v3-demo.js <výstupní složka>
const fs = require('fs'), path = require('path');
global.window = {};
require('../mvgreen-navrh-zahrady/assets/v2/plants-catalog.js');
const G = require('../mvgreen-navrh-zahrady/assets/v3/geo.js');
const P = require('../mvgreen-navrh-zahrady/assets/v3/planting.js');
const cat = {}; window.MVGreenPlantsV2.forEach(p => { cat[p.key] = p; });
const out = process.argv[2] || '.';

// Půdorys v metrech (x doprava, y od fotografa dozadu). V hotovém nástroji ho navrhne AI architekt
// z měření zákazníka a kontroluje ho program; tady je ručně podle náčrtu ze 13. 11.
const W = 16, D = 14, style = 'prirodni';
const site = {
  existing: [
    { kind: 'paving', name: 'Zámková dlažba (stávající)', poly: [[0, 0], [16, 0], [16, 1.6], [0, 1.6]] },
    { kind: 'building', name: 'Přístřešek se studnou', poly: [[5.2, 11], [7.6, 11], [7.6, 13.4], [5.2, 13.4]] },
    { kind: 'wall', name: 'Stávající kamenná zídka', line: [[0.3, 1.6], [0.3, 5.2]] },
    { kind: 'fence', name: 'Dřevěný plot (stávající)', line: [[16, 1.6], [16, 14]] },
    { kind: 'fence', name: 'Drátěný plot (stávající)', line: [[0, 14], [5.2, 14]] }
  ],
  wall: { name: 'Nová opěrná zídka z přírodního kamene, v. 0,5 m', line: [[0.3, 5.2], [1.6, 7.6], [3.4, 9.6], [5.2, 11]] },
  path: { name: 'Cesta z plochých kamenů, š. 1,1 m', line: [[8.6, 1.6], [8.4, 4.5], [7.4, 7.5], [6.6, 10], [6.4, 11]], width: 1.1 },
  beds: [
    { name: 'Záhon 1 – nad novou zídkou', poly: [[0.3, 5.4], [1.4, 7.7], [3.2, 9.8], [4.9, 11.1], [4.9, 13.8], [0.3, 13.8]], back: [4, 5], light: 'slunce', wet: 'normal', place: 'zed' },
    { name: 'Záhon 2 – u studny', poly: [[7.9, 10.6], [11.2, 10.6], [11.6, 12.2], [11.2, 13.8], [7.9, 13.8]], back: [3], light: 'polostin', wet: 'normal', place: 'zed' },
    { name: 'Záhon 3 – lem u plotu', poly: [[14.9, 2.4], [15.8, 2.4], [15.8, 13.6], [14.9, 13.6]], back: [1], light: 'slunce', wet: 'sucho', place: 'cesta' }
  ],
  trees: [{ key: 'amelanchier-lamarckii', at: [1.6, 12.2] }, { key: 'amelanchier-lamarckii', at: [3.4, 12.6] }]
};

// výběr kompozice a rozmístění
const beds = site.beds.map((b, i) => {
  const A = P.axis(b.poly), depth = A.s1 - A.s0;
  const mod = P.choose(Object.assign({}, b, { depth }), { style });
  const lay = P.layout(b, mod, cat, 11 + i);
  return Object.assign({}, b, { mod, lay, area: G.polyArea(b.poly), depth, length: A.t1 - A.t0 });
});
// kmeny stromů se v záhonu nesázejí – rostliny pod korunou blíž než 0,6 m od kmene pryč
beds.forEach(b => { b.lay.plants = b.lay.plants.filter(p => !site.trees.some(t => Math.hypot(t.at[0] - p.x, t.at[1] - p.y) < 0.6)); });

// legenda s počty
const legend = [], idx = {};
const addL = (k, n, where) => { if (!idx[k]) { idx[k] = { key: k, n: 0, where: {}, num: legend.length + 1 }; legend.push(idx[k]); } idx[k].n += n; idx[k].where[where] = (idx[k].where[where] || 0) + n; };
site.trees.forEach(t => addL(t.key, 1, 'Solitéry'));
beds.forEach((b, i) => b.lay.plants.forEach(p => addL(p.key, 1, 'Záhon ' + (i + 1))));

// SVG – měřítko 1 m = 46 px, zadní část nahoře
const S = 46, M = 60, VW = W * S + M * 2, VH = D * S + M * 2;
const X = x => M + x * S, Y = y => M + (D - y) * S;
const pts = p => p.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join(' ');
const line = l => l.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join(' ');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" font-family="Schibsted Grotesk, system-ui, sans-serif">`;
svg += `<rect width="${VW}" height="${VH}" fill="#FBFAF4"/>`;
svg += `<rect x="${X(0)}" y="${Y(D)}" width="${W * S}" height="${D * S}" fill="#CFE3B4"/>`;   // trávník
for (let x = 0; x <= W; x++) svg += `<line x1="${X(x)}" y1="${Y(0)}" x2="${X(x)}" y2="${Y(D)}" stroke="#7FA36B" stroke-opacity=".18"/>`;
for (let y = 0; y <= D; y++) svg += `<line x1="${X(0)}" y1="${Y(y)}" x2="${X(W)}" y2="${Y(y)}" stroke="#7FA36B" stroke-opacity=".18"/>`;
site.existing.forEach(e => {
  if (e.poly) svg += `<polygon points="${pts(e.poly)}" fill="${e.kind === 'building' ? '#B9AFA2' : '#D9D3C7'}" stroke="#8C8273" stroke-width="1.5"/>`;
  if (e.line) svg += `<path d="${line(e.line)}" fill="none" stroke="${e.kind === 'fence' ? '#6B5A45' : '#8C8273'}" stroke-width="${e.kind === 'fence' ? 3 : 7}" stroke-dasharray="${e.kind === 'fence' ? '10 5' : ''}"/>`;
});
svg += `<path d="${line(site.path.line)}" fill="none" stroke="#C9C0AE" stroke-width="${site.path.width * S}" stroke-linecap="round" stroke-linejoin="round"/>`;
svg += `<path d="${line(site.path.line)}" fill="none" stroke="#FBFAF4" stroke-width="2" stroke-dasharray="3 9"/>`;
svg += `<path d="${line(site.wall.line)}" fill="none" stroke="#7D7466" stroke-width="9" stroke-linecap="round"/>`;
beds.forEach(b => { svg += `<polygon points="${pts(b.poly)}" fill="#8A6A4B" fill-opacity=".28" stroke="#5E4630" stroke-width="2"/>`; });
// rostliny: kruh = šířka v dospělosti (spon), barva = květ nebo list
const order = { cibule: 0, koberec: 1, skupina: 2, kostra: 3 };
beds.forEach(b => b.lay.plants.slice().sort((a, c) => order[a.layer] - order[c.layer]).forEach(p => {
  const c = cat[p.key], r = p.layer === 'cibule' ? 2.2 : Math.max(4, c.spon / 2 * S * 0.95), col = c.flower || c.leaf;
  svg += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${r.toFixed(1)}" fill="${col}" fill-opacity="${p.layer === 'koberec' ? .55 : .85}" stroke="${p.layer === 'kostra' ? '#1F3A22' : '#FFFFFF'}" stroke-width="${p.layer === 'kostra' ? 2.2 : 1}"/>`;
  if (p.layer !== 'cibule' && r >= 9) svg += `<text x="${X(p.x).toFixed(1)}" y="${(Y(p.y) + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#1C2A1E">${idx[p.key].num}</text>`;
}));
site.trees.forEach(t => { svg += `<circle cx="${X(t.at[0])}" cy="${Y(t.at[1])}" r="${1.6 * S}" fill="#5E8E46" fill-opacity=".22" stroke="#3F6E45" stroke-width="2" stroke-dasharray="6 4"/><circle cx="${X(t.at[0])}" cy="${Y(t.at[1])}" r="5" fill="#3F6E45"/><text x="${X(t.at[0]) + 8}" y="${Y(t.at[1]) - 6}" font-size="12" font-weight="700" fill="#1C2A1E">${idx[t.key].num}</text>`; });
// kóty záhonů a popisky
beds.forEach((b, i) => {
  const c = b.lay.axis.c;
  // popisek mimo rostliny: štítek u nejnižšího (předního) bodu záhonu, pod ním
  const lo = b.poly.slice().sort((p, q) => p[1] - q[1])[0], lx = Math.min(W - 1.4, Math.max(1.4, lo[0])), ly = lo[1] - 0.45;
  svg += `<rect x="${X(lx) - 58}" y="${Y(ly) - 13}" width="116" height="20" rx="10" fill="#2B1F14"/><text x="${X(lx)}" y="${Y(ly) + 2}" text-anchor="middle" font-size="12" font-weight="700" fill="#FBFAF4">Záhon ${i + 1} · ${b.area.toFixed(1).replace('.', ',')} m²</text>`;
});
// rozměry pozemku
svg += `<path d="M${X(0)} ${Y(0) + 26}H${X(W)}" stroke="#2B1F14"/><text x="${X(W / 2)}" y="${Y(0) + 44}" text-anchor="middle" font-size="13" font-weight="700">16,0 m</text>`;
svg += `<path d="M${X(0) - 26} ${Y(0)}V${Y(D)}" stroke="#2B1F14"/><text x="${X(0) - 34}" y="${Y(D / 2)}" text-anchor="middle" font-size="13" font-weight="700" transform="rotate(-90 ${X(0) - 34} ${Y(D / 2)})">14,0 m</text>`;
svg += `<text x="${X(8.6)}" y="${Y(0) - 6}" text-anchor="middle" font-size="11" fill="#555">▲ místo focení</text>`;
svg += '</svg>';

const data = {
  svg,
  beds: beds.map((b, i) => ({ name: b.name, area: +b.area.toFixed(1), length: +b.length.toFixed(1), depth: +b.depth.toFixed(1), light: b.light, wet: b.wet, place: b.place, module: b.mod.name, why: b.mod.why,
    counts: Object.entries(b.lay.counts).map(([k, n]) => ({ num: idx[k].num, name: cat[k].name, n })) })),
  legend: legend.map(l => ({ num: l.num, name: cat[l.key].name, latin: cat[l.key].latin, n: l.n, spon: cat[l.key].spon, height: cat[l.key].height, where: Object.entries(l.where).map(([w, n]) => w + ': ' + n).join(', '), color: cat[l.key].flower || cat[l.key].leaf, bloom: cat[l.key].bloom })),
  modules: P.MODULES.map(m => ({ id: m.id, name: m.name, styles: m.styles, light: m.light, wet: m.wet, place: m.place, depth: m.depth, why: m.why,
    plants: [m.kostra && ('kostra: ' + cat[m.kostra.key].name + ' po ' + String(m.kostra.every).replace('.', ',') + ' m' + (m.kostra.alt ? ' střídavě s ' + cat[m.kostra.alt].name : '')), m.skupiny && m.skupiny.length && ('skupiny: ' + m.skupiny.map(k => cat[k].name).join(', ')), m.koberec && ('koberec: ' + cat[m.koberec.key].name), m.cibule && ('cibuloviny: ' + cat[m.cibule.key].name + ' ' + m.cibule.perM2 + ' ks/m²')].filter(Boolean) }))
};
fs.writeFileSync(path.join(out, 'plan.svg'), svg);
fs.writeFileSync(path.join(out, 'demo.json'), JSON.stringify(data, null, 1));
console.log(beds.map((b, i) => `Záhon ${i + 1}: ${b.area.toFixed(1)} m², hloubka ${b.depth.toFixed(1)} m → ${b.mod.name}: ` + Object.entries(b.lay.counts).map(([k, n]) => cat[k].name + ' ×' + n).join(', ')).join('\n'));
console.log('Celkem rostlin:', legend.reduce((s, l) => s + l.n, 0), 'druhů:', legend.length);
