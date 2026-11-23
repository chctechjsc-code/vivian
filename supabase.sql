-- Vivian: bảng lưu dữ liệu đồng bộ. Chạy một lần trong Supabase → SQL Editor.
create table if not exists public.vivian_docs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.vivian_docs enable row level security;
grant select, insert, update, delete on public.vivian_docs to authenticated;

drop policy if exists "doc: tự đọc"  on public.vivian_docs;
drop policy if exists "doc: tự thêm" on public.vivian_docs;
drop policy if exists "doc: tự sửa"  on public.vivian_docs;
drop policy if exists "doc: tự xóa"  on public.vivian_docs;

create policy "doc: tự đọc"  on public.vivian_docs for select to authenticated using (auth.uid() = user_id);
create policy "doc: tự thêm" on public.vivian_docs for insert to authenticated with check (auth.uid() = user_id);
create policy "doc: tự sửa"  on public.vivian_docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "doc: tự xóa"  on public.vivian_docs for delete to authenticated using (auth.uid() = user_id);
