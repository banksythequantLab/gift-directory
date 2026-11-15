# Real product photos for the flat personalized items (ornaments, stocking, cutting board, desk mat, puzzle, candle, can cooler).
# For each catalog variant it asks Printful's mockup generator for two photos: one with a blank white print, one with a solid
# magenta print. The magenta pixels give the print area's place and shape on the photo. Writes:
#   public/stages/<catalog variant>.webp     the blank product photo (800 px)
#   public/stages/<catalog variant>-m.png    the print area's shape, cropped to it (CSS mask)
#   shop-photo-stages.json                   { product id: { catalog variant id: { image, mask, w, h, left, top, pw, ph } } }
# Usage (from worker): python scripts/product-photos.py [product ids...]   The Printful token is read from ~/.gd_printful.
# Tees and hoodies use scripts/product-templates.mjs. Wrap-around items (mugs, glasses, tumbler, bowl) also get "u":
# the part of the print, from 0 (left edge) to 1 (right edge), that shows across the photo's print area.
import io, json, os, sys, time, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORKER = os.path.dirname(HERE)
OUT_DIR = os.path.join(WORKER, "public", "stages")
OUT_JSON = os.path.join(WORKER, "shop-photo-stages.json")
FLAT = {"ornament", "metal", "paw", "stocking", "board", "deskmat", "puzzle", "candle", "cooler"}
# Wrap-around prints: the photo shows only part of the print. A calibration print (red rises left to right, blue falls,
# no green) tells which part: on the photo, red / (red + blue) is how far across the print that pixel is.
CURVED = {"mug", "rocks", "wine", "tumbler", "bowl"}
CAL_URL = "https://gift.directory/stages/_cal.png"
# Clear glass: the blank photo needs a clear print, not white ink (a nearly transparent image; one faint pixel).
GLASS = {"rocks", "wine"}
CLEAR_URL = "https://gift.directory/stages/_clear.png"
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


def mockup(pid, vid, placement, pfw, pfh, color, url=None):
    k = min(1, 3000 / max(pfw, pfh))   # a solid color scales up cleanly; the image host refuses very large sizes
    url = url or f"https://dummyimage.com/{round(pfw * k)}x{round(pfh * k)}/{color}/{color}.png"
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
        if c.get("kind") != "tpl" or c.get("ptype") not in FLAT | CURVED or (want and c["id"] not in want):
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
                blank = mockup(pid, vid, placement, pfile["width"], pfile["height"], "ffffff", CLEAR_URL if c["ptype"] in GLASS else None)
                curved = c["ptype"] in CURVED
                mask = mockup(pid, vid, placement, pfile["width"], pfile["height"], "ff00ff", CAL_URL if curved else None)
                if mask.size != blank.size:
                    mask = mask.resize(blank.size)
                # Magenta where the print shows: strong red and blue, little green.
                m = Image.eval(mask.convert("RGB"), lambda v: v)
                px = m.load(); W, Hh = m.size
                sel = Image.new("L", m.size, 0); sp = sel.load()
                for y in range(Hh):
                    for x in range(W):
                        r_, g_, b_ = px[x, y]
                        if (r_ + b_ > 90 and g_ < 0.35 * max(r_, b_)) if curved else (r_ > 150 and b_ > 150 and g_ < 110 and abs(r_ - b_) < 90):
                            sp[x, y] = 255
                if curved:
                    # Shiny insides (a steel bowl, the far side of a glass) reflect the calibration colors too. Keep only the
                    # largest connected patch (the print facing the camera), plus big patches level with it, since a highlight
                    # can split the print into side-by-side pieces.
                    seen, comps = set(), []
                    for y0 in range(Hh):
                        for x0 in range(W):
                            if sp[x0, y0] and (x0, y0) not in seen:
                                comp, stack = [], [(x0, y0)]; seen.add((x0, y0))
                                while stack:
                                    x, y = stack.pop(); comp.append((x, y))
                                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                                        if 0 <= nx < W and 0 <= ny < Hh and sp[nx, ny] and (nx, ny) not in seen:
                                            seen.add((nx, ny)); stack.append((nx, ny))
                                comps.append(comp)
                    best = max(comps, key=len) if comps else []
                    top, bot = (min(y for _, y in best), max(y for _, y in best)) if best else (0, 0)
                    keep = set()
                    for comp in comps:
                        cy = sum(y for _, y in comp) / len(comp)
                        if comp is best or (len(comp) >= 0.1 * len(best) and top <= cy <= bot):
                            keep.update(comp)
                    for y in range(Hh):
                        for x in range(W):
                            if sp[x, y] and (x, y) not in keep: sp[x, y] = 0
                    # Highlights on glossy curved items wash out the calibration colors in thin stripes; a wrap print
                    # covers each row from its left edge to its right edge, so fill each row across.
                    for y in range(Hh):
                        xs = [x for x in range(W) if sp[x, y]]
                        for x in range(xs[0], xs[-1] + 1) if xs else ():
                            sp[x, y] = 255
                box = sel.getbbox()
                if not box:
                    print(c["id"], vid, "no print area found"); continue
                if c["ptype"] == "bowl":
                    # The steel inside the bowl mirrors the print above the front rim. The print starts where the white
                    # outside wall does: walk down the middle of the blank photo past the darker steel and rim.
                    bl, cx, top = blank.convert("RGB"), (box[0] + box[2]) // 2, box[1]
                    while top < box[3] - 10 and sum(bl.getpixel((cx, top))) / 3 < 225:
                        top += 1
                    for y in range(box[1], top + 4):
                        for x in range(box[0], box[2]):
                            sp[x, y] = 0
                    box = sel.getbbox()
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
                if curved:
                    # The part of the print that shows: median of red / (red + blue) in strips at the left and right edges.
                    def u_at(x0, x1):
                        v = sorted(px[x, y][0] / (px[x, y][0] + px[x, y][2]) for x in range(x0, x1) for y in range(box[1], box[3]) if sp[x, y])
                        return v[len(v) // 2] if v else None
                    edge = max(2, (box[2] - box[0]) // 30)
                    ul, ur = u_at(box[0], box[0] + edge), u_at(box[2] - edge, box[2])
                    if ul is None or ur is None or abs(ur - ul) < 0.05:
                        out[str(c["id"])].pop(str(vid), None)   # keeps the drawn preview
                        print(c["id"], vid, "could not read the visible part of the print", ul, ur, flush=True); continue
                    out[str(c["id"])][str(vid)]["u"] = [round(ul, 4), round(ur, 4)]
                    print(c["id"], vid, "visible part of the print", round(ul, 3), "to", round(ur, 3), flush=True)
                print(c["id"], c["ptype"], vid, sv.get("name", "")[:50], "box", box, f"aspect print {ar_print:.3f} photo {ar_box:.3f}", flush=True)
            except Exception as e:
                print(c["id"], vid, "failed:", str(e)[:300], flush=True)
            with open(OUT_JSON, "w", encoding="utf8") as f:
                json.dump(out, f, indent=1)
    print(sum(len(v) for v in out.values()), "variant photos in", OUT_JSON)


if __name__ == "__main__":
    main()
