const registerSystemRoutes = (fastify, deps) => {
  const {
    NODE_ENV,
    STARTED_AT,
    DB_PROVIDER,
    nowIso,
    requireAuth,
    MODEL_ENABLED,
    TRIAGE_MODEL_SCRIPT,
    TRIAGE_MODEL_FILE,
    TRIAGE_MODEL_META_FILE,
    safeJsonParse,
    fs,
    get,
    run,
    all,
    sendOpsAlert,
  } = deps;

  fastify.get("/", async () => ({
    service: "SehatSaathi API",
    status: "ok",
    environment: NODE_ENV,
    startedAt: STARTED_AT,
  }));

  fastify.get("/api/health", async () => ({
    status: "ok",
    startedAt: STARTED_AT,
    uptimeSec: Math.floor((Date.now() - Date.parse(STARTED_AT)) / 1000),
    dbProvider: DB_PROVIDER,
    timestamp: nowIso(),
  }));

  fastify.get("/api/ops/uptime", async () => ({
    status: "ok",
    startedAt: STARTED_AT,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: nowIso(),
  }));

  fastify.get("/api/triage/model/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (request.authUser.role !== "admin") {
      return reply.code(403).send({ error: "Admin access required." });
    }

    const ready = MODEL_ENABLED && fs.existsSync(TRIAGE_MODEL_SCRIPT) && fs.existsSync(TRIAGE_MODEL_FILE);
    const metadata = fs.existsSync(TRIAGE_MODEL_META_FILE)
      ? safeJsonParse(fs.readFileSync(TRIAGE_MODEL_META_FILE, "utf8"), null)
      : null;
    return {
      enabled: MODEL_ENABLED,
      ready,
      scriptPath: TRIAGE_MODEL_SCRIPT,
      modelPath: TRIAGE_MODEL_FILE,
      metadata,
    };
  });

  fastify.get("/api/stats/live", async () => {
    const [users, triage, doctorViews, activeToday] = await Promise.all([
      get("SELECT COUNT(*) AS count FROM users"),
      get("SELECT COUNT(*) AS count FROM triage_logs"),
      get("SELECT COUNT(*) AS count FROM share_access_logs"),
      get(
        `SELECT COALESCE(daily_active_users, 0) AS count
         FROM pilot_metrics_daily
         WHERE metric_date = date('now')
         LIMIT 1`,
      ),
    ]);

    return {
      generatedAt: nowIso(),
      totals: {
        users: users?.count || 0,
        triageCompleted: triage?.count || 0,
        doctorViews: doctorViews?.count || 0,
        activeUsersToday: activeToday?.count || 0,
      },
    };
  });

  fastify.post("/api/client-errors", async (request, reply) => {
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const message = String(body.message || "").trim().slice(0, 2000);
    if (!message) {
      return reply.code(400).send({ error: "Error message is required." });
    }

    const source = String(body.source || "frontend").trim().slice(0, 64) || "frontend";
    const severity = String(body.severity || "error").trim().slice(0, 32) || "error";
    const fingerprint = String(body.fingerprint || `${source}:${message}`).trim().slice(0, 255);
    const stack = body.stack ? String(body.stack).slice(0, 20000) : null;
    const componentStack = body.componentStack ? String(body.componentStack).slice(0, 20000) : null;
    const url = body.url ? String(body.url).slice(0, 2000) : request.headers.referer || null;
    const userAgent = request.headers["user-agent"] || null;
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const createdAt = nowIso();

    await run(
      `INSERT INTO client_error_logs
       (user_id, request_id, fingerprint, source, severity, message, stack, component_stack, url, user_agent, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.authUser?.id || null,
        request.requestId || request.id || null,
        fingerprint,
        source,
        severity,
        message,
        stack,
        componentStack,
        url,
        userAgent,
        JSON.stringify(metadata),
        createdAt,
      ],
    );

    const recentMatches = await all(
      `SELECT id
       FROM client_error_logs
       WHERE fingerprint = ?
         AND created_at >= datetime('now', '-15 minutes')
       ORDER BY created_at DESC
       LIMIT 5`,
      [fingerprint],
    );

    if ((recentMatches?.length || 0) >= 3) {
      await sendOpsAlert({
        key: `client-crash:${fingerprint}`,
        severity: "error",
        message: "Repeated client-side crash detected",
        context: {
          fingerprint,
          source,
          count15Min: recentMatches.length,
          latestMessage: message,
          url,
        },
      });
    }

    return reply.code(202).send({ ok: true });
  });
};

module.exports = { registerSystemRoutes };
