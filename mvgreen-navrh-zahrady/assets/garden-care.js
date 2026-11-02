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
 * Rozšíření (2026-11-01, na základě shrnutí agronomického výzkumu, co poslal Martin -
 * https://share.gemini.google/RvqdPP8K8R74 - tabulka "7. Návrh celoročního plánu údržby a
 * hnojení" se třemi úrovněmi péče): přidán parametr `tier` (nízkoúdržbový / standardní rodinný /
 * reprezentativní), který mění POČET dávek a měsíce, ne jen násobí dávku:
 *   - "high" (Reprezentativní/profesionální, 6-10 hnojení/rok) = PŮVODNÍ 9dávkový plán beze
 *     změny - to je Martinův ověřený reálný plán, nehýbat s ním.
 *   - "standard" (Standardní rodinný, 3-4 hnojení/rok: duben/červen/září/říjen) = odlehčená
 *     verze, 4 dávky.
 *   - "low" (Nízkoúdržbový, 2 hnojení/rok: duben/září) = jen 2 dávky, žádná aerifikace.
 * Dále `problems` (pole: moss/weeds/bare/snowmold/compaction), `lastFertilized`
 * (spring_done/none/unknown), `irrigation` (auto/manual/none) a `fertType`
 * (fast/crf/organic/auto) - viz PROBLEM_NOTES a FERT_TYPE_NOTE níže. Tyhle čtyři jen DOPLŇUJÍ
 * texty/poznámky, nemění strukturu měsíců (aby se nerozbily tiery výše).
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

  /** Krátký popis úrovně péče pro hlavičku výstupního dokumentu (viz TIER_META použití níže). */
  var TIER_META = {
    low: { label: 'Nízká údržba', freq: '2× ročně', nRange: '8-10 g N/m²/rok' },
    standard: { label: 'Běžný rodinný trávník', freq: '4× ročně', nRange: '15-20 g N/m²/rok' },
    representative: { label: 'Anglický trávník', freq: 'cca každé 4 týdny (III-XI)', nRange: '20-30 g N/m²/rok' },
    sportovni: { label: 'Sportovní trávník', freq: '9× ročně', nRange: '20-30 g N/m²/rok' },
    // "high" zůstává jako starší alias pro reprezentativní (zpětná kompatibilita se staršími voláními,
    // co ho posílaly jako jednu kolonku "Reprezentativní / sportovní" - viz 2026-11-02 oprava níže).
    high: { label: 'Reprezentativní / sportovní', freq: '9× ročně', nRange: '20-30 g N/m²/rok' },
  };

  /** Poznámka navíc podle TYPU zátěže u nejvyšší úrovně péče - Martin upozornil (2026-11-02), že
   * "reprezentativní" (vzhled, nízké opotřebení) a "sportovní" (pravidelná zátěž, časté opotřebení)
   * jsou odlišné potřeby, i když hnojivový harmonogram (schedule High) je pro obě stejný. */
  var USE_NOTES = {
    sportovni: 'Sportovní zátěž trávník mechanicky opotřebovává - po náročnějším víkendu nebo zápase poškozená místa co nejdřív dosejte (15-25 g osiva/m²) a aerifikaci dutými hroty plánujte častěji než jednou za rok, aby půda pod zátěží nezhutněla.',
    representative: 'Anglický trávník se hnojí pravidelně cca každé 4 týdny po celou hlavní sezónu (březen až listopad, 9 dávek v kalendáři níže) - sekejte častěji a na nižší výšku (cca 3-4 cm) pro hustý, jemný trávník, okraje pravidelně zarovnávejte a vyhýbejte se zbytečnému zatěžování čerstvě posečené plochy.',
  };

  /** Měsíc (0=Leden..11=Prosinec) -> meteorologické roční období, pro seskupení výstupu -
   * 12 jednotlivých měsíců v řadě bylo nepřehledné, 4 sezóny s ikonou jsou skenovatelné na první
   * pohled (Martin, 2026-11-01: "tohle po mesici je neprehledne a neprofesionalni"). */
  var SEASONS = [
    { key: 'spring', label: 'Jaro', icon: '🌱', months: [2, 3, 4] },
    { key: 'summer', label: 'Léto', icon: '☀️', months: [5, 6, 7] },
    { key: 'autumn', label: 'Podzim', icon: '🍂', months: [8, 9, 10] },
    { key: 'winter', label: 'Zima', icon: '❄️', months: [11, 0, 1] },
  ];

  /** Tři typy hnojiva podle účelu - viz komentář nahoře. doseGPerM2 je základní dávka pro "normal" půdu. */
  var FERT = {
    K: { name: 'zátěžové hnojivo s vysokým draslíkem', npk: '12-0-42 +2MgO', doseGPerM2: { start: 20, end: 30 } },
    N: { name: 'rychlé hnojivo s dusíkem a sírou', npk: '27-6-6 +2S', doseGPerM2: 20 },
    C: { name: 'vyvážené hnojivo s hořčíkem a železem', npk: '12-4-9 +2MgO +1Fe', doseGPerM2: 30 },
  };

  /** Jen informační dovětek k dávce podle preferovaného TYPU hnojiva - NPK poměr a gramáž níže
   * zůstávají stejné orientační číslo, ať zákazník sáhne po jakékoliv značce/formě se stejným
   * přibližným složením; tohle mu jen řekne, na co se dívat v obchodě. */
  var FERT_TYPE_NOTE = {
    fast: 'rychlorozpustné minerální (působí 1-3 týdny, nejlevnější, ale po aplikaci je potřeba brzy zalít, jinak hrozí spálení)',
    crf: 's pomalým uvolňováním - CRF (působí 2-3 měsíce, dražší, ale minimální riziko spálení a nemusíte na něj tak často myslet)',
    organic: 'organické/organominerální (působí 1-3 měsíce, nulové riziko spálení, navíc dlouhodobě zlepšuje půdu, ale účinek je pomalejší)',
  };

  var PROBLEM_NOTES = {
    moss: 'Mech v trávníku bývá signál kyselé půdy, zastínění nebo zhutnění - doporučujeme změřit pH (levné soupravy v zahradnictví) a v hnojivu upřednostnit variantu se železem, které mech navíc mechanicky potlačuje a dodá sytě zelenou barvu.',
    weeds: 'Dvouděložné plevele (jetel, pampeliška apod.) jde ručně vytrhávat, nebo použít schválený herbicid pro neprofesionální uživatele - ideálně v květnu/červnu, ne ve stejném týdnu jako hnojení.',
    bare: 'Na holá a řídká místa počítejte s přísevem při podzimní regeneraci - cca 15-25 g osiva/m², zapravit hráběmi max. 0,5 cm hluboko a první 2 týdny udržovat povrch trvale vlhký.',
    snowmold: 'Loni jste měli plíseň sněžnou - po 15. září proto nehnojte už nic s dusíkem, jen draslíkaté podzimní hnojivo, pravidelně hrabejte spadané listí a strniště před zimou nenechávejte vyšší než 5 cm.',
    compaction: 'Zhutněná půda nebo voda, co se drží na povrchu, = aerifikace dutými hroty letos jednoznačně doporučujeme, i kdyby to zvolená úroveň péče jinak nevyžadovala - jinak kořeny nemají dost vzduchu a trávník se nebude zlepšovat.',
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

  function dose(fertKey, areaM2, soilMult, variant, fertType) {
    var base = FERT[fertKey].doseGPerM2;
    var gPerM2 = Math.round((typeof base === 'object' ? base[variant || 'start'] : base) * soilMult);
    var kg = areaM2 > 0 ? Math.max(0.1, Math.round(areaM2 * gPerM2) / 1000) : null;
    var label = FERT[fertKey].name + ' (NPK ' + FERT[fertKey].npk + ', ' + gPerM2 + ' g/m²';
    label += kg ? ', cca ' + kg + ' kg na ' + areaM2 + ' m²)' : ')';
    if (fertType && FERT_TYPE_NOTE[fertType]) label += ' - typ: ' + FERT_TYPE_NOTE[fertType];
    return label;
  }

  /** Harmonogram pro tier="high" (Reprezentativní/profesionální, 6-10 hnojení/rok) - původní,
   * neměněný 9dávkový program březen-listopad. */
  function scheduleHigh(areaM2, soilMult, waterNote, slopeNote, fertType) {
    return [
      { i: 0, tasks: ['Zimní klid - trávník nesekat, nehnojit, nevstupovat na zmrzlý nebo podmáčený povrch.'] },
      { i: 1, tasks: ['Zimní klid, příprava na sezónu - naostřit nůž sekačky, zkontrolovat techniku a rozmetadlo hnojiva.'] },
      { i: 2, tasks: ['Jarní vyhrabání napadaného listí a plsti.', '1. dávka: ' + dose('K', areaM2, soilMult, 'start', fertType) + ' po oschnutí trávníku - zahájení sezóny, posílení kořenů.'] },
      { i: 3, tasks: ['Pravidelné sečení (začínáme vyšší výškou, cca 5-6 cm).', '2. dávka: ' + dose('N', areaM2, soilMult, null, fertType) + ' - rychlé nastartování růstu a obarvení po zimě.'] },
      { i: 4, tasks: ['Sečení cca 1x týdně.', '3. dávka: ' + dose('C', areaM2, soilMult, null, fertType) + ' - hlavní růstová sezóna začíná.'] },
      { i: 5, tasks: ['4. dávka: ' + dose('C', areaM2, soilMult, null, fertType) + '.', 'Sečení výš (7-8 cm) v horkých dnech, aby trávník lépe snášel sucho.' + waterNote] },
      { i: 6, tasks: ['5. dávka: ' + dose('C', areaM2, soilMult, null, fertType) + '.', 'Zálivka podle potřeby, raději zřídka a vydatně než často a málo.' + waterNote + slopeNote] },
      { i: 7, tasks: ['6. dávka: ' + dose('C', areaM2, soilMult, null, fertType) + '.', 'Nekosit na krátko v suchu a horku.' + waterNote] },
      { i: 8, tasks: ['Vertikutace (prořezání plsti) a aerace trávníku.', '7. dávka: ' + dose('N', areaM2, soilMult, null, fertType) + ' - obnova po letním stresu.', 'Podzimní přísev prořídlých míst - před výsevem použijte startovací hnojivo s vysokým fosforem pro rychlé zakořenění semen, ne běžné sezónní hnojivo.'] },
      { i: 9, tasks: ['8. dávka: ' + dose('C', areaM2, soilMult, null, fertType) + '.', 'Snižujeme frekvenci sečení.'] },
      { i: 10, tasks: ['9. (poslední) dávka: ' + dose('K', areaM2, soilMult, 'end', fertType) + ' - zazimování, posílení odolnosti proti mrazu.', 'Poslední seč sezóny (podle počasí), úklid spadaného listí z trávníku.', 'Nářadí a hadice vyklidit, aby nezmrzly.'] },
      { i: 11, tasks: ['Zimní klid - trávník nezatěžovat, nenechávat na něm hromady listí ani sníh z lopaty.'] },
    ];
  }

  /** Harmonogram pro tier="standard" (Standardní rodinný, 3-4 hnojení/rok: duben/červen/
   * září/říjen, N 15-20 g/m²/rok, vertikutace 2x, aerifikace cca 1x za 2 roky) - odlehčená
   * verze pro běžné použití (děti, pes, chce to vypadat hezky, ale bez profi režimu). */
  function scheduleStandard(areaM2, soilMult, waterNote, slopeNote, fertType) {
    return [
      { i: 0, tasks: ['Zimní klid - trávník nesekat, nehnojit, nevstupovat na zmrzlý nebo podmáčený povrch.'] },
      { i: 1, tasks: ['Zimní klid, příprava na sezónu - naostřit nůž sekačky, zkontrolovat techniku.'] },
      { i: 2, tasks: ['Jarní vyhrabání napadaného listí a plsti, lehká jarní vertikutace (2-3 mm) na prohřáté a mírně suché půdě.'] },
      { i: 3, tasks: ['1. dávka: ' + dose('K', areaM2, soilMult, 'start', fertType) + ' po oschnutí trávníku - start sezóny, posílení kořenů.', 'Pravidelné sečení (začínáme vyšší výškou, cca 5 cm).'] },
      { i: 4, tasks: ['Sečení cca 1x týdně, hlavní růstová sezóna.'] },
      { i: 5, tasks: ['2. dávka: ' + dose('C', areaM2, soilMult, null, fertType) + '.', 'Sečení výš (6-7 cm) v horkých dnech, aby trávník lépe snášel sucho.' + waterNote + slopeNote] },
      { i: 6, tasks: ['Nekosit na krátko v suchu a horku.' + waterNote] },
      { i: 7, tasks: ['Intenzitu zatížení (sport, grilování) v tropických vedrech trochu omezte, trávník si v tu dobu hůř regeneruje.'] },
      { i: 8, tasks: ['Podzimní vertikutace a přísev prořídlých míst.', '3. dávka: ' + dose('N', areaM2, soilMult, null, fertType) + ' - obnova po letním stresu.', 'Aerifikace se u tohoto režimu doporučuje cca 1x za 2 roky - pokud letos (nebo loni) ještě nebyla, je teď dobrý čas.'] },
      { i: 9, tasks: ['4. (poslední) dávka: ' + dose('K', areaM2, soilMult, 'end', fertType) + ' - zazimování, posílení odolnosti proti mrazu.'] },
      { i: 10, tasks: ['Poslední seč sezóny (podle počasí), úklid spadaného listí z trávníku.', 'Nářadí a hadice vyklidit, aby nezmrzly.'] },
      { i: 11, tasks: ['Zimní klid - trávník nezatěžovat, nenechávat na něm hromady listí ani sníh z lopaty.'] },
    ];
  }

  /** Harmonogram pro tier="low" (Nízkoúdržbový, 2 hnojení/rok: duben/září, N 8-10 g/m²/rok,
   * vertikutace jen 1x zjara, aerifikace se vynechává). Záměrně obsahuje jen pár řádků - to je
   * přesně smysl téhle úrovně. */
  function scheduleLow(areaM2, soilMult, waterNote, slopeNote, fertType) {
    return [
      { i: 2, tasks: ['Jarní vyhrabání napadaného listí, volitelně lehká jarní vertikutace (stačí 1x ročně).'] },
      { i: 3, tasks: ['Jediná jarní dávka: ' + dose('K', areaM2, soilMult, 'start', fertType) + ' - na celé jaro a léto to stačí.', 'Sečení cca 1x za 10-14 dní, na vyšší výšku (5-7 cm) - nenáročný režim.'] },
      { i: 8, tasks: ['Podzimní (poslední) dávka: ' + dose('K', areaM2, soilMult, 'end', fertType) + ' - tím letos hnojení končí.', 'Přísev prořídlých míst, pokud je potřeba.'] },
      { i: 10, tasks: ['Poslední seč sezóny, úklid spadaného listí z trávníku.'] },
    ];
  }

  /**
   * Hlavní výpočet. Vstup: plocha trávníku v m² a podmínky z kroku 2 formuláře (stejné hodnoty,
   * co používá i createPlan() v app.js pro bezplatný návrh rostlin), plus volitelné:
   *  - tier: 'low' | 'standard' | 'high' (default 'standard')
   *  - problems: pole z ['moss','weeds','bare','snowmold','compaction']
   *  - lastFertilized: 'spring_done' | 'none' | 'unknown' (default 'unknown')
   *  - irrigation: 'auto' | 'manual' | 'none' (default '' = neznámo, nic se nedoplní)
   *  - fertType: 'fast' | 'crf' | 'organic' | 'auto' (default 'auto' = nic se nedoplňuje k dávkám)
   * Vrací pole měsíců (pro zpětnou kompatibilitu se staršími voláními, co žádné z nových polí
   * neposílají) - obecné poznámky navíc visí jako .notes a .startNote PŘÍMO NA TOM POLI (JS
   * pole je objekt, tohle nerozbije žádné .map()/.length volání u starších volajících).
   */
  function computeCarePlan(input) {
    input = input || {};
    var areaM2 = Math.max(0, Number(input.areaM2) || 0);
    var altitude = Number(input.altitude) || 0;
    var soil = input.soil || 'unknown'; // normal | clay | sand | unknown
    var water = input.water || 'normal'; // normal | dry | wet
    var slope = input.slope || 'flat'; // flat | mild | steep
    var tier = ['low', 'high', 'representative', 'sportovni'].indexOf(input.tier) !== -1 ? input.tier : 'standard';
    var problems = Array.isArray(input.problems) ? input.problems.filter(function (p) { return PROBLEM_NOTES[p]; }) : [];
    var lastFertilized = input.lastFertilized || 'unknown';
    var irrigation = input.irrigation || '';
    var fertType = input.fertType && FERT_TYPE_NOTE[input.fertType] ? input.fertType : '';
    var shift = altitudeShift(altitude);
    var soilMult = soilMultiplier(soil);

    var waterNote = water === 'dry'
      ? ' Půda je u vás spíš suchá, v horkých týdnech zalévejte o trochu častěji.'
      : water === 'wet'
        ? ' Půda je u vás spíš vlhká - hlídejte hlavně provzdušnění, aby trávník nezahníval.'
        : '';
    var slopeNote = slope === 'steep' ? ' Na svahu zalévejte pomalu a po menších dávkách, aby voda nestékala bez užitku.' : '';

    var builder = (tier === 'high' || tier === 'representative' || tier === 'sportovni') ? scheduleHigh : tier === 'low' ? scheduleLow : scheduleStandard;
    var months = builder(areaM2, soilMult, waterNote, slopeNote, fertType);

    // Výstup zůstává v přirozeném pořadí od ledna (m.i), jen LABEL měsíce se posune podle výšky -
    // takže "leden" v horách může nést úkoly, co v nížině platí už pro únor, ale řádek zůstává
    // na svém místě v kalendáři tak, jak ho zákazník čte shora dolů.
    var result = months.map(function (m) {
      var idx = shiftMonth(m.i, shift);
      return { key: idx, label: MONTHS[idx], tasks: m.tasks.slice() };
    });

    // Obecné poznámky navíc (zavlažování, problémy, poslední hnojení) - nejsou vázané na
    // konkrétní měsíc, zobrazují se jednou nahoře nad kalendářem.
    var notes = [];
    if (USE_NOTES[tier]) notes.push(USE_NOTES[tier]);
    if (irrigation === 'auto') {
      notes.push('Automatickou závlahu nastavte podle teploty: do 20 °C cca 10-15 l/m²/týden, 20-25 °C 15-25 l/m²/týden, nad 30 °C až 35-50 l/m²/týden - ideálně spouštět mezi 4:00 a 8:00 ráno, aby se co nejméně vypařilo a tráva do večera oschla.');
    } else if (irrigation === 'manual') {
      notes.push('Zalévejte vydatně a méně často (15-25 l/m² najednou) místo denního krátkého kropení - ideálně ráno mezi 4:00 a 8:00, aby tráva do večera oschla a nevznikaly houbové choroby.');
    } else if (irrigation === 'none') {
      notes.push('Bez zálivky trávník v suchých vedrech přirozeně zežloutne a utlumí růst (letní dormance) - to je normální obranná reakce, ne poškození, po dešti se zase zazelená. V tomto období navíc nehnojte, dusík bez vody trávník spíš poškodí.');
    }
    problems.forEach(function (p) { notes.push(PROBLEM_NOTES[p]); });
    if (lastFertilized === 'spring_done') {
      notes.push('Jarní dávku jste letos už aplikovali - první dávku v kalendáři níže letos vynechejte a pokračujte až další v pořadí.');
    } else if (lastFertilized === 'none') {
      notes.push('Letos jste ještě nehnojili - klidně začněte první dávkou z kalendáře co nejdřív, i když aktuální měsíc úplně neodpovídá; jen pokud je už po polovině září, přeskočte rovnou na poslední podzimní (draslíkovou) dávku.');
    }
    result.notes = notes;
    // Metadata pro hezčí výstupní dokument (hlavička se jménem plánu, přehledová lišta) -
    // visí na vráceném poli stejným trikem jako .notes, aby se nerozbilo žádné starší volání,
    // co o nich neví.
    result.tier = tier;
    result.tierMeta = TIER_META[tier];
    result.areaM2 = areaM2;
    result.planName = (input.planName || '').toString().trim() || null;
    return result;
  }

  function htmlEscape(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtToday() {
    var d = new Date();
    return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
  }

  /** Výstupní "dokument", ne jen prostý seznam měsíců (Martin, 2026-11-01: "musi to byt nejaky
   * hezky vystupni formular ... tohle po mesici je neprehledne a neprofesionalni"): hlavička se
   * jménem plánu (pokud ho zákazník zadal - viz computeCarePlan .planName), přehledová lišta se
   * statistikami, kalendář seskupený podle 4 ročních období (ne 12 řádků zvlášť) a tlačítko na
   * tisk/uložení jako PDF. Celý výstup je obalený v .mg-care-report, aby ho šlo cíleně vytisknout
   * (viz @media print v app.css) bez zbytku formuláře okolo. */
  function renderCarePlanHTML(months) {
    var title = (months && months.planName) || 'Roční plán péče o trávník';
    var tierMeta = (months && months.tierMeta) || null;
    var areaM2 = months && months.areaM2;

    var statChips = [];
    if (areaM2 > 0) statChips.push({ label: 'Plocha trávníku', value: areaM2 + ' m²' });
    if (tierMeta) {
      statChips.push({ label: 'Úroveň péče', value: tierMeta.label });
      statChips.push({ label: 'Hnojení za rok', value: tierMeta.freq });
      statChips.push({ label: 'Dusík (N)', value: tierMeta.nRange });
    }
    var statHtml = statChips.length
      ? '<div class="mg-care-stats">' + statChips.map(function (s) {
        return '<div class="mg-care-stat"><small>' + htmlEscape(s.label) + '</small><strong>' + htmlEscape(s.value) + '</strong></div>';
      }).join('') + '</div>'
      : '';

    var noteRows = (months && months.notes && months.notes.length)
      ? '<div class="mg-care-extra-notes"><h4>Na co si dát pozor u vás</h4><ul>' + months.notes.map(function (n) { return '<li>' + htmlEscape(n) + '</li>'; }).join('') + '</ul></div>'
      : '';

    // Seskupení měsíců (months[].key je 0=Leden..11=Prosinec) do 4 sezón, v pořadí Jaro->Zima -
    // přirozený čtenářský tok "co dělat teď na jaře, pak v létě, ..." i pro nízkoúdržbový tier,
    // kterému chybí celé měsíce (SEASONS sekce bez položek se prostě vynechá).
    var byKey = {};
    (months || []).forEach(function (m) { byKey[m.key] = m; });
    var seasonsHtml = SEASONS.map(function (season) {
      var items = season.months.map(function (k) { return byKey[k]; }).filter(Boolean);
      if (!items.length) return '';
      var monthsHtml = items.map(function (m) {
        return '<div class="mg-care-month"><strong>' + htmlEscape(m.label) + '</strong><ul>' +
          m.tasks.map(function (t) { return '<li>' + htmlEscape(t) + '</li>'; }).join('') +
          '</ul></div>';
      }).join('');
      return '<section class="mg-care-season"><h4><span class="mg-care-season-icon" aria-hidden="true">' + season.icon + '</span>' + season.label + '</h4><div class="mg-care-season-months">' + monthsHtml + '</div></section>';
    }).join('');

    return '<div class="mg-care-report">'
      + '<header class="mg-care-report-head"><span class="mg-care-report-eyebrow">🌿 MVGreen · Roční plán péče</span><h3>' + htmlEscape(title) + '</h3><small>Vytvořeno ' + fmtToday() + '</small>'
      + '<button type="button" class="mg-care-print" onclick="window.print()">🖨️ Vytisknout / uložit jako PDF</button></header>'
      + statHtml
      + noteRows
      + '<div class="mg-care-plan">' + seasonsHtml + '</div>'
      + '<p class="mg-note">Program vychází z profesionálního hnojení (NPK poměry a dávky orientačně 20-30 g/m²), upraveného podle zvolené úrovně péče, typu půdy a nadmořské výšky. Konkrétní obchodní značku hnojiva si vyberte podle uvedeného NPK poměru - kterýkoliv odpovídající produkt funguje stejně.</p>'
      + '<p class="mg-note">⚠️ Minerální hnojivo aplikujte na suchý trávník, nejlépe před deštěm, a pokud neprší, do pár hodin ho zalijte - jinak hrozí spálení trávníku. Nikdy nehnojte mokrý trávník.</p>'
      + '<p class="mg-note">⚠️ Hnojivo vždy rozmetejte ručním elektrickým rozmetadlem nebo tažným rozmetacím vozíkem - nikdy ne z ruky (nerovnoměrné rozprostření a riziko spálení v místech, kam se dostane víc granulí). Secí vozík na výsev trávy není na hnojivo určený a nepoužívejte ho k němu.</p>'
      + '</div>';
  }

  // FERT_TYPE_NOTE se exportuje i samo o sobě (ne jen zabalené v textu poznámky u dávky), aby ho
  // mohl app.js 2026-11-02 znovu použít jako popisky "ⓘ" u vlastního výběru typu hnojiva (#mg-care2-ferttype)
  // - stejný text na dvou místech, ale psaný jen jednou, ať se časem nerozjedou.
  var api = { computeCarePlan: computeCarePlan, renderCarePlanHTML: renderCarePlanHTML, FERT_TYPE_NOTE: FERT_TYPE_NOTE };
  if (typeof window !== 'undefined') window.MVGreenCarePlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
