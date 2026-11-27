-- =============================================================================
-- Supabase Storage: product photographs
-- =============================================================================
-- Bucket "product-images" is PUBLIC for reading individual files (so product
-- photos load quickly on the website and in Google Images), but:
--   * nobody except admins can upload, replace or delete files;
--   * anonymous visitors cannot LIST the bucket (no select policy for anon).
-- Files are stored as products/<product-uuid>/<random>.webp|jpg|png
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB hard limit (the admin UI compresses images well below this)
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "product-images: admin read/list"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admin upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (select public.is_admin())
    and (storage.foldername(name))[1] = 'products'
  );

create policy "product-images: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
