-- =====================================================================
-- 0004_newsletter_and_reviewer_name.sql  (added in Phase 2)
-- Run AFTER 0001, 0002, 0003 (and seed.sql if you use it). Run once.
--
--  1. newsletter_subscribers : emails from the home page sign-up box
--  2. reviews.author_name    : first name + last initial shown next to a review
--     (customers cannot read other people's profiles, so the name is copied
--      onto the review itself when it is written)
-- =====================================================================

-- ---------- 1. Newsletter ----------
create table public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique
              check (email = lower(email) and position('@' in email) > 1),
  created_at  timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- Visitors sign up through server code (service key). Only admins can read the list.
create policy "newsletter: admin only"
  on public.newsletter_subscribers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- 2. Reviewer display name ----------
alter table public.reviews add column author_name text;

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
