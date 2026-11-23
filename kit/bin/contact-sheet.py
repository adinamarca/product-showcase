#!/usr/bin/env python3
"""Sample frames of a GIF into one grid image, to review a capture at a glance.

    python3 kit/bin/contact-sheet.py dist/light/email/02-search.gif sheet.png [frames=12]

Needs Pillow (pip install pillow).
"""
import sys

from PIL import Image, ImageSequence

src, dst = sys.argv[1], sys.argv[2]
count = int(sys.argv[3]) if len(sys.argv) > 3 else 12
frames = [f.convert('RGB') for f in ImageSequence.Iterator(Image.open(src))]
count = max(2, min(count, len(frames)))
picks = [frames[round(i * (len(frames) - 1) / (count - 1))] for i in range(count)]
w, h = picks[0].width // 2, picks[0].height // 2
cols = 4
rows = (count + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols - 1) * 6, rows * h + (rows - 1) * 6), 'black')
for i, frame in enumerate(picks):
    sheet.paste(frame.resize((w, h)), ((i % cols) * (w + 6), (i // cols) * (h + 6)))
sheet.save(dst)
print(f'{len(frames)} frames → {dst}')
