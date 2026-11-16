<?php
/**
 * Roční plán péče o trávník – nová prodejní stránka „Trávník podle plánu“ (2026-11-16).
 *
 * Martin 2026-11-16: stránka podle schváleného náhledu (artefakt „Trávník podle plánu“): nadpis, před/po, časová osa,
 * dotazník, výsledek z „mozku“ (assets/brain.js), cena 499 Kč. Obec → automaticky nadmořská výška a podnebí za
 * posledních 5 let (mrazy, půda 10 °C, srážky, tropické dny, vítr).
 * Mantinel (CLAUDE.md): prohlížeč zákazníka se nesmí připojovat k třetím stranám → geokódování a klimatická data
 * stahuje SERVER (Open-Meteo), výsledek se kešuje. Fonty i fotky jsou z našeho serveru.
 * ⚠ Open-Meteo je zdarma jen pro nekomerční použití – před ostrým prodejem vyřešit licenci (Martin ví, 2026-11-16).
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
    wp_enqueue_script('mvgreen-plan-page', $base . 'assets/plan-page.js', ['mvgreen-brain'], $v, true);
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
 * Obec → poloha, nadmořská výška a podnebí za posledních 5 celých let. Volá server (ne prohlížeč zákazníka).
 * Kešuje se: geokódování podle názvu 30 dní, klima podle polohy 30 dní. Omezení počtu dotazů z jedné IP.
 */
add_action('wp_ajax_mvgreen_climate', 'mvgreen_climate_handle');
add_action('wp_ajax_nopriv_mvgreen_climate', 'mvgreen_climate_handle');

function mvgreen_climate_handle() {
    check_ajax_referer('mvgreen_ai_test', 'nonce');
    $name = isset($_POST['obec']) ? trim(sanitize_text_field(wp_unslash($_POST['obec']))) : '';
    if (mb_strlen($name) < 2 || mb_strlen($name) > 60) wp_send_json_error(['message' => 'Zadejte prosím název obce.']);

    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'x';
    $rk = 'mvgreen_clim_rl_' . md5($ip);
    $n = (int) get_transient($rk);
    if ($n >= 30) wp_send_json_error(['message' => 'Příliš mnoho dotazů za sebou. Zkuste to prosím za chvíli.']);
    set_transient($rk, $n + 1, HOUR_IN_SECONDS);

    $args = ['timeout' => 20, 'user-agent' => 'MVGreen-plan/' . MVGREEN_VERSION . '; ' . home_url('/')];
    $gk = 'mvgreen_geo_' . md5(mb_strtolower($name));
    $place = get_transient($gk);
    if (!$place) {
        $r = wp_remote_get('https://geocoding-api.open-meteo.com/v1/search?' . http_build_query(['name' => $name, 'count' => 10, 'language' => 'cs', 'format' => 'json']), $args);
        if (is_wp_error($r) || wp_remote_retrieve_response_code($r) !== 200) wp_send_json_error(['message' => 'Obec se teď nepodařilo ověřit. Zkuste to prosím znovu.']);
        $j = json_decode(wp_remote_retrieve_body($r), true);
        $hit = null;
        foreach (($j['results'] ?? []) as $x) { if (($x['country_code'] ?? '') === 'CZ') { $hit = $x; break; } }
        if (!$hit) wp_send_json_error(['message' => 'Obec v ČR jsme nenašli. Zkontrolujte prosím název.']);
        $place = ['name' => $hit['name'], 'admin' => trim(($hit['admin2'] ?? '') . (isset($hit['admin1']) ? ', ' . $hit['admin1'] : ''), ', '),
            'lat' => round((float) $hit['latitude'], 3), 'lon' => round((float) $hit['longitude'], 3)];
        set_transient($gk, $place, 30 * DAY_IN_SECONDS);
    }

    $y1 = (int) gmdate('Y') - 1; $y0 = $y1 - 4;
    $ck = 'mvgreen_clim_' . md5($place['lat'] . ',' . $place['lon'] . ',' . $y0);
    $clim = get_transient($ck);
    if (!$clim) {
        $q = ['latitude' => $place['lat'], 'longitude' => $place['lon'], 'start_date' => $y0 . '-01-01', 'end_date' => $y1 . '-12-31',
            'daily' => 'temperature_2m_min,temperature_2m_max,precipitation_sum,wind_gusts_10m_max,soil_temperature_7_to_28cm_mean', 'timezone' => 'Europe/Prague'];
        $r = wp_remote_get('https://archive-api.open-meteo.com/v1/archive?' . http_build_query($q), ['timeout' => 40] + $args);
        if (is_wp_error($r) || wp_remote_retrieve_response_code($r) !== 200) wp_send_json_error(['message' => 'Podnebí se teď nepodařilo načíst. Zkuste to prosím znovu.']);
        $j = json_decode(wp_remote_retrieve_body($r), true);
        $clim = mvgreen_climate_stats($j);
        if (!$clim) wp_send_json_error(['message' => 'Podnebí se nepodařilo spočítat.']);
        $clim['elevation'] = isset($j['elevation']) ? (float) $j['elevation'] : null;
        set_transient($ck, $clim, 30 * DAY_IN_SECONDS);
    }
    wp_send_json_success(['place' => $place['name'], 'admin' => $place['admin'], 'climate' => $clim + ['place' => $place['name']]]);
}

/** Průměry za roky: poslední jarní / první podzimní mráz, půda ≥ 10 °C (5 dní po sobě) a zpět pod 10 °C, srážky, tropické dny, dny s nárazy ≥ 60 km/h. Dny = pořadí dne v roce. */
function mvgreen_climate_stats($j) {
    $d = $j['daily'] ?? null;
    if (!$d || empty($d['time'])) return null;
    $years = [];
    foreach ($d['time'] as $i => $t) {
        $y = (int) substr($t, 0, 4);
        $doy = (int) date('z', strtotime($t));
        $years[$y][] = ['doy' => $doy, 'tmin' => $d['temperature_2m_min'][$i], 'tmax' => $d['temperature_2m_max'][$i],
            'p' => $d['precipitation_sum'][$i], 'g' => $d['wind_gusts_10m_max'][$i], 's' => $d['soil_temperature_7_to_28cm_mean'][$i]];
    }
    $acc = ['lastSpringFrost' => [], 'firstAutumnFrost' => [], 'soil10' => [], 'soilBelow10' => [], 'rainYear' => [], 'hotDays' => [], 'galeDays' => []];
    foreach ($years as $a) {
        if (count($a) < 360) continue;
        $ls = null; $fa = null; $s10 = null; $sb = null; $rain = 0; $hot = 0; $gale = 0;
        $cnt = count($a);
        foreach ($a as $k => $x) {
            if ($x['tmin'] !== null && $x['tmin'] < 0) { if ($x['doy'] < 182) $ls = $x['doy']; elseif ($fa === null) $fa = $x['doy']; }
            $rain += (float) $x['p'];
            if ($x['tmax'] !== null && $x['tmax'] >= 30) $hot++;
            if ($x['g'] !== null && $x['g'] >= 60) $gale++;
            if ($k + 4 < $cnt) {
                $win = array_slice($a, $k, 5);
                $allAbove = true; $allBelow = true;
                foreach ($win as $w) { if ($w['s'] === null || $w['s'] < 10) $allAbove = false; if ($w['s'] === null || $w['s'] >= 10) $allBelow = false; }
                if ($s10 === null && $x['doy'] > 40 && $allAbove) $s10 = $x['doy'];
                if ($sb === null && $x['doy'] >= 200 && $allBelow) $sb = $x['doy'];
            }
        }
        if ($ls !== null) $acc['lastSpringFrost'][] = $ls;
        if ($fa !== null) $acc['firstAutumnFrost'][] = $fa;
        if ($s10 !== null) $acc['soil10'][] = $s10;
        if ($sb !== null) $acc['soilBelow10'][] = $sb;
        $acc['rainYear'][] = $rain; $acc['hotDays'][] = $hot; $acc['galeDays'][] = $gale;
    }
    if (!$acc['rainYear']) return null;
    $out = ['years' => count($acc['rainYear'])];
    foreach ($acc as $k => $vals) $out[$k] = $vals ? round(array_sum($vals) / count($vals), 1) : null;
    return $out;
}
