import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import service from "../service";
import { connectDatabase, disconnectDatabase } from "./prisma/db";
import { AppModule } from "./app.module";

/**
 * Inside a Prisma Composer deployment the connection string arrives through the
 * provisioned `database` binding rather than through `DATABASE_URL`. Outside it
 * (plain `tsx watch src/main.ts`) there is no stash to load, so fall back to the
 * environment.
 */
function resolveDatabaseUrl(): string | undefined {
  try {
    return service.load().database.url;
  } catch {
    return process.env.DATABASE_URL;
  }
}

async function bootstrap() {
  await connectDatabase(resolveDatabaseUrl());

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const rawPort = (process.env.PORT ?? "").trim();
  const parsedPort = rawPort.length > 0 ? Number(rawPort) : Number.NaN;
  const port =
    Number.isFinite(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 3000;

  await app.listen(port);
  console.log(`Server running at http://localhost:${port}`);
}

bootstrap().catch(async (error) => {
  console.error("Failed to start server", error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
