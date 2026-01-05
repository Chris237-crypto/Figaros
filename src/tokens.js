const crypto = require("crypto");
const { prisma } = require("./db");

const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");

async function createEmailVerificationToken(userId, ttlMs = 24 * 60 * 60 * 1000) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.verificationToken.create({ data: { userId, tokenHash, expiresAt } });
  return token;
}

async function consumeEmailVerificationToken(token) {
  const tokenHash = hash(token);
  const rec = await prisma.verificationToken.findUnique({ where: { tokenHash } });
  if (!rec) throw new Error("Token inválido.");
  if (rec.consumedAt) throw new Error("Token ya usado.");
  if (rec.expiresAt < new Date()) throw new Error("Token expirado.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { verified: true } }),
    prisma.verificationToken.update({ where: { tokenHash }, data: { consumedAt: new Date() } }),
    prisma.verificationToken.deleteMany({ where: { userId: rec.userId, NOT: { tokenHash } } }),
  ]);
  return rec.userId;
}

module.exports = { createEmailVerificationToken, consumeEmailVerificationToken };
