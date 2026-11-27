// Prints env vars for the LOCAL test stack: anon + service-role JWTs signed
// with this machine's randomly generated local secret. Test use only.
import crypto from 'node:crypto';

const secret = process.argv[2];
if (!secret) throw new Error('usage: node keys.mjs <jwt-secret>');

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
function sign(payload) {
  const head = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 365;

console.log(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`);
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${sign({ iss: 'supabase-local', role: 'anon', iat: now, exp })}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${sign({ iss: 'supabase-local', role: 'service_role', iat: now, exp })}`);
console.log(`LOCAL_DATABASE_URL=postgres://postgres@127.0.0.1:5432/${process.env.LOCAL_DB_NAME ?? 'sameer_local'}`);
