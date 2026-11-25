# Restaurant Management System - complete starter release

## Included
- `index.html` - your supplied page structure
- `style.css` - your supplied design
- `app.js` - complete replacement application logic
- `config.js` - your supplied Supabase project URL and publishable key
- `database.sql` - database tables, triggers and Row Level Security policies

## 1. Create the database
1. Sign in to Supabase and open your project.
2. Open **SQL Editor** > **New query**.
3. Open `database.sql`, copy all its contents and run it.
4. Confirm that the tables appear in **Table Editor**.

## 2. Set the first administrator
1. Register your own account through the website.
2. Confirm your email if Supabase email confirmation is enabled.
3. In Supabase SQL Editor, edit the final optional `UPDATE public.profiles...` statement in `database.sql` with your registered email.
4. Run that statement once. Do not promote public users to admin.

## 3. Configure authentication
In Supabase **Authentication**:
- Set your Site URL to the deployed website URL.
- Add the deployed URL and local development URL to Redirect URLs.
- For Google login, configure the Google provider with your Google OAuth client ID and secret in Supabase. Add the Supabase callback URL shown by Supabase to your Google OAuth authorized redirect URIs.
- Configure SMTP/email confirmation if you want reliable confirmation emails.

## 4. Deploy
Upload all five website files and the `assets` folder (if you have one) to the same hosting directory. Keep the filenames exactly as shown. The HTML loads Supabase JS, then `config.js`, then `app.js`.

## Roles
- `admin`: menu, orders, user role management, reports and payments.
- `cashier`: create orders, view orders, record payments and reports.
- `kitchen`: view the kitchen queue and update order preparation status.
- `admin`: also manages ingredient inventory and suppliers.
- `customer`: browse menu, place orders, see only their own orders and update their own display name.

New signups are always assigned the `customer` role by the database trigger. Roles are enforced using Row Level Security (RLS), not just by hiding navigation.

## Important operational notes
- The browser key in `config.js` is a publishable/anon key. Never put a Supabase `service_role` or secret key in browser code.
- This starter uses menu item stock as a simple quantity counter. It is not a full ingredient/recipe costing system.
- M-Pesa/card are recorded as payment methods only. This does not integrate Daraja or a card processor and does not automatically charge a customer.
- Order creation uses a PostgreSQL RPC transaction: the database checks current prices and stock, creates the order and lines, and deducts menu stock atomically.
- Take a database backup before running schema changes on a live project.
