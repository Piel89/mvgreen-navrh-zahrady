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
 * Výpočet běží ve Web Workeru (sam-worker.js) – v 0.6.243 v hlavním vlákně zmrazil stránku na ~30 s.
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
  var me = document.currentScript && document.currentScript.src;
  var workerUrl = me ? me.replace(/sam\.js(\?.*)?$/, 'sam-worker.js$1') : '';
  var ready = null, worker = null, base = '', seq = 0, waiting = {};

  function file(f) {
    var cfg = window.MVGreenAI || {}, fd = new FormData();
    fd.append('action', 'mvgreen_sam_file'); fd.append('nonce', cfg.nonce || ''); fd.append('f', f);
    return fetch(cfg.ajaxUrl, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { throw new Error('SAM ' + f + ': HTTP ' + r.status); }); })
      .then(function (j) { if (!j || !j.success) throw new Error((j && j.data && j.data.message) || ('SAM ' + f)); return j.data.base; });
  }

  function prepare() {
    if (ready) return ready;
    ready = FILES.reduce(function (p, f) { return p.then(function () { return file(f).then(function (b) { base = b; }); }); }, Promise.resolve())
      .then(function () {
        if (!workerUrl || typeof Worker === 'undefined') throw new Error('prohlížeč neumí Web Worker');
        return new Promise(function (ok, bad) {
          worker = new Worker(workerUrl, { type: 'module' });
          worker.onerror = function (e) { bad(new Error('worker: ' + (e.message || 'chyba'))); };
          worker.onmessage = function (e) {
            var m = e.data || {};
            if (m.type === 'ready') { ok(); return; }
            var w = m.id != null ? waiting[m.id] : null;
            if (m.type === 'error' && !w) { bad(new Error(m.message)); return; }
            if (!w) return;
            delete waiting[m.id];
            if (m.type === 'masks') w.ok(m.masks); else w.bad(new Error(m.message));
          };
          worker.postMessage({ type: 'prepare', base: base });
        });
      });
    ready.catch(function () { ready = null; if (worker) { worker.terminate(); worker = null; } });
    return ready;
  }

  // Test 0.6.246: SAM obkreslil bílé auto bez oken (přes sklo je vidět louka) → okna zůstala
  // „Mimo pozemek“ (zelená) uprostřed červeného auta. U pevných věcí se díry uvnitř masky vyplní.
  var SOLID = { car: 1, house: 1, neighbor: 1, shed: 1, container: 1, gate: 1 };
  function fillHoles(bits, w, h) {
    var seen = new Uint8Array(w * h), st = [], p;
    function push(q) { if (!bits[q] && !seen[q]) { seen[q] = 1; st.push(q); } }
    for (var x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (var y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (st.length) {
      p = st.pop(); var px = p % w;
      if (px > 0) push(p - 1); if (px < w - 1) push(p + 1);
      if (p >= w) push(p - w); if (p < w * (h - 1)) push(p + w);
    }
    for (p = 0; p < w * h; p++) if (!bits[p] && !seen[p]) bits[p] = 1;
  }

  function segment(src, objects) {
    var list = (objects || []).filter(function (o) { return o && o.box && o.box.length === 4 && o.box[2] > o.box[0] && o.box[3] > o.box[1]; });
    if (!list.length) return Promise.resolve(objects || []);
    return prepare().then(function () {
      var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, k = Math.min(1, 1024 / Math.max(sw, sh));
      var w = Math.round(sw * k), h = Math.round(sh * k);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
      var rgba = x.getImageData(0, 0, w, h).data.buffer;
      var boxes = list.map(function (o) { var b = o.box; return [b[1] / 1000 * w, b[0] / 1000 * h, b[3] / 1000 * w, b[2] / 1000 * h]; });
      var id = ++seq;
      return new Promise(function (ok, bad) {
        waiting[id] = { ok: ok, bad: bad };
        worker.postMessage({ type: 'segment', id: id, base: base, w: w, h: h, rgba: rgba, boxes: boxes }, [rgba]);
      }).then(function (masks) {
        list.forEach(function (o, i) {
          var m = masks[i]; if (!m) return;
          if (SOLID[o.kind]) fillHoles(m.bits, m.w, m.h);
          var cc = document.createElement('canvas'); cc.width = m.w; cc.height = m.h;
          var cx = cc.getContext('2d'), im = cx.createImageData(m.w, m.h), d = im.data;
          for (var p = 0; p < m.bits.length; p++) if (m.bits[p]) d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = d[p * 4 + 3] = 255;
          cx.putImageData(im, 0, 0);
          o.mask = cc.toDataURL('image/png'); o.sam = m.score;
          // maska přesně v rámci boxu, aby ji mark.js natáhl na stejné místo
          o.box = [m.y0 / h * 1000, m.x0 / w * 1000, (m.y0 + m.h) / h * 1000, (m.x0 + m.w) / w * 1000];
        });
        return objects;
      });
    });
  }

  window.MVGreenSamV2 = { prepare: prepare, segment: segment };
})();
