-- =====================================================================
-- seed.sql : sample data so the site isn't empty while you build.
-- Run AFTER 0001, 0002, 0003. Safe to delete or replace later from the admin panel.
-- All names, prices and payment details below are PLACEHOLDERS.
-- =====================================================================

-- ---------- Categories (3) ----------
insert into public.categories (name, slug, description, sort_order) values
  ('Stickers', 'stickers', 'Waterproof vinyl stickers and sticker sheets.', 1),
  ('Crochet',  'crochet',  'Handmade crochet keychains, plushies and flowers.', 2),
  ('Wearables','wearables','Crochet bags, hats and scarves.', 3);

-- ---------- Products (12) ----------
insert into public.products (category_id, name, slug, description, base_price, compare_at_price, is_featured, stock_quantity)
select c.id, p.name, p.slug, p.description, p.base_price, p.compare_at_price, p.is_featured, p.stock
from (values
  ('stickers', 'Pastel Flowers Sticker Sheet', 'pastel-flowers-sticker-sheet', 'A5 sheet of 12 waterproof flower stickers.', 450, null, true, 40),
  ('stickers', 'Retro Mushroom Sticker Sheet', 'retro-mushroom-sticker-sheet', 'A5 sheet of 10 waterproof mushroom stickers.', 450, null, false, 35),
  ('stickers', 'Mini Cats Sticker Sheet', 'mini-cats-sticker-sheet', 'A6 sheet of 15 tiny cat stickers.', 350, null, false, 50),
  ('stickers', 'Single Sticker: Daisy', 'single-sticker-daisy', 'One 7 cm waterproof vinyl daisy sticker.', 120, null, false, 100),
  ('stickers', 'Single Sticker: Coffee Cup', 'single-sticker-coffee-cup', 'One 7 cm waterproof vinyl coffee cup sticker.', 120, null, false, 100),
  ('crochet',  'Crochet Bear Keychain', 'crochet-bear-keychain', 'Handmade amigurumi bear keychain, about 6 cm.', 900, 1100, true, 0),
  ('crochet',  'Crochet Strawberry Keychain', 'crochet-strawberry-keychain', 'Handmade crochet strawberry keychain.', 700, null, false, 15),
  ('crochet',  'Crochet Bunny Plushie', 'crochet-bunny-plushie', 'Soft handmade bunny plushie, about 20 cm.', 2200, null, true, 6),
  ('crochet',  'Crochet Sunflower', 'crochet-sunflower', 'Long-lasting crochet sunflower on a wire stem.', 500, null, false, 25),
  ('crochet',  'Crochet Tulip Bouquet', 'crochet-tulip-bouquet', 'Bouquet of 5 crochet tulips, wrapped.', 2500, null, true, 8),
  ('wearables','Crochet Tote Bag', 'crochet-tote-bag', 'Roomy handmade crochet tote bag.', 3500, null, false, 5),
  ('wearables','Crochet Bucket Hat', 'crochet-bucket-hat', 'Handmade crochet bucket hat.', 2800, null, false, 0)
) as p(cat_slug, name, slug, description, base_price, compare_at_price, is_featured, stock)
join public.categories c on c.slug = p.cat_slug;

-- ---------- Bundles (2): no category, flagged is_bundle ----------
insert into public.products (category_id, name, slug, description, base_price, compare_at_price, is_bundle, is_featured, stock_quantity) values
  (null, 'Sticker Lover Bundle', 'sticker-lover-bundle', '3 sticker sheets + 3 single stickers, gift wrapped.', 1500, 1830, true, true, 20),
  (null, 'Cozy Gift Set', 'cozy-gift-set', 'Crochet keychain + 2 sticker sheets + a handwritten note.', 2200, 2450, true, true, 10);

-- ---------- Variants for products that come in options ----------
-- Products with variants use variant stock instead of the product's own stock.
insert into public.product_variants (product_id, name, options, stock_quantity, sort_order)
select p.id, v.name, v.options::jsonb, v.stock, v.sort_order
from (values
  ('crochet-bear-keychain', 'Brown',  '{"color":"Brown"}',  5, 1),
  ('crochet-bear-keychain', 'Cream',  '{"color":"Cream"}',  4, 2),
  ('crochet-bear-keychain', 'Pink',   '{"color":"Pink"}',   0, 3),
  ('crochet-bucket-hat',    'Beige / Medium', '{"color":"Beige","size":"Medium"}', 0, 1),
  ('crochet-bucket-hat',    'Sage / Medium',  '{"color":"Sage","size":"Medium"}',  3, 2)
) as v(slug, name, options, stock, sort_order)
join public.products p on p.slug = v.slug;

-- ---------- Placeholder image for every product (swap in the admin panel later) ----------
insert into public.product_images (product_id, url, alt, sort_order)
select id, '/placeholder.svg', name, 0 from public.products;

-- ---------- Sample discount code ----------
insert into public.discount_codes (code, type, value, min_order, max_uses, expires_at)
values ('WELCOME10', 'percentage', 10, 1000, 100, now() + interval '1 year');

-- ---------- Default settings (all PLACEHOLDERS, edit in the admin panel) ----------
insert into public.settings (key, value) values
  ('store', '{
    "name": "MUSE",
    "email": "hello@example.com",
    "phone": "03000000000",
    "address": "Lahore, Pakistan",
    "instagram": ""
  }'),
  ('shipping', '{
    "flat_rate": 250,
    "free_shipping_over": 3000,
    "use_city_rates": false,
    "city_rates": { "Lahore": 150, "Karachi": 250, "Islamabad": 250 },
    "other_city_rate": 300
  }'),
  ('payments', '{
    "cod":       { "enabled": true },
    "jazzcash":  { "enabled": true, "account_title": "Your Name", "number": "03XX-XXXXXXX" },
    "easypaisa": { "enabled": true, "account_title": "Your Name", "number": "03XX-XXXXXXX" },
    "bank_transfer": { "enabled": true, "bank_name": "Your Bank", "account_title": "Your Name", "account_number": "0000000000", "iban": "PK00XXXX0000000000000000" }
  }');
