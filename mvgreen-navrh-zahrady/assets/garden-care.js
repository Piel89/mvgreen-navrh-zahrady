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
 * Přepracování výstupu (2026-11-02, na přání Martina - viz celé jeho zadání v komentáři u
 * renderCarePlanHTML níže): 1) hnojení už není zamotané do měsíčních odrážek jako text, ale
 * samostatná TABULKA (termín/úkon/hnojivo/dávka/celkem), přesně jako tabulka v kapitole 7 jeho
 * vlastního podkladu; 2) každý úkol v měsíci má typ 'do' (udělat) / 'warn' (dát si pozor) /
 * 'avoid' (neuspěchat, počkat) a vykresluje se barevně; 3) oprava agronomické chyby: jarní
 * vertikutace se u standard/low tieru dřív nabízela už v březnu - podklad i agronomie (kapitola
 * 2 a 4 jeho dokumentu) ale jasně říkají, že se dělá až v dubnu, na půdě prohřáté nad 8-10 °C -
 * dřív trávníku spíš uškodí, než pomůže. Březen teď jen vyhrabává a hlídá, že se má počkat.
 *
 * Export: window.MVGreenCarePlan = { computeCarePlan, renderCarePlanHTML }
 */
(function () {
  'use strict';

  var MONTHS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

  /** Jeden úkol v měsíci = text + typ pro barevné rozlišení ve výstupu (D=udělat/zelená,
   * W=dát si pozor/oranžová, A=neuspěchat-nedělat teď/červená). Factory funkce místo ručního
   * {text:...,type:...} na každém řádku, ať se harmonogramy níže dají číst jako obyčejný seznam. */
  function D(text) { return { text: text, type: 'do' }; }
  function W(text) { return { text: text, type: 'warn' }; }
  function A(text) { return { text: text, type: 'avoid' }; }

  /** Krátký popis úrovně péče pro hlavičku výstupního dokumentu (viz TIER_META použití níže). */
  var TIER_META = {
    low: { label: 'Nízká údržba', freq: '2× ročně', nRange: '8-10 g N/m²/rok' },
    standard: { label: 'Běžný rodinný trávník', freq: '4× ročně', nRange: '15-20 g N/m²/rok' },
    representative: { label: 'Anglický trávník', freq: '8× ročně (III-XI, bez srpna)', nRange: '20-30 g N/m²/rok' },
    sportovni: { label: 'Sportovní trávník', freq: '8× ročně', nRange: '20-30 g N/m²/rok' },
    // "high" zůstává jako starší alias pro reprezentativní (zpětná kompatibilita se staršími voláními,
    // co ho posílaly jako jednu kolonku "Reprezentativní / sportovní" - viz 2026-11-02 oprava níže).
    high: { label: 'Reprezentativní / sportovní', freq: '8× ročně', nRange: '20-30 g N/m²/rok' },
  };

  /** Poznámka navíc podle TYPU zátěže u nejvyšší úrovně péče - Martin upozornil (2026-11-02), že
   * "reprezentativní" (vzhled, nízké opotřebení) a "sportovní" (pravidelná zátěž, časté opotřebení)
   * jsou odlišné potřeby, i když hnojivový harmonogram (schedule High) je pro obě stejný. */
  var USE_NOTES = {
    sportovni: 'Sportovní zátěž trávník mechanicky opotřebovává - po náročnějším víkendu nebo zápase poškozená místa co nejdřív dosejte (15-25 g osiva/m²) a aerifikaci dutými hroty plánujte častěji než jednou za rok, aby půda pod zátěží nezhutněla.',
    representative: 'Anglický trávník se hnojí pravidelně cca každé 4 týdny po celou hlavní sezónu (březen až listopad, 8 dávek v tabulce níže - v srpnu se při vedru a riziku chorob vynechává) - sekejte co 3-4 dny (nikdy víc než 1/3 výšky stébla najednou) a na nižší výšku (cca 3-4 cm) pro hustý, jemný trávník, okraje pravidelně zarovnávejte a vyhýbejte se zbytečnému zatěžování čerstvě posečené plochy.',
  };

  /** Rady, co neplatí pro jeden konkrétní měsíc, ale pro celou sezónu podle počasí (Martin,
   * 2026-11-02: "jsou veci co plati pro cely leto treba nekosit na kratko ne jen pro Srpen") -
   * dřív byly přibité k jednomu náhodnému měsíci uprostřed léta, takže zákazník čtoucí jiný
   * letní měsíc je snadno přehlédl. Teď se zobrazují jednou nahoře u sezóny (viz
   * renderCarePlanHTML), ne schované v kartě jednoho měsíce. Nízkoúdržbový tier žádné nemá -
   * to je u něj záměr, ne mezera. */
  var SEASON_GENERAL = {
    high: {
      summer: [
        W('Sečení výš (7-8 cm) v horkých dnech, aby trávník lépe snášel sucho.{{WATER}}'),
        W('Zálivka podle potřeby, raději zřídka a vydatně než často a málo.{{WATER}}{{SLOPE}}'),
        A('Nekosit na krátko v suchu a horku.{{WATER}}'),
        W('Ve vlhku a horku hlídejte i jiné choroby než plíseň sněžnou - rezavé skvrny (rez travní) nebo hnědé skvrny s tmavým okrajem (listová skvrnitost) signalizují, že trávník potřebuje míň dusíku a víc vzduchu (prořídnout zálivku, nesekat nakrátko).'),
      ],
    },
    standard: {
      summer: [
        W('Sečení výš (6-7 cm) v horkých dnech, aby trávník lépe snášel sucho.{{WATER}}{{SLOPE}}'),
        A('Nekosit na krátko v suchu a horku.{{WATER}}'),
        W('Ve vlhku a horku hlídejte i jiné choroby než plíseň sněžnou - rezavé skvrny (rez travní) nebo hnědé skvrny s tmavým okrajem (listová skvrnitost) signalizují, že trávník potřebuje míň dusíku a víc vzduchu.'),
      ],
    },
  };
  // "representative"/"sportovni" sdílí harmonogram i sezónní rady se starším aliasem "high".
  SEASON_GENERAL.representative = SEASON_GENERAL.high;
  SEASON_GENERAL.sportovni = SEASON_GENERAL.high;

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
    K: { name: 'Zátěžové hnojivo s vysokým draslíkem', npk: '12-0-42 +2MgO', doseGPerM2: { start: 20, end: 30 } },
    N: { name: 'Rychlé hnojivo s dusíkem a sírou', npk: '27-6-6 +2S', doseGPerM2: 20 },
    C: { name: 'Vyvážené hnojivo s hořčíkem a železem', npk: '12-4-9 +2MgO +1Fe', doseGPerM2: 30 },
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

  /** Syrová čísla dávky (g/m² a kg na zadanou plochu) - společný základ pro tabulku hnojení
   * (fertTableRow) i pro případný textový popis. */
  function doseData(fertKey, areaM2, soilMult, variant) {
    var base = FERT[fertKey].doseGPerM2;
    var gPerM2 = Math.round((typeof base === 'object' ? base[variant || 'start'] : base) * soilMult);
    var kg = areaM2 > 0 ? Math.max(0.1, Math.round(areaM2 * gPerM2) / 1000) : null;
    return { gPerM2: gPerM2, kg: kg };
  }

  /** Jeden řádek tabulky hnojení (viz computeCarePlan -> .fertTable a renderem renderFertTable). */
  function fertTableRow(monthLabel, action, fertKey, variant, areaM2, soilMult) {
    var d = doseData(fertKey, areaM2, soilMult, variant);
    return {
      month: monthLabel,
      action: action,
      name: FERT[fertKey].name,
      npk: FERT[fertKey].npk,
      doseG: d.gPerM2,
      totalKg: d.kg,
      areaM2: areaM2,
    };
  }

  /** Harmonogram pro tier="high" (Reprezentativní/profesionální, 6-10 hnojení/rok) - původní,
   * neměněný 9dávkový program březen-listopad (Martinův ověřený reálný plán - měsíce a počet
   * dávek se tu nehýbou, mění se jen to, ŽE se hnojení zobrazuje zvlášť v tabulce místo v textu
   * odrážky, a typy úkolů pro barevné rozlišení). */
  function scheduleHigh() {
    return [
      { i: 0, tasks: [A('Zimní klid - trávník nesekat, nehnojit, nevstupovat na zmrzlý nebo podmáčený povrch.')] },
      { i: 1, tasks: [D('Zimní klid, příprava na sezónu - naostřit nůž sekačky, zkontrolovat techniku a rozmetadlo hnojiva.')] },
      { i: 2, tasks: [D('Jarní vyhrabání napadaného listí a plsti.')], fert: { key: 'K', variant: 'start', action: 'Jarní vyhrabání, 1. dávka po oschnutí trávníku - zahájení sezóny, posílení kořenů' } },
      { i: 3, tasks: [D('Pravidelné sečení (začínáme vyšší výškou, cca 5-6 cm).')], fert: { key: 'N', action: '2. dávka - rychlé nastartování růstu a obarvení po zimě' } },
      { i: 4, tasks: [D('V hlavní růstové sezóně sekejte co 3-4 dny (u anglického trávníku je častější sečení žádoucí a dělá hustotu i jemnost trávníku) - nikdy ale neseřezávejte najednou víc než 1/3 výšky stébla, jinak trávník zbytečně stresujete.'), D('Při sečení rovnou zarovnejte i okraje trávníku podél záhonů a chodníků (hranová seč) - udrží to ostrou, upravenou hranici, ne jen posekanou plochu.')], fert: { key: 'C', action: '3. dávka - hlavní růstová sezóna začíná' } },
      { i: 5, tasks: [], fert: { key: 'C', action: '4. dávka' } },
      { i: 6, tasks: [D('V polovině sezóny nůž znovu naostřete - po pár měsících sečení už spíš trhá, než řeže, a natržená stébla snáz napadají houbové choroby.')], fert: { key: 'C', action: '5. dávka' } },
      { i: 8, tasks: [D('Vertikutace (prořezání plsti) a aerace trávníku.'), D('Podzimní přísev prořídlých míst - před výsevem použijte startovací hnojivo s vysokým fosforem pro rychlé zakořenění semen, ne běžné sezónní hnojivo.'), W('Zkontrolujte drn, jestli se dá lehce nadzvednout nebo odchlípnout jako koberec - znamení larev chroustů (ponrav) v kořenech. Pokud ano, řešte buď biologicky (hlístice do zalévané půdy) nebo chemickým přípravkem proti ponravám podle návodu.')], fert: { key: 'N', action: '6. dávka - obnova po letním stresu' } },
      { i: 9, tasks: [D('Snižujeme frekvenci sečení.')], fert: { key: 'C', action: '7. dávka' } },
      { i: 10, tasks: [D('Poslední seč sezóny (podle počasí), úklid spadaného listí z trávníku.'), D('Nářadí a hadice vyklidit, aby nezmrzly.')], fert: { key: 'K', variant: 'end', action: '8. (poslední) dávka - zazimování, posílení odolnosti proti mrazu' } },
      { i: 11, tasks: [A('Zimní klid - trávník nezatěžovat, nenechávat na něm hromady listí ani sníh z lopaty.')] },
    ];
  }

  /** Harmonogram pro tier="standard" (Standardní rodinný, 3-4 hnojení/rok: duben/červen/
   * září/říjen, N 15-20 g/m²/rok, vertikutace 2x, aerifikace cca 1x za 2 roky) - odlehčená
   * verze pro běžné použití (děti, pes, chce to vypadat hezky, ale bez profi režimu).
   * 2026-11-02 oprava: jarní vertikutace přesunuta z března do dubna (až je půda prohřátá nad
   * 8-10 °C) - dřív v chladné půdě trávníku spíš škodí, viz Martinův podklad kap. 2 a 4 i jeho
   * přímé upozornění ("delat vertikutaci v obdobi kdy ma pudni profil pod 10 C jen travnik
   * zhorsi"). Březen teď jen vyhrabává a výslovně říká "ještě ne". */
  function scheduleStandard() {
    return [
      { i: 0, tasks: [A('Zimní klid - trávník nesekat, nehnojit, nevstupovat na zmrzlý nebo podmáčený povrch.')] },
      { i: 1, tasks: [D('Zimní klid, příprava na sezónu - naostřit nůž sekačky, zkontrolovat techniku.')] },
      { i: 2, tasks: [D('Jarní vyhrabání napadaného listí a plsti.'), W('Na vertikutaci je ještě brzy - počkejte na duben, až bude půda trvale prohřátá nad 8-10 °C. Dřív by zásah trávníku spíš uškodil, než pomohl.')] },
      { i: 3, tasks: [D('Jarní vertikutace (2-3 mm) na prohřáté (nad 8-10 °C) a mírně suché půdě.'), D('Pravidelné sečení (začínáme vyšší výškou, cca 5 cm).')], fert: { key: 'K', variant: 'start', action: '1. dávka po oschnutí trávníku - start sezóny, posílení kořenů' } },
      { i: 4, tasks: [D('Sečení cca 1x týdně, hlavní růstová sezóna.'), D('Při sečení zarovnejte i okraje podél záhonů a chodníků (hranová seč) - rychlá věc, co zlepší vzhled víc než samotné sečení.')] },
      { i: 5, tasks: [D('V polovině sezóny nůž znovu naostřete - po pár měsících sečení už spíš trhá, než řeže.')], fert: { key: 'C', action: '2. dávka' } },
      { i: 7, tasks: [W('Intenzitu zatížení (sport, grilování) v tropických vedrech trochu omezte, trávník si v tu dobu hůř regeneruje.')] },
      { i: 8, tasks: [D('Podzimní vertikutace a přísev prořídlých míst.'), W('Aerifikace se u tohoto režimu doporučuje cca 1x za 2 roky - pokud letos (nebo loni) ještě nebyla, je teď dobrý čas.'), W('Zkontrolujte drn, jestli se dá lehce nadzvednout - znamení larev chroustů (ponrav) v kořenech. Pokud ano, řešte biologicky (hlístice) nebo chemickým přípravkem proti ponravám.')], fert: { key: 'N', action: '3. dávka - obnova po letním stresu' } },
      { i: 9, tasks: [], fert: { key: 'K', variant: 'end', action: '4. (poslední) dávka - zazimování, posílení odolnosti proti mrazu' } },
      { i: 10, tasks: [D('Poslední seč sezóny (podle počasí), úklid spadaného listí z trávníku.'), D('Nářadí a hadice vyklidit, aby nezmrzly.')] },
      { i: 11, tasks: [A('Zimní klid - trávník nezatěžovat, nenechávat na něm hromady listí ani sníh z lopaty.')] },
    ];
  }

  /** Harmonogram pro tier="low" (Nízkoúdržbový, 2 hnojení/rok: duben/září, N 8-10 g/m²/rok,
   * vertikutace jen 1x zjara, aerifikace se vynechává). Záměrně obsahuje jen pár řádků - to je
   * přesně smysl téhle úrovně. 2026-11-02: stejná oprava časování vertikutace jako u standard. */
  function scheduleLow() {
    return [
      { i: 2, tasks: [D('Jarní vyhrabání napadaného listí.'), W('Vertikutace (u tohoto režimu volitelná, stačí 1x ročně) počká na duben, až bude půda prohřátá nad 8-10 °C - dřív trávníku spíš uškodí.')] },
      { i: 3, tasks: [D('Volitelná jarní vertikutace (1x ročně stačí) na prohřáté a mírně suché půdě.'), D('Sečení cca 1x za 10-14 dní, na vyšší výšku (5-7 cm) - nenáročný režim.'), W('Pokud na to bude čas navíc, zarovnejte i okraje podél chodníků a záhonů (hranová seč) - u nízké údržby to není nutné, ale vzhled to zlepší nejvíc ze všeho.')], fert: { key: 'K', variant: 'start', action: 'Jediná jarní dávka - na celé jaro a léto to stačí' } },
      { i: 8, tasks: [D('Přísev prořídlých míst, pokud je potřeba.'), W('Zkontrolujte drn, jestli se dá lehce nadzvednout - znamení larev chroustů (ponrav) v kořenech. Pokud ano, řešte biologicky (hlístice) nebo chemickým přípravkem proti ponravám.')], fert: { key: 'K', variant: 'end', action: 'Podzimní (poslední) dávka - tím letos hnojení končí' } },
      { i: 10, tasks: [D('Poslední seč sezóny, úklid spadaného listí z trávníku.')] },
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
   * neposílají) - obecné poznámky navíc visí jako .notes a .fertTable jako tabulka hnojení PŘÍMO
   * NA TOM POLI (JS pole je objekt, tohle nerozbije žádné .map()/.length volání u starších
   * volajících). Každý task je teď {text,type} místo prostého řetězce - viz D()/W()/A() nahoře.
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
    var months = builder();

    // Výstup zůstává v přirozeném pořadí od ledna (m.i), jen LABEL měsíce se posune podle výšky -
    // takže "leden" v horách může nést úkoly, co v nížině platí už pro únor, ale řádek zůstává
    // na svém místě v kalendáři tak, jak ho zákazník čte shora dolů.
    var fertTable = [];
    var result = months.map(function (m) {
      var idx = shiftMonth(m.i, shift);
      var label = MONTHS[idx];
      var tasks = m.tasks.map(function (t) {
        // {{WATER}}/{{SLOPE}} jsou explicitní značky přímo u těch pár řádků harmonogramu, co o
        // zálivce/svahu mluví (stejná místa jako dřív, kdy se waterNote/slopeNote připojovaly
        // ručně ke stringu) - značka, ne regex nad textem, aby přesně sedělo i po přefrázování.
        var text = t.text.replace('{{WATER}}', waterNote).replace('{{SLOPE}}', slopeNote);
        return { text: text, type: t.type };
      });
      if (m.fert) {
        fertTable.push(fertTableRow(label, m.fert.action, m.fert.key, m.fert.variant, areaM2, soilMult));
      }
      return { key: idx, label: label, tasks: tasks };
    });
    // Tabulka hnojení se řadí chronologicky podle (případně nadmořskou výškou posunutého) měsíce -
    // ne podle pořadí dávky v kódu, aby odpovídala pořadí, v jakém zákazník kalendář čte.
    fertTable.sort(function (a, b) { return MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month); });

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
      notes.push('Jarní dávku jste letos už aplikovali - první dávku v tabulce hnojení níže letos vynechejte a pokračujte až další v pořadí.');
    } else if (lastFertilized === 'none') {
      notes.push('Letos jste ještě nehnojili - klidně začněte první dávkou z tabulky co nejdřív, i když aktuální měsíc úplně neodpovídá; jen pokud je už po polovině září, přeskočte rovnou na poslední podzimní (draslíkovou) dávku.');
    }
    result.notes = notes;
    // Sezónní obecné rady (viz SEASON_GENERAL výš) - stejná {{WATER}}/{{SLOPE}} substituce jako
    // u měsíčních úkolů, jen aplikovaná na tenhle samostatný, sezónou (ne měsícem) klíčovaný set.
    var seasonGeneralSrc = SEASON_GENERAL[tier] || {};
    var seasonGeneral = {};
    Object.keys(seasonGeneralSrc).forEach(function (seasonKey) {
      seasonGeneral[seasonKey] = seasonGeneralSrc[seasonKey].map(function (t) {
        return { text: t.text.replace('{{WATER}}', waterNote).replace('{{SLOPE}}', slopeNote), type: t.type };
      });
    });
    result.seasonGeneral = seasonGeneral;
    // Metadata pro hezčí výstupní dokument (hlavička se jménem plánu, přehledová lišta, tabulka
    // hnojení) - visí na vráceném poli stejným trikem jako .notes, aby se nerozbilo žádné starší
    // volání, co o nich neví.
    result.tier = tier;
    result.tierMeta = TIER_META[tier];
    result.areaM2 = areaM2;
    result.fertType = fertType;
    result.fertTable = fertTable;
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

  function fmtKg(kg) {
    if (kg == null) return '—';
    return String(kg).replace('.', ',') + ' kg';
  }

  var TASK_ICON = { do: '✅', warn: '⚠️', avoid: '⛔' };

  /** Barevně rozlišený seznam úkolů jednoho měsíce (viz CSS .mg-task-do/.mg-task-warn/.mg-task-avoid
   * v app.css) - zelená/oranžová/červená přesně podle Martinova zadání "prehledne barevne
   * rozlisene co je potreba udelat, na co si dat pozor a co zbytecne neuspechat". */
  function taskListHtml(tasks) {
    return '<ul class="mg-care-tasks">' + tasks.map(function (t) {
      var type = t.type === 'warn' || t.type === 'avoid' ? t.type : 'do';
      return '<li class="mg-task-' + type + '"><span class="mg-task-ic" aria-hidden="true">' + TASK_ICON[type] + '</span><span>' + htmlEscape(t.text) + '</span></li>';
    }).join('') + '</ul>';
  }

  /** Samostatná tabulka hnojení (Martin, 2026-11-02: "Plan hnojeni bude v tabulce jak jsem
   * posilal ja budou tam vsechny infotmace co jsem tam mel ja") - stejné sloupce jako kapitola 7
   * jeho vlastního podkladu (termín / úkon / hnojivo+NPK / dávka na m² / celkem na plochu), teď
   * oddělená od měsíčního kalendáře, ne zamotaná do textu odrážek. */
  function renderFertTable(fertTable, fertType) {
    if (!fertTable || !fertTable.length) return '';
    var rows = fertTable.map(function (r) {
      return '<tr><td><strong>' + htmlEscape(r.month) + '</strong></td><td>' + htmlEscape(r.action) + '</td>' +
        '<td>' + htmlEscape(r.name) + '<br><small>NPK ' + htmlEscape(r.npk) + '</small></td>' +
        '<td>' + r.doseG + ' g/m²</td>' +
        '<td>' + (r.totalKg != null ? fmtKg(r.totalKg) + ' na ' + r.areaM2 + ' m²' : '—') + '</td></tr>';
    }).join('');
    var typeNote = fertType && FERT_TYPE_NOTE[fertType] ? '<p class="mg-note">Preferovaný typ hnojiva: ' + htmlEscape(FERT_TYPE_NOTE[fertType]) + '.</p>' : '';
    return '<section class="mg-fert-table-wrap"><h4>📋 Plán hnojení</h4>' +
      '<table class="mg-fert-table"><thead><tr><th>Termín</th><th>Úkon</th><th>Hnojivo</th><th>Dávka na m²</th><th>Celkem</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      typeNote +
      '</section>';
  }

  /** Doplňkové odborné rady (2026-11-02, na přání Martina - "zapracuj je vsechny dulezite
   * informace a jeste jdi klidne vic do hloubky zakaznik si plati aby mel vsechny informace"):
   * obecné, na měsíci nezávislé know-how, co se nehodí do konkrétního řádku kalendáře, ale
   * zákazník, co si plán platí, by o tom měl vědět - test pH, karenční doba po hnojení/postřiku
   * pro děti a zvířata, a péče o zastíněné části trávníku pod stromy/keři. (Hranová seč, druhé
   * broušení nože, kontrola ponrav a další choroby přes léto jsou naopak sezónně svázané, proto
   * jsou rovnou v kalendáři u konkrétního měsíce, ne tady.) */
  function renderExpertTips() {
    var tips = [
      'Zlaté pravidlo sečení: nikdy nesečte víc než 1/3 výšky stébla najednou - víc trávník vážně stresuje, zpomaluje regeneraci a dělá ho náchylnějším na choroby a plevel. Když roste rychle (hlavní sezóna, po dešti), raději sekejte častěji místo toho, abyste jednou za čas sjeli dolů víc.',
      'Test pH půdy: udělejte ho jednou za 2-3 roky (levná souprava ze zahradnictví), nejlépe na podzim. Trávník má rád pH 5,5-7,0 - pod touhle hranicí přestává přijímat živiny i při pravidelném hnojení a šíří se mech. Vápnění ale dělejte VÝHRADNĚ podle naměřené hodnoty, nikdy preventivně "naslepo".',
      'Karenční doba po hnojení a postřiku: po minerálním hnojivu nechte děti a zvířata na trávník až po zaschnutí/zálivce (pár hodin). Po herbicidu proti plevelům počkejte s jejich přístupem alespoň 24-48 hodin, podle návodu na konkrétním přípravku.',
      'Stín pod stromy a keři: v zastíněných částech trávník roste pomaleji a je náchylnější na houby - dávky hnojiva tam snižte cca o třetinu, sekejte o 1 cm výš než na slunci a pokud je stín trvalý, zvažte při příštím přísevu směs s vyšším podílem kostřavy červené, která stín snáší líp než jílek.',
      'Střídání směru sečení: při každém dalším sečení měňte směr (nahoru-dolů, pak napříč nebo diagonálně) - pořád stejný směr tvoří kolejové stopy a trávník roste nakřivo.',
    ];
    return '<section class="mg-care-tips"><h4>📖 Další odborné rady</h4><ul>' + tips.map(function (t) { return '<li>' + htmlEscape(t) + '</li>'; }).join('') + '</ul></section>';
  }

  /** Výstupní "dokument", ne jen prostý seznam měsíců (Martin, 2026-11-01: "musi to byt nejaky
   * hezky vystupni formular ... tohle po mesici je neprehledne a neprofesionalni"): hlavička se
   * jménem plánu (pokud ho zákazník zadal - viz computeCarePlan .planName), přehledová lišta se
   * statistikami, samostatná tabulka hnojení (2026-11-02), kalendář seskupený podle 4 ročních
   * období (ne 12 řádků zvlášť) s barevně rozlišenými úkoly a tlačítko na tisk/uložení jako PDF.
   * Celý výstup je obalený v .mg-care-report, aby ho šlo cíleně vytisknout (viz @media print v
   * app.css) bez zbytku formuláře okolo.
   *
   * 2026-11-02, Martinovo zadání doslova: "Chdi kazdou vec zvlast Plan hnojeni bude v tabulce jak
   * jsem posilal ja budou tam vsechny infotmace co jsem tam mel ja. Pak budou sisytematicky
   * rozdeleny mesice do 4 rocnich obdobi. a vnich budou ty mesice a bude tam prehledne barevne
   * rozlisene co je potreba udelat na co si dat pozor a co zbytecne neuspechat." - odtud
   * renderFertTable() jako vlastní sekce PŘED kalendářem (hnojení zvlášť, ne zamotané do textu),
   * a taskListHtml() s barvami podle typu úkolu.
   */
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

    var fertTableHtml = renderFertTable(months && months.fertTable, months && months.fertType);

    // Legenda barev nad kalendářem - ať je hned jasné, co zelená/oranžová/červená odrážka znamená,
    // než zákazník narazí na první z nich.
    var legendHtml = '<div class="mg-care-legend"><span class="mg-task-do"><span class="mg-task-ic" aria-hidden="true">' + TASK_ICON.do + '</span>Udělat</span>' +
      '<span class="mg-task-warn"><span class="mg-task-ic" aria-hidden="true">' + TASK_ICON.warn + '</span>Dát si pozor</span>' +
      '<span class="mg-task-avoid"><span class="mg-task-ic" aria-hidden="true">' + TASK_ICON.avoid + '</span>Neuspěchat / nedělat teď</span></div>';

    // Seskupení měsíců (months[].key je 0=Leden..11=Prosinec) do 4 sezón, v pořadí Jaro->Zima -
    // přirozený čtenářský tok "co dělat teď na jaře, pak v létě, ..." i pro nízkoúdržbový tier,
    // kterému chybí celé měsíce (SEASONS sekce bez položek se prostě vynechá). Měsíce bez úkolů
    // (jen hnojení v tabulce výše) se taky vynechají, ať v kartě nezůstává prázdné místo.
    var byKey = {};
    (months || []).forEach(function (m) { byKey[m.key] = m; });
    var seasonGeneral = (months && months.seasonGeneral) || {};
    var seasonsHtml = SEASONS.map(function (season) {
      var items = season.months.map(function (k) { return byKey[k]; }).filter(function (m) { return m && m.tasks && m.tasks.length; });
      var generalTasks = seasonGeneral[season.key] || [];
      if (!items.length && !generalTasks.length) return '';
      // Sezónní rady (platí celé období, ne jeden měsíc - viz SEASON_GENERAL) se zobrazí jednou
      // hned pod nadpisem sezóny, PŘED jednotlivými měsíci, aby je zákazník nemohl minout jen
      // proto, že si přečetl jiný letní měsíc než ten, kde dřív náhodou visely.
      var generalHtml = generalTasks.length
        ? '<div class="mg-care-season-general"><p class="mg-care-season-general-label">Platí pro celé období:</p>' + taskListHtml(generalTasks) + '</div>'
        : '';
      var monthsHtml = items.map(function (m) {
        return '<div class="mg-care-month"><strong>' + htmlEscape(m.label) + '</strong>' + taskListHtml(m.tasks) + '</div>';
      }).join('');
      var monthsWrapHtml = items.length ? '<div class="mg-care-season-months">' + monthsHtml + '</div>' : '';
      return '<section class="mg-care-season"><h4><span class="mg-care-season-icon" aria-hidden="true">' + season.icon + '</span>' + season.label + '</h4>' + generalHtml + monthsWrapHtml + '</section>';
    }).join('');

    return '<div class="mg-care-report">'
      + '<header class="mg-care-report-head"><span class="mg-care-report-eyebrow">🌿 MVGreen · Roční plán péče</span><h3>' + htmlEscape(title) + '</h3><small>Vytvořeno ' + fmtToday() + '</small>'
      + '<button type="button" class="mg-care-print" onclick="window.print()">🖨️ Vytisknout / uložit jako PDF</button></header>'
      + statHtml
      + noteRows
      + fertTableHtml
      + '<h4 class="mg-care-cal-title">📅 Kalendář péče podle ročních období</h4>'
      + legendHtml
      + '<div class="mg-care-plan">' + seasonsHtml + '</div>'
      + renderExpertTips()
      + '<p class="mg-note">Program vychází z profesionálního hnojení (NPK poměry a dávky orientačně 20-30 g/m²), upraveného podle zvolené úrovně péče, typu půdy a nadmořské výšky. Konkrétní obchodní značku hnojiva si vyberte podle uvedeného NPK poměru - kterýkoliv odpovídající produkt funguje stejně.</p>'
      + '<p class="mg-note">⚠️ Minerální hnojivo aplikujte na suchý trávník, nejlépe před deštěm, a pokud neprší, do pár hodin ho zalijte - jinak hrozí spálení trávníku. Nikdy nehnojte mokrý trávník.</p>'
      + '<p class="mg-note">⚠️ Hnojivo vždy rozmetejte ručním elektrickým rozmetadlem nebo tažným rozmetacím vozíkem - nikdy ne z ruky (nerovnoměrné rozprostření a riziko spálení v místech, kam se dostane víc granulí). Secí vozík na výsev trávy není na hnojivo určený a nepoužívejte ho k němu.</p>'
      + renderUpsell()
      + '</div>';
  }

  /** Nabídka "nechte to na nás" pod hotovým plánem (2026-11-02, na přání Martina): zákazník má
   * i po koupi plánu pořád možnost nechat samotné provedení (sekání, hnojení) na MV GREEN místo
   * aby si ho dělal sám podle plánu. Schovává se při tisku/PDF (viz @media print v app.css) -
   * do vytištěného/uloženého dokumentu nepatří, je to jen nabídka na obrazovce. */
  function renderUpsell() {
    return '<div class="mg-care-upsell">'
      + '<div class="mg-care-upsell-ic" aria-hidden="true">🌱</div>'
      + '<div class="mg-care-upsell-txt"><strong>Nechcete to řešit sami?</strong>'
      + '<p>Tenhle plán vám klidně i rovnou splníme - přijedeme, pohnojíme a posekáme přesně podle něj, vy se nemusíte starat o nic. Péče o zeleň je přesně to, co MV GREEN dělá.</p></div>'
      + '<div class="mg-care-upsell-btns">'
      + '<a class="mg-care-upsell-btn mg-care-upsell-btn--primary" href="tel:+420723339650">Zavolat 723 339 650</a>'
      + '<a class="mg-care-upsell-btn" href="/kontakty/">Nezávazná poptávka</a>'
      + '</div></div>';
  }

  // FERT_TYPE_NOTE se exportuje i samo o sobě (ne jen zabalené v textu poznámky u dávky), aby ho
  // mohl app.js 2026-11-02 znovu použít jako popisky "ⓘ" u vlastního výběru typu hnojiva (#mg-care2-ferttype)
  // - stejný text na dvou místech, ale psaný jen jednou, ať se časem nerozjedou.
  var api = { computeCarePlan: computeCarePlan, renderCarePlanHTML: renderCarePlanHTML, FERT_TYPE_NOTE: FERT_TYPE_NOTE };
  if (typeof window !== 'undefined') window.MVGreenCarePlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
