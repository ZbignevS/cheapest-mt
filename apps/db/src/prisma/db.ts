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

/**
 * Opens the pool once per process. Repeat calls share the same promise, and a
 * failure clears it so a later caller can retry.
 *
 * `url` overrides `DATABASE_URL`, which is how a Prisma Composer deployment
 * hands its bound connection string to this client.
 */
export function connectDatabase(url?: string): Promise<void> {
  connecting ??= (url ? db.connect({ url }) : db.connect())
    .then(() => undefined)
    .catch((error: unknown) => {
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
