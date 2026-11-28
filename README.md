# Viet Culture Map – Bản đồ văn hóa Việt Nam

Website tĩnh (HTML5, CSS3, JavaScript thuần, jQuery 3.7.1 đặt sẵn trong `js/vendor/`, Tailwind CSS đã biên dịch sẵn thành `css/tailwind.css`) với bản đồ SVG tương tác 34 tỉnh/thành phố.
Luồng chính: **bản đồ 34 đơn vị → hover → thông tin nhanh → click → hồ sơ đầy đủ.**

## Chạy dự án

Dữ liệu nạp bằng `fetch()` nên **phải chạy qua máy chủ cục bộ**, không mở trực tiếp file HTML:

1. Mở thư mục `Viet-Culture-Map` bằng VS Code.
2. Cài extension **Live Server** → chuột phải `index.html` → *Open with Live Server*.

Chỉ còn Google Fonts tải từ Internet (có font dự phòng của hệ thống khi offline). jQuery và Tailwind đã nằm trong dự án.

## Cấu trúc dự án

### Sơ đồ thư mục

```
Viet-Culture-Map/
│
├── 📄 TRANG WEB (6 trang HTML, mở bằng Live Server)
│   ├── index.html        Trang chủ: Hero, bản đồ #ban-do, địa phương nổi bật, vùng miền
│   ├── explore.html      Khám phá: tìm kiếm, lọc, sắp xếp, phân trang
│   ├── detail.html       Hồ sơ đầy đủ của một tỉnh (5 tab)
│   ├── favorites.html    Danh sách địa phương đã lưu
│   ├── about.html        Giới thiệu dự án + nhóm tác giả
│   └── login.html        Đăng nhập / đăng ký (MÔ PHỎNG)
│
├── 🎨 css/
│   ├── style.css         CSS riêng của dự án (bản đồ, glass, reveal, nền chung...)
│   └── tailwind.css      Tailwind đã biên dịch – KHÔNG sửa tay (sinh từ tools/tailwind)
│
├── ⚙️ js/
│   ├── data.js           Lớp dữ liệu (JS thuần): tải JSON, chuẩn hóa chuỗi, phiên mô phỏng
│   ├── main.js           Dùng chung mọi trang: header/footer, menu, tìm nhanh, thẻ, reveal
│   ├── map.js            Bản đồ: hover, click, cảm ứng, zoom/kéo, lọc miền, danh sách
│   ├── home.js           Trang chủ: nổi bật, vùng miền, số liệu, đếm số
│   ├── explore.js        Trang Khám phá: tìm kiếm, lọc, phân trang (đồng bộ URL)
│   ├── detail.js         Trang chi tiết: 5 tab, lọc tiền thân, modal, nguồn
│   ├── about.js          Trang Giới thiệu: tính số liệu thật, đếm số
│   ├── community.js      Yêu thích + bình luận (demo localStorage)
│   ├── favorites.js      Dựng trang địa phương đã lưu
│   ├── auth.js           Đăng nhập/đăng ký MÔ PHỎNG
│   ├── components/
│   │   └── background.js Nền slideshow chung cho mọi trang
│   └── vendor/
│       └── jquery-3.7.1.min.js
│
├── 🗂️ data/              (chỉ chứa dữ liệu, không chứa giao diện)
│   ├── provinces/
│   │   ├── index.json        34 đơn vị + summary (dùng cho Hover, Khám phá, thẻ)
│   │   └── <id>.json         Hồ sơ đầy đủ từng tỉnh (34 file: ha-noi.json, hue.json...)
│   ├── regions.json          Phân vùng Bắc/Trung/Nam + danh sách nổi bật
│   ├── sources.json          354 nguồn tham khảo
│   ├── taxonomy.json         Phân loại nội dung
│   ├── image-manifest.json   Danh mục ảnh
│   └── background-images.json  Danh sách ảnh + thời gian của nền slideshow
│
├── 🖼️ assets/
│   ├── maps/vietnam-34-provinces.svg   Bản đồ (34 id, sinh từ GeoJSON)
│   ├── icons/vietnam-silhouette.svg    Logo / favicon
│   └── images/<tên địa phương>/{culture, destinations, specialties}/   Ảnh nội dung
│
└── 🛠️ tools/             (công cụ bảo trì, KHÔNG thuộc website khi chạy)
    ├── build_map.py          Dựng lại bản đồ SVG từ GeoJSON
    ├── build_data.py         Tách/chuẩn hóa dữ liệu từ bundle JSON
    ├── optimize_images.py    Nén / đổi cỡ ảnh
    ├── check_images.py       Kiểm tra đường dẫn ảnh (sai hoa/thường, tên không an toàn)
    └── tailwind/             Cấu hình + lệnh build css/tailwind.css
```

### Mỗi trang nạp những file JS nào

Thứ tự nạp luôn là `jQuery → data.js → main.js → file riêng của trang`.

| Trang | Nền slideshow | File JS riêng |
|---|---|---|
| `index.html` | `components/background.js` | `map.js`, `home.js` |
| `explore.html` | `components/background.js` | `explore.js` |
| `about.html` | `components/background.js` | `about.js` |
| `favorites.html` | `components/background.js` | `community.js`, `favorites.js` |
| `login.html` | `components/background.js` | `auth.js` |
| `detail.html` | (ảnh nền riêng của tỉnh, gán bởi `detail.js`) | `community.js`, `detail.js` |

### Luồng dữ liệu

```
data/*.json ──fetch──▶ js/data.js ──▶ js/main.js (giao diện chung)
                                  └──▶ js/<trang>.js ──▶ HTML hiển thị
assets/maps/*.svg ──▶ js/map.js (chỉ trang chủ)
```

Phân công JS: `data.js` thuần (không đụng DOM); mọi thao tác DOM/sự kiện dùng jQuery. Ngoại lệ duy nhất: `wheel` dùng
`addEventListener` gốc vì cần `{passive:false}`.

## Bản đồ

- Nguồn ranh giới: GeoJSON "Vietnam Administrative Divisions (Post-2025)" trong
  [nguyenduy1133/Free-GIS-Data](https://github.com/nguyenduy1133/Free-GIS-Data). Đây là bộ dữ liệu cộng đồng,
  **không phải bản đồ chính thức của cơ quan nhà nước**, và kho này **không có file giấy phép**. Cần xác minh quyền sử dụng
  trước khi công bố rộng rãi/thương mại.
- Đã làm mịn đường biên (~400 m), đảo nhỏ vẽ thành chấm. Mỗi tỉnh là một `<path id="province-<id>" data-province-id="<id>">`.
- Hoàng Sa (Đà Nẵng) và Trường Sa (Khánh Hòa) nằm trong **khung phụ**, dịch chuyển/thu nhỏ, không theo vị trí và tỷ lệ thật.
- Lỗi dữ liệu nguồn đã xử lý: một feature mang thuộc tính "Lạng Sơn" (lặp) nhưng hình học nằm ở đồng bằng sông Cửu Long
  → được ghép thành **Đồng Tháp** theo vị trí; trường `Ma` của nguồn không phải mã hành chính nên không dùng.
- Dựng lại: `python tools/build_map.py <Provinces.geojson> assets/maps/vietnam-34-provinces.svg` (cần `pip install shapely`).

## Dữ liệu

Hồ sơ lấy từ file `viet-culture-map-34-provinces.json` do Hoang Nhat cung cấp `tools/build_data.py` chỉ tách file và thêm:

- `formerUnits` (63 đơn vị tiền thân của 34 đơn vị, theo Nghị quyết 202/2025/QH15, nhập tay trong script – **cần đối chiếu**).
- `originUnitIds` ở từng mục, **suy ra tự động** từ chuỗi `originArea` (khớp tên không dấu). Mục không gắn được một đơn vị
  hiển thị ở nhóm "Chung / chưa phân định". Chưa rà soát thủ công.
- Phân vùng Bắc/Trung/Nam là **quy ước biên tập của dự án** (Lâm Đồng, Gia Lai, Đắk Lắk xếp vào Trung), ghi trong `data/regions.json`.
- 8 địa phương "nổi bật" là danh sách biên tập, không phải xếp hạng.
- Cả 34 hồ sơ đã được rà soát nội dung và có `metadata.researchStatus: "verified"` (hiển thị "Đã rà soát" ở tab nguồn; trang chi tiết không còn nhãn cảnh báo). Giá trị hợp lệ: `needs_review`, `verified`, `draft`. Trường rỗng không hiển thị.

## Chưa hoàn thành / hạn chế (nêu thẳng)

- **Ảnh:** cả 34 thẻ địa phương dùng ảnh bìa thật (`summary.image.file` trong `data/provinces/index.json`, hiển thị `object-fit: cover`). Ảnh có file đều ghi
  `permissionStatus: verified` (người biên soạn xác nhận quyền sử dụng, dự án phi lợi nhuận); đối tượng ảnh gồm `file`, `alt`, `permissionStatus`. 6 mục chưa có file ảnh giữ `unverified`. Nếu một địa phương chưa có `image.file` hoặc ảnh tải lỗi, giao diện hiện ảnh giữ chỗ
  (nền theo miền + biểu tượng, ghi \"Chưa có ảnh bìa\"), không dùng mảnh bản đồ địa giới.
- **Tagline** và **thông tin liên hệ** chưa có trong dữ liệu nên không được bịa; banner hiển thị loại đơn vị, vùng và đơn vị tiền thân; footer ghi chưa cấu hình kênh liên hệ.
- **Đăng nhập/đăng ký, yêu thích và bình luận hiện là bản mô phỏng trên trình duyệt.** Tài khoản dùng localStorage; yêu thích lưu riêng theo tên đăng nhập; bình luận lưu trên trình duyệt hiện tại và có thể xóa bình luận của mình. Dữ liệu không đồng bộ giữa thiết bị/người dùng trên các trình duyệt khác và chưa có máy chủ, xác thực thật hay công cụ kiểm duyệt. Không nhập thông tin riêng tư vào bình luận. Muốn mở cho nhiều người dùng thật, cần thay bằng dịch vụ xác thực/cơ sở dữ liệu và chính sách phân quyền phía máy chủ.
- Ranh giới giữa các tỉnh nhỏ ở đồng bằng Bắc Bộ khó chạm trên điện thoại; dùng nút +/− hoặc danh sách bên phải.
- Đã kiểm thử logic bằng môi trường giả lập (jsdom) cho cả 4 trang; **chưa kiểm tra thị giác trên trình duyệt thật** (bố cục Tailwind, popup sát mép, cảm ứng thật). Nên duyệt thủ công trên desktop và điện thoại.

## Giao diện: Global Background (One Background – One Experience)

Mọi trang (`index`, `explore`, `favorites`, `about`, `login`) dùng **một** nền slideshow chung (trang `detail` dùng ảnh nền riêng của từng tỉnh); nội dung nằm trong các **Content Panel** (`.vcm-panel`, kem/trắng ngà, bo góc, bóng nhẹ) ở lớp phía trên. Header trong suốt ở đầu trang, chuyển sang nền kính mờ khi cuộn. Không còn nền riêng ở Hero, Khám phá, Giới thiệu hay từng tỉnh. (Bản đồ là mục `#ban-do` của trang chủ, không có trang riêng.)

- Markup: `<div id="global-background">` (có sẵn trong mỗi trang) gồm `.background-slides` + `.background-overlay`; CSS ở phần "Global Background" của `css/style.css` (`position: fixed; inset: 0; z-index: -1`, không dùng `background-attachment: fixed`).
- Logic: `js/components/background.js` – fade mượt, preload đúng 1 ảnh kế tiếp (DOM tối đa 2 ảnh), ảnh lỗi bị loại khỏi vòng lặp (hết ảnh → nền gradient dự phòng), tạm dừng khi tab ẩn, `prefers-reduced-motion`/Save-Data → 1 ảnh tĩnh.
- Giữ trạng thái giữa các trang: `sessionStorage["vcm_bg_state"]` (thứ tự ảnh, ảnh hiện tại, thời điểm đổi) → chuyển trang không reset về ảnh đầu, đồng hồ đổi ảnh chạy tiếp. Đóng tab thì bắt đầu phiên mới (thứ tự ngẫu nhiên).
- **Thêm ảnh nền:** thêm một mục vào `images` trong `data/background-images.json` (`id`, `src` tính từ gốc website, `alt`, `focus` = vị trí cắt ảnh, `active`). Chỉ dùng ảnh đã xác minh quyền sử dụng; nên dùng WebP/JPEG ≤ ~300 KB, rộng ~1600 px (`tools/optimize_images.py`). Hiện danh sách dùng lại 8 ảnh bìa tỉnh đã có (không thêm ảnh mới). Tắt ảnh: `"active": false`. Kiểm tra đường dẫn: `python tools/check_images.py`.
- **Đổi thời gian:** `intervalMs` (mặc định 9000 ms, tối thiểu 3000) và `fadeMs` (mặc định 1600 ms) trong cùng file JSON.
- **Panel:** thêm class `vcm-panel` cho khối nội dung; tiêu đề đặt trực tiếp trên nền dùng class `on-bg`. Biến `--panel-bg`, `--panel-radius` ở đầu `css/style.css`.

## Giao diện: Glassmorphism và Reveal animation

Chỉ là lớp hiệu ứng trong `css/style.css` (và một đoạn nhỏ trong observer của `js/main.js`); không ảnh hưởng dữ liệu hay logic.

**Glassmorphism** (nền bán trong suốt + `backdrop-filter: blur()`), áp dụng cho trang Giới thiệu (thẻ tính năng, khối "Một địa phương, nhiều tầng di sản", CTA) và khối cùng tên ở trang chủ:

- Class dùng lại được: `.glass-light` (thẻ sáng, trong và mờ hơn) và `.glass-dark` (khối xanh đậm).
- Biến ở đầu `css/style.css`: `--glass-light-bg`, `--glass-light-blur`, `--glass-dark-bg`, `--glass-blur`, `--glass-light-border`, `--glass-dark-border`, `--glass-dark-inner-bg`, `--glass-shadow`. Muốn mờ hơn: tăng `*-blur` hoặc giảm độ đặc (số cuối của `rgba`).
- Trình duyệt không hỗ trợ `backdrop-filter` tự chuyển sang nền đặc hơn để chữ vẫn dễ đọc. Chữ phụ trong thẻ sáng được làm đậm để giữ độ tương phản.
- Thẻ lồng trong khối kính (ví dụ thẻ 34/63/240/175) không blur riêng vì blur lồng nhau không có tác dụng.

**Reveal animation** (mờ dần + trượt nhẹ khi cuộn tới), dùng một IntersectionObserver chung trong `js/main.js`:

- Thêm class `reveal` vào phần tử là đủ. Biến thể: `reveal-fade` (chỉ mờ dần), `reveal-scale` (mờ dần + phóng 0.98 → 1, dùng cho khung bản đồ SVG).
- Hiện lần lượt (stagger): `reveal-d1` … `reveal-d4` (80–320 ms). Lưới thẻ ở trang Giới thiệu tự có stagger.
- Biến: `--reveal-duration`, `--reveal-ease`, `--reveal-distance`.
- Chỉ dùng `opacity` và `transform` nên không gây layout shift; sau khi hiện xong `transform` trả về `none`, không ảnh hưởng zoom/click bản đồ.
- `prefers-reduced-motion: reduce` → tắt hiệu ứng, nội dung hiện ngay. Trình duyệt tắt JavaScript (`@media (scripting: none)`) cũng hiện đủ nội dung.
- Trên trang chủ, phần bản đồ có reveal cho: tiêu đề + mô tả, khung bản đồ, SVG, bộ lọc miền, danh sách tỉnh.

## Công cụ bảo trì

- **Sửa giao diện bằng class Tailwind mới** (thêm class vào HTML/JS) → build lại CSS (cần Node.js 18+):
  `cd tools/tailwind && npm install && npm run build`  (hoặc `npm run watch` khi đang sửa). Commit file `css/tailwind.css` sinh ra.
- **Thêm ảnh mới** → đặt tên file chỉ gồm `A-Z a-z 0-9 . _ -` (không dấu, không khoảng trắng), rồi nén:
  `pip install pillow && python tools/optimize_images.py` (cạnh dài ≤ 1600 px, giữ nguyên tên/định dạng).
- **Trước khi commit/deploy** → `python tools/check_images.py`: báo đường dẫn ảnh trong JSON bị thiếu hoặc sai hoa/thường
  (Windows bỏ qua lỗi này nhưng GitHub Pages/Linux thì ảnh sẽ vỡ), cùng tên file không an toàn. Thêm `--list-unused` để xem ảnh chưa dùng.
- **Dựng lại dữ liệu từ bundle** → `python tools/build_data.py <bundle.json> .` (thêm `--dry-run` để chỉ báo cáo). Script giữ lại kết quả rà soát hiện tại
  (`researchStatus`, `lastVerified`, `notes`, `permissionStatus` + `alt` của ảnh trùng đường dẫn chính xác), bỏ `sourceId` của ảnh, và **dừng, không ghi file nào**
  nếu bundle cũ làm một trạng thái `verified` bị hạ (`--force` mới cho phép). `python tools/build_data.py --check .` kiểm tra `index.json` khớp các hồ sơ chi tiết.
