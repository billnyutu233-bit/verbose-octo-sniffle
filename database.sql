-- Restaurant Management System (RMS) - Supabase PostgreSQL schema
-- Run this entire script in Supabase Dashboard > SQL Editor > New query.
-- Public sign-ups are ALWAYS customers. Promote your own account to admin
-- manually using the final SQL statement after creating an account.

create extension if not exists pgcrypto;

do $$ begin
  create type public.rms_role as enum ('admin', 'cashier', 'kitchen', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rms_order_status as enum ('pending', 'preparing', 'ready', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Customer',
  role public.rms_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_level integer not null default 5 check (low_stock_level >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null default 'Walk-in',
  table_number text not null default '',
  total numeric(12,2) not null default 0 check (total >= 0),
  status public.rms_order_status not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'mpesa', 'card', 'bank')),
  reference text not null default '',
  status text not null default 'paid' check (status in ('paid', 'pending', 'failed', 'refunded')),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'unit',
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  reorder_level numeric(12,2) not null default 5 check (reorder_level >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('stock_in', 'stock_out', 'adjustment')),
  quantity numeric(12,2) not null check (quantity > 0),
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists menu_items_name_idx on public.menu_items(name);

-- Role lookup used by RLS policies. SECURITY DEFINER avoids recursive profile RLS.
create or replace function public.rms_current_role()
returns public.rms_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Create a customer profile whenever Supabase Auth creates a user.
create or replace function public.rms_handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1), 'Customer'),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists rms_on_auth_user_created on auth.users;
create trigger rms_on_auth_user_created
after insert on auth.users
for each row execute procedure public.rms_handle_new_user();

-- Prevent a user from changing their own role through the browser.
create or replace function public.rms_protect_profile_role()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(public.rms_current_role()::text, '') <> 'admin' then
    raise exception 'Only an administrator can change account roles';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rms_profile_role_guard on public.profiles;
create trigger rms_profile_role_guard
before update on public.profiles
for each row execute procedure public.rms_protect_profile_role();

create or replace function public.rms_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists rms_menu_touch on public.menu_items;
create trigger rms_menu_touch before update on public.menu_items for each row execute procedure public.rms_touch_updated_at();
drop trigger if exists rms_orders_touch on public.orders;
create trigger rms_orders_touch before update on public.orders for each row execute procedure public.rms_touch_updated_at();
drop trigger if exists rms_inventory_touch on public.inventory_items;
create trigger rms_inventory_touch before update on public.inventory_items for each row execute procedure public.rms_touch_updated_at();


-- Atomic order creation: database calculates prices, validates stock and writes
-- the order + lines + stock decrement in one transaction.
create or replace function public.rms_create_order(
  p_customer_name text,
  p_table_number text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.rms_role;
  v_order_id uuid;
  v_customer_id uuid;
  v_total numeric(12,2) := 0;
  v_item record;
  v_menu public.menu_items%rowtype;
  v_qty integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in to place an order'; end if;
  v_role := public.rms_current_role();
  if v_role not in ('customer', 'admin', 'cashier') then
    raise exception 'Your account is not permitted to create orders';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one menu item';
  end if;

  if v_role = 'customer' then v_customer_id := auth.uid(); else v_customer_id := null; end if;

  -- Lock and validate each menu item before calculating the authoritative total.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, (v_item.value->>'quantity')::integer);
    select * into v_menu from public.menu_items
      where id = (v_item.value->>'menu_item_id')::uuid
      for update;
    if not found or not v_menu.available then raise exception 'A selected menu item is no longer available'; end if;
    if v_menu.stock < v_qty then raise exception 'Insufficient stock for %', v_menu.name; end if;
    v_total := v_total + (v_menu.price * v_qty);
  end loop;

  insert into public.orders(customer_id, customer_name, table_number, total, status, created_by)
  values (v_customer_id, coalesce(nullif(trim(p_customer_name), ''), 'Walk-in'),
          coalesce(p_table_number, ''), v_total, 'pending', auth.uid())
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, (v_item.value->>'quantity')::integer);
    select * into v_menu from public.menu_items where id = (v_item.value->>'menu_item_id')::uuid;
    insert into public.order_items(order_id, menu_item_id, item_name, quantity, unit_price, subtotal)
    values (v_order_id, v_menu.id, v_menu.name, v_qty, v_menu.price, v_menu.price * v_qty);
    update public.menu_items set stock = stock - v_qty where id = v_menu.id;
  end loop;

  return v_order_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;

-- Profiles: users can read/update their own basic profile; admins manage all profiles.
drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.rms_current_role() = 'admin');
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated
using (id = auth.uid() or public.rms_current_role() = 'admin')
with check (id = auth.uid() or public.rms_current_role() = 'admin');

-- Menu: signed-in users can view menu; only admins change it.
drop policy if exists "menu_read_authenticated" on public.menu_items;
create policy "menu_read_authenticated" on public.menu_items for select to authenticated using (true);
drop policy if exists "menu_admin_insert" on public.menu_items;
create policy "menu_admin_insert" on public.menu_items for insert to authenticated with check (public.rms_current_role() = 'admin');
drop policy if exists "menu_admin_update" on public.menu_items;
create policy "menu_admin_update" on public.menu_items for update to authenticated using (public.rms_current_role() = 'admin') with check (public.rms_current_role() = 'admin');
drop policy if exists "menu_admin_delete" on public.menu_items;
create policy "menu_admin_delete" on public.menu_items for delete to authenticated using (public.rms_current_role() = 'admin');

-- Orders: customers see only their own; restaurant staff see all.
drop policy if exists "orders_read_owner_or_staff" on public.orders;
create policy "orders_read_owner_or_staff" on public.orders for select to authenticated
using (customer_id = auth.uid() or public.rms_current_role() in ('admin', 'cashier', 'kitchen'));
drop policy if exists "orders_insert_owner_or_staff" on public.orders;
create policy "orders_insert_owner_or_staff" on public.orders for insert to authenticated
with check (
  (public.rms_current_role() = 'customer' and customer_id = auth.uid() and created_by = auth.uid())
  or (public.rms_current_role() in ('admin', 'cashier') and created_by = auth.uid())
);
drop policy if exists "orders_update_staff" on public.orders;
create policy "orders_update_staff" on public.orders for update to authenticated
using (public.rms_current_role() in ('admin', 'cashier', 'kitchen'))
with check (public.rms_current_role() in ('admin', 'cashier', 'kitchen'));
drop policy if exists "orders_delete_admin" on public.orders;
create policy "orders_delete_admin" on public.orders for delete to authenticated using (public.rms_current_role() = 'admin');

-- Order lines: visible only when parent order is visible; insertion for owner or staff.
drop policy if exists "order_items_read_visible_order" on public.order_items;
create policy "order_items_read_visible_order" on public.order_items for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.rms_current_role() in ('admin', 'cashier', 'kitchen'))));
drop policy if exists "order_items_insert_visible_order" on public.order_items;
create policy "order_items_insert_visible_order" on public.order_items for insert to authenticated
with check (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.rms_current_role() in ('admin', 'cashier'))));
drop policy if exists "order_items_delete_staff" on public.order_items;
create policy "order_items_delete_staff" on public.order_items for delete to authenticated using (public.rms_current_role() in ('admin', 'cashier'));

-- Payments: customer can view payments attached to own order; cashier/admin can record.
drop policy if exists "payments_read_order_owner_or_staff" on public.payments;
create policy "payments_read_order_owner_or_staff" on public.payments for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.rms_current_role() in ('admin', 'cashier'))));
drop policy if exists "payments_insert_cashier" on public.payments;
create policy "payments_insert_cashier" on public.payments for insert to authenticated
with check (public.rms_current_role() in ('admin', 'cashier') and recorded_by = auth.uid());
drop policy if exists "payments_update_admin" on public.payments;
create policy "payments_update_admin" on public.payments for update to authenticated
using (public.rms_current_role() = 'admin') with check (public.rms_current_role() = 'admin');

-- Inventory and suppliers are restricted to admins for this initial release.
drop policy if exists "suppliers_admin_all" on public.suppliers;
create policy "suppliers_admin_all" on public.suppliers for all to authenticated
using (public.rms_current_role() = 'admin') with check (public.rms_current_role() = 'admin');
drop policy if exists "inventory_admin_all" on public.inventory_items;
create policy "inventory_admin_all" on public.inventory_items for all to authenticated
using (public.rms_current_role() = 'admin') with check (public.rms_current_role() = 'admin');
drop policy if exists "stock_movements_admin_all" on public.stock_movements;
create policy "stock_movements_admin_all" on public.stock_movements for all to authenticated
using (public.rms_current_role() = 'admin') with check (public.rms_current_role() = 'admin');

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.menu_items, public.orders, public.order_items, public.payments,
  public.suppliers, public.inventory_items, public.stock_movements to authenticated;
grant execute on function public.rms_current_role() to authenticated;
grant execute on function public.rms_create_order(text, text, jsonb) to authenticated;

-- OPTIONAL INITIAL DATA: uncomment and run if you want a few demo menu items.
-- insert into public.menu_items(name, category, description, price, stock, low_stock_level)
-- values ('Chicken and Chips', 'Main course', 'Grilled chicken served with chips', 650, 25, 5),
--        ('Beef Burger', 'Main course', 'Beef burger with fresh vegetables', 550, 20, 5),
--        ('Fresh Juice', 'Drinks', 'Fresh seasonal juice', 180, 30, 8);

-- IMPORTANT: Create your account through the website first. Then replace the email below
-- with the exact email you registered and run this statement ONCE to make yourself admin.
-- update public.profiles p set role = 'admin'
-- from auth.users u where p.id = u.id and lower(u.email) = lower('YOUR-EMAIL@example.com');
