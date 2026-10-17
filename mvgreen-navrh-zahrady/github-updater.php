<?php
/** GitHub updates for MVGreen. No API token required for public repository. */
if (!defined('ABSPATH')) exit;

function mvgreen_github_update_meta() {
    $cached = get_transient('mvgreen_github_update_meta');
    if (is_array($cached) && !wp_doing_cron() && !(is_admin() && isset($_GET['force-check']))) return $cached;
    $response = wp_remote_get('https://raw.githubusercontent.com/Piel89/mvgreen-navrh-zahrady/main/version.json', ['timeout' => 12]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) return false;
    $data = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($data) || empty($data['version']) || !preg_match('/^\d+\.\d+\.\d+$/', $data['version'])) return false;
    set_transient('mvgreen_github_update_meta', $data, 3 * HOUR_IN_SECONDS);
    return $data;
}

add_filter('pre_set_site_transient_update_plugins', function ($transient) {
    if (!is_object($transient) || empty($transient->checked)) return $transient;
    $basename = plugin_basename(__DIR__ . '/mvgreen-navrh-zahrady.php');
    if (empty($transient->checked[$basename])) return $transient;
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
});

add_filter('upgrader_source_selection', function ($source, $remote_source, $upgrader, $hook_extra = []) {
    $plugin = isset($hook_extra['plugin']) ? $hook_extra['plugin'] : '';
    if ($plugin !== 'mvgreen-navrh-zahrady/mvgreen-navrh-zahrady.php') return $source;
    $nested = trailingslashit($source) . 'mvgreen-navrh-zahrady/';
    if (!file_exists($nested . 'mvgreen-navrh-zahrady.php')) return new WP_Error('mvgreen_update_layout', 'GitHub balíček neobsahuje očekávaný plugin.');
    return $nested;
}, 10, 4);
