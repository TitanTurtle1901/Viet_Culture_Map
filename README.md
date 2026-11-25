# Viet Culture Map – Bản đồ văn hóa Việt Nam

Website tĩnh (HTML5, CSS3, JavaScript thuần, jQuery 3.7.1 đặt sẵn trong `js/vendor/`, Tailwind CSS đã biên dịch sẵn thành `css/tailwind.css`) với bản đồ SVG tương tác 34 tỉnh/thành phố.
Luồng chính: **bản đồ 34 đơn vị → hover → thông tin nhanh → click → hồ sơ đầy đủ.**

## Chạy dự án

Dữ liệu nạp bằng `fetch()` nên **phải chạy qua máy chủ cục bộ**, không mở trực tiếp file HTML:

1. Mở thư mục `Viet-Culture-Map` bằng VS Code.
2. Cài extension **Live Server** → chuột phải `index.html` → *Open with Live Server*.

Chỉ còn Google Fonts tải từ Internet (có font dự phòng của hệ thống khi offline). jQuery và Tailwind đã nằm trong dự án.

## Cấu trúc

```
index.html  explore.html  detail.html  login.html
css/style.css      CSS riêng của dự án
css/tailwind.css  CSS Tailwind đã biên dịch (KHÔNG sửa tay – sinh từ tools/tailwind)
js/vendor/jquery-3.7.1.min.js
js/data.js      lớp dữ liệu (JS thuần): tải JSON, chuẩn hóa chuỗi, phiên mô phỏng
js/main.js      header/footer dùng chung, menu, thẻ địa phương, ảnh giữ chỗ (jQuery)
js/map.js       bản đồ: hover, click, cảm ứng, zoom/kéo, lọc miền, danh sách
js/home.js      khu vực nổi bật / vùng miền / số liệu của trang chủ
js/explore.js   tìm kiếm, lọc, sắp xếp, phân trang (đồng bộ URL)
js/detail.js    5 tab, lọc theo đơn vị tiền thân, modal, nguồn
js/auth.js      đăng nhập/đăng ký MÔ PHỎNG
data/provinces/index.json     34 đơn vị + summary (Hover, Khám phá)
data/provinces/<id>.json      hồ sơ đầy đủ từng tỉnh (summary + detail + metadata)
data/sources.json             354 nguồn tham khảo
data/regions.json             quy tắc phân vùng Bắc/Trung/Nam + danh sách nổi bật
data/taxonomy.json, data/image-manifest.json
assets/maps/vietnam-34-provinces.svg   bản đồ (34 id, sinh từ GeoJSON)
assets/icons/vietnam-silhouette.svg    logo/favicon (từ cùng dữ liệu ranh giới)
tools/build_map.py, tools/build_data.py   script dựng dữ liệu (chạy một lần, không thuộc website)
tools/tailwind/          cấu hình + lệnh build css/tailwind.css
tools/optimize_images.py nén/đổi cỡ ảnh   |   tools/check_images.py kiểm tra đường dẫn ảnh
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
- **Đăng nhập/đăng ký chỉ là mô phỏng** (localStorage), không có xác thực thực tế.
- Ranh giới giữa các tỉnh nhỏ ở đồng bằng Bắc Bộ khó chạm trên điện thoại; dùng nút +/− hoặc danh sách bên phải.
- Đã kiểm thử logic bằng môi trường giả lập (jsdom) cho cả 4 trang; **chưa kiểm tra thị giác trên trình duyệt thật** (bố cục Tailwind, popup sát mép, cảm ứng thật). Nên duyệt thủ công trên desktop và điện thoại.

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
