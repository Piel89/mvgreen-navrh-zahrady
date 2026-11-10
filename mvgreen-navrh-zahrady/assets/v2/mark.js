/*
 * MVGreen AI architekt v2 – označení „co zůstane / co pryč“ bez štětce (2026-11-10).
 * Martin (mobil): „je strašně těžký trefit přesně prstem rozhraní třeba u plotu… prst je moc silnej“,
 * „když si dám full screen, tak přes všechny texty a nástroje nevidím, kde chci označovat“.
 * Vybral řešení 3 (AI předznačí, zákazník jen potvrdí) a 8 (čistá celá obrazovka).
 *
 *  - Server (mvgreen_ai_detect_v2, Google Gemini) vrátí objekty s maskou (PNG v boxu nebo obrys).
 *  - Obrysy se přichytí k dílkům fotky (SLIC z mg-paint-mask.js): dílek patří objektu, který ho
 *    pokrývá z větší části → hrany sedí na skutečné okraje plotu, auta, dlažby.
 *  - Ťuknutí na objekt přepne Zůstane → Pryč → Navrhnout znovu. Ťuknutí mimo objekty vybere plochu
 *    podobné barvy. Podržení prstu oddělí jen tuhle část objektu (když AI spojila dvě věci).
 *  - Na fotce jsou jen malá plovoucí tlačítka, při dotyku se schovají; seznam objektů je ve spodním
 *    panelu. Dva prsty přibližují a posouvají.
 * Výstup je stejný jako MVGreenPaintMask.confirmPaintMask (editMask, removeMask, category,
 * hasRemove, previewDataUrl) + state pro znovuotevření; „Doladit štětcem“ otevře původní štětec
 * se stejným rozdělením.
 */
(function () {
  'use strict';
  var PROTECT = 1, REMOVE = 2;
  var STATE_CAT = { keep: PROTECT, remove: REMOVE, change: 0 };
  var STATE_NAME = { keep: 'Zůstane', remove: 'Pryč', change: 'Navrhnout znovu' };
  var NEXT = { keep: 'remove', remove: 'change', change: 'keep' };
  var FORCE = { house: 'keep', neighbor: 'keep', sky: 'keep', fence: 'keep', gate: 'keep', car: 'remove', container: 'remove', rubble: 'remove' };
  var DEFAULT = { tree: 'keep', shrub: 'keep', hedge: 'keep', wall: 'keep', shed: 'keep', paving: 'keep', path: 'keep', terrace: 'keep', steps: 'keep', lawn: 'change', bed: 'change', soil: 'change', gravel: 'change' };

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------- statistiky dílků (barva, sousedé) – sdílí i náčrt (plochy ťuknutím) ---------- */
  function stats(seg) {
    if (seg._mvmStats) return seg._mvmStats;
    var W = seg.W, H = seg.H, L = seg.labels, N = seg.numSegments, d = seg.preview.data;
    var cnt = new Float64Array(N + 1), r = new Float64Array(N + 1), g = new Float64Array(N + 1), b = new Float64Array(N + 1);
    var sx = new Float64Array(N + 1), sy = new Float64Array(N + 1);
    var nb = []; for (var k = 0; k <= N; k++) nb.push({});
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x, s = L[i], p = i * 4;
      cnt[s]++; r[s] += d[p]; g[s] += d[p + 1]; b[s] += d[p + 2]; sx[s] += x; sy[s] += y;
      if (x + 1 < W && L[i + 1] !== s) { nb[s][L[i + 1]] = 1; nb[L[i + 1]][s] = 1; }
      if (y + 1 < H && L[i + W] !== s) { nb[s][L[i + W]] = 1; nb[L[i + W]][s] = 1; }
    }
    var mean = []; for (var s2 = 0; s2 <= N; s2++) { var c = cnt[s2] || 1; mean.push([r[s2] / c, g[s2] / c, b[s2] / c]); }
    var cen = []; for (var s3 = 0; s3 <= N; s3++) { var c3 = cnt[s3] || 1; cen.push([sx[s3] / c3 / W, sy[s3] / c3 / H]); }
    seg._mvmStats = { cnt: cnt, mean: mean, cen: cen, nb: nb.map(function (o) { return Object.keys(o).map(Number); }) };
    return seg._mvmStats;
  }
  function cdist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2])); }
  // Plocha podobné barvy kolem dílku seed; ok(s) omezuje, kam smí růst (stejný objekt, upravovaná plocha…).
  function grow(seg, seed, ok, loose) {
    var st = stats(seg), m0 = st.mean[seed], T = loose ? 46 : 34, T2 = loose ? 28 : 20;
    var seen = {}, out = [seed], q = [seed]; seen[seed] = 1;
    while (q.length && out.length < 700) {
      var s = q.shift();
      st.nb[s].forEach(function (n) {
        if (seen[n]) return; seen[n] = 1;
        if (ok && !ok(n)) return;
        if (cdist(st.mean[n], m0) < T && cdist(st.mean[n], st.mean[s]) < T2) { out.push(n); q.push(n); }
      });
    }
    return out;
  }
  // Obrys množiny dílků jako mnohoúhelník v souřadnicích 0–1 (největší souvislá část, zjednodušený).
  function polygon(seg, set) {
    var W = seg.W, H = seg.H, L = seg.labels, f = Math.max(1, Math.ceil(Math.max(W, H) / 260));
    var w = Math.ceil(W / f), h = Math.ceil(H / f), in_ = {}, gm = new Uint8Array((w + 2) * (h + 2));
    set.forEach(function (s) { in_[s] = 1; });
    var votes = new Uint16Array(w * h), tot = new Uint16Array(w * h);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var c = ((y / f) | 0) * w + ((x / f) | 0); tot[c]++; if (in_[L[y * W + x]]) votes[c]++; }
    for (var i = 0; i < w * h; i++) if (votes[i] * 2 >= tot[i] && tot[i]) gm[(((i / w) | 0) + 1) * (w + 2) + (i % w) + 1] = 1;
    var GW = w + 2, start = -1;
    for (var j = 0; j < gm.length; j++) if (gm[j]) { start = j; break; }
    if (start < 0) return [];
    // Moore-neighbour tracing po okraji
    var dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    var pts = [], cx = start % GW, cy = (start / GW) | 0, sx = cx, sy = cy, bd = 6, guard = 0;
    do {
      pts.push([cx, cy]);
      var found = false;
      for (var k = 0; k < 8; k++) {
        var dd = (bd + k) % 8, nx = cx + dirs[dd][0], ny = cy + dirs[dd][1];
        if (gm[ny * GW + nx]) { cx = nx; cy = ny; bd = (dd + 6) % 8; found = true; break; }
      }
      if (!found) break;
    } while ((cx !== sx || cy !== sy) && ++guard < 20000);
    // do popisu pro AI jde každý roh → nejvýš 16 bodů (test: trávník kolem dlažby měl 70)
    if (pts.length > 2 && pts[pts.length - 1][0] === pts[0][0] && pts[pts.length - 1][1] === pts[0][1]) pts.pop();
    // uzavřený obrys: rozdělit v bodě nejdál od začátku a zjednodušit obě půlky zvlášť
    var far = 0, fd = -1; pts.forEach(function (p, i) { var d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > fd) { fd = d; far = i; } });
    var closedDp = function (e) { var A = dp(pts.slice(0, far + 1), e), B = dp(pts.slice(far).concat([pts[0]]), e); return A.concat(B.slice(1, -1)); };
    var eps = 1.6, simp = closedDp(eps);
    while (simp.length > 16 && eps < 60) { eps *= 1.4; simp = closedDp(eps); }
    return simp.map(function (p) { return [Math.max(0, Math.min(1, (p[0] - 0.5) / w)), Math.max(0, Math.min(1, (p[1] - 0.5) / h))]; });
  }
  function dp(pts, eps) {
    if (pts.length < 4) return pts;
    var keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    (function rec(a, b) {
      var mx = 0, mi = -1, A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
      for (var i = a + 1; i < b; i++) { var dd = Math.abs(dy * pts[i][0] - dx * pts[i][1] + B[0] * A[1] - B[1] * A[0]) / L; if (dd > mx) { mx = dd; mi = i; } }
      if (mx > eps) { keep[mi] = 1; rec(a, mi); rec(mi, b); }
    })(0, pts.length - 1);
    return pts.filter(function (p, i) { return keep[i]; });
  }

  /* ---------- přiřazení dílků k objektům AI ---------- */
  // Objekt = { box:[y0,x0,y1,x1] 0–1000, img (maska PNG uvnitř boxu) | mask (obrys [x,y] 0–1000) | nic (jen box) }
  // Dílek dostane nejmenší objekt, který pokrývá aspoň polovinu dílku a „barevně sedí“.
  // 1. test s Gemini (2026-11-10, Martinova fotka): bez masek patřil klín trávy před domem domu a pole
  // za autem autu → zelená (rostlinná) ploška nesmí patřit stavbě, autu, dlažbě ani obloze.
  var NONVEG = { house: 1, neighbor: 1, car: 1, shed: 1, wall: 1, gate: 1, paving: 1, path: 1, terrace: 1, steps: 1, gravel: 1, rubble: 1, container: 1, sky: 1 };
  function isVeg(c) { var r = c[0], g = c[1], b = c[2]; return g > r * 1.04 && g > b * 1.12 && g - Math.min(r, b) > 14; }
  function assign(seg, objects) {
    var W = seg.W, H = seg.H, L = seg.labels, N = seg.numSegments, st = stats(seg);
    var owner = new Int16Array(N + 1).fill(-1);
    if (!objects.length) return owner;
    var barea = function (o) { var b = o.box || [0, 0, 0, 0]; return (b[2] - b[0]) * (b[3] - b[1]); };
    var c = mk(W, H), x = c.getContext('2d', { willReadFrequently: true });
    var cov = objects.map(function (o) {
      var cnt = new Uint32Array(N + 1), b = o.box; if (!b) return cnt;
      var bx = b[1] / 1000 * W, by = b[0] / 1000 * H, bw = Math.max(1, (b[3] - b[1]) / 1000 * W), bh = Math.max(1, (b[2] - b[0]) / 1000 * H);
      x.clearRect(0, 0, W, H);
      if (o.img) x.drawImage(o.img, bx, by, bw, bh);
      else {
        x.fillStyle = '#fff'; x.beginPath();
        if (o.mask && o.mask.length >= 3) o.mask.forEach(function (p, k) { x[k ? 'lineTo' : 'moveTo'](p[0] / 1000 * W, p[1] / 1000 * H); });
        else x.rect(bx, by, bw, bh);
        x.closePath(); x.fill();
      }
      var X0 = Math.max(0, Math.floor(bx) - 1), Y0 = Math.max(0, Math.floor(by) - 1), X1 = Math.min(W, Math.ceil(bx + bw) + 1), Y1 = Math.min(H, Math.ceil(by + bh) + 1);
      if (o.mask && !o.img) { X0 = 0; Y0 = 0; X1 = W; Y1 = H; }
      if (X1 <= X0 || Y1 <= Y0) return cnt;
      var d = x.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data, ww = X1 - X0;
      for (var yy = Y0; yy < Y1; yy++) for (var xx = X0; xx < X1; xx++) {
        var p = ((yy - Y0) * ww + (xx - X0)) * 4;
        if (d[p] * d[p + 3] / 255 > 127) cnt[L[yy * W + xx]]++;   // maska = pravděpodobnost 0–255
      }
      return cnt;
    });
    // menší objekty mají přednost (auto před dlažbou, sokl před domem, plot před trávou)
    var order = objects.map(function (o, i) { return i; }).sort(function (a, b) { return barea(objects[a]) - barea(objects[b]); });
    for (var s = 1; s <= N; s++) {
      var tot = st.cnt[s] || 1, veg = isVeg(st.mean[s]);
      for (var k = 0; k < order.length; k++) {
        var oi = order[k];
        if (cov[oi][s] * 2 < tot) continue;
        if (veg && NONVEG[objects[oi].kind]) continue;
        owner[s] = oi; break;
      }
    }
    return owner;
  }
  function loadMasks(list) {
    return Promise.all(list.map(function (o) {
      if (typeof o.mask !== 'string') return Promise.resolve(o);
      return new Promise(function (ok) { var im = new Image(); im.onload = function () { o.img = im; ok(o); }; im.onerror = function () { ok(o); }; im.src = o.mask; });
    }));
  }

  /* ---------- masky pro generování (stejně jako mg-paint-mask.js) ---------- */
  function catMask(seg, category, pw, ph, match) {
    var W = seg.W, H = seg.H, L = seg.labels, c = mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    for (var i = 0; i < W * H; i++) if (match(category[L[i]])) d[i * 4 + 3] = 255;
    x.putImageData(img, 0, 0);
    var out = mk(pw, ph), o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.drawImage(c, 0, 0, pw, ph);
    o.globalCompositeOperation = 'source-in'; o.fillStyle = '#1b9c55'; o.fillRect(0, 0, pw, ph);
    return out;
  }
  function previewUrl(seg, category, photo, pw, ph) {
    var W = seg.W, H = seg.H, L = seg.labels, t = mk(W, H), x = t.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    for (var i = 0, p = 0; i < W * H; i++, p += 4) { var c = category[L[i]]; if (c === PROTECT) { d[p] = 47; d[p + 1] = 174; d[p + 2] = 74; d[p + 3] = 255; } else if (c === REMOVE) { d[p] = 217; d[p + 1] = 69; d[p + 2] = 63; d[p + 3] = 255; } }
    x.putImageData(img, 0, 0);
    var out = mk(pw, ph), o = out.getContext('2d'); o.drawImage(photo, 0, 0, pw, ph); o.globalAlpha = 0.38; o.drawImage(t, 0, 0, pw, ph);
    try { return out.toDataURL('image/jpeg', 0.86); } catch (e) { return ''; }
  }

  var CSS = '.mvm{position:fixed;inset:0;z-index:2147483646;background:#0d120e;color:#fff;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-user-select:none;user-select:none}'
    + '.mvm-stage{position:absolute;inset:0;overflow:hidden;touch-action:none}'
    + '.mvm-stage canvas{position:absolute;left:0;top:0;transform-origin:0 0;image-rendering:auto}'
    + '.mvm-ctl{position:absolute;z-index:3;transition:opacity .18s ease;border:0;font:inherit;cursor:pointer;color:#fff;background:rgba(14,22,16,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 2px 10px rgba(0,0,0,.35)}'
    + '.mvm.is-touch .mvm-ctl{opacity:0;pointer-events:none}'
    + '.mvm-close{top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));width:40px;height:40px;border-radius:50%;font-size:24px;line-height:40px;padding:0}'
    + '.mvm-done{top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px));height:40px;border-radius:20px;padding:0 18px;font-weight:700;background:#2F8F4E}'
    + '.mvm-list{bottom:calc(14px + env(safe-area-inset-bottom,0px));right:calc(14px + env(safe-area-inset-right,0px));width:56px;height:56px;border-radius:50%;padding:0;display:grid;place-items:center}'
    + '.mvm-list svg{width:24px;height:24px}'
    + '.mvm-undo{bottom:calc(18px + env(safe-area-inset-bottom,0px));left:calc(14px + env(safe-area-inset-left,0px));width:46px;height:46px;border-radius:50%;padding:0;font-size:20px}'
    + '.mvm-undo:disabled{opacity:.35}'
    + '.mvm-zoom{bottom:calc(22px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);height:38px;border-radius:19px;padding:0 14px;font-weight:600}'
    + '.mvm-toast{position:absolute;z-index:4;top:calc(60px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);max-width:min(92vw,520px);background:rgba(14,22,16,.88);padding:9px 14px;border-radius:10px;font-size:14px;text-align:center;opacity:0;transition:opacity .2s;pointer-events:none}'
    + '.mvm-toast.is-on{opacity:1}'
    + '.mvm-load{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:rgba(13,18,14,.7);text-align:center;padding:24px}'
    + '.mvm-load b{display:block;font-size:17px;margin-bottom:6px}'
    + '.mvm-spin{width:34px;height:34px;margin:0 auto 14px;border-radius:50%;border:4px solid rgba(255,255,255,.25);border-top-color:#7DCB8F;animation:mvmspin 1s linear infinite}'
    + '@keyframes mvmspin{to{transform:rotate(360deg)}}'
    + '.mvm-sheet{position:absolute;z-index:6;left:0;right:0;bottom:0;max-height:58%;display:flex;flex-direction:column;background:#F6F8F4;color:#1C2A20;border-radius:16px 16px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.35);padding:12px max(14px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(14px,env(safe-area-inset-left,0px));transform:translateY(105%);transition:transform .22s ease}'
    + '.mvm-sheet.is-on{transform:none}'
    + '.mvm-sheet header{display:flex;align-items:center;gap:10px;margin-bottom:8px}'
    + '.mvm-sheet header b{flex:1;font-size:16px}'
    + '.mvm-sheet header button,.mvm-foot button{border:1px solid #CBD6CC;background:#fff;color:#1C2A20;border-radius:18px;padding:7px 13px;font:600 14px system-ui,sans-serif;cursor:pointer}'
    + '.mvm-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:#56685A;margin-bottom:6px}'
    + '.mvm-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}'
    + '.mvm-rows{overflow:auto;-webkit-overflow-scrolling:touch;display:grid;gap:6px;padding-bottom:4px}'
    + '.mvm-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #E1E8E1}'
    + '.mvm-row span{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.mvm-seg{display:flex;border:1px solid #CBD6CC;border-radius:9px;overflow:hidden}'
    + '.mvm-seg button{border:0;background:#fff;color:#56685A;padding:8px 9px;font:600 13px system-ui,sans-serif;cursor:pointer}'
    + '.mvm-seg button+button{border-left:1px solid #CBD6CC}'
    + '.mvm-seg button.on-keep{background:#2F8F4E;color:#fff}.mvm-seg button.on-remove{background:#D2452F;color:#fff}.mvm-seg button.on-change{background:#E9B949;color:#2A2108}'
    + '.mvm-foot{display:flex;gap:8px;justify-content:space-between;margin-top:8px;flex-wrap:wrap}'
    + '.mvm button:focus-visible{outline:3px solid #7DCB8F;outline-offset:2px}';

  function open(photo, opts) {
    opts = opts || {};
    var Pm = window.MVGreenPaintMask, S = window.MVGreenAISafety;
    return new Promise(function (resolve) {
      if (!document.getElementById('mvm-css')) { var sty = document.createElement('style'); sty.id = 'mvm-css'; sty.textContent = CSS; document.head.appendChild(sty); }
      var pw = photo.width || photo.naturalWidth, ph = photo.height || photo.naturalHeight;
      var el = document.createElement('div'); el.className = 'mvm';
      el.innerHTML = '<div class="mvm-stage" data-stage><canvas data-c></canvas></div>'
        + '<button type="button" class="mvm-ctl mvm-close" data-x aria-label="Zavřít bez uložení">×</button>'
        + '<button type="button" class="mvm-ctl mvm-done" data-ok>Hotovo</button>'
        + '<button type="button" class="mvm-ctl mvm-undo" data-undo aria-label="Zpět" disabled>↶</button>'
        + '<button type="button" class="mvm-ctl mvm-zoom" data-zoom hidden>Oddálit</button>'
        + '<button type="button" class="mvm-ctl mvm-list" data-list aria-label="Seznam objektů"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/></svg></button>'
        + '<div class="mvm-toast" data-toast></div>'
        + '<div class="mvm-load" data-load><div><div class="mvm-spin"></div><b>Hledám na fotce dům, plot, auta…</b><span>Trvá to asi minutu (poprvé déle).</span></div></div>'
        + '<div class="mvm-sheet" data-sheet><header><b>Co je na fotce</b><button type="button" data-sheetclose>Zpět na fotku</button></header>'
        + '<div class="mvm-legend"><span><i style="background:#2F8F4E"></i>Zůstane beze změny</span><span><i style="background:#D2452F"></i>Pryč</span><span><i style="background:#E9B949"></i>Navrhnout znovu (AI smí změnit)</span></div>'
        + '<div class="mvm-rows" data-rows></div>'
        + '<div class="mvm-foot"><button type="button" data-brush>Doladit štětcem</button><button type="button" data-ok2 style="background:#2F8F4E;color:#fff;border-color:#2F8F4E">Hotovo</button></div></div>';
      document.body.appendChild(el);
      try { if (el.requestFullscreen) el.requestFullscreen().catch(function () {}); } catch (e) { /* telefon bez celé obrazovky */ }
      var $ = function (s) { return el.querySelector(s); };
      var stage = $('[data-stage]'), cv = $('[data-c]'), cx = cv.getContext('2d');
      var toastT, fitFn = null, onResize = function () { if (fitFn) fitFn(); };
      function toast(msg, ms) { var t = $('[data-toast]'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('is-on'); }, ms || 2400); }
      function close(v) {
        window.removeEventListener('resize', onResize);
        try { if (document.fullscreenElement === el) document.exitFullscreen(); } catch (e) { /* nic */ }
        el.remove(); resolve(v);
      }
      $('[data-x]').onclick = function () { close(null); };

      var segP = Pm.prepareSegmentation(photo, opts.cacheKey);
      var detP = opts.initial ? Promise.resolve(null) : (opts.detect ? opts.detect().then(loadMasks).catch(function (e) { return { error: e }; }) : Promise.resolve([]));
      Promise.all([segP, detP]).then(function (res) {
        var seg = res[0], det = res[1], W = seg.W, H = seg.H, L = seg.labels, N = seg.numSegments;
        var objects, owner;
        if (opts.initial && opts.initial.owner && opts.initial.owner.length === N + 1) {
          objects = opts.initial.objects.map(function (o) { return Object.assign({}, o); }); owner = new Int16Array(opts.initial.owner);
        } else {
          var list = det && !det.error ? det : [];
          objects = list.map(function (o) { return { name: o.name || 'Objekt', kind: o.kind, state: FORCE[o.kind] || DEFAULT[o.kind] || 'change', box: o.box, mask: o.mask, img: o.img }; });
          owner = assign(seg, objects);
          // obloha z analýzy fotky, pokud ji AI nevrátila
          // obloha z analýzy fotky vždy – 1. test: AI vrátila oblohu jen vpravo od domu, levý roh zůstal volný
          if ((seg.skyIds || []).length) {
            var si = -1; objects.forEach(function (o, i) { if (o.kind === 'sky' && si < 0) si = i; });
            if (si < 0) { objects.push({ name: 'Obloha', kind: 'sky', state: 'keep' }); si = objects.length - 1; }
            seg.skyIds.forEach(function (s) { if (owner[s] < 0 || objects[owner[s]].kind === 'lawn' || objects[owner[s]].kind === 'soil') owner[s] = si; });
          }
          objects.forEach(function (o) { delete o.box; delete o.mask; delete o.img; });
          if (det && det.error) toast('AI teď objekty nenašla (' + det.error.message + '). Ťukněte na to, co má zůstat nebo zmizet.', 5000);
        }
        var history = [], hiObj = -1;
        cv.width = W; cv.height = H;
        var base = seg.preview, out = cx.createImageData(W, H);

        function category() { var c = new Uint8Array(N + 1); for (var s = 1; s <= N; s++) c[s] = owner[s] >= 0 ? STATE_CAT[objects[owner[s]].state] : 0; return c; }
        function repaint() {
          var cat = category(), d = out.data, b = base.data;
          for (var i = 0, p = 0; i < W * H; i++, p += 4) {
            var s = L[i], o = owner[s], c = cat[s], R = b[p], G = b[p + 1], B = b[p + 2];
            if (c === PROTECT) { R = R * 0.55 + 47 * 0.45; G = G * 0.55 + 174 * 0.45; B = B * 0.55 + 74 * 0.45; }
            else if (c === REMOVE) { R = R * 0.45 + 217 * 0.55; G = G * 0.45 + 69 * 0.55; B = B * 0.45 + 63 * 0.55; }
            var x = i % W, edge = (x + 1 < W && owner[L[i + 1]] !== o) || (i + W < W * H && owner[L[i + W]] !== o);
            if (edge && (o >= 0 || (x + 1 < W && owner[L[i + 1]] >= 0) || (i + W < W * H && owner[L[i + W]] >= 0))) { R = G = B = 255; }
            if (hiObj >= 0 && o === hiObj && ((i / W | 0) + x) % 6 < 3) { R = R * 0.5 + 127; G = G * 0.5 + 127; B = B * 0.5 + 127; }
            d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
          }
          cx.putImageData(out, 0, 0);
          $('[data-undo]').disabled = !history.length;
        }
        function snap() { history.push({ owner: owner.slice(), states: objects.map(function (o) { return o.state; }), n: objects.length }); if (history.length > 30) history.shift(); }
        $('[data-undo]').onclick = function () { var h = history.pop(); if (!h) return; owner = h.owner; objects.length = h.n; h.states.forEach(function (s, i) { objects[i].state = s; }); repaint(); rows(); toast('Vráceno zpět'); };

        /* --- zobrazení: přizpůsobit obrazovce, přiblížení dvěma prsty --- */
        var z = 1, tx = 0, ty = 0, fitS = 1, ox = 0, oy = 0;
        function apply() {
          cv.style.width = W * fitS + 'px'; cv.style.height = H * fitS + 'px';
          cv.style.transform = 'translate(' + (ox + tx) + 'px,' + (oy + ty) + 'px) scale(' + z + ')';
          $('[data-zoom]').hidden = z <= 1.01;
        }
        function clampT() {
          var sw = stage.clientWidth, sh = stage.clientHeight, cw = W * fitS * z, ch = H * fitS * z;
          tx = cw <= sw ? 0 : Math.min(-ox, Math.max(sw - cw - ox, tx)); ty = ch <= sh ? 0 : Math.min(-oy, Math.max(sh - ch - oy, ty));
          if (cw <= sw) tx = (sw - cw) / 2 - ox; if (ch <= sh) ty = (sh - ch) / 2 - oy;
        }
        function fit() {
          var sw = stage.clientWidth, sh = stage.clientHeight; fitS = Math.min(sw / W, sh / H);
          ox = (sw - W * fitS) / 2; oy = (sh - H * fitS) / 2; z = 1; tx = ty = 0; apply();
        }
        $('[data-zoom]').onclick = function () { z = 1; tx = ty = 0; apply(); };
        fitFn = fit; window.addEventListener('resize', onResize);

        function segAt(e) {
          var r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * W), y = Math.floor((e.clientY - r.top) / r.height * H);
          if (x < 0 || y < 0 || x >= W || y >= H) return 0; return L[y * W + x];
        }
        function tap(e) {
          var s = segAt(e); if (!s) return;
          snap();
          var o = owner[s];
          if (o < 0) {
            var reg = grow(seg, s, function (n) { return owner[n] < 0; });
            objects.push({ name: 'Vybraná plocha ' + (objects.filter(function (x) { return x.kind === 'tap'; }).length + 1), kind: 'tap', state: 'keep' });
            reg.forEach(function (n) { owner[n] = objects.length - 1; });
            toast('Vybraná plocha: ' + STATE_NAME.keep + '. Dalším ťuknutím přepnete.');
          } else {
            objects[o].state = NEXT[objects[o].state];
            toast(objects[o].name + ': ' + STATE_NAME[objects[o].state]);
          }
          repaint(); rows();
        }
        function hold(e) {
          var s = segAt(e); if (!s) return; var o = owner[s]; if (o < 0) return tap(e);
          snap();
          var reg = grow(seg, s, function (n) { return owner[n] === o; }, true);
          var nst = NEXT[objects[o].state];
          objects.push({ name: objects[o].name + ' – část', kind: 'tap', state: nst });
          reg.forEach(function (n) { owner[n] = objects.length - 1; });
          if (navigator.vibrate) try { navigator.vibrate(25); } catch (er) { /* nic */ }
          toast('Oddělena část „' + objects[o].name + '“: ' + STATE_NAME[nst]);
          repaint(); rows();
        }

        var ptrs = new Map(), g0 = null, tapC = null, holdT = null;
        stage.addEventListener('pointerdown', function (e) {
          if (e.target !== cv && e.target !== stage) return;
          e.preventDefault(); stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
          el.classList.add('is-touch');
          if (ptrs.size === 1) {
            tapC = { x: e.clientX, y: e.clientY, ev: { clientX: e.clientX, clientY: e.clientY }, moved: false, held: false, tx: tx, ty: ty };
            clearTimeout(holdT); holdT = setTimeout(function () { if (tapC && !tapC.moved) { tapC.held = true; hold(tapC.ev); } }, 550);
          } else if (ptrs.size === 2) {
            clearTimeout(holdT); tapC = null;
            var a = Array.from(ptrs.values());
            g0 = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2, z: z, tx: tx, ty: ty, r: stage.getBoundingClientRect() };
          }
        });
        stage.addEventListener('pointermove', function (e) {
          if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (ptrs.size >= 2 && g0) {
            var a = Array.from(ptrs.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
            var nz = Math.max(1, Math.min(6, g0.z * d / g0.d));
            // bod pod středem prstů zůstane pod prsty
            var px = (g0.mx - g0.r.left - ox - g0.tx) / g0.z, py = (g0.my - g0.r.top - oy - g0.ty) / g0.z;
            z = nz; tx = mx - g0.r.left - ox - px * z; ty = my - g0.r.top - oy - py * z; clampT(); apply();
          } else if (tapC) {
            var dx = e.clientX - tapC.x, dy = e.clientY - tapC.y;
            if (Math.hypot(dx, dy) > 10) { tapC.moved = true; clearTimeout(holdT); }
            if (tapC.moved && z > 1.01) { tx = tapC.tx + dx; ty = tapC.ty + dy; clampT(); apply(); }
          }
        });
        function up(e) {
          if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); clearTimeout(holdT);
          if (e.type === 'pointerup' && tapC && !tapC.moved && !tapC.held && ptrs.size === 0) tap(tapC.ev);
          if (ptrs.size < 2) g0 = null;
          if (ptrs.size === 0) { tapC = null; setTimeout(function () { if (!ptrs.size) el.classList.remove('is-touch'); }, 250); }
        }
        stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);

        /* --- seznam objektů --- */
        function rows() {
          var cnt = {}; for (var s = 1; s <= N; s++) if (owner[s] >= 0) cnt[owner[s]] = (cnt[owner[s]] || 0) + 1;
          var box = $('[data-rows]'); box.textContent = '';
          objects.forEach(function (o, i) {
            if (!cnt[i]) return;
            var row = document.createElement('div'); row.className = 'mvm-row';
            var nm = document.createElement('span'); nm.textContent = o.name; nm.onclick = function () { hiObj = hiObj === i ? -1 : i; repaint(); };
            var sg = document.createElement('div'); sg.className = 'mvm-seg';
            ['keep', 'remove', 'change'].forEach(function (k) {
              var b = document.createElement('button'); b.type = 'button'; b.textContent = k === 'change' ? 'Změnit' : STATE_NAME[k];
              if (o.state === k) b.className = 'on-' + k;
              b.onclick = function () { if (o.state === k) return; snap(); o.state = k; hiObj = i; repaint(); rows(); };
              sg.appendChild(b);
            });
            row.appendChild(nm); row.appendChild(sg); box.appendChild(row);
          });
          if (!box.children.length) box.innerHTML = '<p style="margin:6px 0;color:#56685A">Zatím nic. Ťukněte na fotce na to, co má zůstat nebo zmizet.</p>';
        }
        $('[data-list]').onclick = function () { rows(); $('[data-sheet]').classList.add('is-on'); };
        $('[data-sheetclose]').onclick = function () { hiObj = -1; repaint(); $('[data-sheet]').classList.remove('is-on'); };

        function finish() {
          var category_ = category();
          var editMask = catMask(seg, category_, pw, ph, function (c) { return c !== PROTECT; });
          var removeMask = catMask(seg, category_, pw, ph, function (c) { return c === REMOVE; });
          var protectMask = catMask(seg, category_, pw, ph, function (c) { return c === PROTECT; });
          // stejné úpravy hran jako u štětce (mg-paint-mask.js): ochrana se nikdy nezmenší
          if (S && S.growMask) { editMask = S.growMask(editMask); removeMask = S.growMask(removeMask); }
          if (S && S.combineMasks) editMask = S.combineMasks('subtract', editMask, protectMask);
          if (S && S.smoothMaskEdge) { editMask = S.smoothMaskEdge(editMask); removeMask = S.smoothMaskEdge(removeMask); }
          if (S && S.combineMasks) editMask = S.combineMasks('subtract', editMask, protectMask);
          var hasRemove = false; for (var s = 1; s <= N; s++) if (category_[s] === REMOVE) { hasRemove = true; break; }
          var names = function (k) { return objects.filter(function (o, i) { return o.state === k && Array.prototype.some.call(owner, function (x) { return x === i; }); }).map(function (o) { return o.name; }); };
          close({ editMask: editMask, removeMask: removeMask, category: category_, hasRemove: hasRemove, previewDataUrl: previewUrl(seg, category_, photo, pw, ph),
            state: { objects: objects.map(function (o) { return { name: o.name, kind: o.kind, state: o.state }; }), owner: Array.from(owner) }, keepNames: names('keep'), removeNames: names('remove') });
        }
        $('[data-ok]').onclick = finish; $('[data-ok2]').onclick = finish;
        $('[data-brush]').onclick = function () {
          var c = category(); close(null);
          Pm.confirmPaintMask(photo, 'Doladění štětcem: zelená zůstane, červená zmizí.', { cacheKey: opts.cacheKey, initialCategory: c }).then(function (r) { if (r && opts.onBrush) opts.onBrush(r); });
        };

        $('[data-load]').remove();
        fit(); repaint(); rows();
        var tip = window.innerHeight > window.innerWidth && W > H ? ' Tip: otočte telefon na šířku.' : '';
        if (!(det && det.error)) toast((objects.length ? 'Zelená = zůstane, červená = pryč. Ťuknutím přepnete, seznam je vpravo dole.' : 'Ťukněte na to, co má zůstat.') + tip, 5500);
      }).catch(function (e) {
        var ld = $('[data-load]'); if (ld) ld.innerHTML = '<div><b>Fotku se nepodařilo připravit</b><span>' + String((e && e.message) || e).replace(/</g, '&lt;') + '</span></div>';
      });
    });
  }

  window.MVGreenMarkV2 = { open: open, stats: stats, grow: grow, polygon: polygon };
})();
