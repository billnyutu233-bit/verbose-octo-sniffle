(() => {
  const cfg = window.RMS_CONFIG || {};
  const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR_');

  let client = null;
  try {
    if (ready && window.supabase && typeof window.supabase.createClient === 'function') {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
  } catch (err) {
    console.error('Supabase init error:', err);
  }

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = n => new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES'
  }).format(Number(n || 0));

  const dateTime = value => value ? new Date(value).toLocaleString() : '—';
  const today = () => new Date().toISOString().slice(0, 10);
  let currentProfile = null;
  let currentUser = null;

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function toast(message, type = 'success') {
    const region = $('#toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`;
    el.textContent = message;
    region.append(el);
    setTimeout(() => el.remove(), 4200);
  }

  function showAuth(tab = 'login') {
    $('#auth-screen')?.classList.remove('hidden');
    $('#app-shell')?.classList.add('hidden');

    $$('[data-auth-tab]').forEach(b =>
      b.classList.toggle('active', b.dataset.authTab === tab)
    );

    $('#login-form-wrap')?.classList.toggle('hidden', tab !== 'login');
    $('#signup-form-wrap')?.classList.toggle('hidden', tab !== 'signup');
  }

  // Attach tab switchers right away so buttons are never dormant
  $$('[data-auth-tab]').forEach(btn =>
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showAuth(btn.dataset.authTab);
    })
  );

  function showApp(user, profile) {
    currentUser = user;
    currentProfile = profile;
    $('#auth-screen')?.classList.add('hidden');
    $('#app-shell')?.classList.remove('hidden');

    const role = profile?.role || 'staff';
    const isManager = role === 'manager';

    $$('.manager-only').forEach(el => el.classList.toggle('hidden', !isManager));
    $$('.staff-only').forEach(el => el.classList.toggle('hidden', isManager));

    const fallbackName = user.email ? user.email.split('@')[0] : 'Restaurant User';
    const name = profile?.full_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      fallbackName;

    $('#user-name').textContent = `${name} (${role.toUpperCase()})`;
    $('#user-email').textContent = user.email || '';
    $('#user-avatar').textContent = name.charAt(0).toUpperCase();
    $('#top-avatar').textContent = name.charAt(0).toUpperCase();

    $('#top-date').textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const defaultPage = isManager ? 'dashboard' : 'portal';
    navigate(location.hash.replace('#', '') || defaultPage);
  }

  async function loadProfile(user) {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) console.warn('Profile lookup:', error.message);

    const fallbackName = user.email ? user.email.split('@')[0] : 'Restaurant User';
    return data || {
      id: user.id,
      role: 'staff',
      full_name: user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        fallbackName
    };
  }

  async function refreshSession() {
    if (!client) {
      showAuth();
      toast('Supabase connection not ready. Check config.js and your internet connection.', 'error');
      return;
    }

    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) toast(error.message, 'error');

      if (session?.user) {
        showApp(session.user, await loadProfile(session.user));
      } else {
        showAuth();
      }
    } catch (err) {
      console.error('Session check failed:', err);
      showAuth();
    }
  }

  $('#login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!client) return toast('Configure Supabase in config.js first.', 'error');

    const f = new FormData(e.currentTarget);
    const button = e.currentTarget.querySelector('button[type=submit]');
    button.disabled = true;

    const { data, error } = await client.auth.signInWithPassword({
      email: String(f.get('email')).trim(),
      password: f.get('password')
    });

    button.disabled = false;
    if (error) return toast(error.message, 'error');

    showApp(data.user, await loadProfile(data.user));
    toast('Welcome back.');
  });

  $('#signup-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!client) return toast('Configure Supabase in config.js first.', 'error');

    const f = new FormData(e.currentTarget);
    const name = String(f.get('name')).trim();
    const email = String(f.get('email')).trim();
    const password = String(f.get('password'));

    if (password.length < 8) {
      return toast('Use a password with at least 8 characters.', 'error');
    }

    const button = e.currentTarget.querySelector('button[type=submit]');
    button.disabled = true;

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: location.origin + location.pathname
      }
    });

    button.disabled = false;
    if (error) return toast(error.message, 'error');

    if (data.session) {
      showApp(data.user, await loadProfile(data.user));
      toast('Account created successfully.');
    } else {
      e.currentTarget.reset();
      toast('Account created. Check your email to confirm your address, then sign in.');
      showAuth('login');
    }
  });

  async function googleAuth() {
    if (!client) return toast('Configure Supabase in config.js first.', 'error');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname }
    });
    if (error) toast(error.message, 'error');
  }

  $('#google-login')?.addEventListener('click', googleAuth);
  $('#google-signup')?.addEventListener('click', googleAuth);

  $('#logout-btn')?.addEventListener('click', async () => {
    if (!client) return showAuth();
    const { error } = await client.auth.signOut();
    if (error) return toast(error.message, 'error');
    showAuth();
    toast('You have signed out.');
  });

  $('#menu-toggle')?.addEventListener('click', () =>
    $('#sidebar')?.classList.toggle('open')
  );

  function navigate(page) {
    const isManager = (currentProfile?.role || 'staff') === 'manager';
    const managerPages = ['dashboard', 'shifts', 'payroll', 'menu', 'orders', 'reports'];
    const staffPages = ['portal'];
    const allowed = isManager ? managerPages : staffPages;

    if (!allowed.includes(page)) page = isManager ? 'dashboard' : 'portal';

    history.replaceState(null, '', `#${page}`);

    $$('.nav-link').forEach(b =>
      b.classList.toggle('active', b.dataset.page === page)
    );

    $('#sidebar')?.classList.remove('open');

    const renderer = {
      dashboard: renderDashboard,
      shifts: renderShiftsAdmin,
      payroll: renderPayrollAdmin,
      menu: renderMenu,
      orders: renderOrders,
      reports: renderReports,
      portal: renderStaffPortal
    };

    $('#page-content').innerHTML = '<div class="loading-state">Loading…</div>';

    renderer[page]().catch(err => {
      console.error(err);
      $('#page-content').innerHTML =
        `<div class="notice error">Unable to load this section: ${escapeHTML(err.message)}</div>`;
      toast(err.message || 'Unable to load data.', 'error');
    });
  }

  $$('.nav-link').forEach(b =>
    b.addEventListener('click', () => navigate(b.dataset.page))
  );

  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) navigate(go.dataset.go);
  });

  window.addEventListener('hashchange', () => {
    if (client && currentProfile) navigate(location.hash.slice(1));
  });

  // 1. STAFF PORTAL VIEW
  async function renderStaffPortal() {
    const uid = currentUser.id;
    const [
      { data: shifts, error: e1 },
      { data: records, error: e2 }
    ] = await Promise.all([
      client.from('staff_shifts').select('*').eq('staff_id', uid).order('shift_date', { ascending: false }),
      client.from('staff_records').select('*').eq('staff_id', uid).order('created_at', { ascending: false })
    ]);

    if (e1) throw e1;
    if (e2) throw e2;

    const latestPay = (records || [])[0];
    const netPay = latestPay ? (Number(latestPay.base_pay) + Number(latestPay.bonus_or_tips) - Number(latestPay.deductions)) : 0;

    $('#page-content').innerHTML = `
      <div class="page-heading">
        <div>
          <p class="eyebrow">STAFF PORTAL</p>
          <h1>Welcome, ${escapeHTML(currentProfile?.full_name || 'Staff Member')}</h1>
          <p class="muted">View your assigned duty shifts, performance notes, and payroll status.</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">ASSIGNED SHIFTS</div>
          <div class="stat-value">${(shifts || []).length}</div>
          <small>Total scheduled duties</small>
        </div>
        <div class="stat-card">
          <div class="stat-label">LATEST NET PAY</div>
          <div class="stat-value">${money(netPay)}</div>
          <small>${latestPay ? escapeHTML(latestPay.month_label) : 'No records yet'}</small>
        </div>
        <div class="stat-card">
