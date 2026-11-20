/*
 * MVGreen – „mozek“ ročního plánu péče o trávník (v0.1, 2026-11-16).
 *
 * Martin (2026-11-16): "udělej celý mozek, aby řídil náš plánovač podle toho, co zákazník zadá do dotazníku,
 * který sestavíme podle toho, co mozek potřebuje vědět; mozek udělá výstup a doporučení."
 *
 * decide(odpovědi) -> { tier, requestedTier, recommendedTier, mode, warnings, recommendations, plan, fertTable,
 *                       symptomGuide, shopping, reminders, missing }
 * Výpočetní jádro (termíny, dávky) = MVGreenCarePlan.computeCarePlan (garden-care.js, schválené kalendáře 14. 11.).
 * Tady jsou jen PRAVIDLA R1–R15 (podklad: interní znalostní báze mimo repozitář). Každé pravidlo nese zdroj a důvěru
 * (A = více nezávislých zdrojů, B = jeden dobrý zdroj, C = praxe / odhad). Pravidla s ❓ čekají na Martinovo schválení.
 * Žádné značky ani obchody (Martin 2026-11-16: "nemáme žádnou spolupráci, nemusíme preferovat žádnou značku").
 * Nic se neposílá ven, žádné AI volání – deterministický výpočet v prohlížeči.
 *
 * Export: window.MVGreenBrain = { decide, QUESTIONS, RULES }
 */
(function () {
  'use strict';

  var SRC_M = 'Martin – vlastní praxe', SRC_L = 'odborná literatura (univerzitní doporučení)', SRC_LAB = 'český laboratorní rozbor trávníku';

  /** Dotazník = jen to, co mozek potřebuje vědět. `changes` říká, co odpověď mění (otázka, která nic nemění, se nepokládá). */
  var QUESTIONS = [
    { id: 'altitude', group: 'Místo', q: 'Kde je zahrada (obec)?', changes: 'nadmořská výška -> posun termínů (nízká a běžná péče)', required: true },
    { id: 'areaM2', group: 'Místo', q: 'Kolik m² má trávník?', changes: 'kg hnojiva, cena', required: true },
    { id: 'slope', group: 'Místo', q: 'Je trávník na svahu?', options: ['flat', 'mild', 'steep'], changes: 'zálivka' },
    { id: 'sun', group: 'Místo', q: 'Kolik má trávník slunce?', options: ['full', 'partial', 'shade'], changes: 'stín = poloviční dusík, vyšší seč (R6)' },
    { id: 'age', group: 'Trávník', q: 'Je trávník nový (do 1 roku), nebo zaběhlý?', options: ['new', 'established'], changes: 'nový = startovací hnojení, max. dusík (R5)' },
    { id: 'grassType', group: 'Trávník', q: 'Jaká je travní směs?', options: ['rye', 'fescue', 'mix', ''], changes: 'výška sečení, upozornění u anglického režimu' },
    { id: 'mowPerWeek', group: 'Trávník', q: 'Kolikrát týdně v sezóně sekáte?', changes: 'podmínka pro anglický trávník (R2)' },
    { id: 'irrigation', group: 'Trávník', q: 'Máte závlahu?', options: ['auto', 'manual', 'none'], changes: 'podmínka pro anglický trávník (R1), rady k zálivce' },
    { id: 'use', group: 'Trávník', q: 'Kdo trávník používá?', multi: ['kids', 'dog', 'sport', 'ornamental'], changes: 'pes (R14), sport' },
    { id: 'soil', group: 'Trávník', q: 'Jaká je půda?', options: ['sand', 'normal', 'clay', 'unknown'], changes: 'dávka ×1,15 / ×1 / ×0,85' },
    { id: 'soilTest', group: 'Trávník', q: 'Máte rozbor půdy? Opište kategorie z výsledku (nízká / vyhovující / optimální / vysoká / nadlimitní).', changes: 'P a K se nehromadí (R8), vápnění (R7)' },
    { id: 'problems', group: 'Stav', q: 'Co trávník trápí?', multi: ['moss', 'weeds', 'bare', 'snowmold', 'compaction', 'thatch'], changes: 'přídavné zásahy (R15, poznámky)' },
    { id: 'symptoms', group: 'Stav', q: 'Jak teď vypadá?', multi: ['pale', 'thin', 'slow'], changes: 'úsporný režim: kdy přihnojit (R11)' },
    { id: 'lastFertilized', group: 'Stav', q: 'Hnojili jste letos?', options: ['spring_done', 'none', 'unknown'], changes: 'přeskočení první dávky' },
    { id: 'goal', group: 'Cíl', q: 'Jak má trávník vypadat?', options: ['english', 'family', 'low'], changes: 'úroveň péče (schválené kalendáře)', required: true },
    { id: 'mode', group: 'Cíl', q: 'Chcete hnojit pravidelně, nebo jen když trávník ukáže, že potřebuje?', options: ['preventive', 'thrifty'], changes: 'pevné dávky vs. návod podle příznaků (R11)' },
    { id: 'fertType', group: 'Cíl', q: 'Jaké hnojivo chcete používat?', options: ['fast', 'crf', 'organic', 'auto'], changes: 'poznámky k dávce a intervalu (R3, R4, R13)' },
    { id: 'productPct', group: 'Cíl', q: 'Máte už hnojivo? Opište z obalu obsah hlavní živiny v %.', changes: 'přepočet g/m²' },
    { id: 'prices', group: 'Cíl', q: 'Za kolik hnojivo kupujete (Kč/kg)? Nepovinné.', changes: 'cena na m² a na rok (R13)' },
  ];

  // Dusík podle travní směsi: VYPNUTO (Martin 2026-11-16 večer: „jel bych podle mé praxe a nerozlišoval to, mně to funguje“).
  // Všechny směsi dostávají schválený plán úrovně (anglický 9 dávek ≈ 35 g N). Mechanismus nechávám pro případnou změnu.
  var N_BY_GRASS = {};
  var TIER_BY_GOAL = { english: 'representative', family: 'standard', low: 'low' };
  var GOAL_BY_TIER = { representative: 'english', standard: 'family', low: 'low' };
  var TIER_LABEL = { representative: 'Anglický trávník', sportovni: 'Sportovní trávník', standard: 'Běžný rodinný trávník', low: 'Nízká údržba' };
  var HIGH = function (cat) { return cat === 'vysoka' || cat === 'nadlimitni'; };

  /** Seznam pravidel (pro schvalovací stránku a pro výstup „proč“). */
  var RULES = {
    R1: { title: 'Anglický trávník bez závlahy', source: SRC_M + ' + ' + SRC_L, confidence: 'B', approved: false },
    R2: { title: 'Anglický trávník a málo sečení', source: SRC_M, confidence: 'C', approved: false },
    R3: { title: 'Rychlé hnojivo – max. ≈ 5 g N/m² na aplikaci, po aplikaci zalít', source: SRC_L, confidence: 'A', approved: false },
    R4: { title: 'Dlouhodobé hnojivo – interval podle štítku, štítek často přeceňuje', source: SRC_M + ' + ' + SRC_L, confidence: 'B', approved: false },
    R5: { title: 'Nový trávník – startovací hnojení, max. dusík', source: SRC_L, confidence: 'B', approved: false },
    R6: { title: 'Stín – poloviční dusík, vyšší seč', source: SRC_L, confidence: 'A', approved: false },
    R7: { title: 'Vápnění jen podle rozboru a jeho stupnice', source: SRC_L + ' + ' + SRC_LAB, confidence: 'A', approved: false },
    R8: { title: 'Vysoký fosfor/draslík v rozboru – hnojivo bez P/K', source: SRC_LAB + ' + ' + SRC_L, confidence: 'B', approved: false },
    R9: { title: 'Bez rozboru – doporučit rozbor, neslibovat „zazimování“ draslíkem', source: SRC_L, confidence: 'B', approved: false },
    R10: { title: 'Listopadová dávka jen když tráva roste a nemrzne', source: SRC_L, confidence: 'B', approved: false },
    R17: { title: 'Poslední podzimní dávka podle teploty půdy v obci (ne v září)', source: 'video V10 (Svoboda + Exner) + Martin [M] 16. 11. 2026', confidence: 'C', approved: false },
    R11: { title: 'Úsporný režim – hnojit podle příznaků', source: SRC_M, confidence: 'C', approved: false },
    R12: { title: 'Nikdy na mokrou trávu, sníh ani zmrzlou půdu', source: SRC_M + ' + ' + SRC_L, confidence: 'A', approved: true },
    R13: { title: 'Organické hnojivo – dávka podle obsahu živiny z obalu, cena na m²', source: 'diskuse praktiků (sporné údaje o dávce)', confidence: 'C', approved: false },
    R14: { title: 'Pes – zalít místo do 8 hodin', source: SRC_L, confidence: 'B', approved: false },
    R15: { title: 'Plsť – vertikutace a aerifikace', source: SRC_L + ' + ' + SRC_M, confidence: 'B', approved: false },
    VSTUP: { title: 'Kontrola zadaných čísel', source: 'kontrola vstupu', confidence: 'A', approved: true },
  };


  // ===== PÉČE O DRN – mechanické zásahy (Martin 2026-11-16: „úplně tam chybí aerifikace (duté, plné hroty), vertikutace,
  // dosev, top dressing, scalping, detailní postup“; „anglický vyčesávat klidně 1× za 2 měsíce, propichování válcem
  // s hroty 1× za měsíc“). Čísla: interní znalostní báze §15 (univerzitní doporučení + Exner/Svoboda + Martin).
  // Vše mechanické jen při půdě ≥ 10 °C (Martin). =====
  var PROC = {
    propich: { title: 'Propichování (plné hroty)', tools: 'Válec s hroty, nebo aerifikační vidle s plnými hroty.', why: 'Dostane do půdy vzduch a vodu. Nic se nevynáší a povrch se skoro nenaruší, proto se dá dělat často.',
      steps: ['Půda má být vlhká, ne rozbahněná (třeba den po dešti nebo zálivce) – hroty jdou hlouběji.', 'Projeďte celou plochu válcem s hroty. Vidlemi vpichujte zhruba po 10 cm a při vpichu lehce zapáčte.', 'Nic neuklízíte, otvory se samy zavřou.', 'Ve vedru takhle propíchněte a zalijte místa, kde voda stéká (u obrubníků, na kopečcích).'],
      avoid: 'Na zmrzlé nebo podmáčené půdě.' },
    vycesani: { title: 'Vyčesání', tools: 'Vějířové pružné hrábě nebo vyčesávač (vertikutátor s pružinovým válcem).', why: 'Odstraní odumřelou trávu a začínající plsť dřív, než z ní bude problém.',
      steps: ['Posekejte na obvyklou výšku.', 'Na suchém trávníku projeďte vyčesávačem jedním směrem, hráběmi táhněte lehce, ať trávu nevytrháváte.', 'Vyčesanou stařinu shrabejte nebo posbírejte sekačkou s košem.', 'Za sucha potom zalijte.'],
      avoid: 'Ve vedru a suchu, na mokrém trávníku a dokud půda nemá 10 °C.' },
    vertikutace: { title: 'Vertikutace', tools: 'Vertikutátor s noži (koupit nebo půjčit).', why: 'Prořízne a vytáhne plsť a mech, aby ke kořenům šel vzduch, voda i hnojivo.',
      steps: ['Posekejte nízko a posečenou hmotu odstraňte.', 'Nože nastavte tak, aby jen lehce řezaly do půdy (2–3 mm).', 'Bez dosevu stačí jeden přejezd jedním směrem. Když budete dosévat, projeďte dvakrát do kříže.', 'Vytaženou plsť a mech shrabejte.', 'Pohnojte podle plánu a zalijte. 1–2 týdny bude trávník vypadat hůř, to je normální.', 'Když dosíváte, pokračujte dosevem a lehkým pískováním.'],
      avoid: 'Ve vedru, v suchu bez možnosti zalít, na mokrém trávníku a dokud půda nemá 10 °C.' },
    dute: { title: 'Aerifikace dutými hroty', tools: 'Aerifikátor s dutými hroty (půjčovna) nebo vidle s dutými hroty, hrábě, koště.', why: 'Vytáhne válečky zeminy a uvolní utuženou půdu. Otvory se zasypou pískem, takže se půda časem zlepšuje.',
      steps: ['Den předem vydatně zalijte – půda má být vlhká, ne rozbahněná.', 'Posekejte nízko.', 'Aerifikujte do hloubky 5–8 cm s rozestupem 5–8 cm. Slabší stroj projeďte dvakrát, podruhé křížem.', 'Vytažené špunty nechte oschnout a shrabejte (nebo rozdrťte a zameťte zpět).', 'Do 1–2 dnů pískujte (viz pískování) a případně dosejte.', '2–3 týdny trávník nezatěžujte.'],
      avoid: 'V létě ve vedru, na zmrzlé nebo podmáčené půdě, u nového trávníku v prvním roce.' },
    pisek: { title: 'Pískování (top dressing)', tools: 'Praný písek 0/2, kolečko, lopata, koště nebo vlečná síť.', why: 'Zlepšuje půdu, vyrovnává drobné nerovnosti a drží otvory po aerifikaci otevřené.',
      steps: ['Kupte praný písek 0/2 – rozhoduje zrnitost a že je praný, ne barva.', 'Množství: po aerifikaci dutými hroty asi 10 kg/m² (100 m² ≈ 1 tuna). Jinak jen lehce, nejvýš asi 5 kg/m² (vrstva 3–4 mm).', 'Rozhrňte ho na suchý trávník.', 'Zameťte do otvorů a mezi stébla, stébla musí zůstat vidět.', 'Zalijte.'],
      avoid: 'Silnou vrstvu najednou – lépe méně a častěji.' },
    dosev: { title: 'Dosev', tools: 'Travní osivo stejného typu jako trávník, rozmetadlo, hrábě.', why: 'Zahustí trávník a zaplní holá místa, než je zaroste plevel.',
      steps: ['Dosévejte hned po vertikutaci do kříže nebo po aerifikaci, kdy semena zapadnou do půdy.', 'Pohnojte startovacím hnojivem s vyšším obsahem fosforu (dávka podle obalu) – místo běžné dávky z plánu v tom měsíci.', 'Množství 15–25 g osiva na m² (řiďte se obalem), na holá místa víc.', 'Osivo rozhoďte rozmetadlem ve dvou směrech do kříže.', 'Lehce zahrabejte nebo zasypte tenkou vrstvou písku, nejvýš 0,5 cm.', 'Prvních asi 10 dní udržujte povrch stále vlhký: krátká zálivka 2–3× denně.', 'Jílek vzejde za 7–10 dní, kostřavy za 2–3 týdny. 2–3 týdny po trávníku nechoďte.'],
      avoid: 'V létě ve vedru (mladá tráva se uvaří) a pozdě na podzim, kdy už nestihne zesílit.' },
    scalping: { title: 'Scalping (velmi nízká seč)', tools: 'Sekačka s co nejnižším nastavením a košem (vřetenová sekačka jde nejníž).', why: 'Odstraní starou hmotu, plsť a slabé přerostlé části. Je to první krok velké podzimní regenerace.',
      steps: ['Jen u zaběhlého anglického nebo sportovního trávníku, při velké regeneraci koncem srpna až v září.', 'Posekejte na co nejnižší výšku, kterou vaše sekačka dovolí.', 'Veškerou hmotu posbírejte.', 'Hned pokračujte: aerifikace dutými hroty (u utužené půdy), vertikutace do kříže, shrabání, hnojení, dosev, pískování.', '2–3 týdny bude trávník vypadat hůř.'],
      avoid: 'V zimě a brzy na jaře, ve vedru, u nového trávníku.' },
  };
  // Pořadí podle J. Exnera (Martin 2026-11-16: „nechat Exnera“): aerifikace před vertikutací. Hnojení: s dosevem startovací,
  // bez dosevu dávka podle plánu (Martin 2026-11-16).
  var REGEN = ['Scalping – posekat na nejnižší výšku, kterou sekačka dovolí (jen anglický a sportovní trávník)', 'Aerifikace dutými hroty (jen u utužené nebo jílovité půdy)', 'Uklidit špunty', 'Vertikutace do kříže', 'Shrabat plsť a mech', 'Pohnojit: když dosíváte, startovacím hnojivem s vyšším obsahem fosforu (místo dávky z plánu); bez dosevu dávkou podle plánu', 'Dosev', 'Pískování a zamést do otvorů', 'Zálivka – povrch stále vlhký, dokud tráva nevzejde'];

  function doyLabel(doy) { var d = new Date(2025, 0, 1 + Math.round(doy)); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; }
  function springWindow(alt, climate) {
    // Martin 2026-11-16: „ať se automaticky vyplní nadmořská výška a podnebí za posledních 5 let“ – skutečné datum,
    // kdy má u zákazníka půda 10 °C (průměr 5 let), má přednost před odhadem podle výšky.
    if (climate && climate.soil10 > 0) {
      var dd = new Date(2025, 0, 1 + Math.round(climate.soil10));
      return { text: 'u vás v průměru kolem ' + doyLabel(climate.soil10) + ', průměr posledních ' + (climate.years || 5) + ' let', month: dd.getMonth(), day: dd.getDate() <= 15 ? 1 : 16 };
    }
    alt = Number(alt) || 0;
    if (alt >= 700) return { text: 'obvykle v květnu', month: 4, day: 16 };
    if (alt >= 350) return { text: 'obvykle koncem dubna až začátkem května, v Domažlicích v průměru kolem 3. 5.', month: 4, day: 1 };
    return { text: 'obvykle v průběhu dubna', month: 3, day: 16 };
  }

  /** Roční program péče o drn podle úrovně a odpovědí. Každá položka = zásah, jak často, kdy, postup (PROC). */
  function careProgram(tier, a) {
    var sp = springWindow(a.altitude, a.climate), spring = 'jaro, až má půda 10 °C (' + sp.text + ')';
    var hi = tier === 'representative' || tier === 'sportovni';
    // Martin 2026-11-16: „řiď se co říká Exner podle zhutnění půdního profilu“ – duté hroty jen u utužené/jílovité půdy
    var compact = has(a.problems, 'compaction') || a.soil === 'clay', thatch = has(a.problems, 'thatch');
    var P = [];
    if (a.age === 'new') {
      P.push({ proc: 'dosev', freq: 'podle potřeby', when: 'holá místa koncem srpna až v září', note: 'První rok jen sečení a dosev holých míst; vertikutaci ne dřív než za rok (Martin). Trávník nechte dorůst asi do 10 cm a pak zkracujte vždy o třetinu.' });
      return P;
    }
    if (hi) {
      P.push({ proc: 'propich', freq: '1× za měsíc', when: 'duben–říjen' });
      P.push({ proc: 'vycesani', freq: '1× za 2 měsíce', when: 'v sezóně, od 10 °C v půdě do září' });
      P.push({ proc: 'vertikutace', freq: '2× ročně', when: spring + ' a koncem srpna až v září' });
      P.push({ proc: 'scalping', freq: '1× ročně', when: 'na začátku podzimní regenerace (konec srpna–září)' });
      if (compact) {
        P.push({ proc: 'dute', freq: '1× ročně', when: 'konec srpna–září, při silném utužení i na jaře', note: 'Půda je utužená nebo jílovitá – duté hroty ji postupně zlepší (s pískem).' });
        P.push({ proc: 'pisek', freq: 'po aerifikaci (~10 kg/m²), lehce i po jarní vertikutaci', when: 'hned po zásahu' });
      } else {
        P.push({ proc: 'pisek', freq: 'lehce po vertikutaci (do ~5 kg/m²)', when: 'hned po zásahu', note: 'Půda není utužená: místo dutých hrotů stačí plné hroty (propichování) a lehké pískování. Duté hroty až když se půda utuží.' });
      }
      P.push({ proc: 'dosev', freq: '1× ročně + holá místa', when: 'při podzimní regeneraci (konec srpna–září)' });
    } else if (tier === 'standard') {
      P.push({ proc: 'vertikutace', freq: thatch ? '2× ročně' : '1–2× ročně', when: spring + ', případně i koncem srpna–září' });
      P.push({ proc: 'vycesani', freq: '2× ročně', when: 'jaro (po 10 °C) a podzim' });
      P.push({ proc: 'propich', freq: compact ? '1× za měsíc na utužených místech' : '2–3× ročně', when: 'v sezóně' });
      if (compact) {
        P.push({ proc: 'dute', freq: '1× ročně', when: 'konec srpna–září', note: 'Půda je utužená nebo jílovitá.' });
        P.push({ proc: 'pisek', freq: 'po aerifikaci dutými hroty', when: 'hned po aerifikaci' });
      }
      P.push({ proc: 'dosev', freq: 'podle potřeby', when: 'po podzimní vertikutaci, holá místa' });
    } else {
      P.push({ proc: 'vertikutace', freq: thatch ? '1× ročně' : '1× ročně, volitelně', when: 'konec srpna–září, nebo ' + spring });
      if (compact) P.push({ proc: 'propich', freq: '2–3× ročně na utužených místech', when: 'v sezóně' });
      P.push({ proc: 'dosev', freq: 'podle potřeby', when: 'holá místa koncem srpna až v září' });
    }
    return P;
  }

  /** Celoroční znalosti (lawn-kb.js) vybrané pro zákazníka: sečení, zálivka, jeho problémy nahoře, průvodce všemi. */
  var PROB_MAP = { spots: ['dollarspot', 'redthread', 'rust', 'snowmold'], bare: ['crabgrass'], compaction: ['drypatch', 'moss'] };
  function knowledge(a, tier) {
    var KB = (typeof window !== 'undefined' && window.MVGreenLawnKB) || null;
    if (!KB) return null;
    var mow = KB.MOW.rules.slice();
    var h = num(a.mowHeightCm);
    if (h > 0) mow.unshift('Vaše výška sečení: ' + String(h).replace('.', ',') + ' cm – sekejte, když tráva doroste zhruba na ' + String(Math.round(h * 1.5 * 10) / 10).replace('.', ',') + ' cm; v horku nechte o 1–2 cm víc.');
    if (a.mower && KB.MOW.mowerNote[a.mower]) mow.push(KB.MOW.mowerNote[a.mower]);
    var water = a.irrigation === 'none' ? [KB.WATER.none].concat(KB.WATER.rules.slice(1)) : KB.WATER.rules.slice();
    var keys = {};
    (a.problems || []).forEach(function (p) { keys[p] = 1; (PROB_MAP[p] || []).forEach(function (k) { keys[k] = 1; }); });
    if (has(a.use, 'dog')) keys.dog = 1;
    var mine = KB.PROBLEMS.filter(function (p) { return keys[p.key]; });
    return { mow: mow, newLawn: a.age === 'new' ? KB.MOW.newLawn : null, water: water, newSeed: KB.WATER.newSeed, myProblems: mine, allProblems: KB.PROBLEMS, tips: KB.SEASON_TIPS };
  }

  // ===== Ověření postupů (zobrazuje se zákazníkovi u návodu – „působí ověřeně“, Martin 2026-11-16) =====
  var VERIFIED = {
    propich: 'Univerzitní doporučení (Kansas State University) a praxe MVGreen.',
    vycesani: 'Praxe MVGreen (anglický trávník 1× za 2 měsíce).',
    vertikutace: 'Univerzitní doporučení (University of Idaho, Utah State) a praxe českých profesionálních trávníkářů.',
    dute: 'Univerzitní doporučení (Kansas State, Ohio State, University of Nebraska) a praxe českých profesionálních trávníkářů.',
    pisek: 'Praxe českých profesionálních trávníkářů a doporučení LSU AgCenter a USGA.',
    dosev: 'Univerzitní doporučení (University of Illinois Extension) a praxe MVGreen.',
    scalping: 'Praxe MVGreen.',
  };
  // Množství materiálu na plochu zákazníka (ověřená čísla – znalostní báze §15)
  function amounts(proc, areaM2) {
    var a = Number(areaM2) || 0, kg = function (x) { return String(Math.round(x * 10) / 10).replace('.', ','); };
    if (!a) return '';
    if (proc === 'pisek') return 'Na vašich ' + a + ' m²: po aerifikaci dutými hroty asi ' + kg(a * 10) + ' kg písku, při lehkém pískování nejvýš ' + kg(a * 5) + ' kg.';
    if (proc === 'dosev') return 'Na vašich ' + a + ' m²: ' + kg(a * 0.015) + '–' + kg(a * 0.025) + ' kg osiva (15–25 g/m²).';
    return '';
  }

  /** Kalendář po měsících: hnojení + péče o drn + návyky na jednom místě (aby se zákazník neztrácel, Martin 2026-11-16). */
  var MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  function monthPlan(res, a) {
    var M = MONTHS_CZ.map(function (n, i) { return { m: i, name: n, items: [] }; });
    var add = function (m, item) { if (M[m]) M[m].items.push(item); };
    var fmtKg = function (x) { return String(x).replace('.', ','); };
    if (res.mode === 'preventive') res.fertTable.forEach(function (r) {
      if (typeof r.half !== 'number') return;
      add(Math.floor(r.half / 2), { type: 'fert', key: r.key, title: 'Hnojení: ' + r.name, detail: r.doseG + ' g/m²' + (r.totalKg ? ' · ' + fmtKg(r.totalKg) + ' kg na vaši plochu' : '') + ' · ' + (r.half % 2 ? 'druhá polovina měsíce' : 'první polovina měsíce'), cond: r.condition || 'Na suchou trávu, bez mrazu a sněhu.' });
    });
    var sp = res.care ? res.care.spring.month : 4;
    (res.care ? res.care.program : []).forEach(function (p) {
      var t = PROC[p.proc].title, months = [];
      if (p.proc === 'propich') months = /měsíc/.test(p.freq) ? [3, 4, 5, 6, 7, 8, 9] : [4, 6, 8];
      else if (p.proc === 'vycesani') months = /2 měsíce/.test(p.freq) ? [sp, 6, 8] : [sp, 8];
      else if (p.proc === 'vertikutace') months = /2×|1–2×/.test(p.freq) ? [sp, 8] : [8];
      else months = [8]; // scalping, duté hroty, písek, dosev = podzimní regenerace (konec srpna–září)
      months.forEach(function (m) { add(m, { type: 'care', proc: p.proc, title: t, detail: p.freq }); });
    });
    // návyky a sezónní upozornění (lawn-kb + Martinova pravidla)
    var tip = function (m, title, detail) { add(m, { type: 'tip', title: title, detail: detail }); };
    tip(1, 'Příprava na sezónu', 'Naostřit nůž sekačky, zkontrolovat rozmetadlo a vertikutátor.');
    tip(2, 'Vyhrabat listí a stařinu', 'Jakmile oschne a nemrzne.');
    tip(3, 'První seče', 'O něco výš než obvykle, pak postupně na vaši výšku.');
    tip(4, 'Hlídat ježatku a lipnici', 'Mladou ježatku vytrhat; v době květu lipnice sbírat posečenou hmotu.');
    [5, 6, 7].forEach(function (m) { tip(m, 'Horko', 'Nesekat nakrátko (o 1–2 cm výš), zalévat ráno, ráno stahovat rosu.'); });
    tip(6, 'Ranní obchůzka', 'Za rosy hledat pavučinky plísní (dolarová skvrnitost).');
    tip(8, 'Kontrola ponrav', 'Zkusit zvednout drn na podezřelých místech.');
    [9, 10].forEach(function (m) { tip(m, 'Listí', 'Hrabat nebo foukat průběžně – prevence plísně sněžné.'); });
    tip(10, 'Poslední seč', 'Na běžnou výšku, nenechávat do zimy dlouhou trávu.');
    [11, 0, 1].forEach(function (m) { tip(m, 'Zimní klid', 'Na zmrzlý nebo zasněžený trávník nechodit, nedávat na něj sníh ani listí.'); });
    if (a && a.age === 'new') tip(3, 'Nový trávník', 'Nechat dorůst asi do 10 cm, pak zkracovat vždy o třetinu. Rotační sekačkou nesekat příliš brzy.');
    return M;
  }

  /** Přehled podnebí obce pro zákazníka (data: server, průměr posledních let). */
  function climateSummary(c) {
    if (!c || !c.years) return null;
    var rows = [];
    if (c.elevation != null) rows.push(['Nadmořská výška', Math.round(c.elevation) + ' m']);
    if (c.lastSpringFrost) rows.push(['Poslední jarní mráz', 'v průměru ' + doyLabel(c.lastSpringFrost)]);
    if (c.firstAutumnFrost) rows.push(['První podzimní mráz', 'v průměru ' + doyLabel(c.firstAutumnFrost)]);
    if (c.soil10) rows.push(['Půda 10 °C (start vertikutace, aerifikace, dosevu)', 'v průměru ' + doyLabel(c.soil10)]);
    if (c.soilBelow10) rows.push(['Půda pod 10 °C (konec mechanických zásahů)', 'v průměru ' + doyLabel(c.soilBelow10)]);
    if (c.rainYear) rows.push(['Srážky za rok', Math.round(c.rainYear) + ' mm']);
    if (c.hotDays != null) rows.push(['Tropické dny (30 °C a víc)', Math.round(c.hotDays) + ' za rok']);
    if (c.galeDays != null) rows.push(['Dny se silným větrem (nárazy 60 km/h a víc)', Math.round(c.galeDays) + ' za rok']);
    var notes = [];
    if (c.hotDays >= 6) notes.push('U vás bývá ' + Math.round(c.hotDays) + ' tropických dnů ročně – v tu dobu přidejte zálivku (30 l/m² týdně a víc podle stavu trávníku) a nesekejte nakrátko.');
    if (c.rainYear && c.rainYear < 650) notes.push('Srážek je u vás málo (' + Math.round(c.rainYear) + ' mm za rok) – bez zálivky bude trávník v létě strádat.');
    if (c.galeDays >= 12) notes.push('Často u vás fouká – hnojivo a osivo nerozhazujte ve větru, granule se rozletí nerovnoměrně.');
    return { place: c.place || '', years: c.years, rows: rows, notes: notes, source: c.source || '' };
  }

  // Martin 2026-11-19: „travnik po hnojeni musi vzdycky zalit vodou. bud musi pockat az bude prset nebo aspon hadici.
  // bez vody po hnojeni vzdy hrozi spaleni“ -> platí pro KAŽDOU dávku a KAŽDÉ hnojivo (dřív jen u rychlého, R3).
  var WATER_AFTER = 'Po hnojení trávník vždy zalijte: buď hnojte, když se blíží déšť, nebo ho hned po aplikaci zalijte aspoň hadicí (zhruba 5–6 l/m²). Bez vody po hnojení vždy hrozí spálení.';

  function msg(rule, severity, text) {
    var r = RULES[rule] || {};
    return { rule: rule, severity: severity, text: text, source: r.source || '', confidence: r.confidence || '', approved: !!r.approved };
  }
  // prázdná odpověď ('' / null) = NEZADÁNO, ne nula (jinak by prázdné pole „sečení týdně“ spustilo varování R2)
  function num(v) { if (v === '' || v === null || v === undefined) return NaN; var n = Number(v); return isFinite(n) ? n : NaN; }
  function has(arr, v) { return Array.isArray(arr) && arr.indexOf(v) !== -1; }
  function round1(n) { return Math.round(n * 10) / 10; }

  function decide(a) {
    a = a || {};
    var CP = (typeof window !== 'undefined' && window.MVGreenCarePlan) || null;
    if (!CP) throw new Error('Chybí výpočetní jádro (garden-care.js) – načtěte ho před brain.js.');
    var warnings = [], recs = [], missing = [];

    // --- základní vstupy + co chybí -------------------------------------------------------------------------
    // úroveň: buď přímo z formuláře (a.tier, včetně „sportovní“), nebo z cíle (a.goal)
    var tierIn = ['low', 'standard', 'representative', 'sportovni'].indexOf(a.tier) !== -1 ? a.tier : '';
    var goal = tierIn ? (tierIn === 'representative' || tierIn === 'sportovni' ? 'english' : GOAL_BY_TIER[tierIn]) : (TIER_BY_GOAL[a.goal] ? a.goal : 'family');
    if (!tierIn && !TIER_BY_GOAL[a.goal]) missing.push('goal');
    var requestedTier = tierIn || TIER_BY_GOAL[goal];
    var mode = a.mode === 'thrifty' ? 'thrifty' : 'preventive';
    var areaM2 = num(a.areaM2) > 0 ? num(a.areaM2) : 0;
    if (!areaM2) missing.push('areaM2');
    if (!(num(a.altitude) >= 0)) missing.push('altitude');
    var soilTest = (a.soilTest && typeof a.soilTest === 'object') ? a.soilTest : null;
    var recommendedTier = requestedTier;
    var doseScale = 1;

    // přepočet podle obalu: přijmout jen rozumná čísla (5–100 %), jinak by z překlepu vyšla obří dávka
    var productPct = {};
    if (a.productPct && typeof a.productPct === 'object') {
      Object.keys(a.productPct).forEach(function (k) {
        var p = num(a.productPct[k]);
        if (p >= 5 && p <= 100) productPct[k] = p;
        else if (a.productPct[k] !== '' && a.productPct[k] != null) warnings.push(msg('VSTUP', 'medium', 'Zadaný obsah živiny „' + a.productPct[k] + ' %“ nedává smysl (čekáme 5–100 %), proto počítáme s referenčním složením. Zkontrolujte číslo na obalu.'));
      });
    }

    // --- R1, R2: anglický trávník potřebuje závlahu a časté sečení ------------------------------------------
    if (goal === 'english') {
      if (a.irrigation === 'none') {
        recommendedTier = 'standard';
        warnings.push(msg('R1', 'high', 'Anglický trávník bez závlahy: vysoké dávky dusíku (≈ 35 g/m² za rok) bez vody trávník v suchu spíš poškodí a v létě stejně zežloutne. Doporučujeme běžný rodinný režim, nebo anglický jen se závlahou.'));
      } else if (!a.irrigation) missing.push('irrigation');
      var mpw = num(a.mowPerWeek);
      if (mpw >= 0 && mpw < 1) {
        recommendedTier = 'standard';
        warnings.push(msg('R2', 'high', 'Anglický trávník se v sezóně seče aspoň 1×, spíš 2× týdně. Při řidším sečení hnojení na tuhle úroveň nemá smysl – doporučujeme běžný rodinný režim.'));
      } else if (!(mpw >= 0)) missing.push('mowPerWeek');
    }

    // --- R5: nový trávník -------------------------------------------------------------------------------------
    if (a.age === 'new') {
      warnings.push(msg('R5', 'high', 'Nový trávník (do 1 roku): při výsevu použijte startovací hnojivo s fosforem (nejlépe podle rozboru půdy) a dusíku dávejte nejvýš ≈ 2,5–5 g/m² na jednu aplikaci, víc mladou trávu spálí. Na čerstvě oseté plochy od prosince do března dusík nedávejte. Plán níže berte jako plný až od zaběhnutí trávníku.'));
    } else if (!a.age) missing.push('age');

    // --- R6: stín ------------------------------------------------------------------------------------------------
    if (a.sun === 'shade') {
      doseScale *= 0.5;
      recs.push(msg('R6', 'info', 'Trávník ve stínu: dávky jsou poloviční (stín potřebuje zhruba polovinu dusíku), sekejte o 1,5–2,5 cm výš a hnojte spíš na podzim. Při přísevu volte směs pro stín (kostřavy).'));
    } else if (!a.sun) missing.push('sun');

    // --- R7, R8, R9: rozbor půdy ----------------------------------------------------------------------------------
    var avoid = {};
    if (soilTest) {
      if (HIGH(soilTest.P)) avoid.P = true;
      if (HIGH(soilTest.K)) avoid.K = true;
      if (avoid.P || avoid.K) warnings.push(msg('R8', 'high', 'Rozbor ukazuje vysoký ' + (avoid.P && avoid.K ? 'fosfor i draslík' : avoid.P ? 'fosfor' : 'draslík') + '. Další ' + (avoid.P && avoid.K ? 'P a K' : avoid.P ? 'fosfor' : 'draslík') + ' by se v půdě hromadil a blokoval příjem ostatních živin (trávník pak bývá světlý a řídký, i když se hnojí). Proto plán používá hnojivo bez ' + (avoid.P && avoid.K ? 'P a K' : avoid.P ? 'fosforu' : 'draslíku') + ' se stejným množstvím dusíku. Rozbor zopakujte za 1–2 roky.'));
      if (HIGH(soilTest.pH)) warnings.push(msg('R7', 'high', 'pH je podle rozboru vysoké – nevápnit (vápno pH ještě zvýší).'));
      else if (soilTest.pH === 'nizka') recs.push(msg('R7', 'info', 'pH je podle rozboru nízké – vápnit podle doporučení laboratoře (množství vápence určuje rozbor, ne odhad); na jednu aplikaci nejvýš ≈ 250 g/m², víc rozdělit na dvě. Hašené vápno nepoužívejte (pálí trávu). Změna pH trvá měsíce.'));
      if (soilTest.Mg === 'nizka') recs.push(msg('R8', 'info', 'Hořčík je podle rozboru nízký – volte hnojiva s hořčíkem (MgO).'));
    } else {
      missing.push('soilTest');
      recs.push(msg('R9', 'info', 'Doporučujeme laboratorní rozbor půdy (pH, fosfor, draslík, hořčík). Ukáže, jestli se živiny v půdě nehromadí a jestli je potřeba vápnit – bez něj plán počítá s průměrnou půdou.'));
      if (has(a.problems, 'moss')) recs.push(msg('R7', 'info', 'Mech: příčinou bývá stín, špatný odtok vody, zhutnění, slabá výživa i kyselá půda. Vápnit jen podle rozboru, ne naslepo.'));
    }

    // --- výpočet plánu (schválené kalendáře) ---------------------------------------------------------------------
    var calcTier = requestedTier, grassN = N_BY_GRASS[a.grassType] && N_BY_GRASS[a.grassType][requestedTier];
    if (a.grassType === 'fescue' && grassN) calcTier = 'standard'; // kostřavy: 3–4 dávky místo měsíčních
    var baseIn = {
      areaM2: areaM2, altitude: num(a.altitude) || 0, soil: a.soil, water: a.water, slope: a.slope,
      tier: calcTier, problems: a.problems, lastFertilized: a.lastFertilized, irrigation: a.irrigation,
      fertType: a.fertType, grassType: a.grassType, productPct: productPct, doseScale: doseScale, avoid: avoid,
      planName: a.planName, skipMech: true, mowHeightCm: a.mowHeightCm,
    };
    if (grassN) {
      var nNow = (CP.computeCarePlan(Object.assign({}, baseIn, { doseScale: 1 })).fertTable || []).reduce(function (t, r) { return t + r.nGPerM2; }, 0);
      if (nNow > grassN) {
        baseIn.doseScale = doseScale * grassN / nNow;
        recs.push(msg('R16', 'medium', a.grassType === 'fescue'
          ? 'Kostřavová směs: kostřavy potřebují méně dusíku (zhruba 10–12 g na m² za rok) – při nadbytku řídnou, ustupují jiným trávám a víc je napadá plíseň sněžná. Plán proto hnojí 4× ročně menšími dávkami. Používejte hnojiva s řízeným (pomalým) uvolňováním, ne ledek.'
          : 'Jílková směs: jílek je „hladová tráva“, ale nad ~25 g dusíku na m² za rok už to nepřináší víc – plán dávky drží v této hranici.'));
      }
    }
    var plan = CP.computeCarePlan(baseIn);
    if (plan.tierMeta) plan.tierMeta.label = TIER_LABEL[requestedTier];
    var fertTable = plan.fertTable || [];

    // --- R3: rychlé hnojivo – hranice dusíku na aplikaci ----------------------------------------------------------
    fertTable.forEach(function (r) {
      if ((r.key === 'N' || a.fertType === 'fast') && r.nGPerM2 > 4.9) {
        r.warn = 'Na hranici rozpustného dusíku (≈ ' + String(round1(r.nGPerM2)).replace('.', ',') + ' g N/m²): jen na suchou trávu a hned po aplikaci zalít.';
      }
    });
    if (fertTable.some(function (r) { return r.warn; })) warnings.push(msg('R3', 'medium', 'Rychlé dusíkaté hnojivo: doporučená hranice je ≈ 5 g dusíku na m² na jednu aplikaci. Dávka v tabulce je na její horní hranici (ověřená praxe), proto vždy jen na suchou trávu a hned po aplikaci zalít, jinak hrozí spálení.'));

    // --- R4, R13: typ hnojiva --------------------------------------------------------------------------------------
    if (a.fertType === 'crf') recs.push(msg('R4', 'info', 'Dlouhodobé hnojivo: interval podle štítku (obvykle 8–12 týdnů), ale reálně se živiny uvolňují rychleji, zvlášť v teple – trávník většinu spotřebuje do ~ 2 týdnů. Pro hezký trávník proto i dlouhodobým hnojivem hnojte zhruba každé 4 týdny. Nezačínejte v chladné půdě, poslední dávka nejpozději koncem října.'));
    if (a.fertType === 'organic') recs.push(msg('R13', 'info', 'Organická a organominerální hnojiva mají jiný obsah živin než minerální – dávku proto neodhadujte, opište obsah dusíku z obalu a plán ji přepočítá. Cenu srovnávejte na m² a za gram živiny, ne za pytel.'));

    // --- dosev v září: startovací hnojivo místo dávky z plánu (Martin 2026-11-16) -------------------------------------
    if (requestedTier === 'representative' || requestedTier === 'sportovni' || requestedTier === 'standard') fertTable.forEach(function (r) {
      if (typeof r.half === 'number' && Math.floor(r.half / 2) === 8) r.condition = (r.condition ? r.condition + ' ' : '') + 'Když v září při regeneraci dosíváte, dejte místo této dávky startovací hnojivo s vyšším obsahem fosforu (dávka podle obalu).';
    });

    // --- R10: listopadová dávka -------------------------------------------------------------------------------------
    var last = fertTable[fertTable.length - 1];
    if (last && /listopad/i.test(last.month || '')) {
      last.condition = 'Jen když tráva ještě roste, nemrzne a je suchá – jinak tuhle dávku letos vynechte.';
      recs.push(msg('R10', 'info', 'Poslední dávka v listopadu je podmíněná: jen když tráva ještě roste a půda není zmrzlá. Pozdější hnojení už trávníku nepomůže a dusík se může splachovat.'));
    }

    // --- R17: termín poslední podzimní dávky podle teploty půdy v obci -----------------------------------------------
    // Martin 2026-11-16 („udělej tu novou funkci a dej tam tu teplotu“): podzimní dávka se neřídí jen kalendářem ani jen
    // nadmořskou výškou, ale tím, kdy u zákazníka půda klesá pod 10 °C (průměr posledních let, data obce z pluginu).
    // Video V10 (Svoboda + Exner): v teplejších místech až konec října–listopad, výš dřív; tráva roste, dokud je půda teplá.
    // Vodítko: o půlměsíc po poklesu pod 10 °C (tráva zpomalila, kořeny ještě pracují), nejdřív 2. půlka října a nejpozději
    // 2. půlka listopadu (Martin: „nechat v plánu do listopadu“); od předchozí dávky aspoň 4 týdny. Neschváleno, jistota C.
    var cool = a.climate && Number(a.climate.soilBelow10) > 0 ? Number(a.climate.soilBelow10) : 0;
    // 2026-11-19: jen anglický trávník. U nízké a standardní úrovně R17 posouvala SCHVÁLENOU říjnovou dávku na listopad
    // (zjištěno testem Znojmo/standard) – schválené kalendáře se bez Martina nemění.
    if (last && cool && typeof last.half === 'number' && last.half >= 18 && mode === 'preventive' && (requestedTier === 'representative' || requestedTier === 'sportovni')) {
      var cd = new Date(2025, 0, 1 + Math.round(cool));
      var coolHalf = cd.getMonth() * 2 + (cd.getDate() <= 15 ? 0 : 1);
      var target = Math.max(19, Math.min(21, coolHalf + 1));
      var prev = fertTable.length > 1 ? fertTable[fertTable.length - 2] : null;
      if (prev && typeof prev.half === 'number' && target - prev.half < 2) target = prev.half + 2;
      if (target <= 21 && target !== last.half) {
        var gen = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
        var wh = (target % 2 ? 'Konec ' : 'Začátek ') + gen[Math.floor(target / 2)];
        last.half = target; last.when = wh; last.month = MONTHS_CZ[Math.floor(target / 2)];
      }
      last.condition = (last.condition ? last.condition + ' ' : '') + 'Termín je odvozený od teploty půdy u vás: pod 10 °C klesá v průměru kolem ' + doyLabel(cool) + ' Rozhodující je počasí – dávejte, dokud tráva roste.';
      recs.push(msg('R17', 'info', 'Poslední podzimní dávku máme načasovanou podle toho, kdy u vás půda klesá pod 10 °C (v průměru kolem ' + doyLabel(cool) + ', průměr posledních ' + ((a.climate && a.climate.years) || 5) + ' let). V září se podzimní hnojivo nedává – půda je ještě teplá a trávník má druhé léto; září je na regeneraci. Datum je orientační, vždy se řiďte počasím: tráva roste, nemrzne a je suchá.'));
    }

    // --- R11: úsporný režim ------------------------------------------------------------------------------------------
    var symptomGuide = null;
    if (mode === 'thrifty') {
      symptomGuide = [
        { sign: 'Trávník bledne nebo ztrácí sytou barvu', act: 'Přihnojit rychlým dusíkatým hnojivem, na suchou trávu a hned zalít. Pokud ztrácí barvu už 2–3 týdny po hnojení, přihnojte menší dávkou (rychlorozpustná hnojiva se dají dávat i 2× měsíčně v nižší dávce).' },
        { sign: 'Řídne, přestává být hustý a pružný', act: 'Přihnojit (profil „vyvážené“) a na podzim přisít holá místa.' },
        { sign: 'Sekačka najednou nemá co sbírat (v sezóně)', act: 'Trávníku chybí dusík – přihnojit.' },
        { sign: 'Růžové nebo nahnědlé skvrny (červená nitkovitost)', act: 'Bývá to znak hladovějícího trávníku – přihnojit dusíkem.' },
      ];
      recs.push(msg('R11', 'info', 'Úsporný režim: žádné pevné termíny hnojení. Sledujte trávník podle návodu níže; dávky a hnojiva z tabulky použijte, až se příznaky objeví. Počítejte s tím, že trávník nebude tak sytý jako při pravidelném hnojení.'));
      if (has(a.symptoms, 'pale') || has(a.symptoms, 'thin') || has(a.symptoms, 'slow')) recs.push(msg('R11', 'medium', 'Podle vašeho popisu trávník příznaky hladu už má – přihnojte při nejbližším suchém dni bez mrazu.'));
    }

    // --- R14 pes, R15 plsť ------------------------------------------------------------------------------------------
    if (has(a.use, 'dog')) recs.push(msg('R14', 'info', 'Pes: fleky dělá dusík z moči. Místo, kde pes močil, zalijte co nejdřív (nejpozději do ~8 hodin). Tam, kam pes chodí močit, hnojte méně. Moč lépe snášejí jílek a kostřava rákosovitá než jemné kostřavy. Na „neutralizéry“ moči nespoléhejte, jejich účinek není doložený.'));
    if (has(a.problems, 'thatch')) recs.push(msg('R15', 'info', 'Plsť (vrstva odumřelé trávy nad 1,3 cm): vertikutace hlavně koncem srpna až v září, na jaře až od 10 °C v půdě; aerifikace dutými hroty jednou ročně, nejlépe na podzim (při silném zhutnění dvakrát). V letním vedru ne.'));

    // --- R12: vždy -------------------------------------------------------------------------------------------------------
    recs.unshift(msg('R12', 'info', 'Hnojte jen na suchou trávu (na mokré se granule přilepí a spálí stébla) a nikdy na sníh ani na zmrzlou půdu. ' + WATER_AFTER));
    // zálivka po hnojení u KAŽDÉ dávky (Martin 2026-11-19) – přidává se do podmínky řádku, odtud ji bere kalendář, připomínky i .ics
    fertTable.forEach(function (r) { r.condition = (r.condition || 'Jen na suchou trávu, bez mrazu a sněhu.') + ' ' + WATER_AFTER; });

    // --- doporučená úroveň ------------------------------------------------------------------------------------------------
    if (recommendedTier !== requestedTier) recs.unshift(msg(warnings.some(function (w) { return w.rule === 'R1'; }) ? 'R1' : 'R2', 'high', 'Doporučená úroveň péče: ' + TIER_LABEL[recommendedTier] + ' (zvolili jste ' + TIER_LABEL[requestedTier] + '). Plán je zatím spočítaný pro vámi zvolenou úroveň.'));

    // --- nákup (kg), cena jen když ji zákazník zadal -----------------------------------------------------------------------
    var byKey = {}, prices = (a.prices && typeof a.prices === 'object') ? a.prices : {};
    if (mode === 'preventive') fertTable.forEach(function (r) {
      var k = r.key || 'C';
      if (!byKey[k]) byKey[k] = { key: k, name: r.name, npk: r.npk, look: r.look, kg: 0, doses: 0 };
      byKey[k].kg += r.totalKg || 0; byKey[k].doses++;
    });
    var shopRows = Object.keys(byKey).map(function (k) {
      var s = byKey[k]; s.kg = round1(s.kg);
      var p = num(prices[k]);
      if (p > 0) { s.priceKcKg = p; s.costKc = Math.round(s.kg * p); }
      return s;
    });
    var costTotal = shopRows.reduce(function (t, s) { return t + (s.costKc || 0); }, 0);
    var shopping = { rows: shopRows, costKc: costTotal || null, costPerM2Kc: costTotal && areaM2 ? round1(costTotal / areaM2) : null, pricesFromCustomer: true };

    // --- připomínky (jen pravidelný režim) ---------------------------------------------------------------------------------
    var reminders = mode === 'preventive' ? fertTable.map(function (r) {
      return { when: r.when, text: r.action + ': ' + r.name + ' ' + r.doseG + ' g/m²' + (r.totalKg ? ' (' + r.totalKg + ' kg)' : ''), condition: r.condition || 'Až bude tráva suchá, bez mrazu a sněhu.' };
    }) : [];

    var out = {
      version: '0.1',
      requestedTier: requestedTier, tier: requestedTier, recommendedTier: recommendedTier, tierLabel: TIER_LABEL[requestedTier],
      mode: mode, warnings: warnings, recommendations: recs, plan: plan,
      fertTable: mode === 'preventive' ? fertTable : [], fertTableReference: fertTable,
      symptomGuide: symptomGuide, shopping: shopping, reminders: reminders, missing: missing,
      nPerYear: plan.tierMeta && plan.tierMeta.nRange,
      knowledge: knowledge(a, requestedTier),
      care: { program: careProgram(requestedTier, a), procedures: PROC, regeneration: REGEN, spring: springWindow(a.altitude, a.climate) },
      climate: climateSummary(a.climate),
    };
    out.months = monthPlan(out, a);
    out.verified = VERIFIED;
    out.amount = function (proc) { return amounts(proc, areaM2); };
    return out;
  }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var QLABEL = { soilTest: 'rozbor půdy (nepovinné)', sun: 'slunce na trávníku', age: 'stáří trávníku', mowPerWeek: 'jak často sekáte', irrigation: 'zavlažování', areaM2: 'plocha trávníku', altitude: 'obec (nadmořská výška)', goal: 'úroveň péče' };

  /** HTML s doporučením mozku – vkládá se nad plán (app.js care2Render). Varování první, pak doporučení, příp. návod podle příznaků. */
  function renderAdviceHTML(res) {
    if (!res) return '';
    var item = function (m) { return '<li class="mg-brain-' + esc(m.severity) + '">' + esc(m.text) + '</li>'; };
    // 2026-11-16: dlouhá stěna textu nikdo nečte -> nahoře max. 3 nejdůležitější body (high, pak medium),
    // zbytek pod „Další doporučení“; pravidlo „suchá tráva, bez mrazu a sněhu“ (R12) jako jedna pevná věta.
    var rank = { high: 0, medium: 1, info: 2 };
    var all = res.warnings.concat(res.recommendations).filter(function (m) { return m.rule !== 'R12'; })
      .sort(function (x, y) { return (rank[x.severity] || 2) - (rank[y.severity] || 2); });
    var top = all.filter(function (m) { return m.severity !== 'info'; }).slice(0, 3);
    if (top.length < 3) top = top.concat(all.filter(function (m) { return top.indexOf(m) === -1; }).slice(0, 3 - top.length));
    var rest = all.filter(function (m) { return top.indexOf(m) === -1; });
    var h = '<section class="mg-brain"><h4>🧠 Doporučení k vašemu trávníku</h4>';
    if (top.length) h += '<ul class="mg-brain-warn">' + top.map(item).join('') + '</ul>';
    if (rest.length) h += '<details class="mg-brain-more"><summary>Další doporučení (' + rest.length + ')</summary><ul class="mg-brain-rec">' + rest.map(item).join('') + '</ul></details>';
    h += '<p class="mg-brain-always">Vždy platí: hnojte jen na suchou trávu, nikdy na sníh ani na zmrzlou půdu, a po hnojení vždy zalijte (déšť nebo hadice) – bez vody hrozí spálení.</p>';
    if (res.reminders && res.reminders.length) h += '<p><button type="button" class="mg-primary" id="mg-brain-ics">📅 Přidat připomínky hnojení do kalendáře v mobilu</button><br><small>Stáhne se soubor kalendáře – telefon vás den před každým hnojením upozorní. Nic se nikam neodesílá.</small></p>';
    if (res.symptomGuide) {
      h += '<h4>Kdy přihnojit (úsporný režim)</h4><table class="mg-fert-table"><thead><tr><th>Co vidíte</th><th>Co udělat</th></tr></thead><tbody>' +
        res.symptomGuide.map(function (g) { return '<tr><td>' + esc(g.sign) + '</td><td>' + esc(g.act) + '</td></tr>'; }).join('') +
        '</tbody></table><p class="mg-note">Tabulka hnojení níže vám slouží jako přehled hnojiv a dávek – použijte je, až se příznaky objeví.</p>';
    }
    var miss = (res.missing || []).filter(function (k) { return QLABEL[k] && k !== 'soilTest'; });
    if (miss.length) h += '<p class="mg-note">Plán bude přesnější, když doplníte: ' + miss.map(function (k) { return esc(QLABEL[k]); }).join(', ') + '.</p>';
    if (res.shopping && res.shopping.rows.length) {
      h += '<h4>🛒 Co koupit na celý rok</h4><ul class="mg-brain-shop">' + res.shopping.rows.map(function (s) {
        return '<li><strong>' + esc(s.name) + '</strong> – celkem ' + String(s.kg).replace('.', ',') + ' kg (' + s.doses + '× za rok)' + (s.costKc ? ', ≈ ' + s.costKc + ' Kč' : '') + '<br><small>' + esc(s.look) + '</small></li>';
      }).join('') + '</ul><p class="mg-note">Značku i obchod si vyberte sami – rozhoduje složení na obalu. Když má vaše hnojivo jiné složení, dávka se přepočítá.</p>';
    }
    if (res.care && res.care.program.length) {
      h += '<h4>🌱 Údržba trávníku během roku</h4><table class="mg-fert-table"><thead><tr><th>Zásah</th><th>Jak často</th><th>Kdy</th></tr></thead><tbody>' +
        res.care.program.map(function (p) { return '<tr><td><strong>' + esc(PROC[p.proc].title) + '</strong>' + (p.note ? '<br><small>' + esc(p.note) + '</small>' : '') + '</td><td>' + esc(p.freq) + '</td><td>' + esc(p.when) + '</td></tr>'; }).join('') +
        '</tbody></table><p class="mg-note">Vše mechanické jen při půdě alespoň 10 °C, nikdy ve vedru ani na mokrém či zmrzlém trávníku.</p>';
      h += res.care.program.map(function (p) { var d = PROC[p.proc]; return '<details class="mg-brain-more"><summary>Postup: ' + esc(d.title) + '</summary><p><small>' + esc(d.why) + '</small></p><p><small><strong>Nářadí:</strong> ' + esc(d.tools) + '</small></p><ol>' + d.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol><p><small><strong>Nedělat:</strong> ' + esc(d.avoid) + '</small></p></details>'; }).join('');
      if (res.tier === 'representative' || res.tier === 'sportovni') h += '<details class="mg-brain-more"><summary>Velká podzimní regenerace – pořadí kroků</summary><ol>' + res.care.regeneration.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></details>';
    }
    var K = res.knowledge;
    if (K) {
      var li = function (t) { return '<li>' + esc(t) + '</li>'; };
      var prob = function (p) { return '<details class="mg-brain-more"><summary>' + esc(p.name) + '</summary><p><small><strong>Kdy:</strong> ' + esc(p.when) + '<br><strong>Jak poznat:</strong> ' + esc(p.sign) + '</small></p><p><strong>Prevence:</strong> ' + esc(p.prevent) + '</p><p><strong>Co dělat:</strong> ' + esc(p.fix) + '</p></details>'; };
      if (K.myProblems.length) h += '<h4>🩺 Vaše problémy a jak je řešit</h4>' + K.myProblems.map(prob).join('');
      if (K.newLawn) h += '<h4>🌱 Nový trávník</h4><ul>' + K.newLawn.map(li).join('') + '</ul>';
      h += '<details class="mg-brain-more"><summary>✂️ Sečení</summary><ul>' + K.mow.map(li).join('') + '</ul></details>';
      h += '<details class="mg-brain-more"><summary>💧 Zálivka</summary><ul>' + K.water.map(li).join('') + li(K.newSeed) + '</ul></details>';
      h += '<details class="mg-brain-more"><summary>📅 Návyky během roku</summary><ul>' + K.tips.map(function (t) { return '<li><strong>' + esc(t.when) + ':</strong> ' + esc(t.text) + '</li>'; }).join('') + '</ul></details>';
      h += '<details class="mg-brain-more"><summary>📖 Průvodce chorobami, plevelem a škůdci (' + K.allProblems.length + ')</summary>' + K.allProblems.map(prob).join('') + '</details>';
    }
    return h + '</section>';
  }

  /** Kalendář (.ics) s připomínkami hnojení – „aplikace, která zákazníka upozorní“ bez aplikace (Martin 2026-11-16).
   * Každá dávka = celodenní událost v termínu z plánu (začátek měsíce = 1., konec = 16.), upozornění den předem v 8:00.
   * Termín, který letos už proběhl, se dá na příští rok. Vše se počítá v prohlížeči, nic se neodesílá. */
  function buildICS(res, now) {
    now = now || new Date();
    var rows = (res && res.mode === 'preventive' ? res.fertTable : []) || [];
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var ymd = function (d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };
    var CRLF = String.fromCharCode(13, 10), BS = String.fromCharCode(92);
    // RFC 5545: v textu escapovat zpětné lomítko, středník, čárku a nový řádek
    var LF = String.fromCharCode(10);
    var tx = function (t) { return String(t || '').split(BS).join(BS + BS).split(';').join(BS + ';').split(',').join(BS + ',').split(CRLF).join(BS + 'n').split(LF).join(BS + 'n'); };
    // skládání řádků po max. 73 bajtech UTF-8 (norma 75; čeština má 2bajtové znaky)
    var fold = function (line) { var out = [], cur = '', n = 0; for (var k = 0; k < line.length; k++) { var ch = line[k], cb = unescape(encodeURIComponent(ch)).length; if (n + cb > 73) { out.push(cur); cur = ' '; n = 1; } cur += ch; n += cb; } out.push(cur); return out.join(CRLF); };
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + '00Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MVGreen//Rocni plan pece o travnik//CS', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Hnojení trávníku (MVGreen)'];
    rows.forEach(function (r, i) {
      if (typeof r.half !== 'number') return;
      var month = Math.floor(r.half / 2), day = r.half % 2 ? 16 : 1;
      var d = new Date(today.getFullYear(), month, day);
      if (d < today) d = new Date(today.getFullYear() + 1, month, day);
      var end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      var desc = r.action + '. ' + r.name + ': ' + r.doseG + ' g/m²' + (r.totalKg ? ' (celkem ' + String(r.totalKg).replace('.', ',') + ' kg)' : '') + '. ' +
        (r.condition || 'Jen na suchou trávu, bez mrazu a sněhu – jinak počkejte na první vhodný den.') + (r.warn ? ' ' + r.warn : '') + ' ' + (r.look || '');
      L.push('BEGIN:VEVENT', 'UID:mvgreen-' + ymd(d) + '-' + i + '@mvgreen.cz', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd(d), 'DTEND;VALUE=DATE:' + ymd(end),
        fold('SUMMARY:' + tx('Hnojení trávníku – ' + r.name)), fold('DESCRIPTION:' + tx(desc)), 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + tx('Zítra hnojení trávníku: ' + r.name + ' ' + r.doseG + ' g/m²')), 'TRIGGER:-PT16H', 'END:VALARM', 'END:VEVENT');
    });
    // připomínky péče o drn (měsíčně propichování, vyčesání, vertikutace/regenerace) – den předem v 8:00
    var mechEv = [];
    (res && res.care ? res.care.program : []).forEach(function (p) {
      var t = PROC[p.proc].title;
      if (p.proc === 'propich' && /měsíc/.test(p.freq)) [3, 4, 5, 6, 7, 8, 9].forEach(function (m) { mechEv.push([m, 10, t]); });
      else if (p.proc === 'vycesani' && /2 měsíce/.test(p.freq)) [4, 6, 8].forEach(function (m) { mechEv.push([m, 20, t]); });
      else if (p.proc === 'vertikutace') { mechEv.push([res.care.spring.month, res.care.spring.day, t + ' (jaro, půda 10 °C)']); if (/2×|1–2×/.test(p.freq)) mechEv.push([7, 25, t + ' (podzim)']); }
      else if (p.proc === 'dute') mechEv.push([8, 1, 'Podzimní regenerace: ' + t + ', pískování, dosev']);
      else if (p.proc === 'scalping' && !res.care.program.some(function (q) { return q.proc === 'dute'; })) mechEv.push([8, 1, 'Podzimní regenerace: scalping, vertikutace, dosev, pískování']);
    });
    mechEv.forEach(function (e, i) {
      var d = new Date(today.getFullYear(), e[0], e[1]); if (d < today) d = new Date(today.getFullYear() + 1, e[0], e[1]);
      var end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      L.push('BEGIN:VEVENT', 'UID:mvgreen-drn-' + ymd(d) + '-' + i + '@mvgreen.cz', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd(d), 'DTEND;VALUE=DATE:' + ymd(end),
        fold('SUMMARY:' + tx('Trávník – ' + e[2])), fold('DESCRIPTION:' + tx('Postup najdete ve svém plánu. Jen při půdě alespoň 10 °C, ne ve vedru, ne na mokrém trávníku.')), 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + tx('Zítra: ' + e[2])), 'TRIGGER:-PT16H', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join(CRLF) + CRLF;
  }

  var api = { decide: decide, renderAdviceHTML: renderAdviceHTML, buildICS: buildICS, PROC: PROC, QUESTIONS: QUESTIONS, RULES: RULES, GOAL_BY_TIER: GOAL_BY_TIER };
  if (typeof window !== 'undefined') window.MVGreenBrain = api;
})();
