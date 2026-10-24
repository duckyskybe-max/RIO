"""Cut the picture cards out of the flash-kanji PDF (ちびむすドリル, 小学1年) into public/cards/<position>.webp.

Each PDF page holds two cards (kanji on the left, picture on the right). Pages are in
data/card_pictures.json order (kanji -> deck position). Usage:
  pdftoppm -r 150 -png flash-kanji-syogaku1.pdf /tmp/pg && python3 scripts/extract_card_pictures.py /tmp
"""
import glob, json, pathlib, sys
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
order = json.loads((root / "data" / "card_pictures.json").read_text())  # {kanji: deck position}, PDF order
out = root / "public" / "cards"; out.mkdir(parents=True, exist_ok=True)

def trim(im, pad=14, thr=238):
    box = im.convert("L").point(lambda v: 0 if v > thr else 255).getbbox()
    if not box: return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))

pages = sorted(glob.glob(f"{sys.argv[1]}/pg-*.png"))
positions = list(order.values())
for i, f in enumerate(pages):
    im = Image.open(f).convert("RGB"); w, h = im.size; sx, sy = w / 826, h / 1169
    for row, (y0, y1) in enumerate([(32 * sy, 570 * sy), (586 * sy, 1122 * sy)]):  # inside the grid, above the footer
        pic = trim(im.crop((int(429 * sx), int(y0), int(796 * sx), int(y1))))
        pic.thumbnail((420, 420), Image.LANCZOS)
        pic.save(out / f"{positions[i * 2 + row]}.webp", "WEBP", quality=84, method=6)
print("wrote", len(list(out.glob('*.webp'))), "pictures")
