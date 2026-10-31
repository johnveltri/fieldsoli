"""Read selected original export columns and render a factual marketing excerpt.

The supplied workbook is read-only. No customer identifiers or contact fields
are included. Headers are the original export column names.
"""

from pathlib import Path
import json
from decimal import Decimal

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
# The original workbook extraction is retained as JSON so reproduction does
# not depend on a private Downloads path or require the original workbook.
data = json.loads((HERE / '04-export-excerpt-source.json').read_text())
headers = data['headers']
records = data['rows']

image = Image.new('RGB', (1240, 600), 'white')
draw = ImageDraw.Draw(image)
fontpath = '/System/Library/Fonts/Supplemental/Arial.ttf'
boldpath = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
titlefont = ImageFont.truetype(boldpath, 42)
headerfont = ImageFont.truetype(boldpath, 26)
bodyfont = ImageFont.truetype(fontpath, 31)
draw.text((36, 30), 'Job summary · 2026', font=titlefont, fill='#2B3441')
draw.text((36, 90), 'Selected export columns', font=ImageFont.truetype(fontpath, 25), fill='#6F6A65')
edges = [28, 580, 785, 990, 1212]
top, headerheight, rowheight = 144, 72, 86
draw.rectangle((28, top, 1212, top + headerheight), fill='#F0EBE3')
for index, header in enumerate(headers):
    draw.text((edges[index] + 14, top + 22), header, font=headerfont, fill='#2B3441')
for rowindex, record in enumerate(records):
    y = top + headerheight + rowindex * rowheight
    for index, value in enumerate(record):
        label = value if index == 0 else '${:,.2f}'.format(Decimal(value))
        if index == 0:
            assert draw.textbbox((0, 0), label, font=bodyfont)[2] < edges[1] - edges[0] - 28
            xy = (edges[index] + 14, y + 24)
        else:
            textwidth = draw.textlength(label, font=bodyfont)
            xy = (edges[index + 1] - 14 - textwidth, y + 24)
        draw.text(xy, label, font=bodyfont, fill='#2B3441')
    draw.line((28, y + rowheight, 1212, y + rowheight), fill='#DAD6D0', width=2)
for edge in edges:
    draw.line((edge, top, edge, top + headerheight + len(records) * rowheight), fill='#DAD6D0', width=2)
image.save(HERE / '04-export-excerpt.png')
print('Rendered actual columns:', headers)
print('Rows:', len(records), 'Output:', HERE / '04-export-excerpt.png')
