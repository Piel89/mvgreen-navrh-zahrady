#!/usr/bin/env node
/*
 * Připraví data pro přehled fotek (stránka, kde majitel fotky schvaluje/zamítá):
 * stáhne náhledy 250 px a uloží je jako data: URI do JSON souborů po skupinách.
 *   node scripts/photo-review-data.js <výstupní složka> [<složka cache náhledů>]
 * Do repa se nic neukládá (fotky nejsou naše, repo je veřejné).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2], CACHE = process.argv[3] || path.join(OUT, '.cache');
if (!OUT) { console.error('Použití: node scripts/photo-review-data.js <složka>'); process.exit(1); }
fs.mkdirSync(CACHE, { recursive: true });
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'mvgreen-navrh-zahrady/assets/v2/plants-catalog.js'), 'utf8'), ctx);
const plants = ctx.window.MVGreenPlantsV2, photos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/plant-photos.json'), 'utf8'));
const GROUP = { perennial: 'trvalky', grass: 'travy', lowgrass: 'travy', bulb: 'cibuloviny', shrub: 'kere', conifer: 'jehlicnany', tree: 'stromy', climber: 'popinave' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const groups = {};
  let n = 0;
  for (const p of plants) {
    const ph = photos[p.key] || {};
    const item = { k: p.key, n: p.name, l: p.latin, kind: p.kind, s: ph.status || 'missing', f: ph.file || '', a: ph.author || '', lic: ph.license || '', page: ph.page || '' };
    if (ph.thumb && ph.status !== 'missing') {
      const cf = path.join(CACHE, p.key + '.jpg');
      if (!fs.existsSync(cf)) {
        const url = ph.thumb.replace(/\/\d+px-/, '/250px-');
        for (let a = 0; a < 3; a++) {
          try { const r = await fetch(url, { headers: { 'User-Agent': 'MVGreenPlantCatalog/1.0 (https://mvgreen.cz) node' } });
            if (r.ok) { fs.writeFileSync(cf, Buffer.from(await r.arrayBuffer())); break; }
            await sleep(2000 * (a + 1)); } catch (e) { await sleep(2000); }
        }
        await sleep(80);
      }
      if (fs.existsSync(cf)) item.img = 'data:image/jpeg;base64,' + fs.readFileSync(cf).toString('base64');
    }
    (groups[GROUP[p.kind]] = groups[GROUP[p.kind]] || []).push(item);
    if (++n % 100 === 0) console.log(n + '/' + plants.length);
  }
  const index = [];
  for (const g in groups) {
    const file = 'data-' + g + '.json';
    fs.writeFileSync(path.join(OUT, file), JSON.stringify(groups[g]));
    index.push({ g, file, count: groups[g].length, kb: Math.round(fs.statSync(path.join(OUT, file)).size / 1024) });
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  console.log(index);
})();
