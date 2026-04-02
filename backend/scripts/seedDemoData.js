const { ensureDemoData } = require("../src/db/seedDemoData");
const { prisma } = require("../src/db/prisma");

async function main() {
  await ensureDemoData();
  console.log(JSON.stringify({ ok: true, seeded: true }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
