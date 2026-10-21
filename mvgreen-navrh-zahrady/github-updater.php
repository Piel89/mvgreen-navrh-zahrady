<?php
/** GitHub updates for MVGreen. No API token required for public repository. */
if (!defined('ABSPATH')) exit;

function mvgreen_github_update_meta() {
    $cached = get_transient('mvgreen_github_update_meta');
    if (is_array($cached) && !wp_doing_cron() && !(is_admin() && (isset($_GET['force-check']) || isset($_GET['force_check'])))) return $cached;
    $response = wp_remote_get('https://raw.githubusercontent.com/Piel89/mvgreen-navrh-zahrady/main/version.json', ['timeout' => 12]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) return false;
    $data = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($data) || empty($data['version']) || !preg_match('/^\d+\.\d+\.\d+$/', $data['version'])) return false;
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
    return $transient;
};
add_filter('pre_set_site_transient_update_plugins', $mvgreen_update_inject);
add_filter('site_transient_update_plugins', $mvgreen_update_inject);

add_filter('upgrader_source_selection', function ($source, $remote_source, $upgrader, $hook_extra = []) {
    $plugin = isset($hook_extra['plugin']) ? $hook_extra['plugin'] : '';
    if ($plugin !== 'mvgreen-navrh-zahrady/mvgreen-navrh-zahrady.php') return $source;
    $nested = trailingslashit($source) . 'mvgreen-navrh-zahrady/';
    if (!file_exists($nested . 'mvgreen-navrh-zahrady.php')) return new WP_Error('mvgreen_update_layout', 'GitHub balíček neobsahuje očekávaný plugin.');
    return $nested;
}, 10, 4);
