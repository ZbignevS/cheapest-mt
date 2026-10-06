import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { connectDatabase, db, disconnectDatabase, type Db } from '@cheapest-mt/db';

/**
 * Owns the lifecycle of the shared Prisma client for this process.
 *
 * The client itself lives in `@cheapest-mt/db`. This service only resolves the
 * connection string and ties opening and closing the pool to Nest's lifecycle
 * hooks. The URL is read here rather than at import time because `ConfigModule`
 * populates `process.env` during bootstrap, after module files have loaded.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('DATABASE_URL');

    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Add it to apps/api/.env or apps/db/.env, or export it in the environment.',
      );
    }

    await connectDatabase(url);
  }

  async onModuleDestroy(): Promise<void> {
    await disconnectDatabase();
  }

  get client(): Db {
    return db;
  }
}
