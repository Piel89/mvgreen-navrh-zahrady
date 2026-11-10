# Katalog rostlin AI architekta v2

Zdroj pravdy pro všechny rostliny, které AI architekt (v2) smí navrhnout. Plugin nečte tyto
soubory přímo – skript z nich vyrobí `mvgreen-navrh-zahrady/assets/v2/plants-catalog.js`.

Vznik: 2026-11-10 na pokyn majitele („nemůžeme to dělat z 33… aspoň 1000 trav, keřů, stromů,
kytek“). Základ tvoří 162 ověřených druhů z dřívějšího `plants-curated.js` (soubor `trvalky.txt`,
`kere.txt`, `travy.txt`, `jehlicnany.txt`), zbytek doplněn podle běžné nabídky českých školek.
Údaje jsou **orientační** (pro návrh a péči, ne pro realizační projekt).

## Postup

```
node scripts/build-plants.js --check   # kontrola tabulek (duplicity, kódy, výšky proti katalogu 805)
node scripts/plant-photos.js           # předvýběr fotek z Wikimedia Commons → data/plant-photos.json
node scripts/build-plants.js           # zápis plants-catalog.js (s fotkami)
```

Fotky kontroluje majitel v přehledové stránce. Zamítnutá fotka dostane v `plant-photos.json`
`"status": "rejected"`; další běh `plant-photos.js` pro ni najde jinou (zamítnuté soubory si pamatuje).
Schválená má `"status": "ok"` a skript ji už nemění.

## Formát řádku

`název|latinsky|typ|role|výška|spon|slunce|voda|květ|list|kvetení|příznaky` – řádky s `#` jsou komentáře.

| sloupec | hodnoty |
| --- | --- |
| typ | `p` trvalka, `g` tráva, `lg` nízká tráva, `k` keř, `j` jehličnan, `s` strom, `c` popínavá, `b` cibulovina |
| role | `b` dozadu, `m` doprostřed, `f` dopředu (lem); `t` strom, `c` popínavá, `bu` cibulovina – tyto tři se do záhonů automaticky nevybírají |
| výška, spon | metry (dospělá výška; spon = vzdálenost výsadby) |
| slunce | kombinace `S` slunce, `P` polostín, `T` stín (např. `SP`) |
| voda | kombinace `D` sucho, `N` běžná, `W` vlhko |
| květ | kód barvy nebo `#RRGGBB`, `-` = nekvete okrasně |
| list | kód barvy listu |
| kvetení | `6-9` = červen–září, `12-3` přes zimu, `-` = bez okrasného kvetení (stálezelené nemají „kvetení celý rok“) |
| příznaky | `t` trny, `e` stálezelená, `x` jedovatá (děti/zvířata), `a` potřebuje kyselou půdu, `i` rozpíná se / invazní sklon, `v` do vlhka/k jezírku; `-` = žádné |

Barvy květu: `fi` fialová, `mo` modrá, `sv` světle modrá, `la` levandulová, `bi` bílá, `kr` krémová,
`ru` růžová, `sr` světle růžová, `ma` purpurová, `cv` červená, `vi` vínová, `or` oranžová, `zl` žlutá,
`sz` světle žlutá, `ze` zelená, `hn` hnědá, `si` stříbrná.
Barvy listu: `z` zelená, `tz` tmavě zelená, `bz` sytě zelená, `sz` šedozelená, `si` stříbrná,
`mz` modrozelená, `zl` zlatá, `cv` purpurová/červená, `pe` panašovaná (pestrá), `or` oranžová, `hn` hnědá, `ma` růžová.

Automatický výběr do záhonů (`pickPlants` v `architekt.js`) vynechává příznaky `a` a `i` vždy
a `t`, `x` u rodin s dětmi nebo psem.
