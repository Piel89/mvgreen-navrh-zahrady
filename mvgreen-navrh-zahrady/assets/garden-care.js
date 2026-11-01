/*
 * MVGreen - Roční plán hnojení a péče o zahradu.
 *
 * Deterministický výpočet (žádné AI volání, žádné náklady na API) - placená přidaná hodnota je
 * v tom, že je to spočítané na míru podle plochy trávníku a klimatických podmínek, které si
 * zákazník už zadal v kroku 2 (nadmořská výška, půda, vlhkost, sklon), ne obecný univerzální
 * text "hnojte na jaře a na podzim", co najde kdekoliv zdarma.
 *
 * Harmonogram a NPK typy (2026-11-01, Martinovo zadání "ja mam spracovany plan pro svuj travnik,
 * najdes ruzne druhy hnojiv a tim i mnozstvi a cetnost rozdeleny"): vychází z jeho reálného,
 * profesionálního 9dávkového ročního plánu (dodavatel Agro CS/Lovochemie, 90 m² trávník, 2024),
 * zobecněného na 3 typy hnojiva podle účelu (ne na konkrétní obchodní značku):
 *   A. "Zátěžové hnojivo s vysokým draslíkem" (NPK cca 12-0-42+2MgO) - začátek a konec sezóny,
 *      posiluje odolnost trávníku, málo/žádný dusík, aby netáhlo růst v nevhodnou dobu.
 *   B. "Rychlé hnojivo s dusíkem a sírou" (NPK cca 27-6-6+2S) - start jarního růstu a obnova po
 *      letním horku před podzimem.
 *   C. "Vyvážené hnojivo s hořčíkem a železem" (NPK cca 12-4-9+2MgO+1Fe) - hlavní růstová sezóna,
 *      udržuje sytou barvu a stabilní růst.
 * Dávky (20-30 g/m²) a harmonogram jsou v souladu i s obecnými doporučeními (ceskestavby.cz,
 * husqvarna.cz: 20-30 g/m², 2-3x až 3x dlouhoúčinné hnojivo za sezónu) - tenhle plán je bohatší,
 * profesionální verze toho samého principu, ne vymyšlená navíc.
 *
 * Standing rule: popisujeme jen běžné zahradní práce (hnojení, sečení, zálivka, aerace, přísev,
 * zazimování) - podle obchodního omezení smí odkaz na vlastní služby MVGreen padnout jen u
 * revitalizace trávníku nebo nové výsadby trávníku, nikdy u úpravy terénu (bagr) ani u záhonů.
 *
 * Export: window.MVGreenCarePlan = { computeCarePlan, renderCarePlanHTML }
 */
(function () {
  'use strict';

  var MONTHS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

  /** Tři typy hnojiva podle účelu - viz komentář nahoře. doseGPerM2 je základní dávka pro "normal" půdu. */
  var FERT = {
    K: { name: 'zátěžové hnojivo s vysokým draslíkem', npk: '12-0-42 +2MgO', doseGPerM2: { start: 20, end: 30 } },
    N: { name: 'rychlé hnojivo s dusíkem a sírou', npk: '27-6-6 +2S', doseGPerM2: 20 },
    C: { name: 'vyvážené hnojivo s hořčíkem a železem', npk: '12-4-9 +2MgO +1Fe', doseGPerM2: 30 },
  };

  /**
   * Nadmořská výška posouvá start/konec sezóny - výš je chladněji, sezóna začíná později a
   * končí dřív. Posun v měsících, zaokrouhlený na celé měsíce (0 = nížina do 350 m).
   */
  function altitudeShift(altitude) {
    var a = Number(altitude) || 0;
    if (a >= 700) return 2;
    if (a >= 500) return 1;
    if (a >= 350) return 0.5;
    return 0;
  }

  function shiftMonth(baseMonthIndex, shift) {
    var idx = Math.round(baseMonthIndex + shift);
    while (idx < 0) idx += 12;
    while (idx > 11) idx -= 12;
    return idx;
  }

  /** Jílovitá půda váže živiny déle (nižší dávka), písčitá je rychle vyplavuje (vyšší dávka). */
  function soilMultiplier(soil) {
    if (soil === 'sand') return 1.15;
    if (soil === 'clay') return 0.85;
    return 1;
  }

  function dose(fertKey, areaM2, soilMult, variant) {
    var base = FERT[fertKey].doseGPerM2;
    var gPerM2 = Math.round((typeof base === 'object' ? base[variant || 'start'] : base) * soilMult);
    var kg = areaM2 > 0 ? Math.max(0.1, Math.round(areaM2 * gPerM2) / 1000) : null;
    var label = FERT[fertKey].name + ' (NPK ' + FERT[fertKey].npk + ', ' + gPerM2 + ' g/m²';
    label += kg ? ', cca ' + kg + ' kg na ' + areaM2 + ' m²)' : ')';
    return label;
  }

  /**
   * Hlavní výpočet. Vstup: plocha trávníku v m² a podmínky z kroku 2 formuláře (stejné hodnoty,
   * co používá i createPlan() v app.js pro bezplatný návrh rostlin).
   */
  function computeCarePlan(input) {
    input = input || {};
    var areaM2 = Math.max(0, Number(input.areaM2) || 0);
    var altitude = Number(input.altitude) || 0;
    var soil = input.soil || 'unknown'; // normal | clay | sand | unknown
    var water = input.water || 'normal'; // normal | dry | wet
    var slope = input.slope || 'flat'; // flat | mild | steep
    var shift = altitudeShift(altitude);
    var soilMult = soilMultiplier(soil);

    var waterNote = water === 'dry'
      ? ' Půda je u vás spíš suchá, v horkých týdnech zalévejte o trochu častěji.'
      : water === 'wet'
        ? ' Půda je u vás spíš vlhká - hlídejte hlavně provzdušnění, aby trávník nezahníval.'
        : '';
    var slopeNote = slope === 'steep' ? ' Na svahu zalévejte pomalu a po menších dávkách, aby voda nestékala bez užitku.' : '';

    // 9dávkový profesionální program (březen-listopad, žádné hnojení v zimě) - viz komentář nahoře.
    var months = [
      { i: 0, tasks: ['Zimní klid - trávník nesekat, nehnojit, nevstupovat na zmrzlý nebo podmáčený povrch.'] },
      { i: 1, tasks: ['Zimní klid, příprava na sezónu - naostřit nůž sekačky, zkontrolovat techniku a rozmetadlo hnojiva.'] },
      { i: 2, tasks: ['Jarní vyhrabání napadaného listí a plsti.', '1. dávka: ' + dose('K', areaM2, soilMult, 'start') + ' po oschnutí trávníku - zahájení sezóny, posílení kořenů.'] },
      { i: 3, tasks: ['Pravidelné sečení (začínáme vyšší výškou, cca 5-6 cm).', '2. dávka: ' + dose('N', areaM2, soilMult) + ' - rychlé nastartování růstu a obarvení po zimě.'] },
      { i: 4, tasks: ['Sečení cca 1x týdně.', '3. dávka: ' + dose('C', areaM2, soilMult) + ' - hlavní růstová sezóna začíná.'] },
      { i: 5, tasks: ['4. dávka: ' + dose('C', areaM2, soilMult) + '.', 'Sečení výš (7-8 cm) v horkých dnech, aby trávník lépe snášel sucho.' + waterNote] },
      { i: 6, tasks: ['5. dávka: ' + dose('C', areaM2, soilMult) + '.', 'Zálivka podle potřeby, raději zřídka a vydatně než často a málo.' + waterNote + slopeNote] },
      { i: 7, tasks: ['6. dávka: ' + dose('C', areaM2, soilMult) + '.', 'Nekosit na krátko v suchu a horku.' + waterNote] },
      { i: 8, tasks: ['Vertikutace (prořezání plsti) a aerace trávníku.', '7. dávka: ' + dose('N', areaM2, soilMult) + ' - obnova po letním stresu.', 'Podzimní přísev prořídlých míst - před výsevem použijte startovací hnojivo s vysokým fosforem pro rychlé zakořenění semen, ne běžné sezónní hnojivo.'] },
      { i: 9, tasks: ['8. dávka: ' + dose('C', areaM2, soilMult) + '.', 'Snižujeme frekvenci sečení.'] },
      { i: 10, tasks: ['9. (poslední) dávka: ' + dose('K', areaM2, soilMult, 'end') + ' - zazimování, posílení odolnosti proti mrazu.', 'Poslední seč sezóny (podle počasí), úklid spadaného listí z trávníku.', 'Nářadí a hadice vyklidit, aby nezmrzly.'] },
      { i: 11, tasks: ['Zimní klid - trávník nezatěžovat, nenechávat na něm hromady listí ani sníh z lopaty.'] },
    ];

    // Výstup zůstává v přirozeném pořadí od ledna (m.i), jen LABEL měsíce se posune podle výšky -
    // takže "leden" v horách může nést úkoly, co v nížině platí už pro únor, ale řádek zůstává
    // na svém místě v kalendáři tak, jak ho zákazník čte shora dolů.
    return months.map(function (m) {
      var idx = shiftMonth(m.i, shift);
      return { key: idx, label: MONTHS[idx], tasks: m.tasks.slice() };
    });
  }

  function htmlEscape(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderCarePlanHTML(months) {
    var rows = months.map(function (m) {
      return '<div class="mg-care-month"><strong>' + htmlEscape(m.label) + '</strong><ul>' +
        m.tasks.map(function (t) { return '<li>' + htmlEscape(t) + '</li>'; }).join('') +
        '</ul></div>';
    }).join('');
    return '<div class="mg-care-plan">' + rows + '</div>'
      + '<p class="mg-note">Program vychází z profesionálního 9dávkového hnojení (NPK poměry a dávky 20-30 g/m²), upraveného podle typu půdy a nadmořské výšky. Konkrétní obchodní značku hnojiva si vyberte podle uvedeného NPK poměru - kterýkoliv odpovídající produkt funguje stejně.</p>'
      + '<p class="mg-note">⚠️ Minerální hnojivo aplikujte na suchý trávník, nejlépe před deštěm, a pokud neprší, do pár hodin ho zalijte - jinak hrozí spálení trávníku. Nikdy nehnojte mokrý trávník.</p>'
      + '<p class="mg-note">⚠️ Hnojivo vždy rozmetejte ručním elektrickým rozmetadlem nebo tažným rozmetacím vozíkem - nikdy ne z ruky (nerovnoměrné rozprostření a riziko spálení v místech, kam se dostane víc granulí). Secí vozík na výsev trávy není na hnojivo určený a nepoužívejte ho k němu.</p>';
  }

  var api = { computeCarePlan: computeCarePlan, renderCarePlanHTML: renderCarePlanHTML };
  if (typeof window !== 'undefined') window.MVGreenCarePlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
