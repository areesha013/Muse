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
