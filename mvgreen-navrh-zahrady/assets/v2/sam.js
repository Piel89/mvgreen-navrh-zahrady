/*
 * MVGreen – přesné obrysy objektů modelem SlimSAM-50 přímo v prohlížeči (2026-11-10).
 *
 * Gemini vrátí objekty s obdélníkem (box), SAM v každém obdélníku obkreslí objekt na pixel.
 * Gemini samo obrysy kreslit neumí (test na Martinově fotce: „ani se to k dobrým obrysům
 * nepřibližuje“), SlimSAM-50 na téže fotce obkreslil dům, obě auta, štěrk i kůlnu.
 *
 * Soubory (transformers.js 3.5.1 + ONNX Runtime + model, ~57 MB) posílá náš server z uploads
 * (wp_ajax_mvgreen_sam_file je jednou stáhne a ověří) – prohlížeč se na cizí služby nepřipojuje.
 * Prohlížeč je pak drží v mezipaměti, další fotka už se nestahuje.
 *
 * MVGreenSamV2.prepare()                 → Promise (stáhne a načte model; volat co nejdřív)
 * MVGreenSamV2.segment(img, objects)     → Promise<objects> s o.mask = PNG dataURL uvnitř boxu
 */
(function () {
  'use strict';
  var MODEL = 'Xenova/slimsam-50-uniform';
  var FILES = ['transformers.min.js', 'ort/ort-wasm-simd-threaded.jsep.mjs', 'ort/ort-wasm-simd-threaded.jsep.wasm',
    'models/' + MODEL + '/config.json', 'models/' + MODEL + '/preprocessor_config.json',
    'models/' + MODEL + '/onnx/prompt_encoder_mask_decoder_quantized.onnx', 'models/' + MODEL + '/onnx/vision_encoder_quantized.onnx'];
  var ready = null;

  function file(f) {
    var cfg = window.MVGreenAI || {}, fd = new FormData();
    fd.append('action', 'mvgreen_sam_file'); fd.append('nonce', cfg.nonce || ''); fd.append('f', f);
    return fetch(cfg.ajaxUrl, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { throw new Error('SAM ' + f + ': HTTP ' + r.status); }); })
      .then(function (j) { if (!j || !j.success) throw new Error((j && j.data && j.data.message) || ('SAM ' + f)); return j.data.base; });
  }

  function prepare() {
    if (ready) return ready;
    var base = '';
    ready = FILES.reduce(function (p, f) { return p.then(function () { return file(f).then(function (b) { base = b; }); }); }, Promise.resolve())
      .then(function () { return import(base + 'transformers.min.js'); })
      .then(function (T) {
        T.env.allowRemoteModels = false; T.env.allowLocalModels = true;
        T.env.localModelPath = base + 'models/';
        T.env.backends.onnx.wasm.wasmPaths = base + 'ort/';
        return Promise.all([T.SamModel.from_pretrained(MODEL, { dtype: 'q8', device: 'wasm' }), T.AutoProcessor.from_pretrained(MODEL)])
          .then(function (r) { return { T: T, model: r[0], proc: r[1] }; });
      });
    ready.catch(function () { ready = null; });
    return ready;
  }

  function segment(src, objects) {
    var list = (objects || []).filter(function (o) { return o && o.box && o.box.length === 4 && o.box[2] > o.box[0] && o.box[3] > o.box[1]; });
    if (!list.length) return Promise.resolve(objects || []);
    return prepare().then(function (S) {
      var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, k = Math.min(1, 1024 / Math.max(sw, sh));
      var w = Math.round(sw * k), h = Math.round(sh * k);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
      var img = new S.T.RawImage(new Uint8ClampedArray(x.getImageData(0, 0, w, h).data), w, h, 4).rgb();
      // obdélník jako dva rohové body (štítky 2 a 3) – tento export modelu nemá vstup input_boxes.
      // Druhý pokus přidá kladný bod do středu obdélníku: v prohlížeči (wasm, q8) dal samotný
      // obdélník u Martinova domu jistotu 0,52 a jen pruh fasády, se středem 0,97 a celý dům.
      // U tvarů, kde střed na objekt nepadne (plot, cesta), vyhraje pokus bez středu – bere se
      // maska s nejvyšší jistotou modelu (iou) z obou pokusů.
      var corners = list.map(function (o) { var b = o.box; return [[b[1] / 1000 * w, b[0] / 1000 * h], [b[3] / 1000 * w, b[2] / 1000 * h]]; });
      var withMid = corners.map(function (p) { return p.concat([[(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]]); });
      function run(emb, pts, lab) {
        return S.proc(img, { input_points: [pts], input_labels: [pts.map(function () { return lab; })] }).then(function (inp) {
          return S.model(Object.assign({}, emb, { input_points: inp.input_points, input_labels: inp.input_labels })).then(function (out) {
            return S.proc.post_process_masks(out.pred_masks, inp.original_sizes, inp.reshaped_input_sizes).then(function (masks) {
              return { m: masks[0], sc: out.iou_scores.data };
            });
          });
        });
      }
      return S.proc(img).then(function (inp0) {
        return S.model.get_image_embeddings(inp0).then(function (emb) {
          return run(emb, corners, [2, 3]).then(function (A) { return run(emb, withMid, [2, 3, 1]).then(function (B) { return [A, B]; }); }).then(function (R) {
            {
              var nm = R[0].m.dims[1];
              list.forEach(function (o, i) {
                var md = R[0].m.data, sc = R[0].sc, best = 0, bs = -1;
                R.forEach(function (r) { for (var q = 0; q < nm; q++) if (r.sc[i * nm + q] > bs) { bs = r.sc[i * nm + q]; best = q; md = r.m.data; sc = r.sc; } });
                var b = o.box, X0 = Math.floor(b[1] / 1000 * w), Y0 = Math.floor(b[0] / 1000 * h);
                var X1 = Math.min(w, Math.ceil(b[3] / 1000 * w)), Y1 = Math.min(h, Math.ceil(b[2] / 1000 * h)), bw = X1 - X0, bh = Y1 - Y0;
                if (bw < 2 || bh < 2) return;
                var cc = document.createElement('canvas'); cc.width = bw; cc.height = bh;
                var cx = cc.getContext('2d'), id = cx.createImageData(bw, bh), d = id.data, off = (i * nm + best) * w * h, any = 0;
                for (var yy = 0; yy < bh; yy++) for (var xx = 0; xx < bw; xx++) {
                  if (!md[off + (Y0 + yy) * w + X0 + xx]) continue;
                  var p = (yy * bw + xx) * 4; d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 255; any++;
                }
                if (any < bw * bh * 0.02) return;   // prázdná maska → necháme jen box
                cx.putImageData(id, 0, 0);
                o.mask = cc.toDataURL('image/png'); o.sam = Math.round(sc[i * nm + best] * 100) / 100;
                // maska přesně v rámci boxu, aby ji mark.js natáhl na stejné místo
                o.box = [Y0 / h * 1000, X0 / w * 1000, Y1 / h * 1000, X1 / w * 1000];
              });
              return objects;
            }
          });
        });
      });
    });
  }

  window.MVGreenSamV2 = { prepare: prepare, segment: segment };
})();
