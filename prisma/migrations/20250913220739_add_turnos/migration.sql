-- CreateTable
CREATE TABLE "public"."Turno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "servicio" TEXT NOT NULL,
    "otroServicio" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "telefono" TEXT,
    "grupoId" TEXT,
    "turnoIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + interval '7 days'),

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Turno_fecha_hora_idx" ON "public"."Turno"("fecha", "hora");

-- CreateIndex
CREATE INDEX "Turno_expiresAt_idx" ON "public"."Turno"("expiresAt");
