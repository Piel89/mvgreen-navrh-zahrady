/*
 * MVGreen AI architekt v2 – náčrt zákazníka (2026-11-08).
 * Martin po 3. testu: „potřebovali bychom jednoduchý, ale přesný nástroj, aby zákazník mohl
 * načrtnout, kde chce zeď, kde v té zdi schody, kde záhon, kde kačírek, kde strom – ale aby to
 * bylo jednoduché dělat na mobilu. AI nemůže vědět, co my chceme.“
 *
 * Zákazník kreslí prstem přímo do své fotky: plochy (záhon, trávník, kačírek, dlažba) štětcem,
 * čáry (zeď, schody, cesta) tahem, stromy a keře ťuknutím. Výstup:
 *  - guide(photo): fotka s barevnými značkami ve stejném rozměru → jde AI jako druhý obrázek,
 *  - describe(): přesný text s polohou každého prvku v % fotky → do zadání obrázku i půdorysu,
 *  - preview: malý náhled do průvodce a do PDF.
 * Místa, která mají zůstat beze změny (krok 1), jsou ztmavená – kreslí se jen do upravované plochy.
 * API: MVGreenSketch.open(photoCanvas, editMask, strokes) → Promise<{strokes, preview} | null>
 *      MVGreenSketch.guide(photoCanvas, strokes) → canvas;  MVGreenSketch.describe(strokes) → text
 */
(function () {
  'use strict';
  var TOOLS = [
    { id: 'bed', name: 'Záhon', type: 'area', color: '#E0349A', hint: 'Přejeďte prstem plochu, kde chcete záhon.' },
    { id: 'lawn', name: 'Trávník', type: 'area', color: '#35B84A', hint: 'Přejeďte prstem plochu nového trávníku.' },
    { id: 'gravel', name: 'Kačírek', type: 'area', color: '#F2C230', hint: 'Přejeďte prstem plochu kačírku (okrasného štěrku).' },
    { id: 'paving', name: 'Dlažba', type: 'area', color: '#2F7DE1', hint: 'Přejeďte prstem plochu zámkové dlažby (stání, terasa, chodník).' },
    { id: 'wall', name: 'Zeď', type: 'line', color: '#E53935', hint: 'Táhněte prstem po linii, kudy má vést zeď (opěrná zídka).' },
    { id: 'steps', name: 'Schody', type: 'line', color: '#00C2D1', hint: 'Táhněte prstem podél zdi přes místo, kde mají být schody – délka tahu = šířka schodů.' },
    { id: 'path', name: 'Cesta', type: 'line', color: '#FF8A00', hint: 'Táhněte prstem, kudy má vést cestička nebo šlapáky.' },
    { id: 'tree', name: 'Strom', type: 'point', color: '#0B6E2E', mark: 'S', hint: 'Ťukněte, kam chcete strom.' },
    { id: 'shrub', name: 'Keř', type: 'point', color: '#8E44AD', mark: 'K', hint: 'Ťukněte, kam chcete keř.' }
  ];
  var BY = {}; TOOLS.forEach(function (t) { BY[t.id] = t; });
  var SIZES = { s: 0.025, m: 0.05, l: 0.09 };
  var LINE = 0.014, DOT = 0.022;

  /* ---------- kreslení ---------- */
  function draw(ctx, W, H, strokes, opts) {
    opts = opts || {};
    var layer = document.createElement('canvas'); layer.width = W; layer.height = H;
    var lc = layer.getContext('2d');
    // plochy: každá barva na vlastní vrstvu, aby se překryvy nezvýrazňovaly
    TOOLS.filter(function (t) { return t.type === 'area'; }).forEach(function (t) {
      var ss = strokes.filter(function (s) { return s.tool === t.id; });
      if (!ss.length) return;
      lc.clearRect(0, 0, W, H);
      lc.strokeStyle = lc.fillStyle = t.color; lc.lineCap = lc.lineJoin = 'round';
      ss.forEach(function (s) {
        lc.lineWidth = s.size * W;
        if (s.pts.length === 1) { lc.beginPath(); lc.arc(s.pts[0][0] * W, s.pts[0][1] * H, s.size * W / 2, 0, 7); lc.fill(); return; }
        lc.beginPath(); s.pts.forEach(function (p, i) { lc[i ? 'lineTo' : 'moveTo'](p[0] * W, p[1] * H); }); lc.stroke();
      });
      ctx.globalAlpha = opts.areaAlpha || 0.55; ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1;
    });
    strokes.forEach(function (s) {
      var t = BY[s.tool]; if (!t || t.type === 'area') return;
      if (t.type === 'line' && s.pts.length > 1) {
        ctx.lineCap = ctx.lineJoin = 'round';
        var path = function () { ctx.beginPath(); s.pts.forEach(function (p, i) { ctx[i ? 'lineTo' : 'moveTo'](p[0] * W, p[1] * H); }); };
        path(); ctx.strokeStyle = '#fff'; ctx.lineWidth = LINE * W * 1.7; ctx.stroke();
        path(); ctx.strokeStyle = t.color; ctx.lineWidth = LINE * W; ctx.stroke();
        if (s.tool === 'steps') { // příčky schodů
          var a = s.pts[0], b = s.pts[s.pts.length - 1], dx = (b[0] - a[0]) * W, dy = (b[1] - a[1]) * H, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          ctx.strokeStyle = '#063b40'; ctx.lineWidth = Math.max(1, LINE * W * 0.25);
          for (var k = 1; k < 4; k++) { var cx = a[0] * W + dx * k / 4, cy = a[1] * H + dy * k / 4; ctx.beginPath(); ctx.moveTo(cx - nx * LINE * W * 0.5, cy - ny * LINE * W * 0.5); ctx.lineTo(cx + nx * LINE * W * 0.5, cy + ny * LINE * W * 0.5); ctx.stroke(); }
        }
      } else if (t.type === 'point') {
        var p = s.pts[0], r = DOT * W;
        ctx.beginPath(); ctx.arc(p[0] * W, p[1] * H, r, 0, 7); ctx.fillStyle = t.color; ctx.fill();
        ctx.lineWidth = r * 0.25; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(r * 1.1) + 'px Montserrat, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.mark, p[0] * W, p[1] * H + r * 0.05);
      }
    });
  }

  function guide(photo, strokes) {
    var c = document.createElement('canvas'); c.width = photo.width; c.height = photo.height;
    var x = c.getContext('2d'); x.drawImage(photo, 0, 0);
    draw(x, c.width, c.height, strokes, { areaAlpha: 0.6 });
    return c;
  }

  /* ---------- popis pro AI ---------- */
  function pc(v) { return Math.round(Math.max(0, Math.min(1, v)) * 100); }
  function where(x, y) { return (x < 0.34 ? 'vlevo' : x > 0.66 ? 'vpravo' : 'uprostřed') + (y > 0.66 ? ' v popředí' : y < 0.4 ? ' vzadu' : ''); }
  function describe(strokes) {
    if (!strokes || !strokes.length) return '';
    var out = [], legend = TOOLS.filter(function (t) { return strokes.some(function (s) { return s.tool === t.id; }); });
    out.push('Barvy v náčrtu: ' + legend.map(function (t) { return { E0349A: 'purpurová', '35B84A': 'zelená', F2C230: 'žlutá', '2F7DE1': 'modrá', E53935: 'červená čára', '00C2D1': 'tyrkysová čára s příčkami', FF8A00: 'oranžová čára', '0B6E2E': 'tmavě zelené kolečko „S“', '8E44AD': 'fialové kolečko „K“' }[t.color.slice(1)] + ' = ' + t.name.toLowerCase(); }).join(', ') + '.');
    out.push('Polohy jsou v % fotky (x zleva doprava, y shora dolů):');
    TOOLS.forEach(function (t) {
      var ss = strokes.filter(function (s) { return s.tool === t.id; }); if (!ss.length) return;
      if (t.type === 'area') {
        var all = []; ss.forEach(function (s) { all = all.concat(s.pts); });
        var xs = all.map(function (p) { return p[0]; }), ys = all.map(function (p) { return p[1]; }), pad = Math.max.apply(null, ss.map(function (s) { return s.size; })) / 2;
        var x0 = Math.min.apply(null, xs) - pad, x1 = Math.max.apply(null, xs) + pad, y0 = Math.min.apply(null, ys) - pad, y1 = Math.max.apply(null, ys) + pad;
        out.push('- ' + t.name + ': ' + where((x0 + x1) / 2, (y0 + y1) / 2) + ', oblast x ' + pc(x0) + '–' + pc(x1) + ' %, y ' + pc(y0) + '–' + pc(y1) + ' % (přesný tvar podle ' + ({ bed: 'purpurové', lawn: 'zelené', gravel: 'žluté', paving: 'modré' }[t.id]) + ' plochy v náčrtu).');
      } else if (t.type === 'line') {
        ss.forEach(function (s, i) {
          var n = s.pts.length, pick = [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1].filter(function (v, k, a) { return a.indexOf(v) === k; });
          var txt = pick.map(function (k) { return '(' + pc(s.pts[k][0]) + ' %, ' + pc(s.pts[k][1]) + ' %)'; }).join(' → ');
          out.push('- ' + t.name + (ss.length > 1 ? ' ' + (i + 1) : '') + ': ' + (s.tool === 'steps' ? 'schody v úseku ' + txt + ' – šířka schodů = délka tohoto úseku, stupně vedou kolmo na něj (přes zeď nahoru)' : 'vede po čáře ' + txt) + '.');
        });
      } else {
        out.push('- ' + t.name + ' (' + ss.length + ' ks): ' + ss.map(function (s) { return '(' + pc(s.pts[0][0]) + ' %, ' + pc(s.pts[0][1]) + ' %)'; }).join(', ') + '.');
      }
    });
    return out.join('\n');
  }

  /* ---------- obrazovka náčrtu ---------- */
  function open(photo, editMask, initial) {
    return new Promise(function (resolve) {
      var strokes = (initial || []).map(function (s) { return { tool: s.tool, size: s.size, pts: s.pts.slice() }; });
      var tool = 'bed', size = 'm';
      var W = photo.width, H = photo.height, sc = Math.min(1, 1600 / Math.max(W, H));
      var cw = Math.round(W * sc), ch = Math.round(H * sc);
      var el = document.createElement('div'); el.className = 'mvg2-sk';
      el.innerHTML = '<div class="mvg2-sk__top"><strong>Náčrt: kam co chcete</strong><span data-hint></span></div>'
        + '<div class="mvg2-sk__stage" data-stage><canvas data-c></canvas></div>'
        + '<div class="mvg2-sk__tools" data-tools></div>'
        + '<div class="mvg2-sk__bar"><div class="mvg2-sk__sizes" data-sizes></div><button type="button" data-undo>↶ Zpět</button><button type="button" data-clear>Smazat vše</button><button type="button" class="is-main" data-ok>Hotovo</button></div>'
        + '<button type="button" class="mvg2-sk__close" data-cancel aria-label="Zavřít">×</button>';
      document.body.appendChild(el); document.documentElement.classList.add('mvg2-sk-open');
      var cv = el.querySelector('[data-c]'), cx = cv.getContext('2d'); cv.width = cw; cv.height = ch;
      // podklad: fotka + ztmavená chráněná místa (kde editMask není)
      var base = document.createElement('canvas'); base.width = cw; base.height = ch;
      var bx = base.getContext('2d'); bx.drawImage(photo, 0, 0, cw, ch);
      if (editMask) {
        var dim = document.createElement('canvas'); dim.width = cw; dim.height = ch; var dx = dim.getContext('2d');
        dx.fillStyle = 'rgba(10,20,15,0.55)'; dx.fillRect(0, 0, cw, ch); dx.globalCompositeOperation = 'destination-out'; dx.drawImage(editMask, 0, 0, cw, ch);
        bx.drawImage(dim, 0, 0);
      }
      function paint() { cx.clearRect(0, 0, cw, ch); cx.drawImage(base, 0, 0); draw(cx, cw, ch, strokes); }
      function fit() {
        var st = el.querySelector('[data-stage]'), r = st.getBoundingClientRect(), s = Math.min(r.width / cw, r.height / ch);
        cv.style.width = Math.floor(cw * s) + 'px'; cv.style.height = Math.floor(ch * s) + 'px';
      }
      function ui() {
        var t = BY[tool];
        el.querySelector('[data-tools]').innerHTML = TOOLS.map(function (x) { return '<button type="button" data-tool="' + x.id + '" class="' + (x.id === tool ? 'is-on' : '') + '"><i style="background:' + x.color + '"' + (x.type === 'line' ? ' class="is-line"' : x.type === 'point' ? ' class="is-dot"' : '') + '></i>' + x.name + '</button>'; }).join('');
        el.querySelector('[data-sizes]').innerHTML = t.type === 'area' ? Object.keys(SIZES).map(function (k) { return '<button type="button" data-size="' + k + '" class="' + (k === size ? 'is-on' : '') + '" aria-label="Štětec ' + k + '"><i style="width:' + { s: 8, m: 14, l: 22 }[k] + 'px;height:' + { s: 8, m: 14, l: 22 }[k] + 'px"></i></button>'; }).join('') : '';
        el.querySelector('[data-hint]').textContent = t.hint + (window.innerHeight > window.innerWidth && W > H ? ' Tip: otočte telefon na šířku.' : '');
        el.querySelectorAll('[data-tool]').forEach(function (b) { b.onclick = function () { tool = b.dataset.tool; ui(); }; });
        el.querySelectorAll('[data-size]').forEach(function (b) { b.onclick = function () { size = b.dataset.size; ui(); }; });
      }
      var cur = null;
      var pt = function (e) { var r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault(); cv.setPointerCapture(e.pointerId);
        var t = BY[tool];
        cur = { tool: tool, size: t.type === 'area' ? SIZES[size] : LINE, pts: [pt(e)] };
        strokes.push(cur); paint();
        if (t.type === 'point') cur = null;
      });
      cv.addEventListener('pointermove', function (e) {
        if (!cur) return; e.preventDefault();
        var p = pt(e), l = cur.pts[cur.pts.length - 1];
        if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 0.004) return;
        if (BY[cur.tool].type === 'line' && cur.tool === 'steps') cur.pts = [cur.pts[0], p]; else cur.pts.push(p);
        paint();
      });
      var end = function () {
        if (cur && BY[cur.tool].type === 'line' && cur.pts.length < 2) strokes.pop(); // ťuknutí čárou nic neznamená
        cur = null; paint();
      };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      var close = function (val) { window.removeEventListener('resize', onR); el.remove(); document.documentElement.classList.remove('mvg2-sk-open'); resolve(val); };
      var onR = function () { fit(); ui(); };
      el.querySelector('[data-undo]').onclick = function () { strokes.pop(); paint(); };
      el.querySelector('[data-clear]').onclick = function () { if (strokes.length && window.confirm('Smazat celý náčrt?')) { strokes = []; paint(); } };
      el.querySelector('[data-cancel]').onclick = function () { close(null); };
      el.querySelector('[data-ok]').onclick = function () {
        var pv = document.createElement('canvas'), s2 = Math.min(1, 900 / Math.max(W, H)); pv.width = Math.round(W * s2); pv.height = Math.round(H * s2);
        var px = pv.getContext('2d'); px.drawImage(photo, 0, 0, pv.width, pv.height); draw(px, pv.width, pv.height, strokes);
        close({ strokes: strokes, preview: pv.toDataURL('image/jpeg', 0.85) });
      };
      window.addEventListener('resize', onR);
      ui(); paint(); requestAnimationFrame(fit);
    });
  }

  window.MVGreenSketch = { open: open, guide: guide, describe: describe, tools: TOOLS };
})();
