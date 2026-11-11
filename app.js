(() => {
  const cfg = window.RMS_CONFIG || {};
  const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR_');

  const client = ready
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const money = n => new Intl.NumberFormat('en-KE', {
    style:'currency', currency:'KES'
  }).format(Number(n||0));

  const dateTime = value => value ? new Date(value).toLocaleString() : '—';
  const today = () => new Date().toISOString().slice(0,10);
  let currentProfile = null;

  function escapeHTML(value='') {
    return String(value).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  function toast(message, type='success') {
    const el = document.createElement('div');
    el.className = `toast ${type==='error'?'error':''}`;
    el.textContent = message;
    $('#toast-region').append(el);
    setTimeout(() => el.remove(), 4200);
  }

  function showAuth(tab='login') {
    $('#auth-screen').classList.remove('hidden');
    $('#app-shell').classList.add('hidden');

    $$('[data-auth-tab]').forEach(b =>
      b.classList.toggle('active', b.dataset.authTab===tab)
    );

    $('#login-form-wrap').classList.toggle('hidden', tab!=='login');
    $('#signup-form-wrap').classList.toggle('hidden', tab!=='signup');
  }

  function showApp(user, profile) {
    currentProfile = profile;
    $('#auth-screen').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');

    const name = profile?.full_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Restaurant User';

    $('#user-name').textContent = name;
    $('#user-email').textContent = user.email || '';
    $('#user-avatar').textContent = name.charAt(0).toUpperCase();
    $('#top-avatar').textContent = name.charAt(0).toUpperCase();

    $('#top-date').textContent = new Date().toLocaleDateString(undefined, {
      weekday:'long', year:'numeric', month:'long', day:'numeric'
    });

    navigate(location.hash.replace('#','') || 'dashboard');
  }

  async function loadProfile(user) {
    const {data,error} = await client
      .from('profiles')
      .select('*')
      .eq('id',user.id)
      .maybeSingle();

    if(error) console.warn('Profile lookup:',error.message);

    return data || {
      full_name:user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0]
    };
  }

  async function refreshSession() {
    if(!client) {
      showAuth();
      toast('Add your Supabase URL and anon key in config.js to connect the website.','error');
      return;
    }

    const {data:{session},error} = await client.auth.getSession();

    if(error) toast(error.message,'error');

    if(session?.user) {
      showApp(session.user, await loadProfile(session.user));
    } else {
      showAuth();
    }
  }

  $$('[data-auth-tab]').forEach(btn =>
    btn.addEventListener('click', () => showAuth(btn.dataset.authTab))
  );

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();

    if(!client) return toast('Configure Supabase in config.js first.','error');

    const f = new FormData(e.currentTarget);
    const button = e.currentTarget.querySelector('button[type=submit]');
    button.disabled = true;

    const {data,error} = await client.auth.signInWithPassword({
      email:String(f.get('email')).trim(),
      password:f.get('password')
    });

    button.disabled = false;

    if(error) return toast(error.message,'error');

    showApp(data.user, await loadProfile(data.user));
    toast('Welcome back.');
  });

  $('#signup-form').addEventListener('submit', async e => {
    e.preventDefault();

    if(!client) return toast('Configure Supabase in config.js first.','error');

    const f = new FormData(e.currentTarget);
    const name = String(f.get('name')).trim();
    const email = String(f.get('email')).trim();
    const password = String(f.get('password'));

    if(password.length < 8) {
      return toast('Use a password with at least 8 characters.','error');
    }

    const button = e.currentTarget.querySelector('button[type=submit]');
    button.disabled = true;

    const {data,error} = await client.auth.signUp({
      email,
      password,
      options:{
        data:{full_name:name},
        emailRedirectTo:location.origin+location.pathname
      }
    });

    button.disabled = false;

    if(error) return toast(error.message,'error');

    if(data.session) {
      showApp(data.user, await loadProfile(data.user));
      toast('Account created successfully.');
    } else {
      e.currentTarget.reset();
      toast('Account created. Check your email to confirm your address, then sign in.');
      showAuth('login');
    }
  });

  async function googleAuth() {
    if(!client) return toast('Configure Supabase in config.js first.','error');

    const {error} = await client.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:location.origin+location.pathname
      }
    });

    if(error) toast(error.message,'error');
  }

  $('#google-login').addEventListener('click',googleAuth);
  $('#google-signup').addEventListener('click',googleAuth);

  $('#logout-btn').addEventListener('click',async () => {
    const {error} = await client.auth.signOut();

    if(error) return toast(error.message,'error');

    showAuth();
    toast('You have signed out.');
  });

  $('#menu-toggle').addEventListener('click',() =>
    $('#sidebar').classList.toggle('open')
  );

  function navigate(page) {
    const allowed = ['dashboard','menu','orders','reports'];

    if(!allowed.includes(page)) page = 'dashboard';

    history.replaceState(null,'',`#${page}`);

    $$('.nav-link').forEach(b =>
      b.classList.toggle('active',b.dataset.page===page)
    );

    $('#sidebar').classList.remove('open');

    const renderer = {
      dashboard:renderDashboard,
      menu:renderMenu,
      orders:renderOrders,
      reports:renderReports
    };

    $('#page-content').innerHTML = '<div class="loading-state">Loading…</div>';

    renderer[page]().catch(err => {
      console.error(err);
      $('#page-content').innerHTML =
        '<div class="notice error">Unable to load this section. Check your Supabase setup and database policies.</div>';
      toast(err.message || 'Unable to load data.','error');
    });
  }

  $$('.nav-link').forEach(b =>
    b.addEventListener('click',() => navigate(b.dataset.page))
  );

  window.addEventListener('hashchange',() => {
    if(client) navigate(location.hash.slice(1));
  });

  async function renderDashboard() {
    const [
      {data:items,error:e1},
      {data:orders,error:e2}
    ] = await Promise.all([
      client.from('menu_items')
        .select('id,name,category,price,stock,low_stock_level')
        .order('created_at',{ascending:false}),

      client.from('orders')
        .select('id,total,status,created_at')
        .gte('created_at',new Date(new Date().setHours(0,0,0,0)).toISOString())
        .order('created_at',{ascending:false})
    ]);

    if(e1) throw e1;
    if(e2) throw e2;

    const low = (items||[]).filter(x => x.stock<=x.low_stock_level);
    const revenue = (orders||[])
      .filter(x => x.status==='completed')
      .reduce((s,x) => s+Number(x.total),0);

    $('#page-content').innerHTML = `
      <div class="page-heading">
        <div>
          <p class="eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p class="muted">Welcome back, ${escapeHTML(currentProfile?.full_name||'')}. Here's your restaurant summary.</p>
        </div>
        <button class="btn btn-primary" data-go="orders">＋ Record sale</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">TOTAL MENU ITEMS</div>
          <div class="stat-value">${items.length}</div>
          <small>Items in your menu</small>
        </div>
        <div class="stat-card">
          <div class="stat-label">LOW STOCK ALERTS</div>
          <div class="stat-value">${low.length}</div>
          <small>Items requiring attention</small>
        </div>
        <div class="stat-card">
          <div class="stat-label">TODAY'S REVENUE</div>
          <div class="stat-value">${money(revenue)}</div>
          <small>${orders.length} orders recorded today</small>
        </div>
      </div>

      <div class="content-grid">
        <section class="panel">
          <div class="panel-head">
            <h3>Inventory overview</h3>
            <button class="btn btn-secondary btn-small" data-go="menu">Manage menu</button>
          </div>

          ${items.length ? `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Item</th><th>Category</th><th>Price</th><th>Stock</th></tr>
                </thead>
                <tbody>
                  ${items.slice(0,7).map(x => `
                    <tr>
                      <td>${escapeHTML(x.name)}</td>
                      <td>${escapeHTML(x.category)}</td>
                      <td>${money(x.price)}</td>
                      <td>${stockBadge(x)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty">No menu items yet. Add your first item.</div>'}
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>Today's orders</h3>
            <button class="btn btn-secondary btn-small" data-go="orders">View orders</button>
          </div>

          ${orders.length ? orders.slice(0,7).map(o => `
            <div class="activity-row">
              <div>
                <strong>Order #${o.id}</strong>
                <small>${dateTime(o.created_at)}</small>
              </div>
              <strong>${money(o.total)}</strong>
            </div>
          `).join('') : '<div class="empty">No sales recorded today.</div>'}
        </section>
      </div>
    `;

    $$('[data-go]').forEach(b =>
      b.addEventListener('click',() => navigate(b.dataset.go))
    );
  }

  function stockBadge(item) {
    return item.stock<=item.low_stock_level
      ? `<span class="badge low">${item.stock} · Low</span>`
      : `<span class="badge ok">${item.stock} · Available</span>`;
  }

  async function renderMenu(search='') {
    const {data:items,error} = await client
      .from('menu_items')
      .select('*')
      .order('name');

    if(error) throw error;

    const filtered = items.filter(x =>
      (x.name+' '+x.category).toLowerCase().includes(search.toLowerCase())
    );

    $('#page-content').innerHTML = `
      <div class="page-heading">
        <div>
          <p class="eyebrow">RESTAURANT OPERATIONS</p>
          <h1>Menu & Inventory</h1>
          <p class="muted">Create menu items and monitor stock levels.</p>
        </div>
        <button class="btn btn-primary" id="add-item">＋ Add menu item</button>
      </div>

      <section class="panel">
        <div class="panel-head">
          <h3>Menu items <span class="muted">(${items.length})</span></h3>
          <input id="menu-search" class="search-input" placeholder="Search name or category…" value="${escapeHTML(search)}">
        </div>

        ${filtered.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th><th>Category</th><th>Price</th>
                  <th>Stock</th><th>Threshold</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(x => `
                  <tr>
                    <td>
                      <strong>${escapeHTML(x.name)}</strong><br>
                      <small class="muted">${escapeHTML(x.description||'')}</small>
                    </td>
                    <td>${escapeHTML(x.category)}</td>
                    <td>${money(x.price)}</td>
                    <td>${stockBadge(x)}</td>
                    <td>${x.low_stock_level}</td>
                    <td>
                      <button class="btn btn-secondary btn-small" data-edit="${x.id}">Edit</button>
                      <button class="btn btn-danger btn-small" data-delete="${x.id}">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">No menu items found. Add your first item.</div>'}
      </section>
    `;

    $('#add-item').addEventListener('click',() => itemModal());

    $('#menu-search').addEventListener('input',e =>
      renderMenu(e.target.value)
    );

    $$('[data-edit]').forEach(b =>
      b.addEventListener('click',() =>
        itemModal(items.find(x => x.id===Number(b.dataset.edit)))
      )
    );

    $$('[data-delete]').forEach(b =>
      b.addEventListener('click',() =>
        deleteItem(Number(b.dataset.delete))
      )
    );
  }

  function itemModal(item=null) {
    $('#modal-root').innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <form class="modal" id="item-form">
          <h3>${item?'Edit menu item':'Add menu item'}</h3>

          <div class="field">
            <label>Item name</label>
            <input name="name" required maxlength="100" value="${escapeHTML(item?.name||'')}">
          </div>

          <div class="field-row">
            <div class="field">
              <label>Category</label>
              <input name="category" required value="${escapeHTML(item?.category||'')}">
            </div>
            <div class="field">
              <label>Price (KSh)</label>
              <input name="price" type="number" min="0" step="0.01" required value="${item?.price??''}">
            </div>
          </div>

          <div class="field">
            <label>Description</label>
            <input name="description" maxlength="250" value="${escapeHTML(item?.description||'')}">
          </div>

          <div class="field-row">
            <div class="field">
              <label>Stock quantity</label>
              <input name="stock" type="number" min="0" step="1" required value="${item?.stock??0}">
            </div>
            <div class="field">
              <label>Low-stock threshold</label>
              <input name="low_stock_level" type="number" min="0" step="1" required value="${item?.low_stock_level??5}">
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cancel-modal">Cancel</button>
            <button class="btn btn-primary" type="submit">${item?'Save changes':'Add item'}</button>
          </div>
        </form>
      </div>
    `;

    $('#cancel-modal').addEventListener('click',closeModal);

    $('#modal-backdrop').addEventListener('click',e => {
      if(e.target.id==='modal-backdrop') closeModal();
    });

    $('#item-form').addEventListener('submit',async e => {
      e.preventDefault();

      const f = new FormData(e.currentTarget);

      const payload = {
        name:String(f.get('name')).trim(),
        category:String(f.get('category')).trim(),
        description:String(f.get('description')).trim(),
        price:Number(f.get('price')),
        stock:Number(f.get('stock')),
        low_stock_level:Number(f.get('low_stock_level'))
      };

      if(!Number.isFinite(payload.price) || payload.price<0 ||
         !Number.isInteger(payload.stock) || payload.stock<0 ||
         !Number.isInteger(payload.low_stock_level) || payload.low_stock_level<0) {
        return toast('Check price and stock values.','error');
      }

      const result = item
        ? await client.from('menu_items').update(payload).eq('id',item.id)
        : await client.from('menu_items').insert(payload);

      if(result.error) return toast(result.error.message,'error');

      closeModal();
      toast(item?'Menu item updated.':'Menu item added.');
      renderMenu();
    });
  }

  function closeModal() {
    $('#modal-root').innerHTML = '';
  }

  async function deleteItem(id) {
    if(!confirm('Delete this menu item? Items already used in an order cannot be deleted.')) return;

    const {error} = await client.from('menu_items').delete().eq('id',id);

    if(error) return toast(error.message,'error');

    toast('Menu item deleted.');
    renderMenu();
  }

  async function renderOrders() {
    const [
      {data:items,error:e1},
      {data:orders,error:e2}
    ] = await Promise.all([
      client.from('menu_items')
        .select('id,name,price,stock')
        .gt('stock',0)
        .order('name'),

      client.from('orders')
        .select('id,total,status,created_at')
        .order('created_at',{ascending:false})
        .limit(100)
    ]);

    if(e1) throw e1;
    if(e2) throw e2;

    $('#page-content').innerHTML = `
      <div class="page-heading">
        <div>
          <p class="eyebrow">RESTAURANT OPERATIONS</p>
          <h1>Sales & Orders</h1>
          <p class="muted">Record a sale and track completed transactions.</p>
        </div>
      </div>

      <section class="panel">
        <h3>Record a sale</h3>

        <form id="order-form" class="field-row" style="align-items:end;margin-top:18px">
          <div class="field">
            <label>Menu item</label>
            <select name="item_id" required>
              <option value="">Choose item</option>
              ${items.map(x => `
                <option value="${x.id}">
                  ${escapeHTML(x.name)} — ${money(x.price)} (stock: ${x.stock})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="field">
            <label>Quantity</label>
            <input name="quantity" type="number" min="1" step="1" required placeholder="1">
          </div>

          <div class="field">
            <button class="btn btn-primary" type="submit">Record order</button>
          </div>
        </form>

        ${!items.length?'<div class="notice error">No items currently in stock. Add or restock menu items first.</div>':''}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>Order history</h3>
          <span class="muted">Latest 100 transactions</span>
        </div>

        ${orders.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Order</th><th>Date & time</th><th>Status</th><th>Total</th></tr>
              </thead>
              <tbody>
                ${orders.map(o => `
                  <tr>
                    <td>#${o.id}</td>
                    <td>${dateTime(o.created_at)}</td>
                    <td><span class="badge ${o.status==='completed'?'ok':'pending'}">${escapeHTML(o.status)}</span></td>
                    <td><strong>${money(o.total)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">No orders have been recorded.</div>'}
      </section>
    `;

    $('#order-form').addEventListener('submit',async e => {
      e.preventDefault();

      const f = new FormData(e.currentTarget);
      const itemId = Number(f.get('item_id'));
      const quantity = Number(f.get('quantity'));

      if(!itemId || !Number.isInteger(quantity) || quantity<1) {
        return toast('Select an item and a valid quantity.','error');
      }

      const {data,error} = await client.rpc('create_order',{
        p_item_id:itemId,
        p_quantity:quantity
      });

      if(error) return toast(error.message,'error');

      toast(`Order #${data} recorded. Stock has been updated.`);
      renderOrders();
    });
  }

  async function renderReports() {
    const params = new URLSearchParams(
      location.hash.includes('?') ? location.hash.split('?')[1] : ''
    );

    const from = params.get('from') ||
      new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10);

    const to = params.get('to') || today();

    const start = new Date(`${from}T00:00:00`).toISOString();
    const end = new Date(`${to}T23:59:59.999`).toISOString();

    const [
      {data:orders,error:e1},
      {data:lines,error:e2},
      {data:inventory,error:e3}
    ] = await Promise.all([
      client.from('orders')
        .select('id,total,status,created_at')
        .eq('status','completed')
        .gte('created_at',start)
        .lte('created_at',end),

      client.from('order_items')
        .select('item_name,quantity,subtotal,order_id,orders!inner(created_at,status)')
        .eq('orders.status','completed')
        .gte('orders.created_at',start)
        .lte('orders.created_at',end),

      client.from('menu_items')
        .select('name,category,stock,low_stock_level')
        .order('stock')
    ]);

    if(e1) throw e1;
    if(e2) throw e2;
    if(e3) throw e3;

    const revenue = orders.reduce((s,o) => s+Number(o.total),0);
    const units = lines.reduce((s,l) => s+Number(l.quantity),0);
    const grouped = {};

    lines.forEach(l => {
      const x = grouped[l.item_name] || {
        name:l.item_name, qty:0, revenue:0
      };

      x.qty += Number(l.quantity);
      x.revenue += Number(l.subtotal);
      grouped[l.item_name] = x;
    });

    const best = Object.values(grouped).sort((a,b) => b.qty-a.qty);

    $('#page-content').innerHTML = `
      <div class="page-heading">
        <div>
          <p class="eyebrow">BUSINESS INSIGHTS</p>
          <h1>Reports & Analytics</h1>
          <p class="muted">Review revenue, sales performance and current inventory.</p>
        </div>
        <button class="btn btn-secondary no-print" id="print-report">Print report</button>
      </div>

      <section class="panel no-print">
        <form id="report-filter" class="report-filters">
          <div class="field">
            <label>Start date</label>
            <input type="date" name="from" value="${from}" required>
          </div>
          <div class="field">
            <label>End date</label>
            <input type="date" name="to" value="${to}" required>
          </div>
          <button class="btn btn-primary">Apply filter</button>
        </form>
      </section>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">TOTAL REVENUE</div>
          <div class="stat-value">${money(revenue)}</div>
          <small>${from} to ${to}</small>
        </div>
        <div class="stat-card">
          <div class="stat-label">COMPLETED ORDERS</div>
          <div class="stat-value">${orders.length}</div>
          <small>Transactions in selected period</small>
        </div>
        <div class="stat-card">
          <div class="stat-label">UNITS SOLD</div>
          <div class="stat-value">${units}</div>
          <small>Items sold in selected period</small>
        </div>
      </div>

      <section class="panel">
        <h3>Best-selling items</h3>
        ${best.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Menu item</th><th>Quantity sold</th><th>Revenue</th></tr></thead>
              <tbody>
                ${best.map(x => `
                  <tr>
                    <td>${escapeHTML(x.name)}</td>
                    <td>${x.qty}</td>
                    <td>${money(x.revenue)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">No sales in this date range.</div>'}
      </section>

      <section class="panel">
        <h3>Current inventory</h3>
        ${inventory.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Status</th></tr></thead>
              <tbody>
                ${inventory.map(x => `
                  <tr>
                    <td>${escapeHTML(x.name)}</td>
                    <td>${escapeHTML(x.category)}</td>
                    <td>${x.stock}</td>
                    <td>${x.stock<=x.low_stock_level
                      ? '<span class="badge low">Low stock</span>'
                      : '<span class="badge ok">Available</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">No inventory items found.</div>'}
      </section>
    `;

    $('#report-filter').addEventListener('submit',e => {
      e.preventDefault();

      const f = new FormData(e.currentTarget);

      if(f.get('from')>f.get('to')) {
        return toast('Start date must be before end date.','error');
      }

      history.replaceState(
        null,'',
        `#reports?from=${f.get('from')}&to=${f.get('to')}`
      );

      renderReports();
    });

    $('#print-report').addEventListener('click',() => window.print());
  }

  if(client) {
    client.auth.onAuthStateChange((event,session) => {
      if(event==='SIGNED_IN' && session?.user) {
        loadProfile(session.user).then(p => {
          if($('#app-shell').classList.contains('hidden')) {
            showApp(session.user,p);
          }
        });
      }
    });
  }

  refreshSession();
})();
