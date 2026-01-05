require("dotenv").config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 4000,
  APP_URL: required("APP_URL"),
  API_URL: process.env.API_URL || "http://localhost:4000",
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES: process.env.JWT_EXPIRES || "15m",
  REFRESH_EXPIRES_DAYS: Number(process.env.REFRESH_EXPIRES_DAYS || "7"),
  SMTP_HOST: required("SMTP_HOST"),
  SMTP_PORT: Number(process.env.SMTP_PORT || "587"),
  SMTP_USER: required("SMTP_USER"),
  SMTP_PASS: required("SMTP_PASS"),
  MAIL_FROM: required("MAIL_FROM"),
};
