# Vivian ☁ — bầu trời của Vân

Web cá nhân chạy hoàn toàn trên máy: quản lý việc, lịch, nhắc việc, chi tiêu, ghi chú, dự án, thói quen và âm thanh thư giãn — theo concept đám mây & kính mờ.

## Mở app
- Cách nhanh: nhấp đúp `index.html` (mở bằng Chrome/Edge).
- Hoặc chạy server nhỏ: `python -m http.server 5173` trong thư mục này rồi vào http://localhost:5173

Dữ liệu lưu trong trình duyệt (localStorage) và — nếu đăng nhập — tự đồng bộ lên Supabase.

## Đồng bộ đám mây (Supabase)
- Vào **Cài đặt → Đồng bộ đám mây**, tạo tài khoản bằng email + mật khẩu (bấm link xác nhận trong email), rồi đăng nhập trên mọi thiết bị.
- Sửa gì cũng tự đẩy lên sau ~1,5 giây; mở lại tab hoặc mỗi 45 giây sẽ tự kéo bản mới về. Mất mạng vẫn dùng bình thường.
- Hai máy cùng sửa: dữ liệu được gộp theo từng mục (việc, ghi chú, chi tiêu…), mục sửa cùng lúc thì lấy bản sửa sau cùng.
- Kết nối nằm ở `js/config.js` (khóa công khai). Bảng và quyền truy cập tạo bằng `supabase.sql` — mỗi tài khoản chỉ đọc/ghi được dữ liệu của mình.
- **Quên mật khẩu:** nhập email → bấm “Quên mật khẩu?” → mở link trong email (trong 1 giờ, chỉ bấm 1 lần) → hiện hộp đặt mật khẩu mới. Để link chạy được, trong Supabase → Authentication → URL Configuration: *Site URL* là địa chỉ web Vivian, và *Redirect URLs* có địa chỉ đó (cả `http://localhost:5173/` nếu chạy trên máy).
- Vẫn nên thỉnh thoảng **Cài đặt → Xuất sao lưu** một bản `.json`.

## Có gì bên trong
| Mục | Chức năng |
|---|---|
| Tổng quan | Lời chào theo giờ, vòng tiến độ hôm nay, "mây gom được", việc quá hạn (dời sang hôm nay 1 chạm), 7 ngày tới, thói quen, nhắc sắp tới |
| Công việc | Bảng việc (Cần làm / Đang làm / Đã xong) bên trái, kéo thả sang cột; việc lặp mỗi ngày / T2–T6 / tuần / tháng / năm |
| Lịch sự kiện | Lịch tháng bên phải trang Công việc chỉ hiện **sự kiện** (và nhắc việc nếu bật): có giờ hoặc cả ngày, kéo dài nhiều ngày, địa điểm, lặp lại; kéo thả sự kiện sang ngày khác; bấm “+” trong ô để thêm |
| Nhắc việc | Chuông + thông báo trình duyệt khi đến giờ (khi trang đang mở) |
| Chi tiêu | Thu/chi theo tháng, ngân sách, dự báo cuối tháng, biểu đồ theo danh mục |
| Ghi chú | Ghi chú màu pastel, ghim, tìm kiếm; ô "Ghi nhanh" ở thanh bên (Ctrl + Enter) |
| Dự án | Các bước (milestone), % tiến độ, việc liên kết |
| Thư giãn | 6 âm thanh tự tạo (mưa, gió, sóng, ồn nâu/trắng, lửa) có hẹn giờ tắt, hít thở 4-4-6, Pomodoro, thói quen 7 ngày + chuỗi 🔥 |
| Màu & kính | Bầu trời (tự đổi theo giờ / bình minh / trời trong / kẹo bông / hoàng hôn / đêm sao), màu nhấn, độ nhòe & độ đục kính, số mây |
| Lưu trữ / Cài đặt | Khôi phục mục đã cất, nhóm việc, sao lưu, và nút **Kiểm tra logic** (1 + 1 = 2, hôm qua = hôm nay − 1, năm nhuận, lặp ngày 31…) |

Phím tắt: `n` thêm việc · `e` thêm sự kiện · `←` `→` đổi tháng · `t` về hôm nay · `Esc` đóng hộp thoại.
