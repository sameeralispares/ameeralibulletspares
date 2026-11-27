import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache';
import doShardedTagCache from '@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache';
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue';

// Cache layer for 'use cache' (catalogue data, OG image) and updateTag() /
// revalidateTag(). Without these, Next.js has no cache handler on Workers and
// caching silently does nothing.
//   - Workers KV namespace (binding NEXT_INC_CACHE_KV): stores cached pages and
//     data. Free plan: 1,000 writes/day, so keep admin edits modest.
//   - Durable Object (SQLite): tag revalidation, so admin edits show at once.
//   - Durable Object queue: time-based revalidation.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: doShardedTagCache,
  queue: doQueue,
});
