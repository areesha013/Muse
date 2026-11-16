-- =====================================================================
-- 0005_checkout.sql  (added in Phase 3)
-- Run AFTER 0001 to 0004. Run once.
--
-- All order logic lives here, inside the database, so a customer can never
-- fake a price, a discount or stock from the browser:
--   quote_cart        price a cart (prices, stock, discount, shipping)
--   create_order      place an order in ONE all-or-nothing step
--   get_order_by_token  order page link (/order/<token>)
--   track_order       order number + phone lookup
--   submit_payment    customer sends JazzCash/Easypaisa/bank proof
-- These functions can only be called by the website's server (service key).
-- =====================================================================

-- Secret link for each order, used on the confirmation page (guests have no login).
alter table public.orders add column access_token uuid not null default gen_random_uuid();
create unique index orders_access_token_idx on public.orders (access_token);

-- ---------------------------------------------------------------------
-- Shipping fee from the "shipping" row in settings.
-- Free shipping is decided on the subtotal BEFORE any discount code.
-- ---------------------------------------------------------------------
create function public.calc_shipping_fee(p_subtotal numeric, p_city text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s          jsonb;
  fee        numeric;
  free_over  numeric;
begin
  select value into s from public.settings where key = 'shipping';
  if s is null then
    return 0;
  end if;

  free_over := nullif(s ->> 'free_shipping_over', '')::numeric;
  if free_over is not null and free_over > 0 and p_subtotal >= free_over then
    return 0;
  end if;

  if coalesce((s ->> 'use_city_rates')::boolean, false) then
    select e.value::numeric into fee
    from jsonb_each_text(s -> 'city_rates') e
    where lower(e.key) = lower(trim(coalesce(p_city, '')))
    limit 1;
    if fee is null then
      fee := coalesce((s ->> 'other_city_rate')::numeric, (s ->> 'flat_rate')::numeric, 0);
    end if;
  else
    fee := coalesce((s ->> 'flat_rate')::numeric, 0);
  end if;

  return round(greatest(fee, 0), 2);
end;
$$;

-- ---------------------------------------------------------------------
-- Looks up every cart line in the database and decides its real price and stock.
-- Input : [{"product_id": "...", "variant_id": "..." or null, "quantity": 2}, ...]
-- Output: [{product_id, variant_id, name, variant_name, unit_price, quantity, stock, problem}, ...]
-- "problem" is null when the line is fine, otherwise:
--   UNAVAILABLE | CHOOSE_OPTION | BAD_QUANTITY | OUT_OF_STOCK
-- ---------------------------------------------------------------------
create function public._resolve_items(p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result        jsonb := '[]'::jsonb;
  r             record;
  prod          public.products%rowtype;
  vrow          public.product_variants%rowtype;
  has_variants  boolean;
  price         numeric;
  stock         integer;
  track         boolean;
  problem       text;
  vname         text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART:Your cart is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS:Too many items in one order.';
  end if;

  -- Same product + option listed twice? Add the quantities together.
  for r in
    select (e ->> 'product_id')::uuid               as pid,
           nullif(e ->> 'variant_id', '')::uuid     as vid,
           sum((e ->> 'quantity')::integer)::integer as qty
    from jsonb_array_elements(p_items) e
    group by 1, 2
    order by 1, 2
  loop
    problem := null;
    vname := null;
    price := 0;
    stock := 0;
    track := true;

    select * into prod from public.products p where p.id = r.pid;

    if not found or not prod.is_active then
      problem := 'UNAVAILABLE';
    else
      select exists (
        select 1 from public.product_variants v where v.product_id = r.pid and v.is_active
      ) into has_variants;

      if has_variants then
        if r.vid is null then
          problem := 'CHOOSE_OPTION';
        else
          select * into vrow
          from public.product_variants v
          where v.id = r.vid and v.product_id = r.pid and v.is_active;
          if not found then
            problem := 'UNAVAILABLE';
          else
            vname := vrow.name;
            price := coalesce(vrow.price_override, prod.base_price);
            stock := vrow.stock_quantity;
          end if;
        end if;
      else
        if r.vid is not null then
          problem := 'UNAVAILABLE';
        else
          price := prod.base_price;
          track := prod.track_stock;
          stock := prod.stock_quantity;
        end if;
      end if;
    end if;

    if problem is null and (r.qty < 1 or r.qty > 99) then
      problem := 'BAD_QUANTITY';
    end if;
    if problem is null and track and r.qty > stock then
      problem := 'OUT_OF_STOCK';
    end if;

    result := result || jsonb_build_object(
      'product_id',   r.pid,
      'variant_id',   r.vid,
      'name',         coalesce(prod.name, 'Unknown item'),
      'variant_name', vname,
      'unit_price',   price,
      'quantity',     r.qty,
      'stock',        case when track then stock else null end,
      'problem',      problem
    );
  end loop;

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- Price a cart (used by the checkout page to show live totals).
-- ---------------------------------------------------------------------
create function public.quote_cart(p_items jsonb, p_city text, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lines     jsonb;
  l         jsonb;
  subtotal  numeric := 0;
  disc      record;
  discount  numeric := 0;
  dvalid    boolean := null;
  dmsg      text := null;
  ship      numeric;
begin
  lines := public._resolve_items(p_items);

  for l in select * from jsonb_array_elements(lines) loop
    if l ->> 'problem' is null then
      subtotal := subtotal + (l ->> 'unit_price')::numeric * (l ->> 'quantity')::integer;
    end if;
  end loop;

  if coalesce(trim(p_code), '') <> '' then
    select * into disc from public.validate_discount_code(p_code, subtotal);
    dvalid := disc.valid;
    dmsg := disc.message;
    discount := case when disc.valid then disc.discount_amount else 0 end;
  end if;

  ship := public.calc_shipping_fee(subtotal, p_city);

  return jsonb_build_object(
    'lines',            lines,
    'subtotal',         subtotal,
    'discount_amount',  discount,
    'discount_valid',   dvalid,
    'discount_message', dmsg,
    'shipping_fee',     ship,
    'total',            subtotal - discount + ship
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Place an order. Everything happens in one transaction: if anything fails
-- (for example the last item sells out a second earlier) nothing is saved,
-- no stock is taken and no discount use is counted.
-- Errors are raised as 'CODE:message' so the website can show a friendly text.
-- ---------------------------------------------------------------------
create function public.create_order(
  p_user_id  uuid,
  p_name     text,
  p_email    text,
  p_phone    text,
  p_city     text,
  p_address  text,
  p_notes    text,
  p_method   public.payment_method,
  p_items    jsonb,
  p_code     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pay        jsonb;
  lines      jsonb;
  l          jsonb;
  subtotal   numeric := 0;
  disc       record;
  discount   numeric := 0;
  code_id    uuid := null;
  code_text  text := null;
  ship       numeric;
  total      numeric;
  oid        uuid;
  onum       text;
  token      uuid;
  ostatus    public.order_status;
  touched    integer;
begin
  -- 1. Contact details
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'INVALID_NAME:Please enter your full name.';
  end if;
  if p_phone is null or p_phone !~ '^03[0-9]{9}$' then
    raise exception 'INVALID_PHONE:Please enter a valid mobile number, like 0300 1234567.';
  end if;
  if length(trim(coalesce(p_city, ''))) < 2 then
    raise exception 'INVALID_CITY:Please enter your city.';
  end if;
  if length(trim(coalesce(p_address, ''))) < 5 then
    raise exception 'INVALID_ADDRESS:Please enter your full delivery address.';
  end if;
  if p_email is not null and trim(p_email) <> '' and p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL:Please enter a valid email address.';
  end if;

  -- 2. Slow down spam: at most 5 orders per phone number per hour
  if (
    select count(*) from public.orders
    where customer_phone = p_phone and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'TOO_MANY_ORDERS:Too many orders from this number. Please try again later.';
  end if;

  -- 3. Payment method must be switched on in settings
  select value -> (p_method::text) into pay from public.settings where key = 'payments';
  if not coalesce((pay ->> 'enabled')::boolean, false) then
    raise exception 'PAYMENT_METHOD_DISABLED:This payment method is not available.';
  end if;

  -- 4. Real prices and availability from the database
  lines := public._resolve_items(p_items);
  for l in select * from jsonb_array_elements(lines) loop
    if l ->> 'problem' is not null then
      raise exception 'ITEM_%:%', l ->> 'problem', l ->> 'name';
    end if;
    subtotal := subtotal + (l ->> 'unit_price')::numeric * (l ->> 'quantity')::integer;
  end loop;

  -- 5. Take the stock. The "stock >= quantity" check makes this safe even when
  --    two customers buy the last item at the same moment: only one succeeds.
  for l in select * from jsonb_array_elements(lines) loop
    if l ->> 'variant_id' is not null then
      update public.product_variants
         set stock_quantity = stock_quantity - (l ->> 'quantity')::integer
       where id = (l ->> 'variant_id')::uuid
         and stock_quantity >= (l ->> 'quantity')::integer;
      get diagnostics touched = row_count;
      if touched = 0 then
        raise exception 'ITEM_OUT_OF_STOCK:%', l ->> 'name';
      end if;
    elsif (l ->> 'stock') is not null then
      -- stock is tracked for this product (the line has a stock number)
      update public.products
         set stock_quantity = stock_quantity - (l ->> 'quantity')::integer
       where id = (l ->> 'product_id')::uuid
         and track_stock
         and stock_quantity >= (l ->> 'quantity')::integer;
      get diagnostics touched = row_count;
      if touched = 0 then
        raise exception 'ITEM_OUT_OF_STOCK:%', l ->> 'name';
      end if;
    end if;
  end loop;

  -- 6. Discount code (counted once, only if the order really goes through)
  if coalesce(trim(p_code), '') <> '' then
    select * into disc from public.validate_discount_code(p_code, subtotal);
    if not disc.valid then
      raise exception 'DISCOUNT_INVALID:%', disc.message;
    end if;
    update public.discount_codes
       set times_used = times_used + 1
     where id = disc.code_id
       and (max_uses is null or times_used < max_uses);
    get diagnostics touched = row_count;
    if touched = 0 then
      raise exception 'DISCOUNT_INVALID:This code has been fully used.';
    end if;
    discount := disc.discount_amount;
    code_id := disc.code_id;
    code_text := upper(trim(p_code));
  end if;

  -- 7. Totals
  ship := public.calc_shipping_fee(subtotal, p_city);
  total := subtotal - discount + ship;

  -- Cash on delivery needs no payment step. Everything else waits for payment.
  ostatus := case when p_method = 'cod' then 'confirmed' else 'pending_payment' end;

  -- 8. Save the order
  insert into public.orders (
    user_id, status, payment_method,
    customer_name, customer_email, customer_phone,
    shipping_city, shipping_address, notes,
    subtotal, discount_amount, shipping_fee, total,
    discount_code_id, discount_code
  ) values (
    p_user_id, ostatus, p_method,
    trim(p_name), nullif(lower(trim(coalesce(p_email, ''))), ''), p_phone,
    trim(p_city), trim(p_address), nullif(trim(coalesce(p_notes, '')), ''),
    subtotal, discount, ship, total,
    code_id, code_text
  )
  returning id, order_number, access_token into oid, onum, token;

  insert into public.order_items (order_id, product_id, variant_id, product_name, variant_name, unit_price, quantity)
  select oid,
         (x ->> 'product_id')::uuid,
         nullif(x ->> 'variant_id', '')::uuid,
         x ->> 'name',
         x ->> 'variant_name',
         (x ->> 'unit_price')::numeric,
         (x ->> 'quantity')::integer
  from jsonb_array_elements(lines) x;

  insert into public.payments (order_id, method, amount, status)
  values (oid, p_method, total, 'pending');

  return jsonb_build_object(
    'order_id',     oid,
    'order_number', onum,
    'access_token', token,
    'status',       ostatus,
    'total',        total
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Turns one order into the JSON the website shows.
-- p_private = true adds name, phone, email and full address (order-page link only).
-- ---------------------------------------------------------------------
create function public._order_json(p_order_id uuid, p_private boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o      public.orders%rowtype;
  pay    public.payments%rowtype;
  items  jsonb;
  result jsonb;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then
    return null;
  end if;
  select * into pay from public.payments where order_id = o.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', oi.product_name,
           'variant_name', oi.variant_name,
           'unit_price', oi.unit_price,
           'quantity', oi.quantity
         ) order by oi.product_name), '[]'::jsonb)
    into items
    from public.order_items oi
   where oi.order_id = o.id;

  result := jsonb_build_object(
    'order_id',          o.id,
    'order_number',      o.order_number,
    'status',            o.status,
    'created_at',        o.created_at,
    'tracking_note',     o.tracking_note,
    'payment_method',    o.payment_method,
    'payment_status',    pay.status,
    'payment_note',      pay.admin_note,
    'has_payment_proof', (pay.receipt_path is not null or pay.transaction_id is not null),
    'city',              o.shipping_city,
    'first_name',        split_part(trim(o.customer_name), ' ', 1),
    'items',             items,
    'subtotal',          o.subtotal,
    'discount_amount',   o.discount_amount,
    'discount_code',     o.discount_code,
    'shipping_fee',      o.shipping_fee,
    'total',             o.total
  );

  if p_private then
    result := result || jsonb_build_object(
      'name',    o.customer_name,
      'phone',   o.customer_phone,
      'email',   o.customer_email,
      'address', o.shipping_address,
      'notes',   o.notes
    );
  end if;

  return result;
end;
$$;

create function public.get_order_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public._order_json(o.id, true) from public.orders o where o.access_token = p_token;
$$;

-- Order number + phone number: shows status only, never the full address.
create function public.track_order(p_number text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public._order_json(o.id, false)
  from public.orders o
  where o.order_number = upper(trim(p_number)) and o.customer_phone = p_phone;
$$;

-- ---------------------------------------------------------------------
-- Customer sends proof of payment (JazzCash / Easypaisa / bank transfer).
-- The file itself is uploaded by the website to the private "receipts" bucket first.
-- Returns the previous receipt path (if any) so the old file can be deleted.
-- ---------------------------------------------------------------------
create function public.submit_payment(
  p_token           uuid,
  p_sender_name     text,
  p_transaction_id  text,
  p_receipt_path    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o    public.orders%rowtype;
  pay  public.payments%rowtype;
  old_path text;
begin
  select * into o from public.orders where access_token = p_token;
  if not found then
    raise exception 'ORDER_NOT_FOUND:We could not find this order.';
  end if;
  if o.payment_method = 'cod' then
    raise exception 'NO_PAYMENT_NEEDED:This is a cash on delivery order.';
  end if;
  if o.status <> 'pending_payment' then
    raise exception 'ORDER_CLOSED:This order no longer needs a payment.';
  end if;

  select * into pay from public.payments where order_id = o.id for update;
  if pay.status = 'verified' then
    raise exception 'PAYMENT_LOCKED:Your payment is already confirmed.';
  end if;

  old_path := pay.receipt_path;

  update public.payments
     set status         = 'submitted',
         sender_name    = coalesce(nullif(trim(p_sender_name), ''), sender_name),
         transaction_id = coalesce(nullif(trim(p_transaction_id), ''), transaction_id),
         receipt_path   = coalesce(p_receipt_path, receipt_path),
         admin_note     = null
   where id = pay.id;

  return jsonb_build_object('ok', true, 'old_receipt_path', case when p_receipt_path is not null then old_path end);
end;
$$;

-- ---------------------------------------------------------------------
-- Cancelling an order puts the stock (and the discount use) back.
-- A cancelled order can't be reopened (stock may already be sold again).
-- ---------------------------------------------------------------------
create function public.restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened. Please create a new order instead.';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.product_variants v
       set stock_quantity = v.stock_quantity + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.variant_id = v.id;

    update public.products p
       set stock_quantity = p.stock_quantity + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.variant_id is null and oi.product_id = p.id and p.track_stock;

    if new.discount_code_id is not null then
      update public.discount_codes
         set times_used = greatest(times_used - 1, 0)
       where id = new.discount_code_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_restore_stock
  before update of status on public.orders
  for each row execute function public.restore_stock_on_cancel();

-- ---------------------------------------------------------------------
-- Only the website's server (service key) may call these.
-- ---------------------------------------------------------------------
revoke all on function public.calc_shipping_fee(numeric, text)                      from public, anon, authenticated;
revoke all on function public._resolve_items(jsonb)                                 from public, anon, authenticated;
revoke all on function public.quote_cart(jsonb, text, text)                         from public, anon, authenticated;
revoke all on function public.create_order(uuid, text, text, text, text, text, text, public.payment_method, jsonb, text)
                                                                                    from public, anon, authenticated;
revoke all on function public._order_json(uuid, boolean)                            from public, anon, authenticated;
revoke all on function public.get_order_by_token(uuid)                              from public, anon, authenticated;
revoke all on function public.track_order(text, text)                               from public, anon, authenticated;
revoke all on function public.submit_payment(uuid, text, text, text)                from public, anon, authenticated;

grant execute on function public.calc_shipping_fee(numeric, text)                   to service_role;
grant execute on function public._resolve_items(jsonb)                              to service_role;
grant execute on function public.quote_cart(jsonb, text, text)                      to service_role;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, public.payment_method, jsonb, text)
                                                                                    to service_role;
grant execute on function public._order_json(uuid, boolean)                         to service_role;
grant execute on function public.get_order_by_token(uuid)                           to service_role;
grant execute on function public.track_order(text, text)                            to service_role;
grant execute on function public.submit_payment(uuid, text, text, text)             to service_role;
