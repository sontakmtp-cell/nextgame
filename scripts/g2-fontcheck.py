import hashlib,json,pathlib,sys
from fontTools.ttLib import TTFont

root=pathlib.Path('apps/web/public/fonts')
characters=set('Tiếng Việt: ă â ê ô ơ ư đ Ă Â Ê Ô Ơ Ư Đ à á ả ã ạ ằ ắ ẳ ẵ ặ ầ ấ ẩ ẫ ậ ề ế ể ễ ệ ồ ố ổỗ ộ ờ ớ ở ỡ ợ ừ ứử ữ ự ì í ỉ ĩ ị ù ú ủ ũ ụ ỳ ý ỷ ỹ ỵ'.replace(' ',''))
manifest=json.loads((root/'manifest.json').read_text())
rows=[]
for name,item in manifest.items():
    data=(root/name).read_bytes()
    assert hashlib.sha256(data).hexdigest()==item['sha256']
    font=TTFont(root/name)
    missing=sorted(c for c in characters if ord(c) not in font.getBestCmap())
    assert not missing,(name,missing)
    rows.append({'file':name,'bytes':len(data),'vietnameseGlyphsChecked':len(characters),'missing':missing})
result={'status':'passed','python':sys.version,'files':rows,'licenses':['Inter-OFL.txt','IBM-Plex-Mono-OFL.txt']}
pathlib.Path('.local/g2/fontcheck.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
