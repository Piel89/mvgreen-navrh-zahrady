/*
 * MVGreen AI architekt v2 – náčrt zákazníka ťukáním (2026-11-08).
 * Martin: „potřebovali bychom jednoduchý, ale přesný nástroj, aby zákazník mohl načrtnout, kde chce
 * zeď, kde v té zdi schody, kde záhon, kde kačírek, kde strom – na mobilu“ a pak: „klient klikne na
 * obrazovku, udělá se bod, a napíše, že odsud sem chce opěrnou zeď; zase klikne a vybere, tady chci
 * schody, dalším kliknutím se zjistí, jak široké; klikne na fotku, kde to bude povolené, tady chci
 * zámkovku…“ (kreslení prstem bylo na mobilu nepřesné).
 *
 * Ovládání: vybrat prvek → ťukat body do fotky.
 *  - čára (zeď, chodník, cesta): odkud → kam (lomové body volitelně), Dokončit;
 *  - schody: jeden kraj → druhý kraj (= šířka), dokončí se samo;
 *  - plocha (záhon, dlažba, kačírek, trávník): rohy plochy, uzavřít ťuknutím na první bod / Dokončit;
 *  - bod (strom, keř): jedno ťuknutí.
 * Body jdou prstem přetáhnout. Ťuknout jde jen do upravované plochy z kroku 1 (chráněná místa jsou
 * ztmavená a ťuknutí na ně upozorní). Ke každému prvku jde napsat upřesnění.
 * Výstup stejný jako dřív: guide(photo, items) pro AI (2. obrázek), describe(items) text, preview.
 * Prvek: { tool, pts:[[x,y] 0–1], closed?, note? }
 */
(function () {
  'use strict';
  // „Ťuknout do plochy“ (Martin 2026-11-10, řešení 10): ťuknutí najde obrys plochy podle dílků fotky
  // a nabídne, co tam má být. Výsledek se uloží jako běžná plocha (záhon, dlažba…), sám se neukládá.
  var TOOLS = [
    { id: 'region', name: 'Ťuknout do plochy', type: 'region', color: '#FFFFFF' },
    { id: 'wall', name: 'Opěrná zeď', type: 'line', color: '#E53935' },
    { id: 'steps', name: 'Schody', type: 'steps', color: '#00A8B8' },
    { id: 'path', name: 'Chodník / cesta', type: 'line', color: '#FF8A00' },
    { id: 'paving', name: 'Zámková dlažba', type: 'area', color: '#2F7DE1' },
    { id: 'bed', name: 'Záhon', type: 'area', color: '#E0349A' },
    { id: 'gravel', name: 'Kačírek', type: 'area', color: '#F2C230' },
    { id: 'lawn', name: 'Trávník', type: 'area', color: '#35B84A' },
    { id: 'tree', name: 'Strom', type: 'point', color: '#0B6E2E', mark: 'S' },
    { id: 'shrub', name: 'Keř', type: 'point', color: '#8E44AD', mark: 'K' }
  ];
  var BY = {}; TOOLS.forEach(function (t) { BY[t.id] = t; });
  var COLOR_NAME = { wall: 'červená čára', steps: 'tyrkysový pruh se stupni', path: 'oranžová čára', paving: 'modrá plocha', bed: 'purpurová plocha', gravel: 'žlutá plocha', lawn: 'zelená plocha', tree: 'tmavě zelené kolečko „S“', shrub: 'fialové kolečko „K“' };

  /* ---------- kreslení (W×H = rozměr plátna, k = násobek tloušťky čar) ---------- */
  function draw(ctx, W, H, items, opts) {
    opts = opts || {};
    var k = opts.k || Math.max(1, W / 900), U = Math.max(W, H);
    var P = function (p) { return [p[0] * W, p[1] * H]; };
    var poly = function (pts, close) { ctx.beginPath(); pts.forEach(function (p, i) { var q = P(p); ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1]); }); if (close) ctx.closePath(); };
    items.forEach(function (it) {
      var t = BY[it.tool]; if (!t || !it.pts.length) return;
      ctx.lineCap = ctx.lineJoin = 'round';
      if (t.type === 'area') {
        poly(it.pts, it.closed);
        if (it.closed && it.pts.length >= 3) { ctx.globalAlpha = 0.5; ctx.fillStyle = t.color; ctx.fill(); ctx.globalAlpha = 1; }
        ctx.setLineDash(it.closed ? [] : [8 * k, 6 * k]); ctx.strokeStyle = t.color; ctx.lineWidth = 3.5 * k; ctx.stroke(); ctx.setLineDash([]);
      } else if (t.type === 'line' && it.pts.length > 1) {
        poly(it.pts); ctx.strokeStyle = '#fff'; ctx.lineWidth = 11 * k; ctx.stroke();
        poly(it.pts); ctx.strokeStyle = t.color; ctx.lineWidth = 7 * k; ctx.stroke();
      } else if (t.type === 'steps' && it.pts.length > 1) {
        var a = P(it.pts[0]), b = P(it.pts[1]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, d = Math.max(12 * k, L * 0.35);
        ctx.beginPath(); ctx.moveTo(a[0] - nx * d / 2, a[1] - ny * d / 2); ctx.lineTo(b[0] - nx * d / 2, b[1] - ny * d / 2); ctx.lineTo(b[0] + nx * d / 2, b[1] + ny * d / 2); ctx.lineTo(a[0] + nx * d / 2, a[1] + ny * d / 2); ctx.closePath();
        ctx.fillStyle = t.color; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * k; ctx.stroke();
        ctx.strokeStyle = '#063b40'; ctx.lineWidth = 2 * k;
        for (var s = 1; s < 3; s++) { var o = -d / 2 + d * s / 3; ctx.beginPath(); ctx.moveTo(a[0] + nx * o, a[1] + ny * o); ctx.lineTo(b[0] + nx * o, b[1] + ny * o); ctx.stroke(); }
      } else if (t.type === 'point') {
        var q = P(it.pts[0]), r = 15 * k;
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.fillStyle = t.color; ctx.fill(); ctx.lineWidth = 3 * k; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(r * 1.1) + 'px Montserrat, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.mark, q[0], q[1] + r * 0.05);
      }
      if (opts.handles) {
        it.pts.forEach(function (p, i) {
          var q = P(p); ctx.beginPath(); ctx.arc(q[0], q[1], (i === 0 && t.type === 'area' && !it.closed ? 9 : 6.5) * k, 0, 7);
          ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5 * k; ctx.strokeStyle = t.color; ctx.stroke();
        });
      }
    });
    void U;
  }

  function guide(photo, items) {
    var c = document.createElement('canvas'); c.width = photo.width; c.height = photo.height;
    var x = c.getContext('2d'); x.drawImage(photo, 0, 0);
    draw(x, c.width, c.height, items.filter(done), { k: Math.max(1, photo.width / 700) });
    return c;
  }
  function done(it) { var t = BY[it.tool]; return t && (t.type === 'point' ? it.pts.length === 1 : t.type === 'area' ? it.closed && it.pts.length >= 3 : it.pts.length >= 2); }

  /* ---------- popis pro AI ---------- */
  function pc(v) { return Math.round(Math.max(0, Math.min(1, v)) * 100); }
  function P2(p) { return '(' + pc(p[0]) + ' %, ' + pc(p[1]) + ' %)'; }
  function where(pts) {
    var x = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, y = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length;
    return (x < 0.34 ? 'vlevo' : x > 0.66 ? 'vpravo' : 'uprostřed') + (y > 0.66 ? ' v popředí' : y < 0.4 ? ' vzadu' : '');
  }
  // Co na fotce leží u bodu (z označování, mark.js landmarks: {name, kind, state, box:[x0,y0,x1,y1] 0–1}).
  var LM_SKIP = { sky: 1, lawn: 1, soil: 1, tap: 1 };
  function near(p, lms) {
    var best = null, bd = 1e9;
    (lms || []).forEach(function (l) {
      if (LM_SKIP[l.kind] || l.state === 'remove') return;
      var b = l.box, dx = Math.max(b[0] - 0.04 - p[0], 0, p[0] - b[2] - 0.04), dy = Math.max(b[1] - 0.04 - p[1], 0, p[1] - b[3] - 0.04);
      var d = Math.hypot(dx, dy) * 10 + (b[2] - b[0]) * (b[3] - b[1]);   // uvnitř/blízko + menší objekt má přednost
      if (Math.hypot(dx, dy) < 0.08 && d < bd) { bd = d; best = l; }
    });
    return best ? best.name : '';
  }
  // Čára kreslená tam a zpátky (2026-11-11: cesta k domku) – začátek a konec = dva nejvzdálenější body.
  function ends(pts) {
    var a = 0, b = pts.length - 1, m = -1;
    for (var i = 0; i < pts.length; i++) for (var j = i + 1; j < pts.length; j++) { var d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > m) { m = d; a = i; b = j; } }
    return [pts[a], pts[b]];
  }
  function describe(items, lms) {
    items = (items || []).filter(done);
    if (!items.length) return '';
    var used = TOOLS.filter(function (t) { return items.some(function (it) { return it.tool === t.id; }); });
    var out = ['Značky v náčrtu: ' + used.map(function (t) { return COLOR_NAME[t.id] + ' = ' + t.name.toLowerCase(); }).join(', ') + '.', 'Polohy jsou v % fotky (x zleva doprava, y shora dolů):'];
    var n = {};
    items.forEach(function (it) {
      var t = BY[it.tool]; n[t.id] = (n[t.id] || 0) + 1;
      var name = t.name + (items.filter(function (x) { return x.tool === t.id; }).length > 1 ? ' ' + n[t.id] : ''), s;
      if (t.type === 'area') { var cx = [it.pts.reduce(function (q, p) { return q + p[0]; }, 0) / it.pts.length, it.pts.reduce(function (q, p) { return q + p[1]; }, 0) / it.pts.length], na = near(cx, lms); s = name + ': plocha ' + where(it.pts) + (na ? ' (u: ' + na + ')' : '') + ' s rohy ' + it.pts.map(P2).join(', '); }
      else if (t.type === 'line') {
        var e = ends(it.pts), n0 = near(e[0], lms), n1 = near(e[1], lms);
        s = name + ': vede OD ' + P2(e[0]) + (n0 ? ' (u: ' + n0 + ')' : '') + ' DO ' + P2(e[1]) + (n1 ? ' (u: ' + n1 + ' – cesta musí vést až sem)' : '') + ', průběh ' + it.pts.map(P2).join(' → ');
      }
      else if (t.type === 'steps') s = name + ': ' + where(it.pts) + ', jeden kraj ' + P2(it.pts[0]) + ', druhý kraj ' + P2(it.pts[1]) + ' – šířka schodů = vzdálenost krajů, stupně vedou kolmo na tuto spojnici';
      else s = name + ': ' + P2(it.pts[0]);
      out.push('- ' + s + (it.note ? ' – upřesnění zákazníka: „' + it.note + '“' : '') + '.');
    });
    return out.join('\n');
  }

  /* ---------- obrazovka náčrtu ---------- */
  function open(photo, editMask, initial, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var items = (initial || []).filter(function (it) { return it && it.pts && !it.size && BY[it.tool] && BY[it.tool].type !== 'region'; }).map(function (it) { return { tool: it.tool, pts: it.pts.map(function (p) { return p.slice(); }), closed: it.closed, note: it.note || '' }; });
      var canRegion = !!(window.MVGreenMarkV2 && window.MVGreenPaintMask);
      var tool = canRegion ? 'region' : 'wall', draft = null, last = null, region = null;
      var W = photo.width, H = photo.height, sc = Math.min(1, 1600 / Math.max(W, H));
      var cw = Math.round(W * sc), ch = Math.round(H * sc);
      var el = document.createElement('div'); el.className = 'mvg2-sk';
      el.innerHTML = '<div class="mvg2-sk__top"><strong>Náčrt: kam co chcete</strong><span data-hint></span></div>'
        + '<div class="mvg2-sk__stage" data-stage><canvas data-c></canvas><div class="mvg2-sk__toast" data-toast></div></div>'
        + '<div class="mvg2-sk__tools" data-tools></div>'
        + '<div class="mvg2-sk__note" data-notebox></div>'
        + '<div class="mvg2-sk__bar" data-bar></div>'
        + '<button type="button" class="mvg2-sk__close" data-cancel aria-label="Zavřít">×</button>';
      document.body.appendChild(el); document.documentElement.classList.add('mvg2-sk-open');
      var cv = el.querySelector('[data-c]'), cx = cv.getContext('2d'); cv.width = cw; cv.height = ch;
      // podklad: fotka + ztmavená chráněná místa; mapa povolených míst pro ťuknutí
      var base = document.createElement('canvas'); base.width = cw; base.height = ch;
      var bx = base.getContext('2d'), allowed = null; bx.drawImage(photo, 0, 0, cw, ch);
      if (editMask) {
        var dim = document.createElement('canvas'); dim.width = cw; dim.height = ch; var dx = dim.getContext('2d');
        dx.fillStyle = 'rgba(10,20,15,0.55)'; dx.fillRect(0, 0, cw, ch); dx.globalCompositeOperation = 'destination-out'; dx.drawImage(editMask, 0, 0, cw, ch);
        bx.drawImage(dim, 0, 0);
        var am = document.createElement('canvas'); am.width = 300; am.height = Math.max(1, Math.round(300 * ch / cw));
        am.getContext('2d').drawImage(editMask, 0, 0, am.width, am.height);
        var ad = am.getContext('2d').getImageData(0, 0, am.width, am.height).data;
        allowed = function (p) { // s malou tolerancí: zeď nebo chodník smí vést těsně u domu
          var ax = Math.round(p[0] * (am.width - 1)), ay = Math.round(p[1] * (am.height - 1));
          for (var yy = -3; yy <= 3; yy++) for (var xx = -3; xx <= 3; xx++) { var X = ax + xx, Y = ay + yy; if (X >= 0 && Y >= 0 && X < am.width && Y < am.height && ad[(Y * am.width + X) * 4 + 3] > 100) return true; }
          return false;
        };
      }
      var scale = 1;
      function paint() {
        cx.clearRect(0, 0, cw, ch); cx.drawImage(base, 0, 0);
        draw(cx, cw, ch, items.concat(draft ? [draft] : []), { handles: true, k: 1 / scale });
        if (region && region.pts.length >= 3) {
          cx.beginPath(); region.pts.forEach(function (p, i) { cx[i ? 'lineTo' : 'moveTo'](p[0] * cw, p[1] * ch); }); cx.closePath();
          cx.fillStyle = 'rgba(255,255,255,0.3)'; cx.fill(); cx.setLineDash([8 / scale, 6 / scale]); cx.lineWidth = 3 / scale; cx.strokeStyle = '#fff'; cx.stroke(); cx.setLineDash([]);
        }
      }
      function fit() {
        var st = el.querySelector('[data-stage]'), r = st.getBoundingClientRect();
        scale = Math.min(r.width / cw, r.height / ch);
        cv.style.width = Math.floor(cw * scale) + 'px'; cv.style.height = Math.floor(ch * scale) + 'px'; paint();
      }
      function hint() {
        var t = BY[tool], n = draft ? draft.pts.length : 0;
        if (t.type === 'region') return region ? 'Vyberte, co má na označené ploše být.' : 'Ťukněte do plochy, kterou chcete změnit. Obrys se najde sám.';
        if (t.type === 'point') return 'Ťukněte do fotky, kam chcete ' + t.name.toLowerCase() + '.';
        if (t.type === 'steps') return n === 0 ? 'Ťukněte na JEDEN kraj schodů.' : 'Ťukněte na DRUHÝ kraj schodů – tím určíte jejich šířku.';
        if (t.type === 'line') return n === 0 ? 'Ťukněte, ODKUD má ' + (tool === 'wall' ? 'zeď' : 'cesta') + ' vést.' : n === 1 ? 'Ťukněte, KAM má vést.' : 'Můžete přidat další lomový bod, nebo stiskněte Dokončit.';
        return n === 0 ? 'Ťukejte postupně do ROHŮ plochy (' + t.name.toLowerCase() + ').' : n < 3 ? 'Další roh plochy…' : 'Další roh, nebo plochu uzavřete ťuknutím na první bod / Dokončit.';
      }
      function ok(it) { return done(it); }
      function finish() {
        if (!draft) return;
        if (BY[draft.tool].type === 'area' && draft.pts.length >= 3) draft.closed = true;
        if (ok(draft)) { items.push(draft); last = draft; }
        draft = null; ui();
      }
      function ui() {
        el.querySelector('[data-hint]').textContent = hint() + (window.innerHeight > window.innerWidth && W > H ? ' Tip: otočte telefon na šířku.' : '');
        el.querySelector('[data-tools]').innerHTML = TOOLS.filter(function (x) { return x.type !== 'region' || canRegion; }).map(function (x) { return '<button type="button" data-tool="' + x.id + '" class="' + (x.id === tool ? 'is-on' : '') + '"><i style="background:' + x.color + '" class="is-' + x.type + '"></i>' + x.name + '</button>'; }).join('');
        el.querySelectorAll('[data-tool]').forEach(function (b) { b.onclick = function () { if (draft) finish(); dropRegion(); tool = b.dataset.tool; ui(); }; });
        var nb = el.querySelector('[data-notebox]');
        nb.innerHTML = !draft && last ? '<label>Upřesnění k prvku „' + BY[last.tool].name + '“ (nepovinné)<input type="text" maxlength="80" placeholder="např. gabiony, výška 60 cm" value="' + String(last.note || '').replace(/"/g, '&quot;') + '"></label>' : '';
        var inp = nb.querySelector('input'); if (inp) inp.oninput = function () { last.note = inp.value.slice(0, 80); };
        var bar = el.querySelector('[data-bar]');
        if (draft) {
          var canDone = BY[draft.tool].type === 'area' ? draft.pts.length >= 3 : draft.pts.length >= 2;
          bar.innerHTML = '<button type="button" data-a="pop">↶ Zpět bod</button><button type="button" data-a="drop">Zrušit</button><button type="button" class="is-main" data-a="fin"' + (canDone ? '' : ' disabled') + '>Dokončit</button>';
        } else {
          bar.innerHTML = '<span class="mvg2-sk__count">' + items.length + ' ' + (items.length === 1 ? 'prvek' : items.length > 1 && items.length < 5 ? 'prvky' : 'prvků') + '</span><button type="button" data-a="undo"' + (items.length ? '' : ' disabled') + '>↶ Zpět prvek</button><button type="button" class="is-main" data-a="ok">Hotovo</button>';
        }
        // Pole pro upřesnění mění výšku spodní lišty → fotku znovu vejít (test 4: přetékala přes tlačítka).
        requestAnimationFrame(fit);
        bar.querySelectorAll('[data-a]').forEach(function (b) {
          b.onclick = function () {
            var a = b.dataset.a;
            if (a === 'pop') { draft.pts.pop(); if (!draft.pts.length) draft = null; }
            else if (a === 'drop') draft = null;
            else if (a === 'fin') finish();
            else if (a === 'undo') { items.pop(); last = null; }
            else if (a === 'ok') return close(true);
            ui();
          };
        });
      }
      var toastT;
      function toast(msg) { var t = el.querySelector('[data-toast]'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('is-on'); }, 2200); }
      var pt = function (e) { var r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
      // ťuknutí vs. přetažení existujícího bodu
      var drag = null, downAt = null;
      function hit(p) {
        var r = 22 / scale, all = (draft ? [draft] : []).concat(items.slice().reverse());
        for (var i = 0; i < all.length; i++) for (var j = 0; j < all[i].pts.length; j++) {
          var q = all[i].pts[j]; if (Math.hypot((q[0] - p[0]) * cw, (q[1] - p[1]) * ch) < r) return { it: all[i], j: j };
        }
        return null;
      }
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault(); cv.setPointerCapture(e.pointerId);
        var p = pt(e); downAt = { p: p, x: e.clientX, y: e.clientY }; drag = hit(p);
      });
      cv.addEventListener('pointermove', function (e) {
        if (!drag || !downAt) return; e.preventDefault();
        if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && !drag.moved) return;
        drag.moved = true; drag.it.pts[drag.j] = pt(e); paint();
      });
      cv.addEventListener('pointerup', function (e) {
        if (!downAt) return;
        var p = pt(e), moved = drag && drag.moved, h = drag; drag = null; downAt = null;
        if (moved) return;
        // ťuknutí na první bod rozpracované plochy ji uzavře
        if (draft && h && h.it === draft && h.j === 0 && BY[draft.tool].type === 'area' && draft.pts.length >= 3) { finish(); return; }
        if (allowed && !allowed(p)) { toast('Tady je místo, které má zůstat beze změny (krok 1). Ťukněte do upravované plochy.'); return; }
        var t = BY[tool];
        if (t.type === 'region') { regionTap(p, e); return; }
        if (t.type === 'point') { var it = { tool: tool, pts: [p], note: '' }; items.push(it); last = it; ui(); return; }
        if (!draft) draft = { tool: tool, pts: [], note: '' };
        draft.pts.push(p);
        if (t.type === 'steps' && draft.pts.length === 2) { finish(); return; }
        ui();
      });
      cv.addEventListener('pointercancel', function () { drag = null; downAt = null; });

      /* --- plocha ťuknutím: obrys z dílků fotky + nabídka typu plochy u prstu --- */
      var segP = null;
      function dropRegion() { region = null; var m = el.querySelector('.mvg2-sk__menu'); if (m) m.remove(); paint(); }
      function regionTap(p, e) {
        dropRegion();
        if (!segP) { toast('Chvilku, připravuji fotku…'); segP = window.MVGreenPaintMask.prepareSegmentation(photo, opts.cacheKey); }
        segP.then(function (seg) {
          var M = window.MVGreenMarkV2, stt = M.stats(seg);
          var x = Math.min(seg.W - 1, Math.floor(p[0] * seg.W)), y = Math.min(seg.H - 1, Math.floor(p[1] * seg.H)), seed = seg.labels[y * seg.W + x];
          var okSeg = function (n) { return !allowed || allowed(stt.cen[n]); };
          var build = function (loose) { var reg = M.grow(seg, seed, okSeg, loose); return { pts: M.polygon(seg, reg), loose: loose }; };
          region = build(false);
          if (region.pts.length < 3) { region = null; toast('Plochu se nepodařilo ohraničit. Zkuste ťuknout jinam nebo použijte rohy plochy.'); return; }
          paint(); menu(e, build); ui();
        }).catch(function () { toast('Fotku se nepodařilo připravit. Použijte rohy plochy (Záhon, Dlažba…).'); });
      }
      function menu(e, build) {
        var st = el.querySelector('[data-stage]'), r = st.getBoundingClientRect(), m = document.createElement('div');
        m.className = 'mvg2-sk__menu';
        m.style.cssText = 'position:absolute;z-index:5;background:#fff;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.35);padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;width:236px;max-width:calc(100% - 16px)';
        m.innerHTML = TOOLS.filter(function (x) { return x.type === 'area'; }).map(function (x) { return '<button type="button" data-pick="' + x.id + '" style="border:0;border-radius:9px;padding:10px 6px;font:700 14px system-ui,sans-serif;color:#fff;background:' + x.color + '">' + x.name + '</button>'; }).join('')
          + '<button type="button" data-grow style="border:1px solid #ccd;border-radius:9px;padding:9px 6px;font:600 13px system-ui,sans-serif;background:#fff;color:#1c2a20">' + (region.loose ? 'Menší plocha' : 'Větší plocha') + '</button>'
          + '<button type="button" data-no style="border:1px solid #ccd;border-radius:9px;padding:9px 6px;font:600 13px system-ui,sans-serif;background:#fff;color:#1c2a20">Zrušit</button>';
        st.appendChild(m);
        var mx = e.clientX - r.left, my = e.clientY - r.top, mw = m.offsetWidth, mh = m.offsetHeight;
        var left = Math.max(8, Math.min(r.width - mw - 8, mx - mw / 2)), top = my + 24 + mh < r.height ? my + 24 : Math.max(8, my - mh - 24);
        m.style.left = left + 'px'; m.style.top = top + 'px';
        m.querySelectorAll('[data-pick]').forEach(function (b) {
          b.onclick = function () { var it = { tool: b.dataset.pick, pts: region.pts, closed: true, note: '' }; items.push(it); last = it; dropRegion(); ui(); };
        });
        m.querySelector('[data-grow]').onclick = function () { var nr = build(!region.loose); m.remove(); if (nr.pts.length >= 3) region = nr; paint(); menu(e, build); };
        m.querySelector('[data-no]').onclick = function () { dropRegion(); ui(); };
      }
      var close = function (save) {
        window.removeEventListener('resize', fit); el.remove(); document.documentElement.classList.remove('mvg2-sk-open');
        if (!save) return resolve(null);
        var pv = document.createElement('canvas'), s2 = Math.min(1, 900 / Math.max(W, H)); pv.width = Math.round(W * s2); pv.height = Math.round(H * s2);
        var px = pv.getContext('2d'); px.drawImage(photo, 0, 0, pv.width, pv.height); draw(px, pv.width, pv.height, items, { k: pv.width / 900 });
        resolve({ strokes: items, preview: pv.toDataURL('image/jpeg', 0.85) });
      };
      el.querySelector('[data-cancel]').onclick = function () { close(false); };
      window.addEventListener('resize', fit);
      ui(); requestAnimationFrame(fit);
    });
  }

  window.MVGreenSketch = { open: open, guide: guide, describe: describe, done: done, tools: TOOLS };
})();
