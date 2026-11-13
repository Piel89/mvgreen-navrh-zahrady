#!/usr/bin/env node
/*
 * Sestaví katalog rostlin pro AI architekta v2 z tabulek v data/rostliny/*.txt.
 *   node scripts/build-plants.js          → kontrola + zápis mvgreen-navrh-zahrady/assets/v2/plants-catalog.js
 *   node scripts/build-plants.js --check  → jen kontrola (nic nezapisuje)
 * Fotky bere z data/plant-photos.json (plní scripts/plant-photos.js, schvaluje majitel v přehledu).
 * Formát řádku viz data/rostliny/README.md.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'data', 'rostliny');
const OUT = path.join(ROOT, 'mvgreen-navrh-zahrady', 'assets', 'v2', 'plants-catalog.js');
const PHOTOS = path.join(ROOT, 'data', 'plant-photos.json');

const KIND = { p: 'perennial', g: 'grass', lg: 'lowgrass', k: 'shrub', j: 'conifer', s: 'tree', c: 'climber', b: 'bulb',
  perennial: 'perennial', grass: 'grass', lowgrass: 'lowgrass', shrub: 'shrub', conifer: 'conifer' };
const ROLE = { b: 'back', m: 'mid', f: 'front', t: 'tree', c: 'climber', bu: 'bulb', back: 'back', mid: 'mid', front: 'front' };
const SUN = { S: 'Slunce', P: 'Polostín', T: 'Stín' };
const WATER = { D: 'dry', N: 'normal', W: 'wet' };
const FLOWER = { fi: '#7A5FB5', mo: '#5B7FD0', sv: '#A9B8E8', la: '#B39CD8', bi: '#FBFAF2', kr: '#F2E8C6', ru: '#E58AA8', sr: '#F2C6D0',
  ma: '#C2307A', cv: '#C8323A', vi: '#7A2440', or: '#E07A30', zl: '#E6C531', sz: '#F0E08A', ze: '#B8C98A', hn: '#9A6A4A', si: '#D8DCD2' };
const LEAF = { z: '#5E8F4B', tz: '#3F6E45', bz: '#4E7A40', sz: '#9AAA8C', si: '#B8C0B0', mz: '#7E9AA6', zl: '#C8C46A', cv: '#6A2E3A',
  pe: '#A9C08A', or: '#C0703A', hn: '#8A6A4A', ma: '#A0406A' };
const FLAGS = { t: 'thorny', e: 'evergreen', x: 'toxic', a: 'acid', i: 'spreads', v: 'wet' };

const color = (v, map, field, err) => {
  if (v === '-' || v === '') return '';
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  if (map[v]) return map[v];
  err('neznámá barva ' + field + ' „' + v + '“'); return '';
};
const keyOf = latin => latin.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

const errors = [], warns = [], plants = [], seen = {};
for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.txt')).sort()) {
  fs.readFileSync(path.join(DIR, file), 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.startsWith('#')) return;
    const where = file + ':' + (i + 1), err = m => errors.push(where + ' ' + m);
    const c = line.split('|').map(s => s.trim());
    if (c.length !== 12) return err('má ' + c.length + ' sloupců místo 12');
    const [name, latin, kind, role, h, s, sun, water, fl, leaf, bloom, flags] = c;
    const p = { key: keyOf(latin), name, latin, kind: KIND[kind], role: ROLE[role], height: +h, spon: +s,
      sun: [...sun].map(x => SUN[x]), water: [...water].map(x => WATER[x]),
      flower: color(fl, FLOWER, 'květu', err), leaf: color(leaf, LEAF, 'listu', err) };
    if (!name || !latin) err('chybí název');
    if (!p.kind) err('neznámý typ „' + kind + '“');
    if (!p.role) err('neznámá role „' + role + '“');
    if (!(p.height > 0 && p.height <= 40)) err('výška ' + h);
    if (!(p.spon > 0 && p.spon <= 15)) err('spon ' + s);
    if (!sun || p.sun.some(x => !x)) err('slunce „' + sun + '“');
    if (!water || p.water.some(x => !x)) err('voda „' + water + '“');
    if (!p.leaf) err('chybí barva listu');
    if (bloom !== '-') {
      const m = /^(\d{1,2})-(\d{1,2})$/.exec(bloom);
      if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > 12) err('kvetení „' + bloom + '“');
      else p.bloom = [+m[1], +m[2]];
      if (!p.flower) warns.push(where + ' kvete, ale nemá barvu květu');
    } else p.bloom = null;
    if (flags !== '-') for (const f of flags) { if (!FLAGS[f]) err('neznámý příznak „' + f + '“'); else p[FLAGS[f]] = true; }
    // 2026-11-13: v tabulkách chyběl příznak jedovatosti u 33 rostlin (tis, túje, cesmína, brslen, bobkovišeň,
    // čemeřice, pryšec…) – „Nízká údržba“ pak nabídla tis. Silně jedovaté rody se označí vždy.
    if (/^(Taxus|Thuja|Aconitum|Digitalis|Convallaria|Daphne|Laburnum|Euonymus|Helleborus|Prunus laurocerasus|Ilex|Euphorbia|Ricinus|Colchicum|Nerium|Brugmansia|Datura|Veratrum|Rhododendron|Kalmia|Pieris)\b/.test(latin)) p.toxic = true;
    // Barva do plánu a kalendáře: květ, jinak list. Stálezelené nemají „kvetení“ celý rok
    // (Martin 2026-11-08: u stálezelených se ukazovalo kvetení všech 12 měsíců).
    p.color = p.flower || p.leaf;
    if (p.kind === 'tree' && p.role !== 'tree') err('strom musí mít roli t');
    if (p.kind === 'climber' && p.role !== 'climber') err('popínavka musí mít roli c');
    if (p.kind === 'bulb' && p.role !== 'bulb') err('cibulovina musí mít roli bu');
    if (seen[p.key]) err('duplicita s ' + seen[p.key]); else seen[p.key] = where;
    p.file = file.replace(/\.txt$/, '');
    plants.push(p);
  });
}

// Kontrola výšek proti katalogu 805 (údaje RHS / Missouri / NC State) – jen pro druhy bez kultivaru.
try {
  const csv = fs.readFileSync(path.join(ROOT, 'data', 'MVGreen_805_pripraveno_pro_AI_vizualizace.csv'), 'utf8').split(/\r?\n/).slice(1);
  const ref = {};
  csv.forEach(l => { const c = l.split(';'); const m = /([\d.]+)\D+([\d.]+)\s*cm/.exec(c[3] || ''); if (c[1] && m) ref[c[1].trim().toLowerCase()] = [+m[1] / 100, +m[2] / 100]; });
  plants.forEach(p => { const r = ref[p.latin.toLowerCase()]; if (r && (p.height < r[0] * 0.5 || p.height > r[1] * 1.6)) warns.push(p.name + ': výška ' + p.height + ' m, zdroje uvádějí ' + r[0].toFixed(2) + '–' + r[1].toFixed(2) + ' m'); });
} catch (e) { warns.push('katalog 805 pro kontrolu výšek nenalezen'); }

let photos = {};
try { photos = JSON.parse(fs.readFileSync(PHOTOS, 'utf8')); } catch (e) { /* zatím bez fotek */ }
let withPhoto = 0;
plants.forEach(p => {
  const ph = photos[p.key];
  // Do katalogu jde jen název souboru na Commons; plugin si ho stáhne na svůj server (GDPR).
  if (ph && (ph.status === 'auto' || ph.status === 'ok') && ph.file) { p.photoFile = ph.file; withPhoto++; }
  delete p.file;
});

const count = {}; plants.forEach(p => { count[p.kind] = (count[p.kind] || 0) + 1; });
console.log('Rostlin: ' + plants.length + ' ' + JSON.stringify(count) + ', s fotkou: ' + withPhoto);
warns.forEach(w => console.log('  ! ' + w));
if (errors.length) { errors.forEach(e => console.error('  ✗ ' + e)); console.error(errors.length + ' chyb – katalog nezapsán.'); process.exit(1); }
if (process.argv.includes('--check')) process.exit(0);

const js = '/* Vygenerováno skriptem scripts/build-plants.js z data/rostliny/*.txt – NEUPRAVOVAT RUČNĚ. */\n'
  + '/* Údaje jsou orientační (výška a spon v m, kvetení měsíce od–do). */\n'
  + 'window.MVGreenPlantsV2=' + JSON.stringify(plants) + ';\n';
fs.writeFileSync(OUT, js);
console.log('Zapsáno: ' + path.relative(ROOT, OUT) + ' (' + Math.round(js.length / 1024) + ' kB)');
