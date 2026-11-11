/*
 * MVGreen – znalostní báze pro projekt zahrady (2026-11-11).
 *
 * Majitel: projekt má být jako od architekta za 50 000 Kč – zákazník ví, co koupit, kolik toho,
 * jaké nářadí a stroje, kolik hodin a kolik peněz. AI jen vybírá a navrhuje, ČÍSLA bere odtud.
 *
 * !!! Všechny ceny a normy jsou ODHADY (běžné ceny v ČR 2026, okolí Domažlic) – Martin je opraví
 * podle své praxe a dodavatelů. Měnit jde jen čísla; id nechte beze změny.
 *
 * MVGreenKB.estimate(model, plants) → { materials, plants, tools, own, tasks, weekends, totals }
 *   model = projektový model z architekt.js (jeden zdroj pravdy pro celé PDF):
 *     { beds:[{area, perimeter}], gravel:[{area, perimeter}], paving:[{area, perimeter}],
 *       paths:[{area, length}], walls:[{length, height}], steps:[{count}], lawn: m², lawnExtra: m² }
 *   plants = [{name, count, price}] (price z AI, jinak odhad podle druhu níže)
 */
(function () {
  'use strict';

  // ---------- materiál (cena za jednotku, Kč s DPH) ----------
  var M = {
    dlazba:     { name: 'Zámková dlažba 6 cm', unit: 'm²', price: 340 },
    sterkodrt:  { name: 'Štěrkodrť 0/32 (podklad)', unit: 't', price: 480 },
    drt48:      { name: 'Drť 4/8 (lože pod dlažbu)', unit: 't', price: 620 },
    obrubnik:   { name: 'Zahradní obrubník betonový 100 × 25 × 5 cm', unit: 'ks', price: 75 },
    beton:      { name: 'Suchý beton C16/20, pytel 25 kg', unit: 'pytel', price: 115 },
    betonm3:    { name: 'Beton z betonárky C16/20 (vč. dovozu)', unit: 'm³', price: 3400 },
    geotex:     { name: 'Geotextilie 200 g/m²', unit: 'm²', price: 25 },
    textilie:   { name: 'Mulčovací textilie proti plevelu', unit: 'm²', price: 22 },
    kura:       { name: 'Mulčovací kůra', unit: 'm³', price: 950 },
    kacirek:    { name: 'Okrasný kačírek 16/32', unit: 't', price: 1150 },
    sterkcesta: { name: 'Štěrk na cestu 8/16', unit: 't', price: 780 },
    kompost:    { name: 'Kompost / zahradní substrát', unit: 'm³', price: 1250 },
    obruba:     { name: 'Plastová obruba záhonu', unit: 'm', price: 65 },
    tvarnice:   { name: 'Zahradní tvárnice / kámen na opěrnou zeď', unit: 'm² pohledu', price: 1450 },
    drenaz:     { name: 'Drenážní trubka 100 mm s filtrem', unit: 'm', price: 45 },
    stupen:     { name: 'Schodový blok (stupeň)', unit: 'ks', price: 750 },
    osivo:      { name: 'Travní osivo (hřišťová / parková směs)', unit: 'kg', price: 320 },
    hnojivo:    { name: 'Startovací hnojivo na trávník', unit: 'kg', price: 65 }
  };

  // ---------- rostliny, když AI cenu nedodá (Kč/ks, kontejner 2–5 l) ----------
  var PLANT_PRICE = { tree: 1400, conifer: 650, shrub: 380, grass: 210, perennial: 175, bulb: 25, climber: 320 };

  // ---------- práce (osobohodiny šikovného laika včetně výkopu, odvozu a úklidu) ----------
  var H = { vytyceni: 2, dlazba: 3, cesta: 2.2, zed: 8, schody: 16, zahon: 1, kacirek: 0.6, travnik: 0.12, vysadba: 0.12 };
  var WEEKEND_H = 28;   // 2 lidé × 2 dny × 7 h

  // ---------- nářadí a stroje ----------
  var OWN = ['Rýč a lopata', 'Hrábě a kolečko', 'Provázek, kolíky, metr, sprej na značení', 'Vodováha a gumová palička', 'Zahradní nůžky a konev / hadice'];
  var RENT = {
    deska:     { name: 'Vibrační deska', unit: 'den', price: 650 },
    rezacka:   { name: 'Řezačka na dlažbu', unit: 'den', price: 500 },
    minibagr:  { name: 'Minibagr (bez obsluhy)', unit: 'den', price: 2600 },
    kontejner: { name: 'Kontejner na zeminu a suť 6 m³', unit: 'ks', price: 3600 },
    michacka:  { name: 'Míchačka', unit: 'den', price: 350 },
    kultivator:{ name: 'Rotavátor / kultivátor', unit: 'den', price: 750 },
    valec:     { name: 'Válec na trávník', unit: 'den', price: 200 }
  };

  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var sum = function (a, f) { return (a || []).reduce(function (s, x) { return s + (f ? f(x) : x); }, 0); };

  function estimate(model, plants) {
    var m = model || {}, mats = {}, concrete = 0, add = function (id, q) { if (q > 0.001) mats[id] = (mats[id] || 0) + q; };
    var bed = sum(m.beds, function (b) { return b.area; }), bedPer = sum(m.beds, function (b) { return b.perimeter; });
    var grav = sum(m.gravel, function (b) { return b.area; }), gravPer = sum(m.gravel, function (b) { return b.perimeter; });
    var pav = sum(m.paving, function (p) { return p.area; }), pavPer = sum(m.paving, function (p) { return p.perimeter; });
    var path = sum(m.paths, function (p) { return p.area; }), pathLen = sum(m.paths, function (p) { return p.length; });
    var wallL = sum(m.walls, function (w) { return w.length; }), wallA = sum(m.walls, function (w) { return w.length * (w.height || 0.6); });
    var steps = sum(m.steps, function (s) { return s.count || 3; });
    var lawn = (m.lawn || 0) + (m.lawnExtra || 0);

    // zámková dlažba: 20 cm štěrkodrť (1,9 t/m³), 4 cm drť 4/8 (1,6 t/m³), geotextilie, obrubníky po obvodu v betonu
    if (pav > 0.3) { add('dlazba', pav * 1.05); add('sterkodrt', pav * 0.2 * 1.9); add('drt48', pav * 0.04 * 1.6); add('geotex', pav * 1.1); add('obrubnik', Math.ceil(pavPer)); concrete += pavPer * 0.01; }
    // štěrková cesta: 15 cm štěrkodrť, 5 cm štěrk 8/16, geotextilie, obruba po obou stranách
    if (path > 0.3) { add('sterkodrt', path * 0.15 * 1.9); add('sterkcesta', path * 0.05 * 1.6); add('geotex', path * 1.1); add('obrubnik', Math.ceil(pathLen * 2)); concrete += pathLen * 2 * 0.01; }
    // záhony: 4 cm kompost, textilie, 5 cm kůra, obruba
    if (bed > 0.3) { add('kompost', bed * 0.04); add('textilie', bed * 1.1); add('kura', bed * 0.05); add('obruba', Math.ceil(bedPer)); }
    // kačírek: textilie, 5 cm kačírku (1,6 t/m³), obruba
    if (grav > 0.3) { add('textilie', grav * 1.1); add('kacirek', grav * 0.05 * 1.6); add('obruba', Math.ceil(gravPer)); }
    // opěrná zeď: pohledová plocha, základ 40 × 30 cm z betonu, drenáž a štěrk za zdí
    if (wallL > 0.3) { add('tvarnice', wallA); concrete += wallL * 0.4 * 0.3; add('drenaz', Math.ceil(wallL)); add('sterkodrt', wallL * 0.3 * 0.6 * 1.9); }
    if (steps) { add('stupen', steps); concrete += steps * 0.05; }
    // beton: do půl kubíku pytle (1 pytel ≈ 0,0125 m³), víc = objednat z betonárky
    if (concrete > 0.5) add('betonm3', concrete); else if (concrete > 0) add('beton', Math.ceil(concrete / 0.0125));
    // trávník: 35 g/m² osiva, 30 g/m² startovacího hnojiva
    if (lawn > 1) { add('osivo', lawn * 0.035); add('hnojivo', lawn * 0.03); }

    var round = function (id, q) { var u = M[id].unit; return u === 'ks' || u === 'pytel' || u === 'm' ? Math.ceil(q) : u === 'kg' ? Math.max(1, Math.ceil(q)) : Math.max(0.1, Math.ceil(q * 10) / 10); };
    var materials = Object.keys(mats).map(function (id) { var q = round(id, mats[id]); return { id: id, name: M[id].name, qty: q, unit: M[id].unit, price: M[id].price, cost: Math.round(q * M[id].price) }; });

    var plantRows = (plants || []).map(function (p) { var pr = p.price || PLANT_PRICE[p.kind] || PLANT_PRICE.perennial; return { name: p.name, count: p.count, price: pr, cost: Math.round(pr * p.count), container: p.container || '' }; });

    // stroje z půjčovny podle rozsahu
    var hardArea = pav + path, rent = [], rentAdd = function (id, n) { if (n > 0) rent.push({ id: id, name: RENT[id].name, qty: n, unit: RENT[id].unit, price: RENT[id].price, cost: n * RENT[id].price }); };
    if (hardArea > 3) rentAdd('deska', Math.max(1, Math.ceil(hardArea / 25)));
    if (pav > 3) rentAdd('rezacka', 1);
    if (pav > 15 || wallL > 5) rentAdd('minibagr', pav > 40 || wallL > 12 ? 2 : 1);
    if (pav > 8 || path > 10 || wallL > 3) rentAdd('kontejner', Math.max(1, Math.ceil((pav * 0.3 + path * 0.2 + wallL * 0.3) / 6)));
    if (wallL > 0.3 || steps) rentAdd('michacka', 1);
    if (lawn > 80) rentAdd('kultivator', 1);
    if (lawn > 40) rentAdd('valec', 1);

    // práce po krocích (pořadí = harmonogram)
    var tasks = [], task = function (name, scope, h, group) { if (h > 0.2) tasks.push({ name: name, scope: scope, hours: Math.max(1, Math.round(h)), group: group }); };
    task('Vytyčení podle plánu', 'celá úprava', H.vytyceni + (bed + pav + path + grav) * 0.02, 'Příprava');
    if (pav > 0.3) task('Zámková dlažba vč. výkopu, podkladu a obrubníků', r1(pav) + ' m²', pav * H.dlazba, 'Stavební část');
    if (path > 0.3) task('Štěrková cesta vč. výkopu a obruby', r1(path) + ' m²', path * H.cesta, 'Stavební část');
    if (wallL > 0.3) task('Opěrná zeď vč. základu a drenáže', r1(wallL) + ' m', wallL * H.zed, 'Stavební část');
    if (steps) task('Schody', steps + ' stupňů', H.schody * Math.max(1, steps / 3), 'Stavební část');
    if (bed > 0.3) task('Záhony – příprava půdy, obruba, textilie', r1(bed) + ' m²', bed * H.zahon, 'Záhony');
    var nPl = sum(plants, function (p) { return p.count; });
    if (nPl) task('Výsadba rostlin a mulč', nPl + ' ks', nPl * H.vysadba, 'Záhony');
    if (grav > 0.3) task('Kačírek', r1(grav) + ' m²', grav * H.kacirek, 'Záhony');
    if (lawn > 1) task('Trávník – urovnání, výsev, válcování', Math.round(lawn) + ' m²', lawn * H.travnik, 'Trávník');

    // harmonogram po víkendech (2 lidé)
    var weekends = [], cur = null;
    tasks.forEach(function (t) {
      var left = t.hours;
      while (left > 0) {
        if (!cur || cur.hours >= WEEKEND_H - 0.5) { cur = { n: weekends.length + 1, hours: 0, items: [] }; weekends.push(cur); }
        var take = Math.min(left, WEEKEND_H - cur.hours);
        cur.items.push(t.name + (take < t.hours ? ' (' + Math.round(take) + ' h)' : ''));
        cur.hours += take; left -= take;
      }
    });

    var tot = {
      material: sum(materials, function (x) { return x.cost; }),
      plants: sum(plantRows, function (x) { return x.cost; }),
      rent: sum(rent, function (x) { return x.cost; }),
      hours: sum(tasks, function (t) { return t.hours; })
    };
    tot.total = tot.material + tot.plants + tot.rent;
    tot.weekends = weekends.length;
    return { materials: materials, plants: plantRows, rent: rent, own: OWN.slice(), tasks: tasks, weekends: weekends, totals: tot };
  }

  window.MVGreenKB = { estimate: estimate, materials: M, rent: RENT, norms: H, plantPrice: PLANT_PRICE, weekendHours: WEEKEND_H };
})();
