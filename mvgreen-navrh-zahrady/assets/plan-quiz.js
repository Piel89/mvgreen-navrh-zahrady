/*
 * Dotazník s živým obrázkem trávníku (2026-11-20, Martin: „hezky se mění, intuitivní, interaktivní, to prodává“; schválený návrh).
 * Pravdivým zdrojem zůstává skrytý formulář #q v plan-page.js (stejná pole jako dřív), takže fungují uložené odpovědi,
 * platba i odkaz z e-mailu. Tento soubor jen kreslí dlaždice a obrázek a do formuláře zapisuje hodnoty.
 * Obrázek je kreslený v canvasu, nic se nenačítá z cizích serverů.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n, d) { d = d == null ? 1 : d; return Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: d }); };
  var MONF = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  var TIERS = [['low', 'Nízká údržba', 'Ať je zelený, času mám málo.', 5], ['standard', 'Běžný rodinný', 'Děti, pes, ať vypadá hezky.', 4], ['representative', 'Anglický trávník', 'Hustý, jemný, hnojení každý měsíc.', 3], ['sportovni', 'Sportovní', 'Pravidelná zátěž, rychlá obnova.', 3.5]];
  var PROBS = [['moss', 'Mech', 'prob'], ['weeds', 'Plevel', 'prob'], ['bare', 'Holá místa', 'prob'], ['thatch', 'Plsť', 'prob'], ['compaction', 'Udusaná půda', 'prob'], ['snowmold', 'Loni plíseň sněžná', 'prob'], ['poa', 'Lipnice roční', 'prob'], ['crabgrass', 'Ježatka', 'prob'], ['spots', 'Skvrny, fleky, plíseň', 'prob'], ['grubs', 'Ponravy', 'prob'], ['pale', 'Bledne', 'sym'], ['thin', 'Řídne', 'sym'], ['dog', 'Chodí na něj pes', 'dog']];
  var KEYNAME = { K: 'draslíkové', N: 'rychlé dusíkaté', C: 'vyvážené', D: 'dusíkaté bez P a K' };
  var SAY = {
    tier: { low: 'Nízká údržba: nejméně hnojení a nejméně starostí.', standard: 'Rodinný trávník: pár hnojení rozložených mezi jaro a podzim.', representative: 'Anglický trávník: hnojení zhruba každý měsíc v sezóně, největší nároky na péči.', sportovni: 'Sportovní trávník: důraz na zátěž a rychlou obnovu.' },
    sun: { full: 'Slunce celý den: plné dávky podle plánu.', partial: 'Polostín: plán to zohlední.', shade: 'Stín: dávky dusíku se půlí a trávník je náchylnější na mech.' },
    soil: { unknown: 'Nevadí, počítáme s běžnou půdou. Rozbor můžete doplnit.', normal: 'Běžná propustná půda: nejjednodušší případ.', clay: 'Těžká jílovitá půda: voda se drží u povrchu a půda se snadno utuží.', sand: 'Lehká písčitá půda: voda i živiny rychle prosakují.' },
    irr: { auto: 'Automatická závlaha: plán počítá s hnojením i v létě.', manual: 'Hadice: po každém hnojení trávník zalijte, jinak hrozí spálení.', none: 'Bez zálivky: v suchu se letní hnojení vynechává.' },
    mow: { '0.5': 'Sečení jednou za dva týdny: plán to zohlední.', '1': 'Sečení jednou týdně: plán to zohlední.', '2': 'Sečení dvakrát týdně: plán to zohlední.' },
    mower: { rotary: 'Rotační sekačka zapsána.', reel: 'Vřetenová sekačka zapsána.', robot: 'Robotická sekačka zapsána.' },
    age: { established: 'Starší trávník: plán běží v plném.', 'new': 'Nový trávník: první hnojení až 6–8 týdnů po výsevu.' },
    grass: { fescue: 'Kostřavy zapsány.', rye: 'Jílek zapsán.', mix: 'Směs zapsána.', '': 'Nevadí, plán funguje i bez toho.' },
    mode: { preventive: 'Pravidelně podle plánu: dostanete všechny dávky na celý rok.', thrifty: 'Jen když trávník potřebuje: dostanete znaky, podle kterých poznáte, kdy přihnojit.' },
    prob: { moss: 'Mech: plán řeší příčinu (stín, utužení, kyselost), ne jen mech.', dog: 'Pes: moč pálí, poškozená místa dosejte a zalijte.' }
  };
  var S = { area: 150, tier: '', sun: 'full', soil: 'unknown', irr: '', mow: '', mower: 'rotary', mowh: 3.5, age: '', grass: '', probs: new Set() };
  var Q = { form: null, step: 0, max: 0, scene: null, msg: '', r: null, need: [], dbt: null };

  /* --- formulář je zdroj pravdy --- */
  function val(id) { var e = Q.form.querySelector('#' + id); return e ? e.value : ''; }
  function readS() {
    var f = Q.form, ar = Number(val('area')), t = f.querySelector('input[name="tier"]:checked');
    S.areaSet = ar > 0; S.area = ar > 0 ? ar : 150;
    S.tier = t ? t.value : '';
    var td = TIERS.filter(function (x) { return x[0] === S.tier; })[0];
    S.sun = val('sun') || 'full'; S.soil = val('soil') || 'unknown'; S.irr = val('irr'); S.mow = val('mow'); S.mower = val('mower') || 'rotary';
    var mh = Number(val('mowh')); S.mowhSet = mh > 0; S.mowh = mh > 0 ? mh : (td ? td[3] : 3.5);
    S.age = val('age'); S.grass = val('grass'); S.mode = val('mode') || 'preventive';
    S.probs = new Set();
    [].forEach.call(f.querySelectorAll('input[name="prob"]:checked,input[name="sym"]:checked'), function (i) { S.probs.add(i.value); });
    if ($('dog') && $('dog').checked) S.probs.add('dog');
  }
  function fire(el, type) { el.dispatchEvent(new Event(type || 'change', { bubbles: true })); }
  function setField(id, v, type) { var e = Q.form.querySelector('#' + id); if (!e) return; e.value = v; fire(e, type); }
  function setTier(v) { var r = Q.form.querySelector('input[name="tier"][value="' + v + '"]'); if (r) { r.checked = true; fire(r); } }
  function toggleProb(key) {
    var p = PROBS.filter(function (x) { return x[0] === key; })[0], el = p[2] === 'dog' ? $('dog') : Q.form.querySelector('input[name="' + p[2] + '"][value="' + key + '"]');
    if (el) { el.checked = !el.checked; fire(el); }
  }
  /* posuvníky zapisují do formuláře se zpožděním, aby se plán nepřepočítával při každém pixelu */
  function later(fn) { clearTimeout(Q.dbt); Q.dbt = setTimeout(fn, 140); }

  /* --- zprávy v bublině --- */
  function say(t) { Q.msg = t; var b = $('qzBubble'); if (!b) return; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; b.innerHTML = t; }

  /* --- dlaždice --- */
  var ICO = {
    full: '<svg viewBox="0 0 44 34"><circle cx="22" cy="17" r="8" fill="#f7c93a"/><g stroke="#f7c93a" stroke-width="2.5" stroke-linecap="round"><path d="M22 3v4M22 27v4M8 17h4M32 17h4M12 7l3 3M29 24l3 3M32 7l-3 3M15 24l-3 3"/></g></svg>',
    partial: '<svg viewBox="0 0 44 34"><circle cx="16" cy="13" r="7" fill="#f7c93a"/><ellipse cx="27" cy="21" rx="12" ry="7" fill="#c9d3d8"/></svg>',
    shade: '<svg viewBox="0 0 44 34"><rect x="20" y="16" width="4" height="14" fill="#6d4c2f"/><circle cx="22" cy="12" r="10" fill="#3f7a38"/></svg>',
    soil: function (c) { return '<svg viewBox="0 0 44 34"><rect x="2" y="8" width="40" height="22" rx="6" fill="' + c + '"/><circle cx="12" cy="20" r="2" fill="#0003"/><circle cx="26" cy="16" r="2" fill="#0003"/><circle cx="32" cy="24" r="2" fill="#0003"/></svg>'; },
    auto: '<svg viewBox="0 0 44 34"><circle cx="22" cy="26" r="3" fill="#555"/><path d="M22 26Q8 8 4 26M22 26Q36 8 40 26" stroke="#4aa8e0" stroke-width="2.5" fill="none" stroke-dasharray="3 4" stroke-linecap="round"/></svg>',
    manual: '<svg viewBox="0 0 44 34"><path d="M40 28Q28 32 20 22T8 18" stroke="#2f8a4a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M8 18Q4 10 12 8" stroke="#4aa8e0" stroke-width="2.5" fill="none" stroke-dasharray="3 4" stroke-linecap="round"/></svg>',
    none: '<svg viewBox="0 0 44 34"><path d="M22 6C14 16 12 20 12 24a10 10 0 0 0 20 0C32 20 30 16 22 6z" fill="none" stroke="#97a28d" stroke-width="2.5"/><path d="M8 30L36 4" stroke="#b4451f" stroke-width="3" stroke-linecap="round"/></svg>',
    rotary: '<svg viewBox="0 0 44 34"><rect x="4" y="14" width="26" height="12" rx="4" fill="#d9483a"/><circle cx="11" cy="28" r="4" fill="#333"/><circle cx="25" cy="28" r="4" fill="#333"/><path d="M30 16L42 4" stroke="#333" stroke-width="3" stroke-linecap="round"/></svg>',
    reel: '<svg viewBox="0 0 44 34"><rect x="4" y="16" width="22" height="10" rx="3" fill="#7f8a92"/><circle cx="10" cy="26" r="6" fill="#444"/><circle cx="22" cy="26" r="6" fill="#444"/><path d="M26 18L42 4" stroke="#333" stroke-width="3" stroke-linecap="round"/></svg>',
    robot: '<svg viewBox="0 0 44 34"><ellipse cx="22" cy="22" rx="17" ry="8" fill="#f0f0e8" stroke="#555" stroke-width="2"/><rect x="12" y="16" width="20" height="6" rx="3" fill="#2a78d6"/></svg>',
    h: function (h) { return '<svg viewBox="0 0 44 34">' + [6, 12, 18, 24, 30, 36].map(function (x) { return '<line x1="' + x + '" x2="' + x + '" y1="30" y2="' + (30 - h * 3.2) + '" stroke="#3a7a37" stroke-width="3" stroke-linecap="round"/>'; }).join('') + '</svg>'; }
  };
  var FIELD = { sun: 'sun', soil: 'soil', irr: 'irr', mow: 'mow', mower: 'mower', age: 'age', grass: 'grass', mode: 'mode' };
  function tile(g, v, title, sub, ico) { return '<button type="button" class="qz-tile" data-g="' + g + '" data-v="' + v + '" aria-pressed="false">' + (ico || '') + '<b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</button>'; }

  var STEPS = ['Kde', 'Jaký trávník', 'Slunce a půda', 'Voda a sečení', 'Stav', 'Hotovo'];
  function stepHTML(n) {
    var h = '';
    if (n === 0) h = '<h3>Kde trávník roste a jak je velký?</h3>' +
      '<div class="qz-q"><label class="qz-lab" for="qObec">Obec</label><div class="qz-row"><input id="qObec" type="text" autocomplete="address-level2" placeholder="např. Domažlice" style="flex:1;min-width:0"><button type="button" class="qz-btn small" id="qObecBtn">Zjistit</button></div><span class="qz-hint" id="qObecMsg">Doplníme nadmořskou výšku a podnebí vaší obce za posledních 5 let.</span></div>' +
      '<div class="qz-q"><label class="qz-lab" for="qAreaR">Plocha trávníku</label><div class="qz-range"><input id="qAreaR" type="range" min="0" max="100" value="50"><span class="qz-val"><input id="qArea" type="number" min="1" max="20000" inputmode="numeric" placeholder="150"> m²</span></div>' +
      '<div class="qz-chips">' + [50, 150, 300, 600, 1200].map(function (a) { return '<button type="button" class="qz-chip" data-area="' + a + '">' + a + ' m²</button>'; }).join('') + '</div><span class="qz-hint">Stačí přibližně. Obrázek vlevo ukazuje velikost trávníku vůči domu.</span></div>';
    if (n === 1) h = '<h3>Jaký trávník chcete mít?</h3><div class="qz-tiles two" role="radiogroup" aria-label="Úroveň péče">' + TIERS.map(function (t) { return '<button type="button" class="qz-tile" data-tier="' + t[0] + '" aria-pressed="false" role="radio">' + ICO.h(t[3]) + '<b>' + t[1] + '</b><small>' + t[2] + '</small></button>'; }).join('') + '</div>';
    if (n === 2) h = '<h3>Slunce a půda</h3><div class="qz-q"><span class="qz-lab">Kolik má trávník slunce?</span><div class="qz-tiles">' + tile('sun', 'full', 'Většinu dne', '', ICO.full) + tile('sun', 'partial', 'Polostín', '', ICO.partial) + tile('sun', 'shade', 'Stín', '', ICO.shade) + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Jaká je půda?</span><div class="qz-tiles">' + tile('soil', 'unknown', 'Nevím', '', ICO.soil('#8a7a66')) + tile('soil', 'normal', 'Běžná', 'propustná', ICO.soil('#6b4a2f')) + tile('soil', 'clay', 'Jílovitá', 'těžká', ICO.soil('#8a5532')) + tile('soil', 'sand', 'Písčitá', 'lehká', ICO.soil('#d2b278')) + '</div><span class="qz-hint">Tip: stiskněte hrst vlhké půdy. Drží tvar jako plastelína? Je jílovitá. Sype se? Je písčitá.</span></div><div id="qSoilHost"></div>';
    if (n === 3) h = '<h3>Voda a sečení</h3><div class="qz-q"><span class="qz-lab">Jak trávník zavlažujete?</span><div class="qz-tiles">' + tile('irr', 'auto', 'Automatická závlaha', '', ICO.auto) + tile('irr', 'manual', 'Zalévám ručně', '', ICO.manual) + tile('irr', 'none', 'Nezalévám', '', ICO.none) + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Jak často sekáte?</span><div class="qz-tiles">' + tile('mow', '0.5', 'Za 2 týdny a méně', '') + tile('mow', '1', 'Jednou týdně', '') + tile('mow', '2', '2× týdně a víc', '') + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Čím sekáte?</span><div class="qz-tiles">' + tile('mower', 'rotary', 'Rotační', '', ICO.rotary) + tile('mower', 'reel', 'Vřetenová', '', ICO.reel) + tile('mower', 'robot', 'Robotická', '', ICO.robot) + '</div></div>' +
      '<div class="qz-q"><label class="qz-lab" for="qMowH">Na kolik centimetrů sekáte</label><div class="qz-range"><input id="qMowH" type="range" min="1.5" max="8" step="0.5"><span class="qz-val" id="qMowV"></span></div><span class="qz-hint">Táhněte a sledujte, jak se trávník vlevo zkracuje a prodlužuje.</span></div>';
    if (n === 4) h = '<h3>Co trávník trápí?</h3><div class="qz-q"><span class="qz-lab">Klikněte na všechno, co vidíte</span><div class="qz-chips">' + PROBS.map(function (p) { return '<button type="button" class="qz-chip" data-p="' + p[0] + '" aria-pressed="false">' + p[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Jak je trávník starý?</span><div class="qz-tiles">' + tile('age', 'established', 'Starší než rok', '') + tile('age', 'new', 'Nový (do roku)', '') + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Travní směs</span><div class="qz-tiles">' + tile('grass', 'fescue', 'Kostřavy', '') + tile('grass', 'rye', 'Jílek', '') + tile('grass', 'mix', 'Směs', '') + tile('grass', '', 'Nevím', '') + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Jak chcete hnojit?</span><div class="qz-tiles two">' + tile('mode', 'preventive', 'Pravidelně podle plánu', 'všechny dávky na celý rok') + tile('mode', 'thrifty', 'Jen když trávník potřebuje', 'poznáte podle znaků') + '</div></div>';
    if (n === 5) h = '<h3>Váš plán je sestavený</h3><div id="qPass"></div><p class="qz-hint">Odpovědi můžete kdykoli opravit, plán se hned přepočítá. Kliknutím na číslo kroku nahoře se k nim vrátíte.</p><div><a class="qz-btn mark" href="#res" id="qGo">Ukázat můj plán</a></div>';
    return h;
  }
  function renderStep() {
    var c = $('qzCard'); if (!c) return;
    var soil = Q.soilNode; if (soil && soil.parentNode !== $('qfields')) $('qfields').appendChild(soil);
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    c.innerHTML = stepHTML(Q.step);
    if (Q.step === 2 && soil) $('qSoilHost').appendChild(soil);
    bindStep(); paintStep(); drawProg();
    $('qzBack').disabled = Q.step === 0; $('qzNext').textContent = Q.step === 5 ? 'Začít znovu' : 'Další';
  }
  function drawProg() {
    var done = [needStep(0), needStep(1), false, false, false, false];
    $('qzProg').innerHTML = STEPS.map(function (s, i) { return '<li><button type="button" data-go="' + i + '" data-s="' + (i !== Q.step && (i <= Q.max) && !done[i] ? 'done' : '') + '"' + (i === Q.step ? ' aria-current="step"' : '') + ' aria-label="Krok ' + (i + 1) + ': ' + s + '">' + (i + 1) + '</button></li>'; }).join('');
    [].forEach.call($('qzProg').querySelectorAll('button'), function (b) { b.onclick = function () { Q.step = +b.getAttribute('data-go'); Q.max = Math.max(Q.max, Q.step); renderStep(); }; });
  }
  function needStep(i) { if (i === 0) return !(S.areaSet && val('obec').trim().length >= 2); if (i === 1) return !S.tier; return false; }

  /* označí vybrané dlaždice podle formuláře */
  function paintStep() {
    var c = $('qzCard'); if (!c) return;
    [].forEach.call(c.querySelectorAll('.qz-tile[data-g]'), function (b) { var g = b.getAttribute('data-g'), cur = g === 'mode' ? S.mode : val(FIELD[g]); b.setAttribute('aria-pressed', String(cur === b.getAttribute('data-v'))); });
    [].forEach.call(c.querySelectorAll('.qz-tile[data-tier]'), function (b) { b.setAttribute('aria-pressed', String(S.tier === b.getAttribute('data-tier'))); });
    [].forEach.call(c.querySelectorAll('.qz-chip[data-p]'), function (b) { b.setAttribute('aria-pressed', String(S.probs.has(b.getAttribute('data-p')))); });
    [].forEach.call(c.querySelectorAll('.qz-chip[data-area]'), function (b) { b.setAttribute('aria-pressed', String(S.areaSet && +b.getAttribute('data-area') === S.area)); });
    var ob = $('qObec'); if (ob && document.activeElement !== ob) ob.value = val('obec');
    var ar = $('qArea'); if (ar && document.activeElement !== ar) ar.value = S.areaSet ? S.area : '';
    var as = $('qAreaR'); if (as && document.activeElement !== as) as.value = Math.round(Math.log(S.area / 20) / Math.log(100) * 100);
    var mh = $('qMowH'); if (mh && document.activeElement !== mh) { mh.value = S.mowh; $('qMowV').textContent = fmt(S.mowh, 1) + ' cm'; }
    if (Q.step === 5) paintPass();
  }
  function selTxt(id) { var e = Q.form.querySelector('#' + id); return e && e.value && e.selectedIndex >= 0 ? e.options[e.selectedIndex].text : ''; }
  function paintPass() {
    var host = $('qPass'); if (!host) return;
    var td = TIERS.filter(function (x) { return x[0] === S.tier; })[0], pr = PROBS.filter(function (p) { return S.probs.has(p[0]); }).map(function (p) { return p[1]; }).join(', ') || 'nic zvláštního';
    var v = function (x) { return x ? esc(x) : '<span style="opacity:.6">neuvedeno</span>'; };
    host.innerHTML = '<div class="qz-pass"><div class="qz-band"></div><dl class="qz-pg"><div><dt>Obec</dt><dd>' + v(val('obec').trim()) + '</dd></div><div><dt>Plocha</dt><dd>' + (S.areaSet ? fmt(S.area, 0) + ' m²' : v('')) + '</dd></div><div><dt>Péče</dt><dd>' + v(td ? td[1] : '') + '</dd></div><div><dt>Slunce</dt><dd>' + v(selTxt('sun')) + '</dd></div><div><dt>Půda</dt><dd>' + v(selTxt('soil')) + '</dd></div><div><dt>Zálivka</dt><dd>' + v(selTxt('irr')) + '</dd></div><div><dt>Sečení</dt><dd>' + v([selTxt('mow'), selTxt('mower'), S.mowhSet ? fmt(S.mowh, 1) + ' cm' : ''].filter(Boolean).join(', ')) + '</dd></div><div><dt>Směs</dt><dd>' + v(selTxt('grass')) + '</dd></div><div style="grid-column:1/-1"><dt>Co trávník trápí</dt><dd>' + esc(pr) + '</dd></div></dl></div>' +
      (Q.need.length ? '<p class="qz-hint" style="color:#b4451f">Ještě chybí: ' + esc(Q.need.join(', ')) + '.</p>' : '');
  }

  function bindStep() {
    var c = $('qzCard'), sayTile = function (g, v) { var m = SAY[g] && SAY[g][v]; if (m) say(m); };
    [].forEach.call(c.querySelectorAll('.qz-tile[data-g]'), function (b) { b.onclick = function () { var g = b.getAttribute('data-g'), v = b.getAttribute('data-v'); setField(FIELD[g], v); sayTile(g, v); }; });
    [].forEach.call(c.querySelectorAll('.qz-tile[data-tier]'), function (b) { b.onclick = function () { var v = b.getAttribute('data-tier'); setTier(v); sayTile('tier', v); }; });
    [].forEach.call(c.querySelectorAll('.qz-chip[data-p]'), function (b) { b.onclick = function () { var k = b.getAttribute('data-p'); toggleProb(k); say(S.probs.has(k) ? (SAY.prob[k] || 'Zapsáno, plán to zohlední v doporučeních.') : 'Odebráno z plánu.'); }; });
    var ar = $('qAreaR'), an = $('qArea');
    if (ar) {
      ar.oninput = function () { var a = Math.max(20, Math.round(20 * Math.pow(100, ar.value / 100) / 10) * 10); S.area = a; S.areaSet = true; an.value = a; Q.scene.update(S); paintStep(); later(function () { setField('area', a, 'input'); }); };
      an.oninput = function () { var a = Number(an.value); if (a > 0) { S.area = a; S.areaSet = true; Q.scene.update(S); } later(function () { setField('area', an.value, 'input'); }); };
      [].forEach.call(c.querySelectorAll('.qz-chip[data-area]'), function (b) { b.onclick = function () { var a = +b.getAttribute('data-area'); setField('area', a, 'input'); say('<b>' + fmt(a, 0) + ' m²</b> zapsáno.'); }; });
    }
    var ob = $('qObec'); if (ob) {
      ob.oninput = function () { setField('obec', ob.value, 'input'); };
      ob.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); var bt = $('obecBtn'); if (bt) bt.click(); } };
      $('qObecBtn').onclick = function () { var bt = $('obecBtn'); if (bt) bt.click(); };
      mirrorMsg();
    }
    var mh = $('qMowH'); if (mh) mh.oninput = function () { var h = +mh.value; S.mowh = h; S.mowhSet = true; $('qMowV').textContent = fmt(h, 1) + ' cm'; Q.scene.update(S); say(h <= 3 ? '<b>' + fmt(h, 1) + ' cm</b>: nízký střih, jemný hustý trávník, vyžaduje častější sečení.' : h >= 6 ? '<b>' + fmt(h, 1) + ' cm</b>: vysoký trávník, hrubší a méně hustý.' : '<b>' + fmt(h, 1) + ' cm</b>: běžná výška pro rodinný trávník.'); later(function () { setField('mowh', h, 'input'); }); };
    var go = $('qGo'); if (go) go.onclick = function (e) { e.preventDefault(); var r = $('res'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  }
  /* zpráva o obci z původního (skrytého) pole se zrcadlí do nového vzhledu */
  function mirrorMsg() {
    var src = $('obecMsg'), dst = $('qObecMsg'); if (!src || !dst) return;
    var copy = function () { dst.textContent = src.textContent || 'Doplníme nadmořskou výšku a podnebí vaší obce za posledních 5 let.'; dst.className = 'qz-hint ' + (src.classList.contains('err') ? 'err' : src.classList.contains('ok') ? 'ok' : ''); var bt = $('qObecBtn'); if (bt) bt.disabled = !!($('obecBtn') && $('obecBtn').disabled); };
    copy();
    if (Q.mo) Q.mo.disconnect();
    Q.mo = new MutationObserver(copy); Q.mo.observe(src, { childList: true, characterData: true, subtree: true, attributes: true });
    var ob = $('obecBtn'); if (ob) Q.mo.observe(ob, { attributes: true });
  }

  /* --- živý souhrn pod obrázkem --- */
  var shown = { d: 0, kg: 0, n: 0 }, raf;
  function drawLive() {
    var r = Q.r, rows = r && r.fertTableReference, panel = $('qzScore'), strip = $('qzStrip'), hint = $('qzHint');
    if (!r || !rows || !rows.length || r.mode === 'thrifty') {
      cancelAnimationFrame(raf);
      panel.innerHTML = '<div style="grid-column:1/-1"><b style="font-size:18px">' + (r && r.mode === 'thrifty' ? 'Hnojit podle potřeby' : 'Váš rok se tu poskládá') + '</b><span>' + (r && r.mode === 'thrifty' ? 'Dostanete znaky, podle kterých poznáte, kdy přihnojit.' : 'Doplňte obec, plochu a jaký trávník chcete.') + '</span></div>';
      strip.innerHTML = MONF.map(function (m) { return '<div class="qz-mc"><span class="qz-ps"></span><span>' + m + '</span></div>'; }).join(''); hint.textContent = ''; shown = { d: 0, kg: 0, n: 0 }; return;
    }
    var t = { d: rows.length, kg: rows.reduce(function (s, x) { return s + (x.totalKg || 0); }, 0), n: rows.reduce(function (s, x) { return s + (Number(x.nGPerM2) || 0); }, 0) };
    cancelAnimationFrame(raf); var from = { d: shown.d, kg: shown.kg, n: shown.n }, t0 = performance.now();
    var step = function (now) { var k = Math.max(0, Math.min(1, (now - t0) / 450)), e = 1 - Math.pow(1 - k, 3), c = { d: from.d + (t.d - from.d) * e, kg: from.kg + (t.kg - from.kg) * e, n: from.n + (t.n - from.n) * e }; shown = c;
      panel.innerHTML = '<div><b>' + Math.round(c.d) + '×</b><span>hnojení za rok</span></div><div><b>' + fmt(c.kg, 1) + ' kg</b><span>hnojiva na ' + fmt(S.area, 0) + ' m²</span></div><div><b>' + fmt(c.n, 0) + ' g</b><span>dusíku na m² za rok</span></div>';
      if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    var by = {}; rows.forEach(function (x) { by[Math.floor(x.half / 2)] = x.key || 'C'; });
    strip.innerHTML = MONF.map(function (m, i) { return '<div class="qz-mc"><span class="qz-ps">' + (by[i] ? '<span class="qz-peg ' + by[i] + '" title="' + esc(KEYNAME[by[i]]) + '"><span>' + by[i] + '</span></span>' : '') + '</span><span>' + m + '</span></div>'; }).join('');
    hint.textContent = 'Kolíky ukazují měsíce hnojení. K draslíkové, N rychlé dusíkaté, C vyvážené.';
  }

  /* --- veřejné rozhraní pro plan-page.js --- */
  function init(opts) {
    Q.form = opts.form; var host = $('qz'); if (!host || Q.inited) return; Q.inited = true;
    Q.soilNode = Q.form.querySelector('details.soil');
    host.innerHTML = '<div class="qz-grid"><aside class="qz-live" aria-label="Živý náhled vašeho trávníku"><div class="qz-scenebox"><canvas id="qzScene" role="img" aria-label="Živý obrázek vašeho trávníku podle odpovědí"></canvas><div class="qz-bubble" id="qzBubble" aria-live="polite">Tohle je váš trávník. Klikejte a sledujte, jak se mění.</div></div>' +
      '<div class="qz-panel"><div class="qz-score" id="qzScore"></div><div class="qz-strip" id="qzStrip" aria-label="Měsíce hnojení"></div><p class="qz-hint" id="qzHint"></p></div></aside>' +
      '<section class="qz-steps"><ol class="qz-prog" id="qzProg"></ol><div class="qz-card" id="qzCard"></div><div class="qz-nav"><button type="button" class="qz-btn ghost" id="qzBack">Zpět</button><button type="button" class="qz-btn" id="qzNext">Další</button></div></section></div>';
    readS();
    Q.scene = makeScene($('qzScene'), S);
    Q.scene.build(); Q.scene.update(S); Q.scene.snap();
    $('qzNext').onclick = function () { if (Q.step === 5) { Q.step = 0; Q.max = 0; } else { Q.step++; Q.max = Math.max(Q.max, Q.step); } renderStep(); };
    $('qzBack').onclick = function () { if (Q.step > 0) { Q.step--; renderStep(); } };
    renderStep(); drawLive();
  }
  /* po každém přepočtu plánu (i po načtení odpovědí ze serveru) */
  function update(r, need) {
    if (!Q.inited) return;
    Q.r = r || null; Q.need = need || []; readS(); Q.scene.update(S); paintStep(); drawLive(); drawProg();
  }
  function refresh() { if (!Q.inited) return; readS(); Q.scene.update(S); renderStep(); }
  window.MVGreenQuiz = { init: init, update: update, refresh: refresh };

  function makeScene(cv, S) {
/* --- scéna: živá animace v canvasu (vítr v trávě, kapky vody s gravitací, sekačka, která opravdu seče a trávník pak dorůstá) --- */
const cx=cv.getContext('2d'),W=420,H=292,RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
function fitCanvas(){const r=Math.min(2,window.devicePixelRatio||1)*1.5;cv.width=W*r;cv.height=H*r;cx.setTransform(r,0,0,r,0,0)}
let rs=11;const rnd=()=>{rs=(rs*16807)%2147483647;return (rs-1)/2147483646};
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const rgb=(c,a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const PKEYS=['moss','weeds','bare','compaction','snowmold','poa','crabgrass','spots','grubs','dog','thatch','pale','thin'];
const tgt={sun:1,cloud:0,dark:0,dry:0,wet:0,hs:1,dens:1,ls:1,stripe:0,tree:1,ia:0,im:0,mr:1,mrl:0,mro:0,soil:hex('#6b4a2f'),grass:hex('#3f8a3a'),p:{}};
PKEYS.forEach(k=>tgt.p[k]=0);
const cur=JSON.parse(JSON.stringify(tgt));
const bl=[];let T=0,parts=[],clips=[];
const PATCH={moss:[[.22,.3,.1],[.7,.55,.11],[.45,.88,.08]],bare:[[.35,.7,.07],[.78,.28,.06],[.12,.6,.06]],compaction:[[.5,.9,.3]],snowmold:[[.3,.4,.09],[.72,.72,.1]],poa:[[.15,.62,.08],[.62,.2,.07],[.88,.85,.09]],crabgrass:[[.4,.25,.07],[.1,.9,.08],[.68,.6,.07]],spots:[[.25,.78,.06],[.55,.5,.07],[.85,.3,.05]],grubs:[[.45,.6,.1],[.8,.8,.08]]};
const WEEDS=[[.15,.3],[.3,.6],[.6,.35],[.85,.78],[.5,.75],[.08,.8],[.72,.9],[.9,.4]];
function buildScene(){
  fitCanvas();rs=11;bl.length=0;
  for(let i=0;i<1100;i++){const b={u:rnd(),v:Math.pow(rnd(),.85),r:rnd(),hv:.75+rnd()*.5,ph:rnd()*6.28,c:(rnd()*3)|0,cut:1,hide:''};bl.push(b)}
  bl.sort((a,b)=>a.v-b.v);
  bl.forEach(b=>{for(const k of ['bare','grubs']){(PATCH[k]||[]).forEach(p=>{const dx=(b.u-p[0])/p[2],dy=(b.v-p[1])/(p[2]*1.8);if(dx*dx+dy*dy<1)b.hide=k})}
    (PATCH.compaction||[]).forEach(p=>{const dx=(b.u-p[0])/p[2],dy=(b.v-p[1])/(p[2]*.5);if(dx*dx+dy*dy<.5&&b.r<.5)b.hide='compaction'})});
  snap();
  if(RM)draw();else requestAnimationFrame(frame);
}
function snap(){Object.keys(tgt).forEach(k=>{if(k==='p')PKEYS.forEach(q=>cur.p[q]=tgt.p[q]);else if(Array.isArray(tgt[k]))cur[k]=tgt[k].slice();else cur[k]=tgt[k]})}
function updateScene(){
  const s=S.sun;tgt.sun=s==='shade'?0:s==='partial'?.75:1;tgt.cloud=s==='full'?0:s==='partial'?.6:1;tgt.dark=s==='shade'?.42:s==='partial'?.12:0;tgt.tree=s==='shade'?1.22:1;
  tgt.soil=hex({unknown:'#7a5a3a',normal:'#6b4a2f',clay:'#8a5532',sand:'#d2b278'}[S.soil]);
  tgt.ls=clamp(.55+.5*Math.log(S.area/20)/Math.log(100),.55,1.06);
  tgt.hs=Math.max(.35,S.mowh/3.5);tgt.dens=S.age==='new'?.3:S.probs.has('thin')?.55:1;
  tgt.stripe=(S.mower==='reel'||S.tier==='representative'||S.tier==='sportovni')?1:0;
  tgt.dry=S.irr==='none'?.7:0;tgt.wet=S.irr==='auto'?.55:S.irr==='manual'?.3:0;
  tgt.ia=S.irr==='auto'?1:0;tgt.im=S.irr==='manual'?1:0;tgt.mr=S.mower==='rotary'?1:0;tgt.mrl=S.mower==='reel'?1:0;tgt.mro=S.mower==='robot'?1:0;
  tgt.grass=hex(S.grass==='rye'?'#4d9a3e':S.grass==='fescue'?'#2f7f3a':'#3f8a3a');
  PKEYS.forEach(k=>tgt.p[k]=S.probs.has(k)?1:0);tgt.p.bare=(S.probs.has('bare')||S.age==='new')?1:0;
  if(RM){snap();draw()}
}
function step(dt){
  const k=1-Math.exp(-dt*3.5);
  for(const key of Object.keys(tgt)){if(key==='p')PKEYS.forEach(q=>cur.p[q]+=(tgt.p[q]-cur.p[q])*k);
    else if(Array.isArray(tgt[key]))cur[key]=cur[key].map((v,i)=>v+(tgt[key][i]-v)*k);
    else cur[key]+=(tgt[key]-cur[key])*k}
  mow(dt);spray(dt);
  bl.forEach(b=>{b.cut+=(1-b.cut)*dt*.1});
}
/* sekačka: jede po řádcích, tráva za ní je kratší a pomalu dorůstá */
const M={row:0,p:0,dir:1,wait:1,u:.1,v:.1};
function mow(dt){
  if(S.mower==='robot'){M.u=.5+.38*Math.sin(T*.33);M.v=.5+.4*Math.sin(T*.51+1);bl.forEach(b=>{const du=b.u-M.u,dv=(b.v-M.v)*2.2;if(du*du+dv*dv<.014)b.cut=Math.min(b.cut,.86)});return}
  if(M.wait>0){M.wait-=dt;return}
  const rows=5;M.p+=dt/4.4;if(M.p>=1){M.p=0;M.row++;M.dir*=-1;if(M.row>=rows){M.row=0;M.dir=1;M.wait=4}}
  M.v=(M.row+.5)/rows;M.u=M.dir>0?M.p:1-M.p;
  bl.forEach(b=>{if(Math.abs(b.v-M.v)<.5/rows+.015&&(M.dir>0?b.u<M.u:b.u>M.u))b.cut=Math.min(b.cut,.66)});
  if(S.mower==='rotary'&&Math.random()<.7){const q=at(M.u,M.v);parts.push({t:'clip',x:q.x,y:q.y-3*q.s,vx:(M.dir>0?-1:1)*(25+Math.random()*35),vy:-20-Math.random()*30,l:0,s:q.s})}
}
/* geometrie trávníku podle plochy */
function geo(){const Ls=cur.ls,Ld=.72+.28*(Ls-.55)/.51,top=252-92*Ld;return {Ls,top,bot:252}}
function at(u,v){const g=geo(),y=g.top+v*(g.bot-g.top),hw=(170+34*v)*g.Ls;return {x:210+(u-.5)*2*hw,y,s:.5+.5*v,hw}}
function spray(dt){
  if(cur.ia>.05)[.2,.5,.8].forEach((u,i)=>{const q=at(u,.4);for(let n=0;n<4;n++){const a=Math.sin(T*1.7+i*2)*1.15+(Math.random()-.5)*.25;parts.push({t:'w',x:q.x,y:q.y,vx:Math.sin(a)*70*q.s*1.3,vy:-(70+Math.random()*30)*q.s,l:0,y0:q.y,s:q.s})}});
  if(cur.im>.05){const q=at(.8,.8);for(let n=0;n<7;n++){const a=-1.1+Math.sin(T*.8)*.5+(Math.random()-.5)*.3;parts.push({t:'w',x:q.x-3,y:q.y-8,vx:Math.cos(a)*-55*(.7+Math.random()*.5),vy:-(30+Math.random()*35),l:0,y0:q.y,s:q.s})}}
  parts.forEach(p=>{p.l+=dt;p.vy+=(p.t==='w'?230:150)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt});
  parts=parts.filter(p=>(p.t==='w'?p.y<p.y0+2:p.l<.9)).slice(-900);
}
let vis=true;if('IntersectionObserver' in window)new IntersectionObserver(function(en){vis=en[0].isIntersecting}).observe(cv);
function frame(ts){if(!vis||document.hidden){frame.l=ts;requestAnimationFrame(frame);return}const dt=Math.min(.05,(ts-(frame.l||ts))/1000||.016);frame.l=ts;T+=dt;step(dt);draw();requestAnimationFrame(frame)}

function draw(){
  const g=geo(),c=cx,wind=.55+.35*Math.sin(T*.4)+.2*Math.sin(T*1.3);
  c.clearRect(0,0,W,H);
  /* nebe */
  const sky1=mix(hex('#6fb8e6'),hex('#9aa8ae'),cur.dark/.42),sky2=mix(hex('#d6eef8'),hex('#cdd5d7'),cur.dark/.42);
  let gr=c.createLinearGradient(0,0,0,165);gr.addColorStop(0,rgb(sky1));gr.addColorStop(1,rgb(sky2));c.fillStyle=gr;c.fillRect(0,0,W,165);
  /* slunce */
  if(cur.sun>.02){const sx=70+(1-cur.sun)*30,sy=46;c.save();c.globalAlpha=cur.sun;
    gr=c.createRadialGradient(sx,sy,10,sx,sy,90);gr.addColorStop(0,'rgba(255,236,150,.75)');gr.addColorStop(1,'rgba(255,236,150,0)');c.fillStyle=gr;c.fillRect(0,0,220,160);
    c.strokeStyle='rgba(255,220,90,.9)';c.lineWidth=3;c.lineCap='round';for(let i=0;i<12;i++){const a=i/12*6.283+T*.15,l=i%2?10:16;c.beginPath();c.moveTo(sx+Math.cos(a)*30,sy+Math.sin(a)*30);c.lineTo(sx+Math.cos(a)*(30+l),sy+Math.sin(a)*(30+l));c.stroke()}
    gr=c.createRadialGradient(sx-6,sy-6,2,sx,sy,26);gr.addColorStop(0,'#fff3b0');gr.addColorStop(1,'#f5c231');c.fillStyle=gr;c.beginPath();c.arc(sx,sy,25,0,6.283);c.fill();c.restore()}
  /* mraky se pomalu unášejí */
  for(let i=0;i<5;i++){const vis=clamp(cur.cloud*5-i,0,1);if(vis<=.01)continue;const x=((T*(5+i*2)+i*110)%560)-70,y=26+i*17+(i%2)*10,sc=.8+i*.12,col=mix([255,255,255],[170,178,182],cur.dark/.42);
    c.save();c.globalAlpha=vis*.95;c.translate(x,y);c.scale(sc,sc);c.fillStyle=rgb(col);[[0,0,26,12],[-20,5,18,9],[22,6,20,9],[8,-6,16,10]].forEach(e=>{c.beginPath();c.ellipse(e[0],e[1],e[2],e[3],0,0,6.283);c.fill()});c.restore()}
  /* louka v dálce, dům, strom */
  gr=c.createLinearGradient(0,150,0,252);gr.addColorStop(0,'#b8d19a');gr.addColorStop(1,'#92b46f');c.fillStyle=gr;c.fillRect(0,150,W,102);
  c.fillStyle='#efe6d2';c.fillRect(300,96,90,64);c.fillStyle='#d9ceb6';c.fillRect(300,96,90,6);
  c.fillStyle='#a6503a';c.beginPath();c.moveTo(290,98);c.lineTo(345,60);c.lineTo(400,98);c.fill();
  gr=c.createLinearGradient(0,116,0,142);gr.addColorStop(0,'#a9d4ea');gr.addColorStop(1,'#6fa3c2');c.fillStyle=gr;c.fillRect(316,116,22,26);c.fillRect(352,116,22,26);
  c.fillStyle='#7a5a3a';c.fillRect(336,138,18,22);
  const sw=Math.sin(T*.9)*1.4*wind;
  c.save();c.translate(195,160);c.scale(cur.tree,cur.tree);c.fillStyle='#6d4c2f';c.fillRect(-5,-56,10,56);
  [[sw*1.2,-68,32,'#4f9a45'],[-22+sw,-52,22,'#468c3d'],[24+sw*1.5,-54,24,'#3f8438'],[sw*.8,-84,20,'#5aa84d']].forEach(l=>{gr=c.createRadialGradient(l[0]-6,l[1]-8,3,l[0],l[1],l[2]);gr.addColorStop(0,'#74b95f');gr.addColorStop(1,l[3]);c.fillStyle=gr;c.beginPath();c.arc(l[0],l[1],l[2],0,6.283);c.fill()});c.restore();
  /* trávník */
  const a=at(0,0),b=at(1,0),d=at(0,1),e=at(1,1);
  const lawn=()=>{c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineTo(e.x,e.y);c.lineTo(d.x,d.y);c.closePath()};
  const base=mix(cur.grass,hex('#b9a84a'),cur.dry*.8);
  c.save();lawn();c.fillStyle=rgb(mix(base,[10,40,16],cur.dark*.55));c.fill();c.clip();
  /* pruhy po sekání */
  if(cur.stripe>.02)for(let i=0;i<10;i++){const u0=i/10,u1=(i+1)/10;if(i%2)continue;const p0=at(u0,0),p1=at(u1,0),p2=at(u1,1),p3=at(u0,1);c.fillStyle=`rgba(255,255,255,${.1*cur.stripe})`;c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.lineTo(p2.x,p2.y);c.lineTo(p3.x,p3.y);c.fill()}
  /* skvrny pod stébly */
  const blob=(key,col,sx,sy,soft)=>{const al=cur.p[key];if(al<.02)return;(PATCH[key]||[]).forEach(p=>{const q=at(p[0],p[1]),rx=p[2]*q.hw*2,ry=rx*.3*(.6+q.s*.6);c.save();c.globalAlpha=al;c.translate(q.x,q.y);c.scale(1,ry/rx);gr=c.createRadialGradient(0,0,rx*.2,0,0,rx);gr.addColorStop(0,col);gr.addColorStop(soft,col);gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.beginPath();c.arc(0,0,rx,0,6.283);c.fill();c.restore()})};
  blob('compaction','rgb(155,132,97)',1,1,.5);blob('bare','rgb(122,90,58)',1,1,.7);blob('grubs','rgb(139,111,61)',1,1,.6);blob('moss','rgb(28,72,34)',1,1,.6);
  blob('poa','rgb(166,214,110)',1,1,.5);blob('crabgrass','rgb(190,222,110)',1,1,.5);blob('spots','rgb(201,180,74)',1,1,.6);
  if(cur.p.snowmold>.02)(PATCH.snowmold).forEach(p=>{const q=at(p[0],p[1]),rx=p[2]*q.hw*2;c.save();c.globalAlpha=cur.p.snowmold;c.strokeStyle='rgba(225,225,215,.9)';c.lineWidth=4;c.beginPath();c.ellipse(q.x,q.y,rx,rx*.3,0,0,6.283);c.stroke();c.restore()});
  /* stín stromu se pomalu posouvá */
  if(cur.dark>.02){const sx=at(.3+.03*Math.sin(T*.07),.45);c.save();c.globalAlpha=cur.dark*1.3;gr=c.createRadialGradient(sx.x,sx.y,10,sx.x,sx.y,150*g.Ls);gr.addColorStop(0,'rgba(0,25,8,.55)');gr.addColorStop(1,'rgba(0,25,8,0)');c.fillStyle=gr;c.fillRect(0,150,W,110);c.restore()}
  /* stébla: tři odstíny, hrají ve větru */
  const pal=[mix(base,[10,50,20],.35),base,mix(base,[150,200,90],.3)].map(col=>mix(mix(col,hex('#b6c960'),cur.p.pale*.55),hex('#8b7a4a'),cur.p.thatch*.3));
  const hsz=cur.hs;let curCol=-1,curW=-1;
  const paths={};
  for(let i=0;i<bl.length;i++){const q=bl[i];let hf=clamp((cur.dens-q.r)*6);if(q.hide)hf*=1-cur.p[q.hide]*.95;if(q.r>1-cur.p.thin*.0)hf*=1;if(hf<.03)continue;
    const P=at(q.u,q.v),hb=(8+q.v*17)*q.hv*hsz*q.cut*hf,sway=Math.sin(T*2.1+q.ph+q.u*5+q.v*2)*wind*hb*.16,key=q.c+'_'+(q.v*4|0);
    (paths[key]=paths[key]||[]).push(P.x,P.y,P.x+sway,P.y-hb,hb)}
  c.lineCap='round';
  Object.keys(paths).sort((x,y)=>x.split('_')[1]-y.split('_')[1]).forEach(key=>{const [ci,vi]=key.split('_'),arr=paths[key];c.strokeStyle=rgb(mix(pal[ci],[8,30,12],cur.dark*.5));c.lineWidth=1.1+vi*.45;c.beginPath();for(let j=0;j<arr.length;j+=5){c.moveTo(arr[j],arr[j+1]);c.quadraticCurveTo(arr[j]+(arr[j+2]-arr[j])*.3,arr[j+1]-arr[j+4]*.6,arr[j+2],arr[j+3])}c.stroke()});
  /* pampelišky */
  if(cur.p.weeds>.02)WEEDS.forEach((w,i)=>{const q=at(w[0],w[1]),sx=Math.sin(T*2+i)*wind*1.5,h=9*q.s*hsz*.8+4;c.save();c.globalAlpha=cur.p.weeds;c.strokeStyle='#4f8f3f';c.lineWidth=1.2;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x+sx,q.y-h);c.stroke();c.fillStyle='#f6dd3b';c.beginPath();c.arc(q.x+sx,q.y-h,2.6*q.s+1,0,6.283);c.fill();c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(q.x+sx+3,q.y-h-1,1.4,0,6.283);c.fill();c.restore()});
  /* vlhkost po zalévání, sucho */
  if(cur.wet>.02){c.fillStyle=`rgba(10,40,25,${cur.wet*.16*(.7+.3*Math.sin(T*.8))})`;c.fillRect(0,150,W,110)}
  if(cur.dry>.02){c.fillStyle=`rgba(210,190,90,${cur.dry*.18})`;c.fillRect(0,150,W,110)}
  c.restore();
  /* zavlažovače a hadice */
  if(cur.ia>.02)[.2,.5,.8].forEach(u=>{const q=at(u,.4);c.save();c.globalAlpha=cur.ia;c.fillStyle='#444';c.fillRect(q.x-2,q.y-3,4,5);c.restore()});
  if(cur.im>.02){const q=at(.8,.8);c.save();c.globalAlpha=cur.im;c.strokeStyle='#2f8a4a';c.lineWidth=4;c.lineCap='round';c.beginPath();const e2=at(1.02,.95);c.moveTo(e2.x,e2.y);c.quadraticCurveTo(q.x+30,q.y+18,q.x+4,q.y-2);c.stroke();c.fillStyle='#555';c.fillRect(q.x-6,q.y-9,10,6);c.restore()}
  /* kapky a kousky trávy */
  parts.forEach(p=>{if(p.t==='w'){c.strokeStyle=`rgba(150,205,240,${.75*clamp(1-p.l/1.4)+.15})`;c.lineWidth=1.3*p.s+.3;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.02,p.y-p.vy*.02);c.stroke()}else{c.fillStyle=`rgba(80,150,60,${1-p.l/.9})`;c.fillRect(p.x,p.y,1.6,1.6)}});
  /* sekačka */
  const mw=(alpha,drawFn)=>{if(alpha<.02)return;const q=at(M.u,M.v);c.save();c.globalAlpha=alpha;c.translate(q.x,q.y);c.scale(q.s*1.15*(M.dir<0&&S.mower!=='robot'?-1:1),q.s*1.15);drawFn();c.restore()};
  mw(cur.mr,()=>{c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(0,2,20,5,0,0,6.283);c.fill();c.fillStyle='#d9483a';c.fillRect(-14,-14,28,14);c.fillStyle='#ee6a5a';c.fillRect(-14,-14,28,4);c.strokeStyle='#333';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(-14,-10);c.lineTo(-30,-30);c.lineTo(-24,-34);c.stroke();[-9,9].forEach(x=>{c.fillStyle='#222';c.beginPath();c.arc(x,-1,4.5,0,6.283);c.fill();c.fillStyle='#777';c.fillRect(x-1,-2,2,2)})});
  mw(cur.mrl,()=>{c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(0,2,18,4,0,0,6.283);c.fill();c.fillStyle='#8b979f';c.fillRect(-12,-12,24,10);c.fillStyle='#5d676d';c.beginPath();c.arc(-10,-4,6,0,6.283);c.arc(10,-4,6,0,6.283);c.fill();c.strokeStyle='#333';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(-10,-10);c.lineTo(-28,-30);c.stroke()});
  mw(cur.mro,()=>{c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(0,3,15,4,0,0,6.283);c.fill();gr=c.createLinearGradient(0,-14,0,0);gr.addColorStop(0,'#fff');gr.addColorStop(1,'#cfd3c8');c.fillStyle=gr;c.beginPath();c.ellipse(0,-5,16,9,0,0,6.283);c.fill();c.fillStyle='#2a78d6';c.fillRect(-7,-9,14,4)});
  /* pes */
  if(cur.p.dog>.02){const du=.5+.38*Math.sin(T*.25),dir=Math.cos(T*.25)>0?1:-1,q=at(du,.85),ph=T*7;
    const sp=at(.34,.85);c.save();c.globalAlpha=cur.p.dog*.8;c.fillStyle='rgba(205,180,40,.7)';c.beginPath();c.ellipse(sp.x,sp.y,9,3,0,0,6.283);c.fill();c.restore();
    c.save();c.globalAlpha=cur.p.dog;c.translate(q.x,q.y);c.scale(dir*q.s*1.25,q.s*1.25);
    c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.ellipse(0,1,18,3,0,0,6.283);c.fill();
    c.strokeStyle='#8a5630';c.lineWidth=3.4;c.lineCap='round';[[-9,0],[-5,Math.PI],[8,Math.PI],[12,0]].forEach(l=>{c.beginPath();c.moveTo(l[0],-10);c.lineTo(l[0]+Math.sin(ph+l[1])*5,0);c.stroke()});
    c.fillStyle='#a8703f';c.beginPath();c.ellipse(1,-13,16,7,0,0,6.283);c.fill();c.beginPath();c.arc(18,-18,6.5,0,6.283);c.fill();
    c.fillStyle='#7d4e2a';c.beginPath();c.ellipse(15,-20,2.6,5,.5,0,6.283);c.fill();c.fillStyle='#2b1a0e';c.beginPath();c.arc(23,-17,1.8,0,6.283);c.fill();c.arc(20,-19,.9,0,6.283);c.fill();
    c.strokeStyle='#a8703f';c.lineWidth=3;c.beginPath();c.moveTo(-14,-14);c.quadraticCurveTo(-22,-24+Math.sin(T*12)*3,-20,-28);c.stroke();c.restore()}
  /* půdní řez, pravítko plochy */
  const sc=cur.soil;gr=c.createLinearGradient(0,252,0,H);gr.addColorStop(0,rgb(mix(sc,[0,0,0],.0)));gr.addColorStop(1,rgb(mix(sc,[0,0,0],.28)));c.fillStyle=gr;c.fillRect(0,252,W,H-252);
  c.fillStyle='rgba(0,0,0,.28)';for(let i=0;i<26;i++){const px=(i*53.7)%W,py=258+((i*31)%26);c.beginPath();c.arc(px,py,1+(i%3)*.6,0,6.283);c.fill()}
  c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=2;c.beginPath();c.moveTo(20,277);c.lineTo(400,277);c.moveTo(20,271);c.lineTo(20,283);c.moveTo(400,271);c.lineTo(400,283);c.stroke();
  c.fillStyle='#f0c02a';c.beginPath();c.roundRect(154,266,112,22,11);c.fill();c.fillStyle='#241d00';c.font='700 14px "Young Serif",Georgia,serif';c.textAlign='center';c.fillText(fmt(S.area,0)+' m²',210,281);
}

    return { build: buildScene, update: function () { updateScene(); }, snap: snap };
  }
})();
