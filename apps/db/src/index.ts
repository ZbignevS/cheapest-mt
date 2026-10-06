export {
  connectDatabase,
  db,
  disconnectDatabase,
  type Contract,
  type Db,
} from './prisma/db';

/**
 * Postgres codec types (`Char`, `Numeric`, `Timestamptz`, ...). Columns such as
 * `Offer.productId` are branded strings rather than plain `string`, and
 * `apps/api` cannot import `@prisma/orm-postgres` directly because it is
 * installed under `apps/db`. Re-exporting keeps the contract's column types
 * reachable through this package's public surface.
 */
export type * from '@prisma/orm-postgres/target/codec-types';
