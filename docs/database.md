# Database

How the database layer in this repo is wired, and how to work with it.

This describes Prisma ORM 8 with the TypeScript **contract-builder**. There is no
`schema.prisma` and no `@prisma/client` anywhere in this project.

---

## 1. Architecture

```text
NestJS API            apps/api
    ↓
PrismaService         apps/api/src/prisma/prisma.service.ts
    ↓
@cheapest-mt/db       apps/db/src/index.ts
    ↓
Prisma 8 client       apps/db/src/prisma/db.ts  (@prisma/orm-postgres)
    ↓
PostgreSQL
```

**`apps/db` owns every database concern.** The data contract, the generated
contract artefacts, the migration history, the Prisma CLI configuration, the
Prisma dependencies, and the single client instance all live here. It is a
library: it exports a client and connection helpers, and nothing else.

**`apps/api` owns HTTP and application wiring.** It never imports
`@prisma/orm-postgres`, never builds its own client, and never reads the
contract artefacts. Its only database dependency is `@cheapest-mt/db`, consumed
through `PrismaService`.

`apps/db` also contains a small standalone entry point (`src/main.ts`,
`src/app.module.ts`, `src/app.controller.ts`) used by the Prisma Composer deploy
target. That is separate from the library surface and is not what `apps/api`
imports.

---

## 2. Prisma 8 setup

### Where things live

| Path | What it is |
|---|---|
| `apps/db/src/prisma/contract.ts` | The data contract. **This is the file you edit.** |
| `apps/db/src/prisma/generated/contract.json` | Generated runtime artefact. Loaded by the client. |
| `apps/db/src/prisma/generated/contract.d.ts` | Generated `Contract` type. Types every query. |
| `apps/db/prisma.config.ts` | Prisma CLI config: contract path, output dir, connection. |
| `apps/db/migrations/` | On-disk migration history. |

Generated files are produced by the CLI. Never hand-edit them.

### Why contract-builder instead of `schema.prisma`

The contract is TypeScript, so the model is checked by the compiler as you write
it, and `prisma contract emit` derives the `Contract` type directly from it. That
type is what gives `db.orm.public.Product.select('name')` real autocomplete and
real errors for a wrong column. A `.prisma` file cannot participate in that, and
mixing the two approaches would mean two sources of truth for the same tables.

### Core commands

Run these from `apps/db`, with `DATABASE_URL` exported. See section 5.

```bash
npx prisma contract emit   # contract.ts -> contract.json + contract.d.ts
npx prisma db update       # push the contract to the live database
npx prisma db verify       # check the database marker and schema match the contract
```

`db verify` is the one to reach for when something looks wrong. It reports
whether the live schema and its contract marker still match what
`contract.json` describes.

Other valid commands in this Prisma version:

```bash
npx prisma db schema         # inspect the live schema
npx prisma db sign           # mark a database as matching the contract
npx prisma migration plan    # write a migration from contract changes
npx prisma db migrate        # apply planned migrations
npx prisma migration status  # migration path and pending state
npx prisma migration list    # on-disk migrations
```

---

## 3. Database client

### Where it is created

`apps/db/src/prisma/db.ts` constructs exactly one client for the process:

```ts
export const db = postgres<Contract>({
  contractJson,
  url: process.env.DATABASE_URL,
});
```

`postgres()` is the default export of `@prisma/orm-postgres/runtime`. The
`<Contract>` type parameter comes from the generated `contract.d.ts` and is what
connects the emitted contract to the client. Without it the query surface
collapses to an untyped shape.

The client is lazy. `db.orm` and `db.sql` exist immediately; the connection pool
is not created until `connect()` or the first query.

### What `@cheapest-mt/db` exports

| Export | Purpose |
|---|---|
| `db` | The Prisma 8 Postgres client. |
| `connectDatabase(url?)` | Opens the pool and proves the database is reachable. |
| `disconnectDatabase()` | Closes the pool. |
| `Contract` | The generated contract type. |
| `Db` | The type of `db`, for annotating what you pass around. |
| Codec types | `Char`, `Numeric`, `Timestamptz`, and friends. See the note below. |

### Connection lifecycle

`PrismaService` ties the pool to Nest's lifecycle:

```ts
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('DATABASE_URL');
    if (!url) throw new Error('DATABASE_URL is not set. ...');
    await connectDatabase(url);
  }

  async onModuleDestroy(): Promise<void> {
    await disconnectDatabase();
  }

  get client(): Db { return db; }
}
```

Two details worth knowing:

- The URL is read in `onModuleInit`, not at import time, because `ConfigModule`
  populates `process.env` during bootstrap, after module files have loaded.
- `connectDatabase` issues one `SELECT 1` round trip. Prisma's `connect()` only
  binds the pool and `pg` dials lazily, so without that round trip an
  unreachable database would not surface until the first real query. With it,
  a bad connection string fails during startup.

`PrismaModule` (`apps/api/src/prisma/prisma.module.ts`) is `@Global`, so any
feature module can inject `PrismaService` without importing it again.

### Using it from application code

```ts
import { Injectable } from '@nestjs/common';
import type { Char } from '@cheapest-mt/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  listProducts() {
    return this.prisma.client.orm.public.Product
      .select('id', 'name', 'brand')
      .limit(20)
      .all();
  }

  offersForProduct(productId: string) {
    return this.prisma.client.orm.public.Offer
      .where({ productId: productId as Char<36> })
      .all();
  }
}
```

Models are addressed as `db.orm.public.<Model>`, where `public` is the Postgres
schema the contract declares.

**Branded column types.** Postgres codecs map to branded strings, not plain
`string`. A `uuid` column is `Char<36>` and `price` is a `Numeric`. Passing a raw
`string` into a filter will not compile. Import the codec type from
`@cheapest-mt/db` and cast at the boundary, as above. The API cannot import
`@prisma/orm-postgres` directly, which is why those types are re-exported from
the db package.

---

## 4. Nx integration

**`apps/db` is an Nx library**, not an application. Nx's
`@nx/enforce-module-boundaries` rule forbids importing from a project typed as
an application, so `api` could not depend on `db` otherwise. It stays at
`apps/db`; the directory location is independent of `projectType`.

**Resolution** is a single path mapping in `tsconfig.base.json`:

```json
"paths": { "@cheapest-mt/db": ["./apps/db/src/index.ts"] }
```

The leading `./` is required because the workspace sets no `baseUrl`. Without
it TypeScript raises TS5090.

The alias points at **source**, not a build output, so types update the moment
you re-emit the contract and no rebuild step sits between the two projects.

**Tags and boundaries:**

| Project | Tags |
|---|---|
| `api` | `type:app`, `scope:api` |
| `db` | `type:data`, `scope:db` |

`eslint.config.mjs` allows `type:app` to depend on `type:data` and `type:util`,
and `type:data` on `type:data` and `type:util`. So `api → db` is legal and
`db → api` is not. `nx lint api` enforces this.

Nx records the edge automatically. `nx graph` shows `api → db` as a static
dependency, so `nx build api` builds `db` first.

**Jest** does not read `tsconfig` paths, so `apps/api/jest.config.cts` maps the
alias separately via `moduleNameMapper`.

**Webpack** resolves `@prisma/orm-postgres` by walking up from the importing file
into `apps/db/node_modules` and bundles it into the API output. `apps/db` has its
own `node_modules` and lockfile; the Prisma packages are not installed at the
workspace root.

### Why database code stays in `apps/db`

The Prisma dependencies, the contract, and the generated artefacts are only
coherent together. Splitting a query layer into `apps/api` would mean the API
needs its own Prisma install and its own copy of the contract types, and the
boundary rule that currently keeps the dependency one-directional would stop
meaning anything.

---

## 5. Environment configuration

`DATABASE_URL` is a Postgres connection string. It is never committed; `.env`
files are gitignored.

### Two consumers, two mechanisms

**The NestJS API** loads it through `ConfigModule` in
`apps/api/src/app/app.module.ts`:

```ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['apps/api/.env', 'apps/db/.env', '.env'],
})
```

Earlier entries win, and a real environment variable always beats a file value,
so a deployed container just sets `DATABASE_URL` directly. Paths resolve against
the working directory, which is the workspace root for `nx serve api`.

`apps/db/.env` is in that list on purpose: the db package already owns the
connection string, so local API development needs no second copy. Add
`apps/api/.env` only to point the API at a different database.
`apps/api/.env.example` documents the variable.

**The Prisma CLI** does *not* read those files. `apps/db/prisma.config.ts` reads
`process.env.DATABASE_URL` directly and throws `DATABASE_URL is required` if it
is absent. The variable must already be in your shell:

```bash
cd apps/db
set -a && . ./.env && set +a    # then run any prisma command
npx prisma db verify
```

**This asymmetry is the single most common source of confusion.** The API picks
the value up from `apps/db/.env` automatically. The CLI does not, and fails with
a config error that does not obviously point at your shell.

### Local setup

1. Put `DATABASE_URL=...` in `apps/db/.env`.
2. Run the API with `npx nx serve api` from the workspace root. Nothing else is needed.
3. For CLI work, export the variable in your shell first, as above.

---

## 6. Common workflows

### Changing the data model

Run from `apps/db`, in this order:

```bash
# 1. edit src/prisma/contract.ts

# 2. regenerate contract.json and contract.d.ts
npx prisma contract emit

# 3. apply the change to the database
npx prisma db update

# 4. confirm the database matches the contract
npx prisma db verify

# 5. confirm the package still compiles against the new types
npx nx typecheck db
```

The order matters. `db update` reads the emitted artefacts, so `contract emit`
has to come first or you will push a stale model. After `contract emit` the
`Contract` type changes immediately for `apps/api` too, because the path alias
points at source, so step 5 is where you find query code broken by a renamed or
dropped column.

For a tracked migration instead of a direct push, use `npx prisma migration plan`
then `npx prisma db migrate`.

### Everyday commands

From the workspace root:

```bash
npx nx serve api        # run the API locally
npx nx build api        # production bundle (builds db first)
npx nx test api         # unit tests
npx nx lint api         # includes module-boundary checks
npx nx build db         # build the db package
npx nx lint db
npx nx typecheck db
npx nx contract-emit db # wrapper for `prisma contract emit`
```

From `apps/db`, the equivalent npm scripts are `contract:emit`, `db:update`,
`db:verify`, `migrate`, `migration:status`, `build`, and `dev`.

---

## 7. Rules and pitfalls

**Do not:**

- **Install or import `@prisma/client`.** This project uses
  `@prisma/orm-postgres`. The two are different products and do not mix.
- **Create a `schema.prisma`.** The contract is `apps/db/src/prisma/contract.ts`.
  A `.prisma` file would become a second, silently diverging source of truth.
- **Follow Prisma 6 or 7 documentation or examples.** `prisma generate`,
  `prisma migrate dev`, `PrismaClient`, `$connect`, `$transaction`, and
  `$queryRaw` do not exist here. Verify any command against
  `npx prisma --help` before running it.
- **Construct a second client in `apps/api`.** One `postgres()` instance per
  process, owned by `apps/db`. A second instance means a second connection pool.
- **Bypass `PrismaService`.** Importing `db` directly into a controller skips
  the lifecycle hooks, so nothing closes the pool on shutdown.
- **Put query logic in `apps/api/src/prisma`.** That directory is lifecycle
  wiring only. Queries belong in the feature service that needs them, reached
  through `PrismaService`.
- **Create another `db` or `database` project.** There is one database package
  and it is `apps/db`.
- **Hand-edit `src/prisma/generated/`.** Re-run `prisma contract emit`.
- **Commit a `.env`.** Only `.env.example` is tracked.

**Also worth knowing:**

- `apps/db` has its own `node_modules` and `package-lock.json`. Install Prisma
  dependencies from inside `apps/db`, not at the workspace root.
- `apps/api` cannot resolve `@prisma/*` at all. If you need a Prisma type in the
  API, re-export it from `apps/db/src/index.ts`.
- The build prints a `pg-native` warning. It is the normal optional-dependency
  warning from `pg` and is safe to ignore.
- `npx prisma migration show` requires a target argument; the bare
  `migration:show` npm script will fail without one.

---

## 8. Current model

Defined in `apps/db/src/prisma/contract.ts`, in the `public` schema.

```text
Product ──< Offer >── Store
```

**Product** — `id`, `name`, optional `brand` and `description`, plus `dateAdded`
and `lastUpdated` timestamps.

**Store** — `id`, `name`, `websiteUrl`, optional `logoPath`.

**Offer** — the price of one product at one store. `id`, `productId`, `storeId`,
`price`, `isActive`, `lastUpdated`, `lastSeenAt`.

**Relationships**

- `Product.offers` and `Store.offers` are `hasMany`.
- `Offer.product` and `Offer.store` are `belongsTo`, keyed on `productId` and
  `storeId`.

**Constraints**

- A composite unique on `(productId, storeId)`. One store holds at most one
  offer per product, which makes it the natural upsert key for price updates.
- All ids are UUIDv7, so they sort by creation time. In TypeScript they surface
  as `Char<36>`.
- `price` is a decimal, surfacing as a branded `Numeric` string rather than a
  JavaScript `number`, so no precision is lost.

For the full field list, read the contract. It is short and it is the source of
truth.
