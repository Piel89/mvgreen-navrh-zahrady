/*
 * MVGreen – pravidla bezpečné AI úpravy fotografie.
 *
 * 1) Fotka se nikdy neořezává ani nedeformuje: doplní se okraji na poměr stran, se kterým AI pracuje,
 *    a po úpravě se okraje zase odříznou.
 * 2) AI smí měnit jen odemčenou masku (zahradu). Okraje, dům, plot, obloha atd. zůstávají zamčené.
 * 3) Po návratu se mimo masku vždy vrátí původní pixely (tvrdý zámek).
 * 4) Kontrola posunu scény: když AI změní zamčené části víc, než je přípustné, výsledek se odmítne.
 * 5) Automatický návrh masky: zelené plochy spojené se zemí pod linií horizontu, zákazník je může upravit štětcem.
 */
(function () {
  'use strict';

  var SIZES = [[1536, 1024], [1024, 1536], [1024, 1024]];
  var MAX_EDITABLE = 0.7;   // nikdy neodemknout víc než 70 % fotky
  var MIN_EDITABLE = 0.02;  // a aspoň 2 %
  var MAX_DRIFT = 22;       // průměrná odchylka (0–255) v zamčených částech, nad níž je výsledek nepoužitelný

  function pickSize(w, h) {
    var r = w / h;
    var best = SIZES[0], bestDiff = Infinity;
    SIZES.forEach(function (s) {
      var d = Math.abs(Math.log((s[0] / s[1]) / r));
      if (d < bestDiff) { bestDiff = d; best = s; }
    });
    return best;
  }

  /** Letterbox: places the photo into an API-sized canvas without cropping. Returns geometry to undo it. */
  function fitBox(w, h) {
    var size = pickSize(w, h);
    var scale = Math.min(size[0] / w, size[1] / h);
    var dw = Math.round(w * scale), dh = Math.round(h * scale);
    return { W: size[0], H: size[1], x: Math.floor((size[0] - dw) / 2), y: Math.floor((size[1] - dh) / 2), w: dw, h: dh };
  }

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /**
   * editMask: canvas same size as the photo; alpha>0 (any opaque paint) = EDITABLE area.
   * Returns { image, mask, box, coverage } with PNG data URLs ready for the API.
   * API mask convention: transparent = editable, opaque = protected.
   */
  /**
   * Scales an arbitrary "paint = editable" mask into a given API letterbox box and punches it out
   * (destination-out → transparent = editable), exactly like prepare() does for the customer's own
   * confirmed mask. Factored out so the staged-generation pipeline (app.js's buildStagedPlan) can
   * convert each of its own stage masks into the SAME box prepare() already computed for the photo –
   * every stage of one request must share one letterbox placement, since they all edit the same photo.
   */
  function maskToApiCanvas(mask, box) {
    var m = canvas(box.W, box.H), mc = m.getContext('2d');
    mc.fillStyle = '#fff'; mc.fillRect(0, 0, box.W, box.H);
    var scaled = canvas(box.W, box.H), sc = scaled.getContext('2d');
    sc.drawImage(mask, box.x, box.y, box.w, box.h);
    mc.globalCompositeOperation = 'destination-out';
    mc.drawImage(scaled, 0, 0);
    mc.globalCompositeOperation = 'source-over';
    return m;
  }
  function maskToApi(mask, box) { return maskToApiCanvas(mask, box).toDataURL('image/png'); }

  function prepare(photo, editMask) {
    var w = photo.width, h = photo.height, box = fitBox(w, h);
    var img = canvas(box.W, box.H), ic = img.getContext('2d');
    // Neutral edge fill keeps padding from looking like content.
    ic.fillStyle = '#7f8a80'; ic.fillRect(0, 0, box.W, box.H);
    ic.drawImage(photo, box.x, box.y, box.w, box.h);

    var m = maskToApiCanvas(editMask, box);
    var coverage = editableShare(editMask);
    // JPEG for the photo (no alpha needed; PNG of a photographic image can be 5x+ larger and was
    // tripping the server's upload size limit with a 413). Mask stays PNG: it needs the alpha channel.
    return { image: img.toDataURL('image/jpeg', 0.92), mask: m.toDataURL('image/png'), box: box, coverage: coverage };
  }

  function editableShare(editMask) {
    var d = editMask.getContext('2d').getImageData(0, 0, editMask.width, editMask.height).data, n = 0, t = 0;
    for (var i = 3; i < d.length; i += 16) { t++; if (d[i] > 127) n++; }
    return t ? n / t : 0;
  }

  function validate(coverage) {
    if (coverage < MIN_EDITABLE) return 'Označte prosím na fotografii plochu zahrady, kterou chcete upravit.';
    if (coverage > MAX_EDITABLE) return 'Upravovaná plocha je příliš velká. Ponechte dům, plot, stromy a oblohu mimo označení.';
    return '';
  }

  /** Crops the AI image back to the photo, checks drift in protected parts, and hard-locks them. */
  function finish(photo, editMask, aiImage, box) {
    var w = photo.width, h = photo.height;
    var back = canvas(w, h), bc = back.getContext('2d');
    // Raw AI pixels (may contain transparency outside the mask).
    var raw = canvas(w, h), rc = raw.getContext('2d');
    rc.drawImage(aiImage, box.x * aiImage.width / box.W, box.y * aiImage.height / box.H,
      box.w * aiImage.width / box.W, box.h * aiImage.height / box.H, 0, 0, w, h);
    // Composite over the original so transparent AI pixels keep the real photo.
    bc.drawImage(photo, 0, 0);
    bc.drawImage(raw, 0, 0);

    var o = photo.getContext('2d').getImageData(0, 0, w, h).data;
    var rd = rc.getImageData(0, 0, w, h).data;
    var a = bc.getImageData(0, 0, w, h);
    var ad = a.data;
    var md = editMask.getContext('2d').getImageData(0, 0, w, h).data;
    // Guard band: ignore a few px around the mask edge (resampling blurs the boundary).
    var guard = canvas(w, h), gc = guard.getContext('2d');
    gc.filter = 'blur(' + Math.max(4, Math.round(w / 300)) + 'px)'; gc.drawImage(editMask, 0, 0); gc.filter = 'none';
    var gd = gc.getImageData(0, 0, w, h).data;
    var sum = 0, cnt = 0, insideOpaque = 0, insideCnt = 0;
    for (var i = 0; i < ad.length; i += 4) {
      if ((i >> 2) % 7 !== 0) continue;
      if (md[i + 3] > 127) { insideCnt++; if (rd[i + 3] > 127) insideOpaque++; continue; }
      if (gd[i + 3] > 8) continue;
      if (rd[i + 3] < 128) continue; // transparent = AI left it alone
      sum += (Math.abs(rd[i] - o[i]) + Math.abs(rd[i + 1] - o[i + 1]) + Math.abs(rd[i + 2] - o[i + 2])) / 3;
      cnt++;
    }
    var drift = cnt ? sum / cnt : 0;
    // AI returned nothing usable inside the garden area.
    var emptyInside = insideCnt > 0 && insideOpaque / insideCnt < 0.5;

    // Soft 6 px feather on the mask edge, then original pixels everywhere outside it.
    var feather = canvas(w, h), fc = feather.getContext('2d');
    fc.filter = 'blur(' + Math.max(4, Math.round(w / 150)) + 'px)'; fc.drawImage(editMask, 0, 0); fc.filter = 'none';
    var fd = fc.getImageData(0, 0, w, h).data;
    for (var j = 0; j < ad.length; j += 4) {
      // Inward feather: 0 exactly at the mask edge (no AI pixels leak out), 1 inside → soft seam.
      var k = Math.max(0, (fd[j + 3] - 128) / 127); k = k * k * (3 - 2 * k);
      ad[j] = Math.round(ad[j] * k + o[j] * (1 - k));
      ad[j + 1] = Math.round(ad[j + 1] * k + o[j + 1] * (1 - k));
      ad[j + 2] = Math.round(ad[j + 2] * k + o[j + 2] * (1 - k));
      ad[j + 3] = 255;
    }
    bc.putImageData(a, 0, 0);
    return { canvas: back, raw: raw, drift: drift, emptyInside: emptyInside, ok: drift <= MAX_DRIFT && !emptyInside };
  }

  /**
   * Automatic garden mask: greens and browns below a horizon line, cleaned up.
   * horizon: 0–1 share of height from the top; everything above it stays protected.
   */
  function autoMask(photo, horizon) {
    var w = photo.width, h = photo.height;
    var m = canvas(w, h), mc = m.getContext('2d');
    var src = photo.getContext('2d').getImageData(0, 0, w, h).data;
    var out = mc.createImageData(w, h), od = out.data;
    var top = Math.round(h * horizon);
    // Soft horizon: above the line only smooth (lawn-like, low texture) greens may continue, so a lawn
    // reaching further back is not cut by a straight line while tree foliage (rough texture) stays out.
    var ext = Math.max(0, top - Math.round(h * 0.2)), st = Math.max(2, Math.round(w / 500));
    for (var y = ext; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4, r = src[i], g = src[i + 1], b = src[i + 2];
        var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, s = max - min;
        var green = g >= r && g > b + 8 && s > 18 && l > 30 && l < 220;
        if (green && y < top) {
          var x2 = Math.min(w - 1, x + st), y2 = Math.min(h - 1, y + st), x0 = Math.max(0, x - st), y0 = Math.max(0, y - st);
          var gA = src[(y * w + x2) * 4 + 1], gB = src[(y2 * w + x) * 4 + 1], gC = src[(y * w + x0) * 4 + 1], gD = src[(y0 * w + x) * 4 + 1];
          var rough = Math.abs(gA - g) + Math.abs(gB - g) + Math.abs(gC - g) + Math.abs(gD - g);
          green = rough < 34 && l > 70;
        }
        // Soil colours match brick facades in dull light, so only vegetation is pre-selected; the customer
        // adds bare soil, gravel or mulch with the brush.
        if (green) od[i + 3] = 255;
      }
    }
    mc.putImageData(out, 0, 0);
    // Smooth holes and specks: blur + threshold twice.
    for (var pass = 0; pass < 2; pass++) {
      var t = canvas(w, h), tc = t.getContext('2d');
      tc.filter = 'blur(' + Math.max(2, Math.round(w / 220)) + 'px)'; tc.drawImage(m, 0, 0); tc.filter = 'none';
      var td = tc.getImageData(0, 0, w, h);
      for (var k = 3; k < td.data.length; k += 4) td.data[k] = td.data[k] > (pass ? 110 : 140) ? 255 : 0;
      mc.clearRect(0, 0, w, h); mc.putImageData(td, 0, 0);
    }
    // Keep only regions connected to the bottom edge (the ground the photographer stands on).
    keepGrounded(mc, w, h);
    // Fill holes (bald patches, shadows) inside the lawn so no old patches stay in the new garden.
    fillHoles(mc, w, h, top);
    // Smooth the outline into calm curves – a ragged edge looks like a cut-out.
    var sm = canvas(w, h), smc = sm.getContext('2d');
    smc.filter = 'blur(' + Math.max(3, Math.round(w / 110)) + 'px)'; smc.drawImage(m, 0, 0); smc.filter = 'none';
    var sd = smc.getImageData(0, 0, w, h);
    for (var z = 3; z < sd.data.length; z += 4) sd.data[z] = sd.data[z] > 128 ? 255 : 0;
    mc.clearRect(0, 0, w, h); mc.putImageData(sd, 0, 0);
    keepGrounded(mc, w, h);
    // Paint colour is irrelevant; only alpha counts.
    mc.globalCompositeOperation = 'source-in'; mc.fillStyle = '#1b9c55'; mc.fillRect(0, 0, w, h);
    mc.globalCompositeOperation = 'source-over';
    return m;
  }

  function keepGrounded(mc, w, h) {
    var img = mc.getImageData(0, 0, w, h), d = img.data, seen = new Uint8Array(w * h), stack = [];
    for (var x = 0; x < w; x++) {
      for (var y = h - 1; y >= h - 3; y--) { var i = y * w + x; if (d[i * 4 + 3] > 127 && !seen[i]) { seen[i] = 1; stack.push(i); } }
    }
    while (stack.length) {
      var p = stack.pop(), px = p % w, py = (p / w) | 0;
      var nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1];
      for (var k = 0; k < 4; k++) { var q = nb[k]; if (q >= 0 && !seen[q] && d[q * 4 + 3] > 127) { seen[q] = 1; stack.push(q); } }
    }
    for (var j = 0; j < w * h; j++) if (!seen[j]) d[j * 4 + 3] = 0;
    mc.putImageData(img, 0, 0);
  }

  /** Non-mask regions that cannot be reached from the sky (top edge / sides above the horizon) are holes. */
  function fillHoles(mc, w, h, top) {
    var img = mc.getImageData(0, 0, w, h), d = img.data, seen = new Uint8Array(w * h), stack = [];
    function seed(i) { if (!seen[i] && d[i * 4 + 3] <= 127) { seen[i] = 1; stack.push(i); } }
    for (var x = 0; x < w; x++) seed(x);
    for (var y = 0; y < Math.min(h, top + Math.round(h * 0.15)); y++) { seed(y * w); seed(y * w + w - 1); }
    while (stack.length) {
      var p = stack.pop(), px = p % w, py = (p / w) | 0;
      if (px > 0) seed(p - 1); if (px < w - 1) seed(p + 1); if (py > 0) seed(p - w); if (py < h - 1) seed(p + w);
    }
    for (var j = 0; j < w * h; j++) if (!seen[j]) d[j * 4 + 3] = 255;
    mc.putImageData(img, 0, 0);
  }

  /** Mask from polygons: change/remove areas editable, keep areas protected on top. */
  function polygonMask(w, h, editAreas, keepAreas) {
    var m = canvas(w, h), mc = m.getContext('2d');
    function path(a) { mc.beginPath(); mc.moveTo(a.points[0].x, a.points[0].y); a.points.slice(1).forEach(function (p) { mc.lineTo(p.x, p.y); }); mc.closePath(); }
    mc.fillStyle = '#1b9c55'; mc.strokeStyle = '#1b9c55'; mc.lineJoin = 'round';
    // A hand-traced polygon rarely lines up pixel-perfect with its neighbour (a bed drawn right
    // next to a lawn area, say), leaving a sliver that belongs to neither shape. Anything not
    // explicitly covered stays protected and gets hard-locked back to the original photo, so an
    // unintended sliver shows up as an untouched strip of old ground between two new areas.
    // Stroking each edit polygon's own outline with a small margin closes that sliver without
    // bleeding meaningfully past it; a "keep" polygon cut out right after still keeps its own
    // exact edge, since destination-out trims the margin wherever it overlaps one.
    mc.lineWidth = Math.max(4, w / 220);
    editAreas.forEach(function (a) { if (a.points && a.points.length >= 3) { path(a); mc.fill(); mc.stroke(); } });
    mc.globalCompositeOperation = 'destination-out';
    (keepAreas || []).forEach(function (a) { if (a.points && a.points.length >= 3) { path(a); mc.fill(); } });
    mc.globalCompositeOperation = 'source-over';
    return m;
  }

  /**
   * Grows (dilates) a mask outward by a small margin so a hand-painted stroke that falls a few
   * pixels short of a corner or an adjoining edge doesn't leave that sliver protected by accident.
   * Without this, anything the customer didn't quite reach with the brush stays hard-locked to the
   * original photo after generation – a raw, untouched patch inside an otherwise new-looking area,
   * which reads as unfinished rather than a deliberate edge. The grown mask is reused for BOTH the
   * request sent to the AI and the hard-lock check on the result, so the extra margin the AI is
   * allowed to touch is exactly the margin we accept back – growing it in only one place would let
   * the AI paint there while our own lock-back then erased it again.
   */
  function growMask(mask, px) {
    if (px == null) px = Math.max(4, Math.round(mask.width / 160));
    if (!px) return mask;
    var w = mask.width, h = mask.height, out = canvas(w, h), oc = out.getContext('2d');
    var steps = 8;
    for (var i = 0; i < steps; i++) {
      var ang = (Math.PI * 2 * i) / steps;
      oc.drawImage(mask, Math.round(Math.cos(ang) * px), Math.round(Math.sin(ang) * px));
    }
    oc.drawImage(mask, 0, 0);
    oc.globalCompositeOperation = 'source-in'; oc.fillStyle = '#1b9c55'; oc.fillRect(0, 0, w, h);
    oc.globalCompositeOperation = 'source-over';
    return out;
  }

  /**
   * Rounds a mask's edge into calmer curves (blur+threshold) right before it's confirmed – the
   * same idea as autoMask's own outline-smoothing step, but safe to run on ANY mask: it only
   * rounds the boundary, never fills holes or drops a region not touching the bottom edge (which
   * would be wrong here – a hand-painted mask can legitimately have several separate islands,
   * unlike autoMask's single ground-connected guess).
   */
  function smoothMaskEdge(mask) {
    var w = mask.width, h = mask.height;
    var sm = canvas(w, h), smc = sm.getContext('2d');
    smc.filter = 'blur(' + Math.max(3, Math.round(w / 180)) + 'px)'; smc.drawImage(mask, 0, 0); smc.filter = 'none';
    var sd = smc.getImageData(0, 0, w, h);
    for (var z = 3; z < sd.data.length; z += 4) sd.data[z] = sd.data[z] > 128 ? 255 : 0;
    var out = canvas(w, h), oc = out.getContext('2d');
    oc.putImageData(sd, 0, 0);
    oc.globalCompositeOperation = 'source-in'; oc.fillStyle = '#1b9c55'; oc.fillRect(0, 0, w, h);
    oc.globalCompositeOperation = 'source-over';
    return out;
  }

  /**
   * Full-screen confirmation of the editable area. Resolves with the final mask canvas or null.
   * opts.blank starts from nothing (manual mode: the customer paints what to change from scratch)
   * instead of the automatic horizon-based guess; the brush then defaults to "add" so the first
   * touch already paints.
   * opts.initialMask re-opens the brush loaded with an already-confirmed mask (adjust mode: the
   * customer adds to or removes from what they marked before, instead of starting over); like
   * blank mode it shows the brush-size control, but leaves no brush pre-selected so the first touch
   * can't accidentally erase or extend before the customer picks +/−.
   *
   * In every mode a "Hranice zahrady" line now also acts as a hard lock boundary: while the lock
   * checkbox is on (default), nothing above the line can be painted editable, however sloppily the
   * brush stroke overshoots – the customer never has to carefully trace around a fence or house
   * wall, they just paint over the object they want changed and anything above the line is
   * automatically excluded. Unchecking the lock allows painting anywhere, for the rarer case where
   * the customer genuinely does want to change something above the line (a shed, part of the house).
   */
  function confirmMask(photo, initialHorizon, hint, opts) {
    return new Promise(function (resolve) {
      // Without this guard, a photo/canvas that somehow ended up with zero width or height
      // (seen on a phone: the brush dialog opened with its tools and "Upravuje se 0 % fotky"
      // warning but no photo at all – canvas.width/height of 0 is still a "valid" HTMLCanvasElement,
      // draws nothing, and reports 0% editable area without ever throwing) would otherwise open a
      // dialog with a permanently blank canvas instead of failing clearly and recoverably.
      if (!photo || !photo.width || !photo.height) {
        alert('Fotografii se nepodařilo načíst pro vyznačení plochy. Zkuste prosím fotografii nahrát znovu.');
        resolve(null);
        return;
      }
      var blank = !!(opts && opts.blank);
      var initial = opts && opts.initialMask;
      var horizon = initialHorizon == null ? 0.42 : initialHorizon;
      var mask;
      if (initial) { mask = canvas(photo.width, photo.height); mask.getContext('2d').drawImage(initial, 0, 0); }
      else mask = blank ? canvas(photo.width, photo.height) : autoMask(photo, horizon);
      var freehand = blank || !!initial;
      var locked = true;
      var ov = document.createElement('div');
      ov.className = 'mg-mask-overlay';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Potvrzení upravované plochy');
      ov.innerHTML =
        '<div class="mg-mask-box">' +
        '<div class="mg-mask-head"><strong>Které části zahrady se smí změnit?</strong>' +
        '<span>Zeleně zvýrazněnou plochu AI upraví. Dům, plot, stromy a obloha zůstanou přesně jako na vaší fotce.</span>' +
        (hint ? '<span class="mg-mask-hint">💡 ' + String(hint).replace(/[<>&]/g, '') + '</span>' : '') + '</div>' +
        '<div class="mg-mask-stage"><canvas></canvas></div>' +
        '<div class="mg-mask-tools">' +
        '<label class="mg-mask-horizon">Hranice zahrady<input type="range" min="10" max="85" step="1"></label>' +
        '<label class="mg-mask-lock"><input type="checkbox" class="mg-mask-lock-toggle" checked> 🔒 Chránit oblast nad čarou (plot, dům, obloha) – zaškrtnuto = tam nejde kreslit</label>' +
        '<div class="mg-mask-brush" role="group" aria-label="Štětec">' +
        '<button type="button" data-brush="add" aria-pressed="false">＋ Přidat plochu</button>' +
        '<button type="button" data-brush="erase" aria-pressed="false">− Odebrat plochu</button>' +
        '</div>' +
        (freehand ? '<label class="mg-mask-size">Síla štětce – tenčí pro cestičku, širší pro plochu<input type="range" class="mg-mask-size-range" min="35" max="130" step="5" value="100"></label>' : '') +
        '<span class="mg-mask-share" aria-live="polite"></span>' +
        '</div>' +
        '<div class="mg-mask-actions"><button type="button" data-act="cancel">Zpět</button><button type="button" data-act="ok" class="mg-primary">Potvrdit plochu</button></div>' +
        '</div>';
      document.body.appendChild(ov);
      var cv = ov.querySelector('canvas'), cx = cv.getContext('2d');
      cv.width = photo.width; cv.height = photo.height;
      var range = ov.querySelector('.mg-mask-horizon input[type=range]'); if (range) range.value = Math.round(horizon * 100);
      var lockToggle = ov.querySelector('.mg-mask-lock-toggle');
      var sizeRange = ov.querySelector('.mg-mask-size-range'); var sizeMul = 1;
      var share = ov.querySelector('.mg-mask-share');
      var brush = blank ? 'add' : '';

      // "Locked" must always truthfully mean nothing above the line is currently editable, from the
      // very first frame – autoMask's own soft horizon-extension can paint a little above the line,
      // and a mask handed in via opts.initialMask (re-adjusting a previously confirmed area) may
      // have content up there from before this lock existed. Clipping on open keeps that promise
      // simple and always true, rather than letting the hatch overlay show "locked" over content
      // that's quietly still part of the submitted mask underneath it. If a customer genuinely had
      // something marked up there, unchecking the lock and repainting it is one click away.
      if (locked) clipMaskToLock();

      function clipMaskToLock() {
        var mc = mask.getContext('2d'), topPx = horizon * cv.height;
        mc.save();
        mc.globalCompositeOperation = 'destination-out';
        mc.fillStyle = '#000'; mc.fillRect(0, 0, cv.width, topPx);
        mc.restore();
      }

      function render() {
        cx.clearRect(0, 0, cv.width, cv.height);
        cx.drawImage(photo, 0, 0);
        var tint = canvas(cv.width, cv.height), tc = tint.getContext('2d');
        tc.drawImage(mask, 0, 0);
        tc.globalCompositeOperation = 'source-in'; tc.fillStyle = 'rgba(40,200,110,0.45)'; tc.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(tint, 0, 0);
        // Dim the protected part slightly so the difference is obvious.
        var dim = canvas(cv.width, cv.height), dc = dim.getContext('2d');
        dc.fillStyle = 'rgba(10,20,15,0.35)'; dc.fillRect(0, 0, cv.width, cv.height);
        dc.globalCompositeOperation = 'destination-out'; dc.drawImage(mask, 0, 0);
        cx.drawImage(dim, 0, 0);
        var topPx = horizon * cv.height;
        if (locked) {
          // Grey hatch wash over the locked zone – visually unmistakable from the plain "not marked
          // but could be" dim above, since it genuinely cannot be painted while this is on.
          cx.save();
          cx.beginPath(); cx.rect(0, 0, cv.width, topPx); cx.clip();
          cx.fillStyle = 'rgba(90,90,90,0.38)'; cx.fillRect(0, 0, cv.width, topPx);
          cx.strokeStyle = 'rgba(255,255,255,0.22)'; cx.lineWidth = Math.max(1, cv.width / 400);
          var step = Math.max(10, cv.width / 40);
          for (var lx = -topPx; lx < cv.width + topPx; lx += step) { cx.beginPath(); cx.moveTo(lx, 0); cx.lineTo(lx + topPx, topPx); cx.stroke(); }
          cx.restore();
        }
        cx.save();
        cx.strokeStyle = locked ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
        cx.setLineDash([7, 5]); cx.lineWidth = Math.max(2, cv.width / 400);
        cx.beginPath(); cx.moveTo(0, topPx); cx.lineTo(cv.width, topPx); cx.stroke();
        cx.restore();
        var c = editableShare(mask), msg = validate(c);
        share.textContent = 'Upravuje se ' + Math.round(c * 100) + ' % fotky' + (msg ? ' – ' + msg : '');
        share.classList.toggle('is-bad', !!msg);
        ov.querySelector('[data-act=ok]').disabled = !!msg;
      }
      if (range) range.addEventListener('input', function () {
        horizon = range.value / 100;
        if (!freehand) mask = autoMask(photo, horizon);
        if (locked) clipMaskToLock();
        render();
      });
      if (lockToggle) lockToggle.addEventListener('change', function () {
        locked = lockToggle.checked;
        if (locked) clipMaskToLock();
        render();
      });
      if (sizeRange) sizeRange.addEventListener('input', function () { sizeMul = sizeRange.value / 100; });
      ov.querySelectorAll('[data-brush]').forEach(function (b) {
        b.addEventListener('click', function () {
          brush = brush === b.dataset.brush ? '' : b.dataset.brush;
          ov.querySelectorAll('[data-brush]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.brush === brush)); });
          cv.style.cursor = brush ? 'crosshair' : 'default';
        });
      });
      var painting = false, lastX = null, lastY = null;
      function stamp(x, y, rad) {
        var mc = mask.getContext('2d'), erase = brush === 'erase';
        mc.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        mc.fillStyle = '#1b9c55';
        // Locked + adding: clip the paint to below the line so an "add" stroke that overshoots onto
        // a protected object (a fence, say) never registers above it, however sloppy the stroke –
        // the customer doesn't have to trace carefully around protected edges. Erasing is always
        // allowed everywhere (it can only shrink the editable area, never breach the lock).
        var clip = !erase && locked;
        if (clip) { mc.save(); mc.beginPath(); mc.rect(0, horizon * cv.height, cv.width, cv.height - horizon * cv.height); mc.clip(); }
        mc.beginPath(); mc.arc(x, y, rad, 0, Math.PI * 2); mc.fill();
        if (clip) mc.restore();
        mc.globalCompositeOperation = 'source-over';
      }
      function paint(e) {
        if (!brush) return;
        var r = cv.getBoundingClientRect();
        var x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
        var rad = Math.max(6, cv.width / 30 * sizeMul);
        // Stamp a single dab, then – if we moved since the last event – also stamp along the
        // straight line back to the previous point. A fast or coarse-grained drag (and any
        // programmatic/automated painting that moves the pointer in discrete jumps rather than
        // a smooth stream) can otherwise skip pixels between pointermove events, leaving a row of
        // separate circles with untouched gaps between them instead of one solid, compact area.
        // Those gaps stay protected by the safety hard-lock, so anything sitting in a gap (e.g.
        // clutter the customer meant to mark for removal) would silently survive AI generation.
        if (lastX !== null) {
          var dx = x - lastX, dy = y - lastY, dist = Math.sqrt(dx * dx + dy * dy), step = Math.max(1, rad / 2);
          for (var t = step; t < dist; t += step) stamp(lastX + dx * (t / dist), lastY + dy * (t / dist), rad);
        }
        stamp(x, y, rad);
        lastX = x; lastY = y;
        render();
      }
      cv.addEventListener('pointerdown', function (e) { if (!brush) return; painting = true; lastX = lastY = null; try { cv.setPointerCapture(e.pointerId); } catch (er) {} paint(e); });
      cv.addEventListener('pointermove', function (e) { if (painting) paint(e); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function () { painting = false; lastX = lastY = null; }); });
      function close(v) { ov.remove(); resolve(v); }
      ov.querySelector('[data-act=cancel]').addEventListener('click', function () { close(null); });
      // Round the edge into calmer curves before handing the mask off. A brush stroke is really a
      // string of overlapping circles; on a flat, regular surface (paving, decking) that scalloped
      // boundary can come through in the AI result as a wavy seam that looks like a trail of
      // mouse-drags rather than one deliberate edge. smoothMaskEdge only rounds the boundary – it
      // never closes real gaps or drops a disconnected island, so several separate hand-painted
      // areas (e.g. a bed in the middle of the lawn) still all survive.
      ov.querySelector('[data-act=ok]').addEventListener('click', function () { close(smoothMaskEdge(mask)); });
      if (blank) {
        ov.querySelectorAll('[data-brush]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.brush === brush)); });
        cv.style.cursor = 'crosshair';
      }
      render();
    });
  }

  /**
   * Static thumbnail of a confirmed mask: the photo with the marked (editable) area tinted green and
   * the rest dimmed, exactly like confirmMask's own live overlay – so a customer can see afterwards,
   * on the step itself, what they marked without reopening the brush.
   */
  function maskPreview(photo, mask) {
    var w = photo.width, h = photo.height;
    var out = canvas(w, h), cx = out.getContext('2d');
    cx.drawImage(photo, 0, 0, w, h);
    var tint = canvas(w, h), tc = tint.getContext('2d');
    tc.drawImage(mask, 0, 0, w, h);
    tc.globalCompositeOperation = 'source-in'; tc.fillStyle = 'rgba(40,200,110,0.45)'; tc.fillRect(0, 0, w, h);
    cx.drawImage(tint, 0, 0);
    var dim = canvas(w, h), dc = dim.getContext('2d');
    dc.fillStyle = 'rgba(10,20,15,0.35)'; dc.fillRect(0, 0, w, h);
    dc.globalCompositeOperation = 'destination-out'; dc.drawImage(mask, 0, 0, w, h);
    cx.drawImage(dim, 0, 0);
    return out;
  }

  /**
   * Staged-generation geometry ("5 řešení" revamp, step 2: deterministic masks instead of AI-guessed
   * placement). Turns a set of rough freehand strokes (app.js's bedStrokes/pathStrokes/removeStrokes –
   * each an array of {x,y} in 0–100% photo coordinates, same convention plan.php/garden-plan.js use)
   * into an actual filled mask by stroking a thick line along each one. The customer's drawn line was
   * always just a rough centerline, never a traced outline – widthPx is the real buffer that turns it
   * into a plausible path/bed footprint. Same "paint = editable" convention as every other mask here.
   */
  function strokeMask(w, h, strokes, widthPx) {
    var m = canvas(w, h), mc = m.getContext('2d');
    mc.strokeStyle = '#1b9c55'; mc.fillStyle = '#1b9c55'; mc.lineCap = 'round'; mc.lineJoin = 'round';
    mc.lineWidth = Math.max(2, widthPx);
    (strokes || []).forEach(function (stroke) {
      if (!stroke || stroke.length < 2) {
        // A single dab (e.g. a tap rather than a drag) still marks a spot worth covering.
        if (stroke && stroke.length === 1) {
          mc.beginPath(); mc.arc(stroke[0].x / 100 * w, stroke[0].y / 100 * h, widthPx / 2, 0, Math.PI * 2); mc.fill();
        }
        return;
      }
      mc.beginPath();
      stroke.forEach(function (p, i) {
        var x = p.x / 100 * w, y = p.y / 100 * h;
        if (i === 0) mc.moveTo(x, y); else mc.lineTo(x, y);
      });
      mc.stroke();
    });
    return m;
  }

  /**
   * Boolean combine of two "paint = editable" masks: 'intersect' (both), 'subtract' (a minus b), or
   * 'union' (either). Used to keep every geometric stage mask inside the customer's own confirmed
   * area (intersect with confirmedEditMask) and to carve the leftover "general style" region out of
   * it (subtract the bed/path/remove masks already handled by their own stage).
   */
  function combineMasks(op, a, b) {
    var w = a.width, h = a.height, out = canvas(w, h), oc = out.getContext('2d');
    oc.drawImage(a, 0, 0);
    oc.globalCompositeOperation = op === 'union' ? 'source-over' : (op === 'subtract' ? 'destination-out' : 'source-in');
    oc.drawImage(b, 0, 0);
    oc.globalCompositeOperation = 'source-over';
    // Re-stamp solid paint colour over whatever alpha survived – keeps every mask in the same plain
    // "#1b9c55 where editable" shape other code here already assumes, regardless of which op ran.
    oc.globalCompositeOperation = 'source-in'; oc.fillStyle = '#1b9c55'; oc.fillRect(0, 0, w, h);
    oc.globalCompositeOperation = 'source-over';
    return out;
  }

  window.MVGreenAISafety = {
    prepare: prepare, finish: finish, validate: validate, autoMask: autoMask,
    polygonMask: polygonMask, confirmMask: confirmMask, editableShare: editableShare, growMask: growMask,
    maskPreview: maskPreview, smoothMaskEdge: smoothMaskEdge, strokeMask: strokeMask, combineMasks: combineMasks,
    maskToApi: maskToApi,
    limits: { MAX_EDITABLE: MAX_EDITABLE, MIN_EDITABLE: MIN_EDITABLE, MAX_DRIFT: MAX_DRIFT }
  };
})();
