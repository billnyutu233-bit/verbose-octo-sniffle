(() => {
  const cfg = window.RMS_CONFIG || {};
  const URL = (cfg.SUPABASE_URL || '').replace(/\/$/, '');
  const KEY = cfg.SUPABASE_ANON_KEY || '';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = n => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number(n || 0));
  const dateTime = v => v ? new Date(v).toLocaleString() : '—';
  const today = () => new Date().toISOString().slice(0, 10);

  let session = JSON.parse(localStorage.getItem('rms_session') || 'null');
  let currentProfile = null;

  function escapeHTML(v = '') {
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(msg, type = 'success') {
    const box = $('#auth-debug-msg');
    if (box && !$('#auth-screen').classList.contains('hidden')) {
      box.style.display = 'block';
      box.style.background = type === 'error' ? '#fee2e2' : '#dcfce7';
      box.style.color = type === 'error' ? '#991b1b' : '#166534';
      box.textContent = msg;
    }
    const region = $('#toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`;
    el.textContent = msg;
    region.append(el);
    setTimeout(() => el.remove(), 4200);
  }

  // Direct Supabase REST & Auth helper (zero external libraries needed)
  async function sbFetch(path, options = {}) {
    if (!URL || !KEY || URL.includes('YOUR')) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in config.js');
    const headers = {
      'apikey': KEY,
      'Content-Type': 'application/json',
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : { 'Authorization': `Bearer ${KEY}` }),
      ...(options.headers || {})
    };
    const res = await fetch(`${URL}${path}`, { ...options, headers });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.msg || data?.error_description || data?.message || `Error ${res.status}`);
    return data;
  }

  // Override Google login to work directly without external SDK
  window.startGoogleLogin = () => {
    if (!URL || URL.includes('YOUR')) return toast('Missing SUPABASE_URL in config.js', 'error');
    const redirect = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${URL}/auth/v1/authorize?provider=google&redirect_to=${redirect}`;
  };

  function saveSession(s) {
    session = s;
    if (s) localStorage.setItem('rms_session', JSON.stringify(s));
    else localStorage.removeItem('rms_session');
  }

  function showAuth(tab = 'login') {
    $('#auth-screen')?.classList.remove('hidden');
    $('#app-shell')?.classList.add('hidden');
    if (window.switchAuthTab) window.switchAuthTab(tab);
  }

  async function loadProfile(user) {
    try {
      const rows = await sbFetch(`/rest/v1/profiles?id=eq.${user.id}&select=*`);
      if (rows && rows.length > 0) return rows[0];
    } catch (e) {
      console.warn('Profile fetch:', e.message);
    }
    const fallback = user.email ? user.email.split('@')[0] : 'User';
    return { id: user.id, role: 'staff', full_name: user.user_metadata?.full_name || fallback };
  }

  function showApp(user, profile) {
    currentProfile = profile;
    $('#auth-screen')?.classList.add('hidden');
    $('#app-shell')?.classList.remove('hidden');

    const role = profile?.role || 'staff';
    const isManager = role === 'manager';

    $$('.manager-only').forEach(el => el.classList.toggle('hidden', !isManager));
    $$('.staff-only').forEach(el => el.classList.toggle('hidden', isManager));

    const name = String(profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
    $('#user-name').textContent = `${name} (${role.toUpperCase()})`;
    $('#user-email').textContent = user.email || '';
    $('#user-avatar').textContent = name.charAt(0).toUpperCase();
    $('#top-avatar').textContent = name.charAt(0).toUpperCase();
    $('#top-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    navigate(location.hash.replace('#', '') || (isManager ? 'dashboard' : 'portal'));
  }

  async function init() {
    // Handle Google OAuth redirect token in URL hash
    if (location.hash.includes('access_token=')) {
      const params = new URLSearchParams(location.hash.substring(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token) {
        history.replaceState(null, '', location.pathname);
        session = { access_token, refresh_token };
        try {
          const user = await sbFetch('/auth/v1/user');
          saveSession({ access_token, refresh_token, user });
          showApp(user, await loadProfile(user));
          return;
        } catch (e) {
          saveSession(null);
        }
      }
    }

    if (session?.access_token) {
      try {
        const user = await sbFetch('/auth/v1/user');
        saveSession({ ...session, user });
        showApp(user, await loadProfile(user));
        return;
      } catch (e) {
        saveSession(null);
      }
    }
    showAuth('login');
  }

  $('#login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const btn = e.currentTarget.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const data = await sbFetch('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: String(f.get('email')).trim(), password: f.get('password') })
      });
      saveSession(data);
      showApp(data.user, await loadProfile(data.user));
      toast('Welcome back.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('#signup-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name')).trim();
    const email = String(f.get('email')).trim();
    const password = String(f.get('password'));
    const btn = e.currentTarget.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const data = await sbFetch('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, data: { full_name: name } })
      });
      if (data.access_token) {
        saveSession(data);
        showApp(data.user, await loadProfile(data.user));
        toast('Account created successfully.');
      } else {
        e.currentTarget.reset();
        toast('Account created! Check email to confirm or turn off Confirm Email in Supabase.');
        showAuth('login');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  $('#logout-btn')?.addEventListener('click', () => {
    saveSession(null);
    currentProfile = null;
    showAuth('login');
  });

  $('#menu-toggle')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('open'));

  function navigate(page) {
    const isManager = (currentProfile?.role || 'staff') === 'manager';
    const allowed = isManager ? ['dashboard', 'shifts', 'payroll', 'menu', 'orders', 'reports'] : ['portal'];
    if (!allowed.includes(page)) page = isManager ? 'dashboard' : 'portal';

    history.replaceState(null, '', `#${page}`);
    $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    $('#sidebar')?.classList.remove('open');

    const views = { dashboard: renderDashboard, shifts: renderShiftsAdmin, payroll: renderPayrollAdmin, menu: renderMenu, orders: renderOrders, reports: renderReports, portal: renderStaffPortal };
    $('#page-content').innerHTML = '<div class="loading-state">Loading…</div>';
    views[page]().catch(err => {
      $('#page-content').innerHTML = `<div class="notice error">${escapeHTML(err.message)}</div>`;
    });
  }

  $$('.nav-link').forEach(b => b.addEventListener('click', () => navigate(b.dataset.page)));
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) navigate(g.dataset.go); });

  // STAFF PORTAL
  async function renderStaffPortal() {
    const uid = session.user.id;
    const [shifts, records] = await Promise.all([
      sbFetch(`/rest/v1/staff_shifts?staff_id=eq.${uid}&order=shift_date.desc`),
      sbFetch(`/rest/v1/staff_records?staff_id=eq.${uid}&order=created_at.desc`)
    ]);
    const latest = records?.[0];
    const netPay = latest ? (Number(latest.base_pay) + Number(latest.bonus_or_tips) - Number(latest.deductions)) : 0;

    $('#page-content').innerHTML = `
      <div class="page-heading"><div><p class="eyebrow">STAFF PORTAL</p><h1>Welcome, ${escapeHTML(currentProfile?.full_name || 'Staff')}</h1></div></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">ASSIGNED SHIFTS</div><div class="stat-value">${shifts.length}</div></div>
        <div class="stat-card"><div class="stat-label">LATEST NET PAY</div><div class="stat-value">${money(netPay)}</div></div>
        <div class="stat-card"><div class="stat-label">STATUS</div><div class="stat-value">${latest ? escapeHTML(latest.payment_status.toUpperCase()) : '—'}</div></div>
      </div>
      <div class="panel" style="margin-top:1.5rem;"><h2>My Shifts</h2><div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Time</th><th>Station</th><th>Status</th></tr></thead>
