const { Prisma } = require("@prisma/client");

function isDatabaseUnavailableError(error) {
  if (!error) {
    return false;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (typeof error.code === "string" && /^P10\d{2}$/.test(error.code)) {
    return true;
  }

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("database server") ||
    message.includes("connection refused") ||
    message.includes("connect econnrefused") ||
    message.includes("connect timeout")
  );
}

function isDatabaseSchemaMismatchError(error) {
  if (!error) {
    return false;
  }

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function buildDatabaseSchemaMismatchMessage(error) {
  const columnName =
    error && error.meta && typeof error.meta.column === "string"
      ? String(error.meta.column).trim()
      : "";
  const tableName =
    error && error.meta && typeof error.meta.table === "string"
      ? String(error.meta.table).trim()
      : "";

  if (columnName) {
    return `数据库结构缺少字段 ${columnName}，请在 backend 目录执行 npm run db:push 后重启服务`;
  }

  if (tableName) {
    return `数据库结构缺少数据表 ${tableName}，请在 backend 目录执行 npm run db:push 后重启服务`;
  }

  return "数据库结构与当前代码不一致，请在 backend 目录执行 npm run db:push 后重启服务";
}

function mapErrorToResponse(error, fallbackMessage = "服务暂不可用，请稍后重试") {
  if (isDatabaseUnavailableError(error)) {
    return {
      statusCode: 503,
      message: "数据库暂不可用，请稍后重试",
    };
  }

  if (isDatabaseSchemaMismatchError(error)) {
    return {
      statusCode: 409,
      message: buildDatabaseSchemaMismatchMessage(error),
    };
  }

  return {
    statusCode: 500,
    message: fallbackMessage,
  };
}

module.exports = {
  isDatabaseUnavailableError,
  isDatabaseSchemaMismatchError,
  mapErrorToResponse,
};
