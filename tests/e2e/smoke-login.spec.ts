import { test, expect } from '../fixtures/app';

test.describe('Smoke: Login-Gate', () => {
  test('Demo-Gate erscheint bei forceMode=demo', async ({ page }) => {
    await page.goto('/admin-dashboard-v2.html?forceMode=demo');
    await expect(page.locator('#gateFormDemo')).toBeVisible();
    await expect(page.locator('#gateFormLive')).toBeHidden();
    await expect(page.locator('#appContent')).toBeHidden();
  });

  test('Falsches Passwort → Fehlermeldung, Gate bleibt', async ({ page }) => {
    await page.goto('/admin-dashboard-v2.html?forceMode=demo');
    await page.locator('#pwInput').fill('falsches-passwort-xyz');
    await page.locator('#gateBtnDemo').click();
    await expect(page.locator('#pwError')).toBeVisible();
    await expect(page.locator('#gateFormDemo')).toBeVisible();
    await expect(page.locator('#appContent')).toBeHidden();
  });

  test('Richtiges Passwort → App-Content sichtbar, Version v22+ in Console', async ({ page }) => {
    await page.goto('/admin-dashboard-v2.html?forceMode=demo');
    await page.locator('#pwInput').fill('Krs26PW');
    await page.locator('#gateBtnDemo').click();
    await expect(page.locator('#appContent')).toBeVisible();

    const version = await page.evaluate(() => (window as any).KRS_VERSION);
    const mode = await page.evaluate(() => (window as any).KRS_MODE);
    expect(mode).toBe('demo');
    expect(version).toMatch(/^v(22|23|24|25|26)/);
  });

  test('Kein Console-Error beim App-Start', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/admin-dashboard-v2.html?forceMode=demo');
    await page.locator('#pwInput').fill('Krs26PW');
    await page.locator('#gateBtnDemo').click();
    await expect(page.locator('#appContent')).toBeVisible();
    await page.waitForTimeout(500);

    expect(errors, `Unerwartete Console-Errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
