#!/usr/bin/env python3
"""Build the public album at the repository root from favorite photos."""

from __future__ import annotations

import json
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT


def load_manifest() -> dict:
    text = (ROOT / "photo-review/data.js").read_text(encoding="utf-8")
    return json.loads(text.split("window.PHOTO_REVIEW_DATA = ", 1)[1].rstrip(";\n"))


def title_parts(group: dict) -> tuple[str, str]:
    parts = [part.strip() for part in group.get("title", "").split("·")]
    place = parts[1] if len(parts) > 1 else group["place"]
    if place in {"地点待确认", "不知道诶"}:
        place = "日常"
    title = " · ".join(parts[2:]).strip() if len(parts) > 2 else ""
    return place, title or "那天的我们"


def main() -> None:
    selection = json.loads((ROOT / "content/selection.json").read_text(encoding="utf-8-sig"))
    manifest = load_manifest()
    if selection.get("schemaVersion") != 1 or selection.get("datasetId") != manifest["id"]:
        raise ValueError("The review export does not match the source album")
    source_by_id = {p["id"]: p for p in manifest["photos"]}
    selected_ids = {p["id"] for p in selection["photos"] if p["status"] == "favorite"}
    if not selected_ids or not selected_ids.issubset(source_by_id):
        raise ValueError("No favorites, or favorite IDs missing from source album")
    for folder in ("thumbs", "photos"):
        (SITE / "assets" / folder).mkdir(parents=True, exist_ok=True)

    events = []
    for group in selection["groups"]:
        ids = [pid for pid in group["photoIds"] if pid in selected_ids]
        if not ids:
            continue
        place, title = title_parts(group)
        event = {
            "id": group["id"], "date": group["date"], "place": place,
            "title": title, "fullTitle": group.get("title", ""),
            "kind": "letter" if not group["date"] and "信" in title else "memory",
            "photos": [],
        }
        for pid in ids:
            photo = source_by_id[pid]
            with Image.open(ROOT / "photo-review" / photo["preview"]) as image:
                width, height = image.size
            # Only public fields and favorite assets enter the publishable directory.
            public = {
                "id": pid, "type": photo["type"], "time": photo["time"],
                "width": width, "height": height,
                "thumbnail": f"assets/thumbs/{pid}.webp",
                "preview": f"assets/photos/{pid}.webp",
            }
            for field in ("thumbnail", "preview"):
                destination = SITE / public[field]
                origin = ROOT / "photo-review" / photo[field]
                if not destination.exists() or origin.stat().st_size != destination.stat().st_size:
                    shutil.copyfile(origin, destination)
            event["photos"].append(public)
        events.append(event)

    added_id = "p-we-first-met"
    with Image.open(ROOT / "content/我们相识啦.png") as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        preview = image.copy()
        preview.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        preview.save(SITE / f"assets/photos/{added_id}.webp", "WEBP", quality=88, method=4)
        # The thumbnail frames the friendship card; the lightbox shows the full screenshot.
        thumb = image.crop((70, 395, 795, 1332))
        thumb.thumbnail((600, 600), Image.Resampling.LANCZOS)
        thumb.save(SITE / f"assets/thumbs/{added_id}.webp", "WEBP", quality=88, method=4)
    events.append({
        "id": "g-we-first-met", "date": "2025-10-30", "place": "故事的开始",
        "title": "我们相识啦", "fullTitle": "2025-10-30 · 我们相识啦",
        "kind": "milestone", "photos": [{
            "id": added_id, "type": "截屏", "time": "", "width": preview.width,
            "height": preview.height, "thumbnail": f"assets/thumbs/{added_id}.webp",
            "preview": f"assets/photos/{added_id}.webp",
        }],
    })
    events.sort(key=lambda event: (event["date"] or "9999", event["id"]))
    expected_ids = selected_ids | {added_id}
    actual_ids = {p["id"] for event in events for p in event["photos"]}
    if expected_ids != actual_ids:
        raise ValueError("Favorite-only validation failed")
    for folder in ("thumbs", "photos"):
        assets = {p.stem for p in (SITE / "assets" / folder).glob("*.webp")}
        if assets != expected_ids:
            raise ValueError(f"Unexpected or missing public assets in {folder}: {assets ^ expected_ids}")
    dataset = {
        "title": "我们的日常", "metDate": "2025-10-30", "togetherDate": "2026-06-23",
        "favoriteCount": len(selected_ids), "addedCount": 1,
        "photoCount": len(actual_ids), "eventCount": len(events),
        "coverId": "p-d4804c89d9a3beb9",
        "heroIds": ["p-d4804c89d9a3beb9", "p-a7250e0970d71809"],
        "events": events,
    }
    if not set(dataset["heroIds"]).issubset(actual_ids):
        raise ValueError("Hero images must be favorites")
    (SITE / "data.js").write_text(
        "// Generated by scripts/build_site.py. Only favorites and the added memory are included.\n"
        "window.OUR_STORY = " + json.dumps(dataset, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    size = sum(p.stat().st_size for p in (SITE / "assets").rglob("*.webp"))
    print(json.dumps({"favorites": len(selected_ids), "added": 1, "total": len(actual_ids),
                      "events": len(events), "assetsMiB": round(size / 1024**2, 2),
                      "types": dict(Counter(p["type"] for e in events for p in e["photos"]))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
