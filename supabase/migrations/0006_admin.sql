-- =====================================================================
-- 0006_admin.sql : admin panel functions (Phase 4)
-- Run AFTER 0005_checkout.sql. Run it once.
--
--   admin_set_order_status   move an order forward (or cancel it), with safe rules
--   admin_review_payment     verify or reject a customer's payment proof
--   admin_dashboard_stats    numbers for the admin home page
--
-- Every function checks public.is_admin() first. A customer or a visitor
-- who calls them gets FORBIDDEN, even if they find the function name.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Change an order's status.
-- Allowed moves:
--   pending_payment -> confirmed (only after the payment is verified), cancelled
--   confirmed       -> packed, cancelled
--   packed          -> shipped, cancelled
--   shipped         -> delivered
--   delivered, cancelled: final
-- Cancelling puts the stock back (trigger from 0005).
-- p_note replaces the "tracking note" the customer sees. Pass null to keep it.
-- ---------------------------------------------------------------------
create function public.admin_set_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o   public.orders%rowtype;
  pay public.payments%rowtype;
  allowed boolean;
  refund boolean := false;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN:Only an admin can do this.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND:Order not found.';
  end if;

  if p_note is not null and length(p_note) > 500 then
    raise exception 'NOTE_TOO_LONG:The note is too long (500 characters max).';
  end if;

  if p_status = o.status then
    -- Same status: only the note may change.
    update public.orders set tracking_note = nullif(trim(p_note), '') where id = o.id and p_note is not null;
    return jsonb_build_object('ok', true, 'status', o.status, 'refund_needed', false);
  end if;

  allowed := case o.status
    when 'pending_payment' then p_status in ('confirmed', 'cancelled')
    when 'confirmed'       then p_status in ('packed', 'cancelled')
    when 'packed'          then p_status in ('shipped', 'cancelled')
    when 'shipped'         then p_status = 'delivered'
    else false
  end;
  if not allowed then
    raise exception 'BAD_TRANSITION:An order that is "%" cannot be changed to "%".', o.status, p_status;
  end if;

  select * into pay from public.payments where order_id = o.id;

  if o.status = 'pending_payment' and p_status = 'confirmed'
     and o.payment_method <> 'cod' and coalesce(pay.status::text, '') <> 'verified' then
    raise exception 'PAYMENT_NOT_VERIFIED:Verify the payment first. That confirms the order.';
  end if;

  if p_status = 'cancelled' and pay.status = 'verified' and o.payment_method <> 'cod' then
    refund := true;   -- money was received: the owner must refund it by hand
  end if;

  update public.orders
     set status = p_status,
         tracking_note = case when p_note is null then tracking_note else nullif(trim(p_note), '') end
   where id = o.id;

  -- A cash-on-delivery order is paid when it is delivered.
  if p_status = 'delivered' and o.payment_method = 'cod' then
    update public.payments
       set status = 'verified', verified_by = auth.uid(), verified_at = now()
     where order_id = o.id and status <> 'verified';
  end if;

  return jsonb_build_object('ok', true, 'status', p_status, 'refund_needed', refund);
end;
$$;

-- ---------------------------------------------------------------------
-- Verify or reject a payment.
--   verify: payment becomes "verified" and a waiting order becomes "confirmed".
--           Allowed from "submitted" or "pending" (e.g. customer paid and told you on WhatsApp).
--   reject: payment becomes "rejected" with your note. The customer sees the note and can send proof again.
-- ---------------------------------------------------------------------
create function public.admin_review_payment(
  p_order_id uuid,
  p_action   text,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o   public.orders%rowtype;
  pay public.payments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN:Only an admin can do this.';
  end if;
  if p_action not in ('verify', 'reject') then
    raise exception 'BAD_ACTION:Unknown action.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND:Order not found.';
  end if;
  select * into pay from public.payments where order_id = o.id for update;
  if not found then
    raise exception 'NO_PAYMENT:This order has no payment record.';
  end if;
  if o.payment_method = 'cod' then
    raise exception 'NO_PAYMENT_NEEDED:Cash on delivery orders do not need payment verification.';
  end if;
  if o.status = 'cancelled' then
    raise exception 'ORDER_CLOSED:This order is cancelled.';
  end if;
  if length(coalesce(p_note, '')) > 300 then
    raise exception 'NOTE_TOO_LONG:The note is too long (300 characters max).';
  end if;

  if p_action = 'verify' then
    if pay.status = 'verified' then
      raise exception 'ALREADY_VERIFIED:This payment is already verified.';
    end if;
    update public.payments
       set status = 'verified', verified_by = auth.uid(), verified_at = now(),
           admin_note = nullif(trim(p_note), '')
     where id = pay.id;
    if o.status = 'pending_payment' then
      update public.orders set status = 'confirmed' where id = o.id;
    end if;
    return jsonb_build_object('ok', true, 'payment_status', 'verified', 'order_status',
             case when o.status = 'pending_payment' then 'confirmed' else o.status::text end);
  end if;

  -- reject
  if pay.status = 'verified' then
    raise exception 'ALREADY_VERIFIED:This payment is already verified. Cancel the order instead.';
  end if;
  if o.status <> 'pending_payment' then
    raise exception 'ORDER_CLOSED:Only orders waiting for payment can have their payment rejected.';
  end if;
  if length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'NOTE_REQUIRED:Tell the customer why (for example: transaction ID not found).';
  end if;
  update public.payments
     set status = 'rejected', admin_note = trim(p_note), verified_by = auth.uid(), verified_at = now()
   where id = pay.id;
  return jsonb_build_object('ok', true, 'payment_status', 'rejected', 'order_status', o.status);
end;
$$;

-- ---------------------------------------------------------------------
-- Numbers for the admin home page. "Sales" = orders that are not cancelled
-- and not still waiting for payment. Days are counted in Pakistan time.
-- ---------------------------------------------------------------------
create function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi';
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN:Only an admin can do this.';
  end if;

  select jsonb_build_object(
    'orders_by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        from (select status, count(*) n from public.orders group by status) s
    ),
    'new_today', (select count(*) from public.orders where created_at >= today_start),
    'payments_to_review', (select count(*) from public.payments where status = 'submitted'),
    'sales_today', (
      select coalesce(sum(total), 0) from public.orders
       where created_at >= today_start and status not in ('cancelled', 'pending_payment')
    ),
    'sales_30d', (
      select coalesce(sum(total), 0) from public.orders
       where created_at >= now() - interval '30 days' and status not in ('cancelled', 'pending_payment')
    ),
    'orders_30d', (
      select count(*) from public.orders
       where created_at >= now() - interval '30 days' and status <> 'cancelled'
    ),
    'reviews_pending', (select count(*) from public.reviews where status = 'pending'),
    'custom_requests_new', (select count(*) from public.custom_requests where status = 'new'),
    'subscribers', (select count(*) from public.newsletter_subscribers),
    'low_stock', (
      select coalesce(jsonb_agg(x order by (x ->> 'stock')::int, x ->> 'name'), '[]'::jsonb) from (
        select jsonb_build_object('product_id', p.id, 'name', p.name, 'variant', null, 'stock', p.stock_quantity) x
          from public.products p
         where p.is_active and p.track_stock and p.stock_quantity <= 3
           and not exists (select 1 from public.product_variants v where v.product_id = p.id)
        union all
        select jsonb_build_object('product_id', p.id, 'name', p.name, 'variant', v.name, 'stock', v.stock_quantity)
          from public.product_variants v join public.products p on p.id = v.product_id
         where p.is_active and v.is_active and v.stock_quantity <= 3
      ) t
    ),
    'recent_orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', id, 'order_number', order_number, 'customer_name', customer_name,
               'total', total, 'status', status, 'created_at', created_at
             ) order by created_at desc), '[]'::jsonb)
        from (select * from public.orders order by created_at desc limit 6) r
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'orders', coalesce(c.n, 0), 'sales', coalesce(c.s, 0)) order by d), '[]'::jsonb)
        from generate_series((now() at time zone 'Asia/Karachi')::date - 13, (now() at time zone 'Asia/Karachi')::date, interval '1 day') d
        left join (
          select (created_at at time zone 'Asia/Karachi')::date as day, count(*) n,
                 sum(total) filter (where status not in ('cancelled', 'pending_payment')) s
            from public.orders where status <> 'cancelled' group by 1
        ) c on c.day = d::date
    )
  ) into result;

  return result;
end;
$$;

-- Callable by logged-in users, but each function refuses non-admins.
revoke all on function public.admin_set_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.admin_review_payment(uuid, text, text)                   from public, anon;
revoke all on function public.admin_dashboard_stats()                                  from public, anon;
grant execute on function public.admin_set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.admin_review_payment(uuid, text, text)                   to authenticated;
grant execute on function public.admin_dashboard_stats()                                  to authenticated;
