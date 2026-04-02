require("dotenv").config({ quiet: true });

const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__xueyinPrisma ||
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__xueyinPrisma = prisma;
}

module.exports = {
  prisma,
};
