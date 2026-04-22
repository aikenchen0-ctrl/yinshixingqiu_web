process.env.PRISMA_AUTO_SYNC = process.env.PRISMA_AUTO_SYNC || "0";
process.env.XUEYIN_BACKGROUND_JOBS = process.env.XUEYIN_BACKGROUND_JOBS || "0";

console.log("[prisma] starting backend with PRISMA_AUTO_SYNC=0 and XUEYIN_BACKGROUND_JOBS=0");

require("../src/server");
