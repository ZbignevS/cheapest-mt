import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global so any feature module can inject `PrismaService` without re-importing
 * this module. Relies on a `ConfigModule` being registered globally by the
 * application root.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
