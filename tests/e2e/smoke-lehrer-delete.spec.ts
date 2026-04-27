import { test, expect, goToSection } from '../fixtures/app';

/**
 * Smoke-Test: Lehrer löschen
 *
 * - Edit-Modal hat einen "Löschen"-Button (nur bei bestehenden Lehrern, NICHT für u1).
 * - u1 (Norbert) ist im Code geschützt: editingId !== 'u1' (Zeile ~7943).
 * - Demo: mockLehrerData.splice() — Tabellen-Refresh durch Re-Render.
 *
 * Verifiziert wird:
 *  - Löschen-Button erscheint bei Lehrer ≠ u1 im Edit-Modal
 *  - Löschen-Button fehlt bei u1 (Schutz vor Selbst-Löschen)
 *  - Nach Bestätigung: Toast „Lehrer gelöscht", Lehrer-Anzahl sinkt
 */
test.describe('Smoke: Lehrer löschen', () => {
  test('u1 (Norbert/Admin) hat keinen Löschen-Button (Self-Protection)', async ({ appPage: page }) => {
    await goToSection(page, 'lehrer');

    // Wir suchen den Bearbeiten-Button in der Zeile von u1.
    // u1 = Franziska Amler in Mock-Daten (id: 'u1', name: 'Franziska Amler').
    // Edit-Modal öffnen via erster Treffer (Demo-Daten sind alphabetisch sortiert,
    // u1 = Franziska Amler ist daher erste Zeile).
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.count() === 0) {
      test.skip(true, 'Keine Lehrer in Demo-Daten');
      return;
    }

    await firstRow.getByRole('button', { name: /Bearbeiten|✏️/i }).click();
    await expect(page.locator('.modal-content')).toBeVisible();

    // Modal geöffnet — Lehrer-Name lesen, um zu prüfen ob u1 wirklich erste Zeile ist
    const nameInput = page.locator('.modal-content input[type="text"]').first();
    const name = await nameInput.inputValue();

    // Falls die erste Zeile NICHT u1 ist (z.B. wegen Sortierung anders): skip
    // Wir prüfen u1 via mockLehrerData: u1 = "Franziska Amler"
    if (!name.toLowerCase().includes('franziska')) {
      test.skip(true, `Erste Zeile ist nicht u1 (Franziska Amler), sondern "${name}"`);
      return;
    }

    // u1: Löschen-Button darf NICHT vorhanden sein
    const deleteBtn = page.locator('.modal-content').getByRole('button', { name: /^Löschen$/i });
    await expect(deleteBtn).toHaveCount(0);
  });

  test('Anderen Lehrer (≠ u1) löschen → Anzahl sinkt', async ({ appPage: page }) => {
    await goToSection(page, 'lehrer');

    const rowsBefore = await page.locator('table tbody tr').count();
    if (rowsBefore < 2) {
      test.skip(true, 'Zu wenige Lehrer in Demo-Daten zum Löschen');
      return;
    }

    // 2. Zeile bearbeiten (sicher kein u1 wenn alphabetisch sortiert)
    await page.locator('table tbody tr').nth(1)
      .getByRole('button', { name: /Bearbeiten|✏️/i })
      .click();
    await expect(page.locator('.modal-content')).toBeVisible();

    // Sicherstellen: nicht u1 (Franziska Amler)
    const name = await page.locator('.modal-content input[type="text"]').first().inputValue();
    if (name.toLowerCase().includes('franziska')) {
      test.skip(true, '2. Zeile ist u1 — Test passt nicht zur Mock-Reihenfolge');
      return;
    }

    const deleteBtn = page.locator('.modal-content').getByRole('button', { name: /^Löschen$/i });
    await expect(deleteBtn).toBeVisible();

    page.once('dialog', d => d.accept());
    await deleteBtn.click();

    // Toast „Lehrer gelöscht"
    await expect(
      page.locator('.toast').filter({ hasText: /Lehrer gelöscht/i }).first()
    ).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.modal-content')).toBeHidden({ timeout: 3_000 });

    // Tabelle hat eine Zeile weniger
    await expect(async () => {
      const rowsAfter = await page.locator('table tbody tr').count();
      expect(rowsAfter, 'Tabelle sollte nach Delete um 1 schrumpfen').toBeLessThan(rowsBefore);
    }).toPass({ timeout: 5_000 });
  });
});
