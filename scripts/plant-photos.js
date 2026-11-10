#!/usr/bin/env node
/*
 * Předvýběr ilustračních fotek rostlin z Wikimedia Commons (jen licence vhodné pro komerční web:
 * CC0, CC BY, CC BY-SA, volné dílo). Výsledek: data/plant-photos.json { key: {file, thumb, page,
 * author, license, score, status} }. Fotky se do repa NESTAHUJÍ – plugin si vybraný soubor stáhne
 * k sobě na server až při prvním použití (GDPR: prohlížeč zákazníka se na Wikimedii nepřipojuje).
 *
 *   node scripts/plant-photos.js            → doplní fotky rostlinám, které ještě žádnou nemají
 *   node scripts/plant-photos.js --redo     → znovu vybere i automaticky vybrané (schválené/zamítnuté nechá)
 *   node scripts/plant-photos.js --only=key → jen jedna rostlina
 *
 * status: auto = vybral skript, ok = schválil majitel, rejected = majitel zamítl (skript pak hledá jinou,
 * zamítnuté soubory si pamatuje v poli `rejectedFiles`).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'mvgreen-navrh-zahrady', 'assets', 'v2', 'plants-catalog.js');
const OUT = path.join(ROOT, 'data', 'plant-photos.json');
const UA = 'MVGreenPlantCatalog/1.0 (https://mvgreen.cz) node';
const args = process.argv.slice(2), REDO = args.includes('--redo'), ONLY = (args.find(a => a.startsWith('--only=')) || '').slice(7);

const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(CATALOG, 'utf8'), ctx);
const plants = ctx.window.MVGreenPlantsV2;
let db = {}; try { db = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* první běh */ }
const save = () => fs.writeFileSync(OUT, JSON.stringify(db, null, 1));

const strip = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const LIC = /^(CC0( 1\.0)?|CC BY(-SA)? [0-9.]+|Public domain)$/i;
// Co na ilustrační fotce rostliny nechceme (Martin 2026-11-08: fotky kůry a bobulí místo rostliny).
const BAD = /bark|rinde|seed|samen|sem[ií]n|fruit|frucht|berr|beere|herbar|illustrat|drawing|zeichnung|k[oö]hler|plate|tafel|\bmap\b|stamp|briefmarke|insect|\bbee\b|bees|bumble|hummel|biene|butterfly|schmetterling|caterpillar|raupe|beetle|k[aä]fer|\bfly\b|hoverfly|spider|moth|wasp|larva|aphid|\bbug\b|root|wurzel|cone|zapfen|pollen|microscop|\bsem\b|gall|disease|rust\b|mildew|blight|seedling|keimling|dried|herbarium|x-?ray|section|anther|stamen|pistil|\bbud\b|knospe|market|logo|label|sign\b|book|\bpot\b|vase|bouquet|stra[uß]|food|dish|recipe|tea\b|oil\b|wood\b|holz|stump|log\b|trunk|stamm|snail|schnecke|bird|vogel|cat\b|dog\b|person|people|wedding/;
const LEAFY = /leaf|leaves|blatt|bl[aä]tter|foliage|laub/;
const GOOD = /habit|habitus|garden|garten|zahrad|park\b|border|beet|bed\b|planting|pflanzung|landscape|whole|plant\b|pflanze|shrub|strauch|hedge|hecke|tree\b|baum/;

async function api(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams(Object.assign({ format: 'json', maxlag: '5' }, params));
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (a + 1)); continue; }
      const j = await r.json(); if (j.error && j.error.code === 'maxlag') { await sleep(5000); continue; }
      return j;
    } catch (e) { await sleep(2000 * (a + 1)); }
  }
  return {};
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function queries(p) {
  const latin = p.latin.replace(/\(.*?\)/g, '').trim();
  const base = latin.replace(/\s*[‘’'"].*$/, '').replace(/\s+(subsp|var)\..*$/, '').trim();
  const cv = (/[‘'"](.+?)[’'"]/.exec(latin) || [])[1];
  const sp = base.replace('×', '').split(/\s+/).filter(Boolean);
  const q = [];
  if (cv) q.push(base.replace('×', '') + ' ' + cv, sp[0] + ' ' + cv);
  q.push(base.replace('×', ''));
  if (sp.length > 2) q.push(sp.slice(0, 2).join(' '));
  return { list: [...new Set(q)], base: norm(base.replace('×', '')).split(/\s+/).filter(Boolean), cv: cv && norm(cv) };
}

function score(p, page, qi) {
  const ii = (page.imageinfo || [])[0]; if (!ii || !ii.thumburl) return null;
  const m = ii.extmetadata || {}, lic = strip(m.LicenseShortName && m.LicenseShortName.value);
  if (!LIC.test(lic) || (ii.width || 0) < 800 || (ii.height || 0) < 500) return null;
  if (!/\.(jpe?g)$/i.test(page.title)) return null;
  const title = norm(page.title), cats = norm(m.Categories && m.Categories.value), desc = norm(strip(m.ImageDescription && m.ImageDescription.value)).slice(0, 400);
  const text = title + ' ' + desc;
  if (BAD.test(title) || BAD.test(desc.slice(0, 120))) return null;
  // Na fotce musí být opravdu ten rod (a pokud možno druh) – vyhledávání Commons je volné.
  const [genus, epithet] = q.base;
  if (!(text.includes(genus) || cats.includes(genus))) return null;
  let s = 0;
  if (epithet && (text.includes(epithet) || cats.includes(epithet))) s += 4; else if (epithet) s -= 3;
  if (q.cv) { if ((title + ' ' + cats + ' ' + desc).includes(q.cv)) s += 6; }
  if (GOOD.test(text)) s += 3;
  if (/quality images|featured pictures|valued images/.test(cats)) s += 4;
  if (LEAFY.test(title) && p.flower && !p.evergreen) s -= 3;   // u kvetoucích chceme květ/rostlinu, ne detail listu
  if (/flower|bl[uü]te|blossom|bloom|kvet/.test(text) && p.flower) s += 1;
  if (/close-?up|nahaufnahme|detail|macro|makro/.test(text)) s -= 2;
  const ar = ii.width / ii.height; if (ar >= 1.2 && ar <= 1.8) s += 1; if (ar < 0.7) s -= 1;
  s -= qi * 1.5;  // dotaz s odrůdou má přednost
  return { file: page.title, thumb: ii.thumburl, page: ii.descriptionurl, license: lic,
    author: strip(m.Artist && m.Artist.value).slice(0, 120) || 'neuveden', score: Math.round(s * 10) / 10 };
}

let q;
async function pick(p, rejected) {
  q = queries(p);
  let best = null;
  for (let i = 0; i < q.list.length; i++) {
    const j = await api({ action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '30', gsrsearch: q.list[i] + ' filetype:bitmap',
      prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '640', iiextmetadatafilter: 'LicenseShortName|Artist|Categories|ImageDescription' });
    const pages = Object.values((j.query || {}).pages || {});
    for (const pg of pages) {
      if (rejected.includes(pg.title)) continue;
      const c = score(p, pg, i); if (c && (!best || c.score > best.score)) best = Object.assign(c, { query: q.list[i] });
    }
    if (best && best.score >= 6) break;   // dost dobrá shoda, další dotazy netřeba
    await sleep(120);
  }
  return best;
}

(async () => {
  const todo = plants.filter(p => (!ONLY || p.key === ONLY) && (!db[p.key] || db[p.key].status === 'rejected' || (REDO && db[p.key].status === 'auto') || !db[p.key].file));
  console.log('Hledám fotky: ' + todo.length + ' z ' + plants.length);
  let n = 0, miss = 0;
  for (const p of todo) {
    const prev = db[p.key] || {}, rejected = (prev.rejectedFiles || []).concat(prev.status === 'rejected' && prev.file ? [prev.file] : []);
    const best = await pick(p, rejected);
    db[p.key] = best ? Object.assign(best, { name: p.name, latin: p.latin, status: 'auto', rejectedFiles: rejected })
      : { name: p.name, latin: p.latin, status: 'missing', rejectedFiles: rejected };
    if (!best) miss++;
    if (++n % 25 === 0) { save(); console.log(n + '/' + todo.length + ' (bez fotky ' + miss + ')'); }
    await sleep(150);
  }
  save();
  console.log('Hotovo: ' + n + ', bez fotky ' + miss + ' → ' + path.relative(ROOT, OUT));
})();
