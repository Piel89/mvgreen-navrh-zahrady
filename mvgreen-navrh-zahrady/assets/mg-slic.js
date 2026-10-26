// mg-slic.js — client-side superpixel segmentation (SLIC), for marking "co zůstane" on an
// uploaded garden photo. Runs entirely in the browser on ImageData from a <canvas>: no server
// round-trip, no external dependency. Ported from the algorithm behind Python's
// skimage.segmentation.slic (same Lab-space iterative clustering + connectivity enforcement),
// since the prototype's test photo was pre-segmented offline with that exact function and we
// need the same visual result for arbitrary customer photos, computed on the spot.
//
// Usage:
//   const { labels, numSegments } = MGSlic.segment(imageData, { numSegments: 3000, compactness: 12 });
//   // labels: Int32Array, length = width*height, values 1..numSegments (0 never used)

(function (global) {
  'use strict';

  // sRGB (0-255) -> CIE Lab (D65 white point), matching skimage.color.rgb2lab's defaults -
  // needed because SLIC's "color distance" has to track human-perceived similarity, not raw RGB
  // difference, or segment boundaries hug the wrong edges (RGB distance over-weights brightness).
  function srgbToLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  var Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  function labF(t) {
    var d = 6 / 29;
    return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
  }
  function rgbToLab(r, g, b, out) {
    var rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b);
    var X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
    var Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
    var Z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
    var fx = labF(X / Xn), fy = labF(Y / Yn), fz = labF(Z / Zn);
    out[0] = 116 * fy - 16;
    out[1] = 500 * (fx - fy);
    out[2] = 200 * (fy - fz);
  }

  function segment(imageData, opts) {
    opts = opts || {};
    var numSegmentsTarget = opts.numSegments || 1000;
    var compactness = opts.compactness != null ? opts.compactness : 10;
    var maxIter = opts.maxIter || 10;
    var W = imageData.width, H = imageData.height;
    var data = imageData.data; // RGBA
    var N = W * H;

    var lab = new Float32Array(N * 3);
    var tmp = [0, 0, 0];
    for (var i = 0, p = 0; i < N; i++, p += 4) {
      rgbToLab(data[p], data[p + 1], data[p + 2], tmp);
      lab[i * 3] = tmp[0]; lab[i * 3 + 1] = tmp[1]; lab[i * 3 + 2] = tmp[2];
    }

    var S = Math.sqrt((W * H) / numSegmentsTarget); // grid spacing between initial centers

    var centersX = [], centersY = [];
    for (var y0 = S / 2; y0 < H; y0 += S) {
      for (var x0 = S / 2; x0 < W; x0 += S) {
        centersX.push(Math.min(W - 1, Math.round(x0)));
        centersY.push(Math.min(H - 1, Math.round(y0)));
      }
    }
    var K = centersX.length;

    // Nudge each center to the lowest-gradient spot in its 3x3 neighborhood, so a center doesn't
    // land exactly on a hard edge (which would make its initial color unrepresentative and bias
    // the first iteration).
    function gradientAt(x, y) {
      var x1 = Math.min(W - 1, x + 1), xm1 = Math.max(0, x - 1);
      var y1 = Math.min(H - 1, y + 1), ym1 = Math.max(0, y - 1);
      var iR = (y * W + x1) * 3, iL = (y * W + xm1) * 3;
      var iD = (y1 * W + x) * 3, iU = (ym1 * W + x) * 3;
      var dx = Math.abs(lab[iR] - lab[iL]) + Math.abs(lab[iR + 1] - lab[iL + 1]) + Math.abs(lab[iR + 2] - lab[iL + 2]);
      var dy = Math.abs(lab[iD] - lab[iU]) + Math.abs(lab[iD + 1] - lab[iU + 1]) + Math.abs(lab[iD + 2] - lab[iU + 2]);
      return dx + dy;
    }
    for (var k0 = 0; k0 < K; k0++) {
      var bx = centersX[k0], by = centersY[k0], bg = gradientAt(bx, by);
      for (var dyy = -1; dyy <= 1; dyy++) {
        for (var dxx = -1; dxx <= 1; dxx++) {
          var nx = centersX[k0] + dxx, ny = centersY[k0] + dyy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          var g = gradientAt(nx, ny);
          if (g < bg) { bg = g; bx = nx; by = ny; }
        }
      }
      centersX[k0] = bx; centersY[k0] = by;
    }

    var centerL = new Float32Array(K), centerA = new Float32Array(K), centerB = new Float32Array(K);
    for (var k1 = 0; k1 < K; k1++) {
      var ci = (centersY[k1] * W + centersX[k1]) * 3;
      centerL[k1] = lab[ci]; centerA[k1] = lab[ci + 1]; centerB[k1] = lab[ci + 2];
    }

    var labels = new Int32Array(N).fill(-1);
    var distance = new Float32Array(N);
    var mOverS = compactness / S;
    var mOverS2 = mOverS * mOverS;

    for (var iter = 0; iter < maxIter; iter++) {
      distance.fill(Infinity);
      for (var k = 0; k < K; k++) {
        var cx = centersX[k], cy = centersY[k];
        var cl = centerL[k], ca = centerA[k], cb = centerB[k];
        var xMin = Math.max(0, Math.round(cx - S)), xMax = Math.min(W - 1, Math.round(cx + S));
        var yMin = Math.max(0, Math.round(cy - S)), yMax = Math.min(H - 1, Math.round(cy + S));
        for (var y = yMin; y <= yMax; y++) {
          var rowBase = y * W;
          var dy2 = y - cy; dy2 = dy2 * dy2;
          for (var x = xMin; x <= xMax; x++) {
            var idx = rowBase + x;
            var li = idx * 3;
            var dL = lab[li] - cl, dA = lab[li + 1] - ca, dB = lab[li + 2] - cb;
            var dc2 = dL * dL + dA * dA + dB * dB;
            var dx = x - cx;
            var ds2 = dx * dx + dy2;
            var D = dc2 + ds2 * mOverS2; // squared combined SLIC distance
            if (D < distance[idx]) { distance[idx] = D; labels[idx] = k; }
          }
        }
      }
      var sumX = new Float64Array(K), sumY = new Float64Array(K);
      var sumL = new Float64Array(K), sumA = new Float64Array(K), sumB = new Float64Array(K);
      var count = new Int32Array(K);
      for (var yy = 0; yy < H; yy++) {
        var rb = yy * W;
        for (var xx = 0; xx < W; xx++) {
          var ii = rb + xx, kk = labels[ii];
          if (kk < 0) continue;
          sumX[kk] += xx; sumY[kk] += yy;
          var lli = ii * 3;
          sumL[kk] += lab[lli]; sumA[kk] += lab[lli + 1]; sumB[kk] += lab[lli + 2];
          count[kk]++;
        }
      }
      for (var k2 = 0; k2 < K; k2++) {
        if (count[k2] === 0) continue;
        centersX[k2] = sumX[k2] / count[k2]; centersY[k2] = sumY[k2] / count[k2];
        centerL[k2] = sumL[k2] / count[k2]; centerA[k2] = sumA[k2] / count[k2]; centerB[k2] = sumB[k2] / count[k2];
      }
    }

    var minSize = Math.max(1, Math.round((W * H) / (numSegmentsTarget * 4)));
    var finalLabels = enforceConnectivity(labels, W, H, minSize);

    var maxLabel = 0;
    for (var fi = 0; fi < N; fi++) if (finalLabels[fi] > maxLabel) maxLabel = finalLabels[fi];

    return { labels: finalLabels, numSegments: maxLabel };
  }

  // SLIC's per-pixel nearest-center assignment can leave a handful of disconnected stray pixels
  // or tiny islands belonging to a label whose "main body" is elsewhere in the image (common near
  // busy texture/noise). A brush-paint UI needs every "segment" to be one physically connected
  // blob the user can see and tap as a single shape - so flood-fill connected components of each
  // original label, then merge any component smaller than minSize into a touching neighbor via
  // union-find, and finally relabel 1..N sequentially.
  function enforceConnectivity(labels, W, H, minSize) {
    var N = W * H;
    var visited = new Uint8Array(N);
    var compOfPixel = new Int32Array(N).fill(-1);
    var compSize = [];
    var stack = new Int32Array(N);
    var numComps = 0;

    for (var start = 0; start < N; start++) {
      if (visited[start]) continue;
      var origLabel = labels[start];
      var sp = 0; stack[sp++] = start; visited[start] = 1;
      var cp = 0;
      while (sp > 0) {
        var i = stack[--sp];
        compOfPixel[i] = numComps;
        cp++;
        var x = i % W, y = (i - x) / W;
        if (x > 0) { var jL = i - 1; if (!visited[jL] && labels[jL] === origLabel) { visited[jL] = 1; stack[sp++] = jL; } }
        if (x < W - 1) { var jR = i + 1; if (!visited[jR] && labels[jR] === origLabel) { visited[jR] = 1; stack[sp++] = jR; } }
        if (y > 0) { var jU = i - W; if (!visited[jU] && labels[jU] === origLabel) { visited[jU] = 1; stack[sp++] = jU; } }
        if (y < H - 1) { var jD = i + W; if (!visited[jD] && labels[jD] === origLabel) { visited[jD] = 1; stack[sp++] = jD; } }
      }
      compSize.push(cp);
      numComps++;
    }

    var parent = new Int32Array(numComps);
    for (var c0 = 0; c0 < numComps; c0++) parent[c0] = c0;
    function find(c) { while (parent[c] !== c) { parent[c] = parent[parent[c]]; c = parent[c]; } return c; }
    function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }

    var compPixelLists = new Array(numComps);
    for (var c1 = 0; c1 < numComps; c1++) compPixelLists[c1] = [];
    for (var pi = 0; pi < N; pi++) compPixelLists[compOfPixel[pi]].push(pi);

    for (var c2 = 0; c2 < numComps; c2++) {
      if (compSize[c2] >= minSize) continue;
      var pixels = compPixelLists[c2];
      for (var qi = 0; qi < pixels.length; qi++) {
        var qidx = pixels[qi];
        var qx = qidx % W, qy = (qidx - qx) / W;
        var merged = false;
        if (qx > 0) { var nL = compOfPixel[qidx - 1]; if (nL !== c2) { union(c2, nL); merged = true; } }
        if (!merged && qx < W - 1) { var nR = compOfPixel[qidx + 1]; if (nR !== c2) { union(c2, nR); merged = true; } }
        if (!merged && qy > 0) { var nU = compOfPixel[qidx - W]; if (nU !== c2) { union(c2, nU); merged = true; } }
        if (!merged && qy < H - 1) { var nD = compOfPixel[qidx + W]; if (nD !== c2) { union(c2, nD); merged = true; } }
        if (merged) break;
      }
    }

    var out = new Int32Array(N);
    var rootToLabel = new Map();
    var nextLabel = 1;
    for (var oi = 0; oi < N; oi++) {
      var root = find(compOfPixel[oi]);
      var lbl = rootToLabel.get(root);
      if (lbl === undefined) { lbl = nextLabel++; rootToLabel.set(root, lbl); }
      out[oi] = lbl;
    }
    return out;
  }

  global.MGSlic = { segment: segment };
})(typeof window !== 'undefined' ? window : globalThis);

// mg-sky.js portion — auto-detect "sky" segments so the existing "Obloha automaticky" button can
// keep working once segmentation runs fresh, in-browser, per uploaded photo (the prototype's test
// photo had this precomputed offline; a live customer photo needs it computed on the spot too).
//
// Approach: a segment is "sky-like" by color (bright + either bluish or low-saturation/overcast),
// and the actual sky region is whatever connected group of sky-like segments touches the photo's
// top edge - this naturally follows sky visible between branches/rooflines without misclassifying
// a bright wall or pale gravel path lower in the frame that happens to share a similar color but
// isn't connected to the open sky above it.
(function (global) {
  'use strict';

  function detectSky(imageData, labels, numSegments) {
    var W = imageData.width, H = imageData.height, data = imageData.data, N = W * H;

    var sumR = new Float64Array(numSegments + 1), sumG = new Float64Array(numSegments + 1), sumB = new Float64Array(numSegments + 1);
    var sumY = new Float64Array(numSegments + 1);
    var count = new Int32Array(numSegments + 1);
    var touchesTop = new Uint8Array(numSegments + 1);
    for (var i = 0, p = 0; i < N; i++, p += 4) {
      var lbl = labels[i];
      sumR[lbl] += data[p]; sumG[lbl] += data[p + 1]; sumB[lbl] += data[p + 2];
      sumY[lbl] += Math.floor(i / W);
      count[lbl]++;
      if (i < W) touchesTop[lbl] = 1; // first row
    }

    var skyLike = new Uint8Array(numSegments + 1);
    var belowHorizonLimit = new Uint8Array(numSegments + 1); // too low in the frame to plausibly be sky
    for (var s = 1; s <= numSegments; s++) {
      if (!count[s]) continue;
      var r = sumR[s] / count[s], g = sumG[s] / count[s], b = sumB[s] / count[s];
      var maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
      var brightness = (r + g + b) / 3;
      var sat = maxC > 0 ? (maxC - minC) / maxC : 0;
      // Clear-sky blue: blue channel clearly leads red.
      var bluish = b > r + 16 && brightness > 90;
      // Overcast grey/white sky: low saturation AND genuinely neutral (blue not the weakest
      // channel) - a pale, washed-out painted wall (e.g. a light green or beige house) can have
      // low (max-min)/max saturation too, but there blue is usually the WEAKEST channel, not
      // roughly tied with or ahead of red/green the way real sky (even hazy/overcast) is.
      var neutral = b >= r - 6 && b >= g - 10;
      var overcast = sat < 0.10 && brightness > 160 && neutral;
      skyLike[s] = (bluish || overcast) ? 1 : 0;
      // Hard cap: nothing in the bottom ~35% of the frame counts as sky, however it's colored -
      // keeps a long chain of pale surfaces (path, fence, wall) from flood-filling far down from
      // a genuine sky patch higher up.
      belowHorizonLimit[s] = (sumY[s] / count[s]) > H * 0.45 ? 1 : 0;
    }

    // Adjacency: two segments are neighbors if any pixel pair across a horizontal/vertical
    // boundary has different labels.
    var adj = new Array(numSegments + 1);
    for (var a = 0; a <= numSegments; a++) adj[a] = null;
    function addAdj(x, y) {
      var i = y * W + x, l1 = labels[i];
      if (x < W - 1) { var l2 = labels[i + 1]; if (l2 !== l1) { (adj[l1] || (adj[l1] = new Set())).add(l2); (adj[l2] || (adj[l2] = new Set())).add(l1); } }
      if (y < H - 1) { var l3 = labels[i + W]; if (l3 !== l1) { (adj[l1] || (adj[l1] = new Set())).add(l3); (adj[l3] || (adj[l3] = new Set())).add(l1); } }
    }
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) addAdj(xx, yy);

    var isSky = new Uint8Array(numSegments + 1);
    var queue = [];
    for (var s2 = 1; s2 <= numSegments; s2++) {
      if (touchesTop[s2] && skyLike[s2] && !belowHorizonLimit[s2]) { isSky[s2] = 1; queue.push(s2); }
    }
    while (queue.length) {
      var cur = queue.pop();
      var neighbors = adj[cur];
      if (!neighbors) continue;
      neighbors.forEach(function (n) {
        if (!isSky[n] && skyLike[n] && !belowHorizonLimit[n]) { isSky[n] = 1; queue.push(n); }
      });
    }

    var ids = [];
    for (var s3 = 1; s3 <= numSegments; s3++) if (isSky[s3]) ids.push(s3);
    return ids;
  }

  global.MGSlic.detectSky = detectSky;
})(typeof window !== 'undefined' ? window : globalThis);
