// src/index.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { PORT, APP_URL } = require("./env");

const { authRouter } = require("./auth.routes");      // auth (ya lo tenías)
const turnosRouter = require("./turnos.routes");      // <-- NUEVO
const { startCleanupJob } = require("./cleanup");     // <-- NUEVO

const app = express();
app.set("trust proxy", 1);

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [APP_URL],
    credentials: true,
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

// Rutas
app.use("/api/auth", authRouter);
app.use("/api/turnos", turnosRouter);                 // <-- NUEVA ruta

// Manejador de errores
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// Cron de limpieza (borra turnos con expiresAt <= now)
startCleanupJob();                                    // <-- Arranca cron

// Server - solo en desarrollo local
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`API escuchando en :${PORT}`));
}

// Exportar para Vercel serverless
module.exports = app;
