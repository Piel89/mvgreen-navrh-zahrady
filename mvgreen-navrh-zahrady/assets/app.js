(()=>{'use strict';
const root=document.querySelector('[data-mvgreen-designer]');if(!root)return;
root.innerHTML=`<div class="mg-shell"><header class="mg-head"><h2>🌿 MVGreen – Navrhni si zahradu</h2><p>Navrhněte svou zahradu jednoduše, krok za krokem.</p></header><div class="mg-body"><section class="mg-welcome" id="mg-welcome"><div class="mg-welcome-copy"><span class="mg-eyebrow">🌿 MVGreen · Navrhni si zahradu</span><h2>Podívejte se, jak krásná může být právě vaše zahrada.</h2><p>Nahrajte vlastní fotografii, zvolte styl zahrady a rozpočet. S návrhem vám pomůže AI — bez hodin složitého kreslení.</p><button type="button" id="mg-start" class="mg-primary mg-start">🌱 Začít s návrhem →</button><small>Vaše fotografie. Váš styl. Váš rozpočet.</small></div><div class="mg-welcome-image mg-hero-comparison" aria-label="Ukázka proměny zahrady před a po úpravě"><img class="mg-hero-after" src="https://mvgreen.cz/wp-content/uploads/2026/10/mvgreen-ai-navrh.png" alt="PO: návrh zahrady s okrasnými trávami, levandulí a cestičkou" fetchpriority="high"><img class="mg-hero-before" src="https://mvgreen.cz/wp-content/uploads/2026/10/4a7473d4-21f1-43b8-abdb-583ae4a93e2f.jpg" alt="PŘED: původní zahrada před úpravou"><span class="mg-hero-image-label" aria-live="polite"><span class="mg-hero-label-after">PO – AI návrh zahrady</span><span class="mg-hero-label-before">PŘED – původní zahrada</span></span><button type="button" class="mg-hero-touch-toggle" aria-pressed="false" aria-label="Zobrazit původní zahradu před úpravou">Zobrazit PŘED ↔ PO</button></div><div class="mg-welcome-styles" aria-label="Inspirace pro váš návrh"><button type="button" data-welcome-variant="A"><img loading="lazy" src="https://images.pexels.com/photos/479814/pexels-photo-479814.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Udržovaný zelený trávník"><strong>Anglický trávník</strong><small>Hustý a krásně zelený trávník s čistými liniemi</small></button><button type="button" data-welcome-variant="B"><img loading="lazy" src="https://images.pexels.com/photos/12220735/pexels-photo-12220735.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Zahrada s trávníkem a výsadbou"><strong>Trávník a výsadba</strong><small>Kombinace trávníku, záhonů a okrasných rostlin</small></button><button type="button" data-welcome-variant="B"><img loading="lazy" src="https://images.pexels.com/photos/33752181/pexels-photo-33752181.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Moderní minimalistická zahrada se zelení a čistými liniemi"><strong>Moderní zahrada</strong><small>Elegantní, moderní a nadčasová</small></button><button type="button" data-welcome-variant="C"><img loading="lazy" src="https://images.pexels.com/photos/34909157/pexels-photo-34909157.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=850" alt="Nenáročná zahrada se štěrkem, kameny a suchomilnými rostlinami"><strong>Zahrada s minimální údržbou</strong><small>Krásná zahrada s minimem práce</small></button></div></section><div class="mg-wizard-progress mg-hidden" id="mg-wizard-progress"><span id="mg-progress-label">Krok 1 ze 4</span><div class="mg-progress-track"><span id="mg-progress-fill"></span></div></div><section class="mg-wizard-step" data-mg-step="2" hidden><div class="mg-step-kicker">02 / 09 · VAŠE FOTOGRAFIE</div><h3 class="mg-section-title">Nahrajte fotografii zahrady</h3><p class="mg-note">Nahrajte fotografii a vyberte, jak budete pokračovat.</p><div class="mg-mode-heading"><strong>Vyberte způsob tvorby návrhu</strong><small>Vaše volba určí postup v následujících krocích. Můžete ji později změnit.</small></div><div class="mg-mode-select" role="group" aria-label="Způsob návrhu"><button type="button" class="mg-mode-card" data-mg-mode="auto" aria-pressed="true"><strong>✨ Automatický AI návrh</strong><small>AI navrhne zahradu podle fotografie a vašich požadavků. Bez ručního zakreslování.</small></button><button type="button" class="mg-mode-card" data-mg-mode="advanced" aria-pressed="false"><strong>✏️ Pokročilé úpravy</strong><small>Sami označíte plochy a určíte, co zachovat, změnit nebo odstranit.</small></button></div><input type="hidden" id="mg-design-mode" value="auto"><div class="mg-field"><label for="mg-photo">2. Fotografie zahrady</label><input id="mg-photo" type="file" accept="image/jpeg,image/png,image/webp"><p class="mg-note">JPG, PNG nebo WebP, max. 10 MB. Fotografie zůstává ve vašem prohlížeči.</p></div><div class="mg-calibration"><strong>📏 Zpřesněte rozměry zahrady</strong><p class="mg-note">Díky jedné známé vzdálenosti lépe odhadneme plochu trávníku a záhonů, počet rostlin i orientační rozpočet. Označte dva body, například konce plotu, a zadejte skutečnou vzdálenost. Měření z fotografie zůstává orientační.</p><div class="mg-scale-controls"><button type="button" id="mg-calibrate">📏 Změřit známou vzdálenost</button><span id="mg-scale-status">Měřítko není nastavené</span></div><p class="mg-measure-hint">Neznáte rozměr? Můžete pokračovat i bez něj, výměry a cenový odhad však budou méně přesné.</p></div><div class="mg-stage" id="mg-stage"><button type="button" id="mg-photo-fullscreen" class="mg-photo-fullscreen" aria-label="Otevřít fotografii na celou obrazovku" title="Celá obrazovka">⛶</button><div id="mg-rotate-hint" class="mg-rotate-hint mg-hidden" role="status" aria-live="polite"><span aria-hidden="true">📱↻</span> Otočte telefon na šířku pro pohodlnější kreslení.</div><button type="button" id="mg-exit-fullscreen" class="mg-exit-fullscreen">✕ Zavřít</button><span id="mg-placeholder">Nahrajte fotografii a zakreslete požadované změny.</span><canvas id="mg-canvas" class="mg-hidden" tabindex="0" aria-label="Zakreslení oblastí zahrady"></canvas><div id="mg-crosshair" class="mg-crosshair mg-hidden" aria-hidden="true">＋</div><div class="mg-fullscreen-bar" role="toolbar" aria-label="Kreslení na celé obrazovce"><button type="button" id="mg-fs-undo">↶ Zpět</button><button type="button" id="mg-fs-redo">↷ Vpřed</button><button type="button" data-fs-tool="keep" aria-pressed="true">🟢 Zachovat</button><button type="button" data-fs-tool="remove" aria-pressed="false">🔴 Odstranit</button><button type="button" data-fs-tool="change" aria-pressed="false">🔵 Změnit</button></div></div><div class="mg-below-photo"><label class="mg-check"><input type="checkbox" id="mg-snap" checked> Automaticky dotahovat a přichytávat body a hrany</label><div class="mg-tools"><button type="button" data-tool="keep" aria-pressed="true">🟢 Zachovat</button><button type="button" data-tool="remove" aria-pressed="false">🔴 Odstranit</button><button type="button" data-tool="change" aria-pressed="false">🔵 Změnit</button></div></div><div class="mg-editor-actions"><div class="mg-mode-tabs" role="group" aria-label="Režim editoru"><button type="button" id="mg-tab-draw" aria-pressed="true">✏️ Kreslit</button><button type="button" id="mg-select" aria-pressed="false">↖ Upravit</button><button type="button" id="mg-tab-pan" aria-pressed="false">✥ Posouvat</button></div><div class="mg-draw-tools" id="mg-draw-tools"><button type="button" id="mg-polygon" class="mg-primary">Mnohoúhelník</button><button type="button" id="mg-rectangle">▭ Obdélník</button><button type="button" id="mg-finish">✓ Dokončit</button><button type="button" id="mg-cancel">Zrušit kreslení</button></div><div class="mg-quick-tools"><button type="button" id="mg-undo">↶ Zpět</button><button type="button" id="mg-redo">↷ Znovu</button><button type="button" id="mg-zoom-out" aria-label="Oddálit">−</button><button type="button" id="mg-zoom-reset">100 %</button><button type="button" id="mg-zoom-in" aria-label="Přiblížit">＋</button><button type="button" id="mg-settings-toggle" aria-expanded="false">⚙ Nastavení ▾</button></div><div id="mg-settings-panel" class="mg-settings-panel mg-hidden"><button type="button" id="mg-fullscreen">⛶ Celá obrazovka</button><button type="button" id="mg-clear">Vymazat všechny oblasti</button><span class="mg-zoom-tip">PC: Ctrl + kolečko přibližuje, mezerník dočasně posouvá. Esc vrací poslední bod.</span></div><p id="mg-mode-hint" class="mg-mode-hint" aria-live="polite">Klikáním označte rohy oblasti. Dvojklikem ji dokončíte.</p></div><div class="mg-mobile-controls"><button type="button" id="mg-mobile-pan">✥ Posouvat fotografii</button><button type="button" id="mg-mobile-point">＋ Přidat bod pod křížem</button><span>Pro přesné body posuňte fotografii pod zaměřovací kříž.</span></div><p class="mg-note">Vyberte barvu a rovnou kreslete další oblasti. Klikáním přidávejte body, dvojklikem nebo tlačítkem Dokončit oblast uzavřete. Hotové body lze táhnout, celou plochu posouvat. Kliknutím na hranu přidáte bod. Rozměry jsou přibližné a závisí na měřítku a perspektivě fotografie.</p><div id="mg-area-list" class="mg-area-list" aria-live="polite"></div></section><section class="mg-wizard-step" data-mg-step="1" hidden><div class="mg-step-kicker">01 / 09 · STYL ZAHRADY</div><h3 class="mg-section-title">1 Výběr stylu zahrady</h3><p class="mg-note">Vyberte styl, který se vám nejvíce líbí. Později ho můžeme upravit nebo kombinovat.</p><div class="mg-variant-grid" role="group" aria-label="Výběr ze šesti stylů zahrady"><button type="button" class="mg-variant" data-mg-variant="A" data-mg-style-choice="english" aria-pressed="true"><span class="mg-variant-picture"><img loading="lazy" src="https://images.pexels.com/photos/479814/pexels-photo-479814.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Anglický trávník – inspirativní fotografie zahrady"></span><span class="mg-variant-info"><strong>Anglický trávník</strong><small>Hustý a krásný trávník s čistými liniemi.</small></span></button><button type="button" class="mg-variant" data-mg-variant="B" data-mg-style-choice="lawn-beds" aria-pressed="false"><span class="mg-variant-picture"><img loading="lazy" src="https://images.pexels.com/photos/12220735/pexels-photo-12220735.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Trávník a výsadba – inspirativní fotografie zahrady"></span><span class="mg-variant-info"><strong>Trávník a výsadba</strong><small>Kombinace trávníku, záhonů a okrasných rostlin.</small></span></button><button type="button" class="mg-variant" data-mg-variant="B" data-mg-style-choice="modern" aria-pressed="false"><span class="mg-variant-picture"><img loading="lazy" src="https://images.pexels.com/photos/33752181/pexels-photo-33752181.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Moderní zahrada – inspirativní fotografie zahrady"></span><span class="mg-variant-info"><strong>Moderní zahrada</strong><small>Elegantní, moderní a nadčasová.</small></span></button><button type="button" class="mg-variant" data-mg-variant="B" data-mg-style-choice="natural" aria-pressed="false"><span class="mg-variant-picture"><img loading="lazy" src="https://images.pexels.com/photos/8919730/pexels-photo-8919730.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Přírodní zahrada – inspirativní fotografie zahrady"></span><span class="mg-variant-info"><strong>Přírodní zahrada</strong><small>Přirozený vzhled s trvalkami a keři.</small></span></button><button type="button" class="mg-variant" data-mg-variant="B" data-mg-style-choice="flowers" aria-pressed="false"><span class="mg-variant-picture"><img loading="lazy" src="https://images.pexels.com/photos/16050153/pexels-photo-16050153.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Okrasné záhony – inspirativní fotografie zahrady"></span><span class="mg-variant-info"><strong>Okrasné záhony</strong><small>Barevné květy po celý rok.</small></span></button><button type="button" class="mg-variant" data-mg-variant="C" data-mg-style-choice="low-care" aria-pressed="false"><span class="mg-variant-picture"><img loading="lazy" src="https://images.pexels.com/photos/34909157/pexels-photo-34909157.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Minimum údržby – inspirativní fotografie zahrady"></span><span class="mg-variant-info"><strong>Minimum údržby</strong><small>Krásná zahrada s minimem práce.</small></span></button></div><input type="hidden" id="mg-variant" value="A"><input type="hidden" id="mg-style-card" value="english"><p class="mg-note mg-variant-note" id="mg-variant-note" role="status">Vybráno: Anglický trávník</p><div class="mg-grid"><details class="mg-style-subvariants"><summary>Upravit výběr – 3 podvarianty stylu</summary><div id="mg-tailored-choices" class="mg-tailored-choices" aria-live="polite"></div></details><div class="mg-field"><label for="mg-style">Styl zahrady</label><select id="mg-style"><option>Moderní</option><option>Přírodní</option><option>Venkovská</option><option>Minimalistická</option><option>Nenáročná na údržbu</option></select></div><div class="mg-hidden mg-preference-internal" aria-hidden="true"><select id="mg-preference"><option value="auto">✨ Nechám výběr na AI</option><option value="mix">🌿 Kombinaci rostlin</option><option value="grasses">🌾 Okrasné traviny</option><option value="flowers">🌸 Kvetoucí trvalky</option><option value="shrubs">🌳 Okrasné keře</option><option value="trees">🌲 Stromy</option></select></div><div class="mg-field"><label for="mg-sun">Sluneční podmínky</label><select id="mg-sun"><option>Slunce</option><option>Polostín</option><option>Stín</option><option>Různé podmínky</option></select></div><div class="mg-field mg-optional-field"><label for="mg-width">Šířka upravované plochy (m)</label><input id="mg-width" type="number" min="0.1" max="10000" step="0.1" placeholder="např. 10"></div><div class="mg-field mg-optional-field"><label for="mg-length">Délka upravované plochy (m)</label><input id="mg-length" type="number" min="0.1" max="10000" step="0.1" placeholder="např. 15"></div><div class="mg-field mg-advanced-hidden"><label for="mg-min">Rozpočet od (Kč)</label><input id="mg-min" type="number" min="0" step="1000" value="10000"></div><div class="mg-field mg-optional-field"><label for="mg-build">Způsob realizace</label><select id="mg-build"><option>Svépomocí</option><option>Zahradnickou firmou</option><option>Zatím nevím</option></select></div><div class="mg-field"><label for="mg-maint">Požadovaná údržba</label><select id="mg-maint"><option>Nízká</option><option>Střední</option><option>Nevadí vyšší</option></select></div></div></section><section class="mg-wizard-step" data-mg-step="4" hidden><div class="mg-step-kicker">04 / 09 · DETAILY ZAHRADY</div><h3 class="mg-section-title">Zahrada podle vašich podmínek</h3><p class="mg-note">Rozpočet je orientační horní hranice, které se návrh snaží přiblížit bez překročení.</p><div class="mg-field"><label for="mg-max">Maximální rozpočet (Kč)</label><input id="mg-max" type="number" min="0" step="1000" value="50000"></div><p class="mg-note">Řekněte nám, kde zahrada je a kolik do ní chcete investovat.</p><section class="mg-plan" aria-label="Plán rostlin a rozpočtu"><h3>🌱 Rostliny a orientační rozpočet</h3><p class="mg-note">Bezplatný orientační návrh bez volání AI. Přesnou mrazovou polohu, půdu a ceny je nutné ověřit na místě.</p><div class="mg-grid"><div class="mg-field"><label for="mg-locality">Obec / oblast zahrady</label><input id="mg-locality" placeholder="např. Domažlice"></div><div class="mg-field mg-optional-field"><label for="mg-altitude">Nadmořská výška (m, lze opravit)</label><input id="mg-altitude" type="number" min="0" max="1600" placeholder="Zjistíme podle obce"><small id="mg-location-status" role="status">Po zadání obce klikněte na Zjistit nadmořskou výšku.</small><button type="button" id="mg-location-lookup">⛰️ Zjistit nadmořskou výšku</button></div><div class="mg-field"><label for="mg-soil">Půda</label><select id="mg-soil"><option value="unknown">Nevím</option><option value="normal">Běžná propustná</option><option value="clay">Jílovitá / těžká</option><option value="sand">Písčitá / lehká</option></select></div><div class="mg-field"><label for="mg-water">Vlhkost půdy</label><select id="mg-water"><option value="normal">Běžná</option><option value="dry">Suchá</option><option value="wet">Vlhká</option></select></div><div class="mg-field"><label for="mg-bed-area">Plocha nových výsadeb (m²)</label><input id="mg-bed-area" type="number" min="0" max="10000" step="0.5" placeholder="např. 20"></div><div class="mg-field mg-advanced-hidden"><label for="mg-distance">Doprava – vzdálenost jedním směrem (km)</label><input id="mg-distance" type="number" min="0" max="500" step="1" value="15"></div><div class="mg-field mg-advanced-hidden"><label for="mg-transport-rate">Doprava (Kč/km, obě cesty)</label><input id="mg-transport-rate" type="number" min="0" max="200" step="1" value="18"></div><div class="mg-field mg-advanced-hidden"><label for="mg-labor-rate">Výsadba firmou (Kč/m²)</label><input id="mg-labor-rate" type="number" min="0" max="5000" step="10" value="350"></div><div class="mg-field mg-advanced-hidden"><label for="mg-soil-depth">Vrstva substrátu (cm)</label><input id="mg-soil-depth" type="number" min="0" max="50" step="1" value="8"></div><div class="mg-field mg-advanced-hidden"><label for="mg-mulch-depth">Vrstva mulče (cm)</label><input id="mg-mulch-depth" type="number" min="0" max="30" step="1" value="5"></div><div class="mg-field mg-advanced-hidden"><label for="mg-reserve">Rezerva rozpočtu</label><select id="mg-reserve"><option value="10">10 %</option><option value="15" selected>15 %</option><option value="20">20 %</option></select></div></div><div class="mg-actions"><button type="button" id="mg-plan-create" class="mg-primary">🌿 Navrhnout rostliny zdarma</button><button type="button" id="mg-plan-download">⬇ Stáhnout plán (CSV)</button></div><div id="mg-plan-output" class="mg-plan-output mg-hidden" aria-live="polite"></div><p class="mg-note">Rostliny a ceny jsou orientační. Před realizací ověřte konkrétní kultivary a podmínky na zahradě.</p><a id="mg-suppliers" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/zahradnictv%C3%AD/">Vyhledat zahradnictví v okolí ↗</a></section></section><section class="mg-wizard-step" data-mg-step="6" hidden><div class="mg-step-kicker">06 / 09 · VÝSLEDKY NÁVRHU</div><h3 class="mg-section-title">Váš návrh zahrady</h3><p class="mg-note">Máte téměř hotovo. Doplňte poslední přání a zkontrolujte zadání. AI vizualizace je nyní dostupná v testovacím režimu správci webu.</p><div class="mg-result-intro"><div class="mg-result-intro-photo" role="img" aria-label="Ukázka AI návrhu zahrady"></div><div class="mg-result-intro-copy"><strong>Ze skutečné fotografie k vysněné zahradě</strong><p>Váš styl, skutečné podmínky a rozpočet. Výsledný návrh můžete dále upravovat.</p><span>🌿 Návrh přizpůsobený vaší zahradě</span></div></div><div class="mg-field"><label for="mg-notes">Co si na zahradě přejete?</label><textarea id="mg-notes" rows="3" placeholder="Například hortenzie, okrasné trávy, nový záhon, posezení…"></textarea></div><div class="mg-hint">🔒 Při placeném AI testu se fotografie a vyznačené oblasti odešlou službě OpenAI. Bez spuštění testu se nic neodesílá. Textové údaje a geometrie oblastí lze uložit v tomto prohlížeči. Fotografie se neukládá. Po obnovení stránky ji znovu nahrajte.</div><div class="mg-actions"><button type="button" class="mg-primary" id="mg-summary">Zobrazit zadání</button><button type="button" id="mg-ai-test" class="mg-primary mg-hidden">✨ Vytvořit testovací AI návrh (placené API)</button><button type="button" id="mg-save">Uložit údaje v prohlížeči</button><button type="button" id="mg-reset">Vymazat uložené údaje</button></div><div id="mg-ai-result" class="mg-ai-result mg-hidden" aria-live="polite"></div><div id="mg-output" class="mg-result mg-hidden" role="status"></div></section><div class="mg-wizard-footer mg-hidden" id="mg-wizard-footer"><button type="button" id="mg-prev">← Předchozí krok</button><span id="mg-step-description"></span><button type="button" id="mg-next" class="mg-primary">Další krok →</button></div></div></div>`;
const q=id=>root.querySelector('#'+id)||document.getElementById(id),canvas=q('mg-canvas'),ctx=canvas.getContext('2d');
const colors={keep:'#20ad53',remove:'#e43d3d',change:'#168af0'};
// Five distinct garden surfaces match the approved nine-screen reference.
const areaColors={lawn:'#19a94d',bed:'#9234d3',path:'#59616b',mulch:'#9c622f',terrace:'#e78a19'};
const areaNames={lawn:'Trávník',bed:'Záhon',path:'Cestička',mulch:'Mulč / štěrk',terrace:'Terasa'};
const areaColor=a=>areaColors[a.kind]||colors[a.tool]||'#168af0';
let img=null,photoReady=false,tool='keep',areaKind='lawn',mode='polygon',areas=[],draft=[],selected=-1,calibration=[],metersPerPixel=null,zoom=1,panMode=false,drag=null,rectStart=null,hover=null,history=[],redoHistory=[],draftRedo=[],infoOpen=-1,snapEnabled=true,spacePan=false,panDrag=null;
const fmt=n=>Number(n).toLocaleString('cs-CZ',{maximumFractionDigits:1});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const scaleLabel=n=>metersPerPixel?`≈ ${fmt(n*metersPerPixel)} m`:'bez měřítka';
const polygonArea=pts=>Math.abs(pts.reduce((s,p,i)=>{const b=pts[(i+1)%pts.length];return s+p.x*b.y-b.x*p.y},0)/2);
const polygonLength=pts=>pts.reduce((s,p,i)=>s+dist(p,pts[(i+1)%pts.length]),0);
function saveHistory(){redoHistory=[];draftRedo=[];history.push(JSON.stringify({areas,calibration,metersPerPixel}));if(history.length>40)history.shift()}
function point(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))}}
function inside(p,pts){let hit=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit}return hit}
function nearEdge(p,pts){let best=null;pts.forEach((a,i)=>{const b=pts[(i+1)%pts.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=dist(p,{x:a.x+t*dx,y:a.y+t*dy});if(d<Math.max(10,canvas.width/100)&&(!best||d<best.d))best={i,d}});return best}
function label(txt,x,y){ctx.save();ctx.font=`${Math.max(13,canvas.width/95)}px sans-serif`;const w=ctx.measureText(txt).width+14,h=Math.max(20,canvas.width/65);x=Math.max(0,Math.min(canvas.width-w,x-w/2));y=Math.max(h,Math.min(canvas.height,y));ctx.fillStyle='rgba(255,255,255,.93)';ctx.fillRect(x,y-h,w,h);ctx.fillStyle='#183c2c';ctx.fillText(txt,x+7,y-5);ctx.restore()}
function drawShape(pts,color,closed,editing,highlight=false){if(!pts.length)return;ctx.save();ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));if(closed)ctx.closePath();if(closed){ctx.fillStyle=color+(highlight?'55':'33');ctx.fill()}ctx.strokeStyle=color;ctx.lineWidth=Math.max(highlight?4:2,canvas.width/(highlight?320:500));ctx.stroke();if(editing)pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,Math.max(5,canvas.width/180),0,Math.PI*2);ctx.fillStyle='white';ctx.fill();ctx.stroke()});ctx.restore()}

function draw(){if(!photoReady)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);areas.forEach((a,i)=>{const surfaceColor=areaColor(a);drawShape(a.points,surfaceColor,true,i===selected,i===infoOpen);const c=a.points.reduce((v,p)=>({x:v.x+p.x/a.points.length,y:v.y+p.y/a.points.length}),{x:0,y:0});const title=areaNames[a.kind]||({keep:'Zachovat',remove:'Odstranit',change:'Změnit'}[a.tool]);const area=metersPerPixel?`${fmt(polygonArea(a.points)*metersPerPixel**2)} m²`:'';ctx.save();const fontSize=Math.max(13,Math.min(21,canvas.width/75));ctx.font=`700 ${fontSize}px sans-serif`;const w=Math.max(ctx.measureText(title).width,area?ctx.measureText(area).width:0)+24;const h=area?fontSize*2.9:fontSize*1.9;const x=Math.max(2,Math.min(canvas.width-w-2,c.x-w/2)),y=Math.max(2,Math.min(canvas.height-h-2,c.y-h/2));ctx.fillStyle=surfaceColor;ctx.globalAlpha=.92;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(title,x+w/2,y+(area?h*.34:h/2));if(area){ctx.font=`600 ${fontSize*.9}px sans-serif`;ctx.fillText(area,x+w/2,y+h*.72);}ctx.restore();});if(draft.length)drawShape([...draft,...(hover?[hover]:[])],colors[tool],false,true);if(rectStart&&hover){const a=rectStart,b=hover;drawShape([{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y},{x:a.x,y:b.y}],colors[tool],true,true)}if(calibration.length){drawShape(calibration,'#e9a520',false,true);if(calibration.length===2)label(`${fmt(dist(...calibration)*metersPerPixel)} m`,(calibration[0].x+calibration[1].x)/2,(calibration[0].y+calibration[1].y)/2-10)}updateCanvasLayout()}
function updateList(){const el=q('mg-area-list');el.innerHTML='';if(!areas.length){infoOpen=-1;el.textContent='Zatím žádné dokončené oblasti.';return}if(infoOpen>=areas.length)infoOpen=-1;areas.forEach((a,i)=>{const wrap=document.createElement('div');wrap.className='mg-area-item';const row=document.createElement('div');row.className='mg-area-row';const title=document.createElement('span');title.className='mg-area-title';const name={keep:'Zachovat',remove:'Odstranit',change:'Změnit'}[a.tool];title.textContent=`${i+1}. ${areaNames[a.kind]||name} · ${name}`+(metersPerPixel?` · ≈ ${fmt(polygonArea(a.points)*metersPerPixel**2)} m²`:' · bez měřítka');title.style.borderLeft=`5px solid ${areaColor(a)}`;const actions=document.createElement('div');actions.className='mg-area-buttons';const info=document.createElement('button');info.type='button';info.className='mg-info-button';info.textContent='ⓘ Info';info.setAttribute('aria-expanded',String(infoOpen===i));info.addEventListener('click',()=>{infoOpen=infoOpen===i?-1:i;updateList();draw()});const select=document.createElement('button');select.type='button';select.textContent='Upravit';select.addEventListener('click',()=>{selected=i;infoOpen=i;setMode('select');updateList();draw()});const remove=document.createElement('button');remove.type='button';remove.textContent='Smazat';remove.addEventListener('click',()=>{if(!confirm(`Opravdu smazat oblast ${i+1}?`))return;saveHistory();areas.splice(i,1);selected=-1;infoOpen=-1;updateList();draw()});actions.append(info,select,remove);row.append(title,actions);wrap.append(row);if(infoOpen===i){const details=document.createElement('div');details.className='mg-area-details';const heading=document.createElement('strong');heading.textContent=`Podrobnosti oblasti ${i+1}`;details.append(heading);if(!metersPerPixel){const note=document.createElement('p');note.textContent='Pro výpočet délek a plochy nejprve nastavte měřítko podle známé vzdálenosti.';details.append(note)}else{const metrics=document.createElement('div');metrics.className='mg-area-metrics';const area=document.createElement('span');area.textContent=`Plocha: ≈ ${fmt(polygonArea(a.points)*metersPerPixel**2)} m²`;const perimeter=document.createElement('span');perimeter.textContent=`Obvod: ≈ ${fmt(polygonLength(a.points)*metersPerPixel)} m`;metrics.append(area,perimeter);details.append(metrics);const sides=document.createElement('div');sides.className='mg-side-grid';a.points.forEach((pt,j)=>{const item=document.createElement('div');item.className='mg-side-item';const name=document.createElement('span');name.textContent=`Strana ${j+1}`;const value=document.createElement('strong');value.textContent=`≈ ${fmt(dist(pt,a.points[(j+1)%a.points.length])*metersPerPixel)} m`;item.append(name,value);sides.append(item)});details.append(sides);const note=document.createElement('p');note.className='mg-note';note.textContent='Rozměry jsou orientační; perspektiva fotografie může výsledek zkreslovat.';details.append(note)}wrap.append(details)}el.append(wrap)})}

function syncMode(){q('mg-tab-draw').setAttribute('aria-pressed',String(!panMode&&mode!=='select'));q('mg-select').setAttribute('aria-pressed',String(!panMode&&mode==='select'));q('mg-tab-pan').setAttribute('aria-pressed',String(panMode));q('mg-draw-tools').classList.toggle('mg-hidden',panMode||mode==='select');q('mg-mode-hint').textContent=panMode?'Tažením nebo dvěma prsty posouvejte fotografii.':mode==='select'?'Klikněte na oblast a tažením upravte její body.':'Klikáním označte rohy oblasti. Dvojklikem ji dokončíte.';q('mg-polygon').setAttribute('aria-pressed',String(mode==='polygon'));q('mg-rectangle').setAttribute('aria-pressed',String(mode==='rectangle'))}
function setMode(m){mode=m;draft=[];rectStart=null;hover=null;syncMode();draw()}
function setPan(active){panMode=active;q('mg-mobile-pan').setAttribute('aria-pressed',String(active));q('mg-crosshair').classList.toggle('mg-hidden',!active);canvas.style.touchAction=active?'auto':'none';q('mg-stage').classList.toggle('mg-panning',active);syncMode()}
function snapPoint(p,exclude=-1){if(!snapEnabled)return p;const threshold=12/zoom;let best=p,bestD=threshold;areas.forEach((a,i)=>{a.points.forEach((v,j)=>{if(i===selected&&j===exclude)return;const d=dist(p,v);if(d<bestD){bestD=d;best={...v}}});a.points.forEach((v,j)=>{if(i===selected)return;const w=a.points[(j+1)%a.points.length],dx=w.x-v.x,dy=w.y-v.y,t=Math.max(0,Math.min(1,((p.x-v.x)*dx+(p.y-v.y)*dy)/(dx*dx+dy*dy||1))),candidate={x:v.x+t*dx,y:v.y+t*dy},d=dist(p,candidate);if(d<bestD){bestD=d;best=candidate}})});return best}

function finish(){if(draft.length>=3){saveHistory();areas.push({tool,kind:areaKind,points:draft.map(p=>({...p}))});selected=-1;infoOpen=-1;updateList();draft=[];draftRedo=[];hover=null;draw()}else if(draft.length){alert('Oblast potřebuje alespoň 3 body.')}}
// Show the user's uploaded garden immediately on step 1 in BOTH design modes.
const photoField=q('mg-photo').closest('.mg-field');
const photoPreview=document.createElement('figure');
photoPreview.id='mg-upload-preview';
photoPreview.className='mg-upload-preview';
photoPreview.hidden=true;
photoPreview.innerHTML='<img id="mg-upload-preview-image" alt="Náhled nahrané fotografie zahrady"><figcaption><span>✓ Vaše fotografie je připravená</span><small>Stejný snímek použijeme pro automatický návrh i pokročilé úpravy. Plochy můžete označit v kroku 3.</small></figcaption>';
photoField.insertAdjacentElement('afterend',photoPreview);
// Lightweight, local image-quality check. Framing is a heuristic, not object recognition.
function analyzeGardenPhoto(image){
 const sample=document.createElement('canvas');sample.width=160;sample.height=100;
 const context=sample.getContext('2d',{willReadFrequently:true});
 if(!context)return {type:'good',note:'Zkontrolujte, zda je vidět celá zahrada.'};
 context.drawImage(image,0,0,160,100);
 const pixels=context.getImageData(0,0,160,100).data;
 let light=0,dark=0,bright=0,contrast=0,edges=0;
 const lumas=new Float32Array(160*100);
 for(let i=0;i<lumas.length;i++){
  const j=i*4,lum=.2126*pixels[j]+.7152*pixels[j+1]+.0722*pixels[j+2];
  lumas[i]=lum;light+=lum;if(lum<48)dark++;if(lum>210)bright++;
 }
 light/=lumas.length;
 for(let y=1;y<99;y++)for(let x=1;x<159;x++){
  const i=y*160+x;
  const d=Math.abs(lumas[i]-lumas[i-1])+Math.abs(lumas[i]-lumas[i-160]);
  contrast+=d;if(d>54)edges++;
 }
 const edgeRate=edges/(158*98),darkRate=dark/lumas.length;
 if(light<75||darkRate>.67)return {type:'dark',note:'Fotografie je příliš tmavá. Zkuste ji pořídit za denního světla.'};
 // A very dense close-up can be suspected, but cannot be verified from pixels alone.
 if(edgeRate>.44&&bright/lumas.length<.12)return {type:'bad',note:'Fotografie může být příliš detailní. Ověřte, že je vidět celý prostor.'};
 return {type:'good',note:'Světlo vypadá dobře. Zkontrolujte, zda snímek zachycuje celou zahradu.'};
}
function updateGardenPhotoQuality(){
 if(!photoReady||!img)return;
 const result=analyzeGardenPhoto(img);
 root.dataset.mgPhotoQuality=result.type;
 const guide=root.querySelector('.mg-photo-quality-guide');
 if(!guide)return;
 guide.querySelectorAll('.mg-photo-quality-card').forEach(card=>{
  const current=card.classList.contains('mg-photo-quality-'+result.type);
  card.classList.toggle('is-current',current);
  card.hidden=!current;
  card.setAttribute('aria-hidden',String(!current));
 });
 const note=guide.querySelector('.mg-photo-quality-result');
 if(note)note.textContent=result.note;
}
function showUploadedPhotoPreview(){
 if(!photoReady||!img)return;
 const preview=q('mg-upload-preview-image');
 // Reuse the decoded uploaded image directly, with no additional upload to server.
 preview.src=canvas.toDataURL('image/jpeg',0.88);
 const beforeResult=q('mg-result-before');if(beforeResult){beforeResult.src=preview.src;beforeResult.alt='Vaše nahraná fotografie zahrady před návrhem';}
 photoPreview.hidden=false;
 photoPreview.classList.add('is-visible');
 updateGardenPhotoQuality();
}
q('mg-photo').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024){alert('Vyberte JPG, PNG nebo WebP do 10 MB.');e.target.value='';return}const url=URL.createObjectURL(f),next=new Image();next.onload=()=>{img=next;const s=Math.min(1,1400/Math.max(next.naturalWidth,next.naturalHeight));canvas.width=Math.max(1,Math.round(next.naturalWidth*s));canvas.height=Math.max(1,Math.round(next.naturalHeight*s));photoReady=true;zoom=1;calibration=[];metersPerPixel=null;areas=[];draft=[];selected=-1;history=[],redoHistory=[],draftRedo=[],infoOpen=-1,snapEnabled=q('mg-snap').checked;spacePan=false;mode='polygon';canvas.classList.remove('mg-hidden');q('mg-placeholder').classList.add('mg-hidden');q('mg-scale-status').textContent='Měřítko není nastavené';updateList();draw();showUploadedPhotoPreview();root.classList.add('mg-has-photo');updateRotateHint();URL.revokeObjectURL(url)};next.onerror=()=>{URL.revokeObjectURL(url);alert('Fotografii se nepodařilo otevřít.')};next.src=url});
function chooseTool(next){if(draft.length){if(!confirm('Rozpracovaná oblast není dokončená. Přepnout režim a zahodit rozpracované body?'))return}tool=next;draft=[];draftRedo=[];selected=-1;mode='polygon';setPan(false);syncMode();[...root.querySelectorAll('[data-tool]'),...stage.querySelectorAll('[data-fs-tool]')].forEach(x=>x.setAttribute('aria-pressed',String((x.dataset.tool||x.dataset.fsTool)===tool)));draw()}root.querySelectorAll('[data-tool], [data-fs-tool]').forEach(b=>b.addEventListener('click',()=>chooseTool(b.dataset.tool||b.dataset.fsTool)));
// A CSS-fixed editor overlay avoids the browser's non-cancellable native Escape behavior.
function isStageFullscreen(){return stage.classList.contains('mg-fullscreen-fallback')}
function updateCanvasLayout(){
 if(!photoReady||!canvas.width||!canvas.height)return;
 const full=isStageFullscreen();
 const mobile=window.innerWidth<=740;
 const fullToolsWidth=full&&!mobile&&q('mg-design-mode')?.value==='advanced'?210:0;
 const availableWidth=Math.max(1,full?window.innerWidth-fullToolsWidth-48:stage.clientWidth-24);
 const availableHeight=full?Math.max(1,window.innerHeight-(mobile?200:125)):Infinity;
 const fittedWidth=Math.min(availableWidth,availableHeight*canvas.width/canvas.height);
 const finalWidth=Math.max(1,fittedWidth*zoom);
 const finalHeight=finalWidth*canvas.height/canvas.width;
 stage.classList.toggle('mg-fs-no-tools',full&&!fullToolsWidth);
 if(full){stage.style.setProperty('--mg-fs-photo-width',finalWidth+'px');stage.style.setProperty('--mg-fs-photo-height',finalHeight+'px');}
 canvas.style.setProperty('width',finalWidth+'px','important');
 canvas.style.setProperty('height',finalHeight+'px','important');
 canvas.style.setProperty('max-width','none','important');
 canvas.style.setProperty('max-height','none','important');
 canvas.style.flex='0 0 auto';
}
function updateFullscreenUI(){const full=isStageFullscreen(),btn=q('mg-photo-fullscreen');btn.textContent=full?'⤢':'⛶';btn.setAttribute('aria-label',full?'Ukončit celou obrazovku':'Otevřít fotografii na celou obrazovku');btn.title=full?'Ukončit celou obrazovku':'Celá obrazovka';updateRotateHint();updateCanvasLayout()}
function updateRotateHint(){const mobile=window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;q('mg-rotate-hint').classList.toggle('mg-hidden',!photoReady||!mobile)}
function toggleFullscreen(){
 const open=!isStageFullscreen();
 if(open){
  if(!stage.__mgFullscreenMarker){
   stage.__mgFullscreenMarker=document.createComment('MVGreen editor return point');
   stage.parentNode.insertBefore(stage.__mgFullscreenMarker,stage);
  }
  const overlay=document.createElement('div');
  overlay.id='mg-fullscreen-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Úpravy fotografie na celé obrazovce');
  document.body.appendChild(overlay);
  overlay.appendChild(stage);
  stage.__mgOverlay=overlay;
  stage.__mgPreviousZoom=zoom;
  zoom=1;
 }else{
  if(stage.__mgFullscreenMarker?.parentNode)stage.__mgFullscreenMarker.parentNode.insertBefore(stage,stage.__mgFullscreenMarker);
  stage.__mgOverlay?.remove();
  stage.__mgOverlay=null;
  zoom=stage.__mgPreviousZoom||1;
 }
 stage.classList.toggle('mg-fullscreen-fallback',open);
 document.body.classList.toggle('mg-editor-overlay-open',open);
 stage.scrollLeft=0;stage.scrollTop=0;
 updateFullscreenUI();
}
q('mg-fullscreen').addEventListener('click',toggleFullscreen);q('mg-photo-fullscreen').addEventListener('click',toggleFullscreen);
window.addEventListener('resize',updateFullscreenUI);window.addEventListener('orientationchange',updateFullscreenUI);
q('mg-exit-fullscreen').addEventListener('click',()=>{if(isStageFullscreen())toggleFullscreen()});
q('mg-mobile-pan').addEventListener('click',()=>setPan(!panMode));q('mg-mobile-point').addEventListener('click',()=>{if(!photoReady)return alert('Nejprve nahrajte fotografii.');const stage=q('mg-stage'),r=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect(),x=sr.left+sr.width/2,y=sr.top+sr.height/2;const p={x:Math.max(0,Math.min(canvas.width,(x-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(y-r.top)*canvas.height/r.height))};if(mode==='calibrate'){calibrationClick(p)}else{if(mode!=='polygon')setMode('polygon');draftRedo=[];draft.push(snapPoint(p));draw()}});q('mg-calibrate').addEventListener('click',()=>{if(!photoReady){alert('Nejprve nahrajte fotografii.');return}mode='calibrate';calibration=[];draft=[];selected=-1;draw();q('mg-scale-status').textContent='Klikněte na dva body známé vzdálenosti.'});
q('mg-select').addEventListener('click',()=>{setPan(false);setMode('select')});q('mg-tab-draw').addEventListener('click',()=>{setPan(false);setMode('polygon')});q('mg-tab-pan').addEventListener('click',()=>setPan(true));q('mg-settings-toggle').addEventListener('click',()=>{const panel=q('mg-settings-panel'),open=panel.classList.toggle('mg-hidden')===false;q('mg-settings-toggle').setAttribute('aria-expanded',String(open))});q('mg-snap').addEventListener('change',e=>snapEnabled=e.target.checked);q('mg-exit-fullscreen').addEventListener('click',()=>{if(isStageFullscreen())toggleFullscreen()});q('mg-polygon').addEventListener('click',()=>{if(!photoReady)return alert('Nejprve nahrajte fotografii.');selected=-1;setMode('polygon')});q('mg-rectangle').addEventListener('click',()=>{if(!photoReady)return alert('Nejprve nahrajte fotografii.');selected=-1;setMode('rectangle')});q('mg-finish').addEventListener('click',finish);q('mg-cancel').addEventListener('click',()=>setMode('polygon'));
// Zoom anchored to the pointer: preserve the same image location under the cursor.
const stage=q('mg-stage');
function setZoom(next,clientX,clientY){
 if(!photoReady)return;
 const before=canvas.getBoundingClientRect();
 const sr=stage.getBoundingClientRect();
 const anchorX=Number.isFinite(clientX)?clientX:sr.left+sr.width/2;
 const anchorY=Number.isFinite(clientY)?clientY:sr.top+sr.height/2;
 const ratioX=(anchorX-before.left)/Math.max(1,before.width);
 const ratioY=(anchorY-before.top)/Math.max(1,before.height);
 const target=Math.round(Math.max(1,Math.min(4,next))*100)/100;
 if(target===zoom)return;
 zoom=target;draw();
 const after=canvas.getBoundingClientRect();
 stage.scrollLeft+=(after.left+ratioX*after.width)-anchorX;
 stage.scrollTop+=(after.top+ratioY*after.height)-anchorY;
 q('mg-zoom-reset').textContent=Math.round(zoom*100)+' %';
}
q('mg-zoom-in').addEventListener('click',()=>setZoom(zoom+0.1));
q('mg-zoom-out').addEventListener('click',()=>setZoom(zoom-0.1));
q('mg-zoom-reset').addEventListener('click',()=>setZoom(1));
// Wheel without Ctrl scrolls the page as usual. Ctrl+wheel zooms only over the editor.
stage.addEventListener('wheel',e=>{
 if(!photoReady||!e.ctrlKey)return;
 e.preventDefault();
 // One smooth, bounded 10% step per wheel event; trackpads use smaller increments.
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?160:1);
 const step=Math.max(-0.1,Math.min(0.1,-delta/900));
 if(Math.abs(step)<0.001)return;
 setZoom(zoom+step,e.clientX,e.clientY);
},{passive:false});
function calibrationClick(p){calibration.push(p);if(calibration.length===2){const d=dist(...calibration);if(d<3){calibration=[];return alert('Body musí být od sebe vzdálené.')}const input=prompt('Kolik metrů je mezi označenými body? (např. 12)');const m=Number((input||'').replace(',','.'));if(m>0&&Number.isFinite(m)){saveHistory();metersPerPixel=m/d;applyScaleDimensionEstimate();q('mg-scale-status').textContent=`Měřítko nastaveno: ${fmt(m)} m / ${fmt(d)} px`;updateList()}else{calibration=[];q('mg-scale-status').textContent='Měřítko není nastavené'}mode='polygon'}draw()}canvas.addEventListener('pointerdown',e=>{if(!photoReady)return;if(panMode||spacePan){panDrag={x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};canvas.setPointerCapture(e.pointerId);return}const p=point(e);if(mode==='calibrate'){calibrationClick(p);return}if(mode==='polygon'){if(draft.length>=3&&dist(p,draft[0])<Math.max(12,canvas.width/85)){finish();return}draftRedo=[];draft.push(snapPoint(p));draw();return}if(mode==='rectangle'){rectStart=p;hover=p;canvas.setPointerCapture(e.pointerId);return}if(mode==='select'){for(let i=areas.length-1;i>=0;i--){const a=areas[i];const idx=a.points.findIndex(v=>dist(v,p)<Math.max(12,canvas.width/90));if(idx!==-1){saveHistory();selected=i;drag={kind:'vertex',i,index:idx,last:p};break}const edge=nearEdge(p,a.points);if(edge){saveHistory();a.points.splice(edge.i+1,0,p);selected=i;drag={kind:'vertex',i,index:edge.i+1,last:p};break}if(inside(p,a.points)){saveHistory();selected=i;drag={kind:'area',i,last:p};break}}if(drag)canvas.setPointerCapture(e.pointerId);else selected=-1;updateList();draw()}});
canvas.addEventListener('pointermove',e=>{if(panDrag){stage.scrollLeft=panDrag.left+panDrag.x-e.clientX;stage.scrollTop=panDrag.top+panDrag.y-e.clientY;return}if(!photoReady||panMode||spacePan)return;const p=point(e);hover=p;if(drag){const a=areas[drag.i];if(drag.kind==='vertex')a.points[drag.index]=snapPoint(p,drag.index);else{const dx=p.x-drag.last.x,dy=p.y-drag.last.y;a.points=a.points.map(v=>({x:Math.max(0,Math.min(canvas.width,v.x+dx)),y:Math.max(0,Math.min(canvas.height,v.y+dy))}))}drag.last=p;draw()}else if(mode==='rectangle'||mode==='polygon')draw()});
canvas.addEventListener('pointerup',e=>{if(panDrag){panDrag=null;return}if(panMode||spacePan)return;if(mode==='rectangle'&&rectStart){const p=point(e),a=rectStart;rectStart=null;if(dist(a,p)>5){saveHistory();areas.push({tool,kind:areaKind,points:[{x:a.x,y:a.y},{x:p.x,y:a.y},{x:p.x,y:p.y},{x:a.x,y:p.y}]});selected=areas.length-1;updateList()}setMode('rectangle')}if(drag){drag=null;updateList();draw()}});canvas.addEventListener('pointercancel',()=>{panDrag=null;drag=null;rectStart=null;draw()});canvas.addEventListener('dblclick',e=>{if(mode==='polygon'){e.preventDefault();if(draft.length>3)draft.pop();finish()}});
function undo(){if(draft.length){draftRedo.push(draft.pop());draw();return}if(!history.length)return;redoHistory.push(JSON.stringify({areas,calibration,metersPerPixel}));const d=JSON.parse(history.pop());areas=d.areas;calibration=d.calibration;metersPerPixel=d.metersPerPixel;selected=-1;infoOpen=-1;updateList();draw()}
function redo(){if(draftRedo.length){draft.push(draftRedo.pop());draw();return}if(!redoHistory.length)return;history.push(JSON.stringify({areas,calibration,metersPerPixel}));const d=JSON.parse(redoHistory.pop());areas=d.areas;calibration=d.calibration;metersPerPixel=d.metersPerPixel;selected=-1;infoOpen=-1;updateList();draw()}
q('mg-fs-undo').addEventListener('click',undo);q('mg-fs-redo').addEventListener('click',redo);q('mg-undo').addEventListener('click',undo);q('mg-redo').addEventListener('click',redo);
root.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='Escape'){if(isStageFullscreen()||draft.length){e.preventDefault();e.stopPropagation();if(draft.length)undo()}return}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}});
document.addEventListener('keydown',e=>{if(!root.isConnected)return;if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(isStageFullscreen()&&!root.contains(e.target)&&(e.ctrlKey||e.metaKey)){const k=e.key.toLowerCase();if(k==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return}if(k==='y'){e.preventDefault();redo();return}}if(e.key==='Escape'&&(isStageFullscreen()||draft.length)){e.preventDefault();e.stopImmediatePropagation();if(draft.length)undo()}if(e.code==='Space'&&document.activeElement===canvas){e.preventDefault();spacePan=true}});document.addEventListener('keyup',e=>{if(e.code==='Space')spacePan=false});
q('mg-clear').addEventListener('click',()=>{if(!confirm('Smazat všechny zakreslené oblasti?'))return;saveHistory();areas=[];selected=-1;infoOpen=-1;draft=[];updateList();draw()});
const ids=['mg-design-mode','mg-variant','mg-style-card','mg-style','mg-preference','mg-sun','mg-width','mg-length','mg-min','mg-max','mg-build','mg-maint','mg-notes','mg-locality','mg-altitude','mg-soil','mg-water','mg-bed-area','mg-reserve','mg-distance','mg-transport-rate','mg-labor-rate','mg-soil-depth','mg-mulch-depth'];const getData=()=>Object.fromEntries(ids.map(id=>[id,q(id).value]));
const variantOptions={A:{label:'A – Anglický trávník',style:'Minimalistická',preference:'auto',ai:'HLAVNÍM PRVKEM je souvislý, hustý realistický anglický trávník. Zachovej co největší travnatou plochu, čisté hrany a případně jen úzké jednoduché záhony. Nenahrazuj velký trávník množstvím rostlin.'},B:{label:'B – Trávník a výsadba',style:'Moderní',preference:'mix',ai:'HLAVNÍM PRVKEM je velká souvislá travnatá plocha a reprezentativní okrajové výsadby trvalek, travin, keřů podle skutečného místa. Nezaplňuj celý trávník záhony.'},C:{label:'C – Minimum údržby',style:'Nenáročná na údržbu',preference:'auto',ai:'Navrhni realizovatelnou nenáročnou zahradu: menší jednoduché travnaté plochy, odolné druhy, vhodný mulč či kamenivo a praktické cesty. Nepoužívej zbytečně složité výsadby.'}};
const tailoredChoices={
 A:{title:'Co chcete s trávníkem udělat?',choices:[['Nový trávník','Založit nový hustý trávník'],['Renovace trávníku','Zlepšit současný porost'],['Trávník s okraji','Trávník a jednoduché záhony']]},
 B:{title:'Co má na zahradě převládat?',choices:[['Trávník a záhony','Vyvážená kombinace'],['Více kvetoucích záhonů','Barevná zahrada během sezony'],['Trávník a okrasné trávy','Moderní přírodní vzhled']]},
 C:{title:'Jak má vypadat nenáročná zahrada?',choices:[['Zeleň bez náročné péče','Odolné keře a trvalky'],['Méně trávníku','Více mulče a výsadby'],['Minimalistická zahrada','Jednoduché tvary a odolné rostliny']]}
};
let tailoredChoice='';
function renderTailoredChoices(code){
 const host=q('mg-tailored-choices');if(!host)return;
 const config=tailoredChoices[code]||tailoredChoices.B;
 if(!config.choices.some(c=>c[0]===tailoredChoice))tailoredChoice=config.choices[0][0];
 host.innerHTML='<h4>'+config.title+'</h4><div class="mg-tailored-options">'+config.choices.map((c,i)=>'<button type="button" data-mg-tailored="'+i+'" aria-pressed="'+(c[0]===tailoredChoice)+'"><strong>'+c[0]+'</strong><small>'+c[1]+'</small></button>').join('')+'</div><p class="mg-note">Jde o preferenci pro výsledný návrh. AI může rozložení ploch upravit podle fotografie a rozpočtu.</p>';
 host.querySelectorAll('[data-mg-tailored]').forEach(btn=>btn.addEventListener('click',()=>{tailoredChoice=config.choices[Number(btn.dataset.mgTailored)][0];renderTailoredChoices(code);autoSave()}));
}
const styleChoices={
 'english':{variant:'A',style:'Minimalistická',name:'Anglický trávník'},
 'lawn-beds':{variant:'B',style:'Moderní',name:'Trávník a výsadba'},
 'modern':{variant:'B',style:'Moderní',name:'Moderní zahrada'},
 'natural':{variant:'B',style:'Přírodní',name:'Přírodní zahrada'},
 'flowers':{variant:'B',style:'Venkovská',name:'Okrasné záhony'},
 'low-care':{variant:'C',style:'Nenáročná na údržbu',name:'Minimum údržby'}
};
function chooseVariant(code,applySettings=true,styleChoice=null){
 const selected=variantOptions[code]?code:'B';
 const wanted=styleChoice||q('mg-style-card').value;
 const key=styleChoices[wanted]?.variant===selected?wanted:({'A':'english','B':'lawn-beds','C':'low-care'}[selected]);
 const config=styleChoices[key],v=variantOptions[selected];
 q('mg-variant').value=selected;q('mg-style-card').value=key;
 root.querySelectorAll('[data-mg-style-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mgStyleChoice===key)));
 q('mg-variant-note').textContent='Vybráno: '+config.name;
 // The right-hand inspiration photo must follow the selected card immediately.
 const chosenCard=root.querySelector('[data-mg-style-choice="'+key+'"]');
 const chosenImage=chosenCard?.querySelector('img');
 const tipsImage=root.querySelector('.mg-redesign-tips .mg-tips-reference-photo');
 if(chosenImage&&tipsImage){tipsImage.src=chosenImage.src;tipsImage.alt='Vybraný styl: '+config.name;tipsImage.dataset.mgStyle=key;}
 renderTailoredChoices(selected);
 if(applySettings){q('mg-style').value=config.style;q('mg-preference').value=v.preference;q('mg-maint').value=selected==='C'?'Nízká':'Střední';lastPlan=null;}
}
root.querySelectorAll('[data-mg-style-choice]').forEach(button=>button.addEventListener('click',()=>{chooseVariant(button.dataset.mgVariant,true,button.dataset.mgStyleChoice);autoSave()}));
q('mg-summary').addEventListener('click',()=>{const d=getData(),min=Number(d['mg-min']),max=Number(d['mg-max']),w=Number(d['mg-width']),l=Number(d['mg-length']);if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||max<min){alert('Zkontrolujte rozpočet od–do.');return}const area=w>0&&l>0?`${fmt(w*l)} m²`:'nezadána';const out=q('mg-output');out.textContent=`ZADÁNÍ NÁVRHU ZAHRADY\n\nFotografie: ${photoReady?'nahrána':'nenahrána'}\nOznačené oblasti: ${areas.length}\nMěřítko: ${metersPerPixel?'nastaveno (orientační)':'nenastaveno'}\n${areas.map((a,i)=>`${i+1}. ${a.tool==='keep'?'Zachovat':a.tool==='remove'?'Odstranit':'Změnit'}${metersPerPixel?` ≈ ${fmt(polygonArea(a.points)*metersPerPixel**2)} m²`:''}`).join('\n')}\nVarianta: ${variantOptions[d['mg-variant']]?.label||variantOptions.B.label}\nPreference: ${tailoredChoice}\nStyl: ${d['mg-style']}\nSvětlo: ${d['mg-sun']}\nCelková zadaná plocha: ${area}\nRozpočet: ${fmt(min)}–${fmt(max)} Kč\nRealizace: ${d['mg-build']}\nÚdržba: ${d['mg-maint']}\nPožadavky: ${d['mg-notes']||'neuvedeny'}\n\nVýpočty z fotografie jsou orientační. AI návrh a platby zatím nejsou dostupné.`;out.classList.remove('mg-hidden')});
let wizardStep=0;

/* One consistent set of small line icons, instead of mixed typographic/emoji symbols. */
function mgTipIcon(kind){
 const strokes={
 camera:'<path d="M4 7h4l2-2h4l2 2h4v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
 maximize:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
 list:'<path d="M4 6h3m3 0h10M4 12h3m3 0h10M4 18h3m3 0h10"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m10 2-.5 2-2 1-2-.5-2 3 1.5 1.5v3l-1.5 1.5 2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3L19 12V9l1.5-1.5-2-3-2 .5-2-1-.5-2z"/>',
 leaf:'<path d="M20 4C11 4 5 8 5 15a5 5 0 0 0 5 5c7 0 11-6 10-16Z"/><path d="M4 21c3-6 6-9 12-12"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 sprout:'<path d="M12 21v-9M12 14C5 14 3 10 4 5c6 0 8 3 8 9Zm0-2c0-6 3-8 8-8 1 5-1 8-8 8Z"/>',
 bed:'<circle cx="12" cy="11" r="2"/><path d="M12 9V4m3.5 6-1.5-3.5M14 13l3 2m-5 0v5m-2-7-3 2m2.5-5L8 6.5"/><circle cx="12" cy="11" r="6.5"/>',
 path:'<path d="M7 2c6 4-1 7 5 11s-1 7 5 9M4 2c6 4-1 7 5 11s-1 7 5 9"/>',
 mulch:'<path d="M4 16c0-3 3-5 5-3l3 4-2 3H5zm9-3c2-4 6-4 8 0l-1 5h-6z"/>',
 terrace:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16M3 12h18"/>'
 };
 return '<svg class="mg-professional-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(strokes[kind]||strokes.leaf)+'</svg>';
}

function showWizardStep(n){
 wizardStep=Math.max(0,Math.min(9,n));
 q('mg-welcome').hidden=wizardStep!==0;
 root.querySelectorAll('[data-mg-step]').forEach(section=>{section.hidden=Number(section.dataset.mgStep)!==wizardStep});
 q('mg-wizard-progress').classList.toggle('mg-hidden',wizardStep===0);
 q('mg-wizard-footer').classList.toggle('mg-hidden',wizardStep===0);
 if(wizardStep){
   q('mg-progress-label').textContent=wizardStep+' '+['','Výběr stylu zahrady','Fotografie zahrady','Měření a označení ploch','Detaily zahrady','Vytvoření návrhu','Výsledky návrhu','Detailní úpravy','Přehled a rozpočet','Průvodce a další kroky'][wizardStep];
   q('mg-progress-fill').style.width=(wizardStep*100/9)+'%';
   q('mg-prev').textContent=wizardStep===1?'← Zpět':'← Zpět';
   q('mg-next').textContent=wizardStep===9?'✓ Dokončit':'Další krok →';
   q('mg-step-description').textContent=['','Výběr stylu zahrady','Nahrání fotografie','Měření a plochy','Detaily a podmínky','Generování návrhu','Výsledné varianty','Úpravy návrhu','Rozpočet a souhrn','Další kroky'][wizardStep];
 }
 const side=root.querySelector('.mg-redesign-side');if(side)side.querySelectorAll('[data-go-step]').forEach(b=>{const inNine=!!b.closest('.mg-nine-step-nav');b.classList.toggle('is-active',Number(b.dataset.goStep)===(inNine?wizardStep:(wizardStep<=1?1:wizardStep<=3?2:wizardStep===4?4:6)));b.disabled=false});
 const tips=root.querySelector('.mg-redesign-tips');if(tips){const data={
0:['Vyberte si zahradu, kterou chcete proměnit.','Připravte fotografii skutečného prostoru.','Návrh můžete později upravit.'],
1:['Zamyslete se, jak chcete zahradu využívat.','Zvolte styl podle času na údržbu.','Vybírejte rostliny podle vaší lokality.','Styl můžete kdykoliv změnit.'],
2:['Fotografujte za denního světla.','Zachyťte celý prostor včetně domu a plotu.','Vyberte ostrý snímek bez zbytečných překážek.'],
3:['Znáte délku plotu? Označte dva body pro lepší odhad ploch.','Trávník a záhony označte samostatně.','Rozměry z fotografie jsou pouze orientační.'],
4:['Zadejte obec a skutečné podmínky pozemku.','Rozpočet je orientační limit, nikoli závazná nabídka.','Čím přesnější údaje, tím použitelnější odhad.'],
5:['Prohlédněte si postup zpracování zadání.','AI test může spustit pouze oprávněný správce.','Ukázková fotografie není výsledkem vašeho návrhu.'],
6:['Výsledek AI je dostupný jen po skutečném generování.','Porovnání PŘED a PO je zatím ukázkové.','Vyberte preferovanou variantu zadání.'],
7:['Vybírejte rostliny podle slunce a půdy.','Plochy lze upravit ve fotografickém editoru.','Přání se zohlední při dalším návrhu.'],
8:['Ceny jsou pouze orientační.','Nezapomeňte na dopravu a realizaci.','Stáhněte si položkový rozpočet.'],
9:['Ptejte se průvodce na jednotlivé kroky.','Zadání lze znovu upravit.','Průvodce není živý AI chat.']};
tips.innerHTML='<h3>'+(wizardStep===1?'Tipy pro výběr stylu':'Tipy pro lepší výsledek')+'</h3>'+ (wizardStep===0?[['camera','Foťte za denního světla.','Zahrada bude mít přirozené barvy a detaily.'],['maximize','Zachyťte co největší plochu.','Ideálně z rohu zahrady.'],['list','Označte hlavní zóny.','Trávník, záhony, terasa, cestičky.'],['settings','Nemusíte měřit přesně.','AI návrh se přizpůsobí fotografii.']].map(x=>'<div class="mg-tip-card"><span class="mg-tip-icon" aria-hidden="true">'+mgTipIcon(x[0])+'</span><div><strong>'+x[1]+'</strong><small>'+x[2]+'</small></div></div>').join(''):(data[wizardStep]||data[1]).map((x,i)=>'<div class="mg-tip-card"><span class="mg-tip-icon" aria-hidden="true">'+mgTipIcon(['leaf','sun','check'][i%3])+'</span><div><strong>'+x+'</strong></div></div>').join(''));}

 if(tips&&wizardStep===2){
  const indicator=document.createElement('div');
  indicator.className='mg-photo-quality-guide';
  indicator.setAttribute('aria-label','Ukázky vhodné a nevhodné fotografie');
  const examples=[
   {title:'Správně',desc:'Široký záběr',mark:'✓',type:'good',image:'https://mvgreen.cz/wp-content/uploads/2026/10/4a7473d4-21f1-43b8-abdb-583ae4a93e2f.jpg'},
   {title:'Příliš',desc:'blízko',mark:'✕',type:'bad',image:'https://mvgreen.cz/wp-content/uploads/2026/10/4a7473d4-21f1-43b8-abdb-583ae4a93e2f.jpg'},
   {title:'Málo',desc:'světla',mark:'✕',type:'dark',image:'https://mvgreen.cz/wp-content/uploads/2026/10/4a7473d4-21f1-43b8-abdb-583ae4a93e2f.jpg'}
  ];
  examples.forEach(example=>{
   const card=document.createElement('div');card.className='mg-photo-quality-card mg-photo-quality-'+example.type;
   const photo=document.createElement('div');photo.className='mg-photo-quality-image';
   const img=document.createElement('img');img.src=example.image;img.alt=example.title+' '+example.desc;img.loading='lazy';photo.appendChild(img);
   const mark=document.createElement('span');mark.className='mg-photo-quality-mark';mark.textContent=example.mark;photo.appendChild(mark);
   const title=document.createElement('strong');title.textContent=example.title;
   const desc=document.createElement('small');desc.textContent=example.desc;
   card.append(photo,title,desc);indicator.appendChild(card);
  });
  const note=document.createElement('p');note.className='mg-photo-quality-result';note.setAttribute('role','status');indicator.appendChild(note);
  tips.appendChild(indicator);
  if(photoReady)updateGardenPhotoQuality();
 }
 if(tips&&[1,4,5,7,8,9].includes(wizardStep)){const selectedPhoto=root.querySelector('[data-mg-style-choice][aria-pressed="true"] img');if(selectedPhoto){const photo=document.createElement('img');photo.className='mg-tips-reference-photo';photo.src=selectedPhoto.src;photo.alt='Inspirace pro vybraný styl zahrady';photo.loading='lazy';photo.dataset.mgStyle=q('mg-style-card')?.value||'english';tips.appendChild(photo);}}
 if(wizardStep>0){const main=root.querySelector('.mg-redesign-main');if(main)main.scrollTo({top:0,behavior:'instant'});}
}
function setDesignMode(mode){
 const chosen=mode==='advanced'?'advanced':'auto';
 q('mg-design-mode').value=chosen;
 root.querySelectorAll('[data-mg-mode]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.mgMode===chosen)));
 root.classList.toggle('mg-automatic-mode',chosen==='auto');
 if(q('mg-placeholder'))q('mg-placeholder').textContent=chosen==='auto'?'Po nahrání se zde zobrazí vaše fotografie. Pro přesnější odhad můžete označit známou vzdálenost.':'Nahrajte fotografii a označte požadované změny.';
}
root.querySelectorAll('[data-mg-mode]').forEach(btn=>btn.addEventListener('click',()=>{setDesignMode(btn.dataset.mgMode);autoSave()}));
q('mg-start').addEventListener('click',()=>openDesignerModal());
q('mg-prev').addEventListener('click',()=>{if(wizardStep<=1)closeDesignerModal();else showWizardStep(wizardStep-1)});
q('mg-next').addEventListener('click',()=>{
 if(wizardStep===2&&!photoReady){q('mg-photo').focus();alert('Nejprve nahrajte fotografii zahrady.');return}
 if(wizardStep===9){closeDesignerModal();return}
 showWizardStep(wizardStep+1);
});
setDesignMode('auto');
const shell=root.querySelector('.mg-shell');
if(shell){
 const frame=document.createElement('div');frame.className='mg-redesign-frame';
 const side=document.createElement('nav');side.className='mg-redesign-side';side.setAttribute('aria-label','Průběh návrhu');
 side.innerHTML='<div class="mg-redesign-brand"><span class="mg-brand-leaf">❧</span><strong>MVGreen</strong><small>Navrhni si zahradu</small></div>'+('<div class="mg-nine-step-nav" aria-label="Všech devět kroků návrhu">'+['Styl zahrady','Fotografie zahrady','Měření a plochy','Detaily zahrady','Generování návrhu','Výsledky návrhu','Úpravy návrhu','Přehled a rozpočet','Chatový průvodce'].map((name,i)=>'<button type="button" data-go-step="'+(i+1)+'"><span>'+(i+1)+'</span>'+name+'</button>').join('')+'</div>')+'<div class="mg-sidebar-story"><h2>Začněte svůj<br>návrh zahrady</h2><p>Vyberte styl, který vám nejvíce vyhovuje.</p></div><div class="mg-sidebar-benefits"><div><span>◷</span><p><strong>Rychlý výsledek</strong><small>do 1–2 minut (orientačně)</small></p></div><div><span>❧</span><p><strong>Reálné rostliny</strong><small>pro vaši lokalitu</small></p></div><div><span>▤</span><p><strong>Orientační rozpočet</strong><small>hned ve výsledku</small></p></div><div><span>✦</span><p><strong>Možnost úprav</strong><small>dle vašich preferencí</small></p></div></div><div class="mg-sidebar-quote"><span>❝</span><p>Vaše zahrada. Váš styl. Váš návrh.</p><small>MVGreen – Navrhni si zahradu</small></div>';
 const main=document.createElement('div');main.className='mg-redesign-main';
 const tips=document.createElement('aside');tips.className='mg-redesign-tips';tips.setAttribute('aria-label','Tipy pro návrh');
 shell.parentNode.insertBefore(frame,shell);frame.append(side,main,tips);main.append(shell);
 // Use the real logo configured on the MVGreen WordPress site, never a fabricated replacement.
 const siteLogo=window.MVGreenBrand?.logoUrl;
 if(typeof siteLogo==='string'&&/^https?:\/\//.test(siteLogo)){
  const header=side.querySelector('.mg-redesign-brand');
  const official=document.createElement('img');
  official.className='mg-official-logo';
  official.src=siteLogo;official.alt='Oficiální logo MVGreen';
  official.decoding='async';
  official.onerror=()=>{official.remove();header.classList.remove('mg-has-official-logo');};
  const tagline=document.createElement('small');tagline.textContent='Navrhni si zahradu';
  header.replaceChildren(official,tagline);
  header.classList.add('mg-has-official-logo');
 }
 side.addEventListener('click',e=>{const b=e.target.closest('[data-go-step]');if(!b||!side.contains(b))return;const n=Number(b.dataset.goStep);if(n===0){closeDesignerModal();return}if(n>2&&!photoReady){showWizardStep(2);q('mg-photo').focus();return}if(!frame.classList.contains('mg-is-modal'))openDesignerModal();showWizardStep(n)});
}
// Keep the approved four-item welcome sidebar unchanged; show all nine steps only inside the designer.
const designerStepNames=['Styl zahrady','Fotografie zahrady','Měření a plochy','Detaily zahrady','Generování návrhu','Výsledky návrhu','Úpravy návrhu','Přehled a rozpočet','Chatový průvodce'];
function switchDesignerNavigation(isOpen){
 // One persistent nine-step sidebar for both the welcome screen and the editor.
 const nav=root.querySelector('.mg-redesign-side .mg-nine-step-nav');
 if(nav)nav.setAttribute('aria-label',isOpen?'Navigace mezi devíti kroky':'Přehled devíti kroků návrhu');
}
const designerBackplate=document.createElement('div');
designerBackplate.className='mg-designer-backplate';
designerBackplate.setAttribute('aria-hidden','true');
designerBackplate.hidden=true;
root.appendChild(designerBackplate);
function syncDesignerChrome(){
 const frame=root.querySelector('.mg-redesign-frame');
 if(!frame?.classList.contains('mg-is-modal')){
  designerBackplate.hidden=true;
  return;
 }
 // The browser must lay out the editor at its actual viewport size.
 // Previous inline top and transform-scale values pushed it off-screen.
 frame.style.removeProperty('top');
 frame.style.removeProperty('--mg-modal-scale');
 designerBackplate.hidden=true;
}

window.addEventListener('resize',()=>requestAnimationFrame(syncDesignerChrome));
const modalBackdrop=document.createElement('div');
modalBackdrop.className='mg-designer-modal-backdrop';
modalBackdrop.hidden=true;
root.appendChild(modalBackdrop);
// Render the entire designer at document.body level while open.
 // This avoids transformed/contained WordPress theme ancestors trapping position:fixed.
const designerOriginalParent=root.parentNode;
const designerReturnMarker=document.createComment('MVGreen designer original position');
designerOriginalParent.insertBefore(designerReturnMarker,root);
function mountDesignerAtViewport(){
 if(root.parentNode!==document.body)document.body.appendChild(root);
 root.classList.add('mg-viewport-mounted');
}
function restoreDesignerToPage(){
 root.classList.remove('mg-viewport-mounted');
 if(designerReturnMarker.parentNode)designerReturnMarker.parentNode.insertBefore(root,designerReturnMarker.nextSibling);
}
function openDesignerModal(){
 mountDesignerAtViewport();
 const frame=root.querySelector('.mg-redesign-frame');
 if(!frame)return;
 modalBackdrop.hidden=false;
 frame.classList.add('mg-is-modal');
 switchDesignerNavigation(true);
 const modalBrand=frame.querySelector('.mg-brand-leaf');if(modalBrand)modalBrand.innerHTML=mgTipIcon('sprout');
 document.body.classList.remove('mg-designer-modal-open');
 showWizardStep(1);
 frame.querySelector('.mg-redesign-main')?.scrollTo({top:0,behavior:'instant'});
 frame.querySelector('.mg-modal-close')?.focus();
}
function closeDesignerModal(){
 const frame=root.querySelector('.mg-redesign-frame');
 if(!frame)return;
 frame.classList.remove('mg-is-modal');
 switchDesignerNavigation(false);
 const modalBrand=frame.querySelector('.mg-brand-leaf');if(modalBrand)modalBrand.textContent='❧';
 modalBackdrop.hidden=true;
 document.body.classList.remove('mg-designer-modal-open');
 showWizardStep(0);
 restoreDesignerToPage();
 q('mg-start')?.focus();
}
modalBackdrop.addEventListener('click',closeDesignerModal);
root.querySelector('.mg-redesign-frame')?.insertAdjacentHTML('afterbegin','<button type="button" class="mg-modal-close" aria-label="Zavřít návrhář a vrátit se na úvod">✕ Zavřít</button>');
root.querySelector('.mg-modal-close')?.addEventListener('click',closeDesignerModal);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.querySelector('.mg-redesign-frame')?.classList.contains('mg-is-modal')&&!document.fullscreenElement&&!e.target.closest('.mg-stage'))closeDesignerModal()});
// Approximate dimensions from a single calibrated image; perspective is not corrected.
let dimensionsEditedByUser=false;
const widthInput=q('mg-width'),lengthInput=q('mg-length');
[widthInput,lengthInput].forEach(input=>input.addEventListener('input',()=>{dimensionsEditedByUser=true}));
function applyScaleDimensionEstimate(){
 if(!metersPerPixel||!canvas.width||!canvas.height||dimensionsEditedByUser)return;
 const w=canvas.width*metersPerPixel,l=canvas.height*metersPerPixel;
 if(w>0&&l>0){widthInput.value=(Math.round(w*10)/10).toString();lengthInput.value=(Math.round(l*10)/10).toString();
 const hint=q('mg-dimension-hint');if(hint)hint.textContent='Orientačně dopočítáno z měřítka fotografie. Perspektiva může rozměry zkreslit; hodnoty můžete ručně opravit.';}
}
// Keep both related dimension fields side-by-side in the conditions step.
const conditionsSection=root.querySelector('[data-mg-step="4"]');
if(conditionsSection){
 const dimensions=document.createElement('div');dimensions.className='mg-dimensions-row';
 const heading=document.createElement('p');heading.className='mg-dimension-hint';heading.id='mg-dimension-hint';heading.textContent='Pokud v kroku měření nastavíte měřítko, doplníme orientační rozměry. Můžete je kdykoli opravit.';
 const first=widthInput.closest('.mg-field'),second=lengthInput.closest('.mg-field');
 if(first&&second){dimensions.append(first,second);conditionsSection.insertBefore(dimensions,conditionsSection.querySelector('.mg-plan'));conditionsSection.insertBefore(heading,dimensions);}
}
// Move the existing photo editor to its own step without recreating its controls or losing listeners.
const photoSection=root.querySelector('[data-mg-step="2"]');
if(photoSection){
 const visual=document.createElement('div');visual.className='mg-ref-photo-showcase';
 visual.innerHTML='<img class="mg-ref-photo-showcase-img" src="https://mvgreen.cz/wp-content/uploads/2026/10/4a7473d4-21f1-43b8-abdb-583ae4a93e2f.jpg" alt="Ukázková fotografie zahrady">';
 photoSection.insertBefore(visual,photoSection.querySelector('.mg-mode-select'));
 const thumbs=document.createElement('div');thumbs.className='mg-ref-photo-thumbs';
 thumbs.innerHTML='<div class="mg-ref-thumbs-images" aria-label="Nahrané fotografie"></div><button type="button" class="mg-add-more-photos">＋ Přidat další fotografii</button><input type="file" class="mg-extra-photos-input" accept="image/jpeg,image/png,image/webp" multiple hidden>';
 const field=q('mg-photo')?.closest('.mg-field');if(field)field.appendChild(thumbs);
 const gallery=thumbs.querySelector('.mg-ref-thumbs-images');
 const extraInput=thumbs.querySelector('.mg-extra-photos-input');
 const photos=[];
 function renderGallery(){
  gallery.replaceChildren();
  photos.forEach((file,index)=>{
   const btn=document.createElement('button');btn.type='button';btn.className='mg-gallery-photo';btn.title='Zobrazit fotografii '+(index+1);
   const thumb=document.createElement('img');thumb.alt='Fotografie '+(index+1);thumb.src=URL.createObjectURL(file);
   thumb.onload=()=>URL.revokeObjectURL(thumb.src);
   btn.appendChild(thumb);btn.addEventListener('click',()=>{
    const transfer=new DataTransfer();transfer.items.add(file);
    q('mg-photo').files=transfer.files;
    q('mg-photo').dispatchEvent(new Event('change',{bubbles:true}));
    gallery.querySelectorAll('button').forEach(el=>el.classList.remove('is-active'));btn.classList.add('is-active');
   });
   gallery.appendChild(btn);
  });
 }
 q('mg-photo').addEventListener('change',()=>{
  const file=q('mg-photo').files?.[0];if(!file)return;
  if(!photos.some(p=>p.name===file.name&&p.size===file.size&&p.lastModified===file.lastModified)){photos.push(file);renderGallery();}
  const selected=photos.findIndex(p=>p.name===file.name&&p.size===file.size&&p.lastModified===file.lastModified);
  gallery.querySelectorAll('button').forEach((el,i)=>el.classList.toggle('is-active',i===selected));
 });
 thumbs.querySelector('.mg-add-more-photos').addEventListener('click',()=>extraInput.click());
 extraInput.addEventListener('change',()=>{
  const incoming=Array.from(extraInput.files||[]).filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size<=10*1024*1024);
  incoming.forEach(file=>{if(!photos.some(p=>p.name===file.name&&p.size===file.size&&p.lastModified===file.lastModified))photos.push(file)});
  renderGallery();
  if(incoming.length){const transfer=new DataTransfer();transfer.items.add(incoming[0]);q('mg-photo').files=transfer.files;q('mg-photo').dispatchEvent(new Event('change',{bubbles:true}));}
  extraInput.value='';
 });
 const originalPreview=q('mg-upload-preview-image');if(originalPreview)originalPreview.addEventListener('load',()=>{visual.querySelector('img').src=originalPreview.src;});

}
if(photoSection){
 const measureSection=document.createElement('section');
 measureSection.className='mg-wizard-step mg-measure-step';
 measureSection.dataset.mgStep='3';
 measureSection.hidden=true;
 measureSection.innerHTML='<div class="mg-step-kicker">03 / 09 · MĚŘENÍ A PLOCHY</div><h3 class="mg-section-title">Označte plochy na fotografii</h3><p class="mg-note">Změřte známou vzdálenost a podle potřeby označte trávník, záhony a další části zahrady. V automatickém režimu můžete pokračovat i bez zakreslování.</p>';
 const calibration=photoSection.querySelector('.mg-calibration');
 if(calibration){
   let el=calibration;
   while(el){const next=el.nextElementSibling;measureSection.appendChild(el);el=next;}
 }
 photoSection.insertAdjacentElement('afterend',measureSection);
}

/* Reference-inspired steps 4–9. Existing photo editor and cost engine remain wired. */
const detailStep=root.querySelector('[data-mg-step="4"]');
const styleStep=root.querySelector('[data-mg-step="1"]');
if(detailStep&&styleStep){
 const detailFields=document.createElement('div');
 detailFields.className='mg-reference-details';
 detailStep.insertBefore(detailFields,detailStep.querySelector('.mg-plan'));
 ['mg-sun','mg-width','mg-length','mg-build','mg-maint','mg-locality','mg-soil','mg-water','mg-bed-area','mg-altitude'].forEach(id=>{
  const el=q(id)?.closest('.mg-field');
  if(el)detailFields.appendChild(el);
 });
 const originalDimensions=detailStep.querySelector('.mg-dimensions-row');
 if(originalDimensions){['mg-width','mg-length'].forEach(id=>{const field=q(id)?.closest('.mg-field');if(field)originalDimensions.appendChild(field)});detailFields.prepend(originalDimensions);}
 const conditions=document.createElement('div');conditions.className='mg-ref-conditions';
 conditions.innerHTML='<h4>Podmínky stanoviště</h4><div class="mg-ref-sun-options">'+[['☀','Slunce'],['◐','Polostín'],['☁','Stín']].map((a,i)=>'<button type="button" data-mg-sun="'+a[1]+'" aria-pressed="'+(i===0)+'"><span>'+a[0]+'</span>'+a[1]+'</button>').join('')+'</div><h4>Vlhkost půdy</h4><div class="mg-ref-moisture-options">'+[['dry','Suchá'],['normal','Střední'],['wet','Vlhká']].map((a,i)=>'<button type="button" data-mg-moisture="'+a[0]+'" aria-pressed="'+(i===1)+'">'+a[1]+'</button>').join('')+'</div>';
 detailFields.appendChild(conditions);
 conditions.querySelectorAll('[data-mg-sun]').forEach(b=>b.addEventListener('click',()=>{q('mg-sun').value=b.dataset.mgSun;conditions.querySelectorAll('[data-mg-sun]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));autoSave()}));
 conditions.querySelectorAll('[data-mg-moisture]').forEach(b=>b.addEventListener('click',()=>{q('mg-water').value=b.dataset.mgMoisture;conditions.querySelectorAll('[data-mg-moisture]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));autoSave()}));
 const budgetPanel=document.createElement('div');budgetPanel.className='mg-ref-budget-choices';
 budgetPanel.innerHTML='<h4>Rozpočet (orientačně)</h4>'+[['50000','Do 50 000 Kč'],['150000','50–150 000 Kč'],['300000','Nad 150 000 Kč']].map((x,i)=>'<button type="button" data-mg-budget-choice="'+x[0]+'" aria-pressed="'+(i===1)+'">◉ &nbsp;'+x[1]+'</button>').join('')+'<h4>Další informace</h4><ul><li>Chci zahradu s minimem údržby</li><li>Mám děti / domácí mazlíčky</li><li>Chci jedlé rostliny</li><li>Zajímá mě automatická závlaha</li><li>Preferuji přírodní vzhled</li></ul>';
 detailStep.insertBefore(budgetPanel,detailStep.querySelector('.mg-plan'));
 budgetPanel.querySelectorAll('[data-mg-budget-choice]').forEach(b=>b.addEventListener('click',()=>{q('mg-max').value=b.dataset.mgBudgetChoice;budgetPanel.querySelectorAll('[data-mg-budget-choice]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));autoSave()}));
 const styleControl=q('mg-style')?.closest('.mg-field');
 if(styleControl){styleControl.classList.add('mg-hidden');styleStep.appendChild(styleControl);}
 const budgetMax=q('mg-max')?.closest('.mg-field');
 if(budgetMax)budgetMax.classList.add('mg-budget-in-details');
}
function makeReferenceStep(number,title,description){
 const el=document.createElement('section');
 el.className='mg-wizard-step mg-reference-step';
 el.dataset.mgStep=String(number);
 el.hidden=true;
 el.innerHTML='<div class="mg-step-kicker">'+String(number).padStart(2,'0')+' / 09 · MVGREEN NÁVRH ZAHRADY</div><h3 class="mg-section-title">'+title+'</h3><p class="mg-note">'+description+'</p>';
 return el;
}
const resultStep=root.querySelector('[data-mg-step="6"]');
const generationStep=makeReferenceStep(5,'Vytváříme váš návrh…','Na základě vaší fotografie, zvoleného stylu a podmínek připravíme zadání pro vizualizaci.');
generationStep.innerHTML+='<div class="mg-generation-grid"><div class="mg-generation-image"><img src="https://mvgreen.cz/wp-content/uploads/2026/10/mvgreen-ai-navrh.png" alt="Ilustrační ukázka návrhu zahrady"><span>Ukázka vzhledu návrhu</span></div><div class="mg-generation-status"><h4>Co se právě děje?</h4><p>✓ Analyzujeme vaši fotografii</p><p>✓ Rozpoznáváme plochy</p><p>✓ Vybíráme vhodné rostliny</p><p>✓ Připravujeme vizualizace</p><p>✓ Tvoříme doporučení</p><div class="mg-reference-note">Ukázka procesu. Automatické AI generování zatím není dostupné všem návštěvníkům.</div><button type="button" id="mg-generation-admin" class="mg-primary mg-hidden">✨ Spustit testovací AI návrh</button></div></div>';
resultStep.insertAdjacentElement('beforebegin',generationStep);
const actualAiButton=q('mg-ai-test');
const adminButton=q('mg-generation-admin');
if(actualAiButton&&adminButton){
 adminButton.addEventListener('click',()=>actualAiButton.click());
}
const resultDemo=document.createElement('div');
resultDemo.className='mg-reference-result';
resultDemo.innerHTML='<div class="mg-reference-result-top"><strong>Návrh zahrady – varianta 1</strong><span>Ilustrace – nejedná se o vygenerovaný návrh zákazníka</span></div><div class="mg-result-comparison"><img id="mg-result-before" src="https://mvgreen.cz/wp-content/uploads/2026/10/4a7473d4-21f1-43b8-abdb-583ae4a93e2f.jpg" alt="Ukázková původní zahrada"><img src="https://mvgreen.cz/wp-content/uploads/2026/10/mvgreen-ai-navrh.png" alt="Ukázková vizualizace zahrady"><span>PŘED</span><span>PO – ukázka</span><input type="range" id="mg-demo-reveal" min="0" max="100" value="50" aria-label="Porovnat původní fotografii a ilustrační návrh"></div><div class="mg-result-options"><button type="button" class="mg-reference-choice" aria-pressed="true" data-mg-demo-variant="1">Varianta 1</button><button type="button" class="mg-reference-choice" aria-pressed="false" data-mg-demo-variant="2">Varianta 2</button><button type="button" class="mg-reference-choice" aria-pressed="false" data-mg-demo-variant="3">Varianta 3</button></div><p class="mg-note" id="mg-result-demo-note">Varianty jsou zatím pouze výběrem zadání. Nové vizualizace se automaticky nevytvářejí.</p></div>';
resultStep.insertBefore(resultDemo,resultStep.querySelector('.mg-result-intro'));
resultStep.querySelector('.mg-result-intro')?.classList.add('mg-hidden');
const resultLayout=document.createElement('div');resultLayout.className='mg-ref-results-layout';
 const resultMain=document.createElement('div');resultMain.className='mg-ref-result-main';
 const resultAside=document.createElement('aside');resultAside.className='mg-ref-result-aside';
 resultAside.innerHTML='<h4>O této variantě</h4><p>♧ &nbsp; Styl: <strong id="mg-ref-result-style">Anglický trávník</strong></p><p>▤ &nbsp; Celková plocha: <strong id="mg-ref-result-area">Dle zadání</strong></p><p>✿ &nbsp; Hlavní prvky: Trávník, záhony, terasa</p><p>☀ &nbsp; Orientace: podle zadaných podmínek</p><p>◉ &nbsp; Odhadovaná cena: <strong id="mg-ref-result-price">Orientační</strong></p><h4>Další možnosti</h4><button type="button" data-mg-result-action="edit">✎ &nbsp; Upravit prvky</button><button type="button" data-mg-result-action="style">▦ &nbsp; Změnit styl</button><button type="button" data-mg-result-action="save">↓ &nbsp; Stáhnout obrázek</button>';
 resultDemo.parentNode.insertBefore(resultLayout,resultDemo);resultLayout.append(resultMain,resultAside);resultMain.append(resultDemo);
 resultAside.querySelector('[data-mg-result-action="edit"]').addEventListener('click',()=>showWizardStep(7));
 resultAside.querySelector('[data-mg-result-action="style"]').addEventListener('click',()=>showWizardStep(1));
 resultAside.querySelector('[data-mg-result-action="save"]').addEventListener('click',()=>{const image=q('mg-result-before');if(!image?.src)return;const a=document.createElement('a');a.href=image.src;a.download='mvgreen-puvodni-fotografie.jpg';a.click()});
 q('mg-demo-reveal')?.addEventListener('input',e=>e.target.parentElement.style.setProperty('--mg-demo-reveal',e.target.value+'%'));
root.querySelectorAll('[data-mg-demo-variant]').forEach(btn=>btn.addEventListener('click',()=>{
 root.querySelectorAll('[data-mg-demo-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
 q('mg-result-demo-note').textContent='Vybrána varianta '+btn.dataset.mgDemoVariant+'. Pro skutečnou novou vizualizaci je nutné spustit dostupné AI generování.';
}));
const editStep=makeReferenceStep(7,'Detailní úpravy návrhu','Vyberte prvky, které chcete doplnit, a podle potřeby označte změny přímo na své fotografii.');
editStep.innerHTML+='<div class="mg-edit-tabs" role="tablist" aria-label="Kategorie úprav">'+['Rostliny','Materiály','Prvky','Osvětlení','Nábytek'].map((t,i)=>'<button type="button" role="tab" data-mg-edit-tab="'+i+'" aria-selected="'+(i===0)+'">'+t+'</button>').join('')+'</div><div class="mg-edit-layout"><div class="mg-edit-library" id="mg-edit-library"></div><div class="mg-edit-preview"><img src="https://mvgreen.cz/wp-content/uploads/2026/10/mvgreen-ai-navrh.png" alt="Ilustrační zahradní návrh"><small>Ukázková fotografie. Změny do své fotografie zakreslíte v kroku Měření a plochy.</small><button type="button" class="mg-primary" id="mg-open-editor">✏️ Označit úpravy na fotografii</button></div></div>';
resultStep.insertAdjacentElement('afterend',editStep);
const editItems=[['Okrasné trávy','Hortenzie','Levandule','Javor dlanitolistý','Túje / živý plot'],['Mulčovací kůra','Kačírek','Kamenné šlapáky','Dřevěné prvky'],['Zahradní chodník','Terasa','Vyvýšený záhon','Zahradní domek'],['Zahradní lampy','LED osvětlení','Bodová světla'],['Zahradní sezení','Pergola','Lavička']];
function showEditCategory(i){
 root.querySelectorAll('[data-mg-edit-tab]').forEach(btn=>btn.setAttribute('aria-selected',String(Number(btn.dataset.mgEditTab)===i)));
 q('mg-edit-library').innerHTML='<h4>Vybrané prvky</h4>'+editItems[i].map(t=>'<label class="mg-edit-item"><input type="checkbox" value="'+t+'"><span>🌿 '+t+'</span></label>').join('')+'<p class="mg-note">Volby slouží jako seznam přání. Kreslení a úpravy ploch otevřete tlačítkem vpravo.</p>';
}
root.querySelectorAll('[data-mg-edit-tab]').forEach(b=>b.addEventListener('click',()=>showEditCategory(Number(b.dataset.mgEditTab))));
q('mg-open-editor').addEventListener('click',()=>showWizardStep(3));
showEditCategory(0);
const editTips=document.createElement('aside');editTips.className='mg-ref-edit-tips';
editTips.innerHTML='<h4>Tipy k rostlinám</h4><p>✿ &nbsp; Vybírejte rostliny podle slunce a půdy.</p><p>✿ &nbsp; Zohledněte péči a dobu květu.</p><p>✿ &nbsp; Doporučujeme kombinace pro celoroční vzhled.</p><div class="mg-ref-edit-thumbnails">'+Array.from({length:3},()=>'<img src="https://mvgreen.cz/wp-content/uploads/2026/10/mvgreen-ai-navrh.png" alt="Inspirace pro výsadbu">').join('')+'</div><button type="button" id="mg-ref-add-plant">＋ Přidat rostlinu</button>';
editStep.querySelector('.mg-edit-layout')?.append(editTips);
editTips.querySelector('#mg-ref-add-plant')?.addEventListener('click',()=>{const el=q('mg-notes');if(el){el.value+=(el.value?'\n':'')+'Další rostlina podle výběru';showWizardStep(7);autoSave()}});
const budgetStep=makeReferenceStep(8,'Přehled a rozpočet','Zkontrolujte zadání a sestavte orientační rozpočet rostlin, materiálu a prací.');
resultStep.parentNode.insertBefore(budgetStep,editStep.nextSibling);
const budgetPlan=detailStep?.querySelector('.mg-plan');
if(budgetPlan)budgetStep.appendChild(budgetPlan);
const budgetSummary=document.createElement('div');
budgetSummary.className='mg-budget-summary';
budgetSummary.innerHTML='<div><h4>Souhrn návrhu</h4><p id="mg-budget-summary-info">Zatím bez výpočtu</p><button type="button" id="mg-budget-show-summary">Zobrazit celé zadání</button></div><div><h4>Orientační rozpočet</h4><p>Výsledná cena se vypočítá podle zadaných podmínek a vybraných rostlin. Nejde o závaznou nabídku.</p><button type="button" class="mg-primary" id="mg-budget-create">🌿 Vypočítat rozpočet</button></div></div>';
budgetStep.prepend(budgetSummary);
 const refBudgetTable=document.createElement('div');refBudgetTable.className='mg-ref-budget-table';
 refBudgetTable.innerHTML='<h4>Orientační rozpočet</h4>'+[['Zemní úpravy','25000'],['Trávník','18000'],['Výsadba rostlin','42000'],['Mulč / štěrk','12000'],['Zahradní prvky','28000']].map(x=>'<div><span>♧ &nbsp; '+x[0]+'</span><strong>'+Number(x[1]).toLocaleString('cs-CZ')+' Kč</strong></div>').join('')+'<div class="mg-ref-budget-total"><strong>Cena celkem</strong><strong>125 000 Kč</strong></div><p>Ilustrační položky z předlohy. Skutečný rozpočet vypočtěte z údajů o zahradě.</p><button type="button" class="mg-primary" id="mg-ref-budget-real">Vypočítat vlastní rozpočet</button>';
 budgetStep.append(refBudgetTable);
 const planDetails=document.createElement('details');planDetails.className='mg-ref-plan-details';planDetails.innerHTML='<summary>Podrobné nastavení a výpočet rostlin</summary>';planDetails.append(budgetPlan);budgetStep.append(planDetails);
 refBudgetTable.querySelector('#mg-ref-budget-real').addEventListener('click',()=>{planDetails.open=true;q('mg-plan-create').click()});

q('mg-budget-show-summary').addEventListener('click',()=>{q('mg-summary').click();showWizardStep(6);});
q('mg-budget-create').addEventListener('click',()=>q('mg-plan-create').click());
const chatStep=makeReferenceStep(9,'Chatový průvodce a další kroky','Potřebujete něco vysvětlit nebo se vrátit k úpravám?');
chatStep.innerHTML+='<div class="mg-chat-layout"><div class="mg-chat-main"><div class="mg-chat-title">🌿 MVGreen – průvodce návrhem <small>Jednoduchá nápověda, nikoli živý AI chat</small></div><div id="mg-chat-messages" class="mg-chat-messages" aria-live="polite"><p class="mg-chat-bot">Dobrý den! Mohu vám poradit, kde upravit styl, rozměry nebo rozpočet. Vyberte téma níže.</p></div><div class="mg-chat-questions"><button type="button" data-mg-question="style">Jak změnit styl?</button><button type="button" data-mg-question="measure">Jak změřit zahradu?</button><button type="button" data-mg-question="budget">Kde najdu rozpočet?</button></div></div><aside class="mg-chat-actions"><h4>Další možnosti</h4><button type="button" data-mg-goto="7">✏️ Upravit návrh</button><button type="button" data-mg-goto="8">▤ Přehled a rozpočet</button><button type="button" data-mg-goto="6">🌱 Výsledky návrhu</button><p class="mg-note">AI chat ani odesílání dotazů zatím nejsou aktivní.</p></aside></div>';
budgetStep.insertAdjacentElement('afterend',chatStep);
const chatComposer=document.createElement('form');chatComposer.className='mg-ref-chat-composer';
chatComposer.innerHTML='<input type="text" maxlength="500" placeholder="Napište svou otázku..." aria-label="Vaše otázka"><button type="submit" aria-label="Odeslat otázku">➤</button>';
q('mg-chat-messages')?.parentNode.append(chatComposer);
chatComposer.addEventListener('submit',e=>{e.preventDefault();const input=chatComposer.querySelector('input'),value=input.value.trim();if(!value)return;const messages=q('mg-chat-messages'),u=document.createElement('p'),a=document.createElement('p');u.className='mg-chat-user';u.textContent=value;a.className='mg-chat-bot';a.textContent=/rozpoč|cen/i.test(value)?'Orientační rozpočet najdete v kroku 8.':/rostlin|výsad/i.test(value)?'Rostliny a úpravy můžete vybírat v kroku 7.':/fotograf|snímek/i.test(value)?'Fotografii nahrajete v kroku 2.':'Mohu poradit s navigací v návrháři. Pro odbornou radu kontaktujte MVGreen.';messages.append(u,a);messages.scrollTop=messages.scrollHeight;input.value=''});
const chatActions=root.querySelector('.mg-chat-actions');
if(chatActions){chatActions.insertAdjacentHTML('beforeend','<h4>Užitečné odkazy</h4><p>✿ &nbsp; Jak správně fotit?</p><p>✿ &nbsp; Jak vybrat rostliny?</p><p>✿ &nbsp; Příklady realizací</p><p>✿ &nbsp; Často kladené otázky</p>');}
const answers={style:['Jak změnit styl?','Klikněte vlevo na Styl zahrady a vyberte jeden ze šesti stylů a jeho podvariantu.',1],measure:['Jak změřit zahradu?','V kroku Měření a plochy označte na fotografii dva body se známou vzdáleností. Výpočet je orientační.',3],budget:['Kde najdu rozpočet?','Otevřete Přehled a rozpočet a stiskněte Vypočítat rozpočet.',8]};
root.querySelectorAll('[data-mg-question]').forEach(b=>b.addEventListener('click',()=>{
 const a=answers[b.dataset.mgQuestion],box=q('mg-chat-messages');
 const user=document.createElement('p');user.className='mg-chat-user';user.textContent=a[0];
 const reply=document.createElement('p');reply.className='mg-chat-bot';reply.textContent=a[1];
 box.append(user,reply);box.scrollTop=box.scrollHeight;
}));
root.querySelectorAll('[data-mg-goto]').forEach(b=>b.addEventListener('click',()=>showWizardStep(Number(b.dataset.mgGoto))));

// Reference order: step 1 style selection, step 2 photo upload, step 3 measurements.
const uploadStep=root.querySelector('[data-mg-step="2"]');
if(uploadStep){
 const preview=q('mg-upload-preview');
 const modeSelect=uploadStep.querySelector('.mg-mode-select');
 if(preview&&modeSelect)modeSelect.insertAdjacentElement('beforebegin',preview);
 const uploadLabel=q('mg-photo')?.closest('.mg-field')?.querySelector('label');
 if(uploadLabel)uploadLabel.textContent='Vybrat fotografii zahrady';
}
const progress=q('mg-wizard-progress');
if(progress){
 const badge=document.createElement('span');
 badge.id='mg-progress-badge';badge.className='mg-progress-badge';badge.textContent='1';
 progress.insertBefore(badge,progress.firstChild);
}
const photoStage=q('mg-stage');
const measureStep=root.querySelector('[data-mg-step="3"]');
if(photoStage&&measureStep){
 const layout=document.createElement('div');layout.className='mg-measure-layout';
 const photoCol=document.createElement('div');photoCol.className='mg-measure-photo';
 const toolCol=document.createElement('aside');toolCol.className='mg-measure-side';
 toolCol.innerHTML='<h4>Nástroje</h4>'+[['Trávník','keep','lawn','leaf'],['Záhon','change','bed','bed'],['Cestička','change','path','path'],['Mulč / štěrk','remove','mulch','mulch'],['Terasa','change','terrace','terrace']].map((x,i)=>'<button type="button" class="mg-ref-area-kind mg-ref-area-'+x[2]+'" data-mg-tool-link="'+x[1]+'" data-mg-area-kind="'+x[2]+'" aria-pressed="'+(i===0)+'">'+mgTipIcon(x[3])+' '+x[0]+'</button>').join('')+'<button type="button" id="mg-ref-add-zone">＋ Další zóna</button><h4>Tipy pro označení</h4><p>✓ Označte plochy co nejpřesněji.</p><p>✓ Rozdělujte větší plochy.</p><p>✓ Můžete přidat více zón.</p><p>✓ Rozměry jsou orientační.</p>';
 const calibration=q('mg-calibrate')?.closest('.mg-calibration');
 if(calibration)photoCol.append(calibration);
 photoCol.append(photoStage);
 const below=measureStep.querySelector('.mg-below-photo');
 if(below)photoCol.append(below);
 const actions=measureStep.querySelector('.mg-editor-actions');
 if(actions)photoCol.append(actions);
 layout.append(photoCol,toolCol);
 measureStep.insertBefore(layout,measureStep.querySelector('.mg-mobile-controls'));
 toolCol.querySelectorAll('[data-mg-tool-link]').forEach(b=>b.addEventListener('click',()=>{
  areaKind=b.dataset.mgAreaKind;
  root.querySelector('[data-tool="'+b.dataset.mgToolLink+'"]')?.click();
  toolCol.querySelectorAll('[data-mg-area-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 }));
 toolCol.querySelector('#mg-ref-add-zone')?.addEventListener('click',()=>{if(!photoReady){showWizardStep(2);return}root.querySelector('[data-mg-area-kind="lawn"]')?.click();q('mg-polygon').click()});
}
// Step 03: keep the original wired tool buttons, but display them in the right sidebar.
const step3Tools=measureStep?.querySelector('.mg-measure-side');
const step3ToolHome=step3Tools?.parentNode;
const step3PhotoStage=q('mg-stage');
const step3AdvancedControls=[
 measureStep?.querySelector('.mg-below-photo'),
 measureStep?.querySelector('.mg-editor-actions'),
 measureStep?.querySelector('.mg-mobile-controls'),
 measureStep?.querySelector('#mg-area-list'),
 ...Array.from(measureStep?.querySelectorAll('.mg-note')||[])
].filter(Boolean);
const step3Toggle=document.createElement('button');
step3Toggle.type='button';step3Toggle.className='mg-step3-advanced-toggle';
step3Toggle.setAttribute('aria-expanded','false');
if(step3PhotoStage)step3PhotoStage.insertAdjacentElement('afterend',step3Toggle);
function refreshStep3Controls(){
 const advanced=q('mg-design-mode')?.value==='advanced';
 root.classList.toggle('mg-step3-is-advanced',advanced);
 root.classList.toggle('mg-step3-is-auto',!advanced);
 step3AdvancedControls.forEach(el=>el.classList.toggle('mg-step3-controls-collapsed',!advanced));
 step3Toggle.textContent=advanced?'✨ Přepnout na automatický AI návrh':'✏️ Pokročilé úpravy – označit plochy';
 step3Toggle.setAttribute('aria-expanded',String(advanced));
 if(step3Tools)step3Tools.classList.toggle('mg-step3-tools-collapsed',!advanced);
 const fullKinds=fullscreenKinds;
 if(fullKinds)fullKinds.hidden=!advanced;
 step3PhotoStage?.querySelector('.mg-fullscreen-bar')?.classList.toggle('mg-fs-bar-hidden',!advanced);
}
step3Toggle.addEventListener('click',()=>{
 const advanced=q('mg-design-mode')?.value==='advanced';
 setDesignMode(advanced?'auto':'advanced');
 refreshStep3Controls();
 autoSave();
});
// Fullscreen uses the same working area-kind actions as the right-hand sidebar.
const fullscreenKinds=document.createElement('div');
fullscreenKinds.className='mg-fs-area-kinds';
fullscreenKinds.innerHTML='<strong>Označit plochu</strong>';
[['Trávník','lawn'],['Záhon','bed'],['Cestička','path'],['Mulč / štěrk','mulch'],['Terasa','terrace']].forEach(([label,kind])=>{
 const b=document.createElement('button');b.type='button';b.textContent=label;
 b.dataset.mgFullscreenKind=kind;
 b.addEventListener('click',()=>{
  step3Tools?.querySelector('[data-mg-area-kind="'+kind+'"]')?.click();
  fullscreenKinds.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 });
 fullscreenKinds.appendChild(b);
});
step3PhotoStage?.appendChild(fullscreenKinds);
const originalShowWizardStep=showWizardStep;
const sideTips=root.querySelector('.mg-redesign-tips');
sideTips?.addEventListener('click',event=>{
 const b=event.target.closest('.mg-side-next');
 if(b&&sideTips.contains(b))q('mg-next')?.click();
});
showWizardStep=function(n){
 // Move the existing tool DOM back before the tips column is re-rendered.
 if(step3Tools&&step3ToolHome&&step3Tools.parentNode!==step3ToolHome)step3ToolHome.appendChild(step3Tools);
 originalShowWizardStep(n);
 if(wizardStep===3){
  const right=root.querySelector('.mg-redesign-tips');
  if(right&&step3Tools)right.prepend(step3Tools);
  if(photoReady&&img){
   const stage=q('mg-stage'),placeholder=q('mg-placeholder');
   if(stage)stage.classList.add('mg-stage-has-upload');
   if(placeholder)placeholder.classList.add('mg-hidden');
   canvas.classList.remove('mg-hidden');
   draw();
  }
  refreshStep3Controls();
 }
 const frame=root.querySelector('.mg-redesign-frame');if(frame){for(let i=0;i<=9;i++)frame.classList.toggle('mg-view-step-'+i,i===wizardStep);}
 const badge=q('mg-progress-badge');if(badge)badge.textContent=String(wizardStep);
 const aiTrigger=q('mg-generation-admin'),aiOriginal=q('mg-ai-test');if(aiTrigger&&aiOriginal)aiTrigger.classList.toggle('mg-hidden',aiOriginal.classList.contains('mg-hidden'));
 const summary=q('mg-budget-summary-info');
 if(summary)summary.textContent='Styl: '+(q('mg-variant-note')?.textContent||'neurčen')+' · Lokalita: '+(q('mg-locality')?.value||'nezadána')+' · Plochy: '+areas.length;
 const selectedStyle=q('mg-style-card')?.value||'english';const name=styleChoices[selectedStyle]?.name||'Anglický trávník';
 const styleResult=q('mg-ref-result-style');if(styleResult)styleResult.textContent=name;
 const areaResult=q('mg-ref-result-area');if(areaResult){const area=Number(q('mg-bed-area')?.value)||0;areaResult.textContent=area>0?area.toLocaleString('cs-CZ')+' m²':'Dle zadání';}
 const priceResult=q('mg-ref-result-price');if(priceResult)priceResult.textContent=(Number(q('mg-max')?.value)||0).toLocaleString('cs-CZ')+' Kč (limit)';
 // The original Next button still handles validation. This right-column button forwards its click.
 const tips=root.querySelector('.mg-redesign-tips');
 if(tips&&[1,2,4].includes(wizardStep)){
  const rightNext=document.createElement('button');
  rightNext.type='button';
  rightNext.className='mg-side-next';
  rightNext.innerHTML='Další krok <span aria-hidden="true">→</span>';
  tips.appendChild(rightNext);
 }
 requestAnimationFrame(syncDesignerChrome);
};

showWizardStep(0);
const heroComparison=root.querySelector('.mg-hero-comparison');
if(heroComparison){
 const toggle=heroComparison.querySelector('.mg-hero-touch-toggle');
 const sync=()=>{const before=heroComparison.classList.contains('mg-show-before');toggle.setAttribute('aria-pressed',String(before));toggle.setAttribute('aria-label',before?'Zobrazit AI návrh zahrady po úpravě':'Zobrazit původní zahradu před úpravou');};
 toggle.addEventListener('click',()=>{heroComparison.classList.toggle('mg-show-before');sync()});
 sync();
}
root.querySelectorAll('[data-welcome-variant]').forEach(btn=>btn.addEventListener('click',()=>{chooseVariant(btn.dataset.welcomeVariant);openDesignerModal()}));
const key='mvgreen-designer-draft-v3';try{const d=JSON.parse(localStorage.getItem(key)||'null');if(d){tailoredChoice=typeof d.tailoredChoice==='string'?d.tailoredChoice:'';for(const id of ids)if(typeof d.form?.[id]==='string')q(id).value=d.form[id];if(Array.isArray(d.areas))areas=d.areas;metersPerPixel=Number.isFinite(d.metersPerPixel)?d.metersPerPixel:null;calibration=Array.isArray(d.calibration)?d.calibration:[]}}catch(e){}chooseVariant(q('mg-variant').value,false);setDesignMode(q('mg-design-mode').value);updateList();
function autoSave(){try{localStorage.setItem(key,JSON.stringify({form:getData(),areas,calibration,metersPerPixel,tailoredChoice}))}catch(e){}};root.addEventListener('change',e=>{if(e.target.id!=='mg-photo')autoSave()});root.addEventListener('pointerup',()=>setTimeout(autoSave,100));q('mg-save').addEventListener('click',()=>{try{localStorage.setItem(key,JSON.stringify({form:getData(),areas,calibration,metersPerPixel,tailoredChoice}));alert('Údaje a oblasti byly uloženy v prohlížeči. Fotografie se neukládá. Po obnovení stránky ji nahrajte znovu.')}catch(e){alert('Prohlížeč ukládání nepovolil.')}});q('mg-reset').addEventListener('click',()=>{localStorage.removeItem(key);alert('Uložené údaje byly vymazány. Aktuální formulář zůstává otevřený.')});
syncMode();
// Verified Czech retail listings (17 October 2026). Only matching exact cultivars and sizes.
const legacyPlants=[
{name:'Levandule úzkolistá „Munstead“',latin:'Lavandula angustifolia Munstead',sun:['Slunce'],water:['dry','normal'],soil:['sand','normal'],cold:5,density:6,price:89,priceType:'exact',size:'květináč 9 cm',bloom:'červen–srpen',height:'30–40 cm',source:'https://eshop.starkl.com/lavandula-angustifolia-blue',verified:'2026-10-17'},
{name:'Levandule úzkolistá „Rosea“',latin:"Lavandula angustifolia Rosea",sun:['Slunce'],water:['dry','normal'],soil:['sand','normal'],cold:5,density:6,price:89,priceType:'exact',size:'květináč 9 cm',bloom:'červen–srpen',height:'30–40 cm',source:'https://www.eshop.starkl.com/vonava-levandule-ruzova',verified:'2026-10-17'},
{name:'Levandule úzkolistá „Dark Hidcote Blue“',latin:'Lavandula angustifolia Dark Hidcote Blue',sun:['Slunce'],water:['dry','normal'],soil:['sand','normal'],cold:5,density:6,price:239,priceType:'exact',availability:'vyprodáno',size:'kontejner 2 l',bloom:'červen–srpen',height:'do 40 cm',source:'https://eshop.starkl.com/levandule-uzkolista-dark-hidcote-blue',verified:'2026-10-17'},

{name:'Třapatkovka nachová',latin:'Echinacea purpurea',sun:['Slunce'],water:['normal'],soil:['normal'],cold:5,density:5,price:79,priceType:'exact',size:'květináč 9 cm',bloom:'červenec–září',height:'do 80 cm',source:'https://eshop.starkl.com/trapatka-cervena',verified:'2026-10-17'},
{name:'Kostřava sivá „Elijah Blue“',latin:'Festuca cinerea Elijah Blue',sun:['Slunce'],water:['dry','normal'],soil:['sand','normal'],cold:5,density:7,price:98,priceType:'exact',size:'květináč 9 cm',bloom:'červen–červenec',height:'do 40 cm',source:'https://www.eshop.starkl.com/kostrava-siva-elijah-blue',verified:'2026-10-17'},
{name:'Rudbékie „Cherry Brandy“',latin:"Rudbeckia hirta Cherry Brandy",sun:['Slunce'],water:['normal'],soil:['normal'],cold:5,density:5,price:98,priceType:'exact',size:'květináč 9 cm',bloom:'červenec–září',height:'do 80 cm',source:'https://eshop.starkl.com/rudbekie-cherry-brandy',verified:'2026-10-17'},
{name:'Rozchodník suchomilný',latin:'Sedum cristatum',sun:['Slunce'],water:['dry'],soil:['sand','normal'],cold:5,density:9,price:53,priceType:'approx',size:'květináč 7 cm (prodej po 3 ks za 159 Kč)',bloom:'neuvedeno',height:'do 15 cm',availability:'vyprodáno',source:'https://eshop.starkl.com/rozchodnik-suchomilny',verified:'2026-10-17'},

{name:'Šanta „Purrsian Blue“',latin:'Nepeta x faassenii Purrsian Blue',sun:['Slunce'],water:['dry','normal'],soil:['sand','normal'],cold:5,density:6,price:98,priceType:'exact',size:'květináč 9 cm',bloom:'dlouhé kvetení (až 5 měsíců)',height:'do 40 cm',source:'https://www.eshop.starkl.com/santa-zkrizena',verified:'2026-10-17'},
{name:'Šalvěj hajní „Sensation Compact Bright Rose“',latin:'Salvia nemorosa Sensation Compact Bright Rose',sun:['Slunce'],water:['dry','normal'],soil:['sand','normal'],cold:5,density:7,price:98,priceType:'exact',size:'květináč 9 cm',bloom:'květen–srpen',height:'do 35 cm',source:'https://www.eshop.starkl.com/salvej-sensation-compact-bright-rose',verified:'2026-10-17'},
{name:'Kakost himálajský „Plenum“',latin:'Geranium himalayense Plenum',sun:['Slunce','Polostín'],water:['normal'],soil:['normal'],cold:5,density:6,price:109,priceType:'exact',size:'květináč 9 cm',bloom:'květen–červenec',height:'do 30 cm',availability:'vyprodáno',source:'https://eshop.starkl.com/plnokvety-kakost',verified:'2026-10-17'},
{name:'Třapatka zářivá „Goldsturm“',latin:'Rudbeckia fulgida Goldsturm',sun:['Slunce','Polostín'],water:['normal'],soil:['normal'],cold:5,density:5,price:144,priceType:'approx',size:'kontejner 1,5 l',bloom:'červenec–říjen',height:'do 100 cm',source:'https://www.rostlinky.cz/rudbeckia-fulgida-goldsturm-trapatka-zariva-c1-5.html',verified:'2026-10-17'},
{name:'Rozchodník „Xenox Yellow“',latin:'Sedum Xenox Yellow',sun:['Slunce'],water:['dry','normal'],soil:['sand','normal'],cold:5,density:6,price:187,priceType:'approx',size:'kontejner 1 l',bloom:'srpen–říjen',height:'do 50 cm',source:'https://www.rostlinky.cz/sedum-xenox-yellow-rozchodnik-c1.html',verified:'2026-10-17'}
,
{"name":"Bergénie","latin":"Bergenia cordifolia","sun":["Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":6,"price":79,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"duben–květen","height":"30–40 cm","source":"https://eshop.starkl.com/polstarove-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Bohyška (směs)","latin":"Hosta","sun":["Stín"],"water":["normal"],"soil":["normal"],"cold":5,"density":5,"price":89,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–srpen","height":"30–70 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Čechrava „Pštrosí pero“","latin":"Astilbe","sun":["Polostín"],"water":["wet","normal"],"soil":["normal"],"cold":5,"density":5,"price":119,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–srpen","height":"60–100 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Denivka","latin":"Hemerocallis","sun":["Slunce"],"water":["normal"],"soil":["normal"],"cold":5,"density":4,"price":109,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–srpen","height":"50–90 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Dlužicha „Palace Purple“","latin":"Heuchera Palace Purple","sun":["Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":7,"price":79,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–srpen","height":"30–50 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Dlužicha „Leuchtkäfer“","latin":"Heuchera sanguinea Leuchtkäfer","sun":["Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":7,"price":79,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–srpen","height":"30–50 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Kokarda","latin":"Gaillardia","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":6,"price":79,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–září","height":"30–60 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Kopretina","latin":"Leucanthemum","sun":["Slunce"],"water":["normal"],"soil":["normal"],"cold":5,"density":5,"price":79,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–srpen","height":"40–80 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Krásnoočko","latin":"Coreopsis","sun":["Slunce"],"water":["dry","normal"],"soil":["normal"],"cold":5,"density":6,"price":89,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–září","height":"30–60 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Řebříček „Paprika“","latin":"Achillea millefolium Paprika","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":5,"price":98,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–září","height":"50–70 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Řebříček „Terracotta“","latin":"Achillea millefolium Terracotta","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":5,"price":109,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–září","height":"60–80 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Rozrazil „Rosa Zwerg“","latin":"Veronica spicata Rosa Zwerg","sun":["Slunce"],"water":["normal"],"soil":["normal"],"cold":5,"density":7,"price":79,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–srpen","height":"20–35 cm","source":"https://eshop.starkl.com/ostatni-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Hvozdík „Brilliant“","latin":"Dianthus Brilliant","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":9,"price":79,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"květen–červenec","height":"10–20 cm","source":"https://eshop.starkl.com/polstarove-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Turan","latin":"Erigeron","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":8,"price":79,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"květen–srpen","height":"15–40 cm","source":"https://eshop.starkl.com/polstarove-trvalky","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Třtina ostrokvětá „Overdam“","latin":"Calamagrostis x acutiflora Overdam","sun":["Slunce"],"water":["normal"],"soil":["normal"],"cold":5,"density":3,"price":127,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červen–srpen","height":"100–150 cm","source":"https://www.rostlinky.cz/okrasna-zahrada/travy.html","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Moskytka něžná","latin":"Bouteloua gracilis","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":7,"price":124,"priceType":"approx","size":"běžná sazenice; přesná velikost dle nabídky","bloom":"červenec–září","height":"30–50 cm","source":"https://www.rostlinky.cz/okrasna-zahrada/travy.html","verified":"2026-10-17","verification":"cena v katalogu; pěstební parametry orientační"},
{"name":"Šalvěj hajní „Caradonna“","latin":"Salvia nemorosa Caradonna","sun":["Slunce","Polostín"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":7,"price":69,"priceType":"exact","size":"viz nabídka prodejce","bloom":"květen–srpen","height":"60 cm","source":"https://www.zahradnictvi-eden.cz/salvej-hajni--caradonna--salvia-nemorosa--caradonna/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Levandule úzkolistá „Hidcote Blue“","latin":"Lavandula angustifolia Hidcote Blue","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":6,"price":65,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–srpen","height":"30–50 cm","source":"https://www.zahradnictvi-eden.cz/trvalky/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Rozchodník „Herbstfreude“","latin":"Sedum telephium Herbstfreude","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":5,"price":50,"priceType":"exact","size":"viz nabídka prodejce","bloom":"srpen–říjen","height":"40 cm","source":"https://www.ceskerostliny.cz/ceskerostliny/eshop/5-1-TRVALKY/0/5/1000-Rozchodnik-Herbstfreude","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Třtina ostrokvětá „Karl Foerster“","latin":"Calamagrostis x acutiflora Karl Foerster","sun":["Slunce","Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":3,"price":80,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–srpen","height":"120–180 cm","source":"https://www.zahradnictvi-eden.cz/trvalky/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Kontryhel měkký „Thriller“","latin":"Alchemilla mollis Thriller","sun":["Slunce","Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":7,"price":65,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–červenec","height":"30–50 cm","source":"https://www.zahradnictvi-eden.cz/trvalky/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Mateřídouška časná „Minor“","latin":"Thymus praecox Minor","sun":["Slunce"],"water":["dry"],"soil":["sand","normal"],"cold":5,"density":10,"price":49,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–červenec","height":"5–10 cm","source":"https://www.zahradnictvi-montano.cz/trvalky--skalnicky--travy/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Barvínek menší „Alba“","latin":"Vinca minor Alba","sun":["Polostín","Stín"],"water":["normal"],"soil":["normal"],"cold":5,"density":9,"price":49,"priceType":"exact","size":"viz nabídka prodejce","bloom":"duben–květen","height":"10–20 cm","source":"https://www.zahradnictvi-montano.cz/trvalky--skalnicky--travy/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Barvínek menší","latin":"Vinca minor","sun":["Polostín","Stín"],"water":["normal"],"soil":["normal"],"cold":5,"density":9,"price":49,"priceType":"exact","size":"viz nabídka prodejce","bloom":"duben–květen","height":"10–20 cm","source":"https://www.zahradnictvi-montano.cz/trvalky--skalnicky--travy/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Čistec vlnatý","latin":"Stachys byzantina","sun":["Slunce"],"water":["dry"],"soil":["sand","normal"],"cold":5,"density":7,"price":35,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–srpen","height":"20–40 cm","source":"https://www.zahradnictvi-montano.cz/trvalky--skalnicky--travy/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Rozchodník bílý","latin":"Sedum album","sun":["Slunce"],"water":["dry"],"soil":["sand","normal"],"cold":5,"density":10,"price":39,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–srpen","height":"5–15 cm","source":"https://www.zahradnictvi-montano.cz/trvalky--skalnicky--travy/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Šalvěj hajní „Synchro White“","latin":"Salvia nemorosa Synchro White","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":7,"price":44,"priceType":"exact","size":"viz nabídka prodejce","bloom":"květen–srpen","height":"30–50 cm","source":"https://www.zahradnictvi-montano.cz/trvalky--skalnicky--travy/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Šanta „Cat's Pajamas“","latin":"Nepeta faassenii Cat's Pajamas","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":7,"price":79,"priceType":"exact","size":"viz nabídka prodejce","bloom":"květen–září","height":"30–40 cm","source":"https://www.zahradnictvi-montano.cz/trvalky--skalnicky--travy/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Svíčkovec „Belleza White“","latin":"Oenothera lindheimeri Belleza White","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":5,"price":69,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–říjen","height":"40–60 cm","source":"https://www.zahradnictvi-eden.cz/trvalky/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Třapatkovka nachová „Magnus“","latin":"Echinacea purpurea Magnus","sun":["Slunce"],"water":["normal"],"soil":["normal"],"cold":5,"density":5,"price":69,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červenec–září","height":"80–100 cm","source":"https://www.zahradnictvi-eden.cz/trvalky/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Svatolina cypřišková","latin":"Santolina chamaecyparissus","sun":["Slunce"],"water":["dry"],"soil":["sand","normal"],"cold":5,"density":5,"price":60,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–srpen","height":"30–50 cm","source":"https://www.zahradnictvi-eden.cz/trvalky/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Pupkovec jarní „Alba“","latin":"Omphalodes verna Alba","sun":["Polostín","Stín"],"water":["normal"],"soil":["normal"],"cold":5,"density":9,"price":69,"priceType":"exact","size":"viz nabídka prodejce","bloom":"duben–květen","height":"10–20 cm","source":"https://www.zahradnictvi-eden.cz/trvalky/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Krásnoočko přeslenité „Zagreb“","latin":"Coreopsis verticillata Zagreb","sun":["Slunce"],"water":["dry","normal"],"soil":["sand","normal"],"cold":5,"density":7,"price":95.9,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červen–září","height":"30–40 cm","source":"https://www.rostlinky.cz/okrasna-zahrada/trvalky/nizke-trvalky.html","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Zavinutka „Melua Burgundy“","latin":"Monarda x didyma Melua Burgundy","sun":["Slunce","Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":5,"price":99.9,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červenec–září","height":"60–90 cm","source":"https://www.rostlinky.cz/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Plamenka „Adessa Orange“","latin":"Phlox paniculata Adessa Orange","sun":["Slunce","Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":5,"price":116.9,"priceType":"exact","size":"viz nabídka prodejce","bloom":"červenec–září","height":"40–70 cm","source":"https://www.rostlinky.cz/","verified":"2026-10-17","verification":"cena dle nabídky; pěstební parametry orientační, vyžadují další kontrolu"},
{"name":"Dochan psárkovitý","latin":"Pennisetum alopecuroides","category":"grasses","sun":["Slunce"],"water":["normal"],"soil":["normal","sand"],"cold":5,"density":3,"price":186.9,"priceType":"exact","size":"C1,5","bloom":"srpen–září","height":"31–50 cm","source":"https://www.rostlinky.cz/pennisetum-alopecuroides-dochan-psarkovity-c1-5.html","verification":"Nabídka českého e-shopu; dostupnost a pěstební podmínky ověřte před objednávkou."},
{"name":"Proso prutnaté „Prairie Sky“","latin":"Panicum virgatum Prairie Sky","category":"grasses","sun":["Slunce"],"water":["normal"],"soil":["normal","sand"],"cold":5,"density":1,"price":105.9,"priceType":"exact","size":"K9","bloom":"červenec–září","height":"101–150 cm","source":"https://www.rostlinky.cz/panicum-virgatum-prairie-sky-proso-prutnate-k9.html","verification":"Nabídka českého e-shopu; dostupnost a pěstební podmínky ověřte před objednávkou."},
{"name":"Proso prutnaté „Shenandoah“","latin":"Panicum virgatum Shenandoah","category":"grasses","sun":["Slunce"],"water":["normal"],"soil":["normal"],"cold":5,"density":2,"price":123.9,"priceType":"exact","size":"K9","bloom":"srpen–říjen","height":"101–150 cm","source":"https://www.rostlinky.cz/panicum-virgatum-shenandoah-proso-prutnate-k9.html","verification":"Nabídka českého e-shopu; dostupnost a pěstební podmínky ověřte před objednávkou."},
{"name":"Hortenzie latnatá „Limelight“","latin":"Hydrangea paniculata Limelight","category":"shrubs","sun":["Slunce","Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":0.5,"price":null,"priceType":"unknown","size":"velikost dle nabídky","bloom":"červenec–září","height":"150–250 cm","source":"https://eshop.starkl.com/hortenzie-latnata-limelight","verification":"Nabídka českého e-shopu; dostupnost a pěstební podmínky ověřte před objednávkou."},
{"name":"Tavola kalinolistá „Dart's Gold“","latin":"Physocarpus opulifolius Dart's Gold","category":"shrubs","sun":["Slunce","Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":0.5,"price":null,"priceType":"unknown","size":"velikost dle nabídky","bloom":"květen–červen","height":"150–250 cm","source":"https://eshop.starkl.com/tavola-kalinolista-darts-gold","verification":"Nabídka českého e-shopu; dostupnost a pěstební podmínky ověřte před objednávkou."},
{"name":"Muchovník Lamarckův","latin":"Amelanchier lamarckii","category":"trees","sun":["Slunce","Polostín"],"water":["normal"],"soil":["normal"],"cold":5,"density":0.1,"price":169,"priceType":"exact","size":"květináč 9 cm","bloom":"duben–květen","height":"400–600 cm","source":"https://eshop.starkl.com/muchovnik-lamarckuv-7010352000196747152","verification":"Nabídka českého e-shopu; dostupnost a pěstební podmínky ověřte před objednávkou."}
];
// Catalog is bundled as a separate script loaded before this application.
// Keep exact curated retail data only where it matches a catalog taxon.
const normalizeLatin=s=>String(s||'').toLocaleLowerCase().replace(/[×✕]/g,'x').replace(/[„“'"’]/g,'').replace(/\s+/g,' ').trim();
const legacyByLatin=new Map(legacyPlants.map(p=>[normalizeLatin(p.latin),p]));
const plants=(Array.isArray(window.MVGreenPlantCatalog)?window.MVGreenPlantCatalog:[]).map(entry=>{
 const legacy=legacyByLatin.get(normalizeLatin(entry.latin));
 return legacy?{...entry,...legacy,id:entry.id,source:entry.source||legacy.source}:entry;
});
let lastPlan=null;
const money=n=>Math.round(n).toLocaleString('cs-CZ')+' Kč';
const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createPlan(){
 const d=getData(),sun=d['mg-sun'],soil=d['mg-soil'],water=d['mg-water'],alt=Number(d['mg-altitude']);
  if(!plants.length){alert('Katalog rostlin se nepodařilo načíst. Obnovte stránku.');return;}
 const w=Number(d['mg-width']),l=Number(d['mg-length']);let requested=Number(d['mg-bed-area']);
 if(!requested&&w>0&&l>0)requested=Math.round(w*l*0.3*10)/10;
 if(!Number.isFinite(requested)||requested<=0||requested>10000){alert('Vyplňte plochu nových výsadeb v m².');return}
 const budget=Number(d['mg-max']);
 if(!Number.isFinite(budget)||budget<=0){alert('Zadejte maximální rozpočet vyšší než 0 Kč.');return}
 const preference=d['mg-preference']||'auto';
 const isGrass=p=>/^(Calamagrostis|Festuca|Bouteloua|Miscanthus|Panicum|Pennisetum|Molinia|Deschampsia|Carex|Stipa|Hakonechloa)\b/i.test(p.latin);
 let eligible=plants.filter(p=>p.latin&&p.height&&(p.sun.includes(sun)||sun==='Různé podmínky')&&p.water.includes(water)&&(soil==='unknown'||p.soil.includes(soil)));
 if(!eligible.length){q('mg-plan-output').textContent='Pro tyto podmínky zatím nemáme ověřené rostliny. Nevhodné druhy nebudeme doporučovat.';q('mg-plan-output').classList.remove('mg-hidden');lastPlan=null;return}
 eligible=eligible.filter(p=>p.availability!=='vyprodáno');
 if(preference==='mix'||preference==='auto')eligible=eligible.filter(p=>p.category!=='trees'&&p.category!=='shrubs');
 if(preference==='grasses')eligible=eligible.filter(p=>p.category==='grasses'||(!p.category&&isGrass(p)));
 if(preference==='shrubs')eligible=eligible.filter(p=>p.category==='shrubs');
 if(preference==='trees')eligible=eligible.filter(p=>p.category==='trees');
 if(preference==='flowers')eligible=eligible.filter(p=>!['shrubs','trees','grasses'].includes(p.category)&&!isGrass(p));
 if(!eligible.length){const output=q('mg-plan-output');output.textContent='Pro vybranou skupinu a podmínky zatím nemáme vhodné katalogové rostliny.';output.classList.remove('mg-hidden');lastPlan=null;return;}

 // Design a coherent planting scheme, never choose species randomly.
 // The catalog is fully considered; species count is limited by bed area and plant groups.
 const maxSpecies=(preference==='trees'||preference==='shrubs')?Math.min(3,Math.max(1,Math.floor(requested/8))):requested<4?3:requested<10?4:requested<20?5:requested<40?6:8;
 const parseHeight=p=>{
   const nums=(p.height||'').match(/\d+/g);
   return nums?Number(nums[nums.length-1]):50;
 };
 const colors=p=>{
   const n=(p.name+' '+p.latin).toLowerCase();
   if(/alba|white|schnee|bíl|kopret|kontryhel/.test(n))return 'white';
   if(/rose|pink|růž|bright rose|rosa/.test(n))return 'pink';
   if(/yellow|gold|zlat|žlut|rudb|krásnooč/.test(n))return 'yellow';
   if(/cherry|burgundy|paprika|red|červen/.test(n))return 'red';
   if(/blue|hidcote|munstead|levand|šalvěj|šanta|violet|purple|kakost/.test(n))return 'purple';
   return 'neutral';
 };
 const palettes=[['purple','white','pink','neutral'],['yellow','white','purple','neutral'],['pink','white','purple','neutral']];
 const palette=palettes[Math.abs(Math.round(requested*10))%palettes.length];
 const ordered=eligible.map(p=>({...p,_height:parseHeight(p),_color:colors(p)}))
   .filter(p=>palette.includes(p._color))
   .sort((a,b)=>a._height-b._height||a.name.localeCompare(b.name,'cs'));
 const selected=[];
 const targets=maxSpecies<=3?[0,0.5,1]:[0,0.25,0.5,0.75,1];
 for(const t of targets){
   if(selected.length>=maxSpecies)break;
   const index=Math.min(ordered.length-1,Math.floor(t*Math.max(0,ordered.length-1)));
   const candidate=ordered[index];
   if(candidate&&!selected.some(p=>p.latin===candidate.latin))selected.push(candidate);
 }
 for(const p of ordered){
   if(selected.length>=maxSpecies)break;
   if(!selected.some(x=>x.latin===p.latin))selected.push(p);
 }
 eligible=selected.sort((a,b)=>b._height-a._height);
 if(!eligible.length){q('mg-plan-output').textContent='Pro zadané podmínky nejsou aktuálně dostupné ověřené rostliny.';q('mg-plan-output').classList.remove('mg-hidden');lastPlan=null;return;}
 const weights=eligible.map((p,i)=>i===0?0.2:i===eligible.length-1?0.25:0.55/Math.max(1,eligible.length-2));
 const sumWeights=weights.reduce((a,b)=>a+b,0);
 const shares=weights.map(w=>w/sumWeights);
 const reserve=.1,soilRate=80*13, mulchRate=50*11;
 // Keep the client-facing estimate focused on plants and the bed itself; never exceed the budget.
 // Estimate includes soil and mulch but excludes labour, transport, removal, paving and irrigation.
 function estimate(area){
   const items=eligible.map((p,i)=>({name:p.name,latin:p.latin,quantity:Math.max(1,Math.round(area*shares[i]*p.density)),unit:p.price,kind:'rostlina'}));
   const plantsCost=items.reduce((sum,p)=>sum+(Number.isFinite(p.unit)?p.quantity*p.unit:0),0);
   const materials=0; // No verified supplier pricing for materials.
   return {items,plantsCost,materials,total:Math.ceil((plantsCost+materials)*(1+reserve))};
 }
 let area=requested,calc=estimate(area);
 if(calc.total>budget){
   let lo=0,hi=requested;
   for(let i=0;i<35;i++){const mid=(lo+hi)/2;if(estimate(mid).total<=budget)lo=mid;else hi=mid}
   area=Math.floor(lo*10)/10;calc=estimate(area);
 }
 const canFit=area>0&&calc.total<=budget;
 const output=q('mg-plan-output');
 if(!canFit){lastPlan=null;output.innerHTML=`<h4>Rozpočet ${money(budget)} nestačí na základní výsadbu</h4><p>Zkuste zvýšit rozpočet nebo zvolit jednodušší výsadbu. Nechceme slibovat návrh, který se do limitu nevejde.</p>`;output.classList.remove('mg-hidden');return}
 const reduced=area<requested-.05;
  const incompletePrices=eligible.some(p=>!Number.isFinite(p.price));
 const diversityNotice=eligible.length<4&&preference!=='trees'&&preference!=='shrubs'?'<p class="mg-budget-notice">Upozornění: Katalog zatím nemá dostatek ověřených druhů pro pestrou výsadbu. Jde o částečný návrh.</p>':'';
 const items=[...calc.items,{name:'Zahradnický substrát',quantity:Math.ceil(area*.08*100)/100,unit:null,kind:'materiál',unitName:'m³',visual:'tmavě hnědý sypký zahradnický substrát'},{name:'Borová mulčovací kůra',quantity:Math.ceil(area*.05*100)/100,unit:null,kind:'materiál',unitName:'m³',visual:'přírodní hnědá borová mulčovací kůra střední frakce'}];
 lastPlan={data:d,area,items,subtotal:calc.plantsCost+calc.materials,reserve,total:calc.total};
 const bloomMonths=p=>{
   const b=(p.bloom||'').toLowerCase();
   const names=['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
   const starts=['led','úno','bře','dub','kvě','červ','červenc','srp','zář','říj','list','pros'];
   const parts=b.split(/[–—-]/).map(x=>x.trim());
   const monthIndex=part=>{for(let i=0;i<starts.length;i++)if(part.startsWith(starts[i])&&(i!==5||!part.startsWith('červenc')))return i;return -1};
   const a=monthIndex(parts[0]||''),z=monthIndex(parts[1]||parts[0]||'');
   if(a<0||z<0||z<a)return [];
   return names.slice(a,z+1);
 };
 const flowering=new Set(eligible.flatMap(bloomMonths));
 const seasons=[['Jaro',['březen','duben','květen']],['Léto',['červen','červenec','srpen']],['Podzim',['září','říjen','listopad']],['Zima',['prosinec','leden','únor']]];
 const seasonText=seasons.map(([season,months])=>{
   const active=months.filter(m=>flowering.has(m));
   const icons={Jaro:'🌱',Léto:'☀️',Podzim:'🍂',Zima:'❄️'};
   return '<div class="mg-season-item"><strong>'+icons[season]+' '+season+'</strong><span>'+(active.length?'Doložené kvetení: '+active.join(', ')+'.':'U vybraných rostlin není pro toto období doložené kvetení.')+'</span></div>';
 }).join('');
 const layoutNotice='<details class="mg-result-details"><summary>🌿 Proč tato kombinace a jak ji rozmístit</summary><p>Vyšší rostliny patří obvykle do pozadí nebo středu ostrovního záhonu, nižší k okrajům. Před realizací je nutné ověřit umístění vůči domu, cestám, stávajícím rostlinám a jejich dospělým šířkám. Tento seznam zatím není osazovací plán.</p></details>';
 const yearNotice='<section class="mg-season-summary"><h5>🌼 Záhon během roku</h5><div class="mg-season-grid">'+seasonText+'</div><p class="mg-note">Souvislé kvetení ani zimní efekt zatím nelze zaručit. Pro celoroční působení je potřeba ověřit další prvky podle místa.</p></section>';
 const plantCards=calc.items.map((p,i)=>{
   const original=eligible[i];const page='https://commons.wikimedia.org/w/index.php?search='+encodeURIComponent(original.latin)+'&title=Special:MediaSearch&type=image';
   return `<tr><td><div class="mg-plant-photo" data-plant-latin="${htmlEscape(original.latin.split(' ').slice(0,2).join(' '))}"><span aria-hidden="true">🌱</span><small>Fotografie se načítá…</small></div></td><td><strong>${htmlEscape(p.name)}</strong><small>${htmlEscape(p.latin)} · ${htmlEscape(original.size)}${original.availability?' · '+htmlEscape(original.availability):''}</small><a href="${htmlEscape(original.source)}" target="_blank" rel="noopener noreferrer">Zdroj / nabídka ↗</a></td><td>${p.quantity} ks</td><td>${htmlEscape(original.bloom)}</td><td>${htmlEscape(original.height)}</td><td>${Number.isFinite(p.unit)?money(p.unit):'Cena nezjištěna'}</td><td>${Number.isFinite(p.unit)?money(p.quantity*p.unit):'Cena nezjištěna'}</td></tr>`;
 }).join('');
 const materialPhotos={
   'Zahradnický substrát':{file:'Potting soil.jpg',credit:'Chris Radcliff / Daniel Case, CC BY-SA 2.0',license:'https://creativecommons.org/licenses/by-sa/2.0/'},
   'Borová mulčovací kůra':{file:'Pine bark chip used as a playground surface.jpg',credit:'Fizzie41, CC BY-SA 4.0',license:'https://commons.wikimedia.org/wiki/File:Pine_bark_chip_used_as_a_playground_surface.jpg'}
 };
 const materialCards=items.filter(x=>x.kind==='materiál').map(x=>{
   const photo=materialPhotos[x.name];
   const src=photo?'https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(photo.file)+'?width=320':'';
   const fileUrl=photo?'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(photo.file.replace(/ /g,'_')):'';
   return `<article class="mg-plant-card"><div class="mg-plant-photo">${photo?`<img src="${htmlEscape(src)}" alt="Ilustrační fotografie: ${htmlEscape(x.name)}" loading="lazy" onerror="this.style.display='none';this.parentElement.querySelector('small').style.display='block'"><small style="display:none">Fotografie není dostupná</small>`:'<span aria-hidden="true">🪴</span><small>Fotografie není dostupná</small>'}</div><div><strong>${htmlEscape(x.name)}</strong><small>${htmlEscape(x.visual)}</small><div>${x.quantity.toLocaleString('cs-CZ')} ${x.unitName} · Cena nezjištěna</div>${photo?`<small>Ilustrační snímek (${htmlEscape(photo.credit)}) · <a href="${htmlEscape(fileUrl)}" target="_blank" rel="noopener noreferrer">Autor a licence ↗</a></small>`:''}</div></article>`;
 }).join('');
 output.innerHTML=`<h4>🌿 Návrh výsadby – ${htmlEscape(d['mg-locality']||'vaše zahrada')}</h4><div class="mg-result-overview"><span>📍 ${htmlEscape(d['mg-locality']||'Vaše zahrada')}</span><span>☀️ ${htmlEscape(sun)}</span><span>💧 ${htmlEscape(water)} půda</span><span>📐 ${area.toLocaleString('cs-CZ')} m²</span></div>${alt>650?'<p class="mg-note">Ve vyšší poloze ověřte mrazuvzdornost.</p>':''}${reduced?`<p class="mg-budget-notice">Abychom dodrželi rozpočet, navrhujeme výsadbu na <strong>${area.toLocaleString('cs-CZ')} m²</strong> z požadovaných ${requested.toLocaleString('cs-CZ')} m². Zbývající plochu bude nutné řešit zvlášť.</p>`:`<p>Navržená plocha výsadby: <strong>${area.toLocaleString('cs-CZ')} m²</strong></p>`}${diversityNotice}${yearNotice}<p class="mg-budget-notice">Neúplný rozpočet: materiály nejsou naceněné. Skutečná cena může přesáhnout zadaný limit.</p><h5 class="mg-result-heading">🌿 Vybrané rostliny</h5><div class="mg-plan-scroll"><table><thead><tr><th>Foto</th><th>Rostlina</th><th>Počet</th><th>Kvetení</th><th>Výška</th><th>Cena/ks</th><th>Celkem</th></tr></thead><tbody>${plantCards}</tbody></table></div><h5 class="mg-result-heading">🪴 Materiál k výsadbě</h5><div class="mg-plant-cards">${materialCards}</div><h5 class="mg-result-heading">💰 Orientační náklady</h5><div class="mg-budget-total"><span>Součet známých cen (bez materiálu)</span><strong>${incompletePrices?'Cena k doplnění':money(calc.total)}</strong><small>Váš limit: ${money(budget)} · Materiály bez ověřené ceny</small></div><details class="mg-budget-details"><summary>Zobrazit podrobnosti ceny</summary><p>Rostliny: ${money(calc.plantsCost)}<br>Substrát a mulč: Cena nezjištěna<br>Rezerva: ${money(calc.total-calc.plantsCost-calc.materials)}</p></details>${layoutNotice}<details class="mg-result-details"><summary>ℹ️ Důležité informace o cenách a fotografiích</summary><p class="mg-note">Ceny jsou orientační podle nabídek prodejců. Skladovost a množstevní slevy je nutné ověřit; některé položky mohou být vyprodané. Položky s označením Cena nezjištěna nejsou zahrnuty do součtu; skutečná cena může překročit rozpočet. Nezahrnují práci, dopravu, terénní úpravy, závlahu ani odstranění původních prvků. Fotografie jsou referenční; při nedostupnosti se zobrazí náhradní symbol. U rostlin se může lišit kultivar a velikost. Přesnou vhodnost rostlin a plochu ověřte na místě.</p></details>`;
 output.classList.remove('mg-hidden');
 // Free external image lookup; if unavailable, leave the explicit link to plant photographs.
 output.querySelectorAll('[data-plant-latin]').forEach(async box=>{
   const latin=box.getAttribute('data-plant-latin');
   try{
     const url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent('filetype:bitmap '+latin)+'&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=240&format=json&origin=*';
     const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),3500);
     let res;try{res=await fetch(url,{signal:controller.signal})}finally{clearTimeout(timeout)}
     const data=await res.json(),page=Object.values(data.query?.pages||{}).find(p=>p.title?.toLowerCase().includes(latin.toLowerCase())),src=page?.imageinfo?.[0]?.thumburl;
     if(src&&/^https:\/\//.test(src)){const im=document.createElement('img');im.src=src;im.alt='Fotografie: '+latin;im.loading='lazy';box.replaceChildren(im)}else{box.querySelector('small').textContent='Fotografie není dostupná – viz nabídka prodejce'}
   }catch(e){const small=box.querySelector('small');if(small)small.textContent='Fotografie není dostupná'}
 });
}
q('mg-plan-create').addEventListener('click',createPlan);
q('mg-plan-download').addEventListener('click',()=>{if(!lastPlan){alert('Nejprve sestavte plán.');return}const p=lastPlan,rows=[['Položka','Latinský název','Množství','Jednotková cena Kč','Celkem Kč'],...p.items.map(x=>[x.name,x.latin||'',x.quantity,Number.isFinite(x.unit)?x.unit:'Cena nezjištěna',Number.isFinite(x.unit)?Math.round(x.quantity*x.unit):'Cena nezjištěna']),['MEZISOUČET','','','',p.subtotal],['REZERVA','','','',Math.round(p.subtotal*p.reserve)],['CELKEM včetně rezervy','','','',p.total]];const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='mvgreen-orientacni-rozpocet.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
q('mg-location-lookup').addEventListener('click',async()=>{
 const name=q('mg-locality').value.trim(),status=q('mg-location-status'),btn=q('mg-location-lookup');
 if(name.length<2){status.textContent='Nejprve zadejte obec.';return}
 btn.disabled=true;status.textContent='Ověřuji polohu…';
 try{
   const res=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(name)+'&count=10&language=cs&format=json');
   if(!res.ok)throw Error('geokódování');const json=await res.json();
   const places=(json.results||[]).filter(x=>x.country_code==='CZ');
   if(!places.length){status.textContent='Obec v ČR nebyla nalezena. Upřesněte název.';return}
   const p=places[0];const e=await fetch('https://api.open-meteo.com/v1/elevation?latitude='+encodeURIComponent(p.latitude)+'&longitude='+encodeURIComponent(p.longitude));
   if(!e.ok)throw Error('výška');const v=await e.json(),height=Math.round(v.elevation?.[0]);
   if(!Number.isFinite(height))throw Error('výška');
   q('mg-altitude').value=height;
   status.textContent='≈ '+height+' m n. m. · '+p.name+(p.admin2?', '+p.admin2:'')+'. Přibližná výška středu obce; lze opravit.';
   autoSave();
 }catch(e){status.textContent='Automatické určení není dostupné. Výšku můžete zadat ručně.'}finally{btn.disabled=false}
});
q('mg-locality').addEventListener('input',()=>{const place=q('mg-locality').value.trim().slice(0,120);q('mg-suppliers').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('zahradnictví '+place)});

// Admin-only paid preview. Never send the API key to the browser.
const aiConfig=window.MVGreenAI||{};
const aiButton=q('mg-ai-test');
if(aiConfig.enabled){
  aiButton.classList.remove('mg-hidden');
  aiButton.addEventListener('click',async()=>{
    if(!photoReady)return alert('Nejprve nahrajte fotografii zahrady.');
    const automatic=q('mg-design-mode').value==='auto';
    if(!automatic&&!areas.some(a=>a.tool==='change'||a.tool==='remove'))return alert('Označte alespoň jednu oblast Změnit nebo Odstranit.');
    if(!confirm(automatic?'Spustit placený AI TEST celého snímku? V automatickém režimu zatím nelze zaručit zachování všech staveb a detailů.':'Spustit placený test označených ploch?'))return;
    const result=q('mg-ai-result');result.classList.remove('mg-hidden');result.textContent='AI připravuje návrh. Může to trvat několik minut…';
    aiButton.disabled=true;
    try{
      // A transparent mask marks ONLY red/blue areas as editable. Green and unmarked pixels are protected.
      const original=document.createElement('canvas');original.width=canvas.width;original.height=canvas.height;
      original.getContext('2d').drawImage(img,0,0,original.width,original.height);
      const mask=document.createElement('canvas');mask.width=canvas.width;mask.height=canvas.height;
      const mx=mask.getContext('2d');mx.fillStyle='#fff';mx.fillRect(0,0,mask.width,mask.height);
      const edits=automatic?[{points:[{x:0,y:0},{x:canvas.width,y:0},{x:canvas.width,y:canvas.height},{x:0,y:canvas.height}]}]:areas.filter(a=>(a.tool==='change'||a.tool==='remove')&&a.points?.length>=3);
      edits.forEach(area=>{mx.save();mx.globalCompositeOperation='destination-out';mx.beginPath();mx.moveTo(area.points[0].x,area.points[0].y);area.points.slice(1).forEach(pt=>mx.lineTo(pt.x,pt.y));mx.closePath();mx.fill();mx.restore()});
      // Keep green areas protected even if polygons overlap.
      (automatic?[]:areas.filter(a=>a.tool==='keep'&&a.points?.length>=3)).forEach(area=>{mx.beginPath();mx.moveTo(area.points[0].x,area.points[0].y);area.points.slice(1).forEach(pt=>mx.lineTo(pt.x,pt.y));mx.closePath();mx.fillStyle='#fff';mx.fill()});
      const data=new URLSearchParams();data.set('action','mvgreen_ai_preview');data.set('nonce',aiConfig.nonce);
      data.set('image',original.toDataURL('image/png'));data.set('mask',mask.toDataURL('image/png'));
      const d=getData();data.set('instructions',`Režim návrhu: ${automatic?'Automatický test celé fotografie. Zachovej stávající stavby, plot, cesty a perspektivu.':'Pokročilé úpravy označených ploch.'}; Lokalita: ${d['mg-locality']||'neuvedena'}; půda: ${d['mg-soil']}; vlhkost: ${d['mg-water']}; plán rostlin: ${lastPlan?lastPlan.items.filter(x=>x.kind==='rostlina').map(x=>x.name+' ('+x.latin+') '+x.quantity+' ks').join(', '):'nesestaven'}; Materiály: ${lastPlan?lastPlan.items.filter(x=>x.kind==='materiál').map(x=>x.name+' '+x.quantity+' '+x.unitName).join(', '):'neuvedeny'}; Nepřidávej jiné druhy rostlin ani jiný povrchový mulč; substrát je pod povrchem a nemá být viditelný; Varianta návrhu: ${variantOptions[d['mg-variant']]?.label||variantOptions.B.label}. ${variantOptions[d['mg-variant']]?.ai||variantOptions.B.ai} Zvolená konkrétní preference: ${tailoredChoice}. Respektuj ji, pokud neodporuje podmínkám a rozpočtu. Rozpočet je orientační horní limit ${d['mg-max']} Kč včetně materiálů a práce, nenavrhuj nepřiměřeně nákladné řešení. Styl: ${d['mg-style']}; slunce: ${d['mg-sun']}; realizace: ${d['mg-build']}; údržba: ${d['mg-maint']}; přání: ${d['mg-notes']||'Přirozená, udržovatelná zahrada'}`);
      const response=await fetch(aiConfig.ajaxUrl,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:data.toString()});
      const json=await response.json();if(!json.success||!json.data?.image)throw new Error(json.data?.message||'AI návrh se nepodařilo vytvořit.');
      // Hard-lock all unedited areas to the ORIGINAL photo, independent of model compliance.
      const aiPhoto=new Image();await new Promise((resolve,reject)=>{aiPhoto.onload=resolve;aiPhoto.onerror=()=>reject(new Error('AI obrázek se nepodařilo načíst.'));aiPhoto.src=json.data.image});
      const composite=document.createElement('canvas');composite.width=canvas.width;composite.height=canvas.height;
      const cc=composite.getContext('2d');cc.drawImage(original,0,0);
      cc.save();cc.beginPath();edits.forEach(a=>{cc.moveTo(a.points[0].x,a.points[0].y);a.points.slice(1).forEach(pt=>cc.lineTo(pt.x,pt.y));cc.closePath()});cc.clip();cc.drawImage(aiPhoto,0,0,composite.width,composite.height);cc.restore();
      // Restore protected green regions even when overlapping red/blue shapes.
      cc.save();cc.beginPath();(automatic?[]:areas.filter(a=>a.tool==='keep'&&a.points?.length>=3)).forEach(a=>{cc.moveTo(a.points[0].x,a.points[0].y);a.points.slice(1).forEach(pt=>cc.lineTo(pt.x,pt.y));cc.closePath()});cc.clip();cc.drawImage(original,0,0);cc.restore();
      const finalImage=composite.toDataURL('image/png');
      result.replaceChildren();
      const comparison=document.createElement('div');comparison.className='mg-before-after';comparison.setAttribute('aria-label','Porovnání původní fotografie a AI návrhu');
      const before=document.createElement('img');before.src=original.toDataURL('image/png');before.alt='Před úpravou – původní zahrada';before.className='mg-before-image';
      const after=document.createElement('img');after.src=finalImage;after.alt='Po úpravě – AI návrh';after.className='mg-after-image';
      const labels=document.createElement('div');labels.className='mg-comparison-labels';labels.innerHTML='<span>PŘED</span><span>PO – AI NÁVRH</span>';
      const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.value='50';range.className='mg-comparison-range';range.setAttribute('aria-label','Posunout hranici porovnání před a po');range.addEventListener('input',()=>comparison.style.setProperty('--mg-reveal',range.value+'%'));
      comparison.append(after,before,labels,range);result.append(comparison);
      const note=document.createElement('p');note.textContent='Posuňte jezdec pro porovnání stejné zahrady před úpravou a po AI návrhu. Testovací vizualizace vyžaduje kontrolu zachování staveb, proporcí a realismu.';result.append(note);
      const link=document.createElement('a');link.href=finalImage;link.download='mvgreen-ai-navrh.png';link.textContent='⬇ Uložit AI návrh';link.className='mg-ai-download';result.append(link);
    }catch(err){result.textContent='Chyba: '+err.message;}finally{aiButton.disabled=false;}
  });
}
})();