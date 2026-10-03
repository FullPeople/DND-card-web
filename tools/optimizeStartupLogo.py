"""Rebuild lossless delivery assets without changing approved original PNGs.
Developer-only: python tools/optimizeStartupLogo.py (requires Pillow).
Browser regression also compares decoded pixels in Chromium.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parent.parent
assets = []
for layer in range(1, 5):
    original = root / f"public/startup-logo/{layer}.PNG"
    delivery = original.with_name(f"{layer}.optimized.png")
    pixels = Image.open(original).convert("RGBA")
    pixels.save(delivery, optimize=True, compress_level=9)
    assert Image.open(delivery).convert("RGBA").tobytes() == pixels.tobytes()
    assets.append({
        "layer": layer, "original": str(original.relative_to(root)),
        "delivery": str(delivery.relative_to(root)), "size": list(pixels.size),
        "pngBytes": original.stat().st_size, "deliveryBytes": delivery.stat().st_size,
        "pngSha256": hashlib.sha256(original.read_bytes()).hexdigest(),
        "deliverySha256": hashlib.sha256(delivery.read_bytes()).hexdigest(),
        "decodedRgbaSha256": hashlib.sha256(pixels.tobytes()).hexdigest(), "rgbaExact": True,
    })
manifest = {"codec": "PNG lossless RGBA, Pillow optimize=True compress_level=9", "assets": assets,
            "pngBytes": sum(a["pngBytes"] for a in assets), "deliveryBytes": sum(a["deliveryBytes"] for a in assets)}
(root / "docs/STARTUP-LOSSLESS-ASSETS.json").write_text(json.dumps(manifest, indent=2) + "\n")
