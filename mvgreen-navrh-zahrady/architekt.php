<?php
/**
 * MVGreen AI architekt v2 – nový průvodce a výstup (přestavba podle schváleného návrhu vzhledu,
 * 2026-11-08). Běží vedle původního [mvgreen_navrh_zahrady] na samostatné zkušební stránce
 * (soukromá / chráněná heslem), dokud neprojde 5 návrhů po sobě bez chyby.
 *
 * Shortcode: [mvgreen_ai_architekt]                 – celý průvodce (fotka → … → 11stránkové PDF)
 *            [mvgreen_ai_architekt ukazka="1" pred="URL" po="URL"] – jen ukázkový výkres
 * Fotky z ukázky se zadávají z knihovny médií – do pluginu (veřejný repozitář) se fotky zákazníků
 * nikdy neukládají.
 *
 * Znovu používá ověřené moduly původního návrháře: ai-safety.js (příprava fotky, ochrana toho,
 * co má zůstat, oprava výsledku), mg-paint-mask.js (označení štětcem), catalog-805.js, a serverová
 * volání mvgreen_ai_preview_start/_step (generování), mvgreen_ai_plan (půdorys z výsledku)
 * a mvgreen_ai_plant_facts (údaje o rostlinách a koncept).
 */
if (!defined('ABSPATH')) exit;

add_shortcode('mvgreen_ai_architekt', function ($atts) {
    if (post_password_required()) return get_the_password_form();
    $a = shortcode_atts(['pred' => '', 'po' => '', 'ukazka' => ''], $atts, 'mvgreen_ai_architekt');
    $base = plugin_dir_url(__FILE__);
    $v = MVGREEN_VERSION;
    wp_enqueue_style('mvgreen-reference-font', $base . 'assets/fonts.css', [], $v);
    wp_enqueue_style('mvgreen-architekt', $base . 'assets/v2/architekt.css', ['mvgreen-reference-font'], $v);
    wp_enqueue_script('mvgreen-plants-805', $base . 'assets/catalog-805.js', [], $v, true);
    wp_enqueue_script('mvgreen-ai-safety', $base . 'assets/ai-safety.js', [], $v, true);
    wp_enqueue_script('mvgreen-paint-mask', $base . 'assets/mg-paint-mask.js', ['mvgreen-ai-safety'], $v, true);
    wp_enqueue_script('mvgreen-brief', $base . 'assets/garden-brief.js', [], $v, true);
    wp_enqueue_script('mvgreen-plan-render', $base . 'assets/v2/plan-render.js', [], $v, true);
    wp_enqueue_script('mvgreen-architekt-pdf', $base . 'assets/v2/architekt-pdf.js', ['mvgreen-plan-render'], $v, true);
    wp_enqueue_script('mvgreen-architekt', $base . 'assets/v2/architekt.js', ['mvgreen-plan-render', 'mvgreen-architekt-pdf', 'mvgreen-ai-safety', 'mvgreen-paint-mask', 'mvgreen-plants-805', 'mvgreen-brief'], $v, true);
    $logo_id = (int) get_theme_mod('custom_logo', 0);
    if (!$logo_id) $logo_id = (int) get_option('site_logo', 0);
    $logo = $logo_id ? wp_get_attachment_image_url($logo_id, 'medium') : '';
    // Stejný objekt jako u původního návrháře – mg-paint-mask.js z něj bere adresu Web Workeru.
    wp_add_inline_script('mvgreen-architekt', 'window.MVGreenAI = window.MVGreenAI || ' . wp_json_encode([
        'ajaxUrl' => admin_url('admin-ajax.php'), 'nonce' => wp_create_nonce('mvgreen_ai_test'),
        'enabled' => current_user_can('manage_options'), 'workerUrl' => plugins_url('assets/mg-segment-worker.js', __FILE__),
    ]) . ';', 'before');
    wp_add_inline_script('mvgreen-architekt', 'window.MVGreenArchitekt = ' . wp_json_encode([
        'logo' => $logo ?: get_site_icon_url(192),
        'demo' => $a['ukazka'] === '1',
        'photoBefore' => esc_url_raw($a['pred']),
        'photoAfter' => esc_url_raw($a['po']),
        'isAdmin' => current_user_can('manage_options'),
    ]) . ';', 'before');
    return '<div data-mvgreen-architekt class="mvg2"><p>Načítání…</p></div>';
});
