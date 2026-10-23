<?php
/**
 * MVGreen – společné prvky webu mvgreen.cz.
 *
 * [mvgreen_hlavicka]  hlavička s logem, menu a telefonem
 * [mvgreen_paticka]   patička s kontakty, odkazy a mobilní lištou Zavolat/WhatsApp/Poptávka
 * [mvgreen_srovnani foto="URL" pred="nahore|dole" titulek="…" popis="…"]
 *                     posuvné srovnání před/po z jedné koláže (dvě fotky nad sebou)
 * [mvgreen_srovnani pred_url="URL" po_url="URL" titulek="…"]  dvě samostatné fotky
 */
if (!defined('ABSPATH')) exit;

const MVGREEN_WEB_VERSION = '1.0.0';
const MVGREEN_PHONE = '723 339 650';
const MVGREEN_PHONE_INTL = '+420723339650';
const MVGREEN_EMAIL = 'mvgreen@seznam.cz';

add_action('wp_enqueue_scripts', function () {
    $ver = MVGREEN_WEB_VERSION . '-' . filemtime(__DIR__ . '/assets/web.css');
    // Fonts are served from this site: no request to Google before cookie consent.
    wp_enqueue_style('mvgreen-web-fonts', plugin_dir_url(__FILE__) . 'assets/fonts.css', [], $ver);
    wp_enqueue_style('mvgreen-web', plugin_dir_url(__FILE__) . 'assets/web.css', ['mvgreen-web-fonts'], $ver);
    wp_enqueue_script('mvgreen-web', plugin_dir_url(__FILE__) . 'assets/web.js', [], $ver, true);
});

function mvgreen_web_icon($name, $size = 18) {
    $paths = [
        'phone' => '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
        'chat' => '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5Z"/>',
        'form' => '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
        'mail' => '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
        'pin' => '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
        'menu' => '<path d="M4 7h16M4 12h16M4 17h16"/>',
        'arrows' => '<path d="m9 6-6 6 6 6"/><path d="m15 6 6 6-6 6"/>',
        'clock' => '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    ];
    return '<svg aria-hidden="true" width="' . (int) $size . '" height="' . (int) $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' . ($paths[$name] ?? '') . '</svg>';
}

function mvgreen_web_logo_url() {
    $id = (int) get_theme_mod('custom_logo', 0);
    if (!$id) $id = (int) get_option('site_logo', 0);
    $url = $id ? wp_get_attachment_image_url($id, 'medium') : '';
    return $url ?: get_site_icon_url(192);
}

add_shortcode('mvgreen_hlavicka', function () {
    $items = [
        ['Úvod', home_url('/')],
        ['Služby a ceny', home_url('/cenik/')],
        ['Naše práce', home_url('/naseprace/')],
        ['Pro obce a firmy', home_url('/#obce')],
        ['Kontakt', home_url('/kontakty/')],
    ];
    $current = trailingslashit(strtok(home_url(add_query_arg([])), '?'));
    $nav = '';
    foreach ($items as [$label, $url]) {
        $is = trailingslashit($url) === $current && strpos($url, '#') === false;
        $nav .= '<a href="' . esc_url($url) . '"' . ($is ? ' aria-current="page"' : '') . '>' . esc_html($label) . '</a>';
    }
    return '<header class="mvg-header mvg-site"><div class="mvg-header__in">'
        . '<a class="mvg-brand" href="' . esc_url(home_url('/')) . '"><img src="' . esc_url(mvgreen_web_logo_url()) . '" alt="MVGreen" width="54" height="52"><span><strong>MV GREEN</strong><span>Péče o zeleň bez starostí</span></span></a>'
        . '<button type="button" class="mvg-menu-btn" aria-expanded="false" aria-label="Menu">' . mvgreen_web_icon('menu', 22) . '</button>'
        . '<nav class="mvg-nav" aria-label="Hlavní">' . $nav . '</nav>'
        . '<a class="mvg-header__call" href="tel:' . MVGREEN_PHONE_INTL . '">' . mvgreen_web_icon('phone') . esc_html(MVGREEN_PHONE) . '</a>'
        . '</div></header>';
});

add_shortcode('mvgreen_paticka', function () {
    $y = gmdate('Y');
    return '<footer class="mvg-footer mvg-site"><div class="mvg-footer__in">'
        . '<div><strong>MV GREEN</strong>Údržba zeleně v Domažlicích a okolí do 40 km. Sekání, vertikutace, živé ploty, štěpkování.</div>'
        . '<div><strong>Kontakt</strong><ul><li><a href="tel:' . MVGREEN_PHONE_INTL . '">' . esc_html(MVGREEN_PHONE) . '</a></li><li><a href="https://wa.me/420723339650">WhatsApp</a></li><li><a href="mailto:' . MVGREEN_EMAIL . '">' . MVGREEN_EMAIL . '</a></li><li>Pelechy 46, 344 01 Domažlice</li></ul></div>'
        . '<div><strong>Stránky</strong><ul><li><a href="' . esc_url(home_url('/cenik/')) . '">Služby a ceny</a></li><li><a href="' . esc_url(home_url('/naseprace/')) . '">Naše práce</a></li><li><a href="' . esc_url(home_url('/kontakty/')) . '">Kontakt</a></li></ul></div>'
        . '<div><strong>Sledujte nás</strong><ul><li><a href="https://www.facebook.com/profile.php?id=61588551020349">Facebook</a></li><li><a href="https://www.instagram.com/mvgreen.cz/">Instagram</a></li><li><a href="https://www.youtube.com/watch?v=-uCsuuhrGrI">YouTube</a></li></ul></div>'
        . '</div><div class="mvg-footer__bottom"><span>© ' . $y . ' MV GREEN · Martin Vondrovic · IČO 21119121</span>'
        . '<span><a href="' . esc_url(home_url('/ochrana-osobnich-udaju/')) . '">Ochrana osobních údajů</a> · <a href="' . esc_url(home_url('/zasady-cookies-eu/')) . '">Zásady cookies</a> · <a href="#" class="cmplz-show-banner">Nastavení cookies</a></span></div></footer>'
        . '<nav class="mvg-callbar" aria-label="Rychlý kontakt">'
        . '<a class="mvg-call" href="tel:' . MVGREEN_PHONE_INTL . '">' . mvgreen_web_icon('phone', 20) . 'Zavolat</a>'
        . '<a href="https://wa.me/420723339650">' . mvgreen_web_icon('chat', 20) . 'WhatsApp</a>'
        . '<a href="' . esc_url(home_url('/kontakty/#poptavka')) . '">' . mvgreen_web_icon('form', 20) . 'Poptávka</a>'
        . '</nav>';
});

add_shortcode('mvgreen_srovnani', function ($a) {
    $a = shortcode_atts(['foto' => '', 'pred' => 'nahore', 'pred_url' => '', 'po_url' => '', 'titulek' => '', 'popis' => '', 'alt' => ''], $a, 'mvgreen_srovnani');
    $alt = $a['alt'] ?: $a['titulek'];
    if ($a['foto']) {
        // One collage with two photos stacked: show the top or bottom half in a 2:1 frame.
        $top = '50% 1.5%'; $bottom = '50% 98.5%';
        $before = ['src' => $a['foto'], 'pos' => $a['pred'] === 'dole' ? $bottom : $top];
        $after = ['src' => $a['foto'], 'pos' => $a['pred'] === 'dole' ? $top : $bottom];
    } elseif ($a['pred_url'] && $a['po_url']) {
        $before = ['src' => $a['pred_url'], 'pos' => '50% 50%'];
        $after = ['src' => $a['po_url'], 'pos' => '50% 50%'];
    } else {
        return '';
    }
    $img = function ($p, $label) use ($alt) {
        return '<img class="mvg-ba__img" src="' . esc_url($p['src']) . '" alt="' . esc_attr(trim($label . ': ' . $alt, ': ')) . '" loading="lazy" decoding="async" style="object-position:' . esc_attr($p['pos']) . '">';
    };
    $cap = $a['titulek'] ? '<figcaption>' . esc_html($a['titulek']) . ($a['popis'] ? '<small>' . esc_html($a['popis']) . '</small>' : '') . '</figcaption>' : '';
    return '<figure class="mvg-ba"><div class="mvg-ba__frame">'
        . $img($after, 'Po')
        . '<div class="mvg-ba__before">' . $img($before, 'Před') . '</div>'
        . '<span class="mvg-ba__line"></span>'
        . '<input class="mvg-ba__range" type="range" min="0" max="100" step="0.5" value="50" aria-label="Posunout srovnání před a po' . ($a['titulek'] ? ' – ' . esc_attr($a['titulek']) : '') . '">'
        . '<span class="mvg-ba__knob">' . mvgreen_web_icon('arrows', 20) . '</span>'
        . '<span class="mvg-ba__tag mvg-ba__tag--before">PŘED</span><span class="mvg-ba__tag mvg-ba__tag--after">PO</span>'
        . '</div>' . $cap . '</figure>';
});
