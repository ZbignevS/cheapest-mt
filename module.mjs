// @ts-check
import { module } from "@prisma/composer";
import { postgres, dataContract } from "@prisma/composer-prisma-cloud/orm";
import cheapestMtContractJson from "./cheapest-mt/src/prisma/contract.json" with { type: "json" };
import cheapestMtService from "./cheapest-mt/service.mjs";

export default module("cheapest-mt", ({ provision }) => {
  const database = provision(postgres({ name: "database", contract: dataContract(cheapestMtContractJson), config: "./cheapest-mt/prisma.config.ts" }));
  provision(cheapestMtService, { id: "cheapestmt", deps: { db: database } });
});
