const registerAnalyticsRoutes = (fastify, deps) => {
  const {
    requireAuth,
    requireAdmin,
    requireOps,
    all,
    get,
    run,
    nowIso,
    safeJsonParse,
  } = deps;
  const compactText = (value, maxLength = 300) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, maxLength);
  const allowedLaunchEvents = new Set([
    "launch_page_viewed",
    "launch_audience_selected",
    "launch_patient_cta_clicked",
    "launch_whatsapp_clicked",
    "launch_pilot_lead_completed",
  ]);
  const isoDateDaysAgo = (days) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - Number(days || 0));
    return date.toISOString().slice(0, 10);
  };
  const todayIsoDate = () => new Date().toISOString().slice(0, 10);

  fastify.post("/api/public/launch-event", async (request, reply) => {
    const body = request.body || {};
    const eventName = compactText(body.eventName, 80);
    if (!allowedLaunchEvents.has(eventName)) {
      return reply.code(400).send({ error: "Unsupported campaign event." });
    }
    const payload = {
      source: compactText(body.source, 80) || "direct",
      campaign: compactText(body.campaign, 80) || "india-launch",
      audience: compactText(body.audience, 30) || "patient",
      path: compactText(body.path, 120) || "/launch",
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    };
    await run(
      `INSERT INTO analytics_events (user_id, event_name, event_payload, created_at)
       VALUES (?, ?, ?, ?)`,
      [null, eventName, JSON.stringify(payload), nowIso()],
    );
    return { ok: true };
  });

  fastify.post("/api/public/pilot-interest", async (request, reply) => {
    const body = request.body || {};
    if (compactText(body.website, 200)) {
      return { ok: true };
    }
    const name = compactText(body.name, 120);
    const organization = compactText(body.organization, 160);
    const phone = compactText(body.phone, 40).replace(/[^\d+]/g, "");
    const email = compactText(body.email, 180).toLowerCase();
    const city = compactText(body.city, 100);
    const organizationType = compactText(body.organizationType, 80);
    const monthlyReports = Math.max(0, Math.min(1000000, Number(body.monthlyReports) || 0));
    if (!body.consent) {
      return reply.code(400).send({ error: "Contact consent is required." });
    }
    if (name.length < 2 || organization.length < 2 || city.length < 2 || organizationType.length < 2) {
      return reply.code(400).send({ error: "Name, organisation, city, and organisation type are required." });
    }
    if (phone.replace(/\D/g, "").length < 10) {
      return reply.code(400).send({ error: "Enter a valid WhatsApp number." });
    }
    if (email && !email.includes("@")) {
      return reply.code(400).send({ error: "Enter a valid work email." });
    }
    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO pilot_interest_leads
       (name, organization, phone, email, city, organization_type, monthly_reports,
        message, source, campaign, status, consent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
      [
        name,
        organization,
        phone,
        email || null,
        city,
        organizationType,
        monthlyReports,
        compactText(body.message, 1200),
        compactText(body.source, 80) || "direct",
        compactText(body.campaign, 80) || "india-launch",
        createdAt,
        createdAt,
      ],
    );
    await run(
      `INSERT INTO analytics_events (user_id, event_name, event_payload, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        null,
        "launch_pilot_lead_created",
        JSON.stringify({
          leadId: result.lastID,
          source: compactText(body.source, 80) || "direct",
          campaign: compactText(body.campaign, 80) || "india-launch",
          organizationType,
          city,
        }),
        createdAt,
      ],
    );
    return { ok: true, leadId: result.lastID };
  });

  fastify.get("/api/admin/pilot-interest", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const leads = await all(
      `SELECT id, name, organization, phone, email, city, organization_type,
              monthly_reports, message, source, campaign, status, consent_at, created_at
       FROM pilot_interest_leads
       ORDER BY datetime(created_at) DESC
       LIMIT 500`,
    );
    return {
      leads: leads.map((row) => ({
        id: row.id,
        name: row.name,
        organization: row.organization,
        phone: row.phone,
        email: row.email || "",
        city: row.city,
        organizationType: row.organization_type,
        monthlyReports: Number(row.monthly_reports || 0),
        message: row.message || "",
        source: row.source || "direct",
        campaign: row.campaign || "india-launch",
        status: row.status,
        consentAt: row.consent_at,
        createdAt: row.created_at,
      })),
    };
  });

  fastify.get("/api/audit/me", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const rows = await all(
      `SELECT request_id, method, path, status_code, response_time_ms, ip, user_agent, created_at
       FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [request.authUser.id],
    );
    return {
      logs: rows.map((row) => ({
        requestId: row.request_id || null,
        method: row.method,
        path: row.path,
        statusCode: row.status_code,
        responseTimeMs: row.response_time_ms,
        ip: row.ip,
        userAgent: row.user_agent,
        createdAt: row.created_at,
      })),
    };
  });

  fastify.get("/api/admin/analytics/overview", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    const [userTotals, triageTotals, shareTotals, doctorViewTotals, ratingTotals, errorTotals, funnelCounts] =
      await Promise.all([
        get("SELECT COUNT(*) AS count FROM users"),
        get("SELECT COUNT(*) AS count FROM triage_logs"),
        get("SELECT COUNT(*) AS count FROM share_passes"),
        get("SELECT COUNT(*) AS count FROM share_access_logs"),
        get("SELECT COUNT(*) AS count FROM doctor_ratings"),
        get(
          `SELECT COUNT(*) AS count FROM error_logs
           WHERE created_at >= ?`,
          [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()],
        ),
        all(
          `SELECT event_name, COUNT(*) AS count
           FROM analytics_events
           WHERE event_name IN (
             'report_upload_started',
             'report_upload_completed',
             'plan_started',
             'timeline_opened',
             'followup_booked',
             'lab_booked',
             'drop_off'
           )
             AND created_at >= ?
           GROUP BY event_name`,
          [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()],
        ),
      ]);

    const latestKpis = await get(
      `SELECT
        COALESCE(SUM(daily_active_users), 0) AS dau30,
        COALESCE(SUM(triage_completed), 0) AS triage30,
        COALESCE(SUM(share_pass_generated), 0) AS sharePass30,
        COALESCE(SUM(doctor_view_opened), 0) AS doctorViews30,
        COALESCE(AVG(seven_day_retention), 0) AS retentionAvg30
       FROM pilot_metrics_daily
       WHERE metric_date >= ?`,
      [isoDateDaysAgo(29)],
    );

    const dailySeries = await all(
      `SELECT metric_date, daily_active_users, triage_completed, share_pass_generated,
              doctor_view_opened, seven_day_retention
       FROM pilot_metrics_daily
       WHERE metric_date >= ?
       ORDER BY metric_date ASC`,
      [isoDateDaysAgo(29)],
    );

    const doctorRatingsBreakdown = await all(
      `SELECT rating, COUNT(*) AS count
       FROM doctor_ratings
       GROUP BY rating`,
    );

    const feedbackEvents = await all(
      `SELECT event_name, event_payload
       FROM analytics_events
       WHERE event_name IN ('triage_helpfulness_feedback', 'visit_happened_followup')
         AND created_at >= ?`,
      [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()],
    );

    const feedback = {
      helpful: 0,
      notHelpful: 0,
      visitHappened: 0,
      noVisitYet: 0,
    };
    for (const row of feedbackEvents) {
      let payload = {};
      if (row.event_payload) {
        payload = safeJsonParse(row.event_payload, {});
      }
      if (row.event_name === "triage_helpfulness_feedback") {
        if (payload.helpful === true) feedback.helpful += 1;
        if (payload.helpful === false) feedback.notHelpful += 1;
      }
      if (row.event_name === "visit_happened_followup") {
        if (payload.visitHappened === true) feedback.visitHappened += 1;
        if (payload.visitHappened === false) feedback.noVisitYet += 1;
      }
    }

    const funnel30d = {
      reportUploadStarted: 0,
      reportUploadCompleted: 0,
      planStarted: 0,
      timelineOpened: 0,
      followupBooked: 0,
      labBooked: 0,
      dropOffs: 0,
    };
    for (const row of funnelCounts || []) {
      const count = Number(row.count || 0);
      if (row.event_name === "report_upload_started") funnel30d.reportUploadStarted = count;
      if (row.event_name === "report_upload_completed") funnel30d.reportUploadCompleted = count;
      if (row.event_name === "plan_started") funnel30d.planStarted = count;
      if (row.event_name === "timeline_opened") funnel30d.timelineOpened = count;
      if (row.event_name === "followup_booked") funnel30d.followupBooked = count;
      if (row.event_name === "lab_booked") funnel30d.labBooked = count;
      if (row.event_name === "drop_off") funnel30d.dropOffs = count;
    }

    return {
      generatedAt: nowIso(),
      totals: {
        users: userTotals?.count || 0,
        triageSessions: triageTotals?.count || 0,
        sharePasses: shareTotals?.count || 0,
        doctorViews: doctorViewTotals?.count || 0,
        doctorRatings: ratingTotals?.count || 0,
        serverErrorsLast7d: errorTotals?.count || 0,
      },
      pilotKpis30d: {
        dailyActiveUsers: latestKpis?.dau30 || 0,
        triageCompleted: latestKpis?.triage30 || 0,
        sharePassGenerated: latestKpis?.sharePass30 || 0,
        doctorViewOpened: latestKpis?.doctorViews30 || 0,
        sevenDayRetentionAvg: Number(Number(latestKpis?.retentionAvg30 || 0).toFixed(2)),
      },
      funnel30d,
      feedback30d: feedback,
      doctorRatingsBreakdown,
      dailySeries,
    };
  });

  fastify.get("/api/admin/ops/dashboard", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const today = todayIsoDate();
    const now = nowIso();

    const [
      todayCounts,
      upcomingAppointments,
      departmentLoad,
      doctorLoad,
      financeSummary,
      marketplaceLoad,
    ] = await Promise.all([
      get(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) AS requested,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) AS checkedIn,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
           SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS noShow
         FROM appointments
         WHERE date(scheduled_at) = ?`,
        [today],
      ),
      all(
        `SELECT a.id, a.status, a.reason, a.scheduled_at, p.name AS patient_name,
                d.name AS doctor_name, dep.name AS department_name
         FROM appointments a
         JOIN users p ON p.id = a.user_id
         LEFT JOIN users d ON d.id = a.doctor_id
         LEFT JOIN departments dep ON dep.id = a.department_id
         WHERE a.scheduled_at >= ?
         ORDER BY a.scheduled_at ASC
         LIMIT 12`,
        [now],
      ),
      all(
        `SELECT COALESCE(dep.name, a.department) AS department_name, COUNT(*) AS total
         FROM appointments a
         LEFT JOIN departments dep ON dep.id = a.department_id
         WHERE date(a.scheduled_at) = ?
         GROUP BY COALESCE(dep.name, a.department)
         ORDER BY total DESC, department_name ASC`,
        [today],
      ),
      all(
        `SELECT COALESCE(d.name, 'Unassigned') AS doctor_name, COUNT(*) AS total
         FROM appointments a
         LEFT JOIN users d ON d.id = a.doctor_id
         WHERE date(a.scheduled_at) = ?
         GROUP BY COALESCE(d.name, 'Unassigned')
         ORDER BY total DESC, doctor_name ASC`,
        [today],
      ),
      get(
        `SELECT
           COALESCE(SUM(
             CASE
               WHEN COALESCE(b.status, 'unpaid') IN ('paid', 'partial') THEN COALESCE(b.amount, 0)
               ELSE 0
             END
           ), 0) AS revenue_today,
           SUM(
             CASE
               WHEN COALESCE(b.status, 'unpaid') IN ('unpaid', 'partial')
                 AND a.status NOT IN ('cancelled', 'no_show')
               THEN 1
               ELSE 0
             END
           ) AS pending_bills
         FROM appointments a
         LEFT JOIN appointment_billing b ON b.appointment_id = a.id
         WHERE date(a.scheduled_at) = ?`,
        [today],
      ),
      all(
        `SELECT request_type, COUNT(*) AS total
         FROM marketplace_requests
         WHERE status NOT IN ('completed', 'cancelled', 'fulfilled', 'rejected', 'unavailable')
         GROUP BY request_type`,
      ),
    ]);

    const marketplaceSummary = {
      lab: 0,
      pharmacy: 0,
    };
    for (const row of marketplaceLoad) {
      if (row.request_type === "lab") marketplaceSummary.lab = Number(row.total || 0);
      if (row.request_type === "pharmacy") marketplaceSummary.pharmacy = Number(row.total || 0);
    }

    return {
      today: {
        total: Number(todayCounts?.total || 0),
        requested: Number(todayCounts?.requested || 0),
        approved: Number(todayCounts?.approved || 0),
        waiting: Number(todayCounts?.requested || 0) + Number(todayCounts?.approved || 0),
        checkedIn: Number(todayCounts?.checkedIn || 0),
        completed: Number(todayCounts?.completed || 0),
        cancelled: Number(todayCounts?.cancelled || 0),
        noShow: Number(todayCounts?.noShow || 0),
      },
      finance: {
        revenueToday: Number(financeSummary?.revenue_today || 0),
        pendingBills: Number(financeSummary?.pending_bills || 0),
      },
      marketplace: {
        activeLabRequests: marketplaceSummary.lab,
        activePharmacyRequests: marketplaceSummary.pharmacy,
      },
      upcomingAppointments,
      departmentLoad,
      doctorLoad,
    };
  });

  fastify.get("/api/metrics/pilot", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const rows = await all(
      `SELECT metric_date, daily_active_users, triage_completed, share_pass_generated,
              doctor_view_opened, seven_day_retention
       FROM pilot_metrics_daily
       ORDER BY metric_date DESC
       LIMIT 30`,
    );
    return { metrics: rows };
  });

  fastify.get("/api/ops/errors", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const rows = await all(
      `SELECT request_id, method, path, status_code, error_message, created_at
       FROM error_logs ORDER BY created_at DESC LIMIT 100`,
    );
    return {
      errors: rows.map((row) => ({
        requestId: row.request_id || null,
        method: row.method,
        path: row.path,
        statusCode: row.status_code,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
    };
  });
};

module.exports = { registerAnalyticsRoutes };
