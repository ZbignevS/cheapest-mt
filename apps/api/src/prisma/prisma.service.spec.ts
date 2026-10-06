import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { connectDatabase, disconnectDatabase } from '@cheapest-mt/db';
import { PrismaService } from './prisma.service';

jest.mock('@cheapest-mt/db', () => ({
  db: { orm: {} },
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  disconnectDatabase: jest.fn().mockResolvedValue(undefined),
}));

describe('PrismaService', () => {
  let service: PrismaService;

  async function build(databaseUrl: string | undefined): Promise<PrismaService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        { provide: ConfigService, useValue: { get: () => databaseUrl } },
      ],
    }).compile();

    return module.get<PrismaService>(PrismaService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await build('postgres://user:pass@localhost:5432/postgres');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('connects with the configured url on init and closes on destroy', async () => {
    await service.onModuleInit();
    expect(connectDatabase).toHaveBeenCalledWith(
      'postgres://user:pass@localhost:5432/postgres',
    );

    await service.onModuleDestroy();
    expect(disconnectDatabase).toHaveBeenCalledTimes(1);
  });

  it('fails loudly when DATABASE_URL is missing', async () => {
    const unconfigured = await build(undefined);

    await expect(unconfigured.onModuleInit()).rejects.toThrow('DATABASE_URL is not set');
    expect(connectDatabase).not.toHaveBeenCalled();
  });
});
