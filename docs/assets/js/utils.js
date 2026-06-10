// KudiSave - Utility Functions

// Theme Management
const THEME_STORAGE_KEY = 'kudisave_theme';

function getStoredTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, persist = true) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  if (persist) localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  document.documentElement.setAttribute('data-theme', nextTheme);
  updateThemeIcon(nextTheme);
  return nextTheme;
}

function initTheme() {
  applyTheme(getStoredTheme(), false);
}

// Called by api.js after preferences are loaded (syncs localStorage)
function initThemeFromPreferences() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'dark' || storedTheme === 'light') {
    applyTheme(storedTheme);
    return;
  }

  const preferredTheme = typeof getUserPreference === 'function' ? getUserPreference('theme') : null;
  applyTheme(preferredTheme === 'dark' || preferredTheme === 'light' ? preferredTheme : getStoredTheme());
}

async function toggleTheme(theme) {
  const nextTheme = theme === 'dark' || theme === 'light'
    ? theme
    : (getStoredTheme() === 'dark' ? 'light' : 'dark');
  applyTheme(nextTheme);

  if (typeof setUserPreference === 'function') {
    await setUserPreference('theme', nextTheme);
  }

  return nextTheme;
}

function updateThemeIcon(theme) {
  const themeButtons = document.querySelectorAll('.theme-toggle');
  themeButtons.forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPopupCloseButtons();
  initBottomTapBar();
  initDesktopAppNav();
  initInAppNotifications();
  initPwaInstallPrompt();
});

let deferredInstallPrompt = null;

function initPwaInstallPrompt() {
  registerServiceWorker();
  ensurePwaInstallStyles();

  if (isAppInstalled()) return;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showPwaInstallPrompt('install');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    localStorage.setItem('kudisave_app_installed', 'true');
    hidePwaInstallPrompt();
    if (typeof showToast === 'function') {
      showToast('KudiSave has been added to your home screen.');
    }
  });

  setTimeout(() => {
    if (!deferredInstallPrompt && isIosSafari() && !isInstallPromptDismissed()) {
      showPwaInstallPrompt('ios');
    }
  }, 1400);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const workerPath = getAppBasePath() + 'service-worker.js';
  navigator.serviceWorker.register(workerPath).catch(error => {
    console.warn('Service worker registration failed:', error);
  });
}

function getAppBasePath() {
  const pathname = window.location.pathname.toLowerCase();
  return pathname.includes('/pages/') ? '../' : '';
}

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    localStorage.getItem('kudisave_app_installed') === 'true';
}

function isIosSafari() {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
  return isIos && isSafari;
}

function isInstallPromptDismissed() {
  const dismissedAt = parseInt(localStorage.getItem('kudisave_install_dismissed_at') || '0', 10);
  if (!dismissedAt) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt < sevenDays;
}

function showPwaInstallPrompt(mode = 'install') {
  if (document.querySelector('.pwa-install-card') || isAppInstalled() || isInstallPromptDismissed()) return;

  const isIosMode = mode === 'ios';
  const card = document.createElement('div');
  card.className = 'pwa-install-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `
    <button class="pwa-install-close" type="button" aria-label="Close install prompt">
      <i data-lucide="x"></i>
    </button>
    <div class="pwa-install-icon">
      <i data-lucide="${isIosMode ? 'share' : 'download'}"></i>
    </div>
    <div class="pwa-install-copy">
      <strong>Add KudiSave to your home screen</strong>
      <span>${isIosMode ? 'On iPhone, tap Share, then Add to Home Screen.' : 'Install it like an app. No Play Store or App Store needed.'}</span>
    </div>
    <button class="pwa-install-action" type="button">
      ${isIosMode ? 'Show Me How' : 'Add App'}
    </button>
  `;

  document.body.appendChild(card);
  if (typeof lucide !== 'undefined') lucide.createIcons({ node: card });

  let iosHelpShown = false;
  card.querySelector('.pwa-install-close').addEventListener('click', () => {
    localStorage.setItem('kudisave_install_dismissed_at', String(Date.now()));
    hidePwaInstallPrompt();
  });

  card.querySelector('.pwa-install-action').addEventListener('click', async () => {
    if (isIosMode) {
      if (iosHelpShown) {
        localStorage.setItem('kudisave_install_dismissed_at', String(Date.now()));
        hidePwaInstallPrompt();
        return;
      }
      iosHelpShown = true;
      card.classList.add('show-ios-help');
      card.querySelector('.pwa-install-copy span').textContent = 'Tap the browser Share button, choose Add to Home Screen, then tap Add.';
      card.querySelector('.pwa-install-action').textContent = 'Got it';
      return;
    }

    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (choice.outcome === 'accepted') {
      localStorage.setItem('kudisave_app_installed', 'true');
      hidePwaInstallPrompt();
    } else {
      localStorage.setItem('kudisave_install_dismissed_at', String(Date.now()));
    }
  });
}

function hidePwaInstallPrompt() {
  document.querySelector('.pwa-install-card')?.remove();
}

function ensurePwaInstallStyles() {
  if (document.getElementById('pwa-install-styles')) return;

  const style = document.createElement('style');
  style.id = 'pwa-install-styles';
  style.textContent = `
    .pwa-install-card {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: calc(var(--bottom-nav-height, 0px) + 16px + env(safe-area-inset-bottom, 0px));
      z-index: 1200;
      max-width: 430px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 12px;
      align-items: center;
      padding: 14px;
      border-radius: 20px;
      background: rgba(255,255,255,0.96);
      border: 1px solid rgba(3, 48, 54, 0.1);
      box-shadow: 0 20px 50px rgba(3, 48, 54, 0.18);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      color: var(--text-primary, #033036);
    }

    .pwa-install-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 999px;
      background: rgba(3, 48, 54, 0.08);
      color: #033036;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .pwa-install-close i {
      width: 16px;
      height: 16px;
    }

    .pwa-install-icon {
      width: 44px;
      height: 44px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      background: var(--primary-color, #033036);
    }

    .pwa-install-icon i {
      width: 22px;
      height: 22px;
    }

    .pwa-install-copy {
      min-width: 0;
      padding-right: 28px;
    }

    .pwa-install-copy strong {
      display: block;
      font-size: 14px;
      line-height: 1.2;
      font-weight: 900;
      letter-spacing: 0;
    }

    .pwa-install-copy span {
      display: block;
      margin-top: 4px;
      color: var(--text-muted, #66777a);
      font-size: 12px;
      line-height: 1.45;
      font-weight: 650;
    }

    .pwa-install-action {
      grid-column: 1 / -1;
      min-height: 42px;
      border: 0;
      border-radius: 14px;
      background: var(--primary-color, #033036);
      color: #ffffff;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0;
      cursor: pointer;
    }

    [data-theme="dark"] .pwa-install-card {
      background: rgba(15, 23, 42, 0.96);
      border-color: rgba(255,255,255,0.1);
      color: #ffffff;
    }

    [data-theme="dark"] .pwa-install-close {
      color: #ffffff;
      background: rgba(255,255,255,0.1);
    }

    @media (min-width: 768px) {
      .pwa-install-card {
        left: auto;
        right: 24px;
        bottom: 24px;
        width: 390px;
        margin: 0;
      }

      body.has-desktop-nav .pwa-install-card {
        left: auto;
      }
    }
  `;
  document.head.appendChild(style);
}

function initPopupCloseButtons(root = document) {
  const buttons = root.querySelectorAll('.close-btn, .currency-close-btn');
  buttons.forEach(btn => {
    if (!btn.querySelector('[data-lucide="x"]')) {
      btn.innerHTML = '<i data-lucide="x"></i>';
    }
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'Close');
    if (!btn.getAttribute('title')) btn.setAttribute('title', 'Close');
    if (!btn.getAttribute('type')) btn.setAttribute('type', 'button');
  });
  if (typeof lucide !== 'undefined') lucide.createIcons({ node: root });
}

function initBottomTapBar() {
  const existingNav = document.querySelector('.bottom-nav');
  if (existingNav) {
    existingNav.querySelectorAll('.bottom-nav-item').forEach(item => {
      const label = item.querySelector('span:last-child');
      if (label && label.textContent.trim() === 'Bills') {
        item.setAttribute('href', 'reports.html');
        item.setAttribute('aria-label', 'Reports');
        const icon = item.querySelector('[data-lucide]');
        if (icon) icon.setAttribute('data-lucide', 'bar-chart-3');
        label.textContent = 'Reports';
      }
    });
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: existingNav });
    return;
  }

  const page = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const enabledPages = new Set([
    'dashboard.html',
    'expenses.html',
    'bills.html',
    'subscriptions.html',
    'reports.html',
    'settings.html',
    'tools.html',
    'challenges.html',
    'goals.html',
    'achievements.html'
  ]);

  if (!enabledPages.has(page)) return;

  const items = [
    { href: 'dashboard.html', label: 'Home', icon: 'house', match: ['dashboard.html'] },
    { href: 'expenses.html', label: 'List', icon: 'list', match: ['expenses.html', 'reports.html'] },
    { href: 'expenses.html', label: 'Add', icon: 'plus', center: true, action: 'add-expense' },
    { href: 'reports.html', label: 'Reports', icon: 'bar-chart-3', match: ['reports.html'] },
    { href: 'settings.html', label: 'Settings', icon: 'settings', match: ['settings.html', 'challenges.html', 'goals.html', 'achievements.html'] }
  ];

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Primary navigation');
  nav.innerHTML = items.map(item => {
    const active = item.match && item.match.includes(page) ? ' active' : '';
    const center = item.center ? ' bottom-nav-center' : '';
    const action = item.action ? ` data-action="${item.action}"` : '';
    return `
      <a class="bottom-nav-item${active}${center}" href="${item.href}"${action} aria-label="${item.label}">
        <span class="nav-icon"><i data-lucide="${item.icon}"></i></span>
        <span>${item.label}</span>
      </a>`;
  }).join('');

  document.body.appendChild(nav);

  const addBtn = nav.querySelector('[data-action="add-expense"]');
  if (addBtn) {
    addBtn.addEventListener('click', event => {
      if (typeof openAddModal === 'function') {
        event.preventDefault();
        openAddModal();
      } else if (typeof openExpenseModal === 'function') {
        event.preventDefault();
        openExpenseModal();
      }
    });
  }

  if (typeof lucide !== 'undefined') lucide.createIcons({ node: nav });
}

function initDesktopAppNav() {
  if (document.querySelector('.desktop-app-nav')) return;

  const page = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const enabledPages = new Set([
    'dashboard.html',
    'expenses.html',
    'bills.html',
    'subscriptions.html',
    'reports.html',
    'settings.html',
    'tools.html',
    'challenges.html',
    'goals.html',
    'achievements.html'
  ]);

  if (!enabledPages.has(page)) return;

  document.body.classList.add('has-desktop-nav');
  ensureDesktopNavStyles();

  const groups = [
    {
      label: 'Main',
      items: [
        { href: 'dashboard.html', label: 'Dashboard', icon: 'layout-dashboard', match: ['dashboard.html'] },
        { href: 'expenses.html', label: 'Transactions', icon: 'list', match: ['expenses.html'] },
        { href: 'reports.html', label: 'Reports', icon: 'bar-chart-3', match: ['reports.html'] }
      ]
    },
    {
      label: 'Money',
      items: [
        { href: 'bills.html', label: 'Bills Due', icon: 'calendar-check', match: ['bills.html'] },
        { href: 'subscriptions.html', label: 'Subscriptions', icon: 'repeat', match: ['subscriptions.html'] },
        { href: 'goals.html', label: 'Goals', icon: 'target', match: ['goals.html'] }
      ]
    },
    {
      label: 'Progress',
      items: [
        { href: 'challenges.html', label: 'Challenges', icon: 'swords', match: ['challenges.html'] },
        { href: 'achievements.html', label: 'Achievements', icon: 'trophy', match: ['achievements.html'] },
        { href: 'tools.html', label: 'Shortcuts', icon: 'grid-3x3', match: ['tools.html'] }
      ]
    }
  ];

  const nav = document.createElement('aside');
  nav.className = 'desktop-app-nav';
  nav.setAttribute('aria-label', 'Desktop navigation');
  nav.innerHTML = `
    <a class="desktop-nav-brand" href="dashboard.html" aria-label="KudiSave dashboard">
      <span class="desktop-nav-logo"><i data-lucide="wallet"></i></span>
      <span>
        <strong>KudiSave</strong>
        <small>Money dashboard</small>
      </span>
    </a>
    <div class="desktop-nav-cta">
      <button type="button" onclick="openDesktopQuickAdd()">
        <i data-lucide="plus"></i>
        <span>Add Transaction</span>
      </button>
    </div>
    <div class="desktop-nav-groups">
      ${groups.map(group => `
        <div class="desktop-nav-group">
          <div class="desktop-nav-label">${group.label}</div>
          ${group.items.map(item => {
            const active = item.match.includes(page) ? ' active' : '';
            return `<a class="desktop-nav-link${active}" href="${item.href}">
              <i data-lucide="${item.icon}"></i>
              <span>${item.label}</span>
            </a>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
    <a class="desktop-nav-link desktop-nav-settings${page === 'settings.html' ? ' active' : ''}" href="settings.html">
      <i data-lucide="settings"></i>
      <span>Settings</span>
    </a>
  `;

  document.body.appendChild(nav);
  if (typeof lucide !== 'undefined') lucide.createIcons({ node: nav });
}

function ensureDesktopNavStyles() {
  if (document.getElementById('desktop-app-nav-runtime-styles')) return;
  const style = document.createElement('style');
  style.id = 'desktop-app-nav-runtime-styles';
  style.textContent = `
    @media (min-width: 768px) {
      body.has-desktop-nav { padding-left: var(--desktop-nav-width, 248px) !important; }
      body.has-desktop-nav .mtn-header,
      body.has-desktop-nav .header {
        left: var(--desktop-nav-width, 248px) !important;
        width: auto !important;
      }
      body.has-desktop-nav .mtn-topbar,
      body.has-desktop-nav .mtn-info-section,
      body.has-desktop-nav .header-balance {
        width: min(1180px, calc(100vw - var(--desktop-nav-width, 248px) - 64px)) !important;
      }
      body.has-desktop-nav .container,
      body.has-desktop-nav .main-content,
      body.has-desktop-nav main.main-content,
      body.has-desktop-nav .main-container,
      body.has-desktop-nav .tools-content {
        width: min(1180px, calc(100vw - var(--desktop-nav-width, 248px) - 64px)) !important;
        max-width: 1180px !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function openDesktopQuickAdd() {
  if (typeof openAddModal === 'function') {
    openAddModal();
    return;
  }
  if (typeof openExpenseModal === 'function') {
    openExpenseModal();
    return;
  }
  window.location.href = 'expenses.html';
}

// In-app notifications
const NOTIFICATION_TYPE_CONFIG = {
  level_up: { icon: 'sparkles', className: 'success', href: 'achievements.html' },
  badge_earned: { icon: 'trophy', className: 'success', href: 'achievements.html' },
  budget_alert: { icon: 'triangle-alert', className: 'warning', href: 'dashboard.html' },
  bill_reminder: { icon: 'calendar-clock', className: 'warning', href: 'bills.html' },
  goal_milestone: { icon: 'target', className: 'success', href: 'goals.html' },
  goal_reminder: { icon: 'target', className: 'info', href: 'goals.html' },
  streak_milestone: { icon: 'flame', className: 'success', href: 'achievements.html' },
  challenge: { icon: 'swords', className: 'info', href: 'challenges.html' },
  weekly_summary: { icon: 'bar-chart-3', className: 'info', href: 'reports.html' },
  tip: { icon: 'lightbulb', className: 'info', href: 'tools.html' },
  default: { icon: 'bell', className: 'info', href: 'settings.html' }
};

let inAppNotifications = [];
let inAppNotificationsLoaded = false;
let inAppNotificationsLoading = false;

function initInAppNotifications() {
  if (document.body.dataset.notificationsReady === 'true') return;
  if (!isAuthenticated() || typeof api === 'undefined') return;
  if (!shouldShowNotificationLauncher()) return;

  document.body.dataset.notificationsReady = 'true';
  ensureInAppNotificationStyles();
  ensureNotificationPanel();
  ensureNotificationLauncher();
  loadInAppNotifications({ silent: true });

  document.addEventListener('click', event => {
    const panel = document.getElementById('notificationPanel');
    const launcher = event.target.closest('[data-notification-launcher]');
    if (!panel || launcher || event.target.closest('#notificationPanel')) return;
    closeNotificationPanel();
  });
}

function shouldShowNotificationLauncher() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  return page === 'dashboard.html';
}

function ensureNotificationLauncher() {
  const topbar = document.querySelector('.mtn-topbar-actions');
  if (topbar && !topbar.querySelector('[data-notification-launcher]')) {
    topbar.insertAdjacentHTML('beforeend', `
      <button class="mtn-icon-btn notification-launcher header-notification-btn" type="button" data-notification-launcher aria-label="Open notifications">
        <i data-lucide="bell"></i>
        <span class="notification-badge" data-notification-count hidden></span>
      </button>
    `);
  } else if (!topbar && !document.querySelector('[data-notification-launcher]')) {
    document.body.insertAdjacentHTML('beforeend', `
      <button class="notification-fab notification-launcher" type="button" data-notification-launcher aria-label="Open notifications">
        <i data-lucide="bell"></i>
        <span class="notification-badge" data-notification-count hidden></span>
      </button>
    `);
  }

  document.querySelectorAll('[data-notification-launcher]').forEach(button => {
    if (button.dataset.notificationBound === 'true') return;
    button.dataset.notificationBound = 'true';
    button.addEventListener('click', event => {
      event.preventDefault();
      toggleNotificationPanel();
    });
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function ensureNotificationPanel() {
  if (document.getElementById('notificationPanel')) return;

  const panel = document.createElement('aside');
  panel.id = 'notificationPanel';
  panel.className = 'notification-panel';
  panel.setAttribute('aria-label', 'Notifications');
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="notification-panel-header">
      <div>
        <p class="notification-eyebrow">KudiSave</p>
        <h2>Notifications</h2>
      </div>
      <button class="notification-close" type="button" aria-label="Close notifications">
        <i data-lucide="x"></i>
      </button>
    </div>
    <div class="notification-panel-actions">
      <button type="button" data-notification-refresh>
        <i data-lucide="refresh-cw"></i>
        <span>Refresh</span>
      </button>
      <button type="button" data-notification-mark-all>
        <i data-lucide="check-check"></i>
        <span>Mark all read</span>
      </button>
    </div>
    <div class="notification-list" data-notification-list>
      <div class="notification-state">Loading notifications...</div>
    </div>
  `;

  document.body.appendChild(panel);
  panel.querySelector('.notification-close').addEventListener('click', closeNotificationPanel);
  panel.querySelector('[data-notification-refresh]').addEventListener('click', refreshInAppNotifications);
  panel.querySelector('[data-notification-mark-all]').addEventListener('click', markAllInAppNotificationsRead);

  if (typeof lucide !== 'undefined') lucide.createIcons({ node: panel });
}

function toggleNotificationPanel() {
  const panel = document.getElementById('notificationPanel');
  if (!panel) return;

  const willOpen = !panel.classList.contains('active');
  panel.classList.toggle('active', willOpen);
  panel.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
  document.querySelectorAll('[data-notification-launcher]').forEach(btn => {
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  if (willOpen) loadInAppNotifications();
}

function closeNotificationPanel() {
  const panel = document.getElementById('notificationPanel');
  if (!panel) return;
  panel.classList.remove('active');
  panel.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('[data-notification-launcher]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

async function loadInAppNotifications(options = {}) {
  if (inAppNotificationsLoading || typeof api === 'undefined' || !isAuthenticated()) return;
  if (inAppNotificationsLoaded && !options.force && !options.silent) {
    renderInAppNotifications();
    return;
  }

  inAppNotificationsLoading = true;
  if (!options.silent) renderNotificationState('Loading notifications...');

  try {
    const response = await api.getNotifications({ limit: 30 });
    inAppNotifications = Array.isArray(response.data) ? response.data : [];
    inAppNotificationsLoaded = true;
    renderInAppNotifications();
    updateNotificationBadges();
  } catch (error) {
    console.warn('Failed to load notifications:', error);
    if (!options.silent) {
      renderNotificationState('Could not load notifications. Pull a refresh in a moment.');
    }
  } finally {
    inAppNotificationsLoading = false;
  }
}

async function refreshInAppNotifications(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const panel = document.getElementById('notificationPanel');
  if (panel) {
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
  }
  document.querySelectorAll('[data-notification-launcher]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'true');
  });

  await loadInAppNotifications({ force: true });
}

function renderInAppNotifications() {
  const list = document.querySelector('[data-notification-list]');
  if (!list) return;

  if (!inAppNotifications.length) {
    list.innerHTML = `
      <div class="notification-empty">
        <span><i data-lucide="bell-off"></i></span>
        <strong>All quiet for now</strong>
        <p>Budget alerts, goal wins, bill reminders, and achievement updates will show up here.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: list });
    return;
  }

  list.innerHTML = inAppNotifications.map(notification => {
    const config = getNotificationTypeConfig(notification.type);
    const unreadClass = notification.is_read ? '' : ' unread';
    const href = config.href || 'settings.html';
    return `
      <article class="notification-card${unreadClass}" data-notification-id="${escapeHtml(notification.id)}">
        <a class="notification-card-link" href="${href}">
          <span class="notification-card-icon ${config.className}">
            <i data-lucide="${config.icon}"></i>
          </span>
          <span class="notification-card-copy">
            <strong>${escapeHtml(notification.title || 'Notification')}</strong>
            <span>${escapeHtml(notification.message || '')}</span>
            <small>${formatNotificationTime(notification.created_at)}</small>
          </span>
        </a>
        ${notification.is_read ? '' : '<button type="button" class="notification-read-btn" data-mark-notification-read title="Mark as read" aria-label="Mark notification as read"><i data-lucide="check"></i></button>'}
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-mark-notification-read]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const card = event.currentTarget.closest('[data-notification-id]');
      if (card) markInAppNotificationRead(card.dataset.notificationId);
    });
  });

  list.querySelectorAll('.notification-card-link').forEach(link => {
    link.addEventListener('click', async event => {
      const card = event.currentTarget.closest('[data-notification-id]');
      const notification = inAppNotifications.find(item => String(item.id) === String(card?.dataset.notificationId));
      const href = event.currentTarget.getAttribute('href');

      if (notification && !notification.is_read && href) {
        event.preventDefault();
        await markInAppNotificationRead(notification.id, { silent: true });
        window.location.href = href;
      }
    });
  });

  if (typeof lucide !== 'undefined') lucide.createIcons({ node: list });
}

function renderNotificationState(message) {
  const list = document.querySelector('[data-notification-list]');
  if (list) list.innerHTML = `<div class="notification-state">${escapeHtml(message)}</div>`;
}

async function markInAppNotificationRead(id, options = {}) {
  if (!id || typeof api === 'undefined') return;
  const notification = inAppNotifications.find(item => String(item.id) === String(id));
  if (notification) notification.is_read = true;
  renderInAppNotifications();
  updateNotificationBadges();

  try {
    await api.markNotificationRead(id);
  } catch (error) {
    console.warn('Failed to mark notification as read:', error);
    if (notification) notification.is_read = false;
    renderInAppNotifications();
    updateNotificationBadges();
    if (!options.silent && typeof showAlert === 'function') {
      showAlert('Could not update notification', 'error');
    }
  }
}

async function markAllInAppNotificationsRead() {
  if (typeof api === 'undefined' || inAppNotifications.length === 0) return;
  const previous = inAppNotifications.map(item => ({ id: item.id, is_read: item.is_read }));
  inAppNotifications = inAppNotifications.map(item => ({ ...item, is_read: true }));
  renderInAppNotifications();
  updateNotificationBadges();

  try {
    await api.markAllNotificationsRead();
    if (typeof showAlert === 'function') showAlert('Notifications marked as read', 'success');
  } catch (error) {
    console.warn('Failed to mark all notifications as read:', error);
    inAppNotifications = inAppNotifications.map(item => {
      const old = previous.find(prev => prev.id === item.id);
      return old ? { ...item, is_read: old.is_read } : item;
    });
    renderInAppNotifications();
    updateNotificationBadges();
    if (typeof showAlert === 'function') showAlert('Could not update notifications', 'error');
  }
}

function updateNotificationBadges() {
  const unread = inAppNotifications.filter(item => !item.is_read).length;
  document.querySelectorAll('[data-notification-count]').forEach(badge => {
    badge.hidden = unread === 0;
    badge.textContent = unread > 9 ? '9+' : String(unread);
  });
}

function getNotificationTypeConfig(type) {
  const normalized = String(type || '').toLowerCase().replace(/[\s-]+/g, '_');
  return NOTIFICATION_TYPE_CONFIG[normalized] || NOTIFICATION_TYPE_CONFIG.default;
}

function formatNotificationTime(value) {
  if (!value) return 'Just now';
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return 'Recently';

  const diff = Date.now() - created.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;
  return created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function ensureInAppNotificationStyles() {
  if (document.getElementById('in-app-notification-styles')) return;

  const style = document.createElement('style');
  style.id = 'in-app-notification-styles';
  style.textContent = `
    .notification-launcher {
      position: relative;
      z-index: 1250;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .notification-launcher::before {
      content: '';
      position: absolute;
      inset: -10px;
      border-radius: 20px;
    }

    .header-notification-btn {
      width: 48px !important;
      height: 48px !important;
      min-width: 48px !important;
      min-height: 48px !important;
      border-radius: 16px !important;
      box-shadow: 0 12px 26px rgba(3, 48, 54, 0.18) !important;
    }

    .header-notification-btn i {
      width: 21px !important;
      height: 21px !important;
      stroke-width: 2.5;
    }

    .notification-launcher:active {
      transform: scale(0.94);
    }

    .notification-launcher:focus-visible {
      outline: 3px solid rgba(252, 209, 22, 0.65);
      outline-offset: 3px;
    }

    .notification-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 999px;
      background: #ef4444;
      color: #ffffff;
      border: 2px solid #ffffff;
      font-size: 10px;
      font-weight: 900;
      line-height: 14px;
      text-align: center;
      box-shadow: 0 6px 14px rgba(239, 68, 68, 0.28);
    }

    .notification-fab {
      position: fixed;
      right: 18px;
      bottom: calc(var(--bottom-nav-height, 0px) + 104px + env(safe-area-inset-bottom, 0px));
      z-index: 1250;
      width: 58px;
      height: 58px;
      min-width: 58px;
      min-height: 58px;
      border: 0;
      border-radius: 20px;
      background: var(--primary-color, #033036);
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 18px 34px rgba(3, 48, 54, 0.28);
      cursor: pointer;
    }

    .notification-fab i {
      width: 24px !important;
      height: 24px !important;
      stroke-width: 2.5;
    }

    .notification-fab i,
    .notification-close i,
    .notification-panel-actions i,
    .notification-card-icon i,
    .notification-read-btn i {
      width: 18px;
      height: 18px;
    }

    .notification-panel {
      position: fixed;
      top: calc(12px + env(safe-area-inset-top, 0px));
      right: 12px;
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      z-index: 1300;
      width: min(390px, calc(100vw - 24px));
      display: flex;
      flex-direction: column;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid rgba(3, 48, 54, 0.1);
      color: var(--text-primary, #033036);
      box-shadow: 0 28px 70px rgba(3, 48, 54, 0.24);
      transform: translateX(calc(100% + 24px));
      opacity: 0;
      pointer-events: none;
      transition: transform 0.28s ease, opacity 0.28s ease;
      overflow: hidden;
    }

    .notification-panel.active {
      transform: translateX(0);
      opacity: 1;
      pointer-events: auto;
    }

    .notification-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 18px 12px;
      border-bottom: 1px solid rgba(3, 48, 54, 0.08);
    }

    .notification-eyebrow {
      margin: 0 0 3px;
      color: var(--text-muted, #66777a);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .notification-panel-header h2 {
      margin: 0;
      font-size: 22px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .notification-close,
    .notification-panel-actions button,
    .notification-read-btn {
      border: 0;
      cursor: pointer;
    }

    .notification-close {
      width: 38px;
      height: 38px;
      border-radius: 14px;
      background: rgba(3, 48, 54, 0.08);
      color: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .notification-panel-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(3, 48, 54, 0.08);
    }

    .notification-panel-actions button {
      min-height: 38px;
      border-radius: 14px;
      background: rgba(3, 48, 54, 0.07);
      color: var(--primary-color, #033036);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      font-size: 12px;
      font-weight: 850;
    }

    .notification-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 10px 12px 16px;
    }

    .notification-card {
      position: relative;
      margin-bottom: 10px;
      border-radius: 18px;
      background: rgba(3, 48, 54, 0.04);
      border: 1px solid rgba(3, 48, 54, 0.07);
      transition: background 0.2s ease, transform 0.2s ease;
    }

    .notification-card.unread {
      background: rgba(11, 115, 125, 0.1);
      border-color: rgba(11, 115, 125, 0.22);
    }

    .notification-card-link {
      display: grid;
      grid-template-columns: 42px 1fr;
      gap: 12px;
      padding: 13px 44px 13px 13px;
      color: inherit;
      text-decoration: none;
    }

    .notification-card-icon {
      width: 42px;
      height: 42px;
      border-radius: 15px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      background: var(--primary-color, #033036);
    }

    .notification-card-icon.success { background: #059669; }
    .notification-card-icon.warning { background: #d97706; }
    .notification-card-icon.info { background: #0b737d; }

    .notification-card-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .notification-card-copy strong {
      font-size: 14px;
      line-height: 1.25;
      font-weight: 900;
    }

    .notification-card-copy span {
      color: var(--text-secondary, #4b5f63);
      font-size: 12px;
      line-height: 1.45;
      font-weight: 600;
    }

    .notification-card-copy small {
      color: var(--text-muted, #66777a);
      font-size: 11px;
      font-weight: 750;
    }

    .notification-read-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: #ffffff;
      color: var(--primary-color, #033036);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 18px rgba(3, 48, 54, 0.12);
    }

    .notification-state,
    .notification-empty {
      min-height: 230px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 20px;
      color: var(--text-muted, #66777a);
      font-size: 13px;
      line-height: 1.5;
      font-weight: 650;
    }

    .notification-empty span {
      width: 54px;
      height: 54px;
      border-radius: 18px;
      background: rgba(3, 48, 54, 0.08);
      color: var(--primary-color, #033036);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }

    .notification-empty span i {
      width: 24px;
      height: 24px;
    }

    .notification-empty strong {
      color: var(--text-primary, #033036);
      font-size: 15px;
      margin-bottom: 5px;
    }

    .notification-empty p {
      margin: 0;
      max-width: 250px;
    }

    [data-theme="dark"] .notification-panel {
      background: rgba(15, 23, 42, 0.98);
      border-color: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    [data-theme="dark"] .notification-close,
    [data-theme="dark"] .notification-panel-actions button,
    [data-theme="dark"] .notification-card,
    [data-theme="dark"] .notification-empty span {
      background: rgba(255, 255, 255, 0.08);
    }

    [data-theme="dark"] .notification-card {
      border-color: rgba(255, 255, 255, 0.08);
    }

    [data-theme="dark"] .notification-card.unread {
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.2);
    }

    [data-theme="dark"] .notification-card-copy span,
    [data-theme="dark"] .notification-card-copy small,
    [data-theme="dark"] .notification-eyebrow,
    [data-theme="dark"] .notification-empty {
      color: rgba(255, 255, 255, 0.68);
    }

    [data-theme="dark"] .notification-empty strong,
    [data-theme="dark"] .notification-panel-actions button,
    [data-theme="dark"] .notification-empty span {
      color: #ffffff;
    }

    @media (max-width: 520px) {
      .notification-panel {
        top: auto;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        max-height: min(82vh, 720px);
        border-radius: 24px 24px 0 0;
        transform: translateY(100%);
      }

      .notification-panel.active {
        transform: translateY(0);
      }
    }

    @media (min-width: 768px) {
      body.has-desktop-nav .notification-fab {
        right: 24px;
        bottom: 24px;
      }
    }
  `;
  document.head.appendChild(style);
}

// Currency configuration
const CURRENCY_CONFIG = {
  'GHS': { symbol: 'GH\u20b5', name: 'Ghana Cedi', locale: 'en-GH' },
  'USD': { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  'EUR': { symbol: '\u20ac', name: 'Euro', locale: 'de-DE' },
  'GBP': { symbol: '\u00a3', name: 'British Pound', locale: 'en-GB' },
  'NGN': { symbol: '\u20a6', name: 'Nigerian Naira', locale: 'en-NG' },
  'KES': { symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE' },
  'ZAR': { symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  'XOF': { symbol: 'CFA', name: 'West African CFA', locale: 'fr-SN' }
};

// Get current currency from user preferences (API) with localStorage fallback
function getCurrentCurrency() {
  if (typeof getUserPreference === 'function') {
    return getUserPreference('currency') || localStorage.getItem('currency') || 'GHS';
  }
  return localStorage.getItem('currency') || 'GHS';
}

// Set currency preference
async function setCurrency(currencyCode) {
  localStorage.setItem('currency', currencyCode);
  if (typeof setUserPreference === 'function') {
    await setUserPreference('currency', currencyCode);
  }
  window.dispatchEvent(new CustomEvent('currencychange', { detail: { currency: currencyCode } }));
  return currencyCode;
}

// Get currency symbol
function getCurrencySymbol(code = null) {
  const currency = code || getCurrentCurrency();
  return CURRENCY_CONFIG[currency]?.symbol || currency;
}

// Format currency with user's selected currency
function formatCurrency(amount, currencyCode = null) {
  const code = currencyCode || getCurrentCurrency();
  const config = CURRENCY_CONFIG[code] || CURRENCY_CONFIG['GHS'];
  const num = parseFloat(amount) || 0;
  return `${config.symbol} ${num.toLocaleString(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format currency without symbol (just the number)
function formatCurrencyAmount(amount) {
  const code = getCurrentCurrency();
  const config = CURRENCY_CONFIG[code] || CURRENCY_CONFIG['GHS'];
  const num = parseFloat(amount) || 0;
  return num.toLocaleString(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Show toast notification (mobile-friendly)
function showAlert(message, type = 'success') {
  const alertOptions = typeof message === 'object' && message !== null ? message : { message };
  const alertType = alertOptions.type || type || 'success';
  const messageText = alertOptions.message || alertOptions.detail || '';
  const titleOverride = alertOptions.title;
  const duration = Number(alertOptions.duration) > 0 ? Number(alertOptions.duration) : 4000;

  // Ensure toast container exists
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toastConfig = {
    success: { icon: 'check', title: 'Saved successfully' },
    error: { icon: 'alert-circle', title: 'Needs attention' },
    warning: { icon: 'alert-triangle', title: 'Heads up' },
    info: { icon: 'info', title: 'KudiSave' }
  };
  const config = toastConfig[alertType] || toastConfig.info;
  const title = titleOverride || config.title;

  const toast = document.createElement('div');
  toast.className = `toast toast-${alertType}`;
  toast.setAttribute('role', alertType === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', alertType === 'error' ? 'assertive' : 'polite');
  toast.innerHTML = `
    <div class="toast-accent"></div>
    <div class="toast-icon"><i data-lucide="${config.icon}"></i></div>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(messageText)}</div>
    </div>
    <button class="toast-dismiss" type="button" aria-label="Dismiss notification"><i data-lucide="x"></i></button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons({ node: toast });

  // Auto-dismiss after 4 seconds
  const timer = setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);

  toast.querySelector('.toast-dismiss')?.addEventListener('click', () => {
    clearTimeout(timer);
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  });

  // Swipe to dismiss
  let startX = 0;
  toast.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  toast.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - startX;
    if (Math.abs(dx) > 10) toast.style.transform = `translateX(${dx}px)`;
    toast.style.opacity = Math.max(0, 1 - Math.abs(dx) / 200);
  }, { passive: true });
  toast.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 80) {
      clearTimeout(timer);
      toast.remove();
    } else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
  });

  // Limit to 3 toasts visible
  const toasts = container.querySelectorAll('.toast');
  if (toasts.length > 3) toasts[0].remove();
}

function getAlertIcon(type) {
  const icons = {
    success: 'âœ…',
    error: 'âŒ',
    warning: 'âš ï¸'
  };
  return icons[type] || 'ðŸ’¡';
}

// Show loading overlay
function showLoading(message = 'Working on it...', detail = 'This should only take a moment') {
  const options = typeof message === 'object' && message !== null ? message : { message, detail };
  const title = options.message || options.title || 'Working on it...';
  const subtitle = options.detail || options.subtitle || 'This should only take a moment';
  const existingOverlay = document.getElementById('loading-overlay');
  if (existingOverlay) {
    const currentCount = parseInt(existingOverlay.dataset.loadingCount || '1', 10);
    existingOverlay.dataset.loadingCount = String(currentCount + 1);
    existingOverlay.querySelector('[data-loading-title]').textContent = title;
    existingOverlay.querySelector('[data-loading-detail]').textContent = subtitle;
    existingOverlay.classList.remove('loading-overlay-exit');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.dataset.loadingCount = '1';
  overlay.innerHTML = `
    <div class="loading-card">
      <div class="loading-orbit" aria-hidden="true">
        <span class="loading-spinner"></span>
      </div>
      <div class="loading-copy">
        <div class="loading-text" data-loading-title>${escapeHtml(title)}</div>
        <div class="loading-detail" data-loading-detail>${escapeHtml(subtitle)}</div>
      </div>
      <div class="loading-progress" aria-hidden="true"></div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideLoading(force = false) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    const currentCount = parseInt(overlay.dataset.loadingCount || '1', 10);
    if (!force && currentCount > 1) {
      overlay.dataset.loadingCount = String(currentCount - 1);
      return;
    }
    overlay.dataset.loadingCount = '0';
    overlay.classList.add('loading-overlay-exit');
    setTimeout(() => overlay.remove(), 180);
  }
}

// Check if user is authenticated
function isAuthenticated() {
  return !!localStorage.getItem('token');
}

// Redirect to login if not authenticated
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '../index.html';
  }
}

// Save current page to user preferences (API)
async function saveCurrentPage() {
  const currentPath = window.location.pathname;
  // Extract just the page filename
  const pageName = currentPath.split('/').pop();

  // Don't save login, splash, or onboarding pages
  if (pageName &&
      pageName !== 'index.html' &&
      pageName !== 'splash.html' &&
      pageName !== 'onboarding.html' &&
      pageName.endsWith('.html')) {
    // Save relative path for pages folder
    const relativePath = currentPath.includes('/pages/') ?
      'pages/' + pageName : pageName;

    // Save to API if available
    if (typeof setUserPreference === 'function') {
      await setUserPreference('last_visited_page', relativePath);
    }
  }
}

// Get last visited page from user preferences
function getLastVisitedPage() {
  if (typeof getUserPreference === 'function') {
    return getUserPreference('last_visited_page') || 'pages/dashboard.html';
  }
  return 'pages/dashboard.html';
}

// Check if user should be redirected to last page (for index.html)
function checkReturnToLastPage() {
  const token = localStorage.getItem('token');

  if (token) {
    // User is logged in, return to last page from preferences
    const lastPage = getLastVisitedPage();
    window.location.href = lastPage;
    return true;
  }
  return false;
}

// Ghana-specific expense categories
const EXPENSE_CATEGORIES = [
  'Food / Chop Bar',
  'Transport (Trotro / Bolt)',
  'Data / Airtime',
  'Rent / Hostel',
  'Utilities',
  'Church / Donations',
  'Betting / Gaming',
  'Entertainment',
  'Shopping',
  'Miscellaneous'
];

// Payment methods in Ghana
const PAYMENT_METHODS = [
  'Cash',
  'MTN MoMo',
  'Telecel Cash',
  'Visa Card',
  'Bank Transfer',
  'AirtelTigo Money'
];

// Income sources
const INCOME_SOURCES = [
  'Allowance',
  'Salary',
  'Business',
  'Gift',
  'Hustle',
  'Investment',
  'Other'
];

// Get category icon
function getCategoryIcon(category) {
  const icons = {
    'Food / Chop Bar': 'ðŸ›',
    'Transport (Trotro / Bolt)': 'ðŸšŒ',
    'Data / Airtime': 'ðŸ“±',
    'Rent / Hostel': 'ðŸ ',
    'Utilities': 'ðŸ’¡',
    'Church / Donations': 'â›ª',
    'Betting / Gaming': 'ðŸŽ²',
    'Entertainment': 'ðŸŽ¬',
    'Shopping': 'ðŸ›ï¸',
    'Miscellaneous': 'ðŸ“¦'
  };
  return icons[category] || 'ðŸ’°';
}

function getCategoryIconName(category) {
  const icons = {
    'Food / Chop Bar': 'utensils',
    'Transport (Trotro / Bolt)': 'bus',
    'Data / Airtime': 'smartphone',
    'Rent / Hostel': 'home',
    'Utilities': 'lightbulb',
    'Church / Donations': 'heart-handshake',
    'Betting / Gaming': 'dice-5',
    'Entertainment': 'film',
    'Shopping': 'shopping-bag',
    'Bills & Utilities': 'receipt',
    'Bills': 'receipt',
    'Health': 'pill',
    'Education': 'book-open',
    'Miscellaneous': 'package',
    'Other': 'wallet'
  };
  return icons[category] || 'wallet';
}

// Get motivational message based on budget usage
function getMotivationalMessage(budgetUsage) {
  if (budgetUsage <= 50) {
    return "Chale, you dey do well! ðŸ’ª";
  } else if (budgetUsage <= 75) {
    return "You dey on point! Keep pushing ðŸš€";
  } else if (budgetUsage <= 90) {
    return "Small small ooo, you go reach ðŸ˜…";
  } else {
    return "Masa, check your spending waa ðŸ¤”";
  }
}

// Calculate progress percentage
function calculateProgress(current, target) {
  if (target === 0) return 0;
  return Math.min(100, (current / target) * 100);
}

// Get badge emoji
function getBadgeEmoji(badgeName) {
  const emojis = {
    'Data King/Queen': 'ðŸ‘‘',
    'Chop Saver': 'ðŸ½ï¸',
    'Budget Boss': 'ðŸ’¼',
    'Consistency Champ': 'ðŸ”¥',
    'Goal Getter': 'ðŸŽ¯',
    'Transport Wise': 'ðŸš—'
  };
  return emojis[badgeName] || 'ðŸ†';
}

// Get tier color
function getTierColor(tier) {
  const colors = {
    'bronze': '#CD7F32',
    'silver': '#C0C0C0',
    'gold': '#FFD700',
    'platinum': '#E5E4E2'
  };
  return colors[tier] || '#FFD700';
}

// Validate Ghana phone number (accepts 233XXXXXXXXX or 0XXXXXXXXX)
function validateGhanaPhone(phone) {
  const regex = /^(233[0-9]{9}|0[0-9]{9})$/;
  return regex.test(phone);
}

// Format phone number display
function formatPhoneNumber(phone) {
  if (phone.startsWith('233')) {
    return `+${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  if (phone.startsWith('0')) {
    return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
  }
  return phone;
}

// Debounce function for search/filter
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Generate chart colors (Green & White theme)
function getChartColors(count) {
  const colors = [
    '#033036', // Primary Green
    '#0b737d', // Light Green
    '#064a52', // Dark Green
    '#10b981', // Success green
    '#059669', // Emerald
    '#047857', // Deep emerald
    '#34d399', // Mint
    '#ffffff', // White
    '#6ee7b7', // Light mint
    '#a7f3d0'  // Pale green
  ];

  return colors.slice(0, count);
}

// Group expenses by date
function groupExpensesByDate(expenses) {
  const grouped = {};
  expenses.forEach(expense => {
    const date = expense.expense_date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(expense);
  });
  return grouped;
}

// Calculate date range
function getDateRange(period) {
  const end = new Date();
  const start = new Date();

  switch(period) {
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0]
  };
}

// ================================
// FUN & LIVELY UTILITIES ðŸŽ‰
// ================================

// Confetti celebration
function showConfetti(particleCount = 50) {
  const colors = ['#033036', '#0b737d', '#ffffff', '#34d399', '#fbbf24'];

  // Add keyframes if not exist
  if (!document.getElementById('confetti-keyframes')) {
    const style = document.createElement('style');
    style.id = 'confetti-keyframes';
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(-10px) rotate(0deg) scale(1); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg) scale(0); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  for (let i = 0; i < particleCount; i++) {
    const confetti = document.createElement('div');
    const size = Math.random() * 10 + 5;
    confetti.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}vw;
      top: -20px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      z-index: 9999;
      pointer-events: none;
      animation: confetti-fall ${2 + Math.random() * 3}s linear forwards;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 5000);
  }
}

// Fun toast notification with emoji
function showFunToast(message, emoji = 'ðŸŽ‰', duration = 3000) {
  // Remove existing toasts
  const existing = document.querySelector('.fun-toast');
  if (existing) existing.remove();

  // Add keyframes if not exist
  if (!document.getElementById('toast-keyframes')) {
    const style = document.createElement('style');
    style.id = 'toast-keyframes';
    style.textContent = `
      @keyframes toast-bounce-in {
        0% { transform: translateX(-50%) translateY(100px) scale(0.5); opacity: 0; }
        60% { transform: translateX(-50%) translateY(-10px) scale(1.05); }
        100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      }
      @keyframes toast-bounce-out {
        0% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        100% { transform: translateX(-50%) translateY(100px) scale(0.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const toast = document.createElement('div');
  toast.className = 'fun-toast';
  toast.innerHTML = `<span style="font-size: 24px; animation: bounce 1s ease infinite;">${emoji}</span> ${message}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #033036, #0b737d);
    color: white;
    padding: 14px 24px;
    border-radius: 50px;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 10px 40px rgba(3, 48, 54, 0.4);
    z-index: 9999;
    animation: toast-bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-bounce-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Celebration with sound
function celebrate(title = 'Great Job!', type = 'success') {
  showConfetti(60);
  showFunToast(title, type === 'success' ? 'ðŸŽ‰' : 'ðŸ†', 4000);

  // Play celebration sound
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.12 + 0.25);
      osc.start(audioCtx.currentTime + i * 0.12);
      osc.stop(audioCtx.currentTime + i * 0.12 + 0.25);
    });
  } catch (e) { /* Audio not supported */ }
}

// Animated counter
function animateNumber(element, target, duration = 1000, prefix = '', suffix = '') {
  const start = parseFloat(element.textContent.replace(/[^0-9.-]+/g, '')) || 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * easeProgress;
    element.textContent = prefix + current.toFixed(2) + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = prefix + target.toFixed(2) + suffix;
      element.style.animation = 'pop 0.3s ease';
      setTimeout(() => element.style.animation = '', 300);
    }
  }

  requestAnimationFrame(update);
}

// Add floating emoji
function floatEmoji(element, emoji) {
  const float = document.createElement('span');
  float.textContent = emoji;
  float.style.cssText = `
    position: absolute;
    font-size: 20px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    animation: float-away 1.5s ease-out forwards;
    pointer-events: none;
    z-index: 100;
  `;

  if (!document.getElementById('float-emoji-keyframes')) {
    const style = document.createElement('style');
    style.id = 'float-emoji-keyframes';
    style.textContent = `
      @keyframes float-away {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -150%) scale(1.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  element.style.position = 'relative';
  element.appendChild(float);
  setTimeout(() => float.remove(), 1500);
}

// Haptic feedback (for mobile)
function vibrate(pattern = [10]) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// Success pulse effect
function pulseSuccess(element) {
  element.style.animation = 'pulse-success 0.5s ease';

  if (!document.getElementById('pulse-success-keyframes')) {
    const style = document.createElement('style');
    style.id = 'pulse-success-keyframes';
    style.textContent = `
      @keyframes pulse-success {
        0% { box-shadow: 0 0 0 0 rgba(11, 115, 125, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(11, 115, 125, 0); }
        100% { box-shadow: 0 0 0 0 rgba(11, 115, 125, 0); }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => element.style.animation = '', 500);
}

// Get random encouraging message
function getRandomEncouragement() {
  const messages = [
    { text: "You're doing great! ðŸ’ª", emoji: "ðŸ’ª" },
    { text: "Keep up the good work! ðŸŒŸ", emoji: "ðŸŒŸ" },
    { text: "Awesome progress! ðŸš€", emoji: "ðŸš€" },
    { text: "You're on fire! ðŸ”¥", emoji: "ðŸ”¥" },
    { text: "Financial ninja! ðŸ¥·", emoji: "ðŸ¥·" },
    { text: "Money master! ðŸ’°", emoji: "ðŸ’°" },
    { text: "Saving superstar! â­", emoji: "â­" },
    { text: "Budget boss! ðŸ‘‘", emoji: "ðŸ‘‘" }
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// Export functions
window.utils = {
  initBottomTapBar,
  initInAppNotifications,
  loadInAppNotifications,
  formatCurrency,
  formatCurrencyAmount,
  getCurrentCurrency,
  setCurrency,
  getCurrencySymbol,
  CURRENCY_CONFIG,
  formatDate,
  getTodayDate,
  showAlert,
  showLoading,
  hideLoading,
  isAuthenticated,
  requireAuth,
  saveCurrentPage,
  getLastVisitedPage,
  checkReturnToLastPage,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  INCOME_SOURCES,
  getCategoryIcon,
  getCategoryIconName,
  getMotivationalMessage,
  calculateProgress,
  getBadgeEmoji,
  getTierColor,
  validateGhanaPhone,
  formatPhoneNumber,
  debounce,
  getChartColors,
  groupExpensesByDate,
  getDateRange,
  // Fun utilities
  showConfetti,
  showFunToast,
  celebrate,
  animateNumber,
  floatEmoji,
  vibrate,
  pulseSuccess,
  getRandomEncouragement
};
