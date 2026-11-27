#!/usr/bin/env python3
"""
Seeds the demo catalogue: products, model compatibility and one illustration
per part.

The pictures are drawn by scripts/demo/part-art.py — original mechanical
drawings, not photographs, so nothing here belongs to anyone else. Real photos
replace them through the admin panel one part at a time.

This writes to the LOCAL stack only. It inserts storage rows as the storage
admin role, exactly as the gateway does, and drops the file in the same place
the gateway would.

    python3 -I scripts/demo/seed.py            # add the demo parts
    python3 -I scripts/demo/seed.py --reset    # delete demo parts first
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
STACK_DIR = pathlib.Path(os.environ.get("LOCAL_STACK_DIR", "/opt/localstack"))
BUCKET = "product-images"
DB = "sameer_local"


def psql(sql: str) -> str:
    out = subprocess.run(
        ["su", "postgres", "-c", f"psql -d {DB} -v ON_ERROR_STOP=1 -At -c {shquote(sql)}"],
        capture_output=True,
        text=True,
    )
    if out.returncode != 0:
        sys.stderr.write(out.stderr)
        raise SystemExit(f"psql failed: {out.stderr.strip()[:400]}")
    return out.stdout.strip()


def shquote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


def q(s) -> str:
    """SQL literal."""
    if s is None:
        return "null"
    if isinstance(s, (int, float)):
        return str(s)
    return "'" + str(s).replace("'", "''") + "'"


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:80]


def lookup(table: str) -> dict:
    rows = psql(f"select slug, id from public.{table}")
    return dict(line.split("|") for line in rows.splitlines() if line)


def main() -> int:
    reset = "--reset" in sys.argv
    parts = json.loads((HERE / "parts.json").read_text())
    cats = lookup("product_categories")
    models = lookup("motorcycle_models")

    for p in parts:
        assert p["cat"] in cats, f"unknown category {p['cat']}"
        for m in p["models"]:
            assert m in models, f"unknown model {m}"

    if reset:
        # Only the demo rows: they are the ones carrying a demo part number.
        paths = psql(
            "select i.storage_path from public.product_images i "
            "join public.products p on p.id = i.product_id "
            "where p.part_number ~ '^(ENG|CLT|TRN|BRK|ELC|LGT|BDY|SUS|ACC|OTH)-'"
        ).splitlines()
        for rel in paths:
            f = STACK_DIR / "storage-data" / BUCKET / rel
            if f.is_file():
                f.unlink()
        psql(
            "delete from storage.objects where bucket_id = " + q(BUCKET) + " and name in ("
            "select i.storage_path from public.product_images i join public.products p "
            "on p.id = i.product_id where p.part_number ~ "
            "'^(ENG|CLT|TRN|BRK|ELC|LGT|BDY|SUS|ACC|OTH)-')"
        )
        psql(
            "delete from public.products where part_number ~ "
            "'^(ENG|CLT|TRN|BRK|ELC|LGT|BDY|SUS|ACC|OTH)-'"
        )
        print(f"removed {len(paths)} demo images and their products")

    # A realistic spread: mostly in stock, a few to confirm, the odd one out.
    AVAILABILITY = ["available"] * 8 + ["contact_to_confirm", "out_of_stock"]

    made = 0
    for index, p in enumerate(parts):
        pid = str(uuid.uuid4())
        slug = slugify(p["name"])
        both = p["type"] == "both"
        seo_title = p["name"][:70]
        seo_desc = (f"{p['name']} — genuine Royal Enfield spare part at S Ameer Ali Bullet Spare Parts, Chennai.")[:170]

        psql(
            "insert into public.products (id, name, slug, part_number, description, category_id, "
            "availability, status, is_featured, seo_title, seo_description, published_at, "
            "mrp, offer_price, part_type, vendor_mrp, vendor_offer_price) values ("
            + ", ".join(
                [
                    q(pid),
                    q(p["name"]),
                    q(slug),
                    q(p["part"]),
                    q(p["desc"]),
                    q(cats[p["cat"]]),
                    q(AVAILABILITY[index % len(AVAILABILITY)]),
                    "'published'",
                    "true" if index % 11 == 0 else "false",
                    q(seo_title),
                    q(seo_desc),
                    "now()",
                    q(p["mrp"]),
                    q(p["offer"]),
                    q(p["type"]),
                    q(p["vmrp"]) if both else "null",
                    q(p["voffer"]) if both else "null",
                ]
            )
            + ")"
        )

        for m in p["models"]:
            psql(
                "insert into public.product_model_compatibility (product_id, model_id) values ("
                + q(pid) + ", " + q(models[m]) + ")"
            )

        # One illustration per part, in the same folder shape the uploader uses.
        name = f"{uuid.uuid4()}.webp"
        rel = f"products/{pid}/{name}"
        dest = STACK_DIR / "storage-data" / BUCKET / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [sys.executable, "-I", str(HERE / "part-art.py"), p["cat"], p["name"], str(dest)],
            check=True,
        )
        size = dest.stat().st_size

        psql(
            "insert into storage.objects (bucket_id, name, metadata) values ("
            + q(BUCKET) + ", " + q(rel) + ", "
            + q(json.dumps({"mimetype": "image/webp", "size": size})) + "::jsonb)"
        )
        psql(
            "insert into public.product_images (product_id, storage_path, alt_text, width, height, "
            "sort_order, is_primary, storage_provider, file_size, mime_type) values ("
            + ", ".join(
                [
                    q(pid),
                    q(rel),
                    q(f"Illustration of {p['name']}"),
                    "1200",
                    "900",
                    "10",
                    "true",
                    "'supabase'",
                    str(size),
                    "'image/webp'",
                ]
            )
            + ")"
        )
        made += 1

    print(f"seeded {made} demo parts with illustrations")
    print(psql("select part_type, count(*) from public.products group by 1 order by 1"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
