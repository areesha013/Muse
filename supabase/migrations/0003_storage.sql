-- =====================================================================
-- 0003_storage.sql : file storage buckets and their access rules
-- Run AFTER 0002_rls.sql.
--
--  product-images   PUBLIC   product photos (only admins can upload)
--  review-photos    PUBLIC   photos on reviews (logged-in customers upload to their own folder)
--  receipts         PRIVATE  payment screenshots (only admins can view; uploads via server)
--  custom-requests  PRIVATE  custom order reference images (only admins can view; uploads via server)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images',  'product-images',  true,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('review-photos',   'review-photos',   true,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts',        'receipts',        false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('custom-requests', 'custom-requests', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- product-images ----------
create policy "product-images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product-images: admin write"
  on storage.objects for all
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

-- ---------- review-photos ----------
create policy "review-photos: public read"
  on storage.objects for select
  using (bucket_id = 'review-photos');

-- Files must go into a folder named after the user's own id: <user-id>/photo.jpg
create policy "review-photos: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "review-photos: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "review-photos: admin all"
  on storage.objects for all
  using (bucket_id = 'review-photos' and public.is_admin())
  with check (bucket_id = 'review-photos' and public.is_admin());

-- ---------- receipts (private) ----------
create policy "receipts: admin read"
  on storage.objects for select
  using (bucket_id = 'receipts' and public.is_admin());

create policy "receipts: admin manage"
  on storage.objects for all
  using (bucket_id = 'receipts' and public.is_admin())
  with check (bucket_id = 'receipts' and public.is_admin());

-- ---------- custom-requests (private) ----------
create policy "custom-requests: admin read"
  on storage.objects for select
  using (bucket_id = 'custom-requests' and public.is_admin());

create policy "custom-requests: admin manage"
  on storage.objects for all
  using (bucket_id = 'custom-requests' and public.is_admin())
  with check (bucket_id = 'custom-requests' and public.is_admin());
