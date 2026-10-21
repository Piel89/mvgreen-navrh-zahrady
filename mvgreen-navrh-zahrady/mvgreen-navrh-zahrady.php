<?php
/**
 * Plugin Name: MVGreen – Navrhni si zahradu
 * Description: Editor zahrady s upravitelnými plochami, orientačním měřením a zadáním. S volitelnou AI vizualizací pro správce webu.
 * Version: 0.6.25
 * Requires PHP: 7.4
 * Text Domain: mvgreen-navrh-zahrady
 */
if (!defined('ABSPATH')) exit;
add_shortcode('mvgreen_navrh_zahrady', function () {
    wp_enqueue_style('mvgreen-reference-font', 'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;500;600;700;800;900&display=swap', [], null);
    wp_enqueue_style('mvgreen-designer', plugin_dir_url(__FILE__) . 'assets/app.css', ['mvgreen-reference-font'], '0.6.25');
    wp_enqueue_script('mvgreen-plants-805', plugin_dir_url(__FILE__) . 'assets/catalog-805.js', [], '0.6.25', true);
    wp_enqueue_script('mvgreen-designer', plugin_dir_url(__FILE__) . 'assets/app.js', ['mvgreen-plants-805'], '0.6.25', true);
    wp_add_inline_script('mvgreen-designer', 'window.MVGreenAI = '.wp_json_encode(['ajaxUrl'=>admin_url('admin-ajax.php'),'nonce'=>wp_create_nonce('mvgreen_ai_test'),'enabled'=>current_user_can('manage_options')]).';', 'before');
    // Use the exact WordPress site logo; supports classic and block themes.
    $mvgreen_logo_id = (int) get_theme_mod('custom_logo', 0);
    if (!$mvgreen_logo_id) $mvgreen_logo_id = (int) get_option('site_logo', 0);
    $mvgreen_logo_url = $mvgreen_logo_id ? wp_get_attachment_image_url($mvgreen_logo_id, 'full') : false;
    if (!$mvgreen_logo_url) $mvgreen_logo_url = get_site_icon_url(192);
    wp_add_inline_script('mvgreen-designer', 'window.MVGreenBrand = '.wp_json_encode(['logoUrl' => $mvgreen_logo_url ?: '']).';', 'before');

    return '<div class="mvgreen-designer" data-mvgreen-designer><div class="mvgreen-loading">Načítání návrháře…</div></div>';
});

/** Only administrators may use the paid test endpoint. API key stays on the server. */
add_action('wp_ajax_mvgreen_ai_preview', function () {
    if (!current_user_can('manage_options')) wp_send_json_error(['message'=>'Pouze správce webu může spustit test.'], 403);
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (!defined('MVGREEN_OPENAI_API_KEY') || !is_string(MVGREEN_OPENAI_API_KEY) || !MVGREEN_OPENAI_API_KEY) {
        wp_send_json_error(['message'=>'Nejprve nastavte MVGREEN_OPENAI_API_KEY ve wp-config.php.'], 400);
    }
    // Daily limit is enforced server-side. Each attempt is counted before contacting the paid API.
    $daily_limit = max(0, min(20, (int) apply_filters('mvgreen_ai_daily_limit', 1)));
    $daily_key = 'mvgreen_ai_daily_' . gmdate('Ymd');
    $used_today = (int) get_option($daily_key, 0);
    if ($daily_limit === 0 || $used_today >= $daily_limit) wp_send_json_error(['message'=>'Dnešní limit placených AI pokusů byl vyčerpán. Další test je možný zítra.'], 429);
    if (get_transient('mvgreen_ai_preview_lock')) wp_send_json_error(['message'=>'Jiný návrh se právě vytváří. Zkuste to později.'], 429);
    // The original and the edit mask are PNG data URLs; transparent mask pixels are editable.
    $image = isset($_POST['image']) ? wp_unslash($_POST['image']) : '';
    $mask = isset($_POST['mask']) ? wp_unslash($_POST['mask']) : '';
    $instructions = isset($_POST['instructions']) ? sanitize_textarea_field(wp_unslash($_POST['instructions'])) : '';
    if (strlen($image)>12000000 || strlen($mask)>12000000 || strlen($instructions)>2500) wp_send_json_error(['message'=>'Fotografie nebo zadání je příliš velké.'], 413);
    $decode_png = function($data) {
        if (!preg_match('~^data:image/png;base64,([A-Za-z0-9+/=]+)$~D', $data, $m)) return false;
        $bytes = base64_decode($m[1], true);
        return $bytes !== false && strlen($bytes) <= 9000000 && substr($bytes,0,8) === "\x89PNG\r\n\x1a\n" ? $bytes : false;
    };
    $original_bytes = $decode_png($image);
    $mask_bytes = $decode_png($mask);
    if (!$original_bytes || !$mask_bytes) wp_send_json_error(['message'=>'Neplatná fotografie nebo maska.'], 400);
    if (!function_exists('getimagesizefromstring')) wp_send_json_error(['message'=>'Server nepodporuje kontrolu obrázků.'], 500);
    $image_info = @getimagesizefromstring($original_bytes);
    $mask_info = @getimagesizefromstring($mask_bytes);
    if (!$image_info || !$mask_info || $image_info[0] !== $mask_info[0] || $image_info[1] !== $mask_info[1] || $image_info[2] !== IMAGETYPE_PNG || $mask_info[2] !== IMAGETYPE_PNG) {
        wp_send_json_error(['message'=>'Maska musí mít stejnou velikost jako fotografie.'], 400);
    }
    if (get_transient('mvgreen_ai_preview_lock')) wp_send_json_error(['message'=>'Jiný návrh se právě vytváří.'], 429);
    // Lock is acquired before incrementing; duplicate clicks cannot start parallel paid calls.
    set_transient('mvgreen_ai_preview_lock', 1, 240);
    update_option($daily_key, $used_today + 1, false);
    $prompt = "Uprav přiloženou SKUTEČNOU fotografii zahrady jako realistickou fotografickou retuš, nikoliv jako nový obraz. ZACHOVEJ identický úhel kamery, kompozici, geometrii, stávající stromy, dům, plot, pozadí, oblohu, perspektivu a osvětlení. UPRAVUJ POUZE průhledné oblasti masky. Ostatní pixely ponech bez změny. Nové rostliny musí mít věrohodné měřítko, přirozenou strukturu a stíny odpovídající scéně. Žádný malovaný, ilustrativní, CGI, pohádkový ani přehnaně stylizovaný vzhled. Vhodné pro realistickou fotografii skutečně realizovatelné zahrady. Nezobrazuj žádné barevné značky ani text. Zadání: " . $instructions;
    // WordPress HTTP API does not build multipart files automatically; compose a bounded body.
    $boundary = 'mvgreen_' . wp_generate_password(24, false, false);
    $parts = '';
    $field = function($name, $value) use (&$parts, $boundary) {
        $parts .= '--'.$boundary."\r\n".'Content-Disposition: form-data; name="'.$name.'"'."\r\n\r\n".$value."\r\n";
    };
    $file = function($name, $filename, $bytes) use (&$parts, $boundary) {
        $parts .= '--'.$boundary."\r\n".'Content-Disposition: form-data; name="'.$name.'"; filename="'.$filename.'"'."\r\n".'Content-Type: image/png'."\r\n\r\n".$bytes."\r\n";
    };
    $field('model', 'gpt-image-1.5');
    $field('prompt', $prompt);
    $field('quality', 'high');
    $field('size', $image_info[0] > $image_info[1] * 1.15 ? '1536x1024' : ($image_info[1] > $image_info[0] * 1.15 ? '1024x1536' : '1024x1024'));
    $field('input_fidelity', 'high');
    $file('image[]', 'garden.png', $original_bytes);
    $file('mask', 'edit-mask.png', $mask_bytes);
    $parts .= '--'.$boundary."--\r\n";
    $response = wp_remote_post('https://api.openai.com/v1/images/edits', [
        'headers'=>['Authorization'=>'Bearer '.MVGREEN_OPENAI_API_KEY,'Content-Type'=>'multipart/form-data; boundary='.$boundary],
        'body'=>$parts, 'timeout'=>240
    ]);
    delete_transient('mvgreen_ai_preview_lock');
    if (is_wp_error($response)) wp_send_json_error(['message'=>'Spojení s AI selhalo: '.$response->get_error_message()], 502);
    $status = wp_remote_retrieve_response_code($response);
    $json = json_decode(wp_remote_retrieve_body($response), true);
    if ($status<200 || $status>=300) {
        $message = isset($json['error']['message']) ? sanitize_text_field($json['error']['message']) : 'AI vrátila chybu.';
        wp_send_json_error(['message'=>$message], 502);
    }
    if (!empty($json['data'][0]['b64_json'])) {
        wp_send_json_success(['image'=>'data:image/png;base64,'.$json['data'][0]['b64_json']]);
    }
    wp_send_json_error(['message'=>'AI nevrátila obrázek. Kredit mohl být účtován. Před opakováním zkontrolujte účet.'], 502);
});
require_once __DIR__ . '/github-updater.php';
