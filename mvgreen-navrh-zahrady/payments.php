<?php
/**
 * MVGreen – placené AI návrhy pro veřejnost (bez účtu).
 *
 * Tok: návštěvník zadá e-mail → vytvoří se platba u GoPay → po zaplacení GoPay
 * zavolá notifikaci → server si stav platby VŽDY ověří zpět u GoPay (notifikace
 * sama o sobě není důvěryhodná, nemá podpis) → teprve pak se aktivuje kód a
 * pošle e-mailem. Kód pak návštěvník zadá v návrháři místo přihlášení správce.
 *
 * Nastavení (wp-config.php):
 *   define('MVGREEN_GOPAY_CLIENT_ID', '...');
 *   define('MVGREEN_GOPAY_CLIENT_SECRET', '...');
 *   define('MVGREEN_GOPAY_GOID', '...');
 *   define('MVGREEN_GOPAY_SANDBOX', true); // false až na ostro
 */
if (!defined('ABSPATH')) exit;

/** Jeden balíček pro start. Pole do budoucna umožňuje přidat další bez změny toku. */
function mvgreen_packages() {
    return [
        '1' => ['uses' => 1, 'price' => 89, 'label' => '1 AI návrh zahrady'],
    ];
}

function mvgreen_package($id) {
    $packages = mvgreen_packages();
    return isset($packages[$id]) ? $packages[$id] : null;
}

/* ---------------------------------------------------------------------- *
 * Uložení kódu: vlastní typ příspěvku, název příspěvku = kód.
 * ---------------------------------------------------------------------- */

add_action('init', function () {
    register_post_type('mvgreen_kod', [
        'labels' => [
            'name' => 'Kódy návrhů',
            'singular_name' => 'Kód návrhu',
            'menu_name' => 'Kódy návrhů',
            'all_items' => 'Všechny kódy',
            'edit_item' => 'Kód návrhu',
            'not_found' => 'Zatím žádné kódy',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'menu_position' => 27,
        'menu_icon' => 'dashicons-tickets-alt',
        'supports' => ['title'],
        'capability_type' => 'post',
        'capabilities' => ['create_posts' => 'do_not_allow'],
        'map_meta_cap' => true,
    ]);
});

/** Kód čitelný pro člověka, bez matoucích znaků (0/O, 1/I/L). ~50 bitů entropie. */
function mvgreen_generate_code() {
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $raw = '';
    for ($i = 0; $i < 10; $i++) $raw .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return substr($raw, 0, 5) . '-' . substr($raw, 5, 5);
}

function mvgreen_generate_unique_code() {
    for ($i = 0; $i < 8; $i++) {
        $code = mvgreen_generate_code();
        if (!mvgreen_find_code_post($code)) return $code;
    }
    return mvgreen_generate_code() . '-' . wp_generate_password(4, false, false);
}

/** Přesná shoda na název příspěvku (WP_Query ji interně parametrizuje – bezpečné). */
function mvgreen_find_code_post($code) {
    $code = strtoupper(trim((string) $code));
    if (!preg_match('~^[A-Z0-9]{5}-[A-Z0-9]{4,9}$~', $code)) return null;
    $found = get_posts(['post_type' => 'mvgreen_kod', 'title' => $code, 'post_status' => 'any', 'numberposts' => 1]);
    return $found ? $found[0] : null;
}

/**
 * Atomicky odečte jedno použití kódu (ošetřuje souběh dvou paralelních požadavků
 * se stejným kódem – jediný UPDATE s podmínkou meta_value > 0, žádné čtení-pak-zápis).
 * Vrací ID příspěvku při úspěchu, jinak WP_Error.
 */
function mvgreen_redeem_code_use($code) {
    global $wpdb;
    $post = mvgreen_find_code_post($code);
    if (!$post) return new WP_Error('invalid', 'Neplatný kód.');
    if (get_post_meta($post->ID, '_mvg_status', true) !== 'paid') return new WP_Error('invalid', 'Kód ještě není aktivní nebo byl zrušen.');
    $updated = $wpdb->query($wpdb->prepare(
        "UPDATE {$wpdb->postmeta} SET meta_value = meta_value - 1 WHERE post_id = %d AND meta_key = %s AND meta_value > 0",
        $post->ID, '_mvg_uses_left'
    ));
    if (!$updated) return new WP_Error('exhausted', 'Tento kód je už vyčerpaný.');
    return (int) $post->ID;
}

/** Omezení počtu pokusů na IP – proti zkoušení kódů naslepo. */
function mvgreen_code_rate_limited() {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'x';
    $key = 'mvgreen_kod_rl_' . md5($ip);
    $count = (int) get_transient($key);
    if ($count >= 20) return true;
    set_transient($key, $count + 1, HOUR_IN_SECONDS);
    return false;
}

/* ---------------------------------------------------------------------- *
 * GoPay REST API v3
 * ---------------------------------------------------------------------- */

function mvgreen_gopay_configured() {
    return defined('MVGREEN_GOPAY_CLIENT_ID') && MVGREEN_GOPAY_CLIENT_ID
        && defined('MVGREEN_GOPAY_CLIENT_SECRET') && MVGREEN_GOPAY_CLIENT_SECRET
        && defined('MVGREEN_GOPAY_GOID') && MVGREEN_GOPAY_GOID;
}

function mvgreen_gopay_sandbox() {
    return defined('MVGREEN_GOPAY_SANDBOX') && MVGREEN_GOPAY_SANDBOX;
}

function mvgreen_gopay_base() {
    return mvgreen_gopay_sandbox() ? 'https://gw.sandbox.gopay.com/api' : 'https://gate.gopay.cz/api';
}

/** OAuth2 client_credentials token, krátce kešovaný v transientu. */
function mvgreen_gopay_token() {
    if (!mvgreen_gopay_configured()) return false;
    $cached = get_transient('mvgreen_gopay_token');
    if ($cached) return $cached;
    $response = wp_remote_post(mvgreen_gopay_base() . '/oauth2/token', [
        'headers' => [
            'Authorization' => 'Basic ' . base64_encode(MVGREEN_GOPAY_CLIENT_ID . ':' . MVGREEN_GOPAY_CLIENT_SECRET),
            'Content-Type' => 'application/x-www-form-urlencoded',
            'Accept' => 'application/json',
        ],
        'body' => 'grant_type=client_credentials&scope=payment-all',
        'timeout' => 20,
    ]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) return false;
    $json = json_decode(wp_remote_retrieve_body($response), true);
    if (empty($json['access_token'])) return false;
    $ttl = isset($json['expires_in']) ? max(60, (int) $json['expires_in'] - 120) : 1500;
    set_transient('mvgreen_gopay_token', $json['access_token'], $ttl);
    return $json['access_token'];
}

/** Vytvoří platbu u GoPay. Vrací pole s 'id' a 'gw_url', nebo WP_Error. */
function mvgreen_gopay_create_payment($amount_kc, $order_number, $email, $description) {
    $token = mvgreen_gopay_token();
    if (!$token) return new WP_Error('gopay_auth', 'Platební bránu se nepodařilo kontaktovat.');
    $payload = [
        'target' => ['type' => 'ACCOUNT', 'goid' => MVGREEN_GOPAY_GOID],
        'amount' => (int) round($amount_kc * 100),
        'currency' => 'CZK',
        'order_number' => $order_number,
        'order_description' => $description,
        'items' => [['name' => $description, 'amount' => (int) round($amount_kc * 100), 'count' => 1]],
        'callback' => [
            'return_url' => admin_url('admin-post.php?action=mvgreen_gopay_return'),
            'notification_url' => admin_url('admin-post.php?action=mvgreen_gopay_notify'),
        ],
        'lang' => 'CS',
    ];
    if ($email) $payload['payer'] = ['contact' => ['email' => $email]];
    $response = wp_remote_post(mvgreen_gopay_base() . '/payments/payment', [
        'headers' => ['Authorization' => 'Bearer ' . $token, 'Content-Type' => 'application/json', 'Accept' => 'application/json'],
        'body' => wp_json_encode($payload), 'timeout' => 30,
    ]);
    if (is_wp_error($response)) return new WP_Error('gopay_http', 'Spojení s platební bránou selhalo.');
    $status = wp_remote_retrieve_response_code($response);
    $json = json_decode(wp_remote_retrieve_body($response), true);
    if ($status < 200 || $status >= 300 || empty($json['id']) || empty($json['gw_url'])) {
        return new WP_Error('gopay_create', 'Platbu se nepodařilo vytvořit.');
    }
    return ['id' => (string) $json['id'], 'gw_url' => $json['gw_url']];
}

/** Autoritativní dotaz na stav platby – nikdy nevěřit datům z notifikace samotné. */
function mvgreen_gopay_payment_status($gopay_id) {
    $token = mvgreen_gopay_token();
    if (!$token) return new WP_Error('gopay_auth', 'Platební bránu se nepodařilo kontaktovat.');
    $response = wp_remote_get(mvgreen_gopay_base() . '/payments/payment/' . rawurlencode($gopay_id), [
        'headers' => ['Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'],
        'timeout' => 20,
    ]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        return new WP_Error('gopay_status', 'Stav platby se nepodařilo ověřit.');
    }
    $json = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($json) || empty($json['state'])) return new WP_Error('gopay_status', 'Neplatná odpověď brány.');
    return $json;
}

/* ---------------------------------------------------------------------- *
 * Nákup: formulář (vykresluje assets/app.js) → admin-post handler → GoPay
 * ---------------------------------------------------------------------- */

add_action('admin_post_nopriv_mvgreen_buy', 'mvgreen_buy_handle');
add_action('admin_post_mvgreen_buy', 'mvgreen_buy_handle');

function mvgreen_buy_handle() {
    $back = isset($_POST['mvg_back']) ? esc_url_raw(wp_unslash($_POST['mvg_back'])) : home_url('/');
    $back = wp_validate_redirect($back, home_url('/'));

    if (!isset($_POST['mvg_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['mvg_nonce'])), 'mvgreen_ai_test')) {
        mvgreen_buy_redirect($back, 'chyba-bezpecnost');
    }
    // Honeypot + minimální doba vyplnění.
    $started = isset($_POST['mvg_t']) ? (int) $_POST['mvg_t'] : 0;
    if (!empty($_POST['mvg_web']) || ($started && time() - $started < 2)) mvgreen_buy_redirect($back, 'chyba-udaje');

    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'x';
    $ip_key = 'mvgreen_buy_' . md5($ip);
    $count = (int) get_transient($ip_key);
    if ($count >= 8) mvgreen_buy_redirect($back, 'chyba-limit');
    set_transient($ip_key, $count + 1, HOUR_IN_SECONDS);

    $email = sanitize_email(wp_unslash($_POST['mvg_email'] ?? ''));
    if (!$email || !is_email($email)) mvgreen_buy_redirect($back, 'chyba-email');

    $package_id = isset($_POST['mvg_package']) ? sanitize_key(wp_unslash($_POST['mvg_package'])) : '1';
    $package = mvgreen_package($package_id);
    if (!$package) mvgreen_buy_redirect($back, 'chyba-udaje');

    if (!mvgreen_gopay_configured()) mvgreen_buy_redirect($back, 'chyba-platba-nenastavena');

    $code = mvgreen_generate_unique_code();
    $post_id = wp_insert_post([
        'post_type' => 'mvgreen_kod',
        'post_status' => 'publish',
        'post_title' => $code,
    ], true);
    if (is_wp_error($post_id) || !$post_id) mvgreen_buy_redirect($back, 'chyba-platba');

    $order_number = 'MVG-' . $post_id . '-' . wp_generate_password(4, false, false);
    update_post_meta($post_id, '_mvg_email', $email);
    update_post_meta($post_id, '_mvg_uses_total', (int) $package['uses']);
    update_post_meta($post_id, '_mvg_uses_left', 0);
    update_post_meta($post_id, '_mvg_amount', (int) $package['price']);
    update_post_meta($post_id, '_mvg_status', 'pending');
    update_post_meta($post_id, '_mvg_order_number', $order_number);

    $payment = mvgreen_gopay_create_payment((int) $package['price'], $order_number, $email, $package['label']);
    if (is_wp_error($payment)) {
        update_post_meta($post_id, '_mvg_status', 'canceled');
        mvgreen_buy_redirect($back, 'chyba-platba');
    }
    update_post_meta($post_id, '_mvg_gopay_id', $payment['id']);

    wp_redirect($payment['gw_url']);
    exit;
}

function mvgreen_buy_redirect($back, $status) {
    wp_safe_redirect(add_query_arg('mvg_platba', $status, $back) . '#mvg-koupit');
    exit;
}

/** Návrat z GoPay: jen orientační zpráva. Kód posílá výhradně ověřená notifikace níže. */
add_action('admin_post_nopriv_mvgreen_gopay_return', 'mvgreen_gopay_return_handle');
add_action('admin_post_mvgreen_gopay_return', 'mvgreen_gopay_return_handle');

function mvgreen_gopay_return_handle() {
    $back = wp_validate_redirect(wp_get_referer(), home_url('/'));
    $gopay_id = isset($_GET['id']) ? sanitize_text_field(wp_unslash($_GET['id'])) : '';
    $status = 'cekame';
    if ($gopay_id && preg_match('~^\d+$~', $gopay_id)) {
        $posts = get_posts(['post_type' => 'mvgreen_kod', 'meta_key' => '_mvg_gopay_id', 'meta_value' => $gopay_id, 'numberposts' => 1, 'post_status' => 'any']);
        if ($posts && get_post_meta($posts[0]->ID, '_mvg_status', true) === 'paid') $status = 'diky';
    }
    $home = wp_validate_redirect($back, home_url('/'));
    wp_safe_redirect(add_query_arg('mvg_platba', $status, $home) . '#mvg-koupit');
    exit;
}

/**
 * Notifikace GoPay: nezabezpečené GET s pouze "id" – podle dokumentace GoPay bez podpisu.
 * Bere se jen jako signál "zkontroluj stav"; teprve autentizovaný dotaz na stav rozhoduje,
 * a částka i číslo objednávky se porovnají s tím, co máme uložené u sebe.
 */
add_action('admin_post_nopriv_mvgreen_gopay_notify', 'mvgreen_gopay_notify_handle');
add_action('admin_post_mvgreen_gopay_notify', 'mvgreen_gopay_notify_handle');

function mvgreen_gopay_notify_handle() {
    $gopay_id = isset($_GET['id']) ? sanitize_text_field(wp_unslash($_GET['id'])) : '';
    if (!$gopay_id || !preg_match('~^\d+$~', $gopay_id)) { status_header(400); exit; }

    $posts = get_posts(['post_type' => 'mvgreen_kod', 'meta_key' => '_mvg_gopay_id', 'meta_value' => $gopay_id, 'numberposts' => 1, 'post_status' => 'any']);
    if (!$posts) { status_header(200); exit; } // neznámá platba pro nás – nic nedělat, ale potvrdit příjem

    $post = $posts[0];
    if (get_post_meta($post->ID, '_mvg_status', true) === 'paid') { status_header(200); exit; } // idempotentní

    $data = mvgreen_gopay_payment_status($gopay_id);
    if (is_wp_error($data)) { status_header(502); exit; }

    $expected_amount = (int) round(((float) get_post_meta($post->ID, '_mvg_amount', true)) * 100);
    $expected_order = (string) get_post_meta($post->ID, '_mvg_order_number', true);
    $amount_ok = isset($data['amount']) && (int) $data['amount'] === $expected_amount;
    $order_ok = isset($data['order_number']) && (string) $data['order_number'] === $expected_order;

    if ($data['state'] === 'PAID' && $amount_ok && $order_ok) {
        mvgreen_activate_code($post->ID);
    } elseif (in_array($data['state'], ['CANCELED', 'TIMEOUTED'], true)) {
        update_post_meta($post->ID, '_mvg_status', 'canceled');
    }
    status_header(200);
    exit;
}

/** Aktivuje kód (uvolní použití) a pošle ho e-mailem. Volá se jen po ověřeném stavu PAID. */
function mvgreen_activate_code($post_id) {
    $uses = (int) get_post_meta($post_id, '_mvg_uses_total', true);
    update_post_meta($post_id, '_mvg_status', 'paid');
    update_post_meta($post_id, '_mvg_uses_left', $uses);
    $email = get_post_meta($post_id, '_mvg_email', true);
    $code = get_post_field('post_title', $post_id);
    if ($email && is_email($email) && $code) {
        $subject = 'MV GREEN – váš kód pro AI návrh zahrady';
        $body = "Dobrý den,\n\ndíky za platbu. Váš kód pro AI návrh zahrady je:\n\n    " . $code . "\n\n"
            . "Zadejte ho v návrháři zahrady v kroku generování návrhu. Kód platí pro " . $uses . " vygenerování.\n\nMV GREEN";
        wp_mail($email, $subject, $body);
    }
}

/* ---------------------------------------------------------------------- *
 * Veřejné AJAX endpointy pro návrhář (assets/app.js)
 * ---------------------------------------------------------------------- */

/** Jen ověří platnost kódu, nic nečerpá – pro okamžitou zpětnou vazbu ve formuláři. */
add_action('wp_ajax_nopriv_mvgreen_kod_check', 'mvgreen_kod_check_handle');
add_action('wp_ajax_mvgreen_kod_check', 'mvgreen_kod_check_handle');

function mvgreen_kod_check_handle() {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (mvgreen_code_rate_limited()) wp_send_json_error(['message' => 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.']);
    $code = isset($_POST['code']) ? sanitize_text_field(wp_unslash($_POST['code'])) : '';
    $post = mvgreen_find_code_post($code);
    if (!$post) wp_send_json_error(['message' => 'Neplatný kód.']);
    $status = get_post_meta($post->ID, '_mvg_status', true);
    if ($status !== 'paid') wp_send_json_error(['message' => $status === 'pending' ? 'Platba se ještě zpracovává. Zkuste to prosím za chvíli.' : 'Tento kód není platný.']);
    $left = (int) get_post_meta($post->ID, '_mvg_uses_left', true);
    if ($left <= 0) wp_send_json_error(['message' => 'Tento kód je už vyčerpaný.']);
    wp_send_json_success(['left' => $left]);
}

/** Vytvoří platbu přímo z návrháře (AJAX), aby nebylo nutné opouštět stránku před přesměrováním na GoPay. */
add_action('wp_ajax_nopriv_mvgreen_kod_buy', 'mvgreen_kod_buy_handle');
add_action('wp_ajax_mvgreen_kod_buy', 'mvgreen_kod_buy_handle');

function mvgreen_kod_buy_handle() {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'x';
    $ip_key = 'mvgreen_buy_' . md5($ip);
    $count = (int) get_transient($ip_key);
    if ($count >= 8) wp_send_json_error(['message' => 'Odeslali jste několik požadavků za sebou. Zkuste to prosím za chvíli.']);
    set_transient($ip_key, $count + 1, HOUR_IN_SECONDS);

    $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
    if (!$email || !is_email($email)) wp_send_json_error(['message' => 'Zadejte prosím platný e-mail.']);
    if (!mvgreen_gopay_configured()) wp_send_json_error(['message' => 'Platby zatím nejsou spuštěné. Zkuste to prosím později.']);

    $package = mvgreen_package('1');
    $code = mvgreen_generate_unique_code();
    $post_id = wp_insert_post(['post_type' => 'mvgreen_kod', 'post_status' => 'publish', 'post_title' => $code], true);
    if (is_wp_error($post_id) || !$post_id) wp_send_json_error(['message' => 'Platbu se nepodařilo připravit.']);

    $order_number = 'MVG-' . $post_id . '-' . wp_generate_password(4, false, false);
    update_post_meta($post_id, '_mvg_email', $email);
    update_post_meta($post_id, '_mvg_uses_total', (int) $package['uses']);
    update_post_meta($post_id, '_mvg_uses_left', 0);
    update_post_meta($post_id, '_mvg_amount', (int) $package['price']);
    update_post_meta($post_id, '_mvg_status', 'pending');
    update_post_meta($post_id, '_mvg_order_number', $order_number);

    $payment = mvgreen_gopay_create_payment((int) $package['price'], $order_number, $email, $package['label']);
    if (is_wp_error($payment)) {
        update_post_meta($post_id, '_mvg_status', 'canceled');
        wp_send_json_error(['message' => 'Platbu se nepodařilo vytvořit. Zkuste to prosím znovu.']);
    }
    update_post_meta($post_id, '_mvg_gopay_id', $payment['id']);
    wp_send_json_success(['redirect' => $payment['gw_url']]);
}

/**
 * Admin-only: simulace úspěšné platby bez reálného GoPay. Funguje pouze v sandboxu
 * nebo dokud platba není nastavená – jakmile naběhnou ostré GoPay klíče se sandbox
 * vypnutým, endpoint se sám deaktivuje.
 */
add_action('wp_ajax_mvgreen_kod_simulate', function () {
    if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Pouze správce webu.'], 403);
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    if (mvgreen_gopay_configured() && !mvgreen_gopay_sandbox()) {
        wp_send_json_error(['message' => 'Simulace je dostupná jen v testovacím (sandbox) režimu.'], 403);
    }
    $email = sanitize_email(wp_unslash($_POST['email'] ?? 'test@example.com')) ?: 'test@example.com';
    $package = mvgreen_package('1');
    $code = mvgreen_generate_unique_code();
    $post_id = wp_insert_post(['post_type' => 'mvgreen_kod', 'post_status' => 'publish', 'post_title' => $code], true);
    if (is_wp_error($post_id) || !$post_id) wp_send_json_error(['message' => 'Simulaci se nepodařilo vytvořit.']);
    update_post_meta($post_id, '_mvg_email', $email);
    update_post_meta($post_id, '_mvg_uses_total', (int) $package['uses']);
    update_post_meta($post_id, '_mvg_amount', (int) $package['price']);
    update_post_meta($post_id, '_mvg_order_number', 'SIM-' . $post_id);
    update_post_meta($post_id, '_mvg_gopay_id', 'sim-' . $post_id);
    mvgreen_activate_code($post_id);
    wp_send_json_success(['code' => $code, 'left' => (int) get_post_meta($post_id, '_mvg_uses_left', true)]);
});

/* ---------------------------------------------------------------------- *
 * Administrace: přehledové sloupce
 * ---------------------------------------------------------------------- */

add_filter('manage_mvgreen_kod_posts_columns', function ($cols) {
    $new = ['cb' => $cols['cb'], 'title' => 'Kód'];
    $new['mvg_status'] = 'Stav';
    $new['mvg_email'] = 'E-mail';
    $new['mvg_left'] = 'Zbývá';
    $new['date'] = $cols['date'];
    return $new;
});
add_action('manage_mvgreen_kod_posts_custom_column', function ($col, $id) {
    if ($col === 'mvg_status') {
        $map = ['pending' => 'čeká na platbu', 'paid' => 'zaplaceno', 'canceled' => 'zrušeno'];
        $status = get_post_meta($id, '_mvg_status', true);
        echo esc_html($map[$status] ?? $status);
    }
    if ($col === 'mvg_email') echo esc_html(get_post_meta($id, '_mvg_email', true));
    if ($col === 'mvg_left') echo esc_html(get_post_meta($id, '_mvg_uses_left', true) . ' / ' . get_post_meta($id, '_mvg_uses_total', true));
}, 10, 2);
