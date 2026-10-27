/*
 * MVGreen – area-type classification tool, replacing the old freehand "Umístění záhonu, cesty a
 * úklidu" sketch step. Instead of a rough stroke the AI had to interpret loosely, the customer
 * paints a REGULAR grid of small cells, restricted to exactly the editable zone step 4 already
 * confirmed (the "Zůstane" area is locked here too – shown dimmed, not paintable), picking what
 * each part of that zone should actually become: tráva, cesta, opěrná zeď, nebo záhon (which also
 * covers mulch/gravel/paving/hedge etc. within that same spot – material specifics are left to a
 * free-text note per area, not a separate button per material). Each painted type becomes its own
 * precise mask/instruction pair for app.js's existing staged-generation pipeline
 * (buildStagedPlan) – the same mechanism step 4's "Odstranit"
 * and the old bed/path marks already fed, just with a uniform grid standing in for both the old
 * freehand strokes AND step 4's SLIC segments, since a fixed small square is the simplest shape
 * that is both easy to paint accurately and easy to lock to the editable zone pixel-for-pixel.
 *
 * Structurally this reuses mg-paint-mask.js's whole shell (Shadow DOM isolation, true Fullscreen
 * API + orientation lock, minimap, pinch/wheel zoom, brush-disc vs single-cell precision painting,
 * undo) almost verbatim – only the "segmentation" source changes (a plain grid computed locally
 * instead of SLIC via the Worker), and categories are a configurable list instead of a hardcoded
 * protect/remove pair. See mg-paint-mask.js's own header for the rationale behind each shared
 * piece; comments here focus on what's actually different.
 */
(function () {
  'use strict';

  // ai-safety.js's own mask-grow helper (already used to pad step 4's overall "Zůstane" boundary
  // and, since 2026-10-27, step 4's SLIC-segment remove mask too – see mg-paint-mask.js). Reused
  // here for the SAME reason: a customer painting this grid on a phone can never land the cell
  // boundary exactly on an irregular real-world edge (a slanted fence, a round object) – there is
  // always one cell left just short. A small, fixed pixel grow (ai-safety.js's own default, scaled
  // to photo resolution) gives the AI a modest, bounded allowance to finish the shape naturally
  // past the literal painted cells, instead of leaving a sliver of the old photo untouched right at
  // the boundary. It is still hard-bounded: buildStagedPlan always intersects every mask against
  // the customer's own confirmed editable zone before use, so growth can never reach outside what
  // was already approved (the house, the fence, anything marked "Zůstane").
  var S = window.MVGreenAISafety || {};

  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // The 7 types the customer can paint, in toolbar order. Keys match garden-brief.js's
  // buildXStageInstructions functions one-to-one (buildAreaTypeInstructions below picks the right
  // one by this id) so adding an 8th type later is one entry here + one function there, no other
  // wiring. Colors are deliberately all distinct from step 4's own green(protect)/red(remove) so a
  // customer who has both tools open in memory doesn't read this step's tint as "will be removed".
  // Owner's explicit simplification: only 4 buttons. "Záhon" covers planting AND any other material
  // that goes in that same spot (mulch, gravel/kamínky, paving) – the customer types which one they
  // want (or leaves it to AI) as free text once step 6 (per-area description) exists, instead of
  // picking a separate category button per material here.
  var CATEGORIES = [
    { id: 'grass', icon: '🌱', label: 'Tráva', color: [58, 150, 75] },
    { id: 'path', icon: '🟫', label: 'Cesta', color: [181, 129, 80] },
    { id: 'wall', icon: '🧱', label: 'Opěrná zeď', color: [138, 141, 147] },
    { id: 'bed', icon: '🌸', label: 'Záhon', color: [217, 73, 156] }
  ];

  function mkCanvasFrom(photo, w, h) { var c = mkCanvas(w, h); c.getContext('2d').drawImage(photo, 0, 0, w, h); return c; }

  /** Downscales editMask (full photo res) to the grid's own working resolution as a 0/1 Uint8Array. */
  function downscaleLockMap(editMask, photoW, photoH, W, H) {
    var small = mkCanvas(W, H), sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(editMask, 0, 0, photoW, photoH, 0, 0, W, H);
    var d = sctx.getImageData(0, 0, W, H).data;
    var locked = new Uint8Array(W * H);
    for (var i = 0, p = 3; i < W * H; i++, p += 4) locked[i] = d[p] > 127 ? 0 : 1; // 1 = locked (NOT editable)
    return locked;
  }

  /** Builds the regular-grid "segmentation": labels[pixel] = 1-indexed cell id, cols/rows/cellSize included. */
  function buildGrid(W, H, cellSize) {
    var cols = Math.max(1, Math.round(W / cellSize)), rows = Math.max(1, Math.round(H / cellSize));
    var labels = new Int32Array(W * H);
    for (var y = 0; y < H; y++) {
      var ry = Math.min(rows - 1, Math.floor(y * rows / H));
      for (var x = 0; x < W; x++) {
        var rx = Math.min(cols - 1, Math.floor(x * cols / W));
        labels[y * W + x] = ry * cols + rx + 1;
      }
    }
    return { labels: labels, numSegments: cols * rows, cols: cols, rows: rows };
  }

  /** Builds a full-photo-res alpha mask (nearest-neighbor upscaled from the W,H grid) for every
   *  grid cell where predicate(segId) is true. Shared by categoryMask (whole category) and
   *  instanceMask (one connected island within a category, see buildInstances below). */
  function maskFromPredicate(grid, predicate, photoW, photoH, W, H) {
    var work = mkCanvas(W, H), wctx = work.getContext('2d');
    var img = wctx.createImageData(W, H), d = img.data;
    for (var i = 0, p = 0; i < W * H; i++, p += 4) {
      if (predicate(grid.labels[i])) d[p + 3] = 255;
    }
    wctx.putImageData(img, 0, 0);
    var out = mkCanvas(photoW, photoH), octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(work, 0, 0, photoW, photoH);
    octx.globalCompositeOperation = 'source-in'; octx.fillStyle = '#1b9c55'; octx.fillRect(0, 0, photoW, photoH);
    octx.globalCompositeOperation = 'source-over';
    // Give the painted shape a small, fixed allowance to round out past the literal grid cells
    // (see the S = window.MVGreenAISafety comment near the top of this file) instead of staying
    // locked to a blocky, cell-exact outline.
    return S.growMask ? S.growMask(out) : out;
  }

  function categoryMask(grid, category, matchId, photoW, photoH, W, H) {
    return maskFromPredicate(grid, function (segId) { return category[segId] === matchId; }, photoW, photoH, W, H);
  }

  // Groups one category's grid cells into connected "islands" (8-connectivity, so a diagonal
  // real-world edge traced by the fine grid – e.g. a wall meeting a bed at an angle – stays ONE
  // island instead of fragmenting into many 1-cell "instances" at every diagonal step). Each kept
  // island becomes its own addressable, numbered area (e.g. "Záhon 1", "Záhon 2") for step 6: the
  // customer gets one free-text field per island instead of one shared field for the whole
  // category, and app.js's buildStagedPlan later gives each island its own AI generation stage
  // (own mask, own instructions) instead of blending every island's wishes into one blurred prompt
  // over their combined, possibly disjoint, area.
  var MIN_INSTANCE_SHARE = 0.003; // drop stray noise islands well below a customer-meaningful size
  // Each kept island becomes its own sequential OpenAI edit call later (app.js's buildStagedPlan) –
  // real money and real wait time per call – so this bounds worst-case cost/time per generation
  // (4 categories x 2 + step 4's own remove + remainder = 10 stages max) exactly as far as
  // mvgreen-navrh-zahrady.php's matching stage-count cap allows. Extra islands beyond the cap are
  // not dropped outright (that would silently fall back to generic remainder treatment for a
  // customer-marked bed/path/wall/grass area) – they're merged into the category's largest island
  // instead, so they still get correct category-specific AI treatment, just without their own
  // separate numbered field once there are more islands than the cap allows.
  var MAX_INSTANCES_PER_CATEGORY = 2;
  function buildInstances(grid, category, matchId, photoW, photoH, W, H) {
    var cols = grid.cols, rows = grid.rows;
    var visited = new Uint8Array(cols * rows);
    var raw = [];
    for (var ry = 0; ry < rows; ry++) {
      for (var rx = 0; rx < cols; rx++) {
        var ci = ry * cols + rx;
        if (visited[ci]) continue;
        if (category[ci + 1] !== matchId) { visited[ci] = 1; continue; }
        var queue = [ci], cellIds = [], sumRx = 0, sumRy = 0;
        visited[ci] = 1;
        while (queue.length) {
          var cur = queue.pop();
          var crx = cur % cols, cry = (cur / cols) | 0;
          cellIds.push(cur + 1);
          sumRx += crx; sumRy += cry;
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            var nrx = crx + dx, nry = cry + dy;
            if (nrx < 0 || nrx >= cols || nry < 0 || nry >= rows) continue;
            var nci = nry * cols + nrx;
            if (visited[nci] || category[nci + 1] !== matchId) continue;
            visited[nci] = 1;
            queue.push(nci);
          }
        }
        raw.push({ cellIds: cellIds, cx: sumRx / cellIds.length, cy: sumRy / cellIds.length, cellCount: cellIds.length });
      }
    }
    var totalCells = cols * rows;
    var significant = raw.filter(function (inst) { return (inst.cellCount / totalCells) >= MIN_INSTANCE_SHARE; });
    significant.sort(function (a, b) { return b.cellCount - a.cellCount; }); // largest first
    var kept = significant.slice(0, MAX_INSTANCES_PER_CATEGORY);
    var overflow = significant.slice(MAX_INSTANCES_PER_CATEGORY);
    if (overflow.length && kept.length) {
      var target = kept[0];
      overflow.forEach(function (inst) {
        target.cellIds = target.cellIds.concat(inst.cellIds);
        target.cellCount += inst.cellCount;
      });
    }
    // Reading order: top row first, left-to-right within a row – predictable and matches how a
    // customer visually scans the numbered photo.
    kept.sort(function (a, b) { return (a.cy - b.cy) || (a.cx - b.cx); });
    return kept.map(function (inst, i) {
      var cellSet = {};
      inst.cellIds.forEach(function (id) { cellSet[id] = true; });
      var mask = maskFromPredicate(grid, function (segId) { return !!cellSet[segId]; }, photoW, photoH, W, H);
      return {
        index: i + 1,
        cellCount: inst.cellCount,
        mask: mask,
        // Grid-cell centroid -> W,H pixel center -> full photo pixel coords, for the numbered label.
        photoX: Math.round((inst.cx + 0.5) * (W / cols) * (photoW / W)),
        photoY: Math.round((inst.cy + 0.5) * (H / rows) * (photoH / H))
      };
    });
  }

  var TEMPLATE_HEAD = ''
    + '<style>'
    + ':host{--bg:#f3f6f3;--panel:#ffffff;--ink:#1c2a20;--muted:#5a6d5e;--line:#d7e3d9;--accent:#156333;--accent-soft:#e8f1e9;color-scheme:light;all:initial;}'
    + '@media (prefers-color-scheme: dark){:host(:not([data-theme="light"])){--bg:#13201a;--panel:#182820;--ink:#eaf2ec;--muted:#9fb3a5;--line:#2a3d33;--accent:#4fd184;--accent-soft:#1f3a2a;color-scheme:dark;}}'
    + ':host([data-theme="dark"]){--bg:#13201a;--panel:#182820;--ink:#eaf2ec;--muted:#9fb3a5;--line:#2a3d33;--accent:#4fd184;--accent-soft:#1f3a2a;color-scheme:dark;}'
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
    + 'button.primary{background:var(--accent);color:#fff;}'
    + 'button.toggle-active{outline:2px solid var(--accent);outline-offset:-2px;}'
    + '.zoomrow{flex:0 0 auto;display:flex;gap:6px;padding:6px 0;}'
    + '.stage-wrap{position:relative;flex:1 1 auto;min-height:0;margin-bottom:8px;display:flex;}'
    + '.stage-viewport{flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:12px;background:#111;touch-action:none;}'
    + '.stage{position:relative;width:100%;margin:0 auto;}'
    + 'canvas{display:block;width:100%;height:auto;touch-action:none;}'
    + '#minimap{position:absolute;right:10px;bottom:10px;width:104px;height:auto;border:2px solid rgba(255,255,255,0.85);border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,0.4);touch-action:none;cursor:pointer;}'
    + '.legend{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--muted);padding-bottom:6px;}'
    + '.legend span{display:inline-flex;align-items:center;gap:5px;}'
    + '.sw{width:11px;height:11px;border-radius:3px;display:inline-block;}'
    + '.hintbox{flex:0 0 auto;margin:0 0 6px;padding:8px 12px;border-radius:10px;background:#fff7e0;color:#5a4300;font-size:13px;}'
    + '#status{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:12px;color:var(--muted);padding:4px 0;}'
    + '#status .statstext{flex:1 1 auto;min-width:160px;}'
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
    + '<div class="headerbar"><h1>Co kam patří?</h1><button id="info-toggle" class="info-btn" aria-label="Nápověda">ⓘ</button></div>'
    + '<div class="info-panel" id="info-panel" hidden>'
    + '<p class="note">Zešedlá plocha je to, co jste v předchozím kroku označili jako „Zůstane“ – tu tady měnit nejde. V barevné ploše malujte políčka podle toho, co tam má vzniknout. Co nevymalujete, necháte na AI podle vašeho zadání. 1 prst maluje/klepe, 2 prsty posouvají a přibližují.</p>'
    + '<div class="legend" id="legend"></div></div>'
    + '<p class="hintbox" id="hintbox" hidden></p>'
    + '<div class="toolbar" id="toolbar-cats"></div>'
    + '<div class="toolbar">'
    + '<button id="tool-erase" disabled>⬜ Smazat (maluj)</button>'
    + '<button id="tool-precision" disabled title="Maluje jen jedno políčko pod kurzorem místo celého štětce – pro přesné hranice.">🔲 Přesně (políčko)</button>'
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
    + '<div class="confirmrow"><button id="act-cancel">Zpět</button><button id="act-ok" class="primary">Potvrdit</button></div>'
    + '</div>'
    + '</div>';

  function rgbCss(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  function confirmAreaTypes(photo, editMask, hint, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var photoW = photo.width || photo.naturalWidth, photoH = photo.height || photo.naturalHeight;
      if (!photo || !photoW || !photoH || !editMask) {
        alert('Fotografii se nepodařilo načíst. Zkuste prosím fotografii nahrát znovu.');
        resolve(null);
        return;
      }
      var hostEl = document.createElement('div');
      hostEl.style.position = 'fixed'; hostEl.style.inset = '0'; hostEl.style.zIndex = '2147483647';
      document.body.appendChild(hostEl);
      var root = hostEl.attachShadow({ mode: 'open' });

      var toolbarCatsHtml = CATEGORIES.map(function (c) {
        return '<button type="button" data-cat="' + c.id + '" disabled>' + c.icon + ' ' + c.label + '</button>';
      }).join('');
      var legendHtml = CATEGORIES.map(function (c) {
        return '<span><span class="sw" style="background:' + rgbCss(c.color) + '"></span>' + c.label + '</span>';
      }).join('') + '<span><span class="sw" style="background:#9099a0"></span>Zůstane (zamčeno)</span>';

      root.innerHTML = TEMPLATE_HEAD;
      root.getElementById('toolbar-cats').innerHTML = toolbarCatsHtml;
      root.getElementById('legend').innerHTML = legendHtml;

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

      // Same fix as mg-paint-mask.js's MAX_DIM (see its comment): raised from 1000 so the photo and
      // the grid don't visibly blur/block on a high-res photo viewed on a normal/large screen.
      var MAX_DIM = 1400;
      var scale = Math.min(1, MAX_DIM / Math.max(photoW, photoH));
      var W = Math.max(1, Math.round(photoW * scale)), H = Math.max(1, Math.round(photoH * scale));
      canvas.width = W; canvas.height = H;

      var origCanvas = mkCanvasFrom(photo, W, H);
      var origData = origCanvas.getContext('2d').getImageData(0, 0, W, H);
      var lockMap = downscaleLockMap(editMask, photoW, photoH, W, H);
      // Owner-reported bug: with a coarse grid, a cell straddling a real edge (e.g. a retaining
      // wall meeting a flower bed) can only be assigned ENTIRELY to one category, so the resulting
      // mask boundary overshoots past the true edge by up to half a cell's width – visible as the
      // "stays unchanged" area eating into the bed he wants changed, or vice versa. Shrinking the
      // divisor from 45 to 100 roughly halves each cell's side length (quarters its area), so in
      // precision mode (single-cell clicks) the boundary can be traced much closer to the real
      // edge. BRUSH_RADIUS below is unaffected (it's bounded by W/60, not cellSize), so normal
      // broad-area brush painting stays just as fast – only the finest achievable precision changes.
      var cellSize = Math.max(10, Math.round(W / 100));
      var grid = buildGrid(W, H, cellSize);

      var category = new Uint8Array(grid.numSegments + 1); // 0 = unspecified, else index+1 into CATEGORIES
      if (opts.initialCategory && opts.initialCategory.length === category.length) category.set(opts.initialCategory);

      // Counts only the EDITABLE pixels of each cell, not its full footprint – a cell straddling
      // the locked/editable boundary has part of its area permanently excluded, and including that
      // locked sliver here made the status percentages sum to well over 100% (the "Neurčeno" share
      // was counting every fully-locked cell's whole area too, not just unlocked-but-unpainted
      // ones). segCount[s] summed over all s now equals exactly editablePx, as it should.
      var segCount = new Float64Array(grid.numSegments + 1), editablePx = 0;
      for (var si = 0; si < grid.labels.length; si++) {
        if (!lockMap[si]) { segCount[grid.labels[si]]++; editablePx++; }
      }

      var COLORS = {}; CATEGORIES.forEach(function (c, i) { COLORS[i + 1] = c.color; });

      function repaint() {
        var out = new Uint8ClampedArray(origData.data);
        for (var i = 0, p = 0; i < grid.labels.length; i++, p += 4) {
          if (lockMap[i]) { out[p] *= 0.55; out[p + 1] *= 0.55; out[p + 2] *= 0.55; continue; }
          var cat = category[grid.labels[i]];
          if (cat) {
            var c = COLORS[cat];
            out[p] = out[p] * 0.42 + c[0] * 0.58;
            out[p + 1] = out[p + 1] * 0.42 + c[1] * 0.58;
            out[p + 2] = out[p + 2] * 0.42 + c[2] * 0.58;
          } else {
            // Light grid lines in the editable, still-unspecified zone so cell boundaries stay
            // visible without needing a separate toggle (a uniform grid is cheap to show always,
            // unlike SLIC's organic segment edges in step 4's own tool).
            var x = i % W, y = (i / W) | 0;
            if ((x % cellSize) === 0 || (y % cellSize) === 0) { out[p] *= 0.85; out[p + 1] *= 0.85; out[p + 2] *= 0.85; }
          }
        }
        ctx.putImageData(new ImageData(out, W, H), 0, 0);
        updateStatus();
        updateMinimap();
      }

      function updateStatus() {
        var counts = {}; CATEGORIES.forEach(function (c) { counts[c.id] = 0; });
        var unspecifiedPx = 0;
        for (var s = 1; s <= grid.numSegments; s++) {
          var cat = category[s];
          if (cat) counts[CATEGORIES[cat - 1].id] += segCount[s];
          else unspecifiedPx += segCount[s];
        }
        var parts = CATEGORIES.filter(function (c) { return counts[c.id] > 0; })
          .map(function (c) { return c.icon + ' ' + Math.round(counts[c.id] / (editablePx || 1) * 100) + ' %'; });
        parts.push('Neurčeno: ' + Math.round(unspecifiedPx / (editablePx || 1) * 100) + ' %');
        statusEl.textContent = parts.join('  ·  ');
      }

      // ---- minimap (verbatim pattern from mg-paint-mask.js) ----
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

      // ---- tool selection ----
      var currentTool = CATEGORIES[0].id; // category buttons double as the tool list; 'erase' is separate
      var catButtons = {};
      root.querySelectorAll('[data-cat]').forEach(function (b) {
        catButtons[b.dataset.cat] = b;
        b.addEventListener('click', function () { setTool(b.dataset.cat); });
      });
      var eraseBtn = root.getElementById('tool-erase');
      eraseBtn.addEventListener('click', function () { setTool('erase'); });
      function setTool(t) {
        currentTool = t;
        Object.keys(catButtons).forEach(function (id) { catButtons[id].classList.toggle('toggle-active', id === t); });
        eraseBtn.classList.toggle('toggle-active', t === 'erase');
      }
      setTool(CATEGORIES[0].id);
      root.getElementById('clear-all').addEventListener('click', function () { category.fill(0); repaint(); });

      // ---- precision toggle (brush disc vs single cell) ----
      var precisionMode = false;
      var precisionBtn = root.getElementById('tool-precision');
      precisionBtn.addEventListener('click', function () {
        precisionMode = !precisionMode;
        precisionBtn.classList.toggle('toggle-active', precisionMode);
      });

      // ---- zoom / pinch / fullscreen chrome (verbatim pattern from mg-paint-mask.js) ----
      var zoom = 1; var ZOOM_MAX = 3;
      function isLandscape() { return window.innerWidth > window.innerHeight; }
      function isFullscreen() { return document.fullscreenElement === hostEl || document.webkitFullscreenElement === hostEl; }
      function baseStageWidth() {
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
        }).catch(function () {});
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
            try { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) {}
          } else { enterFullscreen(); }
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
      var BRUSH_RADIUS = Math.max(cellSize, Math.round(W / 60));
      var brushOffsets = (function () {
        var offs = [], r2 = BRUSH_RADIUS * BRUSH_RADIUS;
        for (var dy = -BRUSH_RADIUS; dy <= BRUSH_RADIUS; dy++)
          for (var dx = -BRUSH_RADIUS; dx <= BRUSH_RADIUS; dx++)
            if (dx * dx + dy * dy <= r2) offs.push([dx, dy]);
        return offs;
      })();

      var undoStack = [], strokeChanges = null, lastPaintPt = null;
      var strokeForceErase = false;
      function targetValue() {
        if (strokeForceErase || currentTool === 'erase') return 0;
        var idx = CATEGORIES.findIndex(function (c) { return c.id === currentTool; });
        return idx >= 0 ? idx + 1 : 0;
      }
      function paintDisc(cx, cy) {
        var target = targetValue();
        if (precisionMode) {
          if (cx < 0 || cx >= W || cy < 0 || cy >= H || lockMap[cy * W + cx]) return;
          var only = grid.labels[cy * W + cx];
          if (!strokeChanges.has(only)) strokeChanges.set(only, category[only]);
          category[only] = target;
          return;
        }
        for (var k = 0; k < brushOffsets.length; k++) {
          var x = cx + brushOffsets[k][0], y = cy + brushOffsets[k][1];
          if (x < 0 || x >= W || y < 0 || y >= H || lockMap[y * W + x]) continue;
          var seg = grid.labels[y * W + x];
          if (!strokeChanges.has(seg)) strokeChanges.set(seg, category[seg]);
          category[seg] = target;
        }
      }
      function paintAt(pt) {
        if (lastPaintPt) {
          var dist = Math.hypot(pt.x - lastPaintPt.x, pt.y - lastPaintPt.y);
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

      root.getElementById('act-ok').addEventListener('click', function () {
        var masksByCategory = {}, instancesByCategory = {}, hasAny = false;
        CATEGORIES.forEach(function (c, idx) {
          var matchId = idx + 1;
          var m = categoryMask(grid, category, matchId, photoW, photoH, W, H);
          var hasPixels = false;
          var d = m.getContext('2d').getImageData(0, 0, m.width, m.height).data;
          for (var i = 3; i < d.length; i += 400) if (d[i] > 127) { hasPixels = true; break; }
          if (hasPixels) { masksByCategory[c.id] = m; hasAny = true; } else masksByCategory[c.id] = null;
          // Step 6 (app.js) needs each distinct painted island addressable on its own – see
          // buildInstances' header comment. Computed for every category (grass included, per the
          // owner's follow-up request to offer a sun/irrigation choice per lawn island too).
          instancesByCategory[c.id] = hasPixels ? buildInstances(grid, category, matchId, photoW, photoH, W, H) : [];
        });
        window.removeEventListener('resize', onResize);
        close({ masksByCategory: masksByCategory, instancesByCategory: instancesByCategory, category: category, hasAny: hasAny });
      });

      root.querySelectorAll('[data-cat],#tool-erase,#tool-precision,#undo-btn,#clear-all').forEach(function (b) { b.disabled = false; });
      applyZoom();
      centerView();
      repaint();
    });
  }

  window.MVGreenAreaTypes = { confirmAreaTypes: confirmAreaTypes, CATEGORIES: CATEGORIES };
})();
