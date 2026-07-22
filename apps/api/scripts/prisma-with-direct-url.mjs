/**
 * Prefer Neon direct (non-pooled) URL for migrate/seed on Vercel.
 */
import { spawnSync } from 'node:child_process';

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!url || !/^postgres(ql)?:\/\//i.test(url)) {
  console.error(
    'No valid Postgres URL found (DATABASE_URL / DATABASE_URL_UNPOOLED).',
  );
  process.exit(1);
}

process.env.DATABASE_URL = url;

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/prisma-with-direct-url.mjs <prisma args...>');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', ...args], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
