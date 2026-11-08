/*
 * MVGreen AI architekt v2 – zkušební stránka (2026-11-08).
 * Krok 1 přestavby: vykreslí osazovací plán z ukázkového projektu (zahrada se studnou,
 * fotky mvgreen-ai-navrh (3) a 1000049472). Projekt je v metrech – stejný formát bude
 * později vyrábět průvodce z fotky, označení a AI rozboru.
 */
(function () {
  'use strict';
  var root = document.querySelector('[data-mvgreen-architekt]');
  if (!root || !window.MVGreenPlan) return;
  var cfg = window.MVGreenArchitekt || {};

  // Ukázkový projekt: souřadnice odměřené z fotky v pixelech 1 m = 60 px, tady převedené na metry.
  var P = function (arr) { return arr.map(function (q) { return [q[0] / 60, q[1] / 60]; }); };
  var pt = function (x, y) { return [x / 60, y / 60]; };
  var DEMO = {
    title: 'Zahrada se studnou a kamennou cestou',
    place: 'Pelechy, Domažlice',
    date: new Date().toLocaleDateString('cs-CZ'),
    seed: 11,
    site: { w: 1300 / 60, h: 1096 / 60 },
    brand: { logo: cfg.logo || '', web: 'mvgreen.cz', phone: '723 339 650' },
    photoBefore: cfg.photoBefore || '',
    photoAfter: cfg.photoAfter || '',
    areas: [
      { type: 'outside', poly: P([[0, 0], [1300, 0], [1300, 900], [1271, 900], [570, 230], [540, 205], [60, 240], [0, 240]]) },
      { type: 'building', poly: P([[110, 0], [380, 0], [380, 120], [110, 120]]) },
      { type: 'building', poly: P([[687.5, 266.2], [1258.4, 811.8], [1382.8, 681.7], [811.9, 136.1]]) },
      { type: 'lawn', poly: P([[60, 245], [420, 215], [420, 290], [540, 290], [570, 230], [1271, 900], [60, 900]]) },
      { type: 'paving', poly: P([[0, 900], [1300, 900], [1300, 1096], [0, 1096]]) }
    ],
    beds: [
      {
        surface: 'gravel',
        poly: P([[60, 900], [60, 245], [420, 215], [420, 300], [360, 312], [300, 314], [250, 330], [205, 400], [172, 480], [158, 580], [150, 700], [142, 800], [135, 900]]),
        back: [0, 1],
        blocked: [{ x: 300 / 60, y: 247 / 60, r: 0.6 }, { x: 352 / 60, y: 243 / 60, r: 0.6 }],
        plants: [
          { key: 'cal', name: 'Třtina ostrokvětá', latin: 'Calamagrostis × acutiflora ‘Karl Foerster’', kind: 'grass', leaf: '#BDB46A', spon: 0.6, height: 1.5, share: 0.4 },
          { key: 'lav', name: 'Levandule úzkolistá', latin: 'Lavandula angustifolia ‘Hidcote’', kind: 'perennial', leaf: '#8A9A82', flower: '#7D6BBE', spon: 0.45, height: 0.4, share: 0.45 }
        ]
      },
      {
        surface: 'gravel',
        poly: P([[570, 230], [1271, 900], [1152.3, 900], [542.2, 316.9]]),
        back: [0],
        plants: [
          { key: 'hyd', name: 'Hortenzie latnatá', latin: 'Hydrangea paniculata ‘Limelight’', kind: 'shrub', leaf: '#4B7A40', flower: '#FBFAF2', spon: 1.5, height: 1.8, share: 0.4 },
          { key: 'spi', name: 'Tavolník japonský', latin: 'Spiraea japonica ‘Goldflame’', kind: 'shrub', leaf: '#CDB13C', flower: '#E0708A', spon: 0.6, height: 0.6, share: 0.2 },
          { key: 'ber', name: 'Dřišťál Thunbergův', latin: 'Berberis thunbergii ‘Atropurpurea Nana’', kind: 'shrub', leaf: '#8E3440', spon: 0.5, height: 0.5, share: 0.2 },
          { key: 'fes', name: 'Kostřava sivá', latin: 'Festuca glauca', kind: 'lowgrass', leaf: '#9AB3BB', spon: 0.3, height: 0.25, share: 0.15 }
        ]
      }
    ],
    paths: [{ surface: 'gravel', width: 1.2, stones: 0.75, line: P([[480, 300], [485, 400], [500, 500], [525, 600], [560, 700], [585, 800], [600, 900]]) }],
    walls: [{ width: 0.43, line: P([[40, 240], [420, 212]]) }, { width: 0.7, line: P([[40, 240], [40, 900]]) }],
    structures: [{ label: 'Studna', poly: P([[420, 170], [540, 170], [540, 290], [420, 290]]) }],
    fences: [{ line: P([[570, 230], [1271, 900]]) }],
    existingPlants: [
      { kind: 'conifer', leaf: '#3F6E45', r: 0.3, x: 300 / 60, y: 247 / 60 },
      { kind: 'conifer', leaf: '#3F6E45', r: 0.3, x: 352 / 60, y: 243 / 60 },
      { kind: 'tree', leaf: '#5E8E46', r: 0.75, x: 430 / 60, y: 70 / 60 },
      { kind: 'tree', leaf: '#5E8E46', r: 0.75, x: 30 / 60, y: 60 / 60 }
    ],
    labels: [
      { text: 'TRÁVNÍK', x: 320 / 60, y: 700 / 60, size: 28, color: '#2E5B33', spacing: 3 },
      { text: 'TRÁVNÍK', x: 820 / 60, y: 830 / 60, size: 28, color: '#2E5B33', spacing: 3 },
      { text: 'Studna – stávající', x: 480 / 60, y: 155 / 60, size: 20 },
      { text: 'Opěrná zídka z kamene – nová', x: 260 / 60, y: 195 / 60, size: 20 },
      { text: 'Dřevěný plot – stávající', x: 760 / 60, y: 660 / 60, size: 20 },
      { text: 'Sousední dům', x: 1010 / 60, y: 420 / 60, size: 20, color: '#3E423D' },
      { text: 'Zámková dlažba – stávající', x: 420 / 60, y: 1000 / 60, size: 21 }
    ]
  };

  var sheet = window.MVGreenPlan.renderSheet(DEMO);
  root.classList.add('mvg2');
  root.innerHTML = '<div class="mvg2-dev"><div class="mvg2-dev__bar"><h1>AI architekt v2 – zkušební výkres</h1>'
    + '<button type="button" class="mvg2-btn" data-print>Vytisknout / uložit PDF</button></div>'
    + '<div class="mvg2-sheet-wrap mvg2-print">' + sheet.html + '</div></div>';
  var wrap = root.querySelector('.mvg2-sheet-wrap'), sh = root.querySelector('.mvg2-sheet');
  var fit = function () {
    var s = Math.min(1, wrap.clientWidth / 1700);
    sh.style.transform = 'scale(' + s + ')';
    wrap.style.height = Math.ceil(1100 * s) + 'px';
  };
  fit();
  window.addEventListener('resize', fit);
  root.querySelector('[data-print]').addEventListener('click', function () { window.print(); });
})();
