/* MVGreen – půdorys zahrady z AI plánu (JSON → SVG). Bez závislostí. */
(function () {
  'use strict';
  var STYLE = {
    house:   { fill: '#d6d1c9', stroke: '#8e877c', name: 'Dům' },
    terrace: { fill: '#ecd9b3', stroke: '#b99a5e', name: 'Terasa' },
    lawn:    { fill: '#a9d98f', stroke: '#6fae55', name: 'Trávník' },
    bed:     { fill: '#c99f74', stroke: '#8a6440', name: 'Záhon' },
    path:    { fill: '#ebe5d8', stroke: '#b9ae97', name: 'Cesta' },
    gravel:  { fill: '#dcdcd6', stroke: '#a3a39b', name: 'Štěrk' },
    slope:   { fill: '#cfe3c0', stroke: '#8fb07a', name: 'Svah' },
    other:   { fill: '#eeeeea', stroke: '#b5b5ad', name: 'Ostatní' },
    fence:   { stroke: '#5b5b55', name: 'Plot' },
    hedge:   { fill: '#4f8a52', stroke: '#2f5e33', name: 'Živý plot' },
    tree:    { fill: '#5f9e5a', stroke: '#2f6a33', name: 'Strom' },
    shrub:   { fill: '#7cb36b', stroke: '#3f7a3a', name: 'Keř' }
  };
  var ORDER = { house: 0, terrace: 1, lawn: 2, slope: 3, gravel: 4, path: 5, other: 6, bed: 7, hedge: 8, fence: 9, shrub: 10, tree: 11 };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v) { v = +v; return isFinite(v) ? Math.max(0, Math.min(100, v)) : 0; }
  function pts(el) { return (el.polygon || []).map(function (p) { return [clamp(p[0]), clamp(p[1])]; }); }
  function areaGrid(p) { var a = 0; for (var i = 0; i < p.length; i++) { var j = (i + 1) % p.length; a += p[i][0] * p[j][1] - p[j][0] * p[i][1]; } return Math.abs(a) / 2; }
  function centroid(p) {
    var x = 0, y = 0; p.forEach(function (q) { x += q[0]; y += q[1]; });
    return [x / p.length, y / p.length];
  }
  function fmtM2(v) { return v >= 10 ? Math.round(v) + ' m²' : (Math.round(v * 10) / 10).toString().replace('.', ',') + ' m²'; }
  function pointInPoly(pt, poly) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  /** Deterministic (seeded) point inside a polygon, for scattering individual plant markers. */
  function scatterPoint(poly, rnd) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    poly.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    for (var tries = 0; tries < 20; tries++) {
      var pt = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
      if (pointInPoly(pt, poly)) return pt;
    }
    return centroid(poly); // narrow/sliver polygon – bbox sampling missed, fall back to its middle
  }
  function seededRng(seed) {
    return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  }
  var PLANT_DOT_COLOR = { flowers: '#d6458f', grasses: '#c9a227', shrubs: '#2f6a33', trees: '#6b4423' };

  /**
   * plan: {site:{width_m,depth_m}, elements:[...], notes}
   * opts: {width, length} zadané zákazníkem (mají přednost), title
   * Vrací {svg, legend:[...], totals}
   */
  /** Grid 0–100 expected; models sometimes answer in metres – rescale those. Beds get stable numbers. */
  function prepare(plan) {
    if (plan._ready) return plan;
    var W = +(plan.site && plan.site.width_m) || 0, D = +(plan.site && plan.site.depth_m) || 0, mx = 0, my = 0;
    (plan.elements || []).forEach(function (e) { (e.polygon || []).forEach(function (p) { mx = Math.max(mx, +p[0] || 0); my = Math.max(my, +p[1] || 0); }); });
    if (W && D && mx <= W + 0.5 && my <= D + 0.5 && Math.max(mx, my) <= 60) {
      (plan.elements || []).forEach(function (e) { e.polygon = (e.polygon || []).map(function (p) { return [p[0] / W * 100, p[1] / D * 100]; }); });
    }
    var n = 0;
    var used = {};
    (plan.elements || []).forEach(function (e) { if (e.type === 'bed' && +e.no > 0 && !used[+e.no]) { e._no = +e.no; used[e._no] = 1; n = Math.max(n, e._no); } });
    (plan.elements || []).forEach(function (e) { if (e.type === 'bed' && !e._no && e.polygon && e.polygon.length >= 3 && !plan._markers) e._no = ++n; });
    // Počet kusů nesmí přesáhnout reálnou hustotu výsadby pro plochu záhonu.
    var Wm = +(plan.site && plan.site.width_m) || 15, Dm = +(plan.site && plan.site.depth_m) || 10;
    (plan.elements || []).forEach(function (e) {
      if (e.type === 'bed' && e.polygon && e.polygon.length >= 3) e.area_m2 = areaGrid(pts(e)) / 10000 * Wm * Dm;
      if (e.type !== 'bed' || !e.plants || !e.plants.length || !(+e.area_m2 > 0)) return;
      var cap = 0, sum = 0;
      e.plants.forEach(function (p) { var c = categoryOf(p.name), d = c === 'grasses' ? 5 : c === 'shrubs' ? 1 : c === 'trees' ? 0.2 : 7; sum += +p.count || 0; cap += (+p.count || 0) / d; });
      if (cap > +e.area_m2) { var k = +e.area_m2 / cap; e.plants.forEach(function (p) { p.count = Math.max(1, Math.round((+p.count || 0) * k)); }); }
    });
    plan._ready = true;
    return plan;
  }

  function build(plan, opts) {
    opts = opts || {};
    prepare(plan);
    var W = +opts.width > 0 ? +opts.width : Math.max(3, +(plan.site && plan.site.width_m) || 15);
    var D = +opts.length > 0 ? +opts.length : Math.max(3, +(plan.site && plan.site.depth_m) || 10);
    var measured = +opts.width > 0 && +opts.length > 0;
    var VW = 900, pad = 34, inner = VW - pad * 2;
    var sx = inner / 100, sy = (inner * D / W) / 100;
    var VH = Math.round(pad * 2 + 100 * sy + 40);
    var X = function (x) { return (pad + x * sx).toFixed(1); };
    var Y = function (y) { return (pad + y * sy).toFixed(1); };
    var m2 = function (a) { return a / 10000 * W * D; };

    var els = (plan.elements || []).filter(function (e) { return STYLE[e.type] && e.polygon && e.polygon.length; })
      .sort(function (a, b) { return ORDER[a.type] - ORDER[b.type]; });

    var defs = '<defs>' +
      '<pattern id="mgp-bed" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#c99f74"/><circle cx="3" cy="3" r="1.3" fill="#9c7348"/><circle cx="8" cy="7" r="1.1" fill="#a87d52"/></pattern>' +
      '<pattern id="mgp-lawn" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#a9d98f"/><path d="M1 7l1-3M5 6l1-3" stroke="#93c878" stroke-width=".8"/></pattern>' +
      '<pattern id="mgp-gravel" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#dcdcd6"/><circle cx="2" cy="2" r=".9" fill="#b9b9b1"/><circle cx="5" cy="5" r=".8" fill="#c4c4bc"/></pattern>' +
      '<pattern id="mgp-house" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#d6d1c9"/><path d="M0 0v10" stroke="#c4beb4" stroke-width="3"/></pattern>' +
      '<pattern id="mgp-slope" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#cfe3c0"/><path d="M2 3h8M4 8h4" stroke="#9fbe8a" stroke-width="1"/></pattern>' +
      '</defs>';
    var fillOf = { bed: 'url(#mgp-bed)', lawn: 'url(#mgp-lawn)', gravel: 'url(#mgp-gravel)', house: 'url(#mgp-house)', slope: 'url(#mgp-slope)' };

    var shapes = '', plantShapes = '', labels = '', legend = [], bedNo = 0, totals = { lawn: 0, bed: 0, plants: 0 };
    var plantNo = {}, plantSeq = 0, plantLegend = [];
    els.forEach(function (e) {
      var st = STYLE[e.type], p = pts(e);
      if (e.type === 'fence' && p.length >= 2) {
        shapes += '<polyline points="' + p.map(function (q) { return X(q[0]) + ',' + Y(q[1]); }).join(' ') + '" fill="none" stroke="' + st.stroke + '" stroke-width="3" stroke-dasharray="8 4"/>';
        return;
      }
      if (e.type === 'tree' || e.type === 'shrub') {
        // Only draw NEW plantings. An existing tree/shrub just confirms what's already on the
        // photo and adds nothing for the customer – and on a narrow site the real-world canopy
        // radius (2.2 m) can dwarf the whole plan, producing a huge, misplaced-looking blob
        // (seen in production: two unlabeled green circles swallowing the house). Capping the
        // radius keeps that from recurring even for a genuinely new, deliberately large shrub.
        if (!e.is_new || !p.length) return;
        var c = p[0], r = Math.min(e.type === 'tree' ? Math.max(14, 2.2 / W * inner) : Math.max(8, 0.8 / W * inner), inner * 0.05);
        shapes += '<circle cx="' + X(c[0]) + '" cy="' + Y(c[1]) + '" r="' + r.toFixed(1) + '" fill="' + st.fill + '" fill-opacity=".85" stroke="' + st.stroke + '" stroke-width="1.5"/>' +
          '<circle cx="' + X(c[0]) + '" cy="' + Y(c[1]) + '" r="2" fill="' + st.stroke + '"/>';
        legend.push({ no: '', type: st.name, label: e.label || st.name, area: '', plants: e.plants || [], isNew: true });
        (e.plants || []).forEach(function (pl) { totals.plants += +pl.count || 0; });
        return;
      }
      if (p.length < 3) return; // malformed element from the AI plan – drop it rather than draw a meaningless shape
      var a = m2(areaGrid(p)), cen = centroid(p);
      shapes += '<polygon points="' + p.map(function (q) { return X(q[0]) + ',' + Y(q[1]); }).join(' ') + '" fill="' + (fillOf[e.type] || st.fill) + '" stroke="' + st.stroke + '" stroke-width="' + (e.type === 'bed' ? 2 : 1.5) + '" stroke-linejoin="round"/>';
      if (e.type === 'lawn') totals.lawn += a;
      if (e.type === 'bed') {
        bedNo = e._no || bedNo + 1; totals.bed += a;
        (e.plants || []).forEach(function (pl) { totals.plants += +pl.count || 0; });
        labels += '<g><circle cx="' + X(cen[0]) + '" cy="' + Y(cen[1]) + '" r="13" fill="#0f3d27" stroke="#fff" stroke-width="2"/><text x="' + X(cen[0]) + '" y="' + (+Y(cen[1]) + 4.5) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">' + bedNo + '</text></g>';
        legend.push({ no: bedNo, type: st.name, label: e.label || ('Záhon ' + bedNo), area: fmtM2(a), plants: e.plants || [], isNew: e.is_new !== false });
        // Scatter one small, individually-numbered dot per plant inside the bed outline (same
        // number reused for every specimen of a species, as on a real planting plan), plus a
        // side legend decoding each number to a plant name – a flat brown polygon alone doesn't
        // show what's actually going in the ground. Capped per species so a dense groundcover
        // (e.g. 35 ks) doesn't turn into visual noise; the real count stays in the legend and
        // the shopping list.
        var rnd = seededRng(Math.round((e._no || bedNo) * 97 + cen[0] * 10 + cen[1]));
        (e.plants || []).forEach(function (pl) {
          var name = String(pl.name || '').trim(); if (!name) return;
          var cat = categoryOf(name);
          if (!plantNo[name]) { plantNo[name] = ++plantSeq; plantLegend.push({ no: plantNo[name], name: name, cat: cat, count: 0 }); }
          var entry = plantLegend[plantNo[name] - 1]; entry.count += +pl.count || 0;
          var dotColor = PLANT_DOT_COLOR[cat] || PLANT_DOT_COLOR.flowers;
          var dots = Math.max(1, Math.min(8, Math.round(+pl.count || 1)));
          for (var di = 0; di < dots; di++) {
            var pt = scatterPoint(p, rnd);
            plantShapes += '<circle cx="' + X(pt[0]) + '" cy="' + Y(pt[1]) + '" r="6" fill="' + dotColor + '" stroke="#fff" stroke-width="1.2"/>' +
              '<text x="' + X(pt[0]) + '" y="' + (+Y(pt[1]) + 2.6) + '" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff">' + plantNo[name] + '</text>';
          }
        });
      } else {
        var big = areaGrid(p) > 120;
        if (big) labels += '<text x="' + X(cen[0]) + '" y="' + Y(cen[1]) + '" text-anchor="middle" font-size="13" font-weight="600" fill="#1f3a2a" paint-order="stroke" stroke="#ffffffcc" stroke-width="3">' + esc(e.label || st.name) + (e.type === 'lawn' || e.type === 'terrace' ? ' · ' + fmtM2(a) : '') + '</text>';
        if (e.type === 'lawn' || e.type === 'terrace' || e.type === 'path' || e.type === 'gravel') legend.push({ no: '', type: st.name, label: e.label || st.name, area: fmtM2(a), plants: [], isNew: !!e.is_new });
      }
    });

    // Měřítko
    var step = W > 30 ? 10 : W > 12 ? 5 : 2, barPx = step / W * inner, by = VH - 22;
    var scale = '<g font-size="11" fill="#33473a"><rect x="' + pad + '" y="' + by + '" width="' + barPx.toFixed(1) + '" height="6" fill="#33473a"/><rect x="' + (pad + barPx / 2).toFixed(1) + '" y="' + by + '" width="' + (barPx / 2).toFixed(1) + '" height="6" fill="#fff" stroke="#33473a"/>' +
      '<text x="' + pad + '" y="' + (by - 4) + '">0</text><text x="' + (pad + barPx).toFixed(1) + '" y="' + (by - 4) + '" text-anchor="middle">' + step + ' m</text>' +
      '<text x="' + (VW - pad) + '" y="' + (by + 6) + '" text-anchor="end">' + (measured ? 'Rozměry podle zadání ' : 'Orientační odhad ') + String(Math.round(W * 10) / 10).replace('.', ',') + ' × ' + String(Math.round(D * 10) / 10).replace('.', ',') + ' m · pohled shora, dům nahoře</text></g>';

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" width="100%" role="img" aria-label="Půdorys zahrady" font-family="Inter,Segoe UI,Arial,sans-serif">' + defs +
      '<rect width="' + VW + '" height="' + VH + '" fill="#fbfcf9"/>' +
      '<rect x="' + pad + '" y="' + pad + '" width="' + inner + '" height="' + (100 * sy).toFixed(1) + '" fill="#f1f4ec" stroke="#cfd8c8"/>' +
      shapes + plantShapes + labels + scale + '</svg>';
    plantLegend.sort(function (u, v) { return u.no - v.no; });
    return { svg: svg, legend: legend, plantLegend: plantLegend, totals: totals, width: W, depth: D, measured: measured, notes: plan.notes || '' };
  }

  function legendHtml(r) {
    var rows = r.legend.map(function (l) {
      var pl = l.plants.length ? l.plants.map(function (p) { return esc(p.name) + ' <b>' + (+p.count || 0) + ' ks</b>'; }).join(', ') : '—';
      return '<tr><td>' + (l.no ? '<span class="mg-plan-no">' + l.no + '</span>' : '') + '</td><td><strong>' + esc(l.label) + '</strong>' + (l.isNew ? ' <em>nové</em>' : '') + '</td><td>' + esc(l.area) + '</td><td>' + pl + '</td></tr>';
    }).join('');
    return '<table class="mg-plan-legend"><thead><tr><th></th><th>Prvek</th><th>Plocha</th><th>Rostliny</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="mg-plan-totals">Trávník ' + fmtM2(r.totals.lawn) + ' · záhony ' + fmtM2(r.totals.bed) + ' · rostlin celkem ' + r.totals.plants + ' ks</p>' +
      '<p class="mg-note">Půdorys je převedený z fotografie, proto jsou plochy orientační' + (r.measured ? '' : ' (bez zadaných rozměrů jde o odhad podle domu)') + '. Přesné rozměry si prosím ověřte přímo na zahradě. ' + esc(r.notes) + '</p>';
  }

  /** Legenda k číslům jednotlivých rostlin vyznačeným tečkami v půdorysu (viz build()). */
  function plantLegendHtml(r) {
    if (!r.plantLegend || !r.plantLegend.length) return '';
    var catName = { flowers: 'trvalka / květina', grasses: 'travina', shrubs: 'keř', trees: 'strom' };
    var rows = r.plantLegend.map(function (pl) {
      return '<tr><td><span class="mg-plan-no" style="background:' + (PLANT_DOT_COLOR[pl.cat] || PLANT_DOT_COLOR.flowers) + '">' + pl.no + '</span></td><td><strong>' + esc(pl.name) + '</strong><br><small>' + (catName[pl.cat] || '') + '</small></td><td>' + pl.count + ' ks</td></tr>';
    }).join('');
    return '<h5>🌼 Legenda rostlin v půdorysu</h5><table class="mg-plan-legend mg-plan-plants"><thead><tr><th></th><th>Rostlina</th><th>Počet</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="mg-note">Číslo a barva tečky v půdorysu odpovídají řádku v této legendě. Přesné rozmístění v záhonu je orientační.</p>';
  }

  /** Stáhne SVG jako PNG. */
  function downloadPng(svg, name) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas'); c.width = img.naturalWidth * 2 || 1800; c.height = img.naturalHeight * 2 || 1200;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      var a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = name || 'mvgreen-pudorys.png'; document.body.appendChild(a); a.click(); a.remove();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }


  /**
   * Najde nové záhony porovnáním fotky PŘED a PO: místa, kde přibyla ne-trávníková výsadba
   * (květy, mulč, traviny), uvnitř upravované plochy. Vrací body v % fotky, zleva doprava.
   */
  function detectBeds(beforeSrc, afterSrc, maskCanvas) {
    function load(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
    return Promise.all([load(beforeSrc), load(afterSrc)]).then(function (im) {
      var W = 320, H = Math.round(im[1].naturalHeight / im[1].naturalWidth * W);
      function px(img) { var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'); x.drawImage(img, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; }
      var b = px(im[0]), a = px(im[1]), m = null;
      if (maskCanvas) { var mc = document.createElement('canvas'); mc.width = W; mc.height = H; var mx = mc.getContext('2d'); mx.drawImage(maskCanvas, 0, 0, W, H); m = mx.getImageData(0, 0, W, H).data; }
      var hit = new Uint8Array(W * H);
      for (var i = 0, k = 0; k < W * H; k++, i += 4) {
        if (m && m[i + 3] < 128) continue;
        var r = a[i], g = a[i + 1], bl = a[i + 2];
        var diff = (Math.abs(r - b[i]) + Math.abs(g - b[i + 1]) + Math.abs(bl - b[i + 2])) / 3;
        // Nový trávník je hladký a zelený; záhon je pestrý nebo členitý (traviny, keříky, mulč).
        // Tightened from the original (g>r+10, tex<30): that was loose enough to misclassify real
        // new low/dense planting (e.g. thyme or groundcover along a wall) as "just lawn", silently
        // dropping whole beds from the count a customer could plainly see in the photo. Requiring a
        // stronger green margin AND a lower texture ceiling before calling something "lawn" means
        // only genuinely smooth, uniformly green areas get excluded now.
        var xr = (k % W) < W - 1 ? i + 4 : i - 4, yd = k < W * (H - 1) ? i + W * 4 : i - W * 4;
        var tex = Math.abs(g - a[xr + 1]) + Math.abs(g - a[yd + 1]) + Math.abs(r - a[xr]) + Math.abs(bl - a[yd + 2]);
        var lawn = g > r + 14 && g > bl + 14 && tex < 20;
        if (diff > 24 && !lawn) hit[k] = 1;
      }
      // Uzavření: zaplnit mezery mezi rostlinami (rozmazání 3×3 dvakrát).
      for (var pass = 0; pass < 3; pass++) {
        var nx = new Uint8Array(W * H);
        for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
          var s = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) s += hit[(y + dy) * W + x + dx];
          nx[y * W + x] = s >= (pass < 2 ? 3 : 5) ? 1 : 0;
        }
        hit = nx;
      }
      // Halved from 0.3% – at a 320px-wide working image that was already filtering out smaller or
      // more distant beds (e.g. a modest planting strip by a far wall) before they ever got a
      // chance to become a numbered circle on the photo.
      var seen = new Int32Array(W * H), comps = [], id = 0, minArea = W * H * 0.0015;
      for (var p = 0; p < W * H; p++) {
        if (!hit[p] || seen[p]) continue;
        id++; var st = [p], cnt = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; seen[p] = id;
        while (st.length) {
          var q = st.pop(), qx = q % W, qy = (q / W) | 0; cnt++; sx += qx; sy += qy;
          if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
          [q - 1, q + 1, q - W, q + W].forEach(function (t) { if (t >= 0 && t < W * H && hit[t] && !seen[t] && Math.abs((t % W) - qx) <= 1) { seen[t] = id; st.push(t); } });
        }
        if (cnt >= minArea) comps.push({ n: cnt, sx: sx, sy: sy, x0: x0, y0: y0, x1: x1, y1: y1 });
      }
      // Části jednoho záhonu (přerušené trsy) spojit, když se jejich obrysy téměř dotýkají.
      // A busy/textured photo can produce hundreds of tiny components; restarting the O(n²) scan
      // from scratch on every single merge (as before) makes this O(n³) and can hang the tab for
      // minutes. Cap both the candidate count and the number of passes so it always terminates fast.
      if (comps.length > 1) {
        comps.sort(function (u, v) { return v.n - u.n; });
        if (comps.length > 180) comps = comps.slice(0, 180);
        var gap = Math.round(W * 0.04), pass2 = 0;
        while (pass2 < 12) {
          pass2++;
          var mergedAny = false;
          for (var u = 0; u < comps.length; u++) {
            if (!comps[u]) continue;
            for (var v = u + 1; v < comps.length; v++) {
              if (!comps[v]) continue;
              var A = comps[u], B = comps[v];
              if (A.x0 - gap <= B.x1 && B.x0 - gap <= A.x1 && A.y0 - gap <= B.y1 && B.y0 - gap <= A.y1) {
                A.n += B.n; A.sx += B.sx; A.sy += B.sy; A.x0 = Math.min(A.x0, B.x0); A.y0 = Math.min(A.y0, B.y0); A.x1 = Math.max(A.x1, B.x1); A.y1 = Math.max(A.y1, B.y1);
                comps[v] = null; mergedAny = true;
              }
            }
          }
          comps = comps.filter(function (c) { return c; });
          if (!mergedAny) break;
        }
      }
      comps = comps.filter(function (c) { return c.n >= W * H * 0.002; }).map(function (c) {
        // Číslo dát doprostřed obrysu, ale na skutečný pixel záhonu (ne do mezery).
        return { x: c.sx / c.n / W * 100, y: c.sy / c.n / H * 100, share: c.n / (W * H) };
      });
      comps.sort(function (u, v) { return v.share - u.share; });
      // Capped at 9 to match the server-side AI prompt's own marker ceiling (plan.php) – raised
      // from 6 so a photo with several genuinely separate new beds doesn't lose the smallest ones.
      return comps.slice(0, 9).sort(function (u, v) { return u.x - v.x; });
    });
  }

  /** Čísla podle nalezených záhonů (detectBeds) – přesná poloha, nezávislá na AI. */
  function drawMarkers(src, points) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0);
        var r = Math.max(16, Math.round(c.width / 55));
        points.forEach(function (pt, i) {
          var px = pt.x / 100 * c.width, py = pt.y / 100 * c.height;
          x.beginPath(); x.arc(px, py, r * 1.25, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,.92)'; x.fill();
          x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fillStyle = '#0f3d27'; x.fill();
          x.fillStyle = '#fff'; x.font = '700 ' + Math.round(r * 1.15) + 'px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(String(i + 1), px, py + r * 0.06);
        });
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = function () { reject(new Error('Obrázek se nepodařilo načíst.')); };
      img.src = src;
    });
  }

  /** Numbered markers drawn straight into the design photo (main deliverable for non-gardeners). */
  function annotatePhoto(src, plan) {
    prepare(plan);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0);
        var r = Math.max(16, Math.round(c.width / 55));
        (plan.elements || []).forEach(function (e) {
          if (!e._no || !e.photo_point || e.photo_point.length < 2) return;
          var px = clamp(e.photo_point[0]) / 100 * c.width, py = clamp(e.photo_point[1]) / 100 * c.height;
          x.beginPath(); x.arc(px, py, r * 1.25, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill();
          x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fillStyle = '#0f3d27'; x.fill();
          x.fillStyle = '#fff'; x.font = '700 ' + Math.round(r * 1.15) + 'px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(String(e._no), px, py + r * 0.06);
        });
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = function () { reject(new Error('Obrázek se nepodařilo načíst.')); };
      img.src = src;
    });
  }

  /** Beds with their plants (matches the numbers in the photo) + one combined shopping list. */
  function bedsHtml(plan, opts) {
    var r = build(plan, opts || {});
    var beds = r.legend.filter(function (l) { return l.no; });
    var shop = {};
    (plan.elements || []).forEach(function (e) {
      if (!e.is_new) return;
      (e.plants || []).forEach(function (p) { var k = String(p.name || '').trim(); if (k) shop[k] = (shop[k] || 0) + (+p.count || 0); });
    });
    var bedRows = beds.map(function (l) {
      return '<li><span class="mg-plan-no">' + l.no + '</span><div><strong>' + esc(l.label) + '</strong> <small>≈ ' + esc(l.area) + '</small><br>' +
        (l.plants.length ? l.plants.map(function (p) { return esc(p.name) + ' – ' + (+p.count || 0) + ' ks'; }).join(', ') : 'bez výsadby') + '</div></li>';
    }).join('');
    var shopRows = Object.keys(shop).sort().map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + shop[k] + ' ks</td></tr>'; }).join('');
    return (bedRows ? '<ol class="mg-plan-beds">' + bedRows + '</ol>' : '<p class="mg-note">Na fotografii nejsou žádné nové záhony.</p>') +
      '<p class="mg-note">Počty kusů jsou orientační podle velikosti záhonů na fotografii. Přesné množství si upřesněte podle skutečné velikosti záhonu na zahradě.</p>';
  }


  // Orientační maloobchodní ceny (Kč s DPH) podle skupiny – jediné místo k úpravě.
  var PRICES = { flowers: [70, 130, 'trvalka v květináči 9–11 cm'], grasses: [90, 180, 'travina v květináči 1–2 l'], shrubs: [180, 380, 'keř v kontejneru 2–3 l'], trees: [900, 2500, 'strom 150–200 cm'] };
  var MULCH_M2 = [70, 110]; // kůra 5 cm + netkaná textilie / m²
  /** Same fuzzy name match categoryOf() always did, factored out so priceRangeOf() below can reuse
   *  it instead of re-scanning the catalog a second time per plant. */
  function findCatalogEntry(name) {
    var cat = window.MVGreenPlantCatalog || [], n = String(name || '').toLowerCase().replace(/[„“"].*$/, '').trim();
    for (var i = 0; i < cat.length; i++) { var c = String(cat[i].name || '').toLowerCase(); if (c && (n.indexOf(c) === 0 || c.indexOf(n) === 0)) return cat[i]; }
    return null;
  }
  function categoryOf(name) {
    // Malé polokeře (levandule, šalvěj…) se prodávají a sázejí jako trvalky.
    if (/levandul|šalvěj|yzop|tymián|mateřídouš/i.test(String(name))) return 'flowers';
    var entry = findCatalogEntry(name);
    if (entry && entry.category) return entry.category;
    var n = String(name || '').toLowerCase();
    if (/tráv|kostřav|ostřic|miskant|vousat|dochan/.test(n)) return 'grasses';
    if (/keř|tavolník|zimolez|hortenzi|levandul|zákula|dřišťál/.test(n)) return 'shrubs';
    return 'flowers';
  }
  /**
   * Real retail price for one species where the catalog has hand-verified CZ e-shop data (see
   * legacyPlants in app.js, merged into window.MVGreenPlantCatalog before this ever runs) - a tight
   * band around that one real number, rather than the flat per-category guess below. Falls back to
   * the flat PRICES range (today's only option) for species we have no verified CZ retail price
   * for yet - most of the 805-species catalog, which was built from a US botanical reference, not
   * a CZ nursery, so most of it was never going to have a real price anyway.
   */
  function priceRangeOf(name) {
    var entry = findCatalogEntry(name), fallback = PRICES[categoryOf(name)] || PRICES.flowers;
    if (entry && typeof entry.price === 'number' && entry.price > 0) {
      return [Math.round(entry.price * 0.85), Math.round(entry.price * 1.25), entry.size || fallback[2]];
    }
    return fallback;
  }
  function kc(v) { return Math.round(v / 10) * 10 >= 1000 ? (Math.round(v / 100) * 100).toLocaleString('cs-CZ') : String(Math.round(v / 10) * 10); }

  /**
   * Shared price computation behind both shoppingHtml (the chapter's own table) and shoppingTotals
   * (the project summary's headline price) - ONE calculation, so the two chapters can never show
   * two different numbers for the same design (2026-10-27: the whole "zahradní projekt" rewrite is
   * specifically about never letting the parts disagree with each other).
   */
  function computeShopping(plan, opts) {
    var r = build(plan, opts || {}), shop = {}, lo = 0, hi = 0;
    (plan.elements || []).forEach(function (e) {
      if (!e.is_new) return;
      (e.plants || []).forEach(function (p) { var k = String(p.name || '').trim(); if (k) shop[k] = (shop[k] || 0) + (+p.count || 0); });
    });
    var keys = Object.keys(shop).sort();
    keys.forEach(function (k) { var pr = priceRangeOf(k), n = shop[k]; lo += n * pr[0]; hi += n * pr[1]; });
    var bed = r.totals.bed, mlo = bed * MULCH_M2[0], mhi = bed * MULCH_M2[1];
    if (bed > 0) { lo += mlo; hi += mhi; }
    return { shop: shop, keys: keys, lo: lo, hi: hi, bed: bed, mlo: mlo, mhi: mhi, hasItems: keys.length > 0 };
  }

  /** Just the headline price range (as the same formatted strings the shopping table itself uses) - for the project summary chapter, computed with no rendering work. */
  function shoppingTotals(plan, opts) {
    var c = computeShopping(plan, opts);
    return { hasItems: c.hasItems, lo: kc(c.lo), hi: kc(c.hi), loRaw: c.lo, hiRaw: c.hi };
  }

  /** Nákupní seznam s orientační cenou + nabídka MVGreen. */
  function shoppingHtml(plan, opts) {
    var c = computeShopping(plan, opts || {});
    if (!c.hasItems) return '';
    var rows = c.keys.map(function (k) {
      var pr = priceRangeOf(k), n = c.shop[k];
      return '<tr><td>' + esc(k) + '<br><small>' + pr[2] + '</small></td><td>' + n + ' ks</td><td>' + kc(n * pr[0]) + '–' + kc(n * pr[1]) + ' Kč</td></tr>';
    }).join('');
    if (c.bed > 0) rows += '<tr><td>Mulčovací kůra a textilie<br><small>≈ ' + fmtM2(c.bed) + ' záhonů</small></td><td></td><td>' + kc(c.mlo) + '–' + kc(c.mhi) + ' Kč</td></tr>';
    return '<h5>🛒 Nákupní seznam s orientační cenou</h5><table class="mg-plan-legend mg-plan-shop"><thead><tr><th>Položka</th><th>Množství</th><th>Cena</th></tr></thead><tbody>' + rows +
      '</tbody><tfoot><tr><th>Materiál celkem</th><th></th><th>' + kc(c.lo) + '–' + kc(c.hi) + ' Kč</th></tr></tfoot></table>' +
      '<p class="mg-note">Ceny jsou orientační ceny zahradnictví s DPH, bez práce a dopravy.</p>' +
      // This tool is for self-service garden planning, not a lead-in to a custom on-site survey
      // or build of the whole design (beds, planting…) – the business doesn't offer that. Point
      // only at the real, standing MV GREEN lawn-care services and let the customer arrange beds/
      // planting themselves; never imply a quote is coming for "realizing this design".
      '<div class="mg-plan-offer"><strong>Údržbu trávníku svěřte MV GREEN</strong><p>Na webu mvgreen.cz nabízíme sekání, stříhání živých plotů a tují, založení nebo obnovu trávníku, aerifikaci, zapískování a dosev. Záhony a výsadbu z tohoto návrhu si zajistíte sami nebo přes zahradnictví – o trávník se vám rádi postaráme.</p>' +
      '<a class="mg-primary" href="/kontakty/#poptavka">Napsat MV GREEN</a> <a href="https://wa.me/420723339650">nebo na WhatsApp</a></div>';
  }

  /** Which plant categories (+ levandule specifically) actually appear in the design - shared by careHtml and stepsHtml so the two chapters always tailor themselves to the SAME design, never drift apart. */
  function plantPresence(plan) {
    var has = { flowers: 0, grasses: 0, shrubs: 0, trees: 0 }, lav = false;
    (plan.elements || []).forEach(function (e) { (e.plants || []).forEach(function (p) { has[categoryOf(p.name)] = 1; if (/levandul/i.test(p.name)) lav = true; }); });
    return { has: has, lav: lav };
  }

  /**
   * Build sequence (2026-10-27, new chapter 4 of the "zahradní projekt"): deterministic, not
   * AI-written - the same reliability bar as careHtml below, no risk of the AI inventing a step
   * that doesn't fit. Tailored only by which plant categories genuinely appear (plantPresence),
   * same as careHtml, so chapters 4 and 5 never contradict each other about what's actually in
   * the design.
   */
  function stepsHtml(plan) {
    var pp = plantPresence(plan), has = pp.has;
    var order = (has.trees ? 'stromy' : '') + (has.trees && has.shrubs ? ', ' : '') + (has.shrubs ? 'keře' : '') + ((has.trees || has.shrubs) ? ' a až poté ' : '') + 'trvalky, traviny a nižší výsadbu';
    var steps = [
      ['Příprava', [
        'Podle fotky s očíslovanými záhony a popisu v kapitole 2 si plochy vyznačte přímo na zahradě.',
        'Odstraňte nepořádek a staré nebo nemocné rostliny, které návrh na daném místě nahrazuje.'
      ]],
      ['Nákup', [
        'Materiál i rostliny z nákupního seznamu (kapitola 3) kupte najednou – ušetříte cestu i peníze za hromadný odběr.',
        'Rostliny kupujte těsně před výsadbou, ne s velkým předstihem.'
      ]],
      ['Výsadba', [
        'Sázejte v pořadí ' + order + ' – podle rozmístění na očíslované fotce.',
        'Mezi rostlinami dodržujte vzdálenost podle jejich VZROSTLÉ velikosti, ne podle velikosti sazenice, jinak budou za pár let přerostlé.',
        'Sázejte v zamračeném dni nebo večer, nikdy na plném slunci v poledne – rostlina se lépe uchytí.'
      ]],
      ['Zálivka a mulč', [
        'Po výsadbě každou rostlinu hned důkladně zalejte, i když zrovna prší.',
        'Záhony zamulčujte (kůra, štěrk nebo textilie z nákupního seznamu) – omezí to plevel a vysychání půdy.'
      ]],
      ['První týdny', [
        'Prvních 4–6 týdnů zalévejte pravidelně, dokud rostliny nezakoření.',
        'Pak už se řiďte kalendářem péče v kapitole 5 podle ročního období.'
      ]]
    ];
    return '<h5>🛠️ Jak postupovat</h5><ol class="mg-plan-steps">' + steps.map(function (s) {
      return '<li><strong>' + esc(s[0]) + '</strong><ul>' + s[1].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></li>';
    }).join('') + '</ol>';
  }

  /** Kalendář péče na jednu stránku podle skupin rostlin v návrhu (trávník vždy). */
  function careHtml(plan) {
    var pp = plantPresence(plan), has = pp.has, lav = pp.lav;
    var rows = [
      ['Březen–duben', ['Trávník: vyhrabat, první sekání, jarní hnojení' + '', has.grasses ? 'Traviny: sestřihnout suché listy 10–15 cm nad zemí' : '', has.flowers ? 'Trvalky: odstranit loňské stonky, doplnit mulč' : '', lav ? 'Levandule: lehce zastřihnout do tvaru (ne do starého dřeva)' : '', has.shrubs ? 'Keře: tvarovací řez jarních nekvetoucích keřů' : '']],
      ['Květen–červen', ['Trávník: sekat 1× týdně, výška 4–5 cm', 'Záhony: plít, v suchu zalévat ráno nebo večer', has.flowers ? 'Trvalky: odstraňovat odkvetlé květy' : '']],
      ['Červenec–srpen', ['Trávník: v horku sekat výš, zalévat méně často a vydatně', lav ? 'Levandule: po odkvětu sestřihnout květní stonky' : '', 'Záhony: hlídat zálivku nových rostlin']],
      ['Září–říjen', ['Trávník: podzimní hnojení, případně vertikutace a dosev', has.flowers ? 'Trvalky: nechat semeníky na zimu pro ptáky, nemocné části odstranit' : '', has.shrubs || has.trees ? 'Nejlepší čas na dosadbu keřů a stromů' : '']],
      ['Listopad–únor', ['Trávník: shrabat listí, poslední sekání', has.grasses ? 'Traviny: nestříhat – chrání trs přes zimu' : '', 'Nářadí: nabrousit a připravit na sezonu']]
    ];
    return '<h5>📅 Kalendář péče</h5><table class="mg-plan-legend mg-plan-care"><tbody>' + rows.map(function (r) {
      return '<tr><th>' + r[0] + '</th><td><ul>' + r[1].filter(Boolean).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></td></tr>';
    }).join('') + '</tbody></table>';
  }

  window.MVGreenPlan = { build: build, legendHtml: legendHtml, plantLegendHtml: plantLegendHtml, downloadPng: downloadPng, annotatePhoto: annotatePhoto, bedsHtml: bedsHtml, prepare: prepare, detectBeds: detectBeds, drawMarkers: drawMarkers, shoppingHtml: shoppingHtml, shoppingTotals: shoppingTotals, careHtml: careHtml, stepsHtml: stepsHtml };
})();
