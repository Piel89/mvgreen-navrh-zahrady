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
    wp_enqueue_script('mvgreen-sketch', $base . 'assets/v2/sketch.js', [], $v, true);
    wp_enqueue_script('mvgreen-architekt-pdf', $base . 'assets/v2/architekt-pdf.js', ['mvgreen-plan-render'], $v, true);
    wp_enqueue_script('mvgreen-architekt', $base . 'assets/v2/architekt.js', ['mvgreen-plan-render', 'mvgreen-architekt-pdf', 'mvgreen-ai-safety', 'mvgreen-paint-mask', 'mvgreen-plants-v2', 'mvgreen-sketch'], $v, true);
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
