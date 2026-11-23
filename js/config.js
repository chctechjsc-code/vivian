'use strict';
/* Kết nối Supabase để đồng bộ dữ liệu giữa các thiết bị.
   "anonKey" là khóa công khai (publishable) — được phép để lộ, vì bảng vivian_docs đã bật
   Row Level Security: mỗi người chỉ đọc/ghi được dữ liệu của chính mình.
   Để trống cả hai thì Vivian chạy như cũ, chỉ lưu trong trình duyệt. */
window.VIVIAN_CLOUD = {
  url: 'https://tkvhaffrftezjxwvcimx.supabase.co',
  anonKey: 'sb_publishable_vhgQjp6jjpW7L5vvDqN4_A_p7mpSgXr',
};
