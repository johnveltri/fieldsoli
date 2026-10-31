"""Adapt the approved campaign to Apple's header/search placements.

Imagegen provides campaign typography and backdrop. The exact selected invoice
and common image-02 hardware are inserted as one uniformly scaled source plate.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RELEASE = ROOT.parent
SOURCE = RELEASE / 'final-images/01-unlimited-invoices-estimates.png'
source = Image.open(SOURCE).convert('RGB')
crop_box = (176, 820, 1145, 2770)
phone = source.crop(crop_box)
scale = 4
mask = Image.new('L', (phone.width * scale, phone.height * scale), 0)
draw = ImageDraw.Draw(mask)
def rect(box, radius):
    local = tuple(round((v - (crop_box[0] if i % 2 == 0 else crop_box[1])) * scale) for i, v in enumerate(box))
    draw.rounded_rectangle(local, radius=radius * scale, fill=255)
rect((191, 824, 1130, 2761), 185)
for box in [(180,1167,195,1243), (180,1308,195,1445), (180,1455,195,1613), (1126,1350,1140,1576)]:
    rect(box, 7)
phone.putalpha(mask.resize(phone.size, Image.Resampling.LANCZOS))

specs = {
    'header': {'size': (3840,1646), 'safe': (1097,493,2743,1154), 'phone': (2770,95,1450), 'text': (260,260,1650), 'support': (260,1250,88)},
    'search': {'size': (3840,2560), 'safe': (836,765,3004,1795), 'phone': (2670,280,2000), 'text': (280,480,1800), 'support': (280,1610,110)},
}

# Reuse the exact heavy headline lettering from the selected invoice layout.
# Extract cream typography only, so the new copy isn't baked into a rectangle.
headline_source = source.crop((70,150,1100,690))
red,green,blue = headline_source.split()
headline_mask = ImageChops.darker(ImageChops.darker(red,green),blue).point(lambda v: max(0,min(255,round((v-110)*255/45))))
headline = Image.new('RGBA',headline_source.size,(248,243,232,0))
headline.putalpha(headline_mask)
headline = headline.crop(headline_mask.getbbox())
manifest = {
    'research_date': '2026-10-31',
    'specifications': 'https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications',
    'safe_area_source': 'Apple Photoshop templates linked from https://developer.apple.com/app-store/asset-best-practices/',
    'source_image': str(SOURCE.relative_to(RELEASE)),
    'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'hardware': 'Image 02 common hardware, already composited in the invoice final',
    'generation': 'Built-in imagegen backdrop; approved headline, original device and native UI composited deterministically',
    'headline': 'Unlimited invoices & estimates',
    'support': 'Simple time & expense tracking for contractors.',
    'assets': [],
}
for kind, spec in specs.items():
    artwork = Image.open(HERE / 'backdrop-v1.png').convert('RGB')
    target_width, target_height = spec['size']
    # Fit without distorting typography; generated dimensions can differ by a
    # few pixels from the requested aspect ratio.
    ratio = max(target_width / artwork.width, target_height / artwork.height)
    artwork = artwork.resize((round(artwork.width * ratio),round(artwork.height * ratio)),Image.Resampling.LANCZOS)
    offset = ((artwork.width-target_width)//2, (artwork.height-target_height)//2)
    canvas = artwork.crop((offset[0],offset[1],offset[0]+target_width,offset[1]+target_height))
    tx,ty,tw = spec['text']
    th = round(headline.height * tw / headline.width)
    lettering = headline.resize((tw,th),Image.Resampling.LANCZOS)
    canvas.paste(lettering,(tx,ty),lettering.getchannel('A'))
    text_x,text_y,font_size = spec['support']
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',font_size)
    support_draw = ImageDraw.Draw(canvas)
    support_text = 'Simple time & expense tracking\nfor contractors.'
    support_box = support_draw.multiline_textbbox((text_x,text_y),support_text,font=font,spacing=8)
    support_draw.multiline_text((text_x,text_y),support_text,font=font,spacing=8,fill=(248,243,232))
    assert ty+th < text_y, 'Headline overlaps supporting copy'
    for box in [(tx,ty,tx+tw,ty+th), support_box]:
        assert 0<=box[0] and 0<=box[1] and box[2]<=target_width and box[3]<=target_height
    x,y,h = spec['phone']
    w = round(phone.width * h / phone.height)
    placed = phone.resize((w,h),Image.Resampling.LANCZOS)
    shadow = Image.new('RGBA', canvas.size)
    shadow.paste(Image.new('RGBA', placed.size, (0,0,0,105)),(x+10,y+14),placed.getchannel('A'))
    canvas = Image.alpha_composite(canvas.convert('RGBA'),shadow.filter(ImageFilter.GaussianBlur(14)))
    canvas.alpha_composite(placed,(x,y))
    canvas = canvas.convert('RGB')
    output = RELEASE / 'final-images' / ('06-app-store-header.png' if kind=='header' else '07-app-store-search-results.png')
    canvas.save(output)
    with Image.open(output) as saved:
        assert saved.size == spec['size'] and saved.mode == 'RGB'
    safe = spec['safe']
    assert 0 <= x and 0 <= y and x+w <= target_width and y+h <= target_height
    # An opaque interior sample must remain exactly equal to the scaled source.
    test = (round(w*.12),round(h*.20),round(w*.88),round(h*.85))
    assert canvas.crop((x+test[0],y+test[1],x+test[2],y+test[3])).tobytes() == placed.convert('RGB').crop(test).tobytes()
    manifest['assets'].append({'output':output.name, 'dimensions':spec['size'], 'safe_area':safe, 'phone_box':[x,y,x+w,y+h], 'no_alpha':'PASS', 'source_pixel_check':'PASS', 'composition':'Full canvas as requested; template safe-area constraint removed', 'copy':manifest['support']})
(ROOT / 'validation.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
