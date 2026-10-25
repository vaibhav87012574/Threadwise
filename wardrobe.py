"""Threadwise wardrobe memory: what you own, what you can spend, what you're missing.

SQLite-backed so the closet survives restarts and is shared across chat sessions.
"""
import itertools
import json
import os
import sqlite3
import time
from typing import Optional

DB_PATH = os.environ.get("THREADWISE_DB", os.path.join(os.path.dirname(__file__), "threadwise.db"))

CATEGORIES = ["top", "bottom", "footwear", "outerwear", "accessory", "onepiece"]
OCCASIONS = ["casual", "formal", "ethnic", "sport", "party"]

# Colour logic ---------------------------------------------------------------
NEUTRALS = {"black", "white", "grey", "gray", "beige", "cream", "navy", "denim",
            "tan", "brown", "khaki", "olive", "charcoal", "off-white"}
# Non-neutral pairings that read as intentional (symmetric).
GOOD_PAIRS = {frozenset(p) for p in [
    ("red", "blue"), ("mustard", "maroon"), ("mustard", "navy"), ("teal", "maroon"),
    ("pink", "olive"), ("pink", "grey"), ("green", "brown"), ("blue", "orange"),
    ("purple", "mustard"), ("rust", "teal"), ("maroon", "green"), ("yellow", "blue"),
]}


def colors_match(a: str, b: str) -> bool:
    a, b = a.lower().strip(), b.lower().strip()
    if a == b or a in NEUTRALS or b in NEUTRALS:
        return True
    return frozenset((a, b)) in GOOD_PAIRS


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.executescript("""
    CREATE TABLE IF NOT EXISTS items(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, category TEXT, color TEXT, occasion TEXT,
        brand TEXT, notes TEXT, added_at REAL);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS plans(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, price REAL, category TEXT, color TEXT,
        occasion TEXT, status TEXT DEFAULT 'planned', created_at REAL);
    """)
    return c


# Items ---------------------------------------------------------------------
def add_item(name, category, color, occasion="casual", brand="", notes="") -> dict:
    category, occasion = category.lower(), occasion.lower()
    if category not in CATEGORIES:
        raise ValueError(f"category must be one of {CATEGORIES}")
    if occasion not in OCCASIONS:
        raise ValueError(f"occasion must be one of {OCCASIONS}")
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO items(name,category,color,occasion,brand,notes,added_at) VALUES(?,?,?,?,?,?,?)",
            (name, category, color.lower(), occasion, brand, notes, time.time()))
        return {"id": cur.lastrowid, "name": name, "category": category,
                "color": color.lower(), "occasion": occasion}


def list_items() -> list:
    with _conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM items ORDER BY category, id")]


def remove_item(item_id: int) -> bool:
    with _conn() as c:
        return c.execute("DELETE FROM items WHERE id=?", (item_id,)).rowcount > 0


# Budget ----------------------------------------------------------------------
def set_budget(amount: float, period: str = "month") -> dict:
    with _conn() as c:
        c.execute("REPLACE INTO settings VALUES('budget',?)",
                  (json.dumps({"amount": amount, "period": period, "set_at": time.time()}),))
    return {"amount": amount, "period": period}


def budget_status() -> dict:
    with _conn() as c:
        row = c.execute("SELECT value FROM settings WHERE key='budget'").fetchone()
        if not row:
            return {"budget": None, "spent": 0, "remaining": None}
        b = json.loads(row["value"])
        spent = c.execute(
            "SELECT COALESCE(SUM(price),0) s FROM plans WHERE status IN ('planned','bought')"
        ).fetchone()["s"]
    return {"budget": b["amount"], "period": b["period"], "committed": spent,
            "remaining": b["amount"] - spent}


def add_plan(name, price, category, color, occasion="casual") -> dict:
    st = budget_status()
    if st["remaining"] is not None and price > st["remaining"]:
        return {"ok": False, "reason": f"₹{price:.0f} exceeds remaining budget ₹{st['remaining']:.0f}"}
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO plans(name,price,category,color,occasion,created_at) VALUES(?,?,?,?,?,?)",
            (name, price, category.lower(), color.lower(), occasion.lower(), time.time()))
    return {"ok": True, "plan_id": cur.lastrowid, **budget_status()}


def list_plans() -> list:
    with _conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM plans ORDER BY id DESC")]


def mark_bought(plan_id: int) -> bool:
    """Bought items move into the wardrobe so future outfits include them."""
    with _conn() as c:
        p = c.execute("SELECT * FROM plans WHERE id=?", (plan_id,)).fetchone()
        if not p:
            return False
        c.execute("UPDATE plans SET status='bought' WHERE id=?", (plan_id,))
    add_item(p["name"], p["category"], p["color"], p["occasion"], notes="bought via Threadwise")
    return True


# Outfit engine -----------------------------------------------------------------
def _outfits(items: list) -> list:
    by = lambda cat: [i for i in items if i["category"] == cat]
    out = []
    for t, b, f in itertools.product(by("top"), by("bottom"), by("footwear")):
        if not (t["occasion"] == b["occasion"] == f["occasion"] or
                {t["occasion"], b["occasion"], f["occasion"]} <= {"casual", "party"}):
            continue
        if colors_match(t["color"], b["color"]) and colors_match(b["color"], f["color"]) \
                and colors_match(t["color"], f["color"]):
            out.append({"top": t["name"], "bottom": b["name"], "footwear": f["name"],
                        "occasion": t["occasion"]})
    for o, f in itertools.product(by("onepiece"), by("footwear")):
        if colors_match(o["color"], f["color"]):
            out.append({"onepiece": o["name"], "footwear": f["name"], "occasion": o["occasion"]})
    return out


def outfits(occasion: Optional[str] = None) -> list:
    res = _outfits(list_items())
    return [o for o in res if not occasion or o["occasion"] == occasion.lower()]


def unlock_score(category: str, color: str, occasion: str = "casual") -> dict:
    """How many NEW outfits would one extra piece create? The core 'worth buying?' signal."""
    items = list_items()
    before = len(_outfits(items))
    ghost = {"id": -1, "name": "(candidate)", "category": category.lower(),
             "color": color.lower(), "occasion": occasion.lower()}
    after = len(_outfits(items + [ghost]))
    return {"current_outfits": before, "with_item": after, "new_outfits": after - before}


def gaps() -> dict:
    items = list_items()
    counts = {c: sum(1 for i in items if i["category"] == c) for c in CATEGORIES}
    missing = []
    for occ in OCCASIONS[:3]:  # casual / formal / ethnic are the staples
        occ_items = [i for i in items if i["occasion"] == occ]
        has = {i["category"] for i in occ_items}
        if not occ_items:
            continue
        for need in (["top", "bottom", "footwear"] if "onepiece" not in has else ["footwear"]):
            if need not in has:
                missing.append({"occasion": occ, "category": need})
    ranked = []
    for m in missing:
        # test with a neutral piece – the safest, most versatile fill
        s = unlock_score(m["category"], "black" if m["category"] == "footwear" else "navy", m["occasion"])
        ranked.append({**m, **s})
    ranked.sort(key=lambda r: -r["new_outfits"])
    return {"counts": counts, "total_outfits": len(_outfits(items)), "missing": ranked}
