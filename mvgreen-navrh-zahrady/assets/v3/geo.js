/*
 * MVGreen AI architekt v3 – geometrie (2026-11-13).
 * Majitel: „vůbec to nemá nic společného s realitou“ – v2 hádala metry z perspektivní fotky pomocí AI
 * (stejný záhon jednou 2,8 m², podruhé 11,5 m²). v3: zákazník změří plochu a ťukne její 4 rohy na fotce →
 * homografie mezi fotkou a zemí v metrech. Půdorys je pak zdroj pravdy a na fotku se promítá přesně.
 * Funguje pro rovinu; u svahu je odchylka a projekt to musí přiznat (viz slopeWarning).
 */
(function (root) {
  'use strict';
  // Řešení 8×8 soustavy (Gauss s pivotem) pro homografii ze 4 dvojic bodů.
  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      var t = M[c]; M[c] = M[p]; M[p] = t;
      for (var r2 = 0; r2 < n; r2++) if (r2 !== c) { var f = M[r2][c] / M[c][c]; for (var k = c; k <= n; k++) M[r2][k] -= f * M[c][k]; }
    }
    return M.map(function (r, i) { return r[n] / r[i]; });
  }
  // src[i] → dst[i]; vrací 3×3 matici (řádky) nebo null, když jsou body v jedné přímce.
  function homography(src, dst) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = dst[i][0], v = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h = solve(A, b); if (!h) return null;
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  }
  function apply(H, p) {
    var w = H[2][0] * p[0] + H[2][1] * p[1] + H[2][2];
    return [(H[0][0] * p[0] + H[0][1] * p[1] + H[0][2]) / w, (H[1][0] * p[0] + H[1][1] * p[1] + H[1][2]) / w];
  }
  function invert(H) {
    var a = H[0][0], b = H[0][1], c = H[0][2], d = H[1][0], e = H[1][1], f = H[1][2], g = H[2][0], h = H[2][1], i = H[2][2];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-15) return null;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  /* Kalibrace: rohy upravované plochy ťuknuté na fotce (0–1, pořadí: vlevo vpředu, vpravo vpředu,
   * vpravo vzadu, vlevo vzadu) + změřená šířka a hloubka v metrech. Půdorys: x doprava, y od fotografa
   * dozadu (vlevo vpředu = [0, 0]). Kontrola: změřený referenční rozměr (např. šířka dlažby) se porovná
   * s tím, co z kalibrace vyjde – odchylka nad 15 % = zákazník musí měření opravit. */
  function calibrate(corners, widthM, depthM, check) {
    var dst = [[0, 0], [widthM, 0], [widthM, depthM], [0, depthM]];
    var toGround = homography(corners, dst); if (!toGround) return { ok: false, error: 'Rohy leží v jedné přímce – ťukněte je znovu.' };
    var toPhoto = invert(toGround);
    var out = { ok: true, toGround: toGround, toPhoto: toPhoto, width: widthM, depth: depthM };
    if (check && check.a && check.b && check.m) {
      var a = apply(toGround, check.a), b = apply(toGround, check.b), got = Math.hypot(a[0] - b[0], a[1] - b[1]);
      out.checkGot = got; out.checkErr = Math.abs(got - check.m) / check.m;
      if (out.checkErr > 0.15) { out.ok = false; out.error = 'Kontrolní rozměr nesedí: změřeno ' + check.m + ' m, z fotky vychází ' + got.toFixed(2) + ' m. Zkontrolujte měření a rohy.'; }
    }
    return out;
  }
  function polyArea(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
  function polyPerim(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }
  function inPoly(pt, p) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > pt[1]) !== (p[j][1] > pt[1]) && pt[0] < (p[j][0] - p[i][0]) * (pt[1] - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; }
  function segDist(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
  function edgeDist(pt, p, only) { var m = Infinity; for (var i = 0; i < p.length; i++) { if (only && only.indexOf(i) < 0) continue; m = Math.min(m, segDist(pt, p[i], p[(i + 1) % p.length])); } return m; }
  var api = { homography: homography, apply: apply, invert: invert, calibrate: calibrate, polyArea: polyArea, polyPerim: polyPerim, inPoly: inPoly, segDist: segDist, edgeDist: edgeDist };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MVGreenGeo = api;
})(typeof window !== 'undefined' ? window : this);
