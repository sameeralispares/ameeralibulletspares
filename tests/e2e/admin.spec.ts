import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, STAFF, expectEventually, login, loginAsAdmin, refreshSite, resetSettings, serviceClient } from './helpers';

/**
 * Full owner workflow against the real stack: auth, product CRUD, photos,
 * models/categories, availability, publishing, settings and WhatsApp.
 * Runs serially; cleans up after itself.
 */
test.describe.configure({ mode: 'serial' });

const RUN = Date.now().toString(36);
const PRODUCT = `E2E Test Clutch Plate ${RUN}`;
const SLUG = `e2e-test-clutch-plate-${RUN}`;
const FIXTURE = path.join(__dirname, 'fixtures', 'test-part.png');
const FIXTURE_JPG = path.join(__dirname, 'fixtures', 'test-part.jpg');
let productId = '';

test.beforeAll(async () => {
  await resetSettings();
  const db = serviceClient();
  await db.from('products').delete().like('slug', 'e2e-test-%');
  await db.from('product_categories').delete().like('slug', 'e2e-%');
});

test.afterAll(async () => {
  const db = serviceClient();
  const { data } = await db.from('product_images').select('storage_path').like('storage_path', 'products/%');
  await db.from('products').delete().like('slug', 'e2e-test-%');
  await db.from('product_categories').delete().like('slug', 'e2e-%');
  if (data?.length) await db.storage.from('product-images').remove(data.map((d) => d.storage_path));
  await resetSettings();
});

async function publicHtml(page: Page, url: string) {
  const res = await page.request.get(url);
  return res.text();
}

test('unauthenticated visitors are redirected away from every admin page', async ({ page }) => {
  for (const p of ['/admin', '/admin/products', '/admin/products/new', '/admin/models', '/admin/categories', '/admin/settings']) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  // There is no public registration page.
  const res = await page.goto('/admin/register');
  await expect(page).toHaveURL(/\/admin\/login/);
  expect(res?.status()).toBeLessThan(500);
});

test('admin pages and API carry noindex', async ({ page }) => {
  const res = await page.goto('/admin/login');
  expect(res?.headers()['x-robots-tag']).toContain('noindex');
});

test('login rejects a wrong password with a generic message and keeps the email', async ({ page }) => {
  await login(page, { email: ADMIN.email, password: 'definitely-wrong-password' });
  await expect(page.locator('main').getByRole('alert')).toHaveText(/Incorrect email or password/);
  await expect(page.getByLabel('Email')).toHaveValue(ADMIN.email);
  await login(page, { email: 'nobody@local.test', password: 'whatever-123456' });
  await expect(page.locator('main').getByRole('alert')).toHaveText(/Incorrect email or password/);
});

test('a signed-in user who is not an admin is refused', async ({ page }) => {
  await login(page, STAFF);
  await expect(page.locator('main').getByRole('alert')).toHaveText(/does not have access/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('admin can sign in, sees real dashboard numbers, and signs out', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const db = serviceClient();
  const { count } = await db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'published');
  const tile = page.getByRole('link', { name: /^Published/ });
  await expect(tile).toContainText(String(count ?? 0));
  // The shop's WhatsApp number is configured, so the setup prompt is gone.
  await expect(page.getByText('Add the shop’s WhatsApp number')).toHaveCount(0);
  await page.getByRole('button', { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/admin\/login\?signed_out=1/);
  await page.goto('/admin/products');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('categories: add a new category', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/categories');
  await expect(page.getByText('were suggestions')).toBeVisible();
  await page.getByRole('button', { name: 'Add category' }).click();
  await page.locator('#categories-new-name').fill(`E2E Clutch ${RUN}`);
  await expect(page.locator('#categories-new-slug')).toHaveValue(`e2e-clutch-${RUN}`);
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByText(`E2E Clutch ${RUN}`)).toBeVisible();
  // Duplicate is rejected with a clear message
  await page.getByRole('button', { name: 'Add category' }).click();
  await page.locator('#categories-new-name').fill(`E2E Clutch ${RUN}`);
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('already exists');
});

test('product: validation errors keep the typed values', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/products/new');
  await page.locator('#part_number').fill('KEEP-ME');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('fix the highlighted');
  await expect(page.getByText('Enter the part name')).toBeVisible();
  await expect(page.locator('#part_number')).toHaveValue('KEEP-ME');
});

test('product: create as draft with category and compatible models', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/products/new');
  await page.locator('#name').fill(PRODUCT);
  await page.locator('#part_number').fill(`TST-${RUN}`);
  await page.locator('#category_id').selectOption({ label: `E2E Clutch ${RUN}` });
  await page.locator('#description').fill('Test record created by automated tests.');
  await page.getByRole('checkbox', { name: 'Classic' }).check();
  await page.getByRole('checkbox', { name: 'Bullet', exact: true }).check();
  await page.getByRole('radio', { name: 'Available' }).check();
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\?created=1/);
  productId = page.url().split('/admin/products/')[1].split('?')[0];
  await expect(page.getByText('Product created.')).toBeVisible();

  const { data } = await serviceClient()
    .from('products')
    .select('slug, status, availability, compat:product_model_compatibility(model:motorcycle_models(slug))')
    .eq('id', productId)
    .single();
  expect(data!.slug).toBe(SLUG);
  expect(data!.status).toBe('draft');
  expect(data!.availability).toBe('available');
  expect((data!.compat as unknown as { model: { slug: string } }[]).map((c) => c.model.slug).sort()).toEqual(['bullet', 'classic']);

  // Drafts are not public.
  const res = await page.request.get(`/products/${SLUG}`);
  expect(await res.text()).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
});

test('photos: upload multiple, reject bad files, set main photo, reorder, describe', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/admin/products/${productId}`);
  await page.waitForLoadState('networkidle'); // React must be hydrated before choosing files
  const input = page.getByTestId('image-input');

  await input.setInputFiles(path.join(__dirname, 'fixtures', 'not-an-image.txt'));
  await expect(page.getByText(/Only JPG, PNG, WebP or HEIC photos/)).toBeVisible();

  await input.setInputFiles([FIXTURE, FIXTURE_JPG]);
  await expect(page.locator('section[aria-labelledby="photos-heading"] li img')).toHaveCount(2, { timeout: 30000 });
  await expect(page.getByText('★ Main photo')).toHaveCount(1);

  const db = serviceClient();
  const { data: imgs } = await db
    .from('product_images')
    .select('id, storage_path, width, height, is_primary, sort_order, storage_provider, image_url, provider_file_id, file_size, mime_type')
    .eq('product_id', productId)
    .order('sort_order');
  expect(imgs).toHaveLength(2);
  for (const img of imgs!) {
    expect(img.storage_path).toMatch(new RegExp(`^products/${productId}/[0-9a-f-]+\\.(webp|jpg)$`));
    expect(Math.max(img.width!, img.height!)).toBeLessThanOrEqual(1600);
    // Default provider: the file is in the Supabase bucket and no URL is
    // duplicated into the database.
    expect(img.storage_provider).toBe('supabase');
    expect(img.image_url).toBeNull();
    expect(img.provider_file_id).toBeNull();
    expect(img.file_size).toBeGreaterThan(0);
    expect(['image/webp', 'image/jpeg']).toContain(img.mime_type);
  }
  await expect(page.getByTestId('image-provider-badge').first()).toHaveText('Supabase Storage');
  // Optimised: re-encoded file is served publicly and is small.
  const fileRes = await page.request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${imgs![0].storage_path}`);
  expect(fileRes.status()).toBe(200);
  expect(['image/webp', 'image/jpeg']).toContain(fileRes.headers()['content-type']);
  expect((await fileRes.body()).length).toBeLessThan(fs.statSync(FIXTURE_JPG).size * 4);

  // Make the second photo the main one.
  await page.getByRole('button', { name: 'Make main' }).click();
  await expectEventually(async () => {
    const { data } = await db.from('product_images').select('id').eq('product_id', productId).eq('is_primary', true).single();
    return data?.id === imgs![1].id;
  });

  // Reorder: move first photo later.
  await page.getByRole('button', { name: 'Move photo later' }).first().click();
  await expectEventually(async () => {
    const { data } = await db.from('product_images').select('id').eq('product_id', productId).order('sort_order');
    return data?.[0].id === imgs![1].id;
  });

  // Alt text (reload so the list reflects the new order first)
  await page.reload();
  await page.waitForLoadState('networkidle');
  const altInput = page.getByLabel('Photo description').first();
  await altInput.fill('Clutch plate, front view');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByText('Photo description saved.')).toBeVisible();
  await expectEventually(async () => {
    const { data } = await db.from('product_images').select('alt_text').eq('product_id', productId);
    return Boolean(data?.some((d) => d.alt_text === 'Clutch plate, front view'));
  });
});

test('publish and verify the public product page', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/admin/products/${productId}`);
  await page.locator('#status').selectOption('published');
  await page.getByRole('checkbox', { name: /Feature on the homepage/ }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('link', { name: /View on website/ })).toBeVisible();

  // A URL requested before publishing can be served stale for a moment; retry until fresh.
  await expect(async () => {
    await page.goto(`/products/${SLUG}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PRODUCT, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(page.locator('main').getByText('Available', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`TST-${RUN}`).first()).toBeVisible();
  const fits = page.locator('h2:has-text("Fits these motorcycles") + ul');
  await expect(fits.getByRole('link', { name: 'Bullet' })).toBeVisible();
  await expect(fits.getByRole('link', { name: 'Classic' })).toBeVisible();
  await expect(page.locator('img[alt="Clutch plate, front view"]').first()).toBeVisible();
  // The shop's WhatsApp and call links both point at the shop number.
  await expect(page.locator('a[href^="https://wa.me/919677093315"]').first()).toBeVisible();
  await expect(page.getByTestId('call-shop').first()).toHaveAttribute('href', 'tel:+919677093315');
  // Product JSON-LD: genuine data only, no price/offers.
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
  const product = ld.find((d) => d['@type'] === 'Product');
  expect(product.name).toBe(PRODUCT);
  expect(product.sku).toBe(`TST-${RUN}`);
  expect(product.offers).toBeUndefined();
  expect(JSON.stringify(product)).not.toMatch(/price|rating|review/i);
  const crumbs = ld.find((d) => d['@type'] === 'BreadcrumbList');
  expect(crumbs.itemListElement.at(-1).name).toBe(PRODUCT);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/products/${SLUG}$`));
});

test('public browsing: homepage featured, model page, category filter, search, availability filter', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Featured parts' })).toBeVisible();
  await expect(page.getByRole('link', { name: PRODUCT })).toBeVisible();
  await expect(page.getByRole('link', { name: `E2E Clutch ${RUN}` })).toBeVisible();

  await page.goto('/models/classic');
  await expect(page.getByRole('link', { name: PRODUCT })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0); // now indexable
  await page.goto('/models/himalayan');
  await expect(page.getByRole('link', { name: PRODUCT })).toHaveCount(0);

  await page.goto('/products');
  await page.getByLabel('Part category').selectOption({ label: `E2E Clutch ${RUN}` });
  await expect(page).toHaveURL(new RegExp(`category=e2e-clutch-${RUN}`));
  await expect(page.getByRole('link', { name: PRODUCT })).toBeVisible();
  await page.getByLabel('Availability').selectOption('out_of_stock');
  await expect(page).toHaveURL(/availability=out_of_stock/);
  await expect(page.getByText('No matching parts listed')).toBeVisible();

  await page.goto(`/products?q=${encodeURIComponent(`TST-${RUN}`)}`);
  await expect(page.getByRole('link', { name: PRODUCT })).toBeVisible();
  await page.goto('/products?model=himalayan');
  await expect(page.getByRole('link', { name: PRODUCT })).toHaveCount(0);

  const sitemap = await publicHtml(page, '/sitemap.xml');
  expect(sitemap).toContain(`/products/${SLUG}`);
  expect(sitemap).toContain('/models/classic');
});

test('quick availability change in the list is reflected on the website', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/admin/products?q=${encodeURIComponent(PRODUCT)}`);
  await page.getByLabel(`Availability for ${PRODUCT}`).selectOption('out_of_stock');
  await expect(page.getByText('Saving…')).toHaveCount(0, { timeout: 10000 });
  await expectEventually(async () => (await publicHtml(page, `/products/${SLUG}`)).includes('Out of Stock'));
  const { data } = await serviceClient().from('products').select('availability').eq('id', productId).single();
  expect(data!.availability).toBe('out_of_stock');
});

test('settings: WhatsApp validation and enquiry links', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/settings');
  const wa = page.locator('#whatsapp_number');
  await wa.fill('12ab');
  await page.getByRole('button', { name: 'Save business details' }).click();
  await expect(page.getByText(/Enter the WhatsApp mobile number with country code/)).toBeVisible();
  await page.locator('#google_maps_url').fill('http://insecure.example');
  await page.getByRole('button', { name: 'Save business details' }).click();
  await expect(page.getByText('Enter a full link starting with https://')).toBeVisible();

  await page.locator('#google_maps_url').fill('');
  await wa.fill('+91 90000 00000'); // obviously-test number, local only
  await page.locator('#opening_hours').fill('Test hours line');
  await page.getByRole('button', { name: 'Save business details' }).click();
  await expect(page.getByText('Business details saved.')).toBeVisible();
  const { data } = await serviceClient().from('business_settings').select('whatsapp_number').eq('id', 1).single();
  expect(data!.whatsapp_number).toBe('919000000000');

  // Product page: WhatsApp link carries the product name and the chosen model.
  const link = page.getByTestId('whatsapp-enquiry').first();
  await expect(async () => {
    await page.goto(`/products/${SLUG}`);
    await expect(link).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  let href = (await link.getAttribute('href'))!;
  expect(href.startsWith('https://wa.me/919000000000?text=')).toBe(true);
  let msg = decodeURIComponent(href.split('text=')[1]);
  expect(msg).toBe(`Hello, I am enquiring about ${PRODUCT} (part no. TST-${RUN}). Is this genuine part currently available?`);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await page.getByRole('button', { name: 'Classic', pressed: false }).click();
  href = (await link.getAttribute('href'))!;
  msg = decodeURIComponent(href.split('text=')[1]);
  expect(msg).toContain(`${PRODUCT} (part no. TST-${RUN}) for Classic.`);
  await expect(page.getByText('Test hours line')).toBeVisible(); // footer hours

  // Clearing the number restores the call fallback everywhere.
  await page.goto('/admin/settings');
  await page.locator('#whatsapp_number').fill('');
  await page.locator('#opening_hours').fill('');
  await page.getByRole('button', { name: 'Save business details' }).click();
  await expect(page.getByText('Business details saved.')).toBeVisible();
  await page.goto(`/products/${SLUG}`);
  expect(await page.locator('a[href*="wa.me"]').count()).toBe(0);
  await expect(page.getByTestId('call-shop').first()).toBeVisible();

  // Restore settings so subsequent tests (or public tests) are not affected.
  await resetSettings();
});

test('models: reorder and deactivate/reactivate', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/models');
  const db = serviceClient();
  const order = async () => (await db.from('motorcycle_models').select('slug').order('sort_order')).data!.map((r) => r.slug);
  const before = await order();
  await page.getByRole('button', { name: `Move ${'Classic'} up` }).click();
  await expectEventually(async () => (await order()).indexOf('classic') === before.indexOf('classic') - 1);
  await page.getByRole('button', { name: 'Move Classic down' }).click();
  await expectEventually(async () => JSON.stringify(await order()) === JSON.stringify(before));

  // Deactivate Scram -> hidden from public models page; then restore.
  const row = page.getByTestId('taxonomy-manager').locator('li', { hasText: 'Scram' }).first();
  await row.getByRole('button', { name: 'Edit' }).click();
  await row.getByRole('checkbox', { name: /Active/ }).uncheck();
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(row.getByText('Inactive — hidden from website')).toBeVisible();
  await expectEventually(async () => !(await publicHtml(page, '/models')).includes('/models/scram"'));
  // The edit form stays open after saving.
  await row.getByRole('checkbox', { name: /Active/ }).check();
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(row.getByText(/^Active ·/)).toBeVisible();
});

test('archive hides from the website; restore; then delete removes product and photos', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/admin/products/${productId}`);
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('button', { name: 'Restore as draft' })).toBeVisible();
  await expectEventually(async () => {
    const res = await page.request.get(`/products/${SLUG}`);
    const html = await res.text();
    return html.includes('NEXT_HTTP_ERROR_FALLBACK;404');
  }, 30000);

  const db = serviceClient();
  const { data: imgs } = await db.from('product_images').select('storage_path').eq('product_id', productId);
  expect(imgs!.length).toBe(2);

  // Cancel keeps it.
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  expect((await db.from('products').select('id').eq('id', productId)).data).toHaveLength(1);

  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete forever' }).click();
  await expect(page).toHaveURL(/\/admin\/products\?deleted=1/);
  await expect(page.getByText('Product deleted.')).toBeVisible();
  expect((await db.from('products').select('id').eq('id', productId)).data).toHaveLength(0);
  for (const img of imgs!) {
    const r = await page.request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${img.storage_path}`);
    expect(r.status()).not.toBe(200);
  }
});

test('CSV import: the shop parts list is added once, re-import skips duplicates', async ({ page }) => {
  const file = path.join(__dirname, '..', '..', 'data', 'shop-parts-2026-11.csv');
  const db = serviceClient();
  const parts = ['600004/A', 'RAG00140/A', 'RAQ00471/B', '1100650/B', '110643/7', '1120042/B', '145251/D', '145375/A', '145553/B', '147548/B', '590544/A', '591993/F', '594706/A'];
  await db.from('products').delete().in('part_number', parts);
  try {
    await loginAsAdmin(page);
    await page.goto('/admin/products');
    await page.getByRole('link', { name: 'Import CSV' }).click();
    await page.locator('#file').setInputFiles(file);
    await page.getByRole('button', { name: 'Import products' }).click();
    await expect(page.getByText('13 products added.')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('main li', { hasText: 'created' })).toHaveCount(13);

    await page.locator('#file').setInputFiles(file);
    await page.getByRole('button', { name: 'Import products' }).click();
    await expect(page.getByText('0 products added.')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('main li', { hasText: 'already exists' })).toHaveCount(13);

    const { data } = await db
      .from('products')
      .select('name, status, availability, compat:product_model_compatibility(model:motorcycle_models(slug))')
      .eq('part_number', '591993/F')
      .single();
    expect(data!.status).toBe('published');
    expect(data!.availability).toBe('contact_to_confirm');
    expect((data!.compat as unknown as { model: { slug: string } }[]).map((c) => c.model.slug)).toEqual(['classic']);

    await expectEventually(async () => (await publicHtml(page, '/models/classic')).includes('Handle Bar (Domestic)'));
    await page.goto('/products?q=145251');
    await expect(page.getByRole('link', { name: 'Inspection Cap' })).toBeVisible();
  } finally {
    await db.from('products').delete().in('part_number', parts);
    await refreshSite();
  }
});

test('password recovery: email link lets the admin set a new password', async ({ page }) => {
  const mailDir = path.join(process.env.LOCAL_STACK_DIR ?? '/opt/localstack', 'mail');
  test.skip(!fs.existsSync(mailDir), 'Local SMTP sink not available');
  const before = new Set(fs.readdirSync(mailDir));

  await page.goto('/admin/forgot-password');
  await page.locator('#email').fill(ADMIN.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.locator('main').getByRole('status')).toContainText('If that email belongs to an admin account');

  let file = '';
  await expectEventually(async () => {
    file = fs.readdirSync(mailDir).find((f) => !before.has(f)) ?? '';
    return Boolean(file);
  });
  const raw = fs.readFileSync(path.join(mailDir, file), 'utf8').replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  // The recovery email links straight to /auth/confirm with a token_hash, which
  // the confirm route verifies with verifyOtp — no PKCE code-verifier cookie,
  // so it works even from a different device. (A plain ?code= or /verify link
  // is still accepted too, for the hosted PKCE flow.)
  const link = raw
    .match(/https?:\/\/[^\s"<>]+\/(?:auth\/confirm|verify)\?[^\s"<>]+/)?.[0]
    ?.replace(/&amp;/g, '&');
  expect(link, 'recovery link in email').toBeTruthy();

  await page.goto(link!);
  await expect(page).toHaveURL(/\/admin\/reset-password/);
  // Unique per run: GoTrue rejects reusing the current password, so a fixed
  // value would block a rerun if a previous run failed before restoring it.
  const temp = `Temporary-New-Pass-${RUN}`;
  await page.locator('#password').fill(temp);
  await page.locator('#confirm').fill(temp);
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page).toHaveURL(/\/admin\?password_updated=1/);
  await expect(page.getByText('Your password has been updated.')).toBeVisible();

  // The new password must actually let the admin log in. Clear the session
  // first, then sign in with it from a clean state.
  await page.context().clearCookies();
  await login(page, { email: ADMIN.email, password: temp });
  await expect(page).toHaveURL(/\/admin$/);

  // Restore the original test password for later runs. Done through the admin
  // API rather than the signed-in UI, so it does not depend on the recovery
  // session surviving a password change.
  const admin = serviceClient();
  const { data: list } = await admin.auth.admin.listUsers();
  const owner = list.users.find((u) => u.email === ADMIN.email);
  expect(owner, 'owner account exists').toBeTruthy();
  const { error: restoreError } = await admin.auth.admin.updateUserById(owner!.id, {
    password: ADMIN.password,
  });
  expect(restoreError, 'restore original password').toBeNull();

  // Enumeration-safe: unknown address gets the same response.
  await page.goto('/admin/forgot-password');
  await page.locator('#email').fill('unknown-person@local.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.locator('main').getByRole('status')).toContainText('If that email belongs to an admin account');
});

/* ------------------------------------------------------------------ */
/* Rupee pricing, festive offer banner and home page image upload.      */
/* ------------------------------------------------------------------ */

const PRICED_SLUG = `e2e-test-priced-${RUN}`;

test('pricing: MRP, offer price and festive discount are shown in rupees', async ({ page }) => {
  const db = serviceClient();
  const { data: product, error } = await db
    .from('products')
    .insert({
      name: `E2E Priced Part ${RUN}`,
      slug: PRICED_SLUG,
      part_number: `PRC-${RUN}`,
      availability: 'available',
      status: 'published',
      published_at: new Date().toISOString(),
      mrp: 1000,
    })
    .select('id')
    .single();
  expect(error).toBeNull();

  try {
    // No offer, no festive: the MRP is the price.
    await page.goto(`/products/${PRICED_SLUG}`);
    await expect(page.getByLabel('Price ₹1,000').first()).toBeVisible();

    // Festive offer: 10% off MRP, with a banner on the home page.
    const festiveSet = await db.from('business_settings').update({ festive_active: true, festive_label: `E2E Pongal Sale ${RUN}`, festive_discount_type: 'percent', festive_discount_value: 10 }).eq('id', 1);
    expect(festiveSet.error).toBeNull();
    await refreshSite();
    await expect(async () => {
      await page.goto(`/products/${PRICED_SLUG}`);
      await expect(page.getByLabel('Price ₹900').first()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    await expect(page.getByText('Save 10%').first()).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('status').filter({ hasText: `E2E Pongal Sale ${RUN}` })).toBeVisible();

    // A part's own offer price beats the festive discount.
    const offerSet = await db.from('products').update({ offer_price: 800 }).eq('id', product!.id);
    expect(offerSet.error).toBeNull();
    await refreshSite();
    await expect(async () => {
      await page.goto(`/products/${PRICED_SLUG}`);
      await expect(page.getByLabel('Price ₹800').first()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    await expect(page.getByText('Save 20%').first()).toBeVisible();
  } finally {
    await db.from('products').delete().eq('id', product!.id);
    await resetSettings();
  }
});

test('home page image: upload replaces only the hero picture; bad files are refused', async ({ page }) => {
  const db = serviceClient();
  await loginAsAdmin(page);
  await page.goto('/admin/settings');

  await page.locator('input[name="image"]').setInputFiles(path.join(__dirname, 'fixtures', 'not-an-image.txt'));
  await page.getByRole('button', { name: 'Upload new image' }).click();
  await expect(page.getByText('Use a PNG, JPEG or WebP image.')).toBeVisible();

  await page.locator('input[name="image"]').setInputFiles(FIXTURE);
  await page.getByRole('button', { name: 'Upload new image' }).click();
  await expect(page.getByText('Home page image updated. The website now shows it.')).toBeVisible();
  // The browser compressed the upload before sending it.
  await expect(page.getByText(/Optimised from/)).toBeVisible();

  try {
    const { data } = await db.from('business_settings').select('hero_image_path').eq('id', 1).single();
    expect(data!.hero_image_path).toMatch(/^hero\/[a-z0-9-]{8,64}\.(webp|jpg|png)$/);

    // The uploaded image is served from the public brand-images bucket.
    await expectEventually(async () => (await publicHtml(page, '/')).includes(`/storage/v1/object/public/brand-images/${data!.hero_image_path}`));
  } finally {
    const { data } = await db.from('business_settings').select('hero_image_path').eq('id', 1).single();
    if (data?.hero_image_path) await db.storage.from('brand-images').remove([data.hero_image_path]);
    await resetSettings();
  }
});

test('cart: add a part, review, enter details, confirm and send the order on WhatsApp', async ({ page, context }) => {
  const db = serviceClient();
  const CART_SLUG = `e2e-test-cart-${RUN}`;
  const CART_NAME = `E2E Cart Part ${RUN}`;
  const { data: product, error } = await db
    .from('products')
    .insert({
      name: CART_NAME,
      slug: CART_SLUG,
      part_number: `CRT-${RUN}`,
      availability: 'available',
      status: 'published',
      published_at: new Date().toISOString(),
      mrp: 1000,
    })
    .select('id')
    .single();
  expect(error).toBeNull();

  try {
    await page.goto(`/products/${CART_SLUG}`);
    await page.getByRole('button', { name: `Add ${CART_NAME} to cart` }).click();
    await expect(page.getByText('Added to your cart')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
    await expect(page.getByRole('link', { name: CART_NAME })).toBeVisible();
    await expect(page.getByText('Total').locator('..').getByText('₹1,000')).toBeVisible();
    await page.getByRole('button', { name: `Increase quantity of ${CART_NAME}` }).click();
    await expect(page.getByRole('group', { name: `Quantity for ${CART_NAME}` })).toContainText('2');
    await page.getByRole('link', { name: 'Continue to order' }).click();
    await expect(page).toHaveURL(/\/cart\/order$/);

    // Details are checked before the review step.
    await page.getByRole('button', { name: 'Review order' }).click();
    await expect(page.getByText('Enter your name.')).toBeVisible();
    await expect(page.getByText('Enter your mobile number so the shop can reply.')).toBeVisible();
    await page.locator('#mobile').fill('12345');
    await page.locator('#name').fill('Test Customer');
    await page.getByRole('button', { name: 'Review order' }).click();
    await expect(page.getByText('Enter a valid mobile number')).toBeVisible();

    await page.locator('#mobile').fill('98765 43210');
    await page.locator('#motorcycle').fill('Classic 350');
    await page.getByRole('button', { name: 'Review order' }).click();
    await expect(page.getByRole('heading', { name: 'Check your order' })).toBeVisible();
    await expect(page.getByText('Total ₹2,000')).toBeVisible();
    await page.getByText('Message that will be sent').click();
    await expect(page.getByText(`${CART_NAME} (part no. CRT-${RUN}) [OEM] × 2`)).toBeVisible();

    // Confirming opens WhatsApp to the shop's number with the order in the message.
    const [popup] = await Promise.all([context.waitForEvent('page'), page.getByTestId('confirm-order').click()]);
    expect(popup).toBeTruthy();
    const link = page.getByRole('link', { name: 'Open WhatsApp' });
    const href = (await link.getAttribute('href'))!;
    expect(href.startsWith('https://wa.me/919677093315?text=')).toBe(true);
    const message = decodeURIComponent(href.split('text=')[1]);
    expect(message).toContain(`${CART_NAME} (part no. CRT-${RUN}) [OEM] × 2`);
    expect(message).toContain('Name: Test Customer');
    expect(message).toContain('Mobile: 98765 43210');
    expect(message).toContain('Motorcycle: Classic 350');

    await page.getByRole('button', { name: 'Clear cart' }).click();
    await expect(page.getByRole('link', { name: 'Cart' })).toBeVisible();
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  } finally {
    await db.from('products').delete().eq('id', product!.id);
  }
});

/* ------------------------------------------------------------------ */
/* Image storage provider: Supabase Storage or ImageKit.               */
/*                                                                     */
/* ImageKit is deliberately NOT configured in this environment, which  */
/* is also the shop's starting state. These tests cover the provider    */
/* choice, the honest failure when ImageKit is unavailable, display and */
/* deletion of an ImageKit-stored photo, and that a delete is never     */
/* sent to the wrong provider.                                         */
/* ------------------------------------------------------------------ */

/** A published product of its own, so these tests do not depend on order. */
async function makeProduct(db: ReturnType<typeof serviceClient>, suffix: string) {
  const { data, error } = await db
    .from('products')
    .insert({
      name: `E2E Provider Part ${suffix}`,
      slug: `e2e-test-provider-${suffix}`,
      part_number: `PRV-${suffix}`,
      availability: 'available',
      status: 'published',
      published_at: new Date().toISOString(),
      mrp: 500,
    })
    .select('id, slug')
    .single();
  expect(error).toBeNull();
  return data!;
}

test('image storage: the provider picker defaults to the saved provider and explains each one', async ({ page }) => {
  const db = serviceClient();
  const product = await makeProduct(db, `pick-${RUN}`);
  try {
    await loginAsAdmin(page);
    await page.goto(`/admin/products/${product.id}`);

    const picker = page.getByTestId('provider-picker');
    await expect(picker).toBeVisible();
    await expect(page.getByRole('radio', { name: /Supabase Storage/ })).toBeChecked();
    await expect(page.getByText(/stored in the shop’s own Supabase bucket/)).toBeVisible();
    await expect(page.getByText(/This is the saved default/)).toBeVisible();

    // ImageKit is selectable even before it is configured, and says so.
    await page.getByRole('radio', { name: /ImageKit/ }).check();
    await expect(page.getByText(/stored in the ImageKit media library/)).toBeVisible();
    await expect(page.getByText(/ImageKit is not configured on the server, so an upload to it will fail/)).toBeVisible();
    await expect(page.getByText(/Just for the next upload. The saved default is Supabase Storage/)).toBeVisible();
  } finally {
    await db.from('products').delete().eq('id', product.id);
  }
});

test('image storage: an ImageKit upload with no keys fails clearly and creates nothing', async ({ page }) => {
  const db = serviceClient();
  const product = await makeProduct(db, `ikfail-${RUN}`);
  try {
    await loginAsAdmin(page);
    await page.goto(`/admin/products/${product.id}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('radio', { name: /ImageKit/ }).check();
    await page.getByTestId('image-input').setInputFiles(FIXTURE);

    // Named provider, no silent fallback to Supabase.
    await expect(page.getByText(/ImageKit is not configured on the server, so nothing was uploaded/)).toBeVisible({ timeout: 30000 });

    // A failed upload leaves no database record and no file anywhere.
    const { data: rows } = await db.from('product_images').select('id').eq('product_id', product.id);
    expect(rows ?? []).toHaveLength(0);
    const { data: files } = await db.storage.from('product-images').list(`products/${product.id}`);
    expect(files ?? []).toHaveLength(0);

    // Switching back to Supabase in the same session uploads normally.
    await page.getByRole('radio', { name: /Supabase Storage/ }).check();
    await page.getByTestId('image-input').setInputFiles(FIXTURE);
    await expect(page.locator('section[aria-labelledby="photos-heading"] li img')).toHaveCount(1, { timeout: 30000 });
    const { data: after } = await db.from('product_images').select('storage_provider').eq('product_id', product.id);
    expect(after).toHaveLength(1);
    expect(after![0].storage_provider).toBe('supabase');
  } finally {
    const { data: imgs } = await db.from('product_images').select('storage_path').eq('product_id', product.id);
    if (imgs?.length) await db.storage.from('product-images').remove(imgs.map((i) => i.storage_path));
    await db.from('products').delete().eq('id', product.id);
  }
});

test('image storage: the default provider is saved and still selected after a reload', async ({ page }) => {
  const db = serviceClient();
  try {
    await loginAsAdmin(page);
    await page.goto('/admin/settings');

    const section = page.locator('#image-storage');
    await expect(section.getByRole('heading', { name: 'Image storage' })).toBeVisible();

    // ImageKit cannot become the default while it is not configured.
    await section.getByRole('radio', { name: /ImageKit/ }).check();
    await section.getByRole('button', { name: 'Save default provider' }).click();
    await expect(page.getByText(/ImageKit is not configured on the server yet, so it cannot be the default/)).toBeVisible();
    const { data: unchanged } = await db.from('business_settings').select('default_image_provider').eq('id', 1).single();
    expect(unchanged!.default_image_provider).toBe('supabase');

    // Saving Supabase works and the choice survives a reload and a new page.
    await section.getByRole('radio', { name: /Supabase Storage/ }).check();
    await section.getByRole('button', { name: 'Save default provider' }).click();
    await expect(page.getByText(/New photos will be stored on Supabase Storage/)).toBeVisible();

    await page.reload();
    await expect(page.locator('#image-storage').getByRole('radio', { name: /Supabase Storage/ })).toBeChecked();

    // A directly saved ImageKit default is honoured by the product page.
    const set = await db.from('business_settings').update({ default_image_provider: 'imagekit' }).eq('id', 1);
    expect(set.error).toBeNull();
    const product = await makeProduct(db, `default-${RUN}`);
    try {
      await page.goto(`/admin/products/${product.id}`);
      await expect(page.getByRole('radio', { name: /ImageKit/ })).toBeChecked();
      await expect(page.getByText(/This is the saved default/)).toBeVisible();
    } finally {
      await db.from('products').delete().eq('id', product.id);
    }
  } finally {
    await resetSettings();
  }
});

test('image storage: connection status is checked on the server and usage is never invented', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/settings');
  const statuses = page.getByTestId('provider-statuses');

  const supabaseRow = statuses.locator('li').filter({ hasText: 'Supabase Storage' });
  await expect(supabaseRow.getByText('Connected', { exact: true })).toBeVisible();
  await expect(supabaseRow.getByText(/Bucket “product-images” is reachable/)).toBeVisible();

  const imagekitRow = statuses.locator('li').filter({ hasText: 'ImageKit' });
  // The pill, separate from the longer explanation underneath it.
  await expect(imagekitRow.getByText('Not configured', { exact: true })).toBeVisible();
  await expect(imagekitRow.getByText(/Usage unavailable/)).toBeVisible();

  // Which variables are missing is named; no key material is shown.
  await expect(page.getByText(/set IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT/)).toBeVisible();
  expect(await page.content()).not.toContain('private_');
});

test('image storage: an ImageKit photo displays everywhere, and deleting it never touches Supabase', async ({ page }) => {
  const db = serviceClient();
  const product = await makeProduct(db, `ikshow-${RUN}`);
  const supabasePath = `products/${product.id}/aaaaaaaa-1111.webp`;
  const imagekitUrl = 'https://ik.imagekit.io/e2e-test-shop/products/x/bbbbbbbb-2222.webp';

  try {
    // One real file in the Supabase bucket, plus an ImageKit-stored photo.
    const upload = await db.storage.from('product-images').upload(supabasePath, fs.readFileSync(FIXTURE), { contentType: 'image/webp' });
    expect(upload.error).toBeNull();
    const supabaseRow = await db
      .from('product_images')
      .insert({ product_id: product.id, storage_path: supabasePath, sort_order: 10, is_primary: true, file_size: 1234, mime_type: 'image/webp' })
      .select('id')
      .single();
    expect(supabaseRow.error).toBeNull();

    const imagekitRow = await db
      .from('product_images')
      .insert({
        product_id: product.id,
        storage_path: `/products/${product.id}/bbbbbbbb-2222.webp`,
        storage_provider: 'imagekit',
        image_url: imagekitUrl,
        provider_file_id: `file_e2e_${RUN}`,
        sort_order: 20,
        is_primary: false,
        file_size: 2345,
        mime_type: 'image/webp',
      })
      .select('id')
      .single();
    expect(imagekitRow.error).toBeNull();
    await refreshSite();

    // Public product page renders the saved ImageKit URL as-is.
    await expect(async () => {
      await page.goto(`/products/${product.slug}`);
      await expect(page.locator(`img[src^="${imagekitUrl}"]`).first()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    // The Supabase photo on the same product still comes from the bucket.
    await expect(page.locator('img[src*="/storage/v1/object/public/product-images/"]').first()).toBeVisible({ timeout: 15000 });

    // Admin editing shows both, each labelled with its provider.
    await loginAsAdmin(page);
    await expect(async () => {
      await page.goto(`/admin/products/${product.id}`);
      await expect(page.getByTestId('image-provider-badge')).toHaveCount(2, { timeout: 3000 });
    }).toPass({ timeout: 25000 });
    await expect(page.getByTestId('image-provider-badge').filter({ hasText: 'ImageKit' })).toHaveCount(1);
    await expect(page.locator(`section[aria-labelledby="photos-heading"] img[src^="${imagekitUrl}"]`)).toHaveCount(1);

    // Remove the ImageKit photo. ImageKit is unreachable here, so the admin is
    // told the file is still there and it is queued for cleanup.
    const card = page.locator('section[aria-labelledby="photos-heading"] li').filter({ has: page.locator(`img[src^="${imagekitUrl}"]`) });
    await card.getByRole('button', { name: 'Remove photo' }).click();
    await page.getByRole('button', { name: 'Remove photo', exact: true }).last().click();
    await expect(page.getByText(/the file is still on ImageKit/)).toBeVisible({ timeout: 20000 });

    // The row is gone, the leftover file is recorded for retry...
    await expectEventually(async () => {
      const { data } = await db.from('product_images').select('id').eq('id', imagekitRow.data!.id);
      return (data ?? []).length === 0;
    });
    const { data: queued } = await db
      .from('image_cleanup_queue')
      .select('storage_provider, provider_file_id, last_error')
      .eq('provider_file_id', `file_e2e_${RUN}`);
    expect(queued).toHaveLength(1);
    expect(queued![0].storage_provider).toBe('imagekit');

    // ...and the Supabase file and row were never touched.
    const stillThere = await page.request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${supabasePath}`,
    );
    expect(stillThere.status()).toBe(200);
    const { data: supabaseStill } = await db.from('product_images').select('id').eq('id', supabaseRow.data!.id);
    expect(supabaseStill).toHaveLength(1);

    // The settings page offers the retry and counts the leftover.
    await page.goto('/admin/settings');
    await expect(page.getByTestId('cleanup-pending')).toContainText('1 file');
    await page.getByRole('button', { name: 'Retry cleanup' }).click();
    await expect(page.getByText(/could not be deleted/)).toBeVisible({ timeout: 20000 });
  } finally {
    await db.from('image_cleanup_queue').delete().eq('provider_file_id', `file_e2e_${RUN}`);
    await db.storage.from('product-images').remove([supabasePath]);
    await db.from('products').delete().eq('id', product.id);
  }
});

test('image storage: deleting a Supabase photo removes the file from the bucket', async ({ page }) => {
  const db = serviceClient();
  const product = await makeProduct(db, `sbdel-${RUN}`);
  const storagePath = `products/${product.id}/cccccccc-3333.webp`;
  try {
    const upload = await db.storage.from('product-images').upload(storagePath, fs.readFileSync(FIXTURE), { contentType: 'image/webp' });
    expect(upload.error).toBeNull();
    const row = await db
      .from('product_images')
      .insert({ product_id: product.id, storage_path: storagePath, sort_order: 10, is_primary: true })
      .select('id')
      .single();
    expect(row.error).toBeNull();

    await loginAsAdmin(page);
    await page.goto(`/admin/products/${product.id}`);
    await page.getByRole('button', { name: 'Remove photo' }).click();
    await page.getByRole('button', { name: 'Remove photo', exact: true }).last().click();
    await expect(page.getByText('Photo removed.')).toBeVisible({ timeout: 20000 });

    await expectEventually(async () => {
      const { data } = await db.from('product_images').select('id').eq('id', row.data!.id);
      return (data ?? []).length === 0;
    });
    // The object itself is gone, and nothing was queued for cleanup.
    await expectEventually(async () => {
      const res = await page.request.get(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`,
      );
      return res.status() !== 200;
    });
    const { data: queue } = await db.from('image_cleanup_queue').select('id').eq('storage_path', storagePath);
    expect(queue ?? []).toHaveLength(0);
  } finally {
    await db.storage.from('product-images').remove([storagePath]);
    await db.from('products').delete().eq('id', product.id);
  }
});

/* ------------------------------------------------------------------ */
/* Genuine (OEM) and vendor parts, and the model pictures.             */
/* ------------------------------------------------------------------ */

/** Creates a genuine and a vendor listing of the same part for one model. */
async function makeTypedPair(
  db: ReturnType<typeof serviceClient>,
  suffix: string,
  opts: { modelSlug?: string; freshModel?: boolean } = {},
) {
  // A fresh model isolates count assertions from the rest of the catalogue
  // (the demo data populates every built-in model). Otherwise attach to bullet.
  let modelSlug = opts.modelSlug ?? 'bullet';
  let freshModelId: string | null = null;
  if (opts.freshModel) {
    modelSlug = `e2e-model-${suffix}`;
    const { data: fresh, error: modelError } = await db
      .from('motorcycle_models')
      .insert({ name: `E2E Model ${suffix}`, slug: modelSlug, is_active: true, sort_order: 999 })
      .select('id')
      .single();
    expect(modelError).toBeNull();
    freshModelId = fresh!.id;
  }
  const { data: model } = await db.from('motorcycle_models').select('id').eq('slug', modelSlug).single();
  const made: { id: string; slug: string; name: string }[] = [];
  for (const kind of ['oem', 'vendor'] as const) {
    const name = `E2E ${kind === 'oem' ? 'Genuine' : 'Vendor'} Part ${suffix}`;
    const { data, error } = await db
      .from('products')
      .insert({
        name,
        slug: `e2e-test-${kind}-${suffix}`,
        part_number: `${kind.toUpperCase()}-${suffix}`,
        part_type: kind,
        mrp: kind === 'oem' ? 1200 : 600,
        availability: 'available',
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id, slug, name')
      .single();
    expect(error).toBeNull();
    await db.from('product_model_compatibility').insert({ product_id: data!.id, model_id: model!.id });
    made.push(data!);
  }
  await refreshSite();
  return { oem: made[0], vendor: made[1], modelSlug, modelId: freshModelId };
}

async function dropProducts(db: ReturnType<typeof serviceClient>, ids: string[], modelId?: string | null) {
  await db.from('product_model_compatibility').delete().in('product_id', ids);
  await db.from('products').delete().in('id', ids);
  if (modelId) await db.from('motorcycle_models').delete().eq('id', modelId);
  await refreshSite();
}

test('models: cards show a drawing and the OEM / vendor split', async ({ page }) => {
  const db = serviceClient();
  const pair = await makeTypedPair(db, `card-${RUN}`);
  try {
    await page.goto('/models');
    const card = page.getByTestId('model-grid').getByRole('link', { name: /Bullet/ }).first();
    await expect(card).toBeVisible();
    // An original drawing stands in until the shop uploads a photo.
    await expect(card.locator('svg[data-model-art]')).toHaveCount(1);
    await expect(async () => {
      await page.reload();
      await expect(page.getByTestId('model-grid').getByText(/\d+ OEM · \d+ vendor/).first()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
  } finally {
    await dropProducts(db, [pair.oem.id, pair.vendor.id]);
  }
});

test('models: OEM and Vendor tabs filter the parts for one model', async ({ page }) => {
  const db = serviceClient();
  // Fresh model so the OEM(1)/Vendor(1) counts are exact, independent of the
  // rest of the catalogue.
  const pair = await makeTypedPair(db, `tabs-${RUN}`, { freshModel: true });
  try {
    await expect(async () => {
      await page.goto(`/models/${pair.modelSlug}`);
      await expect(page.getByRole('link', { name: `Vendor (1)` })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    const tabs = page.getByTestId('part-type-tabs');
    await expect(tabs.getByRole('link', { name: 'OEM (1)' })).toBeVisible();
    await expect(page.getByRole('link', { name: pair.oem.name })).toBeVisible();
    await expect(page.getByRole('link', { name: pair.vendor.name })).toBeVisible();

    await tabs.getByRole('link', { name: 'Vendor (1)' }).click();
    await expect(page).toHaveURL(/type=vendor/);
    await expect(page.getByRole('link', { name: pair.vendor.name })).toBeVisible();
    await expect(page.getByRole('link', { name: pair.oem.name })).toHaveCount(0);
    // The blurb must say the vendor stock is the same genuine part.
    await expect(page.getByTestId('part-type-blurb')).toContainText('same genuine Royal Enfield parts');

    await tabs.getByRole('link', { name: 'OEM (1)' }).click();
    await expect(page).toHaveURL(/type=oem/);
    await expect(page.getByRole('link', { name: pair.oem.name })).toBeVisible();
    await expect(page.getByRole('link', { name: pair.vendor.name })).toHaveCount(0);
  } finally {
    await dropProducts(db, [pair.oem.id, pair.vendor.id], pair.modelId);
  }
});

test('both supplies are shown as genuine parts, labelled by supply', async ({ page }) => {
  const db = serviceClient();
  const pair = await makeTypedPair(db, `claim-${RUN}`);
  try {
    // Vendor stock is the same genuine part, so the page still says so.
    await expect(async () => {
      await page.goto(`/products/${pair.vendor.slug}`);
      await expect(page.getByTestId('part-type-badge').first()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    await expect(page.getByText('Genuine Royal Enfield part').first()).toBeVisible();
    await expect(page.getByTestId('part-type-badge').first()).toHaveText('Vendor');
    await expect(page.getByText(/same genuine Royal Enfield parts/)).toBeVisible();
    // Nothing anywhere calls it a copy or an alternative to a genuine part.
    await expect(page.getByText(/aftermarket|other manufacturers|not genuine/i)).toHaveCount(0);

    // A page requested right after the product is created can be served stale.
    await expect(async () => {
      await page.goto(`/products/${pair.oem.slug}`);
      await expect(page.getByTestId('part-type-badge').first()).toHaveText('OEM', { timeout: 2000 });
    }).toPass({ timeout: 20000 });
    await expect(page.getByText('Genuine Royal Enfield part').first()).toBeVisible();
  } finally {
    await dropProducts(db, [pair.oem.id, pair.vendor.id]);
  }
});

test('cart: the WhatsApp order says which supply each part came from', async ({ page, context }) => {
  const db = serviceClient();
  const pair = await makeTypedPair(db, `order-${RUN}`);
  try {
    await expect(async () => {
      await page.goto(`/products/${pair.vendor.slug}`);
      await expect(page.getByRole('button', { name: `Add ${pair.vendor.name} to cart` })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    await page.getByRole('button', { name: `Add ${pair.vendor.name} to cart` }).click();

    await page.goto('/cart/order');
    await page.locator('#name').fill('Test Customer');
    await page.locator('#mobile').fill('98765 43210');
    await page.getByRole('button', { name: 'Review order' }).click();
    await expect(page.getByRole('heading', { name: 'Check your order' })).toBeVisible();

    const [, ] = await Promise.all([context.waitForEvent('page'), page.getByTestId('confirm-order').click()]);
    const href = (await page.getByRole('link', { name: 'Open WhatsApp' }).getAttribute('href'))!;
    const message = decodeURIComponent(href.split('text=')[1]);
    expect(message).toContain('[Vendor]');
    expect(message).not.toContain('[OEM]');

    await page.getByRole('button', { name: 'Clear cart' }).click();
  } finally {
    await dropProducts(db, [pair.oem.id, pair.vendor.id]);
  }
});

test('admin: parts can be browsed by model and filtered to one supply', async ({ page }) => {
  const db = serviceClient();
  const pair = await makeTypedPair(db, `adminlist-${RUN}`);
  try {
    await loginAsAdmin(page);

    // The models page counts both kinds and links to the parts.
    await page.goto('/admin/models');
    await expect(page.getByTestId('model-counts-bullet')).toContainText('OEM');
    await expect(page.getByTestId('model-counts-bullet')).toContainText('vendor');
    await page
      .getByTestId('model-gallery')
      .locator('li')
      .filter({ hasText: 'Bullet' })
      .first()
      .getByRole('link', { name: 'View parts', exact: true })
      .click();

    await expect(page).toHaveURL(/\/admin\/products\?model=bullet/);
    await expect(page.getByText(/Parts that fit the/)).toBeVisible();
    await expect(page.getByRole('link', { name: pair.oem.name })).toBeVisible();
    await expect(page.getByRole('link', { name: pair.vendor.name })).toBeVisible();

    // Narrow to vendor only.
    await page.goto('/admin/products?model=bullet&type=vendor');
    await expect(page.getByRole('link', { name: pair.vendor.name })).toBeVisible();
    await expect(page.getByRole('link', { name: pair.oem.name })).toHaveCount(0);
  } finally {
    await dropProducts(db, [pair.oem.id, pair.vendor.id]);
  }
});

test('admin: a part can be switched from OEM to vendor stock', async ({ page }) => {
  const db = serviceClient();
  const pair = await makeTypedPair(db, `switch-${RUN}`);
  try {
    await loginAsAdmin(page);
    await page.goto(`/admin/products/${pair.oem.id}`);

    const choice = page.getByTestId('part-type-choice');
    await expect(choice.getByRole('radio', { name: /OEM/ })).toBeChecked();
    await choice.getByRole('radio', { name: /Vendor/ }).check();
    await page.getByRole('button', { name: /Save/ }).first().click();
    await expect(page.getByText(/Saved/).first()).toBeVisible({ timeout: 20000 });

    await expectEventually(async () => {
      const { data } = await db.from('products').select('part_type').eq('id', pair.oem.id).single();
      return data?.part_type === 'vendor';
    });
  } finally {
    await dropProducts(db, [pair.oem.id, pair.vendor.id]);
  }
});

test('admin: a model picture replaces the drawing, and can be put back', async ({ page }) => {
  const db = serviceClient();
  const { data: model } = await db.from('motorcycle_models').select('id, image_path').eq('slug', 'bullet').single();
  try {
    await loginAsAdmin(page);
    await page.goto('/admin/models');

    const card = page.getByTestId('model-gallery').locator('li').filter({ hasText: 'Bullet' }).first();
    await expect(card.locator('svg[data-model-art]')).toHaveCount(1);
    await card.locator('input[type="file"]').setInputFiles(FIXTURE);
    await card.getByRole('button', { name: 'Upload' }).click();
    await expect(page.getByText('Model picture updated. The website now shows it.')).toBeVisible({ timeout: 30000 });

    const { data: after } = await db.from('motorcycle_models').select('image_path').eq('id', model!.id).single();
    expect(after!.image_path).toMatch(/^models\/[a-z0-9-]{8,64}\.(webp|jpg|png)$/);

    // The public card now shows the photo instead of the drawing.
    await expectEventually(async () => (await publicHtml(page, '/models')).includes(`brand-images/${after!.image_path}`));

    await page.goto('/admin/models');
    const withPhoto = page.getByTestId('model-gallery').locator('li').filter({ hasText: 'Bullet' }).first();
    await withPhoto.getByRole('button', { name: 'Use drawing' }).click();
    await expect(page.getByText(/Photo removed/)).toBeVisible({ timeout: 30000 });
    const { data: reverted } = await db.from('motorcycle_models').select('image_path').eq('id', model!.id).single();
    expect(reverted!.image_path).toBeNull();
  } finally {
    const { data: now } = await db.from('motorcycle_models').select('image_path').eq('id', model!.id).single();
    if (now?.image_path) await db.storage.from('brand-images').remove([now.image_path]);
    await db.from('motorcycle_models').update({ image_path: model!.image_path }).eq('id', model!.id);
    await refreshSite();
  }
});
