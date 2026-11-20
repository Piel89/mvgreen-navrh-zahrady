<?php
/**
 * Roční plán péče o trávník – nová prodejní stránka „Trávník podle plánu“ (2026-11-16).
 *
 * Martin 2026-11-16: stránka podle schváleného náhledu (artefakt „Trávník podle plánu“): nadpis, před/po, časová osa,
 * dotazník, výsledek z „mozku“ (assets/brain.js), cena 499 Kč. Obec → automaticky nadmořská výška a podnebí za
 * posledních 5 let (mrazy, půda 10 °C, srážky, tropické dny, vítr).
 * Mantinel (CLAUDE.md): prohlížeč zákazníka se nesmí připojovat k třetím stranám → obce i podnebí jsou v datech
 * pluginu (data/klima/, GeoNames + ERA5-Land, obojí CC BY 4.0 – zdarma i komerčně), nikdo se nevolá. Fonty i fotky z našeho serveru.
 *
 * Shortcode: [mvgreen_plan_travnik]
 */
if (!defined('ABSPATH')) exit;

add_shortcode('mvgreen_plan_travnik', function () {
    if (post_password_required()) return get_the_password_form();
    $base = plugin_dir_url(__FILE__);
    $v = MVGREEN_VERSION;
    wp_enqueue_style('mvgreen-web-fonts', $base . 'assets/fonts.css', [], $v);
    wp_enqueue_style('mvgreen-plan-page', $base . 'assets/plan-page.css', ['mvgreen-web-fonts'], $v);
    wp_enqueue_script('mvgreen-care', $base . 'assets/garden-care.js', [], $v, true);
    wp_enqueue_script('mvgreen-lawn-kb', $base . 'assets/lawn-kb.js', [], $v, true);
    wp_enqueue_script('mvgreen-brain', $base . 'assets/brain.js', ['mvgreen-care', 'mvgreen-lawn-kb'], $v, true);
    wp_enqueue_script('mvgreen-plan-quiz', $base . 'assets/plan-quiz.js', [], $v, true);
    wp_enqueue_script('mvgreen-plan-output', $base . 'assets/plan-output.js', ['mvgreen-brain'], $v, true);
    wp_enqueue_script('mvgreen-plan-page', $base . 'assets/plan-page.js', ['mvgreen-brain', 'mvgreen-plan-output', 'mvgreen-plan-quiz'], $v, true);
    wp_add_inline_script('mvgreen-plan-page', 'window.MVGreenPlanPage = ' . wp_json_encode([
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('mvgreen_ai_test'),
        'img' => $base . 'assets/web/plan/',
        // Správce webu vidí celý plán bez platby (kontrola před spuštěním).
        'admin' => current_user_can('manage_options'),
        'terms' => home_url('/obchodni-podminky/'),
    ]) . ';', 'before');
    return '<div class="mvg-plan" id="mvg-plan"><p class="mvg-plan-loading">Načítání…</p></div>';
});

/**
 * Obec → poloha, nadmořská výška a podnebí za posledních 5 let – VŠE Z DAT ULOŽENÝCH V PLUGINU, nic se nevolá ven.
 * Martin 2026-11-16: „zkus najít jiný zdroj, který bude zadarmo“ (Open-Meteo je zdarma jen nekomerčně).
 * Data (data/klima/): obce.json = GeoNames (CC BY 4.0), klima-cr.json = Copernicus ERA5-Land (CC BY 4.0), průměry
 * spočítané jednorázově u nás (scratchpad era5/process.py, stejná pravidla jako dřívější výpočet). Aktualizovat 1× ročně.
 */
add_action('wp_ajax_mvgreen_climate', 'mvgreen_climate_handle');
add_action('wp_ajax_nopriv_mvgreen_climate', 'mvgreen_climate_handle');

function mvgreen_klima_data($file) {
    static $cache = [];
    if (!isset($cache[$file])) {
        $p = __DIR__ . '/data/klima/' . $file;
        $cache[$file] = is_readable($p) ? json_decode(file_get_contents($p), true) : null;
    }
    return $cache[$file];
}

function mvgreen_norm_name($s) {
    $s = function_exists('remove_accents') ? remove_accents($s) : $s;
    return trim(preg_replace('/\s+/', ' ', mb_strtolower($s)));
}

function mvgreen_climate_handle() {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    $raw = isset($_POST['obec']) ? trim(sanitize_text_field(wp_unslash($_POST['obec']))) : '';
    if (mb_strlen($raw) < 2 || mb_strlen($raw) > 80) wp_send_json_error(['message' => 'Zadejte prosím název obce.']);
    $obce = mvgreen_klima_data('obce.json');
    $grid = mvgreen_klima_data('klima-cr.json');
    if (!$obce || !$grid) wp_send_json_error(['message' => 'Data o obcích teď nejsou k dispozici.']);

    // „Lhota, Plzeň-jih“ → obec + okres (rozliší stejnojmenné obce)
    $parts = array_map('trim', explode(',', $raw, 2));
    $name = mvgreen_norm_name($parts[0]);
    $okres = isset($parts[1]) ? mvgreen_norm_name($parts[1]) : '';
    $exact = []; $prefix = [];
    foreach ($obce['rows'] as $r) { // řazeno podle počtu obyvatel – větší obec první
        $n = mvgreen_norm_name($r[0]);
        if ($okres !== '' && strpos(mvgreen_norm_name($r[1]), $okres) === false && strpos(mvgreen_norm_name($r[6]), $okres) === false) continue;
        if ($n === $name) $exact[] = $r; elseif (strpos($n, $name) === 0 && count($prefix) < 5) $prefix[] = $r;
        if (count($exact) >= 5) break;
    }
    $hits = $exact ?: $prefix;
    if (!$hits) wp_send_json_error(['message' => 'Obec jsme nenašli. Zkontrolujte název, případně přidejte okres (např. „Lhota, Plzeň-jih“).']);
    $o = $hits[0];
    $others = array_slice(array_map(function ($r) { return $r[0] . ', ' . $r[1]; }, $hits), 1, 4);

    // nejbližší bod mřížky s daty (ERA5-Land nemá data nad vodou – zkusit okolí)
    $f = $grid['fields'];
    $ci = (int) round(($o[2] - $grid['lat0']) / $grid['dlat']);
    $cj = (int) round(($o[3] - $grid['lon0']) / $grid['dlon']);
    $cell = null;
    for ($rad = 0; $rad <= 2 && !$cell; $rad++) {
        for ($di = -$rad; $di <= $rad && !$cell; $di++) for ($dj = -$rad; $dj <= $rad && !$cell; $dj++) {
            $v = $grid['grid'][$ci + $di][$cj + $dj] ?? null;
            if ($v && $v[0] !== null) $cell = $v;
        }
    }
    if (!$cell) wp_send_json_error(['message' => 'Pro tuto obec nemáme data o počasí.']);
    $clim = array_combine($f, $cell);
    $clim['years'] = (int) $grid['years'];
    $clim['elevation'] = $o[4];
    $clim['galeDays'] = null; // nárazy větru ERA5-Land neobsahuje
    $clim['source'] = 'Počasí: Copernicus Climate Change Service, ERA5-Land (CC BY 4.0); obce: GeoNames (CC BY 4.0).';
    wp_send_json_success(['place' => $o[0], 'admin' => trim($o[1] . ($o[6] ? ', ' . $o[6] : ''), ', '), 'others' => $others, 'climate' => $clim + ['place' => $o[0]]]);
}
