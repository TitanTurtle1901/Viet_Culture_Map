#!/usr/bin/env python3
"""Kiểm tra đường dẫn ảnh: mọi chuỗi 'assets/...' trong data/*.json phải trỏ tới file TỒN TẠI,
khớp CHÍNH XÁC hoa/thường (GitHub Pages/Linux phân biệt hoa/thường, Windows thì không).
Cảnh báo thêm: tên file có ký tự ngoài [A-Za-z0-9._-] và ảnh không được tham chiếu.
Dùng: python tools/check_images.py   (thoát mã 1 nếu có lỗi)"""
import glob, json, os, re, sys, unicodedata

def refs(o, out):
    if isinstance(o, dict):
        for v in o.values(): refs(v, out)
    elif isinstance(o, list):
        for v in o: refs(v, out)
    elif isinstance(o, str) and o.startswith('assets/'):
        out.add(unicodedata.normalize('NFC', o))

used = set()
for f in glob.glob('data/**/*.json', recursive=True):
    refs(json.load(open(f, encoding='utf-8')), used)

def exists_exact(path):  # kiểm tra từng thành phần khớp hoa/thường
    cur = '.'
    for part in path.split('/'):
        names = {unicodedata.normalize('NFC', n) for n in os.listdir(cur)} if os.path.isdir(cur) else set()
        if part not in names: return False
        cur = os.path.join(cur, part)
    return True

missing = sorted(p for p in used if not exists_exact(p))
img_ext = ('.jpg', '.jpeg', '.png', '.webp', '.svg')
files = {unicodedata.normalize('NFC', os.path.join(r, f)).replace(os.sep, '/')
         for r, _, fs in os.walk('assets/images') for f in fs if f.lower().endswith(img_ext)}
unused = sorted(files - used)
badname = sorted(p for p in files if not re.fullmatch(r'[A-Za-z0-9._-]+', os.path.basename(p)))

print(f'Tham chiếu: {len(used)} | thiếu/sai hoa-thường: {len(missing)} | tên file không an toàn: {len(badname)} | ảnh không dùng: {len(unused)}')
for p in missing: print('  THIẾU:', p)
for p in badname: print('  TÊN LẠ:', p)
if '--list-unused' in sys.argv:
    for p in unused: print('  KHÔNG DÙNG:', p)
sys.exit(1 if missing or badname else 0)
