// server/src/turnos.controller.js
const { z } = require("zod");
const { prisma } = require("./db");
const { randomUUID } = require("crypto");

// ================== Schemas ==================
const baseSchema = z.object({
  nombre: z.string().min(1),
  servicio: z.string().min(1),
  otroServicio: z.string().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  telefono: z.string().optional(),
});

// OJO: coerce => convierte "5" (string) en 5 (number)
const batchSchema = baseSchema.extend({
  nTurnos: z.coerce.number().int().min(1).max(20),
});

// ================== Utils ==================
function toDateOnly(yyyy_mm_dd) {
  // Fecha a medianoche UTC para consistencia
  return new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
}

function cleanEmpty(obj = {}) {
  // Elimina claves con "", null o undefined (evita 400 por regex cuando llega "")
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === null || typeof v === "undefined") continue;
    out[k] = v;
  }
  return out;
}

// ================== Controllers ==================

// POST /api/turnos/batch
async function createBatch(req, res) {
  try {
    // 1) normaliza alias y convierte a number
    const raw = req.body || {};
    const body = {
      ...raw,
      // acepta 'nTurnos' o 'turno'
      nTurnos: raw.nTurnos ?? raw.turno,
    };

    console.log("[createBatch] Datos recibidos (normalizados):", body);

    // 2) valida ya con 'nTurnos' coaccionado a number
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[createBatch] Error de validación:", parsed.error.issues[0]?.message);
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Datos inválidos" });
    }

    const { nombre, servicio, otroServicio, fecha, hora, telefono, nTurnos } = parsed.data;
    console.log("[createBatch] Número de turnos a crear:", nTurnos);

    const effectiveService =
      (servicio === "otros" && (otroServicio || "").trim()) || servicio;

    const groupId = randomUUID();
    const base = {
      nombre,
      servicio: effectiveService,
      otroServicio: servicio === "otros" ? (otroServicio || "").trim() || null : null,
      fecha: toDateOnly(fecha),
      hora,
      telefono: (telefono || "").trim() || null,
      grupoId: groupId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const ops = Array.from({ length: nTurnos }, (_, i) =>
      prisma.turno.create({ data: { ...base, turnoIndex: i + 1 } })
    );

    console.log("[createBatch] Longitud de operaciones (ops):", ops.length);
    const created = await prisma.$transaction(ops);
    console.log("[createBatch] Turnos creados:", created.map(t => t.turnoIndex));
    return res.json({ ok: true, groupId, count: created.length });
  } catch (e) {
    console.error("[createBatch] Error al crear turnos:", e);
    return res.status(500).json({ error: "No se pudo crear el lote de turnos" });
  }
}


// GET /api/turnos  (vigentes)
async function list(_req, res) {
  try {
    const turnos = await prisma.turno.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }, { nombre: "asc" }],
    });
    const items = turnos.map((t) => ({
      ...t,
      fecha: t.fecha.toISOString().slice(0, 10), // "YYYY-MM-DD"
    }));
    res.json({ ok: true, items });
  } catch (e) {
    console.error("[list] error:", e);
    res.status(500).json({ error: "No se pudo listar turnos" });
  }
}

// PATCH /api/turnos/:id
// PATCH /api/turnos/:id
async function updateOne(req, res) {
  const { id } = req.params;

  try {
    console.log("[updateOne] id:", id, "raw body:", req.body);

    // 1) limpia vacíos para no romper regex de zod con ""
    const cleaned = cleanEmpty(req.body);

    // 2) valida SOLO campos permitidos (parcial)
    const parsed = baseSchema.partial().safeParse(cleaned);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    // 3) construye data para Prisma (campos normales)
    const p = parsed.data;
    const data = {};

    if (typeof p.nombre === "string") data.nombre = p.nombre;
    if (typeof p.servicio === "string") data.servicio = p.servicio;
    if (typeof p.otroServicio !== "undefined")
      data.otroServicio = p.otroServicio?.trim() || null;
    if (typeof p.fecha === "string") data.fecha = toDateOnly(p.fecha);
    if (typeof p.hora === "string") data.hora = p.hora;
    if (typeof p.telefono !== "undefined")
      data.telefono = (p.telefono || "").trim() || null;

    // Si cambiaron a "otros" pero no mandaron 'otroServicio', preserva el anterior
    if (data.servicio === "otros" && !("otroServicio" in data)) {
      const prev = await prisma.turno.findUnique({
        where: { id },
        select: { otroServicio: true },
      });
      data.otroServicio = prev?.otroServicio || null;
    }

    // 4) aplica primero el UPDATE del turno base (así los nuevos heredan campos ya editados)
    let baseUpdated = await prisma.turno.update({ where: { id }, data });

    // ====== 5) si vino 'nTurnos' o 'turno' en el body, ajusta el tamaño del lote ======
    const newCountRaw = req.body.nTurnos ?? req.body.turno;
    if (typeof newCountRaw !== "undefined") {
      const newCount = Math.max(1, Math.min(20, Number(newCountRaw) || 1));
      console.log("[updateOne] Ajustar tamaño del lote a:", newCount);

      // Asegura que todos compartan un mismo grupoId
      let grupoId = baseUpdated.grupoId;
      if (!grupoId) {
        // si este registro no tenía grupo aún y vamos a manejar lotes, créalo
        grupoId = randomUUID();
        await prisma.turno.update({
          where: { id: baseUpdated.id },
          data: { grupoId, turnoIndex: baseUpdated.turnoIndex || 1 },
        });
        baseUpdated = await prisma.turno.findUnique({ where: { id } });
      }

      // Trae todas las filas del lote (incluida la actual)
      const rows = await prisma.turno.findMany({
        where: { OR: [{ id: baseUpdated.id }, { grupoId }] },
        orderBy: { turnoIndex: "asc" },
      });

      const diff = newCount - rows.length;
      console.log("[updateOne] Lote actual:", rows.length, "diff:", diff);

      if (diff > 0) {
        // Crear faltantes al final
        const maxIdx = Math.max(0, ...rows.map(r => r.turnoIndex || 0));
        const base = {
          nombre: baseUpdated.nombre,
          servicio: baseUpdated.servicio,
          otroServicio: baseUpdated.otroServicio,
          fecha: baseUpdated.fecha,
          hora: baseUpdated.hora,
          telefono: baseUpdated.telefono,
          grupoId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
        const creates = Array.from({ length: diff }, (_, i) =>
          prisma.turno.create({
            data: { ...base, turnoIndex: maxIdx + i + 1 },
          })
        );
        await prisma.$transaction(creates);
      } else if (diff < 0) {
        // Eliminar los "sobrantes" dejando los primeros 'newCount'
        const toDelete = rows.slice(newCount);
        await prisma.$transaction(
          toDelete.map(r => prisma.turno.delete({ where: { id: r.id } }))
        );
      }

      // Opcional: devuelve el turno actualizado
      const item = await prisma.turno.findUnique({ where: { id: baseUpdated.id } });
      return res.json({
        ok: true,
        item: { ...item, fecha: item.fecha.toISOString().slice(0, 10) },
      });
    }

    // ====== 6) si no hubo cambio de cantidad, responde con el registro editado ======
    return res.json({
      ok: true,
      item: { ...baseUpdated, fecha: baseUpdated.fecha.toISOString().slice(0, 10) },
    });
  } catch (e) {
    console.error("[updateOne] error:", e);
    return res.status(500).json({ error: "No se pudo actualizar el turno" });
  }
}


// DELETE /api/turnos/:id
async function removeOne(req, res) {
  const { id } = req.params;
  try {
    await prisma.turno.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error("[removeOne] error:", e);
    res.status(500).json({ error: "No se pudo eliminar el turno" });
  }
}

module.exports = { createBatch, list, updateOne, removeOne };
