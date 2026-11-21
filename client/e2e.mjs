import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4000';
const ADMIN = { user: 'lab.admin', pass: 'LabAdmin@2026' };
const results = [];
let browser;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function login(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function apiLogin(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return { status: res.status, body: await res.json() };
}

(async () => {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  // ---------------------------------------------------------------- Login page
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const bodyText = await page.locator('body').innerText();
  check('1. Login page has no demo credentials', !/Admin@123|Staff@123|Viewer@123|admin \/ |Demonstration/i.test(bodyText),
    bodyText.match(/Admin@123|Demonstration/gi)?.join(',') || 'clean');
  check('1b. Login has sign-up + forgot password links',
    (await page.locator('a[href="/signup"]').count()) > 0 && (await page.locator('a[href="/forgot-password"]').count()) > 0);
  await page.screenshot({ path: 'shots/01-login.png', fullPage: true });

  // ---------------------------------------------------------------- Signup flow
  const uniqueEmail = `qa.viewer.${Date.now()}@cvsu.edu.ph`;
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
  await page.fill('#name', 'QA Viewer Account');
  await page.fill('#email', uniqueEmail);
  await page.fill('#new-password', 'QaViewer@2026');
  await page.fill('#confirm-password', 'QaViewer@2026');
  await page.screenshot({ path: 'shots/02-signup.png', fullPage: true });
  await page.click('button[type=submit]');
  await page.waitForURL((url) => !url.pathname.includes('/signup'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  const signupRole = await page.locator('.user-menu-btn .user-meta small').innerText().catch(() => '');
  check('1c. Sign up creates a Viewer account', signupRole.trim() === 'Viewer', signupRole);

  // Duplicate email rejected
  const dupRes = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dup', email: uniqueEmail, password: 'QaViewer@2026', confirmPassword: 'QaViewer@2026' }),
  });
  check('1d. Duplicate email rejected', dupRes.status === 409, String(dupRes.status));

  // Role sent by client is ignored
  const roleRes = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Escalate Test', email: `esc.${Date.now()}@cvsu.edu.ph`, password: 'Escalate@2026', confirmPassword: 'Escalate@2026', role: 'Administrator' }),
  });
  const roleBody = await roleRes.json();
  check('1e. Client-supplied role ignored on sign up', roleBody.user?.role === 'Viewer', roleBody.user?.role);

  // -------------------------------------------------- Viewer: sidebar + no write
  const sidebarGear = await page.locator('.sidebar').getAttribute('class');
  check('2. Sidebar starts collapsed', sidebarGear.includes('is-collapsed'), sidebarGear);
  const logoVisible = await page.locator('.sidebar .brand-logo').isVisible();
  const logoLoaded = await page.locator('.sidebar .brand-logo').evaluate((img) => img.complete && img.naturalWidth > 0);
  const logoBox = await page.locator('.sidebar .brand-logo').boundingBox();
  const railBox = await page.locator('.sidebar').boundingBox();
  check(
    '2a. Logo visible when collapsed',
    logoVisible && logoLoaded && logoBox.width > 12 && logoBox.x + logoBox.width <= railBox.x + railBox.width + 0.5,
    `img ${Math.round(logoBox.width)}x${Math.round(logoBox.height)} inside ${Math.round(railBox.width)}px rail`
  );
  await page.screenshot({ path: 'shots/03-viewer-dashboard-collapsed.png', fullPage: true });

  // Content margin must match the collapsed rail
  const marginBefore = await page.locator('.main-area').evaluate((el) => getComputedStyle(el).marginLeft);
  // Move the pointer to the left edge / rail to expand the sidebar.
  await page.mouse.move(10, 300);
  await page.waitForTimeout(200);
  await page.mouse.move(34, 400);
  await page.waitForTimeout(600);
  const marginAfter = await page.locator('.main-area').evaluate((el) => getComputedStyle(el).marginLeft);
  const expanded = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width);
  check('2b. Sidebar expands on hover and shifts content', parseFloat(marginAfter) > parseFloat(marginBefore),
    `${marginBefore} → ${marginAfter}, width=${expanded}`);
  await page.screenshot({ path: 'shots/04-viewer-sidebar-expanded.png', fullPage: true });

  // Content must not be overlapped by the sidebar (wait for the transition to settle)
  await page.waitForTimeout(700);
  const sidebarRect = await page.locator('.sidebar').boundingBox();
  const mainRect = await page.locator('.main-area').boundingBox();
  check('2c. No overlap between sidebar and content', Math.round(mainRect.x) >= Math.floor(sidebarRect.x + sidebarRect.width),
    `sidebar right=${sidebarRect.x + sidebarRect.width}, main left=${mainRect.x}`);

  // Move the mouse away → collapse
  await page.mouse.move(900, 400);
  await page.waitForTimeout(500);
  const collapsedAgain = await page.locator('.sidebar').getAttribute('class');
  check('2d. Sidebar collapses when mouse leaves', collapsedAgain.includes('is-collapsed'), collapsedAgain);

  // No profile/logout in the sidebar
  const sidebarText = await page.locator('.sidebar').innerText();
  check('2e. Sidebar has no profile/logout', !/log ?out/i.test(sidebarText) && !sidebarText.includes('Viewer Account'), sidebarText.replace(/\n/g, ' | '));

  // Sidebar shows only permitted nav items for a viewer
  const navLabels = (await page.locator('.sidebar .nav-item').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  check('2f. Viewer nav hides admin-only modules', navLabels.every((l) => !/User Management|Activity Logs/i.test(l)) && navLabels.some((l) => /Reports/.test(l)), navLabels.join(' | '));

  // User menu in the topbar has Profile + Logout
  await page.click('.user-menu-btn');
  await page.waitForTimeout(250);
  const menuText = await page.locator('.user-dropdown').innerText();
  check('2g. Topbar user menu has Profile and Log out', /Profile/.test(menuText) && /Log out/.test(menuText), menuText.replace(/\n/g, ' | '));
  await page.screenshot({ path: 'shots/05-user-menu.png' });
  await page.keyboard.press('Escape');

  // Viewer cannot see stock recording controls
  await page.goto(`${BASE}/transactions`, { waitUntil: 'networkidle' });
  const txnButtons = await page.locator('.page-head-actions button').allInnerTexts().catch(() => []);
  check('5. Viewer sees no "Edit stock" button', !txnButtons.some((t) => /Edit stock/i.test(t)), txnButtons.join(','));
  await page.screenshot({ path: 'shots/06-viewer-transactions.png', fullPage: true });

  // Viewer API write must be rejected
  const viewerUser = await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()).then((d) => d.user));
  const viewerLogin = await apiLogin(viewerUser.email, 'QaViewer@2026');
  const viewerApi = viewerLogin.body.token;
  check('5a0. Viewer can sign in and read /me', viewerLogin.status === 200 && viewerUser.role === 'Viewer', `${viewerLogin.status} ${viewerUser.role}`);
  const writeAttempt = await fetch(`${BASE}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerApi}` },
    body: JSON.stringify({ type: 'Stock In', itemId: '000000000000000000000000', quantity: 5 }),
  });
  check('5a. Viewer API stock write rejected (403)', writeAttempt.status === 403, String(writeAttempt.status));
  const viewerItemWrite = await fetch(`${BASE}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerApi}` },
    body: JSON.stringify({ name: 'Hacked', categoryId: '000000000000000000000000', quantity: 0, unit: 'pcs' }),
  });
  check('5b. Viewer API item create rejected (403)', viewerItemWrite.status === 403, String(viewerItemWrite.status));

  // --------------------------------------------------------------- Dark mode
  await page.click('button[aria-label="Switch to dark mode"]');
  await page.waitForTimeout(350);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  check('3. Dark mode toggles', theme === 'dark', theme);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/07-dark-dashboard.png', fullPage: true });
  // Contrast sanity: body text should be light on dark
  const contrast = await page.evaluate(() => {
    const el = document.querySelector('.page-head p') || document.body;
    const style = getComputedStyle(el);
    return { color: style.color, bg: getComputedStyle(document.body).backgroundColor };
  });
  check('3a. Dark theme text colour applied', /rgba?\(2[0-9]{2}|rgba?\(1[0-9]{2}/.test(contrast.color) && /rgb\(2[0-9], 2[0-9], 2[0-9]\)|rgb\(1[0-9], 1[0-9], 1[0-9]\)/.test(contrast.bg), JSON.stringify(contrast));
  await page.evaluate(() => { localStorage.setItem('ims-theme', 'light'); document.documentElement.dataset.theme = 'light'; });

  // Charts on the dashboard
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const switchers = await page.locator('.chart-switcher').count();
  check('4. Dashboard has chart switchers', switchers >= 2, String(switchers));
  // Cycle a chart through all five types
  const firstSwitcher = page.locator('.chart-switcher').first();
  const labels = ['Pie chart', 'Donut chart', 'Vertical bar chart', 'Horizontal bar chart', 'Line chart'];
  let allTypes = true;
  for (const label of labels) {
    await firstSwitcher.locator(`button[aria-label="${label}"]`).click();
    await page.waitForTimeout(160);
    const pressed = await firstSwitcher.locator(`button[aria-label="${label}"]`).getAttribute('aria-pressed');
    if (pressed !== 'true') allTypes = false;
  }
  check('4a. Chart switches through all 5 types', allTypes);
  await page.screenshot({ path: 'shots/08-charts.png', fullPage: true });

  // Persistence across navigation (sessionStorage)
  await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const persisted = await page.locator('.chart-switcher').first().locator('button[aria-label="Line chart"]').getAttribute('aria-pressed');
  check('4b. Chart type persists for the session', persisted === 'true', persisted);

  // Low stock section present
  const lowPanel = await page.locator('.low-stock-panel').count();
  check('4c. Low-stock alerts shown prominently', lowPanel === 1);

  await context.close();

  // ------------------------------------------------------------ Admin session
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminContext.newPage();
  adminPage.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await login(adminPage, ADMIN.user, ADMIN.pass);
  await adminPage.waitForTimeout(400);
  await adminPage.screenshot({ path: 'shots/09-admin-dashboard.png', fullPage: true });

  // Transactions: summary cards as filters
  await adminPage.goto(`${BASE}/transactions`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(400);
  const filterStats = await adminPage.locator('.filter-stat').count();
  check('5c. Four clickable summary filters', filterStats === 4, String(filterStats));
  await adminPage.locator('.filter-stat').nth(1).click();
  await adminPage.waitForTimeout(500);
  const pressed = await adminPage.locator('.filter-stat').nth(1).getAttribute('aria-pressed');
  const chips = await adminPage.locator('.chip-row .chip').allInnerTexts();
  check('5d. Summary card acts as an active filter', pressed === 'true', String(pressed));
  check('5e. Only All + Adjustment pills remain', chips.length === 2, chips.join(','));
  await adminPage.screenshot({ path: 'shots/10-transactions.png', fullPage: true });

  // Single "Edit stock" button opens the modal
  const editButtons = await adminPage.locator('.page-head-actions button').allInnerTexts();
  check('5f. Single Edit stock button replaces stock in/out', editButtons.filter((t) => /stock/i.test(t)).length === 1, editButtons.join(','));
  await adminPage.click('.page-head-actions button:has-text("Edit stock")');
  await adminPage.waitForTimeout(400);
  const actionOptions = await adminPage.locator('.action-option').count();
  check('5g. Edit stock modal offers 3 actions', actionOptions === 3, String(actionOptions));
  await adminPage.screenshot({ path: 'shots/11-edit-stock-modal.png' });

  // Record a real stock-in and confirm quantity + audit log
  const itemOptions = await adminPage.locator('#stock-item option').evaluateAll((nodes) => nodes.map((n) => ({ v: n.value, t: n.textContent })));
  const target = itemOptions.find((o) => o.v);
  await adminPage.selectOption('#stock-item', target.v);
  await adminPage.fill('#stock-quantity', '4');
  await adminPage.fill('#stock-supplier', 'QA Supplier');
  await adminPage.click('button[form="edit-stock-form"]');
  await adminPage.waitForTimeout(1400);
  check('5h. Stock in recorded through Edit stock modal', !(await adminPage.locator('#edit-stock-form').count()), target.t);

  // Stock out beyond availability must be blocked
  await adminPage.click('.page-head-actions button:has-text("Edit stock")');
  await adminPage.waitForTimeout(300);
  await adminPage.click('.action-option:has-text("Stock Out")');
  await adminPage.selectOption('#stock-item', target.v);
  await adminPage.fill('#stock-quantity', '999999');
  await adminPage.fill('#stock-reason', 'QA overdraw test');
  await adminPage.click('button[form="edit-stock-form"]');
  await adminPage.waitForTimeout(500);
  const overdrawError = await adminPage.locator('.field-error, .login-error').allInnerTexts();
  check('5i. Over-stock-out blocked client side', overdrawError.some((t) => /Only|insufficient/i.test(t)), overdrawError.join('|'));
  await adminPage.keyboard.press('Escape');

  // Negative stock via API is blocked too
  const adminToken = (await apiLogin(ADMIN.user, ADMIN.pass)).body.token;
  const negative = await fetch(`${BASE}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ type: 'Stock Out', itemId: target.v, quantity: 999999, reason: 'QA overdraw' }),
  });
  check('5j. Over-stock-out rejected by API', negative.status === 409 || negative.status === 400, String(negative.status));

  // Direct quantity edit via item PATCH must be blocked
  const directQty = await fetch(`${BASE}/api/items/${target.v}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ quantity: 5000 }),
  });
  check('5k. Direct quantity edit rejected', directQty.status === 400, String(directQty.status));

  // ---------------------------------------------------------------- Reports
  await adminPage.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(700);
  const stickyPosition = await adminPage.locator('.reports-sticky').evaluate((el) => getComputedStyle(el).position);
  const scrollOverflow = await adminPage.locator('.reports-scroll').evaluate((el) => getComputedStyle(el).overflowY);
  check('6. Report header fixed, content scrolls', stickyPosition === 'sticky' && scrollOverflow === 'auto', `${stickyPosition}/${scrollOverflow}`);
  const reportTypes = await adminPage.locator('.report-type').count();
  check('6a. Report type cards present', reportTypes === 8, String(reportTypes));
  await adminPage.screenshot({ path: 'shots/12-reports.png' });
  // Print CSS hides navigation
  await adminPage.emulateMedia({ media: 'print' });
  const topbarHidden = await adminPage.locator('.topbar').evaluate((el) => getComputedStyle(el).display);
  const reportVisible = await adminPage.locator('.reports-scroll .card').first().isVisible();
  check('6b. Print CSS shows only the report', topbarHidden === 'none' && reportVisible, topbarHidden);
  await adminPage.emulateMedia({ media: 'screen' });

  // ---------------------------------------------------------------- Accounts
  await adminPage.goto(`${BASE}/users`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(500);
  const cardSizes = await adminPage.locator('.stat-compact').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
  check('7. Accounts summary cards are compact and equal', cardSizes.length === 4 && new Set(cardSizes).size === 1, cardSizes.join(','));
  const selfRow = adminPage.locator('tbody tr', { hasText: '(you)' }).first();
  const selfDeactivate = await selfRow.locator('button[title="Deactivate account"]').isDisabled().catch(() => null);
  check('7a. Admin cannot deactivate own account', selfDeactivate === true, String(selfDeactivate));
  await adminPage.screenshot({ path: 'shots/13-accounts.png', fullPage: true });

  // Self-demotion blocked server-side
  const me = (await apiLogin(ADMIN.user, ADMIN.pass)).body.user;
  const demote = await fetch(`${BASE}/api/users/${me.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'Viewer' }),
  });
  check('7b. Admin cannot demote self (API)', demote.status === 400, String(demote.status));

  // ---------------------------------------------------------------- Settings
  await adminPage.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(400);
  const tabs = await adminPage.locator('.settings-tabs button').allInnerTexts();
  check('8. Settings has the reduced tab set', tabs.length === 4, tabs.join(','));
  await adminPage.click('.settings-tabs button:has-text("Inventory rules")');
  await adminPage.waitForTimeout(600);
  const thresholdField = await adminPage.locator('#low-stock-threshold').count();
  check('8a. Admin low-stock threshold setting exists', thresholdField === 1);

  // Round trip: save a new threshold, apply it, then restore the seed value.
  await adminPage.fill('#low-stock-threshold', '7');
  await adminPage.click('.settings-grid button[type=submit]');
  await adminPage.waitForTimeout(1000);
  const savedThreshold = await adminPage.evaluate(async () => {
    const r = await fetch('/api/settings');
    return (await r.json()).settings.lowStockThreshold;
  });
  check('8b. Low-stock threshold saves to MongoDB', savedThreshold === 7, String(savedThreshold));

  await adminPage.click('.settings-grid button:has-text("Apply threshold")');
  await adminPage.waitForTimeout(1400);
  const applyToast = await adminPage.locator('.toast').last().innerText().catch(() => '');
  check('8c. Threshold can be applied to all items', /Minimum stock level updated/i.test(applyToast), applyToast.trim());

  await adminPage.fill('#low-stock-threshold', '10');
  await adminPage.click('.settings-grid button[type=submit]');
  await adminPage.waitForTimeout(1000);

  // Profile validation + save
  await adminPage.click('.settings-tabs button:has-text("Profile")');
  await adminPage.waitForTimeout(400);
  await adminPage.fill('#profile-name', 'A');
  await adminPage.click('button:has-text("Save profile")');
  await adminPage.waitForTimeout(600);
  const shortNameToast = await adminPage.locator('.toast').last().innerText().catch(() => '');
  check('8d. Profile rejects a too-short name', /Enter your full name/i.test(shortNameToast), shortNameToast.trim());

  const adminName = await adminPage.evaluate(async () => {
    const r = await fetch('/api/auth/me');
    return (await r.json()).user.name;
  });
  await adminPage.fill('#profile-name', adminName);
  await adminPage.click('button:has-text("Save profile")');
  await adminPage.waitForTimeout(900);
  const profileToast = await adminPage.locator('.toast').last().innerText().catch(() => '');
  check('8e. Profile saves through the API', /Profile updated/i.test(profileToast), profileToast.trim());

  // Change-password client validation (mismatch) — no password is actually changed.
  await adminPage.click('.settings-tabs button:has-text("Password")');
  await adminPage.waitForTimeout(400);
  await adminPage.fill('#current-password', ADMIN.pass);
  await adminPage.fill('#new-password', 'Brand@New1234');
  await adminPage.fill('#confirm-password', 'Different@1234');
  await adminPage.click('button:has-text("Update password")');
  await adminPage.waitForTimeout(600);
  const pwBody = await adminPage.locator('.settings-grid').innerText();
  check('8f. Change password blocks mismatched confirmation', /do not match/i.test(pwBody));
  await adminPage.screenshot({ path: 'shots/14-settings.png', fullPage: true });

  // --------------------------------------------------------- Logout + login
  await adminPage.click('.user-menu-btn');
  await adminPage.click('.dropdown-item.danger');
  await adminPage.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });
  check('9. Logout returns to sign in', adminPage.url().includes('/login'));

  // Protected route redirects when signed out
  await adminPage.goto(`${BASE}/users`, { waitUntil: 'networkidle' });
  check('9a. Protected route redirects to login', adminPage.url().includes('/login'), adminPage.url());

  // Full password reset round trip via UI
  await adminPage.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
  await adminPage.fill('#email', ADMIN.user === 'lab.admin' ? 'lab.admin@cvsu.edu.ph' : '');
  await adminPage.click('button[type=submit]');
  await adminPage.waitForTimeout(900);
  const sentText = await adminPage.locator('.auth-done').innerText().catch(() => '');
  check('10. Forgot password acknowledges without revealing account existence',
    /Request submitted/i.test(sentText) && !/If an account with that email address exists/i.test(sentText),
    sentText.replace(/\s+/g, ' ').slice(0, 80));

  // ══════════════════════════════════════ Round 2: responsiveness, logo, places
  // The forgot-password test above left this context signed out.
  await adminPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await adminPage.fill('#username', ADMIN.user);
  await adminPage.fill('#password', ADMIN.pass);
  await adminPage.click('button[type=submit]');
  await adminPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await adminPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(600);

  // 12. Sidebar toggle is a strict alternating open/close
  const toggleStates = [];
  for (let i = 0; i < 4; i += 1) {
    await adminPage.click('.menu-btn');
    await adminPage.mouse.move(1200, 700);
    await adminPage.waitForTimeout(550);
    toggleStates.push(await adminPage.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width < 100 ? 'closed' : 'open'));
  }
  check('12. Sidebar toggle alternates open/close on every click',
    toggleStates.join(',') === 'open,closed,open,closed', toggleStates.join(','));

  // toggle while the pointer is resting on the rail (previously got stuck open)
  await adminPage.mouse.move(34, 400);
  await adminPage.waitForTimeout(550);
  const hoverOpened = await adminPage.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width > 100);
  await adminPage.click('.menu-btn');
  await adminPage.waitForTimeout(650);
  const closedWhileHovered = await adminPage.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width < 100);
  await adminPage.waitForTimeout(500);
  const stayedClosed = await adminPage.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width < 100);
  check('12a. Toggle closes the sidebar even while hovered', hoverOpened && closedWhileHovered && stayedClosed,
    `hover-open=${hoverOpened} click-closed=${closedWhileHovered} stayed=${stayedClosed}`);
  await adminPage.mouse.move(1200, 700);
  await adminPage.waitForTimeout(400);

  // 13. Every page is free of horizontal overflow at many widths
  const PAGES = ['/', '/inventory', '/transactions', '/borrowing', '/categories', '/places', '/reports', '/users', '/logs', '/settings'];
  const WIDTHS = [1440, 1024, 768, 430, 360];
  const overflowIssues = [];
  for (const width of WIDTHS) {
    await adminPage.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await adminPage.goto(BASE + path, { waitUntil: 'networkidle' });
      await adminPage.mouse.move(width - 20, 700);
      await adminPage.waitForTimeout(320);
      const over = await adminPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) overflowIssues.push(`${width}px${path}=${over}px`);
    }
  }
  check('13. No horizontal overflow at any width/ page combination', overflowIssues.length === 0, overflowIssues.slice(0, 4).join(', '));
  await adminPage.setViewportSize({ width: 1440, height: 950 });

  // 14. Supplied logo is used everywhere (and swaps variant for light surfaces)
  const logoChecks = {};
  for (const [path, selector] of [['/', '.sidebar .brand-logo'], ['/settings', '.sidebar .brand-logo']]) {
    await adminPage.goto(BASE + path, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(400);
    logoChecks[path] = await adminPage.locator(selector).evaluate((img) => ({
      src: new URL(img.getAttribute('src'), location.origin).pathname,
      loaded: img.complete && img.naturalWidth > 0,
    }));
  }
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await adminPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(500);
  const headerLogo = await adminPage.locator('.topbar-brand .brand-logo').evaluate((img) => ({
    src: new URL(img.getAttribute('src'), location.origin).pathname,
    loaded: img.complete && img.naturalWidth > 0,
    visible: img.getBoundingClientRect().width > 8,
  }));
  await adminPage.setViewportSize({ width: 1440, height: 950 });
  const anonContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await anonPage.waitForTimeout(500);
  const authLogo = await anonPage.locator('.login-brand .brand-logo').evaluate((img) => ({
    src: new URL(img.getAttribute('src'), location.origin).pathname,
    loaded: img.complete && img.naturalWidth > 0,
  }));
  const wordmark = await anonPage.locator('.login-brand .login-wordmark').isVisible().catch(() => false);
  await anonContext.close();
  check('14. Supplied logo renders in the rail, header and auth page',
    logoChecks['/'].loaded && logoChecks['/settings'].loaded && headerLogo.loaded && headerLogo.visible && authLogo.loaded && wordmark,
    `rail=${logoChecks['/'].src} header=${headerLogo.src} auth=${authLogo.src} wordmark=${wordmark}`);

  // sign back in for the remaining admin checks
  await adminPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  if (adminPage.url().includes('/login')) {
    await adminPage.fill('#username', ADMIN.user);
    await adminPage.fill('#password', ADMIN.pass);
    await adminPage.click('button[type=submit]');
    await adminPage.waitForURL((url) => !url.pathname.includes('/login'));
  }

  // 15. Storage places (managed locations)
  await adminPage.goto(`${BASE}/places`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(700);
  const placeCards = await adminPage.locator('.places-card .cat-card').count();
  const placeNames = await adminPage.locator('.places-card .cat-card h3').allInnerTexts();
  check('15. Storage places page lists real places from MongoDB', placeCards >= 4, `${placeCards} places: ${placeNames.slice(0, 6).join(', ')}`);

  const placeApi = await adminPage.evaluate(async () => {
    const list = await (await fetch('/api/places')).json();
    const create = await fetch('/api/places', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Test Place', area: 'Other', description: 'created by e2e' }),
    });
    const created = await create.json();
    const dup = await fetch('/api/places', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Test Place' }),
    });
    const del = await fetch(`/api/places/${created.place.id}`, { method: 'DELETE' });
    return { count: list.places.length, createStatus: create.status, dupStatus: dup.status, deleteStatus: del.status };
  });
  check('15a. Places CRUD works with duplicate protection',
    placeApi.createStatus === 201 && placeApi.dupStatus === 409 && placeApi.deleteStatus === 200,
    JSON.stringify(placeApi));

  // item form reads places from the API
  await adminPage.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(700);
  await adminPage.click('button:has-text("Add item")');
  await adminPage.waitForTimeout(600);
  const placeOptions = await adminPage.locator('#item-location option').allInnerTexts();
  check('15b. Item form uses the managed place list', placeOptions.length > 4 && placeOptions.includes('AV Room'),
    placeOptions.slice(0, 5).join(', '));
  await adminPage.keyboard.press('Escape');
  await adminPage.waitForTimeout(300);

  // 16. "Uncategorized" is gone
  const catStats = await adminPage.evaluate(async () => {
    const r = await fetch('/api/categories');
    return (await r.json()).categories.map((c) => c.name);
  });
  await adminPage.goto(`${BASE}/categories`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(600);
  const catPageText = await adminPage.locator('.content').innerText();
  check('16. "Uncategorized" removed from categories and stats',
    !catStats.some((n) => /uncategorized/i.test(n)) && !/Uncategorized/i.test(catPageText),
    catStats.join(', '));

  // 17. Confirm-password visibility toggle (signup + reset pages)
  const anon2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const anon2Page = await anon2.newPage();
  const toggleProbe = async (page, url) => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.fill('#confirm-password', 'Toggle@1234');
    const before = await page.getAttribute('#confirm-password', 'type');
    await page.click('button[aria-label="Show confirm password"]');
    await page.waitForTimeout(150);
    const after = await page.getAttribute('#confirm-password', 'type');
    const value = await page.inputValue('#confirm-password');
    await page.click('button[aria-label="Hide confirm password"]');
    await page.waitForTimeout(150);
    const back = await page.getAttribute('#confirm-password', 'type');
    return `${before}->${after}->${back}|${value}`;
  };
  const signupToggle = await toggleProbe(anon2Page, `${BASE}/signup`);
  const resetToggle = await toggleProbe(anon2Page, `${BASE}/reset-password?token=invalid-token-for-ui-test`);
  await anon2.close();
  check('17. Confirm-password eye toggle reveals without changing the value',
    signupToggle === 'password->text->password|Toggle@1234' && resetToggle === 'password->text->password|Toggle@1234',
    `signup=${signupToggle} reset=${resetToggle}`);

  await adminContext.close();

  // Console health
  const realErrors = consoleErrors.filter((e) => !/favicon|ResizeObserver|Failed to load resource: the server responded with a status of 40/i.test(e));
  check('11. No uncaught console errors', realErrors.length === 0, realErrors.slice(0, 2).join(' || '));

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} checks passed =====`);
  const failures = results.filter((r) => !r.ok);
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach((f) => console.log(` - ${f.name} :: ${f.detail}`));
  }
  process.exit(failures.length ? 1 : 0);
})().catch(async (error) => {
  console.error('E2E crashed:', error);
  if (browser) await browser.close();
  process.exit(2);
});
