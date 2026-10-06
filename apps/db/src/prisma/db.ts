import 'temporal-polyfill/global';

import postgres from '@prisma/orm-postgres/runtime';

import type { Contract } from './generated/contract';
import contractJson from './generated/contract.json' with { type: 'json' };

/**
 * Process-wide Postgres client.
 *
 * `postgres()` is lazy: the static query surfaces (`db.orm`, `db.sql`) are
 * available immediately and the pg pool is only created on the first query or
 * on an explicit `connect()`. That is why this module is safe to import before
 * the environment is loaded.
 */
export const db = postgres<Contract>({
  contractJson,
  url: process.env.DATABASE_URL,
});

export type Db = typeof db;
export type { Contract };

let connecting: Promise<void> | undefined;

async function openConnection(url?: string): Promise<void> {
  const runtime = url ? await db.connect({ url }) : await db.connect();

  // `connect()` only binds the pool; pg dials lazily on the first query. Force
  // one round trip so an unreachable server or a bad credential fails during
  // startup rather than on the first request that happens to need the database.
  await runtime.execute(db.raw.sql`SELECT 1`.affectedCount().build());
}

/**
 * Opens the pool once per process and proves the database is reachable. Repeat
 * calls share the same promise, and a failure clears it so a later caller can
 * retry.
 *
 * `url` overrides `DATABASE_URL`, which is how the API passes the value its
 * `ConfigModule` resolved, and how a Prisma Composer deployment hands over its
 * bound connection string.
 */
export function connectDatabase(url?: string): Promise<void> {
  connecting ??= openConnection(url).catch((error: unknown) => {
    connecting = undefined;
    throw error;
  });

  return connecting;
}

/** Closes the pool. Required for scripts, and for a clean server shutdown. */
export async function disconnectDatabase(): Promise<void> {
  connecting = undefined;
  await db.close();
}
