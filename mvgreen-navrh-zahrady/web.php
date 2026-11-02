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
        'chevron' => '<path d="m6 9 6 6 6-6"/>',
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
    // 2026-11-02, na přání Martina: nástroje z pluginu Navrhni si zahradu (plán péče, AI návrh)
    // nejsou samostatné položky v hlavním menu (bylo nabité/nepřehledné na jednom řádku), ale
    // rozbalovací nabídka "Nástroje" hned za Úvodem - viz .mvg-nav__drop v assets/web.css.
    $tools = [
        ['Plán hnojení a údržby zahrady', home_url('/rocni-plan-pece-a-hnojeni-travniku/')],
        ['AI zahradní architekt', home_url('/navrhni-si-zahradu/')],
    ];
    $current = trailingslashit(strtok(home_url(add_query_arg([])), '?'));
    $link = function ($label, $url) use ($current) {
        $is = trailingslashit($url) === $current && strpos($url, '#') === false;
        return ['html' => '<a href="' . esc_url($url) . '"' . ($is ? ' aria-current="page"' : '') . '>' . esc_html($label) . '</a>', 'active' => $is];
    };
    $nav = $link($items[0][0], $items[0][1])['html'];
    $tools_html = '';
    $tools_active = false;
    foreach ($tools as [$label, $url]) {
        $l = $link($label, $url);
        $tools_html .= $l['html'];
        if ($l['active']) $tools_active = true;
    }
    $nav .= '<div class="mvg-nav__drop' . ($tools_active ? ' mvg-nav__drop--active' : '') . '">'
        . '<button type="button" class="mvg-nav__drop-btn" aria-expanded="false">Nástroje' . mvgreen_web_icon('chevron', 15) . '</button>'
        . '<div class="mvg-nav__drop-panel">' . $tools_html . '</div>'
        . '</div>';
    for ($i = 1; $i < count($items); $i++) {
        $nav .= $link($items[$i][0], $items[$i][1])['html'];
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
        . '<span><a href="' . esc_url(home_url('/obchodni-podminky/')) . '">Obchodní podmínky</a> · <a href="' . esc_url(home_url('/ochrana-osobnich-udaju/')) . '">Ochrana osobních údajů</a> · <a href="' . esc_url(home_url('/zasady-cookies-eu/')) . '">Zásady cookies</a> · <a href="#" class="cmplz-show-banner">Nastavení cookies</a></span></div></footer>'
        . '<nav class="mvg-callbar" aria-label="Rychlý kontakt">'
        . '<a class="mvg-call" href="tel:' . MVGREEN_PHONE_INTL . '">' . mvgreen_web_icon('phone', 20) . 'Zavolat</a>'
        . '<a href="https://wa.me/420723339650">' . mvgreen_web_icon('chat', 20) . 'WhatsApp</a>'
        . '<a href="' . esc_url(home_url('/kontakty/#poptavka')) . '">' . mvgreen_web_icon('form', 20) . 'Poptávka</a>'
        . '</nav>';
});

// 2026-11-02, na přání Martina: stránky chráněné heslem (zatím Plán péče a AI architekt, dokud
// nejede platba) mají mít místo strohé výchozí WP hlášky přívětivé "připravujeme" sdělení, ať
// návštěvníci vědí, že se mají na co těšit, a kdo heslo zná (Martin, GoPay recenze), se dostane dál.
add_filter('the_password_form', function ($form) {
    ob_start(); ?>
    <div class="mvg-wrap" style="max-width:560px;padding:56px 24px;text-align:center">
        <div class="mvg-card" style="padding:36px 28px">
            <span class="mvg-eyebrow">Připravujeme</span>
            <h2 style="margin:0 0 12px">Brzy v provozu 🌱</h2>
            <p class="mvg-lead" style="margin:0 auto 24px;font-size:17px">Na téhle stránce chystáme pro MV GREEN něco nového. Dejte nám prosím ještě chvilku a sledujte nás na Facebooku nebo Instagramu – dáme vědět, jakmile bude spuštěno.</p>
            <form action="<?php echo esc_url(home_url('/wp-login.php?action=postpass', 'login_post')); ?>" method="post" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
                <label for="mvg-pwbox" class="screen-reader-text">Heslo</label>
                <input name="post_password" id="mvg-pwbox" type="password" placeholder="Máte heslo? Zadejte ho zde" size="24" style="flex:1;min-width:220px;max-width:280px;border:1px solid #c9dccf;border-radius:10px;padding:13px 16px;font:inherit">
                <input type="submit" name="Submit" value="Vstoupit" class="mvg-btn mvg-btn--primary" style="border:0">
            </form>
        </div>
    </div>
    <?php
    return '<div class="mvg-site">' . ob_get_clean() . '</div>';
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

/**
 * Obchodní podmínky pro placený digitální obsah (AI návrh zahrady / roční plán péče o trávník),
 * prodávaný přes mvgreen.cz a placený kartou přes GoPay. Vlož shortcode [mvgreen_obchodni_podminky]
 * na novou stránku se slugem /obchodni-podminky/ (na ten odkazuje souhlas při placení v návrháři
 * i patička webu). Datum účinnosti v textu se bere z data poslední úpravy této stránky ve WP.
 */
add_shortcode('mvgreen_obchodni_podminky', function () {
    $ucinnost = get_option('mvgreen_vop_ucinnost');
    if (!$ucinnost) {
        $ucinnost = date_i18n('j. n. Y');
        update_option('mvgreen_vop_ucinnost', $ucinnost, false);
    }
    $sec = function ($h, $body) {
        return '<section class="mvg-legal__sec"><h2>' . esc_html($h) . '</h2>' . $body . '</section>';
    };
    $out = '<div class="mvg-legal mvg-site mvg-wrap">'
        . '<h1>Obchodní podmínky</h1>'
        . '<p class="mvg-legal__intro">Těmito obchodními podmínkami se řídí nákup digitálního obsahu (AI návrh zahrady a/nebo roční plán péče o trávník) na webu mvgreen.cz. Podmínky jsou vydané podle § 1751 zákona č. 89/2012 Sb., občanský zákoník, a jsou účinné od ' . esc_html($ucinnost) . '.</p>';

    $out .= $sec('1. Prodávající', '<ul>'
        . '<li>Martin Vondrovic, podnikající pod obchodním označením MV GREEN</li>'
        . '<li>IČO: 21119121, místo podnikání: Pelechy 46, 344 01 Domažlice</li>'
        . '<li>fyzická osoba podnikající na základě živnostenského oprávnění, nezapsaná v obchodním rejstříku</li>'
        . '<li>není plátcem DPH – uvedené ceny jsou konečné</li>'
        . '<li>kontakt: <a href="mailto:' . MVGREEN_EMAIL . '">' . MVGREEN_EMAIL . '</a>, <a href="tel:' . MVGREEN_PHONE_INTL . '">' . esc_html(MVGREEN_PHONE) . '</a></li>'
        . '</ul>');

    $out .= $sec('2. Co se prodává', '<p>Předmětem prodeje je výhradně digitální obsah nedodávaný na hmotném nosiči, vygenerovaný na základě údajů, které kupující sám zadá:</p><ul>'
        . '<li><strong>AI návrh zahrady (89 Kč)</strong> – vizualizace zahrady vytvořená pomocí umělé inteligence z fotografie a popisu zadaného kupujícím, včetně orientačního rozmístění výsadby, seznamu rostlin s cenou a plánu péče.</li>'
        . '<li><strong>Roční plán péče o trávník (49 Kč)</strong> – dvanáctiměsíční plán hnojení a péče o trávník sestavený podle plochy, lokality a stavu trávníku, které kupující zadá.</li>'
        . '<li><strong>Balíček AI návrh + roční plán péče (119 Kč)</strong> – obojí výše zvýhodněně.</li>'
        . '</ul><p>Nejde o odbornou zahradnickou ani zahradně-architektonickou konzultaci na místě, ani o závazné projektové či stavební řešení. Výstupy jsou orientační a vycházejí z údajů zadaných kupujícím a obecných agronomických doporučení – před realizací je vhodné je ověřit na místě.</p>');

    $out .= $sec('3. Objednávka a uzavření smlouvy', '<p>Kupující zadá e-mail, potvrdí souhlas podle čl. 5 a zaplatí cenu předem přes platební bránu. Kupní smlouva je uzavřena okamžikem připsání platby a aktivace přístupového kódu.</p>');

    $out .= $sec('4. Cena a platba', '<p>Ceny jednotlivých balíčků jsou uvedeny na webu a jsou konečné (prodávající není plátcem DPH). Platbu lze provést výhradně online přes platební bránu <strong><a href="https://www.gopay.com" target="_blank" rel="noopener">GoPay</a></strong>, platební kartou nebo dalším způsobem podle aktuální nabídky brány. Údaje o platební kartě prodávající nikdy nevidí ani neukládá – zpracovává je výhradně GoPay, podle vlastních obchodních podmínek dostupných na gopay.com.</p>');

    $out .= $sec('5. Dodání a souhlas s okamžitým zahájením plnění', '<p>Digitální obsah je dodán ihned po úspěšném zaplacení: přístupový kód se zároveň zašle na zadaný e-mail a výsledek (AI návrh, resp. plán péče) se zobrazí přímo na webu po zadání kódu. Žádné fyzické zboží se nezasílá, doprava se neúčtuje.</p><p>Spotřebitel má podle § 1829 občanského zákoníku právo odstoupit od smlouvy uzavřené na dálku do 14 dnů bez udání důvodu. Protože ale jde o digitální obsah nedodávaný na hmotném nosiči, který je dodán okamžitě, uplatní se výjimka podle § 1837 písm. l) občanského zákoníku: <strong>právo na odstoupení od smlouvy zaniká, jakmile bylo s výslovným souhlasem kupujícího zahájeno plnění před uplynutím 14denní lhůty.</strong> Tento souhlas kupující uděluje zaškrtnutím políčka před zaplacením; bez něj se plnění nezahájí. Udělením souhlasu kupující bere na vědomí, že tím právo na odstoupení od smlouvy ztrácí.</p>');

    $out .= $sec('6. Reklamace', '<p>Právo na odstoupení se podle čl. 5 na tento obsah nevztahuje, odpovědnost prodávajícího za vady (např. nedoručený kód, nefunkční odkaz, chybně vypočtený plán) tím ale není dotčena. Reklamaci uplatněte na <a href="mailto:' . MVGREEN_EMAIL . '">' . MVGREEN_EMAIL . '</a>; prodávající ji vyřídí nejpozději do 30 dnů. Je-li reklamace oprávněná, má kupující právo na nápravu (opravné vygenerování či zaslání obsahu) nebo na vrácení zaplacené částky.</p>');

    $out .= $sec('7. Mimosoudní řešení sporů', '<p>Spotřebitel má právo na mimosoudní řešení sporu u <a href="https://www.coi.cz" target="_blank" rel="noopener">České obchodní inspekce</a> (www.coi.cz) nebo prostřednictvím platformy <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ODR Evropské komise</a>.</p>');

    $out .= $sec('8. Ochrana osobních údajů', '<p>Zpracování osobních údajů (e-mail, fotografie zahrady apod.) upravuje samostatná stránka <a href="' . esc_url(home_url('/ochrana-osobnich-udaju/')) . '">Ochrana osobních údajů</a>.</p>');

    $out .= $sec('9. Závěrečná ustanovení', '<p>Tyto podmínky se řídí právním řádem České republiky, zejména občanským zákoníkem (č. 89/2012 Sb.) a zákonem o ochraně spotřebitele (č. 634/1992 Sb.). Prodávající může podmínky v přiměřeném rozsahu měnit; pro konkrétní objednávku platí znění účinné v okamžiku jejího učinění.</p>');

    return $out . '</div>';
});
