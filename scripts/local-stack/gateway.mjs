// Local Supabase-compatible API gateway (TEST USE ONLY — never deploy).
//
//   /auth/v1/*     -> Supabase Auth (GoTrue) binary on :9999
//   /rest/v1/*     -> PostgREST binary on :3001
//   /storage/v1/*  -> minimal Storage emulator (below)
//   SMTP sink      -> :2500, writes emails to $LOCAL_STACK_DIR/mail
//
// The storage emulator authorises every write by inserting/deleting rows in
// storage.objects AS THE CALLER'S DATABASE ROLE with the caller's JWT claims,
// exactly like hosted Supabase Storage. That means the storage RLS policies in
// supabase/migrations are genuinely exercised by local tests.

import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const JWT_SECRET = process.env.LOCAL_JWT_SECRET;
const STACK_DIR = process.env.LOCAL_STACK_DIR ?? '/opt/localstack';
const DATA_DIR = path.join(STACK_DIR, 'storage-data');
const MAIL_DIR = path.join(STACK_DIR, 'mail');
const TEMPLATES_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'templates');
if (!JWT_SECRET) throw new Error('LOCAL_JWT_SECRET is required');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MAIL_DIR, { recursive: true });

const pool = new pg.Pool({
  connectionString:
    process.env.STORAGE_DB_URL ??
    'postgres://supabase_storage_admin:local-storage-admin@127.0.0.1:5432/postgres',
  max: 5,
});

const UPSTREAMS = {
  '/auth/v1': { host: '127.0.0.1', port: 9999 },
  '/rest/v1': { host: '127.0.0.1', port: 3001 },
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, apikey, content-type, x-client-info, x-upsert, cache-control, prefer, range, accept-profile, content-profile, x-supabase-api-version',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Expose-Headers', 'content-range, x-total-count');
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const given = b64urlDecode(parts[2]);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const claims = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return claims;
}

function claimsFrom(req) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers.apikey;
  if (!token) return null;
  return verifyJwt(String(token));
}

async function asRole(claims, fn) {
  const role = ['anon', 'authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon';
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [claims.sub ?? '']);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeObjectPath(bucket, name) {
  const full = path.resolve(DATA_DIR, bucket, name);
  if (!full.startsWith(path.resolve(DATA_DIR, bucket) + path.sep)) throw new Error('bad path');
  return full;
}

async function handleStorage(req, res, rest) {
  // Public file read: GET /object/public/<bucket>/<path>
  let m = rest.match(/^\/object\/public\/([^/]+)\/(.+)$/);
  if (m && (req.method === 'GET' || req.method === 'HEAD')) {
    const [, bucket, rawName] = m;
    const name = decodeURIComponent(rawName.split('?')[0]);
    const { rows } = await pool.query('select public from storage.buckets where id = $1', [bucket]);
    if (!rows[0]?.public) return json(res, 400, { statusCode: '404', error: 'Bucket not found' });
    const obj = await pool.query(
      'select metadata from storage.objects where bucket_id = $1 and name = $2',
      [bucket, name],
    );
    const file = safeObjectPath(bucket, name);
    if (!obj.rows[0] || !fs.existsSync(file)) {
      return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    }
    cors(res);
    res.writeHead(200, {
      'content-type': obj.rows[0].metadata?.mimetype ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file).pipe(res);
  }

  const claims = claimsFrom(req);
  if (!claims) return json(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'Invalid JWT' });

  // List: POST /object/list/<bucket>  body {prefix, limit, offset}
  m = rest.match(/^\/object\/list\/([^/]+)\/?$/);
  if (m && req.method === 'POST') {
    const [, bucket] = m;
    const { prefix = '', limit = 100, offset = 0 } = JSON.parse((await readBody(req, 65536)).toString('utf8') || '{}');
    const rows = await asRole(claims, async (c) => {
      const r = await c.query(
        `select name, id, metadata, created_at, updated_at from storage.objects
         where bucket_id = $1 and name like $2 order by name limit $3 offset $4`,
        [bucket, `${String(prefix).replace(/\/?$/, '/')}%`, Number(limit), Number(offset)],
      );
      return r.rows;
    });
    return json(res, 200, rows);
  }

  // Upload: POST|PUT /object/<bucket>/<path>
  m = rest.match(/^\/object\/([^/]+)\/(.+)$/);
  if (m && (req.method === 'POST' || req.method === 'PUT')) {
    const [, bucket, rawName] = m;
    const name = decodeURIComponent(rawName);
    const contentType = String(req.headers['content-type'] ?? '');
    if (contentType.startsWith('multipart/')) {
      return json(res, 400, { statusCode: '400', error: 'unsupported', message: 'Local emulator accepts raw bodies only' });
    }
    const b = await pool.query('select * from storage.buckets where id = $1', [bucket]);
    const bucketRow = b.rows[0];
    if (!bucketRow) return json(res, 400, { statusCode: '404', error: 'Bucket not found' });
    const limit = Number(bucketRow.file_size_limit ?? 50 * 1024 * 1024);
    let body;
    try {
      body = await readBody(req, limit);
    } catch {
      return json(res, 400, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
    }
    if (bucketRow.allowed_mime_types?.length && !bucketRow.allowed_mime_types.includes(contentType)) {
      return json(res, 400, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${contentType} is not supported` });
    }
    const upsert = req.method === 'PUT' || req.headers['x-upsert'] === 'true';
    const metadata = { mimetype: contentType, size: body.length };
    try {
      const row = await asRole(claims, async (c) => {
        const sql = upsert
          ? `insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1,$2,$3::uuid,$3::text,$4)
             on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now()
             returning id`
          : `insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1,$2,$3::uuid,$3::text,$4) returning id`;
        const r = await c.query(sql, [bucket, name, claims.sub ?? null, metadata]);
        return r.rows[0];
      });
      const file = safeObjectPath(bucket, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
      return json(res, 200, { Id: row.id, Key: `${bucket}/${name}` });
    } catch (err) {
      if (err.code === '42501') {
        return json(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
      }
      if (err.code === '23505') {
        return json(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
      }
      throw err;
    }
  }

  // Delete many: DELETE /object/<bucket>  body {prefixes: [...]}
  m = rest.match(/^\/object\/([^/]+)\/?$/);
  if (m && req.method === 'DELETE') {
    const [, bucket] = m;
    const { prefixes = [] } = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8') || '{}');
    const deleted = await asRole(claims, async (c) => {
      const r = await c.query(
        'delete from storage.objects where bucket_id = $1 and name = any($2) returning name, id, metadata',
        [bucket, prefixes],
      );
      return r.rows;
    });
    for (const d of deleted) {
      try {
        fs.unlinkSync(safeObjectPath(bucket, d.name));
      } catch {}
    }
    return json(res, 200, deleted.map((d) => ({ name: d.name, id: d.id, bucket_id: bucket, metadata: d.metadata })));
  }

  return json(res, 404, { statusCode: '404', error: 'not_implemented', message: `Local emulator: ${req.method} ${rest}` });
}

function proxy(req, res, upstream, rest) {
  const headers = { ...req.headers, host: `${upstream.host}:${upstream.port}` };
  // Kong in hosted Supabase turns the apikey header into Authorization if absent.
  if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
  const preq = http.request(
    { host: upstream.host, port: upstream.port, method: req.method, path: rest || '/', headers },
    (pres) => {
      cors(res);
      const h = { ...pres.headers };
      delete h['access-control-allow-origin'];
      res.writeHead(pres.statusCode ?? 502, h);
      pres.pipe(res);
    },
  );
  preq.on('error', (e) => json(res, 502, { error: 'upstream_unavailable', message: e.message }));
  req.pipe(preq);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      cors(res);
      res.writeHead(204);
      return res.end();
    }
    const url = req.url ?? '/';
    for (const [prefix, upstream] of Object.entries(UPSTREAMS)) {
      if (url === prefix || url.startsWith(prefix + '/') || url.startsWith(prefix + '?')) {
        return proxy(req, res, upstream, url.slice(prefix.length));
      }
    }
    if (url.startsWith('/storage/v1/')) {
      return await handleStorage(req, res, url.slice('/storage/v1'.length));
    }
    // Email templates for GoTrue, which fetches them over HTTP (not file://).
    // Only serves .html files from this folder, by basename, so the path can
    // not escape it.
    if (url.startsWith('/local-templates/')) {
      const name = path.basename(url.split('?')[0].slice('/local-templates/'.length));
      if (!name.endsWith('.html')) return json(res, 404, { error: 'not_found' });
      try {
        const body = await fs.promises.readFile(path.join(TEMPLATES_DIR, name), 'utf8');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(body);
      } catch {
        return json(res, 404, { error: 'not_found' });
      }
    }
    if (url === '/health') return json(res, 200, { ok: true });
    return json(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { statusCode: '500', error: 'internal', message: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`gateway listening on :${PORT}`));

// ---------------------------------------------------------------------------
// Minimal SMTP sink so password-recovery emails can be tested locally.
// ---------------------------------------------------------------------------
net
  .createServer((sock) => {
    let data = '';
    let inData = false;
    let buf = '';
    const send = (l) => sock.write(l + '\r\n');
    send('220 local-smtp ready');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            const file = path.join(MAIL_DIR, `${Date.now()}-${crypto.randomUUID()}.eml`);
            fs.writeFileSync(file, data);
            data = '';
            send('250 OK queued');
          } else {
            data += (line.startsWith('..') ? line.slice(1) : line) + '\n';
          }
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') send('250 local-smtp');
        else if (cmd === 'DATA') {
          inData = true;
          send('354 End data with <CR><LF>.<CR><LF>');
        } else if (cmd === 'QUIT') {
          send('221 Bye');
          sock.end();
        } else send('250 OK');
      }
    });
  })
  .listen(2500, '127.0.0.1', () => console.log('smtp sink listening on :2500'));
