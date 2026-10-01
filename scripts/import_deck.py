"""Convert the Anki .apkg.bz2 into data/kanji.json (cleaned, one object per kanji).

Usage: python3 scripts/import_deck.py 101Kanji_Kentei_level_10-1.apkg.bz2
"""
import bz2, json, re, sqlite3, sys, tempfile, zipfile, html, pathlib

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parent.parent / "data" / "kanji.json"

def clean(s):
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s).replace("\xa0", " ").strip()

with tempfile.TemporaryDirectory() as tmp:
    apkg = pathlib.Path(tmp) / "deck.apkg"
    apkg.write_bytes(bz2.decompress(src.read_bytes()))
    with zipfile.ZipFile(apkg) as z:
        z.extract("collection.anki21", tmp)
    db = sqlite3.connect(pathlib.Path(tmp) / "collection.anki21")
    rows = db.execute("select flds, tags from notes order by id").fetchall()

cards = []
for flds, tags in rows:
    f = flds.split("\x1f")
    level = re.search(r"level_(\d+(?:_5)?)", tags)
    cards.append({
        "position": int(f[0]),
        "kanji": f[1],
        "on_yomi": clean(f[3]),
        "kun_yomi": clean(f[4]),
        "stroke_count": int(f[5]) if f[5].isdigit() else None,
        "radical": f[6],
        "meaning_ja": clean(f[7]),
        "kanken_level": f[8],
        "words": clean(f[9]),
        "level_tag": level.group(1) if level else None,
    })

out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(cards, ensure_ascii=False, indent=0))
print(len(cards), "cards ->", out, out.stat().st_size // 1024, "KB")
