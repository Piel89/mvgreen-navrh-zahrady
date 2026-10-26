/*
 * MVGreen – paint-based marking tool for step 4 ("Označení plochy").
 *
 * This is a direct port of the standalone prototype built and approved this week (fullscreen
 * mode with orientation lock, minimap, pinch-zoom/pan, the exact toolbar: 🟩 Zůstane (maluj) /
 * 🟥 Odstranit (maluj) / ⬜ Smazat (maluj) / ☁️ Obloha automaticky / ↶ Zpět / Vymazat vše) – not a
 * reuse of ai-safety.js's older, simpler confirmMask() dialog chrome. The only things genuinely
 * new here, absent from the standalone demo because it never needed them: the segmentation runs
 * live (via mg-slic.js/mg-segment-worker.js) on whatever photo the customer actually uploaded,
 * instead of fetching a precomputed meta.json/labels.png for one fixed demo photo; and a
 * confirm/cancel bar, since the demo had no "done" concept at all.
 *
 * The whole UI lives inside a Shadow DOM, attached to a position:fixed;inset:0 host element
 * appended to <body>. The prototype's own CSS leans on bare element selectors (`button`,
 * `canvas`, `:root`) that assume total control of the page – exactly true for a standalone demo,
 * but it would either leak onto the WordPress theme's own buttons/canvases or collide with the
 * theme's own bare-element rules if injected directly into the live page. A shadow root keeps the
 * prototype's CSS working exactly as written (ported close to verbatim below) while guaranteeing
 * it can only ever affect this dialog.
 *
 * Output contract (what app.js's openMaskConfirmation consumes): confirmPaintMask() resolves to
 * null (cancelled) or { editMask, removeMask, category, hasRemove }:
 *   - editMask: "paint = editable" canvas, ai-safety.js's usual convention – opaque wherever the
 *     segment's category != PROTECT. S.growMask/S.editableShare/S.validate/S.prepare downstream
 *     all keep working unchanged.
 *   - removeMask: same convention, opaque only where category === REMOVE – feeds buildStagedPlan's
 *     literal-removal stage in app.js, alongside (not instead of) step 5's own rough strokes.
 *   - category: Uint8Array(numSegments+1), handed back as opts.initialCategory to reopen the
 *     brush exactly as left (app.js's "adjust" flow).
 *   - hasRemove: cheap boolean, so app.js can decide whether to enter the staged pipeline without
 *     re-scanning a whole mask.
 *
 * Every fresh open starts BLANK (category all 0), exactly like the approved prototype – the
 * customer presses "☁️ Obloha automaticky" themselves rather than the dialog silently pre-filling
 * anything. The existing MAX_EDITABLE/MIN_EDITABLE 70%/2% coverage gate (ai-safety.js's
 * validate()) still blocks confirming otherwise, unchanged, wired into the status bar exactly like
 * confirmMask did before it.
 */
(function () {
  'use strict';
  var PROTECT = 1, REMOVE = 2;

  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // One Worker, reused across opens; segmentation itself is cached per cacheKey (app.js passes the
  // uploaded photo's own img.src) so reopening the brush on the same photo never re-runs the
  // ~0.3-2.5s computation. app.js also calls prepareSegmentation() as soon as the photo is ready
  // (setupPhoto), so by the time the customer reaches step 4 the result is usually already cached.
  var worker = null;
  function getWorker() {
    if (!worker) {
      var url = (window.MVGreenAI && window.MVGreenAI.workerUrl) || 'mg-segment-worker.js';
      worker = new Worker(url);
    }
    return worker;
  }
  var segCache = null; // { key, promise }
  function segmentPhoto(photo, cacheKey) {
    if (segCache && segCache.key === cacheKey) return segCache.promise;
    var promise = new Promise(function (resolve, reject) {
      var MAX_DIM = 1000; // same working resolution validated in the standalone prototype
      var srcW = photo.width || photo.naturalWidth, srcH = photo.height || photo.naturalHeight;
      var scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
      var W = Math.max(1, Math.round(srcW * scale)), H = Math.max(1, Math.round(srcH * scale));
      var src = mkCanvas(W, H), sctx = src.getContext('2d');
      sctx.drawImage(photo, 0, 0, W, H);
      var imageData;
      try { imageData = sctx.getImageData(0, 0, W, H); } catch (e) { reject(e); return; }
      var w;
      try { w = getWorker(); } catch (e) { reject(e); return; }
      function onMessage(e) {
        if (e.data.type === 'error') { w.removeEventListener('message', onMessage); reject(new Error(e.data.message)); return; }
        w.removeEventListener('message', onMessage);
        resolve({ W: W, H: H, labels: e.data.labels, numSegments: e.data.numSegments, skyIds: e.data.skyIds, preview: imageData });
      }
      function onError(e) { w.removeEventListener('message', onMessage); reject(new Error((e && e.message) || 'Worker pro analýzu fotografie selhal.')); }
      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError, { once: true });
      w.postMessage({
        type: 'segment', width: W, height: H,
        pixels: imageData.data.buffer.slice(0),
        numSegments: 2500, compactness: 12, maxIter: 10
      });
    });
    segCache = { key: cacheKey, promise: promise };
    return promise;
  }

  /**
   * Builds a full-photo-resolution "paint = editable" mask from the (small, working-resolution)
   * segmentation + category array. match(cat) decides which categories count as "editable" for
   * this mask (e.g. "everything except PROTECT" for editMask, "only REMOVE" for removeMask).
   */
  function categoryMask(seg, category, photoW, photoH, match) {
    var W = seg.W, H = seg.H, labels = seg.labels;
    var work = mkCanvas(W, H), wctx = work.getContext('2d');
    var img = wctx.createImageData(W, H), d = img.data;
    for (var i = 0, p = 0; i < W * H; i++, p += 4) {
      if (match(category[labels[i]])) d[p + 3] = 255;
    }
    wctx.putImageData(img, 0, 0);
    var out = mkCanvas(photoW, photoH), octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(work, 0, 0, photoW, photoH);
    octx.globalCompositeOperation = 'source-in'; octx.fillStyle = '#1b9c55'; octx.fillRect(0, 0, photoW, photoH);
    octx.globalCompositeOperation = 'source-over';
    return out;
  }

  /**
   * A soft, photo-still-visible preview used as the BACKGROUND photo for later steps (step 5's
   * bed/path sketch, step 6's generation panel) – not the strong, fully-opaque tint the interactive
   * dialog itself uses while painting (that's fine full-strength when it's the only thing on
   * screen, but baked into a thumbnail/background photo elsewhere it reads as a garish, almost
   * unrecognizable colour wash). Same category colours, blended at low opacity over the real photo.
   */
  function buildPreviewDataUrl(seg, category, photo, photoW, photoH) {
    var W = seg.W, H = seg.H, labels = seg.labels;
    var tint = mkCanvas(W, H), tctx = tint.getContext('2d');
    var img = tctx.createImageData(W, H), d = img.data;
    for (var i = 0, p = 0; i < W * H; i++, p += 4) {
      var cat = category[labels[i]];
      if (cat === PROTECT) { d[p] = 47; d[p + 1] = 174; d[p + 2] = 74; d[p + 3] = 255; }
      else if (cat === REMOVE) { d[p] = 217; d[p + 1] = 69; d[p + 2] = 63; d[p + 3] = 255; }
    }
    tctx.putImageData(img, 0, 0);
    var out = mkCanvas(photoW, photoH), octx = out.getContext('2d');
    octx.drawImage(photo, 0, 0, photoW, photoH);
    octx.imageSmoothingEnabled = true;
    octx.globalAlpha = 0.38;
    octx.drawImage(tint, 0, 0, photoW, photoH);
    octx.globalAlpha = 1;
    try { return out.toDataURL('image/jpeg', 0.86); } catch (e) { return null; }
  }

  // The prototype's own markup+CSS, ported close to verbatim (selectors scoped to the shadow
  // tree below instead of the whole page – see the file header). `:root` -> `:host`, `body` ->
  // `#app` (the shadow tree's own top-level element, playing body's role here). Added, not in the
  // original demo: the `.confirmrow` action bar (Zpět/Potvrdit) and the `.hintbox` line.
  var TEMPLATE = ''
    + '<style>'
    + ':host{--bg:#f3f6f3;--panel:#ffffff;--ink:#1c2a20;--muted:#5a6d5e;--line:#d7e3d9;--accent:#156333;--accent-soft:#e8f1e9;--protect:#2fae4a;--remove:#d9453f;--erase:#6b7280;color-scheme:light;all:initial;}'
    + '@media (prefers-color-scheme: dark){:host(:not([data-theme="light"])){--bg:#13201a;--panel:#182820;--ink:#eaf2ec;--muted:#9fb3a5;--line:#2a3d33;--accent:#4fd184;--accent-soft:#1f3a2a;--protect:#39c15f;--remove:#e4645c;--erase:#8b95a1;color-scheme:dark;}}'
    + ':host([data-theme="dark"]){--bg:#13201a;--panel:#182820;--ink:#eaf2ec;--muted:#9fb3a5;--line:#2a3d33;--accent:#4fd184;--accent-soft:#1f3a2a;--protect:#39c15f;--remove:#e4645c;--erase:#8b95a1;color-scheme:dark;}'
    + '*{box-sizing:border-box;}'
    + '[hidden]{display:none !important;}'
    + '#app{position:fixed;inset:0;margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;height:100vh;height:100dvh;overflow:hidden;padding-left:max(16px, env(safe-area-inset-left,0px));padding-right:max(16px, env(safe-area-inset-right,0px));padding-top:max(6px, env(safe-area-inset-top,0px));padding-bottom:max(6px, env(safe-area-inset-bottom,0px));}'
    + '.headerbar{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 2px;}'
    + 'h1{font-size:16px;margin:0;}'
    + '.info-btn{padding:4px 11px;font-size:14px;border-radius:999px;flex:0 0 auto;}'
    + '.info-panel{flex:0 0 auto;padding-bottom:6px;}'
    + 'p.note{font-size:13px;color:var(--muted);margin:0 0 8px;}'
    + '.toolbar{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:6px;padding:6px 0;}'
    + 'button{border:0;border-radius:9px;padding:9px 12px;font:inherit;font-size:13px;font-weight:600;background:var(--accent-soft);color:var(--accent);cursor:pointer;}'
    + 'button:disabled{opacity:.5;cursor:not-allowed;}'
    + 'button.active{background:var(--protect);color:#fff;}'
    + 'button#tool-remove.active{background:var(--remove);color:#fff;}'
    + 'button#tool-erase.active{background:var(--erase);color:#fff;}'
    + 'button.primary{background:var(--accent);color:#fff;}'
    + 'button#tool-precision.active{background:#a6670a;color:#fff;}'
    + '.zoomrow{flex:0 0 auto;display:flex;gap:6px;padding:6px 0;}'
    + '.stage-wrap{position:relative;flex:1 1 auto;min-height:0;margin-bottom:8px;display:flex;}'
    + '.stage-viewport{flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:12px;background:#111;touch-action:none;}'
    + '.stage{position:relative;width:100%;margin:0 auto;}'
    + 'canvas{display:block;width:100%;height:auto;touch-action:none;}'
    + '#minimap{position:absolute;right:10px;bottom:10px;width:104px;height:auto;border:2px solid rgba(255,255,255,0.85);border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,0.4);touch-action:none;cursor:pointer;}'
    + '.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);padding-bottom:6px;}'
    + '.legend span{display:inline-flex;align-items:center;gap:5px;}'
    + '.sw{width:11px;height:11px;border-radius:3px;display:inline-block;}'
    + '.hintbox{flex:0 0 auto;margin:0 0 6px;padding:8px 12px;border-radius:10px;background:#fff7e0;color:#5a4300;font-size:13px;}'
    + '#status{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:12px;color:var(--muted);padding:4px 0;}'
    + '#status .statstext{flex:1 1 auto;min-width:160px;}'
    + '#status .statstext.is-bad{color:var(--remove);font-weight:600;}'
    + '.confirmrow{flex:0 0 auto;display:flex;justify-content:flex-end;gap:10px;padding:4px 0 2px;}'
    + '@media (orientation: landscape) and (max-height: 600px){.headerbar,.info-panel{display:none;}button{padding:6px 9px;font-size:11px;border-radius:7px;}.toolbar,.zoomrow{padding:4px 0;gap:4px;}}'
    + '#app.fs-mode .stage-wrap{position:fixed;inset:0;margin:0;}'
    + '#app.fs-mode .stage-viewport{border:0;border-radius:0;}'
    + '#app.fs-mode #chrome-top,#app.fs-mode #status-bottom{position:fixed;left:0;right:0;z-index:5;background:rgba(8,16,11,0.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);transition:opacity .2s ease;margin:0;}'
    + '#app.fs-mode #chrome-top{top:0;padding:max(8px, env(safe-area-inset-top,0px)) max(10px, env(safe-area-inset-right,0px)) 4px max(10px, env(safe-area-inset-left,0px));}'
    + '#app.fs-mode #status-bottom{bottom:0;padding:4px max(10px, env(safe-area-inset-right,0px)) max(8px, env(safe-area-inset-bottom,0px)) max(10px, env(safe-area-inset-left,0px));}'
    + '#app.fs-mode.controls-hidden #chrome-top,#app.fs-mode.controls-hidden #status-bottom{opacity:0;pointer-events:none;}'
    + '#fs-prompt{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:30;padding:16px 26px;font-size:16px;border-radius:999px;color:#fff;background:rgba(8,16,11,0.85);box-shadow:0 6px 24px rgba(0,0,0,0.45);border:0;}'
    + '</style>'
    + '<div id="app">'
    + '<div id="chrome-top">'
    + '<div class="headerbar"><h1>Co zůstane a co odstranit?</h1><button id="info-toggle" class="info-btn" aria-label="Nápověda">ⓘ</button></div>'
    + '<div class="info-panel" id="info-panel" hidden>'
    + '<p class="note">1 prst maluje nebo klepe (i tahem po více políčkách najednou). 2 prsty posouvají a přibližují. Když jsi přiblížený, klepni na mapku vpravo dole a hned skočíš jinam. Na velké ploše (tráva, obloha) jeď normálně štětcem – u plotu, hrany záhonu nebo kytky zapni „🔲 Přesně (dílky)“: uvidíš hranice jednotlivých dílků a malování trefí vždy jen ten jeden, na kterém přesně jsi.</p>'
    + '<div class="legend">'
    + '<span><span class="sw" style="background:var(--protect)"></span> zůstane (chráněno)</span>'
    + '<span><span class="sw" style="background:var(--remove)"></span> odstranit</span>'
    + '<span><span class="sw" style="background:var(--protect)"></span> obloha (auto, počítá se jako zůstane)</span>'
    + '</div></div>'
    + '<p class="hintbox" id="hintbox" hidden></p>'
    + '<div class="toolbar">'
    + '<button id="tool-protect" class="active" disabled>🟩 Zůstane (maluj)</button>'
    + '<button id="tool-remove" disabled>🟥 Odstranit (maluj)</button>'
    + '<button id="tool-erase" disabled>⬜ Smazat (maluj)</button>'
    + '<button id="tool-precision" disabled title="Zapne hranice jednotlivých dílků a malování po jednom – pro přesné trefení plotu, hrany záhonu nebo kytky.">🔲 Přesně (dílky)</button>'
    + '<button id="auto-sky" disabled>☁️ Obloha automaticky</button>'
    + '<button id="undo-btn" disabled>↶ Zpět</button>'
    + '<button id="clear-all" disabled>Vymazat vše</button>'
    + '</div>'
    + '<div class="zoomrow">'
    + '<button id="zoom-out">－</button>'
    + '<button id="zoom-reset">100 %</button>'
    + '<button id="zoom-in">＋</button>'
    + '<button id="fullscreen-btn">⛶ Celá obrazovka</button>'
    + '</div>'
    + '</div>'
    + '<div class="stage-wrap">'
    + '<div class="stage-viewport" id="viewport"><div class="stage" id="stage"><canvas id="view"></canvas></div></div>'
    + '<canvas id="minimap" hidden></canvas>'
    + '</div>'
    + '<button id="fs-prompt" hidden>⛶ Zapnout celou obrazovku</button>'
    + '<div id="status-bottom">'
    + '<div id="status"><span class="statstext" id="statstext">Načítám…</span></div>'
    + '<div class="confirmrow"><button id="act-cancel">Zpět</button><button id="act-ok" class="primary" disabled>Potvrdit plochu</button></div>'
    + '</div>'
    + '</div>';

  function confirmPaintMask(photo, hint, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var photoW = photo.width || photo.naturalWidth, photoH = photo.height || photo.naturalHeight;
      if (!photo || !photoW || !photoH) {
        alert('Fotografii se nepodařilo načíst pro vyznačení plochy. Zkuste prosím fotografii nahrát znovu.');
        resolve(null);
        return;
      }
      var hostEl = document.createElement('div');
      hostEl.style.position = 'fixed'; hostEl.style.inset = '0'; hostEl.style.zIndex = '2147483647';
      document.body.appendChild(hostEl);
      var root = hostEl.attachShadow({ mode: 'open' });
      root.innerHTML = TEMPLATE;

      var app = root.getElementById('app');
      var statusEl = root.getElementById('statstext');
      var viewport = root.getElementById('viewport');
      var stage = root.getElementById('stage');
      var canvas = root.getElementById('view');
      var ctx = canvas.getContext('2d');
      var hintbox = root.getElementById('hintbox');
      if (hint) { hintbox.textContent = '💡 ' + hint; hintbox.hidden = false; }

      root.getElementById('info-toggle').addEventListener('click', function () {
        var p = root.getElementById('info-panel'); p.hidden = !p.hidden;
      });

      function close(v) { hostEl.remove(); resolve(v); }
      root.getElementById('act-cancel').addEventListener('click', function () { close(null); });

      segmentPhoto(photo, opts.cacheKey).then(function (seg) {
        var W = seg.W, H = seg.H, numSegments = seg.numSegments, labels = seg.labels;
        canvas.width = W; canvas.height = H;

        var category = new Uint8Array(numSegments + 1);
        if (opts.initialCategory && opts.initialCategory.length === category.length) category.set(opts.initialCategory);

        var segCount = new Float64Array(numSegments + 1), totalPx = W * H;
        for (var si = 0; si < labels.length; si++) segCount[labels[si]]++;

        // ---- Minimap: small always-on overview, shown only while zoomed in; tap anywhere on it
        // to jump straight there. Ported verbatim from the standalone prototype. ----
        var minimap = root.getElementById('minimap'), miniCtx = minimap.getContext('2d');
        var MINI_W = 104, MINI_H = Math.max(1, Math.round(104 * H / W));
        minimap.width = MINI_W; minimap.height = MINI_H;
        function updateMinimap() {
          if (zoom <= 1.001) { minimap.hidden = true; return; }
          minimap.hidden = false;
          miniCtx.drawImage(canvas, 0, 0, W, H, 0, 0, MINI_W, MINI_H);
          var stageW = stage.getBoundingClientRect().width || MINI_W;
          var stageH = stage.getBoundingClientRect().height || MINI_H;
          var fracLeft = viewport.scrollLeft / stageW, fracTop = viewport.scrollTop / stageH;
          var fracW = Math.min(1, viewport.clientWidth / stageW), fracH = Math.min(1, viewport.clientHeight / stageH);
          miniCtx.strokeStyle = '#ffd400'; miniCtx.lineWidth = 2;
          miniCtx.strokeRect(fracLeft * MINI_W, fracTop * MINI_H, fracW * MINI_W, fracH * MINI_H);
        }
        viewport.addEventListener('scroll', updateMinimap);
        function jumpToMinimapPoint(clientX, clientY) {
          var r = minimap.getBoundingClientRect();
          var fx = (clientX - r.left) / r.width, fy = (clientY - r.top) / r.height;
          var stageW = stage.getBoundingClientRect().width || MINI_W;
          var stageH = stage.getBoundingClientRect().height || MINI_H;
          var targetLeft = fx * stageW - viewport.clientWidth / 2, targetTop = fy * stageH - viewport.clientHeight / 2;
          viewport.scrollLeft = Math.max(0, Math.min(stageW - viewport.clientWidth, targetLeft));
          viewport.scrollTop = Math.max(0, Math.min(stageH - viewport.clientHeight, targetTop));
          updateMinimap();
        }
        var minimapDragging = false;
        minimap.addEventListener('pointerdown', function (e) {
          e.preventDefault(); minimapDragging = true;
          try { minimap.setPointerCapture(e.pointerId); } catch (er) {}
          jumpToMinimapPoint(e.clientX, e.clientY);
        });
        minimap.addEventListener('pointermove', function (e) { if (minimapDragging) jumpToMinimapPoint(e.clientX, e.clientY); });
        ['pointerup', 'pointercancel'].forEach(function (ev) { minimap.addEventListener(ev, function () { minimapDragging = false; }); });

        // ---- repaint / status, matching the prototype's category tinting exactly ----
        var origData = seg.preview;
        var COLORS = {}; COLORS[PROTECT] = [47, 174, 74]; COLORS[REMOVE] = [217, 69, 63];
        var S = window.MVGreenAISafety;
        // "🔲 Přesně (dílky)" mode: draws the individual segment ("dílek") boundaries so the
        // customer can see exactly where each paintable piece ends, and switches painting (below,
        // paintDisc) from the usual fixed-radius brush disc to touching only the single segment
        // under the cursor – needed to hit a thin fence line, a bed edge, or one flower precisely,
        // where the brush disc otherwise always drags in a bit of the neighbouring segment too.
        var precisionMode = false, edgeMap = null;
        function computeEdgeMap() {
          if (edgeMap) return edgeMap;
          edgeMap = new Uint8Array(W * H);
          for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
              var i = y * W + x, lab = labels[i];
              if ((x + 1 < W && labels[i + 1] !== lab) || (y + 1 < H && labels[i + W] !== lab)) edgeMap[i] = 1;
            }
          }
          return edgeMap;
        }
        function repaint() {
          var out = new Uint8ClampedArray(origData.data);
          for (var i = 0, p = 0; i < labels.length; i++, p += 4) {
            var cat = category[labels[i]];
            if (cat) {
              var c = COLORS[cat];
              out[p] = out[p] * 0.42 + c[0] * 0.58;
              out[p + 1] = out[p + 1] * 0.42 + c[1] * 0.58;
              out[p + 2] = out[p + 2] * 0.42 + c[2] * 0.58;
            }
          }
          if (precisionMode) {
            var edges = computeEdgeMap();
            for (var j = 0, pp = 0; j < edges.length; j++, pp += 4) {
              if (edges[j]) { out[pp] *= 0.35; out[pp + 1] *= 0.35; out[pp + 2] *= 0.35; }
            }
          }
          ctx.putImageData(new ImageData(out, W, H), 0, 0);
          updateStatus();
          updateMinimap();
        }
        function updateStatus() {
          var protect = 0, remove = 0, unset = 0;
          var protectPx = 0, removePx = 0, unsetPx = 0;
          for (var s = 1; s <= numSegments; s++) {
            if (category[s] === PROTECT) { protect++; protectPx += segCount[s]; }
            else if (category[s] === REMOVE) { remove++; removePx += segCount[s]; }
            else { unset++; unsetPx += segCount[s]; }
          }
          var pct = function (n) { return Math.round(n / numSegments * 100); };
          var coverage = totalPx ? (removePx + unsetPx) / totalPx : 0;
          var msg = S ? S.validate(coverage) : '';
          statusEl.textContent = 'Zůstane: ' + pct(protect) + ' %  ·  Odstranit: ' + pct(remove) + ' %  ·  Neoznačeno: ' + pct(unset) + ' %' + (msg ? '  –  ' + msg : '');
          statusEl.classList.toggle('is-bad', !!msg);
          okBtn.disabled = !!msg;
        }

        var currentTool = 'protect';
        var btnProtect = root.getElementById('tool-protect'), btnRemove = root.getElementById('tool-remove'), btnErase = root.getElementById('tool-erase');
        function setTool(t) {
          currentTool = t;
          btnProtect.classList.toggle('active', t === 'protect');
          btnRemove.classList.toggle('active', t === 'remove');
          btnErase.classList.toggle('active', t === 'erase');
          repaint();
        }
        btnProtect.addEventListener('click', function () { setTool('protect'); });
        btnRemove.addEventListener('click', function () { setTool('remove'); });
        btnErase.addEventListener('click', function () { setTool('erase'); });
        root.getElementById('clear-all').addEventListener('click', function () { category.fill(0); repaint(); });
        root.getElementById('auto-sky').addEventListener('click', function () {
          seg.skyIds.forEach(function (id) { category[id] = PROTECT; });
          repaint();
        });
        var precisionBtn = root.getElementById('tool-precision');
        precisionBtn.addEventListener('click', function () {
          precisionMode = !precisionMode;
          precisionBtn.classList.toggle('active', precisionMode);
          repaint();
        });

        // ---- zoom / pinch / fullscreen chrome, ported verbatim ----
        var zoom = 1; var ZOOM_MAX = 3;
        function isLandscape() { return window.innerWidth > window.innerHeight; }
        function isFullscreen() { return document.fullscreenElement === hostEl || document.webkitFullscreenElement === hostEl; }
        function baseStageWidth() {
          // Always "contain" (whole photo visible, letterboxed if needed) at zoom 1 – including in
          // fullscreen. The prototype this was ported from used "cover" (fill edge-to-edge, cropped)
          // in fullscreen for more painting precision on a landscape phone, but the customer wants
          // the whole photo visible the moment fullscreen turns on, not cropped until they zoom out
          // manually. Fullscreen still buys the usable screen space (browser chrome hidden,
          // orientation locked) – it just no longer forces a crop on entry.
          var vw = viewport.clientWidth || 1, vh = viewport.clientHeight || 1;
          return Math.min(vw, vh * (W / H));
        }
        function applyZoom() {
          var w = Math.round(baseStageWidth() * zoom);
          var h = w * (H / W);
          stage.style.setProperty('width', w + 'px', 'important');
          var vh = viewport.clientHeight || 1;
          stage.style.marginTop = (h < vh) ? Math.round((vh - h) / 2) + 'px' : '0';
          root.getElementById('zoom-reset').textContent = Math.round(zoom * 100) + ' %';
          updateMinimap();
        }
        function centerView() {
          var stageRect = stage.getBoundingClientRect();
          viewport.scrollLeft = Math.max(0, (stageRect.width - viewport.clientWidth) / 2);
          viewport.scrollTop = Math.max(0, (stageRect.height - viewport.clientHeight) / 2);
        }
        root.getElementById('zoom-in').addEventListener('click', function () { zoom = Math.min(ZOOM_MAX, zoom + 0.5); applyZoom(); });
        root.getElementById('zoom-out').addEventListener('click', function () { zoom = Math.max(1, zoom - 0.5); applyZoom(); });
        root.getElementById('zoom-reset').addEventListener('click', function () { zoom = 1; applyZoom(); centerView(); });

        // Desktop mouse wheel = zoom in/out (centered on the cursor), instead of the viewport's
        // default vertical-scroll behaviour, which is only useful here for panning once zoomed in.
        viewport.addEventListener('wheel', function (e) {
          e.preventDefault();
          var before = stage.getBoundingClientRect();
          var fracX = before.width ? (e.clientX - before.left) / before.width : 0.5;
          var fracY = before.height ? (e.clientY - before.top) / before.height : 0.5;
          zoom = Math.max(1, Math.min(ZOOM_MAX, zoom + (e.deltaY < 0 ? 0.3 : -0.3)));
          applyZoom();
          var after = stage.getBoundingClientRect();
          var curX = after.left + fracX * after.width, curY = after.top + fracY * after.height;
          viewport.scrollLeft = Math.max(0, Math.min(after.width - viewport.clientWidth, viewport.scrollLeft + (curX - e.clientX)));
          viewport.scrollTop = Math.max(0, Math.min(after.height - viewport.clientHeight, viewport.scrollTop + (curY - e.clientY)));
        }, { passive: false });

        var fsBtn = root.getElementById('fullscreen-btn'), fsPrompt = root.getElementById('fs-prompt');
        var canFullscreen = !!((hostEl.requestFullscreen || hostEl.webkitRequestFullscreen) && (document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false));
        function enterFullscreen() {
          return Promise.resolve().then(function () {
            if (hostEl.requestFullscreen) return hostEl.requestFullscreen();
            if (hostEl.webkitRequestFullscreen) return hostEl.webkitRequestFullscreen();
            throw new Error('Fullscreen API není v tomto prohlížeči dostupné.');
          }).then(function () {
            if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape').catch(function () {});
          }).catch(function (e) {
            statusEl.textContent = 'Celá obrazovka se nepovedla spustit: ' + (e && e.message ? e.message : e) + '.';
          });
        }
        function updateFsPrompt() {
          if (!canFullscreen) { fsPrompt.hidden = true; return; }
          fsPrompt.hidden = !(isLandscape() && !isFullscreen());
        }
        if (canFullscreen) fsPrompt.addEventListener('click', enterFullscreen);
        window.addEventListener('resize', onResize);
        function onResize() { applyZoom(); if (zoom <= 1.001) centerView(); updateFsPrompt(); }

        if (!canFullscreen) {
          fsBtn.hidden = true;
        } else {
          function onFullscreenChange() {
            var fs = isFullscreen();
            app.classList.toggle('fs-mode', fs);
            if (!fs) app.classList.remove('controls-hidden');
            fsBtn.textContent = fs ? '⤡ Zavřít celou obrazovku' : '⛶ Celá obrazovka';
            updateFsPrompt();
            setTimeout(function () { applyZoom(); centerView(); }, 50);
          }
          fsBtn.addEventListener('click', function () {
            if (isFullscreen()) {
              try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
              try {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
              } catch (e) {}
            } else {
              enterFullscreen();
            }
          });
          document.addEventListener('fullscreenchange', onFullscreenChange);
          document.addEventListener('webkitfullscreenchange', onFullscreenChange);
          onFullscreenChange();
        }
        updateFsPrompt();

        var pointers = new Map(); var pinch = null;
        function pinchPoints() { var pts = Array.from(pointers.values()); return pts.length >= 2 ? [pts[0], pts[1]] : null; }
        function startPinch() {
          var p = pinchPoints(); if (!p) return;
          var stageRect = stage.getBoundingClientRect();
          var midX = (p[0].x + p[1].x) / 2, midY = (p[0].y + p[1].y) / 2;
          pinch = {
            dist: Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) || 1, zoom: zoom,
            anchorFracX: stageRect.width ? (midX - stageRect.left) / stageRect.width : 0,
            anchorFracY: stageRect.height ? (midY - stageRect.top) / stageRect.height : 0,
          };
        }
        function updatePinch() {
          var p = pinchPoints(); if (!p || !pinch) return;
          var dist = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) || 1;
          var midX = (p[0].x + p[1].x) / 2, midY = (p[0].y + p[1].y) / 2;
          zoom = Math.max(1, Math.min(ZOOM_MAX, pinch.zoom * (dist / pinch.dist)));
          applyZoom();
          var stageRect = stage.getBoundingClientRect();
          var curX = stageRect.left + pinch.anchorFracX * stageRect.width;
          var curY = stageRect.top + pinch.anchorFracY * stageRect.height;
          viewport.scrollLeft = Math.max(0, Math.min(stageRect.width - viewport.clientWidth, viewport.scrollLeft + (curX - midX)));
          viewport.scrollTop = Math.max(0, Math.min(stageRect.height - viewport.clientHeight, viewport.scrollTop + (curY - midY)));
        }
        function endPinch() { pinch = null; }

        function canvasPoint(e) {
          var r = canvas.getBoundingClientRect();
          var x = Math.max(0, Math.min(W - 1, Math.round((e.clientX - r.left) / r.width * W)));
          var y = Math.max(0, Math.min(H - 1, Math.round((e.clientY - r.top) / r.height * H)));
          return { x: x, y: y };
        }

        var painting = false;
        var BRUSH_RADIUS = Math.max(8, Math.round(W / 80));
        var brushOffsets = (function () {
          var offs = [], r2 = BRUSH_RADIUS * BRUSH_RADIUS;
          for (var dy = -BRUSH_RADIUS; dy <= BRUSH_RADIUS; dy++)
            for (var dx = -BRUSH_RADIUS; dx <= BRUSH_RADIUS; dx++)
              if (dx * dx + dy * dy <= r2) offs.push([dx, dy]);
          return offs;
        })();

        var undoStack = [], strokeChanges = null, lastPaintPt = null;
        // Ctrl/Cmd+click with a mouse erases under the cursor regardless of the selected tool – a
        // quick desktop shortcut so correcting a stray mark doesn't require switching to "Smazat"
        // and back. Only applies to the stroke it was held for; set at pointerdown, read by
        // paintDisc for that stroke's whole duration (drag included).
        var strokeForceErase = false;
        function paintDisc(cx, cy) {
          var target = strokeForceErase ? 0 : currentTool === 'protect' ? PROTECT : currentTool === 'erase' ? 0 : REMOVE;
          if (precisionMode) {
            // Touch only the exact segment under the cursor – no radius – so a fence line, a bed
            // edge, or a single flower can be hit without also grabbing its neighbours.
            if (cx < 0 || cx >= W || cy < 0 || cy >= H) return;
            var only = labels[cy * W + cx];
            if (!strokeChanges.has(only)) strokeChanges.set(only, category[only]);
            category[only] = target;
            return;
          }
          for (var k = 0; k < brushOffsets.length; k++) {
            var x = cx + brushOffsets[k][0], y = cy + brushOffsets[k][1];
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            var seg = labels[y * W + x];
            if (!strokeChanges.has(seg)) strokeChanges.set(seg, category[seg]);
            category[seg] = target;
          }
        }
        function paintAt(pt) {
          if (lastPaintPt) {
            var dist = Math.hypot(pt.x - lastPaintPt.x, pt.y - lastPaintPt.y);
            // A precise drag must sample densely (every ~1.5px) so a thin segment along the path
            // between two points isn't skipped entirely – the usual brush-disc spacing (a fraction
            // of BRUSH_RADIUS) assumes the disc itself covers the gap, which precision mode has none of.
            var stepSize = precisionMode ? 1.5 : BRUSH_RADIUS * 0.6;
            var steps = Math.max(1, Math.ceil(dist / stepSize));
            for (var i = 1; i <= steps; i++) paintDisc(Math.round(lastPaintPt.x + (pt.x - lastPaintPt.x) * i / steps), Math.round(lastPaintPt.y + (pt.y - lastPaintPt.y) * i / steps));
          } else paintDisc(pt.x, pt.y);
          lastPaintPt = pt;
          repaint();
        }
        function finishStroke() {
          if (!strokeChanges) return;
          var changed = false;
          strokeChanges.forEach(function (prevCat, seg) { if (category[seg] !== prevCat) changed = true; });
          if (changed) { undoStack.push(strokeChanges); if (undoStack.length > 40) undoStack.shift(); }
          strokeChanges = null;
          strokeForceErase = false;
          repaint();
        }
        root.getElementById('undo-btn').addEventListener('click', function () {
          var last = undoStack.pop(); if (!last) return;
          last.forEach(function (prevCat, seg) { category[seg] = prevCat; });
          repaint();
        });

        var PINCH_GRACE_MS = 130, PINCH_GRACE_MOVE_PX = 6, pendingTouch = null;
        function cancelPendingTouch() { if (pendingTouch) { clearTimeout(pendingTouch.timer); pendingTouch = null; } }
        function commitPendingTouchAsPaint() {
          if (!pendingTouch) return;
          var pt = pendingTouch.pt; cancelPendingTouch();
          painting = true; lastPaintPt = null; strokeChanges = new Map();
          paintAt(pt);
        }
        canvas.addEventListener('pointerdown', function (e) {
          if (isFullscreen()) app.classList.add('controls-hidden');
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.size >= 2) { cancelPendingTouch(); painting = false; startPinch(); return; }
          var pt = canvasPoint(e);
          try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
          cancelPendingTouch();
          // Mouse pointers skip the pinch-grace delay entirely (it exists only to tell a one-finger
          // tap apart from the start of a two-finger touch pinch, which a mouse can't do) and paint
          // immediately, so Ctrl/Cmd+click registers on the click itself rather than ~130ms later.
          if (e.pointerType === 'mouse') {
            strokeForceErase = e.ctrlKey || e.metaKey;
            painting = true; lastPaintPt = null; strokeChanges = new Map();
            paintAt(pt);
            return;
          }
          pendingTouch = {
            pointerId: e.pointerId, pt: pt, screenX: e.clientX, screenY: e.clientY,
            timer: setTimeout(function () { if (pendingTouch && pendingTouch.pointerId === e.pointerId) commitPendingTouchAsPaint(); }, PINCH_GRACE_MS)
          };
        });
        canvas.addEventListener('pointermove', function (e) {
          if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.size >= 2) { cancelPendingTouch(); updatePinch(); return; }
          if (pendingTouch && pendingTouch.pointerId === e.pointerId) {
            var moved = Math.hypot(e.clientX - pendingTouch.screenX, e.clientY - pendingTouch.screenY);
            if (moved > PINCH_GRACE_MOVE_PX) commitPendingTouchAsPaint();
            else return;
          }
          if (!painting) return;
          paintAt(canvasPoint(e));
        });
        ['pointerup', 'pointercancel'].forEach(function (ev) {
          canvas.addEventListener(ev, function (e) {
            pointers.delete(e.pointerId);
            if (pointers.size < 2) endPinch();
            if (pendingTouch && pendingTouch.pointerId === e.pointerId) {
              if (ev === 'pointerup') commitPendingTouchAsPaint(); else cancelPendingTouch();
            }
            if (pointers.size === 0) { painting = false; lastPaintPt = null; finishStroke(); app.classList.remove('controls-hidden'); }
          });
        });

        var okBtn = root.getElementById('act-ok');
        okBtn.addEventListener('click', function () {
          var editMask = categoryMask(seg, category, photoW, photoH, function (c) { return c !== PROTECT; });
          var removeMask = categoryMask(seg, category, photoW, photoH, function (c) { return c === REMOVE; });
          if (S && S.smoothMaskEdge) { editMask = S.smoothMaskEdge(editMask); removeMask = S.smoothMaskEdge(removeMask); }
          var hasRemove = false;
          for (var s = 1; s <= numSegments; s++) if (category[s] === REMOVE) { hasRemove = true; break; }
          var previewDataUrl = buildPreviewDataUrl(seg, category, photo, photoW, photoH);
          window.removeEventListener('resize', onResize);
          close({ editMask: editMask, removeMask: removeMask, category: category, hasRemove: hasRemove, previewDataUrl: previewDataUrl });
        });

        root.querySelectorAll('#tool-protect,#tool-remove,#tool-erase,#tool-precision,#auto-sky,#undo-btn,#clear-all').forEach(function (b) { b.disabled = false; });
        applyZoom();
        centerView();
        repaint();
      }).catch(function (err) {
        statusEl.textContent = 'Analýza fotografie se nepovedla: ' + ((err && err.message) || err) + '. Zkuste to prosím znovu nebo obnovte stránku.';
      });
    });
  }

  window.MVGreenPaintMask = { prepareSegmentation: segmentPhoto, confirmPaintMask: confirmPaintMask };
})();
