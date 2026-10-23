/* MVGreen – chování webu: mobilní menu a srovnání před/po s úvodní animací. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initMenu() {
    document.querySelectorAll('.mvg-header').forEach(function (h) {
      var btn = h.querySelector('.mvg-menu-btn');
      if (!btn || btn.dataset.ready) return;
      btn.dataset.ready = '1';
      btn.addEventListener('click', function () {
        var open = h.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
    });
    if (document.querySelector('.mvg-callbar')) document.body.classList.add('mvg-has-callbar');
  }

  function setPos(frame, v) {
    frame.style.setProperty('--pos', v + '%');
  }

  // Sweeps the divider once so visitors see it can be dragged.
  function intro(frame, range) {
    if (reduce || frame.dataset.played) return;
    frame.dataset.played = '1';
    var keys = [[0, 50], [700, 82], [1500, 18], [2200, 50]];
    var start = null;
    function step(t) {
      if (frame.dataset.touched) return;
      if (start === null) start = t;
      var e = t - start, i = 1;
      while (i < keys.length && keys[i][0] < e) i++;
      if (i >= keys.length) { setPos(frame, 50); range.value = 50; return; }
      var a = keys[i - 1], b = keys[i];
      var p = (e - a[0]) / (b[0] - a[0]);
      p = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // ease in-out
      var v = a[1] + (b[1] - a[1]) * p;
      setPos(frame, v);
      range.value = v;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initCompare() {
    var frames = document.querySelectorAll('.mvg-ba__frame');
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          intro(en.target, en.target.querySelector('.mvg-ba__range'));
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.6 }) : null;
    frames.forEach(function (frame) {
      var range = frame.querySelector('.mvg-ba__range');
      if (!range || frame.dataset.ready) return;
      frame.dataset.ready = '1';
      setPos(frame, range.value);
      range.addEventListener('input', function () {
        frame.dataset.touched = '1';
        setPos(frame, range.value);
      });
      // Drag anywhere on the photo (mouse, pen, finger); the range input keeps keyboard access.
      var dragging = false;
      function fromEvent(e) {
        var r = frame.getBoundingClientRect();
        var v = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
        frame.dataset.touched = '1';
        range.value = v;
        setPos(frame, v);
      }
      frame.addEventListener('pointerdown', function (e) {
        dragging = true;
        try { frame.setPointerCapture(e.pointerId); } catch (err) {}
        fromEvent(e);
      });
      frame.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
        frame.addEventListener(ev, function () { dragging = false; });
      });
      if (io) io.observe(frame);
    });
  }

  function init() { initMenu(); initCompare(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
