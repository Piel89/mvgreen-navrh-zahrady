/*
 * MVGreen AI architekt v3 – půdorys: zadání pro AI architekta a přísná kontrola výsledku (2026-11-14).
 * Test na 5 zahradách (0.6.283): AI přistavěla zdi a schody do svahu, nový domek na trávník, zrušila
 * stávající levandule, záhon plánovala do chráněné části. v3: AI navrhuje JEN půdorys v metrech (JSON) a
 * program ho zkontroluje dřív, než se cokoli kreslí. Chyby se vrátí AI k opravě (max. 2×), pak člověku.
 */
(function (root) {
  'use strict';
  var G = (typeof module !== 'undefined' && module.exports) ? require('./geo.js') : root.MVGreenGeo;

  // Schéma odpovědi AI (OpenAI json_schema, strict). Body jsou v metrech: x zleva doprava, y od fotografa dozadu.
  var pt = { type: 'array', items: { type: 'number' } };
  var SCHEMA = { type: 'object', additionalProperties: false, required: ['concept', 'beds', 'paths', 'walls', 'trees', 'notes'], properties: {
    concept: { type: 'string' },
    beds: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'poly', 'light', 'wet', 'place', 'why'], properties: {
      name: { type: 'string' }, poly: { type: 'array', items: pt }, light: { type: 'string', enum: ['slunce', 'polostin', 'stin'] }, wet: { type: 'string', enum: ['sucho', 'normal', 'vlhko'] },
      place: { type: 'string', enum: ['zed', 'cesta', 'volny', 'svah'] }, why: { type: 'string' } } } },
    paths: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'line', 'width', 'surface', 'from', 'to'], properties: {
      name: { type: 'string' }, line: { type: 'array', items: pt }, width: { type: 'number' }, surface: { type: 'string', enum: ['naslap', 'kamen', 'vf', 'zamkova', 'sterk'] }, from: { type: 'string' }, to: { type: 'string' } } } },
    walls: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'line', 'height', 'joins'], properties: {
      name: { type: 'string' }, line: { type: 'array', items: pt }, height: { type: 'number' }, joins: { type: 'string' } } } },
    trees: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['at', 'why'], properties: { at: pt, why: { type: 'string' } } } },
    notes: { type: 'string' }
  } };

  /* site = { W, D, style, keep: [{name, poly}] (chráněné plochy v metrech – z označení na fotce),
   *   anchors: [{name, line}] (stávající zdi, ploty, domy, terénní hrany – na co smí navazovat zídka),
   *   targets: [{name, at}] (kam vedou cesty: vstup, branka, studna, terasa), slope: 'rovina'|'mirny'|'prudky',
   *   orient: 'J'|'S'|'V'|'Z'|'' (kam fotograf hleděl), wishes: text, users: {kids, dog}, sketch: text } */
  function prompt(site) {
    var f = function (p) { return '[' + p.map(function (v) { return (+v).toFixed(1); }).join(', ') + ']'; };
    return 'Jsi zkušený zahradní architekt v ČR. Navrhni PŮDORYS úpravy zahrady jako JSON v METRECH (x zleva doprava 0–' + site.W + ', y od místa focení dozadu 0–' + site.D + ').\n'
      + 'Upravovaná plocha je obdélník ' + site.W + ' × ' + site.D + ' m (změřil zákazník). Styl: ' + site.style + '. Svah: ' + (site.slope || 'rovina') + '. Fotka hledí na ' + (site.orient || 'neznámo') + '.\n'
      + 'CHRÁNĚNÉ PLOCHY – nic do nich nekresli, nic neměň: ' + (site.keep || []).map(function (k) { return k.name + ' ' + k.poly.map(f).join(' '); }).join('; ') + '.\n'
      + 'NA CO SMÍ NAVAZOVAT ZÍDKA: ' + (site.anchors || []).map(function (a) { return a.name + ' ' + a.line.map(f).join(' '); }).join('; ') + '.\n'
      + 'CÍLE CEST: ' + (site.targets || []).map(function (t) { return t.name + ' ' + f(t.at); }).join('; ') + '.\n'
      + 'PŘÁNÍ ZÁKAZNÍKA (mají přednost): ' + (site.wishes || 'žádná') + (site.sketch ? '. NÁČRT ZÁKAZNÍKA (vodítko): ' + site.sketch : '') + '.\n'
      + 'PRAVIDLA: 1) záhony 0,6–4 m hluboké, tvar podle stylu, mezi záhonem a trávníkem plynulá hrana; 2) cesta vede vždy z jednoho cíle do druhého, šířka 0,9–1,3 m; '
      + '3) zídky JEN když jsou v přání/náčrtu nebo kvůli terénu, vždy začínají u něčeho ze seznamu „na co smí navazovat“; 4) žádné nové stavby, terasy, schody, ploty, pergoly ani domky, pokud nejsou v přání; '
      + '5) u každého záhonu urči světlo (podle stínu domů, stromů a orientace), vlhkost a místo (zed = u zdi/plotu/domu, cesta = lem u cesty, volny, svah); 6) stromy jen pokud přání/náčrt; '
      + '7) zahrada musí dávat smysl jako celek: kudy se chodí, kde se sedí, co se zakryje, co je vidět z domu. Do concept napiš 2–3 věty záměru, do why u každého prvku proč je tam.';
  }

  function pip(p, poly) { return G.inPoly(p, poly); }
  function overlap(a, b, step) {   // přibližná plocha průniku dvou mnohoúhelníků (mřížka)
    var xs = a.map(function (q) { return q[0]; }), ys = a.map(function (q) { return q[1]; }), s = step || 0.2, n = 0;
    for (var x = Math.min.apply(null, xs); x <= Math.max.apply(null, xs); x += s) for (var y = Math.min.apply(null, ys); y <= Math.max.apply(null, ys); y += s) if (pip([x, y], a) && pip([x, y], b)) n++;
    return n * s * s;
  }
  function lineBuffer(line, w) {   // pás kolem čáry (cesta) jako mnohoúhelník
    var L = [], R = [];
    line.forEach(function (p, i) { var a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; L.push([p[0] + nx, p[1] + ny]); R.push([p[0] - nx, p[1] - ny]); });
    return L.concat(R.reverse());
  }
  function nearLine(p, line) { var m = Infinity; for (var i = 1; i < line.length; i++) m = Math.min(m, G.segDist(p, line[i - 1], line[i])); return m; }
  // hloubka záhonu = nejmenší šířka obrysu (otáčí se směr po 3°)
  function depthOf(poly) {
    var best = Infinity;
    for (var a = 0; a < 180; a += 3) {
      var r = a * Math.PI / 180, u = [Math.cos(r), Math.sin(r)], lo = Infinity, hi = -Infinity;
      poly.forEach(function (p) { var t = p[0] * u[0] + p[1] * u[1]; if (t < lo) lo = t; if (t > hi) hi = t; });
      best = Math.min(best, hi - lo);
    }
    return best;
  }

  /* Kontrola půdorysu. Vrací { ok, problems: [text], stats }. Každý problém je česká věta, kterou jde vrátit AI k opravě. */
  function validate(plan, site) {
    var probs = [], tol = 0.15, W = site.W, D = site.D, wish = String(site.wishes || '') + ' ' + String(site.sketch || '');
    var inside = function (p) { return p[0] >= -tol && p[0] <= W + tol && p[1] >= -tol && p[1] <= D + tol; };
    (plan.beds || []).forEach(function (b, i) {
      var nm = b.name || ('Záhon ' + (i + 1));
      if (!b.poly || b.poly.length < 3) { probs.push(nm + ': chybí obrys.'); return; }
      if (!b.poly.every(inside)) probs.push(nm + ': leží mimo změřenou plochu ' + W + ' × ' + D + ' m.');
      var A = G.polyArea(b.poly); if (A < 1.5) probs.push(nm + ': má jen ' + A.toFixed(1) + ' m², to je na záhon málo (min. 1,5 m²).');
      var d = depthOf(b.poly); if (d < 0.6) probs.push(nm + ': je užší než 0,6 m.'); if (d > 4.2 && b.place !== 'svah') probs.push(nm + ': je hlubší než 4 m – do středu se nedá dosáhnout, rozděl ho cestičkou nebo zmenši.');
      (site.keep || []).forEach(function (k) { var o = overlap(b.poly, k.poly); if (o > 0.3) probs.push(nm + ': zasahuje ' + o.toFixed(1) + ' m² do chráněné plochy „' + k.name + '“.'); });
      (plan.beds || []).forEach(function (c, j) { if (j > i && c.poly && overlap(b.poly, c.poly) > 0.3) probs.push(nm + ' a ' + (c.name || 'Záhon ' + (j + 1)) + ': překrývají se.'); });
      (plan.paths || []).forEach(function (p) { if (p.line && p.line.length > 1 && overlap(b.poly, lineBuffer(p.line, p.width || 1)) > 0.3) probs.push(nm + ': leží přes cestu „' + (p.name || 'cesta') + '“.'); });
    });
    (plan.paths || []).forEach(function (p) {
      var nm = p.name || 'Cesta';
      if (!p.line || p.line.length < 2) { probs.push(nm + ': chybí trasa.'); return; }
      if (p.width < 0.8 || p.width > 1.6) probs.push(nm + ': šířka ' + p.width + ' m – má být 0,9–1,3 m.');
      if (!p.line.every(inside)) probs.push(nm + ': vede mimo změřenou plochu.');
      var ends = [p.line[0], p.line[p.line.length - 1]], tg = site.targets || [], edge = function (q) { return q[0] < 0.6 || q[1] < 0.6 || q[0] > W - 0.6 || q[1] > D - 0.6; };
      var hits = ends.filter(function (q) { return tg.some(function (t) { return Math.hypot(t.at[0] - q[0], t.at[1] - q[1]) < 1.2; }) || edge(q); }).length;
      if (hits < 2) probs.push(nm + ': nevede z cíle do cíle (začátek i konec mají být u vstupu, dlažby, studny, terasy nebo na okraji plochy).');
      (site.keep || []).forEach(function (k) { if (/budov|dům|domek|studn|kůln|garáž/i.test(k.name) && overlap(lineBuffer(p.line, p.width || 1), k.poly) > 0.4) probs.push(nm + ': vede přes „' + k.name + '“.'); });
    });
    (plan.walls || []).forEach(function (w) {
      var nm = w.name || 'Zídka';
      if (!/zeď|zíd|opěr|terén|svah/i.test(wish) && site.slope !== 'prudky') probs.push(nm + ': zákazník zídku nechtěl a terén ji nevyžaduje – vypusť ji.');
      if (w.line && w.line.length > 1) {
        var a = w.line[0], b = w.line[w.line.length - 1], anc = site.anchors || [];
        var joined = anc.some(function (x) { return nearLine(a, x.line) < 0.7 || nearLine(b, x.line) < 0.7; }) || (site.keep || []).some(function (k) { return G.edgeDist(a, k.poly) < 0.7 || G.edgeDist(b, k.poly) < 0.7; });
        if (!joined) probs.push(nm + ': stojí samostatně – musí začínat u stávající zdi, domu, plotu nebo terénní hrany.');
      }
      if (w.height > 1.0) probs.push(nm + ': výška ' + w.height + ' m – nad 1 m je to stavba se statikem, ne zahradní úprava.');
    });
    if ((plan.trees || []).length && !/strom|stín|solit/i.test(wish)) probs.push('Stromy: zákazník je nechtěl – vypusť je, nebo je zdůvodni v přání.');
    var bedA = (plan.beds || []).reduce(function (s, b) { return s + (b.poly ? G.polyArea(b.poly) : 0); }, 0);
    if (site.style === 'rodina' && bedA > W * D * 0.35) probs.push('Pro rodinu: záhony zabírají ' + Math.round(bedA / (W * D) * 100) + ' % plochy – má zůstat velký souvislý trávník (záhony do 35 %).');
    if (site.users && site.users.kids && (plan.walls || []).some(function (w) { return w.height > 0.6; })) probs.push('Děti: zídka vyšší než 0,6 m je riziko pádu – sniž ji nebo nahraď svahem s výsadbou.');
    return { ok: !probs.length, problems: probs, stats: { beds: bedA } };
  }

  var api = { SCHEMA: SCHEMA, prompt: prompt, validate: validate, overlap: overlap, lineBuffer: lineBuffer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MVGreenPlanV3 = api;
})(typeof window !== 'undefined' ? window : this);
