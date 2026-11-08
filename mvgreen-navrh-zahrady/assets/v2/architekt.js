/*
 * MVGreen AI architekt v2 – průvodce (2026-11-08, Martin: „vyzkoušíme jeden úplně kompletní až do
 * 11 stránek v PDF“). Pět kroků podle schváleného návrhu vzhledu:
 *   1 Fotka a co zůstane (mg-paint-mask.js)  2 Místo a podmínky  3 Přání  4 Shrnutí  5 Projekt
 * Projekt = AI vizualizace (mvgreen_ai_preview_start/_step + ai-safety.js) → půdorys z výsledku
 * (mvgreen_ai_plan) → údaje o rostlinách a koncept (mvgreen_ai_plant_facts) → malovaný výkres
 * (plan-render.js) → 11 stran PDF (architekt-pdf.js).
 * Zatím jen pro správce (levná testovací kvalita AI, denní limit) – platba se napojí po testech.
 */
(function () {
  'use strict';
  var root = document.querySelector('[data-mvgreen-architekt]');
  if (!root || !window.MVGreenPlanV2) return;
  var cfg = window.MVGreenArchitekt || {}, AI = window.MVGreenAI || {};
  var S = window.MVGreenAISafety, P = window.MVGreenPaintMask, Brief = window.MVGreenBrief;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var $ = function (sel) { return root.querySelector(sel); };

  if (cfg.demo) { renderDemo(); return; }

  /* ---------- stav ---------- */
  var st = {
    step: 1, original: null, editMask: null, maskPreview: '', photoName: '',
    place: '', geo: null, climate: null, sun: 'Slunce', soil: 'unknown', water: 'hose', width: '', depth: '',
    style: 'prirodni', wish: '', users: { kids: false, dog: false, cat: false }, care: 'mid', name: '',
    result: null, busy: false, log: []
  };
  var STYLES = { prirodni: 'Přírodní', moderni: 'Moderní', nizka: 'Nízká údržba', rodina: 'Pro rodinu' };
  var SOILS = { unknown: 'Nevím', normal: 'Hlinitá', sand: 'Písčitá', clay: 'Jílovitá' };
  var CARES = { low: 'Málo', mid: 'Středně', high: 'Hodně' };
  var WATERS = { hose: 'Hadice', auto: 'Automatická závlaha', none: 'Žádná' };

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
  function scaled(canvas, maxSide, type, q) {
    var s = Math.min(1, maxSide / Math.max(canvas.width, canvas.height)), c = document.createElement('canvas');
    c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL(type || 'image/jpeg', q || 0.88);
  }
  function log(msg) { st.log.push(new Date().toLocaleTimeString('cs-CZ') + ' – ' + msg); var el = $('[data-log]'); if (el) el.innerHTML = st.log.map(esc).join('<br>'); }
  function seeded(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function shuffle(a, rnd) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function chips(name, map, cur) {
    return '<div class="mvg2-chips">' + Object.keys(map).map(function (k) { return '<button type="button" class="mvg2-chip' + (cur === k ? ' is-on' : '') + '" data-set="' + name + '" data-val="' + k + '">' + esc(map[k]) + '</button>'; }).join('') + '</div>';
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
      h += '<h2>Kde zahrada je?</h2><p class="mvg2-sub">Podle místa vybereme rostliny, které u vás přezimují.</p>'
        + '<div class="mvg2-row"><input type="text" placeholder="Obec, např. Pelechy" value="' + esc(st.place) + '" data-place><button type="button" class="mvg2-btn" data-geo>Zjistit podmínky</button></div>'
        + (c ? '<div class="mvg2-cards3">' + [[c.elevation + ' m n. m.', 'nadmořská výška'], [c.precip ? c.precip + ' mm' : '—', 'srážky za rok'], [c.zone, 'mrazuvzdornost'], [esc(st.geo.name), 'místo']].map(function (x) { return '<div><strong>' + x[0] + '</strong><span>' + x[1] + '</span></div>'; }).join('') + '</div>' : '')
        + '<h3>Kolik slunce tam svítí?</h3>' + chips('sun', { 'Slunce': 'Slunce', 'Polostín': 'Polostín', 'Stín': 'Stín' }, st.sun)
        + '<h3>Jakou máte půdu?</h3>' + chips('soil', SOILS, st.soil)
        + '<h3>Přibližné rozměry upravované plochy (m)</h3><div class="mvg2-row"><input type="number" placeholder="šířka" value="' + esc(st.width) + '" data-w><input type="number" placeholder="hloubka" value="' + esc(st.depth) + '" data-d></div><p class="mvg2-sub">Nevíte? Nechte prázdné – odhadneme z fotky.</p>'
        + '<h3>Voda na zahradě</h3>' + chips('water', WATERS, st.water)
        + nav(!!st.climate);
    } else if (st.step === 3) {
      h += '<h2>Jak chcete navrhovat?</h2>'
        + '<h3>Styl</h3>' + chips('style', STYLES, st.style)
        + '<h3>Co si přejete? (nepovinné)</h3><textarea rows="4" placeholder="Např. záhon podél plotu, cestičku k terase, trávník ať zůstane co největší." data-wish>' + esc(st.wish) + '</textarea>'
        + '<h3>Kdo bude zahradu užívat?</h3><div class="mvg2-chips">' + [['kids', 'Děti'], ['dog', 'Pes'], ['cat', 'Kočka']].map(function (u) { return '<button type="button" class="mvg2-chip' + (st.users[u[0]] ? ' is-on' : '') + '" data-user="' + u[0] + '">' + u[1] + '</button>'; }).join('') + '</div>'
        + '<h3>Kolik času chcete údržbě věnovat?</h3>' + chips('care', CARES, st.care)
        + nav(true);
    } else if (st.step === 4) {
      h += '<h2>Shrnutí</h2><table class="mvg2-table"><tbody>'
        + [['Fotka', st.photoName], ['Místo', st.geo ? st.geo.name + ' · ' + st.climate.zone : '—'], ['Slunce / půda', st.sun + ' · ' + SOILS[st.soil]], ['Styl', STYLES[st.style]], ['Přání', st.wish || '—'], ['Údržba', CARES[st.care]]].map(function (r) { return '<tr><td>' + r[0] + '</td><td><strong>' + esc(r[1]) + '</strong></td></tr>'; }).join('')
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
    root.querySelectorAll('[data-set]').forEach(function (b) { b.onclick = function () { st[b.dataset.set] = b.dataset.val; render(); }; });
    root.querySelectorAll('[data-user]').forEach(function (b) { b.onclick = function () { st.users[b.dataset.user] = !st.users[b.dataset.user]; render(); }; });
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
      st.original = c; st.photoName = file.name; st.editMask = null; st.maskPreview = ''; st.cacheKey = url;
      render();
    }).catch(function (e) { alert(e.message); });
  }
  function markArea() {
    P.confirmPaintMask(st.original, 'Označte „Zůstane“ všechno, co se nesmí změnit (dům, plot, dlažba, stromy), a „Odstranit“ to, co má zmizet. Zbytek smí AI navrhnout znovu.', { cacheKey: st.cacheKey, initialCategory: st.paintCategory || null })
      .then(function (r) {
        if (!r) return;
        st.paintCategory = r.category; st.editMask = S.growMask(r.editMask); st.maskPreview = r.previewDataUrl || '';
        render();
      });
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
        // Mrazová zóna jen orientačně podle nadmořské výšky v ČR (vysvětleno v PDF jako odhad).
        var zone = el < 250 ? '7b' : el < 450 ? '7a' : el < 650 ? '6b' : el < 850 ? '6a' : '5b';
        st.geo = { name: g.name + (g.admin2 ? ', ' + g.admin2 : ''), lat: g.latitude, lon: g.longitude };
        st.climate = { elevation: el, precip: ann ? Math.round(ann * 365) : null, zone: 'zóna ' + zone };
        render();
      }).catch(function (e) { alert(e.message || 'Podmínky se nepodařilo zjistit.'); });
  }

  /* ---------- výběr rostlin z katalogu ---------- */
  var COLOR_HEX = { purple: '#7D6BBE', white: '#FBFAF2', pink: '#E0708A', yellow: '#E6B931', red: '#C9454F', green: '' };
  function pickPlants() {
    var cat = window.MVGreenPlantCatalog || [], rnd = seeded(Date.now() % 100000);
    var water = st.water === 'none' ? 'dry' : 'normal';
    var fits = function (p) { return (p.sun || []).indexOf(st.sun) >= 0 && (p.water || []).indexOf(water) >= 0 && (st.soil === 'unknown' || (p.soil || []).indexOf(st.soil) >= 0); };
    var maxH = function (p) { var m = String(p.height || '').match(/([\d.]+)\s*cm\s*$/); return m ? +m[1] : 60; };
    var pool = shuffle(cat.filter(fits), rnd);
    var take = function (filter, n) { return pool.filter(filter).slice(0, n); };
    var chosen = [].concat(
      take(function (p) { return p.category === 'grasses'; }, 1),
      take(function (p) { return p.category === 'shrubs' && maxH(p) <= 200; }, 2),
      take(function (p) { return p.category === 'flowers' && maxH(p) <= 120; }, 3)
    );
    return chosen.map(function (p) {
      var h = maxH(p) / 100, col = Brief && Brief.colorOf ? Brief.colorOf(p) : 'green';
      var kind = p.category === 'grasses' ? (h < 0.45 ? 'lowgrass' : 'grass') : p.category === 'shrubs' ? 'shrub' : 'perennial';
      return { key: p.id, name: p.name, latin: p.latin, kind: kind, height: h, spon: Math.max(0.25, Math.min(1.8, 1 / Math.sqrt(p.density || 3))),
        leaf: kind === 'grass' ? '#BDB46A' : kind === 'lowgrass' ? '#9AB3BB' : kind === 'shrub' ? '#4B7A40' : '#7E9A6E', flower: COLOR_HEX[col] || '', color: COLOR_HEX[col] || '#8E7CC3' };
    });
  }

  function promptText(plants) {
    var users = [st.users.kids && 'děti', st.users.dog && 'pes', st.users.cat && 'kočka'].filter(Boolean);
    return 'Navrhni zahradu ve stylu „' + STYLES[st.style] + '“ s ' + { low: 'minimální', mid: 'střední', high: 'vyšší' }[st.care] + ' údržbou. '
      + (st.wish ? 'PŘÁNÍ ZÁKAZNÍKA (má přednost před vším ostatním): ' + st.wish + '. ' : '')
      + 'Trávník zachovej jako hlavní plochu, nové záhony dej hlavně podél plotů, zdí a okrajů s jasnou, plynule zaoblenou hranou a obrubou. '
      + 'Použij POUZE tyto rostliny: ' + plants.map(function (p) { return p.name + ' (' + p.latin + ')'; }).join('; ') + '. '
      + 'Rostliny sázej ve skupinách po 3–7 kusech stejného druhu, vysoké dozadu, nízké dopředu, záhon mulčuj. '
      + (users.length ? 'Zahradu užívají: ' + users.join(', ') + ' – žádné trnité keře u cest. ' : '')
      + 'Výsledek musí vypadat jako skutečná fotografie realizované zahrady v ' + (st.climate ? st.climate.zone : 'ČR') + '.';
  }

  /* ---------- krok 5: celý běh ---------- */
  function runAll() {
    if (st.busy) return;
    if (!cfg.isAdmin) return alert('Zkušební verze je zatím jen pro správce.');
    st.busy = true; st.log = []; render();
    var plants = pickPlants(), original = st.original, editMask = st.editMask;
    var wM = parseFloat(st.width) || 0, dM = parseFloat(st.depth) || 0;
    var prepared = S.prepare(original, editMask);
    var mpp = (wM || 15) / original.width;
    var bufferMask = S.occlusionMask(editMask, mpp);
    var ctx = { plants: plants };
    log('Vybrané rostliny: ' + plants.map(function (p) { return p.name; }).join(', '));
    log('Posílám fotku AI (upravuje se ' + Math.round(prepared.coverage * 100) + ' % fotky)…');
    ajax('mvgreen_ai_preview_start', { image: prepared.image, mask: S.maskToApi(bufferMask, prepared.box), coreMask: S.maskToApi(editMask, prepared.box), instructions: promptText(plants) })
      .then(function (start) { log('AI kreslí návrh (' + (start.totalStages || 1) + ' krok)…'); return poll(start.jobId, 0); })
      .then(function (step) {
        if (!step.image) throw new Error(step.message || 'AI nevrátila obrázek.');
        return loadImg(step.image);
      })
      .then(function (img) {
        var done = S.finish(original, editMask, img, prepared.box, bufferMask);
        log(done.ok ? 'Vizualizace hotová a zkontrolovaná' + (done.repaired ? ' (okraj u chráněných prvků opraven)' : '') + '.' : 'Pozor: kontrola vizualizace hlásí odchylku ' + Math.round(done.drift) + ' – pokračuji, ale výsledek je potřeba posoudit.');
        ctx.after = done.canvas.toDataURL('image/jpeg', 0.9);
        ctx.before = scaled(original, 1600);
        log('AI čte z výsledku půdorys zahrady…');
        return ajax('mvgreen_ai_plan', { image: scaled(done.canvas, 1600), before: ctx.before, plants: plants.map(function (p) { return p.name + ' (' + p.latin + ')'; }).join(', '), style: STYLES[st.style], width: wM, length: dM, markers: 0 });
      })
      .then(function (pl) {
        ctx.plan = pl.plan;
        log('Půdorys načten (' + (pl.plan.elements || []).length + ' prvků, ' + pl.plan.site.width_m + ' × ' + pl.plan.site.depth_m + ' m). Doplňuji údaje o rostlinách…');
        var brief = 'Styl: ' + STYLES[st.style] + '. Místo: ' + (st.geo ? st.geo.name : '') + ', ' + (st.climate ? st.climate.elevation + ' m n. m., ' + st.climate.zone : '') + '. Slunce: ' + st.sun + '. Přání: ' + (st.wish || 'žádné') + '. Popis AI: ' + (pl.plan.notes || '');
        return ajax('mvgreen_ai_plant_facts', { plants: plants.map(function (p) { return p.name + ' (' + p.latin + ')'; }).join('; '), brief: brief });
      })
      .then(function (fx) {
        ctx.facts = fx.facts;
        log('Údaje o rostlinách hotové. Kreslím výkres a skládám PDF…');
        buildResult(ctx);
        st.busy = false; st.step = 5; render();
      })
      .catch(function (e) { st.busy = false; log('CHYBA: ' + e.message); render(); });
  }
  function poll(jobId, fails) {
    return ajax('mvgreen_ai_preview_step', { jobId: jobId }).then(function (s) {
      if (s.done) return s;
      log('Hotovo ' + (s.completedStages || 0) + ' z ' + (s.totalStages || 1) + '…');
      return poll(jobId, 0);
    }, function (e) {
      if ((e.data && e.data.final) || fails >= 6) throw e;
      return new Promise(function (r) { setTimeout(r, 3000 * (fails + 1)); }).then(function () { return poll(jobId, fails + 1); });
    });
  }

  /* ---------- z AI půdorysu na projekt v metrech ---------- */
  function buildResult(ctx) {
    var plan = ctx.plan, w = parseFloat(st.width) || plan.site.width_m || 15, d = parseFloat(st.depth) || plan.site.depth_m || 10;
    var M = function (poly) { return (poly || []).map(function (q) { return [q[0] / 100 * w, q[1] / 100 * d]; }); };
    var byName = function (n) { n = String(n || '').toLowerCase(); return ctx.plants.filter(function (p) { return n.indexOf(p.name.toLowerCase()) >= 0 || n.indexOf(p.latin.toLowerCase().split(' ')[0]) >= 0; })[0]; };
    var factsBy = {}; (ctx.facts.plants || []).forEach(function (f) { factsBy[String(f.latin).toLowerCase()] = f; });
    ctx.plants.forEach(function (p) { var f = factsBy[p.latin.toLowerCase()]; if (f) { p.spon = Math.max(0.2, Math.min(2, (f.spacing_cm || p.spon * 100) / 100)); p.height = (f.height_cm || p.height * 100) / 100; } });
    var project = { title: ctx.facts.title || 'Projekt zahrady', place: st.geo ? st.geo.name : '', date: new Date().toLocaleDateString('cs-CZ'), seed: 5,
      site: { w: w, h: d }, brand: { logo: cfg.logo, web: 'mvgreen.cz', phone: '723 339 650' }, photoBefore: ctx.before, photoAfter: ctx.after,
      areas: [{ type: 'outside', poly: [[0, 0], [w, 0], [w, d], [0, d]] }], beds: [], paths: [], walls: [], structures: [], fences: [], existingPlants: [], labels: [] };
    (plan.elements || []).forEach(function (el) {
      var poly = M(el.polygon);
      if (el.type === 'lawn') { project.areas.push({ type: 'lawn', poly: poly }); }
      else if (el.type === 'house') { project.areas.push({ type: 'building', poly: poly }); }
      else if (el.type === 'terrace' || el.type === 'path' || el.type === 'gravel') { if (poly.length >= 3) project.areas.push({ type: 'paving', poly: poly }); }
      else if (el.type === 'bed' && poly.length >= 3) {
        var specs = (el.plants || []).map(function (x) { return byName(x.name); }).filter(Boolean);
        specs = specs.filter(function (s, i) { return specs.indexOf(s) === i; });
        if (!specs.length) specs = ctx.plants.slice(0, 3);
        project.beds.push({ surface: 'mulch', poly: poly, plants: specs.map(function (s) { return Object.assign({}, s, { share: 1 / specs.length }); }) });
      }
      else if (el.type === 'fence' && poly.length >= 2) { project.fences.push({ line: poly }); }
      else if (el.type === 'hedge') { poly.forEach(function (q) { project.existingPlants.push({ kind: 'shrub', leaf: '#3F6E45', r: 0.5, x: q[0], y: q[1] }); }); }
      else if (el.type === 'tree' && poly[0]) { project.existingPlants.push({ kind: 'tree', leaf: '#5E8E46', r: 1.1, x: poly[0][0], y: poly[0][1] }); }
      else if (el.type === 'shrub' && poly[0]) { project.existingPlants.push({ kind: 'shrub', leaf: '#4B7A40', r: 0.5, x: poly[0][0], y: poly[0][1] }); }
      if (el.label && poly.length >= 3 && ['lawn', 'house', 'terrace'].indexOf(el.type) >= 0) {
        var c = [0, 0]; poly.forEach(function (q) { c[0] += q[0] / poly.length; c[1] += q[1] / poly.length; });
        project.labels.push({ text: el.label, x: c[0], y: c[1], size: el.type === 'lawn' ? 24 : 20, color: el.type === 'lawn' ? '#2E5B33' : '#1E2A22' });
      }
    });
    // Trávník pod ostatními plochami: kreslí se před záhony (plan-render kreslí lawn před beds).
    var sheet = window.MVGreenPlanV2.renderSheet(project);
    var area = window.MVGreenPlanV2.polyArea;
    var plants = sheet.legend.map(function (l) {
      var spec = ctx.plants.filter(function (p) { return p.key === l.key; })[0] || {}, f = factsBy[String(l.latin).toLowerCase()] || {};
      return { name: l.name, latin: l.latin, count: l.count, color: spec.color, spacing: f.spacing_cm, height_cm: f.height_cm, width_cm: f.width_cm, bloom_from: f.bloom_from, bloom_to: f.bloom_to,
        sun: f.sun, water: f.water, pruning: f.pruning, toxic: f.pet_toxic, price: f.price_czk, container: f.container, alternative: f.alternative, alternative_reason: f.alternative_reason };
    });
    var dims = function (poly) { var xs = poly.map(function (q) { return q[0]; }), ys = poly.map(function (q) { return q[1]; }); return (Math.max.apply(null, xs) - Math.min.apply(null, xs)).toFixed(1).replace('.', ',') + ' × ' + (Math.max.apply(null, ys) - Math.min.apply(null, ys)).toFixed(1).replace('.', ',') + ' m'; };
    var areas = [];
    project.beds.forEach(function (b, i) { areas.push({ name: 'Záhon ' + (i + 1), dims: dims(b.poly), area: area(b.poly).toFixed(1).replace('.', ',') + ' m²' }); });
    var lawnArea = 0; project.areas.filter(function (a) { return a.type === 'lawn'; }).forEach(function (a, i) { var ar = area(a.poly); lawnArea += ar; areas.push({ name: 'Trávník ' + (i + 1), dims: dims(a.poly), area: ar.toFixed(1).replace('.', ',') + ' m²' }); });
    var usersL = [st.users.kids && 'děti', st.users.dog && 'pes', st.users.cat && 'kočka'].filter(Boolean);
    var pctx = { logo: cfg.logo, place: project.place || st.place, date: project.date, number: 'MVG-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4), name: st.name,
      styleLabel: STYLES[st.style] + ', údržba ' + CARES[st.care].toLowerCase(), before: ctx.before, after: ctx.after, facts: ctx.facts, plants: plants, climate: st.climate,
      sizeLabel: '≈ ' + w.toFixed(0) + ' × ' + d.toFixed(0) + ' m', sunLabel: st.sun, soil: st.soil, soilLabel: SOILS[st.soil], usersLabel: usersL.length ? usersL.join(', ') : 'bez dětí a zvířat',
      water: st.water, sheetHtml: sheet.html, areas: areas, lawnArea: lawnArea };
    st.result = { sheetHtml: sheet.html, pdfHtml: window.MVGreenPdfV2.pages(pctx), before: ctx.before, after: ctx.after, plants: plants, facts: ctx.facts };
  }

  function resultHtml() {
    var r = st.result;
    return '<h2>' + esc(r.facts.title || 'Váš návrh je hotový') + '</h2><p class="mvg2-sub">' + esc(r.facts.concept || '') + '</p>'
      + '<div class="mvg2-compare"><img src="' + r.before + '" alt="Před"><img src="' + r.after + '" alt="Po" data-after><i data-divider></i><span class="mvg2-tag mvg2-tag--l">PO</span><span class="mvg2-tag mvg2-tag--r">PŘED</span></div>'
      + '<label class="mvg2-sub">Posuňte a porovnejte před a po<input type="range" min="0" max="100" value="55" data-slide></label>'
      + '<div class="mvg2-nav"><span class="mvg2-sub">' + r.plants.reduce(function (s, p) { return s + p.count; }, 0) + ' rostlin, ' + r.plants.length + ' druhů</span><button type="button" class="mvg2-btn" data-print>Stáhnout projekt (PDF, 11 stran)</button></div>'
      + '<h3>Projekt v PDF – náhled</h3><div class="mvg2-pdf">' + r.pdfHtml + '</div>'
      + '<div class="mvg2-log" data-log>' + st.log.map(esc).join('<br>') + '</div>';
  }

  // Výkres má pevných 1700 × 1100 px – zmenší se, aby se vešel do strany (obrazovka i tisk).
  function fitSheets() {
    root.querySelectorAll('.mvg2-land__sheet').forEach(function (box) {
      var sh = box.querySelector('.mvg2-sheet'); if (!sh) return;
      var s = Math.min(box.clientWidth / 1700, box.clientHeight / 1100);
      sh.style.transform = 'scale(' + s + ')';
    });
  }

  /* ---------- ukázkový výkres (shortcode ukazka="1") ---------- */
  function renderDemo() {
    root.innerHTML = '<p>Ukázkový výkres byl nahrazen celým průvodcem – použijte [mvgreen_ai_architekt].</p>';
  }

  render();
})();
