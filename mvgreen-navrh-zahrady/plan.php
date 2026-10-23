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

add_action('wp_ajax_mvgreen_ai_plan', function () {
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Pouze správce webu může vytvořit půdorys.'], 403);
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!defined('MVGREEN_OPENAI_API_KEY') || !MVGREEN_OPENAI_API_KEY) wp_send_json_error(['message' => 'Chybí MVGREEN_OPENAI_API_KEY.'], 400);
    // Levné volání, přesto denní strop proti chybám ve smyčce.
    $key = 'mvgreen_plan_daily_' . gmdate('Ymd');
    $used = (int) get_option($key, 0);
    if ($used >= 20) wp_send_json_error(['message' => 'Dnešní limit půdorysů byl vyčerpán.'], 429);

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
        . ($markers ? "Na fotografii PO jsou bílo-zelené kroužky s čísly 1–{$markers}; každý označuje jeden NOVÝ záhon z návrhu (i když na stejném místě dřív rostlo něco jiného). Vrať PŘESNĚ {$markers} prvků type bed s no = číslem kroužku a is_new true, u každého VŽDY s rostlinami, které jsou v něm na fotce PO vidět – žádné jiné záhony nepřidávej. Popisek podle polohy, např. „Záhon vlevo u trávníku“. Kroužky samotné nejsou součástí zahrady. "
            : "ZÁHON (type bed, is_new true) zakresli JEN tam, kde je na fotografii PO skutečně vidět nová výsadba, která na fotce PŘED není. Nic si nevymýšlej. ")
        . "Polygony se nesmí překrývat kromě stromů a keřů. "
        . "U každého nového záhonu uveď rostliny, které jsou v něm na fotce vidět, a reálný počet kusů pro jeho plochu (trvalky 5–7 ks/m², traviny 3–5 ks/m², keře 1 ks na 1–2 m²; nejvýš 4 druhy na menší záhon). Počet kusů musí odpovídat ploše záhonu. "
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
});

// Poslední uložený AI výstup (pro správce – nový půdorys bez dalšího placeného obrázku).
add_action('wp_ajax_mvgreen_ai_last', function () {
    if (!current_user_can('manage_options')) wp_send_json_error([], 403);
    wp_send_json_success(['stem' => get_option('mvgreen_ai_last_log')]);
});

/**
 * Pohled z jiného úhlu (ptačí perspektiva) – volitelný placený obrázek. AI tu má volnost úhlu,
 * proto se výsledek vždy označuje jako ilustrační pohled, ne jako upravená fotografie.
 */
add_action('wp_ajax_mvgreen_ai_angle', function () {
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Pouze správce webu.'], 403);
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!defined('MVGREEN_OPENAI_API_KEY') || !MVGREEN_OPENAI_API_KEY) wp_send_json_error(['message' => 'Chybí MVGREEN_OPENAI_API_KEY.'], 400);
    $daily_limit = max(0, min(20, (int) get_option('mvgreen_ai_daily_limit', 1)));
    $daily_key = 'mvgreen_ai_daily_' . gmdate('Ymd');
    $used_today = (int) get_option($daily_key, 0);
    if ($daily_limit === 0 || $used_today >= $daily_limit) wp_send_json_error(['message' => 'Dnešní limit placených AI pokusů byl vyčerpán.'], 429);
    if (get_transient('mvgreen_ai_preview_lock')) wp_send_json_error(['message' => 'Jiný návrh se právě vytváří.'], 429);
    $image = isset($_POST['image']) ? wp_unslash($_POST['image']) : '';
    if (!preg_match('~^data:image/png;base64,([A-Za-z0-9+/=]+)$~D', $image, $m)) wp_send_json_error(['message' => 'Neplatný obrázek.'], 400);
    $bytes = base64_decode($m[1], true);
    if (!$bytes || strlen($bytes) > 9000000) wp_send_json_error(['message' => 'Obrázek je příliš velký.'], 413);
    $view = (isset($_POST['view']) && $_POST['view'] === 'aerial') ? 'aerial' : 'raised';
    // Pořadí ve výrazu níže: aerial = ptačí perspektiva, raised = mírně zvednutý pohled (výchozí).
    $plan = isset($_POST['plan']) ? sanitize_textarea_field(wp_unslash($_POST['plan'])) : '';
    set_transient('mvgreen_ai_preview_lock', 1, 240);
    update_option($daily_key, $used_today + 1, false);
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
    $code = wp_remote_retrieve_response_code($response);
    if ($code < 200 || $code >= 300 || empty($json['data'][0]['b64_json'])) {
        wp_send_json_error(['message' => isset($json['error']['message']) ? sanitize_text_field($json['error']['message']) : 'AI nevrátila obrázek.'], 200);
    }
    $up = wp_upload_dir();
    $dir = trailingslashit($up['basedir']) . 'mvgreen-ai-log';
    if (wp_mkdir_p($dir)) @file_put_contents($dir . '/' . gmdate('Ymd-His') . '-' . wp_generate_password(10, false, false) . '-uhel-' . $view . '.png', base64_decode($json['data'][0]['b64_json']));
    wp_send_json_success(['image' => 'data:image/png;base64,' . $json['data'][0]['b64_json']]);
});
