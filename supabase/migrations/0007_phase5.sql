-- Phase 5: reviews with photos, discount code admin, custom orders.
-- Run this once in the Supabase SQL Editor (after 0006).
--
-- What it does:
--  1. Reviews: a customer can only attach photos from their OWN folder in the
--     "review-photos" bucket (max 3), and text has sensible length limits.
--  2. Custom requests: length limits so nobody can store a novel in the database.
--  3. Discount codes: only letters, numbers, - and _ (so a code is easy to type and share).

-- ---------- 1. Reviews ----------
alter table public.reviews
  add constraint reviews_title_length check (title is null or char_length(title) <= 100) not valid,
  add constraint reviews_body_length  check (body  is null or char_length(body)  <= 1500) not valid,
  add constraint reviews_photo_count  check (cardinality(photos) <= 3) not valid;

create or replace function public.set_review_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  new.is_verified_purchase := exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = new.user_id
      and o.status = 'delivered'
      and oi.product_id = new.product_id
  );

  if auth.uid() is not null and not public.is_admin() then
    new.status := 'pending';

    -- Keep only photos that sit in this customer's own folder of the review-photos bucket.
    new.photos := coalesce(
      (select array_agg(p)
         from unnest(new.photos) as p
        where p like '%/storage/v1/object/public/review-photos/' || new.user_id::text || '/%'),
      '{}'
    );
  end if;

  -- "Areesha K." style name. Customers can't choose it, admins can.
  if (auth.uid() is not null and not public.is_admin()) or new.author_name is null then
    select trim(p.full_name) into display_name from public.profiles p where p.id = new.user_id;
    new.author_name := coalesce(
      nullif(split_part(display_name, ' ', 1), '')
        || case
             when position(' ' in display_name) > 0
               then ' ' || upper(left(split_part(display_name, ' ', 2), 1)) || '.'
             else ''
           end,
      'Customer'
    );
  end if;

  return new;
end;
$$;

-- ---------- 2. Custom requests ----------
alter table public.custom_requests
  add constraint custom_requests_name_length    check (char_length(name) between 1 and 100) not valid,
  add constraint custom_requests_phone_length   check (char_length(phone) between 7 and 20) not valid,
  add constraint custom_requests_type_length    check (char_length(product_type) between 1 and 60) not valid,
  add constraint custom_requests_desc_length    check (char_length(description) between 1 and 2000) not valid,
  add constraint custom_requests_reply_length   check (admin_reply is null or char_length(admin_reply) <= 2000) not valid,
  add constraint custom_requests_images_count   check (cardinality(reference_images) <= 3) not valid;

-- ---------- 3. Discount codes ----------
alter table public.discount_codes
  add constraint discount_codes_format check (code ~ '^[A-Z0-9_-]+$' and length(code) <= 24) not valid;
