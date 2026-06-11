const createAuthSessionService = ({
  crypto,
  jwt,
  fs,
  path,
  run,
  get,
  nowIso,
  safeJsonParse,
  ensureDir,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_DAYS,
  PASSWORD_RESET_BASE_URL,
  PASSWORD_RESET_OUTBOX_PATH,
  PASSWORD_RESET_OTP_OUTBOX_PATH,
  OTP_DELIVERY_WEBHOOK_URL,
  OTP_DELIVERY_WEBHOOK_AUTH,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  OTP_LENGTH,
}) => {
  const createRefreshToken = () => crypto.randomBytes(48).toString("base64url");
  const hashToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");

  const signAuthToken = (user) =>
    jwt.sign(
      {
        sub: user.id,
        role: user.role || "patient",
        email: user.email,
        tver: Number(user.token_version || 0),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

  const verifyAuthToken = (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  };

  const queuePasswordResetDelivery = async ({ email, token, expiresAt }) => {
    const resetUrl = `${PASSWORD_RESET_BASE_URL.replace(/\/+$/, "")}?email=${encodeURIComponent(
      email,
    )}&token=${encodeURIComponent(token)}`;
    ensureDir(path.dirname(PASSWORD_RESET_OUTBOX_PATH));
    const payload = JSON.stringify({
      type: "password_reset",
      email,
      resetUrl,
      expiresAt,
      createdAt: nowIso(),
    });
    await fs.promises.appendFile(PASSWORD_RESET_OUTBOX_PATH, `${payload}\n`, "utf8");
  };

  const generateOtpCode = () => {
    let code = "";
    for (let i = 0; i < OTP_LENGTH; i += 1) {
      code += String(Math.floor(Math.random() * 10));
    }
    return code;
  };

  const queuePasswordResetOtpDelivery = async ({ email, otp, expiresAt }) => {
    const payload = {
      type: "password_reset_otp",
      channel: "email",
      destination: email,
      otp,
      expiresAt,
      createdAt: nowIso(),
    };

    let webhookDelivered = false;
    let resendDelivered = false;
    if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: [email],
            subject: "SehatSaathi password reset OTP",
            html: `<div style="font-family:Arial,sans-serif">
  <h2>Reset OTP</h2>
  <p>Your OTP is <strong style="font-size:24px;letter-spacing:2px">${otp}</strong></p>
  <p>This OTP expires at ${new Date(expiresAt).toLocaleString()}.</p>
  <p>If you did not request this, ignore this message.</p>
</div>`,
          }),
        });
        resendDelivered = emailResponse.ok;
      } catch (error) {
        resendDelivered = false;
      }
    }

    if (OTP_DELIVERY_WEBHOOK_URL) {
      try {
        const headers = { "Content-Type": "application/json" };
        if (OTP_DELIVERY_WEBHOOK_AUTH) {
          headers.Authorization = `Bearer ${OTP_DELIVERY_WEBHOOK_AUTH}`;
        }
        const response = await fetch(OTP_DELIVERY_WEBHOOK_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        webhookDelivered = response.ok;
      } catch (error) {
        webhookDelivered = false;
      }
    }

    ensureDir(path.dirname(PASSWORD_RESET_OTP_OUTBOX_PATH));
    await fs.promises.appendFile(
      PASSWORD_RESET_OTP_OUTBOX_PATH,
      `${JSON.stringify({ ...payload, webhookDelivered, resendDelivered })}\n`,
      "utf8",
    );
    return { webhookDelivered, resendDelivered };
  };

  const issueSessionTokens = async (user, meta = {}) => {
    const payloadUser = {
      id: user.id,
      email: user.email,
      role: user.role || "patient",
      token_version: user.token_version || 0,
    };
    const accessToken = signAuthToken(payloadUser);
    const refreshToken = createRefreshToken();
    const refreshHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const insert = await run(
      `INSERT INTO auth_sessions
       (user_id, refresh_token_hash, expires_at, revoked_at, user_agent, ip, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        user.id,
        refreshHash,
        expiresAt,
        meta.userAgent || "",
        meta.ip || "",
        nowIso(),
        nowIso(),
      ],
    );
    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
      sessionId: insert.lastID,
    };
  };

  const consumeIdempotencyKey = async ({ userId, routeKey, idempotencyKey, execute }) => {
    if (!idempotencyKey || !String(idempotencyKey).trim()) {
      const fresh = await execute();
      return { replay: false, payload: fresh };
    }
    const key = String(idempotencyKey).trim().slice(0, 120);
    const existing = await get(
      `SELECT status_code, response_json, created_at
       FROM idempotency_keys
       WHERE user_id = ? AND route_key = ? AND idempotency_key = ?`,
      [userId, routeKey, key],
    );
    if (existing) {
      return {
        replay: true,
        payload: safeJsonParse(existing.response_json, { ok: true }),
        statusCode: Number(existing.status_code || 200),
      };
    }
    const fresh = await execute();
    const statusCode = Number(fresh?.statusCode || 200);
    const payload = fresh?.payload ?? fresh;
    await run(
      `INSERT INTO idempotency_keys
       (user_id, route_key, idempotency_key, status_code, response_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, routeKey, key, statusCode, JSON.stringify(payload), nowIso()],
    );
    return { replay: false, payload, statusCode };
  };

  return {
    createRefreshToken,
    hashToken,
    signAuthToken,
    verifyAuthToken,
    queuePasswordResetDelivery,
    generateOtpCode,
    queuePasswordResetOtpDelivery,
    issueSessionTokens,
    consumeIdempotencyKey,
  };
};

module.exports = { createAuthSessionService };
