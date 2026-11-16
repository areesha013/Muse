-- =====================================================================
-- 0001_schema.sql : tables, constraints, indexes, triggers
-- Run in Supabase -> SQL Editor (new query), BEFORE 0002 and 0003.
-- =====================================================================

-- ---------- Enums ----------
create type public.user_role as enum ('customer', 'admin');

create type public.order_status as enum (
  'pending_payment', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'
);

create type public.payment_method as enum ('cod', 'jazzcash', 'easypaisa', 'bank_transfer');

create type public.payment_status as enum ('pending', 'submitted', 'verified', 'rejected');

create type public.discount_type as enum ('percentage', 'fixed');

create type public.review_status as enum ('pending', 'approved', 'hidden');

create type public.custom_request_status as enum (
  'new', 'quoted', 'accepted', 'in_progress', 'completed', 'declined'
);

-- ---------- Shared helper: keep updated_at fresh ----------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (one row per login, linked to Supabase Auth) ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- True when the current logged-in user is an admin.
-- SECURITY DEFINER so it can read profiles without triggering RLS recursion.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Create a profile automatically whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nobody can promote themselves to admin.
-- Allowed only for existing admins, or from the SQL Editor / service key
-- (where auth.uid() is null). This is how you create your first admin.
create function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change a role';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- addresses (saved delivery addresses for logged-in customers) ----------
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  label       text not null default 'Home',
  full_name   text not null,
  phone       text not null,
  city        text not null,
  address     text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses (user_id);

-- ---------- categories ----------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- products ----------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid references public.categories (id) on delete set null,
  name              text not null,
  slug              text not null unique
                    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description       text,
  base_price        numeric(10, 2) not null check (base_price >= 0),
  compare_at_price  numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  is_bundle         boolean not null default false,
  is_featured       boolean not null default false,
  is_active         boolean not null default true,
  -- Used when the product has NO variants. With variants, stock lives on each variant.
  track_stock       boolean not null default true,
  stock_quantity    integer not null default 0 check (stock_quantity >= 0),
  search            tsvector generated always as (
                      to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
                    ) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index products_category_idx  on public.products (category_id);
create index products_active_idx    on public.products (is_active, created_at desc);
create index products_featured_idx  on public.products (is_featured) where is_featured;
create index products_search_idx    on public.products using gin (search);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------- product_images ----------
create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  url         text not null,
  alt         text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

-- ---------- product_variants (size / color etc.) ----------
create table public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  name            text not null,                       -- e.g. "Pink / Small"
  sku             text unique,
  options         jsonb not null default '{}'::jsonb,  -- e.g. {"color":"Pink","size":"Small"}
  price_override  numeric(10, 2) check (price_override is null or price_override >= 0),
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id, sort_order);

-- ---------- discount_codes ----------
create table public.discount_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code = upper(code) and length(code) >= 3),
  type        public.discount_type not null,
  value       numeric(10, 2) not null check (value > 0),
  min_order   numeric(10, 2) not null default 0 check (min_order >= 0),
  max_uses    integer check (max_uses is null or max_uses > 0),
  times_used  integer not null default 0 check (times_used >= 0),
  expires_at  timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  check (type <> 'percentage' or value <= 100)
);

-- ---------- orders ----------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique
                    default ('ORD-' || nextval('public.order_number_seq')::text),
  user_id           uuid references public.profiles (id) on delete set null,  -- null = guest
  status            public.order_status not null default 'pending_payment',
  payment_method    public.payment_method not null,

  customer_name     text not null,
  customer_email    text,
  customer_phone    text not null,
  shipping_city     text not null,
  shipping_address  text not null,
  notes             text,

  subtotal          numeric(10, 2) not null check (subtotal >= 0),
  discount_amount   numeric(10, 2) not null default 0 check (discount_amount >= 0),
  shipping_fee      numeric(10, 2) not null default 0 check (shipping_fee >= 0),
  total             numeric(10, 2) not null check (total >= 0),
  discount_code_id  uuid references public.discount_codes (id) on delete set null,
  discount_code     text,            -- copy of the code text, kept even if the code is deleted

  tracking_note     text,            -- shown to the customer on the Track Order page

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  check (total = subtotal - discount_amount + shipping_fee)
);

create index orders_user_idx    on public.orders (user_id);
create index orders_status_idx  on public.orders (status, created_at desc);
create index orders_phone_idx   on public.orders (customer_phone);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------- order_items (a snapshot, so later price changes don't alter old orders) ----------
create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  variant_id    uuid references public.product_variants (id) on delete set null,
  product_name  text not null,
  variant_name  text,
  unit_price    numeric(10, 2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(10, 2) generated always as (unit_price * quantity) stored
);

create index order_items_order_idx   on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ---------- payments (one per order) ----------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null unique references public.orders (id) on delete cascade,
  method          public.payment_method not null,
  status          public.payment_status not null default 'pending',
  amount          numeric(10, 2) not null check (amount >= 0),
  sender_name     text,              -- JazzCash / Easypaisa
  transaction_id  text,              -- JazzCash / Easypaisa
  receipt_path    text,              -- file path in the private "receipts" bucket
  admin_note      text,
  verified_by     uuid references public.profiles (id) on delete set null,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index payments_status_idx on public.payments (status);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------- custom_requests ----------
create table public.custom_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete set null,
  name              text not null,
  email             text,
  phone             text not null,
  product_type      text not null,                       -- e.g. "Custom stickers"
  description       text not null,
  budget            numeric(10, 2) check (budget is null or budget >= 0),
  deadline          date,
  reference_images  text[] not null default '{}',        -- paths in the private "custom-requests" bucket
  status            public.custom_request_status not null default 'new',
  quote_amount      numeric(10, 2) check (quote_amount is null or quote_amount >= 0),
  admin_reply       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index custom_requests_status_idx on public.custom_requests (status, created_at desc);
create index custom_requests_user_idx   on public.custom_requests (user_id);

create trigger custom_requests_set_updated_at
  before update on public.custom_requests
  for each row execute function public.set_updated_at();

-- ---------- reviews (logged-in customers only, admin approves) ----------
create table public.reviews (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete cascade,
  rating                smallint not null check (rating between 1 and 5),
  title                 text,
  body                  text,
  photos                text[] not null default '{}',     -- public URLs in the "review-photos" bucket
  status                public.review_status not null default 'pending',
  is_verified_purchase  boolean not null default false,
  created_at            timestamptz not null default now(),
  unique (product_id, user_id)                            -- one review per customer per product
);

create index reviews_product_idx on public.reviews (product_id, status);

-- New reviews always start as "pending", and "verified purchase" is decided
-- by the database (a delivered order that contains the product), never by the customer.
create function public.set_review_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  end if;

  return new;
end;
$$;

create trigger reviews_set_defaults
  before insert on public.reviews
  for each row execute function public.set_review_defaults();

-- ---------- settings (shipping, payment details, store info) ----------
-- Everything here is shown publicly (checkout page, footer). NEVER store secrets in it.
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------- Discount code check (used by checkout in Phase 3) ----------
-- Customers cannot read the discount_codes table, so checkout asks this function instead.
create function public.validate_discount_code(p_code text, p_subtotal numeric)
returns table (valid boolean, message text, discount_amount numeric, code_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d public.discount_codes%rowtype;
  amt numeric(10, 2);
begin
  select * into d from public.discount_codes where code = upper(trim(p_code));

  if not found or not d.is_active then
    return query select false, 'This code is not valid.', 0::numeric, null::uuid;
    return;
  end if;
  if d.expires_at is not null and d.expires_at < now() then
    return query select false, 'This code has expired.', 0::numeric, null::uuid;
    return;
  end if;
  if d.max_uses is not null and d.times_used >= d.max_uses then
    return query select false, 'This code has been fully used.', 0::numeric, null::uuid;
    return;
  end if;
  if p_subtotal < d.min_order then
    return query select false,
      'Minimum order for this code is Rs ' || d.min_order::text || '.', 0::numeric, null::uuid;
    return;
  end if;

  if d.type = 'percentage' then
    amt := round(p_subtotal * d.value / 100, 2);
  else
    amt := least(d.value, p_subtotal);
  end if;

  return query select true, 'Code applied.', amt, d.id;
end;
$$;

grant execute on function public.validate_discount_code(text, numeric) to anon, authenticated;
-- =====================================================================
-- 0002_rls.sql : Row Level Security (who can see / change what)
-- Run AFTER 0001_schema.sql.
--
-- Rules of thumb:
--  * The public (not logged in) can only read active products, categories,
--    approved reviews and store settings.
--  * Customers can only see their own orders, payments, requests, addresses.
--  * Only admins can write products, orders, settings, discount codes.
--  * Guest checkout, order tracking and custom requests are handled by
--    trusted server code using the service-role key, which bypasses RLS.
--    That is why there are no public INSERT policies on orders / requests.
-- =====================================================================

alter table public.profiles         enable row level security;
alter table public.addresses        enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_images   enable row level security;
alter table public.product_variants enable row level security;
alter table public.discount_codes   enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.payments         enable row level security;
alter table public.custom_requests  enable row level security;
alter table public.reviews          enable row level security;
alter table public.settings         enable row level security;

-- ---------- profiles ----------
create policy "profiles: read own or admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());   -- role changes are blocked by the protect_profile_role trigger

create policy "profiles: admin update any"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- addresses ----------
create policy "addresses: manage own"
  on public.addresses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "addresses: admin read"
  on public.addresses for select
  using (public.is_admin());

-- ---------- categories ----------
create policy "categories: public read active"
  on public.categories for select
  using (is_active or public.is_admin());

create policy "categories: admin write"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- products ----------
create policy "products: public read active"
  on public.products for select
  using (is_active or public.is_admin());

create policy "products: admin write"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- product_images ----------
create policy "product_images: public read"
  on public.product_images for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.is_active
    )
  );

create policy "product_images: admin write"
  on public.product_images for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- product_variants ----------
create policy "product_variants: public read active"
  on public.product_variants for select
  using (
    public.is_admin()
    or (
      is_active
      and exists (
        select 1 from public.products p
        where p.id = product_variants.product_id and p.is_active
      )
    )
  );

create policy "product_variants: admin write"
  on public.product_variants for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- discount_codes (admin only; customers use validate_discount_code()) ----------
create policy "discount_codes: admin only"
  on public.discount_codes for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- orders ----------
create policy "orders: read own or admin"
  on public.orders for select
  using (user_id = auth.uid() or public.is_admin());

create policy "orders: admin update"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "orders: admin delete"
  on public.orders for delete
  using (public.is_admin());

-- ---------- order_items ----------
create policy "order_items: read own or admin"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

create policy "order_items: admin write"
  on public.order_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- payments ----------
create policy "payments: read own or admin"
  on public.payments for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = payments.order_id and o.user_id = auth.uid()
    )
  );

create policy "payments: admin write"
  on public.payments for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- custom_requests ----------
create policy "custom_requests: read own or admin"
  on public.custom_requests for select
  using (user_id = auth.uid() or public.is_admin());

create policy "custom_requests: admin update"
  on public.custom_requests for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "custom_requests: admin delete"
  on public.custom_requests for delete
  using (public.is_admin());

-- ---------- reviews ----------
create policy "reviews: public read approved"
  on public.reviews for select
  using (status = 'approved');

create policy "reviews: read own"
  on public.reviews for select
  using (user_id = auth.uid());

create policy "reviews: insert own"
  on public.reviews for insert
  with check (user_id = auth.uid());   -- status/verified are forced by the set_review_defaults trigger

create policy "reviews: delete own"
  on public.reviews for delete
  using (user_id = auth.uid());

create policy "reviews: admin all"
  on public.reviews for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- settings ----------
create policy "settings: public read"
  on public.settings for select
  using (true);

create policy "settings: admin write"
  on public.settings for all
  using (public.is_admin())
  with check (public.is_admin());
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
