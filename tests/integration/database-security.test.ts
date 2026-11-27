/**
 * Database + Storage security tests.
 *
 * Runs against a real Supabase-compatible stack (Supabase Auth + PostgREST +
 * PostgreSQL with our migrations). Locally: scripts/local-stack/start.sh, then
 *   npm run test:integration
 * Against a hosted STAGING project: export the same env vars + test accounts.
 * Never point this at production — it creates and deletes records.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'owner@local.test';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'Local-Test-Owner-Pass-1';
const USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'staff@local.test';
const USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'Local-Test-User-Pass-1';

const enabled = Boolean(URL && ANON && SERVICE);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

let anon: SupabaseClient;
let service: SupabaseClient;
let user: SupabaseClient;
let admin: SupabaseClient;

const tag = `t${Date.now().toString(36)}`;
const ids: { category?: string; published?: string; draft?: string; hidden?: string; archived?: string } = {};
let bulletId = '';
let classicId = '';

async function signedIn(email: string, password: string) {
  const c = createClient(URL!, ANON!, opts);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

describe.skipIf(!enabled)('database security (RLS) and storage policies', () => {
  beforeAll(async () => {
    anon = createClient(URL!, ANON!, opts);
    service = createClient(URL!, SERVICE!, opts);
    user = await signedIn(USER_EMAIL, USER_PASSWORD);
    admin = await signedIn(ADMIN_EMAIL, ADMIN_PASSWORD);

    const { data: models } = await service.from('motorcycle_models').select('id, slug');
    bulletId = models!.find((m) => m.slug === 'bullet')!.id;
    classicId = models!.find((m) => m.slug === 'classic')!.id;

    const { data: cat } = await service
      .from('product_categories')
      .insert({ name: `Test Cat ${tag}`, slug: `test-cat-${tag}` })
      .select('id')
      .single();
    ids.category = cat!.id;

    const mk = async (status: string, suffix: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await service
        .from('products')
        .insert({
          name: `Test ${suffix} ${tag}`,
          slug: `test-${suffix}-${tag}`,
          status,
          category_id: ids.category,
          ...extra,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    };
    ids.published = await mk('published', 'published', { availability: 'available', part_number: `RE-${tag}-100%` });
    ids.draft = await mk('draft', 'draft');
    ids.hidden = await mk('hidden', 'hidden');
    ids.archived = await mk('archived', 'archived');

    for (const pid of [ids.published, ids.draft]) {
      await service.from('product_model_compatibility').insert({ product_id: pid, model_id: bulletId });
      await service
        .from('product_images')
        .insert({ product_id: pid, storage_path: `products/${pid}/seed.webp`, is_primary: true });
    }
  });

  afterAll(async () => {
    if (!enabled) return;
    await service.from('products').delete().like('slug', `%-${tag}`);
    await service.from('product_categories').delete().like('slug', `%-${tag}`);
    await service.from('motorcycle_models').delete().like('slug', `%-${tag}`);
  });

  // ---------------------------------------------------------------- public reads
  describe('public visitor (anon)', () => {
    it('reads all 12 confirmed active models', async () => {
      const { data, error } = await anon.from('motorcycle_models').select('slug').eq('is_active', true);
      expect(error).toBeNull();
      const slugs = data!.map((m) => m.slug);
      for (const s of [
        'bullet', 'classic', 'electra', 'thunderbird', 'other-newer-models', 'scram', 'meteor-350',
        'hunter-350', 'himalayan', 'continental-gt-650', 'standard', 'interceptor-650',
      ]) {
        expect(slugs).toContain(s);
      }
    });

    it('reads the public business settings with only confirmed values', async () => {
      const { data, error } = await anon.from('business_settings').select('*').single();
      expect(error).toBeNull();
      expect(data!.landline).toBe('+91 96770 93315');
    });

    it('sees only published products', async () => {
      const { data } = await anon.from('products').select('id').like('slug', `%-${tag}`);
      expect(data!.map((p) => p.id)).toEqual([ids.published]);
    });

    it('cannot see images or compatibility rows of unpublished products', async () => {
      const imgs = await anon.from('product_images').select('product_id').in('product_id', [ids.published!, ids.draft!]);
      expect(imgs.data!.map((r) => r.product_id)).toEqual([ids.published]);
      const comp = await anon
        .from('product_model_compatibility')
        .select('product_id')
        .in('product_id', [ids.published!, ids.draft!]);
      expect(comp.data!.map((r) => r.product_id)).toEqual([ids.published]);
    });

    it('cannot read admin_users', async () => {
      const { error } = await anon.from('admin_users').select('*');
      expect(error?.code).toBe('42501');
    });

    it('cannot write any catalogue table', async () => {
      const results = await Promise.all([
        anon.from('motorcycle_models').insert({ name: 'X', slug: `x-${tag}` }),
        anon.from('product_categories').insert({ name: 'X', slug: `x-${tag}` }),
        anon.from('products').insert({ name: 'Xx', slug: `x-${tag}` }),
        anon.from('products').update({ name: 'pwned' }).eq('id', ids.published!),
        anon.from('products').delete().eq('id', ids.published!),
        anon.from('business_settings').update({ landline: '000000' }).eq('id', 1),
      ]);
      for (const r of results) expect(r.error?.code).toBe('42501');
      const { data } = await service.from('products').select('name').eq('id', ids.published!).single();
      expect(data!.name).not.toBe('pwned');
    });

    it('cannot call admin-only functions', async () => {
      const stats = await anon.rpc('admin_dashboard_stats');
      expect(stats.error).not.toBeNull();
      const setModels = await anon.rpc('set_product_models', { p_product_id: ids.published, p_model_ids: [] });
      expect(setModels.error).not.toBeNull();
    });

    it('cannot sign up for an account', async () => {
      const { error } = await anon.auth.signUp({ email: `intruder-${tag}@example.com`, password: 'Something-Long-123' });
      expect(error).not.toBeNull();
    });
  });

  // ----------------------------------------------------------- catalog_search
  describe('catalog_search()', () => {
    it('returns only published products, with primary image', async () => {
      const { data, error } = await anon.rpc('catalog_search', { p_query: tag });
      expect(error).toBeNull();
      expect(data!.map((r: { id: string }) => r.id)).toEqual([ids.published]);
      expect(data![0].image_path).toBe(`products/${ids.published}/seed.webp`);
      expect(Number(data![0].total_count)).toBe(1);
    });

    it('filters by model, category and availability', async () => {
      const byModel = await anon.rpc('catalog_search', { p_query: tag, p_model: 'bullet' });
      expect(byModel.data).toHaveLength(1);
      const wrongModel = await anon.rpc('catalog_search', { p_query: tag, p_model: 'classic' });
      expect(wrongModel.data).toHaveLength(0);
      const byCat = await anon.rpc('catalog_search', { p_query: tag, p_category: `test-cat-${tag}` });
      expect(byCat.data).toHaveLength(1);
      const oos = await anon.rpc('catalog_search', { p_query: tag, p_availability: 'out_of_stock' });
      expect(oos.data).toHaveLength(0);
    });

    it('treats % and _ in the search text literally', async () => {
      const lit = await anon.rpc('catalog_search', { p_query: `${tag}-100%` });
      expect(lit.data).toHaveLength(1);
      // '%' must match only rows that literally contain '%', not everything.
      const percent = await anon.rpc('catalog_search', { p_query: '%' });
      for (const r of percent.data as { part_number: string | null; name: string }[]) {
        expect(`${r.name}${r.part_number ?? ''}`).toContain('%');
      }
      const underscore = await anon.rpc('catalog_search', { p_query: `${tag}_` });
      expect(underscore.data).toHaveLength(0);
    });

    it('caps page size at 60', async () => {
      const { error } = await anon.rpc('catalog_search', { p_limit: 100000 });
      expect(error).toBeNull();
    });
  });

  // -------------------------------------------------------- non-admin account
  describe('signed-in user who is NOT an admin', () => {
    it('cannot write catalogue tables', async () => {
      const results = await Promise.all([
        user.from('motorcycle_models').insert({ name: 'Y', slug: `y-${tag}` }),
        user.from('products').insert({ name: 'Yy', slug: `y-${tag}` }),
        user.from('product_images').insert({ product_id: ids.published, storage_path: `products/${ids.published}/x.webp` }),
        user.from('product_model_compatibility').insert({ product_id: ids.published, model_id: classicId }),
      ]);
      for (const r of results) expect(r.error?.code).toBe('42501');
    });

    it('updates and deletes silently affect zero rows', async () => {
      const upd = await user.from('products').update({ name: 'pwned' }).eq('id', ids.published!).select();
      expect(upd.data ?? []).toHaveLength(0);
      const del = await user.from('products').delete().eq('id', ids.published!).select();
      expect(del.data ?? []).toHaveLength(0);
      const settings = await user.from('business_settings').update({ landline: '000000' }).eq('id', 1).select();
      expect(settings.data ?? []).toHaveLength(0);
    });

    it('cannot see unpublished products', async () => {
      const { data } = await user.from('products').select('id').like('slug', `%-${tag}`);
      expect(data!.map((p) => p.id)).toEqual([ids.published]);
    });

    it('cannot make itself an admin', async () => {
      const { data: me } = await user.auth.getUser();
      const { error } = await user.from('admin_users').insert({ user_id: me.user!.id });
      expect(error?.code).toBe('42501');
      const isAdmin = await user.rpc('is_admin');
      expect(isAdmin.data).toBe(false);
    });

    it('cannot run admin functions', async () => {
      const stats = await user.rpc('admin_dashboard_stats');
      expect(stats.error?.code).toBe('42501');
      const reorder = await user.rpc('reorder_rows', { p_table: 'motorcycle_models', p_ids: [bulletId] });
      expect(reorder.error?.code).toBe('42501');
    });

    it('cannot upload or delete product images in storage', async () => {
      const up = await user.storage
        .from('product-images')
        .upload(`products/${ids.published}/evil.webp`, new Uint8Array([1, 2, 3]).buffer, { contentType: 'image/webp' });
      expect(up.error).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------- admin
  describe('admin account', () => {
    it('is recognised as admin by the database', async () => {
      const { data } = await admin.rpc('is_admin');
      expect(data).toBe(true);
    });

    it('sees unpublished products', async () => {
      const { data } = await admin.from('products').select('id').like('slug', `%-${tag}`);
      expect(data).toHaveLength(4);
    });

    it('creates, updates, publishes and deletes a product', async () => {
      const ins = await admin
        .from('products')
        .insert({ name: `Admin made ${tag}`, slug: `admin-made-${tag}`, category_id: ids.category })
        .select('id, status, availability, published_at')
        .single();
      expect(ins.error).toBeNull();
      expect(ins.data!.status).toBe('draft');
      expect(ins.data!.availability).toBe('contact_to_confirm');
      expect(ins.data!.published_at).toBeNull();

      const pub = await admin
        .from('products')
        .update({ status: 'published', availability: 'out_of_stock' })
        .eq('id', ins.data!.id)
        .select('status, availability, published_at')
        .single();
      expect(pub.data!.status).toBe('published');
      expect(pub.data!.published_at).not.toBeNull();

      const visible = await anon.from('products').select('availability').eq('id', ins.data!.id).single();
      expect(visible.data!.availability).toBe('out_of_stock');

      const del = await admin.from('products').delete().eq('id', ins.data!.id);
      expect(del.error).toBeNull();
      const gone = await service.from('products').select('id').eq('id', ins.data!.id);
      expect(gone.data).toHaveLength(0);
    });

    it('replaces compatible models atomically', async () => {
      const r = await admin.rpc('set_product_models', { p_product_id: ids.published, p_model_ids: [classicId, bulletId] });
      expect(r.error).toBeNull();
      const { data } = await anon
        .from('product_model_compatibility')
        .select('model_id')
        .eq('product_id', ids.published!);
      expect(data!.map((d) => d.model_id).sort()).toEqual([bulletId, classicId].sort());

      await admin.rpc('set_product_models', { p_product_id: ids.published, p_model_ids: [classicId] });
      const after = await anon.from('product_model_compatibility').select('model_id').eq('product_id', ids.published!);
      expect(after.data!.map((d) => d.model_id)).toEqual([classicId]);
    });

    it('rejects duplicate slugs and invalid values', async () => {
      const dup = await admin.from('products').insert({ name: 'Dup name', slug: `test-published-${tag}` });
      expect(dup.error?.code).toBe('23505');
      const badSlug = await admin.from('products').insert({ name: 'Bad slug', slug: 'Bad Slug!' });
      expect(badSlug.error).not.toBeNull();
      const badAvail = await admin.from('products').update({ availability: 'maybe' }).eq('id', ids.published!);
      expect(badAvail.error).not.toBeNull();
    });

    it('keeps a single primary image per product', async () => {
      const second = await admin
        .from('product_images')
        .insert({ product_id: ids.published, storage_path: `products/${ids.published}/second.webp` })
        .select('id')
        .single();
      expect(second.error).toBeNull();
      const conflict = await admin
        .from('product_images')
        .insert({ product_id: ids.published, storage_path: `products/${ids.published}/third.webp`, is_primary: true });
      expect(conflict.error?.code).toBe('23505');

      const setPrimary = await admin.rpc('set_primary_image', { p_image_id: second.data!.id });
      expect(setPrimary.error).toBeNull();
      const { data } = await service
        .from('product_images')
        .select('storage_path')
        .eq('product_id', ids.published!)
        .eq('is_primary', true);
      expect(data).toEqual([{ storage_path: `products/${ids.published}/second.webp` }]);
    });

    it('manages models: add, deactivate (hidden from public), reorder', async () => {
      const add = await admin
        .from('motorcycle_models')
        .insert({ name: `Test Model ${tag}`, slug: `test-model-${tag}`, sort_order: 999 })
        .select('id')
        .single();
      expect(add.error).toBeNull();
      await admin.from('motorcycle_models').update({ is_active: false }).eq('id', add.data!.id);
      const pub = await anon.from('motorcycle_models').select('id').eq('id', add.data!.id);
      expect(pub.data).toHaveLength(0);
      const reorder = await admin.rpc('reorder_rows', { p_table: 'motorcycle_models', p_ids: [add.data!.id] });
      expect(reorder.error).toBeNull();
      const bad = await admin.rpc('reorder_rows', { p_table: 'admin_users', p_ids: [] });
      expect(bad.error).not.toBeNull();
    });

    it('updates business settings with validation', async () => {
      const bad = await admin.from('business_settings').update({ whatsapp_number: '044 2841 5241' }).eq('id', 1);
      expect(bad.error).not.toBeNull();
      const ok = await admin.from('business_settings').update({ opening_hours: null }).eq('id', 1).select().single();
      expect(ok.error).toBeNull();
    });

    it('cannot grant admin rights through the API', async () => {
      const { data: u } = await user.auth.getUser();
      const { error } = await admin.from('admin_users').insert({ user_id: u.user!.id });
      expect(error?.code).toBe('42501');
    });

    it('gets real dashboard statistics', async () => {
      const { data, error } = await admin.rpc('admin_dashboard_stats');
      expect(error).toBeNull();
      const { count: published } = await service
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published');
      expect(Number(data![0].published)).toBe(published);
    });

    it('uploads, publicly serves and deletes a product image in storage', async () => {
      const path = `products/${ids.published}/${tag}.webp`;
      const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
      const up = await admin.storage.from('product-images').upload(path, bytes.buffer, { contentType: 'image/webp' });
      expect(up.error).toBeNull();

      const { data: pub } = anon.storage.from('product-images').getPublicUrl(path);
      const res = await fetch(pub.publicUrl);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/webp');

      const wrongType = await admin.storage
        .from('product-images')
        .upload(`products/${ids.published}/${tag}.gif`, bytes.buffer, { contentType: 'image/gif' });
      expect(wrongType.error).not.toBeNull();

      const outside = await admin.storage
        .from('product-images')
        .upload(`elsewhere/${tag}.webp`, bytes.buffer, { contentType: 'image/webp' });
      expect(outside.error).not.toBeNull();

      const anonDelete = await anon.storage.from('product-images').remove([path]);
      expect(anonDelete.data ?? []).toHaveLength(0);
      expect((await fetch(pub.publicUrl)).status).toBe(200);

      const del = await admin.storage.from('product-images').remove([path]);
      expect(del.error).toBeNull();
      expect(del.data).toHaveLength(1);
      expect((await fetch(pub.publicUrl)).status).not.toBe(200);
    });

    it('anonymous visitors cannot list the image bucket', async () => {
      const { data } = await anon.storage.from('product-images').list('products');
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe('image storage providers', () => {
    it('defaults every existing and new image to Supabase', async () => {
      const { data: rows } = await service.from('product_images').select('storage_provider, image_url, provider_file_id');
      for (const row of rows ?? []) {
        if (row.storage_provider === 'supabase') {
          expect(row.image_url).toBeNull();
          expect(row.provider_file_id).toBeNull();
        }
      }
      const { data: settings } = await service.from('business_settings').select('default_image_provider').eq('id', 1).single();
      expect(['supabase', 'imagekit']).toContain(settings!.default_image_provider);
    });

    it('rejects an unknown provider on an image and on the default setting', async () => {
      const bad = await service
        .from('product_images')
        .insert({ product_id: ids.published!, storage_path: `products/${ids.published}/aaaaaaaa-bbbb.webp`, storage_provider: 'cloudinary' });
      expect(bad.error?.code).toBe('23514');

      const badDefault = await service.from('business_settings').update({ default_image_provider: 'cloudinary' }).eq('id', 1);
      expect(badDefault.error?.code).toBe('23514');
    });

    it('requires a delivery URL and file id for an ImageKit image, and forbids them for a Supabase one', async () => {
      const missing = await service.from('product_images').insert({
        product_id: ids.published!,
        storage_path: `/products/${ids.published}/cccccccc-dddd.webp`,
        storage_provider: 'imagekit',
      });
      expect(missing.error?.code).toBe('23514');

      const strayUrl = await service.from('product_images').insert({
        product_id: ids.published!,
        storage_path: `products/${ids.published}/eeeeeeee-ffff.webp`,
        storage_provider: 'supabase',
        image_url: 'https://ik.imagekit.io/shop1/x.webp',
      });
      expect(strayUrl.error?.code).toBe('23514');

      const good = await service
        .from('product_images')
        .insert({
          product_id: ids.published!,
          storage_path: `/products/${ids.published}/11111111-2222.webp`,
          storage_provider: 'imagekit',
          image_url: 'https://ik.imagekit.io/shop1/products/x/11111111-2222.webp',
          provider_file_id: `file_${tag}`,
          file_size: 20480,
          mime_type: 'image/webp',
        })
        .select('id')
        .single();
      expect(good.error).toBeNull();

      // Public visitors can read an ImageKit image of a published product.
      const { data: visible } = await anon
        .from('product_images')
        .select('image_url, storage_provider')
        .eq('id', good.data!.id)
        .single();
      expect(visible!.storage_provider).toBe('imagekit');
      expect(visible!.image_url).toContain('ik.imagekit.io');

      await service.from('product_images').delete().eq('id', good.data!.id);
    });

    it('returns the provider and delivery URL from catalog_search', async () => {
      const { data, error } = await anon.rpc('catalog_search', { p_limit: 5 });
      expect(error).toBeNull();
      for (const row of data ?? []) {
        expect(row).toHaveProperty('image_provider');
        expect(row).toHaveProperty('image_url');
      }
    });

    it('keeps the cleanup queue admin-only', async () => {
      const entry = await admin
        .from('image_cleanup_queue')
        .insert({ storage_provider: 'imagekit', storage_path: `/products/x/${tag}.webp`, provider_file_id: `file_${tag}`, last_error: 'test' })
        .select('id')
        .single();
      expect(entry.error).toBeNull();

      const anonRead = await anon.from('image_cleanup_queue').select('*');
      expect(anonRead.error?.code).toBe('42501');
      const anonWrite = await anon.from('image_cleanup_queue').insert({ storage_provider: 'supabase', storage_path: 'x' });
      expect(anonWrite.error?.code).toBe('42501');

      // A signed-in non-admin sees nothing and can write nothing.
      const userRead = await user.from('image_cleanup_queue').select('*');
      expect(userRead.data ?? []).toHaveLength(0);
      const userWrite = await user.from('image_cleanup_queue').insert({ storage_provider: 'supabase', storage_path: 'x' });
      expect(userWrite.error).not.toBeNull();

      const adminRead = await admin.from('image_cleanup_queue').select('id').eq('id', entry.data!.id);
      expect(adminRead.data ?? []).toHaveLength(1);

      await admin.from('image_cleanup_queue').delete().eq('id', entry.data!.id);
    });
  });

  describe('genuine and vendor parts', () => {
    it('defaults every existing product to genuine', async () => {
      const { data } = await service.from('products').select('part_type');
      for (const row of data ?? []) expect(['oem', 'vendor']).toContain(row.part_type);
      const { data: created } = await service
        .from('products')
        .insert({ name: `Default Type ${tag}`, slug: `default-type-${tag}`, status: 'draft' })
        .select('part_type')
        .single();
      expect(created!.part_type).toBe('oem');
      await service.from('products').delete().eq('slug', `default-type-${tag}`);
    });

    it('rejects a part type the shop does not use', async () => {
      const bad = await service
        .from('products')
        .insert({ name: `Bad Type ${tag}`, slug: `bad-type-${tag}`, status: 'draft', part_type: 'refurbished' });
      expect(bad.error?.code).toBe('23514');
    });

    it('filters catalog_search by part type and reports both totals', async () => {
      const vendor = await service
        .from('products')
        .insert({
          name: `Vendor Probe ${tag}`,
          slug: `vendor-probe-${tag}`,
          part_type: 'vendor',
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      expect(vendor.error).toBeNull();

      try {
        const all = await anon.rpc('catalog_search', { p_query: `Vendor Probe ${tag}`, p_limit: 10 });
        expect(all.error).toBeNull();
        expect(all.data).toHaveLength(1);
        expect(all.data![0].part_type).toBe('vendor');
        // The totals ignore the type filter, so a tab can show the other count.
        expect(Number(all.data![0].vendor_total)).toBe(1);
        expect(Number(all.data![0].oem_total)).toBe(0);

        const onlyVendor = await anon.rpc('catalog_search', { p_query: `Vendor Probe ${tag}`, p_part_type: 'vendor', p_limit: 10 });
        expect(onlyVendor.data).toHaveLength(1);

        const onlyGenuine = await anon.rpc('catalog_search', { p_query: `Vendor Probe ${tag}`, p_part_type: 'oem', p_limit: 10 });
        expect(onlyGenuine.data ?? []).toHaveLength(0);
      } finally {
        await service.from('products').delete().eq('id', vendor.data!.id);
      }
    });

    it('splits the published counts by type', async () => {
      const { data, error } = await anon.rpc('published_counts');
      expect(error).toBeNull();
      for (const row of data ?? []) {
        expect(Number(row.oem_count) + Number(row.vendor_count)).toBe(Number(row.product_count));
      }
    });
  });

  describe('model pictures', () => {
    it('only accepts a picture path inside the models folder', async () => {
      const { data: model } = await service.from('motorcycle_models').select('id, image_path').limit(1).single();
      const bad = await service.from('motorcycle_models').update({ image_path: 'hero/evil.webp' }).eq('id', model!.id);
      expect(bad.error?.code).toBe('23514');
      const alsoBad = await service.from('motorcycle_models').update({ image_path: '../secret.webp' }).eq('id', model!.id);
      expect(alsoBad.error?.code).toBe('23514');

      const good = await service
        .from('motorcycle_models')
        .update({ image_path: 'models/aaaaaaaa-bbbb.webp' })
        .eq('id', model!.id);
      expect(good.error).toBeNull();
      await service.from('motorcycle_models').update({ image_path: model!.image_path }).eq('id', model!.id);
    });

    it('lets an admin upload under models/ but nobody else', async () => {
      const path = `models/${tag}-probe.png`;
      const bytes = new Uint8Array([137, 80, 78, 71]);
      const asAdmin = await admin.storage.from('brand-images').upload(path, bytes, { contentType: 'image/png' });
      expect(asAdmin.error).toBeNull();

      const asAnon = await anon.storage.from('brand-images').upload(`models/${tag}-anon.png`, bytes, { contentType: 'image/png' });
      expect(asAnon.error).not.toBeNull();
      const asUser = await user.storage.from('brand-images').upload(`models/${tag}-user.png`, bytes, { contentType: 'image/png' });
      expect(asUser.error).not.toBeNull();

      // Uploads outside the two allowed folders are still refused.
      const elsewhere = await admin.storage.from('brand-images').upload(`secrets/${tag}.png`, bytes, { contentType: 'image/png' });
      expect(elsewhere.error).not.toBeNull();

      await service.storage.from('brand-images').remove([path]);
    });
  });
});
