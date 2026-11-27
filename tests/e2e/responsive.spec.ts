import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin, refreshSite, resetSettings, serviceClient } from './helpers';

/**
 * Responsive checks at every target viewport: no horizontal overflow and
 * touch targets of at least 40px for controls (inline text links exempt).
 * Saves a screenshot of each page/viewport as evidence.
 */
const VIEWPORTS = [
  [360, 800], [375, 812], [390, 844], [430, 932], [768, 1024], [1366, 768], [1440, 900],
] as const;

const RUN = Date.now().toString(36);
const SLUG = `e2e-test-responsive-${RUN}`;
let productId = '';
const SHOTS = path.join('test-results', 'responsive');

test.describe.configure({ mode: 'default' });

test.beforeAll(async () => {
  await resetSettings();
  fs.mkdirSync(SHOTS, { recursive: true });
  const db = serviceClient();
  const { data: models } = await db.from('motorcycle_models').select('id, slug').in('slug', ['classic', 'bullet', 'electra']);
  const { data: cat } = await db.from('product_categories').select('id').eq('slug', 'engine-parts').single();
  const { data: p, error } = await db
    .from('products')
    .insert({
      name: `E2E Test Long Product Name For Layout Checking ${RUN}`,
      slug: SLUG,
      part_number: `TST-${RUN}-LONG-NUMBER`,
      description: 'Automated test record used to check responsive layout. '.repeat(4),
      category_id: cat!.id,
      availability: 'contact_to_confirm',
      status: 'published',
      is_featured: true,
    })
    .select('id')
    .single();
  if (error) throw error;
  productId = p.id;
  await db.from('product_model_compatibility').insert(models!.map((m) => ({ product_id: productId, model_id: m.id })));
  const bytes = fs.readFileSync(path.join(__dirname, 'fixtures', 'test-part.jpg'));
  for (const [i, name] of ['a1b2c3d4-one', 'a1b2c3d4-two'].entries()) {
    const storagePath = `products/${productId}/${name}.jpg`;
    await db.storage.from('product-images').upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: true });
    await db.from('product_images').insert({ product_id: productId, storage_path: storagePath, is_primary: i === 0, sort_order: i * 10, width: 1400, height: 1050 });
  }
  await refreshSite();
});

test.afterAll(async () => {
  const db = serviceClient();
  await db.storage.from('product-images').remove([`products/${productId}/a1b2c3d4-one.jpg`, `products/${productId}/a1b2c3d4-two.jpg`]);
  await db.from('products').delete().eq('id', productId);
  await refreshSite();
});

async function audit(page: Page, label: string) {
  await page.waitForLoadState('networkidle');
  const result = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const small: string[] = [];
    const els = document.querySelectorAll<HTMLElement>('a, button, input:not([type=hidden]), select, textarea, summary');
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden') continue;
      if (el.closest('.sr-only') || el.classList.contains('sr-only')) continue;
      // Inline links inside running text are exempt (WCAG 2.5.8 exception).
      if (el.tagName === 'A' && el.closest('p, address, dd') && style.display === 'inline') continue;
      // Stretched card links: the ::after overlay makes the whole card the target.
      if (el.tagName === 'A' && getComputedStyle(el, '::after').position === 'absolute') continue;
      if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes((el as HTMLInputElement).type)) continue; // wrapped in large labels
      if (r.height < 40) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return { overflow, small };
  });
  expect(result.overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
  expect(result.small, `${label}: small touch targets`).toEqual([]);
}

for (const [w, h] of VIEWPORTS) {
  test(`public pages at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    for (const url of ['/', '/models', '/models/classic', '/products', `/products/${SLUG}`, '/about', '/contact', '/admin/login']) {
      await page.goto(url);
      await audit(page, `${url} @${w}`);
      if (w === 360 || w === 768 || w === 1440) {
        const name = url === '/' ? 'home' : url.replace(/\//g, '_').replace(/^_/, '').replace(SLUG, 'product');
        await page.screenshot({ path: path.join(SHOTS, `${name}-${w}.png`), fullPage: true });
      }
    }
    // Product page: the enquiry action is reachable without scrolling on phones.
    if (w < 1024) {
      await page.goto(`/products/${SLUG}`);
      const bar = page.locator('[data-sticky-enquiry]').first();
      await expect(bar).toBeVisible();
      const box = await bar.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(h + 1);
    }
  });

  test(`admin pages at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await loginAsAdmin(page);
    for (const url of ['/admin', '/admin/products', `/admin/products/${productId}`, '/admin/products/new', '/admin/models', '/admin/categories', '/admin/settings']) {
      await page.goto(url);
      await audit(page, `${url} @${w}`);
      if (w === 360 || w === 1440) {
        const name = url.replace(/\//g, '_').replace(/^_/, '').replace(productId, 'edit');
        await page.screenshot({ path: path.join(SHOTS, `${name}-${w}.png`), fullPage: true });
      }
    }
  });
}
