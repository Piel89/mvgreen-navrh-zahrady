/*
 * Stránka „Trávník podle plánu“ – shortcode [mvgreen_plan_travnik] (travnik.php). 2026-11-16.
 * Vygenerováno ze schváleného náhledu (artefakt „Trávník podle plánu“) + web: obec → výška a podnebí přes NÁŠ server
 * (prohlížeč zákazníka se nepřipojuje k třetím stranám), kód/nákup přes stávající platby (payments.php), připomínky .ics.
 */
(function(){
'use strict';
var CFG=window.MVGreenPlanPage||{};
var root=document.getElementById('mvg-plan');var MODE=CFG.mode||'';
if(!root||(!window.MVGreenBrain&&MODE!=='uvod'))return;
root.innerHTML="<div class=\"in hero\">\n  <div class=\"brand\"><i aria-hidden=\"true\"></i>MVGreen · Martin Vondrovic, zahradník z Domažlic</div>\n  <h1>Z písku na anglický trávník</h1>\n  <p class=\"subhead\">Naše zahrada 2023–2026: od holé zeminy po anglický trávník.</p>\n  <div class=\"ba\" id=\"ba\" style=\"--p:50%\">\n    <img src=\"{IMG}20230428_131652.jpg\" alt=\"Před: holý písek po stavbě domu, duben 2023\">\n    <img class=\"after\" src=\"{IMG}20240708_192206.jpg\" alt=\"Po: hustý anglický trávník s pruhy, červenec 2024\">\n    <span class=\"bar\"></span><span class=\"tag t1\">DUBEN 2023</span><span class=\"tag t2\">ČERVENEC 2024</span>\n    <input type=\"range\" id=\"baR\" min=\"0\" max=\"100\" value=\"50\" aria-label=\"Posunout srovnání před a po\"><span class=\"knob\" aria-hidden=\"true\">⇆</span>\n  </div>\n  <div class=\"hero-offer\">\n    <p class=\"lead\">Stačil správný plán. Ten samý vám spočítáme pro vaši zahradu: <b>kdy</b> hnojit, <b>čím</b> (složení, ne značka), <b>kolik kg</b> na vaši plochu a jak se o trávník starat. Připomínky přímo do kalendáře v mobilu.</p>\n    <div class=\"cta-row\"><a class=\"btn\" href=\"#plan\">Sestavit můj plán</a><span class=\"price\"><b>499 Kč</b> na celý rok</span></div>\n    <div class=\"trust\"><span>Plán, podle kterého roste moje zahrada</span><span>Hotový za pár minut</span><span>Bez vazby na značku nebo e-shop</span></div>\n  </div>\n  <div class=\"timeline\">\n    <span class=\"eyebrow\">Moje zahrada krok za krokem, 2023–2026</span>\n    <div class=\"strip\">\n    <figure><img loading=\"lazy\" src=\"{IMG}20230428_111214.jpg\" alt=\"Holá zemina po stavbě domu, duben 2023\"><figcaption><b>28. 4. 2023</b>Už od začátku bylo všechno špatně – jen semínko do hlíny.</figcaption></figure>\n    <figure><img loading=\"lazy\" src=\"{IMG}20230622_061906.jpg\" alt=\"Řídká tráva, červen 2023\"><figcaption><b>22. 6. 2023</b>Řídká a s holými místy</figcaption></figure>\n    <figure class=\"bad\"><span class=\"badtag\">Bez plánu</span><img loading=\"lazy\" src=\"{IMG}bez-planu-2024.jpg\" alt=\"Zažloutlý, flekatý a řídký trávník po roce bez plánu, jaro 2024\"><figcaption><b>Jaro 2024</b>Do téhle doby jsem trávník dělal bez plánu – jen jsem bezhlavě sekal, kdy se mi chtělo.</figcaption></figure>\n    <figure><img loading=\"lazy\" src=\"{IMG}20240427_152831.jpg\" alt=\"Obnova trávníku, duben 2024\"><figcaption><b>27. 4. 2024</b>Závlaha + plán hnojení</figcaption></figure>\n    <figure><img loading=\"lazy\" src=\"{IMG}20240918_160211.jpg\" alt=\"Trávník s pruhy, září 2024\"><figcaption><b>18. 9. 2024</b>Anglický trávník</figcaption></figure>\n    <figure><img loading=\"lazy\" src=\"{IMG}20260528_063036.jpg\" alt=\"Hustý trávník, květen 2026\"><figcaption><b>28. 5. 2026</b>Třetí sezóna</figcaption></figure>\n    <figure><img loading=\"lazy\" src=\"{IMG}20261114_091507.jpg\" alt=\"Trávník s prvním mrazem, listopad 2026\"><figcaption><b>14. 11. 2026</b>Do zimy hustý a zdravý</figcaption></figure>\n  </div>\n  </div>\n</div>\n\n<section class=\"in\" id=\"plan\">\n  <span class=\"eyebrow\">Sestavte si plán</span>\n  <h2>Pár otázek o vašem trávníku</h2>\n  <p class=\"muted\" style=\"margin-top:8px;max-width:62ch\">Při každé odpovědi se vám mění obrázek trávníku a skládá se váš rok. Stačí obec, plocha a jaký trávník chcete, ostatní otázky plán zpřesní. Rozbor půdy je nepovinný.</p>\n  <div class=\"tool\" style=\"margin-top:22px\">\n    <form class=\"q\" id=\"q\" novalidate>\n      <div class=\"qz\" id=\"qz\"></div>\n      <div class=\"qhid\" id=\"qfields\">\n      <div class=\"lookup\"><div class=\"fld\"><label for=\"obec\">Obec</label><input type=\"text\" id=\"obec\" value=\"\" placeholder=\"např. Domažlice\" autocomplete=\"address-level2\"></div><button type=\"button\" class=\"btn small\" id=\"obecBtn\">Zjistit</button></div>\n      <input type=\"hidden\" id=\"alt\" value=\"\">\n      <p class=\"hint msg\" id=\"obecMsg\" aria-live=\"polite\">Doplníme nadmořskou výšku a podnebí vaší obce za posledních 5 let.</p>\n      <div class=\"row2\">\n        <div class=\"fld\"><label for=\"area\">Plocha trávníku (m²)</label><input type=\"number\" id=\"area\" value=\"\" placeholder=\"např. 150\" min=\"1\" max=\"20000\" inputmode=\"numeric\"></div>\n        <div class=\"fld\"><label for=\"soil\">Půda</label><select id=\"soil\"><option value=\"unknown\" selected>Nevím</option><option value=\"normal\">Běžná propustná</option><option value=\"clay\">Jílovitá / těžká</option><option value=\"sand\">Písčitá / lehká</option></select></div>\n      </div>\n      <div class=\"fld\"><span>Jaký trávník chcete?</span>\n        <div class=\"tiers\" role=\"radiogroup\" aria-label=\"Úroveň péče\">\n          <label class=\"tier\"><input type=\"radio\" name=\"tier\" value=\"low\"><span><b>Nízká údržba</b><small>Ať je zelený, času mám málo.</small></span></label>\n          <label class=\"tier\"><input type=\"radio\" name=\"tier\" value=\"standard\"><span><b>Běžný rodinný</b><small>Děti, pes, ať vypadá hezky.</small></span></label>\n          <label class=\"tier\"><input type=\"radio\" name=\"tier\" value=\"representative\"><span><b>Anglický trávník</b><small>Hustý, jemný, hnojení každý měsíc.</small></span></label>\n          <label class=\"tier\"><input type=\"radio\" name=\"tier\" value=\"sportovni\"><span><b>Sportovní</b><small>Pravidelná zátěž, rychlá obnova.</small></span></label>\n        </div>\n      </div>\n      <div class=\"row2\">\n        <div class=\"fld\"><label for=\"irr\">Zavlažování</label><select id=\"irr\"><option value=\"\">Nevyplněno</option><option value=\"auto\">Automatická závlaha</option><option value=\"manual\">Zalévám ručně</option><option value=\"none\">Nezalévám</option></select></div>\n        <div class=\"fld\"><label for=\"mow\">Sečení v sezóně</label><select id=\"mow\"><option value=\"\">Nevyplněno</option><option value=\"0.5\">Za 2 týdny a méně</option><option value=\"1\">Jednou týdně</option><option value=\"2\">2× týdně a víc</option></select></div>\n      </div>\n      <div class=\"row2\">\n        <div class=\"fld\"><label for=\"sun\">Slunce</label><select id=\"sun\"><option value=\"\">Nevyplněno</option><option value=\"full\">Většinu dne</option><option value=\"partial\">Polostín</option><option value=\"shade\">Stín</option></select></div>\n        <div class=\"fld\"><label for=\"age\">Stáří trávníku</label><select id=\"age\"><option value=\"\">Nevyplněno</option><option value=\"established\">Starší než rok</option><option value=\"new\">Nový (do roku)</option></select></div>\n      </div>\n      <div class=\"row2\">\n        <div class=\"fld\"><label for=\"mower\">Sekačka</label><select id=\"mower\"><option value=\"\">Nevyplněno</option><option value=\"rotary\">Rotační</option><option value=\"reel\">Vřetenová</option><option value=\"robot\">Robotická</option></select></div>\n        <div class=\"fld\"><label for=\"mowh\">Na kolik sekáte (cm)</label><input type=\"number\" id=\"mowh\" value=\"\" min=\"0.5\" max=\"12\" step=\"0.5\" inputmode=\"decimal\"></div>\n      </div>\n      <div class=\"row2\">\n        <div class=\"fld\"><label for=\"grass\">Travní směs</label><select id=\"grass\"><option value=\"\">Nevím</option><option value=\"fescue\">Kostřavy</option><option value=\"rye\">Jílek</option><option value=\"mix\">Směs</option></select></div>\n        <div class=\"fld\"><label for=\"mode\">Jak hnojit</label><select id=\"mode\"><option value=\"preventive\" selected>Pravidelně podle plánu</option><option value=\"thrifty\">Jen když trávník potřebuje</option></select></div>\n      </div>\n      <div class=\"fld\"><span>Co trávník trápí nebo jak vypadá</span>\n        <div class=\"chips\">\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"moss\">Mech</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"weeds\">Plevel</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"bare\">Holá místa</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"thatch\">Plsť</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"compaction\">Udusaná půda</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"snowmold\">Loni plíseň sněžná</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"poa\">Lipnice roční</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"crabgrass\">Ježatka</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"spots\">Skvrny, fleky, plíseň</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"prob\" value=\"grubs\">Ponravy</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"sym\" value=\"pale\">Bledne</label>\n          <label class=\"chip\"><input type=\"checkbox\" name=\"sym\" value=\"thin\">Řídne</label>\n          <label class=\"chip\"><input type=\"checkbox\" id=\"dog\">Chodí na něj pes</label>\n        </div>\n      </div>\n      <details class=\"soil\"><summary>Mám rozbor půdy (nepovinné)</summary>\n        <p class=\"hint\" style=\"margin:8px 0\">Opište kategorii z výsledku laboratoře.</p>\n        <div class=\"row2\">\n          <div class=\"fld\"><label for=\"st-ph\">pH</label><select id=\"st-ph\"></select></div>\n          <div class=\"fld\"><label for=\"st-p\">Fosfor (P)</label><select id=\"st-p\"></select></div>\n          <div class=\"fld\"><label for=\"st-k\">Draslík (K)</label><select id=\"st-k\"></select></div>\n          <div class=\"fld\"><label for=\"st-mg\">Hořčík (Mg)</label><select id=\"st-mg\"></select></div>\n        </div>\n      </details>\n      </div>\n    </form>\n\n    <div class=\"res\" id=\"res\" aria-live=\"polite\"></div>\n  </div>\n</section>\n\n<section class=\"in\" id=\"koupit\">\n  <div class=\"buy\">\n    <span class=\"eyebrow\">Roční plán péče na míru</span>\n    <div style=\"display:flex;gap:16px;align-items:baseline;flex-wrap:wrap\"><span class=\"big\">499 Kč</span><span class=\"muted\">jednorázově, na celý rok</span></div>\n    <ul class=\"list\">\n      <li>Termíny hnojení a péče pro vaši obec a úroveň péče</li>\n      <li>Složení hnojiva u každé dávky, g/m² a kg na vaši plochu</li>\n      <li>Doporučení podle stavu trávníku, stínu, psa, závlahy a případně rozboru půdy</li>\n      <li>Připomínky do kalendáře v mobilu</li>\n    </ul>\n    <div class=\"cta-row\"><a class=\"btn\" href=\"#plan\">Sestavit můj plán</a><span class=\"muted\" style=\"font-size:14px\">Bezpečná platba kartou online</span></div>\n    <div style=\"border-top:1px solid var(--line);padding-top:14px;display:grid;gap:6px\"><h3>Nechcete to dělat sami?</h3><p class=\"muted\">Na Domažlicku se o trávník postaráme celý rok: sečení, hnojení, vertikutace.</p></div>\n  </div>\n</section>\n\n<section class=\"in\">\n  <h2>Časté otázky</h2>\n  <div style=\"margin-top:12px\">\n    <details class=\"faq\"><summary>Proč nestačí návod na pytli?</summary><p>Návod je pro celou republiku a pro jedno hnojivo. Plán řekne, kdy hnojit u vás, čím během roku a kolik kg na vaši plochu. Vertikutaci a aerifikaci až ve chvíli, kdy tráva aktivně roste (u nás zhruba při 10 °C v půdě) – dřív se trávník po zásahu hůř zotavuje.</p></details>\n    <details class=\"faq\"><summary>Musím kupovat konkrétní značku?</summary><p>Ne. U každé dávky je složení, které hledat na obalu. Když má vaše hnojivo jiné složení, plán dávku přepočítá.</p></details>\n    <details class=\"faq\"><summary>Potřebuji rozbor půdy?</summary><p>Ne. Plán funguje i bez něj. Když rozbor máte, plán ho zohlední: například při přebytku fosforu nebo draslíku navrhne hnojivo bez nich.</p></details>\n    <details class=\"faq\"><summary>Mám malý trávník, má to smysl?</summary><p>Ano. Dávky se přepočítají na vaši plochu, takže nekoupíte zbytečně velké balení.</p></details>\n    <details class=\"faq\"><summary>Jak fungují připomínky?</summary><p>Plán si jedním tlačítkem uložíte do kalendáře v telefonu. Den před každým hnojením vám telefon připomene, čím a kolik. Žádnou aplikaci nepotřebujete.</p></details>\n  </div>\n</section>\n\n<div class=\"sticky\" id=\"sticky\"><span><b>Plán na celý rok</b><br><span class=\"muted\" style=\"font-size:13px\">499 Kč · pro vaši zahradu</span></span><a class=\"btn\" href=\"#plan\" style=\"padding:12px 20px;font-size:16px\">Sestavit plán</a></div>".split('{IMG}').join(CFG.img||'');
// Dvě stránky místo jedné (Martin 2026-11-22): [mvgreen_plan_travnik mode="uvod"] = čistá prodejní stránka s odkazem na dotazník,
// mode="dotaznik" = samotný dotazník a plán. Bez mode zůstává dosavadní celá stránka.
(function(){
  var q=function(sel){return root.querySelector(sel)},all=function(sel){return [].slice.call(root.querySelectorAll(sel))};
  if(MODE==='dotaznik'){
    var h=q('.hero');if(h)h.remove();var bu=q('#koupit');if(bu){var nx=bu.nextElementSibling;bu.remove();if(nx&&nx.tagName==='SECTION')nx.remove()}var sk=q('#sticky');if(sk)sk.remove();
    var pl=q('#plan');if(pl&&CFG.uvod){var bk=document.createElement('p');bk.style.cssText='margin:0 0 14px';bk.innerHTML='<a href="'+CFG.uvod.replace(/"/g,'')+'" class="muted" style="text-decoration:none;font-weight:600">← Zpět na popis plánu</a>';pl.insertBefore(bk,pl.firstChild)}
  }
  if(MODE==='uvod'){
    var url=(CFG.dotaznik||'#plan').replace(/"/g,'');
    var pl2=q('#plan');if(pl2){
      // Ukázka na prodejní stránce (Martin 2026-11-22): dvě otázky, obrázek se mění, odpovědi se předají dotazníku přes localStorage.
      var TZ=[['low','Nízká údržba','Ať je zelený, času mám málo.','Nízká údržba: nejméně hnojení a nejméně starostí.'],['standard','Běžný rodinný','Děti, pes, ať vypadá hezky.','Rodinný trávník: pár hnojení rozložených mezi jaro a podzim.'],['representative','Anglický trávník','Hustý, jemný, hnojení každý měsíc.','Anglický trávník: hnojení zhruba každý měsíc v sezóně, největší nároky na péči.'],['sportovni','Sportovní','Pravidelná zátěž, rychlá obnova.','Sportovní trávník: důraz na zátěž a rychlou obnovu.']],TA=[50,150,300,600],tzA=150,tzT='standard';
      var tzh='<span class="eyebrow">Zkuste si to</span><h2>Dvě otázky a vidíte, jak to půjde</h2><p class="muted" style="margin-top:8px;max-width:62ch">Plán vzniká z vašich odpovědí. Vyzkoušejte první dvě, zbytek doplníte v dotazníku.</p>'+
      '<div class="tz"><div class="tz-pic" id="tzPic" data-tier="standard" aria-hidden="true"><canvas id="tzCv"></canvas><span class="tz-lines"></span><span class="tz-lab" id="tzLab"></span></div><div class="tz-q">'+
      '<h3>Jak velký je váš trávník?</h3><div class="tz-chips" id="tzA">'+TA.map(function(a){return '<button type="button" data-a="'+a+'" aria-pressed="'+(a===tzA)+'">'+a+' m²</button>'}).join('')+'</div>'+
      '<h3>Jaký trávník chcete mít?</h3><div class="tz-tiles" id="tzT" role="radiogroup" aria-label="Úroveň péče">'+TZ.map(function(t){return '<button type="button" role="radio" data-t="'+t[0]+'" aria-checked="'+(t[0]===tzT)+'"><b>'+t[1]+'</b><span>'+t[2]+'</span></button>'}).join('')+'</div>'+
      '<p class="tz-say" id="tzSay" aria-live="polite"></p><p style="margin-top:14px"><a class="btn" id="tzGo" href="'+url+'">Pokračovat – sestavit celý plán</a></p></div></div>';
      pl2.innerHTML=tzh;
      /* stejná živá scéna jako v dotazníku (kreslí se jen když je vidět); bez ní zůstane jednoduchý obrázek z CSS */
      var tzS=null,SS=null;
      if(window.MVGreenQuiz&&MVGreenQuiz.makeScene){try{SS={doy:196,clim:null,area:tzA,tier:tzT,sun:'full',soil:'normal',irr:'manual',mow:'1',mower:'rotary',mowh:3.5,age:'established',grass:'',mode:'preventive',probs:new Set()};pl2.querySelector('#tzPic').classList.add('live');tzS=MVGreenQuiz.makeScene(pl2.querySelector('#tzCv'),SS);tzS.build();tzS.update(SS);tzS.snap()}catch(e){tzS=null;pl2.querySelector('#tzPic').classList.remove('live')}}
      var tzUp=function(){if(tzS){SS.area=tzA;SS.tier=tzT;tzS.update(SS)}var pic=pl2.querySelector('#tzPic');pic.setAttribute('data-tier',tzT);pic.style.setProperty('--s',Math.min(1,.55+Math.log(tzA/50)/Math.log(12)*.45));pl2.querySelector('#tzLab').textContent=tzA+' m²';
        [].forEach.call(pl2.querySelectorAll('#tzA button'),function(b){b.setAttribute('aria-pressed',String(+b.getAttribute('data-a')===tzA))});
        [].forEach.call(pl2.querySelectorAll('#tzT button'),function(b){b.setAttribute('aria-checked',String(b.getAttribute('data-t')===tzT))});
        pl2.querySelector('#tzSay').textContent=TZ.filter(function(t){return t[0]===tzT})[0][3]+' Na '+tzA+' m² z toho dostanete přesný kalendář, dávky v kg a nákupní seznam.'};
      pl2.querySelector('#tzA').addEventListener('click',function(e){var b=e.target.closest('button');if(b){tzA=+b.getAttribute('data-a');tzUp()}});
      pl2.querySelector('#tzT').addEventListener('click',function(e){var b=e.target.closest('button');if(b){tzT=b.getAttribute('data-t');tzUp()}});
      pl2.querySelector('#tzGo').addEventListener('click',function(){try{var d=JSON.parse(localStorage.getItem('mvgPlanForm')||'null')||{f:{}};d.f=d.f||{};d.f.area=String(tzA);TZ.forEach(function(t){d.f['tier:'+t[0]]=(t[0]===tzT)});d.t=Date.now();localStorage.setItem('mvgPlanForm',JSON.stringify(d))}catch(e){}});
      tzUp();
    }
    // Cenová karta je hned pod ukázkou, druhé stejné tlačítko by bylo zbytečné (Martin 2026-11-22: 2× za sebou „Sestavit můj plán“).
    var kb=q('#koupit .cta-row a.btn');if(kb)kb.remove();
    all('a[href="#plan"]').forEach(function(a){a.setAttribute('href',url)});
  }
})();

'use strict';
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
// před/po
var ba=document.getElementById('ba'),r=document.getElementById('baR');
if(ba&&r){function setP(v){ba.style.setProperty('--p',v+'%');r.value=v}
r.addEventListener('input',function(){setP(r.value)});
var drag=false;ba.addEventListener('pointerdown',function(e){drag=true;ba.setPointerCapture(e.pointerId);mv(e)});ba.addEventListener('pointermove',function(e){if(drag)mv(e)});ba.addEventListener('pointerup',function(){drag=false});
function mv(e){var b=ba.getBoundingClientRect();setP(Math.max(0,Math.min(100,(e.clientX-b.left)/b.width*100)))}}
// lepivé tlačítko
var st=document.getElementById('sticky');if(st&&'IntersectionObserver' in window&&document.querySelector('.hero .btn')&&document.getElementById('plan')){var heroSeen=true,planSeen=false,upd=function(){st.classList.toggle('show',!heroSeen&&!planSeen)};new IntersectionObserver(function(en){heroSeen=en[0].isIntersecting;upd()}).observe(document.querySelector('.hero .btn'));
  // spodní lišta nesmí zakrývat tlačítka dotazníku (Martin 2026-11-22, mobil)
  new IntersectionObserver(function(en){planSeen=en[0].isIntersecting;upd()},{threshold:.15}).observe(document.getElementById('plan'))}

if(MODE==='uvod')return; // prodejní stránka dál nic nepotřebuje
var B=window.MVGreenBrain, res=document.getElementById('res'), form=document.getElementById('q');
var unlocked=!!CFG.admin, paid=false, climate=null, lastRes=null;
try{var sc=localStorage.getItem('mvgPlanCode');if(sc)checkCode(sc,true)}catch(e){}
var CAT=[['','Neuvedeno'],['nizka','nízká'],['vyhovujici','vyhovující'],['optimalni','optimální'],['vysoka','vysoká'],['nadlimitni','nadlimitní']];
['st-ph','st-p','st-k','st-mg'].forEach(function(id){document.getElementById(id).innerHTML=CAT.map(function(c){return '<option value="'+c[0]+'">'+c[1]+'</option>'}).join('')});
var COL={K:'var(--K)',N:'var(--N)',C:'var(--C)',D:'var(--D)'}, SHORT={K:'draslíkové',N:'rychlé dusíkaté',C:'vyvážené',D:'dusíkaté bez P a K'};
var MON=['led','úno','bře','dub','kvě','čvn','čvc','srp','zář','říj','lis','pro'];
function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function v(id){return document.getElementById(id).value}
function selTxt(id){var e=document.getElementById(id);return e&&e.value&&e.selectedIndex>=0?e.options[e.selectedIndex].text:''}
function kg(n){return String(n).replace('.',',')}
function read(){
  var checked=function(n){return [].map.call(form.querySelectorAll('input[name="'+n+'"]:checked'),function(i){return i.value})};
  var t={pH:v('st-ph'),P:v('st-p'),K:v('st-k'),Mg:v('st-mg')};
  return {areaM2:v('area'),altitude:v('alt'),soil:v('soil'),tier:(form.querySelector('input[name="tier"]:checked')||{}).value,
    irrigation:v('irr'),mowPerWeek:v('mow'),mower:v('mower'),mowHeightCm:v('mowh'),sun:v('sun'),age:v('age'),grassType:v('grass'),mode:v('mode'),
    problems:checked('prob'),symptoms:checked('sym'),use:document.getElementById('dog').checked?['dog']:[],
    soilTest:(t.pH||t.P||t.K||t.Mg)?t:null, climate:climate};
}
function wheel(rows){
  var cx=150,cy=150,R=118,s='';
  var pt=function(h,rr){var a=(h/24)*Math.PI*2-Math.PI/2;return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]};
  s+='<circle cx="150" cy="150" r="118" fill="none" stroke="rgba(239,235,224,.14)" stroke-width="26"/>';
  for(var m=0;m<12;m++){var a=pt(m*2,105),b=pt(m*2,131),l=pt(m*2+1,146);s+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#0c1a13" stroke-width="2"/><text x="'+l[0]+'" y="'+(l[1]+4)+'" text-anchor="middle" font-size="11" fill="#a9b8ab" font-family="Schibsted Grotesk,sans-serif">'+MON[m]+'</text>'}
  rows.forEach(function(r){if(typeof r.half!=='number')return;var p=pt(r.half+0.5,118);s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="9" fill="'+COL[r.key||'C']+'" stroke="#0c1a13" stroke-width="2"/>'});
  s+='<text x="150" y="146" text-anchor="middle" font-size="34" fill="#c6e36c" font-family="Young Serif,serif">'+rows.length+'×</text><text x="150" y="168" text-anchor="middle" font-size="12" fill="#a9b8ab" font-family="Schibsted Grotesk,sans-serif">hnojení za rok</text>';
  return '<svg class="wheel" viewBox="0 0 300 300" role="img" aria-label="Roční kolo – termíny hnojení">'+s+'</svg>';
}
function render(){
  if(window.MVGreenQuiz&&MVGreenQuiz.setClimate)MVGreenQuiz.setClimate(climate);
  var r;
  // prázdný formulář = prázdná stránka s výzvou (Martin 2026-11-20); plán se spočítá, až je vyplněno nejnutnější
  var need=[];if(!(Number(v('area'))>0))need.push('plochu trávníku');if(!read().tier)need.push('jaký trávník chcete');if(v('obec').trim().length<2)need.push('obec');
  if(need.length){res.innerHTML='<div class="pcard"><div class="phead"><span class="eyebrow">Váš plán</span><h3>'+(unlocked?'Plán je odemčený':'Plán se ukáže tady')+'</h3><p class="muted">Vyplňte ještě: '+need.join(', ')+'. Ostatní otázky plán zpřesní.</p></div></div>';lastRes=null;if(window.MVGreenQuiz)MVGreenQuiz.update(null,need);return}
  try{r=B.decide(read())}catch(e){res.innerHTML='<p class="muted">Výpočet se nepovedl: '+esc(e.message)+'</p>';return}
  var rows=r.fertTableReference, thrifty=r.mode==='thrifty', meta=r.plan.tierMeta||{}, K=r.knowledge, PR=B.PROC, area=r.plan.areaM2||0;
  var mh=r.plan.mowHeight||{}, hTxt=mh.min?(mh.min===mh.max?kg(mh.min):mh.min+'–'+mh.max)+' cm':'–';
  var rank={high:0,medium:1,info:2};
  var all=r.warnings.concat(r.recommendations).filter(function(m){return m.rule!=='R12'}).sort(function(a,b){return rank[a.severity]-rank[b.severity]});
  var lock=function(title){return '<div class="lockbox"><b>🔒 '+esc(title)+'</b><span>Součást celého plánu za 499 Kč.</span> <a class="btn small" href="#koupit-plan">Koupit plán</a></div>'};
  // Správce vidí odemčený plán; přepínač ukáže, co uvidí zákazník před zaplacením (Martin 2026-11-22: myslel si, že se plán ukazuje všem)
  var h=(CFG.admin&&!paid)?'<div class="admbar"><span>Jste přihlášen jako správce. '+(unlocked?'Vidíte odemčený plán, jako po zaplacení.':'Vidíte náhled, který má zákazník před zaplacením.')+'</span><button type="button" class="btn small ghost" id="admToggle">'+(unlocked?'Zobrazit jako zákazník':'Zobrazit odemčený plán')+'</button></div>':'', NEW=unlocked&&!thrifty&&rows.length>0, eb=function(n,t){return NEW?t:n+' · '+t};
  // Výstup po zaplacení = nový interaktivní přehled (plan-output.js); ostatní části zůstávají jako podrobné návody pod ním (Martin 2026-11-20)
  if(NEW&&window.MVGreenPlanOutput){h+=window.MVGreenPlanOutput.html()}else NEW=false;
  // 1) V kostce
  if(!NEW)h+='<section class="pcard" id="p-souhrn"><div class="phead"><span class="eyebrow">Váš plán v kostce</span><h3>'+esc(r.tierLabel)+' · '+esc(area)+' m²</h3></div>'+
    '<div class="stats"><div class="stat"><b>'+(thrifty?'podle potřeby':rows.length+'×')+'</b><span>hnojení za rok</span></div><div class="stat"><b>'+esc((meta.nRange||'').replace(' g N/m²/rok',' g'))+'</b><span>dusíku na m² za rok</span></div><div class="stat"><b>'+hTxt+'</b><span>výška sečení</span></div><div class="stat"><b>'+r.care.program.length+'</b><span>druhů údržby trávníku</span></div></div>';
  // Osobní ochutnávka (Martin 2026-11-20, bod 2): zdarma jen čísla pro tuto zahradu a měsíce dávek, složení a množství až po zaplacení
  if(!unlocked&&!thrifty&&rows.length){var totKg=rows.reduce(function(t,x){return t+(x.totalKg||0)},0),MN=['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
    h+='<div class="ptease"><p>Pro vaši zahradu: za rok asi <b>'+kg(Math.round(totKg*10)/10)+' kg</b> hnojiva v <b>'+rows.length+' dávkách</b>, první dávka <b>'+esc(String(rows[0].when).toLowerCase())+'</b>.</p><div class="mchips">'+rows.map(function(x){return '<span class="mchip">'+MN[Math.floor(x.half/2)]+'</span>'}).join('')+'</div><p class="muted" style="font-size:13px;margin:8px 0 0">🔒 Složení hnojiva a množství pro každou dávku jsou v celém plánu.</p></div>'}
  if(NEW&&(all.length||r.climate))h+='<section class="pcard" id="p-souhrn">';
  if(all.length){h+='<div class="keys"><h4>Na co si u vás dát pozor</h4><ol>'+all.slice(0,unlocked?3:1).map(function(m){return '<li class="'+m.severity+'">'+esc(m.text)+'</li>'}).join('')+'</ol>'+(!unlocked?(all.length>1?'<p class="muted" style="margin:8px 0 0;font-size:14px">🔒 Dalších '+(all.length-1)+' doporučení pro váš trávník je v celém plánu.</p>':''):all.length>3?'<details><summary>Další doporučení ('+(all.length-3)+')</summary><ul>'+all.slice(3).map(function(m){return '<li>'+esc(m.text)+'</li>'}).join('')+'</ul></details>':'')+'</div>'}
  if(r.climate){h+='<div class="climate"><h4 style="margin:0;color:var(--lime)">Podnebí '+esc(r.climate.place?'– '+r.climate.place:'')+' (průměr '+r.climate.years+' let)</h4><dl>'+r.climate.rows.map(function(x){return '<dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd>'}).join('')+'</dl>'+(r.climate.notes.length?'<ul style="margin:0;padding-left:18px">'+r.climate.notes.map(function(n){return '<li>'+esc(n)+'</li>'}).join('')+'</ul>':'')+(r.climate.source?'<p class="muted" style="font-size:12px;margin:0">'+esc(r.climate.source)+'</p>':'')+'</div>'}
  if(!unlocked)h+='<p style="margin:14px 0 0"><a class="btn" href="#koupit-plan">Odemknout celý plán – 499 Kč</a></p>';
  if(NEW)h+=(all.length||r.climate)?'</section>':'';else h+='<p class="always">Vždy platí: hnojit jen na suchou trávu a po hnojení vždy zalít (déšť nebo hadice, bez vody hrozí spálení), vertikutace a aerifikace jen když tráva aktivně roste (půda alespoň kolem 10 °C), nic na sníh ani zmrzlou půdu.</p></section>';
  // obsah
  if(!NEW)h+='<nav class="toc" aria-label="Obsah plánu"><a href="#p-kalendar">Kalendář</a><a href="#p-hnojeni">Hnojení</a><a href="#p-drn">Údržba trávníku</a><a href="#p-seceni">Sečení a zálivka</a><a href="#p-problemy">Problémy a choroby</a><a href="#p-nakup">Nákup</a><a href="#p-zdroje">Z čeho plán vychází</a></nav>';
  // 2) Kalendář po měsících
  var cm=new Date().getMonth(),fm=cm;for(var q=0;q<12;q++){var mi=(cm+q)%12;if(r.months[mi]&&r.months[mi].items.some(function(i){return i.type==='fert'})){fm=mi;break}}
  var freeMonths=[r.months[fm]].filter(Boolean);
  var ICON={fert:'Hnojení',care:'Údržba',tip:'Návyk'};
  var mcard=function(m){return '<div class="month"><h4>'+esc(m.name)+'</h4>'+(m.items.length?'<ul>'+m.items.map(function(i){return '<li class="it-'+i.type+'"><span class="tag2">'+ICON[i.type]+'</span><b>'+esc(i.title.replace('Hnojení: ',''))+'</b>'+(i.detail?'<small>'+esc(i.detail)+'</small>':'')+(i.cond&&i.type==='fert'?'<small class="w">'+esc(i.cond)+'</small>':'')+(i.proc?'<a class="howto" href="#n-'+i.proc+'">Návod →</a>':'')+'</li>'}).join('')+'</ul>':'<p class="muted">Klid.</p>')+'</div>'};
  if(!NEW)h+='<section class="pcard" id="p-kalendar"><div class="phead"><span class="eyebrow">1 · Kalendář</span><h3>Co dělat měsíc po měsíci</h3><p class="muted">Termíny jsou nejdřívější možné. Hnojení vždy až první suchý den bez mrazu, mechanické zásahy až při půdě 10 °C.</p></div>'+
    '<div class="months">'+(unlocked?r.months:freeMonths).map(mcard).join('')+'</div>'+(unlocked?'':lock('Zbývajících 11 měsíců kalendáře'))+'</section>';
  // 3) Hnojení
  if(!NEW)h+='<section class="pcard" id="p-hnojeni"><div class="phead"><span class="eyebrow">2 · Hnojení</span><h3>'+(thrifty?'Hnojiva pro případ potřeby':'Dávky během roku')+'</h3><p class="muted">Značku i obchod si vyberte sami, rozhoduje složení na obalu. Když má vaše hnojivo jiné složení, dávka se přepočítá.</p></div>';
  if(thrifty&&r.symptomGuide)h+='<div class="keys"><h4>Kdy přihnojit</h4><ul>'+r.symptomGuide.map(function(g){return '<li><b>'+esc(g.sign)+'.</b> '+esc(g.act)+'</li>'}).join('')+'</ul></div>';
  var fdi=rows.findIndex(function(x){return Math.floor(x.half/2)===fm});if(fdi<0)fdi=0;
  if(!NEW)h+='<div class="doses">'+rows.map(function(x,i){if(!unlocked&&i!==fdi)return '';return '<div class="dose"><div class="d">'+esc(x.when)+'</div><div style="min-width:0"><span class="pill" style="background:'+COL[x.key||'C']+'">'+esc(SHORT[x.key]||'')+'</span><b>'+esc(x.name)+'</b><small>'+esc(x.look)+'</small>'+(x.note?'<small class="w">'+esc(x.note)+'</small>':'')+(x.warn?'<small class="w">⚠ '+esc(x.warn)+'</small>':'')+(x.condition?'<small class="w">'+esc(x.condition)+'</small>':'')+'</div><div class="g"><b>'+x.doseG+' g/m²</b>'+(x.totalKg?kg(x.totalKg)+' kg':'')+'</div></div>'}).join('')+'</div>'+(unlocked||rows.length<2?'':lock('Dalších '+(rows.length-1)+' dávek, složení a množství pro vaši plochu'))+'</section>';
  // 4) Péče o drn – návody
  var procCard=function(p){var d=PR[p.proc],am=r.amount(p.proc);return '<article class="proc" id="n-'+p.proc+'"><div class="ph"><h4>'+esc(d.title)+'</h4><span class="freq">'+esc(p.freq)+'</span></div><dl><dt>Kdy</dt><dd>'+esc(p.when)+'</dd><dt>K čemu</dt><dd>'+esc(d.why)+'</dd><dt>Nářadí</dt><dd>'+esc(d.tools)+'</dd>'+(am?'<dt>Množství</dt><dd>'+esc(am)+'</dd>':'')+'</dl>'+(p.note?'<p class="w">'+esc(p.note)+'</p>':'')+'<ol>'+d.steps.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ol><p class="avoid"><b>Nedělat:</b> '+esc(d.avoid)+'</p><p class="ver">✓ Ověřeno: '+esc(r.verified[p.proc]||'')+'</p></article>'};
  h+='<section class="pcard" id="p-drn"><div class="phead"><span class="eyebrow">'+eb(3,'Údržba trávníku')+'</span><h3>Návody krok za krokem</h3></div>';
  if(unlocked)h+='<div class="plist">'+r.care.program.map(function(p){return '<div class="prow"><b>'+esc(PR[p.proc].title)+'</b><span>'+esc(p.freq)+'</span><small>'+esc(p.when)+'</small></div>'}).join('')+'</div>';
  if(unlocked){h+=r.care.program.map(procCard).join('');if(r.tier==='representative'||r.tier==='sportovni')h+='<article class="proc" id="n-regen"><div class="ph"><h4>Velká podzimní regenerace</h4><span class="freq">konec srpna–září</span></div><ol>'+r.care.regeneration.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ol></article>'}
  else h+=lock('Přehled '+r.care.program.length+' druhů údržby: kdy a jak často, nářadí, množství na vaši plochu, postup, čemu se vyhnout');
  h+='</section>';
  // 5) Sečení a zálivka
  if(K){var lis=function(a){return '<ul>'+a.map(function(t){return '<li>'+esc(t)+'</li>'}).join('')+'</ul>'};
    h+='<section class="pcard" id="p-seceni"><div class="phead"><span class="eyebrow">'+eb(4,'Sečení a zálivka')+'</span><h3>Pravidla, která drží trávník hustý</h3></div>';
    if(K.newLawn&&unlocked)h+='<div class="keys"><h4>Nový trávník</h4>'+lis(K.newLawn)+'</div>';
    h+=unlocked?'<div class="two-col"><div><h4>Sečení</h4>'+lis(K.mow)+'</div><div><h4>Zálivka</h4>'+lis(K.water.concat([K.newSeed]))+'</div></div>':lock('Pravidla sečení a zálivky pro váš trávník');
    h+='</section>';
    // 6) Problémy
    var prob=function(p){return '<details class="prob"><summary>'+esc(p.name)+'</summary><dl><dt>Kdy</dt><dd>'+esc(p.when)+'</dd><dt>Jak poznat</dt><dd>'+esc(p.sign)+'</dd><dt>Prevence</dt><dd>'+esc(p.prevent)+'</dd><dt>Co dělat</dt><dd>'+esc(p.fix)+'</dd></dl></details>'};
    h+='<section class="pcard" id="p-problemy"><div class="phead"><span class="eyebrow">'+eb(5,'Problémy a choroby')+'</span><h3>Jak poznat a co dělat</h3><p class="muted">Chemii plán nedoporučuje jménem, jen přípravky registrované v ČR pro trávník, podle etikety.</p></div>';
    if(K.myProblems.length)h+='<h4>Vaše problémy</h4>'+(unlocked?K.myProblems.map(prob).join(''):'<p class="muted">'+K.myProblems.map(function(p){return esc(p.name)}).join(', ')+'. Jak je poznat, předejít jim a co dělat je v celém plánu.</p>');
    h+=unlocked?'<h4>Průvodce ('+K.allProblems.length+')</h4>'+K.allProblems.filter(function(p){return K.myProblems.indexOf(p)===-1}).map(prob).join(''):lock('Průvodce '+K.allProblems.length+' chorobami, plevely a škůdci');
    h+='</section>';
  }
  // 7) Nákup
  if(!NEW){h+='<section class="pcard" id="p-nakup"><div class="phead"><span class="eyebrow">6 · Nákup</span><h3>Co koupit na celý rok</h3></div>';
  if(unlocked){
    h+='<div class="shop">'+r.shopping.rows.map(function(s){return '<div class="r"><span><span class="pill" style="background:'+COL[s.key]+'">'+esc(SHORT[s.key])+'</span>'+esc(s.name)+'<br><small class="muted">'+s.doses+'× za rok</small></span><b>'+kg(s.kg)+' kg</b></div>'}).join('');
    ['pisek','dosev'].forEach(function(k){if(r.care.program.some(function(p){return p.proc===k})){var am=r.amount(k);if(am)h+='<div class="r"><span>'+esc(PR[k].title)+'<br><small class="muted">'+esc(am)+'</small></span><b></b></div>'}});
    h+='</div><p><button type="button" class="btn" id="icsBtn">Přidat připomínky do kalendáře v mobilu</button></p><p class="muted" style="font-size:14px">Stáhne se soubor kalendáře s připomínkami hnojení i údržby trávníku. Telefon upozorní den předem v 8:00. Nic se nikam neodesílá.</p>';
  } else h+=lock('Nákupní seznam v kg pro vaši plochu a připomínky do mobilu');
  h+='</section>'}
  // 8) Zdroje
  h+='<section class="pcard" id="p-zdroje"><div class="phead"><span class="eyebrow">Z čeho plán vychází</span><h3>Ověřené postupy, ne obecné rady</h3></div><ul class="src"><li><b>Praxe MVGreen</b> – plán hnojení a péče, podle kterého od roku 2024 roste naše anglická zahrada v Domažlicích.</li><li><b>Univerzitní doporučení</b> – americké zemědělské univerzity (např. Purdue, Kansas State, Penn State, Illinois) pro dávky dusíku, aerifikaci, dosev, zálivku a choroby.</li><li><b>Čeští profesionální trávníkáři</b> – praxe z hřišť a okrasných trávníků (pískování, vertikutace, lipnice roční).</li><li>U každého návodu je uvedeno, z čeho je ověřený. Kde se zdroje rozcházejí nebo jde o naši vlastní praxi, píšeme to otevřeně.</li></ul></section>';
  if(!unlocked)h+='<div class="paywall" id="koupit-plan"><h3>Celý plán za 499 Kč</h3><p class="muted">Všech 12 měsíců kalendáře, všech '+rows.length+' dávek, návody s množstvím na vaši plochu, sečení a zálivka, průvodce chorobami, nákupní seznam a připomínky do mobilu.</p>'+
    '<div class="buybox"><label for="buyEmail" class="muted" style="font-size:14px">Váš e-mail (pošleme na něj kód k plánu)</label><input type="email" id="buyEmail" autocomplete="email" placeholder="vas@email.cz">'+
    '<label style="font-size:13px;display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="buyConsent" style="margin-top:3px"><span>Souhlasím, aby plnění začalo ihned po zaplacení, a beru na vědomí, že tím ztrácím právo na odstoupení do 14 dnů. <a href="'+esc(CFG.terms)+'" target="_blank" rel="noopener" style="color:var(--lime)">Obchodní podmínky</a></span></label>'+
    '<button type="button" class="btn" id="buyBtn">Objednat s povinností platby – 499 Kč</button>'+
    '<label for="codeIn" class="muted" style="font-size:14px;margin-top:6px">Už máte kód z e-mailu?</label><div class="lookup"><input type="text" id="codeIn" maxlength="11" autocomplete="off" placeholder="Např. AB12C-3DE45"><button type="button" class="btn small ghost" id="codeBtn">Odemknout</button></div><p class="msg" id="payMsg" aria-live="polite"></p></div></div>';
  res.innerHTML=h;
  var at=document.getElementById('admToggle');if(at)at.addEventListener('click',function(){unlocked=!unlocked;render()});
  if(NEW){var P={place:v('obec').trim(),alt:v('alt'),irrKey:v('irr'),soil:selTxt('soil'),sun:selTxt('sun'),irr:selTxt('irr'),grass:selTxt('grass'),probs:[].map.call(form.querySelectorAll('input[name="prob"]:checked,input[name="sym"]:checked,#dog:checked'),function(i){return i.parentNode.textContent.trim()})};
    P.mow=[selTxt('mow'),selTxt('mower'),v('mowh')?v('mowh')+' cm':''].filter(Boolean).join(', ');
    window.MVGreenPlanOutput.mount({r:r,rows:rows,climate:climate,prof:P,area:area})}
  if(!unlocked){var sa=st&&st.querySelector('a');if(sa){sa.setAttribute('href','#koupit-plan');sa.textContent='Koupit plán'}}
  lastRes=r;
  if(window.MVGreenQuiz)MVGreenQuiz.update(r,[]);
  bindPay();
}
// Odpovědi se pamatují v prohlížeči, ať zákazník po návratu z platební brány nevyplňuje vše znovu (2026-11-17).
function saveForm(){try{var o={};Array.prototype.forEach.call(form.elements,function(el){if(!el.id&&!el.name)return;var k=el.id||(el.name+':'+el.value);
  o[k]=(el.type==='checkbox'||el.type==='radio')?el.checked:el.value});localStorage.setItem('mvgPlanForm',JSON.stringify({f:o,c:climate,t:Date.now()}))}catch(e){}}
function loadForm(){try{var d=JSON.parse(localStorage.getItem('mvgPlanForm')||'null');if(!d||!d.f)return;Array.prototype.forEach.call(form.elements,function(el){var k=el.id||(el.name+':'+el.value);if(!(k in d.f))return;
  if(el.type==='checkbox'||el.type==='radio')el.checked=!!d.f[k];else el.value=d.f[k]});if(d.c)climate=d.c}catch(e){}}
// Odpovědi z dotazníku se ukládají i k objednávce na serveru (2026-11-20, Martin: odkaz z e-mailu otevřel prázdnou stránku bez plánu),
// takže se plán po zadání kódu sestaví na jakémkoli zařízení.
function collectForm(){var o={};Array.prototype.forEach.call(form.elements,function(el){if(!el.id&&!el.name)return;var k=el.id||(el.name+':'+el.value);o[k]=(el.type==='checkbox'||el.type==='radio')?el.checked:el.value});return {f:o,c:climate}}
function applyForm(d){if(!d||!d.f)return;Array.prototype.forEach.call(form.elements,function(el){var k=el.id||(el.name+':'+el.value);if(!(k in d.f))return;if(el.type==='checkbox'||el.type==='radio')el.checked=!!d.f[k];else el.value=d.f[k]});if(d.c)climate=d.c;if(window.MVGreenQuiz)MVGreenQuiz.refresh()}
loadForm();
if(window.MVGreenQuiz)MVGreenQuiz.init({form:form});
form.addEventListener('input',function(){render();saveForm()});form.addEventListener('change',function(){render();saveForm()});form.addEventListener('submit',function(e){e.preventDefault()});
render();
// Návrat z platební brány: ?mvg_platba=diky|cekame, kód v #kod=… (server ho tam dá jen u zaplacené objednávky).
(function(){var u;try{u=new URL(location.href)}catch(e){return}var st=u.searchParams.get('mvg_platba'),m=/[#&]kod=([A-Za-z0-9-]+)/.exec(location.hash);if(!st&&!m)return;
  var box=document.createElement('p');box.className='msg';box.setAttribute('role','status');box.style.margin='0 0 16px';box.style.gridColumn='1 / -1';res.parentNode.insertBefore(box,form);
  if(m){box.textContent='Odemykám plán…';Promise.resolve(checkCode(decodeURIComponent(m[1]),true)).then(function(ok){box.className='msg '+(ok?'ok':'err');box.textContent=ok?'Děkujeme za platbu. Plán je odemčený a kód máte i v e-mailu.':'Plán se nepodařilo odemknout. Zadejte prosím kód z e-mailu níže v plánu.'})}
  else if(st==='cekame'){box.textContent='Platbu ještě ověřujeme. Jakmile ji banka potvrdí, pošleme vám kód e-mailem a plán si odemknete.'}
  else if(st==='zruseno'){box.textContent='Platba byla zrušena, nic jsme vám nestrhli. Plán si můžete koupit kdykoli níže.'}
  else if(st==='diky'){box.className='msg ok';box.textContent='Děkujeme za platbu. Kód k plánu vám přišel e-mailem.'}
  u.searchParams.delete('mvg_platba');u.hash='';history.replaceState(null,'',u.toString());
  setTimeout(function(){document.getElementById('plan').scrollIntoView()},50)})();

// ===== web: AJAX (obec → výška a podnebí přes náš server, kód, nákup, připomínky) =====
function ajax(action,data){var fd=new FormData();fd.append('action',action);fd.append('nonce',CFG.nonce);Object.keys(data||{}).forEach(function(k){fd.append(k,data[k])});
  return fetch(CFG.ajaxUrl,{method:'POST',body:fd,credentials:'same-origin'}).then(function(r){return r.json().catch(function(){throw new Error('Server teď neodpovídá. Zkuste to prosím za chvíli znovu.')})},function(){throw new Error('Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.')}).then(function(j){if(!j||!j.success)throw new Error((j&&j.data&&j.data.message)||'Něco se nepovedlo.');return j.data})}
function setMsg(id,kind,t){var el=document.getElementById(id);if(el){el.className='msg '+(kind||'');el.textContent=t||''}}
function lookup(){var name=v('obec').trim(),btn=document.getElementById('obecBtn');if(name.length<2){setMsg('obecMsg','err','Zadejte prosím obec.');return}
  btn.disabled=true;setMsg('obecMsg','','Zjišťuji podnebí obce…');
  ajax('mvgreen_climate',{obec:name}).then(function(d){climate=d.climate;if(d.climate&&d.climate.elevation!=null)document.getElementById('alt').value=Math.round(d.climate.elevation);
    setMsg('obecMsg','ok',d.place+(d.admin?' ('+d.admin+')':'')+' · '+(d.climate.elevation!=null?Math.round(d.climate.elevation)+' m n. m. · ':'')+'podnebí za '+d.climate.years+' let doplněno'+(d.others&&d.others.length?'. Myslíte jinou obec? Napište i okres, např. „'+d.others[0]+'“.':''));render()})
  .catch(function(e){climate=null;setMsg('obecMsg','err',e.message)}).then(function(){btn.disabled=false})}
function checkCode(code,silent){code=(code||'').trim().toUpperCase();if(!code){setMsg('payMsg','err','Zadejte prosím kód z e-mailu.');return}
  return ajax('mvgreen_kod_check',{code:code}).then(function(d){if((d.grants||[]).indexOf('care')===-1)throw new Error('Tento kód neobsahuje roční plán péče.');
    if(d.form&&!(Number(v('area'))>0)){applyForm(d.form);saveForm()}
    unlocked=true;paid=true;try{localStorage.setItem('mvgPlanCode',code)}catch(e){}render();return true})
  .catch(function(e){if(!silent)setMsg('payMsg','err',e.message);else{try{localStorage.removeItem('mvgPlanCode')}catch(x){}}return false})}
function bindPay(){
  var cb=document.getElementById('codeBtn');if(cb)cb.addEventListener('click',function(){checkCode(v('codeIn'))});
  var bb=document.getElementById('buyBtn');if(bb)bb.addEventListener('click',function(){
    var em=v('buyEmail').trim();if(!em){setMsg('payMsg','err','Zadejte prosím e-mail.');return}
    if(!document.getElementById('buyConsent').checked){setMsg('payMsg','err','Potvrďte prosím souhlas se zahájením plnění.');return}
    if(bb.disabled)return;bb.disabled=true;bb.classList.add('busy');bb.innerHTML='<span class="spin" aria-hidden="true"></span>Přesměrovávám na platbu…';setMsg('payMsg','','');
    // Překryv přes celou stránku: zákazník vidí, že se něco děje, a nemůže kliknout znovu (Martin 2026-11-20: kliknul 10×, protože nic neviděl; server na každé kliknutí vytvoří objednávku)
    var ov=document.createElement('div');ov.className='payov';ov.setAttribute('role','alertdialog');ov.setAttribute('aria-live','assertive');
    ov.innerHTML='<div class="payov-box"><span class="spin big" aria-hidden="true"></span><b>Přesměrovávám vás na zabezpečenou platbu</b><span>Může to trvat až několik sekund. Nezavírejte prosím okno a neklikejte znovu.</span><span class="payov-slow" style="display:none">Trvá to déle než obvykle, platba se pořád připravuje. Vyčkejte prosím.</span></div>';
    document.body.appendChild(ov);var slow=setTimeout(function(){var el=ov.querySelector('.payov-slow');if(el)el.style.display='block'},12000);
    var stopBusy=function(){clearTimeout(slow);ov.remove();bb.disabled=false;bb.classList.remove('busy');bb.textContent='Objednat s povinností platby – 499 Kč'};
    ajax('mvgreen_kod_buy',{email:em,consent:'1',package:'care',form:JSON.stringify(collectForm())}).then(function(d){location.href=d.redirect}).catch(function(e){stopBusy();setMsg('payMsg','err',e.message)})});
  var ib=document.getElementById('icsBtn');if(ib&&lastRes)ib.addEventListener('click',function(){
    var blob=new Blob([B.buildICS(lastRes)],{type:'text/calendar;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='trávník-připomínky.ics';
    document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000)});
}
document.getElementById('obecBtn').addEventListener('click',lookup);
document.getElementById('obec').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();lookup()}});
if(v('obec').trim().length>=2)lookup();

})();
