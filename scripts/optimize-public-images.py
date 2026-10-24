"""Export responsive WebP derivatives of the approved portraits and package artwork.

Requires Pillow with WebP support. Originals remain at their public URLs.
Run only when these source images change; production builds serve the committed exports.
"""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1] / 'public/assets/images/faunapoolen'
sources = [(path, (400, 800)) for path in (root / 'team').glob('*.png')]
sources += [(path, (480, 960, 1448)) for path in (root / 'editorial').glob('package-*.png')]
for source, widths in sources:
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        for width in widths:
            if width > image.width:
                continue
            resized = image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
            target = source.with_name(f'{source.stem}-{width}.webp')
            resized.save(target, 'WEBP', quality=85, method=6)
            print(f'{target.name}: {target.stat().st_size:,} bytes')
