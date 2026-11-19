"""Composite VEB logo onto a white background and refresh favicons."""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = Path(
    r"C:\Users\MM\.cursor\projects\c-Users-MM-Desktop-Zebl-LMS\assets\image-c20eb8ed-e9db-4573-83f5-bbeba342b9c7.png"
)
if not src.exists():
    src = ROOT / "apps/web/public/brand/logo.png"

logo_out = ROOT / "apps/web/public/brand/logo.png"
fav_png = ROOT / "apps/web/public/favicon.png"
fav_32 = ROOT / "apps/web/public/favicon-32.png"
fav_ico = ROOT / "apps/web/public/favicon.ico"

rgba = Image.open(src).convert("RGBA")
white = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
composited = Image.alpha_composite(white, rgba).convert("RGB")
logo_out.parent.mkdir(parents=True, exist_ok=True)
composited.save(logo_out, "PNG", optimize=True)
print("logo", composited.size, "corner", composited.getpixel((0, 0)))


def make_square(size: int) -> Image.Image:
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    margin = max(2, size // 10)
    avail = size - 2 * margin
    thumb = composited.copy()
    thumb.thumbnail((avail, avail), Image.Resampling.LANCZOS)
    ox = (size - thumb.width) // 2
    oy = (size - thumb.height) // 2
    canvas.paste(thumb, (ox, oy))
    return canvas


make_square(192).save(fav_png, "PNG", optimize=True)
make_square(32).save(fav_32, "PNG", optimize=True)
make_square(32).save(fav_ico, format="ICO", sizes=[(16, 16), (32, 32)])
print("favicons updated")
