import { createClient } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';

export const ADMIN = { email: process.env.TEST_ADMIN_EMAIL ?? 'owner@local.test', password: process.env.TEST_ADMIN_PASSWORD ?? 'Local-Test-Owner-Pass-1' };
export const STAFF = { email: process.env.TEST_USER_EMAIL ?? 'staff@local.test', password: process.env.TEST_USER_PASSWORD ?? 'Local-Test-User-Pass-1' };

/** Service-role client for test setup/teardown only (never used by the app). */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('E2E tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function resetSettings() {
  const db = serviceClient();
  const { error } = await db
    .from('business_settings')
    .update({
      business_name: 'S Ameer Ali Bullet Spare Parts',
      address: '25, Venkatachalan Naicken Street, Pudupet, Chennai-02',
      landline: '+91 96770 93315',
      whatsapp_number: '919677093315',
      opening_hours: null,
      google_maps_url: null,
      email: null,
      facebook_url: null,
      instagram_url: null,
      youtube_url: null,
      about_intro: null,
      about_history: null,
      festive_active: false,
      festive_label: null,
      festive_discount_type: 'percent',
      festive_discount_value: 0,
      hero_image_path: null,
      default_image_provider: 'supabase',
    })
    .eq('id', 1);
  if (error) throw error;
  await refreshSite();
}

export async function login(page: Page, who = ADMIN) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function loginAsAdmin(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
}

/** Wait until a public URL reflects a change (cache revalidation is async). */
export async function expectEventually(fn: () => Promise<boolean>, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('condition not met in time');
}

/** After service-role changes (which bypass the admin's cache refresh), refresh the site. */
export async function refreshSite() {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return;
  await fetch(`${base}/api/revalidate`, { method: 'POST', headers: { 'x-revalidate-secret': secret } });
}
