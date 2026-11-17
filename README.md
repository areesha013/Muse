# Handmade Shop (stickers + crochet)

Next.js 14 + TypeScript + Tailwind + Supabase. Built in phases.

| Phase | Status |
|---|---|
| 1. Project setup, database, security, storage | Done |
| 2. Home, shop, product pages, cart | Done |
| 3. Checkout, payments, order tracking | Done |
| 4. Login + admin dashboard | Done |
| 5. Reviews, discount codes, custom orders | Next |
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
7. `supabase/migrations/0006_admin.sql` (added in Phase 4)

Shortcut: `supabase/setup_all.sql` is files 1 to 3 combined.
You should see "Success" each time. Do not run any file twice.

**Already did through Phase 3?** Run ONLY file 7 (0006). Nothing else.
**Only did Phase 1 and 2?** Run files 6 and 7.
**Only did Phase 1?** Run files 5, 6 and 7.

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

### 6. Make yourself the first admin
1. Sign up on the site once (`/signup`).
2. In Supabase SQL Editor run (use your email):
```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```
Only the SQL Editor can create the first admin. Nobody can promote themselves from the website.

## What to customize
- Brand name, tagline, WhatsApp number: `src/config/site.ts`
- Store info, shipping rates, JazzCash/Easypaisa/bank details: **Admin > Settings** (no code needed)
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
  migrations/0006_admin.sql    admin functions: order status, payment review, dashboard numbers
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

## Phase 4: what was added
- **Login, sign up, My account** (`/login`, `/signup`, `/account`). Customers see their own orders.
- **Admin panel** at `/admin` (only for admins): dashboard, orders, products, categories, settings.

### First time: become admin
1. Run `0006_admin.sql` in the Supabase SQL Editor (once).
2. Supabase > Authentication > Providers > Email: for now turn **Confirm email OFF** (easier while testing). Turn it back ON before launch.
3. Supabase > Authentication > URL Configuration: set **Site URL** to `http://localhost:3000`.
4. Restart `npm run dev`, open `/signup` and create your account.
5. Run the "first admin" SQL from step 6 above, with your email.
6. Log out and in again. You will see an **Admin panel** button in My account.

### Admin guide
| Job | Where |
|---|---|
| Check customer payments (JazzCash, Easypaisa, bank) | Dashboard > "Payments to check", or Orders > "Check payment" |
| Verify or reject a payment | Open the order. Rejecting needs a reason. The customer sees it and can send again. |
| Move an order: packed, shipped, delivered | Open the order > Update this order. Add a note (courier, tracking). The customer sees it on Track order. |
| Cancel an order | Open the order > Cancel. It asks twice. Items go back into stock. |
| Add or edit a product, photos, options | Products |
| Hide a product without deleting it | Products > open it > untick "Show in the shop" |
| Change payment details, shipping, store info | Settings |

### Good to know
- Photos: pick any JPG, PNG or WebP. Big photos are shrunk in your browser before upload.
- Changes show in the shop within a moment. No redeploy is needed.
- Order flow is fixed: waiting for payment > confirmed > packed > shipped > delivered. Cancel is possible until shipped.
- A cancelled order with a verified online payment shows **Refund needed**. Send the money back yourself, then tell the customer on WhatsApp.
- Cash on delivery counts as paid when you mark it delivered.

### Security layers (admin)
1. Logged-out visitors are sent to login.
2. Logged-in customers see "No admin access" and no data.
3. Every admin action checks your role again on the server.
4. The database itself refuses admin changes from anyone who is not an admin.

### Known limits (planned)
- Edit payment details in Settings before launch. The pages warn you while they are still placeholders.
- No "forgot password" page yet.
- Reviews, discount codes and custom requests: the dashboard shows counts. The screens come in Phase 5.
- The shop list has no pages yet (fine for a small shop).

### Troubleshooting (Phase 4)
- **"permission denied for function admin_dashboard_stats"**: you are not admin yet, or `0006_admin.sql` was not run.
- **Signup says "check your email"**: Confirm email is ON in Supabase. Confirm via the email, or turn it OFF while testing.
- **Login goes in a circle**: Site URL in Supabase must match the address you open (`http://localhost:3000`).
- **Photo upload fails**: run `0003_storage.sql` and check `SUPABASE_SERVICE_ROLE_KEY`.
