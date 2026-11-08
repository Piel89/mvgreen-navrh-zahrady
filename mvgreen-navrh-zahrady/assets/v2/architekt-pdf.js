/*
 * MVGreen AI architekt v2 – 11stránkový projekt v PDF (2026-11-08).
 * Strany skládá z dat jednoho návrhu (výkres + legenda z plan-render.js, podnebí, údaje o rostlinách
 * z mvgreen_ai_plant_facts, fotky před/po). Tiskne se přes window.print() – A4, strana 4 na šířku.
 * Obsah a pořadí stran odsouhlasil Martin v návrhu vzhledu (11 bodů „co má být v PDF“).
 */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var kc = function (n) { return Math.round(n).toLocaleString('cs-CZ') + ' Kč'; };
  var MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  var MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

  function head(ctx, no) {
    return '<div class="mvg2-page__head"><span>' + (ctx.logo ? '<img src="' + esc(ctx.logo) + '" alt="">' : '') + 'Projekt zahrady · ' + esc(ctx.place) + '</span><span>' + no + ' / 11</span></div>';
  }
  function title(cap, h) { return '<div class="mvg2-page__title"><span>' + esc(cap) + '</span><h2>' + esc(h) + '</h2></div>'; }
  function inRange(m, a, b) { return a <= b ? m >= a && m <= b : m >= a || m <= b; }

  function pages(ctx) {
    var f = ctx.facts || {}, plants = ctx.plants, out = [];
    var total = plants.reduce(function (s, p) { return s + p.count * (p.price || 0); }, 0);
    var nPlants = plants.reduce(function (s, p) { return s + p.count; }, 0);
    var safeList = plants.filter(function (p) { return p.toxic === 'ano'; }).map(function (p) { return p.name; });

    // 1 – titulní strana
    out.push('<section class="mvg2-page mvg2-page--cover">'
      + '<div class="mvg2-cover__top">' + (ctx.logo ? '<img src="' + esc(ctx.logo) + '" alt="MV GREEN">' : '') + '<div><strong>MV GREEN</strong><span>AI zahradní architekt</span></div><em>PROJEKT Č. ' + esc(ctx.number) + '</em></div>'
      + '<div class="mvg2-cover__title"><span>PROJEKT ZAHRADY</span><h1>' + esc(f.title || 'Projekt zahrady') + '</h1></div>'
      + (ctx.after ? '<img class="mvg2-cover__photo" src="' + esc(ctx.after) + '" alt="Vizualizace návrhu">' : '')
      + '<div class="mvg2-cover__info">'
      + [['PRO', ctx.name || '—'], ['MÍSTO', ctx.place], ['DATUM', ctx.date], ['STYL', ctx.styleLabel]].map(function (r) { return '<div><span>' + r[0] + '</span><strong>' + esc(r[1]) + '</strong></div>'; }).join('')
      + '<ol class="mvg2-toc">' + ['Rozbor stanoviště', 'Koncept, před a po', 'Osazovací plán', 'Rozměry a spon', 'Karty rostlin', 'Kvetení a zálivka', 'Návod krok za krokem', 'Rozpočet a nákup', 'Péče a hnojení', 'Dobré vědět, zdroje'].map(function (t, i) { return '<li><span>' + t + '</span><em>' + (i + 2) + '</em></li>'; }).join('') + '</ol></div>'
      + '<div class="mvg2-cover__foot"><span>mvgreen.cz</span><span>723 339 650 · mvgreen@seznam.cz</span></div></section>');

    // 2 – rozbor stanoviště
    var c = ctx.climate || {};
    var cards = [[c.elevation ? c.elevation + ' m n. m.' : '—', 'nadmořská výška'], [c.precip ? c.precip + ' mm' : '—', 'srážky za rok'], [c.zone || '—', 'mrazuvzdornost (orientačně)'], [ctx.sizeLabel, 'upravovaná plocha'], [ctx.sunLabel, 'slunce'], [ctx.soilLabel, 'půda']];
    out.push('<section class="mvg2-page">' + head(ctx, 2) + title('ROZBOR STANOVIŠTĚ', 'Z čeho návrh vychází')
      + (ctx.before ? '<img class="mvg2-page__photo" src="' + esc(ctx.before) + '" alt="Původní stav zahrady">' : '')
      + '<div class="mvg2-cards3">' + cards.map(function (x) { return '<div><strong>' + esc(x[0]) + '</strong><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>'
      + '<div class="mvg2-notes">'
      + '<div><strong>Co zůstává</strong><span>Vše, co jste na fotce neoznačili k úpravě – dům, plot, dlažba a další stávající prvky zůstávají přesně tak, jak jsou.</span></div>'
      + '<div><strong>Půda</strong><span>' + (ctx.soil === 'unknown' ? 'Zadali jste „nevím“ – počítáme s běžnou hlinitou půdou. Rychlý test: vlhká hrst zeminy se drolí = písčitá, dá se vyválet ve váleček = jílovitá.' : 'Podle vašeho zadání: ' + esc(ctx.soilLabel) + '.') + '</span></div>'
      + '<div><strong>Kdo bude zahradu užívat</strong><span>' + esc(ctx.usersLabel) + '</span></div>'
      + '</div><p class="mvg2-page__src">Klima: Open-Meteo (nadmořská výška), NASA POWER (srážky). Rozměry odhadnuté z fotky – před výsadbou ověřte pásmem.</p></section>');

    // 3 – koncept, před a po
    out.push('<section class="mvg2-page">' + head(ctx, 3) + title('KONCEPT', f.title || 'Koncept zahrady')
      + '<p class="mvg2-lead">' + esc(f.concept || '') + '</p>'
      + (ctx.before ? '<figure class="mvg2-fig"><img src="' + esc(ctx.before) + '" alt="Před"><figcaption><strong>PŘED</strong> · vaše fotka</figcaption></figure>' : '')
      + (ctx.after ? '<figure class="mvg2-fig"><img src="' + esc(ctx.after) + '" alt="Po"><figcaption><strong>PO</strong> · vizualizace návrhu na vaší fotce</figcaption></figure>' : '')
      + '<div class="mvg2-cards3 mvg2-ideas">' + (f.ideas || []).slice(0, 3).map(function (i, k) { return '<div><em>0' + (k + 1) + '</em><strong>' + esc(i.title) + '</strong><span>' + esc(i.text) + '</span></div>'; }).join('') + '</div></section>');

    // 4 – osazovací plán (na šířku)
    out.push('<section class="mvg2-page mvg2-page--land">' + head(ctx, 4) + '<div class="mvg2-land__sheet">' + ctx.sheetHtml + '</div></section>');

    // 5 – rozměry a spon
    out.push('<section class="mvg2-page">' + head(ctx, 5) + title('ROZMĚRY A SPON', 'Podle čeho vytyčit a sázet')
      + '<table class="mvg2-table"><thead><tr><th>Plocha</th><th>Rozměr (cca)</th><th>Výměra</th></tr></thead><tbody>'
      + ctx.areas.map(function (a) { return '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.dims) + '</td><td>' + esc(a.area) + '</td></tr>'; }).join('') + '</tbody></table>'
      + '<table class="mvg2-table"><thead><tr><th>Rostlina</th><th>Spon</th><th>Velikost v dospělosti</th></tr></thead><tbody>'
      + plants.map(function (p) { return '<tr><td><strong>' + esc(p.name) + '</strong></td><td>' + (p.spacing ? p.spacing + ' cm' : '—') + '</td><td>' + (p.height_cm ? p.height_cm + ' × ' + p.width_cm + ' cm' : '—') + '</td></tr>'; }).join('') + '</tbody></table>'
      + '<div class="mvg2-tip"><strong>Jak vytyčit:</strong> od hrany dlažby nebo domu naměřte rozměry pásmem, okraje záhonů a cest vyznačte provázkem mezi kolíky a obtáhněte pískem. Rozměry jsou odhadnuté z fotky – když se skutečnost liší, upravte šířky záhonů, spon rostlin zachovejte.</div></section>');

    // 6 – karty rostlin
    out.push('<section class="mvg2-page">' + head(ctx, 6) + title(plants.length + ' DRUHŮ · ' + nPlants + ' KUSŮ', 'Karty rostlin')
      + '<div class="mvg2-plantcards">' + plants.map(function (p) {
        return '<div class="mvg2-plantcard"><div class="mvg2-plantcard__img">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : 'fotka se doplní') + '</div><div class="mvg2-plantcard__body">'
          + '<div class="mvg2-plantcard__name"><strong>' + esc(p.name) + '</strong><em>' + p.count + ' ks</em></div><i>' + esc(p.latin) + '</i>'
          + '<span><b>Dospělá:</b> ' + (p.height_cm ? p.height_cm + ' × ' + p.width_cm + ' cm' : '—') + ' · <b>Kvete:</b> ' + (p.bloom_from ? MONTHS[p.bloom_from - 1] + '–' + MONTHS[p.bloom_to - 1] : '—') + '</span>'
          + '<span><b>Stanoviště:</b> ' + esc(p.sun || '—') + ' · <b>Voda:</b> ' + esc(p.water || '—') + '</span>'
          + '<span><b>Řez:</b> ' + esc(p.pruning || '—') + '</span>'
          + '<span class="mvg2-safe mvg2-safe--' + (p.toxic === 'ano' ? 'warn' : 'check') + '">' + (p.toxic === 'ano' ? 'Jedovatá pro psy a kočky (ASPCA).' : p.toxic === 'ne' ? 'Podle ASPCA není jedovatá pro psy a kočky – ověřte.' : 'Bezpečnost pro zvířata: ověřit.') + '</span>'
          + '</div></div>';
      }).join('') + '</div><p class="mvg2-page__src">Údaje o rostlinách jsou orientační (AI odhad podle běžných pěstitelských údajů) – před nákupem je ověřte na štítku.</p></section>');

    // 7 – kalendář kvetení a zálivka
    out.push('<section class="mvg2-page">' + head(ctx, 7) + title('KALENDÁŘ KVETENÍ', 'Co bude kdy hezké')
      + '<div class="mvg2-bloom"><span></span>' + MONTHS.map(function (m) { return '<b>' + m + '</b>'; }).join('')
      + plants.map(function (p) { var row = '<span>' + esc(p.name) + '</span>'; for (var m = 1; m <= 12; m++) row += '<i style="background:' + (p.bloom_from && inRange(m, p.bloom_from, p.bloom_to) ? (p.color || '#8E7CC3') : '#F1F0E9') + '"></i>'; return row; }).join('')
      + '</div>' + title('ZÁLIVKA', 'První rok rozhoduje')
      + '<table class="mvg2-table"><tbody>' + [['Den výsadby', 'Každou rostlinu vydatně zalít: trvalky 3–5 l, keře 10 l. I když prší.'], ['První 2 týdny', 'Každý druhý den stejné množství – kořeny jsou zatím jen v balu.'], ['Do konce prvního léta', '1× týdně vydatně, v horku nad 28 °C 2× týdně.'], ['Nový trávník', 'Do vzejití denně krátce, pak 2× týdně 10–15 l/m².']].map(function (r) { return '<tr><td><strong>' + r[0] + '</strong></td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>'
      + '<div class="mvg2-tip"><strong>Tip:</strong> zalévejte ráno přímo ke kořenům. Prst zastrčený 5 cm do země je nejlepší vlhkoměr – když je suchý, zalijte. ' + (ctx.water === 'auto' ? 'Automatickou závlahu v prvním roce nastavte na delší a řidší zálivku.' : ctx.water === 'none' ? 'Bez zálivky vybíráme suchomilné rostliny – první léto je ale zalít musíte.' : '') + '</div></section>');

    // 8 – návod pro kutily
    var steps = [['Vytyčení', 'Podle strany 5 vyznačte záhony a cesty provázkem a pískem.'], ['Úklid a drn', 'Odstraňte drn a plevel i s kořeny z budoucích záhonů.'], ['Příprava půdy', 'Prorýčujte 20–25 cm hluboko a zapracujte 3–5 cm kompostu.'], ['Obruba', 'Zapusťte obrubu 1 cm nad trávník – sekačka pak jede přes ni.'], ['Geotextilie', 'Položte s přesahem 15 cm, v místě rostlin prořízněte kříž.'], ['Výsadba', 'Jamka 2× širší než bal, stejně hluboká. Bal namočte, po zasazení zalijte.'], ['Mulč nebo štěrk', 'Rozprostřete 5 cm vrstvu, kolem rostlin nechte 5 cm volno.'], ['Cesty a šlapáky', 'Kameny do lože z 5 cm štěrkodrti, krok zhruba 60 cm.'], ['Trávník', 'Urovnejte, uválcujte, vysejte 30–35 g/m² a udržujte vlhko.']];
    out.push('<section class="mvg2-page">' + head(ctx, 8) + title('NÁVOD KROK ZA KROKEM', 'Zvládnete to sami za 2–3 víkendy')
      + '<div class="mvg2-steps">' + steps.map(function (s, i) { return '<div><em>' + (i + 1) + '</em><span><strong>' + s[0] + '</strong>' + s[1] + '</span></div>'; }).join('') + '</div>'
      + '<div class="mvg2-layers"><span class="mvg2-cap">ŘEZ ZÁHONEM</span>' + [['1', 'Mulč nebo štěrk', '5 cm'], ['2', 'Geotextilie', ''], ['3', 'Zemina s kompostem', '25 cm'], ['4', 'Původní podloží', '']].map(function (l) { return '<div class="mvg2-layer mvg2-layer--' + l[0] + '"><em>' + l[0] + '</em><span>' + l[1] + '</span><b>' + l[2] + '</b></div>'; }).join('') + '</div>'
      + '<div class="mvg2-tip mvg2-tip--warn"><strong>Pozor:</strong> než začnete kopat, přečtěte si stranu 11 – podzemní sítě a vzdálenosti od hranice pozemku.</div></section>');

    // 9 – rozpočet, nákup, náhrady
    out.push('<section class="mvg2-page">' + head(ctx, 9) + title('ROZPOČET A NÁKUPNÍ SEZNAM', 'Vytiskněte a vezměte do zahradnictví')
      + '<table class="mvg2-table mvg2-table--shop"><tbody>' + plants.map(function (p) { return '<tr><td><i class="mvg2-box"></i></td><td>' + esc(p.name) + (p.container ? ', ' + esc(p.container) : '') + '</td><td>' + p.count + ' ks</td><td>' + (p.price ? kc(p.count * p.price) : '—') + '</td></tr>'; }).join('')
      + '<tr class="mvg2-total"><td></td><td>Rostliny celkem</td><td>' + nPlants + ' ks</td><td>' + kc(total) + '</td></tr></tbody></table>'
      + '<p class="mvg2-page__src">Orientační ceny ±20 % (AI odhad běžných cen v českých zahradnictvích). Materiál (mulč, obruba, geotextilie) se dopočítá podle výměry ze strany 5.</p>'
      + title('NÁHRADNÍ ROSTLINY', 'Když něco nemají')
      + '<table class="mvg2-table"><thead><tr><th>V návrhu</th><th>Náhrada</th><th>Proč</th></tr></thead><tbody>' + plants.map(function (p) { return '<tr><td><strong>' + esc(p.name) + '</strong></td><td>' + esc(p.alternative || '—') + '</td><td>' + esc(p.alternative_reason || '') + '</td></tr>'; }).join('') + '</tbody></table></section>');

    // 10 – péče a hnojení trávníku
    var lawn = Math.round(ctx.lawnArea || 0), dose = Math.round(lawn * 25 / 100) / 10;
    var care = ['Klid. Nešlapat po zmrzlém trávníku.', 'Plán nákupu hnojiv.', 'Řez keřů a trav podle karet rostlin, vertikutace.', '1. hnojení trávníku, vyčesat suché listy.', 'Odplevelit záhony, první seče výš (5 cm).', '2. hnojení trávníku, zálivka v suchu.', 'Střih odkvetlých trvalek, letní hnojení.', 'Zálivka v horku, nesekat nízko.', '3. hnojení, dosev holých míst.', 'Draselné hnojení před zimou, dosadba.', 'Shrabat listí, poslední seč.', 'Klid.'];
    out.push('<section class="mvg2-page">' + head(ctx, 10) + title('PÉČE PO CELÝ ROK', 'Co dělat měsíc po měsíci')
      + '<div class="mvg2-months">' + MONTH_NAMES.map(function (m, i) { return '<div><strong>' + m + '</strong><span>' + care[i] + '</span></div>'; }).join('') + '</div>'
      + title('HNOJENÍ TRÁVNÍKU · UKÁZKA', 'Váš trávník má podle plánu zhruba ' + lawn + ' m²')
      + '<table class="mvg2-table"><thead><tr><th>Termín</th><th>Hnojivo</th><th>Dávka</th><th>Na ' + lawn + ' m²</th></tr></thead><tbody>'
      + [['Duben', 'Rychlé dusíkaté se sírou (NPK ≈ 27-6-6 + S)'], ['Červen', 'Vyvážené s hořčíkem a železem (NPK ≈ 12-4-9)'], ['Září', 'Rychlé dusíkaté se sírou (NPK ≈ 27-6-6 + S)'], ['Říjen', 'Draselné „zimní“ (NPK ≈ 12-0-42)']].map(function (r) { return '<tr><td><strong>' + r[0] + '</strong></td><td>' + r[1] + '</td><td>25 g/m²</td><td>' + String(dose).replace('.', ',') + ' kg</td></tr>'; }).join('') + '</tbody></table>'
      + '<div class="mvg2-promo"><strong>Trávník je naše parketa</strong><span>Plný roční plán péče a hnojení na míru za 49 Kč – termíny podle vaší nadmořské výšky, řešení mechu a plevele. Kolem Domažlic trávník i založíme a postaráme se o něj. mvgreen.cz · 723 339 650</span></div></section>');

    // 11 – dobré vědět, zdroje
    out.push('<section class="mvg2-page">' + head(ctx, 11) + title('DOBRÉ VĚDĚT PŘED KOPÁNÍM', 'Ať nepřekvapí soused ani úřad')
      + '<div class="mvg2-notes">'
      + '<div><strong>Podzemní sítě</strong><span>Než budete kopat hlouběji než 30 cm, zjistěte, kudy vedou voda, plyn, elektřina a internet – přípojky najdete v dokumentaci domu, u sítí v ulici si vyžádejte vyjádření od správců (zpravidla online).</span></div>'
      + '<div><strong>Vzdálenost od hranice pozemku</strong><span>Podle § 1017 občanského zákoníku se stromy, které obvykle dorůstají nad 3 m, sázejí nejméně 3 m od společné hranice, ostatní stromy 1,5 m (měří se od kmene).</span></div>'
      + '<div><strong>Děti a zvířata</strong><span>' + (safeList.length ? 'Podle databáze ASPCA jsou pro psy a kočky jedovaté: ' + esc(safeList.join(', ')) + '. ' : '') + 'U ostatních rostlin údaj ověřte, než je vysadíte tam, kde si hrají děti nebo pes.</span></div>'
      + '</div><div class="mvg2-sources"><span class="mvg2-cap">ZDROJE</span><span>Jedovatost: ASPCA Animal Poison Control (aspca.org). Hranice pozemku: zákon č. 89/2012 Sb., § 1017. Klima: NASA POWER, Open-Meteo. Údaje o rostlinách a ceny: orientační AI odhad. Vizualizace: AI úprava vaší fotky – rostliny na ní jsou ilustrační.</span></div>'
      + '<p class="mvg2-page__src">Projekt je orientační studie vytvořená s pomocí AI na základě vaší fotky a zadání. Před realizací ověřte rozměry na místě.</p>'
      + '<div class="mvg2-cover__foot"><span>' + (ctx.logo ? '<img src="' + esc(ctx.logo) + '" alt="">' : '') + 'MV GREEN – Péče o zeleň bez starostí</span><span>mvgreen.cz · 723 339 650</span></div></section>');
    return out.join('');
  }

  window.MVGreenPdfV2 = { pages: pages };
})();
