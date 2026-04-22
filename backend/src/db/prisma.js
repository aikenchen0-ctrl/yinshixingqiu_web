const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });

const BACKEND_ROOT = path.join(__dirname, "..", "..");
const PRISMA_SCHEMA_PATH = path.join(BACKEND_ROOT, "prisma", "schema.prisma");
const PRISMA_CLI_ENTRY_CANDIDATES = [
  path.join(BACKEND_ROOT, "node_modules", "prisma", "build", "index.js"),
  path.join(path.dirname(BACKEND_ROOT), "node_modules", "prisma", "build", "index.js"),
];
const PRISMA_BINARY_NAME = process.platform === "win32" ? "prisma.cmd" : "prisma";
const PRISMA_BINARY_CANDIDATES = [
  path.join(BACKEND_ROOT, "node_modules", ".bin", PRISMA_BINARY_NAME),
  path.join(path.dirname(BACKEND_ROOT), "node_modules", ".bin", PRISMA_BINARY_NAME),
];
const AUTO_SYNC_DISABLED_VALUES = ["0", "false", "off", "no"];

let prismaSchemaReady = false;

function shouldAutoSyncPrisma() {
  const normalizedValue = String(process.env.PRISMA_AUTO_SYNC ?? "1")
    .trim()
    .toLowerCase();

  return !AUTO_SYNC_DISABLED_VALUES.includes(normalizedValue);
}

function resolvePrismaBinaryPath() {
  const existingBinaryPath = PRISMA_BINARY_CANDIDATES.find((candidatePath) => fs.existsSync(candidatePath));
  return existingBinaryPath || PRISMA_BINARY_NAME;
}

function resolvePrismaCliEntryPath() {
  return PRISMA_CLI_ENTRY_CANDIDATES.find((candidatePath) => fs.existsSync(candidatePath)) || "";
}

function getPrismaCommandOutput(error) {
  const stdout = String((error && error.stdout) || "").trim();
  const stderr = String((error && error.stderr) || "").trim();

  return {
    stdout,
    stderr,
    detailText: [stdout, stderr].filter(Boolean).join("\n"),
  };
}

function isDatabaseServerUnreachableError(error) {
  const { detailText } = getPrismaCommandOutput(error);
  return /\bP1001\b/.test(detailText) || /can't reach database server/i.test(detailText);
}

function buildPrismaSyncError(error) {
  const { detailText } = getPrismaCommandOutput(error);
  const guidance = isDatabaseServerUnreachableError(error)
    ? [
        "Local database is not reachable.",
        "Try one of the following before retrying:",
        "1. Start PostgreSQL on localhost:5432.",
        "2. If Docker Desktop is available, run `npm run db:start` in `backend`.",
        "3. If you only need a non-database dev shell, run `npm run start:no-db` in `backend`.",
      ].join("\n")
    : "";
  const message = detailText
    ? ["Prisma schema auto sync failed.", detailText, guidance].filter(Boolean).join("\n")
    : `Prisma schema auto sync failed: ${error instanceof Error ? error.message : "unknown error"}`;

  const syncError = new Error(message);
  syncError.cause = error;
  return syncError;
}

function buildPrismaSpawnOptions() {
  return {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
  };
}

function runPrismaCommand(prismaBinaryPath, commandArgs) {
  const spawnOptions = buildPrismaSpawnOptions();
  const prismaCliEntryPath = resolvePrismaCliEntryPath();

  if (prismaCliEntryPath) {
    return spawnSync(process.execPath, [prismaCliEntryPath].concat(commandArgs), spawnOptions);
  }

  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(prismaBinaryPath)) {
    const windowsShell = process.env.ComSpec || "cmd.exe";
    const commandText = [`"${prismaBinaryPath}"`].concat(commandArgs).join(" ");

    return spawnSync(windowsShell, ["/d", "/s", "/c", commandText], spawnOptions);
  }

  return spawnSync(prismaBinaryPath, commandArgs, spawnOptions);
}

function ensurePrismaSchemaReady() {
  if (prismaSchemaReady) {
    return;
  }

  prismaSchemaReady = true;

  if (!shouldAutoSyncPrisma()) {
    console.log("[prisma] auto sync disabled by PRISMA_AUTO_SYNC=0");
    return;
  }

  const prismaBinaryPath = resolvePrismaBinaryPath();

  console.log(`[prisma] auto syncing schema from ${PRISMA_SCHEMA_PATH}`);

  const result = runPrismaCommand(prismaBinaryPath, ["db", "push", "--schema", "prisma/schema.prisma"]);

  if (result.error || result.status !== 0) {
    const syncError = result.error || new Error(`Prisma CLI exited with status ${String(result.status)}`);
    syncError.stdout = result.stdout;
    syncError.stderr = result.stderr;
    throw buildPrismaSyncError(syncError);
  }

  console.log("[prisma] schema ready");
}

ensurePrismaSchemaReady();

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
