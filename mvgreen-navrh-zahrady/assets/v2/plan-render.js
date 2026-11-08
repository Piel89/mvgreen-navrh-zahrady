/*
 * MVGreen AI architekt v2 – malovaný osazovací plán (2026-11-08).
 *
 * Vstup: projekt v METRECH (obrysy ploch, cesty, ploty, stávající prvky, rostliny pro každý záhon).
 * Výstup: HTML list výkresu (SVG plán + razítko s legendou). Rostliny se do záhonů rozmisťují samy
 * podle sponu (vysoké dozadu k plotu/zdi, nízké dopředu), takže počty kusů v legendě, v rozpočtu
 * i na výkresu jsou vždy stejné – nikdo je nepočítá ručně.
 *
 * Styl odsouhlasil Martin podle vzorů „navrhar 1–4“: malované vrstvené symboly rostlin se světlem
 * a stínem, pruhovaný trávník, papírová textura, ručně psané popisky (Architects Daughter).
 */
(function () {
  'use strict';

  var PI2 = Math.PI * 2;
  var R1 = function (v) { return Math.round(v * 10) / 10; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- geometrie ---------- */
  function polyArea(p) { var a = 0; for (var i = 0; i < p.length; i++) { var j = (i + 1) % p.length; a += p[i][0] * p[j][1] - p[j][0] * p[i][1]; } return Math.abs(a) / 2; }
  function centroid(p) { var x = 0, y = 0; p.forEach(function (q) { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
  function inPoly(pt, p) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
      var xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function segDist(pt, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy);
  }
  function edgeDist(pt, p, edges) {
    var d = Infinity;
    for (var i = 0; i < p.length; i++) { if (edges && edges.indexOf(i) < 0) continue; d = Math.min(d, segDist(pt, p[i], p[(i + 1) % p.length])); }
    return d;
  }
  function seeded(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------- rozmístění rostlin v záhonu ---------- */
  // bed.poly v metrech; bed.back = indexy hran u plotu/zdi (tam patří vysoké rostliny);
  // bed.plants = [{key, spon (m), height (m), share (podíl plochy)}].
  function layoutBed(bed, seed) {
    var poly = bed.poly, area = polyArea(poly), rnd = seeded(seed);
    var species = bed.plants.slice().sort(function (a, b) { return b.height - a.height; });
    var minSpon = Math.min.apply(null, species.map(function (s) { return s.spon; }));
    var g = Math.max(0.12, minSpon / 2.2);
    var xs = poly.map(function (q) { return q[0]; }), ys = poly.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var cand = [];
    for (var y = y0, row = 0; y <= y1; y += g * 0.866, row++) {
      for (var x = x0 + (row % 2 ? g / 2 : 0); x <= x1; x += g) {
        var pt = [x + (rnd() - 0.5) * g * 0.35, y + (rnd() - 0.5) * g * 0.35];
        if (!inPoly(pt, poly)) continue;
        // bed.blocked: stávající rostliny/prvky v záhonu [{x, y, r}] – kolem nich se nesází.
        if (bed.blocked && bed.blocked.some(function (b) { return Math.hypot(pt[0] - b.x, pt[1] - b.y) < b.r; })) continue;
        cand.push({ p: pt, edge: edgeDist(pt, poly), back: bed.back ? edgeDist(pt, poly, bed.back) : null });
      }
    }
    var placed = [];
    species.forEach(function (sp) {
      var target = Math.max(1, Math.round(area * sp.share / (sp.spon * sp.spon)));
      var order = cand.slice().sort(function (a, b) { return bed.back ? a.back - b.back : b.edge - a.edge; });
      var n = 0;
      for (var i = 0; i < order.length && n < target; i++) {
        var c = order[i];
        if (c.edge < Math.min(sp.spon * 0.4, 0.35)) continue;
        var ok = true;
        for (var k = 0; k < placed.length; k++) {
          var q = placed[k];
          if (Math.hypot(q.p[0] - c.p[0], q.p[1] - c.p[1]) < (q.sp.spon + sp.spon) / 2 * 0.92) { ok = false; break; }
        }
        if (!ok) continue;
        placed.push({ p: c.p, sp: sp });
        n++;
      }
    });
    return placed;
  }

  /* ---------- symboly ---------- */
  function lob(r, n, amp, rot, ox, oy) {
    var d = '';
    for (var i = 0; i <= n; i++) {
      var a = rot + i / n * PI2, am = rot + (i - 0.5) / n * PI2;
      var x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r;
      d += i === 0 ? 'M' + R1(x) + ' ' + R1(y) + ' ' : 'Q' + R1(ox + Math.cos(am) * r * (1 + amp)) + ' ' + R1(oy + Math.sin(am) * r * (1 + amp)) + ' ' + R1(x) + ' ' + R1(y) + ' ';
    }
    return d + 'Z';
  }
  function star(ox, oy, ro, ri, n, rot) {
    var d = '';
    for (var i = 0; i < n * 2; i++) {
      var a = rot + i / (n * 2) * PI2, r = i % 2 === 0 ? ro * (0.85 + 0.15 * Math.sin(i * 1.7)) : ri;
      d += (i === 0 ? 'M' : 'L') + R1(ox + Math.cos(a) * r) + ' ' + R1(oy + Math.sin(a) * r) + ' ';
    }
    return d + 'Z';
  }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var m = function (c) { return Math.max(0, Math.min(255, Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)))); };
    return '#' + ((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1);
  }
  // kind: tree | conifer | shrub | grass | perennial | lowgrass ; leaf/flower = barvy ; r = poloměr v px
  function symbol(kind, x, y, r, leaf, flower, rnd) {
    var rot = rnd() * PI2, s = '';
    var shadow = '<ellipse cx="' + R1(x + r * 0.25) + '" cy="' + R1(y + r * 0.3) + '" rx="' + R1(r * 0.98) + '" ry="' + R1(r * 0.92) + '" fill="#22301F" opacity="0.2"/>';
    if (kind === 'grass' || kind === 'lowgrass') {
      s += shadow;
      s += '<path d="' + star(x, y, r, r * 0.3, kind === 'grass' ? 28 : 20, rot) + '" fill="' + shade(leaf, -0.18) + '" stroke="' + shade(leaf, -0.4) + '" stroke-width="0.7" stroke-linejoin="round"/>';
      s += '<path d="' + star(x, y, r * 0.72, r * 0.22, kind === 'grass' ? 24 : 16, rot + 0.13) + '" fill="' + shade(leaf, 0.3) + '"/>';
      if (kind === 'grass') s += '<circle cx="' + R1(x) + '" cy="' + R1(y) + '" r="' + R1(r * 0.15) + '" fill="' + shade(leaf, -0.3) + '"/>';
      return s;
    }
    var n = kind === 'tree' ? 11 : kind === 'conifer' ? 9 : 8;
    s += shadow;
    s += '<path d="' + lob(r, n, kind === 'conifer' ? 0.18 : 0.24, rot, x, y) + '" fill="' + shade(leaf, -0.15) + '" stroke="' + shade(leaf, -0.42) + '" stroke-width="0.8"/>';
    s += '<path d="' + lob(r * 0.72, n - 2, 0.28, rot + 0.4, x - r * 0.16, y - r * 0.16) + '" fill="' + shade(leaf, 0.12) + '"/>';
    s += '<circle cx="' + R1(x - r * 0.32) + '" cy="' + R1(y - r * 0.34) + '" r="' + R1(r * 0.22) + '" fill="' + shade(leaf, 0.42) + '" opacity="0.85"/>';
    if (flower) {
      var cnt = kind === 'perennial' ? 7 : 5, fr = kind === 'perennial' ? r * 0.17 : r * 0.28;
      for (var i = 0; i < cnt; i++) {
        var a = rot + i / cnt * PI2 + rnd() * 0.5, d = r * (0.25 + rnd() * 0.45);
        s += '<circle cx="' + R1(x + Math.cos(a) * d) + '" cy="' + R1(y + Math.sin(a) * d) + '" r="' + R1(fr * (0.8 + rnd() * 0.4)) + '" fill="' + (i % 2 ? flower : shade(flower, -0.15)) + '"' + (flower.toLowerCase() === '#ffffff' || flower.toLowerCase() === '#fbfaf2' ? ' stroke="#D5D2C3" stroke-width="0.8"' : '') + '/>';
      }
    }
    return s;
  }

  var DEFS = '<defs>'
    + '<filter id="mvgPaint" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>'
    + '<filter id="mvgGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.22  0 0 0 0 0.18  0 0 0 0.09 0"/></filter>'
    + '<pattern id="mvgLawn" width="70" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><rect width="70" height="70" fill="#B4D392"/><rect width="35" height="70" fill="#A9CB86"/><path d="M8 12 l2 -4 M30 40 l2 -4 M50 18 l-2 -4 M60 55 l2 -4 M18 60 l-2 -4" stroke="#97BC74" stroke-width="1.2"/></pattern>'
    + '<pattern id="mvgGravel" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#ECE8DD"/><circle cx="3" cy="4" r="1.8" fill="#D5CFC0"/><circle cx="11" cy="10" r="1.6" fill="#FFFFFF"/><circle cx="8" cy="2" r="1.1" fill="#CBC4B3"/><circle cx="14" cy="4" r="1.3" fill="#DED8CA"/><circle cx="4" cy="13" r="1.5" fill="#FFFFFF"/></pattern>'
    + '<pattern id="mvgMulch" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#8C6C4D"/><circle cx="3" cy="4" r="1.6" fill="#A2805D"/><circle cx="10" cy="9" r="1.4" fill="#73553B"/><circle cx="7" cy="2" r="1" fill="#9A7856"/><circle cx="4" cy="11" r="1.3" fill="#A2805D"/></pattern>'
    + '<pattern id="mvgStone" width="44" height="26" patternUnits="userSpaceOnUse"><rect width="44" height="26" fill="#A79D8C"/><rect x="1" y="1" width="24" height="11" rx="3" fill="#CFC6B5"/><rect x="27" y="1" width="16" height="11" rx="3" fill="#C3B9A6"/><rect x="1" y="14" width="13" height="11" rx="3" fill="#C3B9A6"/><rect x="16" y="14" width="27" height="11" rx="3" fill="#D6CEBF"/></pattern>'
    + '<pattern id="mvgPaving" width="36" height="20" patternUnits="userSpaceOnUse"><rect width="36" height="20" fill="#9C978E"/><rect x="1" y="1" width="16" height="8" rx="1.5" fill="#B9B4AA"/><rect x="19" y="1" width="16" height="8" rx="1.5" fill="#B1ACA2"/><rect x="-8" y="11" width="16" height="8" rx="1.5" fill="#B1ACA2"/><rect x="10" y="11" width="16" height="8" rx="1.5" fill="#BDB8AE"/><rect x="28" y="11" width="16" height="8" rx="1.5" fill="#B9B4AA"/></pattern>'
    + '<pattern id="mvgRoof" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#6E6A66"/><path d="M0 0 L0 10" stroke="#5C5854" stroke-width="3"/></pattern>'
    + '</defs>';
  var FILL = { lawn: 'url(#mvgLawn)', gravel: 'url(#mvgGravel)', mulch: 'url(#mvgMulch)', paving: 'url(#mvgPaving)', stone: 'url(#mvgStone)', outside: '#E7E3D6' };
  var LABEL_FONT = "font-family=\"'Architects Daughter', cursive\"";
  var HALO = ' paint-order="stroke" stroke="#FBFAF4" stroke-width="5" stroke-linejoin="round"';

  /* ---------- výkres ---------- */
  // Vrací { html, legend:[{num,key,name,latin,count,...}], placed } – legend slouží i rozpočtu.
  function renderPlan(project, opts) {
    opts = opts || {};
    var W = 1300, H = 1096, M = 30;
    var site = project.site, sc = Math.min((W - 2 * M) / site.w, (H - 2 * M) / site.h);
    var ox = (W - site.w * sc) / 2, oy = (H - site.h * sc) / 2;
    var X = function (m) { return R1(ox + m * sc); }, Y = function (m) { return R1(oy + m * sc); };
    var path = function (p, close) { return p.map(function (q, i) { return (i ? 'L' : 'M') + X(q[0]) + ' ' + Y(q[1]); }).join(' ') + (close === false ? '' : ' Z'); };
    var rnd = seeded(project.seed || 7);
    var out = '<svg class="mvg2-plan__svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Osazovací plán – ' + (project.title || '')) + '">' + DEFS;
    out += '<rect width="' + W + '" height="' + H + '" fill="#F4F1E7"/>';

    // 1) plochy (sousední pozemky, trávník, záhony, dlažba) – malovaný filtr na měkké okraje
    var areas = project.areas || [];
    areas.filter(function (a) { return a.type === 'outside' || a.type === 'building'; }).forEach(function (a) {
      out += '<path d="' + path(a.poly) + '" fill="' + (a.type === 'building' ? 'url(#mvgRoof)' : FILL.outside) + '"' + (a.type === 'building' ? ' stroke="#4E4A46" stroke-width="2"' : '') + '/>';
    });
    out += '<g filter="url(#mvgPaint)">';
    areas.filter(function (a) { return a.type === 'lawn'; }).forEach(function (a) { out += '<path d="' + path(a.poly) + '" fill="' + FILL.lawn + '"/>'; });
    (project.beds || []).forEach(function (b) { out += '<path d="' + path(b.poly) + '" fill="' + (FILL[b.surface] || FILL.mulch) + '" stroke="#B9B2A1" stroke-width="2"/>'; });
    (project.paths || []).forEach(function (p) {
      var d = path(p.line, false), w = R1(p.width * sc);
      out += '<path d="' + d + '" fill="none" stroke="' + (FILL[p.surface] || FILL.gravel) + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
    });
    out += '</g>';
    areas.filter(function (a) { return a.type === 'paving'; }).forEach(function (a) { out += '<path d="' + path(a.poly) + '" fill="' + FILL.paving + '" stroke="#6E6A62" stroke-width="2"/>'; });

    // 2) šlapáky na cestách
    (project.paths || []).filter(function (p) { return p.stones; }).forEach(function (p) {
      var pts = [], acc = 0, step = p.stones * sc, carry = step / 2, k = 0;
      for (var i = 1; i < p.line.length; i++) {
        var a = [ox + p.line[i - 1][0] * sc, oy + p.line[i - 1][1] * sc], b = [ox + p.line[i][0] * sc, oy + p.line[i][1] * sc];
        var len = Math.hypot(b[0] - a[0], b[1] - a[1]), t = carry;
        while (t <= len) { pts.push([a[0] + (b[0] - a[0]) * t / len, a[1] + (b[1] - a[1]) * t / len, k++]); t += step; }
        carry = t - len; acc += len;
      }
      var rx = R1(p.width * sc * 0.32), ry = R1(p.width * sc * 0.21);
      pts.forEach(function (q) {
        var off = q[2] % 2 ? rx * 0.3 : -rx * 0.3;
        out += '<ellipse cx="' + R1(q[0] + off + 3) + '" cy="' + R1(q[1] + 4) + '" rx="' + rx + '" ry="' + ry + '" fill="#22301F" opacity="0.2"/>'
          + '<ellipse cx="' + R1(q[0] + off) + '" cy="' + R1(q[1]) + '" rx="' + rx + '" ry="' + ry + '" fill="#8F8B83" stroke="#6F6B64" stroke-width="1.2"/>'
          + '<ellipse cx="' + R1(q[0] + off - rx * 0.18) + '" cy="' + R1(q[1] - ry * 0.2) + '" rx="' + R1(rx * 0.62) + '" ry="' + R1(ry * 0.55) + '" fill="#ABA79E"/>';
      });
    });

    // 3) zdi, stavby, ploty
    (project.walls || []).forEach(function (w) {
      out += '<path d="' + path(w.line, false) + '" fill="none" stroke="url(#mvgStone)" stroke-width="' + R1(w.width * sc) + '"/>';
    });
    (project.structures || []).forEach(function (s) {
      var c = centroid(s.poly);
      out += '<path d="' + path(s.poly) + '" fill="#5A4A40" stroke="#3B2F28" stroke-width="2.5"/>';
      out += s.poly.map(function (q) { return '<path d="M' + X(q[0]) + ' ' + Y(q[1]) + ' L' + X(c[0]) + ' ' + Y(c[1]) + '" stroke="#3B2F28" stroke-width="1.6"/>'; }).join('');
    });
    (project.fences || []).forEach(function (f) {
      out += '<path d="' + path(f.line, false) + '" fill="none" stroke="#5C3B2C" stroke-width="5"/>';
      for (var i = 1; i < f.line.length; i++) {
        var a = f.line[i - 1], b = f.line[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
        for (var t = 0.1; t < len; t += 0.22) {
          var px = a[0] + ux * t, py = a[1] + uy * t, n = 0.1;
          out += '<path d="M' + X(px - uy * n) + ' ' + Y(py + ux * n) + ' L' + X(px + uy * n) + ' ' + Y(py - ux * n) + '" stroke="#7A5240" stroke-width="2.5"/>';
        }
      }
    });

    // 4) rostliny – rozmístění podle sponu, kreslené odzadu dopředu
    var legend = [], legendByKey = {}, placedAll = [];
    (project.beds || []).forEach(function (b, bi) {
      var placed = layoutBed(b, (project.seed || 7) + bi * 31);
      placed.forEach(function (pl) {
        var sp = pl.sp;
        if (!legendByKey[sp.key]) { legendByKey[sp.key] = { key: sp.key, name: sp.name, latin: sp.latin, kind: sp.kind, leaf: sp.leaf, flower: sp.flower, count: 0, inst: [] }; legend.push(legendByKey[sp.key]); }
        legendByKey[sp.key].count++;
        legendByKey[sp.key].inst.push(pl.p);
        placedAll.push(pl);
      });
    });
    (project.existingPlants || []).forEach(function (e) { placedAll.push({ p: [e.x, e.y], sp: e, existing: true }); });
    placedAll.sort(function (a, b) { return a.p[1] - b.p[1]; });
    out += '<g>';
    placedAll.forEach(function (pl) {
      var sp = pl.sp, r = Math.max(6, (pl.existing ? sp.r : sp.spon * 0.55) * sc);
      out += symbol(sp.kind, ox + pl.p[0] * sc, oy + pl.p[1] * sc, r, sp.leaf, sp.flower, rnd);
    });
    out += '</g>';

    // 5) čísla druhů (u rostliny nejblíž středu každé skupiny) a popisky ploch
    // Číslo se dává k rostlině nejblíž středu skupiny, ale ne blíž než ~70 px k jinému číslu –
    // jinak se čísla druhů ze stejného záhonu nahloučí na jedno místo.
    var badges = [], minGap = 70 / sc;
    legend.forEach(function (l, i) {
      l.num = i + 1;
      var c = centroid(l.inst);
      var order = l.inst.slice().sort(function (a, b) { return Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]); });
      var best = order.find(function (p) { return badges.every(function (q) { return Math.hypot(p[0] - q[0], p[1] - q[1]) >= minGap; }); }) || order[0];
      badges.push(best);
      out += '<circle cx="' + X(best[0]) + '" cy="' + Y(best[1]) + '" r="13" fill="#2E5E2C" stroke="#FFFFFF" stroke-width="2.5"/>'
        + '<text x="' + X(best[0]) + '" y="' + R1(oy + best[1] * sc + 5) + '" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="14" fill="#FFFFFF">' + l.num + '</text>';
    });
    (project.labels || []).forEach(function (lb) {
      out += '<text x="' + X(lb.x) + '" y="' + Y(lb.y) + '" text-anchor="middle" ' + LABEL_FONT + ' font-size="' + (lb.size || 22) + '" fill="' + (lb.color || '#1E2A22') + '"' + HALO + (lb.spacing ? ' letter-spacing="' + lb.spacing + '"' : '') + '>' + esc(lb.text) + '</text>';
    });

    // 6) severka, měřítko, papír
    var nr = project.north || 0;
    out += '<g transform="translate(' + (W - 80) + ' ' + (H - 90) + ') rotate(' + nr + ')"><circle r="40" fill="#FBFAF4" stroke="#2F3A33" stroke-width="1.5"/><path d="M0 -32 L11 13 L0 5 L-11 13 Z" fill="#2F3A33"/><text y="-44" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="15" fill="#2F3A33">S</text></g>';
    var unit = [1, 2, 5, 10].filter(function (u) { return u * sc >= 50; })[0] || 10;
    out += '<g transform="translate(' + (W - 330) + ' ' + (H - 40) + ')"><rect x="-10" y="-24" width="' + R1(unit * sc * 3 + 30) + '" height="52" rx="6" fill="#FBFAF4" opacity="0.92"/>';
    for (var u = 0; u < 3; u++) out += '<rect x="' + R1(u * unit * sc) + '" y="-8" width="' + R1(unit * sc) + '" height="8" fill="' + (u % 2 ? '#FBFAF4' : '#2F3A33') + '" stroke="#2F3A33" stroke-width="1.2"/><text x="' + R1(u * unit * sc) + '" y="17" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" fill="#2F3A33">' + (u * unit) + '</text>';
    out += '<text x="' + R1(3 * unit * sc) + '" y="17" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" fill="#2F3A33">' + (3 * unit) + ' m</text></g>';
    out += '<rect width="' + W + '" height="' + H + '" filter="url(#mvgGrain)" pointer-events="none"/></svg>';
    return { svg: out, legend: legend, scale: sc };
  }

  // Malá ikonka druhu do legendy (stejný symbol jako ve výkresu).
  function legendIcon(l) {
    return '<svg class="mvg2-legend__icon" viewBox="-22 -22 44 44" aria-hidden="true">' + symbol(l.kind, 0, 0, 17, l.leaf, l.flower, seeded(3)) + '</svg>';
  }

  /* ---------- celý list (výkres + razítko) ---------- */
  function renderSheet(project) {
    var r = renderPlan(project);
    var legendRows = r.legend.map(function (l) {
      return '<tr><td><span class="mvg2-num">' + l.num + '</span></td><td>' + legendIcon(l) + '</td><td class="mvg2-legend__count">' + l.count + '</td><td><strong>' + esc(l.name) + '</strong><em>' + esc(l.latin) + '</em></td></tr>';
    }).join('');
    var b = project.brand || {};
    var photos = '';
    if (project.photoBefore || project.photoAfter) {
      photos = '<div class="mvg2-sheet__photos">'
        + (project.photoBefore ? '<figure><img src="' + esc(project.photoBefore) + '" alt="Zahrada před úpravou"><figcaption><strong>PŘED</strong> · původní stav</figcaption></figure>' : '')
        + (project.photoAfter ? '<figure><img src="' + esc(project.photoAfter) + '" alt="Vizualizace návrhu"><figcaption><strong>PO</strong> · vizualizace AI</figcaption></figure>' : '')
        + '</div>';
    }
    var stamp = [['VÝKRES', 'Osazovací plán'], ['MĚŘÍTKO', 'orientační'], ['DATUM', project.date || ''], ['LIST', '1 / 1'], ['ZPRACOVAL', 'MVGreen AI architekt'], ['KONTAKT', b.phone || '']];
    var html = '<div class="mvg2-sheet">'
      + '<div class="mvg2-sheet__plan">' + r.svg + '</div>'
      + '<aside class="mvg2-sheet__side">'
      + '<div class="mvg2-sheet__brand">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="MV GREEN">' : '') + '<div><strong>MV GREEN</strong><span>Péče o zeleň bez starostí</span><span>' + esc((b.web || '') + (b.phone ? ' · ' + b.phone : '')) + '</span></div></div>'
      + '<div class="mvg2-sheet__title"><span>OSAZOVACÍ PLÁN</span><strong>' + esc(project.title || '') + '</strong><em>' + esc(project.place || '') + '</em></div>'
      + photos
      + '<div class="mvg2-sheet__legend"><span class="mvg2-cap">LEGENDA ROSTLIN</span><table>' + legendRows + '</table></div>'
      + '<div class="mvg2-sheet__stamp">' + stamp.map(function (s) { return '<div><span>' + s[0] + '</span><strong>' + esc(s[1]) + '</strong></div>'; }).join('') + '</div>'
      + '</aside></div>';
    return { html: html, legend: r.legend };
  }

  window.MVGreenPlan = { renderPlan: renderPlan, renderSheet: renderSheet, layoutBed: layoutBed, polyArea: polyArea };
})();
