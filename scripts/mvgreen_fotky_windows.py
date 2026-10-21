#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MVGreen: kandidáti fotografií Wikimedia Commons pro 805 rostlin.
Použití: python mvgreen_fotky_windows.py --limit 10
         python mvgreen_fotky_windows.py --all
         python mvgreen_fotky_windows.py --all --download-previews
Zdroj: Wikimedia Commons API. Neoznačuje kandidáty jako schválené fotografie.
"""
import argparse, csv, html, json, re, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

ROOT=Path(__file__).resolve().parent
INPUT=ROOT/'MVGreen_805_pripraveno_pro_AI_vizualizace.csv'
CACHE=ROOT/'MVGreen_fotky_commons_cache.json'
OUT=ROOT/'MVGreen_fotky_kandidati.csv'
PREVIEW=ROOT/'MVGreen_fotky_nahledy'
API='https://commons.wikimedia.org/w/api.php'
UA='MVGreenGardenDesigner/1.0 (plant reference image discovery; attribution metadata; contact via project website mvgreen.cz)'
HEAD={'User-Agent':UA,'Accept':'application/json'}
# Konzervativní licence pro komerční zobrazení ve webové aplikaci.
# CC BY-SA není povolena automaticky kvůli povinnostem u odvozenin;
# může být posouzena zvlášť. Podobně fotografie jsou JEN kandidáty.
OK_LICENSE={'cc0','cc-by-4.0','cc-by-3.0','cc-by-2.0','cc-by-2.5','public domain','pd','pd-old','pd-self'}
COLUMNS=['ID','Latinský název','Stav','Název souboru','Odkaz na popis','Odkaz na náhled','Autor','Licence','Odkaz na licenci','Shoda názvu','Obraz px','Lokální náhled','Poznámka']

def clean(s):
    return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',str(s or '')))).strip()

def norm(s):
    return re.sub(r'[^a-z0-9 ]',' ',str(s).lower().replace('×',' x ')).strip()

def taxon_tokens(s):
    s=re.sub(r'\s+',' ',str(s)).strip()
    # Pro automatické přijetí druhu vyžadujeme dvouslovný druh; samotný rod nejde spolehlivě párovat.
    p=s.replace('×','x').split()
    if len(p)<2 or p[1].lower()=='sp.' or p[1].lower()=='spp.':return None
    if p[1].lower()=='x' and len(p)>2: return (p[0],p[2])
    return (p[0],p[1])

def fetch_json(params):
    url=API+'?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers=HEAD)
    with urllib.request.urlopen(req,timeout=35) as r:
        if 'json' not in r.headers.get('Content-Type','').lower():raise ValueError('API nevydalo JSON')
        return json.load(r)

def meta(d,k):return clean((d.get(k) or {}).get('value',''))

def get_candidates(name, max_count):
    parts=taxon_tokens(name)
    if not parts:return [],'JEN ROD / NEURČENÝ DRUH'
    query='"%s %s" filetype:bitmap' % parts
    params={'action':'query','format':'json','generator':'search','gsrsearch':query,'gsrnamespace':6,
        'gsrlimit':min(20,max_count*5),'prop':'imageinfo','iiprop':'url|size|extmetadata','iiurlwidth':700}
    d=fetch_json(params)
    pages=list((d.get('query') or {}).get('pages',{}).values())
    rows=[]
    latin=' '.join(parts).lower()
    for p in pages:
        ii=(p.get('imageinfo') or [{}])[0];em=ii.get('extmetadata') or {}
        license_code=meta(em,'LicenseShortName');url=meta(em,'LicenseUrl');artist=meta(em,'Artist')
        desc=meta(em,'ImageDescription');filetitle=p.get('title','')
        hay=(filetitle+' '+desc).lower().replace('_',' ')
        # Filtr přesného taxonu. Výsledek stále musí projít pohledovou kontrolou.
        if latin not in hay:continue
        lic=license_code.lower().replace(' ','-').replace('creative-commons-','cc-')
        compatible=lic in OK_LICENSE or lic.startswith('cc-by-') or lic.startswith('public-domain')
        if not compatible or 'sa' in lic or 'nc' in lic or 'nd' in lic:continue
        w,h=ii.get('width',0),ii.get('height',0)
        if min(w,h)<400:continue
        thumb=ii.get('thumburl','')
        if not thumb:continue
        rows.append({'filename':filetitle,'page':ii.get('descriptionurl',''),'preview':thumb,
            'author':artist,'license':license_code,'license_url':url,'dims':f'{w}×{h}',
            'match':'Druh zmíněn ve jménu/popisu – ověřit ručně'})
        if len(rows)>=max_count:break
    return rows,('KANDIDÁTI K VÝBĚRU' if rows else 'BEZ KANDIDÁTA')

def write_output(plants,cache):
    with OUT.open('w',newline='',encoding='utf-8-sig') as f:
        wr=csv.writer(f,delimiter=';');wr.writerow(COLUMNS)
        for pid,name in plants:
            item=cache.get(pid,{})
            rows=item.get('candidates') or []
            if not rows:
                wr.writerow([pid,name,item.get('status','ČEKÁ'),'', '', '', '', '', '', '', '', '',item.get('note','')])
            for cand in rows:
                path=PREVIEW/(pid+'_'+str(rows.index(cand)+1)+'.jpg')
                wr.writerow([pid,name,item.get('status',''),cand['filename'],cand['page'],cand['preview'],
                    cand['author'],cand['license'],cand['license_url'],cand['match'],cand['dims'],
                    str(path.name) if path.exists() else '', 'KANDIDÁT – autorství a správnost fotografie zkontrolovat před zveřejněním'])

def save(plants,cache):
    tmp=CACHE.with_name(CACHE.name+'.tmp')
    tmp.write_text(json.dumps(cache,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(CACHE)
    write_output(plants,cache)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--limit',type=int,default=10)
    p.add_argument('--all',action='store_true')
    p.add_argument('--download-previews',action='store_true')
    p.add_argument('--retry',action='store_true')
    p.add_argument('--per-plant',type=int,default=3)
    a=p.parse_args()
    if not INPUT.exists():raise SystemExit('CHYBÍ: '+str(INPUT)+'\nStáhni CSV katalog z GitHubu nebo ChatGPT a vlož vedle programu.')
    with INPUT.open(encoding='utf-8-sig',newline='') as f:
        plants=[(r['ID'],r['Latinský název']) for r in csv.DictReader(f,delimiter=';') if r.get('ID') and r.get('Latinský název')]
    cache=json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else {}
    if a.download_previews:PREVIEW.mkdir(exist_ok=True)
    print(f'Katalog: {len(plants)} | již zpracováno: {len(cache)} | max. kandidátů/rostlina: {a.per_plant}',flush=True)
    done=0;errors=0
    for pid,name in plants:
        if pid in cache and not a.retry:continue
        if not a.all and done>=a.limit:break
        try:
            images,status=get_candidates(name,max(1,min(a.per_plant,5)))
            item={'status':status,'candidates':images}
            if a.download_previews:
                for j,c in enumerate(images,1):
                    fn=PREVIEW/f'{pid}_{j}.jpg'
                    if not fn.exists():
                        req=urllib.request.Request(c['preview'],headers={'User-Agent':UA})
                        with urllib.request.urlopen(req,timeout=35) as resp:
                            ct=resp.headers.get('Content-Type','')
                            if not ct.startswith('image/'):raise ValueError('Náhled není obraz')
                            data=resp.read(2_500_000)
                        fn.write_bytes(data)
            cache[pid]=item
            errors=0
        except urllib.error.HTTPError as e:
            print(f'{pid}: HTTP {e.code} – {e.reason}',flush=True)
            if e.code in (429,403):
                save(plants,cache)
                print('STOP: omezení API, pokračuj později; cache zachována.',flush=True);return
            cache[pid]={'status':'CHYBA HTTP','note':str(e)};errors+=1
        except Exception as e:
            print(f'{pid}: chyba: {e}',flush=True)
            cache[pid]={'status':'CHYBA PŘIPOJENÍ','note':str(e)[:200]};errors+=1
        done+=1
        if done%10==0:
            save(plants,cache)
        print(f'{done}: {pid} {name}: {cache[pid]["status"]} ({len(cache[pid].get("candidates",[]))} fotek)',flush=True)
        if errors>=5:
            print('STOP: 5 opakovaných chyb – ověř připojení, pokračuj později.',flush=True);break
        time.sleep(1.2)
    save(plants,cache)
    print('HOTOVO:',OUT,'| záznamů v cache:',len(cache),flush=True)
    print('POZOR: fotky jsou pouze licenčně filtrovaní KANDIDÁTI, nikoli schválené fotky.',flush=True)

if __name__=='__main__':main()