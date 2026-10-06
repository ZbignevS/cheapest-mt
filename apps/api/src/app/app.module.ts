import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    /**
     * Paths resolve against the process working directory, which is the
     * workspace root for `nx serve api` and `nx build api` output. Earlier
     * entries win, and real environment variables always beat file values, so
     * a deployed container can simply set `DATABASE_URL` directly.
     *
     * `apps/db/.env` is in the list because the db package owns the connection
     * string and the Prisma CLI already reads it from there.
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', 'apps/db/.env', '.env'],
    }),
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
