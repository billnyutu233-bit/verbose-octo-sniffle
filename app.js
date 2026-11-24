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
 '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'''
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

 $('#page-content').innerHTML = '<div class="loading-state">Loading...</div>';

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
 <button class="btn btn-primary" data-go="orders">+ Record sale</button>
 </div>

 <div class="stats-grid">
 <div class="stat-card">
 <div class="stat-label">TOTAL MENU ITEMS</div>
 <div class="stat-value">${items.length}</div>
 <small>Items in your menu</small>
 </div>
