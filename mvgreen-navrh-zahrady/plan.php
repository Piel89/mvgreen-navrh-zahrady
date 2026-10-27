<?php
/**
 * Půdorys z AI návrhu: vision model přečte fotografii „po“ a vrátí strukturovaný plán (JSON).
 * Kreslení půdorysu dělá prohlížeč (assets/garden-plan.js). Jen pro správce, klíč zůstává na serveru.
 */
if (!defined('ABSPATH')) exit;

function mvgreen_plan_schema() {
    $point = ['type' => 'array', 'items' => ['type' => 'number']];
    return [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['site', 'elements', 'notes'],
        'properties' => [
            'site' => [
                'type' => 'object', 'additionalProperties' => false,
                'required' => ['width_m', 'depth_m', 'house_side'],
                'properties' => [
                    'width_m' => ['type' => 'number', 'description' => 'Odhad šířky zobrazené zahrady v metrech'],
                    'depth_m' => ['type' => 'number', 'description' => 'Odhad hloubky zobrazené zahrady v metrech'],
                    'house_side' => ['type' => 'string', 'enum' => ['top', 'none']],
                ],
            ],
            'elements' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object', 'additionalProperties' => false,
                    'required' => ['type', 'no', 'label', 'polygon', 'photo_point', 'plants', 'is_new'],
                    'properties' => [
                        'type' => ['type' => 'string', 'enum' => ['house', 'terrace', 'lawn', 'bed', 'path', 'gravel', 'fence', 'hedge', 'tree', 'shrub', 'slope', 'other']],
                        'no' => ['type' => 'integer', 'description' => 'U záhonu číslo kroužku z fotografie, jinak 0.'],
                        'label' => ['type' => 'string'],
                        'polygon' => ['type' => 'array', 'items' => $point, 'description' => 'Body v mřížce 0–100 (x zleva doprava, y od domu dolů k fotografovi). Strom/keř = 1 bod.'],
                        'photo_point' => ['type' => 'array', 'items' => ['type' => 'number'], 'description' => 'Kde je střed prvku na fotografii PO: [x, y] v procentech 0–100 šířky a výšky fotky.'],
                        'is_new' => ['type' => 'boolean', 'description' => 'true = nový prvek z návrhu, false = stávající'],
                        'plants' => [
                            'type' => 'array',
                            'items' => [
                                'type' => 'object', 'additionalProperties' => false,
                                'required' => ['name', 'count'],
                                'properties' => ['name' => ['type' => 'string'], 'count' => ['type' => 'integer']],
                            ],
                        ],
                    ],
                ],
            ],
            'notes' => ['type' => 'string'],
        ],
    ];
}

add_action('wp_ajax_mvgreen_ai_plan', 'mvgreen_ai_plan_handle');
add_action('wp_ajax_nopriv_mvgreen_ai_plan', 'mvgreen_ai_plan_handle');
function mvgreen_ai_plan_handle() {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    // Admin testuje zdarma. Veřejnost potřebuje platný (zaplacený) kód, ale tento
    // levný rozbor fotky už zakoupené použití nečerpá – to dělá jen mvgreen_ai_preview/angle.
    // Právě proto, že nečerpá _mvg_uses_left, by jinak jeden jednou zaplacený kód – byť už dávno
    // vyčerpaný – fungoval jako navždy platný klíč k neomezeným voláním tohoto (byť levného)
    // placeného API. Vlastní strop na kód (_mvg_plan_calls) to omezí na rozumný, ale štědrý počet
    // (víc než dost na skutečné použití: rozbor po každém vygenerování + pár náhledů znovu).
    if (!current_user_can('manage_options')) {
        if (!function_exists('mvgreen_find_code_post')) wp_send_json_error(['message' => 'Půdorys zatím není dostupný.'], 503);
        if (mvgreen_code_rate_limited()) wp_send_json_error(['message' => 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.'], 429);
        $code_post = mvgreen_find_code_post(isset($_POST['code']) ? sanitize_text_field(wp_unslash($_POST['code'])) : '');
        if (!$code_post || get_post_meta($code_post->ID, '_mvg_status', true) !== 'paid') wp_send_json_error(['message' => 'Neplatný nebo nezaplacený kód.'], 403);
        $plan_limit = max(10, ((int) get_post_meta($code_post->ID, '_mvg_uses_total', true)) * 5);
        $plan_used = (int) get_post_meta($code_post->ID, '_mvg_plan_calls', true);
        if ($plan_used >= $plan_limit) wp_send_json_error(['message' => 'Pro tento kód už bylo rozborů fotky využito dost. Napište nám prosím, pokud potřebujete další.'], 429);
        update_post_meta($code_post->ID, '_mvg_plan_calls', $plan_used + 1);
    }
    if (!defined('MVGREEN_OPENAI_API_KEY') || !MVGREEN_OPENAI_API_KEY) wp_send_json_error(['message' => 'Chybí MVGREEN_OPENAI_API_KEY.'], 400);
    // Levné volání, přesto denní strop proti chybám ve smyčce (sdílený mezi správcem a veřejností).
    $key = 'mvgreen_plan_daily_' . gmdate('Ymd');
    $used = (int) get_option($key, 0);
    if ($used >= 300) wp_send_json_error(['message' => 'Dnešní limit půdorysů byl vyčerpán.'], 429);

    $image = isset($_POST['image']) ? wp_unslash($_POST['image']) : '';
    if (!preg_match('~^data:image/(jpeg|png);base64,[A-Za-z0-9+/=]+$~D', $image) || strlen($image) > 6000000) {
        wp_send_json_error(['message' => 'Neplatný obrázek návrhu.'], 400);
    }
    $before = isset($_POST['before']) ? wp_unslash($_POST['before']) : '';
    if ($before && (!preg_match('~^data:image/(jpeg|png);base64,[A-Za-z0-9+/=]+$~D', $before) || strlen($before) > 6000000)) $before = '';
    $plants = isset($_POST['plants']) ? sanitize_textarea_field(wp_unslash($_POST['plants'])) : '';
    $style = isset($_POST['style']) ? sanitize_text_field(wp_unslash($_POST['style'])) : '';
    $width = isset($_POST['width']) ? (float) $_POST['width'] : 0;
    $length = isset($_POST['length']) ? (float) $_POST['length'] : 0;
    $markers = isset($_POST['markers']) ? max(0, min(9, (int) $_POST['markers'])) : 0;
    update_option($key, $used + 1, false);

    $dims = ($width > 0 && $length > 0) ? "Zákazník zadal rozměry upravované plochy: šířka {$width} m, hloubka {$length} m – použij je." : 'Rozměry nejsou zadané – odhadni je podle domu (běžné okno ~1,2 m, dveře ~2,1 m, podlaží ~2,8 m).';
    $prompt = "Jsi zahradní architekt. Dostáváš fotografii zahrady PO realizaci návrhu" . ($before ? ' a pro srovnání i PŘED' : '') . ". "
        . "1) U KAŽDÉHO prvku urči photo_point = střed prvku na fotografii PO v procentech (x 0–100 zleva, y 0–100 shora). "
        . "2) Převeď zahradu na PŮDORYS (pohled shora) v mřížce 0–100 – NIKDY ne v metrech: dům nahoře (y=0), fotograf dole (y=100), x zleva doprava tak, jak to vidí fotograf. "
        . "Zakresli dům (jen pruh u horního okraje), terasu, trávník, cesty, plot, stávající stromy a velké keře (1 bod). "
        . ($markers ? "Na fotografii PO jsou bílo-zelené kroužky s čísly 1–{$markers}; každý označuje jeden NOVÝ záhon z návrhu (i když na stejném místě dřív rostlo něco jiného) – kroužek je u STŘEDU záhonu, ne u celé jeho plochy, a záhon kolem něj může pokračovat daleko do stran, zejména podél cestičky, plotu nebo zdi. Vrať PŘESNĚ {$markers} prvků type bed s no = číslem kroužku a is_new true. U KAŽDÉHO nejdřív pečlivě projdi CELOU skutečně viditelnou plochu toho záhonu na fotce (ne jen okolí kroužku, klidně přes polovinu šířky záběru) a teprve podle toho urči rostliny a počty kusů – žádné jiné záhony nepřidávej, ale tenhle neořezávej jen na malý výsek kolem kroužku. U KAŽDÉHO z těch {$markers} záhonů musí být plants neprázdné pole s aspoň jedním druhem, pokud je v něm na fotce vidět jakákoliv výsadba (byť jen jeden druh) – prázdné pole vrať jen tehdy, když ta plocha na fotce fakticky vypadá holá/bez rostlin. Popisek podle polohy, např. „Záhon vlevo u trávníku“. Kroužky samotné nejsou součástí zahrady. "
            : "ZÁHON (type bed, is_new true) zakresli JEN tam, kde je na fotografii PO skutečně vidět nová výsadba, která na fotce PŘED není. Nic si nevymýšlej. ")
        . "Polygony se nesmí překrývat kromě stromů a keřů. "
        . "U každého nového záhonu uveď rostliny, které jsou v něm na fotce vidět, a reálný počet kusů pro jeho SKUTEČNOU plochu na fotce (trvalky 5–7 ks/m², traviny 3–5 ks/m², keře 1 ks na 1–2 m²; nejvýš 4 druhy na menší záhon). Je-li záhon dlouhý a hustě osázený (např. lem podél celé cestičky nebo zdi), počítej s jeho celou skutečnou délkou na fotce, ne jen s malým výsekem kolem kroužku – podhodnocený počet kusů je horší chyba než nadhodnocený. Počet kusů i plocha musí odpovídat tomu, co je na fotce doopravdy vidět, ne zjednodušenému odhadu. "
        . "Používej jen tyto rostliny z návrhu: {$plants}. Styl: {$style}. {$dims} "
        . "Šedé pruhy na okraji obrázku ignoruj. Popisky česky a krátce (např. „Záhon u svahu“, „Trávník“). Do notes napiš 1–2 věty, co je odhad.";

    $content = [['type' => 'text', 'text' => $prompt], ['type' => 'image_url', 'image_url' => ['url' => $image, 'detail' => 'high']]];
    if ($before) $content[] = ['type' => 'image_url', 'image_url' => ['url' => $before, 'detail' => 'low']];
    $model = defined('MVGREEN_OPENAI_PLAN_MODEL') ? MVGREEN_OPENAI_PLAN_MODEL : 'gpt-4.1-mini';
    $body = [
        'model' => $model,
        'messages' => [['role' => 'user', 'content' => $content]],
        'response_format' => ['type' => 'json_schema', 'json_schema' => ['name' => 'garden_plan', 'strict' => true, 'schema' => mvgreen_plan_schema()]],
    ];
    $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
        'headers' => ['Authorization' => 'Bearer ' . MVGREEN_OPENAI_API_KEY, 'Content-Type' => 'application/json'],
        'body' => wp_json_encode($body), 'timeout' => 120,
    ]);
    if (is_wp_error($response)) wp_send_json_error(['message' => 'Spojení s AI selhalo: ' . $response->get_error_message()], 200);
    $status = wp_remote_retrieve_response_code($response);
    $json = json_decode(wp_remote_retrieve_body($response), true);
    if ($status < 200 || $status >= 300) {
        wp_send_json_error(['message' => isset($json['error']['message']) ? sanitize_text_field($json['error']['message']) : 'AI vrátila chybu.'], 200);
    }
    $text = $json['choices'][0]['message']['content'] ?? '';
    $plan = json_decode($text, true);
    if (!is_array($plan) || empty($plan['elements'])) wp_send_json_error(['message' => 'AI nevrátila použitelný půdorys.'], 200);
    wp_send_json_success(['plan' => $plan, 'model' => $model]);
}

// Poslední uložený AI výstup (pro správce – nový půdorys bez dalšího placeného obrázku).
// Zůstává přísně admin-only: ukládá se do jediné, webu společné volby, takže by
// veřejnému zákazníkovi mohla ukázat fotografii z návrhu někoho jiného.
add_action('wp_ajax_mvgreen_ai_last', function () {
    if (!current_user_can('manage_options')) wp_send_json_error([], 403);
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    wp_send_json_success(['stem' => get_option('mvgreen_ai_last_log')]);
});

/**
 * Pohled z jiného úhlu (ptačí perspektiva) – volitelný placený obrázek. AI tu má volnost úhlu,
 * proto se výsledek vždy označuje jako ilustrační pohled, ne jako upravená fotografie.
 */
add_action('wp_ajax_mvgreen_ai_angle', 'mvgreen_ai_angle_handle');
add_action('wp_ajax_nopriv_mvgreen_ai_angle', 'mvgreen_ai_angle_handle');
function mvgreen_ai_angle_handle() {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!defined('MVGREEN_OPENAI_API_KEY') || !MVGREEN_OPENAI_API_KEY) wp_send_json_error(['message' => 'Chybí MVGREEN_OPENAI_API_KEY.'], 400);
    $is_admin = current_user_can('manage_options');
    $code = '';
    if ($is_admin) {
        $daily_limit = max(0, min(20, (int) get_option('mvgreen_ai_daily_limit', 1)));
        $daily_key = 'mvgreen_ai_daily_' . gmdate('Ymd');
        $used_today = (int) get_option($daily_key, 0);
        if ($daily_limit === 0 || $used_today >= $daily_limit) wp_send_json_error(['message' => 'Dnešní limit placených AI pokusů byl vyčerpán.'], 429);
    } else {
        if (!function_exists('mvgreen_redeem_code_use')) wp_send_json_error(['message' => 'Zatím není dostupné.'], 503);
        if (mvgreen_code_rate_limited()) wp_send_json_error(['message' => 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.'], 429);
        $code = isset($_POST['code']) ? sanitize_text_field(wp_unslash($_POST['code'])) : '';
        if ($code === '') wp_send_json_error(['message' => 'Zadejte prosím kód z e-mailu.'], 400);
    }
    if (get_transient('mvgreen_ai_preview_lock')) wp_send_json_error(['message' => 'Jiný návrh se právě vytváří.'], 429);
    $image = isset($_POST['image']) ? wp_unslash($_POST['image']) : '';
    if (!preg_match('~^data:image/png;base64,([A-Za-z0-9+/=]+)$~D', $image, $m)) wp_send_json_error(['message' => 'Neplatný obrázek.'], 400);
    $bytes = base64_decode($m[1], true);
    if (!$bytes || strlen($bytes) > 9000000) wp_send_json_error(['message' => 'Obrázek je příliš velký.'], 413);
    $view = (isset($_POST['view']) && $_POST['view'] === 'aerial') ? 'aerial' : 'raised';
    // Pořadí ve výrazu níže: aerial = ptačí perspektiva, raised = mírně zvednutý pohled (výchozí).
    $plan = isset($_POST['plan']) ? sanitize_textarea_field(wp_unslash($_POST['plan'])) : '';
    set_transient('mvgreen_ai_preview_lock', 1, 240);
    if ($is_admin) {
        update_option($daily_key, $used_today + 1, false);
    } else {
        $redeem = mvgreen_redeem_code_use($code);
        if (is_wp_error($redeem)) {
            delete_transient('mvgreen_ai_preview_lock');
            wp_send_json_error(['message' => $redeem->get_error_message()], 400);
        }
    }
    $angle = $view === 'aerial'
        ? 'z ptačí perspektivy – kamera asi 8 m vysoko a šikmo shora (cca 45°) z rohu zahrady, aby bylo vidět rozmístění trávníku a záhonů'
        : 'ze STEJNÉHO místa a STEJNÝM směrem jako původní fotografie, jen kamera je zvednutá asi do 3 m a mírně skloněná dolů, aby byla lépe vidět plocha zahrady. Úhel změň jen málo; proporce domu, vzdálenosti a velikosti všech prvků musí odpovídat skutečnosti';
    $prompt = "Předloha je realistický návrh konkrétní zahrady u konkrétního domu. Vytvoř FOTOREALISTICKÝ pohled na TUTÉŽ zahradu {$angle}. "
        . "Dům musí zůstat stejný: tvar, střecha, barva fasády, okna, dveře, komín. Zachovej stejné záhony, rostliny, trávník, plot a stávající stromy na stejných místech. "
        . "Nepřidávej nic, co na předloze není (žádné bazény, pergoly, sochy, lidi, auta, nápisy). Denní světlo, přirozené barvy. "
        . ($plan ? "Rozmístění podle půdorysu: {$plan}" : '');
    $boundary = 'mvgreen_' . wp_generate_password(24, false, false);
    $body = '';
    foreach (['model' => 'gpt-image-1.5', 'prompt' => $prompt, 'quality' => 'high', 'size' => '1536x1024', 'input_fidelity' => 'high'] as $k => $v) {
        $body .= '--' . $boundary . "\r\nContent-Disposition: form-data; name=\"{$k}\"\r\n\r\n{$v}\r\n";
    }
    $body .= '--' . $boundary . "\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"navrh.png\"\r\nContent-Type: image/png\r\n\r\n" . $bytes . "\r\n--" . $boundary . "--\r\n";
    $response = wp_remote_post('https://api.openai.com/v1/images/edits', [
        'headers' => ['Authorization' => 'Bearer ' . MVGREEN_OPENAI_API_KEY, 'Content-Type' => 'multipart/form-data; boundary=' . $boundary],
        'body' => $body, 'timeout' => 240,
    ]);
    delete_transient('mvgreen_ai_preview_lock');
    if (is_wp_error($response)) wp_send_json_error(['message' => 'Spojení s AI selhalo: ' . $response->get_error_message()], 200);
    $json = json_decode(wp_remote_retrieve_body($response), true);
    $http_status = wp_remote_retrieve_response_code($response);
    if ($http_status < 200 || $http_status >= 300 || empty($json['data'][0]['b64_json'])) {
        wp_send_json_error(['message' => isset($json['error']['message']) ? sanitize_text_field($json['error']['message']) : 'AI nevrátila obrázek.'], 200);
    }
    $up = wp_upload_dir();
    $dir = trailingslashit($up['basedir']) . 'mvgreen-ai-log';
    if (wp_mkdir_p($dir)) {
        if (function_exists('mvgreen_harden_upload_dir')) mvgreen_harden_upload_dir($dir);
        @file_put_contents($dir . '/' . gmdate('Ymd-His') . '-' . wp_generate_password(10, false, false) . '-uhel-' . $view . '.png', base64_decode($json['data'][0]['b64_json']));
    }
    wp_send_json_success(['image' => 'data:image/png;base64,' . $json['data'][0]['b64_json']]);
}
