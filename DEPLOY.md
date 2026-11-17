# Put MUSE on the internet

Do the parts in order. Each part takes 5 to 15 minutes.
Cost to start: Rs 0 (GitHub, Vercel, Supabase, Resend and Cloudflare all have free plans). A domain costs money each year.

| Part | What | Needed? |
|---|---|---|
| 1 | Check the shop is ready | Yes |
| 2 | Put the code on GitHub | Yes |
| 3 | Publish on Vercel | Yes |
| 4 | Tell Supabase your live address | Yes |
| 5 | Emails (Supabase + Resend) | Strongly advised |
| 6 | Your own domain | Optional (you get a free `.vercel.app` address) |
| 7 | Turnstile spam protection | Advised |
| 8 | Test the live shop | Yes |

---

## Part 1. Check the shop is ready

Open **Admin > Dashboard**. The box "Before you open the shop" lists what is missing.

| Item | Where to fix it |
|---|---|
| Real payment details | Admin > Settings |
| Product photos | Admin > Products |
| Your WhatsApp number | `src/config/site.ts` (`whatsappNumber`, like `923001234567`, no `+` or spaces) |
| Your tagline | `src/config/site.ts` (`tagline`) |
| Real website address | Part 3 below |

Also run `npm run build` once on your computer. If it ends without red errors, the site will build on Vercel too.

---

## Part 2. Put the code on GitHub

1. Install Git from https://git-scm.com (keep the default choices).
2. Log in at https://github.com. Click **New repository**. Name it `muse-shop`. Choose **Private**. Do NOT tick "Add a README". Click **Create**.
3. Open a terminal in `C:\Projects\shop` and run these one at a time:

```
git init
git add .
git commit -m "MUSE shop"
git branch -M main
git remote add origin https://github.com/areesha013/muse-shop.git
git push -u origin main
```

4. Refresh the GitHub page. You should see your files.

**Safety check:** the file `.env.local` must NOT be on GitHub. It is blocked by `.gitignore`, so it should not be. It holds your secret keys. If it ever gets uploaded, go to Supabase > Project Settings > API and reset the keys.

---

## Part 3. Publish on Vercel

1. Go to https://vercel.com and sign up with GitHub.
2. Click **Add New > Project**. Pick `muse-shop`. Click **Import**.
3. Open **Environment Variables**. Add these (names must match exactly):

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase > Project Settings > API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` `public` key | |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key | Secret. Never share. |
| `NEXT_PUBLIC_SITE_URL` | `https://muse-shop.vercel.app` | Use the address Vercel gives you. No `/` at the end. Change later if you buy a domain. |
| `RESEND_API_KEY` | from Part 5 | Optional |
| `OWNER_EMAIL` | the email where you want alerts | Optional |
| `EMAIL_FROM` | `MUSE <orders@yourdomain.com>` | Optional, needs your own domain |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from Part 7 | Optional |
| `TURNSTILE_SECRET_KEY` | from Part 7 | Optional |

4. Click **Deploy**. Wait 2 to 3 minutes. Click the picture of your site.
5. Copy your real address. If it is not what you typed for `NEXT_PUBLIC_SITE_URL`, fix it in **Settings > Environment Variables** and click **Redeploy** (Deployments tab, the three dots).

**Speed tip:** your Supabase project is in Mumbai. In Vercel go to **Settings > Functions > Function Region** and choose **Mumbai (bom1)**. Pages load faster for Pakistan.

**Important:** every time you change an environment variable, you must **Redeploy** for it to take effect.

---

## Part 4. Tell Supabase your live address

Without this, login links in emails point to the wrong place.

1. Supabase > **Authentication > URL Configuration**.
2. **Site URL**: your live address, like `https://muse-shop.vercel.app`.
3. **Redirect URLs**: click **Add URL** and add both:
   - `https://muse-shop.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`
4. Click **Save**.

Later, when you get a domain, add `https://yourdomain.com/auth/callback` too and change Site URL.

---

## Part 5. Emails

The shop works without emails. But signup confirmation and password reset need them.

**The catch:** Supabase's built-in email sender allows only a few emails per hour. That is fine for testing and too small for a real shop. Fix it with your own sender. Resend has a free plan.

1. Make an account at https://resend.com.
2. **API Keys > Create API Key**. Copy it. Put it in Vercel as `RESEND_API_KEY`.
3. **Domains > Add Domain**. This needs a domain you own (Part 6). Add the DNS records Resend shows. Wait until it says **Verified**.
4. In Vercel set `EMAIL_FROM` to `MUSE <orders@yourdomain.com>` and `OWNER_EMAIL` to your own email. Redeploy.
5. So Supabase also sends its emails through Resend: Supabase > **Authentication > SMTP Settings** > turn on **Custom SMTP**:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender email | `orders@yourdomain.com` |
| Sender name | `MUSE` |

Until you have a domain: leave emails off. Customers can still order and track orders by link and WhatsApp. For your own testing, turn **Confirm email** OFF in Supabase > Authentication > Providers > Email (turn it back ON before launch).

**Password reset on a different device:** the reset link works in the same browser where the person asked for it. That is how Supabase's secure login works. If someone opens it on another phone, they see "That link did not work" and can ask again.

---

## Part 6. Your own domain (optional)

1. Buy a domain (for example at Namecheap or GoDaddy for `.com`, or PKNIC for `.pk`).
2. Vercel > your project > **Settings > Domains > Add**. Type `yourdomain.com`.
3. Vercel shows DNS records. Add exactly those at the place you bought the domain. They usually look like this:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Use the values Vercel shows if they differ. Waiting time: a few minutes to a few hours.

4. When Vercel shows a green tick: change `NEXT_PUBLIC_SITE_URL` to `https://yourdomain.com`, **Redeploy**.
5. Update Supabase URL Configuration (Part 4) with the new address.
6. Do Part 5 step 3 (Resend domain) and add the new address to Turnstile (Part 7).

---

## Part 7. Turnstile spam protection (free)

It blocks bots on signup, checkout, custom orders and password reset. People almost never see it.

1. Go to https://dash.cloudflare.com and sign up (free). Open **Turnstile** in the left menu.
2. **Add widget**. Name: `MUSE`. Hostnames: your domain, plus `muse-shop.vercel.app` (and `localhost` if you want to test on your computer).
3. Widget mode: **Managed**.
4. Copy the **Site key** and **Secret key** into Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. **Redeploy.**

Both keys are needed. With only one, the check stays off (so nobody gets locked out by mistake).
If Cloudflare itself is down for a moment, customers are let through, so you do not lose orders.

**Optional extra:** do NOT also turn on "CAPTCHA protection" inside Supabase. The tokens work only once, and the shop already checks them.

---

## Part 8. Test the live shop

Do this on your phone, using mobile data (not your home Wi-Fi), as if you were a customer.

| # | Test | Expected |
|---|---|---|
| 1 | Open the home page | Loads fast, photos show |
| 2 | Add a product, go to checkout, order with Cash on delivery | Order page opens with an order number |
| 3 | Admin > Orders | The order is there |
| 4 | Order with JazzCash and send proof with a photo | "Payments to check" shows 1 in admin |
| 5 | Admin: verify the payment, then mark Shipped | Customer's order page shows the new status |
| 6 | Sign up with a new email | Confirmation email arrives (if Part 5 is done) |
| 7 | "Forgot your password?" | Reset email arrives, new password works |
| 8 | Write a review, approve it in Admin > Reviews | It appears on the product page |
| 9 | Create a discount code, use it at checkout | Price drops |
| 10 | Send a custom order | It shows in Admin > Custom orders |
| 11 | Open the site on a small phone | Nothing slides sideways |

Then **delete the test orders** in Supabase > Table editor > `orders` (select rows, delete), so your numbers start clean. Put stock back if the tests used it.

---

## Updating the site later

1. Change files on your computer.
2. In the terminal: `git add .` then `git commit -m "what I changed"` then `git push`.
3. Vercel rebuilds by itself in about 2 minutes.

Changes made in the admin panel (products, prices, settings) are live straight away. They do not need a rebuild.

---

## Good to know

- **Free Supabase projects pause** if nothing happens for about a week. If the shop shows errors after a quiet period, open Supabase and click **Restore**. A busy shop will not pause.
- **Free Supabase has no automatic backups.** Once in a while: Supabase > Table editor > `orders` > Export to CSV. Keep a copy of your product photos too.
- **Vercel free plan** is for non-commercial use by its rules. A shop that earns money should use the Pro plan (about 20 USD per month) when it grows. Check Vercel's current terms.
- **Costs to expect:** domain yearly. Everything else is free until you have many visitors.

## If something goes wrong

| What you see | Try this |
|---|---|
| Build fails on Vercel with red text | Run `npm run build` on your computer. Fix the first error, push again. |
| Site shows "Ordering isn't available" | An environment variable is missing or misspelled in Vercel. Redeploy after fixing. |
| Login works locally but not live | Part 4: Site URL and Redirect URLs in Supabase. |
| Confirmation or reset email never arrives | Check spam. Check Part 5 (SMTP). Supabase > Authentication > Logs. |
| Photos do not show | Check `NEXT_PUBLIC_SUPABASE_URL` in Vercel. Check the storage buckets exist (`0003_storage.sql`). |
| "The security check did not pass" for everyone | The Turnstile hostnames must include your live domain. Keys must be from the same widget. |
| "Please wait a second for the security check" | An ad blocker blocks Cloudflare, or the page just loaded. Wait 2 seconds and try again. |
| Old data or old look after a change | Hard refresh (Ctrl + Shift + R). Check the latest deployment is green. |
| Admin panel says "No admin access" | Your account is not admin yet. See "become admin" in the README. |
