const nodemailer = require("nodemailer");
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, API_URL } = require("./env");

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

async function sendVerificationEmail(to, token) {
  const url = `${API_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h2>Confirma tu correo</h2>
      <p>Gracias por registrarte en Figaros. Haz clic para activar tu cuenta:</p>
      <p><a href="${url}" style="background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none">Verificar mi correo</a></p>
      <p>Si no ves el botón, copia este enlace:<br><code>${url}</code></p>
      <p>Caduca en 24 horas.</p>
    </div>`;
  await transporter.sendMail({ from: MAIL_FROM, to, subject: "Verifica tu correo", html });
}

module.exports = { sendVerificationEmail };
