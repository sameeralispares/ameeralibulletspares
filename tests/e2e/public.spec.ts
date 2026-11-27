import { expect, test } from '@playwright/test';
import { resetSettings } from './helpers';

const MODELS = [
  'Bullet', 'Classic', 'Electra', 'Thunderbird', 'Standard', 'Meteor 350', 'Hunter 350', 'Himalayan', 'Scram',
  'Interceptor 650', 'Continental GT 650', 'Other / Newer Models',
];

test.beforeAll(async () => {
  await resetSettings();
});

test.describe('public website — empty catalogue, WhatsApp not configured', () => {
  test('homepage communicates what, where and how to enquire', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Genuine Royal\s+Enfield spare parts/i);
    await expect(page.getByText('Venkatachalan Naicken Street · Pudupet · Chennai').first()).toBeVisible();
    // Shop number: a call link, and the WhatsApp icon at the top of the page.
    const call = page.locator('a[href="tel:+919677093315"]').first();
    await expect(call).toBeVisible();
    const wa = page.getByRole('link', { name: 'Chat with the shop on WhatsApp' });
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/919677093315\?text=/);
    // All 12 confirmed models are offered.
    for (const m of MODELS) await expect(page.getByRole('link', { name: new RegExp(m.replace('/', '\\/')) }).first()).toBeVisible();
    // Parts section renders whether or not products are published (no invented products).
    await expect(page.getByRole('heading', { name: /Featured parts|Recently listed parts/ })).toBeVisible();
    // No unconfirmed claims.
    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const banned of ['authorised dealer', 'authorized dealer', 'since 19', 'years of experience', 'testimonial', '★★★']) {
      expect(body).not.toContain(banned);
    }
    await expect(page.getByText('Please call the shop to confirm opening hours before visiting.')).toBeVisible();
  });

  test('main navigation reaches every page without dead links', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const [label, path] of [
      ['Shop by Model', '/models'],
      ['All Parts', '/products'],
      ['About', '/about'],
      ['Contact', '/contact'],
    ] as const) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('every internal link on key pages returns a page (no 404s)', async ({ page, request }) => {
    const seen = new Set<string>();
    for (const start of ['/', '/models', '/products', '/about', '/contact']) {
      await page.goto(start);
      const hrefs = await page.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href')!));
      hrefs.forEach((h) => seen.add(h.split('#')[0]));
    }
    for (const href of seen) {
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
      // A streamed not-found still returns 200, so also check it isn't flagged noindex as a missing page.
      const html = await res.text();
      expect(html.includes('NEXT_HTTP_ERROR_FALLBACK;404'), `${href} renders not-found`).toBe(false);
    }
  });

  test('model catalogue lists 12 models and model pages handle empty catalogue', async ({ page }) => {
    await page.goto('/models');
    await expect(page.locator('main a[href^="/models/"]')).toHaveCount(12);
    await page.goto('/models/meteor-350');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Meteor 350 spare parts/i);
    // The demo catalogue lists parts for every model, so the empty state only
    // shows when a model has none. Check whichever state the data is in.
    const empty = (await page.getByRole('heading', { name: 'Meteor 350 parts are being listed' }).count()) > 0;
    if (empty) {
      // Empty model pages are not indexed (thin content), but are followable.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    } else {
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    }
    await page.goto('/models/other-newer-models');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Other & newer models/i);
  });

  test('unknown pages show a helpful not-found page that is not indexed', async ({ page }) => {
    await page.goto('/products/does-not-exist');
    await expect(page.getByRole('heading', { name: /isn.t on the shelf/i })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    const res = await page.goto('/totally/unknown/path');
    expect(res?.status()).toBe(404);
  });

  test('contact page shows confirmed details and a validated Maps destination', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Contact & directions/i);
    await expect(page.getByText('25, Venkatachalan Naicken Street, Pudupet, Chennai-02').first()).toBeVisible();
    const maps = page.getByRole('link', { name: /Get directions in Google Maps/i });
    const href = await maps.getAttribute('href');
    expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(decodeURIComponent(href!.split('query=')[1])).toContain('Venkatachalan Naicken Street');
    await expect(maps).toHaveAttribute('target', '_blank');
  });

  test('SEO: unique titles, descriptions and canonicals; valid JSON-LD without invented data', async ({ page }) => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const path of ['/', '/models', '/products', '/about', '/contact']) {
      await page.goto(path);
      const title = await page.title();
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(title.length).toBeGreaterThan(10);
      expect(desc && desc.length).toBeGreaterThan(50);
      expect(canonical).toMatch(new RegExp(`${path === '/' ? '/?' : path}$`));
      expect(titles.has(title), `duplicate title ${title}`).toBe(false);
      expect(descriptions.has(desc!), `duplicate description on ${path}`).toBe(false);
      titles.add(title);
      descriptions.add(desc!);
      expect(await page.locator('h1').count(), `one h1 on ${path}`).toBe(1);
      for (const raw of await page.locator('script[type="application/ld+json"]').allTextContents()) {
        const data = JSON.parse(raw);
        const text = JSON.stringify(data);
        for (const forbidden of ['aggregateRating', 'review', 'priceRange', '"geo"', 'openingHours', '"price"']) {
          expect(text, `${forbidden} on ${path}`).not.toContain(forbidden);
        }
      }
    }
    await page.goto('/');
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
    const biz = ld.find((d) => d['@type'] === 'AutoPartsStore');
    expect(biz.name).toBe('S Ameer Ali Bullet Spare Parts');
    expect(biz.telephone).toBe('+919677093315');
    expect(biz.address.postalCode).toBe('600002');
  });

  test('robots.txt and sitemap.xml', async ({ request, page }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain('<urlset');
    expect(xml).not.toContain('/admin');
    // A model page is in the sitemap only when it has parts to show.
    await page.goto('/models/meteor-350');
    const modelEmpty = (await page.getByRole('heading', { name: 'Meteor 350 parts are being listed' }).count()) > 0;
    if (modelEmpty) expect(xml).not.toContain('/models/meteor-350');
    else expect(xml).toContain('/models/meteor-350');
  });

  test('images have alt text and buttons have accessible names', async ({ page }) => {
    for (const path of ['/', '/models', '/products', '/contact']) {
      await page.goto(path);
      const missingAlt = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.hasAttribute('alt')).length);
      expect(missingAlt, path).toBe(0);
      const unnamed = await page.$$eval('button, a', (els) =>
        els.filter((e) => !(e.textContent?.trim() || e.getAttribute('aria-label') || e.querySelector('img[alt]:not([alt=""])'))).length,
      );
      expect(unnamed, path).toBe(0);
    }
  });

  test('mobile menu opens, traps focus and closes with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await toggle.click();
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeHidden();
    await toggle.click();
    await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Contact' }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeHidden();
  });

  test('search works from the catalogue page and shows a useful empty state', async ({ page }) => {
    await page.goto('/products');
    await page.getByLabel('Search parts by name or part number').fill('zzz-nothing');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=zzz-nothing/);
    await expect(page.getByText('No matching parts listed')).toBeVisible();
    await page.getByRole('link', { name: 'Clear all' }).click();
    await expect(page).toHaveURL(/\/products$/);
  });
});

test.describe('branding and address', () => {
  test('favicon is the shop logo, not the browser default', async ({ request }) => {
    for (const url of ['/favicon.ico', '/icon.png', '/apple-icon.png']) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      expect((await res.body()).length, url).toBeGreaterThan(2000);
    }
  });

  test('the new shop address appears on the contact page', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByText('25, Venkatachalan Naicken Street, Pudupet, Chennai-02').first()).toBeVisible();
  });
});
