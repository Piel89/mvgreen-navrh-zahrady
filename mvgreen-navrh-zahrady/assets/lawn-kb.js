/*
 * MVGreen – znalosti pro celoroční péči o trávník (v0.1, 2026-11-16).
 *
 * Martin (2026-11-16): „všechny znalosti co máš nebo najdeš pro starost a péči o trávník po celý rok do toho přidej –
 * to je to gro“; „musíme mít řešení na všechny choroby (lipnice, plíseň sněžná, ježatka…), když je rosa, ráno stahovat“.
 * Obsah = vlastními slovy z interní znalostní báze (Martinova praxe, univerzitní doporučení, videa R. Svobody
 * a J. Exnera). Žádné značky přípravků: chemii jen „registrovanou v ČR pro trávník, podle etikety“ (Martin: bez značek;
 * přípravky z videí nejsou vždy v ČR pro trávník registrované).
 * Používá brain.js (decide → res.knowledge). Export: window.MVGreenLawnKB = { MOW, WATER, PROBLEMS, SEASON_TIPS }
 */
(function () {
  'use strict';

  /** Sečení. Martin: výšku volí zákazník; ve vedru nesekat nakrátko; nový trávník do ~10 cm, pak po ⅓. */
  var MOW = {
    rules: [
      'Sekejte na výšku, kterou chcete mít, ale nikdy neuberte víc než třetinu stébla najednou. Sekejte tedy ve chvíli, kdy tráva naroste zhruba o polovinu nad cílovou výšku.',
      'V horku a suchu nesekejte nakrátko: nechte stéblo delší, o 1–2 cm podle druhu trávy.',
      'Nůž udržujte ostrý (naostřit před sezónou a v jejím průběhu znovu) – tupý nůž stébla trhá a natržené konce snáz chytají choroby.',
      'Nesekejte mokrou trávu.',
      'Posečenou hmotu v době, kdy kvete lipnice roční (květen–červen, září), sbírejte do koše – omezíte její semena.',
      'Poslední seč na podzim na běžnou výšku, nenechávejte do zimy dlouhou trávu (plíseň sněžná).',
    ],
    newLawn: [
      'Nový trávník nechte dorůst zhruba do 10 cm, teprve pak poprvé sekejte.',
      'Pak výšku postupně snižujte vždy o třetinu, až se dostanete na požadovanou výšku.',
      'Pozor: brzké sečení rotační sekačkou vysaje semena, která se ještě neuchytila.',
      'První rok žádnou vertikutaci ani aerifikaci, jen sečení a dosev holých míst.',
    ],
    mowerNote: {
      reel: 'Vřetenová sekačka stříhá jako nůžky a jde nízko – nejlepší pro jemné kostřavy a anglický trávník.',
      rotary: 'Rotační sekačka: jemné kostřavy nesnesou nízký střih, držte vyšší výšku.',
      robot: 'Robotická sekačka seče často a málo – vhodné pomalu rostoucí druhy; trávník vyčesávejte častěji (ideálně co 14 dní), jinak se tvoří plsť.',
    },
  };

  /** Zálivka – ověřeno (Iowa State, Idaho, MSU, UC IPM, Cornell, Purdue). */
  var WATER = {
    rules: [
      // Martin 2026-11-16 (vlastní praxe): běžné počasí 10 l/m² týdně, v tropech 15 l/m² týdně, když trávník pořád strádá, přidat; brzy ráno 5–7 h, 2× týdně, v extrémním počasí obden, při žloutnutí přidat.
      // 2026-11-19/20 Martin: „zálivku zvyš“ (průzkum zdrojů: CZ 20–40 l/m² týdně, medián ≈ 27; na jednu zálivku medián 12,5 l) -> 20 / 30 l, ve 2 zálivkách po ~10 l.
      'Za běžného počasí zhruba 20 litrů na m² za týden (2 zálivky po asi 10 litrech), v tropických dnech 30 litrů na m² za týden (včetně deště). Sledujte trávník – když pořád žloutne nebo vadne, přidejte.',
      'Zalévejte brzy ráno, nejlépe mezi 5. a 7. hodinou. Večerní a odpolední zálivka podporuje plísně.',
      'Běžně 2× týdně, v extrémním horku a suchu až obden (menší dávky po 10–15 litrech). Déšť se počítá – po vydatném dešti zálivku vynechte.',
      'Chcete-li vědět, jestli je zálivka dost: po zálivce vykopněte kousek drnu – půda má být vlhká do 10–15 cm. Nebo šlápněte na trávník: když se stébla nevzpřímí, chce vodu.',
      'Vydatně a méně často je lepší než každý den trochu: kořeny jdou hlouběji a méně se daří lipnici roční.',
      'Kolik vám zálivka dává, změříte plechovkou nebo kelímkem postaveným na trávníku.',
      'Na svahu a utužených místech zalévejte po menších dávkách, ať voda nestéká; předtím pomůže propíchnout.',
    ],
    none: 'Bez zálivky trávník v létě zežloutne a zastaví růst. Je to obranná reakce, po dešti se zazelená. V té době nehnojte a nesekejte nakrátko.',
    newSeed: 'Po výsevu a dosevu udržujte povrch stále vlhký: krátká zálivka 2–3× denně asi 10 dní, pak postupně přejděte na vydatnější a řidší.',
  };

  /**
   * Choroby, plevele, škůdci a problémy. sign = jak poznat, when = kdy, prevent = prevence, fix = co dělat.
   * key = vazba na dotazník (problems) – to, co zákazník zaškrtne, se mu ukáže nahoře.
   */
  var PROBLEMS = [
    { key: 'dollarspot', name: 'Dolarová skvrnitost', when: 'druhá polovina léta, horké dny i noci, často po bouřce',
      sign: 'malá suchá kolečka velikosti mince, později splývají; ráno na nich bývá pavučinka',
      prevent: 'Ráno stáhněte rosu (hadicí, lanem, koštětem) – prokazatelně snižuje počet ohnisek. Hnojte pravidelně, hladový trávník je náchylnější. Zalévejte jen ráno.',
      fix: 'Vertikutace a vyhrabání postižených míst, přihnojit dusíkem. Chemické ošetření jen přípravkem registrovaným v ČR pro trávník, podle etikety.' },
    { key: 'redthread', name: 'Červená nitkovitost', when: 'celá sezóna, vlhké počasí',
      sign: 'suché flíčky, růžové „vatové“ vlákno a červené konce stébel',
      prevent: 'Pravidelné hnojení dusíkem – objevuje se hlavně u hladovějícího trávníku. Méně plsti, ranní zálivka.',
      fix: 'Pohnojit dusíkem; trávník obvykle doroste.' },
    { key: 'snowmold', name: 'Plíseň sněžná (fusárium)', when: 'podzim a zima, i bez sněhu (při chladu do ~15 °C a vlhku)',
      sign: 'hnědé až rezavé fleky, za vlhka bílé nebo růžové vlákno, stébla slepená, voní houbami; často pod listím a ve stínu',
      prevent: 'Hrabejte nebo vyfoukejte listí, nenechávejte na trávníku nic ležet. Ráno stahujte rosu. Poslední seč na běžnou výšku, ne dlouhou. Na podzim ne rychlý dusík na poslední chvíli. Do zimy hustý, vyživený trávník.',
      fix: 'Postižená místa vyhrabat; doroste až na jaře, pak případně dosít. Chemii univerzity pro domácí trávník nedoporučují (většina případů odroste); přípravek proti chorobám trávníku pro domácnosti jsme v ČR nenašli.' },
    { key: 'drypatch', name: 'Suchá skvrnitost', when: 'léto, vedro a sucho',
      sign: 'suchý flek, půda je tak tvrdá, že ji nepropíchnete; u obrubníků, fasád, na kopečcích',
      prevent: 'Pravidelné propichování, zálivka ráno, nesekat nakrátko v horku.',
      fix: 'Opakovaně propíchnout a zalévat menšími dávkami, klidně týden; pomůže smáčedlo.' },
    { key: 'fairyring', name: 'Čarodějné kruhy', when: 'léto',
      sign: 'kruh tmavě zelené nebo naopak suché trávy, někdy houby',
      prevent: 'Propichování, rovnoměrná zálivka a výživa.',
      fix: 'Malé kruhy propíchat, důkladně zavodnit, smáčedlo. Úplně se jich zbavit nejde (univerzity: spolehlivá kontrola neexistuje), držte je zavlažováním, propichováním a výživou.' },
    { key: 'rust', name: 'Rez a listové skvrnitosti', when: 'sezóna, hlavně u jílků a lipnic',
      sign: 'žluté až oranžové skvrny na listech, oranžový prášek na botách a rukou',
      prevent: 'Vyvážená výživa, nenechat trávník hladovět, ranní zálivka.',
      fix: 'Přihnojit, pravidelně sekat a sbírat hmotu; obvykle odroste.' },
    { key: 'poa', name: 'Lipnice roční', when: 'nejvíc vidět koncem května až v červnu a v září, kvete skoro celý rok',
      sign: 'světlejší zelené trsy s bělavými klásky, i při nízké seči',
      prevent: 'Hustý trávník, který ji vytlačí. Vydatná a řidší zálivka místo denního kropení. Odstraňovat utužení (propichování). Brzy na jaře nehnat trávník dusíkem. Dosévat holá místa.',
      fix: 'Zcela se jí zbavit nejde, jen ji držet na uzdě. Malé trsy vytrhat. V době květu sbírat posečenou hmotu. Chemie na lipnici je jen pro profesionály, plán ji nedoporučuje.' },
    { key: 'crabgrass', name: 'Ježatka kuří noha', when: 'klíčí od května, když půda drží kolem 13–15 °C; roste v létě',
      sign: 'široké světlé trsy plazivé trávy, v létě rychle rostou, na podzim hynou a zbudou holá místa',
      prevent: 'Hustý trávník bez holých míst na jaře, holá místa dosít na podzim, nesekat nakrátko.',
      fix: 'Mladé rostliny vytrhat i s kořenem, dřív než vykvetou. Chemii jen registrovanou v ČR pro trávník a domácí použití, podle etikety (některé přípravky z internetu u nás pro trávník registrované nejsou).' },
    { key: 'weeds', name: 'Dvouděložné plevele (pampeliška, jetel, sedmikráska…)', when: 'jaro a začátek léta',
      sign: 'listy, které nejsou tráva',
      prevent: 'Hustý trávník a správná výška seče.',
      fix: 'Vytrhávat, nebo lokálně selektivním herbicidem pro trávník (registrovaným v ČR), ideálně v květnu–červnu. Nechte trávník předtím trochu odrůst; odstup od hnojení a sečení řiďte etiketou přípravku.' },
    { key: 'moss', name: 'Mech', when: 'hlavně jaro a podzim',
      sign: 'zelený nebo hnědý měkký koberec mezi travou',
      prevent: 'Mech je příznak: stín, utužená nebo podmáčená půda, slabá výživa, kyselá půda. Řešte příčinu.',
      fix: 'Vyhrabat nebo vertikutovat (až při 10 °C v půdě), hnojivo se železem, propichování, dosev. Vápnit jen podle rozboru půdy.' },
    { key: 'grubs', name: 'Ponravy (larvy chroustů)', when: 'konec léta a podzim',
      sign: 'trávník se dá zvednout jako koberec, pod ním bílé larvy; ptáci a divočáci trávník rozhrabávají',
      prevent: 'Koncem léta zkusit na podezřelých místech nadzvednout trávník.',
      fix: 'Biologicky hlísticemi do vlhké a teplé půdy, nebo přípravkem registrovaným v ČR proti ponravám podle etikety; poškozená místa dosít.' },
    { key: 'dog', name: 'Fleky od psa', when: 'kdykoliv',
      sign: 'suchý střed se sytě zeleným okrajem',
      prevent: 'Místo zalít do pár hodin (nejpozději do ~8 hodin). Tam, kam pes chodí, hnojit méně. Naučit psa (hlavně fenu) chodit na štěrk nebo kůru.',
      fix: 'Vyhrabat, dosít, udržovat vlhko.' },
    { key: 'thatch', name: 'Plsť', when: 'postupně, hlavně u kostřav a při vysoké seči',
      sign: 'houbovitá hnědá vrstva mezi zemí a zelenými stébly, víc než ~1,3 cm',
      prevent: 'Pravidelné vyčesávání, propichování, nepřehnojovat.',
      fix: 'Vertikutace (hlavně konec srpna–září), aerifikace, pískování.' },
  ];

  /** Celoroční návyky – co dělat pravidelně (Martin: ráno stahovat rosu). */
  var SEASON_TIPS = [
    { when: 'Celá sezóna', text: 'Když je ráno rosa, stáhněte ji (hadicí taženou přes trávník, lanem nebo koštětem). Tráva rychleji oschne a méně ji napadají plísně.' },
    { when: 'Červenec–srpen', text: 'Ráno za rosy projděte trávník a hledejte pavučinky – mycelium plísní je vidět jen ráno.' },
    { when: 'Podzim', text: 'Listí hrabejte nebo foukejte průběžně, ne až na konci podzimu.' },
    { when: 'Zima', text: 'Po zmrzlém nebo zasněženém trávníku nechoďte a nedávejte na něj hromady sněhu ani listí.' },
    { when: 'Únor–březen', text: 'Naostřete nůž sekačky, zkontrolujte rozmetadlo a vertikutátor.' },
  ];

  var api = { MOW: MOW, WATER: WATER, PROBLEMS: PROBLEMS, SEASON_TIPS: SEASON_TIPS };
  if (typeof window !== 'undefined') window.MVGreenLawnKB = api;
})();
