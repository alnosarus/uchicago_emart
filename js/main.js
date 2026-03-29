/* ═══════════════════════════════════════════════════════════════
   main.js — shared logic for all pages
   ═══════════════════════════════════════════════════════════════ */

/* ── Auth state (sessionStorage so it resets on close) ───────── */
function isLoggedIn() { return sessionStorage.getItem('uchicago_auth') === '1'; }
function setLoggedIn() { sessionStorage.setItem('uchicago_auth', '1'); }

/* ── Current page detection ───────────────────────────────────── */
function currentPage() {
  const p = window.location.pathname.split('/').pop() || 'index.html';
  return p;
}

/* ── Navbar HTML ──────────────────────────────────────────────── */
function getNavbarHTML() {
  const page = currentPage();
  const loggedIn = isLoggedIn();
  const browseActive = (page === 'browse.html') ? 'active' : '';

  return `
  <nav class="navbar">
    <a href="index.html" class="navbar-logo">
      <div class="logo-icon">U</div>
      <span class="logo-text">UChicago Marketplace</span>
    </a>

    <div class="navbar-actions" id="nav-logged-out" style="${loggedIn ? 'display:none' : ''}">
      <a href="browse.html" class="nav-link ${browseActive}">Browse</a>
      <button class="btn btn-ghost" onclick="openModal()">Log In</button>
      <button class="btn btn-primary" onclick="openModal('signup')">Sign Up</button>
    </div>

    <div class="navbar-actions" id="nav-logged-in" style="${loggedIn ? '' : 'display:none'}">
      <a href="browse.html" class="nav-link ${browseActive}">Browse</a>
      <a href="create.html" class="nav-link">+ Post</a>
      <button class="btn-icon" onclick="location.href='notifications.html'" title="Notifications">🔔</button>
      <button class="btn-icon" onclick="location.href='profile.html'" title="Profile">👤</button>
    </div>
  </nav>`;
}

/* ── Auth Modal HTML ──────────────────────────────────────────── */
function getAuthModalHTML() {
  return `
  <div class="modal-overlay" id="authModal">
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div style="text-align:center;margin-bottom:20px;">
        <div class="logo-icon" style="width:52px;height:52px;font-size:22px;margin:0 auto 12px;">U</div>
        <div class="modal-title">Welcome to UChicago Marketplace</div>
        <div class="modal-subtitle">Your UChicago community marketplace</div>
      </div>
      <div class="modal-tabs">
        <div class="modal-tab active" id="tab-login-btn" onclick="switchAuthTab('login',this)">Log In</div>
        <div class="modal-tab" id="tab-signup-btn" onclick="switchAuthTab('signup',this)">Sign Up</div>
      </div>

      <div id="auth-login">
        <div class="form-group">
          <label class="form-label">UChicago Email</label>
          <input type="email" class="form-input" id="login-email" placeholder="cnetid@uchicago.edu" />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" placeholder="••••••••" />
        </div>
        <div id="login-error" style="display:none;color:#9b1212;font-size:13px;margin-bottom:12px;padding:10px 12px;background:var(--maroon-100);border-radius:var(--radius-sm);">
          ⚠️ Please use your UChicago email (@uchicago.edu).
        </div>
        <button class="btn btn-primary" style="width:100%;padding:12px;font-size:15px;border-radius:var(--radius-md);justify-content:center;" onclick="loginUser()">Log In</button>
        <div class="modal-divider">or</div>
        <button class="btn btn-ghost" style="width:100%;padding:12px;font-size:14px;border-radius:var(--radius-md);justify-content:center;">🎓 Continue with UChicago SSO</button>
      </div>

      <div id="auth-signup" style="display:none;">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" class="form-input" placeholder="Alex Johnson" />
        </div>
        <div class="form-group">
          <label class="form-label">UChicago Email <span style="color:var(--maroon-500);font-size:12px;font-weight:400;">— must end in @uchicago.edu</span></label>
          <input type="email" class="form-input" id="signup-email" placeholder="cnetid@uchicago.edu" />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" placeholder="Create a strong password" />
        </div>
        <div id="signup-error" style="display:none;color:#9b1212;font-size:13px;margin-bottom:12px;padding:10px 12px;background:var(--maroon-100);border-radius:var(--radius-sm);">
          ⚠️ Only @uchicago.edu addresses can create an account.
        </div>
        <button class="btn btn-primary" style="width:100%;padding:12px;font-size:15px;border-radius:var(--radius-md);justify-content:center;" onclick="signupUser()">Create Account</button>
      </div>
    </div>
  </div>`;
}

/* ── Init: inject navbar + modal on every page ────────────────── */
function initPage() {
  // Navbar
  const navMount = document.getElementById('navbar-mount');
  if (navMount) navMount.innerHTML = getNavbarHTML();

  // Auth modal
  const modalMount = document.getElementById('modal-mount');
  if (modalMount) modalMount.innerHTML = getAuthModalHTML();

  // Close modal on overlay click
  document.addEventListener('click', (e) => {
    const overlay = document.getElementById('authModal');
    if (overlay && e.target === overlay) closeModal();
  });
}

document.addEventListener('DOMContentLoaded', initPage);

/* ── Auth functions ───────────────────────────────────────────── */
function openModal(tab) {
  if (tab === 'signup') switchAuthTab('signup', document.getElementById('tab-signup-btn'));
  document.getElementById('authModal').classList.add('open');
}
function closeModal() {
  document.getElementById('authModal').classList.remove('open');
}
function switchAuthTab(tab, el) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('auth-login').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('auth-signup').style.display = tab === 'signup' ? '' : 'none';
}
function loginUser() {
  const email = document.getElementById('login-email').value.trim();
  const err   = document.getElementById('login-error');
  if (email && !email.toLowerCase().endsWith('@uchicago.edu')) {
    err.style.display = 'block'; return;
  }
  err.style.display = 'none';
  setLoggedIn();
  closeModal();
  // Refresh navbar to show logged-in state
  document.getElementById('nav-logged-out').style.display = 'none';
  document.getElementById('nav-logged-in').style.display  = 'flex';
}
function signupUser() {
  const email = document.getElementById('signup-email').value.trim();
  const err   = document.getElementById('signup-error');
  if (!email.toLowerCase().endsWith('@uchicago.edu')) {
    err.style.display = 'block'; return;
  }
  err.style.display = 'none';
  setLoggedIn();
  closeModal();
  document.getElementById('nav-logged-out').style.display = 'none';
  document.getElementById('nav-logged-in').style.display  = 'flex';
}

/* ── Filter checkboxes ────────────────────────────────────────── */
function toggleCheck(row) {
  const cb = row.querySelector('.filter-checkbox');
  const on = cb.classList.toggle('checked');
  cb.textContent = on ? '✓' : '';
}

/* ── Generic single-select helpers ───────────────────────────── */
function selectOne(btn, groupSelector, activeClass) {
  const ac = activeClass || 'active';
  btn.closest(groupSelector)
    .querySelectorAll('button, [data-selectable]')
    .forEach(b => b.className = b.className.replace(/active(-\w+)?/g, '').trim());
  btn.classList.add(ac);
}

/* ── Tab switching ────────────────────────────────────────────── */
function switchTab(panelId, btn, headerEl) {
  // Deactivate all panels and buttons within the same container
  const container = btn.closest('.tabs-header').parentElement;
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

/* ── Feature tabs (top-level) ─────────────────────────────────── */
function switchFeatureTab(feature) {
  // Deactivate all feature tabs
  document.querySelectorAll('.feature-tab').forEach(t => {
    t.classList.remove('active-marketplace', 'active-rideshare', 'active-storage');
  });
  // Activate clicked
  const btn = document.getElementById('ftab-' + feature);
  if (btn) btn.classList.add('active-' + feature);

  // Show/hide panels
  ['marketplace','rideshare','storage'].forEach(f => {
    const p = document.getElementById('fpanel-' + f);
    if (p) p.style.display = (f === feature) ? '' : 'none';
  });
}

/* ── Save/Favorite toggle ─────────────────────────────────────── */
function toggleSave(btn) {
  const saved = btn.dataset.saved === '1';
  if (saved) {
    btn.innerHTML = '<span>🤍</span> Save Post';
    btn.dataset.saved = '0';
    btn.style.background = 'linear-gradient(135deg, var(--maroon-600), var(--maroon-700))';
  } else {
    btn.innerHTML = '<span>❤️</span> Saved!';
    btn.dataset.saved = '1';
    btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
  }
}

/* ── Notifications: mark read ─────────────────────────────────── */
function markRead(item) {
  item.classList.remove('unread');
  const dot = item.querySelector('.notif-unread-dot');
  if (dot) dot.remove();
}
function markAllRead() {
  document.querySelectorAll('.notif-item.unread').forEach(markRead);
}
