import postgres from '@prisma/orm-postgres/runtime';

import type { Contract } from './generated/contract';
import contractJson from './generated/contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env.DATABASE_URL,
});

export async function connectDatabase() {
  await db.connect();
}
