// server/src/cleanup.js
const cron = require("node-cron");
const { prisma } = require("./db");

// Todos los días a las 03:00
function startCleanupJob() {
  cron.schedule("0 3 * * *", async () => {
    try {
      const res = await prisma.turno.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
      if (res.count > 0) {
        console.log(`[cleanup] turnos eliminados: ${res.count}`);
      }
    } catch (e) {
      console.error("[cleanup] error:", e.message);
    }
  });
}

module.exports = { startCleanupJob };
