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
  /* Popis potíží lidskou řečí + malá ilustrace (Martin 2026-11-22: zákazník ježatku nebo lipnici nepozná) */
  var PHELP = {
    pale: ['Tráva bledne nebo žloutne', '', 'Celý trávník je světlejší, než by měl být.'],
    thin: ['Tráva řídne, prosvítá půda', '', 'Mezi stébly je vidět zem.'],
    bare: ['Holá místa bez trávy', '', 'Plochy, kde nic neroste.'],
    moss: ['Měkký tmavozelený koberec místo trávy', 'mech', 'Nejčastěji ve stínu a ve vlhku.'],
    weeds: ['Kytky a široké listy', 'plevel', 'Třeba pampelišky, jetel nebo jitrocel.'],
    poa: ['Světlé trsy, na jaře s bílými klásky', 'lipnice roční', 'Světlejší než zbytek trávníku a brzy kvete.'],
    crabgrass: ['Široké ploché listy do hvězdice, od léta', 'ježatka', 'Po prvních mrazech zežloutne a odumře.'],
    spots: ['Hnědé nebo žluté skvrny a kruhy', 'houbová choroba', 'Skvrny rostou nebo tvoří kruhy.'],
    snowmold: ['Na jaře šedobílé kruhy po tání sněhu', 'plíseň sněžná', 'Stébla jsou slepená a zplihlá.'],
    grubs: ['Trávník jde zvednout jako koberec', 'ponravy', 'Kořeny jsou ukousané, vrány nebo krtci to rozrývají.'],
    thatch: ['Pod trávou je houbovitá spleť stébel', 'plsť', 'Povrch se pod nohou prohýbá jako koberec.'],
    compaction: ['Tvrdá udusaná půda, po dešti kaluže', 'utužení', 'Typicky stezka, kudy se chodí.'],
    dog: ['Pes tam chodí', '', 'Žluté skvrny se zeleným okrajem.']
  };
  var PGROUPS = [['Samotná tráva', ['pale', 'thin', 'bare']], ['Něco roste, co tam nemá', ['moss', 'weeds', 'poa', 'crabgrass']], ['Skvrny a choroby', ['spots', 'snowmold', 'grubs', 'dog']], ['Půda pod trávou', ['thatch', 'compaction']]];
  var THUMBS = {};
  function thumb(key) {
    if (THUMBS[key]) return THUMBS[key];
    var cv = document.createElement('canvas'); cv.width = 224; cv.height = 140; var c = cv.getContext('2d'), r = 7;
    var rn = function () { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
    function lawn(h, s, l, dens, ln) {
      var g = c.createLinearGradient(0, 0, 0, 140); g.addColorStop(0, 'hsl(' + h + ',' + s + '%,' + (l - 8) + '%)'); g.addColorStop(1, 'hsl(' + h + ',' + s + '%,' + (l - 16) + '%)'); c.fillStyle = g; c.fillRect(0, 0, 224, 140); c.lineCap = 'round';
      for (var i = 0; i < dens; i++) { var x = rn() * 224, y = 10 + rn() * 130, L = (ln || 13) * (.6 + rn() * .8) * (.5 + y / 140); c.strokeStyle = 'hsl(' + (h + rn() * 16 - 6) + ',' + s + '%,' + (l - 6 + rn() * 16) + '%)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + rn() * 5 - 2, y - L * .6, x + rn() * 9 - 4, y - L); c.stroke(); }
    }
    function blob(x, y, rx, ry, col, a) { c.save(); c.globalAlpha = a == null ? 1 : a; c.fillStyle = col; c.beginPath(); for (var k = 0; k < 14; k++) { var an = k / 14 * 6.283, f = .8 + rn() * .4; if (k) c.lineTo(x + Math.cos(an) * rx * f, y + Math.sin(an) * ry * f); else c.moveTo(x + Math.cos(an) * rx * f, y + Math.sin(an) * ry * f); } c.closePath(); c.fill(); c.restore(); }
    function blades(x, y, n, spread, col, len, w) { c.strokeStyle = col; c.lineWidth = w || 1.6; c.lineCap = 'round'; for (var i = 0; i < n; i++) { var a = -1.57 + (rn() - .5) * spread; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len * (.6 + rn() * .5), y + Math.sin(a) * len * (.6 + rn() * .5)); c.stroke(); } }
    var i, x, y, j, k;
    if (key === 'moss') { lawn(100, 45, 36, 380); for (i = 0; i < 3; i++) { x = 40 + i * 70 + rn() * 20; y = 60 + rn() * 50; blob(x, y, 34, 17, '#1f4a2a'); for (j = 0; j < 90; j++) { c.fillStyle = 'hsl(' + (110 + rn() * 20) + ',50%,' + (24 + rn() * 12) + '%)'; c.fillRect(x + (rn() - .5) * 64, y + (rn() - .5) * 30, 2, 2); } } }
    else if (key === 'weeds') { lawn(100, 48, 34, 420); for (i = 0; i < 4; i++) { x = 30 + i * 55 + rn() * 14; y = 80 + rn() * 40; for (k = 0; k < 7; k++) { c.fillStyle = '#3d7a2c'; c.save(); c.translate(x, y); c.rotate(k / 7 * 6.283); c.beginPath(); c.ellipse(14, 0, 14, 4, 0, 0, 6.283); c.fill(); c.restore(); } c.strokeStyle = '#4f8f3f'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2, y - 26); c.stroke(); c.fillStyle = '#f6dc2c'; c.beginPath(); c.arc(x + 2, y - 28, 7, 0, 6.283); c.fill(); c.fillStyle = '#e8b81c'; c.beginPath(); c.arc(x + 2, y - 28, 3, 0, 6.283); c.fill(); } }
    else if (key === 'bare') { lawn(100, 45, 34, 360); blob(60, 90, 40, 20, '#7a5a3a'); blob(160, 55, 30, 15, '#7a5a3a'); for (i = 0; i < 70; i++) { c.fillStyle = 'rgba(60,40,24,.5)'; c.fillRect(30 + rn() * 70, 76 + rn() * 28, 2, 2); c.fillRect(135 + rn() * 50, 45 + rn() * 22, 2, 2); } }
    else if (key === 'thatch') { c.fillStyle = '#5b4028'; c.fillRect(0, 96, 224, 44); c.fillStyle = '#2f6b2b'; c.fillRect(0, 0, 224, 50); c.strokeStyle = '#4f9a3f'; c.lineWidth = 1.5; for (i = 0; i < 160; i++) { x = rn() * 224; c.beginPath(); c.moveTo(x, 50); c.lineTo(x + rn() * 6 - 3, 6 + rn() * 28); c.stroke(); } c.fillStyle = '#b3935a'; c.fillRect(0, 50, 224, 46); for (i = 0; i < 240; i++) { c.strokeStyle = i % 3 ? '#8c6b3a' : '#d2b87a'; c.lineWidth = 1.4; x = rn() * 224; y = 52 + rn() * 42; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 12 * (rn() - .5) * 2, y + 6 * (rn() - .5) * 2); c.stroke(); } c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '600 11px sans-serif'; c.fillText('plsť', 8, 72); }
    else if (key === 'compaction') { lawn(100, 45, 34, 380); c.fillStyle = '#b49d70'; c.beginPath(); c.moveTo(70, 140); c.lineTo(118, 140); c.lineTo(160, 0); c.lineTo(122, 0); c.closePath(); c.fill(); c.strokeStyle = 'rgba(90,70,45,.6)'; c.lineWidth = 1; for (i = 0; i < 8; i++) { c.beginPath(); c.moveTo(90 + i * 4, 128 - i * 16); c.lineTo(98 + i * 4, 122 - i * 16); c.lineTo(93 + i * 4, 116 - i * 16); c.stroke(); } c.fillStyle = '#9fc7df'; c.beginPath(); c.ellipse(142, 70, 22, 7, 0, 0, 6.283); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(136, 68, 10, 3, 0, 3.4, 5.6); c.stroke(); }
    else if (key === 'snowmold') { lawn(62, 30, 56, 300, 9); [[60, 70, 30], [150, 90, 26], [120, 40, 18]].forEach(function (q) { c.save(); c.globalAlpha = .55; c.fillStyle = '#d8d6c8'; c.beginPath(); c.ellipse(q[0], q[1], q[2], q[2] * .6, 0, 0, 6.283); c.fill(); c.globalAlpha = .9; c.strokeStyle = '#ecebe2'; c.lineWidth = 5; c.stroke(); c.restore(); }); }
    else if (key === 'poa') { lawn(100, 48, 34, 420); for (i = 0; i < 5; i++) { x = 30 + i * 44 + rn() * 12; y = 108 + rn() * 14; blades(x, y, 16, 1.8, '#b5da72', 22, 2); for (var k2 = 0; k2 < 3; k2++) { var sx = x + (k2 - 1) * 7; c.strokeStyle = '#e9f2cf'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(sx, y - 6); c.lineTo(sx + (k2 - 1) * 2, y - 38); c.stroke(); for (var t = 0; t < 5; t++) { c.fillStyle = '#fff'; c.fillRect(sx + (k2 - 1) * 2 * t / 5 - 1.5, y - 38 + t * 5, 3, 2); } } } }
    else if (key === 'crabgrass') { lawn(100, 48, 34, 400); [[70, 92], [154, 70]].forEach(function (q) { for (var kk = 0; kk < 11; kk++) { var an = kk / 11 * 6.283; c.strokeStyle = kk % 2 ? '#a9cf5e' : '#bcd978'; c.lineWidth = 4.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(q[0], q[1]); c.quadraticCurveTo(q[0] + Math.cos(an) * 14, q[1] + Math.sin(an) * 6 - 3, q[0] + Math.cos(an) * 34, q[1] + Math.sin(an) * 12); c.stroke(); } c.fillStyle = '#7ea23a'; c.beginPath(); c.arc(q[0], q[1], 4, 0, 6.283); c.fill(); }); }
    else if (key === 'spots') { lawn(100, 48, 34, 420); [[60, 80, 24], [150, 60, 18], [165, 108, 14]].forEach(function (q) { c.fillStyle = '#c8ae48'; c.beginPath(); c.arc(q[0], q[1], q[2], 0, 6.283); c.fill(); c.strokeStyle = '#7e6a2a'; c.lineWidth = 3; c.stroke(); for (var jj = 0; jj < 20; jj++) { c.fillStyle = 'rgba(120,95,30,.5)'; c.fillRect(q[0] + (rn() - .5) * q[2] * 1.6, q[1] + (rn() - .5) * q[2] * 1.6, 2, 2); } }); }
    else if (key === 'grubs') { lawn(100, 48, 34, 400); c.fillStyle = '#6b4a2f'; c.fillRect(50, 60, 130, 62); c.fillStyle = '#e3d6b4'; c.beginPath(); c.moveTo(50, 60); c.lineTo(180, 60); c.lineTo(150, 28); c.lineTo(78, 24); c.closePath(); c.fill(); c.strokeStyle = '#f2ead2'; c.lineWidth = 1.2; for (i = 0; i < 40; i++) { x = 60 + rn() * 100; c.beginPath(); c.moveTo(x, 58); c.lineTo(x + rn() * 6 - 3, 34 + rn() * 18); c.stroke(); } [[76, 92], [118, 100], [150, 84]].forEach(function (q) { c.strokeStyle = '#f4efe0'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.arc(q[0], q[1], 10, .6, 5.4); c.stroke(); c.fillStyle = '#a5702f'; c.beginPath(); c.arc(q[0] + 9, q[1] + 9, 4.2, 0, 6.283); c.fill(); }); }
    else if (key === 'pale') { lawn(66, 52, 48, 420); }
    else if (key === 'thin') { lawn(100, 45, 34, 90); c.globalAlpha = .55; c.fillStyle = '#7a5a3a'; for (i = 0; i < 160; i++) c.fillRect(rn() * 224, 30 + rn() * 110, 3, 2); c.globalAlpha = 1; }
    else if (key === 'dog') { lawn(100, 48, 34, 420); [[62, 84, 18], [150, 56, 15], [168, 106, 13]].forEach(function (q) { c.fillStyle = '#4c9a2c'; c.beginPath(); c.arc(q[0], q[1], q[2] + 6, 0, 6.283); c.fill(); c.fillStyle = '#d5c248'; c.beginPath(); c.arc(q[0], q[1], q[2], 0, 6.283); c.fill(); }); }
    else lawn(100, 45, 34, 300);
    var g2 = c.createLinearGradient(0, 0, 0, 140); g2.addColorStop(.7, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = g2; c.fillRect(0, 0, 224, 140);
    return (THUMBS[key] = cv.toDataURL('image/jpeg', .82));
  }
  function probTile(k) { var h = PHELP[k]; return '<button type="button" class="qz-chip qz-prob" data-p="' + k + '" aria-pressed="false"><img src="' + thumb(k) + '" alt="" width="112" height="70" loading="lazy"><b>' + esc(h[0]) + '</b>' + (h[1] ? '<em>odborně: ' + esc(h[1]) + '</em>' : '') + '<span>' + esc(h[2]) + '</span></button>'; }
  function probsHTML() { return PGROUPS.map(function (g) { return '<div class="qz-q"><span class="qz-lab">' + g[0] + '</span><div class="qz-probs">' + g[1].map(probTile).join('') + '</div></div>'; }).join('') + '<p class="qz-hint">Obrázky jsou jen ilustrace. Nevíte nebo nic nevidíte? Nechte prázdné, plán pak počítá s běžným stavem trávníku.</p>'; }
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
  var S = { doy: 196, clim: null, area: 150, tier: '', sun: 'full', soil: 'unknown', irr: '', mow: '', mower: 'rotary', mowh: 3.5, age: '', grass: '', probs: new Set() };
  var Q = { doy: 196, clim: null, form: null, step: 0, max: 0, scene: null, msg: '', r: null, need: [], dbt: null };

  /* --- formulář je zdroj pravdy --- */
  function val(id) { var e = Q.form.querySelector('#' + id); return e ? e.value : ''; }
  function readS() {
    var f = Q.form, ar = Number(val('area')), t = f.querySelector('input[name="tier"]:checked');
    S.doy = Q.doy; S.clim = Q.clim;
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
      '<div class="qz-chips">' + [50, 150, 300, 600, 1200].map(function (a) { return '<button type="button" class="qz-chip" data-area="' + a + '">' + a + ' m²</button>'; }).join('') + '</div><span class="qz-hint">Stačí přibližně. Obrázek ukazuje velikost trávníku vůči domu.</span></div>';
    if (n === 1) h = '<h3>Jaký trávník chcete mít?</h3><div class="qz-tiles two" role="radiogroup" aria-label="Úroveň péče">' + TIERS.map(function (t) { return '<button type="button" class="qz-tile" data-tier="' + t[0] + '" aria-pressed="false" role="radio">' + ICO.h(t[3]) + '<b>' + t[1] + '</b><small>' + t[2] + '</small></button>'; }).join('') + '</div>';
    if (n === 2) h = '<h3>Slunce a půda</h3><div class="qz-q"><span class="qz-lab">Kolik má trávník slunce?</span><div class="qz-tiles">' + tile('sun', 'full', 'Většinu dne', '', ICO.full) + tile('sun', 'partial', 'Polostín', '', ICO.partial) + tile('sun', 'shade', 'Stín', '', ICO.shade) + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Jaká je půda?</span><div class="qz-tiles">' + tile('soil', 'unknown', 'Nevím', '', ICO.soil('#8a7a66')) + tile('soil', 'normal', 'Běžná', 'propustná', ICO.soil('#6b4a2f')) + tile('soil', 'clay', 'Jílovitá', 'těžká', ICO.soil('#8a5532')) + tile('soil', 'sand', 'Písčitá', 'lehká', ICO.soil('#d2b278')) + '</div><span class="qz-hint">Tip: stiskněte hrst vlhké půdy. Drží tvar jako plastelína? Je jílovitá. Sype se? Je písčitá.</span></div><div id="qSoilHost"></div>';
    if (n === 3) h = '<h3>Voda a sečení</h3><div class="qz-q"><span class="qz-lab">Jak trávník zavlažujete?</span><div class="qz-tiles">' + tile('irr', 'auto', 'Automatická závlaha', '', ICO.auto) + tile('irr', 'manual', 'Zalévám ručně', '', ICO.manual) + tile('irr', 'none', 'Nezalévám', '', ICO.none) + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Jak často sekáte?</span><div class="qz-tiles">' + tile('mow', '0.5', 'Za 2 týdny a méně', '') + tile('mow', '1', 'Jednou týdně', '') + tile('mow', '2', '2× týdně a víc', '') + '</div></div>' +
      '<div class="qz-q"><span class="qz-lab">Čím sekáte?</span><div class="qz-tiles">' + tile('mower', 'rotary', 'Rotační', '', ICO.rotary) + tile('mower', 'reel', 'Vřetenová', '', ICO.reel) + tile('mower', 'robot', 'Robotická', '', ICO.robot) + '</div></div>' +
      '<div class="qz-q"><label class="qz-lab" for="qMowH">Na kolik centimetrů sekáte</label><div class="qz-range"><input id="qMowH" type="range" min="1.5" max="8" step="0.5"><span class="qz-val" id="qMowV"></span></div><span class="qz-hint">Táhněte a sledujte, jak se trávník v obrázku zkracuje a prodlužuje.</span></div>';
    if (n === 4) h = '<h3>Co trávník trápí?</h3><p class="qz-hint" style="margin:-4px 0 10px">Podívejte se na obrázky a klikněte na všechno, co na svém trávníku vidíte.</p>' + probsHTML() +
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
    c.innerHTML = '<p class="qz-stepno">Krok ' + (Q.step + 1) + ' z 6 · ' + STEPS[Q.step] + '</p>' + stepHTML(Q.step);
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

  /* --- podnebí místa (průměr posledních let) a posuvník roku --- */
  var MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  function dl(doy) { var d = new Date(2025, 0, Math.round(doy)); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; }
  function doyLabel() { var e = $('qzDoyL'); if (e) e.textContent = dl(Q.doy) + ' · ' + MONTHS[new Date(2025, 0, Q.doy).getMonth()]; }
  function drawClim() {
    var host = $('qzClim'); if (!host) return;
    var c = Q.clim, d = Q.doy, lsf = (c && c.lastSpringFrost) || 110, fau = (c && c.firstAutumnFrost) || 300, s10 = (c && c.soil10) || lsf + 10, sb = (c && c.soilBelow10) || fau;
    var stt = function (x) { return (x < lsf || x > fau) ? 0 : (x >= s10 && x <= sb) ? 2 : 1; };
    var segs = '', run = 1, st0 = stt(1);
    for (var x = 2; x <= 366; x++) { var st = x <= 365 ? stt(x) : -1; if (st !== st0) { segs += '<i class="s' + st0 + '" style="left:' + ((run - 1) / 365 * 100) + '%;width:' + ((x - run) / 365 * 100) + '%"></i>'; run = x; st0 = st; } }
    var state = stt(d), msg = state === 0 ? 'Mrazy: na zmrzlý trávník nechodit a nic na něj nerozhazovat.' : state === 1 ? 'Bez mrazu, ale půda je pod 10 °C: žádná vertikutace, aerifikace ani dosev.' : 'Půda je nad 10 °C: tráva roste a je sezóna péče.';
    var rows = [];
    if (c) {
      rows.push(['Poslední jarní mráz', 'kolem ' + dl(lsf)], ['První podzimní mráz', 'kolem ' + dl(fau)], ['Půda nad 10 °C', 'od ' + dl(s10) + ' do ' + dl(sb) + ' (asi ' + Math.max(0, sb - s10) + ' dní)']);
      if (c.frostDays != null) rows.push(['Dnů s mrazem za rok', Math.round(c.frostDays)]);
      if (c.hotDays != null) rows.push(['Tropických dnů (30 °C a víc)', Math.round(c.hotDays)]);
      if (c.rainYear) rows.push(['Srážky za rok', Math.round(c.rainYear) + ' mm']);
      if (c.elevation != null) rows.push(['Nadmořská výška', Math.round(c.elevation) + ' m']);
      if (c.galeDays != null) rows.push(['Dnů se silným větrem', Math.round(c.galeDays)]);
    }
    host.innerHTML = '<h4>Podnebí u vás' + (c ? '<span>' + esc(c.place || '') + ' · průměr ' + esc(c.years) + ' let</span>' : '') + '</h4>' +
      '<div class="qz-yr"><div class="qz-yb">' + segs + '<b class="qz-cur" style="left:' + (d / 365 * 100) + '%"></b></div><div class="qz-ym">' + MONF.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div></div>' +
      '<p class="qz-cl"><span><i class="s0"></i>mrazy</span><span><i class="s1"></i>bez mrazu, půda pod 10 °C</span><span><i class="s2"></i>půda nad 10 °C</span></p>' +
      '<p class="qz-cstate">' + msg + '</p>' +
      (c ? '<dl class="qz-cg">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl><p class="qz-hint">Průměr posledních ' + esc(c.years) + ' let z družicových dat (ERA5-Land, mřížka asi 9 km). Údaje jsou orientační, skutečné počasí se může lišit.</p>'
        : '<p class="qz-hint">Tohle je typický rok. Doplňte obec a ukážeme podnebí u vás.</p>');
  }
  /* --- veřejné rozhraní pro plan-page.js --- */
  function init(opts) {
    Q.form = opts.form; var host = $('qz'); if (!host || Q.inited) return; Q.inited = true;
    Q.soilNode = Q.form.querySelector('details.soil');
    host.innerHTML = '<div class="qz-grid"><aside class="qz-live" aria-label="Živý náhled vašeho trávníku"><div class="qz-scenebox"><canvas id="qzScene" role="img" aria-label="Živý obrázek vašeho trávníku podle odpovědí"></canvas><div class="qz-bubble" id="qzBubble" aria-live="polite">Tohle je váš trávník. Klikejte a sledujte, jak se mění.</div><div class="qz-season"><label for="qzDoy"><b>Rok na trávníku</b><span id="qzDoyL"></span></label><input type="range" id="qzDoy" min="1" max="365" value="196" aria-label="Posunout rok"><a class="qz-clink" href="#qzClim">Podnebí u vás ↓</a></div></div>' +
      '<div class="qz-panel"><div class="qz-score" id="qzScore"></div><div class="qz-strip" id="qzStrip" aria-label="Měsíce hnojení"></div><p class="qz-hint" id="qzHint"></p></div><div class="qz-panel qz-seasonbox"><div class="qz-clim" id="qzClim"></div></div></aside>' +
      '<section class="qz-steps"><ol class="qz-prog" id="qzProg"></ol><div class="qz-card" id="qzCard"></div><div class="qz-nav"><button type="button" class="qz-btn ghost" id="qzBack">Zpět</button><button type="button" class="qz-btn" id="qzNext">Další</button></div></section></div>';
    readS();
    Q.scene = makeScene($('qzScene'), S);
    Q.scene.build(); Q.scene.update(S); Q.scene.snap();
    drawClim(); doyLabel(); $('qzDoy').oninput = function () { Q.doy = +this.value; S.doy = Q.doy; Q.scene.update(S); doyLabel(); drawClim(); };
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
  window.MVGreenQuiz = { makeScene: makeScene, init: init, update: update, refresh: refresh, setClimate: function (c) { Q.clim = (c && c.years) ? c : null; if (!Q.inited) return; readS(); Q.scene.update(S); drawClim(); } };

  function makeScene(cv, S) {
/* --- scéna: živá animace v canvasu (vítr v trávě, kapky vody s gravitací, sekačka, která opravdu seče a trávník pak dorůstá) --- */
const cx=cv.getContext('2d'),W=420,H=336,RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let LOD=0,ema=0,nf=0;/* na slabším telefonu se podle času snímku sníží počet stébel a rozlišení */
function fitCanvas(){const r=LOD>=2?1:Math.min(2,window.devicePixelRatio||1)*1.5;cv.width=W*r;cv.height=H*r;cx.setTransform(r,0,0,r,0,0)}
let rs=11;const rnd=()=>{rs=(rs*16807)%2147483647;return (rs-1)/2147483646};
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const rgb=(c,a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const PKEYS=['moss','weeds','bare','compaction','snowmold','poa','crabgrass','spots','grubs','dog','thatch','pale','thin'];
const tgt={sunH:1,frost:0,snow:0,dorm:0,sun:1,cloud:0,dark:0,dry:0,wet:0,hs:1,dens:1,ls:1,stripe:0,tree:1,ia:0,im:0,mr:1,mrl:0,mro:0,soil:hex('#6b4a2f'),grass:hex('#3f8a3a'),tvar:0,tw:1,edge:0,goal:0,flow:0,ball:0,clay:0,sand:0,p:{}};
PKEYS.forEach(k=>tgt.p[k]=0);
const cur=JSON.parse(JSON.stringify(tgt));
const bl=[];let T=0,parts=[],clips=[];
const PATCH={moss:[[.22,.3,.1],[.7,.55,.11],[.45,.88,.08]],bare:[[.35,.7,.07],[.78,.28,.06],[.12,.6,.06]],compaction:[[.5,.9,.3]],snowmold:[[.3,.4,.09],[.72,.72,.1]],poa:[[.15,.62,.08],[.62,.2,.07],[.88,.85,.09]],crabgrass:[[.4,.25,.07],[.1,.9,.08],[.68,.6,.07]],spots:[[.25,.78,.06],[.55,.5,.07],[.85,.3,.05]],grubs:[[.45,.6,.1],[.8,.8,.08]]};
const WEEDS=[[.15,.3],[.3,.6],[.6,.35],[.85,.78],[.5,.75],[.08,.8],[.72,.9],[.9,.4]];
function buildScene(){
  fitCanvas();rs=11;bl.length=0;
  for(let i=0;i<1700;i++){const b={u:rnd(),v:Math.pow(rnd(),.85),r:rnd(),hv:.75+rnd()*.5,ph:rnd()*6.28,c:(rnd()*3)|0,cut:1,hide:''};bl.push(b)}
  bl.sort((a,b)=>a.v-b.v);
  bl.forEach(b=>{for(const k of ['bare','grubs']){(PATCH[k]||[]).forEach(p=>{const dx=(b.u-p[0])/p[2],dy=(b.v-p[1])/(p[2]*1.8);if(dx*dx+dy*dy<1)b.hide=k})}
    {const pu=.42+.2*Math.sin(b.v*3.2+.6);if(Math.abs(b.u-pu)<.07&&!b.hide)b.hide='compaction'}});
  snap();
  if(RM)draw();else requestAnimationFrame(frame);
}
function snap(){Object.keys(tgt).forEach(k=>{if(k==='p')PKEYS.forEach(q=>cur.p[q]=tgt.p[q]);else if(Array.isArray(tgt[k]))cur[k]=tgt[k].slice();else cur[k]=tgt[k]})}
function updateScene(){
  const s=S.sun;tgt.sun=s==='shade'?0:s==='partial'?.75:1;tgt.cloud=s==='full'?0:s==='partial'?.6:1;tgt.dark=s==='shade'?.42:s==='partial'?.12:0;tgt.tree=s==='shade'?1.22:1;
  tgt.soil=hex({unknown:'#7a5a3a',normal:'#6b4a2f',clay:'#8a5532',sand:'#d2b278'}[S.soil]);
  tgt.ls=clamp(.55+.5*Math.log(S.area/20)/Math.log(100),.55,1.06);
  const TP=({low:{d:.5,v:1,w:1.35,e:0,g:0,f:1,b:0,s:0,col:'#78a03c'},standard:{d:.8,v:.45,w:1.1,e:0,g:0,f:0,b:1,s:0,col:'#3f8a3a'},representative:{d:1,v:0,w:.8,e:1,g:0,f:0,b:0,s:1.5,col:'#1b6b33'},sportovni:{d:.95,v:0,w:.95,e:0,g:1,f:0,b:0,s:1.3,col:'#2f9f3e'}})[S.tier]||{d:.85,v:.3,w:1,e:0,g:0,f:0,b:0,s:0,col:'#3f8a3a'};
  tgt.hs=Math.max(.35,S.mowh/3.5);tgt.dens=Math.min(TP.d*(S.soil==='sand'?.85:1),S.age==='new'?.3:1,S.probs.has('thin')?.55:1);
  tgt.tvar=TP.v;tgt.tw=TP.w;tgt.edge=TP.e;tgt.goal=TP.g;tgt.flow=TP.f;tgt.ball=TP.b;tgt.clay=S.soil==='clay'?1:0;tgt.sand=S.soil==='sand'?1:0;
  tgt.stripe=Math.max(TP.s,S.mower==='reel'?1:0);
  tgt.dry=S.irr==='none'?.7:0;tgt.wet=S.irr==='auto'?.55:S.irr==='manual'?.3:0;
  tgt.ia=S.irr==='auto'?1:0;tgt.im=S.irr==='manual'?1:0;tgt.mr=S.mower==='rotary'?1:0;tgt.mrl=S.mower==='reel'?1:0;tgt.mro=S.mower==='robot'?1:0;
  tgt.grass=mix(hex(TP.col),S.grass==='rye'?[120,190,80]:S.grass==='fescue'?[10,60,30]:[0,0,0],S.grass==='rye'||S.grass==='fescue'?.18:0);tgt.dry=Math.max(tgt.dry,S.soil==='sand'?.22:0);
  PKEYS.forEach(k=>tgt.p[k]=S.probs.has(k)?1:0);tgt.p.bare=(S.probs.has('bare')||S.age==='new')?1:0;
  /* roční doba z podnebí místa: mráz, půda pod 10 °C (tráva odpočívá), sníh, vedro */
  {const cl=S.clim||{lastSpringFrost:110,firstAutumnFrost:300,soil10:115,soilBelow10:300,frostDays:90,hotDays:4,rainYear:700},d=S.doy||196,lsf=cl.lastSpringFrost||110,fau=cl.firstAutumnFrost||300,s10=cl.soil10||lsf+10,sb=cl.soilBelow10||fau;
    tgt.sunH=.5+.5*Math.sin((d-80)/365*6.2832);
    tgt.frost=Math.max(clamp((lsf+4-d)/8),clamp((d-fau+4)/8));
    tgt.dorm=Math.max(clamp((s10+7-d)/14),clamp((d-sb+7)/14));
    const win=clamp(1-Math.min(Math.abs(d-20),Math.abs(d-385))/50);
    tgt.snow=Math.min(.9,win*clamp(((cl.frostDays==null?90:cl.frostDays)-45)/70))*(tgt.frost>.5?1:0);
    const heat=clamp(1-Math.abs(d-200)/45)*clamp((cl.hotDays==null?3:cl.hotDays)/10)*(1-clamp((cl.rainYear||700)/1000)*.3);
    tgt.dry=Math.max(tgt.dry,heat*(S.irr==='auto'?.15:S.irr==='manual'?.45:.9));
    tgt.cloud=Math.max(tgt.cloud,(1-tgt.sunH)*.5);tgt.dark=Math.max(tgt.dark,tgt.snow*.12)}
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
  if(cur.dorm>.55||cur.snow>.1){M.wait=Math.max(M.wait,1);return}
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
  if(cur.ia>.05&&cur.dorm<.5)[.2,.5,.8].forEach((u,i)=>{const q=at(u,.4);for(let n=0;n<4;n++){const a=Math.sin(T*1.7+i*2)*1.15+(Math.random()-.5)*.25;parts.push({t:'w',x:q.x,y:q.y,vx:Math.sin(a)*70*q.s*1.3,vy:-(70+Math.random()*30)*q.s,l:0,y0:q.y,s:q.s})}});
  if(cur.im>.05&&cur.dorm<.5){const q=at(.8,.8);for(let n=0;n<7;n++){const a=-1.1+Math.sin(T*.8)*.5+(Math.random()-.5)*.3;parts.push({t:'w',x:q.x-3,y:q.y-8,vx:Math.cos(a)*-55*(.7+Math.random()*.5),vy:-(30+Math.random()*35),l:0,y0:q.y,s:q.s})}}
  if(cur.snow>.15&&Math.random()<.5)parts.push({t:'s',x:Math.random()*W,y:140,vx:6+Math.random()*14,vy:22+Math.random()*20,l:0,y0:0,s:1});
  parts.forEach(p=>{p.l+=dt;p.vy+=(p.t==='w'?230:p.t==='s'?0:150)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt});
  parts=parts.filter(p=>(p.t==='w'?p.y<p.y0+2:p.t==='s'?p.y<258:p.l<.9)).slice(-900);
}
let vis=true;if('IntersectionObserver' in window)new IntersectionObserver(function(en){vis=en[0].isIntersecting}).observe(cv);
function frame(ts){if(!vis||document.hidden){frame.l=ts;requestAnimationFrame(frame);return}const dt=Math.min(.05,(ts-(frame.l||ts))/1000||.016);frame.l=ts;T+=dt;const a0=performance.now();step(dt);draw();const cost=performance.now()-a0;ema=ema*.92+cost*.08;if(++nf>45&&ema>(LOD?26:18)&&LOD<2){LOD++;ema=0;nf=0;fitCanvas()}requestAnimationFrame(frame)}

function draw(){
  const g=geo(),c=cx,wind=.55+.35*Math.sin(T*.4)+.2*Math.sin(T*1.3);
  c.clearRect(0,0,W,H);
  /* sezóna z podnebí: v zimě mráz a sníh, ve vedru sucho, na podzim barevné listí */
  const sunH=cur.sunH,dk=clamp(cur.dark/.42),wi=clamp(1-sunH),sCol=(col,k=1)=>mix(mix(col,[146,140,98],cur.dorm*.38*k),[236,241,247],cur.snow*.78*k);
  const lf=clamp(1-cur.dorm*1.1),ac=clamp(cur.dorm*1.7)*(1-clamp((cur.dorm-.75)*4));
  /* nebe */
  const sky1=mix(mix(hex('#4fa6e8'),hex('#8da5b6'),wi*.6),hex('#9aa8ae'),dk),sky2=mix(mix(hex('#e1f2fa'),hex('#dde2e3'),wi*.5),hex('#cdd5d7'),dk);
  let gr=c.createLinearGradient(0,0,0,165);gr.addColorStop(0,rgb(sky1));gr.addColorStop(1,rgb(sky2));c.fillStyle=gr;c.fillRect(0,0,W,165);
  gr=c.createLinearGradient(0,95,0,165);gr.addColorStop(0,'rgba(255,238,205,0)');gr.addColorStop(1,`rgba(255,238,205,${.4*(1-dk)})`);c.fillStyle=gr;c.fillRect(0,95,W,70);
  /* slunce: jen záře, v zimě níž a slabší */
  if(cur.sun>.02){const sx=70+(1-cur.sun)*30,sy=70-26*sunH;c.save();c.globalAlpha=cur.sun*(.5+.5*sunH);
    gr=c.createRadialGradient(sx,sy,6,sx,sy,150);gr.addColorStop(0,'rgba(255,240,170,.8)');gr.addColorStop(.25,'rgba(255,236,160,.28)');gr.addColorStop(1,'rgba(255,236,160,0)');c.fillStyle=gr;c.fillRect(0,0,300,200);
    gr=c.createRadialGradient(sx,sy,2,sx,sy,22);gr.addColorStop(0,'#fffdf0');gr.addColorStop(.6,'#fff1a8');gr.addColorStop(1,'rgba(255,230,120,0)');c.fillStyle=gr;c.beginPath();c.arc(sx,sy,22,0,6.283);c.fill();c.restore()}
  /* ptáci */
  const bw=clamp(1-cur.dorm*.6)*(1-dk);if(bw>.05)for(let k=0;k<3;k++){const bx=((T*16+k*140)%560)-60,by=44+k*15+Math.sin(T*.9+k)*4,fl=Math.sin(T*9+k*2)*3;c.save();c.globalAlpha=bw*.7;c.strokeStyle='#2c3a36';c.lineWidth=1.4;c.lineCap='round';c.beginPath();c.moveTo(bx-6,by-fl);c.quadraticCurveTo(bx-2,by-3,bx,by);c.quadraticCurveTo(bx+2,by-3,bx+6,by-fl);c.stroke();c.restore()}
  /* mraky: nadýchané, světlé nahoře a stínované dole, pomalu se unášejí */
  const cl0=mix(mix([255,255,255],[236,240,246],wi),[196,202,206],dk),cl1=mix([170,184,205],[130,136,142],dk);
  for(let i=0;i<5;i++){const vs=clamp(cur.cloud*5-i,0,1);if(vs<=.01)continue;const x=((T*(4+i*1.6)+i*110)%560)-70,y=24+i*17+(i%2)*10,s2=.8+i*.12;
    c.save();c.globalAlpha=vs*.96;c.translate(x,y);c.scale(s2,s2);
    [[0,0,22],[-24,5,16],[24,6,17],[9,-9,15],[-10,-7,14],[38,9,11],[-38,9,11],[-2,8,18]].forEach(p=>{const g2=c.createRadialGradient(p[0]-p[2]*.25,p[1]-p[2]*.45,p[2]*.1,p[0],p[1],p[2]);g2.addColorStop(0,rgb(cl0));g2.addColorStop(.7,rgb(mix(cl0,cl1,.45),.9));g2.addColorStop(1,rgb(cl1,0));c.fillStyle=g2;c.beginPath();c.arc(p[0],p[1],p[2],0,6.283);c.fill()});c.restore()}
  /* kopce v dálce, louka, stromořadí */
  [[128,'#a5c19b',.012,10,.35],[140,'#86ac78',.019,8,.15]].forEach((h,hi)=>{c.fillStyle=rgb(sCol(mix(hex(h[1]),sky2,h[4])));c.beginPath();c.moveTo(0,168);for(let x=0;x<=W;x+=14){c.lineTo(x,h[0]+Math.sin(x*h[2]+hi*2)*h[3]+Math.sin(x*h[2]*2.7+hi)*h[3]*.4)}c.lineTo(W,168);c.closePath();c.fill()});
  gr=c.createLinearGradient(0,150,0,252);gr.addColorStop(0,rgb(sCol(hex('#b8d19a'))));gr.addColorStop(1,rgb(sCol(hex('#92b46f'))));c.fillStyle=gr;c.fillRect(0,150,W,102);
  for(let k=0;k<34;k++){const tx=k*13+((k*37)%9),tr=7+((k*53)%7),ty=150-tr*.2+((k*17)%5);c.fillStyle=rgb(sCol(mix(mix(hex('#4f8a46'),hex('#d2892f'),ac),[112,96,72],1-lf),.7));c.beginPath();c.arc(tx+Math.sin(T*.8+k)*.4,ty,tr,0,6.283);c.fill()}
  /* živý plot */
  for(let k=0;k<26;k++){const hx=k*11+3,hy=156+((k*13)%4),hr=8+((k*7)%4);gr=c.createRadialGradient(hx-3,hy-4,1,hx,hy,hr);gr.addColorStop(0,rgb(sCol(hex('#5fa04e'))));gr.addColorStop(1,rgb(sCol(hex('#2f6a2e'))));c.fillStyle=gr;c.beginPath();c.arc(hx,hy,hr,0,6.283);c.fill()}
  /* dům: stěna, střecha s taškami, komín, okna s odrazem, dveře, stín na zemi */
  c.fillStyle='rgba(0,30,10,.2)';c.beginPath();c.ellipse(348,161,58,4,0,0,6.283);c.fill();
  gr=c.createLinearGradient(300,0,390,0);gr.addColorStop(0,'#f4ebd8');gr.addColorStop(1,'#dcd0b6');c.fillStyle=gr;c.fillRect(300,96,90,64);c.fillStyle='rgba(0,0,0,.08)';c.fillRect(300,96,90,5);
  c.fillStyle='#a6503a';c.beginPath();c.moveTo(288,99);c.lineTo(345,58);c.lineTo(402,99);c.closePath();c.fill();
  c.strokeStyle='rgba(60,20,10,.24)';c.lineWidth=1;for(let k=0;k<6;k++){const yy=66+k*6,hw=(yy-58)*1.39;c.beginPath();c.moveTo(345-hw,yy);c.lineTo(345+hw,yy);c.stroke()}
  if(cur.snow>.05){c.fillStyle=`rgba(244,248,252,${cur.snow*.92})`;c.beginPath();c.moveTo(345,58);c.lineTo(299,92);c.lineTo(391,92);c.closePath();c.fill()}
  c.fillStyle='#8a4a3a';c.fillRect(372,62,10,18);c.fillStyle='#6d382c';c.fillRect(370,60,14,3);
  if(cur.dorm>.3)for(let k=0;k<6;k++){const t2=((T*.35+k/6)%1),sxp=377+t2*22+Math.sin(T+k)*3,syp=58-t2*34;c.fillStyle=`rgba(210,214,218,${.34*(1-t2)*clamp(cur.dorm*1.5)})`;c.beginPath();c.arc(sxp,syp,3+t2*7,0,6.283);c.fill()}
  [316,352].forEach(x=>{c.fillStyle='#f8f4e8';c.fillRect(x-2,114,26,30);gr=c.createLinearGradient(0,116,0,142);gr.addColorStop(0,'#b4d9ee');gr.addColorStop(1,'#6fa3c2');c.fillStyle=gr;c.fillRect(x,116,22,26);c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.moveTo(x,116);c.lineTo(x+10,116);c.lineTo(x,128);c.closePath();c.fill();c.fillStyle='#f8f4e8';c.fillRect(x+10,116,2,26);c.fillRect(x,128,22,2);c.fillStyle='#cfc4a8';c.fillRect(x-3,144,28,3)});
  c.fillStyle='#7a5a3a';c.fillRect(336,138,18,22);c.fillStyle='rgba(255,255,255,.18)';c.fillRect(336,138,18,3);c.fillStyle='#d9b552';c.beginPath();c.arc(351,150,1.2,0,6.283);c.fill();
  /* strom: zúžený kmen, větve a koruna z osvětlených chomáčů; na podzim barevná, v zimě holá */
  {const sw=Math.sin(T*.9)*1.4*wind;
  c.save();c.translate(195,160);c.scale(cur.tree,cur.tree);
  c.fillStyle='rgba(0,30,10,.22)';c.beginPath();c.ellipse(26,2,44,6,0,0,6.283);c.fill();
  gr=c.createLinearGradient(-8,0,8,0);gr.addColorStop(0,'#4c3320');gr.addColorStop(.55,'#78553a');gr.addColorStop(1,'#5a3e28');c.fillStyle=gr;c.beginPath();c.moveTo(-8,0);c.quadraticCurveTo(-5,-28,-4,-58);c.lineTo(4,-58);c.quadraticCurveTo(6,-28,8,0);c.closePath();c.fill();
  c.strokeStyle='rgba(30,18,10,.35)';c.lineWidth=1;for(let k=0;k<6;k++){c.beginPath();c.moveTo(-3+k*1.2,-4-k*8);c.lineTo(-2+k*1.2,-12-k*8);c.stroke()}
  c.strokeStyle='#5d4029';c.lineCap='round';[[-22,-60],[24,-62],[0,-82],[-8,-70],[12,-74]].forEach((b,bi)=>{c.lineWidth=3.2;c.beginPath();c.moveTo(0,-50);c.quadraticCurveTo(b[0]*.4,-62,b[0]+sw*.4,b[1]);c.stroke();if(lf<.6){c.lineWidth=1.6;[[-9,-10],[8,-12],[0,-14]].forEach((t,ti)=>{c.beginPath();c.moveTo(b[0]+sw*.4,b[1]);c.lineTo(b[0]+sw*.5+t[0]+(bi%2?3:-3),b[1]+t[1]);c.stroke();c.lineWidth=1;c.beginPath();c.moveTo(b[0]+sw*.5+t[0]*.6,b[1]+t[1]*.6);c.lineTo(b[0]+sw*.5+t[0]*1.1+ti,b[1]+t[1]*1.5);c.stroke();c.lineWidth=1.6})}});
  const CL=[[0,-72,30],[-24,-54,21],[26,-56,23],[2,-90,20],[-12,-78,22],[16,-80,22],[-32,-72,15],[34,-74,15],[0,-60,25],[-18,-92,13],[20,-96,12],[-4,-104,12]];
  if(lf>.02)CL.forEach((l,i)=>{const o=sw*(.5+i*.07),x=l[0]+o,y=l[1],r=l[2],light=mix(mix(hex('#8fd070'),hex('#f0b648'),ac),[236,241,247],cur.snow*.3),dark=mix(hex('#2f6e32'),hex('#b5541f'),ac);
    c.save();c.globalAlpha=lf;const g2=c.createRadialGradient(x-r*.4,y-r*.45,r*.1,x,y,r);g2.addColorStop(0,rgb(light));g2.addColorStop(.55,rgb(mix(light,dark,.55)));g2.addColorStop(1,rgb(dark));c.fillStyle=g2;c.beginPath();c.arc(x,y,r,0,6.283);c.fill();
    for(let k=0;k<7;k++){const a2=k*2.4+i,rr=r*(.25+.6*((k*37+i*11)%10)/10);c.fillStyle=rgb(mix(light,[255,255,220],.25),.5);c.beginPath();c.arc(x+Math.cos(a2)*rr,y+Math.sin(a2)*rr*.8-r*.1,1.6+(k%3),0,6.283);c.fill()}c.restore()});
  c.restore()}
  /* trávník */
  const a=at(0,0),b=at(1,0),d=at(0,1),e=at(1,1);
  const lawn=()=>{c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineTo(e.x,e.y);c.lineTo(d.x,d.y);c.closePath()};
  const base=mix(mix(cur.grass,[128,126,78],cur.dorm*.5),hex('#b9a84a'),cur.dry*.8);
  c.save();lawn();c.fillStyle=rgb(mix(base,[10,40,16],cur.dark*.55));c.fill();c.clip();
  const pathU=v=>.42+.2*Math.sin(v*3.2+.6);
  const pathBand=()=>{const al=cur.p.compaction;if(al<.02)return;c.save();c.globalAlpha=al;c.fillStyle='rgb(172,150,110)';c.beginPath();for(let k=0;k<=12;k++){const v=k/12,q=at(pathU(v)-.055,v);k?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y)}for(let k=12;k>=0;k--){const v=k/12,q=at(pathU(v)+.055,v);c.lineTo(q.x,q.y)}c.closePath();c.fill();c.strokeStyle='rgba(90,70,45,.55)';c.lineWidth=1;for(let k=1;k<12;k++){const v=k/12,q=at(pathU(v)+(k%2?-.02:.02),v);c.beginPath();c.moveTo(q.x-5,q.y);c.lineTo(q.x,q.y-2);c.lineTo(q.x+4,q.y+1);c.stroke()}c.restore()};
  /* pruhy po sekání */
  if(cur.stripe>.02)for(let i=0;i<10;i++){const u0=i/10,u1=(i+1)/10,p0=at(u0,0),p1=at(u1,0),p2=at(u1,1),p3=at(u0,1);c.fillStyle=i%2?`rgba(0,30,10,${.13*cur.stripe})`:`rgba(255,255,255,${.1*cur.stripe})`;c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.lineTo(p2.x,p2.y);c.lineTo(p3.x,p3.y);c.fill()}
  /* skvrny pod stébly */
  const blob=(key,col,sx,sy,soft)=>{const al=cur.p[key];if(al<.02)return;(PATCH[key]||[]).forEach(p=>{const q=at(p[0],p[1]),rx=p[2]*q.hw*2,ry=rx*.3*(.6+q.s*.6);c.save();c.globalAlpha=al;c.translate(q.x,q.y);c.scale(1,ry/rx);gr=c.createRadialGradient(0,0,rx*.2,0,0,rx);gr.addColorStop(0,col);gr.addColorStop(soft,col);gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.beginPath();c.arc(0,0,rx,0,6.283);c.fill();c.restore()})};
  pathBand();blob('bare','rgb(122,90,58)',1,1,.7);blob('grubs','rgb(139,111,61)',1,1,.6);blob('moss','rgb(28,72,34)',1,1,.6);
  blob('poa','rgb(166,214,110)',1,1,.5);blob('crabgrass','rgb(190,222,110)',1,1,.5);blob('spots','rgb(201,180,74)',1,1,.6);
  if(cur.p.snowmold>.02)(PATCH.snowmold).forEach(p=>{const q=at(p[0],p[1]),rx=p[2]*q.hw*2;c.save();c.globalAlpha=cur.p.snowmold;c.strokeStyle='rgba(225,225,215,.9)';c.lineWidth=4;c.beginPath();c.ellipse(q.x,q.y,rx,rx*.3,0,0,6.283);c.stroke();c.restore()});
  if(cur.goal>.02){c.save();c.globalAlpha=cur.goal;c.strokeStyle='rgba(255,255,255,.92)';c.lineWidth=2.2;const A=at(.04,.08),B=at(.96,.08),C=at(.96,.96),D=at(.04,.96);c.beginPath();c.moveTo(A.x,A.y);c.lineTo(B.x,B.y);c.lineTo(C.x,C.y);c.lineTo(D.x,D.y);c.closePath();c.stroke();const m1=at(.04,.5),m2=at(.96,.5),mm=at(.5,.5);c.beginPath();c.moveTo(m1.x,m1.y);c.lineTo(m2.x,m2.y);c.stroke();c.beginPath();c.ellipse(mm.x,mm.y,mm.hw*.22,mm.hw*.22*.28,0,0,6.283);c.stroke();c.restore()}
  /* stín stromu se pomalu posouvá */
  if(cur.dark>.02){const sx=at(.3+.03*Math.sin(T*.07),.45);c.save();c.globalAlpha=cur.dark*1.3;gr=c.createRadialGradient(sx.x,sx.y,10,sx.x,sx.y,150*g.Ls);gr.addColorStop(0,'rgba(0,25,8,.55)');gr.addColorStop(1,'rgba(0,25,8,0)');c.fillStyle=gr;c.fillRect(0,150,W,110);c.restore()}
  /* stébla: tři odstíny, tmavší spodek a světlejší špička, hrají ve větru a v nárazech */
  const pal=[mix(base,[10,50,20],.35),base,mix(base,[150,200,90],.3)].map(col=>mix(mix(col,hex('#b6c960'),cur.p.pale*.55),hex('#8b7a4a'),cur.p.thatch*.3));
  const hsz=cur.hs*(1-cur.dorm*.2)*(1-cur.snow*.55);
  const paths={};
  for(let i=0;i<bl.length;i++){if(LOD&&i%(LOD+1))continue;const q=bl[i];let hf=clamp((cur.dens-q.r)*6);if(q.hide)hf*=1-cur.p[q.hide]*.95;if(hf<.03)continue;
    const P=at(q.u,q.v),hb=(8+q.v*17)*(1+(q.hv-1)*(1+cur.tvar*2.2))*hsz*q.cut*hf,gust=(Math.sin(q.u*7-T*1.9+q.v*2.5)*.5+.5),sway=Math.sin(T*2.1+q.ph+q.u*5+q.v*2)*wind*hb*.16+gust*wind*hb*.1,key=q.c+'_'+(q.v*4|0);
    (paths[key]=paths[key]||[]).push(P.x,P.y,P.x+sway,P.y-hb,hb)}
  c.lineCap='round';
  const wht=clamp(cur.frost*.75+cur.snow*.55);
  Object.keys(paths).sort((x,y)=>x.split('_')[1]-y.split('_')[1]).forEach(key=>{const [ci,vi]=key.split('_'),arr=paths[key],w=(1.1+vi*.45)*cur.tw*(1+LOD*.3),col=mix(mix(pal[ci],[200,222,210],(3-vi)*.045),[8,30,12],cur.dark*.5);
    c.strokeStyle=rgb(mix(col,[6,24,10],.3));c.lineWidth=w;c.beginPath();for(let j=0;j<arr.length;j+=5){c.moveTo(arr[j],arr[j+1]);c.quadraticCurveTo(arr[j]+(arr[j+2]-arr[j])*.3,arr[j+1]-arr[j+4]*.6,arr[j+2],arr[j+3])}c.stroke();
    c.strokeStyle=rgb(mix(mix(col,[198,228,112],.3),[246,250,255],wht));c.lineWidth=w*.85;c.beginPath();for(let j=0;j<arr.length;j+=5){const x0=arr[j],y0=arr[j+1],cx2=x0+(arr[j+2]-x0)*.3,cy2=y0-arr[j+4]*.6,x1=arr[j+2],y1=arr[j+3];c.moveTo(.2025*x0+.495*cx2+.3025*x1,.2025*y0+.495*cy2+.3025*y1);c.lineTo(x1,y1)}c.stroke()});
  /* pampelišky */
  if(cur.p.weeds>.02)WEEDS.forEach((w,i)=>{const q=at(w[0],w[1]),sx=Math.sin(T*2+i)*wind*1.5,h=9*q.s*hsz*.8+4;c.save();c.globalAlpha=cur.p.weeds;c.strokeStyle='#4f8f3f';c.lineWidth=1.2;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x+sx,q.y-h);c.stroke();c.fillStyle='#f6dd3b';c.beginPath();c.arc(q.x+sx,q.y-h,2.6*q.s+1,0,6.283);c.fill();c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(q.x+sx+3,q.y-h-1,1.4,0,6.283);c.fill();c.restore()});
  if(cur.flow>.02)[[.1,.5],[.22,.25],[.35,.8],[.48,.4],[.58,.7],[.7,.3],[.82,.6],[.9,.85],[.15,.9],[.65,.92],[.4,.15]].forEach((w,i)=>{const q=at(w[0],w[1]),sx=Math.sin(T*1.8+i*1.3)*wind*1.6,h=(10+q.s*6)*hsz*.9+3;c.save();c.globalAlpha=cur.flow;c.strokeStyle='#5a9a3f';c.lineWidth=1.2;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x+sx,q.y-h);c.stroke();c.fillStyle=i%3===0?'#f3e66a':'#fff';for(let k=0;k<6;k++){const an=k/6*6.283;c.beginPath();c.ellipse(q.x+sx+Math.cos(an)*2.4*q.s,q.y-h+Math.sin(an)*2.4*q.s,1.5*q.s+.5,.9*q.s+.4,an,0,6.283);c.fill()}c.fillStyle='#e8b020';c.beginPath();c.arc(q.x+sx,q.y-h,1.4*q.s+.4,0,6.283);c.fill();c.restore()});
  if(cur.clay>.02)[[.3,.35,.07],[.66,.62,.09],[.45,.85,.06]].forEach((p,i)=>{const q=at(p[0],p[1]),rx=p[2]*q.hw*2,ry=rx*.28;c.save();c.globalAlpha=cur.clay*.85;gr=c.createLinearGradient(0,q.y-ry,0,q.y+ry);gr.addColorStop(0,'#a9cde4');gr.addColorStop(1,'#6f9fbf');c.fillStyle=gr;c.beginPath();c.ellipse(q.x,q.y,rx,ry,0,0,6.283);c.fill();c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=1;c.beginPath();c.ellipse(q.x-rx*.2,q.y-ry*.2,rx*.45,ry*.35,0,3.6,5.6);c.stroke();const t2=(T*.9+i*.37)%1;c.strokeStyle='rgba(255,255,255,'+(.5*(1-t2))+')';c.beginPath();c.ellipse(q.x,q.y,rx*.3*(1+t2),ry*.3*(1+t2),0,0,6.283);c.stroke();c.restore()});
  /* vlhkost po zalévání, sucho */
  if(cur.wet>.02){c.fillStyle=`rgba(10,40,25,${cur.wet*.16*(.7+.3*Math.sin(T*.8))})`;c.fillRect(0,150,W,110)}
  if(cur.dry>.02){c.fillStyle=`rgba(210,190,90,${cur.dry*.18})`;c.fillRect(0,150,W,110)}
  /* stín stromu a světlo mezi listy */
  {const ts=.16*(1-cur.snow*.6)*(1-clamp(cur.dark*1.5)),sx=at(.62+.03*Math.sin(T*.05),.18);c.save();gr=c.createRadialGradient(sx.x,sx.y,8,sx.x,sx.y,95*g.Ls);gr.addColorStop(0,`rgba(0,30,10,${ts*1.6})`);gr.addColorStop(1,'rgba(0,30,10,0)');c.fillStyle=gr;c.fillRect(0,150,W,110);
    c.globalCompositeOperation='lighter';for(let k=0;k<7;k++){const gx=sx.x+Math.sin(T*.3+k*1.9)*40+(k-3)*9,gy=sx.y+Math.cos(T*.27+k*2.3)*8+(k%3)*3;gr=c.createRadialGradient(gx,gy,0,gx,gy,9);gr.addColorStop(0,`rgba(255,244,190,${.1*cur.sun})`);gr.addColorStop(1,'rgba(255,244,190,0)');c.fillStyle=gr;c.fillRect(gx-9,gy-9,18,18)}c.restore()}
  /* mráz a sníh */
  if(cur.frost>.02){c.fillStyle=`rgba(232,243,250,${cur.frost*.2})`;c.fillRect(0,150,W,110)}
  if(cur.snow>.02){gr=c.createLinearGradient(0,150,0,252);gr.addColorStop(0,'#f1f6fb');gr.addColorStop(1,'#dce7f1');c.save();c.globalAlpha=cur.snow*.86;c.fillStyle=gr;c.fillRect(0,150,W,110);c.globalAlpha=cur.snow*.35;c.fillStyle='#b9cadb';for(let k=0;k<8;k++){const q=at(.1+k*.115,.3+((k*5)%7)*.1);c.beginPath();c.ellipse(q.x,q.y,38*q.s,5*q.s,0,0,6.283);c.fill()}c.restore()}
  /* rosa a jinovatka se třpytí */
  {const tw=clamp(cur.frost+(1-cur.dorm)*.35*(1-cur.dry)*clamp(1.3-cur.sunH))*(1-cur.snow*.4);if(tw>.03)for(let k=0;k<46;k++){const q=at(((k*47)%97)/97,((k*29)%89)/89),a2=Math.pow(Math.max(0,Math.sin(T*2.6+k*1.7)),8)*tw;if(a2<.04)continue;c.fillStyle=`rgba(255,255,255,${a2})`;c.fillRect(q.x-1,q.y-8*q.s,2,2)}}
  c.restore();
  if(cur.edge>.02){c.save();c.globalAlpha=Math.min(1,cur.edge);const hl=at(0,0),hr=at(1,0);c.fillStyle='#1f4d24';c.beginPath();c.roundRect(hl.x-8,hl.y-12,hr.x-hl.x+16,14,6);c.fill();c.fillStyle='#2f7034';c.beginPath();c.roundRect(hl.x-8,hl.y-12,hr.x-hl.x+16,5,4);c.fill();c.strokeStyle='#dcd9cf';c.lineWidth=3;c.lineJoin='round';c.beginPath();c.moveTo(a.x,a.y);c.lineTo(d.x,d.y);c.lineTo(e.x,e.y);c.lineTo(b.x,b.y);c.stroke();c.restore()}
  if(cur.goal>.02){c.save();c.globalAlpha=cur.goal;const g1=at(.38,0),g2=at(.62,0),gh=20;c.fillStyle='rgba(255,255,255,.22)';c.fillRect(g1.x,g1.y-gh,g2.x-g1.x,gh);c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=.8;for(let k=1;k<6;k++){c.beginPath();c.moveTo(g1.x+(g2.x-g1.x)*k/6,g1.y-gh);c.lineTo(g1.x+(g2.x-g1.x)*k/6,g1.y);c.stroke()}c.strokeStyle='#fff';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(g1.x,g1.y);c.lineTo(g1.x,g1.y-gh);c.lineTo(g2.x,g1.y-gh);c.lineTo(g2.x,g1.y);c.stroke();c.restore()}
  const ballAt=(u,v,al,col)=>{if(al<.02)return;const q=at(u,v),r=4.8*q.s+1.5,bob=Math.abs(Math.sin(T*2.4))*(q.s*5);c.save();c.globalAlpha=al;c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(q.x,q.y+1,r*1.1,r*.35,0,0,6.283);c.fill();c.fillStyle=col;c.beginPath();c.arc(q.x,q.y-r-bob,r,0,6.283);c.fill();c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.2;c.beginPath();c.arc(q.x,q.y-r-bob,r*.7,.4,2.6);c.stroke();c.restore()};
  ballAt(.5,.58,cur.goal,'#f4f4ee');ballAt(.74,.82,cur.ball,'#e8742a');
  /* zavlažovače a hadice */
  if(cur.ia>.02)[.2,.5,.8].forEach(u=>{const q=at(u,.4);c.save();c.globalAlpha=cur.ia;c.fillStyle='#444';c.fillRect(q.x-2,q.y-3,4,5);c.restore()});
  if(cur.im>.02){const q=at(.8,.8);c.save();c.globalAlpha=cur.im;c.strokeStyle='#2f8a4a';c.lineWidth=4;c.lineCap='round';c.beginPath();const e2=at(1.02,.95);c.moveTo(e2.x,e2.y);c.quadraticCurveTo(q.x+30,q.y+18,q.x+4,q.y-2);c.stroke();c.fillStyle='#555';c.fillRect(q.x-6,q.y-9,10,6);c.restore()}
  /* kapky a kousky trávy */
  parts.forEach(p=>{if(p.t==='s'){c.fillStyle='rgba(255,255,255,.88)';c.beginPath();c.arc(p.x,p.y,1.4,0,6.283);c.fill()}else if(p.t==='w'){c.strokeStyle=`rgba(150,205,240,${.75*clamp(1-p.l/1.4)+.15})`;c.lineWidth=1.3*p.s+.3;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.02,p.y-p.vy*.02);c.stroke()}else{c.fillStyle=`rgba(80,150,60,${1-p.l/.9})`;c.fillRect(p.x,p.y,1.6,1.6)}});
  /* sekačka */
  const mw=(alpha0,drawFn)=>{const alpha=alpha0*(1-clamp(cur.dorm*1.6));if(alpha<.02)return;const q=at(M.u,M.v);c.save();c.globalAlpha=alpha;c.translate(q.x,q.y);c.scale(q.s*1.15*(M.dir<0&&S.mower!=='robot'?-1:1),q.s*1.15);drawFn();c.restore()};
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
  /* motýli a včela v teple, teplé světlo zleva a ztmavení okrajů */
  {const wm=clamp(1-cur.dorm*1.8)*(1-cur.snow)*(1-clamp(cur.dark*2));if(wm>.05){
    for(let k=0;k<2;k++){const bq=at(.5+.42*Math.sin(T*.23+k*2.4),.4+.3*Math.sin(T*.31+k*1.7)),by=bq.y-(22+7*Math.sin(T*1.7+k))*bq.s-6,bxp=bq.x+Math.sin(T*2.1+k)*4,fl=Math.abs(Math.sin(T*12+k*2)),sz=(5+k)*bq.s+2;
      c.save();c.globalAlpha=wm;c.translate(bxp,by);c.fillStyle=k?'#f4f1e6':'#f2da4a';[-1,1].forEach(sd=>{c.beginPath();c.ellipse(sd*sz*.55*(.35+.65*fl),-sz*.2,sz*.7*(.35+.65*fl)+.5,sz*.9,sd*.5,0,6.283);c.fill()});c.fillStyle='#3a2c1a';c.fillRect(-.7,-sz*.7,1.4,sz*1.3);c.restore()}
    const hq=at(.3+.25*Math.sin(T*.4),.62),hx=hq.x+Math.sin(T*9)*3,hy=hq.y-14*hq.s-4+Math.cos(T*7)*2;c.save();c.globalAlpha=wm;c.fillStyle='#f0c020';c.beginPath();c.ellipse(hx,hy,3,2,0,0,6.283);c.fill();c.fillStyle='#3a2c1a';c.fillRect(hx-1,hy-2,1.2,4);c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.ellipse(hx-1,hy-3,2.4,1.2,-.5,0,6.283);c.fill();c.restore()}}
  {const dk2=clamp(cur.dark/.42),lg=c.createLinearGradient(0,0,W*.75,252);lg.addColorStop(0,`rgba(255,232,180,${.11*cur.sunH*(1-dk2)*cur.sun})`);lg.addColorStop(.7,'rgba(255,232,180,0)');c.fillStyle=lg;c.fillRect(0,0,W,252);const vg=c.createRadialGradient(W/2,140,W*.28,W/2,140,W*.78);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,20,8,.2)');c.fillStyle=vg;c.fillRect(0,0,W,252)}
  /* řez půdou s kořeny: jíl a utužení = mělké kořeny nad zhutnělou vrstvou, písek a vyšší tráva = kořeny hlouběji */
  const SY=252,SH=54,sc=cur.soil;gr=c.createLinearGradient(0,SY,0,SY+SH);gr.addColorStop(0,rgb(sc));gr.addColorStop(1,rgb(mix(sc,[0,0,0],.32)));c.fillStyle=gr;c.fillRect(0,SY,W,SH);
  c.fillStyle=rgb(mix(sc,[0,0,0],.5));c.fillRect(0,SY+SH,W,H-SY-SH);
  c.fillStyle='rgba(0,0,0,.25)';for(let i=0;i<30;i++){c.beginPath();c.arc((i*53.7)%W,SY+4+((i*29)%(SH-8)),1+(i%3)*.6,0,6.283);c.fill()}
  if(cur.sand>.02){c.fillStyle=`rgba(255,240,200,${.55*cur.sand})`;for(let i=0;i<90;i++){c.fillRect((i*37.3)%W,SY+2+((i*19)%(SH-4)),1.6,1.6)}}
  const hard=Math.max(cur.clay*.85,cur.p.compaction),panY=SY+38-hard*14;
  if(hard>.02){c.save();c.globalAlpha=Math.min(1,hard);c.strokeStyle='rgba(35,22,12,.9)';c.lineWidth=3;c.setLineDash([10,5]);c.beginPath();c.moveTo(0,panY);c.lineTo(W,panY);c.stroke();c.setLineDash([]);
    if(cur.clay>.02){c.globalAlpha=cur.clay;c.strokeStyle='rgba(30,18,10,.6)';c.lineWidth=1.2;for(let i=0;i<10;i++){const x=20+i*41;c.beginPath();c.moveTo(x,SY+2);c.lineTo(x+6,SY+11);c.lineTo(x-3,SY+21);c.stroke()}}c.restore()}
  const rootK=Math.max(.35,(1+cur.sand*.4-cur.clay*.4-cur.p.compaction*.4)*(.72+.28*cur.hs));
  c.strokeStyle='rgba(245,232,200,.9)';c.lineCap='round';c.lineWidth=1.1;c.beginPath();
  for(let i=0;i<48;i++){const x=14+i*(W-28)/47,len=(18+((i*37)%17))*rootK,wob=Math.sin(i*1.7)*3,stop=hard>.02?(panY-SY)+3:SH-3,y1=SY+Math.min(len,stop);c.moveTo(x,SY);c.quadraticCurveTo(x+wob,SY+(y1-SY)*.55,x+wob*1.4,y1);if(hard>.02&&len>stop-3)c.lineTo(x+wob*1.4+(i%2?9:-9),y1+1)}
  c.stroke();
  c.fillStyle='rgba(255,255,255,.8)';c.font='600 10px "Schibsted Grotesk",system-ui,sans-serif';c.textAlign='left';c.fillText('řez půdou a kořeny',8,SY+SH-5);
  const RY=H-16;c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=2;c.beginPath();c.moveTo(20,RY);c.lineTo(400,RY);c.moveTo(20,RY-6);c.lineTo(20,RY+6);c.moveTo(400,RY-6);c.lineTo(400,RY+6);c.stroke();
  c.fillStyle='#f0c02a';c.beginPath();c.roundRect(154,RY-11,112,22,11);c.fill();c.fillStyle='#241d00';c.font='700 14px "Young Serif",Georgia,serif';c.textAlign='center';c.fillText(fmt(S.area,0)+' m²',210,RY+5);
}

    return { build: buildScene, update: function () { updateScene(); }, snap: snap };
  }
})();
