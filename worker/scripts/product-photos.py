# Real product photos for the flat personalized items (ornaments, stocking, cutting board, desk mat, puzzle, candle, can cooler).
# For each catalog variant it asks Printful's mockup generator for two photos: one with a blank white print, one with a solid
# magenta print. The magenta pixels give the print area's place and shape on the photo. Writes:
#   public/stages/<catalog variant>.webp     the blank product photo (800 px)
#   public/stages/<catalog variant>-m.png    the print area's shape, cropped to it (CSS mask)
#   shop-photo-stages.json                   { product id: { catalog variant id: { image, mask, w, h, left, top, pw, ph } } }
# Usage (from worker): python scripts/product-photos.py [product ids...]   The Printful token is read from ~/.gd_printful.
# Tees and hoodies use scripts/product-templates.mjs; mugs and wrap-around glasses keep the drawn preview.
import io, json, os, sys, time, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORKER = os.path.dirname(HERE)
OUT_DIR = os.path.join(WORKER, "public", "stages")
OUT_JSON = os.path.join(WORKER, "shop-photo-stages.json")
FLAT = {"ornament", "metal", "paw", "stocking", "board", "deskmat", "puzzle", "candle", "cooler"}
SIZE = 800

with open(os.path.expanduser("~/.gd_printful"), encoding="utf8") as f:
    TOKEN = f.read().strip().split("=", 1)[-1]
H = {"Authorization": f"Bearer {TOKEN}", "X-PF-Store-Id": "19038070", "content-type": "application/json", "user-agent": "gift.directory-tools"}


def pf(path, body=None):
    for _ in range(6):
        req = urllib.request.Request("https://api.printful.com" + path, headers=H, method="POST" if body else "GET",
                                     data=json.dumps(body).encode() if body else None)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)["result"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(62); continue
            raise RuntimeError(f"{path} {e.code} {e.read()[:300]!r}")
    raise RuntimeError(path + " still rate-limited")


def get_img(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "gift.directory-tools"}), timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGBA")


def mockup(pid, vid, placement, pfw, pfh, color):
    k = min(1, 3000 / max(pfw, pfh))   # a solid color scales up cleanly; the image host refuses very large sizes
    url = f"https://dummyimage.com/{round(pfw * k)}x{round(pfh * k)}/{color}/{color}.png"
    t = pf(f"/mockup-generator/create-task/{pid}", {"variant_ids": [vid], "format": "png", "files": [{"placement": placement, "image_url": url,
           "position": {"area_width": pfw, "area_height": pfh, "width": pfw, "height": pfh, "top": 0, "left": 0}}]})
    for _ in range(40):
        time.sleep(4)
        r = pf(f"/mockup-generator/task?task_key={t['task_key']}")
        if r["status"] != "pending":
            break
    if r["status"] != "completed":
        raise RuntimeError(f"mockup {pid}/{vid} {r['status']} {r.get('error')}")
    m = next((m for m in r["mockups"] if m.get("placement") == placement), r["mockups"][0])
    return get_img(m["mockup_url"])


def main():
    want = {int(a) for a in sys.argv[1:]}
    with urllib.request.urlopen(urllib.request.Request("https://gift.directory/api/shop/products", headers={"user-agent": "gift.directory-tools"}), timeout=60) as r:
        cards = json.load(r)["products"]
    os.makedirs(OUT_DIR, exist_ok=True)
    out = json.load(open(OUT_JSON, encoding="utf8")) if os.path.exists(OUT_JSON) else {}
    printfiles = {}
    for c in cards:
        if c.get("kind") != "tpl" or c.get("ptype") not in FLAT or (want and c["id"] not in want):
            continue
        d = pf(f"/store/products/{c['id']}")
        for sv in d["sync_variants"]:
            if sv.get("is_ignored"):
                continue
            vid, pid = sv["variant_id"], sv["product"]["product_id"]
            try:
                if pid not in printfiles:
                    printfiles[pid] = pf(f"/mockup-generator/printfiles/{pid}")
                pr = printfiles[pid]
                vp = next((x for x in pr["variant_printfiles"] if x["variant_id"] == vid), pr["variant_printfiles"][0])
                placement = next(iter(vp["placements"]))
                pfile = next(f for f in pr["printfiles"] if f["printfile_id"] == vp["placements"][placement])
                blank = mockup(pid, vid, placement, pfile["width"], pfile["height"], "ffffff")
                mask = mockup(pid, vid, placement, pfile["width"], pfile["height"], "ff00ff")
                if mask.size != blank.size:
                    mask = mask.resize(blank.size)
                # Magenta where the print shows: strong red and blue, little green.
                m = Image.eval(mask.convert("RGB"), lambda v: v)
                px = m.load(); W, Hh = m.size
                sel = Image.new("L", m.size, 0); sp = sel.load()
                for y in range(Hh):
                    for x in range(W):
                        r_, g_, b_ = px[x, y]
                        if r_ > 150 and b_ > 150 and g_ < 110 and abs(r_ - b_) < 90:
                            sp[x, y] = 255
                box = sel.getbbox()
                if not box:
                    print(c["id"], vid, "no print area found"); continue
                k = SIZE / max(W, Hh)
                small = blank.resize((round(W * k), round(Hh * k)), Image.LANCZOS)
                small.save(os.path.join(OUT_DIR, f"{vid}.webp"), "WEBP", quality=84, method=6)
                shape = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (255, 255, 255, 0))
                shape.putalpha(sel.crop(box))
                shape.thumbnail((SIZE, SIZE), Image.LANCZOS)
                shape.save(os.path.join(OUT_DIR, f"{vid}-m.png"), optimize=True)
                ar_print, ar_box = pfile["width"] / pfile["height"], (box[2] - box[0]) / (box[3] - box[1])
                out.setdefault(str(c["id"]), {})[str(vid)] = {"image": f"/stages/{vid}.webp", "mask": f"/stages/{vid}-m.png",
                    "w": W, "h": Hh, "left": box[0], "top": box[1], "pw": box[2] - box[0], "ph": box[3] - box[1], "under": True}
                print(c["id"], c["ptype"], vid, sv.get("name", "")[:50], "box", box, f"aspect print {ar_print:.3f} photo {ar_box:.3f}", flush=True)
            except Exception as e:
                print(c["id"], vid, "failed:", str(e)[:300], flush=True)
            with open(OUT_JSON, "w", encoding="utf8") as f:
                json.dump(out, f, indent=1)
    print(sum(len(v) for v in out.values()), "variant photos in", OUT_JSON)


if __name__ == "__main__":
    main()
