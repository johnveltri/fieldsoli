"""Adapt approved screenshot artwork to minimal edge-to-edge Android frames.

Uses original screenshot pixels with the iOS status bar cropped out. This is a
marketing frame adaptation, not evidence of fresh Android device captures.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
RELEASE = HERE.parent.parent
FINAL = RELEASE / 'final-images'
OUT = FINAL / 'android'
OUT.mkdir(exist_ok=True)
SIZE = (1080,1920)
items = [
    ('01-unlimited-invoices-estimates','invoice-preview-charges.png'),
    ('02-track-time-expenses','job-edit-time-materials-and-costs.png'),
    ('03-simple-fast','active-visit.png'),
    ('04-take-data-with-you','export-job-summary.png'),
    ('05-job-earnings-insights','earnings-monthly-snapshot.png'),
]
ios_hashes = {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in FINAL.glob('*.png')}
background = Image.open(HERE/'backdrop-v1.png').convert('RGB')
ratio = max(SIZE[0]/background.width,SIZE[1]/background.height)
background = background.resize((round(background.width*ratio),round(background.height*ratio)),Image.Resampling.LANCZOS)
offset=(background.width-SIZE[0])//2
background=background.crop((offset,0,offset+SIZE[0],SIZE[1]))
manifest={'dimensions':SIZE,'format':'RGB PNG, no alpha','source_type':'Original supplied screenshots with iOS status bars cropped; not fresh Android captures','frame':'Identical thin edge-to-edge frame; no hardware cutout, notch, Dynamic Island, or iPhone buttons','images':[]}
for stem,screen_name in items:
    canvas=background.copy()
    approved=Image.open(FINAL/(stem+'.png')).convert('RGB')
    # Retain the exact approved lettering and captions, with no new copy.
    header=approved.crop((0,0,1320,780))
    r,g,b=header.split()
    alpha=ImageChops.darker(ImageChops.darker(r,g),b).point(lambda v:max(0,min(255,round((v-110)*255/45))))
    lettering=Image.new('RGBA',header.size,(248,243,232,0))
    lettering.putalpha(alpha)
    lettering=lettering.resize((1056,624),Image.Resampling.LANCZOS)
    canvas.paste(lettering,(12,0),lettering.getchannel('A'))

    source_path=RELEASE/'source-screenshots'/screen_name
    source=Image.open(source_path).convert('RGB')
    crop_top=round(source.height*140/2622)
    native=source.crop((0,crop_top,source.width,source.height))
    width=600
    height=round(native.height*width/native.width)
    screen=native.resize((width,height),Image.Resampling.LANCZOS)
    left,top=240,640
    frame_box=(left-10,top-10,left+width+10,top+height+10)
    # Supersampled border and mask: a generic edge-to-edge presentation frame.
    frame_mask=Image.new('L',(SIZE[0]*2,SIZE[1]*2),0)
    ImageDraw.Draw(frame_mask).rounded_rectangle(tuple(v*2 for v in frame_box),radius=64,fill=255)
    frame_mask=frame_mask.resize(SIZE,Image.Resampling.LANCZOS)
    shadow=frame_mask.filter(ImageFilter.GaussianBlur(14)).point(lambda v:round(v*.5))
    canvas.paste(Image.new('RGB',SIZE,'black'),(0,8),shadow)
    canvas.paste(Image.new('RGB',SIZE,'#15191e'),(0,0),frame_mask)
    screen_mask=Image.new('L',(width*4,height*4),0)
    ImageDraw.Draw(screen_mask).rounded_rectangle((0,0,width*4-1,height*4-1),radius=24*4,fill=255)
    screen_mask=screen_mask.resize(screen.size,Image.Resampling.LANCZOS)
    canvas.paste(screen,(left,top),screen_mask)
    interior=(35,35,width-35,height-35)
    assert canvas.crop((left+35,top+35,left+width-35,top+height-35)).tobytes()==screen.crop(interior).tobytes()
    if stem.startswith('04-'):
        table=Image.open(RELEASE/'design-proofs/04-export-excerpt.png').convert('RGB')
        table=table.resize((840,round(table.height*840/table.width)),Image.Resampling.LANCZOS)
        table_left,table_top=120,1330
        tm=Image.new('L',table.size,0)
        ImageDraw.Draw(tm).rounded_rectangle((0,0,table.width-1,table.height-1),radius=16,fill=255)
        canvas.paste(table,(table_left,table_top),tm)
        # The export CTA is below the separate table and remains untouched.
        cta=(left+35,top+round(height*.89),left+width-35,top+round(height*.97))
        assert canvas.crop(cta).tobytes()==screen.crop((35,round(height*.89),width-35,round(height*.97))).tobytes()
    output=OUT/(stem+'.png')
    canvas.save(output)
    with Image.open(output) as saved:
        assert saved.size==SIZE and saved.mode=='RGB'
        saved.verify()
    assert max(SIZE)<=2*min(SIZE)
    manifest['images'].append({'file':output.name,'native_source':screen_name,'native_source_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'source_crop':[0,crop_top,source.width,source.height],'screen_box':[left,top,left+width,top+height],'source_interior_pixel_check':'PASS before separate export table'})
for name,digest in ios_hashes.items():
    assert hashlib.sha256((FINAL/name).read_bytes()).hexdigest()==digest
(OUT/'validation.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
