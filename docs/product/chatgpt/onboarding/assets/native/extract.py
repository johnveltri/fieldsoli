from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parents[6]
SRC=ROOT/'docs/app-store/release-1.2/source-screenshots'
OUT=Path(__file__).resolve().parent
jobs=[('card-02-time-expenses','job-edit-time-materials-and-costs.png',(60,350,1146,2622)),('card-03-simple-fast','active-visit.png',(60,340,1146,1338)),('card-04-export','export-job-summary.png',(60,245,1146,1505)),('card-05-earnings','earnings-monthly-snapshot.png',(60,810,1146,1668))]
manifest=[]
for name,source,box in jobs:
 original=Image.open(SRC/source).convert('RGBA');im=original.crop(box)
 # Only remove the screenshot's flat cream surface; preserve native UI RGB pixels.
 bg=original.getpixel((5,700))[:3]
 for y in range(im.height):
  for x in range(im.width):
   p=im.getpixel((x,y))
   if max(abs(p[i]-bg[i]) for i in range(3))<=2:im.putpixel((x,y),(p[0],p[1],p[2],0))
 canvas=Image.new('RGBA',(im.width+96,im.height+96));canvas.paste(im,(48,48));canvas.save(OUT/(name+'.png'))
 # Validate every retained pixel has exactly the original RGB value (no regeneration/resampling).
 for y in range(im.height):
  for x in range(im.width):
   if im.getpixel((x,y))[3]:assert im.getpixel((x,y))[:3]==original.getpixel((box[0]+x,box[1]+y))[:3]
 manifest.append(dict(asset=name+'.png',source=source,source_sha256=hashlib.sha256((SRC/source).read_bytes()).hexdigest(),crop=box,removed_background_rgb=bg,retained_rgb_check='PASS'))
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
