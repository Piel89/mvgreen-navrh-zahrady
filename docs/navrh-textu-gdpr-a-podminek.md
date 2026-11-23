# Návrh doplnění zásad ochrany osobních údajů a obchodních podmínek (23. 11. 2026)

**Tohle není právní posouzení.** Je to návrh vět, které chybí podle toho, co plán a platba opravdu dělají v kódu. Před zveřejněním je projděte vy nebo právník. Nic z toho jsem nezveřejnil.

Co kód dělá (ověřeno čtením `payments.php`, `plan-page.js`, `travnik.php`):
- Při zahájení platby se k objednávce uloží e-mail kupujícího a odpovědi z dotazníku (plocha, půda, slunce, závlaha, sečení, problémy, obec, podnebí), nejvýš 4 000 znaků.
- Po zaplacení se na e-mail pošle kód a odkaz.
- Platbu zpracovává Stripe. Údaje o kartě webu nikdy neprojdou.
- Výpočet plánu běží v prohlížeči kupujícího, nic se nikam neposílá.
- Podnebí se bere z dat uložených na serveru, žádné volání ven.

## A. Zásady ochrany osobních údajů: co doplnit

### A1. Nový řádek do tabulky v bodě 2 („Jaké údaje zpracováváme a proč“)
| Kdy | Jaké údaje | Proč a na jakém základě |
|---|---|---|
| Nákup ročního plánu péče o trávník nebo AI návrhu | e-mail, údaje o trávníku zadané v dotazníku (plocha, půda, slunce, závlaha, způsob sečení, potíže trávníku, obec), částka a stav platby, přístupový kód | dodání zakoupeného digitálního obsahu, plnění smlouvy (čl. 6 odst. 1 písm. b GDPR); doklady o platbě – zákonná povinnost (písm. c) |

### A2. Doplnit do bodu 3 („Jak dlouho údaje uchováváme“)
> Objednávky digitálního obsahu (e-mail, odpovědi z dotazníku, přístupový kód): po dobu platnosti přístupu k zakoupenému plánu a poté [ROZHODNOUT: 12 / 36 měsíců] kvůli reklamacím; účetní doklady 10 let, jak ukládají předpisy. Na vaši žádost údaje vymažeme dřív, pokud nám je nebude třeba uchovat ze zákona.

### A3. Doplnit do bodu 4 („Komu údaje předáváme“)
> - Stripe Payments Europe, Ltd. (Irsko), provozovatel platební brány: zpracovává platbu; číslo karty nevidíme a neukládáme. Stripe může údaje předávat mimo EU, což se řídí standardními smluvními doložkami nebo rozhodnutím o odpovídající ochraně.
> - [Poskytovatel umělé inteligence, který zpracovává fotografie u AI návrhu zahrady, např. Google a/nebo OpenAI – DOPLNIT podle toho, co se opravdu používá] – jen u AI návrhu zahrady, jen na fotografii a popis, které sami nahrajete.

Poznámka: v kódu jsou volání OpenAI i Google (`architekt.php`, `plan.php`). Je třeba rozhodnout, které se při ostrém provozu opravdu použijí, a uvést jen ty.

### A4. Bez změny
Roční plán nepoužívá automatizované rozhodování ani profilování o osobě. Odpovědi z dotazníku slouží jen k výpočtu plánu a v prohlížeči zákazníka se z nich nic neposílá třetím stranám. Tuto větu doporučuju přidat výslovně.

## B. Obchodní podmínky: co doplnit

### B1. Doba platnosti přístupu (nový odstavec v čl. 5)
Dnes e-mail slibuje „kód platí po celý rok“, podmínky nic neříkají a kód v systému nevyprší. Rozhodnout jednu z variant:
- **Varianta 1 (jednoduchá):** „Přístup k zakoupenému plánu platí po dobu [12 měsíců] od zaplacení. Plán si můžete kdykoli vytisknout nebo uložit.“ Pak musí kód skutečně vypršet (dnes nevyprší, je třeba kód upravit), nebo se věta mění.
- **Varianta 2:** „Přístup platí bez časového omezení, dokud plán na webu provozujeme. Pokud bychom službu ukončili, upozorníme vás e-mailem alespoň 30 dnů předem a umožníme vám plán uložit.“ Doporučuju tuto, protože odpovídá dnešnímu stavu kódu.

### B2. Rozsah odpovědnosti (nový odstavec v čl. 2 nebo 6)
> Plán vychází z údajů, které jste zadali, a z obecných doporučení pro české podmínky. Skutečný stav půdy, počasí a odrůdy trávy se mohou lišit. Dávky hnojiv a postupy je nutné vždy porovnat s návodem na obalu přípravku. Za škodu vzniklou nesprávným použitím hnojiva nebo přípravku odpovídá ten, kdo je používá; naše odpovědnost se řídí zákonem. [PRÁVNÍK: formulaci posoudit]

### B3. Způsob úhrady
Podmínky uvádějí „výhradně Stripe“. V kódu je i GoPay. Pokud GoPay nepoužijete, nechte text; pokud ano, přepište.

### B4. Zdroje dat (do patičky nebo „O plánu“)
> Podnebí: průměr posledních let ze služby Copernicus Climate Change Service (ERA5-Land, CC BY 4.0), obsahuje upravené údaje. Obce a jejich poloha: GeoNames (geonames.org), CC BY 4.0.
(Už je doplněno do poznámky pod podnebím v dotazníku.)

## C. Co z toho musí rozhodnout majitel

1. Jak dlouho se uchovávají objednávky (12 nebo 36 měsíců).
2. Varianta platnosti přístupu (B1).
3. Který poskytovatel AI se uvede (A3).
4. Zda jde text právníkovi.

## D. Poloha zařízení (nové tlačítko „Použít polohu tohoto zařízení“, 23. 11. 2026)
Do zásad doplnit například:
> Pokud v plánu kliknete na „Použít polohu tohoto zařízení“, váš prohlížeč se zeptá na povolení. Souřadnice (zaokrouhlené na zhruba 100 metrů) se odešlou jen na náš server, který podle nich určí nejbližší obec a podnebí. Souřadnice neukládáme ani neprodáváme a třetím stranám je nepředáváme. Bez povolení polohy můžete obec zadat ručně.
Ověřeno v kódu (`travnik.php`, `mvgreen_climate_geo_handle`): souřadnice se nikam neukládají ani nelogují.
