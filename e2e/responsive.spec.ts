import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

/** Force app language to English so role/name queries are stable regardless of runner locale. */
const FORCE_ENGLISH = {
  storageState: {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:4173',
        localStorage: [{ name: 'glossboss-app-language', value: 'en' }],
      },
    ],
  },
} as const;

/** Assert the page has no horizontal overflow. */
async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, 'Page should not have horizontal overflow').toBe(false);
}

/** Collect all visible inputs with font-size below 16px. */
async function getInputsBelowMinFontSize(page: Page) {
  return page.evaluate(() => {
    const inputs = document.querySelectorAll(
      'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea, select',
    );
    const violations: string[] = [];
    inputs.forEach((el) => {
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      if (fontSize < 16) {
        const id = el.id || el.getAttribute('aria-label') || el.tagName;
        violations.push(`${id}: ${fontSize}px`);
      }
    });
    return violations;
  });
}

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} (${size.width}x${size.height})`, () => {
    test.use({ viewport: size, ...FORCE_ENGLISH });

    test('landing page renders without overflow', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'GlossBoss' })).toBeVisible();
      await expect(page.getByRole('button', { name: /upload/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /load example/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('editor loads and fits viewport', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /load example/i }).click();
      // Wait for editor to render
      await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expectNoOverflow(page);

      // Settings gear should always be visible
      await expect(page.getByRole('button', { name: /settings and actions/i })).toBeVisible();
    });

    test('settings modal opens and fits viewport', async ({ page }) => {
      await page.goto('/');
      // Open settings via gear menu
      await page.getByRole('button', { name: /settings and actions/i }).click();
      await page.getByRole('menuitem', { name: /open settings/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoOverflow(page);
    });
  });
}

// iOS zoom guard — mobile only, checks landing, editor, and settings modal
test.describe('iOS zoom prevention', () => {
  test.use({ viewport: VIEWPORTS.mobile, ...FORCE_ENGLISH });

  test('landing page inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/');
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All landing page inputs should have font-size >= 16px').toEqual([]);
  });

  test('editor inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /load example/i }).click();
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All editor inputs should have font-size >= 16px').toEqual([]);
  });

  test('settings modal inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /settings and actions/i }).click();
    await page.getByRole('menuitem', { name: /open settings/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All settings modal inputs should have font-size >= 16px').toEqual([]);
  });
});
