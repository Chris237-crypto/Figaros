const { prisma } = require("./db");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { JWT_SECRET, JWT_EXPIRES, APP_URL } = require("./env");
const { sendVerificationEmail } = require("./email");
const { createEmailVerificationToken, consumeEmailVerificationToken } = require("./tokens");

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().transform(s => s.toLowerCase()),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email().transform(s => s.toLowerCase()),
  password: z.string().min(1),
});

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function setSessionCookie(res, token) {
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,         // en prod con HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  });
}

async function register(req, res) {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });

    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });

    const token = await createEmailVerificationToken(user.id);
    await sendVerificationEmail(user.email, token);
    return res.status(201).json({ message: "Usuario creado. Revisa tu email para verificar." });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0].message });
    return res.status(400).json({ error: e.message || "Error al registrarse" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return res.status(401).json({ error: "Credenciales incorrectas." });
    if (!user.verified) return res.status(403).json({ error: "Cuenta no verificada. Revisa tu correo o reenvía el enlace." });

    const token = signAccessToken(user);
    setSessionCookie(res, token);
    return res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: e.issues[0].message });
    return res.status(400).json({ error: e.message || "Error al iniciar sesión" });
  }
}

async function verifyEmail(req, res) {
  const token = String(req.query.token || "");
  if (!token) return res.status(400).send("Token faltante.");
  try {
    await consumeEmailVerificationToken(token);
    const url = `${APP_URL}/?verified=1`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`<meta http-equiv="refresh" content="0;url=${url}" /><p>Cuenta verificada. Redirigiendo…</p>`);
  } catch (e) {
    return res.status(400).send(`No se pudo verificar: ${e.message}`);
  }
}

async function resendVerification(req, res) {
  const email = String(req.body.email || "").toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
  if (user.verified) return res.status(400).json({ error: "La cuenta ya está verificada." });

  const token = await createEmailVerificationToken(user.id);
  await sendVerificationEmail(user.email, token);
  return res.json({ message: "Se envió un nuevo enlace de verificación." });
}

async function me(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No autenticado." });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, verified: true },
    });
    if (!user) return res.status(401).json({ error: "No autenticado." });
    return res.json({ user });
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }
}

async function logout(_req, res) {
  res.clearCookie("access_token", { path: "/" });
  return res.json({ ok: true });
}

module.exports = { register, login, verifyEmail, resendVerification, me, logout };
