async page => {
  const errors = [];
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));

  await page.context().route('**/identitytoolkit.googleapis.com/**', async route => {
    const url = route.request().url();
    if (url.includes('signInWithPassword')) {
      const nowSec = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        iss: 'https://securetoken.google.com/robust-truck-5pqwl',
        aud: 'robust-truck-5pqwl',
        user_id: 'test-admin-uid',
        sub: 'test-admin-uid',
        email: 'suryadi.k94@gmail.com',
        email_verified: true,
        iat: nowSec,
        exp: nowSec + 3600,
      })).toString('base64url');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#VerifyPasswordResponse',
          localId: 'test-admin-uid',
          email: 'suryadi.k94@gmail.com',
          displayName: 'Suryadi Admin',
          idToken: header + '.' + payload + '.sig',
          registered: true,
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600',
        }),
      });
    }
    if (url.includes('lookup')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#GetAccountInfoResponse',
          users: [{
            localId: 'test-admin-uid',
            email: 'suryadi.k94@gmail.com',
            emailVerified: true,
            displayName: 'Suryadi Admin',
            providerUserInfo: [{ providerId: 'password', email: 'suryadi.k94@gmail.com' }],
          }],
        }),
      });
    }
    return route.continue();
  });

  await page.context().route('**/firestore.googleapis.com/**', route => route.abort('failed'));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#auth-email', { timeout: 15000 });
  await page.fill('#auth-email', 'suryadi.k94@gmail.com');
  await page.fill('#auth-password', 'Password123!');
  await page.click('button[type="submit"]');

  await page.waitForSelector('button[aria-label="Input Handover Baru"]', { timeout: 25000 });
  await page.click('button[aria-label="Aktifkan Tema Dark AMOLED"]');
  await page.waitForTimeout(300);

  // Open Pengaturan -> Menu Admin in Dark AMOLED
  await page.locator('aside button:has-text("Pengaturan")').click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Menu Admin")').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/cap_dist_admin_dark.png' });

  // Back to Beranda and check Mobile Dark AMOLED
  await page.locator('aside button:has-text("Beranda")').click();
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/cap_dist_dash_dark_mobile.png' });

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    rootLen: document.getElementById('root')?.innerHTML.length || 0,
    isDark: document.documentElement.classList.contains('dark'),
    appBooted: window.__appBooted === true,
  }));
  console.log('DIST_METRICS:', JSON.stringify(metrics));

  // Verify pre-mount chunk failure shows recovery UI instead of blank white screen
  const ctx2 = await page.context().browser().newContext();
  const page2 = await ctx2.newPage();
  await page2.setViewportSize({ width: 1280, height: 800 });
  await page2.addInitScript(() => {
    try { sessionStorage.setItem('ms_boot_reload_v1', '1'); } catch {}
  });
  await page2.route('**/assets/index-*.js', route => route.abort('failed'));
  await page2.goto('http://localhost:4173', { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(2600);
  const recoveryText = await page2.evaluate(() => document.getElementById('root')?.innerText || '');
  await page2.screenshot({ path: '.playwright-cli/cap_boot_recovery.png' });
  await ctx2.close();

  console.log('RECOVERY_TEXT:', recoveryText.replace(/\s+/g, ' ').slice(0, 200));
  if (errors.length > 0) throw new Error('Dist page errors: ' + errors.join('; '));
  if (!metrics.isDark || metrics.rootLen < 200 || metrics.scrollWidth > metrics.innerWidth) {
    throw new Error('Dist layout/dark check failed: ' + JSON.stringify(metrics));
  }
  if (!recoveryText.includes('Gagal') && !recoveryText.includes('Muat Ulang')) {
    throw new Error('Pre-mount recovery card did not render!');
  }
  return 'DIST_AND_RECOVERY_OK';
}
