#!/usr/bin/env python3
"""Nén và đổi cỡ ảnh trong assets/images (giữ nguyên tên file, định dạng và đường dẫn).

Dùng: pip install pillow && python tools/optimize_images.py [--max 1600] [--quality 80] [--dry-run]
- Ảnh có cạnh dài > --max sẽ được thu nhỏ; ảnh chỉ bị ghi đè khi file mới nhỏ hơn.
- Chạy lại nhiều lần an toàn (ảnh đã nhỏ sẽ được bỏ qua).
"""
import argparse, os, sys
from PIL import Image, ImageOps

ap = argparse.ArgumentParser()
ap.add_argument('--root', default='assets/images')
ap.add_argument('--max', type=int, default=1600, help='cạnh dài tối đa (px)')
ap.add_argument('--quality', type=int, default=80)
ap.add_argument('--min-kb', type=int, default=150, help='chỉ xử lý file lớn hơn mức này (KB)')
ap.add_argument('--dry-run', action='store_true')
a = ap.parse_args()

before = after = changed = 0
for r, _, fs in os.walk(a.root):
    for f in fs:
        ext = f.lower().rsplit('.', 1)[-1]
        if ext not in ('jpg', 'jpeg', 'png', 'webp'):
            continue
        p = os.path.join(r, f)
        size = os.path.getsize(p)
        before += size
        if size < a.min_kb * 1024:
            after += size
            continue
        try:
            im = Image.open(p)
            im = ImageOps.exif_transpose(im)
            im.thumbnail((a.max, a.max), Image.LANCZOS)
            tmp = p + '.tmp'
            if ext in ('jpg', 'jpeg'):
                im.convert('RGB').save(tmp, 'JPEG', quality=a.quality, optimize=True, progressive=True)
            elif ext == 'webp':
                im.save(tmp, 'WEBP', quality=a.quality, method=6)
            else:
                im.save(tmp, 'PNG', optimize=True)
            new = os.path.getsize(tmp)
            if new < size and not a.dry_run:
                os.replace(tmp, p); after += new; changed += 1
            else:
                os.remove(tmp); after += size
        except Exception as e:
            print('Bỏ qua', p, e, file=sys.stderr); after += size
print(f'Đã nén {changed} ảnh: {before/1e6:.1f} MB -> {after/1e6:.1f} MB')
