import { expect, test } from '@playwright/test';

test('PWA-Grundausstattung: Manifest und Icon werden ausgeliefert', async ({ page }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBe('/manifest.webmanifest');

  const manifestRes = await page.request.get('/manifest.webmanifest');
  expect(manifestRes.ok()).toBe(true);
  const manifest = (await manifestRes.json()) as {
    name?: string;
    short_name?: string;
    display?: string;
    icons?: { src?: string; sizes?: string }[];
  };
  expect(manifest.short_name).toBe('LAMA');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons?.length).toBeGreaterThan(0);

  const iconSrc = manifest.icons?.[0]?.src ?? '';
  const iconRes = await page.request.get(iconSrc);
  expect(iconRes.ok()).toBe(true);

  const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
  expect(themeColor).toBeTruthy();
});
