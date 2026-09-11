#!/usr/bin/env python3
"""
LaundryOps PWA 아이콘 생성
원본 한 장에서 아이콘 6종을 만든다 — icon-192 / icon-512 /
icon-maskable-512 / apple-touch-icon / favicon-32 / favicon.ico.

경로는 이 파일 위치를 기준으로 풀리므로 어느 위치에서 실행해도 된다.
원본을 바꿀 때는 assets/logo-src.jpeg 를 갈아끼우고 다시 실행한다.

배경 처리 규칙 (iOS/안드로이드 실동작 기준):
- icon-192 / icon-512 : 투명 배경. 안드로이드가 알아서 배치한다.
- apple-touch-icon    : iOS는 투명을 검게 채운다 → 흰색으로 채우고 RGB 저장.
                        iOS가 모서리를 스스로 깎으므로 미리 깎지 않는다.
- icon-maskable-512   : 안드로이드 원형 마스크 대비. 로고를 80% 안전 영역에
                        넣고 나머지를 흰색으로 채운다. 안 그러면 테두리가 잘린다.
"""
from PIL import Image, ImageDraw
import os

# repo 루트 — 이 파일이 있는 곳이다. 실행 위치와 무관하게 고정된다.
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'assets', 'logo-src.jpeg')
OUT = ROOT                # 아이콘은 루트에 바로 놓는다(Vercel 이 루트를 서빙한다)
BG = (255, 255, 255)      # 배경색 (apple-touch / maskable)
TOL = 26                  # 배경 제거 허용 오차

os.makedirs(OUT, exist_ok=True)


def strip_background(im):
    """모서리에서 flood fill로 배경만 투명하게. 로고 내부 밝은 영역은 보존."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    seed = px[0, 0][:3]

    visited = bytearray(w * h)
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if visited[i]:
            continue
        r, g, b, a = px[x, y]
        if abs(r - seed[0]) > TOL or abs(g - seed[1]) > TOL or abs(b - seed[2]) > TOL:
            continue
        visited[i] = 1
        px[x, y] = (r, g, b, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def feather_edge(im):
    """JPEG 압축 잡티 정리 — 반투명 가장자리를 약간 다듬는다."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # 배경색에 아주 가까운 불투명 픽셀은 부분 투명 처리
            d = max(abs(r - 241), abs(g - 241), abs(b - 243))
            if d < 8:
                px[x, y] = (r, g, b, 0)
    return im


def fill_disc(im):
    """로고 테두리에 끊긴 곳이 있어 flood fill이 원 안쪽까지 샌다.
    원본 로고의 안쪽은 흰 면이므로, 로고 외접원 안을 흰색으로 깔아준다.
    바깥은 투명 유지."""
    w, h = im.size
    alpha = im.split()[3]
    bbox = alpha.getbbox()          # 불투명 픽셀의 외곽
    cx = (bbox[0] + bbox[2]) / 2
    cy = (bbox[1] + bbox[3]) / 2
    r = max(bbox[2] - bbox[0], bbox[3] - bbox[1]) / 2

    disc = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(disc)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BG + (255,))
    return Image.alpha_composite(disc, im)


def square(im):
    """정사각 캔버스 중앙 정렬."""
    w, h = im.size
    s = max(w, h)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    canvas.paste(im, ((s - w) // 2, (s - h) // 2), im)
    return canvas


def save_transparent(base, size, name):
    img = base.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(OUT, name), 'PNG')
    return name


def save_on_bg(base, size, name, scale=1.0, bg=BG):
    """불투명 배경 위에 얹는다. scale<1이면 안전 영역 축소."""
    canvas = Image.new('RGB', (size, size), bg)
    inner = int(size * scale)
    img = base.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    canvas.paste(img, (off, off), img)
    canvas.save(os.path.join(OUT, name), 'PNG')
    return name


src = Image.open(SRC)
base = square(fill_disc(feather_edge(strip_background(src))))
print(f'원본 {src.size} → 정사각 {base.size}')

made = []
made.append(save_transparent(base, 192, 'icon-192.png'))
made.append(save_transparent(base, 512, 'icon-512.png'))
made.append(save_on_bg(base, 180, 'apple-touch-icon.png'))
made.append(save_on_bg(base, 512, 'icon-maskable-512.png', scale=0.78))
made.append(save_transparent(base, 32, 'favicon-32.png'))

# favicon.ico (16/32/48 멀티)
ico = base.resize((48, 48), Image.LANCZOS)
ico.save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
made.append('favicon.ico')

for m in made:
    p = os.path.join(OUT, m)
    print(f'  {m:26s} {os.path.getsize(p):>7,} bytes')
