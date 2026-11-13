/*
 * MVGreen AI architekt v3 – výsadba z ověřených kompozic (2026-11-13).
 * Majitel po testu na 5 zahradách: „všechny záhony jsou na jedno brdo, není tam žádná přidaná hodnota“.
 * v2 losovala 6–10 druhů z katalogu a program je rozházel podle sponu. v3: každý záhon dostane KOMPOZICI
 * podle svého místa (světlo, vlhkost, styl, hloubka, co je za ním) – jako u zahradního architekta:
 *   kostra   = strukturní rostliny v rytmu (dávají záhonu tvar i v zimě),
 *   skupiny  = doprovodné druhy v protáhlých skupinách po 3–7 ks (barva, sezóna),
 *   koberec  = pokryvná „matrix“ mezi nimi (žádná holá zem, méně plevele),
 *   cibuloviny = jaro, pod ostatním.
 * Kompozice jsou ručně sestavené z katalogu (assets/v2/plants-catalog.js) – AI je nevymýšlí, jen vybírá.
 * Majitel je jako odborník schvaluje (seznam v docs/architekt-v3.md, krok 4).
 */
(function (root) {
  'use strict';
  var G = (typeof module !== 'undefined' && module.exports) ? require('./geo.js') : root.MVGreenGeo;

  // light: slunce | polostin | stin; wet: sucho | normal | vlhko; place: zed (u zdi/plotu/domu), cesta (lem u cesty),
  // volny (ostrůvek), svah; depth: [min, max] m; styles: prirodni moderni nizka rodina
  var MODULES = [
    { id: 'prerie', name: 'Prérijní slunný záhon', styles: ['prirodni', 'rodina'], light: ['slunce'], wet: ['sucho', 'normal'], place: ['zed', 'volny', 'cesta'], depth: [1.2, 6],
      why: 'Trávy v pravidelném rytmu drží tvar celý rok, mezi nimi rozvolněné skupiny trvalek kvetou od června do října. Pokryvná tráva nenechá místo plevelu. Na jaře okrasné česneky.',
      kostra: { key: 'calamagrostis-acutiflora-karl-foerster', every: 1.6 },
      skupiny: ['echinacea-purpurea-magnus', 'salvia-nemorosa-caradonna', 'achillea-moonshine', 'rudbeckia-fulgida-little-goldstar'],
      koberec: { key: 'sporobolus-heterolepis', step: 0.6 }, cibule: { key: 'allium-hollandicum-purple-sensation', perM2: 5 } },
    { id: 'moderni-graficky', name: 'Moderní grafický záhon', styles: ['moderni'], light: ['slunce'], wet: ['sucho', 'normal'], place: ['zed', 'volny', 'cesta'], depth: [1, 6],
      why: 'Stálezelené koule kleče v přesném rytmu dávají záhonu kostru i v zimě. Mezi nimi bloky levandule, šanty a perovskie v jedné paletě modrofialové a stříbrné. Podklad tvoří pokryvná sesleria.',
      kostra: { key: 'pinus-mugo-mops', every: 1.4 },
      skupiny: ['lavandula-angustifolia', 'perovskia-little-spire', 'nepeta-faassenii'],
      koberec: { key: 'sesleria-autumnalis', step: 0.4 }, cibule: { key: 'allium-globemaster', perM2: 2 } },
    { id: 'moderni-travni', name: 'Moderní travní záhon', styles: ['moderni'], light: ['slunce', 'polostin'], wet: ['normal', 'vlhko'], place: ['zed', 'volny'], depth: [1.5, 6],
      why: 'Vysoký bezkolenec tvoří průhlednou clonu v rytmu. Bílá rdesna a pokryvná sesleria drží omezenou moderní paletu. Záhon je pěkný od července do zimy.',
      kostra: { key: 'molinia-arundinacea-transparent', every: 1.6 },
      skupiny: ['persicaria-amplexicaulis-alba', 'deschampsia-cespitosa-goldtau'],
      koberec: { key: 'sesleria-autumnalis', step: 0.4 }, cibule: { key: 'allium-hollandicum-purple-sensation', perM2: 4 } },
    { id: 'levandulovy-lem', name: 'Levandulový lem', styles: ['prirodni', 'moderni', 'rodina'], light: ['slunce'], wet: ['sucho', 'normal'], place: ['cesta', 'zed'], depth: [0.4, 1.3],
      why: 'Úzký pás podél cesty nebo zdi: souvislá levandule s vložkami šanty a šalvěje. Voní, láká opylovače, je nízký a drží tvar.',
      kostra: null, skupiny: ['nepeta-faassenii', 'salvia-nemorosa-blauhugel'], skupinyNa: 6,
      koberec: { key: 'lavandula-angustifolia', step: 0.45 }, cibule: null },
    { id: 'polostin-zed', name: 'Polostinný záhon u zdi', styles: ['prirodni', 'rodina'], light: ['polostin'], wet: ['normal', 'vlhko'], place: ['zed', 'volny'], depth: [1, 5],
      why: 'Hortenzie Annabelle v rytmu jsou kostrou a od června do září kvetou bílými koulemi. Mezi nimi skupiny čechravy, kakostu a bohyšky. Pokryvný kakost potlačí plevel a voní.',
      kostra: { key: 'hydrangea-arborescens-annabelle', every: 2.0 },
      skupiny: ['astilbe-arendsii-brautschleier', 'geranium-phaeum-lily-lovell', 'hosta-june'],
      koberec: { key: 'geranium-macrorrhizum-bevan-s-variety', step: 0.45 }, cibule: null },
    { id: 'stin', name: 'Stinný záhon pod stromy', styles: ['prirodni', 'moderni', 'nizka', 'rodina'], light: ['stin'], wet: ['sucho', 'normal', 'vlhko'], place: ['zed', 'volny', 'cesta'], depth: [0.8, 6],
      why: 'Do stínu, kde tráva neroste: kapradiny jako kostra, skupiny bohyšek, pomněnkovce a škornice. Pod nimi stálezelená tlustonitka. Vydrží i suchý stín pod stromy.',
      kostra: { key: 'dryopteris-affinis', every: 1.4 },
      skupiny: ['hosta-patriot', 'brunnera-macrophylla', 'epimedium-versicolor-sulphureum'],
      koberec: { key: 'pachysandra-terminalis-green-carpet', step: 0.3 }, cibule: null },
    { id: 'svah-slunce', name: 'Slunný svah', styles: ['prirodni', 'nizka', 'rodina', 'moderni'], light: ['slunce'], wet: ['sucho', 'normal'], place: ['svah'], depth: [1, 30],
      why: 'Svah se nezarovnává, osází se rostlinami, které ho zpevní kořeny: kostra z kleče, skupiny mochny, perovskie a šanty, mezi nimi pokryvná sesleria. Bez sečení ve svahu.',
      kostra: { key: 'pinus-mugo-gnom', every: 2.4 },
      skupiny: ['potentilla-fruticosa-tilford-cream', 'perovskia-lacey-blue', 'nepeta-faassenii'],
      koberec: { key: 'sesleria-heufleriana', step: 0.35 }, cibule: null },
    { id: 'nizka-kerova', name: 'Keřový záhon na nízkou údržbu', styles: ['nizka'], light: ['slunce', 'polostin'], wet: ['sucho', 'normal'], place: ['zed', 'volny', 'cesta'], depth: [1, 6],
      why: 'Málo práce: stálezelená kleč, kvetoucí tavolníky a mochny, pod nimi pokryvný kakost. Stačí jeden řez za rok, bez dosazování.',
      kostra: { key: 'pinus-mugo-mops', every: 1.8 },
      skupiny: ['spiraea-japonica-shirobana', 'potentilla-fruticosa-red-ace'],
      koberec: { key: 'geranium-macrorrhizum-czakor', step: 0.45 }, cibule: null },
    { id: 'rodina-odolna', name: 'Odolný rodinný záhon', styles: ['rodina'], light: ['slunce', 'polostin'], wet: ['normal', 'sucho'], place: ['zed', 'volny', 'cesta'], depth: [1, 6],
      why: 'Na děti a míče: netrnité a nejedovaté druhy, které snesou pošlapání a rychle obrostou. Kostra z tavolníku, skupiny denivek a kakostu, mezi nimi kontryhel.',
      kostra: { key: 'spiraea-japonica-anthony-waterer', every: 1.8 },
      skupiny: ['hemerocallis-happy-returns', 'geranium-sirak'],
      koberec: { key: 'alchemilla-mollis', step: 0.45 }, cibule: null },
    { id: 'soukromi', name: 'Clona u plotu', styles: ['prirodni', 'rodina', 'moderni', 'nizka'], light: ['slunce', 'polostin'], wet: ['normal', 'vlhko'], place: ['zed'], depth: [1.6, 6],
      why: 'Clona proti pohledům bez tújí: latnaté hortenzie a ozdobnice dorostou do 2 m, ale zůstanou vzdušné. Před nimi astry na podzim, pod nimi pokryvný kakost.',
      kostra: { key: 'hydrangea-paniculata-vanille-fraise', every: 1.8, alt: 'miscanthus-sinensis-ferner-osten' },
      skupiny: ['symphyotrichum-novae-angliae-barr-s-blue'],
      koberec: { key: 'geranium-macrorrhizum-czakor', step: 0.45 }, cibule: null },
    { id: 'vlhky-polostin', name: 'Vlhký polostinný záhon', styles: ['prirodni', 'rodina', 'moderni'], light: ['polostin', 'stin'], wet: ['vlhko'], place: ['zed', 'volny', 'cesta'], depth: [1, 6],
      why: 'Do vlhčího místa: velké modré bohyšky jako kostra, skupiny kosatce sibiřského, čechravy a bílého rdesna. Pod nimi ostřice.',
      kostra: { key: 'hosta-blue-angel', every: 1.6 },
      skupiny: ['iris-sibirica-caesar-s-brother', 'astilbe-japonica-europa', 'persicaria-amplexicaulis-alba'],
      koberec: { key: 'carex-sylvatica', step: 0.4 }, cibule: null },
    { id: 'moderni-polostin', name: 'Moderní polostinný záhon', styles: ['moderni', 'nizka'], light: ['polostin', 'stin'], wet: ['normal', 'vlhko'], place: ['zed', 'volny', 'cesta'], depth: [0.8, 6],
      why: 'Bílé hortenzie v rytmu, skupiny zlaté trávy hakonechloa a tmavých dlužich. Pod nimi tlustonitka. Omezená paleta (bílá, zelená, tmavá), působí čistě a moderně.',
      kostra: { key: 'hydrangea-arborescens-annabelle', every: 1.8 },
      skupiny: ['hakonechloa-macra', 'heuchera-obsidian', 'brunnera-macrophylla-looking-glass'],
      koberec: { key: 'pachysandra-terminalis-green-carpet', step: 0.3 }, cibule: null }
  ];

  // Výběr kompozice pro záhon: vše musí sedět (styl, světlo, vlhkost, místo, hloubka). Když nic, povolí se jiný styl.
  function choose(bed, opts) {
    var o = opts || {}, style = o.style || 'prirodni', ok = function (m, strictStyle) {
      return (!strictStyle || m.styles.indexOf(style) >= 0) && m.light.indexOf(bed.light) >= 0 && m.wet.indexOf(bed.wet || 'normal') >= 0
        && m.place.indexOf(bed.place || 'volny') >= 0 && bed.depth >= m.depth[0] && bed.depth <= m.depth[1]
        && !(o.lowCare && /prerie|vlhky/.test(m.id)) && (m.id !== 'soukromi' || bed.privacy);
    };
    var list = MODULES.filter(function (m) { return ok(m, true); });
    if (!list.length) list = MODULES.filter(function (m) { return ok(m, false); });
    if (!list.length) return null;
    // úzký pás (≤ 1,3 m) → lem; jinak pořadí podle toho, jak typická je kompozice pro styl (první = hlavní)
    var PRI = ['prerie', 'moderni-graficky', 'polostin-zed', 'moderni-polostin', 'stin', 'svah-slunce', 'nizka-kerova', 'rodina-odolna', 'moderni-travni', 'vlhky-polostin', 'soukromi', 'levandulovy-lem'];
    var narrow = function (m) { return bed.depth <= 1.3 && m.depth[1] <= 1.3 ? 0 : 1; };
    return list.sort(function (a, b) { return narrow(a) - narrow(b) || PRI.indexOf(a.id) - PRI.indexOf(b.id); })[0];
  }

  function seeded(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  // Hlavní osa záhonu (PCA vrcholů) a hloubka kolmo na ni.
  function axis(poly) {
    var cx = 0, cy = 0; poly.forEach(function (p) { cx += p[0] / poly.length; cy += p[1] / poly.length; });
    var sxx = 0, syy = 0, sxy = 0; poly.forEach(function (p) { var dx = p[0] - cx, dy = p[1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
    var a = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]];
    var t0 = Infinity, t1 = -Infinity, s0 = Infinity, s1 = -Infinity;
    poly.forEach(function (p) { var t = (p[0] - cx) * u[0] + (p[1] - cy) * u[1], s = (p[0] - cx) * v[0] + (p[1] - cy) * v[1]; t0 = Math.min(t0, t); t1 = Math.max(t1, t); s0 = Math.min(s0, s); s1 = Math.max(s1, s); });
    return { c: [cx, cy], u: u, v: v, t0: t0, t1: t1, s0: s0, s1: s1 };
  }

  /* Rozmístění kompozice v záhonu (metry). bed = { poly, back: [indexy hran u zdi/plotu] }. Vrací
   * { plants: [{key, x, y, layer}], counts: {key: n} }. Pořadí: kostra → skupiny → koberec → cibuloviny.
   * Rostlina nesmí být blíž k okraji než polovina sponu (nepřeroste do trávníku) ani k jiné rostlině
   * blíž než průměr jejich sponů × 0,9. */
  function layout(bed, mod, catalog, seed) {
    var poly = bed.poly, rnd = seeded(seed || 7), A = axis(poly), placed = [];
    var spec = function (k) { var p = catalog[k]; if (!p) throw new Error('Kompozice „' + mod.id + '“: rostlina ' + k + ' není v katalogu'); return p; };
    var free = function (pt, sp, edgeK) {
      if (!G.inPoly(pt, poly) || G.edgeDist(pt, poly) < sp * (edgeK || 0.5)) return false;
      for (var i = 0; i < placed.length; i++) { var q = placed[i]; if (Math.hypot(q.x - pt[0], q.y - pt[1]) < (q.sp + sp) / 2 * 0.9) return false; }
      return true;
    };
    var put = function (k, pt, layer) { var sp = spec(k).spon; placed.push({ key: k, x: pt[0], y: pt[1], sp: sp, layer: layer }); };
    var at = function (t, s) { return [A.c[0] + A.u[0] * t + A.v[0] * s, A.c[1] + A.u[1] * t + A.v[1] * s]; };
    // „záda“ záhonu: strana osy blíž ke zdi/plotu (s0 nebo s1); u volného záhonu střed
    var backS = 0;
    if (bed.back && bed.back.length) {
      var m = bed.back.map(function (i) { var a = poly[i], b = poly[(i + 1) % poly.length]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
      var ms = m.reduce(function (s, p) { return s + (p[0] - A.c[0]) * A.v[0] + (p[1] - A.c[1]) * A.v[1]; }, 0) / m.length;
      backS = ms > 0 ? A.s1 : A.s0;
    }
    var depth = A.s1 - A.s0, len = A.t1 - A.t0;
    // 1) kostra v rytmu podél osy, u zad záhonu (u volného uprostřed)
    if (mod.kostra) {
      var ksp = spec(mod.kostra.key).spon, sK = backS ? backS - Math.sign(backS) * Math.max(ksp * 0.6, Math.min(depth * 0.3, 0.9)) : 0;
      var n = Math.max(1, Math.floor((len - ksp) / mod.kostra.every) + 1), start = -((n - 1) * mod.kostra.every) / 2 + (A.t0 + A.t1) / 2;
      for (var i = 0; i < n; i++) {
        var key = mod.kostra.alt && i % 2 ? mod.kostra.alt : mod.kostra.key;
        // u nepravidelného záhonu bod v ose zad nemusí ležet uvnitř → zkusit blíž ke středu
        var tries2 = [sK, sK * 0.6, sK * 0.3, 0, -sK * 0.3];
        for (var q = 0; q < tries2.length; q++) { var pt = at(start + i * mod.kostra.every, tries2[q]); if (free(pt, spec(key).spon)) { put(key, pt, 'kostra'); break; } }
      }
    }
    // 2) skupiny: protáhlé skupiny po 3–7 ks podél osy, druhy se střídají, každá skupina jinde v hloubce
    var groups = mod.skupiny || [];
    if (groups.length) {
      // skupina zhruba na každé 3,5 m² (u lemu řidčeji – hlavní je souvislá levandule); koberec pak vyplní zbytek
      var area = G.polyArea(poly), nGroups = Math.max(groups.length, Math.round(area / (mod.skupinyNa || 3.5))), gi = 0;
      for (var g = 0; g < nGroups; g++) {
        var k2 = groups[gi++ % groups.length], sp2 = spec(k2).spon, size = 3 + Math.floor(rnd() * 3);
        var tc = A.t0 + (g + 0.5) / nGroups * len, sc = A.s0 + depth * (0.3 + 0.4 * rnd());
        var got = 0;
        for (var tries = 0; tries < 60 && got < size; tries++) {
          var ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * sp2 * 1.6;
          var pt2 = at(tc + Math.cos(ang) * rr * 1.6, sc + Math.sin(ang) * rr * 0.7);
          if (free(pt2, sp2)) { put(k2, pt2, 'skupina'); got++; }
        }
        // skupina menší než 3 ks působí nahodile (test: čechrava ×1) – raději ji vynechat, místo zaplní koberec
        if (got < 3) placed.splice(placed.length - got, got);
      }
    }
    // 3) koberec: šestiúhelníková síť přes zbytek záhonu
    if (mod.koberec) {
      var sp3 = mod.koberec.step, ksp3 = spec(mod.koberec.key).spon;
      for (var s = A.s0; s <= A.s1; s += sp3 * 0.866) for (var t = A.t0 + ((Math.round((s - A.s0) / (sp3 * 0.866)) % 2) ? sp3 / 2 : 0); t <= A.t1; t += sp3) {
        // přírodní styly: síť rozvolnit (náhodný posun), jinak koberec vypadá jako řádky na poli; moderní nechat pravidelný
        var jit = mod.styles.indexOf('moderni') >= 0 && mod.styles.length <= 2 ? 0 : sp3 * 0.28;
        var pt3 = at(t + (rnd() - 0.5) * 2 * jit, s + (rnd() - 0.5) * 2 * jit); if (free(pt3, Math.min(ksp3, sp3), 0.4)) put(mod.koberec.key, pt3, 'koberec');
      }
    }
    // 4) cibuloviny: počet podle plochy, mezi ostatním (nekontroluje se rozestup – rostou pod nimi)
    var bulbs = [];
    if (mod.cibule) { var nb = Math.round(G.polyArea(poly) * mod.cibule.perM2); for (var b = 0, tr = 0; b < nb && tr < nb * 5; tr++) { var pt4 = at(A.t0 + rnd() * len, A.s0 + rnd() * depth); if (G.inPoly(pt4, poly) && G.edgeDist(pt4, poly) > 0.15) { bulbs.push({ key: mod.cibule.key, x: pt4[0], y: pt4[1], sp: 0.1, layer: 'cibule' }); b++; } } }
    var all = placed.concat(bulbs), counts = {};
    all.forEach(function (p) { counts[p.key] = (counts[p.key] || 0) + 1; });
    return { plants: all, counts: counts, axis: A, depth: depth, length: len };
  }

  var api = { MODULES: MODULES, choose: choose, layout: layout, axis: axis };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MVGreenPlanting = api;
})(typeof window !== 'undefined' ? window : this);
