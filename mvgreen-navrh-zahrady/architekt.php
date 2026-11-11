<?php
/**
 * MVGreen AI architekt v2 – nový průvodce a výstup (přestavba podle schváleného návrhu vzhledu,
 * 2026-11-08). Běží vedle původního [mvgreen_navrh_zahrady] na samostatné zkušební stránce
 * (soukromá / chráněná heslem), dokud neprojde 5 návrhů po sobě bez chyby.
 *
 * Shortcode: [mvgreen_ai_architekt]                 – celý průvodce (fotka → … → 11stránkové PDF)
 *            [mvgreen_ai_architekt ukazka="1" pred="URL" po="URL"] – jen ukázkový výkres
 * Fotky z ukázky se zadávají z knihovny médií – do pluginu (veřejný repozitář) se fotky zákazníků
 * nikdy neukládají.
 *
 * Znovu používá ověřené moduly původního návrháře: ai-safety.js (příprava fotky, ochrana toho,
 * co má zůstat, oprava výsledku), mg-paint-mask.js (označení štětcem), catalog-805.js, a serverová
 * volání mvgreen_ai_preview_start/_step (generování), mvgreen_ai_plan (půdorys z výsledku)
 * a mvgreen_ai_plant_facts (údaje o rostlinách a koncept).
 */
if (!defined('ABSPATH')) exit;

/**
 * Půdorys v2 (2026-11-08, Martin po 1. testu: „záhon u plotu není u plotu, 4/11 má úplně špatné
 * parametry“). Původní mvgreen_ai_plan četl jen výslednou fotku do mřížky 0–100 s domem vždy
 * nahoře – u zahrady s domem vpravo a plotem vlevo pak plán neodpovídal skutečnosti. Tahle verze:
 * dostane fotku PŘED s vyznačením toho, co zůstává, fotku PO, rozložení zahrady od zákazníka
 * (kde je dům, plot, kam je fotka focená, známá délka) a vrací souřadnice rovnou v METRECH
 * z pohledu fotografa (x zleva doprava, y od fotografa dozadu). Silnější model kvůli přesnosti.
 */
function mvgreen_plan_v2_schema() {
    $num = ['type' => 'number'];
    return [
        'type' => 'object', 'additionalProperties' => false,
        'required' => ['width_m', 'depth_m', 'elements', 'notes'],
        'properties' => [
            'width_m' => $num, 'depth_m' => $num, 'notes' => ['type' => 'string'],
            'elements' => ['type' => 'array', 'items' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => ['type', 'label', 'is_new', 'points', 'width_m', 'plants'],
                'properties' => [
                    'type' => ['type' => 'string', 'enum' => ['house', 'terrace', 'paving', 'gravel', 'lawn', 'bed', 'path', 'stepping', 'steps', 'fence', 'wall', 'hedge', 'tree', 'shrub', 'structure']],
                    'label' => ['type' => 'string'],
                    'is_new' => ['type' => 'boolean'],
                    'points' => ['type' => 'array', 'items' => ['type' => 'array', 'items' => $num]],
                    'width_m' => $num,
                    'plants' => ['type' => 'array', 'items' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['name', 'count'], 'properties' => ['name' => ['type' => 'string'], 'count' => ['type' => 'integer']]]],
                ],
            ]],
        ],
    ];
}
add_action('wp_ajax_mvgreen_ai_plan_v2', function () {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Zatím jen pro správce.'], 403);
    if (!defined('MVGREEN_OPENAI_API_KEY') || !MVGREEN_OPENAI_API_KEY) wp_send_json_error(['message' => 'Chybí MVGREEN_OPENAI_API_KEY.'], 400);
    $img = function ($k) {
        $v = isset($_POST[$k]) ? wp_unslash($_POST[$k]) : '';
        return (preg_match('~^data:image/(jpeg|png);base64,[A-Za-z0-9+/=]+$~D', $v) && strlen($v) < 6000000) ? $v : '';
    };
    $after = $img('after'); $before = $img('before'); $marked = $img('marked'); $sketch = $img('sketch');
    if (!$after) wp_send_json_error(['message' => 'Chybí fotka návrhu.'], 400);
    $hints = isset($_POST['hints']) ? sanitize_textarea_field(wp_unslash($_POST['hints'])) : '';
    $plants = isset($_POST['plants']) ? sanitize_textarea_field(wp_unslash($_POST['plants'])) : '';
    $prompt = "Jsi zahradní architekt a z fotografií vytváříš přesný PŮDORYS (pohled shora) skutečné zahrady.\n"
        . "Obrázky: 1) fotka PO – navržená zahrada (z ní kresli nové záhony, cesty a trávník); "
        . ($before ? "2) fotka PŘED – původní stav; " : '') . ($marked ? "3) fotka PŘED se zeleně vyznačeným tím, co zůstává beze změny (dům, plot, dlažba…); " : '')
        . ($sketch ? "4) NÁČRT ZÁKAZNÍKA – fotka PŘED s barevnými značkami, kde chce jednotlivé prvky (význam barev a polohy jsou v údajích od zákazníka níže); náčrt je kreslený prstem a přibližný – urči z něj, co kde je, ale přesné polohy ber z fotky PO; " : '')
        . "všechny jsou ze STEJNÉHO místa.\n"
        . "SOUŘADNICE V METRECH z pohledu fotografa: x = 0 je levý okraj viditelné zahrady, x roste doprava; y = 0 je místo fotografa (přední okraj), y roste dozadu od fotografa. "
        . "Perspektiva: vzdálené věci jsou na fotce menší a výš – přepočítej je na skutečné metry. Co je na fotce NÍŽ, je BLÍŽ k fotografovi (menší y): např. opěrná zídka v popředí před dlažbou má menší y než dlažba za ní, záhon před domem má menší y než dům. Měřítko odvoď ze známých věcí (dveře ~0,9 m, panel plotu ~2 m, dlaždice ~0,2 m) a z údajů zákazníka.\n"
        . "Pro každý prvek dej points: plochy (house, terrace, paving, gravel = kačírek/štěrk, lawn, bed, structure, steps = schody) jako mnohoúhelník 4–12 bodů po obvodu; čáry (fence, wall, hedge, path, stepping) jako lomená čára 2–8 bodů se šířkou width_m; strom/keř jako 1 bod. "
        . "Nové prvky z návrhu mají is_new true, stávající false. Záhon zakresli PŘESNĚ tam a v takovém tvaru, kde je na fotce PO (např. úzký pás podél plotu = úzký pás podél čáry plotu). Trávník zakresli jako celou zbývající travnatou plochu. "
        . "U každého nového záhonu vyjmenuj rostliny z fotky PO, jen z tohoto seznamu: {$plants}. "
        . "Popisky česky a krátce. Do notes 1–2 věty, co je odhad.\n"
        . "ÚDAJE OD ZÁKAZNÍKA (mají přednost před odhadem): {$hints}";
    $content = [['type' => 'text', 'text' => $prompt], ['type' => 'image_url', 'image_url' => ['url' => $after, 'detail' => 'high']]];
    if ($before) $content[] = ['type' => 'image_url', 'image_url' => ['url' => $before, 'detail' => 'low']];
    if ($marked) $content[] = ['type' => 'image_url', 'image_url' => ['url' => $marked, 'detail' => 'low']];
    if ($sketch) $content[] = ['type' => 'image_url', 'image_url' => ['url' => $sketch, 'detail' => 'high']];
    $model = defined('MVGREEN_OPENAI_PLAN_V2_MODEL') ? MVGREEN_OPENAI_PLAN_V2_MODEL : 'gpt-4.1';
    $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
        'headers' => ['Authorization' => 'Bearer ' . MVGREEN_OPENAI_API_KEY, 'Content-Type' => 'application/json'],
        'body' => wp_json_encode(['model' => $model, 'messages' => [['role' => 'user', 'content' => $content]],
            'response_format' => ['type' => 'json_schema', 'json_schema' => ['name' => 'garden_plan_v2', 'strict' => true, 'schema' => mvgreen_plan_v2_schema()]]]),
        'timeout' => 150,
    ]);
    if (is_wp_error($response)) wp_send_json_error(['message' => 'Spojení s AI selhalo: ' . $response->get_error_message()], 200);
    $json = json_decode(wp_remote_retrieve_body($response), true);
    $status = wp_remote_retrieve_response_code($response);
    if ($status < 200 || $status >= 300) wp_send_json_error(['message' => isset($json['error']['message']) ? sanitize_text_field($json['error']['message']) : 'AI vrátila chybu.'], 200);
    $plan = json_decode($json['choices'][0]['message']['content'] ?? '', true);
    if (!is_array($plan) || empty($plan['elements'])) wp_send_json_error(['message' => 'AI nevrátila použitelný půdorys.'], 200);
    wp_send_json_success(['plan' => $plan, 'model' => $model]);
});

/**
 * AI předznačení (2026-11-10, Martin vybral řešení 3 ze „10 způsobů označování“: na mobilu je prst
 * moc tlustý na plot a okraje). Model najde na fotce objekty a vrátí jejich MASKY; v prohlížeči se
 * přichytí k dílkům fotky (SLIC) a zákazník jen ťuká opravy (assets/v2/mark.js).
 * 1. pokus s GPT-4.1 (obrysy z bodů) byl nepoužitelný – Martin: „absolutně nedostačující“ (dům
 * napůl, auta vůbec). GPT obrysy kreslit neumí → Google Gemini, které vrací masky objektů. Martin
 * chce nejdřív bezplatnou úroveň; když nebude stačit, přejde se na Grounded SAM (Replicate).
 * POZOR: bezplatná úroveň Gemini smí data použít ke zlepšování modelů – jen na testy s vlastními
 * fotkami, pro zákazníky placená úroveň (GDPR).
 * Klíč: WordPress → Nastavení → MVGreen AI (nebo MVGREEN_GEMINI_API_KEY ve wp-config.php).
 */
function mvgreen_detect_v2_kinds() {
    // kategorie v dotazu → kind v pluginu
    return ['house' => 'house', 'neighboring house' => 'neighbor', 'fence' => 'fence', 'gate' => 'gate', 'retaining wall' => 'wall',
        'car' => 'car', 'trailer' => 'car', 'shed' => 'shed', 'tree' => 'tree', 'shrub' => 'shrub', 'hedge' => 'hedge',
        'lawn' => 'lawn', 'flower bed' => 'bed', 'paving' => 'paving', 'path' => 'path', 'terrace' => 'terrace', 'steps' => 'steps',
        'gravel' => 'gravel', 'bare soil' => 'soil', 'construction material' => 'rubble', 'trash bin' => 'container', 'sky' => 'sky', 'outside property' => 'offsite'];
}
add_action('wp_ajax_mvgreen_ai_detect_v2', function () {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Zatím jen pro správce.'], 403);
    $gkey = function_exists('mvgreen_gemini_key') ? mvgreen_gemini_key() : '';
    if (!$gkey) wp_send_json_error(['message' => 'Chybí klíč Google Gemini (WordPress → Nastavení → MVGreen AI).'], 200);
    $photo = isset($_POST['photo']) ? wp_unslash($_POST['photo']) : '';
    if (!preg_match('~^data:image/jpeg;base64,([A-Za-z0-9+/=]+)$~D', $photo, $m) || strlen($photo) > 4000000) wp_send_json_error(['message' => 'Chybí fotka.'], 400);
    $kinds = mvgreen_detect_v2_kinds();
    // 3. test (0.6.243): obrysy kreslí SAM v prohlížeči (sam.js), od Gemini stačí obdélník a druh –
    // bez polygonů odpovídá rychleji. Majitel: les a louka za domem nejsou pozemek majitelky →
    // vlastní kategorie „outside property“ (mark.js je nechá beze změny).
    $prompt = 'Find every separate object and surface in this garden photo from these categories: '
        . implode(', ', array_keys($kinds)) . '. Each car, tree, shed or house is a separate item; give fences, gates and walls even when they are thin. '
        . 'Only the garden of the photographed house is the property. Everything clearly beyond it - fields, meadows, forest, land of other owners, roads, hills in the distance - is "outside property" (one item per area), never lawn, tree or bare soil. Neighbouring houses stay "neighboring house". '
        . 'Output a JSON list where each entry contains the 2D bounding box in the key "box_2d" as [ymin, xmin, ymax, xmax] normalized to 0-1000 and the text label in the key "label". The box must tightly enclose the whole visible object. '
        . 'The label must be "<category>: <short Czech name with position>", e.g. "car: Bílé auto vpravo", "lawn: Tráva v popředí", "outside property: Louka za domem". At most 30 items. '
        // 2026-11-11, majitel: záhon pod domem ve svahu AI nakreslila na rovinu (a se zídkou) → popis terénu
        . 'Put the list in the key "items". In the key "terrain" describe the ground shape in Czech in 1–3 short sentences: which parts of the photo slope and in which direction (e.g. "pod domem vlevo svah klesá dolů k trávníku"), where are existing retaining walls, steps or terraces, and which parts are flat. In the key "horizon_y" give the height of the horizon line (camera eye level, where distant flat ground would meet the sky) as y on the same 0-1000 scale – it is used to convert the photo to a top-down plan.';
    // 1. test na Martinově fotce (2026-11-10): gemini-3-flash-preview vrátil jen obdélníky BEZ masek →
    // tráva u domu „patřila“ domu, pole za autem autu. Nejdřív model, který masky vrací (2.5 Flash);
    // když odpověď masky nemá, zkusí se další model a vezme se odpověď s nejvíc maskami.
    // 2. test: 2.5 Flash už nový účet nedostane, 3.8 Flash odmítl thinkingLevel „minimal“, 3 Flash Preview
    // vrátil jen box_2d+label → povinné schéma s obrysem (mask = [x,y] 0–1000) a postupně nastavení přemýšlení.
    $models = array_values(array_unique(array_filter([defined('MVGREEN_GEMINI_MODEL') ? MVGREEN_GEMINI_MODEL : '', 'gemini-3.8-flash', 'gemini-3-flash-preview'])));
    $schema = ['type' => 'OBJECT', 'required' => ['items', 'terrain', 'horizon_y'], 'properties' => [
        'items' => ['type' => 'ARRAY', 'items' => ['type' => 'OBJECT', 'required' => ['box_2d', 'label'], 'properties' => [
            'box_2d' => ['type' => 'ARRAY', 'items' => ['type' => 'INTEGER']],
            'label' => ['type' => 'STRING'],
        ]]],
        'terrain' => ['type' => 'STRING'],
        'horizon_y' => ['type' => 'INTEGER'],
    ]];
    $parse = function ($items) use ($kinds) {
        $objects = [];
        foreach ((array) $items as $o) {
            if (!is_array($o) || !isset($o['box_2d']) || count((array) $o['box_2d']) !== 4) continue;
            $b = array_map(function ($v) { return max(0, min(1000, (float) $v)); }, array_values((array) $o['box_2d']));
            if ($b[2] <= $b[0] || $b[3] <= $b[1]) continue;
            $label = (string) ($o['label'] ?? '');
            $cat = strtolower(trim(strstr($label, ':', true) ?: $label));
            $kind = $kinds[$cat] ?? 'other';
            $name = trim(strpos($label, ':') !== false ? substr($label, strpos($label, ':') + 1) : $label);
            $mask = $o['mask'] ?? ($o['segmentation'] ?? ($o['polygon'] ?? null)); $outMask = null;
            if (is_string($mask)) {
                $mask = preg_replace('~\s+~', '', $mask);
                if (preg_match('~^(data:image/png;base64,)?([A-Za-z0-9+/=]+)$~D', $mask, $mm) && strlen($mm[2]) < 1500000) $outMask = 'data:image/png;base64,' . $mm[2];
            } elseif (is_array($mask) && $mask) {
                $pts = [];
                if (!is_array(reset($mask))) { $flat = array_values($mask); for ($i = 0; $i + 1 < count($flat); $i += 2) $pts[] = [$flat[$i], $flat[$i + 1]]; }
                else foreach ($mask as $p) if (is_array($p) && count($p) >= 2) $pts[] = array_values($p);
                $pts = array_map(function ($p) { return [max(0, min(1000, (float) $p[0])), max(0, min(1000, (float) $p[1]))]; }, $pts);
                if (count($pts) >= 3) $outMask = $pts;
            }
            $objects[] = ['kind' => $kind, 'name' => sanitize_text_field($name ?: $cat), 'box' => $b, 'mask' => $outMask];
        }
        return $objects;
    };
    $last = 'AI neodpověděla.'; $best = null; $used = ''; $notes = [];
    $tries = [];
    // Test 0.6.247 (2026-11-10): dotaz běžel přes 100 s (až 6 pokusů po 120 s) a WEDOS ho utnul
    // chybou 503 – a v tu dobu hlásil 503 i celý web. Teď: naposledy fungující model a nastavení
    // jako první, celkový limit 45 s, při vypršení času se model dál nezkouší.
    $ok = get_option('mvgreen_gemini_ok');
    if (is_array($ok) && in_array($ok[0] ?? '', $models, true)) $tries[] = [$ok[0], (string) ($ok[1] ?? '')];
    foreach ($models as $model) foreach (['minimal', 'low', ''] as $tl) if (!in_array([$model, $tl], $tries, true)) $tries[] = [$model, $tl];
    $skip = [];
    $deadline = microtime(true) + 45;
    @set_time_limit(90);
    foreach ($tries as $try) {
        list($model, $tl) = $try;
        if (!empty($skip[$model])) continue;
        $left = (int) floor($deadline - microtime(true));
        if ($left < 8) { $notes[] = 'Časový limit 45 s vyčerpán.'; break; }
        // „For better results, disable thinking“ (dokumentace Gemini) – ne každý model umí „minimal“
        $gc = ['responseMimeType' => 'application/json', 'responseSchema' => $schema, 'temperature' => 0.3];
        if ($tl) $gc['thinkingConfig'] = ['thinkingLevel' => $tl];
        $r = wp_remote_post('https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent', [
            'headers' => ['x-goog-api-key' => $gkey, 'Content-Type' => 'application/json'],
            'body' => wp_json_encode(['contents' => [['parts' => [['inline_data' => ['mime_type' => 'image/jpeg', 'data' => $m[1]]], ['text' => $prompt]]]], 'generationConfig' => $gc]),
            'timeout' => $left,
        ]);
        if (is_wp_error($r)) { $last = 'Spojení s Gemini selhalo: ' . $r->get_error_message(); $notes[] = $model . ': ' . $last; $skip[$model] = true; continue; }
        $code = wp_remote_retrieve_response_code($r); $json = json_decode(wp_remote_retrieve_body($r), true);
        if ($code < 200 || $code >= 300) {
            $emsg = (string) ($json['error']['message'] ?? ('HTTP ' . $code));
            $last = 'Gemini (' . $model . ($tl ? ', ' . $tl : '') . '): ' . sanitize_text_field($emsg); $notes[] = $last;
            if (stripos($emsg, 'thinking') === false) $skip[$model] = true;   // jiná chyba než nastavení přemýšlení → další model
            continue;
        }
        $skip[$model] = true;
        update_option('mvgreen_gemini_ok', [$model, $tl], false);
        $text = '';
        foreach ((array) ($json['candidates'][0]['content']['parts'] ?? []) as $p) if (isset($p['text'])) $text .= $p['text'];
        $text = trim(preg_replace('~^\s*```(?:json)?|```\s*$~', '', $text));
        $out = json_decode($text, true);
        $terrainNow = is_array($out) && isset($out['terrain']) ? sanitize_text_field((string) $out['terrain']) : '';
        $horizonNow = is_array($out) && isset($out['horizon_y']) && is_numeric($out['horizon_y']) ? max(0, min(1000, (int) $out['horizon_y'])) : null;
        if (is_array($out) && isset($out['items'])) $out = $out['items'];
        if (is_array($out) && isset($out['boxes'])) $out = $out['boxes'];
        if (!is_array($out)) { $last = 'Gemini (' . $model . ') nevrátilo seznam objektů.'; $notes[] = $last . ' ' . sanitize_text_field(substr($text, 0, 120)); continue; }
        $objs = $parse($out);
        $withMask = count(array_filter($objs, function ($o) { return $o['mask'] !== null; }));
        $first = is_array(reset($out)) ? reset($out) : [];
        $notes[] = $model . ': ' . count($objs) . ' objektů, s maskou ' . $withMask . ' (klíče: ' . implode(',', array_keys($first)) . ')';
        if (!$best || count($objs) > count($best['objects'])) { $best = ['objects' => $objs, 'withMask' => $withMask, 'terrain' => $terrainNow, 'horizon' => $horizonNow]; $used = $model; }
        if ($objs) break;
    }
    if (!$best) wp_send_json_error(['message' => $last, 'notes' => $notes], 200);
    $objects = $best['objects'];
    wp_send_json_success(['objects' => array_slice($objects, 0, 40), 'terrain' => mb_substr($best['terrain'] ?? '', 0, 600), 'horizon' => $best['horizon'] ?? null, 'model' => $used, 'notes' => $notes]);
});

/**
 * Fotka rostliny pro karty v PDF (2026-11-08): hledá na Wikimedia Commons jen fotky s licencí pro
 * komerční použití (CC0, CC BY, volné dílo), stáhne náhled k nám na server a vrací místní adresu
 * + autora a licenci (uvádí se na straně 11). Prohlížeč zákazníka se tak na Wikimedii nikdy
 * nepřipojuje (GDPR) a každá rostlina se hledá jen jednou (výsledek se pamatuje).
 */
add_action('wp_ajax_mvgreen_plant_photo', function () {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Zatím jen pro správce.'], 403);
    $latin = isset($_POST['latin']) ? sanitize_text_field(wp_unslash($_POST['latin'])) : '';
    if ($latin === '' || strlen($latin) > 120) wp_send_json_error(['message' => 'Chybí název.'], 400);
    // Uložená fotka platí trvale; neúspěch se pamatuje jen 6 hodin. V 1. testu v2 (2026-11-08) se
    // uložila prázdná odpověď natrvalo a všechny karty pak ukazovaly „fotka se doplní“.
    // Katalog (2026-11-10) nese předem vybranou a majitelem kontrolovanou fotku (název souboru na
    // Commons) – vyhledávání brávalo kůru, bobule nebo jinou rostlinu. Hledání zůstává jako záloha.
    $file = isset($_POST['file']) ? sanitize_text_field(wp_unslash($_POST['file'])) : '';
    if (!preg_match('/^File:[^|#<>\[\]{}]{3,240}\.jpe?g$/i', $file)) $file = '';
    $key = 'mvgreen_plant_photo_' . md5(strtolower($latin) . ($file ? '|' . $file : ''));
    $cached = get_option($key);
    if (is_array($cached) && !empty($cached['url'])) wp_send_json_success($cached);
    if (get_transient($key . '_miss')) wp_send_json_success(['url' => '', 'license' => '', 'author' => '', 'page' => '', 'reason' => 'nedávno nenalezeno']);
    $ua = 'MVGreenGardenDesigner/1.0 (https://mvgreen.cz; mvgreen@seznam.cz) WordPress';
    // Hledá se botanický název bez odrůdy v uvozovkách – Commons hledá podle slov, celé jméno
    // s ‘odrůdou’ obvykle nenajde nic. Pak jen rod + druh.
    $base_name = trim(preg_replace('/\s*[‘’\'"].*$/u', '', $latin));
    $queries = array_unique(array_filter([$base_name, implode(' ', array_slice(preg_split('/\s+/', str_replace('×', '', $base_name)), 0, 2))]));
    $found = null; $reason = 'nic nenalezeno';
    $urls = [];
    if ($file) $urls[] = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=' . rawurlencode($file) . '&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=640';
    foreach ($queries as $q) $urls[] = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch='
        . rawurlencode($q . ' filetype:bitmap') . '&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=640';
    foreach ($urls as $url) {
        $r = wp_remote_get($url, ['headers' => ['User-Agent' => $ua], 'timeout' => 20]);
        if (is_wp_error($r)) { $reason = 'spojení: ' . $r->get_error_message(); continue; }
        if (wp_remote_retrieve_response_code($r) !== 200) { $reason = 'Wikimedia HTTP ' . wp_remote_retrieve_response_code($r); continue; }
        $pages = json_decode(wp_remote_retrieve_body($r), true)['query']['pages'] ?? [];
        uasort($pages, function ($a, $b) { return ($a['index'] ?? 0) <=> ($b['index'] ?? 0); });
        foreach ($pages as $p) {
            $ii = $p['imageinfo'][0] ?? null; if (!$ii || empty($ii['thumburl'])) continue;
            $lic = trim(wp_strip_all_tags($ii['extmetadata']['LicenseShortName']['value'] ?? ''));
            // CC BY-SA je pro komerční použití v pořádku (fotka se nemění, uvádí se autor a licence).
            if (!preg_match('/^(CC0( 1\.0)?|CC BY(-SA)? [0-9.]+|Public domain)$/i', $lic) || ($ii['width'] ?? 0) < 800) continue;
            $found = ['thumb' => $ii['thumburl'], 'license' => $lic, 'author' => trim(wp_strip_all_tags($ii['extmetadata']['Artist']['value'] ?? 'neuveden')), 'page' => $ii['descriptionurl'] ?? ''];
            break;
        }
        if ($found) break;
    }
    $result = ['url' => '', 'license' => '', 'author' => '', 'page' => ''];
    if ($found) {
        $up = wp_upload_dir();
        $dir = trailingslashit($up['basedir']) . 'mvgreen-plants';
        if (wp_mkdir_p($dir)) {
            if (function_exists('mvgreen_harden_upload_dir')) mvgreen_harden_upload_dir($dir);
            $img = wp_remote_get($found['thumb'], ['headers' => ['User-Agent' => $ua], 'timeout' => 30]);
            $bytes = is_wp_error($img) ? '' : wp_remote_retrieve_body($img);
            if ($bytes && substr($bytes, 0, 3) === "\xFF\xD8\xFF") {
                $file = sanitize_title($latin) . '.jpg';
                if (@file_put_contents($dir . '/' . $file, $bytes)) {
                    $result = ['url' => trailingslashit($up['baseurl']) . 'mvgreen-plants/' . $file, 'license' => $found['license'], 'author' => $found['author'], 'page' => $found['page']];
                } else { $reason = 'nelze zapsat do uploads'; }
            } else { $reason = is_wp_error($img) ? 'stažení: ' . $img->get_error_message() : 'náhled není JPEG (HTTP ' . wp_remote_retrieve_response_code($img) . ')'; }
        } else { $reason = 'nelze vytvořit složku'; }
    }
    if ($result['url']) { update_option($key, $result, false); wp_send_json_success($result); }
    delete_option($key);
    set_transient($key . '_miss', 1, 6 * HOUR_IN_SECONDS);
    wp_send_json_success($result + ['reason' => $reason]);
});

/**
 * Soubory modelu SAM pro přesné obrysy objektů (2026-11-10). Gemini dobře pozná, CO na fotce je
 * a kde (obdélník), ale obrys nakreslit neumí (Martinova fotka: „ani se to k dobrým obrysům
 * nepřibližuje“). SlimSAM-50 v prohlížeči obkreslí objekt v obdélníku přesně (test na stejné fotce:
 * dům, obě auta, štěrk, kůlna). Soubory (~57 MB, pevné verze, kontrola SHA-256) si server stáhne
 * jednou do uploads a pak je posílá sám – prohlížeč zákazníka se na Hugging Face ani jsDelivr
 * nepřipojuje (GDPR) a fotka neopouští prohlížeč. Plugin ZIP tím nenabobtná o 57 MB.
 */
function mvgreen_sam_files() {
    $tj = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/';
    $hf = 'https://huggingface.co/Xenova/slimsam-50-uniform/resolve/3959c85fa93ab1c3dedd879c833aae1931961e19/';
    $m = 'models/Xenova/slimsam-50-uniform/';
    return [
        'transformers.min.js' => [$tj . 'transformers.min.js', '79fad8c1c2fd165bf1e77ace20ce023fab4dc13b6621f0e586c9b8c59c4d09d8'],
        'ort/ort-wasm-simd-threaded.jsep.mjs' => [$tj . 'ort-wasm-simd-threaded.jsep.mjs', '08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9'],
        'ort/ort-wasm-simd-threaded.jsep.wasm' => [$tj . 'ort-wasm-simd-threaded.jsep.wasm', 'c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39'],
        $m . 'config.json' => [$hf . 'config.json', '122411ca7e10980ffcdc938b754e5895d9f29af1da8b7ea7f857b81de5f89b08'],
        $m . 'preprocessor_config.json' => [$hf . 'preprocessor_config.json', '225545a743c654e3c495ec6f545a0eaba57c8ba3fbbd8483b3cb1c0fc58db517'],
        $m . 'onnx/vision_encoder_quantized.onnx' => [$hf . 'onnx/vision_encoder_quantized.onnx', '84934ceb504b07a757c63f56440699c9c593933b41bea3e11c261eb27a35baab'],
        $m . 'onnx/prompt_encoder_mask_decoder_quantized.onnx' => [$hf . 'onnx/prompt_encoder_mask_decoder_quantized.onnx', 'cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2'],
    ];
}

add_action('wp_ajax_mvgreen_sam_file', function () {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Zatím jen pro správce.'], 403);
    $files = mvgreen_sam_files();
    $f = isset($_POST['f']) ? sanitize_text_field(wp_unslash($_POST['f'])) : '';
    if (!isset($files[$f])) wp_send_json_error(['message' => 'Neznámý soubor.'], 400);
    $up = wp_upload_dir();
    $root = trailingslashit($up['basedir']) . 'mvgreen-sam';
    $base = set_url_scheme(trailingslashit($up['baseurl']) . 'mvgreen-sam/');
    $path = $root . '/' . $f;
    $done = $path . '.ok';   // značka „staženo a ověřeno“ – hash 30 MB souboru se nepočítá při každém volání
    if (file_exists($path) && file_exists($done)) wp_send_json_success(['base' => $base]);
    if (!wp_mkdir_p(dirname($path))) wp_send_json_error(['message' => 'Nelze vytvořit složku v uploads.'], 500);
    if (!file_exists($root . '/.htaccess')) {
        // stejná ochrana jako mvgreen_harden_upload_dir + správný typ pro WebAssembly a JS moduly
        @file_put_contents($root . '/.htaccess', "<FilesMatch \"\\.(php|phtml|php[0-9]?|pl|py|cgi|asp|aspx|sh)$\">\n"
            . "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n</FilesMatch>\n"
            . "<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\n"
            . "<IfModule mod_mime.c>\nAddType application/wasm .wasm\nAddType text/javascript .mjs\n</IfModule>\n"
            . "<IfModule mod_expires.c>\nExpiresActive On\nExpiresDefault \"access plus 1 year\"\n</IfModule>\n");
        @file_put_contents($root . '/index.php', '<?php // Silence is golden.');
    }
    @set_time_limit(300);
    $tmp = $path . '.part';
    $r = wp_remote_get($files[$f][0], ['timeout' => 240, 'stream' => true, 'filename' => $tmp, 'headers' => ['User-Agent' => 'MVGreenGardenDesigner/1.0 (https://mvgreen.cz) WordPress']]);
    if (is_wp_error($r) || wp_remote_retrieve_response_code($r) !== 200) {
        @unlink($tmp);
        wp_send_json_error(['message' => 'Stažení ' . $f . ': ' . (is_wp_error($r) ? $r->get_error_message() : 'HTTP ' . wp_remote_retrieve_response_code($r))], 502);
    }
    if (!hash_equals($files[$f][1], (string) hash_file('sha256', $tmp))) { @unlink($tmp); wp_send_json_error(['message' => 'Soubor ' . $f . ' nesedí (kontrolní součet).'], 502); }
    if (!@rename($tmp, $path)) { @unlink($tmp); wp_send_json_error(['message' => 'Nelze uložit ' . $f . '.'], 500); }
    @file_put_contents($done, '1');
    wp_send_json_success(['base' => $base]);
});

add_shortcode('mvgreen_ai_architekt', function ($atts) {
    if (post_password_required()) return get_the_password_form();
    $a = shortcode_atts(['pred' => '', 'po' => '', 'ukazka' => ''], $atts, 'mvgreen_ai_architekt');
    $base = plugin_dir_url(__FILE__);
    $v = MVGREEN_VERSION;
    wp_enqueue_style('mvgreen-reference-font', $base . 'assets/fonts.css', [], $v);
    wp_enqueue_style('mvgreen-architekt', $base . 'assets/v2/architekt.css', ['mvgreen-reference-font'], $v);
    wp_enqueue_script('mvgreen-ai-safety', $base . 'assets/ai-safety.js', [], $v, true);
    wp_enqueue_script('mvgreen-paint-mask', $base . 'assets/mg-paint-mask.js', ['mvgreen-ai-safety'], $v, true);
    wp_enqueue_script('mvgreen-plan-render', $base . 'assets/v2/plan-render.js', [], $v, true);
    wp_enqueue_script('mvgreen-plants-v2', $base . 'assets/v2/plants-catalog.js', [], $v, true);
    wp_enqueue_script('mvgreen-mark-v2', $base . 'assets/v2/mark.js', ['mvgreen-paint-mask', 'mvgreen-ai-safety'], $v, true);
    wp_enqueue_script('mvgreen-sam-v2', $base . 'assets/v2/sam.js', [], $v, true);
    wp_enqueue_script('mvgreen-sketch', $base . 'assets/v2/sketch.js', ['mvgreen-mark-v2'], $v, true);
    wp_enqueue_script('mvgreen-architekt-pdf', $base . 'assets/v2/architekt-pdf.js', ['mvgreen-plan-render'], $v, true);
    wp_enqueue_script('mvgreen-architekt', $base . 'assets/v2/architekt.js', ['mvgreen-plan-render', 'mvgreen-architekt-pdf', 'mvgreen-ai-safety', 'mvgreen-paint-mask', 'mvgreen-plants-v2', 'mvgreen-sketch', 'mvgreen-mark-v2', 'mvgreen-sam-v2'], $v, true);
    $logo_id = (int) get_theme_mod('custom_logo', 0);
    if (!$logo_id) $logo_id = (int) get_option('site_logo', 0);
    $logo = $logo_id ? wp_get_attachment_image_url($logo_id, 'medium') : '';
    // Stejný objekt jako u původního návrháře – mg-paint-mask.js z něj bere adresu Web Workeru.
    wp_add_inline_script('mvgreen-architekt', 'window.MVGreenAI = window.MVGreenAI || ' . wp_json_encode([
        'ajaxUrl' => admin_url('admin-ajax.php'), 'nonce' => wp_create_nonce('mvgreen_ai_test'),
        'enabled' => current_user_can('manage_options'), 'workerUrl' => plugins_url('assets/mg-segment-worker.js', __FILE__),
    ]) . ';', 'before');
    wp_add_inline_script('mvgreen-architekt', 'window.MVGreenArchitekt = ' . wp_json_encode([
        'logo' => $logo ?: get_site_icon_url(192),
        'demo' => $a['ukazka'] === '1',
        'photoBefore' => esc_url_raw($a['pred']),
        'photoAfter' => esc_url_raw($a['po']),
        'isAdmin' => current_user_can('manage_options'),
    ]) . ';', 'before');
    return '<div data-mvgreen-architekt class="mvg2"><p>Načítání…</p></div>';
});
