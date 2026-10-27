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

  function favoritesHtml(curated) {
    // Showing a fixed pick of ~18 names out of 800+ in the catalog made the catalog look much
    // smaller than it is and steered customers toward only those few species. The AI already
    // chooses from the full curated catalog for the site's actual conditions (choosePlants
    // below); a customer with a specific plant in mind names it in the free-text notes field
    // (sent to the AI as PŘÁNÍ ZÁKAZNÍKA) instead of picking from this short list.
    return '<section class="mg-fav" aria-labelledby="mg-fav-title">' +
      '<h4 id="mg-fav-title">Co máte rádi?</h4>' +
      '<p class="mg-note">Vyberte barvu a způsob zálivky. Vhodné rostliny z celého katalogu vybere AI podle podmínek na vaší zahradě – konkrétní přání napište do poznámek.</p>' +
      '<div class="mg-fav__group" role="group" aria-label="Oblíbené barvy">' + COLORS.map(function (c) {
        return '<button type="button" class="mg-chip" data-fav-color="' + c[0] + '" aria-pressed="false"><span class="mg-chip__dot mg-chip__dot--' + c[0] + '"></span>' + c[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="mg-fav__group" role="group" aria-label="Závlaha"><span class="mg-fav__label">Závlaha:</span>' +
      ['Mám automatickou závlahu', 'Zalévám ručně', 'Nechci zalévat'].map(function (t, i) {
        return '<button type="button" class="mg-chip" data-fav-water="' + i + '" aria-pressed="' + (i === 1) + '">' + t + '</button>';
      }).join('') + '</div>' +
      '<input type="hidden" id="mg-fav-colors"><input type="hidden" id="mg-fav-plants"><input type="hidden" id="mg-irrigation" value="1">' +
      '</section>';
  }

  // curated/plants kept as parameters (bindFavorites(root, curated, onChange), restore(colors,
  // plants, water)) for call-site/signature compatibility even though favoritesHtml() never
  // renders [data-fav-plant] chips – there is currently no UI path that sets #mg-fav-plants.
  function bindFavorites(root, curated, onChange) {
    function sync() {
      var cols = [].map.call(root.querySelectorAll('[data-fav-color][aria-pressed=true]'), function (b) { return b.dataset.favColor; });
      var w = root.querySelector('[data-fav-water][aria-pressed=true]');
      root.querySelector('#mg-fav-colors').value = cols.join(',');
      root.querySelector('#mg-irrigation').value = w ? w.dataset.favWater : '1';
      if (onChange) onChange();
    }
    root.querySelectorAll('[data-fav-color]').forEach(function (b) {
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
      if (water !== undefined && water !== '') root.querySelectorAll('[data-fav-water]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.favWater === String(water))); });
      sync();
    };
  }

  /** Fisher–Yates, non-mutating. Used by choosePlants so the catalog's fixed listing order never
   * determines which species keep getting picked (see choosePlants' own comment below). */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
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
    // Catalog order is fixed (whatever order catalog-805.js/legacyPlants happen to list species in),
    // so filtering straight out of `curated` picked the SAME first ~6 matching species every single
    // time for any two gardens with the same sun/water conditions - the 805-species catalog's actual
    // variety never surfaced ("pořád ty samé kytky dokola", owner's own words - lavender near the
    // top of the list for sun+dry conditions, which most CZ gardens have, made it look baked in).
    // A fresh shuffle per call means two different designs - or two different beds in the same one -
    // can land on genuinely different, still fully verified/catalog-matched species.
    var pool = shuffle(curated.filter(fits));
    if (colors.length && colors.indexOf('green') < 0) pool.sort(function (a, b) { return (colors.indexOf(colorOf(b)) >= 0) - (colors.indexOf(colorOf(a)) >= 0); });
    if (colors.length === 1 && colors[0] === 'green') pool = pool.filter(function (p) { return colorOf(p) === 'green' || p.category === 'grasses'; }).concat(pool);
    // Make sure there is one ornamental grass for structure, then fill up.
    var isGrass = function (p) { return p.category === 'grasses' || /^(Festuca|Calamagrostis|Miscanthus|Pennisetum|Panicum|Molinia|Carex|Stipa|Deschampsia|Hakonechloa)\b/.test(p.latin || ''); };
    if (!chosen.some(isGrass)) { var gr = pool.filter(isGrass)[0]; if (gr) add(gr, 'struktura'); }
    pool.forEach(function (p) { add(p, 'podmínky'); });
    return { plants: chosen, rejected: rejected };
  }

  // Shared by buildInstructions (the general/remainder prompt) and buildBedStageInstructions (the
  // staged-pipeline bed prompt) so the two never drift apart on how plants/colors get worded.
  var COLOR_NAMES = { purple: 'fialová', white: 'bílá', pink: 'růžová', yellow: 'žlutá', red: 'červená', green: 'převážně zelená' };
  function favoriteColorNames(d) {
    return (d['mg-fav-colors'] || '').split(',').filter(Boolean).map(function (c) { return COLOR_NAMES[c]; }).filter(Boolean);
  }
  function plantListLine(pick) {
    return pick.plants.map(function (p) { return p.name + ' (' + p.latin + (p.height ? ', výška ' + p.height : '') + ')'; }).join('; ');
  }

  function buildInstructions(d, curated, lastPlan, extra) {
    var pick = choosePlants(d, curated, lastPlan, { max: extra.maxPlants || 6 });
    var cols = favoriteColorNames(d);
    var irr = ['automatická závlaha je k dispozici', 'zalévá se ručně', 'zahrada se nezalévá – jen suchomilné rostliny'][+(d['mg-irrigation'] || 1)] || 'zalévá se ručně';
    // Rough bed/path/remove placement from the optional wizard step "Umístění záhonu, cesty a
    // úklidu" (app.js) – a few percent-of-photo coordinates per hint type, already capped there.
    // Worded explicitly as approximate position only, never an exact shape or size, matching what
    // the customer actually drew (a quick freehand line, not a traced outline).
    // IMPORTANT: as of the "5 řešení" revamp, these same strokes are ALSO burned directly onto the
    // photo sent to the AI (app.js's annotateForAI, called right before upload) – the % coordinates
    // below are a text backup of the same information, not the only signal. The AI genuinely sees
    // these marks on the image it's editing, so this line must say so and tell it to erase the marks
    // themselves from the result, or the model may render the colored lines/dashes as if they were
    // real paint or tape on the ground.
    // extra.skipHintLine: set by the staged pipeline's "remainder/style" call (app.js) once bed/path/
    // remove strokes are handled by their OWN dedicated stage with a real geometric mask – restating
    // them here as a text hint would be redundant at best and confusing at worst (this stage's mask
    // no longer even covers those strokes' area). The single-call fallback (no step-5 strokes, or
    // strokes present but the staged pipeline not applicable) always leaves this on, unchanged.
    var bedHints = extra.skipHintLine ? [] : (extra.bedHints || []).slice(0, 4);
    var pathHints = extra.skipHintLine ? [] : (extra.pathHints || []).slice(0, 4);
    var removeHints = extra.skipHintLine ? [] : (extra.removeHints || []).slice(0, 4);
    var hintParts = [];
    if (bedHints.length) hintParts.push('záhon zhruba u: ' + bedHints.join(', '));
    if (pathHints.length) hintParts.push('cesta zhruba u: ' + pathHints.join(', '));
    if (removeHints.length) hintParts.push('odstranit zhruba u: ' + removeHints.join(', '));
    var hintLine = hintParts.length ? 'ZNAČKY ZÁKAZNÍKA PŘÍMO NA FOTOGRAFII, KTEROU UPRAVUJEŠ: na vstupním obrázku jsou navíc nakreslené tenké barevné čáry/křížky – ČERVENÁ čára = sem zákazník chce nový záhon, MODRÁ čára = sem chce cestu, ČERNÁ přerušovaná čára/křížek = přesně tady je objekt nebo nepořádek, který musíš v této oblasti úplně a beze zbytku odstranit (viz pravidlo POŘÁDEK – typicky nářadí, stroje nebo haraburdí, které si zákazník sám vyznačil, protože na fotce zůstávalo). Tyto čáry a křížky NEJSOU skutečná barva, páska ani součást zahrady – v hotovém obrázku po nich nesmí zůstat ani stopa, nahraď to místo trávníkem, záhonem nebo cestou podle okolí. Udávají jen VELMI HRUBOU polohu, ne přesný tvar ani rozměr. Pro jistotu i jako text (souřadnice v % šířky/výšky fotografie od levého horního rohu): ' + hintParts.join('; ') + '.' : '';
    var lines = [
      'ÚKOL: Realisticky dosázej a uprav pouze plochu zahrady v průhledné části masky. Výsledek musí vypadat jako fotografie stejné zahrady po realizaci, ne jako vizualizace. NEJVYŠŠÍ PRIORITA ZE VŠEHO: v upravované ploše nesmí po úpravě zůstat vidět žádný nepořádek ani stavební materiál či nářadí – viz pravidlo POŘÁDEK níže. Návrh, který tohle nesplní, je nepoužitelný, i kdyby byl jinak hezký.',
      'STYL: ' + String(extra.styleLabel || d['mg-style'] || 'přirozená zahrada').replace(/^[A-C] – /, '') + '. ' + (extra.styleAi || ''),
      'ROSTLINY – POUŽIJ POUZE TYTO DRUHY: ' + plantListLine(pick) + '. Žádné jiné druhy nepřidávej. Respektuj uvedené výšky a skutečné měřítko vůči domu a plotu.',
      cols.length ? 'BARVY KVĚTŮ: převažuje ' + cols.join(', ') + '.' : '',
      'PODMÍNKY: ' + ({ 'Slunce': 'plné slunce', 'Polostín': 'polostín', 'Stín': 'stín' }[d['mg-sun']] || 'různé oslunění') + '; půda ' + ({ dry: 'suchá', wet: 'vlhká' }[d['mg-water']] || 'běžně vlhká') + '; ' + irr + '; lokalita ' + (d['mg-locality'] || 'Domažlicko') + (d['mg-altitude'] ? ', ' + d['mg-altitude'] + ' m n. m' : '') + '.',
      (d['mg-slope'] && d['mg-slope'] !== 'flat') || (d['mg-orientation'] && d['mg-orientation'] !== 'unknown') ? 'TERÉN: ' + ({ mild: 'mírný svah', steep: 'výrazný svah' }[d['mg-slope']] || 'rovina') + (d['mg-orientation'] && d['mg-orientation'] !== 'unknown' ? '; orientace zahrady ke světovým stranám: ' + d['mg-orientation'] + (({ mild: true, steep: true }[d['mg-slope']]) ? ' (sklon klesá/stoupá ve směru ' + d['mg-orientation'] + ')' : '') : '') + '. Respektuj sklon a orientaci při návrhu výsadby a cestiček – na svahu nenavrhuj rovinné prvky bez opěrných záhonů/teras, na jihu/jihozápadě počítej s větším suchem a sluncem, na severu/severovýchodě s vlhčím a stinnějším stanovištěm.' : '',
      'ÚDRŽBA: ' + (d['mg-maint'] || 'nízká') + '. Rozpočet do ' + (d['mg-max'] || '50000') + ' Kč – žádné drahé prvky (jezírka, pergoly, zídky, terasy).',
      extra.layout ? 'ROZVRŽENÍ: ' + extra.layout : '',
      hintLine,
      'NAVÁZÁNÍ: nové záhony a rostliny ukonči s odstupem od okraje upravované plochy; u okraje nech pruh trávníku nebo mulče, aby výsledek plynule navazoval na původní fotografii. Nikdy neusekávej rostliny okrajem plochy.',
      'DOKONČI CELOU ODEMČENOU PLOCHU: zákazník odemčenou plochu maloval štětcem od ruky, takže její okraj může být nepravidelný a v rohu nebo podél hrany může zůstat drobná nedotažená mezera. I přesto uprav odemčenou plochu celou, beze zbytku, až po samý okraj – žádné místo uvnitř ní, ani v rohu, ani těsně u hranice, nesmí zůstat jako neupravený kousek původní fotky. Výsledek musí působit jako jeden souvislý, uzavřený a profesionálně dokončený celek, nikdy jako plocha s nedodělaným koutkem.',
      'ZÁHONY: nové záhony veď jako pruh těsně podél hranice upravované plochy – u domu, plotu, zdi, stromu nebo cesty. ZÁSADNĚ NEDĚLEJ záhon jako samostatný ostrůvek nebo velký oblouk zasahující doprostřed trávníku – majitel chce mít uprostřed zahrady souvislou otevřenou plochu trávníku, kterou lze normálně sekat. Jasné okraje, nastýlané kůrou nebo štěrkem, rostliny ve skupinách po 3–7 kusech, ne náhodně rozházené. Trávník hustý a rovnoměrný, ale přirozený, ne umělý.',
      'BARVA TRÁVNÍKU: odstín a sytost zelené u trávníku zachovej stejné jako na originální fotografii – neměň barvu trávy na tmavší, sytější nebo jinak laděnou zelenou a neslaďuj ji s barvou nových rostlin. Tráva smí být jen upravenější (rovnoměrně posekaná, bez plešin a suchých míst), ne jinak zbarvená.',
      'POŘÁDEK (POVINNÉ, BEZ VÝJIMKY): V CELÉ upravované ploše smí po úpravě zůstat JEN trávník, záhon nebo mulč/štěrk – nic jiného. Projdi upravovanou plochu objekt po objektu a odstraň úplně VŠECHNO přenosné nebo dočasné, co tam na originální fotce je – zejména: stavební nářadí a technika (míchačka na beton, kolečko, lopaty, žebřík, hadice), hromady hlíny, písku, štěrku nebo stavební suti, pytle a palety s materiálem, dřevo, větve, kamení, odpadky, uschlé nebo řídké rostliny. Žádný z těchto předmětů nesmí zůstat viditelný ani částečně, ani v pozadí za novým záhonem – nahraď to místo trávníkem, mulčem nebo záhonem podle okolí. Trvalé prvky zahrady (zeď, plot, strom, studna, altán) nech beze změny, ale cokoliv přenosného vždy odstraň – v pochybnostech je to nepořádek k odstranění, ne prvek k zachování.',
      // The textarea's own maxlength (app.js) already stops typing at 1200 chars – generous room for
      // several sentences. Truncate defensively here too (matching that same 1200) in case the field
      // is ever filled some other way than typing. (v0.6.134: this whole buildInstructions() text is
      // also reused, unchanged, as the "remainder" block folded into buildStagedPlan's one combined
      // call alongside every category-instance's own text – see mvgreen-navrh-zahrady.php's matching
      // comment on the server's per-stage instructions-length cap for the up-to-date total budget.)
      d['mg-notes'] ? 'PŘÁNÍ ZÁKAZNÍKA: ' + String(d['mg-notes']).slice(0, 1200) : '',
      'ZAKÁZÁNO: měnit dům, okna, střechu, plot, cesty, terén, stromy, oblohu a úhel pohledu; přidávat lidi, zvířata, nábytek, text, vodoznaky nebo nové stavby.'
    ];
    var text = lines.filter(Boolean).join('\n');
    // Safety net: in rare worst-case combinations (meadow style with up to 9 plant slots, every
    // optional field maxed out, a full 1200-char customer-notes field) the fixed instruction text
    // above can already sit within roughly 100 characters of the server's 6000-char cap
    // (mvgreen-navrh-zahrady.php, strlen($instructions)>6000) with no hint line at all. This hint
    // line is optional and best-effort – the AI design works fine without it – so rather than risk
    // tipping a request over that cap, drop it (never the customer's own notes or plant list) when
    // there is no safe room left for it.
    if (hintLine && text.length > 5900) text = lines.filter(function (l) { return l && l !== hintLine; }).join('\n');
    return { text: text, plants: pick.plants, rejected: pick.rejected };
  }

  /*
   * ---------- Staged-generation prompts ("5 řešení" revamp, step 2) ----------
   * app.js's staged pipeline (see runStagedGeneration there) turns the customer's rough bed/path/
   * remove sketch into real geometric masks (ai-safety.js's strokeMask) and sends a SEPARATE,
   * independent OpenAI call for each one, chained server-side (mvgreen-navrh-zahrady.php). Each call
   * only ever sees its own narrow mask and has no memory of the others, so every prompt below must be
   * fully self-contained – there is no "as discussed above" to lean on. mvgreen-navrh-zahrady.php's
   * fixed preamble (scene/house/fence/angle preservation) wraps every one of these identically, the
   * same way it wraps buildInstructions()'s text today.
   */

  /** Cleanup: whatever the customer marked "⬛ Tohle odstranit" (step 4/5) – now folded into the
   *  SAME single combined-design call as everything else (see app.js's buildStagedPlan, rewritten
   *  2026-10-27), not its own isolated masked call, so the replacement material blends with
   *  whatever gets built next to it instead of being generated in visual isolation. */
  function buildRemoveStageInstructions(pos) {
    return 'Na fotografii' + (pos ? ' (' + pos + ')' : '') + ' je konkrétní předmět nebo nepořádek, který si zákazník sám označil jako věc k odstranění (typicky stavební nářadí nebo technika jako míchačka, kolečko, žebřík, hadice, nebo hromada hlíny, písku, dřeva či jiného materiálu). Najdi ho a odstraň ho úplně a beze zbytku – nenechej viditelnou jeho žádnou část ani stín ani obrys po něm. Nahraď to místo tím, co by tam realisticky navazovalo podle bezprostředního okolí (trávník, dlažba, mulč nebo štěrk, nebo to, co je popsané níže pro totéž místo). Fotorealistický výsledek, žádný malovaný ani ilustrativní vzhled.';
  }

  // A spot the customer marked for removal (step 4) very often sits under a new bed/path/wall/grass
  // area they later marked in roughly the same place (e.g. "there's a mixer there, remove it" then,
  // separately, "put a bed there") – by design that overlap is now resolved in the area-type stage's
  // favour (see app.js's buildStagedPlan claim order), since a specific "put a bed here" is a more
  // precise instruction than the generic "just tidy up, don't add anything" remove stage. But the
  // area-type stage's own mask doesn't know whether the photo under it still shows the original
  // clutter, so every builder below states explicitly that any pre-existing object/material in its
  // masked area must be cleared away as part of building the new thing – otherwise the model could
  // leave the old object awkwardly standing in among new plants/paving instead of replacing it.
  // Reported 2026-10-27 ("míchačku smazalo, ale vynechalo tam úplně záhon co tam měl být" / "ten
  // nástroj... musí to vzít v potaz, že... nemůže prostě vynechat" – the tool must treat the whole
  // marked area as one job, not leave untouched gaps inside it).
  var CLEAR_EXISTING_NOTE = ' Pokud je v této ploše na fotce nějaký existující předmět, materiál, stavební technika nebo nepořádek, odstraň ho úplně jako součást téhle úpravy a nahraď ho tím, co je popsané níže – nenech z něj nic viditelného ani jím nic neobcházej.';

  /** Hardscape: the customer's own "🔵 Tady chci cestu" mark. `extra.pos` is an optional plain-language
   *  position label (e.g. "vlevo u plotu") – a HINT about where, not a shape to fill exactly; see the
   *  2026-10-27 rewrite note above buildRemoveStageInstructions for why this is no longer its own mask. */
  function buildPathStageInstructions(extra) {
    var material = (extra && extra.pathMaterial) || 'mlatová nebo štěrková cestička s přírodním, nepravidelným okrajem';
    var sizeHint = extra && extra.sizeHint;
    var pos = extra && extra.pos;
    var base = 'Zákazník na fotce vyznačil' + (pos ? ' (' + pos + ')' : '') + ', že si tam přeje ' + material + '. ' + (sizeHint
      ? 'Zákazník tuhle plochu přesně obkreslil podle skutečných rozměrů (' + sizeHint + ') – respektuj přesně tento tvar a měřítko, nic nezaokrouhluj ani nezvětšuj.'
      : 'Jeho vyznačení je jen orientační – poloha a přibližná šířka, ne přesný předpis tvaru. Skutečnou linii, šířku, zakřivení a okraje zvol sama tak, aby cesta vedla přirozeně a plynule k tomu, kam zjevně směřuje (ne podle hranic čtverečků, které si zákazník vymaloval).') + ' Cesta plynule a realisticky navazuje na úroveň a materiál bezprostředního okolí (kde sousedí s trávníkem, zůstává za jejím okrajem trávník; kde sousedí s domem, zdí nebo jiným fixním prvkem, cesta k němu přiléhá bez mezery a bez viditelné spáry). Nepřidávej podél cesty žádné rostliny ani záhon, jen zpevněný povrch.' + CLEAR_EXISTING_NOTE + ' Fotorealistický výsledek, stíny a perspektiva odpovídající zbytku fotografie, žádný malovaný ani ilustrativní vzhled.';
    return withDetail(base, extra && extra.detail, extra && extra.detailGeneral);
  }

  /** Bed/planting stage: the customer's own "🔴 Tady chci záhon" mark, already buffered into a real bed-shaped mask. */
  function buildBedStageInstructions(d, curated, lastPlan, extra) {
    var pick = choosePlants(d, curated, lastPlan, { max: (extra && extra.maxPlants) || 6 });
    var cols = favoriteColorNames(d);
    var sizeHint = extra && extra.sizeHint;
    var detail = extra && extra.detail;
    var detailGeneral = extra && extra.detailGeneral;
    var terrainHint = (d['mg-slope'] && d['mg-slope'] !== 'flat') ? ' Záhon je na svahu (' + ({ mild: 'mírný', steep: 'výrazný' }[d['mg-slope']] || d['mg-slope']) + ') – zohledni to rozmístěním i volbou druhů (odolnost vůči splavování vody).' : '';
    // A customer's own wish for THIS bed (e.g. "jen strom a mulčovací kůra", "bílý oblázek", "jen
    // okrasné trávy a buxusy") used to be appended at the very end via withDetail, AFTER an
    // unconditional "POUŽIJ POUZE TYTO DRUHY ... Žádné jiné druhy nepřidávej" (use ONLY these
    // species, add no others) a few sentences earlier – a direct, explicit contradiction the prompt
    // itself then told the model to resolve by ignoring the customer ("řiď se jím, pokud neodporuje
    // výše uvedenému"). That's exactly backwards for a feature whose whole point is per-area
    // customer control, and it's why specific wishes (different species, gravel instead of planting,
    // just a tree with no dense bed) were silently dropped. Now: when a wish is given, it comes
    // FIRST and is stated as the authority for this bed; the catalog species list becomes a fallback
    // for whatever the wish itself leaves unspecified, instead of a hard whitelist that overrides it.
    // detailGeneral: no note was written for THIS bed specifically (step 6's own field for it was
    // left empty) – app.js fell back to the customer's one shared "Ještě něco k celé zahradě?"
    // note instead of sending this stage nothing. That shared note is one summary for the WHOLE
    // garden and may describe a different bed too, so it must not be framed as this bed's own
    // specific order (reported 2026-10-27: a combined note meant for two different beds, typed
    // into the shared field instead of each bed's own, left both beds guessing at the other's
    // wish). The model instead judges from the photo which part of it, if any, actually describes
    // THIS masked spot.
    var wishLine = detail
      ? (detailGeneral
        ? ' ZÁKAZNÍKOVO CELKOVÉ PŘÁNÍ PRO CELOU ZAHRADU (napsal ho jako jeden souhrn, ne zvlášť pro tenhle záhon): "' + detail + '". Pokud se některá jeho část podle polohy a kontextu na fotografii zjevně týká JINÉHO záhonu nebo jiného místa, tu část na tenhle záhon neaplikuj – použij jen to, co dává smysl přesně pro tohle místo. Pokud relevantní část jmenuje vlastní rostliny nebo materiál (např. štěrk, oblázky, mulčovací kůra) nebo žádá jen strom či keř bez husté výsadby, udělej přesně to.'
        : ' ZÁKAZNÍKOVO VÝSLOVNÉ PŘÁNÍ PRO TUHLE KONKRÉTNÍ PLOCHU – ŘIĎ SE JÍM PŘESNĚ, I KDYŽ SE LIŠÍ OD OBECNÉHO POPISU NÍŽE: "' + detail + '". Pokud přání jmenuje vlastní rostliny nebo materiál (např. štěrk, oblázky, mulčovací kůra) nebo žádá jen strom či keř bez husté výsadby, udělej přesně to.')
      : '';
    var speciesLine = detail
      ? ' Pro cokoliv, co zákazníkovo přání samo nespecifikuje, použij tyto ověřené druhy: ' + plantListLine(pick) + '.'
      : ' POUŽIJ POUZE TYTO DRUHY: ' + plantListLine(pick) + '. Žádné jiné druhy nepřidávej, respektuj uvedené výšky a skutečné měřítko vůči okolí.';
    var pos = extra && extra.pos;
    var shapeLine = sizeHint
      ? ' Zákazník tenhle záhon přesně obkreslil podle skutečných rozměrů (' + sizeHint + ') – respektuj přesně tento tvar a měřítko, počet rostlin tomu přizpůsob.'
      : ' Zákazníkovo vyznačení na fotce je jen orientační poloha a přibližný tvar, ne přesný předpis – skutečný tvar, hranici a rozměry zvol sama tak, aby záhon vypadal přirozeně a opticky vyvážené (např. plynulý oblouk podél zdi nebo plotu, ne klikatý okraj kopírující čtverečky mřížky, kterou si zákazník vymaloval). Pokud záhon sousedí s plotem, zdí nebo jiným fixním prvkem, nech ho podél něj souvisle lemovat (žádná mezera, žádný "ostrov" uprostřed trávníku).';
    var base = 'Zákazník na fotce vyznačil' + (pos ? ' (' + pos + ')' : '') + ', že si tam přeje záhon, s jasnou hranicí lemovanou mulčem nebo kůrou (pokud zákazníkovo přání níže neurčuje jinak).' + shapeLine + wishLine + speciesLine + (!detail ? ' Rostliny saď ve skupinách po 3–7 kusech stejného druhu vedle sebe, nikdy jednotlivě roztroušené.' : '') + (cols.length && !detail ? ' BARVY KVĚTŮ: převažuje ' + cols.join(', ') + '.' : '') + terrainHint + CLEAR_EXISTING_NOTE + ' Fotorealistický výsledek, stíny odpovídající zbytku fotografie, žádný malovaný ani ilustrativní vzhled.';
    return base;
  }

  /*
   * ---------- mg-area-types.js's grid classification step (replaces the old freehand bed/path
   * sketch) – one instruction builder per category (grass/wall here; path/bed reuse the two
   * builders above), same "self-contained, no cross-stage memory" rule as those two. Only 4
   * category buttons exist (owner's explicit simplification) – "záhon" stands in for any other
   * material in that same spot (mulch, gravel, paving, hedge…), resolved via `detail`: an optional
   * note for THIS specific area – folded in verbatim when present, left out entirely when not
   * (never invent a placeholder in its absence).
   *
   * Since step 6's numbered-area redesign (app.js), every connected island mg-area-types.js paints
   * within bed/path/wall/grass becomes its OWN stage (own mask, own instructions) instead of one
   * shared stage per whole category – so `detail` here is always THAT ONE island's own text, never
   * a blend of several unrelated areas' wishes. For bed/path/wall it's the customer's own free text
   * from that island's field. For grass it's not free text but a picked label from a dropdown of
   * real lawn-type categories (e.g. "Zátěžový/sportovní trávník") – sun/water/irrigation are already
   * asked once in step 2 and passed into buildGrassStageInstructions directly (see `d` below) rather
   * than re-asked per island, so `detail` there only ever carries the grass-type pick, never
   * redundant site-condition text. Same withDetail() mechanism either way.
   */
  function withDetail(base, detail, isGeneral) {
    // Was "Řiď se jím, pokud neodporuje výše uvedenému" (follow it only if it doesn't contradict the
    // above) - too weak: a customer's specific wish for THIS exact spot is, almost by definition,
    // more specific than the generic description above it, so treating any difference as a
    // "contradiction" to defer to made real per-area requests (e.g. "jen strom a mulčovací kůra",
    // "bílý oblázek") get silently dropped in favor of the generic default. Now stated as a clear
    // override instead of a tie-breaker.
    if (!detail) return base;
    // isGeneral: this island has no note of its own (step 6's per-area field for it was left
    // empty) – rather than send this stage NOTHING, app.js now falls back to the customer's one
    // shared "Ještě něco k celé zahradě?" field. That field is written as ONE summary for the
    // WHOLE garden, often describing several different spots in the same paragraph (reported
    // 2026-10-27: a customer's single combined note meant for two different beds, with no per-area
    // field used, produced both beds guessing at each other's details). So it must not be
    // presented as this one area's own specific wish (the wording below used to say exactly that,
    // which told the model to force-apply all of it here) – instead the model is told to use its
    // own judgement, from the photo itself, about which part (if any) of that shared note
    // describes THIS masked spot specifically, by its real position and neighbouring context.
    return base + (isGeneral
      ? ' ZÁKAZNÍKOVO CELKOVÉ PŘÁNÍ PRO CELOU ZAHRADU (napsal ho jako jeden souhrn, ne zvlášť pro tuhle plochu): "' + detail + '". Pokud se některá jeho část podle polohy a kontextu na fotografii zjevně týká JINÉHO konkrétního místa, tu část na tuhle plochu neaplikuj – použij jen to, co dává smysl přesně pro tohle místo.'
      : ' ZÁKAZNÍKOVO VÝSLOVNÉ PŘÁNÍ PRO TUHLE KONKRÉTNÍ PLOCHU (má přednost před obecným popisem výše, pokud se od něj liší): "' + detail + '".');
  }

  function buildGrassStageInstructions(d, detail, detailGeneral, pos) {
    // Staged per-island grass prompts had no access to step 2's site data before (unlike
    // buildInstructions' single-call/remainder path, which always included it) – an AI call that
    // genuinely had zero idea whether the spot is sunny/shaded or irrigated. Passing `d` through
    // closes that gap so every grass island gets a lawn mix suited to its real conditions, on top
    // of whichever specific grass-type category the customer picked in step 6 (`detail`).
    var sunText = ({ 'Slunce': 'plné slunce', 'Polostín': 'polostín', 'Stín': 'stín' })[d && d['mg-sun']] || 'různé oslunění na zahradě';
    var irrText = ['automatická závlaha je k dispozici', 'zalévá se ručně', 'zahrada se nezalévá – jen suchovzdorné řešení'][+(d && d['mg-irrigation'] || 1)] || 'zalévá se ručně';
    var base = 'Zákazník na fotce vyznačil' + (pos ? ' (' + pos + ')' : '') + ', že si v téhle oblasti přeje trávník – zdravý, rovnoměrně sestřižený, stejné barvy a textury jako zbytek trávníku na fotografii. Jeho vyznačení je jen orientační poloha, ne přesná hranice – skutečný okraj zvol sama tak, aby plynule a přirozeně navazoval na okolí (žádná ostrá čtvercová hrana kopírující mřížku, kterou si zákazník vymaloval). Podmínky této oblasti: ' + sunText + '; ' + irrText + ' – zvol travní směs a hustotu odpovídající těmto podmínkám (např. stín snášející směs do stínu, odolnou/suchovzdornou směs tam, kde se nezalévá). Žádné rostliny, dlažba ani jiné prvky v této ploše.' + CLEAR_EXISTING_NOTE + ' Fotorealistický výsledek, stíny a perspektiva odpovídající zbytku fotografie, žádný malovaný ani ilustrativní vzhled.';
    return withDetail(base, detail, detailGeneral);
  }

  function buildWallStageInstructions(detail, detailGeneral, pos) {
    // Reported 2026-10-27: the wall's real height shrank/faded away right where it approached a
    // locked natural rock outcrop on one side, instead of holding its height to a clean, deliberate
    // end - the earlier wording only said "navazovat na úroveň terénu po obou stranách" (follow the
    // ground level on both sides), which an AI could satisfy by tapering the wall down toward zero.
    // A retaining wall's height is a structural dimension, not a decorative line that should fade -
    // the fix states this explicitly and as its own rule, independent of (and in addition to) the
    // "blend into an existing wall at the same height" rule for when the fixed neighbor IS a wall.
    return withDetail('Zákazník na fotce vyznačil' + (pos ? ' (' + pos + ')' : '') + ', že si tam přeje nízkou opěrnou zídku (přírodní kámen nebo betonové tvárnice, podle stylu zbytku zahrady). Jeho vyznačení je jen orientační poloha a přibližná délka, ne přesný předpis tvaru – skutečný průběh, délku a napojení na okolí zvol sama podle toho, co na fotce dává smysl. Zídka musí mít realistickou výšku vzhledem k okolí (typicky 20–60 cm) a tuto výšku musí držet KONSTANTNÍ a PLNOU po celé své délce, od jednoho konce k druhému – nikdy se nesmí postupně snižovat, ztenčovat ani vytrácet, dokud nekončí. Tam, kde zídka na jednom nebo obou koncích naráží na jiný fixní (needitovaný) prvek fotografie, který NENÍ zeď ani zídka (např. přírodní skála, svah, strom, roh domu), musí v plné výšce zřetelně a čistě ukončit přímo u něj (např. rovným čelem nebo zapuštěním do svahu) – ne se do něj postupně vytrácet nebo mizet. KDE naopak navazuje na jinou již existující zeď nebo zídku, která na fotce zůstává (fixní, needitovaná), musí na ni plynule stylově navázat ve STEJNÉ výšce a linii (stejný kámen/materiál) – bez viditelné spáry, předělu ani poklesu výšky v místě napojení.' + CLEAR_EXISTING_NOTE + ' Fotorealistický výsledek, stíny a perspektiva odpovídající zbytku fotografie, žádný malovaný ani ilustrativní vzhled.', detail, detailGeneral);
  }

  window.MVGreenBrief = {
    analyze: analyze, renderCheck: renderCheck, guideHtml: guideHtml,
    favoritesHtml: favoritesHtml, bindFavorites: bindFavorites,
    choosePlants: choosePlants, buildInstructions: buildInstructions, colorOf: colorOf,
    buildRemoveStageInstructions: buildRemoveStageInstructions,
    buildPathStageInstructions: buildPathStageInstructions,
    buildBedStageInstructions: buildBedStageInstructions,
    buildGrassStageInstructions: buildGrassStageInstructions,
    buildWallStageInstructions: buildWallStageInstructions
  };
})();
