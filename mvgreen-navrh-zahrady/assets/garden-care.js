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
    // freq/nRange se v computeCarePlan přepíšou skutečným počtem dávek a dusíkem z tabulky hnojení
    // (2026-11-16: dřív tu stálo "8× bez srpna" a "20-30 g N", což neodpovídalo Martinovu plánu: 9 dávek, ≈35 g N).
    representative: { label: 'Anglický trávník', freq: '9× ročně (III-XI)', nRange: '≈ 35 g N/m²/rok' },
    sportovni: { label: 'Sportovní trávník', freq: '9× ročně', nRange: '≈ 35 g N/m²/rok' },
    // "high" zůstává jako starší alias pro reprezentativní (zpětná kompatibilita se staršími voláními,
    // co ho posílaly jako jednu kolonku "Reprezentativní / sportovní" - viz 2026-11-02 oprava níže).
    high: { label: 'Reprezentativní / sportovní', freq: '9× ročně', nRange: '≈ 35 g N/m²/rok' },
  };

  /** Poznámka navíc podle TYPU zátěže u nejvyšší úrovně péče - Martin upozornil (2026-11-02), že
   * "reprezentativní" (vzhled, nízké opotřebení) a "sportovní" (pravidelná zátěž, časté opotřebení)
   * jsou odlišné potřeby, i když hnojivový harmonogram (schedule High) je pro obě stejný. */
  var USE_NOTES = {
    sportovni: 'Sportovní zátěž trávník mechanicky opotřebovává – po náročnějším víkendu nebo zápase poškozená místa co nejdřív dosejte (15-25 g osiva/m²) a aerifikaci dutými hroty plánujte podle zhutnění – univerzity radí 1× ročně, při velké zátěži a těžké půdě dvakrát (podzim, jaro).',
    representative: 'Anglický trávník se hnojí pravidelně cca každé 4 týdny po celou hlavní sezónu (březen až listopad, 9 dávek v tabulce níže, i v srpnu; hnojíte vždy, až přestane mrznout a tráva oschne, nikdy na mokrou trávu ani do sněhu). Je to intenzivní režim (více než 30 g dusíku na m² za rok, víc než běžná univerzitní doporučení pro domácí trávník 10–17 g; blíží se golfovým plochám) a vyžaduje závlahu – sekejte často (v sezóně zhruba co 3–4 dny) na vámi zvolenou výšku, nikdy víc než třetinu stébla najednou, okraje pravidelně zarovnávejte a čerstvě posečenou plochu zbytečně nezatěžujte.',
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
        W('V horkých dnech sekejte o 1–2 cm výš než obvykle ({{MOWHOT}}), aby trávník lépe snášel sucho.{{WATER}}'),
        W('Zálivka podle potřeby, raději zřídka a vydatně než často a málo.{{WATER}}{{SLOPE}}'),
        A('Nesekat nakrátko v suchu a horku.{{WATER}}'),
        W('Ve vlhku a horku hlídejte rez (žluté až oranžové skvrny, oranžový prášek na botách) a listové skvrnitosti – pomáhá vyvážená výživa, zálivka jen ráno a nesekat nakrátko.'),
      ],
    },
    standard: {
      summer: [
        W('V horkých dnech sekejte o 1–2 cm výš než obvykle ({{MOWHOT}}), aby trávník lépe snášel sucho.{{WATER}}{{SLOPE}}'),
        A('Nesekat nakrátko v suchu a horku.{{WATER}}'),
        W('Ve vlhku a horku hlídejte rez (žluté až oranžové skvrny, oranžový prášek na botách) a listové skvrnitosti – pomáhá vyvážená výživa, zálivka jen ráno a nesekat nakrátko.'),
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
    // 2026-11-16 (Martin): plán NEZNÁ značky ani obchody ("zadnou spolupraci nemame, nemusime preferovat zadnou znacku") -
    // říká jen "použijte hnojivo s tímto složením"; zákazník koupí kdekoliv cokoliv, co složení splňuje.
    // drive = živina, podle které se dávka přepočítá, když zákazník zadá složení svého hnojiva (refPct = její % u referenčního složení).
    // Rozsahy v `look` jsou orientační okolí referenčního složení z Martinova plánu (ne předpis výrobce).
    K: { hasP: false, hasK: true, name: 'Zátěžové hnojivo s vysokým draslíkem', npk: '12-0-42 +2MgO', nPct: 12, drive: 'draslík (K₂O)', refPct: 42, doseGPerM2: { start: 20, end: 30 },
      look: 'Na obalu hledejte: draslík (K₂O) kolem 40 % (35–45), dusík kolem 12 % (do 15), fosfor žádný nebo minimální, hořčík (MgO) alespoň 2 %. Bývá označeno jako zátěžové, podzimní nebo draslíkové trávníkové hnojivo.' },
    N: { hasP: true, hasK: true, name: 'Rychlé hnojivo s dusíkem a sírou', npk: '27-6-6 +2S', nPct: 27, drive: 'dusík (N)', refPct: 27, doseGPerM2: 18, // 2026-11-20: 20 g = 5,4 g N bylo nad hranicí 4,9 g N na aplikaci, kterou uvádí většina univerzit
     
      look: 'Na obalu hledejte: dusík (N) 26–28 %, fosfor (P₂O₅) kolem 6 %, draslík (K₂O) kolem 6 %, síra (S) kolem 2 %. Bývá označeno jako jarní, startovací nebo rychlé dusíkaté trávníkové hnojivo. Je rychlé – aplikujte jen na suchou trávu a po aplikaci zalijte.' },
    // D = náhrada, když rozbor půdy ukáže vysoký/nadlimitní fosfor nebo draslík (živiny se v půdě hromadí a blokují příjem dalších) - dusík bez P a K,
    // dávka se dopočítá tak, aby dodala STEJNÉ množství dusíku jako nahrazená dávka. Referenční složení je orientační (Martin 2026-11-16: bez značek).
    D: { hasP: false, hasK: false, name: 'Dusíkaté hnojivo bez fosforu a draslíku', npk: '30-0-0 (+S)', nPct: 30, drive: 'dusík (N)', refPct: 30, doseGPerM2: 12,
      look: 'Na obalu hledejte: dusík (N) kolem 30 % (28–32), fosfor (P₂O₅) 0 %, draslík (K₂O) 0 %; bývá označeno jako čisté dusíkaté nebo trávníkové dusíkaté hnojivo, ideálně se sírou (S). Hořčík a železo si případně doplňte zvlášť, podle rozboru. Čistá močovina (46 % N) je silnější: dávku z tabulky pak snižte zhruba na dvě třetiny. Aplikujte na suchou trávu a zalijte.' },
    C: { hasP: true, hasK: true, name: 'Vyvážené hnojivo s hořčíkem a železem', npk: '12-4-9 +2MgO +1Fe', nPct: 12, drive: 'dusík (N)', refPct: 12, doseGPerM2: 30,
      look: 'Na obalu hledejte: dusík (N) 10–14 %, fosfor (P₂O₅) 3–6 %, draslík (K₂O) 7–11 %, hořčík (MgO) alespoň 2 %, železo (Fe) kolem 1 %. Bývá označeno jako celoroční, vyvážené nebo „All Season“ trávníkové hnojivo.' },
  };

  /** Jen informační dovětek k dávce podle preferovaného TYPU hnojiva - NPK poměr a gramáž níže
   * zůstávají stejné orientační číslo, ať zákazník sáhne po jakékoliv značce/formě se stejným
   * přibližným složením; tohle mu jen řekne, na co se dívat v obchodě. */
  var FERT_TYPE_NOTE = {
    fast: 'rychlorozpustné minerální (působí 1-3 týdny, nejlevnější, ale po aplikaci je potřeba brzy zalít, jinak hrozí spálení)',
    crf: 's pomalým uvolňováním – CRF (štítek uvádí 2–3 měsíce, ale v teple se dusík uvolňuje rychleji a trávník ho většinu spotřebuje do několika týdnů; dražší, nižší riziko spálení než u rychlých hnojiv)',
    organic: 'organické/organominerální (působí 1-3 měsíce, nižší riziko spálení – organominerální hnojiva ale obsahují i minerální složku, takže přesto dodržte dávku a zalijte; účinek je pomalejší)',
  };

  /** Druh/směs trávníku (2026-11-02, Martinovo zadání: "potrebujeme jeste zjistit jakej druh
   * travniku maji nebo chteji jilky nebo kostravy ... nemame vubec informace na kolik se jaky
   * travnik seka jaky jsou jeho minimalni a maximalni dylky") - dřív se výška sečení řešila jen
   * podle úrovně péče (tier), bez ohledu na to, jaká tráva v trávníku vůbec roste. mowMin/mowMax
   * jsou REÁLNÁ doporučená rozmezí pro běžně udržovaný rodinný trávník (ne extrémy jako golfové
   * jamkoviště), ověřená proti agronomickým zdrojům (SZÚZ "Zakládání trávníků a péče o trávníky",
   * poster_9 Mendelovy univerzity - viz commit message). Prázdný klíč '' = "nevím/poraďte", beze
   * změny chování (stejná čísla jako dřív, podle tier). */
  var GRASS_SPECIES = {
    rye: {
      label: 'Jílek vytrvalý',
      mowMin: 3,
      mowMax: 5,
      note: 'Jílek vytrvalý je rychlý a houževnatý – vzchází za 7–10 dní a po zátěži či sešlapu se dobře sám zahojí, proto je základem většiny sportovních a často používaných trávníků. Snese časté nízké sečení, ale potřebuje víc vody a živin než kostřava; počítejte s pravidelným dosevem.',
    },
    fescue: {
      label: 'Kostřava (červená / rákosovitá)',
      mowMin: 4,
      mowMax: 6,
      note: 'Kostřavy snášejí polostín, sucho i méně živin lépe než jílek, proto jsou v okrasných, stínových a suchovzdorných směsích. Rostou pomaleji (vzcházejí za 2–3 týdny) a po poškození se pomaleji zahojí. Jemné kostřavy se dají sekat velmi nízko vřetenovou sekačkou; rotační sekačkou je držte výš.',
    },
    mix: {
      label: 'Smíšený trávník (neznám přesný poměr)',
      mowMin: 4,
      mowMax: 5,
      note: 'Většina travních směsí v obchodech kombinuje jílek vytrvalý (rychlost, odolnost) s kostřavami a lipnicí (hustota, nenáročnost) – přesný poměr najdete na obalu od osiva; bez něj doporučujeme střední výšku sečení a sledovat, jak trávník na péči reaguje.',
    },
  };

  /** Výchozí rozmezí výšky sečení PODLE ÚROVNĚ PÉČE, použité, dokud zákazník nevyplní (nebo neví)
   * druh trávníku - stejná čísla, co už dřív plán fakticky používal v textu jednotlivých úkolů
   * (viz scheduleLow/scheduleStandard/scheduleHigh), teď jen i jako samostatné dostupné číslo. */
  var TIER_MOW_FALLBACK = {
    low: { mowMin: 5, mowMax: 7 },
    standard: { mowMin: 4, mowMax: 5 },
    high: { mowMin: 3, mowMax: 4 },
  };
  function tierMowFallback(tier) {
    return TIER_MOW_FALLBACK[tier === 'representative' || tier === 'sportovni' ? 'high' : tier] || TIER_MOW_FALLBACK.standard;
  }

  var PROBLEM_NOTES = {
    moss: 'Mech bývá příznak stínu, utužené nebo podmáčené půdy, slabé výživy nebo kyselé půdy – nechte si udělat rozbor půdy a řešte příčinu. Železo mech jen hubí a trávu zazelení, návratu mechu ale nezabrání (Clemson); stopové železo v běžném hnojivu na mech nestačí.',
    weeds: 'Dvouděložné plevele (jetel, pampeliška apod.) jde ručně vytrhávat, nebo použít herbicid registrovaný v ČR pro neprofesionální uživatele (ověřte na etiketě) – ideálně v květnu/červnu; odstup od hnojení a sečení řiďte etiketou přípravku.',
    bare: 'Na holá a řídká místa počítejte s přísevem při podzimní regeneraci – cca 15-25 g osiva/m², zapravit hráběmi max. 0,5 cm hluboko a první 2 týdny udržovat povrch trvale vlhký.',
    snowmold: 'Loni jste měli plíseň sněžnou – po polovině září proto nepoužívejte silné rychlé dusíkaté hnojivo (pozdní vysoký dusík plíseň zhoršuje), dávky snižte a dejte přednost pomalu působícímu hnojivu, pravidelně hrabejte spadané listí a strniště před zimou nenechávejte vyšší než 5 cm.',
    compaction: 'Utužená půda nebo voda, která se drží na povrchu: letos doporučujeme aerifikaci dutými hroty, i kdyby ji zvolená úroveň péče jinak nevyžadovala – jinak kořeny nemají dost vzduchu a trávník se nezlepší.',
  };

  /**
   * Nadmořská výška posouvá start/konec sezóny - výš je chladněji, sezóna začíná později a
   * končí dřív. Posun v měsících, zaokrouhlený na celé měsíce (0 = nížina do 350 m).
   */
  // Posun v POLOVINÁCH měsíce (2026-11-14 oprava): dřív se celý rok posunul o celé měsíce později,
  // včetně podzimu – v Domažlicích (430 m) pak plán radil hnojit dusíkem v listopadu a draslíkem
  // v prosinci. Ve vyšší poloze ale jaro začíná POZDĚJI a podzim končí DŘÍV. Proto:
  // jaro (únor–květen) +posun, léto beze změny, podzim (září–listopad) −posun.
  function altitudeShift(altitude) {
    var a = Number(altitude) || 0;
    if (a >= 700) return 3;   // ~6 týdnů
    if (a >= 500) return 2;   // ~1 měsíc
    if (a >= 350) return 1;   // ~2 týdny
    return 0;
  }
  // Základ harmonogramu = nížina (do 350 m), termín „1. polovina měsíce i“ = půlměsíc 2*i.
  function shiftHalf(baseMonthIndex, shift) {
    var h = baseMonthIndex * 2;
    if (baseMonthIndex >= 1 && baseMonthIndex <= 4) h += shift;          // jaro později
    else if (baseMonthIndex >= 8 && baseMonthIndex <= 10) h -= [0, 1, 1, 2][shift] || 0;   // podzim dřív, ale méně než jaro (konec sezóny se ve výšce zkracuje méně)
    return Math.max(0, Math.min(23, h));
  }
  function halfLabel(h) { return (h % 2 ? 'konec ' : 'začátek ') + MONTHS_GEN[Math.floor(h / 2)]; }
  var MONTHS_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

  /** Jílovitá půda váže živiny déle (nižší dávka), písčitá je rychle vyplavuje (vyšší dávka). */
  function soilMultiplier(soil) {
    if (soil === 'sand') return 1.15;
    if (soil === 'clay') return 0.85;
    return 1;
  }

  /** Syrová čísla dávky (g/m² a kg na zadanou plochu) - společný základ pro tabulku hnojení
   * (fertTableRow) i pro případný textový popis. */
  function doseData(fertKey, areaM2, soilMult, variant, customPct, forceDose) {
    var base = FERT[fertKey].doseGPerM2;
    var refDose = forceDose > 0 ? forceDose : (typeof base === 'object' ? base[variant || 'start'] : base) * soilMult;
    // Zákazník zadal skutečné složení svého hnojiva (% hlavní živiny) -> stejné množství živiny, jiné množství produktu.
    var pct = Number(customPct);
    var gPerM2 = Math.round(pct > 0 && pct <= 100 ? refDose * FERT[fertKey].refPct / pct : refDose);
    var kg = areaM2 > 0 ? Math.max(0.1, Math.round(areaM2 * gPerM2) / 1000) : null;
    return { gPerM2: gPerM2, kg: kg };
  }

  /** Jeden řádek tabulky hnojení (viz computeCarePlan -> .fertTable a renderem renderFertTable). */
  function fertTableRow(monthLabel, action, fertKey, variant, areaM2, soilMult, customPct, forceDose) {
    var d = doseData(fertKey, areaM2, soilMult, variant, customPct, forceDose);
    var custom = Number(customPct) > 0 && Number(customPct) <= 100;
    return {
      month: monthLabel,
      action: action,
      name: FERT[fertKey].name,
      npk: FERT[fertKey].npk,
      look: FERT[fertKey].look,
      drive: FERT[fertKey].drive,
      customPct: custom ? Number(customPct) : null,
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
      { i: 0, tasks: [A('Zimní klid – trávník nesekat, nehnojit, nevstupovat na zmrzlý nebo podmáčený povrch.')] },
      { i: 1, tasks: [D('Zimní klid, příprava na sezónu – naostřit nůž sekačky, zkontrolovat techniku a rozmetadlo hnojiva.')] },
      { i: 2, tasks: [D('Jarní vyhrabání napadaného listí a plsti.')], fert: { key: 'K', variant: 'start', action: 'po oschnutí trávníku – zahájení sezóny, posílení kořenů' } },
      { i: 3, tasks: [D('Pravidelné sečení – první seče o něco výš než obvykle, pak postupně na vaši výšku.')], fert: { key: 'N', action: '2. dávka – rychlé nastartování růstu a obarvení po zimě' } },
      { i: 4, tasks: [D('V hlavní růstové sezóně sekejte co 3-4 dny (u anglického trávníku je častější sečení žádoucí a dělá hustotu i jemnost trávníku) – nikdy ale neseřezávejte najednou víc než 1/3 výšky stébla, jinak trávník zbytečně stresujete.'), D('Při sečení rovnou zarovnejte i okraje trávníku podél záhonů a chodníků (hranová seč) – udrží to ostrou, upravenou hranici, ne jen posekanou plochu.')], fert: { key: 'C', action: '3. dávka – hlavní růstová sezóna začíná' } },
      { i: 5, tasks: [], fert: { key: 'C', action: '4. dávka' } },
      { i: 6, tasks: [D('V polovině sezóny nůž znovu naostřete – po pár měsících sečení už spíš trhá, než řeže, a natržená stébla snáz napadají houbové choroby.')], fert: { key: 'C', action: '5. dávka' } },
      // Srpen: Martin 2026-11-16 "v srpnu se hnojí" (jeho plán má v srpnu Match Golf 30 g/m²); dřív tu dávka chyběla.
      { i: 7, tasks: [W('Hnojivo aplikujte jen na suchou trávu (nikdy na mokrou – granule se přilepí na stébla a spálí je).')], fert: { key: 'C', action: '6. dávka' } },
      { i: 8, tasks: [D('Vertikutace (prořezání plsti) a aerace trávníku.'), D('Podzimní přísev prořídlých míst – před výsevem použijte startovací hnojivo s vysokým fosforem pro rychlé zakořenění semen, ne běžné sezónní hnojivo.'), W('Zkontrolujte, jestli se trávník nedá lehce nadzvednout nebo odchlípnout jako koberec – znamení larev chroustů (ponrav) v kořenech. Pokud ano, řešte buď biologicky (hlístice do zalévané půdy) nebo přípravkem proti ponravám registrovaným v ČR pro domácí použití (ověřte na etiketě).')], fert: { key: 'N', action: '6. dávka – obnova po letním stresu' } },
      { i: 9, tasks: [D('Snižujeme frekvenci sečení.')], fert: { key: 'C', action: '7. dávka' } },
      { i: 10, tasks: [D('Poslední seč sezóny (podle počasí), úklid spadaného listí z trávníku.'), D('Nářadí a hadice vyklidit, aby nezmrzly.')], fert: { key: 'K', variant: 'end', action: '8. (poslední) dávka – podzimní doplnění draslíku před zimou' } },
      { i: 11, tasks: [A('Zimní klid – trávník nezatěžovat, nenechávat na něm hromady listí ani sníh z lopaty.')] },
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
      { i: 0, tasks: [A('Zimní klid – trávník nesekat, nehnojit, nevstupovat na zmrzlý nebo podmáčený povrch.')] },
      { i: 1, tasks: [D('Zimní klid, příprava na sezónu – naostřit nůž sekačky, zkontrolovat techniku.')] },
      { i: 2, tasks: [D('Jarní vyhrabání napadaného listí a plsti.'), W('Na vertikutaci je ještě brzy – počkejte na duben, až bude půda trvale prohřátá nad 8-10 °C. Dřív by zásah trávníku spíš uškodil, než pomohl.')] },
      { i: 3, tasks: [D('Jarní vertikutace (2-3 mm) na prohřáté (nad 8-10 °C) a mírně suché půdě.'), D('Pravidelné sečení – první seče o něco výš než obvykle, pak postupně na vaši výšku.')], fert: { key: 'K', variant: 'start', action: '1. dávka po oschnutí trávníku – start sezóny, posílení kořenů' } },
      { i: 4, tasks: [D('Sečení cca 1x týdně, hlavní růstová sezóna.'), D('Při sečení zarovnejte i okraje podél záhonů a chodníků (hranová seč) – rychlá věc, co zlepší vzhled víc než samotné sečení.')] },
      { i: 5, tasks: [D('V polovině sezóny nůž znovu naostřete – po pár měsících sečení už spíš trhá, než řeže.')], fert: { key: 'C', action: '2. dávka' } },
      { i: 7, tasks: [W('Intenzitu zatížení (sport, grilování) v tropických vedrech trochu omezte, trávník si v tu dobu hůř regeneruje.')] },
      { i: 8, tasks: [D('Podzimní vertikutace a přísev prořídlých míst.'), W('Aerifikace se u tohoto režimu doporučuje cca 1x za 2 roky – pokud letos (nebo loni) ještě nebyla, je teď dobrý čas.'), W('Zkontrolujte, jestli se trávník nedá lehce nadzvednout – znamení larev chroustů (ponrav) v kořenech. Pokud ano, řešte biologicky (hlístice) nebo přípravkem proti ponravám registrovaným v ČR pro domácí použití (ověřte na etiketě).')], fert: { key: 'N', action: '3. dávka – obnova po letním stresu' } },
      { i: 9, tasks: [], fert: { key: 'K', variant: 'end', action: '4. (poslední) dávka – podzimní doplnění draslíku před zimou' } },
      { i: 10, tasks: [D('Poslední seč sezóny (podle počasí), úklid spadaného listí z trávníku.'), D('Nářadí a hadice vyklidit, aby nezmrzly.')] },
      { i: 11, tasks: [A('Zimní klid – trávník nezatěžovat, nenechávat na něm hromady listí ani sníh z lopaty.')] },
    ];
  }

  /** Harmonogram pro tier="low" (Nízkoúdržbový, 2 hnojení/rok: duben/září, N 8-10 g/m²/rok,
   * vertikutace jen 1x zjara, aerifikace se vynechává). Záměrně obsahuje jen pár řádků - to je
   * přesně smysl téhle úrovně. 2026-11-02: stejná oprava časování vertikutace jako u standard. */
  function scheduleLow() {
    return [
      { i: 2, tasks: [D('Jarní vyhrabání napadaného listí.'), W('Vertikutace (u tohoto režimu volitelná, stačí 1x ročně) počká na duben, až bude půda prohřátá nad 8-10 °C – dřív trávníku spíš uškodí.')] },
      { i: 3, tasks: [D('Volitelná jarní vertikutace (1x ročně stačí) na prohřáté a mírně suché půdě.'), D('Sečení cca 1x za 10-14 dní, na vyšší výšku (5-7 cm) – nenáročný režim.'), W('Pokud na to bude čas navíc, zarovnejte i okraje podél chodníků a záhonů (hranová seč) – u nízké údržby to není nutné, ale vzhled to zlepší nejvíc ze všeho.')], fert: { key: 'K', variant: 'start', action: 'Jediná jarní dávka – na celé jaro a léto to stačí' } },
      { i: 8, tasks: [D('Přísev prořídlých míst, pokud je potřeba.'), W('Zkontrolujte, jestli se trávník nedá lehce nadzvednout – znamení larev chroustů (ponrav) v kořenech. Pokud ano, řešte biologicky (hlístice) nebo přípravkem proti ponravám registrovaným v ČR pro domácí použití (ověřte na etiketě).')], fert: { key: 'K', variant: 'end', action: 'tím letos hnojení končí' } },
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
    var grassType = input.grassType && GRASS_SPECIES[input.grassType] ? input.grassType : '';
    // 2026-11-16 (Martin, schvalovací stránka z 14. 11.): nízká a běžná úroveň MÁ výškový posun schválený (✅ ve všech
    // 3 výškách). Anglický trávník ale ne: "hnojí se každý měsíc, pokud to podmínky dovolí" – a v Domažlicích (434 m) posun
    // vyhazoval 2 dávky z 9. Proto u nejvyšší úrovně žádný posun ani vyřazování dávek; ve vyšší poloze se jen první
    // dávka nechává až na dobu, kdy přestane mrznout a tráva oschne (viz poznámka níže).
    var isHighTier = tier === 'high' || tier === 'representative' || tier === 'sportovni';
    var shift = isHighTier ? 0 : altitudeShift(altitude);
    // Volitelné: zákazník zadá % hlavní živiny svého hnojiva { K: % K2O, N: % N, C: % N } (viz FERT.drive) - plán přepočítá g/m².
    var productPct = (input.productPct && typeof input.productPct === 'object') ? input.productPct : {};
    // doseScale: násobek dávek (např. 0.5 ve stínu - brain.js); avoid: {P:true,K:true} = rozbor půdy ukázal vysoký/nadlimitní P/K -> profil D (bez P a K)
    var soilMult = soilMultiplier(soil) * (Number(input.doseScale) > 0 ? Number(input.doseScale) : 1);
    var avoid = (input.avoid && typeof input.avoid === 'object') ? input.avoid : {};

    var waterNote = water === 'dry'
      ? ' Půda je u vás spíš suchá, v horkých týdnech zalévejte o trochu častěji.'
      : water === 'wet'
        ? ' Půda je u vás spíš vlhká – hlídejte hlavně provzdušnění, aby trávník nezahníval.'
        : '';
    var slopeNote = slope === 'steep' ? ' Na svahu zalévejte pomalu a po menších dávkách, aby voda nestékala bez užitku.' : '';

    var builder = (tier === 'high' || tier === 'representative' || tier === 'sportovni') ? scheduleHigh : tier === 'low' ? scheduleLow : scheduleStandard;
    var months = builder();

    // Výstup zůstává v přirozeném pořadí od ledna (m.i), jen LABEL měsíce se posune podle výšky -
    // takže "leden" v horách může nést úkoly, co v nížině platí už pro únor, ale řádek zůstává
    // na svém místě v kalendáři tak, jak ho zákazník čte shora dolů.
    var fertTable = [], fertCand = [];
    var result = months.map(function (m) {
      var half = shiftHalf(m.i, shift), idx = Math.floor(half / 2);
      var label = MONTHS[idx], when = halfLabel(half);
      // skipMech (brain.js, 2026-11-16): vertikutaci, aerifikaci, přísev a pískování plánuje mozek v „Péči o drn“ podrobně – tady by se opakovaly/rozcházely
      var tasks = m.tasks.filter(function (t) { return !(input.skipMech && /vertikut|aera|aerifik|přísev|písk/i.test(t.text)); }).map(function (t) {
        // {{WATER}}/{{SLOPE}} jsou explicitní značky přímo u těch pár řádků harmonogramu, co o
        // zálivce/svahu mluví (stejná místa jako dřív, kdy se waterNote/slopeNote připojovaly
        // ručně ke stringu) - značka, ne regex nad textem, aby přesně sedělo i po přefrázování.
        var text = t.text.replace('{{WATER}}', waterNote).replace('{{SLOPE}}', slopeNote);
        return { text: text, type: t.type };
      });
      if (m.fert) fertCand.push({ half: half, label: label, when: when, fert: m.fert });
      return { key: idx, label: label, when: when, tasks: tasks };
    });
    // Tabulka hnojení se řadí chronologicky podle (případně nadmořskou výškou posunutého) měsíce -
    // ne podle pořadí dávky v kódu, aby odpovídala pořadí, v jakém zákazník kalendář čte.
    // Mezi dávkami aspoň 4 týdny (2 půlměsíce). Ve vyšší poloze je sezóna kratší a posunuté jaro by
    // jinak dávky namačkalo (750 m: 5 dávek za 2 měsíce) – vypadne vyrovnávací dávka (C), nikdy startovní,
    // dusíková ani zazimovací. Pak se dávky přečíslují.
    var prio = function (c) { return c.fert.key === 'C' ? 2 : 1; }, kept = [];
    fertCand.slice().sort(function (a, b) { return prio(a) - prio(b) || a.half - b.half; }).forEach(function (c) {
      if (kept.every(function (k) { return Math.abs(k.half - c.half) >= 2; })) kept.push(c);
    });
    kept.sort(function (a, b) { return a.half - b.half; });
    kept.forEach(function (c, i) {
      var desc = String(c.fert.action).replace(/^\d+\.\s*(\(poslední\)\s*)?dávka\s*([-–]\s*)?/i, '').replace(/^Jediná jarní dávka\s*[-–]\s*/i, '');
      var last = i === kept.length - 1, num = (i + 1) + '. ' + (last ? '(poslední) ' : '') + 'dávka';
      var origKey = c.fert.key, useKey = origKey, forceDose = 0, replacedBy = '';
      var origN = doseData(origKey, 0, soilMult, c.fert.variant).gPerM2 * FERT[origKey].nPct / 100; // dusík z referenční dávky (stejné množství živiny bez ohledu na značku)
      if ((avoid.P && FERT[origKey].hasP) || (avoid.K && FERT[origKey].hasK)) {
        // rozbor půdy: nehromadit P/K -> dusíkaté bez P a K se stejným množstvím dusíku
        useKey = 'D'; forceDose = Math.max(1, Math.round(origN / (FERT.D.nPct / 100)));
        replacedBy = avoid.P && avoid.K ? 'fosfor a draslík' : avoid.P ? 'fosfor' : 'draslík';
      }
      var row = fertTableRow(c.label, desc ? num + ' – ' + desc : num, useKey, c.fert.variant, areaM2, soilMult, productPct[useKey], forceDose);
      row.when = c.when.charAt(0).toUpperCase() + c.when.slice(1); row.half = c.half;
      row.nGPerM2 = origN;
      row.key = useKey; row.origKey = origKey;
      if (replacedBy) row.note = 'Podle rozboru půdy je u vás ' + replacedBy + ' vysoký – proto hnojivo bez ' + (avoid.P && avoid.K ? 'P a K' : avoid.P ? 'fosforu' : 'draslíku') + ' (stejné množství dusíku).';
      fertTable.push(row);
    });
    // Počet dávek a dusík do hlavičky plánu = skutečně z tabulky (2026-11-16), ne ručně psané číslo.
    var nTotal = fertTable.reduce(function (s, r) { return s + r.nGPerM2; }, 0);
    var tierMetaOut = Object.assign({}, TIER_META[tier], { freq: fertTable.length + '× ročně', nRange: '≈ ' + Math.round(nTotal) + ' g N/m²/rok' });
    // dva úkoly ve stejném měsíci (jaro posunuté, podzim předsunutý) se sloučí do jedné karty měsíce
    var byIdx = {};
    result = result.filter(function (m) { if (byIdx[m.key]) { byIdx[m.key].tasks = byIdx[m.key].tasks.concat(m.tasks); return false; } byIdx[m.key] = m; return true; });

    // Obecné poznámky navíc (zavlažování, problémy, poslední hnojení) - nejsou vázané na
    // konkrétní měsíc, zobrazují se jednou nahoře nad kalendářem.
    var notes = [];
    if (USE_NOTES[tier]) notes.push(USE_NOTES[tier]);
    if (isHighTier && altitude >= 500) notes.push('Ve vyšší poloze (u vás ' + Math.round(altitude) + ' m) jaro přichází později: termíny v tabulce jsou měsíční a platí, jakmile přestane mrznout a tráva oschne. Dávky, které by vyšly do mrazu nebo na sníh, odložte na první vhodný suchý den bez mrazu – pořadí a rozestup 4 týdny zachovejte.');
    if (irrigation === 'auto') {
      notes.push('Automatickou závlahu nastavte za běžného počasí na zhruba 20 l/m² za týden (2 zálivky po ~10 l), v tropech na 30 l/m² za týden; spouštějte brzy ráno mezi 5. a 7. hodinou, běžně 2× týdně a v extrémním horku až obden. Když trávník pořád žloutne, přidejte; po vydatném dešti zálivku vynechte.');
    } else if (irrigation === 'manual') {
      notes.push('Zalévejte za běžného počasí zhruba 20 l/m² za týden (2 zálivky po ~10 l), v tropech 30 l/m² za týden, brzy ráno mezi 5. a 7. hodinou, běžně 2× týdně a v extrémním horku až obden. Když trávník pořád žloutne, přidejte; večerní zálivka podporuje plísně.');
    } else if (irrigation === 'none') {
      notes.push('Bez zálivky trávník v suchých vedrech přirozeně zežloutne a utlumí růst (letní dormance) – to je normální obranná reakce, ne poškození, po dešti se zase zazelená. V tomto období navíc nehnojte, dusík bez vody trávník spíš poškodí.');
    }
    problems.forEach(function (p) { notes.push(PROBLEM_NOTES[p]); });
    if (lastFertilized === 'spring_done') {
      notes.push('Jarní dávku jste letos už aplikovali – první dávku v tabulce hnojení níže letos vynechejte a pokračujte až další v pořadí.');
    } else if (lastFertilized === 'none') {
      notes.push('Letos jste ještě nehnojili – začněte nejbližší dávkou v pořadí podle toho, jaký je teď měsíc (jarní dávky až když tráva roste; po polovině září přeskočte na podzimní). Vždy jen na suchou trávu, bez mrazu a sněhu.');
    }
    result.notes = notes;
    // Sezónní obecné rady (viz SEASON_GENERAL výš) - stejná {{WATER}}/{{SLOPE}} substituce jako
    // u měsíčních úkolů, jen aplikovaná na tenhle samostatný, sezónou (ne měsícem) klíčovaný set.
    var userH = Number(input.mowHeightCm) > 0 ? Number(input.mowHeightCm) : 0; // Martin 2026-11-16: výšku volí zákazník, v horku delší
    var mf0 = grassType ? GRASS_SPECIES[grassType] : tierMowFallback(tier), hotBase = userH || mf0.mowMax, mowHot = String(hotBase + 1).replace('.', ',') + '–' + String(hotBase + 2).replace('.', ',') + ' cm';
    var seasonGeneralSrc = SEASON_GENERAL[tier] || {};
    var seasonGeneral = {};
    Object.keys(seasonGeneralSrc).forEach(function (seasonKey) {
      seasonGeneral[seasonKey] = seasonGeneralSrc[seasonKey].map(function (t) {
        return { text: t.text.replace('{{WATER}}', waterNote).replace('{{SLOPE}}', slopeNote).replace('{{MOWHOT}}', mowHot), type: t.type };
      });
    });
    result.seasonGeneral = seasonGeneral;
    // Metadata pro hezčí výstupní dokument (hlavička se jménem plánu, přehledová lišta, tabulka
    // hnojení) - visí na vráceném poli stejným trikem jako .notes, aby se nerozbilo žádné starší
    // volání, co o nich neví.
    result.tier = tier;
    result.tierMeta = tierMetaOut;
    result.areaM2 = areaM2;
    result.fertType = fertType;
    result.fertTable = fertTable;
    result.planName = (input.planName || '').toString().trim() || null;
    // Výška sečení (2026-11-02, viz GRASS_SPECIES výš): druh trávníku, pokud ho zákazník zná/vybral,
    // má přednost před obecným odhadem podle úrovně péče; jinak padáme zpátky na tierMowFallback,
    // takže tahle hodnota je VŽDY k dispozici, i když zákazník druh nevyplnil.
    var grassSpecies = grassType ? GRASS_SPECIES[grassType] : null;
    var mowFallback = tierMowFallback(tier);
    // Nízkoúdržbový tier seká záměrně řidč/méně často (viz scheduleLow), takže i trávník, co by
    // jinak snesl nízké sečení (jílek), se tu drží o 2 cm výš - delší mezery mezi sečením potřebují
    // vyšší startovní výšku, ať se mezitím neseřízne přes 1/3 pravidlo. Jinak (standard/high) platí
    // druh trávníku beze změny - tam se seká pravidelně, takže na tom tolik nezáleží.
    var lowBump = (tier === 'low' && grassSpecies) ? 2 : 0;
    result.grassType = grassType;
    result.mowHeight = {
      min: (grassSpecies ? grassSpecies.mowMin : mowFallback.mowMin) + lowBump,
      max: (grassSpecies ? grassSpecies.mowMax : mowFallback.mowMax) + lowBump,
      bySpecies: !!grassSpecies,
      speciesLabel: grassSpecies ? grassSpecies.label : null,
      speciesNote: grassSpecies ? grassSpecies.note : null,
    };
    if (userH) { result.mowHeight.min = userH; result.mowHeight.max = userH; result.mowHeight.byUser = true; }
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
      return '<tr><td><strong>' + htmlEscape(r.when || r.month) + '</strong></td><td>' + htmlEscape(r.action) + '</td>' +
        '<td>' + htmlEscape(r.name) + '<br><small>Referenční složení NPK ' + htmlEscape(r.npk) + '</small>' +
          (r.look ? '<br><small>' + htmlEscape(r.look) + '</small>' : '') +
          (r.note ? '<br><small><strong>' + htmlEscape(r.note) + '</strong></small>' : '') +
          (r.warn ? '<br><small class="mg-fert-warn">⚠ ' + htmlEscape(r.warn) + '</small>' : '') +
          (r.condition ? '<br><small class="mg-fert-warn">' + htmlEscape(r.condition) + '</small>' : '') +
          (r.customPct ? '<br><small><strong>Přepočteno pro vaše hnojivo: ' + htmlEscape(r.drive) + ' ' + r.customPct + ' %.</strong></small>' : '') + '</td>' +
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
      { icon: '✂️', group: 'Sečení', title: 'Zlaté pravidlo třetiny', text: 'Nikdy neuberte víc než třetinu výšky stébla najednou – víc trávník stresuje, zpomaluje regeneraci a zvyšuje riziko chorob a plevele. Když roste rychle (hlavní sezóna, po dešti), sekejte raději častěji, než abyste jednou za čas ubrali víc.' },
      { icon: '🔄', group: 'Sečení', title: 'Střídejte směr', text: 'Při každém dalším sečení měňte směr (nahoru-dolů, pak napříč nebo diagonálně) – pořád stejný směr tvoří kolejové stopy a trávník roste nakřivo.' },
      { icon: '🧪', group: 'Půda', title: 'Rozbor půdy a pH', text: 'Nejspolehlivější je laboratorní rozbor půdy (pH, fosfor, draslík, hořčík, vápník) – ukáže, jestli se živiny nehromadí a jestli je vápnění vůbec potřeba. Pozor na stupnici: optimum pro trávník je zhruba pH 6-7 ve vodě, laboratoře ale často uvádějí pH/CaCl₂, kde je optimum o ~0,5 nižší – řiďte se stupnicí z vašeho výsledku. Vápnění dělejte výhradně podle rozboru, nikdy "naslepo"; změna pH trvá měsíce.' },
      { icon: '⏳', group: 'Bezpečnost', title: 'Kdy zase na trávník', text: 'Po minerálním hnojivu pusťte děti a zvířata na trávník až po zálivce nebo dešti, kdy granule zmizí z povrchu. Po postřiku proti plevelům se řiďte etiketou přípravku.' },
      { icon: '🌳', group: 'Stín', title: 'Stín pod stromy a keři', text: 'V zastíněných částech trávník roste pomaleji a je náchylnější na houby – dávky hnojiva tam snižte zhruba na polovinu a sekejte o 1,5–2,5 cm výš než na slunci. Je-li stín trvalý, zvažte při příštím přísevu směs s vyšším podílem kostřavy červené, která stín snáší líp než jílek.' },
    ];
    var cardsHtml = tips.map(function (t) {
      return '<div class="mg-advice-card"><p class="mg-advice-group">' + htmlEscape(t.group) + '</p>' +
        '<div class="mg-advice-head"><span class="mg-advice-ic" aria-hidden="true">' + t.icon + '</span><h5>' + htmlEscape(t.title) + '</h5></div>' +
        '<p class="mg-advice-text">' + htmlEscape(t.text) + '</p></div>';
    }).join('');
    return '<section class="mg-care-tips"><h4>📖 Další odborné rady</h4><div class="mg-advice-grid">' + cardsHtml + '</div></section>';
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

    var mowHeight = months && months.mowHeight;

    var statChips = [];
    if (areaM2 > 0) statChips.push({ label: 'Plocha trávníku', value: areaM2 + ' m²' });
    if (tierMeta) {
      statChips.push({ label: 'Úroveň péče', value: tierMeta.label });
      statChips.push({ label: 'Hnojení', value: tierMeta.freq });
      statChips.push({ label: 'Dusík (N)', value: tierMeta.nRange });
    }
    // Výška sečení (2026-11-02): dřív se tohle číslo vůbec neuvádělo jako samostatný údaj, jen
    // schované v textu jednotlivých měsíců - teď je to vlastní dlaždice, přesná podle druhu
    // trávníku, pokud ho zákazník zná/vybral (viz GRASS_SPECIES), jinak podle úrovně péče.
    if (mowHeight) {
      statChips.push({ label: 'Výška sečení', value: (mowHeight.min === mowHeight.max ? String(mowHeight.min).replace('.', ',') : mowHeight.min + '–' + mowHeight.max) + ' cm' + (mowHeight.bySpecies || mowHeight.byUser ? '' : ' *') });
    }
    var statHtml = statChips.length
      ? '<div class="mg-care-stats">' + statChips.map(function (s) {
        return '<div class="mg-care-stat"><small>' + htmlEscape(s.label) + '</small><strong>' + htmlEscape(s.value) + '</strong></div>';
      }).join('') + '</div>'
      : '';

    // Vysvětlující poznámka k druhu trávníku - stejný vzor jako typeNote u hnojiva (FERT_TYPE_NOTE):
    // když zákazník druh zná/vybral, dostane konkrétní výhody/nevýhody a odůvodnění výšky sečení
    // výš; když ne, aspoň krátké vysvětlení, že hvězdička u výšky sečení je jen obecný odhad podle
    // úrovně péče, a ať se mrkne na pytel od osiva nebo fakturu od zakládání, pokud ji chce zpřesnit.
    var grassNoteHtml = (mowHeight && mowHeight.bySpecies)
      ? '<div class="mg-care-extra-notes mg-care-grass-note"><h4>🌱 ' + htmlEscape(mowHeight.speciesLabel) + '</h4><p>' + htmlEscape(mowHeight.speciesNote) + '</p></div>'
      : (mowHeight && !mowHeight.byUser ? '<p class="mg-note mg-care-grass-note-unknown">* Výška sečení je obecný odhad podle úrovně péče. Zadejte v dotazníku, na kolik sekáte, nebo druh trávníku (najdete ho na obalu od osiva).</p>' : '');

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
    // Časová osa (2026-11-02, Martinovo rozhodnutí z vizuálních náhledů - "libi se mi D osa"):
    // sezóny jako velké milníky na svislé ose, jednotlivé měsíce pod nimi jako menší uzly -
    // nahrazuje dřívější mřížku karet (.mg-care-season-months), styl vycházející z přípravných
    // náhledů (viz calendar_variants.html, varianta D). Sezónní obecné rady zůstávají stejně jako
    // dřív hned u nadpisu sezóny, PŘED jednotlivými měsíci (viz SEASON_GENERAL výš).
    var seasonsHtml = SEASONS.map(function (season) {
      var items = season.months.map(function (k) { return byKey[k]; }).filter(function (m) { return m && m.tasks && m.tasks.length; });
      var generalTasks = seasonGeneral[season.key] || [];
      if (!items.length && !generalTasks.length) return '';
      var generalHtml = generalTasks.length
        ? '<div class="mg-care-season-general"><p class="mg-care-season-general-label">Platí pro celé období:</p>' + taskListHtml(generalTasks) + '</div>'
        : '';
      var nodesHtml = items.map(function (m) {
        return '<div class="mg-care-node"><p class="mg-care-node-month">' + htmlEscape(m.label) + '</p>' + taskListHtml(m.tasks) + '</div>';
      }).join('');
      return '<div class="mg-care-milestone" data-icon="' + season.icon + '"><h4>' + season.label + '</h4>' + generalHtml + nodesHtml + '</div>';
    }).join('');

    return '<div class="mg-care-report">'
      + '<header class="mg-care-report-head"><span class="mg-care-report-eyebrow">🌿 MVGreen · Roční plán péče</span><h3>' + htmlEscape(title) + '</h3><small>Vytvořeno ' + fmtToday() + '</small>'
      + '<button type="button" class="mg-care-print" onclick="window.print()">🖨️ Vytisknout / uložit jako PDF</button></header>'
      + statHtml
      + grassNoteHtml
      + noteRows
      + fertTableHtml
      + '<h4 class="mg-care-cal-title">📅 Kalendář péče podle ročních období</h4>'
      + legendHtml
      + '<div class="mg-care-plan mg-care-timeline">' + seasonsHtml + '</div>'
      + renderExpertTips()
      + '<p class="mg-note">Program vychází z ověřeného profesionálního plánu hnojení (dávky orientačně 20–30 g/m²), upraveného podle úrovně péče, půdy a nadmořské výšky. Značku hnojiva si vyberte sami – rozhoduje složení na obalu.</p>'
      + '<p class="mg-note">⚠️ Minerální hnojivo aplikujte na suchý trávník, nejlépe těsně před deštěm; pokud neprší, hned po aplikaci ho zalijte aspoň hadicí – bez vody po hnojení vždy hrozí spálení trávníku (Martin 2026-11-19). Nikdy nehnojte mokrý trávník.</p>'
      + '<p class="mg-note">⚠️ Hnojivo rozhazujte rozmetadlem (ručním nebo pojízdným rotačním), nikdy ne z ruky – kam se dostane víc granulí, tam tráva spálí. Rozmetadlo plňte mimo trávník a vysypané granule hned smeťte nebo vyfoukejte.</p>'
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
      + '<p>Tenhle plán vám klidně i rovnou splníme – přijedeme, pohnojíme a posekáme přesně podle něj, vy se nemusíte starat o nic. Péče o zeleň je přesně to, co MV GREEN dělá.</p></div>'
      + '<div class="mg-care-upsell-btns">'
      + '<a class="mg-care-upsell-btn mg-care-upsell-btn--primary" href="tel:+420723339650">Zavolat 723 339 650</a>'
      + '<a class="mg-care-upsell-btn" href="/kontakty/">Nezávazná poptávka</a>'
      + '</div></div>';
  }

  // FERT_TYPE_NOTE se exportuje i samo o sobě (ne jen zabalené v textu poznámky u dávky), aby ho
  // mohl app.js 2026-11-02 znovu použít jako popisky "ⓘ" u vlastního výběru typu hnojiva (#mg-care2-ferttype)
  // - stejný text na dvou místech, ale psaný jen jednou, ať se časem nerozjedou.
  var api = { computeCarePlan: computeCarePlan, renderCarePlanHTML: renderCarePlanHTML, FERT_TYPE_NOTE: FERT_TYPE_NOTE, GRASS_SPECIES: GRASS_SPECIES };
  if (typeof window !== 'undefined') window.MVGreenCarePlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
