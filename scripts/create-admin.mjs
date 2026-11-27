#!/usr/bin/env node
// Create (or promote) the shop owner's admin account.
//
// Run by the DEVELOPER from a trusted machine — never from the website.
// Needs the Supabase service-role key, which must never be shipped to browsers.
//
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/create-admin.mjs owner@example.com
//
// You will be prompted for a password (input hidden). Alternatively pass
// ADMIN_PASSWORD in the environment for automation (e.g. local tests).
// If the e-mail already exists, the account is just granted admin rights.

import { createClient } from '@supabase/supabase-js';
import readline from 'node:readline';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] ?? '').trim().toLowerCase();
const role = process.argv[3] === 'editor' ? 'editor' : 'owner';

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: node scripts/create-admin.mjs <email> [owner|editor]');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(target) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUserByEmail(email);

if (!user) {
  const password = process.env.ADMIN_PASSWORD ?? (await askHidden('New password (min 12 characters): '));
  if (!password || password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error('Could not create user:', error.message);
    process.exit(1);
  }
  user = data.user;
  console.log(`Created auth user ${email}`);
} else {
  console.log(`Auth user ${email} already exists — granting admin rights only.`);
}

const { error: grantError } = await supabase
  .from('admin_users')
  .upsert({ user_id: user.id, role }, { onConflict: 'user_id' });

if (grantError) {
  console.error('Could not grant admin rights:', grantError.message);
  process.exit(1);
}

console.log(`✓ ${email} is now an admin (${role}). They can sign in at /admin/login`);
