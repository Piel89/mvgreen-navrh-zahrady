/*
 * MVGreen - Roční plán hnojení a péče o zahradu.
 *
 * Deterministický výpočet (žádné AI volání, žádné náklady na API) - placená přidaná hodnota je
 * v tom, že je to spočítané na míru podle plochy trávníku a klimatických podmínek, které si
 * zákazník už zadal v kroku 2 (nadmořská výška, půda, vlhkost, sklon, orientace), ne obecný
 * univerzální text, co najde kdekoliv na internetu.
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
    // shift v půlměsících pro jemnější posun (0.5 měsíce), zaokrouhlíme na měsíc až na konci.
    var idx = Math.round(baseMonthIndex + shift);
    while (idx < 0) idx += 12;
    while (idx > 11) idx -= 12;
    return idx;
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

    // Dávka hnojiva - orientační, běžné komerční granulované hnojivo s postupným účinkem.
    // Jílovitá půda váže živiny déle (nižší dávka), písčitá je rychle vyplavuje (o trochu vyšší).
    var doseGPerM2 = soil === 'sand' ? 40 : soil === 'clay' ? 30 : 35;
    var kgPerApplication = areaM2 > 0 ? Math.max(0.5, Math.round((areaM2 * doseGPerM2) / 100) / 10) : null;

    function fertNote() {
      if (!kgPerApplication) return 'granulované hnojivo s postupným účinkem podle návodu na obalu';
      return 'cca ' + kgPerApplication + ' kg granulovaného hnojiva s postupným účinkem (dávka ' + doseGPerM2 + ' g/m² × ' + areaM2 + ' m²)';
    }

    var waterNote = water === 'dry'
      ? ' Půda je u vás spíš suchá, v horkých týdnech zalévejte o trochu častěji.'
      : water === 'wet'
        ? ' Půda je u vás spíš vlhká - hlídejte hlavně provzdušnění, aby trávník nezahníval.'
        : '';
    var slopeNote = slope === 'steep' ? ' Na svahu zalévejte pomalu a po menších dávkách, aby voda nestékala bez užitku.' : '';

    // Plán po měsících - báze pro nížinu (0-350 m), posunutá podle výšky (shift v "půlměsících").
    var months = [
      { i: 0, tasks: ['Zimní klid - trávník nesekat, nehnojit, nevstupovat na zmrzlý nebo podmáčený povrch.'] },
      { i: 1, tasks: ['Zimní klid, příprava na sezónu - naostřit nůž sekačky, zkontrolovat techniku.'] },
      { i: 2, tasks: ['Jarní vyhrabání napadaného listí a plstě.', 'První jarní dávka hnojiva (' + fertNote() + ') po oschnutí trávníku.'] },
      { i: 3, tasks: ['Pravidelné sečení (začínáme vyšší výškou, cca 5-6 cm).', 'Dosev prázdných míst, pokud jsou.'] },
      { i: 4, tasks: ['Sečení cca 1x týdně.', 'Druhá dávka hnojiva (' + fertNote() + ').'] },
      { i: 5, tasks: ['Letní hnojivo s dlouhým účinkem (' + fertNote() + ').', 'Sečení výš (7-8 cm) v horkých dnech, aby trávník lépe snášel sucho.' + waterNote] },
      { i: 6, tasks: ['Zálivka podle potřeby, raději zřídka a vydatně než často a málo.' + waterNote + slopeNote, 'Nekosit na krátko v suchu a horku.'] },
      { i: 7, tasks: ['Stejný režim jako červenec - zálivka, vyšší seč v suchu.' + waterNote] },
      { i: 8, tasks: ['Vertikutace (prořezání plsti) a aerace trávníku.', 'Podzimní přísev prořídlých míst.'] },
      { i: 9, tasks: ['Podzimní hnojivo s draslíkem - zpevní trávník před zimou (' + fertNote() + ').', 'Snižujeme frekvenci sečení.'] },
      { i: 10, tasks: ['Poslední seč sezóny (podle počasí), úklid spadaného listí z trávníku.', 'Zazimování: nářadí a hadice vyklidit, aby nezmrzly.'] },
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
    return '<div class="mg-care-plan">' + rows + '</div>';
  }

  var api = { computeCarePlan: computeCarePlan, renderCarePlanHTML: renderCarePlanHTML };
  if (typeof window !== 'undefined') window.MVGreenCarePlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
