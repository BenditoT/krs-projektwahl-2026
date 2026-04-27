import { test, expect, goToSection } from '../fixtures/app';

/**
 * Smoke-Test für Projekt-CRUD — analog zu Lehrer-CRUD.
 * Deckt die v19/v22-Kombi ab: Modal-Prefill + Tabellen-Refresh nach Edit.
 */

test.describe('Smoke: Projekt-CRUD', () => {
  test('Projekte-View ist erreichbar', async ({ appPage: page }) => {
    await goToSection(page, 'projekte');
    await expect(page.getByRole('heading', { name: /projekte/i })).toBeVisible();
  });

  test('Neues Projekt anlegen → erscheint in Tabelle', async ({ appPage: page }) => {
    await goToSection(page, 'projekte');

    // Counter-Stand vor Save merken (für Inkrement-Check)
    const subtitleBefore = await page.locator('.main-subtitle').first().textContent() || '';
    const countBefore = parseInt((subtitleBefore.match(/(\d+) Projekte angelegt/) || ['', '0'])[1], 10);

    const uniqueTitel = 'Test-Projekt-' + Date.now();
    await page.getByRole('button', { name: /Neues Projekt|Projekt anlegen|➕/i }).first().click();

    await expect(page.locator('.modal-content')).toBeVisible();

    // Titel-Feld (erstes text-Input im Modal) + kurz warten damit Preact propagiert
    await page.locator('.modal-content input[type="text"]').first().fill(uniqueTitel);
    await page.waitForTimeout(200);

    // Lehrer-Dropdown: erste gültige Option wählen
    const lehrerSelect = page.locator('.modal-content select').first();
    const options = await lehrerSelect.locator('option').all();
    for (const opt of options) {
      const val = await opt.getAttribute('value');
      if (val && val !== '') {
        await lehrerSelect.selectOption(val);
        break;
      }
    }
    await page.waitForTimeout(200);

    await page.locator('.modal-content').getByRole('button', { name: /speichern/i }).click();
    await expect(page.locator('.modal-content')).toBeHidden({ timeout: 5_000 });

    // Direkter DOM-Check: neues Projekt muss in der Tabelle erscheinen
    // (möglich dank key=${p.id} Fix in admin-dashboard-v2.html — Bug 1 E0)
    await expect(page.locator('table tbody').getByText(uniqueTitel).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Projekt bearbeiten → Modal prefilled, Änderung persistiert', async ({ appPage: page }) => {
    await goToSection(page, 'projekte');

    // Ersten Projekt-Bearbeiten-Button klicken
    const firstEditBtn = page.locator('table tbody tr').first()
      .getByRole('button', { name: /Bearbeiten|✏️/i });

    // Falls keine Projekte existieren, erst eines anlegen
    if (await firstEditBtn.count() === 0) {
      test.skip(true, 'Keine Projekte in Demo-Daten vorhanden');
    }

    await firstEditBtn.click();
    await expect(page.locator('.modal-content')).toBeVisible();

    const titelInput = page.locator('.modal-content input[type="text"]').first();
    const original = await titelInput.inputValue();
    expect(original, 'Modal-Prefill darf nicht leer sein (v19-Bug!)').not.toBe('');

    const edited = original + ' [edit-' + Date.now() + ']';
    await titelInput.fill(edited);

    await page.locator('.modal-content').getByRole('button', { name: /speichern/i }).click();
    await expect(page.locator('.modal-content')).toBeHidden({ timeout: 3_000 });

    await expect(page.getByText(edited).first()).toBeVisible({ timeout: 3_000 });
  });
});
