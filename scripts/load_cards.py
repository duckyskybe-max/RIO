"""Load data/kanji.json into Supabase `cards` (idempotent upsert).

Needs the project's secret/service-role key (never commit it):
  SUPABASE_URL=https://zvmbkxchzocvnnubjoju.supabase.co \
  SUPABASE_SERVICE_KEY=... python3 scripts/load_cards.py [--levels 10,9,8]
"""
import json, os, sys, urllib.request, pathlib

url, key = os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
levels = None
if "--levels" in sys.argv:
    levels = set(sys.argv[sys.argv.index("--levels") + 1].split(","))
data = json.loads((pathlib.Path(__file__).resolve().parent.parent / "data" / "kanji.json").read_text())

def call(method, path, body=None, prefer=None):
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    req = urllib.request.Request(f"{url}/rest/v1/{path}", method=method, headers=h,
                                 data=json.dumps(body, ensure_ascii=False).encode() if body is not None else None)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or "null")

call("POST", "decks?on_conflict=name", [{"name": "Kanji Kentei 10-1", "topic": "kanji"}],
     "resolution=ignore-duplicates")
deck_id = call("GET", "decks?name=eq.Kanji%20Kentei%2010-1&select=id")[0]["id"]

rows = [{"deck_id": deck_id, "position": c["position"], "level": c["kanken_level"],
         "content": {k: v for k, v in c.items() if k not in ("position", "kanken_level", "level_tag")}}
        for c in data if levels is None or c["kanken_level"] in levels]
for i in range(0, len(rows), 500):
    call("POST", "cards?on_conflict=deck_id,position", rows[i:i+500], "resolution=merge-duplicates")
    print("loaded", min(i + 500, len(rows)), "/", len(rows))
