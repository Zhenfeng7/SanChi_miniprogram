"""Draw the four original tab icons in one consistent palette.

Run with: python3 scripts/generate_tab_icons.py
Requires Pillow only when regenerating the PNG assets.
"""

from pathlib import Path

from PIL import Image, ImageDraw


OUT = Path(__file__).resolve().parents[1] / "miniprogram/images/icons"
SCALE = 4
SIZE = 96
COLORS = {False: "#928b83", True: "#735d45"}


def draw_icon(kind, active):
    image = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
    pen = ImageDraw.Draw(image)
    color = COLORS[active]

    def point(xy):
        return tuple(round(v * SCALE) for v in xy)

    def line(points, width=5):
        pen.line([point(p) for p in points], fill=color, width=width * SCALE, joint="curve")

    def ellipse(box, width=5, fill=None):
        pen.ellipse(point(box), outline=color, width=width * SCALE, fill=fill)

    if kind == "home":
        line([(15, 45), (48, 17), (81, 45)])
        line([(24, 39), (24, 78), (72, 78), (72, 39)])
        pen.rounded_rectangle(point((40, 57, 56, 78)), radius=2 * SCALE, outline=color, width=4 * SCALE, fill=color if active else None)
    elif kind == "business":
        pen.rounded_rectangle(point((20, 25, 76, 78)), radius=6 * SCALE, outline=color, width=5 * SCALE)
        line([(20, 43), (76, 43)], 4)
        line([(34, 18), (34, 32)], 5)
        line([(62, 18), (62, 32)], 5)
        for x in (34, 48, 62):
            for y in (56, 68):
                ellipse((x - 2, y - 2, x + 2, y + 2), width=1, fill=color)
    elif kind == "goods":
        pen.rounded_rectangle(point((23, 35, 73, 79)), radius=5 * SCALE, outline=color, width=5 * SCALE)
        line([(34, 35), (34, 29)], 5)
        line([(62, 35), (62, 29)], 5)
        pen.arc(point((34, 16, 62, 45)), 180, 360, fill=color, width=5 * SCALE)
        if active:
            line([(39, 57), (48, 66), (58, 54)], 4)
    elif kind == "usercenter":
        ellipse((36, 16, 60, 42), width=5)
        pen.arc(point((19, 42, 77, 101)), 185, 355, fill=color, width=5 * SCALE)
        line([(24, 77), (72, 77)], 5)
    else:
        raise ValueError(kind)

    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


for name in ("home", "business", "goods", "usercenter"):
    for selected in (False, True):
        suffix = "-active" if selected else ""
        draw_icon(name, selected).save(OUT / f"{name}{suffix}.png")
