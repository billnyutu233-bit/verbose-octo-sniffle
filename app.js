(() => {
  'use strict';

  const cfg = window.RMS_CONFIG || {};
  const ready = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR_') &&
    window.supabase?.createClient);

  const db = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = n => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number(n || 0));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const todayStart = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  };

  let sessionUser = null;
  let profile = null;
  let activePage = 'dashboard';
  let realtimeChannel = null;

  const role = () => profile?.role || 'customer';
  const isStaff = () => ['admin', 'cashier', 'kitchen'].includes(role());
  const isAdmin = () => role() === 'admin';
  const isCashier = () => ['admin', 'cashier'].includes(role());
  const isKitchen = () => ['admin', 'kitchen'].includes(role());

  function toast(message, type = 'success') {
    const region = $('#toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`;
    el.textContent = message;
    region.append(el);
    window.setTimeout(() => el.remove(), 4500);
  }

  function showAuth(tab = 'login') {
    $('#auth-screen')?.classList.remove('hidden');
    $('#app-shell')?.classList.add('hidden');
    $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === tab));
    $('#login-form-wrap')?.classList.toggle('hidden', tab !== 'login');
    $('#signup-form-wrap')?.classList.toggle('hidden', tab !== 'signup');
  }

  function displayName() {
    return profile?.full_name || sessionUser?.user_metadata?.full_name ||
      sessionUser?.user_metadata?.name || sessionUser?.email?.split('@')[0] || 'Restaurant User';
  }

  function setUserChrome() {
    const name = displayName();
    $('#user-name').textContent = name;
    $('#user-email').textContent = sessionUser?.email || '';
    $('#user-avatar').textContent = name.charAt(0).toUpperCase();
    $('#top-avatar').textContent = name.charAt(0).toUpperCase();
    $('#top-date').textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  async function loadProfile(user) {
    const { data, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
    // The database trigger normally creates this row. Do not let the browser assign a privileged role.
    const fallback = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Customer',
      role: 'customer'
    };
    const { data: inserted, error: insertError } = await db.from('profiles').insert(fallback).select().single();
    if (insertError) throw insertError;
    return inserted;
  }

  const navItems = () => {
    if (isStaff()) {
      const items = [
        ['dashboard', '▦', 'Dashboard'],
        ['menu', '☷', 'Menu & Inventory'],
        ['orders', '▣', 'Sales & Orders']
      ];
      if (isKitchen()) items.push(['kitchen', '♨', 'Kitchen Queue']);
      if (isAdmin()) { items.push(['inventory', '◈', 'Ingredient Inventory']); items.push(['users', '♙', 'User Management']); }
      items.push(['reports', '▤', 'Reports']);
      return items;
    }
    return [
      ['customer-menu', '☷', 'Browse Menu'],
      ['customer-orders', '▣', 'My Orders'],
      ['customer-profile', '♙', 'My Account']
    ];
  };

  function buildNavigation() {
    const nav = $('.side-nav');
    nav.innerHTML = navItems().map(([page, icon, label]) =>
      `<button class="nav-link ${activePage === page ? 'active' : ''}" data-page="${page}"><span>${icon}</span>${label}</button>`
    ).join('');
    $$('.nav-link').forEach(b => b.addEventListener('click', () => navigate(b.dataset.page)));
  }

  function showApp(user, userProfile) {
    sessionUser = user;
    profile = userProfile;
    $('#auth-screen').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
    setUserChrome();
    buildNavigation();
    navigate(location.hash.replace('#', '') || (isStaff() ? 'dashboard' : 'customer-menu'));
    subscribeRealtime();
  }

  async function refreshSession() {
    if (!ready) {
      showAuth();
      toast('Supabase is not configured. Check config.js.', 'error');
      return;
    }
    const { data: { session }, error } = await db.auth.getSession();
    if (error) toast(error.message, 'error');
    if (session?.user) {
      try { showApp(session.user, await loadProfile(session.user)); }
      catch (e) { console.error(e); toast('Could not load your account profile: ' + e.message, 'error'); showAuth(); }
    } else showAuth();
  }

  function subscribeRealtime() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    realtimeChannel = db.channel('rms-live-workspace')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (['dashboard', 'orders', 'kitchen', 'customer-orders', 'reports'].includes(activePage)) navigate(activePage, false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        if (['dashboard', 'menu', 'customer-menu'].includes(activePage)) navigate(activePage, false);
      })
      .subscribe();
  }

  function navigate(page, updateHash = true) {
    const allowed = navItems().map(x => x[0]);
    if (!allowed.includes(page)) page = isStaff() ? 'dashboard' : 'customer-menu';
    activePage = page;
    if (updateHash) history.replaceState(null, '', `#${page}`);
    buildNavigation();
    $('#sidebar').classList.remove('open');
    const renderers = {
      dashboard: renderDashboard, menu: renderMenu, orders: renderOrders,
      kitchen: renderKitchen, inventory: renderInventory, users: renderUsers, reports: renderReports,
      'customer-menu': renderCustomerMenu, 'customer-orders': renderCustomerOrders,
      'customer-profile': renderCustomerProfile
    };
    $('#page-content').innerHTML = '<div class="loading-state">Loading your workspace...</div>';
    Promise.resolve(renderers[page]()).catch(err => {
      console.error(err);
      $('#page-content').innerHTML = `<div class="notice error">Unable to load this section: ${esc(err.message || 'Unknown error')}</div>`;
      toast(err.message || 'Unable to load data.', 'error');
    });
  }

  function heading(kicker, title, description, action = '') {
    return `<div class="page-heading"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1><p class="muted">${esc(description)}</p></div>${action}</div>`;
  }
  function stat(label, value, note) {
    return `<div class="stat-card"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div><small>${esc(note)}</small></div>`;
  }
  function statusBadge(status) {
    const s = String(status || 'pending').toLowerCase();
    const cls = ['completed', 'ready', 'paid', 'available'].includes(s) ? 'ok' :
      ['cancelled', 'unavailable'].includes(s) ? 'low' : 'pending';
    return `<span class="badge ${cls}">${esc(s.replaceAll('_', ' '))}</span>`;
  }
  function emptyRow(cols, text = 'No records found.') {
    return `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`;
  }
  function openModal(title, body, onSubmit) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><section class="modal"><h3>${esc(title)}</h3><form id="rms-modal-form">${body}<div class="modal-actions"><button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form></section></div>`;
    $('#modal-cancel').onclick = () => root.innerHTML = '';
    $('.modal-backdrop').addEventListener('click', e => { if (e.target.classList.contains('modal-backdrop')) root.innerHTML = ''; });
    $('#rms-modal-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.currentTarget.querySelector('[type=submit]');
      btn.disabled = true;
      try { await onSubmit(new FormData(e.currentTarget)); root.innerHTML = ''; }
      catch (err) { toast(err.message || 'Could not save.', 'error'); btn.disabled = false; }
    });
  }
  function field(label, name, type = 'text', value = '', extra = '') {
    return `<div class="field"><label>${esc(label)}<input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}></label></div>`;
  }

  async function renderDashboard() {
    if (!isStaff()) return navigate('customer-menu');
    const [{ data: items, error: e1 }, { data: orders, error: e2 }] = await Promise.all([
      db.from('menu_items').select('id,name,category,price,stock,low_stock_level,available').order('created_at', { ascending: false }),
      db.from('orders').select('id,total,status,created_at').gte('created_at', todayStart()).order('created_at', { ascending: false })
    ]);
    if (e1) throw e1; if (e2) throw e2;
    const rows = orders || [], menu = items || [];
    const revenue = rows.filter(x => x.status === 'completed').reduce((s, x) => s + Number(x.total), 0);
    const low = menu.filter(x => Number(x.stock) <= Number(x.low_stock_level));
    $('#page-content').innerHTML = `
      ${heading('OVERVIEW', 'Dashboard', `Welcome back, ${displayName()}. Here's your restaurant summary.`, '<button class="btn btn-primary" data-action="new-order">+ Record sale</button>')}
      <div class="stats-grid">
        ${stat('MENU ITEMS', menu.length, 'Items in your menu')}
        ${stat("TODAY'S ORDERS", rows.length, 'Orders received today')}
        ${stat("TODAY'S REVENUE", money(revenue), 'Completed orders only')}
      </div>
      <div class="content-grid">
        <section class="panel"><div class="panel-head"><h3>Recent orders</h3><button class="btn btn-secondary btn-small" data-page-jump="orders">View all</button></div>
          <div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>
          ${rows.slice(0, 7).map(o => `<tr><td>#${esc(o.id.slice(0, 8))}</td><td>${esc(o.customer_name || 'Walk-in')}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('') || emptyRow(4, 'No orders recorded today.')}</tbody></table></div>
        </section>
        <section class="panel"><div class="panel-head"><h3>Low stock alerts</h3><button class="btn btn-secondary btn-small" data-page-jump="menu">Manage menu</button></div>
          ${low.map(x => `<div class="panel-head"><div><strong>${esc(x.name)}</strong><p class="muted">${Number(x.stock)} in stock · alert at ${Number(x.low_stock_level)}</p></div>${statusBadge('low stock')}</div>`).join('') || '<p class="empty">All menu stock levels look healthy.</p>'}
        </section>
      </div>`;
    wirePageActions();
  }

  async function renderMenu() {
    const { data, error } = await db.from('menu_items').select('*').order('name');
    if (error) throw error;
    const items = data || [];
    $('#page-content').innerHTML = `
      ${heading('RESTAURANT CATALOGUE', 'Menu & Inventory', 'Manage dishes, prices, availability and stock.', isAdmin() ? '<button class="btn btn-primary" data-action="add-menu">+ Add menu item</button>' : '')}
      <section class="panel"><div class="panel-head"><h3>Menu items</h3><input class="search-input" id="menu-search" placeholder="Search menu..."></div>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Stock</th><th>Availability</th><th>Action</th></tr></thead><tbody id="menu-rows">
      ${items.map(x => `<tr data-search="${esc((x.name+' '+(x.category||'')).toLowerCase())}"><td><strong>${esc(x.name)}</strong><br><small class="muted">${esc(x.description || '')}</small></td><td>${esc(x.category || 'General')}</td><td>${money(x.price)}</td><td>${Number(x.stock)}</td><td>${statusBadge(x.available ? 'available' : 'unavailable')}</td><td>${isAdmin() ? `<button class="btn btn-secondary btn-small" data-edit-menu="${esc(x.id)}">Edit</button> <button class="btn btn-danger btn-small" data-delete-menu="${esc(x.id)}">Delete</button>` : '—'}</td></tr>`).join('') || emptyRow(6, 'No menu items yet.')}</tbody></table></div></section>`;
    $('#menu-search').addEventListener('input', e => $$('#menu-rows tr').forEach(r => r.hidden = !r.dataset.search.includes(e.target.value.toLowerCase())));
    $('[data-action="add-menu"]')?.addEventListener('click', () => menuModal());
    $$('[data-edit-menu]').forEach(b => b.onclick = () => menuModal(items.find(x => x.id === b.dataset.editMenu)));
    $$('[data-delete-menu]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this menu item? Existing order history will remain.')) return;
      const { error } = await db.from('menu_items').delete().eq('id', b.dataset.deleteMenu);
      if (error) return toast(error.message, 'error');
      toast('Menu item deleted.'); navigate('menu', false);
    });
  }

  function menuModal(item = null) {
    openModal(item ? 'Edit menu item' : 'Add menu item', `
      ${field('Item name', 'name', 'text', item?.name || '', 'required')}
      ${field('Category', 'category', 'text', item?.category || 'Main course')}
      ${field('Description', 'description', 'text', item?.description || '')}
      <div class="field-row">${field('Price (KES)', 'price', 'number', item?.price ?? '', 'min="0" step="0.01" required')}
      ${field('Stock quantity', 'stock', 'number', item?.stock ?? 0, 'min="0" step="1" required')}
      ${field('Low stock alert', 'low_stock_level', 'number', item?.low_stock_level ?? 5, 'min="0" step="1" required')}</div>
      <div class="field"><label><input name="available" type="checkbox" ${item?.available !== false ? 'checked' : ''}> Available for ordering</label></div>`,
      async f => {
        const payload = { name: f.get('name').trim(), category: f.get('category').trim(), description: f.get('description').trim(),
          price: Number(f.get('price')), stock: Number(f.get('stock')), low_stock_level: Number(f.get('low_stock_level')), available: f.get('available') === 'on' };
        const q = item ? db.from('menu_items').update(payload).eq('id', item.id) : db.from('menu_items').insert(payload);
        const { error } = await q; if (error) throw error;
        toast(item ? 'Menu item updated.' : 'Menu item added.'); navigate('menu', false);
      });
  }

  async function fetchOrders(own = false) {
    let query = db.from('orders').select('*,order_items(id,item_name,quantity,unit_price,subtotal),payments(id,amount,method,status)').order('created_at', { ascending: false }).limit(100);
    if (own) query = query.eq('customer_id', sessionUser.id);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  function orderRows(rows, actions = true) {
    return rows.map(o => `<tr><td>#${esc(o.id.slice(0, 8))}<br><small class="muted">${new Date(o.created_at).toLocaleString()}</small></td>
      <td>${esc(o.customer_name || 'Walk-in')}</td><td>${(o.order_items || []).map(i => `${esc(i.item_name)} × ${i.quantity}`).join('<br>') || '—'}</td>
      <td>${money(o.total)}</td><td>${statusBadge(o.status)}</td><td>${actions ? orderActionButtons(o) : '—'}</td></tr>`).join('') || emptyRow(6, 'No orders found.');
  }
  function orderActionButtons(o) {
    const controls = [];
    if (isCashier() && !['completed', 'cancelled'].includes(o.status)) controls.push(`<button class="btn btn-secondary btn-small" data-pay="${esc(o.id)}">Payment</button>`);
    if (isKitchen() && !['completed', 'cancelled'].includes(o.status)) controls.push(`<button class="btn btn-secondary btn-small" data-status="${esc(o.id)}" data-next="${o.status === 'pending' ? 'preparing' : o.status === 'preparing' ? 'ready' : 'completed'}">${o.status === 'pending' ? 'Start' : o.status === 'preparing' ? 'Mark ready' : 'Complete'}</button>`);
    if (isAdmin() && !['completed', 'cancelled'].includes(o.status)) controls.push(`<button class="btn btn-danger btn-small" data-cancel="${esc(o.id)}">Cancel</button>`);
    return controls.join(' ') || '—';
  }
  async function renderOrders() {
    if (!isStaff()) return navigate('customer-orders');
    const rows = await fetchOrders(false);
    $('#page-content').innerHTML = `${heading('TRANSACTIONS', 'Sales & Orders', 'Review orders, fulfilment and payments.', isCashier() ? '<button class="btn btn-primary" data-action="new-order">+ New order</button>' : '')}
      <section class="panel"><div class="panel-head"><h3>All recent orders</h3><input id="order-search" class="search-input" placeholder="Search customer or order ID"></div>
      <div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody id="order-rows">${orderRows(rows)}</tbody></table></div></section>`;
    wireOrderActions(rows);
    $('#order-search').addEventListener('input', e => $$('#order-rows tr').forEach(r => r.hidden = !r.textContent.toLowerCase().includes(e.target.value.toLowerCase())));
    $('[data-action="new-order"]')?.addEventListener('click', () => newOrderModal(false));
  }
  async function renderKitchen() {
    if (!isKitchen()) return navigate('dashboard');
    const rows = await fetchOrders(false);
    const open = rows.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
    $('#page-content').innerHTML = `${heading('FOOD PREPARATION', 'Kitchen Queue', 'Orders update here as customers and cashiers place them.')}
      <section class="panel"><div class="panel-head"><h3>Active orders</h3><span class="muted">${open.length} active</span></div>
      <div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Update</th></tr></thead><tbody>
      ${open.map(o => `<tr><td>#${esc(o.id.slice(0, 8))}<br><small class="muted">${new Date(o.created_at).toLocaleTimeString()}</small></td><td>${esc(o.customer_name || 'Walk-in')}</td><td>${(o.order_items || []).map(i => `${esc(i.item_name)} × ${i.quantity}`).join('<br>')}</td><td>${statusBadge(o.status)}</td><td>${orderActionButtons(o)}</td></tr>`).join('') || emptyRow(5, 'No active orders.')}</tbody></table></div></section>`;
    wireOrderActions(rows);
  }

  async function wireOrderActions(rows) {
    $$('[data-status]').forEach(b => b.onclick = async () => {
      const { error } = await db.from('orders').update({ status: b.dataset.next }).eq('id', b.dataset.status);
      if (error) return toast(error.message, 'error');
      toast('Order status updated.'); navigate(activePage, false);
    });
    $$('[data-cancel]').forEach(b => b.onclick = async () => {
      if (!confirm('Cancel this order?')) return;
      const { error } = await db.from('orders').update({ status: 'cancelled' }).eq('id', b.dataset.cancel);
      if (error) return toast(error.message, 'error');
      toast('Order cancelled.'); navigate(activePage, false);
    });
    $$('[data-pay]').forEach(b => b.onclick = () => paymentModal(rows.find(o => o.id === b.dataset.pay)));
  }

  function paymentModal(order) {
    openModal('Record payment', `<p class="muted">Order #${esc(order.id.slice(0, 8))} · Balance due: ${money(order.total - (order.payments || []).filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0))}</p>
      ${field('Amount (KES)', 'amount', 'number', order.total, 'min="0.01" step="0.01" required')}
      <div class="field"><label>Payment method<select name="method" required><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="card">Card</option><option value="bank">Bank transfer</option></select></label></div>
      ${field('Transaction/reference (optional)', 'reference', 'text', '')}`,
      async f => {
        const amount = Number(f.get('amount'));
        if (!(amount > 0)) throw new Error('Enter a valid payment amount.');
        const { error } = await db.from('payments').insert({ order_id: order.id, amount, method: f.get('method'), reference: f.get('reference').trim(), status: 'paid', recorded_by: sessionUser.id });
        if (error) throw error;
        const paid = (order.payments || []).reduce((s, p) => s + Number(p.amount), 0) + amount;
        if (paid >= Number(order.total)) {
          const { error: updateError } = await db.from('orders').update({ status: 'completed' }).eq('id', order.id);
          if (updateError) throw updateError;
        }
        toast('Payment recorded.'); navigate('orders', false);
      });
  }

  async function menuForOrdering() {
    const { data, error } = await db.from('menu_items').select('id,name,price,stock,available').eq('available', true).order('name');
    if (error) throw error;
    return (data || []).filter(x => Number(x.stock) > 0);
  }
  async function newOrderModal(customerMode = false) {
    try {
      const items = await menuForOrdering();
      if (!items.length) return toast('There are no available menu items to order.', 'error');
      const itemFields = items.map(x => `<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:12px"><input type="checkbox" name="item_${esc(x.id)}"><span style="flex:1">${esc(x.name)} · ${money(x.price)} <small class="muted">(${x.stock} available)</small></span><input name="qty_${esc(x.id)}" type="number" min="1" max="${Number(x.stock)}" value="1" style="width:70px;padding:7px;border:1px solid var(--line);border-radius:6px"></label>`).join('');
      openModal(customerMode ? 'Place your order' : 'Create order', `
        ${customerMode ? '' : `${field('Customer name', 'customer_name', 'text', '', 'placeholder="Walk-in customer"')}`}
        ${field('Table number (optional)', 'table_number', 'text', '')}
        <div class="field"><label>Choose items</label><div style="max-height:260px;overflow:auto">${itemFields}</div></div>
        <p class="muted">Select each item you want. Stock is checked again when saved.</p>`,
        async f => {
          const selected = items.filter(x => f.get(`item_${x.id}`) === 'on').map(x => ({
            menu_item_id: x.id, item_name: x.name, quantity: Math.max(1, Number(f.get(`qty_${x.id}`) || 1)),
            unit_price: Number(x.price), subtotal: Math.max(1, Number(f.get(`qty_${x.id}`) || 1)) * Number(x.price)
          }));
          if (!selected.length) throw new Error('Select at least one menu item.');
          for (const it of selected) {
            const source = items.find(x => x.id === it.menu_item_id);
            if (it.quantity > Number(source.stock)) throw new Error(`Not enough stock for ${source.name}.`);
          }
          const { data: orderId, error: orderError } = await db.rpc('rms_create_order', {
            p_customer_name: customerMode ? displayName() : (f.get('customer_name').trim() || 'Walk-in'),
            p_table_number: f.get('table_number').trim(),
            p_items: selected.map(x => ({ menu_item_id: x.menu_item_id, quantity: x.quantity }))
          });
          if (orderError) throw orderError;
          toast(`Order #${String(orderId).slice(0, 8)} placed successfully.`);
          navigate(customerMode ? 'customer-orders' : 'orders', false);
        });
    } catch (e) { toast(e.message, 'error'); }
  }

  async function renderCustomerMenu() {
    const { data, error } = await db.from('menu_items').select('*').eq('available', true).order('category').order('name');
    if (error) throw error;
    const items = data || [];
    const groups = [...new Set(items.map(x => x.category || 'Other'))];
    $('#page-content').innerHTML = `${heading('WELCOME', 'Restaurant Menu', 'Browse available meals and place an order.', '<button class="btn btn-primary" data-action="customer-order">View / place order</button>')}
      ${groups.map(g => `<section class="panel"><div class="panel-head"><h3>${esc(g)}</h3></div><div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
        ${items.filter(x => (x.category || 'Other') === g).map(x => `<div class="stat-card"><strong>${esc(x.name)}</strong><p class="muted">${esc(x.description || '')}</p><div class="stat-value" style="font-size:19px">${money(x.price)}</div><small>${Number(x.stock) > 0 ? 'Available' : 'Out of stock'}</small></div>`).join('')}
      </div></section>`).join('') || '<section class="panel empty">The restaurant menu is being updated. Please check again later.</section>'}`;
    $('[data-action="customer-order"]')?.addEventListener('click', () => newOrderModal(true));
  }
  async function renderCustomerOrders() {
    const rows = await fetchOrders(true);
    $('#page-content').innerHTML = `${heading('YOUR ACTIVITY', 'My Orders', 'Track your orders and review your receipts.', '<button class="btn btn-primary" data-action="customer-order">+ Place order</button>')}
      <section class="panel"><div class="table-wrap"><table><thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>
      ${rows.map(o => `<tr><td>#${esc(o.id.slice(0, 8))}<br><small class="muted">${new Date(o.created_at).toLocaleString()}</small></td><td>${(o.order_items || []).map(i => `${esc(i.item_name)} × ${i.quantity}`).join('<br>')}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td><td>${money((o.payments || []).filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0))}</td></tr>`).join('') || emptyRow(5, 'You have not placed any orders yet.')}</tbody></table></div></section>`;
    $('[data-action="customer-order"]').onclick = () => newOrderModal(true);
  }
  async function renderCustomerProfile() {
    $('#page-content').innerHTML = `${heading('ACCOUNT', 'My Account', 'Update the name shown on your customer account.')}
      <section class="panel" style="max-width:600px"><form id="profile-form">
      ${field('Full name', 'full_name', 'text', profile.full_name || '', 'required')}
      <div class="field"><label>Email address<input value="${esc(sessionUser.email)}" disabled></label></div>
      <button class="btn btn-primary" type="submit">Save changes</button></form></section>`;
    $('#profile-form').onsubmit = async e => {
      e.preventDefault();
      const name = new FormData(e.currentTarget).get('full_name').trim();
      const { data, error } = await db.from('profiles').update({ full_name: name }).eq('id', sessionUser.id).select().single();
      if (error) return toast(error.message, 'error');
      profile = data; setUserChrome(); toast('Profile updated.');
    };
  }


  async function renderInventory() {
    if (!isAdmin()) return navigate('dashboard');
    const [{ data: stock, error: e1 }, { data: suppliers, error: e2 }] = await Promise.all([
      db.from('inventory_items').select('*,suppliers(name)').order('name'),
      db.from('suppliers').select('id,name').order('name')
    ]);
    if (e1) throw e1; if (e2) throw e2;
    const rows = stock || [];
    $('#page-content').innerHTML = `${heading('STOCK CONTROL', 'Ingredient Inventory', 'Track raw ingredients, reorder levels and suppliers.', '<button class="btn btn-primary" data-action="add-inventory">+ Add ingredient</button>')}
      <section class="panel"><div class="panel-head"><h3>Ingredients and supplies</h3><button class="btn btn-secondary btn-small" data-action="add-supplier">+ Add supplier</button></div>
      <div class="table-wrap"><table><thead><tr><th>Ingredient</th><th>Quantity</th><th>Reorder at</th><th>Supplier</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(x => `<tr><td><strong>${esc(x.name)}</strong><br><small class="muted">${esc(x.unit)}</small></td><td>${Number(x.quantity)}</td><td>${Number(x.reorder_level)}</td><td>${esc(x.suppliers?.name || '—')}</td><td>${Number(x.quantity) <= Number(x.reorder_level) ? statusBadge('low stock') : statusBadge('available')}</td><td><button class="btn btn-secondary btn-small" data-stock-edit="${esc(x.id)}">Adjust</button> <button class="btn btn-danger btn-small" data-stock-delete="${esc(x.id)}">Delete</button></td></tr>`).join('') || emptyRow(6, 'No ingredient inventory recorded yet.')}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h3>Suppliers</h3></div><div class="table-wrap"><table><thead><tr><th>Supplier</th></tr></thead><tbody>${(suppliers || []).map(x => `<tr><td>${esc(x.name)}</td></tr>`).join('') || emptyRow(1, 'No suppliers added.')}</tbody></table></div></section>`;
    $('[data-action="add-inventory"]').onclick = () => inventoryModal(null, suppliers || []);
    $('[data-action="add-supplier"]').onclick = () => openModal('Add supplier', `${field('Supplier name', 'name', 'text', '', 'required')}${field('Contact person', 'contact_name')}${field('Phone', 'phone', 'tel')}${field('Email', 'email', 'email')}`, async f => {
      const { error } = await db.from('suppliers').insert({ name: f.get('name').trim(), contact_name: f.get('contact_name').trim(), phone: f.get('phone').trim(), email: f.get('email').trim() });
      if (error) throw error; toast('Supplier added.'); navigate('inventory', false);
    });
    $$('[data-stock-edit]').forEach(b => b.onclick = () => inventoryModal(rows.find(x => x.id === b.dataset.stockEdit), suppliers || []));
    $$('[data-stock-delete]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this ingredient record?')) return;
      const { error } = await db.from('inventory_items').delete().eq('id', b.dataset.stockDelete);
      if (error) return toast(error.message, 'error');
      toast('Ingredient deleted.'); navigate('inventory', false);
    });
  }

  function inventoryModal(item, suppliers) {
    const supplierOptions = `<option value="">No supplier selected</option>` + suppliers.map(x => `<option value="${esc(x.id)}" ${item?.supplier_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    openModal(item ? 'Adjust ingredient inventory' : 'Add ingredient', `
      ${field('Ingredient name', 'name', 'text', item?.name || '', 'required')}
      <div class="field-row">${field('Unit (kg, litres, pieces)', 'unit', 'text', item?.unit || 'unit', 'required')}
      ${field('Quantity', 'quantity', 'number', item?.quantity ?? 0, 'min="0" step="0.01" required')}
      ${field('Reorder level', 'reorder_level', 'number', item?.reorder_level ?? 5, 'min="0" step="0.01" required')}</div>
      <div class="field"><label>Supplier<select name="supplier_id">${supplierOptions}</select></label></div>`,
      async f => {
        const payload = { name: f.get('name').trim(), unit: f.get('unit').trim(), quantity: Number(f.get('quantity')), reorder_level: Number(f.get('reorder_level')), supplier_id: f.get('supplier_id') || null };
        const { error } = item ? await db.from('inventory_items').update(payload).eq('id', item.id) : await db.from('inventory_items').insert(payload);
        if (error) throw error;
        toast(item ? 'Ingredient stock updated.' : 'Ingredient added.'); navigate('inventory', false);
      });
  }

  async function renderUsers() {
    if (!isAdmin()) return navigate('dashboard');
    const { data, error } = await db.from('profiles').select('id,full_name,role,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    $('#page-content').innerHTML = `${heading('ACCESS CONTROL', 'User Management', 'Assign staff roles. New public registrations always start as customers.')}
      <section class="panel"><div class="notice success">Only administrators can change account roles. Never share your administrator login.</div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Joined</th><th>Update role</th></tr></thead><tbody>
      ${(data || []).map(u => `<tr><td>${esc(u.full_name || 'Unnamed')} ${u.id === sessionUser.id ? '(you)' : ''}</td><td>${statusBadge(u.role)}</td><td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td><td><select data-user-role="${esc(u.id)}" ${u.id === sessionUser.id ? 'disabled' : ''}><option value="customer" ${u.role === 'customer' ? 'selected' : ''}>Customer</option><option value="cashier" ${u.role === 'cashier' ? 'selected' : ''}>Cashier</option><option value="kitchen" ${u.role === 'kitchen' ? 'selected' : ''}>Kitchen staff</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option></select></td></tr>`).join('') || emptyRow(4)}</tbody></table></div></section>`;
    $$('[data-user-role]').forEach(s => s.onchange = async () => {
      const { error } = await db.from('profiles').update({ role: s.value }).eq('id', s.dataset.userRole);
      if (error) { toast(error.message, 'error'); navigate('users', false); return; }
      toast('User role updated.');
    });
  }

  async function renderReports() {
    if (!isCashier()) return navigate('customer-orders');
    const from = new Date(); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0);
    const { data, error } = await db.from('orders').select('id,total,status,created_at,customer_name').gte('created_at', from.toISOString()).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    const completed = rows.filter(o => o.status === 'completed');
    const revenue = completed.reduce((s, o) => s + Number(o.total), 0);
    $('#page-content').innerHTML = `${heading('BUSINESS PERFORMANCE', 'Reports', 'A rolling 30-day summary of restaurant orders and completed sales.', '<button class="btn btn-secondary" id="print-report">Print report</button>')}
      <div class="stats-grid">${stat('ORDERS (30 DAYS)', rows.length, 'All order statuses')}${stat('COMPLETED SALES', completed.length, 'Paid / completed orders')}${stat('REVENUE (30 DAYS)', money(revenue), 'Completed orders')}</div>
      <section class="panel"><div class="panel-head"><h3>Order history</h3></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${rows.map(o => `<tr><td>${new Date(o.created_at).toLocaleDateString()}</td><td>#${esc(o.id.slice(0, 8))}</td><td>${esc(o.customer_name || 'Walk-in')}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('') || emptyRow(5)}</tbody></table></div></section>`;
    $('#print-report').onclick = () => window.print();
  }

  function wirePageActions() {
    $$('[data-page-jump]').forEach(b => b.onclick = () => navigate(b.dataset.pageJump));
    $('[data-action="new-order"]')?.addEventListener('click', () => newOrderModal(false));
  }

  // Authentication
  $$('[data-auth-tab]').forEach(btn => btn.addEventListener('click', () => showAuth(btn.dataset.authTab)));

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!db) return toast('Configure Supabase in config.js first.', 'error');
    const f = new FormData(e.currentTarget), button = e.currentTarget.querySelector('[type=submit]');
    button.disabled = true;
    const { data, error } = await db.auth.signInWithPassword({ email: String(f.get('email')).trim(), password: f.get('password') });
    button.disabled = false;
    if (error) return toast(error.message, 'error');
    try { showApp(data.user, await loadProfile(data.user)); toast('Welcome back.'); }
    catch (err) { toast(err.message, 'error'); }
  });

  $('#signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!db) return toast('Configure Supabase in config.js first.', 'error');
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name')).trim(), email = String(f.get('email')).trim(), password = String(f.get('password'));
    if (password.length < 8) return toast('Use a password with at least 8 characters.', 'error');
    const button = e.currentTarget.querySelector('[type=submit]');
    button.disabled = true;
    const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: location.origin + location.pathname } });
    button.disabled = false;
    if (error) return toast(error.message, 'error');
    e.currentTarget.reset();
    if (data.session) {
      try { showApp(data.user, await loadProfile(data.user)); toast('Account created. Your account has customer access.'); }
      catch (err) { toast(err.message, 'error'); }
    } else {
      toast('Account created. Confirm your email, then sign in.');
      showAuth('login');
    }
  });

  async function googleAuth() {
    if (!db) return toast('Configure Supabase in config.js first.', 'error');
    const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) toast(error.message, 'error');
  }
  $('#google-login').addEventListener('click', googleAuth);
  $('#google-signup').addEventListener('click', googleAuth);

  $('#logout-btn').addEventListener('click', async () => {
    if (realtimeChannel) await db.removeChannel(realtimeChannel);
    const { error } = await db.auth.signOut();
    if (error) return toast(error.message, 'error');
    sessionUser = null; profile = null; showAuth(); toast('You have signed out.');
  });
  $('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  window.addEventListener('hashchange', () => { if (db && sessionUser) navigate(location.hash.slice(1)); });
  if (db) db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { sessionUser = null; profile = null; showAuth(); }
    if (event === 'SIGNED_IN' && session?.user && !sessionUser) {
      setTimeout(() => refreshSession(), 0);
    }
  });

  refreshSession();
})();
