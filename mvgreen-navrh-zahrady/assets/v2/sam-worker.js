/*
 * MVGreen – SlimSAM-50 ve Web Workeru (2026-11-10). Výpočet trvá na PC ~20–30 s a v hlavním vlákně
 * stránku zmrazil (točítko stálo, na mobilu by to vypadalo jako pád). Viz sam.js.
 *
 * Zprávy: {type:'prepare', base} → {type:'ready'} | {type:'error', message}
 *         {type:'segment', id, w, h, rgba (ArrayBuffer), boxes:[[x0,y0,x1,y1] px]} →
 *         {type:'masks', id, masks:[{x0,y0,w,h,bits (Uint8Array 0/1), score} | null]}
 */
var MODEL = 'Xenova/slimsam-50-uniform';
var S = null;

function prepare(base) {
  if (S) return S;
  S = import(base + 'transformers.min.js').then(function (T) {
    T.env.allowRemoteModels = false; T.env.allowLocalModels = true;
    T.env.localModelPath = base + 'models/';
    T.env.backends.onnx.wasm.wasmPaths = base + 'ort/';
    return Promise.all([T.SamModel.from_pretrained(MODEL, { dtype: 'q8', device: 'wasm' }), T.AutoProcessor.from_pretrained(MODEL)])
      .then(function (r) { return { T: T, model: r[0], proc: r[1] }; });
  });
  S.catch(function () { S = null; });
  return S;
}

// Obdélník jako dva rohové body (štítky 2 a 3) – tento export modelu nemá vstup input_boxes.
// Druhý pokus přidá kladný bod do středu: v prohlížeči (wasm, q8) dal samotný obdélník u Martinova
// domu jistotu 0,52 a jen pruh fasády, se středem 0,97 a celý dům. U tvarů, kde střed na objekt
// nepadne (plot, cesta), vyhraje pokus bez středu – bere se maska s nejvyšší jistotou z obou.
function segment(M, msg) {
  var w = msg.w, h = msg.h;
  var img = new M.T.RawImage(new Uint8ClampedArray(msg.rgba), w, h, 4).rgb();
  var corners = msg.boxes.map(function (b) { return [[b[0], b[1]], [b[2], b[3]]]; });
  var withMid = corners.map(function (p) { return p.concat([[(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]]); });
  function run(emb, pts, lab) {
    return M.proc(img, { input_points: [pts], input_labels: [pts.map(function () { return lab; })] }).then(function (inp) {
      return M.model(Object.assign({}, emb, { input_points: inp.input_points, input_labels: inp.input_labels })).then(function (out) {
        return M.proc.post_process_masks(out.pred_masks, inp.original_sizes, inp.reshaped_input_sizes).then(function (masks) {
          return { m: masks[0], sc: out.iou_scores.data };
        });
      });
    });
  }
  return M.proc(img).then(function (inp0) {
    return M.model.get_image_embeddings(inp0).then(function (emb) {
      return run(emb, corners, [2, 3]).then(function (A) {
        return run(emb, withMid, [2, 3, 1]).then(function (B) {
          var R = [A, B], nm = A.m.dims[1];
          return msg.boxes.map(function (b, i) {
            var md = null, best = 0, bs = -1;
            R.forEach(function (r) { for (var q = 0; q < nm; q++) if (r.sc[i * nm + q] > bs) { bs = r.sc[i * nm + q]; best = q; md = r.m.data; } });
            var X0 = Math.max(0, Math.floor(b[0])), Y0 = Math.max(0, Math.floor(b[1]));
            var X1 = Math.min(w, Math.ceil(b[2])), Y1 = Math.min(h, Math.ceil(b[3])), bw = X1 - X0, bh = Y1 - Y0;
            if (bw < 2 || bh < 2) return null;
            var bits = new Uint8Array(bw * bh), off = (i * nm + best) * w * h, any = 0;
            for (var yy = 0; yy < bh; yy++) for (var xx = 0; xx < bw; xx++) if (md[off + (Y0 + yy) * w + X0 + xx]) { bits[yy * bw + xx] = 1; any++; }
            if (any < bw * bh * 0.02) return null;   // prázdná maska → zůstane jen box
            return { x0: X0, y0: Y0, w: bw, h: bh, bits: bits, score: Math.round(bs * 100) / 100 };
          });
        });
      });
    });
  });
}

self.onmessage = function (e) {
  var msg = e.data || {};
  if (msg.type === 'prepare') {
    prepare(msg.base).then(function () { self.postMessage({ type: 'ready' }); }, function (err) { self.postMessage({ type: 'error', message: String(err && err.message || err) }); });
  } else if (msg.type === 'segment') {
    prepare(msg.base).then(function (M) { return segment(M, msg); }).then(function (masks) {
      self.postMessage({ type: 'masks', id: msg.id, masks: masks }, masks.filter(Boolean).map(function (m) { return m.bits.buffer; }));
    }, function (err) { self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message || err) }); });
  }
};
