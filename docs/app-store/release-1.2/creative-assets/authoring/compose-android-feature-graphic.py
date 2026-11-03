"""Compose the 1024x500 Play feature graphic from approved campaign assets."""
from pathlib import Path
import json
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageFilter

HERE=Path(__file__).resolve().parent
RELEASE=HERE.parent.parent
FINAL=RELEASE/'final-images'
OUT=FINAL/'android'
SIZE=(1024,500)
background=Image.open(HERE/'backdrop-v1.png').convert('RGB')
ratio=max(SIZE[0]/background.width,SIZE[1]/background.height)
background=background.resize((round(background.width*ratio),round(background.height*ratio)),Image.Resampling.LANCZOS)
y=(background.height-SIZE[1])//2
canvas=background.crop((0,y,SIZE[0],y+SIZE[1]))

# Preserve the approved headline's exact lettering and line breaks.
source=Image.open(FINAL/'01-unlimited-invoices-estimates.png').convert('RGB')
header=source.crop((70,150,1100,690))
r,g,b=header.split()
alpha=ImageChops.darker(ImageChops.darker(r,g),b).point(lambda v:max(0,min(255,round((v-110)*255/45))))
headline=Image.new('RGBA',header.size,(248,243,232,0))
headline.putalpha(alpha)
headline=headline.crop(alpha.getbbox())
width=520
headline=headline.resize((width,round(headline.height*width/headline.width)),Image.Resampling.LANCZOS)
canvas.paste(headline,(54,58),headline.getchannel('A'))
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',26)
subtitle='Simple time & expense tracking\nfor contractors.'
draw=ImageDraw.Draw(canvas)
subtitle_box=draw.multiline_textbbox((54,375),subtitle,font=font,spacing=6)
draw.multiline_text((54,375),subtitle,font=font,spacing=6,fill=(248,243,232))
assert 58+headline.height<375
assert subtitle_box[2]<720 and subtitle_box[3]<SIZE[1]-30

# Reuse the Android frame and native UI as a single uniformly scaled plate.
android=Image.open(OUT/'01-unlimited-invoices-estimates.png').convert('RGB')
plate=android.crop((230,630,850,1885))
mask=Image.new('L',(plate.width*4,plate.height*4),0)
ImageDraw.Draw(mask).rounded_rectangle((0,0,mask.width-1,mask.height-1),radius=32*4,fill=255)
plate.putalpha(mask.resize(plate.size,Image.Resampling.LANCZOS))
height=430
plate=plate.resize((round(plate.width*height/plate.height),height),Image.Resampling.LANCZOS)
px,py=750,35
shadow=Image.new('RGBA',SIZE)
shadow.paste(Image.new('RGBA',plate.size,(0,0,0,110)),(px+3,py+4),plate.getchannel('A'))
canvas=Image.alpha_composite(canvas.convert('RGBA'),shadow.filter(ImageFilter.GaussianBlur(5)))
canvas.alpha_composite(plate,(px,py))
canvas=canvas.convert('RGB')
output=OUT/'06-feature-graphic.png'
canvas.save(output)
with Image.open(output) as im:
    assert im.size==SIZE and im.mode=='RGB'
    im.verify()
data={'output':output.name,'dimensions':SIZE,'format':'RGB PNG without alpha','headline':'Unlimited invoices & estimates','subtitle':'Simple time & expense tracking for contractors.','phone':'Existing Android edge-to-edge frame and invoice plate; no new native UI generated','method':'Deterministic composition of approved existing artwork','visual_review':'Required after rendering'}
(OUT/'feature-graphic-validation.json').write_text(json.dumps(data,indent=2)+'\n')
print(output)
