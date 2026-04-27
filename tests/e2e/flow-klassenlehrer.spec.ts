import { test, expect, loginAs, seedMockData } from '../fixtures/app';

test.describe.configure({ mode: 'serial' });

/**
 * E2E-Flow: KlassenlehrerView (v27 / Sprint E1)
 *
 * Testet:
 *  - Login als klassenlehrer landet automatisch in "Meine Klasse"
 *  - Schüler werden nach `klassenlehrer_von` der eigenen User-Row gefiltert
 *  - Anmelde-Status (hat_gewaehlt) wird korrekt angezeigt
 *  - Zähler im Header (X von Y angemeldet, %) stimmt
 */
test.describe('Flow: KlassenlehrerView', () => {
  test('Login als klassenlehrer → Default-Section "Meine Klasse"', async ({ page }) => {
    await loginAs(page, 'klassenlehrer');

    // Header der KlassenlehrerView
    await expect(page.locator('h1').filter({ hasText: /Meine Klasse/i })).toBeVisible({ timeout: 5_000 });

    // Mock-Klassenlehrer u23 ist Klassenlehrer von 7a
    await expect(page.locator('h1')).toContainText('7A');
  });

  test('Tabelle zeigt nur Schüler der eigenen Klasse', async ({ page }) => {
    await loginAs(page, 'klassenlehrer');
    await page.waitForTimeout(200);

    const rows = page.locator('[data-testid="klassenlehrer-row"]');
    const count = await rows.count();
    expect(count, 'Mindestens 1 Schüler in 7a erwartet').toBeGreaterThan(0);

    // Keiner der Codes darf mit einer anderen Klasse beginnen
    // Codes haben das Schema "<KLASSE>-<ID>", z.B. "7A-H6RD"
    for (let i = 0; i < count; i++) {
      const code = await rows.nth(i).locator('code').textContent();
      expect(code?.toUpperCase()).toMatch(/^7A-/);
    }
  });

  test('Anmelde-Status wird korrekt angezeigt', async ({ page }) => {
    await loginAs(page, 'klassenlehrer');

    // Setze 2 Schüler aus 7a auf hat_gewaehlt: true
    await seedMockData(page, {
      schueler: [
        { code: '7A-AAAA', vorname: 'Anna', nachname: 'Anders', klasse: '7a', klassenstufe: 7, hat_gewaehlt: true,  zuteilung: null },
        { code: '7A-BBBB', vorname: 'Ben',  nachname: 'Berger', klasse: '7a', klassenstufe: 7, hat_gewaehlt: false, zuteilung: null },
        { code: '8B-CCCC', vorname: 'Carla',nachname: 'Conrad', klasse: '8b', klassenstufe: 8, hat_gewaehlt: true,  zuteilung: null },
      ],
    });

    // Subtitle sollte "1 von 2 angemeldet (50%) · 1 offen" zeigen
    const subtitle = page.locator('.main-subtitle');
    await expect(subtitle).toContainText(/1 von 2/);
    await expect(subtitle).toContainText(/50%/);

    // 7a-Schüler sind in Tabelle, 8b nicht
    await expect(page.locator('[data-testid="klassenlehrer-row"]')).toHaveCount(2);
    const codes = await page.locator('[data-testid="klassenlehrer-row"] code').allTextContents();
    expect(codes).toEqual(expect.arrayContaining(['7A-AAAA', '7A-BBBB']));
    expect(codes).not.toContain('8B-CCCC');

    // Status-Badges: 1× "Angemeldet", 1× "Offen"
    const angemeldet = page.locator('[data-testid="klassenlehrer-row"][data-status="angemeldet"]');
    const offen = page.locator('[data-testid="klassenlehrer-row"][data-status="offen"]');
    await expect(angemeldet).toHaveCount(1);
    await expect(offen).toHaveCount(1);
  });
});
