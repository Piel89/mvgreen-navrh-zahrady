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
    place: '', geo: null, climate: null, sun: 'Slunce', soil: 'unknown', water: 'hose', width: '', depth: '', extraLawn: '',
    orient: 'unknown', house: 'none', fence: { left: false, right: false, back: false },
    mode: 'ai', sketch: [], sketchPreview: '',
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
        // 2026-11-11, majitel: když je zahrada větší než fotka a zbytek má být jen trávník, musí se započítat do rozpočtu
        + '<h3>Další trávník mimo fotku (m²)</h3><input type="number" min="0" placeholder="např. 300 – část zahrady, která na fotce není" value="' + esc(st.extraLawn) + '" data-xl><p class="mvg2-sub">Když máte zahradu větší, než je na fotce, a zbytek má být jen trávník, napište jeho přibližnou plochu – započítáme ho do rozpočtu i do péče o trávník.</p>'
        + '<h3>Kolik slunce tam svítí?</h3>' + chips('sun', { 'Slunce': 'Slunce', 'Polostín': 'Polostín', 'Stín': 'Stín' }, st.sun)
        + '<h3>Jakou máte půdu?</h3>' + chips('soil', SOILS, st.soil)
        + '<h3>Voda na zahradě</h3>' + chips('water', WATERS, st.water)
        + nav(!!st.climate);
    } else if (st.step === 3) {
      var nSk = st.sketch.length;
      h += '<h2>Jak chcete navrhovat?</h2>'
        + chips('mode', { ai: 'Nechat na AI', sketch: 'Nakreslím, kam co chci' }, st.mode)
        + (st.mode === 'sketch' ? '<p class="mvg2-sub">Vyberte prvek a ťukněte do fotky: u zdi odkud a kam vede, u schodů jeden a druhý kraj (= šířka), u záhonu, dlažby nebo kačírku rohy plochy, u stromu jedno místo. AI podle toho pozná, co a kde chcete, a dotáhne to do hezkého celku. Kde nic nezadáte, bude trávník.</p>'
          + (st.sketchPreview ? '<img class="mvg2-preview" src="' + st.sketchPreview + '" alt="Váš náčrt">' : '')
          + '<button type="button" class="mvg2-btn' + (nSk ? ' mvg2-btn--ghost' : '') + '" data-sketch>' + (nSk ? 'Upravit náčrt (' + nSk + ' ' + (nSk === 1 ? 'prvek' : nSk < 5 ? 'prvky' : 'prvků') + ')' : 'Nakreslit náčrt') + '</button>' : '')
        + '<h3>Styl</h3>' + chips('style', STYLES, st.style)
        + '<h3>Co si přejete? (nepovinné)</h3><textarea rows="4" placeholder="Např. záhon podél plotu, cestičku k terase, trávník ať zůstane co největší." data-wish>' + esc(st.wish) + '</textarea>'
        + '<h3>Kdo bude zahradu užívat?</h3>' + multi('users', { kids: 'Děti', dog: 'Pes', cat: 'Kočka' }, st.users)
        + '<h3>Kolik času chcete údržbě věnovat?</h3>' + chips('care', CARES, st.care)
        + nav(st.mode !== 'sketch' || st.sketch.length > 0);
    } else if (st.step === 4) {
      var fences = Object.keys(st.fence).filter(function (k) { return st.fence[k]; }).map(function (k) { return SIDES[k]; }).join(', ') || '—';
      h += '<h2>Shrnutí</h2><table class="mvg2-table"><tbody>'
        + [['Fotka', st.photoName], ['Místo', st.geo ? st.geo.name + ' · ' + st.climate.zone : '—'], ['Fotka focená', ORIENTS[st.orient]], ['Dům / plot', HOUSES[st.house] + ' · plot ' + fences], ['Rozměry', (st.width || '?') + ' × ' + (st.depth || '?') + ' m' + (st.extraLawn ? ' + ' + st.extraLawn + ' m² trávníku mimo fotku' : '')], ['Slunce / půda', st.sun + ' · ' + SOILS[st.soil]], ['Styl', STYLES[st.style]], ['Rozmístění', st.mode === 'sketch' && st.sketch.length ? 'podle vašeho náčrtu (' + st.sketch.length + ' prvků)' : 'navrhne AI'], ['Přání', st.wish || '—'], ['Údržba', CARES[st.care]]].map(function (r) { return '<tr><td>' + r[0] + '</td><td><strong>' + esc(r[1]) + '</strong></td></tr>'; }).join('')
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
    var sk = $('[data-sketch]'); if (sk) sk.onclick = function () {
      save();
      window.MVGreenSketch.open(st.original, st.editMask, st.sketch, { cacheKey: st.cacheKey }).then(function (r) { if (r) { st.sketch = r.strokes; st.sketchPreview = r.strokes.length ? r.preview : ''; } render(); });
    };
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
    if (v('[data-xl]') !== null) st.extraLawn = v('[data-xl]');
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
      st.original = c; st.photoName = file.name; st.editMask = null; st.maskPreview = ''; st.removeWhere = ''; st.sketch = []; st.sketchPreview = ''; st.cacheKey = url; st.markState = null; st.removeNames = []; st.landmarks = []; st.terrain = ''; st.paintCategory = null;
      render();
    }).catch(function (e) { alert(e.message); });
  }
  // Martin 2026-11-10 (řešení 3 + 8): místo štětce AI předznačí objekty a zákazník jen ťuká opravy
  // na čisté celé obrazovce (mark.js). Štětec zůstává jako „Doladit štětcem“ a jako záloha.
  function markArea() {
    var M = window.MVGreenMarkV2;
    if (!M) return markBrush();
    var took = function (r) {
      st.paintCategory = r.category; st.maskPreview = r.previewDataUrl || '';
      st.markState = r.state || null; st.removeNames = r.removeNames || []; st.landmarks = r.landmarks || [];
      st.removeWhere = r.hasRemove ? maskWhere(r.removeMask) : '';
      st.editMask = S.growMask(fillHoles(r.editMask, r.hasRemove ? r.removeMask : null));
      render();
    };
    M.open(st.original, {
      cacheKey: st.cacheKey, initial: st.markState || null,
      // Gemini najde objekty a obdélníky, SAM (sam.js, v prohlížeči) je přesně obkreslí – model
      // se začne načítat hned, souběžně s dotazem na Gemini. Když SAM selže, zůstanou obrysy Gemini.
      detect: function () {
        var S = window.MVGreenSamV2, t0 = Date.now(), samP = S ? S.prepare().catch(function (e) { return { error: e }; }) : Promise.resolve({ error: new Error('sam.js chybí') });
        return ajax('mvgreen_ai_detect_v2', { photo: scaled(st.original, 1024, 'image/jpeg', 0.85) }).then(function (d) {
          var objs = d.objects || [];
          st.terrain = d.terrain || '';
          if (st.terrain) log('Terén podle AI: ' + st.terrain);
          log('AI předznačení (' + (d.model || '?') + '): ' + objs.length + ' objektů, s maskou ' + objs.filter(function (o) { return o.mask; }).length + '. ' + (d.notes || []).join(' | '));
          return samP.then(function (r) {
            if (r && r.error) throw r.error;
            var t1 = Date.now();
            return S.segment(st.original, objs).then(function (o) {
              log('SAM obrysy: ' + o.filter(function (x) { return typeof x.mask === 'string'; }).length + '/' + o.length + ' objektů, model ' + Math.round((t1 - t0) / 1000) + ' s, výpočet ' + Math.round((Date.now() - t1) / 1000) + ' s.');
              return o;
            });
          }).catch(function (e) { log('SAM obrysy selhaly: ' + (e && e.message || e) + ' – použity obrysy Gemini.'); return objs; });
        });
      },
      onBrush: function (r) { st.markState = null; st.removeNames = []; took(r); st.landmarks = []; }
    }).then(function (r) { if (r) took(r); });
  }
  function markBrush() {
    P.confirmPaintMask(st.original, 'Označte „Zůstane“ všechno, co se nesmí změnit (dům, plot, dlažba, stromy), a „Odstranit“ to, co má zmizet. Zbytek smí AI navrhnout znovu.', { cacheKey: st.cacheKey, initialCategory: st.paintCategory || null })
      .then(function (r) {
        if (!r) return;
        st.paintCategory = r.category; st.maskPreview = r.previewDataUrl || ''; st.markState = null; st.removeNames = [];
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

  /* ---------- výběr rostlin (katalog plants-catalog.js, generovaný z data/rostliny/*.txt) ---------- */
  // Martin 2026-11-10: „nemůžeme to dělat z 33… aspoň 1000 trav, keřů, stromů, kytek“ → katalog ~1200 druhů.
  // Do záhonů se automaticky berou jen role back/mid/front; stromy, popínavky a cibuloviny jsou v katalogu
  // pro přání zákazníka. Vyřazeno z automatického výběru: rostliny na kyselou půdu (rododendron –
  // 1. test), rozpínavé, a jedovaté tam, kde jsou děti nebo pes.
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
    // 2026-11-11 (majitel: „vyber rostlin je spatny“ – 23× pažitka v okrasném záhonu): kuchyňské bylinky
    // jen když o ně zákazník stojí.
    var HERB = /^(Allium schoenoprasum|Allium tuberosum|Mentha|Melissa|Petroselinum|Levisticum|Origanum vulgare|Salvia officinalis|Salvia rosmarinus|Rosmarinus|Artemisia dracunculus|Anethum|Ocimum|Satureja|Thymus vulgaris)/i;
    var wantHerbs = /bylin/i.test(st.wish || '');
    var fits = function (p) { return (wantHerbs || !HERB.test(p.latin)) && p.sun.indexOf(st.sun) >= 0 && okWater(p) && !p.acid && !p.spreads && !((p.thorny || p.toxic) && (st.users.kids || st.users.dog)); };
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
    // profesionální záhon: 7–9 druhů (dřív 5–6 a AI z nich v půdorysu použila jen 4)
    var n = { low: [2, 2, 2], mid: [3, 3, 2], high: [3, 4, 3] }[st.care] || [3, 3, 2];
    take('back', 1, function (p) { return p.kind === 'shrub' || p.kind === 'conifer'; });
    take('back', n[0] - 1, function (p) { return p.kind === 'grass' || p.kind === 'perennial'; });
    take('mid', n[1], st.care === 'low' ? function (p) { return p.kind !== 'perennial'; } : null);
    take('front', n[2], null);
    // Stromy a keře, které zákazník ťukl do náčrtu, dostanou vlastní druh (role solo – nejsou v záhonech),
    // počet = počet ťuknutí. Dřív je AI kreslila z keře do záhonu a v rozpočtu chyběly.
    var skN = function (t) { return hasSketch() ? st.sketch.filter(function (it) { return it.tool === t && window.MVGreenSketch.done(it); }).length : 0; };
    var solo = function (kind, count, maxH) {
      if (!count) return;
      var p = pool.filter(function (q) { return q.kind === kind && chosen.indexOf(q) < 0 && q.height <= maxH && (kind !== 'shrub' || q.role === 'back'); })[0];
      if (p) chosen.push(Object.assign({}, p, { role: 'solo', soloCount: count }));
    };
    solo('tree', skN('tree'), 8); solo('shrub', skN('shrub'), 3);
    return chosen.map(function (p) { return Object.assign({}, p); });
  }

  function promptText(plants, brief) {
    var users = [st.users.kids && 'děti', st.users.dog && 'pes', st.users.cat && 'kočka'].filter(Boolean);
    var fences = Object.keys(st.fence).filter(function (k) { return st.fence[k]; }).map(function (k) { return SIDES[k]; });
    return 'Navrhni zahradu ve stylu „' + STYLES[st.style] + '“ s ' + { low: 'minimální', mid: 'střední', high: 'vyšší' }[st.care] + ' údržbou. '
      + (brief && brief.length ? 'ZADÁNÍ ARCHITEKTA (hlavní podklad, řiď se jím): ' + brief.join(' ') + ' ' : '')
      + (st.wish ? 'PŘÁNÍ ZÁKAZNÍKA (má přednost před vším ostatním a musí být na fotce jasně vidět): ' + st.wish + '. ' : '')
      + ((st.removeNames || []).length ? 'Zákazník chce odstranit: ' + st.removeNames.join(', ') + '. ' : '')
      + (st.removeWhere ? 'Věci, které zákazník nechal odstranit, stály ' + st.removeWhere + '. Když přání mluví o místě, kde stojí/stály (např. „kde stojí auta“), myslí PŘESNĚ tuto oblast – nové zpevněné plochy a zídky dej jen tam a zbytek upravované plochy řeš podle stylu (trávník, záhony). ' : '')
      + (hasSketch() ? 'NÁČRT ZÁKAZNÍKA (druhý obrázek) – VODÍTKO, kde zhruba co má být, tvary a detaily navrhni sám kvalitně: '
          + window.MVGreenSketch.describe(st.sketch, st.landmarks).replace(/\n/g, ' ')
          + ' Náčrt je kreslený prstem na mobilu, je jen PŘIBLIŽNÝ: určuje CO a ZHRUBA KDE, polohy v % jsou orientační. Prvky dolaď podle celé fotky, aby vše na sebe logicky navazovalo a vypadalo jako skutečná realizace (zeď rovná a navazující na terén, schody kolmo ve zdi, chodník souběžně s domem, dlažba až k zídce, plynulé hrany záhonů). Kde v upravované ploše žádná značka není, dej upravený trávník. '
          // 2026-11-11: cesta k zahradnímu domku nahoře skončila jako záhon
          + (st.sketch.some(function (it) { return it.tool === 'wall'; }) ? 'V místě nové zdi z náčrtu je na fotce HRUBĚ předkreslený pás šedých kamenů – udělej z něj skutečnou, pěknou kamennou opěrnou zídku po CELÉ jeho délce (od začátku až na konec, nic nevynechávej), navazující na stávající zeď/terén. ' : '')
          + 'Cesty, chodníky a dlažbu z náčrtu nakresli CELÉ od začátku až ke konci – až k místu, u kterého podle náčrtu končí (např. k domku nebo kůlně) – a NIKDY je nenahrazuj záhonem ani trávníkem. ' : '')
      + (fences.length && !hasSketch() ? 'Plot je ' + fences.join(' a ') + ' – záhon u plotu veď jako souvislý pás těsně podél plotu, široký 1–1,5 m, vysoké rostliny přímo u plotu. ' : '')
      // 2026-11-11, majitel: záhon pod domem ve svahu nakreslen na rovinu a se zídkou, kterou nechtěl
      + (st.terrain ? 'TERÉN NA FOTCE: ' + st.terrain + ' ' : '')
      + 'ZACHOVEJ TVAR TERÉNU z fotky: svahy zůstávají svahy, záhony a cesty ve svahu kopírují sklon, nic nesrovnávej do roviny. Opěrné zdi, zídky a terasy dělej JEN tam, kde je zákazník nakreslil v náčrtu nebo kde už na fotce jsou – jinde žádné nepřidávej. '
      + 'Trávník zachovej jako hlavní plochu. Záhony mají plynule zaoblenou hranu s obrubou a jsou mulčované. '
      + plants.filter(function (p) { return p.role === 'solo'; }).map(function (p) { return (p.kind === 'tree' ? 'Stromy' : 'Solitérní keře') + ' z náčrtu (' + p.soloCount + ' ks) = ' + p.name + ' (' + p.latin + '), výška po výsadbě cca ' + Math.min(4, Math.round(p.height * 0.5 * 10) / 10) + ' m – každý CELÝ: kmen i plná koruna, nic nesmí být useknuté ani schované. Ploty, zdi a domy ZA stromy zůstávají přesně jako na fotce – koruna je jen částečně zakrývá, nic za stromy neodstraňuj ani nepřekresluj. '; }).join('')
      + 'Použij POUZE tyto rostliny: ' + plants.map(function (p) { return p.name + ' (' + p.latin + ', výška ' + Math.round(p.height * 100) + ' cm)'; }).join('; ') + '. '
      + 'Rostliny sázej ve skupinách po 3–7 kusech stejného druhu, vysoké dozadu, nízké dopředu. '
      // 2. test: AI přidala neobjednanou bránu s plotem a řadu tújí → zakázáno výslovně.
      + 'NEPŘIDÁVEJ nic, o co zákazník nežádal: žádné terasy, dřevěná pódia, nábytek, lavičky, pergoly, bazény, sochy, osvětlení, NOVÉ PLOTY, BRÁNY, VRATA ani živé ploty a řady tújí. Co je na fotce mimo upravovanou plochu, nech přesně jak je. '
      + (users.length ? 'Zahradu užívají: ' + users.join(', ') + ' – žádné trnité keře u cest. ' : '')
      + 'Výsledek musí vypadat jako skutečná fotografie realizované zahrady v ČR (' + (st.climate ? st.climate.zone : '') + ').';
  }
  function hasSketch() { return st.mode === 'sketch' && !!window.MVGreenSketch && st.sketch.filter(window.MVGreenSketch.done).length > 0; }
  // Náčrt ve stejném letterboxu jako fotka pro AI (ai-safety prepare → box), aby značky seděly na pixel.
  function guideFor(box) {
    var g = window.MVGreenSketch.guide(st.original, st.sketch), c = document.createElement('canvas');
    c.width = box.W; c.height = box.H;
    var x = c.getContext('2d'); x.fillStyle = '#7f8a80'; x.fillRect(0, 0, box.W, box.H);
    // 2026-11-11: rozmazané zóny místo ostrých čar – AI je jinak obkreslovala (hranatá cesta podle prstu)
    x.filter = 'blur(' + Math.max(4, Math.round(box.w / 220)) + 'px)'; x.drawImage(g, box.x, box.y, box.w, box.h); x.filter = 'none';
    return c.toDataURL('image/jpeg', 0.9);
  }
  function hintsText() {
    var fences = Object.keys(st.fence).filter(function (k) { return st.fence[k]; }).map(function (k) { return SIDES[k]; });
    return 'Dům na fotce: ' + HOUSES[st.house].toLowerCase() + '. Plot/hranice pozemku: ' + (fences.join(', ') || 'neuvedeno') + '. '
      + (st.width ? 'Šířka zahrady zleva doprava ≈ ' + st.width + ' m. ' : '') + (st.depth ? 'Hloubka od fotografa dozadu ≈ ' + st.depth + ' m. ' : '')
      + (st.removeWhere ? 'Odstraněné věci (např. auta) stály ' + st.removeWhere + '. ' : '')
      + (hasSketch() ? 'NÁČRT ZÁKAZNÍKA (obrázek 4, závazný pro polohu prvků): ' + window.MVGreenSketch.describe(st.sketch, st.landmarks).replace(/\n/g, ' ') + ' ' : '')
      + (st.terrain ? 'Terén na fotce: ' + st.terrain + ' ' : '')
      + 'Přání zákazníka: ' + (st.wish || 'žádné') + '.';
  }

  /* Koruny stromů z náčrtu (2026-11-11, majitel: „stromy na levo jednomu chybí úplně koruna“): strom
   * ťuknutý pod domem/plotem má korunu PŘED zamčeným domem – ochrana stávajících věcí ji vracela zpět
   * na fotku PŘED, zbyl kmen bez koruny. Nad každým stromem/keřem z náčrtu proto uvolníme elipsu na korunu. */
  function withCrowns(mask) {
    var items = hasSketch() ? st.sketch.filter(function (it) { return (it.tool === 'tree' || it.tool === 'shrub') && window.MVGreenSketch.done(it); }) : [];
    if (!items.length || !mask) return mask;
    var W = mask.width, H = mask.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.drawImage(mask, 0, 0); g.fillStyle = '#000';
    items.forEach(function (it) {
      // 0.6.277: test 0.6.276 – velká elipsa až k zemi pustila AI i na drátěný plot před domem a AI ho
      // překreslila na trávník. Koruna se uvolní jen NAD výškou plotu (≈ 1,6 m), níž jen úzký pruh na kmen.
      var p = it.pts[0], tree = it.tool === 'tree', near = 0.6 + p[1];   // níž na fotce = blíž = větší
      var bx = p[0] * W, by = p[1] * H;
      if (tree) {
        var rx = W * 0.045 * near, top = by - H * 0.26 * near, bottom = by - H * 0.095 * near;
        g.beginPath(); g.ellipse(bx, (top + bottom) / 2, rx, (bottom - top) / 2, 0, 0, Math.PI * 2); g.fill();
        g.fillRect(bx - W * 0.006 * near, bottom - 2, W * 0.012 * near, by - bottom + 2);
      } else {
        g.beginPath(); g.ellipse(bx, by - H * 0.03 * near, W * 0.025 * near, H * 0.035 * near, 0, 0, Math.PI * 2); g.fill();
      }
    });
    return c;
  }

  /* Předkreslená zeď (2026-11-11, test 0.6.276: zeď z náčrtu udělala AI jen napůl, přední část chyběla).
   * Do fotky, kterou dostane AI (NE do originálu pro kontrolu změn), se v upravované ploše podél zdi
   * z náčrtu domaluje hrubý pás šedých kamenů – AI ho dotvoří na skutečnou zídku po celé délce. */
  function underpaint(photo, mask) {
    var walls = hasSketch() ? st.sketch.filter(function (it) { return it.tool === 'wall' && it.pts.length >= 2 && window.MVGreenSketch.done(it); }) : [];
    if (!walls.length || !mask) return photo;
    var W = photo.width, H = photo.height;
    var layer = document.createElement('canvas'); layer.width = W; layer.height = H; var g = layer.getContext('2d');
    var rnd = seeded(4242);
    walls.forEach(function (it) {
      for (var i = 1; i < it.pts.length; i++) {
        var a = it.pts[i - 1], b = it.pts[i], L = Math.hypot((b[0] - a[0]) * W, (b[1] - a[1]) * H), n = Math.max(2, Math.ceil(L / 6));
        for (var k = 0; k <= n; k++) {
          var t = k / n, x = (a[0] + (b[0] - a[0]) * t) * W, y = (a[1] + (b[1] - a[1]) * t) * H, near = 0.6 + y / H, hh = H * 0.05 * near;
          for (var r = 0; r < 3; r++) {
            var v = 105 + Math.floor(rnd() * 70);
            g.fillStyle = 'rgb(' + v + ',' + (v - 4) + ',' + (v - 12) + ')';
            g.fillRect(x - 5 + rnd() * 4, y - hh + r * hh / 3 + rnd() * 2, 10 + rnd() * 6, hh / 3 - 1);
          }
        }
      }
    });
    g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0, W, H);   // jen v upravované ploše
    var out = document.createElement('canvas'); out.width = W; out.height = H; var o = out.getContext('2d');
    o.drawImage(photo, 0, 0); o.globalAlpha = 0.85; o.drawImage(layer, 0, 0);
    return out;
  }

  /* ---------- krok 5: celý běh ---------- */
  function runAll() {
    if (st.busy) return;
    if (!cfg.isAdmin) return alert('Zkušební verze je zatím jen pro správce.');
    st.busy = true; st.log = []; render();
    var plants = pickPlants(), original = st.original, editMask = withCrowns(st.editMask);
    var wM = parseFloat(st.width) || 0;
    var prepared = S.prepare(underpaint(original, editMask), editMask);
    var bufferMask = S.occlusionMask(editMask, (wM || 15) / original.width);
    var ctx = { plants: plants };
    var plantList = plants.map(function (p) { return p.name + ' (' + p.latin + ')'; }).join('; ');
    log('Vybrané rostliny: ' + plants.map(function (p) { return p.name; }).join(', '));
    log('Posílám fotku AI (upravuje se ' + Math.round(prepared.coverage * 100) + ' % fotky)…');
    // 2026-11-11, majitel: „AI má být intuitivní, náčrt je vodítko … nechceme návrhy s chybami“ →
    // 1) AI architekt napíše odborné zadání, 2) kreslení podle něj, 3) kontrola a nejvýš jedna oprava.
    var guide = hasSketch() ? guideFor(prepared.box) : '';
    var gen = function (instr) {
      var f = { image: prepared.image, mask: S.maskToApi(bufferMask, prepared.box), coreMask: S.maskToApi(editMask, prepared.box), instructions: instr.slice(0, 5900) };
      if (guide) f.guide = guide;
      return ajax('mvgreen_ai_preview_start', f)
        .then(function (start) { log('AI kreslí návrh…'); return poll(start.jobId, 0); })
        .then(function (step) { if (!step.image) throw new Error(step.message || 'AI nevrátila obrázek.'); return loadImg(step.image); })
        .then(function (img) { return S.finish(original, editMask, img, prepared.box, bufferMask); });
    };
    var info = 'Styl: ' + STYLES[st.style] + ', údržba ' + CARES[st.care].toLowerCase() + '. ' + hintsText()
      + ' Rostliny k použití: ' + plantList + '. ' + ((st.removeNames || []).length ? 'Odstranit: ' + st.removeNames.join(', ') + '. ' : '')
      + ((st.landmarks || []).length ? 'Na fotce rozpoznáno: ' + st.landmarks.filter(function (l) { return l.kind !== 'sky'; }).map(function (l) { return l.name + (l.state === 'keep' ? ' (zůstává)' : l.state === 'remove' ? ' (pryč)' : ''); }).join(', ') + '.' : '');
    log('AI architekt promýšlí návrh podle vašeho zadání' + (hasSketch() ? ' a náčrtu' : '') + '…');
    ajax('mvgreen_ai_design_brief', { before: scaled(original, 1024), sketch: hasSketch() ? st.sketchPreview : '', marked: st.maskPreview || '', info: info })
      .then(function (b) { ctx.brief = b.brief || []; ctx.checks = b.checks || []; log('Zadání architekta: ' + ctx.brief.join(' | ')); },
        function (e) { ctx.brief = []; ctx.checks = []; log('Zadání architekta se nepovedlo (' + e.message + ') – kreslím podle náčrtu.'); })
      .then(function () {
        log('Posílám fotku AI (upravuje se ' + Math.round(prepared.coverage * 100) + ' % fotky)…');
        return gen(promptText(plants, ctx.brief));
      })
      .then(function (done) {
        if (!ctx.checks || !ctx.checks.length) return done;
        log('Kontroluji návrh, jestli nemá chyby…');
        return ajax('mvgreen_ai_design_check', { before: scaled(original, 1024), after: scaled(done.canvas, 1024), brief: ctx.brief.join(' / '), checks: ctx.checks.join(' / ') })
          .then(function (c) {
            if (c.ok || !c.fix) { log('Kontrola: bez podstatných chyb.'); return done; }
            log('Kontrola našla: ' + c.problems.join(' | ') + ' → překresluji s opravou.');
            return gen(promptText(plants, ctx.brief) + ' OPRAVA PO KONTROLE (nejdůležitější): ' + c.fix).then(function (d2) { log('Opravený návrh hotový.'); return d2; }, function (e) { log('Překreslení se nepovedlo (' + e.message + ') – použiji první návrh.'); return done; });
          }, function (e) { log('Kontrola se nepovedla (' + e.message + ') – pokračuji.'); return done; });
      })
      .then(function (done) {
        log(done.ok ? 'Vizualizace hotová a zkontrolovaná' + (done.repaired ? ' (okraj u chráněných prvků opraven)' : '') + '.' : 'Pozor: kontrola vizualizace hlásí odchylku ' + Math.round(done.drift) + ' – výsledek je potřeba posoudit.');
        ctx.after = done.canvas.toDataURL('image/jpeg', 0.9);
        ctx.before = scaled(original, 1600);
        log('AI čte z fotek přesný půdorys v metrech…');
        return ajax('mvgreen_ai_plan_v2', { after: scaled(done.canvas, 1600), before: scaled(original, 1024), marked: st.maskPreview || '', sketch: hasSketch() ? st.sketchPreview : '', plants: plantList, hints: hintsText() + ((ctx.brief || []).length ? ' ZADÁNÍ ARCHITEKTA (výsadba záhonů – podle něj vyjmenuj rostliny v záhonech): ' + ctx.brief.join(' / ') : '') });
      })
      .then(function (pl) {
        ctx.plan = pl.plan;
        log('Půdorys načten: ' + pl.plan.elements.length + ' prvků, ' + pl.plan.width_m + ' × ' + pl.plan.depth_m + ' m. Doplňuji údaje o rostlinách…');
        var brief = 'Styl: ' + STYLES[st.style] + '. Místo: ' + (st.geo ? st.geo.name : '') + ', ' + (st.climate ? st.climate.elevation + ' m n. m., ' + st.climate.zone : '') + '. Slunce: ' + st.sun + '. Přání: ' + (st.wish || 'žádné') + '. '
          // Test 4: koncept tvrdil „místo aut trávník“, přitom tam je podle náčrtu dlažba → AI pro texty dostává i náčrt a prvky půdorysu.
          + (hasSketch() ? 'Náčrt zákazníka: ' + window.MVGreenSketch.describe(st.sketch, st.landmarks).replace(/\n/g, ' ') + ' ' : '')
          + 'Prvky návrhu: ' + pl.plan.elements.filter(function (e) { return e.is_new; }).map(function (e) { return e.label; }).join(', ') + '. Popis AI: ' + (pl.plan.notes || '');
        return ajax('mvgreen_ai_plant_facts', { plants: plantList, brief: brief });
      })
      .then(function (fx) {
        ctx.facts = fx.facts;
        log('Údaje o rostlinách hotové. Hledám fotky rostlin…');
        return plants.reduce(function (pr, p) {
          return pr.then(function () { return ajax('mvgreen_plant_photo', { latin: p.latin, file: p.photoFile || '' }).then(function (ph) { p.photo = ph.url; p.credit = ph.url ? ph.author + ', Wikimedia Commons, ' + ph.license : ''; if (!ph.url) log('Fotka „' + p.name + '“ nenalezena (' + (ph.reason || '?') + ').'); }, function (e) { log('Fotka „' + p.name + '“: ' + e.message); }); });
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

  /* ---------- plán na fotce (2026-11-11) ----------
   * Majitel k osazovacímu plánu shora: „vůbec to nepřipomíná, co jsme si řekli … nikdo se v tom
   * nevyzná“. Půdorys z perspektivní fotky je nespolehlivý (zkoušel se i přepočet na zem – širokoúhlý
   * objektiv a svah ho rozbily). Majitel vybral „plán na fotce“: obrysy z náčrtu na vizualizaci PO,
   * v záhonech čísla rostlin, legenda s počty. Počty dál počítá plan-render (spon × plocha záhonu). */
  var PP_COL = { bed: '#E0349A', paving: '#2F7DE1', gravel: '#E2B400', path: '#FF8A00', wall: '#E53935', steps: '#00A8B8', lawn: '#35B84A' };
  function photoPlan(project, legend) {
    if (!hasSketch() || !st.original) return null;
    var items = st.sketch.filter(window.MVGreenSketch.done), VW = 1000, VH = Math.round(1000 * st.original.height / st.original.width);
    var X = function (p) { return Math.round(p[0] * VW); }, Y = function (p) { return Math.round(p[1] * VH); };
    var cen = function (pts) { return [pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length]; };
    var closedLine = function (pts) { var a = pts[0], b = pts[pts.length - 1]; return pts.length >= 6 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05; };
    var svg = '', labels = [], n = { bed: 0, gravel: 0 };
    // záhony z náčrtu ↔ záhony půdorysu (rostliny) podle pořadí zleva doprava
    var skBeds = items.filter(function (it) { return it.tool === 'bed'; }).sort(function (a, b) { return cen(a.pts)[0] - cen(b.pts)[0]; });
    var prBeds = project.beds.map(function (b, i) { return { i: i, b: b, c: cen(b.poly) }; }).filter(function (o) { return o.b.surface !== 'gravel'; }).sort(function (a, b) { return a.c[0] - b.c[0]; });
    var bedNo = function (it) { return skBeds.indexOf(it) + 1; };
    items.forEach(function (it) {
      var t = it.tool, pts = it.pts, col = PP_COL[t === 'path' && closedLine(pts) ? 'path' : t];
      if (!col || t === 'lawn') return;
      var d = pts.map(function (p, k) { return (k ? 'L' : 'M') + X(p) + ' ' + Y(p); }).join(' ');
      var area = t === 'bed' || t === 'paving' || t === 'gravel' || (t === 'path' && closedLine(pts));
      // 2026-11-11: AI tvary podle náčrtu sama vylepšuje → obrysy z náčrtu by s vizualizací neseděly; jen popisky a čísla
      void d;
      var txt = t === 'bed' ? 'Záhon ' + bedNo(it) : t === 'gravel' ? 'Kačírek' : t === 'paving' ? 'Zámková dlažba' : t === 'path' ? 'Cesta' : t === 'wall' ? 'Opěrná zeď' : 'Schody';
      var c = area ? cen(pts) : pts[Math.floor(pts.length / 2)];
      labels.push({ x: X(c), y: Y(c) - (t === 'bed' ? 26 : 0), t: txt, col: col });
    });
    // čísla rostlin uvnitř záhonů
    var badge = function (x, y, num) { return '<circle cx="' + x + '" cy="' + y + '" r="15" fill="#2E5E2C" stroke="#FFFFFF" stroke-width="3"/><text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="16" fill="#FFFFFF">' + num + '</text>'; };
    var bedRows = [];
    skBeds.forEach(function (it, k) {
      var pr = prBeds[k], nums = [];
      if (pr) legend.forEach(function (l) { if (l.beds && l.beds[pr.i]) nums.push({ num: l.num, count: l.beds[pr.i] }); });
      bedRows.push({ name: 'Záhon ' + (k + 1), area: pr ? window.MVGreenPlanV2.polyArea(pr.b.poly) : 0, plants: nums });
      if (!nums.length) return;
      var xs = it.pts.map(function (p) { return p[0]; }), ys = it.pts.map(function (p) { return p[1]; }), cand = [];
      for (var gx = Math.min.apply(null, xs); gx <= Math.max.apply(null, xs); gx += 0.012)
        for (var gy = Math.min.apply(null, ys); gy <= Math.max.apply(null, ys); gy += 0.012) if (pip([gx, gy], it.pts)) cand.push([gx, gy]);
      if (!cand.length) cand = [cen(it.pts)];
      cand.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      nums.forEach(function (o, j) { var p = cand[Math.floor((j + 0.5) * cand.length / nums.length)]; svg += badge(X(p), Y(p), o.num); });
    });
    // stromy a keře z náčrtu: číslo druhu přímo na místě ťuknutí
    items.forEach(function (it) {
      if (it.tool !== 'tree' && it.tool !== 'shrub') return;
      var l = legend.filter(function (q) { return q.kind === it.tool && !Object.keys(q.beds || {}).length; })[0];
      if (l) svg += badge(X(it.pts[0]), Y(it.pts[0]) - 12, l.num);
    });
    labels.forEach(function (l) {
      svg += '<text x="' + l.x + '" y="' + l.y + '" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF" stroke="' + l.col + '" stroke-width="6" paint-order="stroke" stroke-linejoin="round">' + esc(l.t) + '</text>';
    });
    var html = '<div class="mvg2-pp"><div class="mvg2-pp__img"><img src="' + ctxAfterSrc + '" alt="Plán na fotce"><svg viewBox="0 0 ' + VW + ' ' + VH + '" preserveAspectRatio="none">' + svg + '</svg></div>'
      + '<div class="mvg2-pp__legend"><strong>Rostliny</strong><ol>' + legend.map(function (l) {
        var where = bedRows.filter(function (r) { return r.plants.some(function (p) { return p.num === l.num; }); }).map(function (r) { return r.name + ': ' + r.plants.filter(function (p) { return p.num === l.num; })[0].count + ' ks'; });
        return '<li><b>' + l.num + '</b><span><strong>' + esc(l.name) + '</strong><i>' + esc(l.latin) + '</i><em>celkem ' + l.count + ' ks' + (where.length ? ' · ' + esc(where.join(', ')) : '') + '</em></span></li>';
      }).join('') + '</ol><p>Popisky ukazují prvky z vašeho zadání, čísla, který druh patří do kterého záhonu. Přesné rozmístění rostlin udělejte podle sponu (strana 5).</p></div></div>';
    return { html: html, bedRows: bedRows };
  }
  var ctxAfterSrc = '';

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
      if ((t === 'fence' || t === 'wall') && pts.length >= 2) { (t === 'fence' ? project.fences : project.walls).push(t === 'fence' ? { line: pts } : { line: pts, width: Math.max(0.2, el.width_m || 0.3), isNew: !!el.is_new }); lines.push(pts); }
      else if (t === 'hedge' && pts.length >= 2) { lines.push(pts); for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (var s = 0; s <= L; s += 0.8) project.existingPlants.push({ kind: 'shrub', leaf: '#3F6E45', r: 0.5, x: a[0] + (b[0] - a[0]) * s / L, y: a[1] + (b[1] - a[1]) * s / L }); } }
      else if ((t === 'path' || t === 'stepping') && pts.length >= 2) project.paths.push({ surface: 'gravel', width: Math.max(0.5, el.width_m || 1), stones: t === 'stepping' ? 0.65 : 0, line: pts });
      else if (t === 'tree') project.existingPlants.push({ kind: 'tree', leaf: '#5E8E46', r: 1.2, x: pts[0][0], y: pts[0][1] });
      else if (t === 'shrub') project.existingPlants.push({ kind: 'shrub', leaf: '#4B7A40', r: 0.5, x: pts[0][0], y: pts[0][1] });
      else if (pts.length >= 3) {
        if (t === 'lawn') project.areas.push({ type: 'lawn', poly: pts });
        else if (t === 'house') project.areas.push({ type: 'building', poly: pts });
        else if (t === 'terrace' || t === 'paving') project.areas.push({ type: 'paving', poly: pts, isNew: !!el.is_new });
        else if (t === 'structure' || t === 'steps') project.structures.push({ poly: pts, isNew: !!el.is_new, steps: t === 'steps' || /schod/i.test(el.label || '') });
        else if (t === 'gravel') project.beds.push({ surface: 'gravel', poly: pts, plants: [] });
        else if (t === 'bed') {
          var specs = (el.plants || []).map(function (x) { return byName(x.name); }).filter(Boolean);
          specs = specs.filter(function (s2, k) { return specs.indexOf(s2) === k; });
          specs = specs.filter(function (s2) { return s2.role !== 'solo'; });
          if (specs.length < 2) specs = ctx.plants.filter(function (p) { return p.role !== 'solo'; });
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

    // 2026-11-11 (test 0.6.276): architekt rozdělil 10 druhů, půdorys z obrázku převzal jen 6 → PDF
    // neodpovídalo zadání. Každý vybraný druh (kromě stromů/keřů z náčrtu) musí být v některém záhonu.
    var mulchBeds = project.beds.filter(function (b) { return b.surface !== 'gravel'; });
    if (mulchBeds.length) {
      var bigBed = mulchBeds.slice().sort(function (a, b) { return window.MVGreenPlanV2.polyArea(b.poly) - window.MVGreenPlanV2.polyArea(a.poly); })[0];
      ctx.plants.forEach(function (p) {
        if (p.role === 'solo' || mulchBeds.some(function (b) { return b.plants.some(function (q) { return q.key === p.key; }); })) return;
        bigBed.plants.push(Object.assign({}, p, { share: p.role === 'back' ? 0.3 : 0.35 }));
      });
    }
    var sheet = window.MVGreenPlanV2.renderSheet(project);
    ctxAfterSrc = ctx.after || '';
    ctx.plants.filter(function (p) { return p.role === 'solo'; }).forEach(function (p) {
      if (!sheet.legend.some(function (l) { return l.key === p.key; })) sheet.legend.push({ key: p.key, name: p.name, latin: p.latin, kind: p.kind, leaf: p.leaf, flower: p.flower, count: p.soloCount, inst: [], beds: {}, num: sheet.legend.length + 1 });
    });
    var pplan = photoPlan(project, sheet.legend);
    var area = window.MVGreenPlanV2.polyArea;
    var plants = sheet.legend.map(function (l) {
      var spec = ctx.plants.filter(function (p) { return p.key === l.key; })[0] || {}, f = factsBy[String(l.latin).toLowerCase()] || {};
      return { name: l.name, latin: l.latin, count: l.count, color: spec.color, photo: spec.photo, credit: spec.credit, spacing: f.spacing_cm || Math.round((spec.spon || 0.4) * 100), height_cm: f.height_cm || Math.round((spec.height || 0.5) * 100), width_cm: f.width_cm,
        // Kvetení bere z katalogu (má ho každá rostlina; null = nekvete okrasně). AI ho u stálezelených
        // vyplňovala na celý rok (Martin 2026-11-08) – AI údaj jen pro rostliny mimo katalog.
        bloom_from: spec.bloom !== undefined ? (spec.bloom || [])[0] : f.bloom_from, bloom_to: spec.bloom !== undefined ? (spec.bloom || [])[1] : f.bloom_to, sun: f.sun, water: f.water, pruning: f.pruning, toxic: f.pet_toxic, price: f.price_czk, container: f.container, alternative: f.alternative, alternative_reason: f.alternative_reason };
    });
    var lawnArea = w * d - project.beds.reduce(function (s, b) { return s + area(b.poly); }, 0) - project.areas.filter(function (a) { return a.type === 'paving' || a.type === 'building'; }).reduce(function (s, a) { return s + area(a.poly); }, 0);
    // Projektový model (2026-11-11, bod 1 „projekt za 50 000 Kč“): JEDEN zdroj pravdy pro výměry,
    // rozpočet, nákupní seznam, nářadí a harmonogram v PDF (dřív si každá strana počítala zvlášť).
    var perim = function (poly) { var s2 = 0; for (var i = 0; i < poly.length; i++) { var a2 = poly[i], b2 = poly[(i + 1) % poly.length]; s2 += Math.hypot(b2[0] - a2[0], b2[1] - a2[1]); } return s2; };
    var lineLen = function (l) { var s2 = 0; for (var i = 1; i < l.length; i++) s2 += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s2; };
    // Test 2026-11-11 (studna): zákazník nakreslil zeď, architekt ji zadal, AI ji nakreslila – ale půdorys
    // ji měl jako stávající, takže v rozpočtu chyběla. Zeď z náčrtu je VŽDY nová; délka z půdorysu,
    // jinak hrubě z náčrtu (šířka × hloubka zahrady). Cesta: když ji architekt zadal z dlažby/kamene,
    // počítá se jako dlažba (ne štěrk).
    var skWalls = hasSketch() ? st.sketch.filter(function (it) { return it.tool === 'wall' && window.MVGreenSketch.done(it); }) : [];
    var newWalls = project.walls.filter(function (w2) { return w2.isNew; }).map(function (w2) { return { length: lineLen(w2.line), height: 0.6 }; });
    if (skWalls.length && !newWalls.length) newWalls = skWalls.map(function (it) {
      var fromPlan = project.walls.map(function (w2) { return lineLen(w2.line); }).sort(function (x, y) { return y - x; })[0];
      return { length: fromPlan || lineLen(it.pts.map(function (p) { return [p[0] * w, p[1] * d]; })), height: 0.6 };
    });
    var pavedPath = /dlažb|dlaždic|kamenn[áé] (cest|chodník)|chodník[^.]*kámen/i.test((ctx.brief || []).filter(function (t) { return /cest|chodník/i.test(t); }).join(' '));
    var pathPaving = pavedPath ? project.paths.map(function (p2) { var L = lineLen(p2.line); return { area: L * (p2.width || 1), perimeter: 2 * L }; }) : [];
    var model = {
      beds: project.beds.filter(function (b) { return b.surface !== 'gravel'; }).map(function (b) { return { area: area(b.poly), perimeter: perim(b.poly) }; }),
      gravel: project.beds.filter(function (b) { return b.surface === 'gravel'; }).map(function (b) { return { area: area(b.poly), perimeter: perim(b.poly) }; }),
      paving: project.areas.filter(function (a2) { return a2.type === 'paving' && a2.isNew; }).map(function (a2) { return { area: area(a2.poly), perimeter: perim(a2.poly) }; }).concat(pathPaving),
      paths: pavedPath ? [] : project.paths.map(function (p2) { var L = lineLen(p2.line); return { length: L, area: L * (p2.width || 1) }; }),
      walls: newWalls,
      steps: project.structures.filter(function (s3) { return s3.steps && s3.isNew; }).map(function () { return { count: 3 }; }),
      lawn: Math.max(0, lawnArea), lawnExtra: parseFloat(st.extraLawn) || 0
    };
    var estimate = window.MVGreenKB ? window.MVGreenKB.estimate(model, plants.map(function (p2) { var spec = ctx.plants.filter(function (q) { return q.name === p2.name; })[0] || {}; return { name: p2.name, count: p2.count, price: p2.price, kind: spec.kind, container: p2.container }; })) : null;
    var usersL = [st.users.kids && 'děti', st.users.dog && 'pes', st.users.cat && 'kočka'].filter(Boolean);
    var fencesL = Object.keys(st.fence).filter(function (k) { return st.fence[k]; }).map(function (k) { return SIDES[k]; });
    var pctx = { logo: cfg.logo, place: project.place || st.place, date: project.date, number: 'MVG-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4), name: st.name,
      styleLabel: STYLES[st.style] + ', údržba ' + CARES[st.care].toLowerCase(), before: ctx.before, after: ctx.after, marked: st.maskPreview, sketch: hasSketch() ? st.sketchPreview : '', facts: ctx.facts, plants: plants, climate: st.climate,
      sizeLabel: '≈ ' + w.toFixed(0) + ' × ' + d.toFixed(0) + ' m', sun: st.sun, orient: st.orient, house: st.house, fences: fencesL, soil: st.soil, soilLabel: SOILS[st.soil],
      usersLabel: usersL.length ? usersL.join(', ') : 'bez dětí a zvířat', water: st.water, sheetHtml: sheet.html, photoPlanHtml: pplan ? pplan.html : '', bedRows: pplan ? pplan.bedRows : null, project: project, lawnArea: Math.max(0, lawnArea) + (parseFloat(st.extraLawn) || 0), model: model, estimate: estimate, extraLawn: parseFloat(st.extraLawn) || 0, planNotes: plan.notes };
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
