<?php
/**
 * Plugin Name: MVGreen – Navrhni si zahradu
 * Description: Editor zahrady s upravitelnými plochami, orientačním měřením a zadáním. S volitelnou AI vizualizací pro správce webu.
 * Version: 0.6.72
 * Requires PHP: 7.4
 * Text Domain: mvgreen-navrh-zahrady
 */
if (!defined('ABSPATH')) exit;

/**
 * Defense in depth for upload subfolders: even though every file written here is already
 * validated (real image bytes / server-checked MIME type), block script execution outright
 * in case a misconfigured host would otherwise run a .php file dropped in uploads/.
 */
function mvgreen_harden_upload_dir($dir) {
    if (!file_exists($dir . '/index.php')) @file_put_contents($dir . '/index.php', '<?php // Silence is golden.');
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "<FilesMatch \"\\.(php|phtml|php[0-9]?|pl|py|cgi|asp|aspx|sh)$\">\n"
            . "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n</FilesMatch>\n"
            . "<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\n");
    }
}

add_shortcode('mvgreen_navrh_zahrady', function () {
    wp_enqueue_style('mvgreen-reference-font', 'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;500;600;700;800;900&display=swap', [], null);
    wp_enqueue_style('mvgreen-designer', plugin_dir_url(__FILE__) . 'assets/app.css', ['mvgreen-reference-font'], '0.6.66');
    wp_enqueue_script('mvgreen-plants-805', plugin_dir_url(__FILE__) . 'assets/catalog-805.js', [], '0.6.66', true);
    wp_enqueue_script('mvgreen-ai-safety', plugin_dir_url(__FILE__) . 'assets/ai-safety.js', [], '0.6.66', true);
    wp_enqueue_script('mvgreen-brief', plugin_dir_url(__FILE__) . 'assets/garden-brief.js', [], '0.6.66', true);
    wp_enqueue_script('mvgreen-plan', plugin_dir_url(__FILE__) . 'assets/garden-plan.js', [], '0.6.66', true);
    wp_enqueue_script('mvgreen-designer', plugin_dir_url(__FILE__) . 'assets/app.js', ['mvgreen-plants-805', 'mvgreen-ai-safety', 'mvgreen-brief', 'mvgreen-plan'], '0.6.66', true);
    wp_add_inline_script('mvgreen-designer', 'window.MVGreenAI = '.wp_json_encode(['ajaxUrl'=>admin_url('admin-ajax.php'),'nonce'=>wp_create_nonce('mvgreen_ai_test'),'enabled'=>current_user_can('manage_options')]).';', 'before');
    // Use the exact WordPress site logo; supports classic and block themes.
    $mvgreen_logo_id = (int) get_theme_mod('custom_logo', 0);
    if (!$mvgreen_logo_id) $mvgreen_logo_id = (int) get_option('site_logo', 0);
    $mvgreen_logo_url = $mvgreen_logo_id ? wp_get_attachment_image_url($mvgreen_logo_id, 'full') : false;
    if (!$mvgreen_logo_url) $mvgreen_logo_url = get_site_icon_url(192);
    wp_add_inline_script('mvgreen-designer', 'window.MVGreenBrand = '.wp_json_encode(['logoUrl' => $mvgreen_logo_url ?: '']).';', 'before');

    return '<div class="mvgreen-designer" data-mvgreen-designer><div class="mvgreen-loading">Načítání návrháře…</div></div>';
});

/**
 * Správce testuje zdarma (denní limit). Veřejnost platí přes GoPay a použije
 * jednorázový kód (payments.php) – ten se čerpá atomicky až těsně před
 * zavoláním placeného API, aby se nevyčerpal zbytečně při neplatném vstupu.
 */
$mvgreen_ai_preview_handle = function () {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!defined('MVGREEN_OPENAI_API_KEY') || !is_string(MVGREEN_OPENAI_API_KEY) || !MVGREEN_OPENAI_API_KEY) {
        wp_send_json_error(['message'=>'Nejprve nastavte MVGREEN_OPENAI_API_KEY ve wp-config.php.'], 400);
    }
    $is_admin = current_user_can('manage_options');
    $code = '';
    if ($is_admin) {
        // Daily limit is enforced server-side. Each attempt is counted before contacting the paid API.
        $daily_limit = max(0, min(20, (int) apply_filters('mvgreen_ai_daily_limit', (int) get_option('mvgreen_ai_daily_limit', 1))));
        $daily_key = 'mvgreen_ai_daily_' . gmdate('Ymd');
        $used_today = (int) get_option($daily_key, 0);
        if ($daily_limit === 0 || $used_today >= $daily_limit) wp_send_json_error(['message'=>'Dnešní limit placených AI pokusů byl vyčerpán. Další test je možný zítra.'], 429);
    } else {
        if (!function_exists('mvgreen_redeem_code_use')) wp_send_json_error(['message'=>'Placené návrhy zatím nejsou dostupné.'], 503);
        if (mvgreen_code_rate_limited()) wp_send_json_error(['message'=>'Příliš mnoho pokusů. Zkuste to prosím za chvíli.'], 429);
        $code = isset($_POST['code']) ? sanitize_text_field(wp_unslash($_POST['code'])) : '';
        if ($code === '') wp_send_json_error(['message'=>'Zadejte prosím kód z e-mailu.'], 400);
    }
    if (get_transient('mvgreen_ai_preview_lock')) wp_send_json_error(['message'=>'Jiný návrh se právě vytváří. Zkuste to později.'], 429);
    // The original and the edit mask are PNG data URLs; transparent mask pixels are editable.
    $image = isset($_POST['image']) ? wp_unslash($_POST['image']) : '';
    $mask = isset($_POST['mask']) ? wp_unslash($_POST['mask']) : '';
    $instructions = isset($_POST['instructions']) ? sanitize_textarea_field(wp_unslash($_POST['instructions'])) : '';
    // Styles with more plants (e.g. "Okrasné záhony", max 9) plus the free-text customer-notes
    // field legitimately produce instructions well past 2500 chars (measured ~3000 with no notes
    // at all) – that used to trip this guard and fail with a misleading "photo too large" error
    // for a paying customer. The client now truncates notes to 500 chars; 6000 leaves generous
    // headroom above the realistic worst case while still bounding the request.
    if (strlen($image)>12000000 || strlen($mask)>12000000 || strlen($instructions)>6000) wp_send_json_error(['message'=>'Fotografie nebo zadání je příliš velké.'], 413);
    // The photo may be JPEG (small, no alpha needed) or PNG; the mask must stay PNG (needs the alpha channel).
    $image_mime = 'image/png';
    $decode_photo = function($data) use (&$image_mime) {
        if (!preg_match('~^data:(image/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$~D', $data, $m)) return false;
        $bytes = base64_decode($m[2], true);
        if ($bytes === false || strlen($bytes) > 9000000) return false;
        $is_png = substr($bytes,0,8) === "\x89PNG\r\n\x1a\n";
        $is_jpeg = substr($bytes,0,3) === "\xFF\xD8\xFF";
        if ($m[1] === 'image/png' && !$is_png) return false;
        if ($m[1] === 'image/jpeg' && !$is_jpeg) return false;
        $image_mime = $m[1];
        return $bytes;
    };
    $decode_png = function($data) {
        if (!preg_match('~^data:image/png;base64,([A-Za-z0-9+/=]+)$~D', $data, $m)) return false;
        $bytes = base64_decode($m[1], true);
        return $bytes !== false && strlen($bytes) <= 9000000 && substr($bytes,0,8) === "\x89PNG\r\n\x1a\n" ? $bytes : false;
    };
    $original_bytes = $decode_photo($image);
    $mask_bytes = $decode_png($mask);
    if (!$original_bytes || !$mask_bytes) wp_send_json_error(['message'=>'Neplatná fotografie nebo maska.'], 400);
    if (!function_exists('getimagesizefromstring')) wp_send_json_error(['message'=>'Server nepodporuje kontrolu obrázků.'], 200);
    $image_info = @getimagesizefromstring($original_bytes);
    $mask_info = @getimagesizefromstring($mask_bytes);
    $image_type_ok = $image_mime === 'image/jpeg' ? $image_info[2] === IMAGETYPE_JPEG : $image_info[2] === IMAGETYPE_PNG;
    if (!$image_info || !$mask_info || $image_info[0] !== $mask_info[0] || $image_info[1] !== $mask_info[1] || !$image_type_ok || $mask_info[2] !== IMAGETYPE_PNG) {
        wp_send_json_error(['message'=>'Maska musí mít stejnou velikost jako fotografie.'], 400);
    }
    $allowed_sizes = ['1536x1024', '1024x1536', '1024x1024'];
    if (!in_array($image_info[0] . 'x' . $image_info[1], $allowed_sizes, true)) {
        wp_send_json_error(['message'=>'Fotografie musí být připravena bezpečnostním modulem (bez ořezu). Obnovte stránku a zkuste to znovu.'], 400);
    }
    // Hard rule: the AI may never repaint the whole photo. Count editable (transparent) mask pixels.
    if (function_exists('imagecreatefromstring')) {
        $m = @imagecreatefromstring($mask_bytes);
        if (!$m) wp_send_json_error(['message'=>'Neplatná maska.'], 400);
        $mw = imagesx($m); $mh = imagesy($m); $editable = 0; $total = 0;
        for ($y = 0; $y < $mh; $y += 8) {
            for ($x = 0; $x < $mw; $x += 8) {
                $alpha = (imagecolorat($m, $x, $y) >> 24) & 0x7F; // 127 = fully transparent
                $total++;
                if ($alpha > 63) $editable++;
            }
        }
        imagedestroy($m);
        $share = $total ? $editable / $total : 1;
        if ($share > 0.72) wp_send_json_error(['message'=>'Upravovaná plocha je příliš velká. Dům, plot, stromy a obloha musí zůstat mimo úpravu.'], 400);
        if ($share < 0.015) wp_send_json_error(['message'=>'Označte prosím plochu zahrady, kterou chcete upravit.'], 400);
    }
    if (get_transient('mvgreen_ai_preview_lock')) wp_send_json_error(['message'=>'Jiný návrh se právě vytváří.'], 429);
    // Lock is acquired before counting the attempt; duplicate clicks cannot start parallel paid calls.
    set_transient('mvgreen_ai_preview_lock', 1, 240);
    if ($is_admin) {
        update_option($daily_key, $used_today + 1, false);
    } else {
        $redeem = mvgreen_redeem_code_use($code);
        if (is_wp_error($redeem)) {
            delete_transient('mvgreen_ai_preview_lock');
            wp_send_json_error(['message'=>$redeem->get_error_message()], 400);
        }
    }
    $prompt = "Toto je SKUTEČNÁ fotografie konkrétní zahrady. Proveď pouze lokální retuš uvnitř průhledné oblasti masky; mimo ni nesmí být změněn ani jeden pixel. Nevytvářej novou scénu, neměň dům, střechu, okna, fasádu, plot, terén, svah, stromy, oblohu ani úhel pohledu. Šedé okraje fotografie ponech šedé. Uprav přiloženou SKUTEČNOU fotografii zahrady jako realistickou fotografickou retuš, nikoliv jako nový obraz. ZACHOVEJ identický úhel kamery, kompozici, geometrii, stávající stromy, dům, plot, pozadí, oblohu, perspektivu a osvětlení. UPRAVUJ POUZE průhledné oblasti masky. Ostatní pixely ponech bez změny. Nové rostliny musí mít věrohodné měřítko, přirozenou strukturu a stíny odpovídající scéně. Žádný malovaný, ilustrativní, CGI, pohádkový ani přehnaně stylizovaný vzhled. Vhodné pro realistickou fotografii skutečně realizovatelné zahrady. Nezobrazuj žádné barevné značky ani text. Zadání: " . $instructions;
    // WordPress HTTP API does not build multipart files automatically; compose a bounded body.
    $boundary = 'mvgreen_' . wp_generate_password(24, false, false);
    $parts = '';
    $field = function($name, $value) use (&$parts, $boundary) {
        $parts .= '--'.$boundary."\r\n".'Content-Disposition: form-data; name="'.$name.'"'."\r\n\r\n".$value."\r\n";
    };
    $file = function($name, $filename, $bytes, $content_type) use (&$parts, $boundary) {
        $parts .= '--'.$boundary."\r\n".'Content-Disposition: form-data; name="'.$name.'"; filename="'.$filename.'"'."\r\n".'Content-Type: '.$content_type."\r\n\r\n".$bytes."\r\n";
    };
    $field('model', 'gpt-image-1.5');
    $field('prompt', $prompt);
    $field('quality', 'high');
    $field('size', $image_info[0] > $image_info[1] * 1.15 ? '1536x1024' : ($image_info[1] > $image_info[0] * 1.15 ? '1024x1536' : '1024x1024'));
    $field('input_fidelity', 'high');
    $file('image[]', $image_mime === 'image/jpeg' ? 'garden.jpg' : 'garden.png', $original_bytes, $image_mime);
    $file('mask', 'edit-mask.png', $mask_bytes, 'image/png');
    $parts .= '--'.$boundary."--\r\n";
    $response = wp_remote_post('https://api.openai.com/v1/images/edits', [
        'headers'=>['Authorization'=>'Bearer '.MVGREEN_OPENAI_API_KEY,'Content-Type'=>'multipart/form-data; boundary='.$boundary],
        'body'=>$parts, 'timeout'=>240
    ]);
    delete_transient('mvgreen_ai_preview_lock');
    if (is_wp_error($response)) wp_send_json_error(['message'=>'Spojení s AI selhalo: '.$response->get_error_message()], 200);
    $status = wp_remote_retrieve_response_code($response);
    $json = json_decode(wp_remote_retrieve_body($response), true);
    if ($status<200 || $status>=300) {
        $message = isset($json['error']['message']) ? sanitize_text_field($json['error']['message']) : 'AI vrátila chybu.';
        wp_send_json_error(['message'=>$message], 200);
    }
    if (!empty($json['data'][0]['b64_json'])) {
        // Keep every paid output (input, mask, result) so a rejected result can be reviewed without paying again.
        $up = wp_upload_dir();
        $dir = trailingslashit($up['basedir']) . 'mvgreen-ai-log';
        if (wp_mkdir_p($dir)) {
            mvgreen_harden_upload_dir($dir);
            $stem = gmdate('Ymd-His') . '-' . wp_generate_password(10, false, false);
            @file_put_contents($dir . '/' . $stem . '-vstup.png', $original_bytes);
            @file_put_contents($dir . '/' . $stem . '-maska.png', $mask_bytes);
            @file_put_contents($dir . '/' . $stem . '-ai.png', base64_decode($json['data'][0]['b64_json']));
            $log = glob($dir . '/*.png') ?: [];
            sort($log);
            while (count($log) > 60) @unlink(array_shift($log));
            update_option('mvgreen_ai_last_log', trailingslashit($up['baseurl']) . 'mvgreen-ai-log/' . $stem, false);
        }
        wp_send_json_success(['image'=>'data:image/png;base64,'.$json['data'][0]['b64_json']]);
    }
    wp_send_json_error(['message'=>'AI nevrátila obrázek. Kredit mohl být účtován. Před opakováním zkontrolujte účet.'], 200);
};
add_action('wp_ajax_mvgreen_ai_preview', $mvgreen_ai_preview_handle);
add_action('wp_ajax_nopriv_mvgreen_ai_preview', $mvgreen_ai_preview_handle);
// Admin-adjustable daily cap for paid AI tests (Settings REST API, admins only). Default 1.
add_action('init', function () {
    register_setting('options', 'mvgreen_ai_daily_limit', [
        'type' => 'integer', 'default' => 1, 'show_in_rest' => true,
        'sanitize_callback' => function ($v) { return max(0, min(20, (int) $v)); },
    ]);
});
require_once __DIR__ . '/poptavka.php';
require_once __DIR__ . '/web.php';
require_once __DIR__ . '/github-updater.php';
require_once __DIR__ . '/payments.php';
require_once __DIR__ . '/plan.php';
