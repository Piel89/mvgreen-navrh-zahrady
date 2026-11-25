/*
 * Výstup ročního plánu po zaplacení (2026-11-20, Martin: „hezký, přehledný, hravý, interaktivní, originální“; schválený prototyp „Trávníkový rok“).
 * Jen vykreslení: všechna čísla přicházejí z brain.js (decide) a z odpovědí zákazníka. Žádné načítání z cizích serverů.
 * Použití (plan-page.js): MVGreenPlanOutput.html(ctx) vrátí kostru, MVGreenPlanOutput.mount(ctx) ji naplní a zapojí ovládání.
 * ctx = { r, rows, climate, prof, area, kg:function }
 */
(function () {
  'use strict';
  var MON = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
  var MONF = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  var KNAME = { K: 'Draslíkové', N: 'Rychlé dusíkaté', C: 'Celoroční vyvážené', D: 'Dusíkaté bez P a K' };
  var KLOOK = { K: 'draslíkové', N: 'rychlé dusíkaté', C: 'vyvážené', D: 'dusíkaté bez P a K' };
  var S = { month: new Date().getMonth(), heat: false, tbl: false, mow: null, done: {} };
  try { var sv = JSON.parse(localStorage.getItem('mvgSeasonDone') || '{}'); if (sv && typeof sv === 'object') S.done = sv; } catch (e) {}
  var X = null; // poslední kontext

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n, d) { d = d == null ? 1 : d; return Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: d }); }
  function $(id) { return document.getElementById(id); }
  function dm(d) { return Math.floor(d.half / 2); }
  function kgOf(d) { return d.totalKg != null ? d.totalKg : d.doseG * X.area / 1000; }
  function nOf(d) { return Number(d.nGPerM2) || 0; }
  function doy(n) { var d = new Date(2025, 0, 1 + Math.round(n)); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; }

  function html(ctx) {
    return '<div class="pv" id="pvRoot">' +
      '<div class="pv-top"><div class="pv-hero"><span class="eyebrow">Váš plán · zaplaceno</span><h2>Váš trávníkový rok</h2><p class="lead" id="pvLead"></p></div><div class="pv-pass" id="pvPass"></div></div>' +
      '<div class="pv-score" id="pvScore"></div>' +
      '<div class="pv-card pv-intro"><div class="pv-ih"><span class="eyebrow">Úvod do vašeho plánu</span><h3>Nemusíte číst všechno. Začněte čtyřmi kroky.</h3><p class="muted" id="pvIntroP"></p></div>' +
      '<ol class="pv-steps" id="pvSteps"></ol>' +
      '<div class="pv-rules"><b>Vždy platí</b><span>Hnojte jen na suchou trávu.</span><span>Po hnojení vždy zalijte (déšť nebo hadice, bez vody hrozí spálení).</span><span>Nesekejte najednou víc než třetinu stébla.</span></div>' +
      '<nav class="pv-jump" aria-label="Obsah plánu"><a href="#pv-rok">Rok na pruhu</a><a href="#pv-n">Hnojení v číslech</a><a href="#pv-shop">Nákup</a><a href="#pv-w">Voda</a><a href="#pv-m">Sečení</a><a href="#pv-s">Moje sezóna</a><a href="#p-drn">Návody</a><a href="#p-problemy">Problémy</a></nav></div>' +
      '<div class="pv-now" id="pvNow" aria-live="polite"></div>' +
      '<div class="pv-card" id="pv-rok"><div><span class="eyebrow">Rok na jednom pruhu</span><h3>Co kdy dělat</h3><p class="muted pv-small">Klikněte na měsíc, ukáže se, co v něm vás čeká.</p></div>' +
      '<div class="pv-ribbon" id="pvRibbon"></div><div class="pv-clim" id="pvClim" aria-hidden="true"></div><div class="pv-legend" id="pvLegend"></div><div class="pv-detail" id="pvDetail"></div></div>' +
      '<div class="pv-card" id="pv-n"><div class="pv-hd"><div><span class="eyebrow">Hnojení v číslech</span><h3>Kolik dusíku dostane trávník</h3><p class="muted pv-small" id="pvNSub"></p></div><button class="pv-link" type="button" id="pvTblBtn" aria-pressed="false">Zobrazit tabulku</button></div>' +
      '<svg id="pvChart" role="img" aria-label="Sloupcový graf: dusík na jednu dávku po měsících"></svg><div class="pv-tablewrap" id="pvTable" hidden></div></div>' +
      '<div class="pv-card" id="pv-shop"><div><span class="eyebrow">Nákup</span><h3>Co koupit na celý rok</h3><p class="muted pv-small">Značku a obchod si vyberete sami, rozhoduje složení na obalu.</p></div><div id="pvShop" class="pv-shop"></div></div>' +
      '<div class="pv-card" id="pv-w"><div class="pv-hd"><div><span class="eyebrow">Voda</span><h3>Kolik zalévat</h3></div><button class="pv-tog" type="button" id="pvHeat" aria-pressed="false"><i></i>Tropické vedro</button></div>' +
      '<div class="pv-water"><div><div class="pv-tank" id="pvTank"></div><p class="muted pv-small">Pruh ukazuje týdenní množství vody v litrech na m² (včetně deště). Šrafovaná oblast je rozpětí, které uvádějí zdroje.</p></div><div class="pv-facts" id="pvWFacts"></div></div></div>' +
      '<div class="pv-card" id="pv-m"><div><span class="eyebrow">Sečení</span><h3>Kdy sekat a kolik ukrojit</h3></div>' +
      '<div class="pv-mow"><div><label for="pvMowH" class="pv-lab">Výška, na kterou chcete trávník mít</label><div class="pv-range"><input id="pvMowH" type="range" min="1.5" max="8" step="0.1"><span class="pv-val" id="pvMowVal"></span></div><div class="pv-facts" id="pvMowFacts" style="margin-top:12px"></div></div><svg id="pvBlades" viewBox="0 0 320 260" role="img" aria-label="Schéma stébla a výšky sečení"></svg></div></div>' +
      '<div class="pv-card" id="pv-s"><div><span class="eyebrow">Moje sezóna</span><h3>Odškrtávejte, co už je hotové</h3></div><div class="pv-season"><div class="pv-ring" id="pvRing"></div><div><div class="pv-tasks" id="pvTasks"></div><p class="pv-win" id="pvWin"></p></div></div></div>' +
      '<div class="pv-tip" id="pvTip" role="status"></div></div>';
  }

  function drawTop() {
    var p = X.prof, r = X.r, rows = X.rows;
    var kg = rows.reduce(function (t, d) { return t + kgOf(d); }, 0);
    var nYear = rows.reduce(function (t, d) { return t + nOf(d); }, 0);
    $('pvLead').textContent = 'Plán sestavený z vašich odpovědí: ' + String(r.tierLabel).toLowerCase() + ' na ' + fmt(X.area, 0) + ' m²' + (p.place ? ' v obci ' + p.place : '') + '. Všechna čísla níže platí pro vaši zahradu.';
    var val = function (x) { return x ? esc(x) : '<span class="muted">neuvedeno</span>'; };
    $('pvPass').innerHTML = '<div class="pv-band"></div><span class="pv-stamp">PLÁN NA MÍRU</span><div class="pv-pb">' +
      '<div><span class="eyebrow">Pas vašeho trávníku</span><div class="pv-place">' + (p.place ? esc(p.place) : 'Váš trávník') + '</div><div class="pv-sub">' + (p.alt ? fmt(p.alt, 0) + ' m n. m.' : '') + (p.alt && X.climate ? ' · ' : '') + (X.climate ? 'podnebí z průměru ' + esc(X.climate.years || 5) + ' let' : '') + '</div></div>' +
      '<dl class="pv-grid"><div><dt>Plocha</dt><dd class="pv-area">' + fmt(X.area, 0) + ' m²</dd></div><div><dt>Péče</dt><dd>' + esc(r.tierLabel) + '</dd></div>' +
      '<div><dt>Půda</dt><dd>' + val(p.soil) + '</dd></div><div><dt>Slunce</dt><dd>' + val(p.sun) + '</dd></div>' +
      '<div><dt>Zálivka</dt><dd>' + val(p.irr) + '</dd></div><div><dt>Sečení</dt><dd>' + val(p.mow) + '</dd></div>' +
      '<div><dt>Travní směs</dt><dd>' + val(p.grass) + '</dd></div><div><dt>Co trávník trápí</dt><dd>' + (p.probs.length ? '<span class="pv-chips">' + p.probs.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</span>' : 'nic zvláštního') + '</dd></div></dl></div>';
    $('pvScore').innerHTML = '<div><b>' + rows.length + '×</b><span>hnojení za rok</span></div><div><b>' + fmt(kg, 1) + ' kg</b><span>hnojiva na vašich ' + fmt(X.area, 0) + ' m²</span></div><div><b>' + fmt(nYear, 0) + ' g</b><span>dusíku na m² za rok</span></div>';
    var m = new Date().getMonth(), nx = rows.filter(function (d) { return dm(d) >= m; })[0] || rows[0];
    var types = {}; rows.forEach(function (d) { types[d.key || 'C'] = 1; });
    var lw = S.heat ? 30 : 20, m3 = lw * X.area / 1000;
    $('pvIntroP').textContent = 'Tento plán je sestavený jen pro vaši zahradu' + (p.place ? ' v obci ' + p.place : '') + ' (' + fmt(X.area, 0) + ' m², ' + String(r.tierLabel).toLowerCase() + '). Odpovědi, ze kterých vychází, vidíte v pasu trávníku. Nemusíte nic počítat, všechna čísla jsou přepočítaná na vaši plochu.';
    var it = [
      ['Zjistěte, co je na řadě', 'Karta Tento týden vám řekne, co dělat právě teď. Nejbližší hnojení: <b>' + MONF[dm(nx)] + '</b>, ' + esc(KLOOK[nx.key || 'C']) + ', ' + fmt(nx.doseG, 0) + ' g/m².'],
      ['Nakupte hnojivo', 'Na celý rok asi <b>' + fmt(kg, 1) + ' kg</b> ' + (Object.keys(types).length === 1 ? 'v 1 typu' : 've ' + Object.keys(types).length + ' typech') + '. Značku si vyberete sami, rozhoduje složení na obalu.'],
      ['Nastavte zálivku', 'Zhruba <b>' + lw + ' l/m² týdně</b> ve dvou zálivkách brzy ráno. Na vašich ' + fmt(X.area, 0) + ' m² je to asi ' + fmt(m3, 1) + ' m³ vody.'],
      ['Odškrtávejte', 'Dole je seznam úkolů pro vaši sezónu. Hotové odškrtnete a kroužek ukáže, kolik už máte za sebou.']];
    $('pvSteps').innerHTML = it.map(function (x) { return '<li><b>' + x[0] + '</b><span>' + x[1] + '</span></li>'; }).join('');
  }

  function drawNow() {
    var now = new Date(), m = now.getMonth(), items = [];
    X.rows.filter(function (d) { return dm(d) === m; }).forEach(function (d) {
      items.push('<b>Hnojení:</b> ' + esc(KNAME[d.key || 'C']) + ', ' + fmt(d.doseG, 0) + ' g/m² (' + fmt(kgOf(d), 1) + ' kg na vaši plochu). Jen na suchou trávu, potom zalít.');
    });
    ((X.r.months[m] && X.r.months[m].items) || []).filter(function (i) { return i.type !== 'fert'; }).slice(0, 3).forEach(function (i) {
      items.push('<b>' + esc(i.title) + '</b>' + (i.detail ? ': ' + esc(i.detail) : ''));
    });
    if (!items.length) items.push('Klidový měsíc. Trávník nesekat, nehnojit a nechodit po zmrzlém.');
    $('pvNow').innerHTML = '<div class="pv-date"><small>' + MON[m] + '</small><b>' + now.getDate() + '</b></div><div><span class="eyebrow">Tento týden</span><h3>Co s trávníkem právě teď</h3><ul>' + items.map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('') + '</ul></div>';
  }

  function drawRibbon() {
    var rows = X.rows, h = '';
    for (var m = 0; m < 12; m++) {
      var ds = rows.filter(function (d) { return dm(d) === m; });
      var pegs = ds.map(function (d) { var k = d.key || 'C'; return '<span class="pv-peg ' + k + '" title="' + esc(KNAME[k]) + '"><span>' + k + '</span></span>'; }).join('');
      var cares = ((X.r.months[m] && X.r.months[m].items) || []).filter(function (i) { return i.type === 'care'; }).map(function (i) { return i.title.replace(/ \(.*\)/, ''); }).slice(0, 2).join(' · ');
      h += '<button class="pv-mon" type="button" data-m="' + m + '" aria-pressed="' + (m === S.month) + '" aria-label="' + MONF[m] + ': ' + ds.length + ' hnojení"><span class="pv-mn">' + MON[m] + '</span><span class="pv-pegs">' + pegs + '</span><span class="pv-cares">' + esc(cares) + '</span></button>';
    }
    var t = new Date(), pos = ((t.getMonth() + (t.getDate() - 1) / 31) / 12) * 100;
    var rb = $('pvRibbon'); rb.innerHTML = h + '<span class="pv-today" style="left:' + pos + '%"></span>';
    Array.prototype.forEach.call(rb.querySelectorAll('.pv-mon'), function (b) { b.onclick = function () { S.month = +b.getAttribute('data-m'); drawRibbon(); drawDetail(); }; });
    var c = X.climate, cl = $('pvClim');
    if (c && c.soil10 && c.soilBelow10) {
      var pct = function (n) { return n / 365 * 100; };
      cl.style.display = '';
      cl.innerHTML = '<div class="pv-track"></div><div class="pv-grow" style="left:' + pct(c.soil10) + '%;width:' + pct(c.soilBelow10 - c.soil10) + '%"></div><div class="pv-tick" style="left:' + pct(c.soil10) + '%"></div><div class="pv-tick" style="left:' + pct(c.soilBelow10) + '%"></div>' +
        '<span class="pv-cl" style="left:' + pct(c.soil10) + '%">půda 10 °C ≈ ' + doy(c.soil10) + '</span><span class="pv-cl" style="left:' + pct(c.soilBelow10) + '%">pod 10 °C ≈ ' + doy(c.soilBelow10) + '</span>';
      $('pvLegend').innerHTML = legend() + '<span class="muted">Zelený proužek pod pruhem: půda alespoň 10 °C (průměr 5 let, ERA5)</span>';
    } else { cl.style.display = 'none'; $('pvLegend').innerHTML = legend(); }
  }
  function legend() {
    var seen = {}; X.rows.forEach(function (d) { seen[d.key || 'C'] = 1; });
    return ['K', 'N', 'C', 'D'].filter(function (k) { return seen[k]; }).map(function (k) { return '<span><i class="pv-lg ' + k + '"></i>' + k + ' ' + esc(KLOOK[k]) + '</span>'; }).join('');
  }

  function drawDetail() {
    var m = S.month, ds = X.rows.filter(function (d) { return dm(d) === m; });
    var h = '<div class="pv-dh"><h4>' + MONF[m].charAt(0).toUpperCase() + MONF[m].slice(1) + '</h4><span class="muted pv-small">' + (ds.length ? ds.length + ' hnojení' : 'bez hnojení') + ' · klikněte na jiný měsíc v pruhu</span></div>';
    ds.forEach(function (d) {
      var k = d.key || 'C';
      h += '<div class="pv-item"><div class="pv-badge ' + k + '"><span>' + k + '</span></div><div class="pv-body"><b>' + (d.half % 2 ? 'Konec' : 'Začátek') + ' měsíce: ' + esc(KNAME[k]) + '</b>' +
        '<span>' + fmt(d.doseG, 0) + ' g/m² · ' + fmt(kgOf(d), 1) + ' kg na vašich ' + fmt(X.area, 0) + ' m² · ' + fmt(nOf(d), 1) + ' g dusíku na m²</span>' +
        '<span class="pv-note">' + esc(d.look) + '</span>' + (d.note ? '<span class="pv-note w">' + esc(d.note) + '</span>' : '') + (d.warn ? '<span class="pv-note w">⚠ ' + esc(d.warn) + '</span>' : '') + (d.condition ? '<span class="pv-note w">' + esc(d.condition) + '</span>' : '') + '</div></div>';
    });
    ((X.r.months[m] && X.r.months[m].items) || []).filter(function (i) { return i.type !== 'fert'; }).forEach(function (i) {
      h += '<div class="pv-item"><div class="pv-badge ' + i.type + '"><span>' + (i.type === 'care' ? '⚒' : 'i') + '</span></div><div class="pv-body"><b>' + esc(i.title) + '</b>' + (i.detail ? '<span>' + esc(i.detail) + '</span>' : '') + (i.proc ? '<a class="pv-howto" href="#n-' + esc(i.proc) + '">Jak na to krok za krokem →</a>' : '') + '</div></div>';
    });
    if (!ds.length && !((X.r.months[m] && X.r.months[m].items) || []).filter(function (i) { return i.type !== 'fert'; }).length) h += '<p class="muted">V tomto měsíci trávník odpočívá.</p>';
    $('pvDetail').innerHTML = h;
  }

  function drawChart() {
    var rows = X.rows, host = $('pvChart');
    var W = Math.max(300, (host.parentElement.clientWidth || 620) - 36), H = 300, L = 34, Rr = 10, T = 26, B = 34;
    var mx = 6; rows.forEach(function (d) { if (nOf(d) > mx) mx = Math.ceil(nOf(d)); });
    var step = (W - L - Rr) / 12, bw = Math.min(30, step * 0.72), narrow = W < 520;
    host.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var y = function (v) { return T + (H - T - B) * (1 - v / mx); }, s = '';
    for (var t = 0; t <= mx; t += 2) s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(t) + '" y2="' + y(t) + '" class="pv-grid-l"/><text x="' + (L - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + '</text>';
    s += '<text x="' + L + '" y="12">' + (narrow ? 'g N na m²' : 'g dusíku na m² a dávku') + '</text>';
    for (var m = 0; m < 12; m++) {
      var cx = L + step * m + step / 2;
      s += '<text x="' + cx + '" y="' + (H - 12) + '" text-anchor="middle">' + (narrow ? MON[m].charAt(0) : MON[m]) + '</text>';
      rows.filter(function (d) { return dm(d) === m; }).forEach(function (d) {
        var k = d.key || 'C', top = y(nOf(d)), bh = y(0) - top, x = cx - bw / 2;
        s += '<g class="pv-bar" data-m="' + m + '" tabindex="0" role="img" aria-label="' + MONF[m] + ', ' + esc(KNAME[k]) + ', ' + fmt(nOf(d), 1) + ' g dusíku na m²">' +
          '<rect x="' + x + '" y="' + top + '" width="' + bw + '" height="' + bh + '" rx="4" fill="var(--' + k + ')"/><rect x="' + x + '" y="' + (y(0) - 4) + '" width="' + bw + '" height="4" fill="var(--' + k + ')"/>' +
          '<rect x="' + (x - 6) + '" y="' + T + '" width="' + (bw + 12) + '" height="' + (H - T - B) + '" fill="transparent"/>' +
          '<text class="pv-vlab" x="' + cx + '" y="' + (top - 6) + '" text-anchor="middle">' + fmt(nOf(d), 1) + '</text><text class="pv-klab" x="' + cx + '" y="' + (y(0) - 9) + '" text-anchor="middle">' + k + '</text></g>';
      });
    }
    s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(4.9) + '" y2="' + y(4.9) + '" class="pv-cap"/><text x="' + (L + 6) + '" y="' + (y(4.9) - 6) + '" class="pv-captx">' + (narrow ? 'strop 4,9' : 'strop 4,9 g N na jednu dávku (univerzity)') + '</text>';
    host.innerHTML = s;
    var nYear = rows.reduce(function (t2, d) { return t2 + nOf(d); }, 0);
    $('pvNSub').textContent = X.r.tierLabel + ': ' + rows.length + ' dávek, dohromady ' + fmt(nYear, 0) + ' g dusíku na m² za rok. Najeďte na sloupec.';
    var tip = $('pvTip');
    Array.prototype.forEach.call(host.querySelectorAll('.pv-bar'), function (g) {
      var m2 = +g.getAttribute('data-m'), d = rows.filter(function (x) { return dm(x) === m2; })[0], k = d.key || 'C';
      var show = function () { var rc = g.getBoundingClientRect(); tip.style.display = 'block'; tip.innerHTML = '<b>' + MONF[m2] + '</b><br>' + esc(KNAME[k]) + '<br>' + fmt(d.doseG, 0) + ' g/m² · ' + fmt(kgOf(d), 1) + ' kg<br>' + fmt(nOf(d), 1) + ' g dusíku na m²';
        tip.style.left = Math.min(innerWidth - 250, Math.max(8, rc.left + rc.width / 2 - 100)) + 'px'; tip.style.top = Math.max(8, rc.top - tip.offsetHeight - 8) + 'px'; };
      g.onmouseenter = show; g.onfocus = show; g.onmouseleave = g.onblur = function () { tip.style.display = 'none'; };
      g.onclick = function () { S.month = m2; drawRibbon(); drawDetail(); };
    });
    var tb = '<table><thead><tr><th>Měsíc</th><th>Hnojivo</th><th class="r">g/m²</th><th class="r">kg</th><th class="r">g N/m²</th></tr></thead><tbody>';
    rows.forEach(function (d) { tb += '<tr><td>' + MONF[dm(d)] + '</td><td>' + esc(KNAME[d.key || 'C']) + '</td><td class="r">' + fmt(d.doseG, 0) + '</td><td class="r">' + fmt(kgOf(d), 1) + '</td><td class="r">' + fmt(nOf(d), 1) + '</td></tr>'; });
    $('pvTable').innerHTML = tb + '</tbody></table>';
  }

  function drawShop() {
    var by = {}, order = [];
    X.rows.forEach(function (d) { var k = d.key || 'C'; if (!by[k]) { by[k] = { kg: 0, n: 0, look: d.look }; order.push(k); } by[k].kg += kgOf(d); by[k].n++; });
    var mx = Math.max.apply(null, order.map(function (k) { return by[k].kg; }).concat([1]));
    var h = order.map(function (k) {
      return '<div><div class="pv-bagrow"><span><b>' + esc(KNAME[k]) + '</b><br><span class="muted pv-small">' + by[k].n + '× za rok</span></span><div class="pv-bagbar"><i style="width:' + (by[k].kg / mx * 100) + '%;background:var(--' + k + ')"></i></div><b class="pv-bagkg">' + fmt(by[k].kg, 1) + ' kg</b></div>' +
        '<details class="pv-what"><summary>Co hledat na obalu</summary><p>' + esc(by[k].look) + '</p></details></div>';
    }).join('');
    var B = window.MVGreenBrain, PR = B.PROC;
    ['pisek', 'dosev'].forEach(function (k) {
      if (X.r.care.program.some(function (p) { return p.proc === k; })) { var am = X.r.amount(k); if (am) h += '<div class="pv-bagrow pv-extra"><span><b>' + esc(PR[k].title) + '</b><br><span class="muted pv-small">' + esc(am) + '</span></span></div>'; }
    });
    h += '<p><button type="button" class="btn" id="icsBtn">Přidat připomínky do kalendáře v mobilu</button></p><p class="muted pv-small">Stáhne se soubor kalendáře s připomínkami hnojení i údržby trávníku. Telefon upozorní den předem v 8:00. Nic se nikam neodesílá.</p><p><button type="button" class="btn ghost" id="prtBtn">Vytisknout nebo uložit jako PDF</button></p>';
    $('pvShop').innerHTML = h;
  }

  function drawWater() {
    var l = S.heat ? 30 : 20, max = 45, pc = function (x) { return x / max * 100; };
    $('pvTank').innerHTML = '<div class="pv-scale"><div class="pv-band2" style="left:' + pc(20) + '%;width:' + pc(20) + '%"></div><div class="pv-fill" data-l="' + l + ' l/m²" style="width:' + pc(l) + '%"></div></div>' +
      [0, 10, 20, 30, 40].map(function (t) { return '<span class="pv-t" style="left:' + pc(t) + '%">' + t + '</span>'; }).join('');
    var tot = l * X.area / 1000, irr = X.prof.irrKey;
    $('pvWFacts').innerHTML = '<div class="pv-fact"><b>' + fmt(tot, 1) + ' m³</b><span>vody týdně na ' + fmt(X.area, 0) + ' m² (asi ' + fmt(tot * 1000 / (S.heat ? 3 : 2), 0) + ' l při každé zálivce)</span></div>' +
      '<div class="pv-fact"><b>' + (S.heat ? '2–3×' : '2×') + '</b><span>týdně, ' + (S.heat ? 'v extrému obden, menšími dávkami po 10–15 l/m²' : 'vždy po ~10 l/m²') + '</span></div>' +
      '<div class="pv-fact"><b>5–7 h</b><span>brzy ráno. Večer podporuje plísně.</span></div>' +
      '<div class="pv-fact"><b>10–15 cm</b><span>vlhká půda po zálivce = dost (vykopněte kousek drnu)</span></div>' +
      (irr === 'none' ? '<p class="pv-note w">Uvedli jste, že nezaléváte. Bez vody v suchu trávník žloutne a hnojení v létě vynechejte (viz dávky v kalendáři).</p>' : '');
  }

  function drawMow() {
    var h = S.mow, trig = h * 1.5, cut = h * 0.5, k = 22; $('pvMowVal').textContent = fmt(h, 1) + ' cm';
    var base = 230, top = base - trig * k, hy = base - h * k, b = '';
    for (var i = 0; i < 9; i++) { var x = 40 + i * 30, jig = (i % 3) * 4; b += '<path d="M' + x + ' ' + base + ' Q ' + (x + 6) + ' ' + (top + 10 + jig) + ' ' + (x + 2) + ' ' + (top + jig) + '" class="pv-blade"/>'; }
    $('pvBlades').innerHTML = '<rect x="0" y="' + base + '" width="320" height="30" class="pv-soil" rx="6"/>' + b +
      '<rect x="20" y="' + top + '" width="280" height="' + (hy - top) + '" class="pv-cutzone"/>' +
      '<line x1="20" x2="300" y1="' + top + '" y2="' + top + '" class="pv-trig"/><text x="24" y="' + (top - 6) + '" class="pv-t1">sekejte při ' + fmt(trig, 1) + ' cm</text>' +
      '<line x1="20" x2="300" y1="' + hy + '" y2="' + hy + '" class="pv-goal"/><text x="24" y="' + (hy + 16) + '" class="pv-t2">cílová výška ' + fmt(h, 1) + ' cm</text>' +
      '<text x="300" y="' + ((top + hy) / 2 + 4) + '" text-anchor="end" class="pv-t3">ukrojíte ' + fmt(cut, 1) + ' cm</text>';
    $('pvMowFacts').innerHTML = '<div class="pv-fact"><b>' + fmt(trig, 1) + ' cm</b><span>tak vysoká má být tráva, než sekáte</span></div><div class="pv-fact"><b>≤ ⅓</b><span>stébla najednou. Víc trávník stresuje.</span></div>' +
      '<div class="pv-fact"><b>+1–2 cm</b><span>v horku nechte trávu vyšší (u vás ' + fmt(h + 1, 0) + '–' + fmt(h + 2, 0) + ' cm)</span></div>';
  }

  function taskList() {
    var t = [], tier = X.r.tier || 'x';
    X.rows.forEach(function (d) { var k = d.key || 'C'; t.push({ id: 'd-' + tier + '-' + d.half + '-' + k, title: MONF[dm(d)].charAt(0).toUpperCase() + MONF[dm(d)].slice(1) + ': hnojení', sub: KNAME[k] + ', ' + fmt(d.doseG, 0) + ' g/m²' }); });
    var PR = window.MVGreenBrain.PROC;
    X.r.care.program.forEach(function (c) { t.push({ id: 'c-' + tier + '-' + c.proc, title: PR[c.proc].title, sub: c.freq + ', ' + c.when }); });
    return t;
  }
  function drawSeason() {
    var t = taskList(), n = t.filter(function (x) { return S.done[x.id]; }).length, pct = t.length ? n / t.length : 0, C = 2 * Math.PI * 58;
    $('pvRing').innerHTML = '<svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="58" class="pv-rb"/><circle cx="70" cy="70" r="58" class="pv-rf" stroke-dasharray="' + C + '" stroke-dashoffset="' + C * (1 - pct) + '"/></svg><div class="pv-rc"><b>' + n + '/' + t.length + '</b><span>hotovo</span></div>';
    $('pvTasks').innerHTML = t.map(function (x) { return '<button type="button" class="pv-task" data-id="' + esc(x.id) + '" aria-pressed="' + !!S.done[x.id] + '"><span class="pv-box">✓</span><span class="pv-tt"><span>' + esc(x.title) + '</span><small>' + esc(x.sub) + '</small></span></button>'; }).join('');
    Array.prototype.forEach.call($('pvTasks').querySelectorAll('.pv-task'), function (b) {
      b.onclick = function () { var id = b.getAttribute('data-id'); S.done[id] = !S.done[id]; try { localStorage.setItem('mvgSeasonDone', JSON.stringify(S.done)); } catch (e) {} drawSeason(); };
    });
    $('pvWin').textContent = t.length && n === t.length ? 'Sezóna je splněná. Trávník poděkuje na jaře.' : (n ? 'Dobrá práce, pokračujte.' : '');
  }

  var rz;
  function mount(ctx) {
    X = ctx;
    var mh = X.r.plan && X.r.plan.mowHeight && X.r.plan.mowHeight.min; if (!S.mow || ctx.resetMow) S.mow = mh || 3;
    $('pvMowH').value = S.mow;
    drawTop(); drawNow(); drawRibbon(); drawDetail(); drawChart(); drawShop(); drawWater(); drawMow(); drawSeason();
    var hb = $('pvHeat'); hb.setAttribute('aria-pressed', S.heat); hb.onclick = function () { S.heat = !S.heat; hb.setAttribute('aria-pressed', S.heat); drawWater(); drawTop(); };
    // Posuvník sečení: krok 0,1 cm a překreslení nejvýš jednou za snímek, aby na mobilu netrhal (Martin 2026-11-24: "na mobilu se to seká, není to plynulé").
    var mowRaf = 0;
    $('pvMowH').oninput = function (e) {
      S.mow = +e.target.value;
      if (mowRaf) return;
      mowRaf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(function () { mowRaf = 0; drawMow(); });
    };
    var tb = $('pvTblBtn'); var showTbl = function () { $('pvTable').hidden = !S.tbl; $('pvChart').style.display = S.tbl ? 'none' : 'block'; tb.setAttribute('aria-pressed', S.tbl); tb.textContent = S.tbl ? 'Zobrazit graf' : 'Zobrazit tabulku'; };
    tb.onclick = function () { S.tbl = !S.tbl; showTbl(); }; showTbl();
    if (!mount.rb) { mount.rb = true; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if ($('pvChart') && X) drawChart(); }, 150); }); }
  }
  window.MVGreenPlanOutput = { html: html, mount: mount };
})();
