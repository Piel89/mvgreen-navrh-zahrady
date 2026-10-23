/*
 * MVGreen – kvalita vstupu pro AI návrh.
 * 1) Kontrola fotografie hned po nahrání (světlo, ostrost, rozlišení, záběr, kolik je vidět zahrady).
 * 2) Návod jak fotit v kroku 02.
 * 3) Výběr oblíbených rostlin, barev a závlahy → přesné zadání pro AI jen z ověřených rostlin.
 */
(function () {
  'use strict';

  /* ---------- 1) Kontrola fotografie ---------- */
  function analyze(source) {
    var W = 320, H = Math.max(1, Math.round(320 * source.height / source.width));
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(source, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H).data, n = W * H;
    var lum = new Float32Array(n), sum = 0, dark = 0, blown = 0, greenLow = 0, lowCount = 0;
    for (var i = 0; i < n; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      var l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum[i] = l; sum += l;
      if (l < 45) dark++;
      if (l > 245) blown++;
      if (i / W > H * 0.45) { lowCount++; if (g >= r && g > b + 8 && Math.max(r, g, b) - Math.min(r, g, b) > 18) greenLow++; }
    }
    var mean = sum / n;
    // Sharpness: variance of the Laplacian on the downsampled image.
    var lap = 0, lap2 = 0, m = 0;
    for (var y = 1; y < H - 1; y++) for (var xx = 1; xx < W - 1; xx++) {
      var k = y * W + xx;
      var v = 4 * lum[k] - lum[k - 1] - lum[k + 1] - lum[k - W] - lum[k + W];
      lap += v; lap2 += v * v; m++;
    }
    var sharp = lap2 / m - Math.pow(lap / m, 2);
    var ratio = source.width / source.height;
    var issues = [];
    if (mean < 70 || dark / n > 0.5) issues.push({ level: 'bad', text: 'Fotka je příliš tmavá. Vyfoťte zahradu za denního světla.' });
    else if (blown / n > 0.25) issues.push({ level: 'warn', text: 'Velká část fotky je přepálená. Zkuste fotit zády ke slunci nebo v jinou denní dobu.' });
    if (sharp < 60) issues.push({ level: 'bad', text: 'Fotka je neostrá. Podržte telefon klidně a vyfoťte ji znovu.' });
    if (Math.max(source.naturalWidth || source.width, source.naturalHeight || source.height) < 1000) issues.push({ level: 'warn', text: 'Fotka má nízké rozlišení. Výsledek bude méně detailní.' });
    if (ratio > 2.4) issues.push({ level: 'warn', text: 'Fotka je hodně široká (panoráma). Lépe funguje běžná fotka na šířku.' });
    if (ratio < 0.8) issues.push({ level: 'warn', text: 'Fotka je na výšku. Pro návrh zahrady je lepší fotka na šířku.' });
    if (lowCount && greenLow / lowCount < 0.15) issues.push({ level: 'warn', text: 'Na fotce je vidět málo zahrady. Vyfoťte ji tak, aby trávník nebo plocha k úpravě zabírala spodní polovinu snímku.' });
    var level = issues.some(function (s) { return s.level === 'bad'; }) ? 'bad' : issues.length ? 'warn' : 'good';
    return { level: level, issues: issues, metrics: { mean: Math.round(mean), sharp: Math.round(sharp), ratio: Math.round(ratio * 100) / 100, greenShare: lowCount ? Math.round(greenLow / lowCount * 100) : 0 } };
  }

  function renderCheck(container, result) {
    if (!container) return;
    container.hidden = false;
    container.className = 'mg-photo-check mg-photo-check--' + result.level;
    var head = result.level === 'good' ? 'Fotka je v pořádku pro návrh.' : result.level === 'bad' ? 'Tahle fotka nejspíš nedá dobrý výsledek.' : 'Fotka projde, ale výsledek může být horší.';
    var html = '<strong>' + head + '</strong>';
    if (result.issues.length) html += '<ul>' + result.issues.map(function (i) { return '<li>' + i.text + '</li>'; }).join('') + '</ul>';
    if (result.level !== 'good') html += '<span class="mg-photo-check__hint">Můžete nahrát jinou fotku, nebo pokračovat i s touto.</span>';
    container.innerHTML = html;
  }

  /* ---------- 2) Návod jak fotit ---------- */
  var GUIDE_IMG = 'https://mvgreen.cz/wp-content/uploads/2026/10/4a7473d4-21f1-43b8-abdb-583ae4a93e2f.jpg';
  function guideHtml() {
    var cards = [
      ['good', '✓', 'Správně', 'Široký záběr za světla'],
      ['close', '✕', 'Příliš blízko', 'Není vidět celá plocha'],
      ['dark', '✕', 'Málo světla', 'Ztrácí se barvy a detaily'],
      ['blur', '✕', 'Rozmazané', 'AI neodhadne tvary']
    ];
    return '<div class="mg-shoot-guide" aria-label="Jak vyfotit zahradu">' +
      '<strong class="mg-shoot-guide__title">Jak vyfotit zahradu pro nejlepší návrh</strong>' +
      '<ul class="mg-shoot-guide__tips"><li>Foťte <b>za denního světla</b>, ideálně zády ke slunci.</li><li>Stoupněte si <b>do rohu zahrady</b> a držte telefon <b>na šířku ve výšce očí</b>.</li><li>Ať je vidět <b>celá plocha, kterou chcete změnit</b>, a kus domu nebo plotu pro měřítko.</li><li>Ukliďte, co nemá být v návrhu (auta, hadice, hračky).</li></ul>' +
      '<div class="mg-shoot-guide__cards">' + cards.map(function (c) {
        return '<figure class="mg-shoot-card mg-shoot-card--' + c[0] + '"><span class="mg-shoot-card__img"><img src="' + GUIDE_IMG + '" alt="" loading="lazy"><span class="mg-shoot-card__mark">' + c[1] + '</span></span><figcaption><strong>' + c[2] + '</strong><small>' + c[3] + '</small></figcaption></figure>';
      }).join('') + '</div></div>';
  }

  /* ---------- 3) Oblíbené rostliny a zadání pro AI ---------- */
  var COLORS = [['purple', 'Fialová'], ['white', 'Bílá'], ['pink', 'Růžová'], ['yellow', 'Žlutá'], ['red', 'Červená'], ['green', 'Jen zelená']];
  function colorOf(p) {
    var t = (p.name + ' ' + p.latin).toLowerCase();
    if (/alba|white|schnee|bíl|kopret/.test(t)) return 'white';
    if (/rose|pink|růž|rosa/.test(t)) return 'pink';
    if (/yellow|gold|zlat|žlut|rudb/.test(t)) return 'yellow';
    if (/cherry|burgundy|paprika|red|červen/.test(t)) return 'red';
    if (/blue|hidcote|munstead|levand|šalvěj|šanta|violet|purple|kakost/.test(t)) return 'purple';
    return 'green';
  }

  // One chip per plant name (cultivars of the same plant collapse into one), max 18.
  function uniquePicks(curated) {
    var seen = {}, out = [];
    curated.forEach(function (p) {
      var label = String(p.name).replace(/\s*„.*$/, '').trim();
      if (seen[label] || out.length >= 18) return;
      seen[label] = 1; out.push({ label: label, plant: p });
    });
    return out;
  }

  function favoritesHtml(curated) {
    var picks = uniquePicks(curated);
    return '<section class="mg-fav" aria-labelledby="mg-fav-title">' +
      '<h4 id="mg-fav-title">Co máte rádi?</h4>' +
      '<p class="mg-note">Vyberte pár rostlin a barev. Do návrhu dáme jen rostliny, které u vás porostou.</p>' +
      '<div class="mg-fav__group" role="group" aria-label="Oblíbené barvy">' + COLORS.map(function (c) {
        return '<button type="button" class="mg-chip" data-fav-color="' + c[0] + '" aria-pressed="false"><span class="mg-chip__dot mg-chip__dot--' + c[0] + '"></span>' + c[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="mg-fav__group mg-fav__plants" role="group" aria-label="Oblíbené rostliny">' + picks.map(function (p, i) {
        return '<button type="button" class="mg-chip" data-fav-plant="' + i + '" aria-pressed="false">' + p.label + '</button>';
      }).join('') + '</div>' +
      '<div class="mg-fav__group" role="group" aria-label="Závlaha"><span class="mg-fav__label">Závlaha:</span>' +
      ['Mám automatickou závlahu', 'Zalévám ručně', 'Nechci zalévat'].map(function (t, i) {
        return '<button type="button" class="mg-chip" data-fav-water="' + i + '" aria-pressed="' + (i === 1) + '">' + t + '</button>';
      }).join('') + '</div>' +
      '<input type="hidden" id="mg-fav-colors"><input type="hidden" id="mg-fav-plants"><input type="hidden" id="mg-irrigation" value="1">' +
      '</section>';
  }

  function bindFavorites(root, curated, onChange) {
    var picks = uniquePicks(curated).map(function (x) { return x.plant; });
    function sync() {
      var cols = [].map.call(root.querySelectorAll('[data-fav-color][aria-pressed=true]'), function (b) { return b.dataset.favColor; });
      var pl = [].map.call(root.querySelectorAll('[data-fav-plant][aria-pressed=true]'), function (b) { return picks[+b.dataset.favPlant].latin; });
      var w = root.querySelector('[data-fav-water][aria-pressed=true]');
      root.querySelector('#mg-fav-colors').value = cols.join(',');
      root.querySelector('#mg-fav-plants').value = pl.join('|');
      root.querySelector('#mg-irrigation').value = w ? w.dataset.favWater : '1';
      if (onChange) onChange();
    }
    root.querySelectorAll('[data-fav-color],[data-fav-plant]').forEach(function (b) {
      b.addEventListener('click', function () { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); sync(); });
    });
    root.querySelectorAll('[data-fav-water]').forEach(function (b) {
      b.addEventListener('click', function () {
        root.querySelectorAll('[data-fav-water]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        sync();
      });
    });
    return function restore(colors, plants, water) {
      (colors || '').split(',').filter(Boolean).forEach(function (c) { var b = root.querySelector('[data-fav-color="' + c + '"]'); if (b) b.setAttribute('aria-pressed', 'true'); });
      (plants || '').split('|').filter(Boolean).forEach(function (l) { picks.forEach(function (p, i) { if (p.latin === l) { var b = root.querySelector('[data-fav-plant="' + i + '"]'); if (b) b.setAttribute('aria-pressed', 'true'); } }); });
      if (water !== undefined && water !== '') root.querySelectorAll('[data-fav-water]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.favWater === String(water))); });
      sync();
    };
  }

  /**
   * Picks the plants the AI is allowed to draw: customer favourites that fit the site first,
   * then the plan, then curated plants for the conditions. Max 6 species for a coherent look.
   */
  function choosePlants(d, curated, lastPlan, opts) {
    var sun = d['mg-sun'], water = d['mg-water'] || 'normal', irr = String(d['mg-irrigation'] || '1');
    var fits = function (p) {
      var sunOk = sun === 'Různé podmínky' || !sun || (p.sun || []).indexOf(sun) >= 0;
      var effWater = irr === '2' ? 'dry' : water; // nechce zalévat → jen suchomilné
      var waterOk = (p.water || []).indexOf(effWater) >= 0 || (irr === '0' && (p.water || []).indexOf('normal') >= 0);
      return sunOk && waterOk;
    };
    var colors = (d['mg-fav-colors'] || '').split(',').filter(Boolean);
    var favLatin = (d['mg-fav-plants'] || '').split('|').filter(Boolean);
    var chosen = [], seen = {};
    var genera = {};
    var genus = function (p) { return String(p.latin || '').split(' ')[0].toLowerCase(); };
    // Favourites may repeat a genus; everything else adds variety (one cultivar per genus).
    function add(p, why) {
      var key = (p.latin || '').toLowerCase(), g = genus(p);
      if (!key || seen[key] || chosen.length >= (opts && opts.max || 6)) return;
      if (why !== 'oblíbená' && genera[g]) return;
      seen[key] = 1; genera[g] = 1;
      chosen.push({ name: p.name, latin: p.latin, height: p.height, why: why });
    }
    curated.filter(function (p) { return favLatin.indexOf(p.latin) >= 0; }).forEach(function (p) { if (fits(p)) add(p, 'oblíbená'); });
    var rejected = curated.filter(function (p) { return favLatin.indexOf(p.latin) >= 0 && !fits(p); }).map(function (p) { return p.name; });
    if (lastPlan && lastPlan.items) lastPlan.items.filter(function (x) { return x.kind === 'rostlina'; }).forEach(function (x) { add({ name: x.name, latin: x.latin, height: x.height }, 'plán'); });
    var pool = curated.filter(fits);
    if (colors.length && colors.indexOf('green') < 0) pool.sort(function (a, b) { return (colors.indexOf(colorOf(b)) >= 0) - (colors.indexOf(colorOf(a)) >= 0); });
    if (colors.length === 1 && colors[0] === 'green') pool = pool.filter(function (p) { return colorOf(p) === 'green' || p.category === 'grasses'; }).concat(pool);
    // Make sure there is one ornamental grass for structure, then fill up.
    var isGrass = function (p) { return p.category === 'grasses' || /^(Festuca|Calamagrostis|Miscanthus|Pennisetum|Panicum|Molinia|Carex|Stipa|Deschampsia|Hakonechloa)\b/.test(p.latin || ''); };
    if (!chosen.some(isGrass)) { var gr = pool.filter(isGrass)[0]; if (gr) add(gr, 'struktura'); }
    pool.forEach(function (p) { add(p, 'podmínky'); });
    return { plants: chosen, rejected: rejected };
  }

  function buildInstructions(d, curated, lastPlan, extra) {
    var pick = choosePlants(d, curated, lastPlan, { max: extra.maxPlants || 6 });
    var colorNames = { purple: 'fialová', white: 'bílá', pink: 'růžová', yellow: 'žlutá', red: 'červená', green: 'převážně zelená' };
    var cols = (d['mg-fav-colors'] || '').split(',').filter(Boolean).map(function (c) { return colorNames[c]; }).filter(Boolean);
    var irr = ['automatická závlaha je k dispozici', 'zalévá se ručně', 'zahrada se nezalévá – jen suchomilné rostliny'][+(d['mg-irrigation'] || 1)] || 'zalévá se ručně';
    var lines = [
      'ÚKOL: Realisticky dosázej a uprav pouze plochu zahrady v průhledné části masky. Výsledek musí vypadat jako fotografie stejné zahrady po realizaci, ne jako vizualizace.',
      'STYL: ' + String(extra.styleLabel || d['mg-style'] || 'přirozená zahrada').replace(/^[A-C] – /, '') + '. ' + (extra.styleAi || ''),
      'ROSTLINY – POUŽIJ POUZE TYTO DRUHY: ' + pick.plants.map(function (p) { return p.name + ' (' + p.latin + (p.height ? ', výška ' + p.height : '') + ')'; }).join('; ') + '. Žádné jiné druhy nepřidávej. Respektuj uvedené výšky a skutečné měřítko vůči domu a plotu.',
      cols.length ? 'BARVY KVĚTŮ: převažuje ' + cols.join(', ') + '.' : '',
      'PODMÍNKY: ' + ({ 'Slunce': 'plné slunce', 'Polostín': 'polostín', 'Stín': 'stín' }[d['mg-sun']] || 'různé oslunění') + '; půda ' + ({ dry: 'suchá', wet: 'vlhká' }[d['mg-water']] || 'běžně vlhká') + '; ' + irr + '; lokalita ' + (d['mg-locality'] || 'Domažlicko') + (d['mg-altitude'] ? ', ' + d['mg-altitude'] + ' m n. m' : '') + '.',
      'ÚDRŽBA: ' + (d['mg-maint'] || 'nízká') + '. Rozpočet do ' + (d['mg-max'] || '50000') + ' Kč – žádné drahé prvky (jezírka, pergoly, zídky, terasy).',
      extra.layout ? 'ROZVRŽENÍ: ' + extra.layout : '',
      'NAVÁZÁNÍ: nové záhony a rostliny ukonči s odstupem od okraje upravované plochy; u okraje nech pruh trávníku nebo mulče, aby výsledek plynule navazoval na původní fotografii. Nikdy neusekávej rostliny okrajem plochy.',
      'ZÁHONY: nové záhony veď jako pruh těsně podél hranice upravované plochy – u domu, plotu, zdi, stromu nebo cesty. ZÁSADNĚ NEDĚLEJ záhon jako samostatný ostrůvek nebo velký oblouk zasahující doprostřed trávníku – majitel chce mít uprostřed zahrady souvislou otevřenou plochu trávníku, kterou lze normálně sekat. Jasné okraje, nastýlané kůrou nebo štěrkem, rostliny ve skupinách po 3–7 kusech, ne náhodně rozházené. Trávník hustý a rovnoměrný, ale přirozený, ne umělý.',
      'POŘÁDEK: pokud je v upravované ploše nepořádek – hromady větví, kamení, suť, uschlé nebo řídké rostliny, zbytky materiálu – odstraň ho a nahraď upraveným trávníkem, mulčem nebo záhonem. Výsledek musí působit čistě a dokončeně v celé upravované ploše, žádný nepořádek nesmí zůstat viditelný, ani v pozadí za novým záhonem.',
      d['mg-notes'] ? 'PŘÁNÍ ZÁKAZNÍKA: ' + d['mg-notes'] : '',
      'ZAKÁZÁNO: měnit dům, okna, střechu, plot, cesty, terén, stromy, oblohu a úhel pohledu; přidávat lidi, zvířata, nábytek, text, vodoznaky nebo nové stavby.'
    ];
    return { text: lines.filter(Boolean).join('\n'), plants: pick.plants, rejected: pick.rejected };
  }

  window.MVGreenBrief = {
    analyze: analyze, renderCheck: renderCheck, guideHtml: guideHtml,
    favoritesHtml: favoritesHtml, bindFavorites: bindFavorites,
    choosePlants: choosePlants, buildInstructions: buildInstructions, colorOf: colorOf
  };
})();
