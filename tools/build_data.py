#!/usr/bin/env python3
"""
Tách bộ dữ liệu hợp nhất (viet-culture-map-34-provinces.json) thành cấu trúc thư mục của dự án:

  data/provinces/index.json        danh sách 34 đơn vị + summary (dùng cho Hover, Khám phá, tìm kiếm)
  data/provinces/<id>.json         hồ sơ đầy đủ từng tỉnh/thành (summary + detail + metadata)
  data/sources.json                354 nguồn tham khảo
  data/taxonomy.json               phân loại do bộ dữ liệu quy định
  data/image-manifest.json         sao chép nguyên imageManifest của bundle (xem ghi chú bên dưới)

NGUỒN DỮ LIỆU
  * Nội dung (văn hóa, hành chính, nguồn tham khảo) lấy từ BUNDLE đầu vào. Bundle KHÔNG nằm trong repo
    (do Hoang Nhat cung cấp) và có thể mang trạng thái kiểm duyệt cũ.
  * Kết quả kiểm duyệt lấy từ dữ liệu HIỆN TẠI trong <root>/data/provinces/<id>.json (ghép theo province id).

BẢO TOÀN TRẠNG THÁI KIỂM DUYỆT (khi build lại)
  * metadata.researchStatus / lastVerified / notes (cả detail.metadata nếu có): giữ giá trị hiện tại.
    Ngoại lệ duy nhất: bundle có lastVerified MỚI HƠN hồ sơ hiện tại -> dùng bundle (và cảnh báo nếu bị hạ trạng thái).
  * Ảnh: permissionStatus = verified chỉ được giữ khi cùng vị trí (slot) và `file` trùng khớp CHÍNH XÁC với ảnh
    đã verified trong hồ sơ hiện tại. Ảnh mới/đổi đường dẫn/không còn file thì lấy trạng thái của bundle (không bao giờ tự nâng lên verified).
    Ảnh được giữ verified cũng giữ `alt` hiện tại (PRESERVE_ALT) để không quay lại các ghi chú quy trình đã dọn.
  * Thuộc tính `sourceId` của đối tượng ảnh bị loại bỏ (quyết định của dự án, tháng 11/2026).
  * Nếu build làm một trạng thái verified bị hạ xuống needs_review/unverified, script DỪNG và KHÔNG ghi gì cả,
    trừ khi có --force. Mọi phần ghi chỉ diễn ra sau khi mọi kiểm tra đã qua.

image-manifest.json: chỉ có cấu trúc {"images": []} do bundle cung cấp; schema của từng phần tử chưa được quy định
  trong dự án và hiện KHÔNG có module nào đọc file này (js/*.js, tools/check_images.py đều không dùng). Script chỉ
  sao chép nguyên từ bundle, không tự tạo cấu trúc mới.

Script KHÔNG sửa nội dung văn hóa/lịch sử. Chỉ bổ sung 2 trường dẫn xuất (đánh dấu rõ):
  * formerUnits: danh sách đơn vị tiền thân (theo Nghị quyết 202/2025/QH15 – bảng ở FORMER_UNITS bên dưới).
  * originUnitIds: ở từng địa điểm/đặc sản/lễ hội/nghệ thuật…, suy ra TỰ ĐỘNG từ chuỗi originArea
    (khớp tên không dấu). Mục không khớp đơn vị nào → [] (giao diện xếp vào "Chung / chưa phân định").
Trường dẫn xuất được ghi nhận ở metadata.derivedFields của từng tỉnh.

Cách dùng:
  python tools/build_data.py <bundle.json> .              # build; dừng nếu làm mất trạng thái verified
  python tools/build_data.py <bundle.json> . --dry-run    # chỉ báo cáo, không ghi file
  python tools/build_data.py <bundle.json> . --force      # cho phép hạ trạng thái (chỉ khi chắc chắn)
  python tools/build_data.py --check .                    # kiểm tra tính nhất quán dữ liệu hiện có (không cần bundle)
"""
import argparse
import json
import os
import re
import sys
import unicodedata

_ap = argparse.ArgumentParser(description="Dựng dữ liệu Viet Culture Map từ bundle, bảo toàn trạng thái kiểm duyệt.")
_ap.add_argument("paths", nargs="+", help="<bundle.json> <root>   hoặc   <root> khi dùng --check")
_ap.add_argument("--force", action="store_true", help="cho phép hạ trạng thái verified (không khuyến nghị)")
_ap.add_argument("--dry-run", action="store_true", help="chỉ kiểm tra và báo cáo, không ghi file")
_ap.add_argument("--check", action="store_true", help="chỉ kiểm tra dữ liệu hiện có trong <root>/data, không build")
ARGS = _ap.parse_args()
if ARGS.check:
    if len(ARGS.paths) != 1:
        _ap.error("--check chỉ nhận một đối số: <root>")
    SRC, ROOT = None, ARGS.paths[0]
else:
    if len(ARGS.paths) != 2:
        _ap.error("cần hai đối số: <bundle.json> <root>")
    SRC, ROOT = ARGS.paths

VERIFIED = "verified"
PRESERVE_ALT = True  # ảnh được giữ verified cũng giữ alt hiện tại (alt đã được dọn khỏi ghi chú quy trình)
STALE_ALT = re.compile(r"chưa xác minh|chưa chọn ảnh|chưa có giấy phép", re.I)

# id đơn vị tiền thân: slug không dấu. aliases: tên gọi khác thường gặp trong chuỗi originArea.
FORMER_UNITS = {
    "an-giang": [("an-giang", "An Giang", []), ("kien-giang", "Kiên Giang", ["Rạch Giá", "Hà Tiên", "Phú Quốc"])],
    "bac-ninh": [("bac-ninh", "Bắc Ninh", []), ("bac-giang", "Bắc Giang", [])],
    "ca-mau": [("ca-mau", "Cà Mau", []), ("bac-lieu", "Bạc Liêu", [])],
    "can-tho": [("can-tho", "Cần Thơ", []), ("soc-trang", "Sóc Trăng", []), ("hau-giang", "Hậu Giang", [])],
    "cao-bang": [("cao-bang", "Cao Bằng", [])],
    "da-nang": [("da-nang", "Đà Nẵng", []), ("quang-nam", "Quảng Nam", ["Hội An"])],
    "dak-lak": [("dak-lak", "Đắk Lắk", []), ("phu-yen", "Phú Yên", [])],
    "dien-bien": [("dien-bien", "Điện Biên", [])],
    "dong-nai": [("dong-nai", "Đồng Nai", []), ("binh-phuoc", "Bình Phước", [])],
    "dong-thap": [("dong-thap", "Đồng Tháp", []), ("tien-giang", "Tiền Giang", [])],
    "gia-lai": [("gia-lai", "Gia Lai", []), ("binh-dinh", "Bình Định", [])],
    "ha-noi": [("ha-noi", "Hà Nội", [])],
    "ha-tinh": [("ha-tinh", "Hà Tĩnh", [])],
    "hai-phong": [("hai-phong", "Hải Phòng", []), ("hai-duong", "Hải Dương", [])],
    "ho-chi-minh": [("ho-chi-minh", "Thành phố Hồ Chí Minh", ["TP.HCM", "TP HCM", "Sài Gòn", "Hồ Chí Minh"]),
                    ("binh-duong", "Bình Dương", []),
                    ("ba-ria-vung-tau", "Bà Rịa – Vũng Tàu", ["Bà Rịa", "Vũng Tàu", "Côn Đảo"])],
    "hue": [("hue", "Huế", ["Thừa Thiên Huế", "Thừa Thiên - Huế"])],
    "hung-yen": [("hung-yen", "Hưng Yên", []), ("thai-binh", "Thái Bình", [])],
    "khanh-hoa": [("khanh-hoa", "Khánh Hòa", []), ("ninh-thuan", "Ninh Thuận", [])],
    "lai-chau": [("lai-chau", "Lai Châu", [])],
    "lam-dong": [("lam-dong", "Lâm Đồng", []), ("dak-nong", "Đắk Nông", []), ("binh-thuan", "Bình Thuận", [])],
    "lang-son": [("lang-son", "Lạng Sơn", [])],
    "lao-cai": [("lao-cai", "Lào Cai", []), ("yen-bai", "Yên Bái", [])],
    "nghe-an": [("nghe-an", "Nghệ An", [])],
    "ninh-binh": [("ninh-binh", "Ninh Bình", []), ("ha-nam", "Hà Nam", []), ("nam-dinh", "Nam Định", [])],
    "phu-tho": [("phu-tho", "Phú Thọ", []), ("vinh-phuc", "Vĩnh Phúc", []), ("hoa-binh", "Hòa Bình", [])],
    "quang-ngai": [("quang-ngai", "Quảng Ngãi", []), ("kon-tum", "Kon Tum", [])],
    "quang-ninh": [("quang-ninh", "Quảng Ninh", [])],
    "quang-tri": [("quang-tri", "Quảng Trị", []), ("quang-binh", "Quảng Bình", [])],
    "son-la": [("son-la", "Sơn La", [])],
    "tay-ninh": [("tay-ninh", "Tây Ninh", []), ("long-an", "Long An", [])],
    "thai-nguyen": [("thai-nguyen", "Thái Nguyên", []), ("bac-kan", "Bắc Kạn", [])],
    "thanh-hoa": [("thanh-hoa", "Thanh Hóa", [])],
    "tuyen-quang": [("tuyen-quang", "Tuyên Quang", []), ("ha-giang", "Hà Giang", [])],
    "vinh-long": [("vinh-long", "Vĩnh Long", []), ("tra-vinh", "Trà Vinh", []), ("ben-tre", "Bến Tre", [])],
}

# Phân vùng Bắc / Trung / Nam — QUY TẮC CỦA DỰ ÁN (biên tập), ghi ở data/regions.json.
MACRO = {
    "bac": ["ha-noi", "hai-phong", "quang-ninh", "bac-ninh", "hung-yen", "ninh-binh", "phu-tho", "thai-nguyen",
            "tuyen-quang", "lao-cai", "lang-son", "cao-bang", "dien-bien", "lai-chau", "son-la"],
    "trung": ["thanh-hoa", "nghe-an", "ha-tinh", "quang-tri", "hue", "da-nang", "quang-ngai", "gia-lai",
              "dak-lak", "khanh-hoa", "lam-dong"],
    "nam": ["dong-nai", "ho-chi-minh", "tay-ninh", "vinh-long", "dong-thap", "an-giang", "can-tho", "ca-mau"],
}
FEATURED = ["ha-noi", "hue", "da-nang", "ho-chi-minh", "ninh-binh", "quang-ninh", "lao-cai", "lam-dong"]


def norm(s):
    s = unicodedata.normalize("NFD", s.lower().replace("đ", "d"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " " + re.sub(r"[^a-z0-9]+", " ", s).strip() + " "


def match_units(text, units):
    """Trả về id các đơn vị tiền thân xuất hiện trong text (khớp tên không dấu, bỏ 'X mới')."""
    t = norm(text or "")
    found = []
    for uid, name, aliases in units:
        for n in [name] + aliases:
            nn = norm(n)  # có khoảng trắng hai đầu
            idx = t.find(nn)
            while idx != -1:
                after = t[idx + len(nn):idx + len(nn) + 5]
                if not after.startswith("moi "):  # "tỉnh An Giang mới" = đơn vị hiện hành, không phải tiền thân
                    found.append(uid)
                    break
                idx = t.find(nn, idx + 1)
            if uid in found:
                break
    return found


def tag_items(obj, units, stats):
    if isinstance(obj, dict):
        if "originArea" in obj and isinstance(obj["originArea"], str):
            ids = match_units(obj["originArea"], units)
            obj["originUnitIds"] = ids
            stats["items"] += 1
            stats["matched"] += 1 if ids else 0
        for v in obj.values():
            tag_items(v, units, stats)
    elif isinstance(obj, list):
        for v in obj:
            tag_items(v, units, stats)


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# Bảo toàn trạng thái kiểm duyệt
# ---------------------------------------------------------------------------
def iter_images(obj, path=""):
    """Duyệt mọi đối tượng ảnh (dict có permissionStatus); slot = đường dẫn ổn định (dùng `id` của mục nếu có)."""
    if isinstance(obj, dict):
        if "permissionStatus" in obj:
            yield path, obj
        for k, v in obj.items():
            yield from iter_images(v, path + "." + k if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            key = v["id"] if isinstance(v, dict) and isinstance(v.get("id"), str) else str(i)
            yield from iter_images(v, path + "[" + key + "]")


def meta_containers(p):
    cands = [("metadata", p.get("metadata")), ("detail.metadata", (p.get("detail") or {}).get("metadata"))]
    return [(n, m) for n, m in cands if isinstance(m, dict)]


class Log:
    def __init__(self):
        self.downgrades = []   # trạng thái verified bị hạ -> chặn build
        self.warnings = []     # cần người biên soạn xem lại, không chặn
        self.stats = {"research_kept": 0, "images_kept": 0, "alt_kept": 0, "sourceId_removed": 0,
                      "bundle_newer": 0, "new_provinces": 0}


def preserve_review_state(pid, p, old, log):
    """Sửa tại chỗ hồ sơ `p` (từ bundle): ghép lại kết quả rà soát từ hồ sơ hiện tại `old` (hoặc None)."""
    old_imgs, dup = {}, set()
    if old is not None:
        for slot, img in iter_images(old):
            if slot in old_imgs:
                dup.add(slot)
            old_imgs[slot] = img
    # --- metadata ---
    if old is None:
        log.stats["new_provinces"] += 1
    else:
        old_meta = dict(meta_containers(old))
        for name, m in meta_containers(p):
            om = old_meta.get(name)
            if not om:
                continue
            o_lv, b_lv = om.get("lastVerified") or "", m.get("lastVerified") or ""
            if o_lv and b_lv > o_lv:  # bundle mới hơn: tôn trọng bundle, nhưng báo nếu bị hạ trạng thái
                log.stats["bundle_newer"] += 1
                if om.get("researchStatus") == VERIFIED and m.get("researchStatus") != VERIFIED:
                    log.downgrades.append((pid, name + ".researchStatus", VERIFIED, m.get("researchStatus"),
                                           "bundle có lastVerified mới hơn (%s > %s)" % (b_lv, o_lv)))
                continue
            for key in ("researchStatus", "lastVerified", "notes"):
                if key in om:
                    if key == "notes":
                        extra = [n for n in (m.get("notes") or []) if n not in om["notes"]]
                        if extra:
                            log.warnings.append("%s %s: bundle có %d ghi chú không có trong hồ sơ hiện tại (đã bỏ qua, xem lại)"
                                                % (pid, name, len(extra)))
                    m[key] = om[key]
            log.stats["research_kept"] += 1
    # --- ảnh ---
    new_slots = set()
    for slot, img in iter_images(p):
        new_slots.add(slot)
        if "sourceId" in img:
            log.stats["sourceId_removed"] += 1
            if img.pop("sourceId"):
                log.warnings.append("%s %s: bundle có sourceId khác rỗng (đã bỏ thuộc tính theo quy ước dự án)" % (pid, slot))
        o = old_imgs.get(slot) if slot not in dup else None
        if o is None or o.get("permissionStatus") != VERIFIED:
            continue
        if img.get("file") and img.get("file") == o.get("file"):
            img["permissionStatus"] = VERIFIED
            log.stats["images_kept"] += 1
            if PRESERVE_ALT and o.get("alt") and o.get("alt") != img.get("alt"):
                img["alt"] = o["alt"]
                log.stats["alt_kept"] += 1
        else:
            log.downgrades.append((pid, slot, "verified:" + str(o.get("file")), "%s:%s" % (img.get("permissionStatus"), img.get("file")),
                                   "đường dẫn ảnh không trùng khớp chính xác"))
    for slot, o in old_imgs.items():
        if o.get("permissionStatus") == VERIFIED and slot not in new_slots:
            log.warnings.append("%s %s: ảnh đã verified không còn trong bundle (file %s)" % (pid, slot, o.get("file")))
    for slot, img in iter_images(p):
        if img.get("permissionStatus") == VERIFIED and STALE_ALT.search(img.get("alt") or ""):
            log.warnings.append("%s %s: alt còn ghi chú quy trình cũ: %s" % (pid, slot, img["alt"]))


def check_consistency(index, provinces_by_id):
    """index.json phải khớp hồ sơ chi tiết: researchStatus, ảnh bìa, tên, loại đơn vị, miền."""
    errs = []
    ids = [u["id"] for u in index["units"]]
    if len(ids) != 34 or len(set(ids)) != 34:
        errs.append("index.json không đủ 34 đơn vị duy nhất (%d)" % len(ids))
    if sorted(ids) != sorted(provinces_by_id):
        errs.append("tập id của index.json khác tập hồ sơ chi tiết")
    for u in index["units"]:
        p = provinces_by_id.get(u["id"])
        if p is None:
            continue
        if u["researchStatus"] != (p.get("metadata") or {}).get("researchStatus"):
            errs.append("%s: researchStatus index=%r, hồ sơ=%r" % (u["id"], u["researchStatus"], p["metadata"].get("researchStatus")))
        if u["summary"]["image"] != p["summary"]["image"]:
            errs.append("%s: summary.image index khác hồ sơ chi tiết" % u["id"])
        for k in ("name", "administrativeType", "region"):
            if u[k] != p[k]:
                errs.append("%s: %s index khác hồ sơ" % (u["id"], k))
        d = p["detail"]
        want = {"destinations": [x["name"] for x in d["destinations"]],
                "specialties": [x["name"] for x in d["specialties"]],
                "arts": [x["name"] for x in (d.get("arts") or [])]}
        if u["searchNames"] != want:
            errs.append("%s: searchNames index khác tên trong hồ sơ chi tiết" % u["id"])
        for key, grp, ids in (("featuredDestinations", "destinations", "featuredDestinationIds"),
                              ("featuredSpecialties", "specialties", "featuredSpecialtyIds")):
            w = [{"id": x["id"], "name": x["name"]} for x in d[grp] if x["id"] in p["summary"][ids]]
            if u["summary"][key] != w:
                errs.append("%s: summary.%s index khác hồ sơ chi tiết" % (u["id"], key))
    for pid, p in provinces_by_id.items():
        for slot, img in iter_images(p):
            if "sourceId" in img:
                errs.append("%s %s: còn thuộc tính sourceId" % (pid, slot))
            if img.get("permissionStatus") == VERIFIED and not img.get("file"):
                errs.append("%s %s: verified nhưng không có file" % (pid, slot))
    return errs


def summarize(provinces_by_id):
    rs, im = {}, {}
    for p in provinces_by_id.values():
        k = (p.get("metadata") or {}).get("researchStatus")
        rs[k] = rs.get(k, 0) + 1
        for _, img in iter_images(p):
            k = (img.get("permissionStatus"), "có file" if img.get("file") else "không file")
            im[k] = im.get(k, 0) + 1
    return rs, im


def load_existing(pid):
    path = os.path.join(ROOT, "data", "provinces", pid + ".json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


if ARGS.check:
    ipath = os.path.join(ROOT, "data", "provinces", "index.json")
    index = json.load(open(ipath, encoding="utf-8"))
    by_id = {u["id"]: load_existing(u["id"]) for u in index["units"]}
    missing = [k for k, v in by_id.items() if v is None]
    errs = ["thiếu file hồ sơ: " + ", ".join(missing)] if missing else check_consistency(index, {k: v for k, v in by_id.items() if v})
    rs, im = summarize({k: v for k, v in by_id.items() if v})
    print("researchStatus:", rs)
    print("ảnh:", {"%s/%s" % k: v for k, v in im.items()})
    for e in errs:
        print("LỖI:", e)
    print("OK – dữ liệu nhất quán." if not errs else "Phát hiện %d lỗi." % len(errs))
    sys.exit(1 if errs else 0)

bundle = json.load(open(SRC, encoding="utf-8"))
provinces = bundle["provinces"]
assert len(provinces) == 34
assert sum(len(v) for v in FORMER_UNITS.values()) == 63, "34 đơn vị mới phải gồm đủ 63 đơn vị cũ"
assert sorted(sum(MACRO.values(), [])) == sorted(p["id"] for p in provinces)

index_units = []
tot = {"items": 0, "matched": 0}
report = []
log = Log()
outputs = []  # (đường dẫn, dữ liệu) – chỉ ghi sau khi mọi kiểm tra đã qua
bundle_state = {}
for p in provinces:
    pid = p["id"]
    units = FORMER_UNITS[pid]
    _st = (p.get("metadata") or {}).get("researchStatus")
    bundle_state[_st] = bundle_state.get(_st, 0) + 1
    p["formerUnits"] = [{"id": u[0], "name": u[1]} for u in units]
    st = {"items": 0, "matched": 0}
    tag_items(p["detail"], units, st)
    tot["items"] += st["items"]
    tot["matched"] += st["matched"]
    report.append((pid, len(units), st["items"], st["matched"]))
    p["metadata"]["derivedFields"] = [
        "formerUnits: bảng đơn vị tiền thân theo Nghị quyết 202/2025/QH15, nhập bằng tay trong tools/build_data.py",
        "originUnitIds: suy ra tự động từ chuỗi originArea (khớp tên không dấu); chưa được rà soát thủ công",
    ]
    preserve_review_state(pid, p, load_existing(pid), log)
    outputs.append((os.path.join(ROOT, "data", "provinces", pid + ".json"), p))

    d = p["detail"]
    index_units.append({
        "id": pid,
        "name": p["name"],
        "administrativeType": p["administrativeType"],
        "region": p["region"],
        "administrativeCode": d["overview"].get("administrativeCode"),
        "file": pid + ".json",
        "researchStatus": p["metadata"].get("researchStatus"),
        "formerUnits": p["formerUnits"],
        "summary": {
            "image": p["summary"]["image"],
            "shortIntroduction": p["summary"]["shortIntroduction"],
            "featuredDestinations": [{"id": x["id"], "name": x["name"]} for x in d["destinations"]
                                     if x["id"] in p["summary"]["featuredDestinationIds"]],
            "featuredSpecialties": [{"id": x["id"], "name": x["name"]} for x in d["specialties"]
                                    if x["id"] in p["summary"]["featuredSpecialtyIds"]],
        },
        # Chỉ tên – phục vụ tìm kiếm ở trang Khám phá mà không phải tải 34 hồ sơ đầy đủ
        "searchNames": {
            "destinations": [x["name"] for x in d["destinations"]],
            "specialties": [x["name"] for x in d["specialties"]],
            "arts": [x["name"] for x in (d.get("arts") or [])],
        },
    })

_index = {
    "schemaVersion": bundle["index"]["schemaVersion"],
    "asOfDate": bundle["index"]["asOfDate"],
    "generatedBy": "tools/build_data.py",
    "units": index_units,
}
outputs.append((os.path.join(ROOT, "data", "provinces", "index.json"), _index))
outputs.append((os.path.join(ROOT, "data", "sources.json"), {"schemaVersion": bundle["schemaVersion"], "sources": bundle["sources"]["sources"]}))
outputs.append((os.path.join(ROOT, "data", "taxonomy.json"), bundle["taxonomy"]))
# image-manifest.json: sao chép nguyên từ bundle (chưa có module nào đọc; schema phần tử chưa được quy định) – xem docstring
outputs.append((os.path.join(ROOT, "data", "image-manifest.json"), bundle["imageManifest"]))
outputs.append((os.path.join(ROOT, "data", "regions.json"), {
    "schemaVersion": "1.0.0",
    "rule": "Quy tắc phân vùng của dự án Viet Culture Map (biên tập, KHÔNG phải phân loại hành chính chính thức): "
            "mỗi đơn vị cấp tỉnh thuộc đúng một trong ba miền Bắc/Trung/Nam, xếp theo vị trí của trụ sở và phần lớn lãnh thổ. "
            "Trường 'region' trong hồ sơ từng tỉnh giữ nguyên phân vùng địa lý – kinh tế của bộ dữ liệu gốc.",
    "regions": [
        {"id": "bac", "label": "Miền Bắc", "description": "Từ biên giới phía Bắc đến vùng đồng bằng sông Hồng: núi cao Tây Bắc – Đông Bắc, châu thổ Bắc Bộ, văn hóa Kinh Bắc, Hạ Long và nhiều cộng đồng dân tộc thiểu số.", "provinceIds": MACRO["bac"]},
        {"id": "trung", "label": "Miền Trung", "description": "Dải đất từ Thanh Hóa đến Khánh Hòa và Tây Nguyên: kinh đô Huế, phố cổ Hội An, biển miền Trung, cao nguyên và không gian cồng chiêng.", "provinceIds": MACRO["trung"]},
        {"id": "nam", "label": "Miền Nam", "description": "Đông Nam Bộ và đồng bằng sông Cửu Long: đô thị sôi động, sông nước miệt vườn, ẩm thực phong phú và văn hóa Kinh – Khmer – Hoa – Chăm.", "provinceIds": MACRO["nam"]},
    ],
    "featuredProvinceIds": FEATURED,
    "featuredRule": "Danh sách biên tập: 8 địa phương đại diện cho nhiều vùng và nhiều loại hình di sản; không phải xếp hạng.",
}))

# ---------- Kiểm tra trước khi ghi ----------
_by_id = {p["id"]: p for p in provinces}
_errs = check_consistency(_index, _by_id)
_rs, _im = summarize(_by_id)
print("Trạng thái trong bundle (researchStatus):", bundle_state)
print("Sau khi ghép kết quả rà soát hiện tại:  ", _rs)
print("Ảnh sau khi ghép:", {"%s/%s" % k: v for k, v in _im.items()})
print("Đã giữ: researchStatus %d hồ sơ, ảnh verified %d (alt %d); bỏ sourceId ở %d ảnh; bundle mới hơn: %d; hồ sơ mới: %d"
      % (log.stats["research_kept"], log.stats["images_kept"], log.stats["alt_kept"], log.stats["sourceId_removed"],
         log.stats["bundle_newer"], log.stats["new_provinces"]))
for w in log.warnings[:30]:
    print("CẢNH BÁO:", w)
if len(log.warnings) > 30:
    print("CẢNH BÁO: … và %d cảnh báo khác" % (len(log.warnings) - 30))
for e in _errs:
    print("LỖI NHẤT QUÁN:", e)
if log.downgrades:
    print("\nPHÁT HIỆN %d TRẠNG THÁI VERIFIED BỊ HẠ (bundle đầu vào có thể đã cũ):" % len(log.downgrades))
    for pid_, slot, a, b, why in log.downgrades[:30]:
        print("  - %s %s: %s -> %s (%s)" % (pid_, slot, a, b, why))
    if len(log.downgrades) > 30:
        print("  … và %d trường hợp khác" % (len(log.downgrades) - 30))
if _errs or (log.downgrades and not ARGS.force):
    print("\nDỪNG: KHÔNG GHI file nào." + ("" if _errs else " Dùng bundle mới hơn, hoặc --force nếu thực sự muốn hạ trạng thái."))
    sys.exit(2)
if ARGS.dry_run:
    print("\n--dry-run: không ghi file nào.")
    sys.exit(0)
for _path, _data in outputs:
    dump(_path, _data)

print("Đã ghi 34 hồ sơ.")
print(f"originArea khớp đơn vị tiền thân: {tot['matched']}/{tot['items']}")
for pid, nu, ni, nm in report:
    if nu > 1 and nm < ni:
        print(f"  {pid}: {nm}/{ni} mục gán được đơn vị tiền thân")
