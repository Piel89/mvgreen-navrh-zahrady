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

    var shapes = '', labels = '', legend = [], bedNo = 0, totals = { lawn: 0, bed: 0, plants: 0 };
    els.forEach(function (e) {
      var st = STYLE[e.type], p = pts(e);
      if (e.type === 'tree' || e.type === 'shrub' || p.length < 3) {
        if (e.type === 'fence' && p.length >= 2) {
          shapes += '<polyline points="' + p.map(function (q) { return X(q[0]) + ',' + Y(q[1]); }).join(' ') + '" fill="none" stroke="' + st.stroke + '" stroke-width="3" stroke-dasharray="8 4"/>';
          return;
        }
        var c = p[0], r = e.type === 'tree' ? Math.max(14, 2.2 / W * inner) : Math.max(8, 0.8 / W * inner);
        shapes += '<circle cx="' + X(c[0]) + '" cy="' + Y(c[1]) + '" r="' + r.toFixed(1) + '" fill="' + st.fill + '" fill-opacity=".85" stroke="' + st.stroke + '" stroke-width="1.5"/>' +
          '<circle cx="' + X(c[0]) + '" cy="' + Y(c[1]) + '" r="2" fill="' + st.stroke + '"/>';
        if (e.is_new) {
          legend.push({ no: '', type: st.name, label: e.label || st.name, area: '', plants: e.plants || [], isNew: true });
          (e.plants || []).forEach(function (pl) { totals.plants += +pl.count || 0; });
        }
        return;
      }
      var a = m2(areaGrid(p)), cen = centroid(p);
      shapes += '<polygon points="' + p.map(function (q) { return X(q[0]) + ',' + Y(q[1]); }).join(' ') + '" fill="' + (fillOf[e.type] || st.fill) + '" stroke="' + st.stroke + '" stroke-width="' + (e.type === 'bed' ? 2 : 1.5) + '" stroke-linejoin="round"/>';
      if (e.type === 'lawn') totals.lawn += a;
      if (e.type === 'bed') {
        bedNo = e._no || bedNo + 1; totals.bed += a;
        (e.plants || []).forEach(function (pl) { totals.plants += +pl.count || 0; });
        labels += '<g><circle cx="' + X(cen[0]) + '" cy="' + Y(cen[1]) + '" r="13" fill="#0f3d27" stroke="#fff" stroke-width="2"/><text x="' + X(cen[0]) + '" y="' + (+Y(cen[1]) + 4.5) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">' + bedNo + '</text></g>';
        legend.push({ no: bedNo, type: st.name, label: e.label || ('Záhon ' + bedNo), area: fmtM2(a), plants: e.plants || [], isNew: e.is_new !== false });
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
      shapes + labels + scale + '</svg>';
    return { svg: svg, legend: legend, totals: totals, width: W, depth: D, measured: measured, notes: plan.notes || '' };
  }

  function legendHtml(r) {
    var rows = r.legend.map(function (l) {
      var pl = l.plants.length ? l.plants.map(function (p) { return esc(p.name) + ' <b>' + (+p.count || 0) + ' ks</b>'; }).join(', ') : '—';
      return '<tr><td>' + (l.no ? '<span class="mg-plan-no">' + l.no + '</span>' : '') + '</td><td><strong>' + esc(l.label) + '</strong>' + (l.isNew ? ' <em>nové</em>' : '') + '</td><td>' + esc(l.area) + '</td><td>' + pl + '</td></tr>';
    }).join('');
    return '<table class="mg-plan-legend"><thead><tr><th></th><th>Prvek</th><th>Plocha</th><th>Rostliny</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="mg-plan-totals">Trávník ' + fmtM2(r.totals.lawn) + ' · záhony ' + fmtM2(r.totals.bed) + ' · rostlin celkem ' + r.totals.plants + ' ks</p>' +
      '<p class="mg-note">Půdorys je převedený z fotografie, proto jsou plochy orientační' + (r.measured ? '' : ' (bez zadaných rozměrů jde o odhad podle domu)') + '. Přesné míry ověříme na místě. ' + esc(r.notes) + '</p>';
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
        var xr = (k % W) < W - 1 ? i + 4 : i - 4, yd = k < W * (H - 1) ? i + W * 4 : i - W * 4;
        var tex = Math.abs(g - a[xr + 1]) + Math.abs(g - a[yd + 1]) + Math.abs(r - a[xr]) + Math.abs(bl - a[yd + 2]);
        var lawn = g > r + 10 && g > bl + 10 && tex < 30;
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
      var seen = new Int32Array(W * H), comps = [], id = 0, minArea = W * H * 0.003;
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
      comps = comps.filter(function (c) { return c.n >= W * H * 0.004; }).map(function (c) {
        // Číslo dát doprostřed obrysu, ale na skutečný pixel záhonu (ne do mezery).
        return { x: c.sx / c.n / W * 100, y: c.sy / c.n / H * 100, share: c.n / (W * H) };
      });
      comps.sort(function (u, v) { return v.share - u.share; });
      return comps.slice(0, 6).sort(function (u, v) { return u.x - v.x; });
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
      '<p class="mg-note">Počty kusů jsou orientační podle velikosti záhonů na fotografii. Přesné množství upřesníme při zaměření na místě.</p>';
  }


  // Orientační maloobchodní ceny (Kč s DPH) podle skupiny – jediné místo k úpravě.
  var PRICES = { flowers: [70, 130, 'trvalka v květináči 9–11 cm'], grasses: [90, 180, 'travina v květináči 1–2 l'], shrubs: [180, 380, 'keř v kontejneru 2–3 l'], trees: [900, 2500, 'strom 150–200 cm'] };
  var MULCH_M2 = [70, 110]; // kůra 5 cm + netkaná textilie / m²
  function categoryOf(name) {
    // Malé polokeře (levandule, šalvěj…) se prodávají a sázejí jako trvalky.
    if (/levandul|šalvěj|yzop|tymián|mateřídouš/i.test(String(name))) return 'flowers';
    var cat = window.MVGreenPlantCatalog || [], n = String(name || '').toLowerCase().replace(/[„“"].*$/, '').trim();
    for (var i = 0; i < cat.length; i++) { var c = String(cat[i].name || '').toLowerCase(); if (c && (n.indexOf(c) === 0 || c.indexOf(n) === 0)) return cat[i].category; }
    if (/tráv|kostřav|ostřic|miskant|vousat|dochan/.test(n)) return 'grasses';
    if (/keř|tavolník|zimolez|hortenzi|levandul|zákula|dřišťál/.test(n)) return 'shrubs';
    return 'flowers';
  }
  function kc(v) { return Math.round(v / 10) * 10 >= 1000 ? (Math.round(v / 100) * 100).toLocaleString('cs-CZ') : String(Math.round(v / 10) * 10); }

  /** Nákupní seznam s orientační cenou + nabídka MVGreen. */
  function shoppingHtml(plan, opts) {
    var r = build(plan, opts || {}), shop = {}, lo = 0, hi = 0;
    (plan.elements || []).forEach(function (e) {
      if (!e.is_new) return;
      (e.plants || []).forEach(function (p) { var k = String(p.name || '').trim(); if (k) shop[k] = (shop[k] || 0) + (+p.count || 0); });
    });
    var rows = Object.keys(shop).sort().map(function (k) {
      var pr = PRICES[categoryOf(k)] || PRICES.flowers, n = shop[k];
      lo += n * pr[0]; hi += n * pr[1];
      return '<tr><td>' + esc(k) + '<br><small>' + pr[2] + '</small></td><td>' + n + ' ks</td><td>' + kc(n * pr[0]) + '–' + kc(n * pr[1]) + ' Kč</td></tr>';
    }).join('');
    if (!rows) return '';
    var bed = r.totals.bed, mlo = bed * MULCH_M2[0], mhi = bed * MULCH_M2[1];
    if (bed > 0) rows += '<tr><td>Mulčovací kůra a textilie<br><small>≈ ' + fmtM2(bed) + ' záhonů</small></td><td></td><td>' + kc(mlo) + '–' + kc(mhi) + ' Kč</td></tr>';
    lo += mlo; hi += mhi;
    return '<h5>🛒 Nákupní seznam s orientační cenou</h5><table class="mg-plan-legend mg-plan-shop"><thead><tr><th>Položka</th><th>Množství</th><th>Cena</th></tr></thead><tbody>' + rows +
      '</tbody><tfoot><tr><th>Materiál celkem</th><th></th><th>' + kc(lo) + '–' + kc(hi) + ' Kč</th></tr></tfoot></table>' +
      '<p class="mg-note">Ceny jsou orientační ceny zahradnictví s DPH, bez práce a dopravy.</p>' +
      '<div class="mg-plan-offer"><strong>Nechte práci na nás</strong><p>MV GREEN připraví plochy, založí nebo obnoví trávník, odveze starý materiál a postará se o pravidelnou údržbu. Pošlete nám tento návrh a do 1–2 dnů dostanete nezávaznou cenovou nabídku.</p>' +
      '<a class="mg-primary" href="/kontakty/#poptavka">Chci nabídku na realizaci</a> <a href="https://wa.me/420723339650">nebo napište na WhatsApp</a></div>';
  }

  /** Kalendář péče na jednu stránku podle skupin rostlin v návrhu (trávník vždy). */
  function careHtml(plan) {
    var has = { flowers: 0, grasses: 0, shrubs: 0, trees: 0 }, lav = false;
    (plan.elements || []).forEach(function (e) { (e.plants || []).forEach(function (p) { has[categoryOf(p.name)] = 1; if (/levandul/i.test(p.name)) lav = true; }); });
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

  window.MVGreenPlan = { build: build, legendHtml: legendHtml, downloadPng: downloadPng, annotatePhoto: annotatePhoto, bedsHtml: bedsHtml, prepare: prepare, detectBeds: detectBeds, drawMarkers: drawMarkers, shoppingHtml: shoppingHtml, careHtml: careHtml };
})();
