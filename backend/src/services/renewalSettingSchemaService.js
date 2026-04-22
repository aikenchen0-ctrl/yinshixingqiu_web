const { prisma } = require("../db/prisma");

const RENEWAL_SETTING_COLUMN_PATCHES = [
  { column: "enabled", definition: 'BOOLEAN NOT NULL DEFAULT true' },
  { column: "limit_window", definition: 'BOOLEAN NOT NULL DEFAULT false' },
  { column: "amount", definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0' },
  { column: "original_amount", definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0' },
  { column: "discounted_percentage", definition: 'INTEGER NOT NULL DEFAULT 100' },
  { column: "expiring_enabled", definition: 'BOOLEAN NOT NULL DEFAULT true' },
  { column: "advance_amount", definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0' },
  { column: "advance_discount_percentage", definition: 'INTEGER NOT NULL DEFAULT 100' },
  { column: "advance_enabled", definition: 'BOOLEAN NOT NULL DEFAULT true' },
  { column: "grace_amount", definition: 'DECIMAL(10, 2) NOT NULL DEFAULT 0' },
  { column: "grace_discount_percentage", definition: 'INTEGER NOT NULL DEFAULT 100' },
  { column: "grace_enabled", definition: 'BOOLEAN NOT NULL DEFAULT true' },
  { column: "audience", definition: "TEXT NOT NULL DEFAULT 'renewable_members'" },
  { column: "allow_coupon_stack", definition: 'BOOLEAN NOT NULL DEFAULT true' },
  { column: "min_renew_count", definition: 'INTEGER NOT NULL DEFAULT 0' },
  { column: "mode", definition: "TEXT NOT NULL DEFAULT 'period'" },
  { column: "duration", definition: "TEXT NOT NULL DEFAULT '1Y'" },
  { column: "begin_time", definition: 'TIMESTAMP(3)' },
  { column: "end_time", definition: 'TIMESTAMP(3)' },
  { column: "guidance", definition: 'TEXT' },
  { column: "renewal_url", definition: 'TEXT' },
  { column: "created_at", definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
  { column: "updated_at", definition: 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP' },
];

let cachedRenewalSettingColumns = null;

async function getRenewalSettingColumnNames(options = {}) {
  const { refresh = false } = options;

  if (!refresh && cachedRenewalSettingColumns) {
    return cachedRenewalSettingColumns;
  }

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'renewal_settings'`
    );
    cachedRenewalSettingColumns = new Set(
      Array.isArray(rows) ? rows.map((item) => String(item.column_name || "")).filter(Boolean) : []
    );
  } catch (error) {
    cachedRenewalSettingColumns = new Set();
  }

  return cachedRenewalSettingColumns;
}

async function ensureRenewalSettingColumns(requiredColumns = []) {
  const currentColumns = await getRenewalSettingColumnNames({ refresh: true });
  const missingColumns = requiredColumns.filter((column) => !currentColumns.has(column));

  if (!currentColumns.size || !missingColumns.length) {
    return {
      columnNames: currentColumns,
      missingColumns,
      addedColumns: [],
    };
  }

  const patchableColumns = RENEWAL_SETTING_COLUMN_PATCHES.filter(
    (item) => missingColumns.includes(item.column) && !currentColumns.has(item.column)
  );

  if (!patchableColumns.length) {
    return {
      columnNames: currentColumns,
      missingColumns,
      addedColumns: [],
    };
  }

  try {
    for (const patch of patchableColumns) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "renewal_settings" ADD COLUMN IF NOT EXISTS "${patch.column}" ${patch.definition}`
      );
    }
  } catch (error) {
    console.warn(
      `[renewal_settings] failed to auto patch columns: ${patchableColumns.map((item) => item.column).join(", ")}`,
      error
    );
  }

  const nextColumns = await getRenewalSettingColumnNames({ refresh: true });
  return {
    columnNames: nextColumns,
    missingColumns: requiredColumns.filter((column) => !nextColumns.has(column)),
    addedColumns: patchableColumns
      .map((item) => item.column)
      .filter((column) => nextColumns.has(column) && !currentColumns.has(column)),
  };
}

module.exports = {
  getRenewalSettingColumnNames,
  ensureRenewalSettingColumns,
};
