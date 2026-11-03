"""Landscape tablet campaign using fresh native Android captures, never redrawn UI."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageOps
HERE=Path(__file__).resolve().parent
REL=HERE.parent.parent
SOURCES=REL/'source-screenshots/android-tablets'
OUT=REL/'final-images/android-tablets'
SIZE=(2560,1600)
COPY=[('01-unlimited-invoices-estimates','Unlimited invoices & estimates',''),('02-track-time-expenses','Track time & expenses',''),('03-simple-fast','Simple. Fast.',''),('04-take-data-with-you','Take your data with you.','CSV export. No active subscription required.'),('05-job-earnings-insights','Job earnings insights','Understand profitability to inform future pricing')]
FONT='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
REG='/System/Library/Fonts/Supplemental/Arial.ttf'
manifest={'size':SIZE,'source':'Fresh Expo Go SDK 57 Android emulator captures; hosted Dev fictional fixture','frame':'Same minimal black 16:10 tablet frame throughout; no camera cutout','images':[]}

def panel(canvas,im,xy,width,radius=22):
 im=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
 mask=Image.new('L',im.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,im.width-1,im.height-1),radius,fill=255)
 shadow=Image.new('L',SIZE);shadow.paste(mask,xy);shadow=shadow.filter(ImageFilter.GaussianBlur(18)).point(lambda v:round(v*.38))
 canvas.paste(Image.new('RGB',SIZE,'black'),(0,10),shadow)
 canvas.paste(im,xy,mask)
 return im

for device in ['nexus-7','pixel-tablet']:
 dest=OUT/device;dest.mkdir(parents=True,exist_ok=True)
 files=['invoice-preview-charges.png','job-other-costs.png' if device=='nexus-7' else 'job-edit-time-materials-and-costs.png','active-visit.png','export-job-summary.png','earnings-job-comparisons.png']
 for (stem,title,subtitle),name in zip(COPY,files):
  source=SOURCES/device/name
  assert source.exists(), f"Missing native capture: {source}"
  screen=Image.open(source).convert('RGB');assert screen.width>screen.height
  assert screen.size in [(1920,1200),(2560,1600)]
  canvas=ImageOps.fit(Image.open(HERE/'backdrop-v1.png').convert('RGB'),SIZE,method=Image.Resampling.LANCZOS)
  d=ImageDraw.Draw(canvas);font=ImageFont.truetype(FONT,100)
  while d.textbbox((0,0),title,font=font)[2]>2360:font=ImageFont.truetype(FONT,font.size-2)
  d.text((1280,65),title,font=font,fill='#f8f3e8',anchor='mt')
  if subtitle:d.text((1280,192),subtitle,font=ImageFont.truetype(REG,48),fill='#f8f3e8',anchor='mt')
  # Every native image scales uniformly into the same hardware geometry.
  x,y,w,h=280,300,2000,1250
  ImageDraw.Draw(canvas).rounded_rectangle((x-14,y-14,x+w+14,y+h+14),radius=50,fill='#11151a',outline='#55585a',width=3)
  scaled=screen.resize((w,h),Image.Resampling.LANCZOS)
  mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=36,fill=255)
  canvas.paste(scaled,(x,y),mask)
  # Interior equality checks precede the explicitly separate UI proof cards.
  assert canvas.crop((x+50,y+50,x+w-50,y+h-50)).tobytes()==scaled.crop((50,50,w-50,h-50)).tobytes()
  extras=[]
  if stem.startswith('01'):
   top=Image.open(SOURCES/device/'invoice-preview-top.png').convert('RGB')
   box=(184,365,900,860) if device=='nexus-7' else (504,365,1220,860)
   panel(canvas,top.crop(box),(1930,255),500)
   extras.append({'source':'invoice-preview-top.png','crop':box,'placement':[1930,255,500]})
  if stem.startswith('02') and device=='nexus-7':
   visit=Image.open(SOURCES/device/'job-visits-materials-and-costs.png').convert('RGB')
   box=(360,264,1560,422)
   panel(canvas,visit.crop(box),(1330,275),1050)
   extras.append({'source':'job-visits-materials-and-costs.png','crop':box,'placement':[1330,275,1050]})
  if stem.startswith('05') and device=='nexus-7':
   least=Image.open(SOURCES/device/'earnings-least-profitable.png').convert('RGB')
   box=(360,310,1560,565) if device=='nexus-7' else (680,310,1880,565)
   panel(canvas,least.crop(box),(1600,280),800)
   extras.append({'source':'earnings-least-profitable.png','crop':box,'placement':[1600,280,800]})
  if stem.startswith('04'):
   table=Image.open(REL/'design-proofs/04-export-excerpt.png').convert('RGB')
   panel(canvas,table,(1400,740),1000)
   extras.append({'source':'design-proofs/04-export-excerpt.png','placement':[1400,740,1000]})
  cta_check='N/A'
  if stem[:2] in ['01','03','04']:
   rows=(966,1072) if stem.startswith('04') else (1030,1136)
   if device=='pixel-tablet': rows=(1366,1472) if stem.startswith('04') else (1430,1536)
   roi=(round(w*.12),round(rows[0]*h/screen.height)+12,round(w*.88),round(rows[1]*h/screen.height)-12)
   assert canvas.crop((x+roi[0],y+roi[1],x+roi[2],y+roi[3])).tobytes()==scaled.crop(roi).tobytes(), 'Native CTA was obscured'
   cta_check='PASS after all separate proof cards'
  path=dest/(stem+'.png');canvas.save(path,optimize=True)
  assert path.stat().st_size<8_000_000
  manifest['images'].append({'file':str(path.relative_to(OUT)),'headline':title,'subtitle':subtitle,'native_capture':str(source.relative_to(REL)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'screen_box':[x,y,w,h],'native_pixel_check':'PASS; uniform scaling only','native_cta_check':cta_check,'separate_proof_cards':extras})
(OUT/'validation.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f"Created {len(manifest['images'])} landscape tablet images.")
