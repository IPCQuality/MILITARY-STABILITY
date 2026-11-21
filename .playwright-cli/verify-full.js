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

  // Abort Firestore network calls so Firebase treats client as offline cleanly
  // (avoids real server rejecting our synthetic unsigned JWT with PERMISSION_DENIED)
  await page.context().route('**/firestore.googleapis.com/**', route => route.abort('failed'));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#auth-email', { timeout: 15000 });
  await page.screenshot({ path: '.playwright-cli/cap_auth_desktop.png' });

  await page.fill('#auth-email', 'suryadi.k94@gmail.com');
  await page.fill('#auth-password', 'Password123!');
  await page.click('button[type="submit"]');

  // Wait up to 25s for Firestore offline timeout + post-login DashboardView mount
  await page.waitForSelector('button[aria-label="Input Handover Baru"]', { timeout: 25000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.playwright-cli/cap_dash_light_desktop.png' });

  // Open Form Handover via FAB
  await page.click('button[aria-label="Input Handover Baru"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/cap_form_desktop.png' });
  // Cancel back to Dashboard
  const cancelBtn = page.locator('button:has-text("Batal")').first();
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
    await page.waitForTimeout(300);
  }

  // Navigate to Riwayat
  await page.locator('aside button:has-text("Riwayat")').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/cap_history_desktop.png' });

  // Navigate to Ekspor
  await page.locator('aside button:has-text("Ekspor")').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/cap_export_desktop.png' });

  // Navigate to Pengaturan & toggle Dark Mode
  await page.locator('aside button:has-text("Pengaturan")').click();
  await page.waitForTimeout(400);
  const darkBtn = page.locator('button:has-text("Mode Gelap"), button:has-text("Dark")').first();
  if (await darkBtn.isVisible()) {
    await darkBtn.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: '.playwright-cli/cap_settings_dark_desktop.png' });

  // Navigate to Menu Admin
  const adminBtn = page.locator('aside button:has-text("Menu Admin")');
  if (await adminBtn.isVisible()) {
    await adminBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: '.playwright-cli/cap_admin_dark_desktop.png' });
  }

  // Back to Beranda & check Mobile 390x844 layout
  await page.locator('aside button:has-text("Beranda")').click();
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.playwright-cli/cap_dash_dark_mobile.png' });

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    rootLen: document.getElementById('root')?.innerHTML.length || 0,
    isDark: document.documentElement.classList.contains('dark'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    appBooted: window.__appBooted === true,
  }));

  console.log('METRICS:', JSON.stringify(metrics));
  console.log('PAGE_ERRORS:', JSON.stringify(errors));
  if (errors.length > 0) throw new Error('Page errors: ' + errors.join('; '));
  if (metrics.rootLen < 200) throw new Error('Blank root detected!');
  if (metrics.scrollWidth > metrics.innerWidth) {
    throw new Error(`Mobile overflow detected: ${metrics.scrollWidth} > ${metrics.innerWidth}`);
  }
  return 'FULL_FLOW_OK';
}
