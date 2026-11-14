/*
 * MVGreen AI architekt v3 – promítnutí půdorysu do fotky zákazníka (2026-11-14).
 * Stejný kód kreslí 1) náhled „plán na fotce“ pro zákazníka a 2) PODKLAD pro AI obrázek: vizualizace se pak
 * maluje přesně podle půdorysu (dřív si AI kreslila, co chtěla, a z obrázku se hádal půdorys).
 * render(canvas, photo, model, H, opts) – H = homografie země (m) → fotka (0–1) z MVGreenGeo.calibrate().toPhoto.
 * model = { W, D, beds: [{poly, plants: [{x, y, r, h, c, leaf, k, layer, num}]}], paths: [{line, width, surface}],
 *           walls: [{line, height}], trees: [{at, num}] }
 * opts = { grid, plan, plants, numbers, guide } – guide: ploché barvy bez fotky (pro AI: hnědá = záhon, šedá = cesta …)
 */
(function (root) {
  'use strict';
  function render(cv, photo, M, H, o) {
    o = o || {};
    var cx = cv.getContext('2d');
    var ap = function (p) { var w = H[2][0] * p[0] + H[2][1] * p[1] + H[2][2]; return [(H[0][0] * p[0] + H[0][1] * p[1] + H[0][2]) / w * cv.width, (H[1][0] * p[0] + H[1][1] * p[1] + H[1][2]) / w * cv.height]; };
    var sc = function (p) { var b = ap([p[0] + 0.5, p[1]]), c = ap([p[0] - 0.5, p[1]]); return Math.hypot(b[0] - c[0], b[1] - c[1]); };
    var poly = function (pts, fill, stroke, lw) { cx.beginPath(); pts.forEach(function (p, i) { var q = ap(p); if (i) cx.lineTo(q[0], q[1]); else cx.moveTo(q[0], q[1]); }); cx.closePath(); if (fill) { cx.fillStyle = fill; cx.fill(); } if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = lw || 2; cx.stroke(); } };
    var offs = function (line, w) { var L = [], R = []; line.forEach(function (p, i) { var a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; L.push([p[0] + nx, p[1] + ny]); R.push([p[0] - nx, p[1] - ny]); }); return L.concat(R.reverse()); };
    var len = function (l) { var s = 0; for (var i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; };
    var along = function (l, t) { var s = 0; for (var i = 1; i < l.length; i++) { var d = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); if (s + d >= t) { var k = (t - s) / d; return { p: [l[i - 1][0] + (l[i][0] - l[i - 1][0]) * k, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * k], dir: [(l[i][0] - l[i - 1][0]) / d, (l[i][1] - l[i - 1][1]) / d] }; } s += d; } return { p: l[l.length - 1], dir: [0, 1] }; };
    var rnd = function (s) { var x = Math.sin(s) * 43758.5453; return x - Math.floor(x); };
    var shade = function (hex, f) { var n = parseInt(String(hex || '#4B7A40').slice(1), 16); return 'rgb(' + Math.min(255, Math.round((n >> 16 & 255) * f)) + ',' + Math.min(255, Math.round((n >> 8 & 255) * f)) + ',' + Math.min(255, Math.round((n & 255) * f)) + ')'; };
    var G_ = o.guide;   // podklad pro AI: jednoznačné ploché barvy

    cx.clearRect(0, 0, cv.width, cv.height);
    if (!G_ && photo) cx.drawImage(photo, 0, 0, cv.width, cv.height);
    if (G_) { cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height); }

    if (o.grid) {
      cx.save(); cx.strokeStyle = 'rgba(255,230,80,.85)'; cx.lineWidth = 1.2;
      for (var x = 0; x <= M.W + 0.01; x += 1) { var a = ap([x, 0]), b = ap([x, M.D]); cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); }
      for (var y = 0; y <= M.D + 0.01; y += 1) { var c = ap([0, y]), e = ap([M.W, y]); cx.beginPath(); cx.moveTo(c[0], c[1]); cx.lineTo(e[0], e[1]); cx.stroke(); }
      poly([[0, 0], [M.W, 0], [M.W, M.D], [0, M.D]], null, '#FFE14D', 3); cx.restore();
    }
    if (o.plan || G_) {
      poly([[0, 0], [M.W, 0], [M.W, M.D], [0, M.D]], G_ ? '#3FA34D' : 'rgba(110,170,70,.33)');
      (M.beds || []).forEach(function (b) { poly(b.poly, G_ ? '#6B4A2F' : 'rgba(92,62,38,.78)', G_ ? null : 'rgba(60,40,25,.9)', 2); });
      (M.paths || []).forEach(function (p) {
        if (p.surface === 'naslap' || !p.surface) {
          if (!G_) poly(offs(p.line, p.width), 'rgba(110,170,70,.25)');
          var L = len(p.line);
          for (var t = 0.35; t < L - 0.2; t += 0.62) { var A = along(p.line, t), u = A.dir, v = [-u[1], u[0]], c = A.p, pts = []; for (var k = 0; k < 10; k++) { var an = k / 10 * Math.PI * 2; pts.push([c[0] + v[0] * Math.cos(an) * 0.42 + u[0] * Math.sin(an) * 0.24, c[1] + v[1] * Math.cos(an) * 0.42 + u[1] * Math.sin(an) * 0.24]); } poly(pts, G_ ? '#BDBDBD' : '#C9C1B1', G_ ? null : '#8E8573', 1.2); }
        } else poly(offs(p.line, p.width), G_ ? '#BDBDBD' : 'rgba(205,198,184,.92)', G_ ? null : '#8E8573', 1.5);
      });
      (M.walls || []).forEach(function (w) {
        var base = w.line.map(ap), up = w.line.map(function (p, i) { return [base[i][0], base[i][1] - w.height * sc(p)]; });
        cx.beginPath(); base.forEach(function (q, i) { if (i) cx.lineTo(q[0], q[1]); else cx.moveTo(q[0], q[1]); }); for (var i = up.length - 1; i >= 0; i--) cx.lineTo(up[i][0], up[i][1]); cx.closePath();
        cx.fillStyle = G_ ? '#8A8A8A' : '#9A8F7D'; cx.fill(); if (!G_) { cx.strokeStyle = '#5F574A'; cx.lineWidth = 2; cx.stroke(); }
      });
    }
    if (o.plants) {
      var all = [];
      (M.beds || []).forEach(function (b) { (b.plants || []).forEach(function (p) { if (p.layer !== 'cibule') all.push(p); }); });
      (M.trees || []).forEach(function (t) { all.push({ x: t.at[0], y: t.at[1], tree: true, num: t.num }); });
      all.sort(function (a, b) { return b.y - a.y; });
      all.forEach(function (p) {
        var q = ap([p.x, p.y]), s = sc([p.x, p.y]), seed = p.x * 913 + p.y * 317;
        if (p.tree) { cx.strokeStyle = '#5A4632'; cx.lineWidth = Math.max(2, 0.12 * s); cx.beginPath(); cx.moveTo(q[0], q[1]); cx.lineTo(q[0], q[1] - 1.8 * s); cx.stroke(); cx.fillStyle = 'rgba(98,140,72,.9)'; cx.beginPath(); cx.ellipse(q[0], q[1] - 2.7 * s, 1.3 * s, 1.2 * s, 0, 0, 7); cx.fill(); }
        else {
          var rw = Math.max(2, p.r * s * 0.95), hh = Math.max(3, Math.min(p.h, 1.9) * s), leaf = p.leaf || '#4B7A40';
          if (p.k === 'grass' || p.k === 'lowgrass') {
            var n = Math.max(8, Math.round(rw * 1.6)); cx.lineCap = 'round';
            for (var i2 = 0; i2 < n; i2++) { var a2 = (rnd(seed + i2) - 0.5) * 1.3, ln = hh * (0.75 + 0.25 * rnd(seed + i2 * 3)); cx.strokeStyle = shade(leaf, 0.75 + 0.5 * rnd(seed + i2 * 7)); cx.lineWidth = Math.max(1, s * 0.02); cx.beginPath(); cx.moveTo(q[0] + (rnd(seed + i2 * 5) - 0.5) * rw * 0.5, q[1]); cx.quadraticCurveTo(q[0] + a2 * rw * 0.4, q[1] - ln * 0.6, q[0] + a2 * rw * 1.1, q[1] - ln); cx.stroke(); }
          } else {
            var cone = p.k === 'conifer', m = cone ? 1 : 0.55;
            for (var j = 0; j < 3; j++) { cx.fillStyle = shade(leaf, 0.7 + 0.15 * j); cx.beginPath(); cx.ellipse(q[0] + (j - 1) * rw * 0.18, q[1] - hh * 0.42 - j * hh * 0.04, rw * (1 - j * 0.12), hh * m * (1 - j * 0.1), 0, 0, 7); cx.fill(); }
            if (p.c && p.c !== leaf && !cone) { var nf = Math.max(5, Math.round(rw * rw / 10)); cx.fillStyle = p.c; for (var f = 0; f < nf; f++) { var ang = rnd(seed + f * 11) * Math.PI * 2, rr = Math.sqrt(rnd(seed + f * 13)); cx.beginPath(); cx.arc(q[0] + Math.cos(ang) * rr * rw * 0.85, q[1] - hh * 0.55 + Math.sin(ang) * rr * hh * 0.38, Math.max(1.2, s * 0.035), 0, 7); cx.fill(); } }
          }
        }
        if (o.numbers && (p.layer === 'kostra' || p.tree)) { var yy = q[1] - (p.tree ? 4.1 * s : Math.min(p.h, 1.8) * s + 8); cx.fillStyle = '#1F5A35'; cx.beginPath(); cx.arc(q[0], yy, 8, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = 'bold 10px sans-serif'; cx.textAlign = 'center'; cx.fillText(p.num, q[0], yy + 3.5); }
      });
    }
    return cv;
  }
  var api = { render: render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MVGreenRenderV3 = api;
})(typeof window !== 'undefined' ? window : this);
