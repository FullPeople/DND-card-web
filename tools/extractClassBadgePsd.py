"""Export named, user-authored PSD layers as padded character-card badges.

Requires psd-tools 1.24.0 and Pillow. The PSD remains outside the repository.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image
from psd_tools import PSDImage

LAYERS = {
    "野蛮人": "barbarian",
    "吟游诗人": "bard",
    "牧师": "cleric",
    "德鲁伊": "druid",
    "战士": "fighter",
    "游侠": "ranger",
    "游荡者": "rogue",
    "圣骑士": "paladin",
    "术士": "sorcerer",
    "魔契师": "warlock",
    "奇械师": "artificer",
}
SIZE = 512
PADDING = 52


def export(source: Path, destination: Path, receipt: Path):
    psd = PSDImage.open(source)
    destination.mkdir(parents=True, exist_ok=True)
    rows = []
    seen = set()
    for layer in psd:
        name = layer.name.rstrip("\0").strip()
        badge = LAYERS.get(name)
        if not badge:
            continue
        if badge in seen:
            raise ValueError(f"Duplicate badge layer: {name}")
        seen.add(badge)
        image = layer.composite().convert("RGBA")
        bounds = image.getchannel("A").getbbox()
        if not bounds:
            raise ValueError(f"Empty badge layer: {name}")
        image = image.crop(bounds)
        scale = (SIZE - 2 * PADDING) / max(image.size)
        dimensions = tuple(max(1, round(value * scale)) for value in image.size)
        image = image.resize(dimensions, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE))
        offset = tuple((SIZE - value) // 2 for value in dimensions)
        canvas.alpha_composite(image, offset)
        output = destination / f"{badge}.png"
        canvas.save(output, optimize=True)
        output_bounds = canvas.getchannel("A").getbbox()
        assert output_bounds and all(
            margin >= PADDING
            for margin in (
                output_bounds[0], output_bounds[1],
                SIZE - output_bounds[2], SIZE - output_bounds[3],
            )
        )
        rows.append({
            "layer": name, "badge": badge, "layerBounds": layer.bbox,
            "size": canvas.size, "alphaBounds": output_bounds,
            "bytes": output.stat().st_size,
            "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        })
    if seen != set(LAYERS.values()):
        raise ValueError(f"Missing named layers: {sorted(set(LAYERS.values()) - seen)}")
    receipt.parent.mkdir(parents=True, exist_ok=True)
    receipt.write_text(json.dumps({
        "source": source.name, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "canvas": psd.size, "format": "transparent RGBA PNG",
        "outputSize": SIZE, "minimumPadding": PADDING,
        "exported": rows,
        "retained": ["monk", "wizard", "mystic", "expert-sidekick", "spellcaster-sidekick", "warrior-sidekick"],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(rows)} badges, {sum(row['bytes'] for row in rows):,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("receipt", type=Path)
    options = parser.parse_args()
    export(options.source, options.destination, options.receipt)
