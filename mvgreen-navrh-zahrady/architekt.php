<?php
/**
 * MVGreen AI architekt v2 – nový průvodce a výstup (přestavba podle schváleného návrhu vzhledu,
 * 2026-11-08). Běží vedle původního [mvgreen_navrh_zahrady] na samostatné, heslem chráněné
 * zkušební stránce, dokud neprojde 5 návrhů po sobě bez chyby.
 *
 * Shortcode: [mvgreen_ai_architekt pred="URL fotky před" po="URL vizualizace po"]
 * Fotky se zadávají z knihovny médií WordPressu – do pluginu (veřejný repozitář na GitHubu)
 * se fotky zákazníků nikdy neukládají.
 */
if (!defined('ABSPATH')) exit;

add_shortcode('mvgreen_ai_architekt', function ($atts) {
    if (post_password_required()) return get_the_password_form();
    $a = shortcode_atts(['pred' => '', 'po' => ''], $atts, 'mvgreen_ai_architekt');
    $base = plugin_dir_url(__FILE__);
    wp_enqueue_style('mvgreen-reference-font', $base . 'assets/fonts.css', [], MVGREEN_VERSION);
    wp_enqueue_style('mvgreen-architekt', $base . 'assets/v2/architekt.css', ['mvgreen-reference-font'], MVGREEN_VERSION);
    wp_enqueue_script('mvgreen-plan-render', $base . 'assets/v2/plan-render.js', [], MVGREEN_VERSION, true);
    wp_enqueue_script('mvgreen-architekt', $base . 'assets/v2/architekt.js', ['mvgreen-plan-render'], MVGREEN_VERSION, true);
    $logo_id = (int) get_theme_mod('custom_logo', 0);
    if (!$logo_id) $logo_id = (int) get_option('site_logo', 0);
    $logo = $logo_id ? wp_get_attachment_image_url($logo_id, 'medium') : '';
    wp_add_inline_script('mvgreen-architekt', 'window.MVGreenArchitekt = ' . wp_json_encode([
        'logo' => $logo ?: get_site_icon_url(192),
        'photoBefore' => esc_url_raw($a['pred']),
        'photoAfter' => esc_url_raw($a['po']),
    ]) . ';', 'before');
    return '<div data-mvgreen-architekt><p>Načítání…</p></div>';
});
