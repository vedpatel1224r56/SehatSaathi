const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const DB_PROVIDER = (process.env.DB_PROVIDER || "sqlite").trim().toLowerCase();
const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
const DB_PATH =
  process.env.DB_PATH ||
  path.resolve(__dirname, "..", "..", "database", "health.db");
const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  path.resolve(__dirname, "..", "..", "database", "uploads");
const RECORDS_DIR = path.join(UPLOAD_DIR, "records");
const FILE_STORAGE_MODE = (process.env.FILE_STORAGE_MODE || "local").trim().toLowerCase();
const PUBLIC_UPLOAD_BASE_URL = (process.env.PUBLIC_UPLOAD_BASE_URL || "").trim().replace(/\/+$/, "");
const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || "pved2038@gmail.com").trim();
const SUPPORT_PHONE = (process.env.SUPPORT_PHONE || "").trim();
const SUPPORT_WHATSAPP = (process.env.SUPPORT_WHATSAPP || "").trim();
const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-jwt-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const REFRESH_TOKEN_EXPIRES_DAYS = Math.max(
  1,
  Math.min(Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30), 90),
);
const MODEL_ENABLED = (process.env.TRIAGE_MODEL_ENABLED || "false").toLowerCase() === "true";
const PYTHON_BIN = process.env.TRIAGE_MODEL_PYTHON || "python3";
const TRIAGE_MODEL_SCRIPT =
  process.env.TRIAGE_MODEL_SCRIPT ||
  path.resolve(__dirname, "..", "ml", "predict_triage.py");
const TRIAGE_MODEL_FILE =
  process.env.TRIAGE_MODEL_FILE ||
  path.resolve(__dirname, "..", "ml", "artifacts", "triage_model.joblib");
const TRIAGE_MODEL_META_FILE =
  process.env.TRIAGE_MODEL_META_FILE ||
  path.resolve(__dirname, "..", "ml", "artifacts", "model_metadata.json");
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const PASSWORD_RESET_BASE_URL = (
  process.env.PASSWORD_RESET_BASE_URL || "http://localhost:5173/reset-password"
).trim();
const PASSWORD_RESET_OUTBOX_PATH =
  process.env.PASSWORD_RESET_OUTBOX_PATH ||
  path.resolve(__dirname, "..", "..", "database", "outbox", "password_reset_requests.log");
const PASSWORD_RESET_OTP_OUTBOX_PATH =
  process.env.PASSWORD_RESET_OTP_OUTBOX_PATH ||
  path.resolve(__dirname, "..", "..", "database", "outbox", "password_reset_otp_requests.log");
const OTP_DELIVERY_WEBHOOK_URL = (process.env.OTP_DELIVERY_WEBHOOK_URL || "").trim();
const OTP_DELIVERY_WEBHOOK_AUTH = (process.env.OTP_DELIVERY_WEBHOOK_AUTH || "").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL || "").trim();
const OTP_LENGTH = Math.max(4, Math.min(Number(process.env.OTP_LENGTH || 6), 8));
const OTP_EXPIRES_MINUTES = Math.max(3, Math.min(Number(process.env.OTP_EXPIRES_MINUTES || 10), 30));
const LOGIN_RATE_LIMIT_PER_MIN = Math.max(
  3,
  Math.min(Number(process.env.LOGIN_RATE_LIMIT_PER_MIN || 12), 120),
);
const OTP_RATE_LIMIT_PER_MIN = Math.max(
  2,
  Math.min(Number(process.env.OTP_RATE_LIMIT_PER_MIN || 8), 60),
);
const IDEMPOTENCY_TTL_MINUTES = Math.max(
  1,
  Math.min(Number(process.env.IDEMPOTENCY_TTL_MINUTES || 15), 120),
);
const ALERT_WEBHOOK_URL = (process.env.ALERT_WEBHOOK_URL || "").trim();
const ALERT_WEBHOOK_AUTH = (process.env.ALERT_WEBHOOK_AUTH || "").trim();
const ALERT_COOLDOWN_SECONDS = Math.max(
  10,
  Math.min(Number(process.env.ALERT_COOLDOWN_SECONDS || 120), 3600),
);
const UPTIME_HEARTBEAT_SECONDS = Math.max(
  15,
  Math.min(Number(process.env.UPTIME_HEARTBEAT_SECONDS || 60), 3600),
);
const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const RAZORPAY_ENABLED =
  (process.env.RAZORPAY_ENABLED || "").trim()
    ? (process.env.RAZORPAY_ENABLED || "").trim().toLowerCase() === "true"
    : Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
const ABDM_ENABLED = (process.env.ABDM_ENABLED || "").trim().toLowerCase() === "true";
const ABDM_BASE_URL = (process.env.ABDM_BASE_URL || "").trim().replace(/\/+$/, "");
const ABDM_CLIENT_ID = (process.env.ABDM_CLIENT_ID || "").trim();
const ABDM_CLIENT_SECRET = (process.env.ABDM_CLIENT_SECRET || "").trim();
const ABDM_SESSION_PATH = (process.env.ABDM_SESSION_PATH || "").trim();
const ABDM_ABHA_VERIFY_URL = (process.env.ABDM_ABHA_VERIFY_URL || "").trim();
const ABDM_ABHA_PROFILE_URL = (process.env.ABDM_ABHA_PROFILE_URL || "").trim();
const ABDM_TIMEOUT_MS = Math.max(
  2000,
  Math.min(Number(process.env.ABDM_TIMEOUT_MS || 10000), 30000),
);

// Hard blockers — server cannot operate safely without these
const REQUIRED_PRODUCTION_ENV = ["JWT_SECRET", "CORS_ORIGINS"];
// Soft warnings — encouraged but app still runs without them
const RECOMMENDED_PRODUCTION_ENV = ["PASSWORD_RESET_BASE_URL", "SUPPORT_WHATSAPP"];
const PLACEHOLDER_PATTERNS = [
  /change_me/i,
  /change_this/i,
  /replace_me/i,
  /paste_/i,
  /your_.+_here/i,
  /example/i,
  /<.+>/,
];

const looksPlaceholder = (value) => {
  const str = String(value || "").trim();
  if (!str) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(str));
};

const validateRuntimeConfig = () => {
  const problems = [];
  const warnings = [];
  if (!["sqlite", "postgres"].includes(DB_PROVIDER)) {
    problems.push(`Unsupported DB_PROVIDER: ${DB_PROVIDER}. Use sqlite or postgres.`);
  }

  if (NODE_ENV === "production") {
    const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !String(process.env[key] || "").trim());
    if (missing.length > 0) {
      problems.push(`Missing required production env vars: ${missing.join(", ")}`);
    }
    const recommended = RECOMMENDED_PRODUCTION_ENV.filter((key) => !String(process.env[key] || "").trim());
    if (recommended.length > 0) {
      warnings.push(`Optional env vars not set (app still runs): ${recommended.join(", ")}`);
    }
    if (JWT_SECRET === "dev-insecure-jwt-secret") {
      problems.push("JWT_SECRET is using the insecure development default.");
    }
    if (JWT_SECRET.length < 32 || looksPlaceholder(JWT_SECRET)) {
      problems.push("JWT_SECRET must be a strong non-placeholder value (>=32 chars).");
    }
    if (DB_PROVIDER === "postgres" && !DATABASE_URL) {
      problems.push("DATABASE_URL is required when DB_PROVIDER=postgres.");
    }
    if (DB_PROVIDER === "postgres" && DATABASE_URL && looksPlaceholder(DATABASE_URL)) {
      problems.push("DATABASE_URL appears to be a placeholder.");
    }
    if (RESEND_API_KEY && looksPlaceholder(RESEND_API_KEY)) {
      problems.push("RESEND_API_KEY appears to be a placeholder.");
    }
    if (RESEND_FROM_EMAIL && /yourdomain\.com$/i.test(RESEND_FROM_EMAIL)) {
      problems.push("RESEND_FROM_EMAIL must use a real sending domain.");
    }
    if (RAZORPAY_ENABLED && (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET)) {
      problems.push("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when Razorpay is enabled.");
    }
    if (ABDM_ENABLED && (!ABDM_BASE_URL || !ABDM_SESSION_PATH || !ABDM_CLIENT_ID || !ABDM_CLIENT_SECRET)) {
      problems.push("ABDM_BASE_URL, ABDM_SESSION_PATH, ABDM_CLIENT_ID and ABDM_CLIENT_SECRET are required when ABDM is enabled.");
    }
    if (ABDM_ENABLED && !ABDM_ABHA_VERIFY_URL) {
      warnings.push("ABDM_ENABLED=true but ABDM_ABHA_VERIFY_URL is missing; ABHA verification will fall back to pending review.");
    }
    if (ABDM_ENABLED && !ABDM_ABHA_PROFILE_URL) {
      warnings.push("ABDM_ENABLED=true but ABDM_ABHA_PROFILE_URL is missing; ABHA profile fetch will stay disabled.");
    }
    if (!["local", "local_persistent"].includes(FILE_STORAGE_MODE)) {
      problems.push("FILE_STORAGE_MODE must be local or local_persistent.");
    }
    if (FILE_STORAGE_MODE === "local" && !PUBLIC_UPLOAD_BASE_URL) {
      warnings.push("FILE_STORAGE_MODE=local in production should be paired with a persistent volume strategy or a PUBLIC_UPLOAD_BASE_URL.");
    }
    if (FILE_STORAGE_MODE === "local_persistent" && !UPLOAD_DIR) {
      problems.push("UPLOAD_DIR is required when FILE_STORAGE_MODE=local_persistent.");
    }
  } else {
    if (looksPlaceholder(JWT_SECRET)) {
      warnings.push("JWT_SECRET looks like a placeholder in non-production.");
    }
    if (DB_PROVIDER === "postgres" && DATABASE_URL && looksPlaceholder(DATABASE_URL)) {
      warnings.push("DATABASE_URL looks like a placeholder in non-production.");
    }
  }

  if (MODEL_ENABLED) {
    if (!fs.existsSync(TRIAGE_MODEL_SCRIPT)) {
      problems.push(`TRIAGE_MODEL_SCRIPT not found at ${TRIAGE_MODEL_SCRIPT}`);
    }
    if (!fs.existsSync(TRIAGE_MODEL_FILE)) {
      problems.push(`TRIAGE_MODEL_FILE not found at ${TRIAGE_MODEL_FILE}`);
    }
    if (!fs.existsSync(TRIAGE_MODEL_META_FILE)) {
      problems.push(`TRIAGE_MODEL_META_FILE not found at ${TRIAGE_MODEL_META_FILE}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Runtime configuration invalid: ${problems.join(" | ")}`);
  }
  if (warnings.length > 0) {
    // Keep development usable but visible.
    // eslint-disable-next-line no-console
    console.warn(`Runtime configuration warnings: ${warnings.join(" | ")}`);
  }
};

module.exports = {
  NODE_ENV,
  PORT,
  DB_PROVIDER,
  DATABASE_URL,
  DB_PATH,
  UPLOAD_DIR,
  RECORDS_DIR,
  FILE_STORAGE_MODE,
  PUBLIC_UPLOAD_BASE_URL,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_WHATSAPP,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_DAYS,
  MODEL_ENABLED,
  PYTHON_BIN,
  TRIAGE_MODEL_SCRIPT,
  TRIAGE_MODEL_FILE,
  TRIAGE_MODEL_META_FILE,
  CORS_ORIGINS,
  PASSWORD_RESET_BASE_URL,
  PASSWORD_RESET_OUTBOX_PATH,
  PASSWORD_RESET_OTP_OUTBOX_PATH,
  OTP_DELIVERY_WEBHOOK_URL,
  OTP_DELIVERY_WEBHOOK_AUTH,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  OTP_LENGTH,
  OTP_EXPIRES_MINUTES,
  LOGIN_RATE_LIMIT_PER_MIN,
  OTP_RATE_LIMIT_PER_MIN,
  IDEMPOTENCY_TTL_MINUTES,
  ALERT_WEBHOOK_URL,
  ALERT_WEBHOOK_AUTH,
  ALERT_COOLDOWN_SECONDS,
  UPTIME_HEARTBEAT_SECONDS,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_ENABLED,
  ABDM_ENABLED,
  ABDM_BASE_URL,
  ABDM_CLIENT_ID,
  ABDM_CLIENT_SECRET,
  ABDM_SESSION_PATH,
  ABDM_ABHA_VERIFY_URL,
  ABDM_ABHA_PROFILE_URL,
  ABDM_TIMEOUT_MS,
  validateRuntimeConfig,
};
