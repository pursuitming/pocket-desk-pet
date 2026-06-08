# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pillow>=10.0",
# ]
# ///
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def resize_to_grid(image: Image.Image, columns: int, rows: int, frame_width: int, frame_height: int) -> Image.Image:
    target_size = (columns * frame_width, rows * frame_height)
    if image.size == target_size:
        return image
    return image.resize(target_size, Image.Resampling.LANCZOS)


def is_green_screen(r: int, g: int, b: int, threshold: int) -> bool:
    return g >= threshold and g - max(r, b) >= 70


def remove_green_screen(
    path: Path,
    output: Path,
    threshold: int,
    columns: int,
    rows: int,
    frame_width: int,
    frame_height: int,
) -> None:
    image = Image.open(path).convert("RGBA")
    image = resize_to_grid(image, columns, rows, frame_width, frame_height)
    pixels = image.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a and is_green_screen(r, g, b, threshold):
                pixels[x, y] = (r, g, b, 0)

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="WEBP", lossless=True, method=6)


def main() -> int:
    parser = argparse.ArgumentParser(description="Remove #00FF00 chroma-key background from a spritesheet.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--threshold", type=int, default=140)
    parser.add_argument("--columns", type=int, default=6)
    parser.add_argument("--rows", type=int, default=9)
    parser.add_argument("--frame-width", type=int, default=170)
    parser.add_argument("--frame-height", type=int, default=170)
    args = parser.parse_args()

    remove_green_screen(
        args.input,
        args.output,
        args.threshold,
        args.columns,
        args.rows,
        args.frame_width,
        args.frame_height,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
