<?php
/**
 * MVGreen – poptávkový formulář s fotografiemi.
 *
 * Shortcode: [mvgreen_poptavka]
 * - Každá poptávka se uloží do administrace (Poptávky), takže se neztratí, ani když selže e-mail.
 * - Na e-mail správce webu přijde zpráva s fotkami v příloze (zmenšenými na rozumnou velikost).
 * - Ochrana proti spamu: nonce, skryté pole (honeypot), minimální doba vyplnění, limit na IP.
 */
if (!defined('ABSPATH')) exit;

const MVGREEN_POPTAVKA_MAX_FILES = 6;
const MVGREEN_POPTAVKA_MAX_FILE_BYTES = 12 * 1024 * 1024; // jedna fotka z mobilu
const MVGREEN_POPTAVKA_MAX_TOTAL_BYTES = 40 * 1024 * 1024;

function mvgreen_poptavka_services() {
    return ['Sekání trávníku', 'Vertikutace', 'Živý plot / thuje', 'Štěpkování', 'Pravidelná údržba', 'Jiné'];
}

function mvgreen_poptavka_recipient() {
    // Inquiries go to the business mailbox, not the WordPress admin e-mail.
    return apply_filters('mvgreen_poptavka_recipient', get_option('mvgreen_poptavka_email', 'mvgreen@seznam.cz'));
}

add_action('init', function () {
    register_post_type('mvgreen_poptavka', [
        'labels' => [
            'name' => 'Poptávky',
            'singular_name' => 'Poptávka',
            'menu_name' => 'Poptávky',
            'all_items' => 'Všechny poptávky',
            'edit_item' => 'Poptávka',
            'not_found' => 'Zatím žádné poptávky',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'menu_position' => 26,
        'menu_icon' => 'dashicons-email-alt',
        'supports' => ['title', 'editor'],
        'capability_type' => 'post',
        'capabilities' => ['create_posts' => 'do_not_allow'],
        'map_meta_cap' => true,
    ]);
});

add_shortcode('mvgreen_poptavka', function () {
    $status = isset($_GET['poptavka']) ? sanitize_key(wp_unslash($_GET['poptavka'])) : '';
    $action = esc_url(admin_url('admin-post.php'));
    $services = mvgreen_poptavka_services();
    $privacy = esc_url(apply_filters('mvgreen_poptavka_privacy_url', home_url('/ochrana-osobnich-udaju/')));
    ob_start();
    ?>
<div class="mvg-poptavka" id="poptavka">
<?php if ($status === 'ok') : ?>
  <div class="mvg-pp-msg mvg-pp-ok" role="status"><strong>Děkujeme, poptávka je odeslaná.</strong> Ozveme se co nejdříve, obvykle do 1–2 dnů. Pokud spěcháte, zavolejte na <a href="tel:+420723339650">723 339 650</a>.</div>
<?php elseif ($status !== '') : ?>
  <div class="mvg-pp-msg mvg-pp-err" role="alert"><?php echo esc_html(mvgreen_poptavka_error_text($status)); ?></div>
<?php endif; ?>
  <form method="post" action="<?php echo $action; ?>" enctype="multipart/form-data" novalidate>
    <input type="hidden" name="action" value="mvgreen_poptavka">
    <input type="hidden" name="mvg_back" value="">
    <input type="hidden" name="mvg_t" value="<?php echo esc_attr(time()); ?>">
    <?php wp_nonce_field('mvgreen_poptavka', 'mvg_nonce'); ?>
    <div class="mvg-pp-hp" aria-hidden="true"><label>Nevyplňujte<input type="text" name="mvg_web" tabindex="-1" autocomplete="off"></label></div>
    <div class="mvg-pp-row">
      <label>Jméno <span>*</span><input type="text" name="mvg_name" required maxlength="100" autocomplete="name"></label>
      <label>Telefon <span>*</span><input type="tel" name="mvg_phone" required maxlength="30" autocomplete="tel" inputmode="tel"></label>
    </div>
    <div class="mvg-pp-row">
      <label>E-mail<input type="email" name="mvg_email" maxlength="120" autocomplete="email"></label>
      <label>Obec<input type="text" name="mvg_town" maxlength="80" placeholder="např. Domažlice"></label>
    </div>
    <fieldset class="mvg-pp-services">
      <legend>Co potřebujete?</legend>
      <?php foreach ($services as $i => $s) : ?>
        <label><input type="checkbox" name="mvg_services[]" value="<?php echo esc_attr($i); ?>"><?php echo esc_html($s); ?></label>
      <?php endforeach; ?>
    </fieldset>
    <label>Zpráva<textarea name="mvg_message" rows="4" maxlength="3000" placeholder="Např. velikost zahrady, výška plotu, kdy by se vám to hodilo…"></textarea></label>
    <div class="mvg-pp-files">
      <label class="mvg-pp-drop">
        <input type="file" name="mvg_photos[]" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple>
        <span class="mvg-pp-drop-title">Přidat fotky zahrady</span>
        <span class="mvg-pp-drop-hint">Až <?php echo (int) MVGREEN_POPTAVKA_MAX_FILES; ?> fotek z mobilu nebo počítače. Díky nim vám můžeme poslat cenu bez návštěvy.</span>
      </label>
      <ul class="mvg-pp-list" aria-live="polite"></ul>
    </div>
    <button type="submit">Odeslat poptávku</button>
    <p class="mvg-pp-note">Odesláním poptávky nám předáváte kontaktní údaje a fotky, abychom vám mohli připravit nabídku. Více v <a href="<?php echo $privacy; ?>">zásadách ochrany osobních údajů</a>.</p>
  </form>
</div>
<style>
.mvg-poptavka{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#12261b}
.mvg-poptavka form{display:flex;flex-direction:column;gap:14px;margin:0}
.mvg-poptavka label{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600;color:#2b4434}
.mvg-poptavka label span{color:#b42318}
.mvg-poptavka input[type=text],.mvg-poptavka input[type=tel],.mvg-poptavka input[type=email],.mvg-poptavka textarea{font:inherit;font-weight:500;font-size:15px;color:#12261b;background:#fff;padding:12px 14px;border:1px solid #d3e1d7;border-radius:10px;width:100%;box-sizing:border-box;margin:0}
.mvg-poptavka input:focus,.mvg-poptavka textarea:focus{outline:2px solid #156333;outline-offset:1px;border-color:#156333}
.mvg-pp-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
.mvg-pp-services{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.mvg-pp-services legend{font-size:14px;font-weight:600;color:#2b4434;margin-bottom:8px;padding:0}
.mvg-pp-services label{flex-direction:row;align-items:center;gap:8px;border:1px solid #d3e1d7;border-radius:999px;padding:9px 14px;cursor:pointer;font-weight:600}
.mvg-pp-services input{accent-color:#156333;width:16px;height:16px;margin:0}
.mvg-pp-files{display:flex;flex-direction:column;gap:8px}
.mvg-pp-drop{position:relative;border:2px dashed #b9d3c1;border-radius:14px;padding:18px;background:#f6faf7;cursor:pointer;text-align:center;align-items:center}
.mvg-pp-drop:hover,.mvg-pp-drop.is-over{border-color:#156333;background:#eef6f0}
.mvg-pp-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.mvg-pp-drop-title{font-size:16px;font-weight:800;color:#156333}
.mvg-pp-drop-title::before{content:"";display:inline-block;width:18px;height:18px;margin-right:8px;vertical-align:-3px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'/%3E%3Ccircle cx='12' cy='13' r='4'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'/%3E%3Ccircle cx='12' cy='13' r='4'/%3E%3C/svg%3E") center/contain no-repeat}
.mvg-pp-drop-hint{font-size:13px;font-weight:500;color:#4f6457}
.mvg-pp-list{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.mvg-pp-list li{display:flex;align-items:center;gap:8px;font-size:13px;background:#fff;border:1px solid #e0eae3;border-radius:10px;padding:6px 8px 6px 6px;max-width:100%}
.mvg-pp-list img{width:44px;height:44px;object-fit:cover;border-radius:7px}
.mvg-pp-list li.is-bad{border-color:#f0b4ad;color:#b42318}
.mvg-poptavka button[type=submit]{font:inherit;background:#156333;color:#fff;border:0;border-radius:12px;padding:16px;font-weight:800;font-size:17px;cursor:pointer}
.mvg-poptavka button[type=submit]:hover{background:#0f3d27}
.mvg-poptavka button[type=submit][disabled]{opacity:.7;cursor:wait}
.mvg-pp-note{margin:0;font-size:12.5px;line-height:1.5;color:#4f6457}
.mvg-pp-note a{color:#156333}
.mvg-pp-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}
.mvg-pp-msg{border-radius:12px;padding:14px 16px;margin-bottom:14px;font-size:15px;line-height:1.5}
.mvg-pp-ok{background:#e8f5eb;color:#0f3d27;border:1px solid #b9d3c1}
.mvg-pp-err{background:#fdecea;color:#8a1c12;border:1px solid #f0b4ad}
</style>
<script>
(function(){
  var root=document.currentScript&&document.currentScript.previousElementSibling&&document.currentScript.previousElementSibling.previousElementSibling;
  if(!root||!root.classList||!root.classList.contains('mvg-poptavka')){root=document.querySelector('.mvg-poptavka');}
  if(!root)return;
  var form=root.querySelector('form'),input=root.querySelector('.mvg-pp-drop input'),list=root.querySelector('.mvg-pp-list'),drop=root.querySelector('.mvg-pp-drop');
  var MAXF=<?php echo (int) MVGREEN_POPTAVKA_MAX_FILES; ?>,MAXB=<?php echo (int) MVGREEN_POPTAVKA_MAX_FILE_BYTES; ?>;
  form.querySelector('[name=mvg_back]').value=location.href.split('#')[0];
  function render(){
    list.innerHTML='';
    Array.prototype.slice.call(input.files||[]).forEach(function(f,i){
      var li=document.createElement('li'),bad=i>=MAXF||f.size>MAXB;
      if(bad)li.className='is-bad';
      if(/^image\/(jpeg|png|webp)$/.test(f.type)){var im=document.createElement('img');im.alt='';im.src=URL.createObjectURL(f);li.appendChild(im);}
      var t=document.createElement('span');t.textContent=f.name+(f.size>MAXB?' – příliš velká':(i>=MAXF?' – nad limit':''));li.appendChild(t);list.appendChild(li);
    });
  }
  input.addEventListener('change',render);
  ['dragenter','dragover'].forEach(function(e){drop.addEventListener(e,function(){drop.classList.add('is-over');});});
  ['dragleave','drop'].forEach(function(e){drop.addEventListener(e,function(){drop.classList.remove('is-over');});});
  form.addEventListener('submit',function(ev){
    var n=form.querySelector('[name=mvg_name]'),p=form.querySelector('[name=mvg_phone]');
    if(!n.value.trim()){ev.preventDefault();n.focus();return;}
    if(p.value.replace(/\D/g,'').length<9){ev.preventDefault();p.focus();p.setCustomValidity('Zadejte prosím telefon.');p.reportValidity();p.setCustomValidity('');return;}
    var b=form.querySelector('button[type=submit]');b.disabled=true;b.textContent='Odesílám…';
  });
})();
</script>
    <?php
    return ob_get_clean();
});

function mvgreen_poptavka_error_text($code) {
    $map = [
        'chyba-udaje' => 'Vyplňte prosím jméno a telefon.',
        'chyba-fotky' => 'Některou fotku se nepodařilo nahrát. Zkuste prosím menší fotky (do 12 MB) nebo je pošlete přes WhatsApp.',
        'chyba-limit' => 'Odeslali jste několik poptávek za sebou. Zkuste to prosím za chvíli nebo zavolejte.',
        'chyba-bezpecnost' => 'Formulář vypršel. Načtěte prosím stránku znovu a odešlete poptávku ještě jednou.',
    ];
    return $map[$code] ?? 'Poptávku se nepodařilo odeslat. Zavolejte nám prosím na 723 339 650.';
}

function mvgreen_poptavka_redirect($back, $status) {
    $back = wp_validate_redirect($back, home_url('/'));
    wp_safe_redirect(add_query_arg('poptavka', $status, $back) . '#poptavka');
    exit;
}

add_action('admin_post_nopriv_mvgreen_poptavka', 'mvgreen_poptavka_handle');
add_action('admin_post_mvgreen_poptavka', 'mvgreen_poptavka_handle');

function mvgreen_poptavka_handle() {
    $back = isset($_POST['mvg_back']) ? esc_url_raw(wp_unslash($_POST['mvg_back'])) : home_url('/');
    // Large uploads over post_max_size arrive as an empty POST.
    if (empty($_POST) && !empty($_SERVER['CONTENT_LENGTH'])) mvgreen_poptavka_redirect(wp_get_referer() ?: home_url('/'), 'chyba-fotky');
    if (!isset($_POST['mvg_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['mvg_nonce'])), 'mvgreen_poptavka')) mvgreen_poptavka_redirect($back, 'chyba-bezpecnost');
    // Bots: honeypot filled or form sent faster than a human could. Pretend success.
    $started = isset($_POST['mvg_t']) ? (int) $_POST['mvg_t'] : 0;
    if (!empty($_POST['mvg_web']) || ($started && time() - $started < 4)) mvgreen_poptavka_redirect($back, 'ok');

    $ip_key = 'mvgreen_pp_' . md5(isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'x');
    $count = (int) get_transient($ip_key);
    if ($count >= 5) mvgreen_poptavka_redirect($back, 'chyba-limit');

    $name = sanitize_text_field(wp_unslash($_POST['mvg_name'] ?? ''));
    $phone = sanitize_text_field(wp_unslash($_POST['mvg_phone'] ?? ''));
    $email = sanitize_email(wp_unslash($_POST['mvg_email'] ?? ''));
    $town = sanitize_text_field(wp_unslash($_POST['mvg_town'] ?? ''));
    $message = sanitize_textarea_field(wp_unslash($_POST['mvg_message'] ?? ''));
    $all = mvgreen_poptavka_services();
    $picked = [];
    foreach ((array) ($_POST['mvg_services'] ?? []) as $i) { $i = (int) $i; if (isset($all[$i])) $picked[] = $all[$i]; }
    if ($name === '' || strlen(preg_replace('/\D/', '', $phone)) < 9) mvgreen_poptavka_redirect($back, 'chyba-udaje');

    // Photos: validated by real image type, stored under a random folder name, resized for e-mail.
    $saved = [];
    $files = $_FILES['mvg_photos'] ?? null;
    if ($files && is_array($files['name'])) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        $total = 0; $n = 0;
        $dir = wp_upload_dir();
        $sub = 'mvgreen-poptavky/' . gmdate('Y-m') . '-' . wp_generate_password(16, false, false);
        $target = trailingslashit($dir['basedir']) . $sub;
        foreach ($files['name'] as $k => $orig) {
            if ($files['error'][$k] === UPLOAD_ERR_NO_FILE) continue;
            if ($files['error'][$k] !== UPLOAD_ERR_OK) mvgreen_poptavka_redirect($back, 'chyba-fotky');
            if (++$n > MVGREEN_POPTAVKA_MAX_FILES) break;
            $size = (int) $files['size'][$k];
            $total += $size;
            if ($size > MVGREEN_POPTAVKA_MAX_FILE_BYTES || $total > MVGREEN_POPTAVKA_MAX_TOTAL_BYTES) mvgreen_poptavka_redirect($back, 'chyba-fotky');
            $tmp = $files['tmp_name'][$k];
            $check = wp_check_filetype_and_ext($tmp, $orig, ['jpg|jpeg|jpe' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'heic' => 'image/heic', 'heif' => 'image/heif']);
            if (empty($check['type'])) mvgreen_poptavka_redirect($back, 'chyba-fotky');
            if (!wp_mkdir_p($target)) mvgreen_poptavka_redirect($back, 'chyba-fotky');
            if (!file_exists($target . '/index.html')) file_put_contents($target . '/index.html', '');
            $ext = $check['ext'] ?: 'jpg';
            $dest = $target . '/foto-' . $n . '-' . wp_generate_password(8, false, false) . '.' . $ext;
            if (!@move_uploaded_file($tmp, $dest)) mvgreen_poptavka_redirect($back, 'chyba-fotky');
            // Phone photos are often 5–10 MB: keep a resized copy for e-mail and storage.
            $editor = wp_get_image_editor($dest);
            if (!is_wp_error($editor)) {
                $editor->resize(2000, 2000, false);
                $editor->set_quality(82);
                $res = $editor->save(preg_replace('/\.\w+$/', '', $dest) . '-z.jpg', 'image/jpeg');
                if (!is_wp_error($res) && !empty($res['path'])) { @unlink($dest); $dest = $res['path']; }
            }
            $saved[] = $dest;
        }
    }
    set_transient($ip_key, $count + 1, HOUR_IN_SECONDS);

    $lines = [
        'Jméno: ' . $name,
        'Telefon: ' . $phone,
        'E-mail: ' . ($email ?: '—'),
        'Obec: ' . ($town ?: '—'),
        'Služby: ' . ($picked ? implode(', ', $picked) : '—'),
        '',
        'Zpráva:',
        $message ?: '—',
        '',
        'Fotky: ' . count($saved),
    ];
    $body = implode("\n", $lines);

    // Always keep a copy in the admin, so no lead is lost if e-mail delivery fails.
    $post_id = wp_insert_post([
        'post_type' => 'mvgreen_poptavka',
        'post_status' => 'private',
        'post_title' => $name . ' – ' . $phone . ($town ? ' – ' . $town : ''),
        'post_content' => $body,
    ]);
    if ($post_id && !is_wp_error($post_id) && $saved) {
        $urls = array_map(function ($p) use ($dir) { return str_replace(trailingslashit($dir['basedir']), trailingslashit($dir['baseurl']), $p); }, $saved);
        update_post_meta($post_id, '_mvgreen_photos', $urls);
        wp_update_post(['ID' => $post_id, 'post_content' => $body . "\n\n" . implode("\n", array_map(function ($u) { return '<a href="' . esc_url($u) . '"><img src="' . esc_url($u) . '" style="max-width:320px;height:auto;margin:4px"></a>'; }, $urls))]);
    }

    $headers = ['Content-Type: text/plain; charset=UTF-8'];
    if ($email) $headers[] = 'Reply-To: ' . str_replace(["\r", "\n"], '', $name) . ' <' . $email . '>';
    $subject = 'Nová poptávka z webu: ' . $name . ($picked ? ' (' . implode(', ', $picked) . ')' : '');
    $sent = wp_mail(mvgreen_poptavka_recipient(), $subject, $body . "\n\nPoptávka je uložená i v administraci webu: " . admin_url('edit.php?post_type=mvgreen_poptavka'), $headers, $saved);
    if ($post_id && !is_wp_error($post_id)) update_post_meta($post_id, '_mvgreen_mail_sent', $sent ? 'ano' : 'NE');

    mvgreen_poptavka_redirect($back, 'ok');
}

// Show whether the e-mail went out in the admin list.
add_filter('manage_mvgreen_poptavka_posts_columns', function ($cols) { $cols['mvg_mail'] = 'E-mail odeslán'; $cols['mvg_photos'] = 'Fotky'; return $cols; });
add_action('manage_mvgreen_poptavka_posts_custom_column', function ($col, $id) {
    if ($col === 'mvg_mail') echo esc_html(get_post_meta($id, '_mvgreen_mail_sent', true) ?: '—');
    if ($col === 'mvg_photos') echo (int) count((array) get_post_meta($id, '_mvgreen_photos', true) ?: []);
}, 10, 2);
