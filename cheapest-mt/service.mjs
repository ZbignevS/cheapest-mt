// @ts-check
import node from "@prisma/composer/node";
import { compute } from "@prisma/composer-prisma-cloud";
import { postgres, dataContract } from "@prisma/composer-prisma-cloud/orm";
import cheapestMtContractJson from "./src/prisma/contract.json" with { type: "json" };

export default compute({
  name: "cheapest-mt",
  deps: { db: postgres(dataContract(cheapestMtContractJson)) },
  build: node({ module: import.meta.url, dir: "dist", entry: "main.js" }),
});
