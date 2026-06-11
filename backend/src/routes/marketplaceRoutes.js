const registerMarketplaceRoutes = (fastify, deps) => {
  const {
    requireAuth,
    all,
    get,
    run,
    nowIso,
    safeJsonParse,
    consumeIdempotencyKey,
    getFamilyMember,
    isOpsRole,
    enqueueAndDeliverUserNotification,
    buildMarketplaceFallbackOptions,
    createMarketplaceRequestTimeline,
  } = deps;
  const MARKETPLACE_TRANSITIONS = {
    requested: new Set(["accepted", "cancelled", "rejected", "unavailable"]),
    accepted: new Set(["sample_collected", "processing", "out_for_delivery", "ready_for_pickup", "completed", "cancelled", "rejected", "unavailable"]),
    sample_collected: new Set(["processing", "completed", "cancelled", "rejected", "unavailable"]),
    processing: new Set(["out_for_delivery", "ready_for_pickup", "completed", "cancelled", "rejected", "unavailable"]),
    out_for_delivery: new Set(["completed", "cancelled"]),
    ready_for_pickup: new Set(["completed", "cancelled"]),
    completed: new Set([]),
    cancelled: new Set([]),
    rejected: new Set([]),
    unavailable: new Set([]),
  };

  const canTransitionMarketplaceStatus = (fromStatus, toStatus) => {
    const from = String(fromStatus || "").trim().toLowerCase();
    const to = String(toStatus || "").trim().toLowerCase();
    if (!from || !to) return false;
    if (from === to) return true;
    return MARKETPLACE_TRANSITIONS[from]?.has(to) || false;
  };

  fastify.get("/api/marketplace/labs", async (request) => {
    const mode = String(request.query?.mode || "all");
    const area = String(request.query?.area || "all").trim();
    const areaFilterSql = area && area !== "all" ? "AND lower(COALESCE(area_label,'')) = lower(?)" : "";
    const areaParams = area && area !== "all" ? [area] : [];

    const packageRows = await all(
      `SELECT id, partner_name, package_name AS item_name, price, home_visit_price, home_collection_available,
              eta_minutes, eta_sla_minutes, distance_km, area_label, price_last_updated_at, 'package' AS item_type
       FROM lab_packages
       WHERE active = 1 ${areaFilterSql}`,
      areaParams,
    );
    const testRows = await all(
      `SELECT id, partner_name, test_name AS item_name, price, home_visit_price, home_collection_available,
              eta_minutes, eta_sla_minutes, distance_km, area_label, price_last_updated_at, 'test' AS item_type
       FROM lab_tests
       WHERE active = 1 ${areaFilterSql}`,
      areaParams,
    );

    const allRows = [...packageRows, ...testRows].sort((a, b) => {
      const aPrice = mode === "home" && a.home_visit_price !== null ? a.home_visit_price : a.price;
      const bPrice = mode === "home" && b.home_visit_price !== null ? b.home_visit_price : b.price;
      if (aPrice !== bPrice) return aPrice - bPrice;
      if ((a.distance_km || 0) !== (b.distance_km || 0)) return (a.distance_km || 0) - (b.distance_km || 0);
      return (a.eta_minutes || 0) - (b.eta_minutes || 0);
    });

    const areas = Array.from(
      new Set(
        allRows
          .map((row) => String(row.area_label || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const byLab = new Map();
    for (const row of allRows) {
      const key = `${row.partner_name}__${row.area_label || ""}`;
      if (!byLab.has(key)) {
        byLab.set(key, {
          lab_id: row.id,
          partner_name: row.partner_name,
          area_label: row.area_label || "Nearby",
          distance_km: row.distance_km,
          eta_minutes: row.eta_minutes,
          eta_sla_minutes: row.eta_sla_minutes || row.eta_minutes || null,
          price_last_updated_at: row.price_last_updated_at || row.created_at || null,
          home_collection_available: Number(row.home_collection_available) === 1,
          tests: [],
          packages: [],
        });
      }
      const lab = byLab.get(key);
      lab.home_collection_available =
        lab.home_collection_available || Number(row.home_collection_available) === 1;
      if (lab.distance_km == null || (row.distance_km != null && row.distance_km < lab.distance_km)) {
        lab.distance_km = row.distance_km;
      }
      if (lab.eta_minutes == null || (row.eta_minutes != null && row.eta_minutes < lab.eta_minutes)) {
        lab.eta_minutes = row.eta_minutes;
      }
      if (
        lab.eta_sla_minutes == null ||
        (row.eta_sla_minutes != null && Number(row.eta_sla_minutes) > Number(lab.eta_sla_minutes))
      ) {
        lab.eta_sla_minutes = row.eta_sla_minutes || row.eta_minutes || lab.eta_sla_minutes;
      }
      if (row.price_last_updated_at && (!lab.price_last_updated_at || row.price_last_updated_at > lab.price_last_updated_at)) {
        lab.price_last_updated_at = row.price_last_updated_at;
      }
      const item = {
        id: row.id,
        service_name: row.item_name,
        price: row.price,
        home_visit_price: row.home_visit_price,
        eta_sla_minutes: row.eta_sla_minutes || row.eta_minutes || null,
        price_last_updated_at: row.price_last_updated_at || null,
        home_collection_available: Number(row.home_collection_available) === 1,
        effective_price: mode === "home" && row.home_visit_price !== null ? row.home_visit_price : row.price,
      };
      if (row.item_type === "test") lab.tests.push(item);
      else lab.packages.push(item);
    }

    const labs = Array.from(byLab.values())
      .map((lab) => {
        const pricePool = [...lab.tests, ...lab.packages];
        const minInPerson = pricePool.length ? Math.min(...pricePool.map((i) => Number(i.price) || 0)) : 0;
        const homePrices = pricePool
          .map((i) => (i.home_visit_price === null ? null : Number(i.home_visit_price)))
          .filter((i) => i !== null);
        const minHome = homePrices.length ? Math.min(...homePrices) : null;
        lab.tests.sort((a, b) => (a.effective_price || 0) - (b.effective_price || 0));
        lab.packages.sort((a, b) => (a.effective_price || 0) - (b.effective_price || 0));
        return {
          ...lab,
          starting_price: minInPerson,
          home_starting_price: minHome,
        };
      })
      .sort((a, b) => {
        const aPrice = mode === "home" && a.home_starting_price !== null ? a.home_starting_price : a.starting_price;
        const bPrice = mode === "home" && b.home_starting_price !== null ? b.home_starting_price : b.starting_price;
        if (aPrice !== bPrice) return aPrice - bPrice;
        if ((a.distance_km || 0) !== (b.distance_km || 0)) return (a.distance_km || 0) - (b.distance_km || 0);
        return (a.eta_minutes || 0) - (b.eta_minutes || 0);
      });

    return { labs, areas };
  });

  fastify.get("/api/marketplace/pharmacies", async (request) => {
    const mode = String(request.query?.mode || "delivery");
    const rows = await all(
      `SELECT id, partner_name, area_label, medicine_price_note, delivery_fee, eta_minutes, eta_sla_minutes, distance_km, price_last_updated_at,
              home_delivery_available, pickup_available
       FROM pharmacy_partners
       WHERE active = 1
       ORDER BY
         CASE WHEN ? = 'home_delivery' THEN delivery_fee ELSE 0 END ASC,
         distance_km ASC,
         eta_minutes ASC`,
      [mode],
    );
    return {
      pharmacies: rows.map((row) => ({
        ...row,
        eta_sla_minutes: row.eta_sla_minutes || row.eta_minutes || null,
        home_delivery_available: Number(row.home_delivery_available) === 1,
        pickup_available: Number(row.pickup_available) === 1,
      })),
    };
  });

  fastify.get("/api/marketplace/requests", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const rows = await all(
      `SELECT id, request_type, partner_id, service_name, fulfillment_mode, listed_price, status, fallback_options_json, notes, created_at, updated_at
       FROM marketplace_requests
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [request.authUser.id],
    );
    return {
      requests: rows.map((row) => ({
        ...row,
        fallback_options: row.fallback_options_json ? safeJsonParse(row.fallback_options_json, []) : [],
      })),
    };
  });

  fastify.get("/api/admin/marketplace/requests", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!(isOpsRole(request.authUser.role) || request.authUser.role === "admin")) {
      return reply.code(403).send({ error: "Ops access required." });
    }
    const requestType = String(request.query?.requestType || "all").trim().toLowerCase();
    const status = String(request.query?.status || "all").trim().toLowerCase();
    const rows = await all(
      `SELECT mr.id, mr.user_id, mr.member_id, mr.request_type, mr.partner_id, mr.service_name, mr.fulfillment_mode,
              mr.listed_price, mr.status, mr.fallback_options_json, mr.notes, mr.created_at, mr.updated_at,
              u.patient_uid, u.name AS patient_name, u.email AS patient_email, fm.name AS member_name
       FROM marketplace_requests mr
       JOIN users u ON u.id = mr.user_id
       LEFT JOIN family_members fm ON fm.id = mr.member_id
       WHERE (? = 'all' OR mr.request_type = ?)
         AND (? = 'all' OR mr.status = ?)
       ORDER BY mr.created_at DESC
       LIMIT 300`,
      [requestType, requestType, status, status],
    );
    return {
      requests: rows.map((row) => ({
        ...row,
        fallback_options: row.fallback_options_json ? safeJsonParse(row.fallback_options_json, []) : [],
      })),
    };
  });

  fastify.get("/api/marketplace/analytics", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const rows = await all(
      `SELECT id, request_type, status, created_at, updated_at
       FROM marketplace_requests
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [request.authUser.id],
    );
    if (!rows.length) {
      return {
        overall: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
        lab: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
        pharmacy: { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 },
      };
    }

    const completionRows = await all(
      `SELECT t.request_id, t.created_at
       FROM marketplace_request_timeline t
       INNER JOIN marketplace_requests r ON r.id = t.request_id
       WHERE r.user_id = ?
         AND t.to_status IN ('completed', 'fulfilled')
       ORDER BY t.created_at ASC`,
      [request.authUser.id],
    );
    const completionByRequestId = new Map();
    for (const row of completionRows) {
      if (!completionByRequestId.has(Number(row.request_id))) {
        completionByRequestId.set(Number(row.request_id), row.created_at);
      }
    }

    const calc = (subset) => {
      const total = subset.length;
      if (!total) {
        return { totalRequests: 0, conversionRate: 0, cancelRate: 0, avgFulfillmentMinutes: 0 };
      }
      const completed = subset.filter((row) => ["completed", "fulfilled"].includes(String(row.status || "")));
      const cancelled = subset.filter((row) => ["cancelled", "rejected", "unavailable"].includes(String(row.status || "")));
      const fulfillmentMinutes = completed
        .map((row) => {
          const completedAt = completionByRequestId.get(Number(row.id)) || row.updated_at || null;
          if (!completedAt || !row.created_at) return null;
          const start = new Date(row.created_at).getTime();
          const end = new Date(completedAt).getTime();
          if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
          return Math.round((end - start) / 60000);
        })
        .filter((value) => Number.isFinite(value));
      const avgFulfillment =
        fulfillmentMinutes.length > 0
          ? Math.round(fulfillmentMinutes.reduce((sum, value) => sum + value, 0) / fulfillmentMinutes.length)
          : 0;
      const percent = (part) => Number(((part / total) * 100).toFixed(1));
      return {
        totalRequests: total,
        conversionRate: percent(completed.length),
        cancelRate: percent(cancelled.length),
        avgFulfillmentMinutes: avgFulfillment,
      };
    };

    const labs = rows.filter((row) => row.request_type === "lab");
    const pharmacies = rows.filter((row) => row.request_type === "pharmacy");
    return {
      overall: calc(rows),
      lab: calc(labs),
      pharmacy: calc(pharmacies),
    };
  });

  fastify.get("/api/marketplace/requests/:requestId/timeline", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const requestId = Number(request.params.requestId);
    if (!requestId) return reply.code(400).send({ error: "Invalid request id." });
    const requestRow = await get(
      "SELECT id, user_id, request_type, status, created_at FROM marketplace_requests WHERE id = ?",
      [requestId],
    );
    if (!requestRow) return reply.code(404).send({ error: "Request not found." });
    const isOwner = Number(requestRow.user_id) === Number(request.authUser.id);
    const opsAccess = isOpsRole(request.authUser.role) || request.authUser.role === "admin";
    if (!isOwner && !opsAccess) {
      return reply.code(403).send({ error: "Forbidden." });
    }
    const rows = await all(
      `SELECT t.id, t.event_type, t.from_status, t.to_status, t.note, t.metadata_json, t.created_at,
              u.name AS actor_name, u.role AS actor_role
       FROM marketplace_request_timeline t
       LEFT JOIN users u ON u.id = t.actor_user_id
       WHERE t.request_id = ?
       ORDER BY t.created_at ASC`,
      [requestId],
    );
    return {
      request: {
        id: requestRow.id,
        requestType: requestRow.request_type,
        status: requestRow.status,
        createdAt: requestRow.created_at,
      },
      timeline: rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        note: row.note,
        metadata: row.metadata_json ? safeJsonParse(row.metadata_json, {}) : {},
        actorName: row.actor_name || null,
        actorRole: row.actor_role || null,
        createdAt: row.created_at,
      })),
    };
  });

  fastify.post("/api/marketplace/requests", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const idempotencyKey = request.headers["idempotency-key"];
    const {
      requestType = "",
      partnerId = null,
      fulfillmentMode = "",
      serviceName = "",
      listedPrice = 0,
      memberId = null,
      notes = "",
    } = request.body || {};

    if (!["lab", "pharmacy"].includes(requestType)) {
      return reply.code(400).send({ error: "requestType must be lab or pharmacy." });
    }
    if (!partnerId || !serviceName || !fulfillmentMode) {
      return reply.code(400).send({ error: "partnerId, serviceName, and fulfillmentMode are required." });
    }
    if (
      (requestType === "lab" && !["home_visit", "in_person"].includes(fulfillmentMode)) ||
      (requestType === "pharmacy" && !["home_delivery", "pickup"].includes(fulfillmentMode))
    ) {
      return reply.code(400).send({ error: "Invalid fulfillment mode." });
    }
    if (memberId) {
      const member = await getFamilyMember(request.authUser.id, Number(memberId));
      if (!member) {
        return reply.code(404).send({ error: "Selected family member not found." });
      }
    }

    const executed = await consumeIdempotencyKey({
      userId: request.authUser.id,
      routeKey: "marketplace:create",
      idempotencyKey,
      execute: async () => {
        const createdAt = nowIso();
        const result = await run(
          `INSERT INTO marketplace_requests
           (user_id, member_id, request_type, partner_id, service_name, fulfillment_mode, listed_price, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?)`,
          [
            request.authUser.id,
            memberId ? Number(memberId) : null,
            requestType,
            Number(partnerId),
            serviceName,
            fulfillmentMode,
            Number(listedPrice) || 0,
            notes || null,
            createdAt,
            createdAt,
          ],
        );
        const requestRow = await get(
          `SELECT id, request_type, partner_id, service_name, fulfillment_mode, listed_price, status, fallback_options_json, notes, created_at, updated_at
           FROM marketplace_requests
           WHERE id = ?`,
          [result.lastID],
        );
        await createMarketplaceRequestTimeline({
          requestId: result.lastID,
          actorUserId: request.authUser.id,
          eventType: "created",
          fromStatus: null,
          toStatus: "requested",
          note: "Request created by patient.",
          metadata: {
            requestType,
            partnerId: Number(partnerId),
            serviceName,
            fulfillmentMode,
            listedPrice: Number(listedPrice) || 0,
          },
        });
        return {
          request: {
            ...requestRow,
            fallback_options: requestRow?.fallback_options_json
              ? safeJsonParse(requestRow.fallback_options_json, [])
              : [],
          },
        };
      },
    });
    return executed.payload;
  });

  fastify.patch("/api/marketplace/requests/:requestId/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const requestId = Number(request.params.requestId);
    const { status = "" } = request.body || {};
    const allowedStatuses = new Set([
      "requested",
      "accepted",
      "sample_collected",
      "processing",
      "out_for_delivery",
      "ready_for_pickup",
      "completed",
      "cancelled",
      "rejected",
      "unavailable",
    ]);
    if (!requestId || !allowedStatuses.has(status)) {
      return reply.code(400).send({ error: "Invalid request status update." });
    }
    const requestRow = await get(
      "SELECT id, user_id, request_type, partner_id, service_name, fulfillment_mode, status FROM marketplace_requests WHERE id = ?",
      [requestId],
    );
    if (!requestRow) return reply.code(404).send({ error: "Request not found." });
    const isOwner = Number(requestRow.user_id) === Number(request.authUser.id);
    const opsAccess = isOpsRole(request.authUser.role) || request.authUser.role === "admin";
    if (!isOwner && !opsAccess) {
      return reply.code(403).send({ error: "Forbidden." });
    }
    if (isOwner && status !== "cancelled") {
      return reply.code(403).send({ error: "Patients can only cancel marketplace requests." });
    }
    if (!canTransitionMarketplaceStatus(requestRow.status, status)) {
      return reply.code(409).send({
        error: `Invalid marketplace transition: ${String(requestRow.status || "").toLowerCase()} -> ${status}.`,
      });
    }
    let fallbackOptions = [];
    if (!isOwner && (status === "rejected" || status === "unavailable")) {
      fallbackOptions = await buildMarketplaceFallbackOptions({
        requestType: requestRow.request_type,
        partnerId: requestRow.partner_id,
        fulfillmentMode: requestRow.fulfillment_mode,
        serviceName: requestRow.service_name,
      });
    }
    await run(
      "UPDATE marketplace_requests SET status = ?, fallback_options_json = ?, updated_at = ? WHERE id = ?",
      [status, fallbackOptions.length ? JSON.stringify(fallbackOptions) : null, nowIso(), requestId],
    );
    await createMarketplaceRequestTimeline({
      requestId,
      actorUserId: request.authUser.id,
      eventType: "status_changed",
      fromStatus: requestRow.status,
      toStatus: status,
      note: `${isOwner ? "Patient" : "Hospital team"} updated request status.`,
      metadata: {
        requestType: requestRow.request_type,
        actorRole: request.authUser.role,
        updatedBy: request.authUser.name || request.authUser.email || "User",
        fallbackCount: fallbackOptions.length,
      },
    });
    if (!isOwner) {
      const readable = status.replace(/_/g, " ");
      const fallbackSuffix =
        fallbackOptions.length > 0 ? ` ${fallbackOptions.length} fallback option(s) are ready.` : "";
      await enqueueAndDeliverUserNotification({
        userId: Number(requestRow.user_id),
        type: "marketplace_status",
        title: `${requestRow.request_type === "lab" ? "Lab" : "Pharmacy"} request update`,
        message: `Your ${requestRow.request_type === "lab" ? "lab" : "pharmacy"} request is now ${readable}.${fallbackSuffix}`,
        relatedId: requestId,
        eventKey: `marketplace:${requestId}:status:${status}`,
      });
    }
    return { ok: true };
  });

  fastify.patch("/api/admin/marketplace/requests/:requestId/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!(isOpsRole(request.authUser.role) || request.authUser.role === "admin")) {
      return reply.code(403).send({ error: "Ops access required." });
    }
    const requestId = Number(request.params.requestId);
    const { status = "", note = "" } = request.body || {};
    const allowedStatuses = new Set([
      "requested",
      "accepted",
      "sample_collected",
      "processing",
      "out_for_delivery",
      "ready_for_pickup",
      "completed",
      "cancelled",
      "rejected",
      "unavailable",
    ]);
    if (!requestId || !allowedStatuses.has(status)) {
      return reply.code(400).send({ error: "Invalid request status update." });
    }
    const requestRow = await get(
      "SELECT id, user_id, request_type, partner_id, service_name, fulfillment_mode, status FROM marketplace_requests WHERE id = ?",
      [requestId],
    );
    if (!requestRow) return reply.code(404).send({ error: "Request not found." });
    if (!canTransitionMarketplaceStatus(requestRow.status, status)) {
      return reply.code(409).send({
        error: `Invalid marketplace transition: ${String(requestRow.status || "").toLowerCase()} -> ${status}.`,
      });
    }
    let fallbackOptions = [];
    if (status === "rejected" || status === "unavailable") {
      fallbackOptions = await buildMarketplaceFallbackOptions({
        requestType: requestRow.request_type,
        partnerId: requestRow.partner_id,
        fulfillmentMode: requestRow.fulfillment_mode,
        serviceName: requestRow.service_name,
      });
    }
    await run(
      "UPDATE marketplace_requests SET status = ?, fallback_options_json = ?, updated_at = ? WHERE id = ?",
      [status, fallbackOptions.length ? JSON.stringify(fallbackOptions) : null, nowIso(), requestId],
    );
    await createMarketplaceRequestTimeline({
      requestId,
      actorUserId: request.authUser.id,
      eventType: "status_changed",
      fromStatus: requestRow.status,
      toStatus: status,
      note: String(note || "").trim() || "Marketplace request updated by operations.",
      metadata: {
        requestType: requestRow.request_type,
        actorRole: request.authUser.role,
        updatedBy: request.authUser.name || request.authUser.email || "Ops user",
        fallbackCount: fallbackOptions.length,
      },
    });
    const readable = status.replace(/_/g, " ");
    const fallbackSuffix =
      fallbackOptions.length > 0 ? ` ${fallbackOptions.length} fallback option(s) are ready.` : "";
    await enqueueAndDeliverUserNotification({
      userId: Number(requestRow.user_id),
      type: "marketplace_status",
      title: `${requestRow.request_type === "lab" ? "Lab" : "Pharmacy"} request update`,
      message: `Your ${requestRow.request_type === "lab" ? "lab" : "pharmacy"} request is now ${readable}.${fallbackSuffix}`,
      relatedId: requestId,
      eventKey: `marketplace:${requestId}:ops-status:${status}`,
    });
    return { ok: true };
  });
};

module.exports = { registerMarketplaceRoutes };
