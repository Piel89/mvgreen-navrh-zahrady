/*
 * MVGreen AI architekt v2 – průvodce (2026-11-08).
 * Pět kroků podle schváleného návrhu vzhledu: 1 Fotka a co zůstane  2 Místo a rozložení
 * 3 Přání  4 Shrnutí  5 Projekt (AI vizualizace → půdorys v metrech → údaje a fotky rostlin →
 * malovaný výkres → 11 stran PDF).
 * Úpravy po 1. kompletním testu (Martin): půdorys podle skutečnosti (dům, plot, orientace od
 * zákazníka + fotka s vyznačením pro AI, souřadnice v metrech), ověřený výběr rostlin místo
 * náhodného z katalogu, AI nesmí přidávat nevyžádané stavby/nábytek, fotky rostlin, strana 2
 * s rozborem fotky a světovými stranami, strana 5 s kótami.
 * Zatím jen pro správce (levná testovací kvalita AI, denní limit) – platba se napojí po testech.
 */
(function () {
  'use strict';
  var root = document.querySelector('[data-mvgreen-architekt]');
  if (!root || !window.MVGreenPlanV2) return;
  var cfg = window.MVGreenArchitekt || {}, AI = window.MVGreenAI || {};
  var S = window.MVGreenAISafety, P = window.MVGreenPaintMask;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var $ = function (sel) { return root.querySelector(sel); };

  /* ---------- stav ---------- */
  var st = {
    step: 1, original: null, editMask: null, maskPreview: '', photoName: '',
    place: '', geo: null, climate: null, sun: 'Slunce', soil: 'unknown', water: 'hose', width: '', depth: '',
    orient: 'unknown', house: 'none', fence: { left: false, right: false, back: false },
    style: 'prirodni', wish: '', users: { kids: false, dog: false, cat: false }, care: 'mid', name: '',
    result: null, busy: false, log: []
  };
  var STYLES = { prirodni: 'Přírodní', moderni: 'Moderní', nizka: 'Nízká údržba', rodina: 'Pro rodinu' };
  var SOILS = { unknown: 'Nevím', normal: 'Hlinitá', sand: 'Písčitá', clay: 'Jílovitá' };
  var CARES = { low: 'Málo', mid: 'Středně', high: 'Hodně' };
  var WATERS = { hose: 'Hadice', auto: 'Automatická závlaha', none: 'Žádná' };
  var ORIENTS = { J: 'Na jih', S: 'Na sever', V: 'Na východ', Z: 'Na západ', unknown: 'Nevím' };
  var HOUSES = { left: 'Vlevo', right: 'Vpravo', back: 'Vzadu', behind: 'Za mnou', none: 'Není vidět' };
  var SIDES = { left: 'vlevo', right: 'vpravo', back: 'vzadu' };

  /* ---------- pomocníci ---------- */
  function ajax(action, fields) {
    var data = new URLSearchParams();
    data.set('action', action); data.set('nonce', AI.nonce);
    Object.keys(fields || {}).forEach(function (k) { data.set(k, fields[k] == null ? '' : String(fields[k])); });
    return fetch(AI.ajaxUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: data.toString() })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) { if (!j.success) { var e = new Error((j.data && j.data.message) || 'Požadavek se nezdařil.'); e.data = j.data || {}; throw e; } return j.data; });
  }
  function loadImg(src) { return new Promise(function (ok, bad) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { bad(new Error('Obrázek se nepodařilo načíst.')); }; i.src = src; }); }
  function scaled(src, maxSide, type, q) {
    var s = Math.min(1, maxSide / Math.max(src.width, src.height)), c = document.createElement('canvas');
    c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL(type || 'image/jpeg', q || 0.88);
  }
  function log(msg) { st.log.push(new Date().toLocaleTimeString('cs-CZ') + ' – ' + msg); var el = $('[data-log]'); if (el) el.innerHTML = st.log.map(esc).join('<br>'); }
  function seeded(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function shuffle(a, rnd) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function chips(name, map, cur) {
    return '<div class="mvg2-chips">' + Object.keys(map).map(function (k) { return '<button type="button" class="mvg2-chip' + (cur === k ? ' is-on' : '') + '" data-set="' + name + '" data-val="' + k + '">' + esc(map[k]) + '</button>'; }).join('') + '</div>';
  }
  function multi(name, map, obj) {
    return '<div class="mvg2-chips">' + Object.keys(map).map(function (k) { return '<button type="button" class="mvg2-chip' + (obj[k] ? ' is-on' : '') + '" data-multi="' + name + '" data-val="' + k + '">' + esc(map[k]) + '</button>'; }).join('') + '</div>';
  }

  /* ---------- obrazovky ---------- */
  function render() {
    var h = '<div class="mvg2-wiz"><div class="mvg2-wiz__head">' + (cfg.logo ? '<img src="' + esc(cfg.logo) + '" alt="MV GREEN">' : '') + '<div><strong>AI zahradní architekt</strong><span>Zkušební verze 2 · krok ' + Math.min(st.step, 5) + ' z 5</span></div></div>'
      + '<div class="mvg2-progress"><i style="width:' + (Math.min(st.step, 5) * 20) + '%"></i></div>';
    if (!cfg.isAdmin) h += '<p class="mvg2-warn">Zkušební verze je zatím jen pro přihlášeného správce.</p>';
    if (st.step === 1) {
      h += '<h2>Fotka a co zůstane</h2><p class="mvg2-sub">Vyfoťte zahradu z místa, odkud je vidět celá plocha. Pak štětcem označte, co se nesmí změnit (dům, plot, dlažba, stromy) a co se může upravit.</p>'
        + '<label class="mvg2-upload"><input type="file" accept="image/*" data-photo><span>' + (st.original ? 'Vyměnit fotku' : 'Nahrát fotku zahrady') + '</span></label>'
        + (st.original ? '<p class="mvg2-sub">' + esc(st.photoName) + ' · ' + st.original.width + ' × ' + st.original.height + ' px</p>' : '')
        + (st.maskPreview ? '<img class="mvg2-preview" src="' + st.maskPreview + '" alt="Označená fotka">' : (st.original ? '<img class="mvg2-preview" src="' + st.original.toDataURL('image/jpeg', 0.7) + '" alt="Vaše fotka">' : ''))
        + (st.original ? '<button type="button" class="mvg2-btn mvg2-btn--ghost" data-mark>' + (st.editMask ? 'Upravit označení' : 'Označit, co zůstane a co se změní') + '</button>' : '')
        + nav(!!st.editMask);
    } else if (st.step === 2) {
      var c = st.climate;
      h += '<h2>Kde zahrada je?</h2><p class="mvg2-sub">Podle místa vybereme rostliny, které u vás přezimují. Podle rozložení nakreslíme přesný plán.</p>'
        + '<div class="mvg2-row"><input type="text" placeholder="Obec, např. Pelechy" value="' + esc(st.place) + '" data-place><button type="button" class="mvg2-btn" data-geo>Zjistit podmínky</button></div>'
        + (c ? '<div class="mvg2-cards3">' + [[c.elevation + ' m n. m.', 'nadmořská výška'], [c.precip ? c.precip + ' mm' : '—', 'srážky za rok'], [c.zone, 'mrazuvzdornost'], [esc(st.geo.name), 'místo']].map(function (x) { return '<div><strong>' + x[0] + '</strong><span>' + x[1] + '</span></div>'; }).join('') + '</div>' : '')
        + '<h3>Kam je fotka focená? (kam se díváte)</h3>' + chips('orient', ORIENTS, st.orient)
        + '<h3>Kde je na fotce dům?</h3>' + chips('house', HOUSES, st.house)
        + '<h3>Kde je plot nebo hranice pozemku?</h3>' + multi('fence', { left: 'Vlevo', right: 'Vpravo', back: 'Vzadu' }, st.fence)
        + '<h3>Přibližné rozměry zahrady na fotce (m)</h3><div class="mvg2-row"><input type="number" placeholder="šířka zleva doprava" value="' + esc(st.width) + '" data-w><input type="number" placeholder="hloubka od vás dozadu" value="' + esc(st.depth) + '" data-d></div><p class="mvg2-sub">Stačí odhad krokem (1 krok ≈ 0,7 m). Když nevíte, nechte prázdné – odhadneme z fotky.</p>'
        + '<h3>Kolik slunce tam svítí?</h3>' + chips('sun', { 'Slunce': 'Slunce', 'Polostín': 'Polostín', 'Stín': 'Stín' }, st.sun)
        + '<h3>Jakou máte půdu?</h3>' + chips('soil', SOILS, st.soil)
        + '<h3>Voda na zahradě</h3>' + chips('water', WATERS, st.water)
        + nav(!!st.climate);
    } else if (st.step === 3) {
      h += '<h2>Jak chcete navrhovat?</h2>'
        + '<h3>Styl</h3>' + chips('style', STYLES, st.style)
        + '<h3>Co si přejete? (nepovinné)</h3><textarea rows="4" placeholder="Např. záhon podél plotu, cestičku k terase, trávník ať zůstane co největší." data-wish>' + esc(st.wish) + '</textarea>'
        + '<h3>Kdo bude zahradu užívat?</h3>' + multi('users', { kids: 'Děti', dog: 'Pes', cat: 'Kočka' }, st.users)
        + '<h3>Kolik času chcete údržbě věnovat?</h3>' + chips('care', CARES, st.care)
        + nav(true);
    } else if (st.step === 4) {
      var fences = Object.keys(st.fence).filter(function (k) { return st.fence[k]; }).map(function (k) { return SIDES[k]; }).join(', ') || '—';
      h += '<h2>Shrnutí</h2><table class="mvg2-table"><tbody>'
        + [['Fotka', st.photoName], ['Místo', st.geo ? st.geo.name + ' · ' + st.climate.zone : '—'], ['Fotka focená', ORIENTS[st.orient]], ['Dům / plot', HOUSES[st.house] + ' · plot ' + fences], ['Rozměry', (st.width || '?') + ' × ' + (st.depth || '?') + ' m'], ['Slunce / půda', st.sun + ' · ' + SOILS[st.soil]], ['Styl', STYLES[st.style]], ['Přání', st.wish || '—'], ['Údržba', CARES[st.care]]].map(function (r) { return '<tr><td>' + r[0] + '</td><td><strong>' + esc(r[1]) + '</strong></td></tr>'; }).join('')
        + '</tbody></table><h3>Jméno na titulní stranu projektu</h3><input type="text" placeholder="Např. Rodina Nováková" value="' + esc(st.name) + '" data-name>'
        + '<p class="mvg2-warn">Zkušební běh: AI poběží v levné testovací kvalitě (obrázek bude hrubší) a počítá se do denního limitu správce. Placení se napojí po testech.</p>'
        + '<div class="mvg2-nav"><button type="button" class="mvg2-btn mvg2-btn--ghost" data-back>Zpět</button><button type="button" class="mvg2-btn" data-run' + (st.busy ? ' disabled' : '') + '>Vytvořit návrh zahrady</button></div>'
        + '<div class="mvg2-log" data-log>' + st.log.map(esc).join('<br>') + '</div>';
    } else {
      h += resultHtml();
    }
    root.innerHTML = h + '</div>';
    bind();
  }
  function nav(canNext) {
    return '<div class="mvg2-nav">' + (st.step > 1 ? '<button type="button" class="mvg2-btn mvg2-btn--ghost" data-back>Zpět</button>' : '<span></span>') + '<button type="button" class="mvg2-btn" data-next' + (canNext ? '' : ' disabled') + '>Pokračovat</button></div>';
  }

  function bind() {
    // save() před každým překreslením – jinak volba (čip) smazala rozepsané přání (chyba z 1. testu).
    root.querySelectorAll('[data-set]').forEach(function (b) { b.onclick = function () { save(); st[b.dataset.set] = b.dataset.val; render(); }; });
    root.querySelectorAll('[data-multi]').forEach(function (b) { b.onclick = function () { save(); var o = st[b.dataset.multi]; o[b.dataset.val] = !o[b.dataset.val]; render(); }; });
    var nx = $('[data-next]'); if (nx) nx.onclick = function () { save(); st.step++; render(); window.scrollTo(0, root.offsetTop - 20); };
    var bk = $('[data-back]'); if (bk) bk.onclick = function () { save(); st.step--; render(); };
    var ph = $('[data-photo]'); if (ph) ph.onchange = function () { if (ph.files[0]) loadPhoto(ph.files[0]); };
    var mk = $('[data-mark]'); if (mk) mk.onclick = markArea;
    var geo = $('[data-geo]'); if (geo) geo.onclick = function () { save(); lookupPlace(); };
    var run = $('[data-run]'); if (run) run.onclick = function () { save(); runAll(); };
    var pr = $('[data-print]'); if (pr) pr.onclick = function () { document.body.classList.add('mvg2-printing'); window.print(); setTimeout(function () { document.body.classList.remove('mvg2-printing'); }, 500); };
    var slide = function (v) { $('[data-after]').style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)'; $('[data-divider]').style.left = v + '%'; };
    var sl = $('[data-slide]'); if (sl) { sl.oninput = function () { slide(+sl.value); }; slide(+sl.value); }
    fitSheets();
  }
  function save() {
    var v = function (sel) { var e = $(sel); return e ? e.value : null; };
    if (v('[data-place]') !== null) st.place = v('[data-place]');
    if (v('[data-w]') !== null) { st.width = v('[data-w]'); st.depth = v('[data-d]'); }
    if (v('[data-wish]') !== null) st.wish = v('[data-wish]').slice(0, 500);
    if (v('[data-name]') !== null) st.name = v('[data-name]').slice(0, 80);
  }

  /* ---------- krok 1: fotka a označení ---------- */
  function loadPhoto(file) {
    var url = URL.createObjectURL(file);
    loadImg(url).then(function (img) {
      var s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      st.original = c; st.photoName = file.name; st.editMask = null; st.maskPreview = ''; st.removeWhere = ''; st.cacheKey = url;
      render();
    }).catch(function (e) { alert(e.message); });
  }
  function markArea() {
    P.confirmPaintMask(st.original, 'Označte „Zůstane“ všechno, co se nesmí změnit (dům, plot, dlažba, stromy), a „Odstranit“ to, co má zmizet. Zbytek smí AI navrhnout znovu.', { cacheKey: st.cacheKey, initialCategory: st.paintCategory || null })
      .then(function (r) {
        if (!r) return;
        st.paintCategory = r.category; st.maskPreview = r.previewDataUrl || '';
        st.removeWhere = r.hasRemove ? maskWhere(r.removeMask) : '';
        st.editMask = S.growMask(fillHoles(r.editMask, r.hasRemove ? r.removeMask : null));
        render();
      });
  }
  // 3. test (2026-11-08): štětec po superpixelech nechal mezi domem a soklem malé neoznačené
  // ostrůvky; AI do nich na zeď nakreslila kytky a kontrola je pak vrátila jako barevné skvrny.
  // Malá upravitelná místa úplně obklopená tím, co zůstává (a neoznačená „Odstranit“), se proto
  // berou jako „Zůstane“.
  function fillHoles(mask, removeMask) {
    var W = mask.width, H = mask.height, sc = Math.min(1, 600 / Math.max(W, H));
    var w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc));
    var small = function (m) { var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(m, 0, 0, w, h); return c.getContext('2d').getImageData(0, 0, w, h).data; };
    var a = small(mask), rm = removeMask ? small(removeMask) : null;
    var lab = new Int32Array(w * h), holes = [], n = 0, limit = w * h * 0.015;
    for (var i = 0; i < w * h; i++) {
      if (lab[i] || a[i * 4 + 3] < 128) continue;
      n++; var stack = [i], comp = [], border = false, removed = false; lab[i] = n;
      while (stack.length) {
        var p = stack.pop(), x = p % w, y = (p - x) / w; comp.push(p);
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
        if (rm && rm[p * 4 + 3] >= 128) removed = true;
        [p - 1, p + 1, p - w, p + w].forEach(function (q, k) {
          if (q < 0 || q >= w * h || (k === 0 && x === 0) || (k === 1 && x === w - 1)) return;
          if (!lab[q] && a[q * 4 + 3] >= 128) { lab[q] = n; stack.push(q); }
        });
      }
      if (!border && !removed && comp.length < limit) holes.push(comp);
    }
    if (!holes.length) return mask;
    var out = document.createElement('canvas'); out.width = W; out.height = H;
    var o = out.getContext('2d'); o.drawImage(mask, 0, 0);
    o.globalCompositeOperation = 'destination-out';
    var cw = W / w, ch = H / h;
    holes.forEach(function (comp) { comp.forEach(function (p) { var x = p % w, y = (p - x) / w; o.fillRect(Math.floor(x * cw) - 1, Math.floor(y * ch) - 1, Math.ceil(cw) + 2, Math.ceil(ch) + 2); }); });
    return out;
  }
  // Kde na fotce byly věci označené „Odstranit“ – AI dostává fotku už bez nich, takže „místo, kde
  // stojí auta“ jinak neumí najít (3. test: dlažbu se zídkou dala přes celé popředí).
  function maskWhere(m) {
    var w = 200, h = Math.max(1, Math.round(200 * m.height / m.width)), c = document.createElement('canvas');
    c.width = w; c.height = h; c.getContext('2d').drawImage(m, 0, 0, w, h);
    var d = c.getContext('2d').getImageData(0, 0, w, h).data, x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return '';
    var px = function (v, t) { return Math.round(v / t * 100); }, cx = (x0 + x1) / 2 / w, cy = (y0 + y1) / 2 / h;
    var hor = cx < 0.36 ? 'v levé části' : cx > 0.64 ? 'v pravé části' : 'uprostřed', ver = cy > 0.62 ? 'v popředí' : cy < 0.4 ? 'vzadu' : 've středu hloubky';
    return hor + ' fotky ' + ver + ' (vodorovně ' + px(x0, w) + '–' + px(x1 + 1, w) + ' %, svisle ' + px(y0, h) + '–' + px(y1 + 1, h) + ' % od levého horního rohu)';
  }

  /* ---------- krok 2: podnebí ---------- */
  function lookupPlace() {
    if (!st.place.trim()) return alert('Zadejte prosím obec.');
    var g;
    fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(st.place.trim()) + '&count=5&language=cs&format=json').then(function (r) { return r.json(); })
      .then(function (j) {
        g = (j.results || []).filter(function (x) { return x.country_code === 'CZ'; })[0] || (j.results || [])[0];
        if (!g) throw new Error('Obec jsem nenašel. Zkuste ji napsat jinak.');
        return Promise.all([
          fetch('https://api.open-meteo.com/v1/elevation?latitude=' + g.latitude + '&longitude=' + g.longitude).then(function (r) { return r.json(); }),
          fetch('https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR&community=AG&longitude=' + g.longitude + '&latitude=' + g.latitude + '&format=JSON').then(function (r) { return r.json(); }).catch(function () { return null; })
        ]);
      })
      .then(function (res) {
        var el = Math.round((res[0].elevation || [0])[0]);
        var ann = res[1] && res[1].properties && res[1].properties.parameter && res[1].properties.parameter.PRECTOTCORR && res[1].properties.parameter.PRECTOTCORR.ANN;
        var zone = el < 250 ? '7b' : el < 450 ? '7a' : el < 650 ? '6b' : el < 850 ? '6a' : '5b';
        st.geo = { name: g.name + (g.admin2 ? ', ' + g.admin2 : ''), lat: g.latitude, lon: g.longitude };
        st.climate = { elevation: el, precip: ann ? Math.round(ann * 365) : null, zone: 'zóna ' + zone };
        render();
      }).catch(function (e) { alert(e.message || 'Podmínky se nepodařilo zjistit.'); });
  }

  /* ---------- výběr rostlin (ověřený seznam plants-curated.js) ---------- */
  // Martin: „dělat návrhy z 33 druhů je strašně málo“ → ~150 druhů; výběr váží styl, půdu a údržbu,
  // hlídá pestrost barev a druhů a u větší péče přidá víc druhů.
  var STYLE_W = {
    prirodni: { perennial: 3, grass: 3, lowgrass: 2, shrub: 1.5, conifer: 0.3 },
    moderni: { perennial: 1, grass: 3, lowgrass: 3, shrub: 2, conifer: 2 },
    nizka: { perennial: 1, grass: 2.5, lowgrass: 2.5, shrub: 3, conifer: 2.5 },
    rodina: { perennial: 2.5, grass: 1.5, lowgrass: 1.5, shrub: 2.5, conifer: 1 }
  };
  function pickPlants() {
    var all = window.MVGreenPlantsV2 || [], rnd = seeded(Date.now() % 100000);
    var water = st.water === 'none' || st.soil === 'sand' ? 'dry' : st.soil === 'clay' ? 'wet' : 'normal';
    var okWater = function (p) { return p.water.indexOf(water) >= 0 || p.water.indexOf('normal') >= 0 && water !== 'dry' || (water === 'normal' && p.water.indexOf('dry') >= 0); };
    var fits = function (p) { return p.sun.indexOf(st.sun) >= 0 && okWater(p) && !(p.thorny && (st.users.kids || st.users.dog)); };
    var wts = STYLE_W[st.style] || STYLE_W.prirodni;
    // vážené náhodné pořadí: lepší shoda se stylem = dřív na řadě, ale pokaždé jiný návrh
    var pool = all.filter(fits).map(function (p) { return { p: p, k: Math.pow(rnd(), 1 / (wts[p.kind] || 1)) }; }).sort(function (a, b) { return b.k - a.k; }).map(function (x) { return x.p; });
    var chosen = [], usedColors = [];
    var hue = function (c) { return String(c || '').slice(1, 3); };
    var take = function (role, n, pref) {
      var list = pool.filter(function (p) { return p.role === role && chosen.indexOf(p) < 0; });
      if (pref) list = list.filter(pref).concat(list.filter(function (p) { return !pref(p); }));
      for (var i = 0; i < list.length && n > 0; i++) {
        var p = list[i];
        // pestrost: ne dvě rostliny stejného typu a podobné barvy květu v jedné roli
        if (chosen.some(function (c) { return c.role === role && c.kind === p.kind && hue(c.color) === hue(p.color); })) continue;
        if (p.flower && usedColors.indexOf(p.flower) >= 0) continue;
        chosen.push(p); if (p.flower) usedColors.push(p.flower); n--;
      }
    };
    var n = { low: [2, 1, 2], mid: [2, 2, 2], high: [2, 3, 3] }[st.care] || [2, 2, 2];
    take('back', 1, function (p) { return p.kind === 'shrub' || p.kind === 'conifer'; });
    take('back', n[0] - 1, function (p) { return p.kind === 'grass' || p.kind === 'perennial'; });
    take('mid', n[1], st.care === 'low' ? function (p) { return p.kind !== 'perennial'; } : null);
    take('front', n[2], null);
    return chosen.map(function (p) { return Object.assign({}, p); });
  }

  function promptText(plants) {
    var users = [st.users.kids && 'děti', st.users.dog && 'pes', st.users.cat && 'kočka'].filter(Boolean);
    var fences = Object.keys(st.fence).filter(function (k) { return st.fence[k]; }).map(function (k) { return SIDES[k]; });
    return 'Navrhni zahradu ve stylu „' + STYLES[st.style] + '“ s ' + { low: 'minimální', mid: 'střední', high: 'vyšší' }[st.care] + ' údržbou. '
      + (st.wish ? 'PŘÁNÍ ZÁKAZNÍKA (má přednost před vším ostatním a musí být na fotce jasně vidět): ' + st.wish + '. ' : '')
      + (st.removeWhere ? 'Věci, které zákazník nechal odstranit, stály ' + st.removeWhere + '. Když přání mluví o místě, kde stojí/stály (např. „kde stojí auta“), myslí PŘESNĚ tuto oblast – nové zpevněné plochy a zídky dej jen tam a zbytek upravované plochy řeš podle stylu (trávník, záhony). ' : '')
      + (fences.length ? 'Plot je ' + fences.join(' a ') + ' – záhon u plotu veď jako souvislý pás těsně podél plotu, široký 1–1,5 m, vysoké rostliny přímo u plotu. ' : '')
      + 'Trávník zachovej jako hlavní plochu. Záhony mají plynule zaoblenou hranu s obrubou a jsou mulčované. '
      + 'Použij POUZE tyto rostliny: ' + plants.map(function (p) { return p.name + ' (' + p.latin + ', výška ' + Math.round(p.height * 100) + ' cm)'; }).join('; ') + '. '
      + 'Rostliny sázej ve skupinách po 3–7 kusech stejného druhu, vysoké dozadu, nízké dopředu. '
      // 2. test: AI přidala neobjednanou bránu s plotem a řadu tújí → zakázáno výslovně.
      + 'NEPŘIDÁVEJ nic, o co zákazník nežádal: žádné terasy, dřevěná pódia, nábytek, lavičky, pergoly, bazény, sochy, osvětlení, NOVÉ PLOTY, BRÁNY, VRATA ani živé ploty a řady tújí. Co je na fotce mimo upravovanou plochu, nech přesně jak je. '
      + (users.length ? 'Zahradu užívají: ' + users.join(', ') + ' – žádné trnité keře u cest. ' : '')
      + 'Výsledek musí vypadat jako skutečná fotografie realizované zahrady v ČR (' + (st.climate ? st.climate.zone : '') + ').';
  }
  function hintsText() {
    var fences = Object.keys(st.fence).filter(function (k) { return st.fence[k]; }).map(function (k) { return SIDES[k]; });
    return 'Dům na fotce: ' + HOUSES[st.house].toLowerCase() + '. Plot/hranice pozemku: ' + (fences.join(', ') || 'neuvedeno') + '. '
      + (st.width ? 'Šířka zahrady zleva doprava ≈ ' + st.width + ' m. ' : '') + (st.depth ? 'Hloubka od fotografa dozadu ≈ ' + st.depth + ' m. ' : '')
      + (st.removeWhere ? 'Odstraněné věci (např. auta) stály ' + st.removeWhere + '. ' : '')
      + 'Přání zákazníka: ' + (st.wish || 'žádné') + '.';
  }

  /* ---------- krok 5: celý běh ---------- */
  function runAll() {
    if (st.busy) return;
    if (!cfg.isAdmin) return alert('Zkušební verze je zatím jen pro správce.');
    st.busy = true; st.log = []; render();
    var plants = pickPlants(), original = st.original, editMask = st.editMask;
    var wM = parseFloat(st.width) || 0;
    var prepared = S.prepare(original, editMask);
    var bufferMask = S.occlusionMask(editMask, (wM || 15) / original.width);
    var ctx = { plants: plants };
    var plantList = plants.map(function (p) { return p.name + ' (' + p.latin + ')'; }).join('; ');
    log('Vybrané rostliny: ' + plants.map(function (p) { return p.name; }).join(', '));
    log('Posílám fotku AI (upravuje se ' + Math.round(prepared.coverage * 100) + ' % fotky)…');
    ajax('mvgreen_ai_preview_start', { image: prepared.image, mask: S.maskToApi(bufferMask, prepared.box), coreMask: S.maskToApi(editMask, prepared.box), instructions: promptText(plants) })
      .then(function (start) { log('AI kreslí návrh…'); return poll(start.jobId, 0); })
      .then(function (step) { if (!step.image) throw new Error(step.message || 'AI nevrátila obrázek.'); return loadImg(step.image); })
      .then(function (img) {
        var done = S.finish(original, editMask, img, prepared.box, bufferMask);
        log(done.ok ? 'Vizualizace hotová a zkontrolovaná' + (done.repaired ? ' (okraj u chráněných prvků opraven)' : '') + '.' : 'Pozor: kontrola vizualizace hlásí odchylku ' + Math.round(done.drift) + ' – výsledek je potřeba posoudit.');
        ctx.after = done.canvas.toDataURL('image/jpeg', 0.9);
        ctx.before = scaled(original, 1600);
        log('AI čte z fotek přesný půdorys v metrech…');
        return ajax('mvgreen_ai_plan_v2', { after: scaled(done.canvas, 1600), before: scaled(original, 1024), marked: st.maskPreview || '', plants: plantList, hints: hintsText() });
      })
      .then(function (pl) {
        ctx.plan = pl.plan;
        log('Půdorys načten: ' + pl.plan.elements.length + ' prvků, ' + pl.plan.width_m + ' × ' + pl.plan.depth_m + ' m. Doplňuji údaje o rostlinách…');
        var brief = 'Styl: ' + STYLES[st.style] + '. Místo: ' + (st.geo ? st.geo.name : '') + ', ' + (st.climate ? st.climate.elevation + ' m n. m., ' + st.climate.zone : '') + '. Slunce: ' + st.sun + '. Přání: ' + (st.wish || 'žádné') + '. Popis AI: ' + (pl.plan.notes || '');
        return ajax('mvgreen_ai_plant_facts', { plants: plantList, brief: brief });
      })
      .then(function (fx) {
        ctx.facts = fx.facts;
        log('Údaje o rostlinách hotové. Hledám fotky rostlin…');
        return plants.reduce(function (pr, p) {
          return pr.then(function () { return ajax('mvgreen_plant_photo', { latin: p.latin }).then(function (ph) { p.photo = ph.url; p.credit = ph.url ? ph.author + ', Wikimedia Commons, ' + ph.license : ''; if (!ph.url) log('Fotka „' + p.name + '“ nenalezena (' + (ph.reason || '?') + ').'); }, function (e) { log('Fotka „' + p.name + '“: ' + e.message); }); });
        }, Promise.resolve());
      })
      .then(function () {
        log('Kreslím výkres a skládám PDF…');
        buildResult(ctx);
        st.busy = false; st.step = 5; render();
      })
      .catch(function (e) { st.busy = false; log('CHYBA: ' + e.message); render(); });
  }
  function poll(jobId, fails) {
    return ajax('mvgreen_ai_preview_step', { jobId: jobId }).then(function (s) {
      if (s.done) return s;
      return poll(jobId, 0);
    }, function (e) {
      if ((e.data && e.data.final) || fails >= 6) throw e;
      return new Promise(function (r) { setTimeout(r, 3000 * (fails + 1)); }).then(function () { return poll(jobId, fails + 1); });
    });
  }

  /* ---------- z AI půdorysu (metry od fotografa) na projekt pro výkres ---------- */
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function pip(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if ((poly[i][1] > p[1]) !== (poly[j][1] > p[1]) && p[0] < (poly[j][0] - poly[i][0]) * (p[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) inside = !inside;
    }
    return inside;
  }
  function lineDist(p, line) { var d = Infinity; for (var i = 1; i < line.length; i++) d = Math.min(d, segDist(p, line[i - 1], line[i])); return d; }

  function buildResult(ctx) {
    var plan = ctx.plan;
    var w = Math.max(3, parseFloat(st.width) || plan.width_m || 12), d = Math.max(3, parseFloat(st.depth) || plan.depth_m || 10);
    // AI: y = vzdálenost od fotografa. Výkres: zadní část nahoře, fotograf dole → y_výkres = d − y.
    var T = function (pts) { return (pts || []).filter(function (q) { return q && q.length >= 2; }).map(function (q) { return [Math.max(0, Math.min(w, q[0])), Math.max(0, Math.min(d, d - q[1]))]; }); };
    var byName = function (n) { n = String(n || '').toLowerCase(); return ctx.plants.filter(function (p) { return n.indexOf(p.name.toLowerCase().split(' ')[0]) >= 0 || n.indexOf(p.latin.toLowerCase().split(' ')[0]) >= 0; })[0]; };
    var factsBy = {}; (ctx.facts.plants || []).forEach(function (f) { factsBy[String(f.latin).toLowerCase()] = f; });
    ctx.plants.forEach(function (p) { var f = factsBy[p.latin.toLowerCase()]; if (f && f.spacing_cm) p.spon = Math.max(0.2, Math.min(2, f.spacing_cm / 100)); });
    var project = { title: ctx.facts.title || 'Projekt zahrady', place: st.geo ? st.geo.name : '', date: new Date().toLocaleDateString('cs-CZ'), seed: 5,
      site: { w: w, h: d }, brand: { logo: cfg.logo, web: 'mvgreen.cz', phone: '723 339 650' }, photoBefore: ctx.before, photoAfter: ctx.after,
      // Horní okraj výkresu = směr, kam fotograf hleděl. Šipka „S“ míří na sever: při pohledu na
      // východ je sever vlevo (−90°), na západ vpravo (+90°), na jih dole (180°).
      north: { J: 180, S: 0, V: -90, Z: 90 }[st.orient] || 0,
      areas: [{ type: 'outside', poly: [[0, 0], [w, 0], [w, d], [0, d]] }, { type: 'lawn', poly: [[0, 0], [w, 0], [w, d], [0, d]] }],
      beds: [], paths: [], walls: [], structures: [], fences: [], existingPlants: [], labels: [] };
    var els = plan.elements || [], lines = [];
    els.forEach(function (el) {
      var pts = T(el.points);
      if (!pts.length) return;
      var t = el.type;
      if ((t === 'fence' || t === 'wall') && pts.length >= 2) { (t === 'fence' ? project.fences : project.walls).push(t === 'fence' ? { line: pts } : { line: pts, width: Math.max(0.2, el.width_m || 0.3) }); lines.push(pts); }
      else if (t === 'hedge' && pts.length >= 2) { lines.push(pts); for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (var s = 0; s <= L; s += 0.8) project.existingPlants.push({ kind: 'shrub', leaf: '#3F6E45', r: 0.5, x: a[0] + (b[0] - a[0]) * s / L, y: a[1] + (b[1] - a[1]) * s / L }); } }
      else if ((t === 'path' || t === 'stepping') && pts.length >= 2) project.paths.push({ surface: 'gravel', width: Math.max(0.5, el.width_m || 1), stones: t === 'stepping' ? 0.65 : 0, line: pts });
      else if (t === 'tree') project.existingPlants.push({ kind: 'tree', leaf: '#5E8E46', r: 1.2, x: pts[0][0], y: pts[0][1] });
      else if (t === 'shrub') project.existingPlants.push({ kind: 'shrub', leaf: '#4B7A40', r: 0.5, x: pts[0][0], y: pts[0][1] });
      else if (pts.length >= 3) {
        if (t === 'lawn') project.areas.push({ type: 'lawn', poly: pts });
        else if (t === 'house') project.areas.push({ type: 'building', poly: pts });
        else if (t === 'terrace' || t === 'paving') project.areas.push({ type: 'paving', poly: pts });
        else if (t === 'structure') project.structures.push({ poly: pts });
        else if (t === 'bed') {
          var specs = (el.plants || []).map(function (x) { return byName(x.name); }).filter(Boolean);
          specs = specs.filter(function (s2, k) { return specs.indexOf(s2) === k; });
          if (specs.length < 2) specs = ctx.plants.slice();
          // Každý záhon potřebuje i nízké rostliny do popředí – AI je v seznamu někdy vynechá.
          ['back', 'mid', 'front'].forEach(function (role) { if (!specs.some(function (s2) { return s2.role === role; })) { var add = ctx.plants.filter(function (p) { return p.role === role; })[0]; if (add) specs.push(add); } });
          project.beds.push({ surface: 'mulch', poly: pts, plants: specs.map(function (s2) { return Object.assign({}, s2, { share: s2.role === 'back' ? 0.3 : s2.role === 'mid' ? 0.35 : 0.35 }); }) });
        }
      }
      // Popisek podle skutečnosti: nová dlažba nesmí mít „stávající“ (2. test: parkovací stání).
      if (el.label && (t === 'house' || t === 'terrace' || t === 'paving' || t === 'structure') && pts.length >= 3) {
        var c = [0, 0]; pts.forEach(function (q) { c[0] += q[0] / pts.length; c[1] += q[1] / pts.length; });
        project.labels.push({ text: el.label + (el.is_new ? ' – nové' : ' – stávající'), x: c[0], y: c[1], size: 20 });
      }
      if (t === 'wall' && el.is_new && pts.length >= 2) {
        var m2 = pts[Math.floor((pts.length - 1) / 2)], m3 = pts[Math.ceil((pts.length - 1) / 2)];
        project.labels.push({ text: (el.label || 'Zídka') + ' – nová', x: Math.max(1.5, Math.min(w - 1.5, (m2[0] + m3[0]) / 2)), y: Math.max(0.6, (m2[1] + m3[1]) / 2 - 0.7), size: 18 });
      }
    });
    // 3. test: AI zakreslila záhony „u domu“ do půdorysu domu. Záhon, který leží z větší části
    // v budově, se posune před ni (k fotografovi), dokud z ní nevyjede – záda pak má u zdi domu.
    var buildings = project.areas.filter(function (a) { return a.type === 'building'; }).map(function (a) { return a.poly; });
    var share = function (poly) {
      var xs = poly.map(function (q) { return q[0]; }), ys = poly.map(function (q) { return q[1]; }), tot = 0, hit = 0;
      for (var gx = Math.min.apply(null, xs); gx <= Math.max.apply(null, xs); gx += 0.25) for (var gy = Math.min.apply(null, ys); gy <= Math.max.apply(null, ys); gy += 0.25)
        if (pip([gx, gy], poly)) { tot++; if (buildings.some(function (bp) { return pip([gx, gy], bp); })) hit++; }
      return tot ? hit / tot : 0;
    };
    project.beds.forEach(function (b) {
      if (!buildings.length || share(b.poly) < 0.25) return;
      var cy = b.poly.reduce(function (s, q) { return s + q[1]; }, 0) / b.poly.length;
      var by = buildings.map(function (bp) { return bp.reduce(function (s, q) { return s + q[1]; }, 0) / bp.length; })[0];
      var dir = cy >= by ? 1 : -1;
      for (var k = 0; k < 40 && share(b.poly) > 0.02; k++) b.poly = b.poly.map(function (q) { return [q[0], Math.max(0, Math.min(d, q[1] + dir * 0.2))]; });
    });
    buildings.forEach(function (bp) { lines.push(bp.concat([bp[0]])); });
    // Hrany záhonu u plotu/zdi/domu = „záda“ záhonu → vysoké rostliny dozadu (plan-render.js: bed.back).
    project.beds.forEach(function (b) {
      var back = [];
      b.poly.forEach(function (q, i) { var n = b.poly[(i + 1) % b.poly.length], m = [(q[0] + n[0]) / 2, (q[1] + n[1]) / 2]; if (lines.some(function (l) { return lineDist(m, l) < 0.8; })) back.push(i); });
      if (back.length) b.back = back;
      b.plants.forEach(function (p) { p.share = p.role === 'back' ? 0.25 : p.role === 'mid' ? 0.35 : 0.4; });
    });
    // Pořadí kreslení: trávník pod dlažbou a dům navrchu – AI často vrátí trávník přes celou
    // zahradu včetně domu a dům pak na výkresu zmizel pod trávou (2. test, 2026-11-08).
    var ORDER = { outside: 0, lawn: 1, paving: 2, building: 3 };
    project.areas.sort(function (a, b) { return ORDER[a.type] - ORDER[b.type]; });
    var lawns = project.areas.filter(function (a, i) { return a.type === 'lawn' && i > 1; });
    var mainLawn = lawns.sort(function (a, b) { return window.MVGreenPlanV2.polyArea(b.poly) - window.MVGreenPlanV2.polyArea(a.poly); })[0];
    project.fences.forEach(function (f) { var m = f.line[Math.floor(f.line.length / 2)]; project.labels.push({ text: 'Plot – stávající', x: Math.max(1.5, Math.min(w - 1.5, m[0])), y: Math.max(0.6, m[1] + 0.9), size: 18 }); });
    // 3. test: AI zakreslila záhony „u domu“ částečně do domu → místa v budovách a na dlažbě se
    // v záhonu blokují (plan-render.js: bed.blocked), rostliny se tam nesázejí.
    var solid = project.areas.filter(function (a) { return a.type === 'building' || a.type === 'paving'; }).map(function (a) { return a.poly; }).concat(project.structures.map(function (s) { return s.poly; }));
    var inSolid = function (p) { return solid.some(function (pl) { return pip(p, pl); }); };
    project.beds.forEach(function (b) {
      var xs = b.poly.map(function (q) { return q[0]; }), ys = b.poly.map(function (q) { return q[1]; });
      b.blocked = b.blocked || [];
      for (var gx = Math.min.apply(null, xs); gx <= Math.max.apply(null, xs); gx += 0.3)
        for (var gy = Math.min.apply(null, ys); gy <= Math.max.apply(null, ys); gy += 0.3)
          if (pip([gx, gy], b.poly) && inSolid([gx, gy])) b.blocked.push({ x: gx, y: gy, r: 0.3 });
    });
    // Nápis TRÁVNÍK do nejvolnějšího místa trávníku (ne na dům, dlažbu ani záhon).
    var lc = [w * 0.55, d * 0.6], best = -1, lawnPoly = mainLawn ? mainLawn.poly : null;
    var obst = solid.concat(project.beds.map(function (b) { return b.poly; }));
    var edgeDist = function (p, pl) { var m = Infinity; for (var i = 0; i < pl.length; i++) m = Math.min(m, segDist(p, pl[i], pl[(i + 1) % pl.length])); return m; };
    for (var lx = 1.5; lx <= w - 1.5; lx += 0.5) for (var ly = 1; ly <= d - 1; ly += 0.5) {
      var p = [lx, ly];
      if ((lawnPoly && !pip(p, lawnPoly)) || obst.some(function (pl) { return pip(p, pl); })) continue;
      var dist = Math.min(lx, w - lx, ly * 2, (d - ly) * 2); obst.forEach(function (pl) { dist = Math.min(dist, edgeDist(p, pl)); });
      if (dist > best) { best = dist; lc = p; }
    }
    project.labels.push({ text: 'TRÁVNÍK', x: lc[0], y: lc[1], size: 26, color: '#2E5B33', spacing: 3 });

    var sheet = window.MVGreenPlanV2.renderSheet(project);
    var area = window.MVGreenPlanV2.polyArea;
    var plants = sheet.legend.map(function (l) {
      var spec = ctx.plants.filter(function (p) { return p.key === l.key; })[0] || {}, f = factsBy[String(l.latin).toLowerCase()] || {};
      return { name: l.name, latin: l.latin, count: l.count, color: spec.color, photo: spec.photo, credit: spec.credit, spacing: f.spacing_cm || Math.round((spec.spon || 0.4) * 100), height_cm: f.height_cm || Math.round((spec.height || 0.5) * 100), width_cm: f.width_cm,
        bloom_from: f.bloom_from || (spec.bloom || [])[0], bloom_to: f.bloom_to || (spec.bloom || [])[1], sun: f.sun, water: f.water, pruning: f.pruning, toxic: f.pet_toxic, price: f.price_czk, container: f.container, alternative: f.alternative, alternative_reason: f.alternative_reason };
    });
    var lawnArea = w * d - project.beds.reduce(function (s, b) { return s + area(b.poly); }, 0) - project.areas.filter(function (a) { return a.type === 'paving' || a.type === 'building'; }).reduce(function (s, a) { return s + area(a.poly); }, 0);
    var usersL = [st.users.kids && 'děti', st.users.dog && 'pes', st.users.cat && 'kočka'].filter(Boolean);
    var fencesL = Object.keys(st.fence).filter(function (k) { return st.fence[k]; }).map(function (k) { return SIDES[k]; });
    var pctx = { logo: cfg.logo, place: project.place || st.place, date: project.date, number: 'MVG-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4), name: st.name,
      styleLabel: STYLES[st.style] + ', údržba ' + CARES[st.care].toLowerCase(), before: ctx.before, after: ctx.after, marked: st.maskPreview, facts: ctx.facts, plants: plants, climate: st.climate,
      sizeLabel: '≈ ' + w.toFixed(0) + ' × ' + d.toFixed(0) + ' m', sun: st.sun, orient: st.orient, house: st.house, fences: fencesL, soil: st.soil, soilLabel: SOILS[st.soil],
      usersLabel: usersL.length ? usersL.join(', ') : 'bez dětí a zvířat', water: st.water, sheetHtml: sheet.html, project: project, lawnArea: Math.max(0, lawnArea), planNotes: plan.notes };
    st.result = { pdfHtml: window.MVGreenPdfV2.pages(pctx), before: ctx.before, after: ctx.after, plants: plants, facts: ctx.facts, plan: plan };
  }

  function resultHtml() {
    var r = st.result;
    return '<h2>' + esc(r.facts.title || 'Váš návrh je hotový') + '</h2><p class="mvg2-sub">' + esc(r.facts.concept || '') + '</p>'
      + '<div class="mvg2-compare"><img src="' + r.before + '" alt="Před"><img src="' + r.after + '" alt="Po" data-after><i data-divider></i><span class="mvg2-tag mvg2-tag--l">PO</span><span class="mvg2-tag mvg2-tag--r">PŘED</span></div>'
      + '<label class="mvg2-sub">Posuňte a porovnejte před a po<input type="range" min="0" max="100" value="55" data-slide></label>'
      + '<div class="mvg2-nav"><span class="mvg2-sub">' + r.plants.reduce(function (s, p) { return s + p.count; }, 0) + ' rostlin, ' + r.plants.length + ' druhů</span><button type="button" class="mvg2-btn" data-print>Stáhnout projekt (PDF, 11 stran)</button></div>'
      + '<h3>Projekt v PDF – náhled</h3><div class="mvg2-pdf-wrap"><div class="mvg2-pdf">' + r.pdfHtml + '</div></div>'
      + '<div class="mvg2-log" data-log>' + st.log.map(esc).join('<br>') + '</div>';
  }

  // Výkres 1700 × 1100 px se zmenší do strany na šířku; celé PDF se na obrazovce zmenší na šířku okna.
  function fitSheets() {
    root.querySelectorAll('.mvg2-land__sheet').forEach(function (box) {
      var sh = box.querySelector('.mvg2-sheet'); if (!sh) return;
      sh.style.transform = 'scale(' + Math.min(1083 / 1700, 730 / 1100) + ')';
    });
    var wrap = $('.mvg2-pdf-wrap'), pdf = $('.mvg2-pdf');
    if (wrap && pdf) {
      var s = Math.min(1, (wrap.clientWidth - 16) / 1123);
      pdf.style.transform = 'scale(' + s + ')';
      wrap.style.height = Math.ceil(pdf.scrollHeight * s) + 'px';
    }
  }
  window.addEventListener('resize', function () { if (st.step === 5) fitSheets(); });
  // Jen pro testy bez AI (node / konzole): sestaví výsledek z hotových dat.
  window.MVGreenArchitektTest = { state: st, build: function (ctx) { buildResult(ctx); return st.result; }, pickPlants: pickPlants };

  render();
})();
