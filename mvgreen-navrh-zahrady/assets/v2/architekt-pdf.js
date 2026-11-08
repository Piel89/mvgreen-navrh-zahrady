/*
 * MVGreen AI architekt v2 – 11stránkový projekt v PDF (2026-11-08).
 * Strany skládá z dat jednoho návrhu (výkres + legenda z plan-render.js, podnebí, údaje o rostlinách
 * z mvgreen_ai_plant_facts, fotky před/po). Tiskne se přes window.print() – A4, strana 4 na šířku.
 * Obsah a pořadí stran odsouhlasil Martin v návrhu vzhledu (11 bodů „co má být v PDF“).
 */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var kc = function (n) { return Math.round(n).toLocaleString('cs-CZ') + ' Kč'; };
  var MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  var MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

  function head(ctx, no) {
    return '<div class="mvg2-page__head"><span>' + (ctx.logo ? '<img src="' + esc(ctx.logo) + '" alt="">' : '') + 'Projekt zahrady · ' + esc(ctx.place) + '</span><span>' + no + ' / 11</span></div>';
  }
  function title(cap, h) { return '<div class="mvg2-page__title"><span>' + esc(cap) + '</span><h2>' + esc(h) + '</h2></div>'; }
  function inRange(m, a, b) { return a <= b ? m >= a && m <= b : m >= a || m <= b; }

  /* ---------- světové strany a slunce (strana 2) ---------- */
  var DIRS = ['S', 'V', 'J', 'Z'], DIR_NAME = { S: 'sever', V: 'východ', J: 'jih', Z: 'západ' };
  function rot(d, k) { return DIRS[(DIRS.indexOf(d) + k + 4) % 4]; }
  // Na které světové straně zahrady je plot vlevo/vpravo/vzadu, když fotograf hledí směrem `o`.
  function sideDir(o, side) { return side === 'vzadu' ? o : side === 'vlevo' ? rot(o, -1) : side === 'vpravo' ? rot(o, 1) : rot(o, 2); }
  function sunNotes(ctx) {
    var o = ctx.orient;
    if (!o || o === 'unknown') return ['Světové strany jste nezadali – slunce a stín odhadujeme jen podle volby „' + (ctx.sun || 'slunce') + '“. Pro přesnější výběr rostlin zadejte příště, kam je fotka focená.'];
    var out = ['Fotka je focená směrem na ' + DIR_NAME[o] + '. Horní okraj výkresu na straně 4 je tedy ' + DIR_NAME[o] + '.'];
    (ctx.fences || []).forEach(function (side) {
      var d = sideDir(o, side);
      var txt = { S: 'je na severní straně – pás podél něj je otočený k jihu a má plné slunce (nejlepší místo pro kvetoucí záhon)', J: 'je na jižní straně – pás těsně u něj je většinu dne ve stínu plotu, hodí se rostliny do polostínu', V: 'je na východní straně – pás u něj je dopoledne ve stínu, odpoledne na slunci', Z: 'je na západní straně – pás u něj je dopoledne na slunci, odpoledne ve stínu' }[d];
      out.push('Plot ' + side + ' ' + txt + '.');
    });
    if (ctx.house && ctx.house !== 'none') {
      var hd = sideDir(o, { left: 'vlevo', right: 'vpravo', back: 'vzadu', behind: 'za' }[ctx.house]);
      out.push('Dům stojí na ' + { S: 'severní', V: 'východní', J: 'jižní', Z: 'západní' }[hd] + ' straně – ' + (hd === 'J' ? 'plochy u něj jsou většinu dne v jeho stínu.' : hd === 'S' ? 'plochy u něj jsou na slunci a v teple od zdi.' : hd === 'V' ? 'stín vrhá dopoledne.' : 'stín vrhá odpoledne.'));
    }
    return out;
  }
  function compassSvg(o) {
    var known = o && o !== 'unknown', top = known ? o : '?';
    var L = known ? { t: o, r: rot(o, 1), b: rot(o, 2), l: rot(o, -1) } : { t: '?', r: '?', b: '?', l: '?' };
    var sunPos = { t: [100, 34], r: [166, 100], b: [100, 166], l: [34, 100] }, sunKey = known ? Object.keys(L).filter(function (k) { return L[k] === 'J'; })[0] : null;
    return '<svg width="190" height="190" viewBox="0 0 200 200" role="img" aria-label="Orientace zahrady ke světovým stranám">'
      + '<circle cx="100" cy="100" r="88" fill="#FFFFFF" stroke="#C9C4B6" stroke-width="1.5"/>'
      + (sunKey ? '<circle cx="' + sunPos[sunKey][0] + '" cy="' + sunPos[sunKey][1] + '" r="12" fill="#F2B544"/>' : '')
      + '<rect x="68" y="78" width="64" height="44" rx="4" fill="#B4D392" stroke="#2E5E2C" stroke-width="1.5"/>'
      + '<path d="M100 160 L100 128 M94 136 L100 127 L106 136" fill="none" stroke="#142019" stroke-width="2"/>'
      + '<text x="100" y="22" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="14" font-weight="800" fill="#142019">' + L.t + '</text>'
      + '<text x="186" y="105" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="14" font-weight="800" fill="#142019">' + L.r + '</text>'
      + '<text x="100" y="196" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="14" font-weight="800" fill="#142019">' + L.b + '</text>'
      + '<text x="14" y="105" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="14" font-weight="800" fill="#142019">' + L.l + '</text>'
      + '<text x="100" y="104" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="700" fill="#142019">zahrada</text>'
      + '<text x="100" y="176" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="#4A554F">směr focení ↑</text></svg>';
  }

  // Orientační pracnost (osobohodiny šikovného laika včetně výkopu, odvozu a úklidu):
  // záhon 1 h/m², kačírek 0,6 h/m², trávník 0,12 h/m², dlažba 3 h/m², chodník 2,5 h/m²,
  // opěrná zeď 8 h/m délky, schody 16 h. Víkend = 2 lidé × 2 dny × 7 h = 28 h.
  function workPlan(ctx) {
    var p = ctx.project || {}, A = window.MVGreenPlanV2 ? window.MVGreenPlanV2.polyArea : function () { return 0; };
    var len = function (l) { var s = 0; for (var i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; };
    var sum = function (a, f) { return (a || []).reduce(function (s, x) { return s + f(x); }, 0); };
    var bed = sum((p.beds || []).filter(function (b) { return b.surface !== 'gravel'; }), function (b) { return A(b.poly); });
    var gravel = sum((p.beds || []).filter(function (b) { return b.surface === 'gravel'; }), function (b) { return A(b.poly); });
    var paving = sum((p.areas || []).filter(function (a) { return a.type === 'paving' && a.isNew; }), function (a) { return A(a.poly); });
    var path = sum(p.paths, function (x) { return len(x.line) * (x.width || 1); });
    var wall = sum((p.walls || []).filter(function (w) { return w.isNew; }), function (w) { return len(w.line); });
    var steps = (p.structures || []).filter(function (s) { return s.steps && s.isNew; }).length;
    var lawn = ctx.lawnArea || 0, rows = [], f1 = function (v) { return v.toFixed(0); };
    var add = function (name, q, unit, rate) { if (q > 0.3) rows.push([name, f1(q) + ' ' + unit, Math.max(1, Math.round(q * rate))]); };
    add('Zámková dlažba vč. výkopu a podkladu', paving, 'm²', 3); add('Chodník', path, 'm²', 2.5); add('Opěrná zeď vč. základu', wall, 'm', 8);
    if (steps) rows.push(['Schody', steps + ' ks', steps * 16]);
    add('Záhony (příprava, výsadba, mulč)', bed, 'm²', 1); add('Kačírek', gravel, 'm²', 0.6); add('Trávník (příprava a výsev)', lawn, 'm²', 0.12);
    var hours = rows.reduce(function (s, r) { return s + r[2]; }, 0), hardH = Math.round(paving * 3 + path * 2.5 + wall * 8 + steps * 16);
    return { rows: rows, hours: hours, weekends: Math.max(1, Math.ceil(hours / 28)), gardenWeekends: Math.max(1, Math.ceil((hours - hardH) / 28)), hard: paving > 0.3 || wall > 0.3 || steps > 0, paving: paving > 0.3, wall: wall > 0.3, steps: steps };
  }
  // Záhon 1, 2… a zvlášť Kačírek 1, 2… (kačírek je v projektu „záhon“ s povrchem gravel).
  function bedName(beds, i) {
    var g = beds[i].surface === 'gravel', n = beds.slice(0, i + 1).filter(function (b) { return (b.surface === 'gravel') === g; }).length;
    return (g ? 'Kačírek ' : 'Záhon ') + n;
  }
  /* ---------- rozměrový výkres s kótami (strana 5) ---------- */
  function dimsDrawing(p) {
    var W = 682, H = 360, M = 34, w = p.site.w, h = p.site.h, sc = Math.min((W - 2 * M) / w, (H - 2 * M) / h);
    var ox = M + ((W - 2 * M) - w * sc) / 2, oy = M / 2 + ((H - 2 * M) - h * sc) / 2;
    var X = function (m) { return Math.round((ox + m * sc) * 10) / 10; }, Y = function (m) { return Math.round((oy + m * sc) * 10) / 10; };
    var path = function (pts, close) { return pts.map(function (q, i) { return (i ? 'L' : 'M') + X(q[0]) + ' ' + Y(q[1]); }).join(' ') + (close === false ? '' : ' Z'); };
    var fmt = function (v) { return v.toFixed(1).replace('.', ','); };
    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">'
      + '<rect x="' + X(0) + '" y="' + Y(0) + '" width="' + (w * sc) + '" height="' + (h * sc) + '" fill="#F1F5EA" stroke="#8E8676" stroke-width="1.5"/>';
    var labels = [];
    p.areas.filter(function (a) { return a.type === 'paving' || a.type === 'building'; }).forEach(function (a) { svg += '<path d="' + path(a.poly) + '" fill="' + (a.type === 'building' ? '#B9B4AA' : '#DDD7CA') + '" stroke="#8E8676"/>'; });
    (p.paths || []).forEach(function (pa) { svg += '<path d="' + path(pa.line, false) + '" fill="none" stroke="#E2DED2" stroke-width="' + Math.max(4, pa.width * sc) + '" stroke-linecap="round"/>'; });
    (p.beds || []).forEach(function (b, i) {
      svg += '<path d="' + path(b.poly) + '" fill="#E9DFC8" stroke="#8C6C4D" stroke-width="1.5"/>';
      var xs = b.poly.map(function (q) { return q[0]; }), ys = b.poly.map(function (q) { return q[1]; });
      var bw = Math.max.apply(null, xs) - Math.min.apply(null, xs), bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      var cx = xs.reduce(function (s, v) { return s + v; }, 0) / xs.length, cy = ys.reduce(function (s, v) { return s + v; }, 0) / ys.length;
      // Popisek úzkého záhonu u kraje by překryl kótu – posune se dovnitř zahrady.
      var lxPos = X(cx) < X(0) + 90 ? X(Math.max.apply(null, xs)) + 80 : X(cx) > X(w) - 90 ? X(Math.min.apply(null, xs)) - 80 : X(cx);
      labels.push({ x: lxPos, y: Y(cy) + i * 22, t: bedName(p.beds, i) + ': ' + fmt(bw) + ' × ' + fmt(bh) + ' m', cls: 'bed' });
    });
    (p.walls || []).forEach(function (wl) { svg += '<path d="' + path(wl.line, false) + '" fill="none" stroke="#7E7566" stroke-width="5"/>'; });
    (p.fences || []).forEach(function (f) { svg += '<path d="' + path(f.line, false) + '" fill="none" stroke="#5C3B2C" stroke-width="4"/>'; });
    // kóty celé zahrady
    var by = Y(h) + 16, lx = X(0) - 16;
    svg += '<path d="M' + X(0) + ' ' + by + ' L' + X(w) + ' ' + by + ' M' + X(0) + ' ' + (by - 6) + ' L' + X(0) + ' ' + (by + 6) + ' M' + X(w) + ' ' + (by - 6) + ' L' + X(w) + ' ' + (by + 6) + '" stroke="#B5371F" stroke-width="1.6"/>';
    svg += '<path d="M' + lx + ' ' + Y(0) + ' L' + lx + ' ' + Y(h) + ' M' + (lx - 6) + ' ' + Y(0) + ' L' + (lx + 6) + ' ' + Y(0) + ' M' + (lx - 6) + ' ' + Y(h) + ' L' + (lx + 6) + ' ' + Y(h) + '" stroke="#B5371F" stroke-width="1.6"/></svg>';
    labels.push({ x: (X(0) + X(w)) / 2, y: by, t: 'šířka ≈ ' + fmt(w) + ' m', cls: 'dim' });
    labels.push({ x: lx, y: (Y(0) + Y(h)) / 2, t: fmt(h) + ' m', cls: 'dim' });
    return '<div class="mvg2-dims">' + svg + labels.map(function (l) { return '<span class="mvg2-dims__' + l.cls + '" style="left:' + l.x + 'px;top:' + l.y + 'px">' + esc(l.t) + '</span>'; }).join('') + '</div>';
  }

  function pages(ctx) {
    var f = ctx.facts || {}, plants = ctx.plants, out = [];
    var total = plants.reduce(function (s, p) { return s + p.count * (p.price || 0); }, 0);
    var nPlants = plants.reduce(function (s, p) { return s + p.count; }, 0);
    var safeList = plants.filter(function (p) { return p.toxic === 'ano'; }).map(function (p) { return p.name; });

    // 1 – titulní strana
    out.push('<section class="mvg2-page mvg2-page--cover">'
      + '<div class="mvg2-cover__top">' + (ctx.logo ? '<img src="' + esc(ctx.logo) + '" alt="MV GREEN">' : '') + '<div><strong>MV GREEN</strong><span>AI zahradní architekt</span></div><em>PROJEKT Č. ' + esc(ctx.number) + '</em></div>'
      + '<div class="mvg2-cover__title"><span>PROJEKT ZAHRADY</span><h1>' + esc(f.title || 'Projekt zahrady') + '</h1></div>'
      + (ctx.after ? '<img class="mvg2-cover__photo" src="' + esc(ctx.after) + '" alt="Vizualizace návrhu">' : '')
      + '<div class="mvg2-cover__info">'
      + [['PRO', ctx.name || '—'], ['MÍSTO', ctx.place], ['DATUM', ctx.date], ['STYL', ctx.styleLabel]].map(function (r) { return '<div><span>' + r[0] + '</span><strong>' + esc(r[1]) + '</strong></div>'; }).join('')
      + '<ol class="mvg2-toc">' + ['Rozbor stanoviště', 'Koncept, před a po', 'Osazovací plán', 'Rozměry a spon', 'Karty rostlin', 'Kvetení a zálivka', 'Návod krok za krokem', 'Rozpočet a nákup', 'Péče a hnojení', 'Dobré vědět, zdroje'].map(function (t, i) { return '<li><span>' + t + '</span><em>' + (i + 2) + '</em></li>'; }).join('') + '</ol></div>'
      + '<div class="mvg2-cover__foot"><span>mvgreen.cz</span><span>723 339 650 · mvgreen@seznam.cz</span></div></section>');

    // 2 – rozbor stanoviště
    var c = ctx.climate || {};
    var cards = [[c.elevation ? c.elevation + ' m n. m.' : '—', 'nadmořská výška'], [c.precip ? c.precip + ' mm' : '—', 'srážky za rok'], [c.zone || '—', 'mrazuvzdornost (orientačně)'], [ctx.sizeLabel, 'upravovaná plocha'], [ctx.sun || '—', 'slunce (vaše zadání)'], [ctx.soilLabel, 'půda']];
    out.push('<section class="mvg2-page">' + head(ctx, 2) + title('ROZBOR STANOVIŠTĚ', 'Z čeho návrh vychází')
      + (ctx.sketch ? '<div class="mvg2-fig2"><figure class="mvg2-fig"><img class="mvg2-page__photo mvg2-page__photo--short" src="' + esc(ctx.marked || ctx.before) + '" alt="Co zůstává"><figcaption><strong>Zeleně</strong> co zůstává beze změny.</figcaption></figure>'
        + '<figure class="mvg2-fig"><img class="mvg2-page__photo mvg2-page__photo--short" src="' + esc(ctx.sketch) + '" alt="Váš náčrt"><figcaption><strong>Váš náčrt</strong> – podle něj je rozmístěn návrh.</figcaption></figure></div>'
      : ctx.marked || ctx.before ? '<figure class="mvg2-fig"><img class="mvg2-page__photo mvg2-page__photo--short" src="' + esc(ctx.marked || ctx.before) + '" alt="Původní stav s vyznačením"><figcaption>' + (ctx.marked ? '<strong>Zeleně</strong> je vyznačeno, co zůstává beze změny (vaše označení). Zbytek smí návrh upravit.' : 'Původní stav – vaše fotka.') + '</figcaption></figure>' : '')
      + '<div class="mvg2-cards3">' + cards.map(function (x) { return '<div><strong>' + esc(x[0]) + '</strong><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>'
      + '<div class="mvg2-orient">' + compassSvg(ctx.orient) + '<div class="mvg2-notes">'
      + '<div><strong>Slunce a stín</strong><span>' + sunNotes(ctx).map(esc).join(' ') + '</span></div>'
      + '<div><strong>Půda</strong><span>' + (ctx.soil === 'unknown' ? 'Zadali jste „nevím“ – počítáme s běžnou hlinitou půdou. Rychlý test: vlhká hrst zeminy se drolí = písčitá, dá se vyválet ve váleček = jílovitá.' : 'Podle vašeho zadání: ' + esc(ctx.soilLabel) + '.') + '</span></div>'
      + '<div><strong>Kdo bude zahradu užívat</strong><span>' + esc(ctx.usersLabel) + '</span></div>'
      + '</div></div><p class="mvg2-page__src">Klima: Open-Meteo (nadmořská výška), NASA POWER (srážky, dlouhodobý průměr). Mrazová zóna odhadnutá podle nadmořské výšky. Rozměry odhadnuté z fotky – před výsadbou ověřte pásmem.</p></section>');

    // 3 – koncept, před a po
    out.push('<section class="mvg2-page">' + head(ctx, 3) + title('KONCEPT', f.title || 'Koncept zahrady')
      + '<p class="mvg2-lead">' + esc(f.concept || '') + '</p>'
      + (ctx.before ? '<figure class="mvg2-fig"><img src="' + esc(ctx.before) + '" alt="Před"><figcaption><strong>PŘED</strong> · vaše fotka</figcaption></figure>' : '')
      + (ctx.after ? '<figure class="mvg2-fig"><img src="' + esc(ctx.after) + '" alt="Po"><figcaption><strong>PO</strong> · vizualizace návrhu na vaší fotce</figcaption></figure>' : '')
      + '<div class="mvg2-cards3 mvg2-ideas">' + (f.ideas || []).slice(0, 3).map(function (i, k) { return '<div><em>0' + (k + 1) + '</em><strong>' + esc(i.title) + '</strong><span>' + esc(i.text) + '</span></div>'; }).join('') + '</div></section>');

    // 4 – osazovací plán (na šířku)
    out.push('<section class="mvg2-page mvg2-page--land">' + head(ctx, 4) + '<div class="mvg2-land__sheet">' + ctx.sheetHtml + '</div></section>');

    // 5 – rozměry a spon
    var area = window.MVGreenPlanV2 ? window.MVGreenPlanV2.polyArea : function () { return 0; };
    out.push('<section class="mvg2-page">' + head(ctx, 5) + title('ROZMĚRY A SPON', 'Podle čeho vytyčit a sázet')
      + (ctx.project ? dimsDrawing(ctx.project) : '')
      + '<table class="mvg2-table"><thead><tr><th>Plocha</th><th>Výměra</th></tr></thead><tbody>'
      + (ctx.project ? ctx.project.beds.map(function (b, i) { return '<tr><td>' + bedName(ctx.project.beds, i) + '</td><td>' + area(b.poly).toFixed(1).replace('.', ',') + ' m²</td></tr>'; }).join('') : '')
      + '<tr><td>Trávník</td><td>' + Math.round(ctx.lawnArea || 0) + ' m²</td></tr></tbody></table>'
      + '<table class="mvg2-table"><thead><tr><th>Rostlina</th><th>Spon</th><th>Velikost v dospělosti</th></tr></thead><tbody>'
      + plants.map(function (p) { return '<tr><td><strong>' + esc(p.name) + '</strong></td><td>' + (p.spacing ? p.spacing + ' cm' : '—') + '</td><td>' + (p.height_cm ? p.height_cm + ' × ' + p.width_cm + ' cm' : '—') + '</td></tr>'; }).join('') + '</tbody></table>'
      + '<div class="mvg2-tip"><strong>Jak vytyčit:</strong> od hrany dlažby nebo domu naměřte rozměry pásmem, okraje záhonů a cest vyznačte provázkem mezi kolíky a obtáhněte pískem. Rozměry jsou odhadnuté z fotky – když se skutečnost liší, upravte šířky záhonů, spon rostlin zachovejte.</div></section>');

    // 6 – karty rostlin
    out.push('<section class="mvg2-page">' + head(ctx, 6) + title(plants.length + ' DRUHŮ · ' + nPlants + ' KUSŮ', 'Karty rostlin')
      + '<div class="mvg2-plantcards">' + plants.map(function (p) {
        return '<div class="mvg2-plantcard"><div class="mvg2-plantcard__img">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : 'fotka se doplní') + '</div><div class="mvg2-plantcard__body">'
          + '<div class="mvg2-plantcard__name"><strong>' + esc(p.name) + '</strong><em>' + p.count + ' ks</em></div><i>' + esc(p.latin) + '</i>'
          + '<span><b>Dospělá:</b> ' + (p.height_cm ? p.height_cm + ' × ' + p.width_cm + ' cm' : '—') + ' · <b>Kvete:</b> ' + (p.bloom_from ? MONTHS[p.bloom_from - 1] + '–' + MONTHS[p.bloom_to - 1] : '—') + '</span>'
          + '<span><b>Stanoviště:</b> ' + esc(p.sun || '—') + ' · <b>Voda:</b> ' + esc(p.water || '—') + '</span>'
          + '<span><b>Řez:</b> ' + esc(p.pruning || '—') + '</span>'
          + '<span class="mvg2-safe mvg2-safe--' + (p.toxic === 'ano' ? 'warn' : 'check') + '">' + (p.toxic === 'ano' ? 'Jedovatá pro psy a kočky (ASPCA).' : p.toxic === 'ne' ? 'Podle ASPCA není jedovatá pro psy a kočky – ověřte.' : 'Bezpečnost pro zvířata: ověřit.') + '</span>'
          + '</div></div>';
      }).join('') + '</div><p class="mvg2-page__src">Údaje o rostlinách jsou orientační (AI odhad podle běžných pěstitelských údajů) – před nákupem je ověřte na štítku.</p></section>');

    // 7 – kalendář kvetení a zálivka
    out.push('<section class="mvg2-page">' + head(ctx, 7) + title('KALENDÁŘ KVETENÍ', 'Co bude kdy hezké')
      + '<div class="mvg2-bloom"><span></span>' + MONTHS.map(function (m) { return '<b>' + m + '</b>'; }).join('')
      + plants.map(function (p) { var row = '<span>' + esc(p.name) + '</span>'; for (var m = 1; m <= 12; m++) row += '<i style="background:' + (p.bloom_from && inRange(m, p.bloom_from, p.bloom_to) ? (p.color || '#8E7CC3') : '#F1F0E9') + '"></i>'; return row; }).join('')
      + '</div>' + title('ZÁLIVKA', 'První rok rozhoduje')
      + '<table class="mvg2-table"><tbody>' + [['Den výsadby', 'Každou rostlinu vydatně zalít: trvalky 3–5 l, keře 10 l. I když prší.'], ['První 2 týdny', 'Každý druhý den stejné množství – kořeny jsou zatím jen v balu.'], ['Do konce prvního léta', '1× týdně vydatně, v horku nad 28 °C 2× týdně.'], ['Nový trávník', 'Do vzejití denně krátce, pak 2× týdně 10–15 l/m².']].map(function (r) { return '<tr><td><strong>' + r[0] + '</strong></td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>'
      + '<div class="mvg2-tip"><strong>Tip:</strong> zalévejte ráno přímo ke kořenům. Prst zastrčený 5 cm do země je nejlepší vlhkoměr – když je suchý, zalijte. ' + (ctx.water === 'auto' ? 'Automatickou závlahu v prvním roce nastavte na delší a řidší zálivku.' : ctx.water === 'none' ? 'Bez zálivky vybíráme suchomilné rostliny – první léto je ale zalít musíte.' : '') + '</div></section>');

    // 8 – návod pro kutily. Martin (test 4): „za 2–3 víkendy to píšeš u všeho, to je nereálné“ →
    // doba se počítá z výměr projektu (orientační normohodiny pro šikovného laika, 2 lidé) a stavební
    // část (dlažba, zeď, schody) má vlastní kroky a doporučení.
    var wp = workPlan(ctx), hard = wp.hard;
    var steps = [['Vytyčení', 'Podle strany 5 vyznačte vše provázkem, kolíky a sprejem.']];
    if (wp.paving) steps.push(['Výkop pro dlažbu', 'Vykopejte 30–35 cm, srovnejte dno do spádu 1–2 % od domu, položte geotextilii.'], ['Podklad dlažby', '20–25 cm štěrkodrti 0/32 po vrstvách 10 cm hutněte vibrační deskou, pak 3–4 cm drti 4/8 jako lože.']);
    if (wp.wall) steps.push(['Opěrná zeď', 'Betonový základ do nezámrzné hloubky (~80 cm), tvárnice podle návodu výrobce, za zeď drenážní trubku a štěrk. Zeď nad 1 m jen podle statika.']);
    if (wp.steps) steps.push(['Schody', 'Stupeň 15–17 cm vysoký a 30–35 cm hluboký, na betonovém základu spolu se zdí.']);
    if (wp.paving) steps.push(['Obrubníky a dlažba', 'Obrubníky do betonového lože, dlažbu kladte ve vazbě, zapískujte a zavibrujte přes gumovou podložku.']);
    steps.push(['Úklid a příprava půdy', 'Odstraňte drn a plevel s kořeny, prorýčujte 20–25 cm a zapracujte 3–5 cm kompostu.'], ['Obruba a výsadba', 'Obrubu 1 cm nad trávník. Jamka 2× širší než bal, bal namočte, po zasazení zalijte.'], ['Mulč nebo štěrk', '5 cm vrstva, kolem rostlin 5 cm volno.'], ['Trávník', 'Urovnejte, uválcujte, vysejte 30–35 g/m² a udržujte vlhko.']);
    var subtitle = wp.weekends <= 1 ? 'Zvládnete to sami za víkend' : wp.weekends <= 4 && !hard ? 'Zvládnete to sami za ' + wp.weekends + ' víkendy' : 'Odhad práce: asi ' + wp.weekends + ' víkendů pro 2 lidi';
    out.push('<section class="mvg2-page">' + head(ctx, 8) + title('NÁVOD KROK ZA KROKEM', subtitle)
      + '<table class="mvg2-table mvg2-table--work"><thead><tr><th>Práce</th><th>Rozsah</th><th>Odhad</th></tr></thead><tbody>' + wp.rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + ' h</td></tr>'; }).join('')
      + '<tr class="mvg2-total"><td>Celkem</td><td>2 lidé, víkend ≈ 28 h práce</td><td>' + wp.hours + ' h</td></tr></tbody></table>'
      + (hard ? '<div class="mvg2-tip mvg2-tip--warn"><strong>Stavební část</strong> (' + [wp.paving && 'dlažba', wp.wall && 'opěrná zeď', wp.steps && 'schody'].filter(Boolean).join(', ') + ') je nejtěžší a zabere většinu času. Vyplatí se půjčit minibagr a vibrační desku, nebo ji svěřit stavební firmě – záhony a trávník pak zvládnete sami za ' + wp.gardenWeekends + ' ' + (wp.gardenWeekends === 1 ? 'víkend' : 'víkendy') + '.</div>' : '')
      + '<div class="mvg2-steps">' + steps.map(function (s, i) { return '<div><em>' + (i + 1) + '</em><span><strong>' + s[0] + '</strong>' + s[1] + '</span></div>'; }).join('') + '</div>'
      + '<div class="mvg2-layers"><span class="mvg2-cap">ŘEZ ZÁHONEM</span>' + [['1', 'Mulč nebo štěrk', '5 cm'], ['2', 'Geotextilie', ''], ['3', 'Zemina s kompostem', '25 cm'], ['4', 'Původní podloží', '']].map(function (l) { return '<div class="mvg2-layer mvg2-layer--' + l[0] + '"><em>' + l[0] + '</em><span>' + l[1] + '</span><b>' + l[2] + '</b></div>'; }).join('') + '</div>'
      + '<div class="mvg2-tip mvg2-tip--warn"><strong>Pozor:</strong> než začnete kopat, přečtěte si stranu 11 – podzemní sítě a vzdálenosti od hranice pozemku.</div></section>');

    // 9 – rozpočet, nákup, náhrady
    out.push('<section class="mvg2-page">' + head(ctx, 9) + title('ROZPOČET A NÁKUPNÍ SEZNAM', 'Vytiskněte a vezměte do zahradnictví')
      + '<table class="mvg2-table mvg2-table--shop"><tbody>' + plants.map(function (p) { return '<tr><td><i class="mvg2-box"></i></td><td>' + esc(p.name) + (p.container ? ', ' + esc(p.container) : '') + '</td><td>' + p.count + ' ks</td><td>' + (p.price ? kc(p.count * p.price) : '—') + '</td></tr>'; }).join('')
      + '<tr class="mvg2-total"><td></td><td>Rostliny celkem</td><td>' + nPlants + ' ks</td><td>' + kc(total) + '</td></tr></tbody></table>'
      + '<p class="mvg2-page__src">Orientační ceny ±20 % (AI odhad běžných cen v českých zahradnictvích). Materiál (mulč, obruba, geotextilie) se dopočítá podle výměry ze strany 5.</p>'
      + title('NÁHRADNÍ ROSTLINY', 'Když něco nemají')
      + '<table class="mvg2-table"><thead><tr><th>V návrhu</th><th>Náhrada</th><th>Proč</th></tr></thead><tbody>' + plants.map(function (p) { return '<tr><td><strong>' + esc(p.name) + '</strong></td><td>' + esc(p.alternative || '—') + '</td><td>' + esc(p.alternative_reason || '') + '</td></tr>'; }).join('') + '</tbody></table></section>');

    // 10 – péče a hnojení trávníku
    var lawn = Math.round(ctx.lawnArea || 0), dose = Math.round(lawn * 25 / 100) / 10;
    var care = ['Klid. Nešlapat po zmrzlém trávníku.', 'Plán nákupu hnojiv.', 'Řez keřů a trav podle karet rostlin, vertikutace.', '1. hnojení trávníku, vyčesat suché listy.', 'Odplevelit záhony, první seče výš (5 cm).', '2. hnojení trávníku, zálivka v suchu.', 'Střih odkvetlých trvalek, letní hnojení.', 'Zálivka v horku, nesekat nízko.', '3. hnojení, dosev holých míst.', 'Draselné hnojení před zimou, dosadba.', 'Shrabat listí, poslední seč.', 'Klid.'];
    out.push('<section class="mvg2-page">' + head(ctx, 10) + title('PÉČE PO CELÝ ROK', 'Co dělat měsíc po měsíci')
      + '<div class="mvg2-months">' + MONTH_NAMES.map(function (m, i) { return '<div><strong>' + m + '</strong><span>' + care[i] + '</span></div>'; }).join('') + '</div>'
      + title('HNOJENÍ TRÁVNÍKU · UKÁZKA', 'Váš trávník má podle plánu zhruba ' + lawn + ' m²')
      + '<table class="mvg2-table"><thead><tr><th>Termín</th><th>Hnojivo</th><th>Dávka</th><th>Na ' + lawn + ' m²</th></tr></thead><tbody>'
      + [['Duben', 'Rychlé dusíkaté se sírou (NPK ≈ 27-6-6 + S)'], ['Červen', 'Vyvážené s hořčíkem a železem (NPK ≈ 12-4-9)'], ['Září', 'Rychlé dusíkaté se sírou (NPK ≈ 27-6-6 + S)'], ['Říjen', 'Draselné „zimní“ (NPK ≈ 12-0-42)']].map(function (r) { return '<tr><td><strong>' + r[0] + '</strong></td><td>' + r[1] + '</td><td>25 g/m²</td><td>' + String(dose).replace('.', ',') + ' kg</td></tr>'; }).join('') + '</tbody></table>'
      + '<div class="mvg2-promo"><strong>Trávník je naše parketa</strong><span>Plný roční plán péče a hnojení na míru za 49 Kč – termíny podle vaší nadmořské výšky, řešení mechu a plevele. Kolem Domažlic trávník i založíme a postaráme se o něj. mvgreen.cz · 723 339 650</span></div></section>');

    // 11 – dobré vědět, zdroje
    out.push('<section class="mvg2-page">' + head(ctx, 11) + title('DOBRÉ VĚDĚT PŘED KOPÁNÍM', 'Ať nepřekvapí soused ani úřad')
      + '<div class="mvg2-notes">'
      + '<div><strong>Podzemní sítě</strong><span>Než budete kopat hlouběji než 30 cm, zjistěte, kudy vedou voda, plyn, elektřina a internet – přípojky najdete v dokumentaci domu, u sítí v ulici si vyžádejte vyjádření od správců (zpravidla online).</span></div>'
      + '<div><strong>Vzdálenost od hranice pozemku</strong><span>Podle § 1017 občanského zákoníku se stromy, které obvykle dorůstají nad 3 m, sázejí nejméně 3 m od společné hranice, ostatní stromy 1,5 m (měří se od kmene).</span></div>'
      + '<div><strong>Děti a zvířata</strong><span>' + (safeList.length ? 'Podle databáze ASPCA jsou pro psy a kočky jedovaté: ' + esc(safeList.join(', ')) + '. ' : '') + 'U ostatních rostlin údaj ověřte, než je vysadíte tam, kde si hrají děti nebo pes.</span></div>'
      + '</div><div class="mvg2-sources"><span class="mvg2-cap">ZDROJE</span><span>Jedovatost: ASPCA Animal Poison Control (aspca.org). Hranice pozemku: zákon č. 89/2012 Sb., § 1017. Klima: NASA POWER, Open-Meteo. Údaje o rostlinách a ceny: orientační AI odhad. Vizualizace: AI úprava vaší fotky – rostliny na ní jsou ilustrační.</span>'
      + plants.filter(function (p) { return p.credit; }).map(function (p) { return '<span>Foto ' + esc(p.name) + ': ' + esc(p.credit) + '.</span>'; }).join('') + '</div>'
      + '<p class="mvg2-page__src">Projekt je orientační studie vytvořená s pomocí AI na základě vaší fotky a zadání. Před realizací ověřte rozměry na místě.</p>'
      + '<div class="mvg2-cover__foot"><span>' + (ctx.logo ? '<img src="' + esc(ctx.logo) + '" alt="">' : '') + 'MV GREEN – Péče o zeleň bez starostí</span><span>mvgreen.cz · 723 339 650</span></div></section>');
    return out.join('');
  }

  window.MVGreenPdfV2 = { pages: pages };
})();
