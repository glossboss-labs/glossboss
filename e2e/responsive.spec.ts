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

// ---------------------------------------------------------------------------
// Responsive overflow tests — all public routes × 3 viewports
// ---------------------------------------------------------------------------

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} (${size.width}x${size.height})`, () => {
    test.use({ viewport: size, ...FORCE_ENGLISH });

    test('landing page renders without overflow', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('link', { name: /start translating/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('editor empty state fits viewport', async ({ page }) => {
      await page.goto('/editor');
      await expect(page.getByRole('heading', { name: /upload a translation file/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('login page renders without overflow', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('signup page renders without overflow', async ({ page }) => {
      await page.goto('/signup');
      await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('forgot password page renders without overflow', async ({ page }) => {
      await page.goto('/forgot-password');
      await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('reset password page renders without overflow', async ({ page }) => {
      await page.goto('/reset-password');
      await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /update password/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('settings page renders without overflow', async ({ page }) => {
      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /translation/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('explore page renders without overflow', async ({ page }) => {
      await page.goto('/explore');
      await expect(page.getByRole('heading', { name: /explore/i })).toBeVisible();
      await expectNoOverflow(page);
    });

    test('roadmap page renders without overflow', async ({ page }) => {
      await page.goto('/roadmap');
      await expect(page.getByRole('heading', { name: /roadmap/i })).toBeVisible();
      await expectNoOverflow(page);
    });
  });
}

// ---------------------------------------------------------------------------
// iOS zoom guard — mobile only
// ---------------------------------------------------------------------------

test.describe('iOS zoom prevention', () => {
  test.use({ viewport: VIEWPORTS.mobile, ...FORCE_ENGLISH });

  test('landing page inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /start translating/i })).toBeVisible();
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All landing page inputs should have font-size >= 16px').toEqual([]);
  });

  test('editor inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/editor');
    await expect(page.getByRole('heading', { name: /upload a translation file/i })).toBeVisible();
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All editor inputs should have font-size >= 16px').toEqual([]);
  });

  test('login page inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All login inputs should have font-size >= 16px').toEqual([]);
  });

  test('signup page inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All signup inputs should have font-size >= 16px').toEqual([]);
  });

  test('forgot password page inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All forgot password inputs should have font-size >= 16px').toEqual([]);
  });

  test('reset password page inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible();
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All reset password inputs should have font-size >= 16px').toEqual([]);
  });

  test('settings page inputs have font-size >= 16px', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: /translation/i })).toBeVisible();
    const violations = await getInputsBelowMinFontSize(page);
    expect(violations, 'All settings inputs should have font-size >= 16px').toEqual([]);
  });
});
