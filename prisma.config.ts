declare const process: {
  env: Record<string, string | undefined>
};

export default {
  schema: "backend/prisma/schema.prisma",
  migrations: {
    path: "backend/prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/xueyin?schema=public",
  },
};
