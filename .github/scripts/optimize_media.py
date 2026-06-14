#!/usr/bin/env python3
"""Optimize CMS media uploads in place.

The GitHub Action installs Pillow for consistent cross-platform optimization.
On macOS development machines without Pillow, this script falls back to `sips`
so the behavior can still be smoke-tested locally.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

MAX_WIDTH = 2000
QUALITY = 80
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="*", help="Image files or folders to optimize.")
    parser.add_argument("--file-list", help="NUL-delimited file list.")
    parser.add_argument("--max-width", type=int, default=MAX_WIDTH)
    parser.add_argument("--quality", type=int, default=QUALITY)
    return parser.parse_args()


def read_paths(args: argparse.Namespace) -> list[Path]:
    paths: list[Path] = []
    if args.file_list:
        raw = Path(args.file_list).read_bytes()
        paths.extend(Path(item.decode("utf-8")) for item in raw.split(b"\0") if item)
    paths.extend(Path(item) for item in args.paths)

    if not paths:
        paths = [Path("assets/media")]

    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(child for child in path.rglob("*") if child.is_file())
        elif path.is_file():
            files.append(path)

    return sorted(
        {
            file
            for file in files
            if file.suffix.lower() in SUPPORTED_EXTENSIONS
            and "assets/media" in file.as_posix()
        }
    )


def run_with_pillow(files: list[Path], max_width: int, quality: int) -> int:
    from PIL import Image, ImageOps  # type: ignore

    changed = 0
    for path in files:
        before_size = path.stat().st_size
        try:
            with Image.open(path) as image:
                original_format = image.format
                image = ImageOps.exif_transpose(image)
                resized = False
                if image.width > max_width:
                    ratio = max_width / float(image.width)
                    height = max(1, round(image.height * ratio))
                    image = image.resize((max_width, height), Image.Resampling.LANCZOS)
                    resized = True

                suffix = path.suffix.lower()
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                    temp_path = Path(temp_file.name)

                try:
                    if original_format == "JPEG" or suffix in {".jpg", ".jpeg"}:
                        if image.mode not in {"RGB", "L"}:
                            image = image.convert("RGB")
                        image.save(temp_path, "JPEG", quality=quality, optimize=True, progressive=True)
                    elif original_format == "PNG" or suffix == ".png":
                        image.save(temp_path, "PNG", optimize=True, compress_level=9)
                    elif original_format == "WEBP" or suffix == ".webp":
                        image.save(temp_path, "WEBP", quality=quality, method=6)
                    else:
                        temp_path.unlink(missing_ok=True)
                        continue

                    after_size = temp_path.stat().st_size
                    if resized or after_size < before_size:
                        shutil.move(str(temp_path), path)
                        changed += 1
                    else:
                        temp_path.unlink(missing_ok=True)
                except Exception:
                    temp_path.unlink(missing_ok=True)
                    raise
        except Exception as exc:
            print(f"Skipping {path}: {exc}", file=sys.stderr)

    return changed


def sips_dimensions(path: Path) -> tuple[int | None, int | None]:
    result = subprocess.run(
        ["/usr/bin/sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None, None

    width = None
    height = None
    for line in result.stdout.splitlines():
        if "pixelWidth:" in line:
            width = int(line.rsplit(":", 1)[1].strip())
        if "pixelHeight:" in line:
            height = int(line.rsplit(":", 1)[1].strip())
    return width, height


def run_with_sips(files: list[Path], max_width: int, quality: int) -> int:
    if not Path("/usr/bin/sips").exists():
        print("Pillow is not installed and sips is unavailable.", file=sys.stderr)
        return 0

    changed = 0
    for path in files:
        if path.suffix.lower() == ".webp":
            continue

        before_size = path.stat().st_size
        width, _height = sips_dimensions(path)
        resized = bool(width and width > max_width)

        temp_path = path.with_name(f"{path.name}.tmp{path.suffix.lower()}")
        temp_path.unlink(missing_ok=True)
        result = subprocess.run(
            [
                "/usr/bin/sips",
                "-Z",
                str(max_width),
                "-s",
                "formatOptions",
                str(quality),
                str(path),
                "--out",
                str(temp_path),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        if result.returncode != 0 or not temp_path.exists():
            temp_path.unlink(missing_ok=True)
            continue

        after_size = temp_path.stat().st_size
        if resized or after_size < before_size:
            shutil.move(str(temp_path), path)
            changed += 1
        else:
            temp_path.unlink(missing_ok=True)

    return changed


def main() -> int:
    args = parse_args()
    files = read_paths(args)
    if not files:
        print("No media files to optimize.")
        return 0

    try:
        changed = run_with_pillow(files, args.max_width, args.quality)
    except ModuleNotFoundError:
        changed = run_with_sips(files, args.max_width, args.quality)

    print(f"Optimized {changed} of {len(files)} media files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
