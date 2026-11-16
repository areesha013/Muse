# Handmade Shop (stickers + crochet)

Next.js 14 + TypeScript + Tailwind + Supabase. Built in phases.

| Phase | Status |
|---|---|
| 1. Project setup, database, security, storage | Done |
| 2. Home, shop, product pages, cart | Done |
| 3. Checkout, payments, order tracking | Done |
| 4. Admin dashboard | Next |
| 5. Reviews, discount codes, custom orders | |
| 6. Testing, deploy, domain | |

## Phase 1 setup (about 15 minutes)

### 1. Create your Supabase project
1. Go to supabase.com and sign up (free).
2. Click **New project**. Choose a name and a strong database password. Save the password.
3. Pick the region closest to your customers.
4. Wait about 2 minutes for it to finish.

### 2. Run the database SQL
Open **SQL Editor** > **New query**. Paste and **Run**, in this order:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_storage.sql`
4. `supabase/seed.sql` (sample data, optional)
5. `supabase/migrations/0004_newsletter_and_reviewer_name.sql` (added in Phase 2)
6. `supabase/migrations/0005_checkout.sql` (added in Phase 3)

Shortcut: `supabase/setup_all.sql` is files 1 to 3 combined.
You should see "Success" each time. Do not run any file twice.

**Already did Phase 1 and 2?** Run ONLY file 6 (0005). Nothing else.
**Only did Phase 1?** Run files 5 and 6.

### 3. Check it worked
- **Table Editor** should list: profiles, categories, products, orders and more.
- **Storage** should list 4 buckets: product-images, review-photos, receipts, custom-requests.
- **Authentication > Policies** should show policies on every table.

### 4. Add your keys
1. In Supabase, open **Project Settings > API**.
2. Copy `.env.example` to a new file named `.env.local`.
3. Fill in the Project URL, the `anon` key and the `service_role` key.
4. The `service_role` key is a secret. Never share it, never put it in browser code, never commit it.

### 5. Run the site on your computer
```bash
npm install
npm run dev
```
Open http://localhost:3000.

### 6. Make yourself the first admin (do this after Phase 4 adds login)
1. Sign up on the site once.
2. In Supabase SQL Editor run (use your email):
```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```
Only the SQL Editor can create the first admin. Nobody can promote themselves from the website.

## What to customize
- Brand name, tagline, WhatsApp number: `src/config/site.ts`
- Store info, shipping rates, JazzCash/Easypaisa/bank details: the `settings` table (admin panel in Phase 4)
- Logo and colors: Phase 2

## How security works
- The public can only read active products, approved reviews and store settings.
- Customers only see their own orders.
- Only admins can change products, orders, settings and discount codes.
- Guest checkout, order tracking and custom requests run in server code with the service key. The browser never gets that key.
- Stock can never go below zero (the database refuses it), so you cannot oversell.
- Do not put secrets in the `settings` table. Everything in it is public.

## Files
```
supabase/
  migrations/0001_schema.sql   tables, triggers
  migrations/0002_rls.sql      who can see and edit what
  migrations/0003_storage.sql  image buckets
  migrations/0004_...sql       newsletter, reviewer names
  migrations/0005_checkout.sql order functions: price, stock, discount, shipping
  seed.sql                     sample products, settings, 1 discount code
  setup_all.sql                files 1 to 3 combined
src/config/site.ts             brand name, tagline, WhatsApp
src/lib/supabase/              browser, server and admin clients
src/middleware.ts              login session + protects /admin and /account
```

## Phase 2: what was added
- Home, Shop (search, category, price, in-stock, sort), Product pages (gallery, options, stock, reviews)
- Cart drawer (saved in the browser). The Checkout button goes to /checkout.
- About, Contact, FAQ, Shipping and returns, sitemap, robots, 404 page
- Newsletter sign-up (needs migration 0004)

### Edit these before launch
| What | File |
|---|---|
| Brand colors | `tailwind.config.ts` (3 colors, top of file) |
| Hero text, menu links | `src/config/site.ts` |
| About, FAQ, shipping and returns text | `src/content/pages.ts` (draft text, please read it) |
| Product photos | Admin panel (Phase 4). For now they show a placeholder. |

### Troubleshooting
- **Shop says "We're stocking the shelves"**: the site can't read products. Check `.env.local` has the URL and anon key, that you ran `seed.sql`, then restart `npm run dev`.
- **Changes in the database take up to 60 seconds to appear** on public pages. That keeps the site fast.
- **After editing `.env.local`**, stop the site (Ctrl+C) and run `npm run dev` again.

## Phase 3: what was added
- `/checkout`: contact + city + address, payment choice, discount code, live totals from the server.
- `/order/<secret link>`: order page with progress bar, payment details (copy buttons), proof form, items, delivery details.
- `/track-order`: order number + phone gives status only (no address or full name).
- Payments: Cash on delivery (order is confirmed at once), JazzCash / Easypaisa (sender name + transaction ID, screenshot optional), Bank transfer (receipt photo required).
- Receipts go to the private `receipts` bucket. Only JPG, PNG or WebP up to 5 MB. The file type is checked by its content, not its name.

### How it stays safe
- Prices, stock, shipping and discounts are worked out in the database. The browser's numbers are for display only.
- The last item can only be bought once. If two people click together, one gets a "sold out" message.
- Cancelling an order puts the stock (and the discount use) back.
- Spam: a hidden trap field plus a limit of 5 orders per phone per hour.

### Edit these before launch
| What | Where |
|---|---|
| JazzCash / Easypaisa / bank account details (the pages show "Your Name", "03XX-XXXXXXX") | `settings` table, row `payments` (admin panel in Phase 4) |
| Shipping fee and free-shipping amount | `settings` table, row `shipping` |
| Turn a payment method off | `settings` > `payments` > set `"enabled": false` |

### Known limits (planned)
- If a customer loses the order link on a JazzCash/bank order, they cannot send proof from tracking. They can message you on WhatsApp. Email links come in Phase 5.
- There are no photos yet. Add them in the admin panel (Phase 4).
- Extra spam protection (Cloudflare Turnstile) is planned for Phase 6.

### Troubleshooting (Phase 3)
- **"Something went wrong" on Place order**: you probably skipped `0005_checkout.sql`. Run it once.
- **Receipt upload fails**: run `0003_storage.sql` (creates the `receipts` bucket) and check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
- **Order page shows 404**: the link must be the full `/order/<long code>` link.
