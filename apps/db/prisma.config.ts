import { definePrismaConfig } from 'prisma/config';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

export default definePrismaConfig({
  skills: {
    agents: ['claude', 'cursor', 'agents', 'devin'],
  },
  orm: ormConfig({
    contract: './src/prisma/contract.ts',
    output: './src/prisma/generated',
    db: {
      connection: databaseUrl,
    },
  }),
  composer: {
    configPath: './prisma-composer.config.ts',
  },
});
