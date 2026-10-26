/*
 * MVGreen – paint-based marking tool for step 4 ("Označení plochy").
 *
 * Replaces the single-category "editable blob" brush (ai-safety.js's confirmMask) with the
 * two-category tool validated this week in a standalone prototype the owner approved ("ano nas
 * klikaci nastroj je skveůek"): the customer paints "🟩 Zůstane" (protect) over whatever must stay
 * exactly as photographed, "🟥 Odstranit" (remove) over clutter that must definitely go, and
 * leaves everything else unmarked – that free space is left entirely to the AI's general
 * redesign. Painting snaps to real superpixel segments (mg-slic.js, run once per photo in a Web
 * Worker via mg-segment-worker.js) instead of raw brush circles, so a sloppy stroke can only ever
 * mark whole, visually-coherent patches of the photo (a paving slab, a bush) rather than bleeding
 * a few stray pixels across a real edge.
 *
 * Output contract (what app.js's openMaskConfirmation consumes): confirmPaintMask() resolves to
 * null (cancelled) or { editMask, removeMask, category, hasRemove }:
 *   - editMask: "paint = editable" canvas, ai-safety.js's usual convention – opaque wherever the
 *     segment's category != PROTECT. This is exactly the single mask confirmMask used to return,
 *     so S.growMask/S.editableShare/S.validate/S.prepare downstream all keep working unchanged.
 *   - removeMask: same convention, opaque only where category === REMOVE. New: lets app.js feed
 *     this into buildStagedPlan's literal-removal stage alongside (in ADDITION to, not instead
 *     of) step 5's rough "⬛ Tohle odstranit" strokes – marking removal here on step 4 has the
 *     exact same downstream effect as drawing it again on step 5, so the customer only has to do
 *     it once.
 *   - category: Uint8Array(numSegments+1), kept by the caller and handed back as
 *     opts.initialCategory to reopen the brush exactly as left (app.js's "adjust" flow).
 *   - hasRemove: cheap boolean (did the customer mark anything "Odstranit" at all), so app.js can
 *     decide whether to enter the staged-generation pipeline without re-scanning a whole mask.
 *
 * Deliberately NOT ported from confirmMask: the straight horizon-line hard lock. Segment-snapped
 * painting already can't bleed a stroke across a real object edge the way a raw circular brush
 * could, and every fresh open now starts pre-filled by the sky/wall auto-detect below (instead of
 * a blank canvas), so the customer is correcting a safe starting guess rather than opening onto a
 * photo that's wide open by default. The existing MAX_EDITABLE/MIN_EDITABLE coverage gate
 * (ai-safety.js's validate()) still blocks confirming whenever too much of the photo is left
 * editable – same hard rule as before, wired into render() below exactly like confirmMask did.
 *
 * Performance: the interactive canvas runs at the SEGMENTATION's own working resolution (≤1000px
 * on the long side – the same size validated in the standalone prototype), not the photo's full
 * resolution. A photo can be several megapixels; repainting that many pixels in a plain JS loop
 * on every pointermove (confirmMask avoids this entirely by using hardware-accelerated canvas
 * composite ops instead of a per-pixel loop) would stutter on a mid-range phone. Zoom/pan scales
 * this smaller canvas up via CSS exactly as the prototype did – a little softer at 3x zoom, a
 * trade already tried and approved. The full photo-resolution editMask/removeMask only ever get
 * built once, at confirm time (categoryMask below).
 */
(function () {
  'use strict';
  var PROTECT = 1, REMOVE = 2;

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // One Worker, reused across opens; segmentation itself is cached per cacheKey (app.js passes the
  // uploaded photo's own img.src, which only changes when a new photo is uploaded) so reopening
  // the brush on the same photo (confirm again, "adjust", or stepping back/forward through the
  // wizard) never re-runs the ~0.3-2.5s computation. app.js also calls prepareSegmentation() as
  // soon as the photo is ready (setupPhoto), so by the time the customer reaches step 4 the result
  // is usually already sitting in this cache.
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
      var scale = Math.min(1, MAX_DIM / Math.max(photo.width || photo.naturalWidth, photo.height || photo.naturalHeight));
      var srcW = photo.width || photo.naturalWidth, srcH = photo.height || photo.naturalHeight;
      var W = Math.max(1, Math.round(srcW * scale)), H = Math.max(1, Math.round(srcH * scale));
      var src = canvas(W, H), sctx = src.getContext('2d');
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
      // imageData.data.buffer is still needed locally (as the live preview), so the worker gets a
      // copy, not a transfer of the same buffer out from under us.
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
   * this particular mask (e.g. "everything except PROTECT" for editMask, "only REMOVE" for
   * removeMask). Upscaling nearest-neighbour (imageSmoothingEnabled=false) keeps every edge a
   * clean step at the segmentation's own boundary instead of a soft, semi-transparent gradient
   * that smoothMaskEdge would then round from an already-blurred starting point.
   */
  function categoryMask(seg, category, photoW, photoH, match) {
    var W = seg.W, H = seg.H, labels = seg.labels;
    var work = canvas(W, H), wctx = work.getContext('2d');
    var img = wctx.createImageData(W, H), d = img.data;
    for (var i = 0, p = 0; i < W * H; i++, p += 4) {
      if (match(category[labels[i]])) d[p + 3] = 255;
    }
    wctx.putImageData(img, 0, 0);
    var out = canvas(photoW, photoH), octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(work, 0, 0, photoW, photoH);
    // Paint colour is irrelevant downstream (only alpha counts, same convention every other mask
    // in ai-safety.js uses) – re-stamp solid colour over whatever alpha the upscale left.
    octx.globalCompositeOperation = 'source-in'; octx.fillStyle = '#1b9c55'; octx.fillRect(0, 0, photoW, photoH);
    octx.globalCompositeOperation = 'source-over';
    return out;
  }

  function confirmPaintMask(photo, hint, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var photoW = photo.width || photo.naturalWidth, photoH = photo.height || photo.naturalHeight;
      if (!photo || !photoW || !photoH) {
        alert('Fotografii se nepodařilo načíst pro vyznačení plochy. Zkuste prosím fotografii nahrát znovu.');
        resolve(null);
        return;
      }
      var ov = document.createElement('div');
      ov.className = 'mg-mask-overlay';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Vyznačení plochy – co zůstane a co odstranit');
      ov.innerHTML =
        '<div class="mg-mask-box">' +
        '<div class="mg-mask-head"><button type="button" class="mg-mask-maximize" data-act="maximize" aria-pressed="false" aria-label="Zvětšit na celou obrazovku" title="Zvětšit na celou obrazovku">⛶</button><strong>Co se nesmí změnit a co odstranit?</strong>' +
        '<span class="mg-mask-desc">🟩 Zůstane = beze změny. 🟥 Odstranit = AI to z fotky odstraní. Co nevyznačíte, AI smí volně upravit podle vašeho zadání.</span>' +
        (hint ? '<span class="mg-mask-hint">💡 ' + String(hint).replace(/[<>&]/g, '') + '</span>' : '') + '</div>' +
        '<div class="mg-mask-zoom" role="group" aria-label="Lupa pro přesnější kreslení prstem">' +
        '<button type="button" data-zoom="out" aria-label="Oddálit">－</button>' +
        '<button type="button" data-zoom="reset" title="Vrátit přiblížení">100 %</button>' +
        '<button type="button" data-zoom="in" aria-label="Přiblížit">＋</button>' +
        '</div>' +
        '<div class="mg-mask-stage"><canvas></canvas><p class="mg-paint-loading" id="mg-paint-loading">Analyzujeme fotografii…</p></div>' +
        '<div class="mg-mask-tools">' +
        '<div class="mg-mask-brush mg-paint-brush" role="group" aria-label="Štětec">' +
        '<button type="button" data-cat="' + PROTECT + '" aria-pressed="true" disabled>🟩 Zůstane</button>' +
        '<button type="button" data-cat="' + REMOVE + '" aria-pressed="false" disabled>🟥 Odstranit</button>' +
        '<button type="button" data-cat="0" aria-pressed="false" disabled>⬜ Smazat (vrátit)</button>' +
        '<button type="button" data-act="undo" disabled>↶ Zpět</button>' +
        '<button type="button" data-act="autosky" disabled>☁️ Obloha a zeď automaticky</button>' +
        '</div>' +
        '<span class="mg-mask-share" aria-live="polite"></span>' +
        '</div>' +
        '<div class="mg-mask-actions"><button type="button" data-act="cancel">Zpět</button><button type="button" data-act="ok" class="mg-primary" disabled>Potvrdit plochu</button></div>' +
        '</div>';
      document.body.appendChild(ov);
      var cv = ov.querySelector('canvas'), cx = cv.getContext('2d');
      var loadingEl = ov.querySelector('#mg-paint-loading');
      var okBtn = ov.querySelector('[data-act=ok]');
      var share = ov.querySelector('.mg-mask-share');

      // ---- zoom/pan/pinch/maximize chrome: the same behaviour as confirmMask's own dialog
      // (ai-safety.js), copied rather than shared since the two overlays' lifetimes never overlap
      // and sharing would mean reaching across files into a closure built for a different dialog.
      var maskStage = ov.querySelector('.mg-mask-stage');
      var maskZoom = 1, MASK_ZOOM_MAX = 3, maskNaturalW = null, maskNaturalH = null;
      function applyMaskZoom() {
        if (maskZoom <= 1) {
          cv.style.removeProperty('width'); cv.style.removeProperty('height');
          cv.style.removeProperty('max-width'); cv.style.removeProperty('max-height');
          maskStage.classList.remove('mg-mask-zoomed');
        } else {
          if (!maskNaturalW) { var nr = cv.getBoundingClientRect(); if (nr.width) { maskNaturalW = nr.width; maskNaturalH = nr.height; } }
          if (maskNaturalW) {
            cv.style.setProperty('width', Math.round(maskNaturalW * maskZoom) + 'px', 'important');
            cv.style.setProperty('height', Math.round(maskNaturalH * maskZoom) + 'px', 'important');
            cv.style.setProperty('max-width', 'none', 'important');
            cv.style.setProperty('max-height', 'none', 'important');
          }
          maskStage.classList.add('mg-mask-zoomed');
        }
        var resetBtn = ov.querySelector('[data-zoom=reset]'); if (resetBtn) resetBtn.textContent = Math.round(maskZoom * 100) + ' %';
      }
      var zoomInBtn = ov.querySelector('[data-zoom=in]'), zoomOutBtn = ov.querySelector('[data-zoom=out]'), zoomResetBtn = ov.querySelector('[data-zoom=reset]');
      if (zoomInBtn) zoomInBtn.addEventListener('click', function () { maskZoom = Math.min(MASK_ZOOM_MAX, maskZoom + 0.5); applyMaskZoom(); });
      if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { maskZoom = Math.max(1, maskZoom - 0.5); applyMaskZoom(); });
      if (zoomResetBtn) zoomResetBtn.addEventListener('click', function () { maskZoom = 1; applyMaskZoom(); maskStage.scrollLeft = 0; maskStage.scrollTop = 0; });
      var maskPointers = new Map();
      var maskPinch = null;
      function maskPinchPoints() { var pts = Array.from(maskPointers.values()); return pts.length >= 2 ? [pts[0], pts[1]] : null; }
      function maskStartPinch() {
        var p = maskPinchPoints(); if (!p) return;
        maskPinch = { dist: Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) || 1, midX: (p[0].x + p[1].x) / 2, midY: (p[0].y + p[1].y) / 2, zoom: maskZoom, scrollLeft: maskStage.scrollLeft, scrollTop: maskStage.scrollTop };
        maskStage.classList.add('mg-mask-panning');
      }
      function maskUpdatePinch() {
        var p = maskPinchPoints(); if (!p || !maskPinch) return;
        var dist = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) || 1;
        var midX = (p[0].x + p[1].x) / 2, midY = (p[0].y + p[1].y) / 2;
        maskZoom = Math.max(1, Math.min(MASK_ZOOM_MAX, maskPinch.zoom * (dist / maskPinch.dist)));
        applyMaskZoom();
        maskStage.scrollLeft = maskPinch.scrollLeft - (midX - maskPinch.midX);
        maskStage.scrollTop = maskPinch.scrollTop - (midY - maskPinch.midY);
      }
      function maskEndPinch() { maskPinch = null; maskStage.classList.remove('mg-mask-panning'); }
      maskStage.addEventListener('wheel', function (e) {
        if (!e.ctrlKey) return;
        e.preventDefault();
        var delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 160 : 1);
        var step = Math.max(-0.2, Math.min(0.2, -delta / 600));
        maskZoom = Math.max(1, Math.min(MASK_ZOOM_MAX, maskZoom + step));
        applyMaskZoom();
      }, { passive: false });
      var maxBtn = ov.querySelector('.mg-mask-maximize'), maskBox = ov.querySelector('.mg-mask-box');
      if (maxBtn) maxBtn.addEventListener('click', function () {
        var maxed = ov.classList.toggle('mg-mask-maxed');
        maskBox.classList.toggle('mg-mask-maxed', maxed);
        maxBtn.textContent = maxed ? '⤢' : '⛶';
        maxBtn.setAttribute('aria-pressed', String(maxed));
      });
      // ---- end shared chrome ----

      function close(v) { ov.remove(); resolve(v); }
      ov.querySelector('[data-act=cancel]').addEventListener('click', function () { close(null); });

      segmentPhoto(photo, opts.cacheKey).then(function (seg) {
        cv.width = seg.W; cv.height = seg.H;
        var numSegments = seg.numSegments, labels = seg.labels;
        var category = new Uint8Array(numSegments + 1);
        if (opts.initialCategory && opts.initialCategory.length === category.length) {
          category.set(opts.initialCategory);
        } else {
          // Fresh open: pre-fill the auto-detected sky/wall segments as "Zůstane" so the dialog
          // never opens onto a photo that's wide open by default (see the file header comment).
          seg.skyIds.forEach(function (id) { category[id] = PROTECT; });
        }
        // Per-segment pixel counts, for the cheap live coverage estimate render() uses – scanning
        // the real editableShare() at full photo resolution on every single paint event (instead
        // of only once, at confirm time) would be needlessly slow.
        var segCount = new Float64Array(numSegments + 1), totalPx = seg.W * seg.H;
        for (var si = 0; si < labels.length; si++) segCount[labels[si]]++;

        var origData = seg.preview; // already the working-resolution pixels segmentation itself used
        var COLORS = {}; COLORS[PROTECT] = [47, 174, 74]; COLORS[REMOVE] = [217, 69, 63];
        function render() {
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
          cx.putImageData(new ImageData(out, cv.width, cv.height), 0, 0);
          var editablePx = 0;
          for (var s = 1; s <= numSegments; s++) if (category[s] !== PROTECT) editablePx += segCount[s];
          var coverage = totalPx ? editablePx / totalPx : 0;
          var S = window.MVGreenAISafety, msg = S ? S.validate(coverage) : '';
          share.textContent = 'Upravuje se ' + Math.round(coverage * 100) + ' % fotky' + (msg ? ' – ' + msg : '');
          share.classList.toggle('is-bad', !!msg);
          okBtn.disabled = !!msg;
        }

        // ---- painting: disc-over-segments, validated in the standalone prototype (see the file
        // header) – a touch/drag marks every segment its brush disc overlaps, not just the exact
        // pixels under the cursor, so one stroke covers a whole patch at once while still snapping
        // to the segmentation's real object boundaries. ----
        var currentCat = PROTECT;
        ov.querySelectorAll('[data-cat]').forEach(function (b) {
          b.disabled = false;
          b.addEventListener('click', function () {
            currentCat = parseInt(b.dataset.cat, 10);
            ov.querySelectorAll('[data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          });
        });
        var autoSkyBtn = ov.querySelector('[data-act=autosky]'); autoSkyBtn.disabled = false;
        autoSkyBtn.addEventListener('click', function () {
          seg.skyIds.forEach(function (id) { category[id] = PROTECT; });
          render();
        });
        var undoBtn = ov.querySelector('[data-act=undo]'); undoBtn.disabled = false;
        var undoStack = [], strokeChanges = null, lastPaintPt = null;
        // Fixed brush radius, scaled to the working resolution rather than the prototype's literal
        // "12px" constant (its working image happened to be ~1000px wide too, so this lands on the
        // same real brush size): no size control, matching the approved prototype, which had none.
        var BRUSH_RADIUS = Math.max(8, cv.width / 80);
        function paintDisc(px, py) {
          var r2 = BRUSH_RADIUS * BRUSH_RADIUS;
          var x0 = Math.max(0, Math.floor(px - BRUSH_RADIUS)), x1 = Math.min(cv.width - 1, Math.ceil(px + BRUSH_RADIUS));
          var y0 = Math.max(0, Math.floor(py - BRUSH_RADIUS)), y1 = Math.min(cv.height - 1, Math.ceil(py + BRUSH_RADIUS));
          for (var y = y0; y <= y1; y++) {
            for (var x = x0; x <= x1; x++) {
              var dx = x - px, dy = y - py; if (dx * dx + dy * dy > r2) continue;
              var s = labels[y * cv.width + x];
              if (!strokeChanges.has(s)) strokeChanges.set(s, category[s]);
              category[s] = currentCat;
            }
          }
        }
        function paintAt(pt) {
          if (lastPaintPt) {
            var dist = Math.hypot(pt.x - lastPaintPt.x, pt.y - lastPaintPt.y);
            var steps = Math.max(1, Math.ceil(dist / (BRUSH_RADIUS * 0.6)));
            for (var i = 1; i <= steps; i++) paintDisc(lastPaintPt.x + (pt.x - lastPaintPt.x) * i / steps, lastPaintPt.y + (pt.y - lastPaintPt.y) * i / steps);
          } else paintDisc(pt.x, pt.y);
          lastPaintPt = pt;
          render();
        }
        function finishStroke() {
          if (!strokeChanges) return;
          var changed = false;
          strokeChanges.forEach(function (prevCat, s) { if (category[s] !== prevCat) changed = true; });
          if (changed) { undoStack.push(strokeChanges); if (undoStack.length > 40) undoStack.shift(); }
          strokeChanges = null;
        }
        undoBtn.addEventListener('click', function () {
          var last = undoStack.pop(); if (!last) return;
          last.forEach(function (prevCat, s) { category[s] = prevCat; });
          render();
        });
        function cvPoint(e) {
          var r = cv.getBoundingClientRect();
          var x = Math.max(0, Math.min(cv.width - 1, Math.round((e.clientX - r.left) / r.width * cv.width)));
          var y = Math.max(0, Math.min(cv.height - 1, Math.round((e.clientY - r.top) / r.height * cv.height)));
          return { x: x, y: y };
        }
        var painting = false;
        cv.addEventListener('pointerdown', function (e) {
          maskPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (maskPointers.size >= 2) { painting = false; lastPaintPt = null; maskStartPinch(); return; }
          painting = true; lastPaintPt = null; strokeChanges = new Map();
          try { cv.setPointerCapture(e.pointerId); } catch (er) {}
          paintAt(cvPoint(e));
        });
        cv.addEventListener('pointermove', function (e) {
          if (maskPointers.has(e.pointerId)) maskPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (maskPointers.size >= 2) { maskUpdatePinch(); return; }
          if (painting) paintAt(cvPoint(e));
        });
        ['pointerup', 'pointercancel'].forEach(function (ev) {
          cv.addEventListener(ev, function (e) {
            maskPointers.delete(e.pointerId);
            if (maskPointers.size < 2) maskEndPinch();
            if (maskPointers.size === 0) { painting = false; lastPaintPt = null; finishStroke(); }
          });
        });

        okBtn.addEventListener('click', function () {
          var S = window.MVGreenAISafety;
          var editMask = categoryMask(seg, category, photoW, photoH, function (c) { return c !== PROTECT; });
          var removeMask = categoryMask(seg, category, photoW, photoH, function (c) { return c === REMOVE; });
          if (S && S.smoothMaskEdge) { editMask = S.smoothMaskEdge(editMask); removeMask = S.smoothMaskEdge(removeMask); }
          var hasRemove = false;
          for (var s = 1; s <= numSegments; s++) if (category[s] === REMOVE) { hasRemove = true; break; }
          close({ editMask: editMask, removeMask: removeMask, category: category, hasRemove: hasRemove, previewDataUrl: cv.toDataURL('image/jpeg', 0.85) });
        });

        if (loadingEl) loadingEl.remove();
        okBtn.disabled = false;
        render();
      }).catch(function (err) {
        if (loadingEl) loadingEl.textContent = 'Analýza fotografie se nepovedla: ' + ((err && err.message) || err) + '. Zkuste to prosím znovu nebo obnovte stránku.';
      });
    });
  }

  window.MVGreenPaintMask = { prepareSegmentation: segmentPhoto, confirmPaintMask: confirmPaintMask };
})();
