<?php
/**
 * Plugin Name: MVGreen – Navrhni si zahradu
 * Description: Editor zahrady s upravitelnými plochami, orientačním měřením a zadáním. S volitelnou AI vizualizací pro správce webu.
 * Version: 0.6.111
 * Requires PHP: 7.4
 * Text Domain: mvgreen-navrh-zahrady
 */
if (!defined('ABSPATH')) exit;

// Single source of truth for asset cache-busting below. Each enqueue was previously pinned to a
// hardcoded '0.6.66' string that never moved across several later releases, so browsers (and any
// cache in front of the site) could keep serving old JS/CSS after an update even though the plugin
// itself had updated – a stale-cache bug fixed here, not just for this release.
define('MVGREEN_VERSION', '0.6.111');

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
    // Matches the real mvgreen.cz site, verified by inspecting its live computed styles:
    // Montserrat for headings (700/800), Inter for body text/buttons (400–900). Previously this
    // loaded Roboto Condensed under a mistaken assumption that it matched the real site – it
    // never did, and a later patch (see assets/app.css) had already silently papered over most
    // of the visible effect by forcing Inter back on via !important; this corrects it at the source.
    wp_enqueue_style('mvgreen-reference-font', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@700;800;900&display=swap', [], null);
    wp_enqueue_style('mvgreen-designer', plugin_dir_url(__FILE__) . 'assets/app.css', ['mvgreen-reference-font'], MVGREEN_VERSION);
    wp_enqueue_script('mvgreen-plants-805', plugin_dir_url(__FILE__) . 'assets/catalog-805.js', [], MVGREEN_VERSION, true);
    wp_enqueue_script('mvgreen-ai-safety', plugin_dir_url(__FILE__) . 'assets/ai-safety.js', [], MVGREEN_VERSION, true);
    // Step 4's paint-based marking tool (protect/remove categories, snapped to superpixel segments
    // computed client-side in a Web Worker – see mg-slic.js/mg-segment-worker.js's own headers).
    // mg-slic.js itself is never enqueued here: only the Worker loads it (importScripts, relative
    // to the Worker's own URL below), the main thread never needs it directly.
    wp_enqueue_script('mvgreen-paint-mask', plugin_dir_url(__FILE__) . 'assets/mg-paint-mask.js', ['mvgreen-ai-safety'], MVGREEN_VERSION, true);
    wp_enqueue_script('mvgreen-area-types', plugin_dir_url(__FILE__) . 'assets/mg-area-types.js', ['mvgreen-ai-safety'], MVGREEN_VERSION, true);
    wp_enqueue_script('mvgreen-brief', plugin_dir_url(__FILE__) . 'assets/garden-brief.js', [], MVGREEN_VERSION, true);
    wp_enqueue_script('mvgreen-plan', plugin_dir_url(__FILE__) . 'assets/garden-plan.js', [], MVGREEN_VERSION, true);
    wp_enqueue_script('mvgreen-designer', plugin_dir_url(__FILE__) . 'assets/app.js', ['mvgreen-plants-805', 'mvgreen-ai-safety', 'mvgreen-paint-mask', 'mvgreen-area-types', 'mvgreen-brief', 'mvgreen-plan'], MVGREEN_VERSION, true);
    wp_add_inline_script('mvgreen-designer', 'window.MVGreenAI = '.wp_json_encode(['ajaxUrl'=>admin_url('admin-ajax.php'),'nonce'=>wp_create_nonce('mvgreen_ai_test'),'enabled'=>current_user_can('manage_options'),'workerUrl'=>plugins_url('assets/mg-segment-worker.js', __FILE__)]).';', 'before');
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
    // The photo is a PNG/JPEG data URL. The plain single-call flow sends its own `mask`+
    // `instructions` fields, same as always. The staged pipeline ("5 řešení" revamp, step 2 –
    // app.js's buildStagedPlan) instead sends `stages`: a JSON array of {mask, instructions} pairs,
    // each already scoped to its own deterministic geometric mask (bed/path/remove/remainder) by
    // app.js. Either way this handler ends up with the same $stage_defs shape and chains them, one
    // OpenAI call per stage, inside this SAME request/redeem/lock cycle – a staged design still only
    // ever costs the customer one code.
    $image = isset($_POST['image']) ? wp_unslash($_POST['image']) : '';
    $instructions = isset($_POST['instructions']) ? sanitize_textarea_field(wp_unslash($_POST['instructions'])) : '';
    $stages_raw = isset($_POST['stages']) ? wp_unslash($_POST['stages']) : '';
    // Styles with more plants (e.g. "Okrasné záhony", max 9) plus the free-text customer-notes
    // field legitimately produce instructions well past 2500 chars (measured ~3000 with no notes
    // at all) – that used to trip this guard and fail with a misleading "photo too large" error
    // for a paying customer. The client now truncates notes to 500 chars; 6000 leaves generous
    // headroom above the realistic worst case while still bounding the request. The staged payload
    // can legitimately hold several masks at once, so it gets its own, larger cap.
    if (strlen($image)>12000000 || strlen($instructions)>6000 || strlen($stages_raw)>48000000) wp_send_json_error(['message'=>'Fotografie nebo zadání je příliš velké.'], 413);
    // The photo may be JPEG (small, no alpha needed) or PNG; every mask must stay PNG (needs the alpha channel).
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
        if (!is_string($data) || !preg_match('~^data:image/png;base64,([A-Za-z0-9+/=]+)$~D', $data, $m)) return false;
        $bytes = base64_decode($m[1], true);
        return $bytes !== false && strlen($bytes) <= 9000000 && substr($bytes,0,8) === "\x89PNG\r\n\x1a\n" ? $bytes : false;
    };
    $original_bytes = $decode_photo($image);
    if (!$original_bytes) wp_send_json_error(['message'=>'Neplatná fotografie.'], 400);
    if (!function_exists('getimagesizefromstring')) wp_send_json_error(['message'=>'Server nepodporuje kontrolu obrázků.'], 200);
    $image_info = @getimagesizefromstring($original_bytes);
    $image_type_ok = $image_info && ($image_mime === 'image/jpeg' ? $image_info[2] === IMAGETYPE_JPEG : $image_info[2] === IMAGETYPE_PNG);
    if (!$image_info || !$image_type_ok) wp_send_json_error(['message'=>'Neplatná fotografie.'], 400);
    $allowed_sizes = ['1536x1024', '1024x1536', '1024x1024'];
    if (!in_array($image_info[0] . 'x' . $image_info[1], $allowed_sizes, true)) {
        wp_send_json_error(['message'=>'Fotografie musí být připravena bezpečnostním modulem (bez ořezu). Obnovte stránku a zkuste to znovu.'], 400);
    }
    // Build the ordered list of stages to run. Legacy single-call flow: exactly one stage from the
    // top-level mask+instructions fields (unchanged behaviour, same validation as before). Staged
    // flow: `stages` decodes to an ordered array, each entry already a full-size mask + its own
    // self-contained prompt (see garden-brief.js's buildRemoveStageInstructions and neighbours).
    $stage_defs = [];
    if ($stages_raw !== '') {
        $decoded = json_decode($stages_raw, true);
        if (!is_array($decoded) || !count($decoded) || count($decoded) > 4) {
            wp_send_json_error(['message'=>'Neplatné zadání kroků návrhu.'], 400);
        }
        foreach ($decoded as $stage) {
            if (!is_array($stage) || !isset($stage['mask'], $stage['instructions']) || !is_string($stage['mask']) || !is_string($stage['instructions'])) {
                wp_send_json_error(['message'=>'Neplatné zadání kroků návrhu.'], 400);
            }
            $stage_mask_bytes = $decode_png($stage['mask']);
            $stage_instructions = sanitize_textarea_field($stage['instructions']);
            if (!$stage_mask_bytes || strlen($stage_instructions) > 6000) wp_send_json_error(['message'=>'Neplatné zadání kroků návrhu.'], 400);
            $mi = @getimagesizefromstring($stage_mask_bytes);
            if (!$mi || $mi[0] !== $image_info[0] || $mi[1] !== $image_info[1] || $mi[2] !== IMAGETYPE_PNG) {
                wp_send_json_error(['message'=>'Maska kroku musí mít stejnou velikost jako fotografie.'], 400);
            }
            $stage_defs[] = ['mask' => $stage_mask_bytes, 'instructions' => $stage_instructions];
        }
    } else {
        $mask = isset($_POST['mask']) ? wp_unslash($_POST['mask']) : '';
        if (strlen($mask)>12000000) wp_send_json_error(['message'=>'Fotografie nebo zadání je příliš velké.'], 413);
        $mask_bytes = $decode_png($mask);
        if (!$mask_bytes) wp_send_json_error(['message'=>'Neplatná maska.'], 400);
        $mask_info = @getimagesizefromstring($mask_bytes);
        if (!$mask_info || $mask_info[0] !== $image_info[0] || $mask_info[1] !== $image_info[1] || $mask_info[2] !== IMAGETYPE_PNG) {
            wp_send_json_error(['message'=>'Maska musí mít stejnou velikost jako fotografie.'], 400);
        }
        $stage_defs[] = ['mask' => $mask_bytes, 'instructions' => $instructions];
    }
    // Hard rule: the AI may never repaint the whole photo. Checked against the UNION of every
    // stage's mask (what ends up unlocked across the whole chained result), not each stage alone –
    // a staged design is deliberately split into several small masks that can each be well under
    // the limit on their own but must still add up to a sane total.
    if (function_exists('imagecreatefromstring')) {
        $mw = $image_info[0]; $mh = $image_info[1];
        $cols = (int) ceil($mw / 8); $rows = (int) ceil($mh / 8);
        $union = array_fill(0, max(1, $cols * $rows), false);
        foreach ($stage_defs as $sd) {
            $m = @imagecreatefromstring($sd['mask']);
            if (!$m) wp_send_json_error(['message'=>'Neplatná maska.'], 400);
            $idx = 0;
            for ($y = 0; $y < $mh; $y += 8) {
                for ($x = 0; $x < $mw; $x += 8) {
                    if (!$union[$idx]) {
                        $alpha = (imagecolorat($m, $x, $y) >> 24) & 0x7F; // 127 = fully transparent
                        if ($alpha > 63) $union[$idx] = true;
                    }
                    $idx++;
                }
            }
            imagedestroy($m);
        }
        $total = count($union); $editable = count(array_filter($union));
        $share = $total ? $editable / $total : 1;
        if ($share > 0.72) wp_send_json_error(['message'=>'Upravovaná plocha je příliš velká. Dům, plot, stromy a obloha musí zůstat mimo úpravu.'], 400);
        if ($share < 0.015) wp_send_json_error(['message'=>'Označte prosím plochu zahrady, kterou chcete upravit.'], 400);
    }
    if (get_transient('mvgreen_ai_preview_lock')) wp_send_json_error(['message'=>'Jiný návrh se právě vytváří.'], 429);
    // Lock is acquired before counting the attempt; duplicate clicks cannot start parallel paid calls.
    set_transient('mvgreen_ai_preview_lock', 1, 240);
    // Non-admin success is tied to a specific mvgreen_kod post (the code just redeemed) so the
    // finished result can be saved durably against it and e-mailed – see mvgreen_save_result_and_notify
    // below. Admin tests have no code/post and are never persisted or e-mailed.
    $result_post_id = 0;
    if ($is_admin) {
        update_option($daily_key, $used_today + 1, false);
    } else {
        $redeem = mvgreen_redeem_code_use($code);
        if (is_wp_error($redeem)) {
            delete_transient('mvgreen_ai_preview_lock');
            wp_send_json_error(['message'=>$redeem->get_error_message()], 400);
        }
        $result_post_id = (int) $redeem;
    }
    // One stage = one OpenAI edit call, chained: stage i's output bytes become stage i+1's input, all
    // inside this one redeem/lock cycle. A chain can run several minutes end to end; lift the PHP
    // time limit (best effort – @ in case the host disables this) so a slow host doesn't kill the
    // request mid-chain the way a short default could.
    @set_time_limit(0);
    $size = $image_info[0] > $image_info[1] * 1.15 ? '1536x1024' : ($image_info[1] > $image_info[0] * 1.15 ? '1024x1536' : '1024x1024');
    $run_stage = function($photo_bytes, $photo_mime, $mask_bytes, $stage_instructions) use ($size) {
        $prompt = "Toto je SKUTEČNÁ fotografie konkrétní zahrady. Proveď pouze lokální retuš uvnitř průhledné oblasti masky; mimo ni nesmí být změněn ani jeden pixel. Nevytvářej novou scénu, neměň dům, střechu, okna, fasádu, plot, terén, svah, stromy, oblohu ani úhel pohledu. Šedé okraje fotografie ponech šedé. Uprav přiloženou SKUTEČNOU fotografii zahrady jako realistickou fotografickou retuš, nikoliv jako nový obraz. ZACHOVEJ identický úhel kamery, kompozici, geometrii, stávající stromy, dům, plot, pozadí, oblohu, perspektivu a osvětlení. UPRAVUJ POUZE průhledné oblasti masky. Ostatní pixely ponech bez změny. Nové rostliny musí mít věrohodné měřítko, přirozenou strukturu a stíny odpovídající scéně. Žádný malovaný, ilustrativní, CGI, pohádkový ani přehnaně stylizovaný vzhled. Vhodné pro realistickou fotografii skutečně realizovatelné zahrady. Nezobrazuj žádné barevné značky ani text. Zadání: " . $stage_instructions;
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
        $field('size', $size);
        $field('input_fidelity', 'high');
        $file('image[]', $photo_mime === 'image/jpeg' ? 'garden.jpg' : 'garden.png', $photo_bytes, $photo_mime);
        $file('mask', 'edit-mask.png', $mask_bytes, 'image/png');
        $parts .= '--'.$boundary."--\r\n";
        $response = wp_remote_post('https://api.openai.com/v1/images/edits', [
            'headers'=>['Authorization'=>'Bearer '.MVGREEN_OPENAI_API_KEY,'Content-Type'=>'multipart/form-data; boundary='.$boundary],
            'body'=>$parts, 'timeout'=>240
        ]);
        if (is_wp_error($response)) return ['error' => 'Spojení s AI selhalo: '.$response->get_error_message()];
        $status = wp_remote_retrieve_response_code($response);
        $json = json_decode(wp_remote_retrieve_body($response), true);
        if ($status<200 || $status>=300) {
            return ['error' => isset($json['error']['message']) ? sanitize_text_field($json['error']['message']) : 'AI vrátila chybu.'];
        }
        if (empty($json['data'][0]['b64_json'])) return ['error' => 'AI nevrátila obrázek.'];
        return ['bytes' => base64_decode($json['data'][0]['b64_json'])];
    };
    $current_bytes = $original_bytes; $current_mime = $image_mime;
    $last_good_bytes = $original_bytes; $partial_message = '';
    foreach ($stage_defs as $i => $sd) {
        $r = $run_stage($current_bytes, $current_mime, $sd['mask'], $sd['instructions']);
        if (isset($r['error'])) {
            if ($i === 0) {
                // Nothing usable at all yet – and for the legacy single-call flow this IS the only
                // stage – so this is a hard failure exactly like before.
                delete_transient('mvgreen_ai_preview_lock');
                wp_send_json_error(['message'=>$r['error']], 200);
            }
            // A later stage failed after the customer's one code was already redeemed. Rather than
            // return nothing for a spent credit, keep whatever the chain produced up to here and
            // tell the customer part of the design could not be finished.
            $partial_message = $r['error'];
            break;
        }
        $current_bytes = $r['bytes']; $current_mime = 'image/png';
        $last_good_bytes = $current_bytes;
    }
    delete_transient('mvgreen_ai_preview_lock');
    $final_bytes = $last_good_bytes;
    // Keep every paid output (first stage's input, last stage's mask, final result) so a rejected
    // result can be reviewed without paying again.
    $up = wp_upload_dir();
    $dir = trailingslashit($up['basedir']) . 'mvgreen-ai-log';
    if (wp_mkdir_p($dir)) {
        mvgreen_harden_upload_dir($dir);
        $stem = gmdate('Ymd-His') . '-' . wp_generate_password(10, false, false);
        @file_put_contents($dir . '/' . $stem . '-vstup.png', $original_bytes);
        @file_put_contents($dir . '/' . $stem . '-maska.png', end($stage_defs)['mask']);
        @file_put_contents($dir . '/' . $stem . '-ai.png', $final_bytes);
        $log = glob($dir . '/*.png') ?: [];
        sort($log);
        while (count($log) > 60) @unlink(array_shift($log));
        update_option('mvgreen_ai_last_log', trailingslashit($up['baseurl']) . 'mvgreen-ai-log/' . $stem, false);
    }
    $final_b64 = base64_encode($final_bytes);
    // Durable per-customer copy (never rotated/deleted like the debug log above) plus the
    // "don't lose your design" e-mail – only for a real paid code, never for admin tests.
    if ($result_post_id && function_exists('mvgreen_save_result_and_notify')) {
        mvgreen_save_result_and_notify($result_post_id, $final_b64);
    }
    $payload = ['image'=>'data:image/png;base64,'.$final_b64];
    if ($partial_message !== '') $payload['message'] = 'Část návrhu se nepodařilo dokončit (' . $partial_message . '), zobrazujeme nejlepší dosažený výsledek.';
    wp_send_json_success($payload);
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
