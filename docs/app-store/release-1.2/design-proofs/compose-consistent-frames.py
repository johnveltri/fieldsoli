"""Reuse image 02's exact device plate throughout the selected campaign.

Uses existing selected finals for campaign headers and the common hardware.
Original source app screens are preserved; this refreshes UI plates, not typography. No generative
editing is used; image 02 supplies the common lower backdrop and hardware.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageChops

HERE = Path(__file__).resolve().parent
FINAL = HERE.parent / 'final-images'
SIZE = (1320, 2868)
reference_path = FINAL / '02-track-time-expenses.png'
reference = Image.open(reference_path).convert('RGB')
assert reference.size == SIZE
selections = [
    ('01-unlimited-invoices-estimates', 'v3', 'invoice-preview-charges.png'),
    ('02-track-time-expenses', 'v2', 'job-edit-time-materials-and-costs.png'),
    ('03-simple-fast', 'v1', 'active-visit.png'),
    ('04-take-data-with-you', 'v1', 'export-job-summary.png'),
    ('05-job-earnings-insights', 'v1', 'earnings-monthly-snapshot.png'),
]

# All existing source composites use this same uniformly scaled screen box.
left, top, width, height = 237, 869, 844, 1835
factor = SIZE[0] / 851
mask4 = Image.new('L', (width * 4, height * 4), 0)
ImageDraw.Draw(mask4).rounded_rectangle(
    (0, 0, width * 4 - 1, height * 4 - 1),
    radius=round(85 * factor * 4), fill=255,
)
screen_mask = mask4.resize((width, height), Image.Resampling.LANCZOS)

# The top of the physical phone is below this short background-only blend.
plate_mask = Image.new('L', SIZE, 0)
plate_draw = ImageDraw.Draw(plate_mask)
for y in range(780, SIZE[1]):
    plate_draw.line((0, y, SIZE[0], y), fill=min(255, round((y - 780) * 255 / 35)))

island_box = (520, 892, 800, 974)
original_island = reference.crop(island_box)
island = Image.new('RGB', original_island.size, 'black')
island_mask4 = Image.new('L', (island.width * 4, island.height * 4), 0)
ImageDraw.Draw(island_mask4).rounded_rectangle(
    (0, 0, island_mask4.width - 1, island_mask4.height - 1),
    radius=island_mask4.height // 2, fill=255,
)
island_mask = island_mask4.resize(island.size, Image.Resampling.LANCZOS)
# Remove the cream-screen antialias fringe from the extracted capsule so it
# also sits cleanly on image 03's dark screen. Keep 02's camera pixels intact.
island_core4 = Image.new('L', island_mask4.size, 0)
ImageDraw.Draw(island_core4).rounded_rectangle(
    (20, 20, island_core4.width - 21, island_core4.height - 21),
    radius=(island_core4.height - 40) // 2, fill=255,
)
island_core = island_core4.resize(island.size, Image.Resampling.LANCZOS)
island.paste(original_island, (0, 0), island_core)

manifest = {'reference': reference_path.name, 'dimensions': list(SIZE), 'images': []}
outputs = []
for stem, version, screen_name in selections:
    selected = FINAL / f'{stem}.png'
    original = Image.open(selected).convert('RGB')
    canvas = original.copy()
    canvas.paste(reference, (0, 0), plate_mask)
    src_path = HERE.parent / 'source-screenshots' / screen_name
    source = Image.open(src_path).convert('RGB')
    assert round(source.height * width / source.width) == height
    screen = source.resize((width, height), Image.Resampling.LANCZOS)
    canvas.paste(screen, (left, top), screen_mask)
    canvas.paste(island, island_box[:2], island_mask)

    # The header must be untouched and the actual UI must match its source.
    assert canvas.crop((0, 0, SIZE[0], 780)).tobytes() == original.crop((0, 0, SIZE[0], 780)).tobytes()
    interior = (70, 150, width - 70, height - 70)
    actual_box = (left + interior[0], top + interior[1], left + interior[2], top + interior[3])
    assert canvas.crop(actual_box).tobytes() == screen.crop(interior).tobytes()

    table_box = None
    if stem.startswith('04-'):
        excerpt = Image.open(HERE / '04-export-excerpt.png').convert('RGB')
        table_width = round(758 * factor)
        table_height = round(excerpt.height * table_width / excerpt.width)
        table = excerpt.resize((table_width, table_height), Image.Resampling.LANCZOS)
        table_left, table_top = round(67 * factor), 1930
        table_mask4 = Image.new('L', (table_width * 4, table_height * 4), 0)
        ImageDraw.Draw(table_mask4).rounded_rectangle(
            (0, 0, table_mask4.width - 1, table_mask4.height - 1), radius=round(17 * factor * 4), fill=255,
        )
        canvas.paste(table, (table_left, table_top), table_mask4.resize(table.size, Image.Resampling.LANCZOS))
        table_box = (table_left, table_top, table_left + table_width, table_top + table_height)
        cta = (left + 70, top + round(height * .89), left + width - 70, top + round(height * .96))
        assert canvas.crop(cta).tobytes() == screen.crop((70, round(height * .89), width - 70, round(height * .96))).tobytes()

    # Compare the complete hardware region outside the screen against 02.
    # Exclude only the separate spreadsheet card that intentionally overlaps it.
    hardware_mask = Image.new('L', SIZE, 0)
    hd = ImageDraw.Draw(hardware_mask)
    hd.rectangle((170, 820, 1145, 2770), fill=255)
    hd.rectangle((left - 2, top - 2, left + width + 2, top + height + 2), fill=0)
    if table_box:
        hd.rectangle(table_box, fill=0)
    difference = ImageChops.difference(canvas, reference)
    assert ImageChops.multiply(difference, Image.merge('RGB', (hardware_mask,) * 3)).getbbox() is None
    island_interior = island_core.point(lambda value: 255 if value == 255 else 0)
    island_difference = ImageChops.difference(canvas.crop(island_box), reference.crop(island_box))
    assert ImageChops.multiply(island_difference, Image.merge('RGB', (island_interior,) * 3)).getbbox() is None

    canvas.save(FINAL / f'{stem}.png')
    manifest['images'].append({
        'final': f'{stem}.png', 'selected_layout': selected.name, 'historical_selected_version': version,
        'source_screen': screen_name,
        'source_sha256': hashlib.sha256(src_path.read_bytes()).hexdigest(),
        'header_pixel_check': 'PASS', 'native_ui_pixel_check': 'PASS before export card',
        'hardware_pixel_check_against_02': 'PASS', 'camera_cutout_pixel_check': 'PASS',
        'export_card_box': table_box,
    })
    outputs.append(canvas)

(HERE / 'consistent-frames-v1.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
