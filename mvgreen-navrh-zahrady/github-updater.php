<?php
/** GitHub updates for MVGreen. No API token required for public repository. */
if (!defined('ABSPATH')) exit;

function mvgreen_github_update_meta() {
    $cached = get_transient('mvgreen_github_update_meta');
    if (is_array($cached) && !wp_doing_cron() && !(is_admin() && (isset($_GET['force-check']) || isset($_GET['force_check'])))) return $cached;
    // Primary: raw file. Fallback: GitHub contents API (different CDN). Errors are kept for diagnosis.
    $data = null; $errors = [];
    $sources = [
        'raw' => 'https://raw.githubusercontent.com/Piel89/mvgreen-navrh-zahrady/main/version.json?nocache=' . floor(time() / 60),
        'api' => 'https://api.github.com/repos/Piel89/mvgreen-navrh-zahrady/contents/version.json?ref=main',
    ];
    foreach ($sources as $kind => $url) {
        $response = wp_remote_get($url, ['timeout' => 12, 'headers' => ['Accept' => $kind === 'api' ? 'application/vnd.github+json' : 'application/json', 'User-Agent' => 'MVGreen-Updater', 'Cache-Control' => 'no-cache']]);
        if (is_wp_error($response)) { $errors[] = $kind . ': ' . $response->get_error_message(); continue; }
        $code = wp_remote_retrieve_response_code($response);
        if ($code !== 200) { $errors[] = $kind . ': HTTP ' . $code; continue; }
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if ($kind === 'api' && is_array($body) && isset($body['content'])) $body = json_decode(base64_decode($body['content']), true);
        if (is_array($body) && !empty($body['version']) && preg_match('/^\d+\.\d+\.\d+$/', $body['version'])) { $data = $body; break; }
        $errors[] = $kind . ': neplatná odpověď';
    }
    update_option('mvgreen_update_last_check', ['time' => time(), 'version' => $data['version'] ?? null, 'errors' => $errors], false);
    if (!$data) return false;
    set_transient('mvgreen_github_update_meta', $data, 5 * MINUTE_IN_SECONDS);
    return $data;
}

$mvgreen_update_inject = function ($transient) {
    if (!is_object($transient)) return $transient;
    if (!isset($transient->checked) || !is_array($transient->checked)) $transient->checked = [];
    if (!isset($transient->response) || !is_array($transient->response)) $transient->response = [];
    $basename = plugin_basename(__DIR__ . '/mvgreen-navrh-zahrady.php');
    if (empty($transient->checked[$basename])) {
        if (!function_exists('get_plugin_data')) require_once ABSPATH . 'wp-admin/includes/plugin.php';
        $plugin_data = get_plugin_data(__DIR__ . '/mvgreen-navrh-zahrady.php', false, false);
        $transient->checked[$basename] = $plugin_data['Version'] ?? '0.0.0';
    }
    $meta = mvgreen_github_update_meta();
    if (!$meta || !version_compare($meta['version'], $transient->checked[$basename], '>')) return $transient;
    $transient->response[$basename] = (object) [
        'slug' => 'mvgreen-navrh-zahrady',
        'plugin' => $basename,
        'new_version' => $meta['version'],
        'url' => 'https://github.com/Piel89/mvgreen-navrh-zahrady',
        'package' => 'https://github.com/Piel89/mvgreen-navrh-zahrady/archive/refs/heads/main.zip',
        'requires' => '6.0',
    ];
    if (isset($transient->no_update[$basename])) unset($transient->no_update[$basename]);
    return $transient;
};
add_filter('pre_set_site_transient_update_plugins', $mvgreen_update_inject);
add_filter('site_transient_update_plugins', $mvgreen_update_inject);
// Also populate the update record on an explicit WP update check.
add_filter('pre_set_site_transient_update_plugins', $mvgreen_update_inject, 999);

add_filter('upgrader_source_selection', function ($source, $remote_source, $upgrader, $hook_extra = []) {
    $plugin = isset($hook_extra['plugin']) ? $hook_extra['plugin'] : '';
    if ($plugin !== 'mvgreen-navrh-zahrady/mvgreen-navrh-zahrady.php') return $source;
    $nested = trailingslashit($source) . 'mvgreen-navrh-zahrady/';
    if (!file_exists($nested . 'mvgreen-navrh-zahrady.php')) return new WP_Error('mvgreen_update_layout', 'GitHub balíček neobsahuje očekávaný plugin.');
    return $nested;
}, 10, 4);

// Admin diagnostics: /wp-admin/admin-ajax.php?action=mvgreen_update_status
add_action('wp_ajax_mvgreen_update_status', function () {
    if (!current_user_can('update_plugins')) wp_send_json_error([], 403);
    wp_send_json_success(['last' => get_option('mvgreen_update_last_check'), 'cached' => get_transient('mvgreen_github_update_meta')]);
});
