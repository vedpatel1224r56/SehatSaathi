const registerAppointmentRoutes = (fastify, deps) => {
  const {
    requireAuth,
    requireAdmin,
    requireOps,
    all,
    get,
    run,
    nowIso,
    consumeIdempotencyKey,
    getFamilyMember,
    isDoctorRole,
    isOpsRole,
    canAccessConsult,
    getDoctorSchedules,
    buildDoctorSlots,
    normalizeAppointmentStatus,
    canTransitionAppointmentStatus,
    createAppointmentTimeline,
    enqueueAndDeliverUserNotification,
    hospitalSettingsService,
    getAllowedVisitTypeCodes,
    paymentGatewayService,
    safeJsonParse,
    crypto,
    verifyAuthToken,
    getUserById,
    markDailyActive,
  } = deps;

  const APPOINTMENT_ALLOWED_STATUSES = new Set([
    "requested",
    "approved",
    "checked_in",
    "completed",
    "cancelled",
    "no_show",
  ]);
  const BILLING_ALLOWED_STATUSES = new Set(["unpaid", "paid", "partial", "waived"]);
  const PAYMENT_REFERENCE_TYPES = new Set(["appointment", "teleconsult"]);
  const teleconsultEventStreams = new Map();
  const indiaDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const TELEMEDICINE_PROVIDER = String(process.env.TELEMEDICINE_PROVIDER || "").trim().toLowerCase();
  const DAILY_API_KEY = String(process.env.DAILY_API_KEY || "").trim();
  const DAILY_BASE_URL = String(process.env.DAILY_BASE_URL || "").trim().replace(/\/+$/, "");
  const WEBRTC_STUN_URLS = String(process.env.WEBRTC_STUN_URLS || "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const WEBRTC_TURN_URLS = String(process.env.WEBRTC_TURN_URLS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const WEBRTC_TURN_USERNAME = String(process.env.WEBRTC_TURN_USERNAME || "").trim();
  const WEBRTC_TURN_CREDENTIAL = String(process.env.WEBRTC_TURN_CREDENTIAL || "").trim();
  const WEBRTC_ICE_TRANSPORT_POLICY = String(process.env.WEBRTC_ICE_TRANSPORT_POLICY || "").trim().toLowerCase();

  const getIndiaSlotParts = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = indiaDateTimeFormatter.formatToParts(date);
    const lookup = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    if (!lookup.year || !lookup.month || !lookup.day || !lookup.hour || !lookup.minute) return null;
    return {
      dateText: `${lookup.year}-${lookup.month}-${lookup.day}`,
      timeText: `${lookup.hour}:${lookup.minute}`,
    };
  };

  const buildRtcConfiguration = () => {
    const iceServers = [];
    if (WEBRTC_STUN_URLS.length) {
      iceServers.push({ urls: WEBRTC_STUN_URLS });
    }
    if (WEBRTC_TURN_URLS.length) {
      iceServers.push({
        urls: WEBRTC_TURN_URLS,
        ...(WEBRTC_TURN_USERNAME ? { username: WEBRTC_TURN_USERNAME } : {}),
        ...(WEBRTC_TURN_CREDENTIAL ? { credential: WEBRTC_TURN_CREDENTIAL } : {}),
      });
    }
    return {
      iceServers,
      ...(WEBRTC_ICE_TRANSPORT_POLICY === "relay" ? { iceTransportPolicy: "relay" } : {}),
    };
  };

  const sendSseEvent = (stream, event, payload) => {
    try {
      stream.write(`event: ${event}\n`);
      stream.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // caller cleans up dead streams
    }
  };

  const broadcastTeleconsultEvent = (consultId, event, payload) => {
    const listeners = teleconsultEventStreams.get(Number(consultId));
    if (!listeners?.size) return;
    for (const stream of Array.from(listeners)) {
      try {
        sendSseEvent(stream, event, payload);
      } catch {
        listeners.delete(stream);
      }
    }
    if (listeners.size === 0) {
      teleconsultEventStreams.delete(Number(consultId));
    }
  };

  const authenticateTeleconsultStream = async (request) => {
    const authHeader = request.headers.authorization || "";
    const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    const queryToken = String(request.query?.token || "").trim();
    const token = queryToken || headerToken;
    const payload = token ? verifyAuthToken(token) : null;
    if (!payload?.sub) return null;
    const user = await getUserById(payload.sub);
    const tokenVersionMatches =
      payload.tver === undefined || Number(payload.tver) === Number(user?.token_version || 0);
    if (!user || Number(user.active) !== 1 || !tokenVersionMatches) return null;
    await markDailyActive(user.id);
    return user;
  };

  const normalizeAmount = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
  };

  const resolveConsultFee = (doctorRow, mode = "in_person") => {
    const normalizedMode = String(mode || "in_person").toLowerCase();
    if (normalizedMode === "chat") return normalizeAmount(doctorRow?.chat_fee);
    if (normalizedMode === "video") return normalizeAmount(doctorRow?.video_fee);
    if (normalizedMode === "audio") return normalizeAmount(doctorRow?.audio_fee);
    return normalizeAmount(doctorRow?.in_person_fee);
  };

  const buildJitsiMeetingUrl = (consultId, mode) => {
    const normalizedMode = String(mode || "").trim().toLowerCase();
    if (!consultId || !["audio", "video"].includes(normalizedMode)) return null;
    const configSuffix =
      normalizedMode === "audio"
        ? "#config.startWithVideoMuted=true&config.prejoinPageEnabled=false&config.disableDeepLinking=true"
        : "#config.prejoinPageEnabled=false&config.disableDeepLinking=true";
    return `https://meet.jit.si/SehatSaathi-Consult-${consultId}${configSuffix}`;
  };

  const buildTeleconsultMeetingUrl = (consultId, mode) => {
    const normalizedMode = String(mode || "").trim().toLowerCase();
    if (!consultId || !["audio", "video"].includes(normalizedMode)) return null;
    if (TELEMEDICINE_PROVIDER === "jitsi") {
      return buildJitsiMeetingUrl(consultId, normalizedMode);
    }
    return null;
  };

  const buildDailyRoomName = (consultId, mode) =>
    `sehatsaathi-consult-${String(mode || "video").trim().toLowerCase()}-${consultId}`;

  const buildDailyFallbackUrl = (consultId, mode) => {
    if (!DAILY_BASE_URL) return null;
    return `${DAILY_BASE_URL}/${buildDailyRoomName(consultId, mode)}`;
  };

  const getTelemedicineProvider = () => {
    if (TELEMEDICINE_PROVIDER) return TELEMEDICINE_PROVIDER;
    if (DAILY_API_KEY && DAILY_BASE_URL) return "daily";
    return "jitsi";
  };

  const createDailyMeetingRoom = async (consultId, mode) => {
    if (!DAILY_API_KEY || !DAILY_BASE_URL) return null;
    const roomName = buildDailyRoomName(consultId, mode);
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
    const endpoint = "https://api.daily.co/v1/rooms";
    const createResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "public",
        properties: {
          enable_chat: true,
          enable_prejoin_ui: false,
          eject_at_room_exp: true,
          exp,
          start_video_off: String(mode || "").toLowerCase() === "audio",
        },
      }),
    });

    if (createResponse.ok) {
      const created = await createResponse.json();
      return String(created?.url || buildDailyFallbackUrl(consultId, mode) || "").trim() || null;
    }

    if (createResponse.status === 409) {
      return buildDailyFallbackUrl(consultId, mode);
    }

    const errorBody = await createResponse.text().catch(() => "");
    fastify.log?.warn?.(
      {
        consultId,
        mode,
        statusCode: createResponse.status,
        body: errorBody,
      },
      "daily_room_create_failed",
    );
    return null;
  };

  const ensureTeleconsultMeetingUrl = async (consultId, mode, existingUrl = "") => {
    const normalizedMode = String(mode || "").trim().toLowerCase();
    if (!consultId || !["audio", "video"].includes(normalizedMode)) return null;
    const current = String(existingUrl || "").trim();
    if (current) return current;

    const provider = getTelemedicineProvider();
    if (provider === "daily") {
      const dailyUrl = await createDailyMeetingRoom(consultId, normalizedMode);
      if (dailyUrl) return dailyUrl;
      return null;
    }
    if (provider === "jitsi") {
      return buildJitsiMeetingUrl(consultId, normalizedMode);
    }
    return null;
  };

  const upsertAppointmentBilling = async ({
    appointmentId,
    amount,
    status = "unpaid",
    paymentMethod = null,
    notes = null,
    gatewayOrderId = null,
    gatewayPaymentId = null,
    gatewaySignature = null,
    createdBy = null,
  }) => {
    const timestamp = nowIso();
    await run(
      `INSERT INTO appointment_billing
       (appointment_id, amount, status, payment_method, notes, gateway_order_id, gateway_payment_id, gateway_signature, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(appointment_id) DO UPDATE SET
         amount = excluded.amount,
         status = excluded.status,
         payment_method = excluded.payment_method,
         notes = excluded.notes,
         gateway_order_id = excluded.gateway_order_id,
         gateway_payment_id = excluded.gateway_payment_id,
         gateway_signature = excluded.gateway_signature,
         created_by = excluded.created_by,
         updated_at = excluded.updated_at`,
      [
        appointmentId,
        normalizeAmount(amount),
        status,
        paymentMethod,
        notes,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
        createdBy,
        timestamp,
        timestamp,
      ],
    );
  };

  const upsertTeleconsultBilling = async ({
    consultId,
    amount,
    status = "unpaid",
    paymentMethod = null,
    notes = null,
    gatewayOrderId = null,
    gatewayPaymentId = null,
    gatewaySignature = null,
    createdBy = null,
  }) => {
    const timestamp = nowIso();
    await run(
      `INSERT INTO teleconsult_billing
       (consult_id, amount, status, payment_method, notes, gateway_order_id, gateway_payment_id, gateway_signature, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(consult_id) DO UPDATE SET
         amount = excluded.amount,
         status = excluded.status,
         payment_method = excluded.payment_method,
         notes = excluded.notes,
         gateway_order_id = excluded.gateway_order_id,
         gateway_payment_id = excluded.gateway_payment_id,
         gateway_signature = excluded.gateway_signature,
         created_by = excluded.created_by,
         updated_at = excluded.updated_at`,
      [
        consultId,
        normalizeAmount(amount),
        status,
        paymentMethod,
        notes,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
        createdBy,
        timestamp,
        timestamp,
      ],
    );
  };

  const createPaymentTransaction = async ({
    referenceType,
    referenceId,
    providerOrderId,
    amount,
    createdByUserId,
  }) => {
    if (!PAYMENT_REFERENCE_TYPES.has(referenceType)) {
      throw new Error("Unsupported payment reference type.");
    }
    const timestamp = nowIso();
    await run(
      `INSERT INTO payment_transactions
       (reference_type, reference_id, provider, provider_order_id, amount, currency, status, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, 'razorpay', ?, ?, 'INR', 'created', ?, ?, ?)`,
      [referenceType, referenceId, providerOrderId, normalizeAmount(amount), createdByUserId, timestamp, timestamp],
    );
  };

  const listActiveFrontDeskUserIds = async () => {
    const rows = await all(
      `SELECT id
       FROM users
       WHERE role = 'front_desk' AND active = 1`,
    );
    return rows.map((row) => Number(row.id)).filter(Boolean);
  };

  const notifyFrontDeskUsers = async ({
    type = "appointment_status",
    title,
    message,
    relatedId = null,
    eventKeyBase,
  }) => {
    if (!title || !message || !eventKeyBase) return;
    const recipientIds = await listActiveFrontDeskUserIds();
    for (const userId of recipientIds) {
      await enqueueAndDeliverUserNotification({
        userId,
        type,
        title,
        message,
        relatedId,
        eventKey: `${eventKeyBase}:front_desk:${userId}`,
      });
    }
  };

  const maybeEnqueueAppointmentReminder = async ({ appointment, recipientUserId, audience = "patient" }) => {
    const scheduledAt = appointment?.scheduled_at ? new Date(appointment.scheduled_at) : null;
    if (!recipientUserId || !scheduledAt || Number.isNaN(scheduledAt.getTime())) return;
    const normalizedStatus = normalizeAppointmentStatus(appointment?.status);
    if (normalizedStatus !== "approved") return;
    const msUntil = scheduledAt.getTime() - Date.now();
    if (msUntil <= 0 || msUntil > 24 * 60 * 60 * 1000) return;
    const eventKey = `appointment:${appointment.id}:reminder:${audience}:${scheduledAt.toISOString()}`;
    const message =
      audience === "doctor"
        ? `Upcoming appointment #${appointment.id} is scheduled for ${scheduledAt.toLocaleString()}.`
        : `Your appointment #${appointment.id} is scheduled for ${scheduledAt.toLocaleString()}. Keeping your reports ready can make the visit easier.`;
    await enqueueAndDeliverUserNotification({
      userId: Number(recipientUserId),
      type: "appointment_reminder",
      title: "Appointment reminder",
      message,
      relatedId: appointment.id,
      eventKey,
    });
  };

  const maybeEnqueueTeleconsultReminder = async ({ consult, recipientUserId, audience = "patient" }) => {
    const scheduledAt = consult?.preferred_slot ? new Date(consult.preferred_slot) : null;
    if (!recipientUserId || !scheduledAt || Number.isNaN(scheduledAt.getTime())) return;
    const normalizedStatus = String(consult?.status || "").toLowerCase();
    if (normalizedStatus !== "scheduled") return;
    const msUntil = scheduledAt.getTime() - Date.now();
    if (msUntil <= 0 || msUntil > 24 * 60 * 60 * 1000) return;
    const eventKey = `teleconsult:${consult.id}:reminder:${audience}:${scheduledAt.toISOString()}`;
    const message =
      audience === "doctor"
        ? `Upcoming ${String(consult.mode || "remote").toUpperCase()} consult #${consult.id} is scheduled for ${scheduledAt.toLocaleString()}.`
        : `Your ${String(consult.mode || "remote").toUpperCase()} consult #${consult.id} is scheduled for ${scheduledAt.toLocaleString()}. Keeping your summary nearby can make it easier to begin.`;
    await enqueueAndDeliverUserNotification({
      userId: Number(recipientUserId),
      type: "appointment_reminder",
      title: "Remote consult reminder",
      message,
      relatedId: consult.id,
      eventKey,
    });
  };

  const finalizePaymentTransaction = async ({
    providerOrderId,
    providerPaymentId,
    providerSignature,
    paymentMethod = "online",
    rawPayloadJson,
  }) => {
    await run(
      `UPDATE payment_transactions
       SET provider_payment_id = ?, provider_signature = ?, payment_method = ?, raw_payload_json = ?, status = 'paid', updated_at = ?
       WHERE provider_order_id = ?`,
      [providerPaymentId, providerSignature, paymentMethod, rawPayloadJson, nowIso(), providerOrderId],
    );
  };

  fastify.post("/api/teleconsults", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const {
      memberId = null,
      doctorId = null,
      departmentId = null,
      mode = "video",
      concern = "",
      preferredSlot = "",
      phone = "",
      triageLogId = null,
    } = request.body || {};

    const allowedModes = new Set(["video", "chat", "audio"]);
    if (!allowedModes.has(mode)) {
      return reply.code(400).send({ error: "mode must be video, chat, or audio." });
    }
    if (!concern || typeof concern !== "string" || concern.trim().length < 10) {
      return reply.code(400).send({ error: "concern must be at least 10 characters." });
    }
    if (concern.length > 1000) {
      return reply.code(400).send({ error: "concern is too long." });
    }
    if (phone && !/^[0-9+\-\s()]{8,20}$/.test(phone)) {
      return reply.code(400).send({ error: "phone format is invalid." });
    }
    if (!doctorId) {
      return reply.code(400).send({ error: "Valid doctor selection is required." });
    }
    if (!departmentId) {
      return reply.code(400).send({ error: "Valid department selection is required." });
    }
    if (!preferredSlot || Number.isNaN(new Date(preferredSlot).getTime())) {
      return reply.code(400).send({ error: "preferredSlot must be a valid datetime." });
    }
    if (memberId) {
      const member = await getFamilyMember(request.authUser.id, Number(memberId));
      if (!member) {
        return reply.code(404).send({ error: "Selected family member not found." });
      }
    }
    if (triageLogId) {
      const triage = await get("SELECT id FROM triage_logs WHERE id = ? AND user_id = ?", [
        Number(triageLogId),
        request.authUser.id,
      ]);
      if (!triage) {
        return reply.code(404).send({ error: "Referenced triage log not found." });
      }
    }

    const departmentRow = await get(
      "SELECT id, name FROM departments WHERE id = ? AND active = 1",
      [Number(departmentId)],
    );
    if (!departmentRow) {
      return reply.code(400).send({ error: "Valid department is required." });
    }

    const doctor = await get(
      `SELECT dp.doctor_id AS id, dp.chat_fee, dp.video_fee, dp.audio_fee, dp.in_person_fee
       FROM doctor_profiles dp
       WHERE dp.doctor_id = ? AND dp.active = 1 AND dp.department_id = ?`,
      [Number(doctorId), departmentRow.id],
    );
    if (!doctor) {
      return reply.code(404).send({ error: "Selected doctor not found." });
    }

    const slotParts = getIndiaSlotParts(preferredSlot);
    if (!slotParts) {
      return reply.code(400).send({ error: "preferredSlot must be a valid datetime." });
    }
    const availableSlots = await buildDoctorSlots(Number(doctorId), slotParts.dateText);
    if (availableSlots.error) {
      return reply.code(400).send({ error: availableSlots.error });
    }
    const slotAllowed = availableSlots.slots.some((slot) => slot.time === slotParts.timeText);
    if (!slotAllowed) {
      return reply.code(409).send({ error: "Selected slot is no longer available." });
    }

    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO teleconsult_requests
       (user_id, member_id, doctor_id, department_id, mode, status, concern, preferred_slot, phone, meeting_url, triage_log_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'requested', ?, ?, ?, NULL, ?, ?, ?)`,
      [
        request.authUser.id,
        memberId ? Number(memberId) : null,
        Number(doctorId),
        departmentRow.id,
        mode,
        concern.trim(),
        new Date(preferredSlot).toISOString(),
        phone.trim() || null,
        triageLogId ? Number(triageLogId) : null,
        createdAt,
        createdAt,
      ],
    );
    const autoMeetingUrl = await ensureTeleconsultMeetingUrl(result.lastID, mode);
    if (autoMeetingUrl) {
      await run(
        `UPDATE teleconsult_requests
         SET meeting_url = ?, updated_at = ?
         WHERE id = ?`,
        [autoMeetingUrl, createdAt, result.lastID],
      );
    }
    const consultFee = resolveConsultFee(doctor, mode);
    await upsertTeleconsultBilling({
      consultId: result.lastID,
      amount: consultFee,
      status: consultFee > 0 ? "unpaid" : "waived",
      paymentMethod: consultFee > 0 ? null : "not_required",
      notes: consultFee > 0 ? "Waiting for patient payment." : "No consultation fee configured.",
      createdBy: request.authUser.id,
    });

    const consult = await get(
      `SELECT tr.id, tr.user_id, tr.member_id, tr.doctor_id, tr.department_id, tr.mode, tr.status, tr.concern, tr.preferred_slot,
              tr.phone, tr.meeting_url, tr.triage_log_id, tr.created_at, tr.updated_at,
              tb.amount AS bill_amount, tb.status AS bill_status, tb.payment_method AS bill_payment_method,
              u.name AS patient_name, u.email AS patient_email, fm.name AS member_name,
              d.name AS doctor_name, dep.name AS department_name
       FROM teleconsult_requests tr
       JOIN users u ON u.id = tr.user_id
       LEFT JOIN users d ON d.id = tr.doctor_id
       LEFT JOIN departments dep ON dep.id = tr.department_id
       LEFT JOIN teleconsult_billing tb ON tb.consult_id = tr.id
       LEFT JOIN family_members fm ON fm.id = tr.member_id
       WHERE tr.id = ?`,
      [result.lastID],
    );
    await enqueueAndDeliverUserNotification({
      userId: Number(request.authUser.id),
      type: "appointment_status",
      title: "Remote consult request received",
      message: `Your ${String(mode).toUpperCase()} consult request has been received. We’ll keep the details ready here for your next step.`,
      relatedId: result.lastID,
      eventKey: `teleconsult:${result.lastID}:created:patient`,
    });
    if (consult.doctor_id) {
      await enqueueAndDeliverUserNotification({
        userId: Number(consult.doctor_id),
        type: "appointment_status",
        title: "New remote consult request",
        message: `${consult.patient_name || "A patient"} requested a ${String(mode).toUpperCase()} consult for ${new Date(consult.preferred_slot).toLocaleString()}.`,
        relatedId: result.lastID,
        eventKey: `teleconsult:${result.lastID}:created:doctor`,
      });
    }
    await notifyFrontDeskUsers({
      type: "appointment_status",
      title: "New remote consult request",
      message: `${consult.patient_name || "A patient"} requested a ${String(mode).toUpperCase()} consult for ${new Date(consult.preferred_slot).toLocaleString()}.`,
      relatedId: result.lastID,
      eventKeyBase: `teleconsult:${result.lastID}:created`,
    });
    return {
      consult: {
        id: consult.id,
        userId: consult.user_id,
        memberId: consult.member_id,
        doctorId: consult.doctor_id,
        departmentId: consult.department_id,
        mode: consult.mode,
        status: consult.status,
        concern: consult.concern,
        preferredSlot: consult.preferred_slot,
        phone: consult.phone,
        meetingUrl: consult.meeting_url,
        triageLogId: consult.triage_log_id,
        patientName: consult.patient_name,
        patientEmail: consult.patient_email,
        memberName: consult.member_name,
        doctorName: consult.doctor_name,
        departmentName: consult.department_name,
        billAmount: consult.bill_amount || 0,
        billStatus: consult.bill_status || "unpaid",
        billPaymentMethod: consult.bill_payment_method || "",
        createdAt: consult.created_at,
        updatedAt: consult.updated_at,
      },
    };
  });

  fastify.get("/api/teleconsults", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const limit = Math.max(1, Math.min(Number(request.query?.limit) || 30, 100));
    const baseSelect = `SELECT tr.id, tr.user_id, tr.member_id, tr.doctor_id, tr.department_id, tr.mode, tr.status, tr.concern, tr.preferred_slot,
                               tr.phone, tr.meeting_url, tr.triage_log_id, tr.created_at, tr.updated_at,
                               tb.amount AS bill_amount, tb.status AS bill_status, tb.payment_method AS bill_payment_method,
                               u.name AS patient_name, u.email AS patient_email,
                               fm.name AS member_name, d.name AS doctor_name, dep.name AS department_name
                        FROM teleconsult_requests tr
                        JOIN users u ON u.id = tr.user_id
                        LEFT JOIN family_members fm ON fm.id = tr.member_id
                        LEFT JOIN users d ON d.id = tr.doctor_id
                        LEFT JOIN departments dep ON dep.id = tr.department_id
                        LEFT JOIN teleconsult_billing tb ON tb.consult_id = tr.id`
    const rows =
      request.authUser.role === "doctor"
        ? await all(
            `${baseSelect}
             WHERE tr.doctor_id = ?
               AND tr.status IN ('requested', 'scheduled', 'in_progress', 'completed')
             ORDER BY COALESCE(tr.preferred_slot, tr.created_at) ASC
             LIMIT ?`,
            [request.authUser.id, limit],
          )
        : isOpsRole(request.authUser.role) || request.authUser.role === "admin"
          ? await all(
              `${baseSelect}
               ORDER BY COALESCE(tr.preferred_slot, tr.created_at) ASC
               LIMIT ?`,
              [limit],
            )
          : await all(
              `${baseSelect}
               WHERE tr.user_id = ?
               ORDER BY tr.created_at DESC
               LIMIT ?`,
              [request.authUser.id, limit],
            );

    for (const row of rows) {
      if (request.authUser.role === "doctor") {
        await maybeEnqueueTeleconsultReminder({ consult: row, recipientUserId: request.authUser.id, audience: "doctor" });
      } else if (request.authUser.role === "patient") {
        await maybeEnqueueTeleconsultReminder({ consult: row, recipientUserId: request.authUser.id, audience: "patient" });
      }
    }
    return {
      consults: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        memberId: row.member_id,
        doctorId: row.doctor_id,
        departmentId: row.department_id,
        mode: row.mode,
        status: row.status,
        concern: row.concern,
        preferredSlot: row.preferred_slot,
        phone: row.phone,
        meetingUrl: row.meeting_url,
        triageLogId: row.triage_log_id,
        patientName: row.patient_name,
        patientEmail: row.patient_email,
        memberName: row.member_name,
        doctorName: row.doctor_name,
        departmentName: row.department_name,
        billAmount: row.bill_amount || 0,
        billStatus: row.bill_status || "unpaid",
        billPaymentMethod: row.bill_payment_method || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  });

  fastify.get("/api/teleconsults/:consultId/events", async (request, reply) => {
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Invalid consult id." });
    }
    const authUser = await authenticateTeleconsultStream(request);
    if (!authUser) {
      return reply.code(401).send({ error: "Authentication required." });
    }
    const consult = await get("SELECT id, user_id, doctor_id, mode, meeting_url FROM teleconsult_requests WHERE id = ?", [consultId]);
    if (!consult) {
      return reply.code(404).send({ error: "Consult not found." });
    }
    if (!canAccessConsult({ authUser }, consult)) {
      return reply.code(403).send({ error: "Access denied." });
    }

    reply.hijack();
    const requestOrigin = String(request.headers.origin || "").trim();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(requestOrigin
        ? {
            "Access-Control-Allow-Origin": requestOrigin,
            Vary: "Origin",
          }
        : {}),
    });
    reply.raw.write("\n");

    const listeners = teleconsultEventStreams.get(consultId) || new Set();
    listeners.add(reply.raw);
    teleconsultEventStreams.set(consultId, listeners);

    sendSseEvent(reply.raw, "connected", {
      consultId,
      connectedAt: nowIso(),
    });

    const keepAlive = setInterval(() => {
      sendSseEvent(reply.raw, "ping", { at: nowIso() });
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(keepAlive);
      const activeListeners = teleconsultEventStreams.get(consultId);
      if (!activeListeners) return;
      activeListeners.delete(reply.raw);
      if (activeListeners.size === 0) {
        teleconsultEventStreams.delete(consultId);
      }
    });
  });

  fastify.get("/api/teleconsults/:consultId/patient-history", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!(isDoctorRole(request.authUser.role) || isOpsRole(request.authUser.role))) {
      return reply.code(403).send({ error: "Doctor, admin, or front desk access required." });
    }
    const consultId = Number(request.params.consultId);
    if (!consultId) return reply.code(400).send({ error: "Invalid consult id." });

    const consult = await get(
      `SELECT tr.id, tr.user_id, tr.member_id, tr.doctor_id, tr.department_id, tr.mode, tr.status, tr.concern, tr.preferred_slot,
              u.name AS patient_name, u.email AS patient_email,
              p.age AS profile_age, p.sex AS profile_sex, p.conditions AS profile_conditions,
              p.allergies AS profile_allergies, p.blood_group AS profile_blood_group,
              p.date_of_birth AS profile_date_of_birth, p.phone AS profile_phone, p.weight_kg AS profile_weight_kg, p.height_cm AS profile_height_cm,
              p.abha_number AS profile_abha_number, p.abha_address AS profile_abha_address, p.abha_status AS profile_abha_status,
              pr.first_name, pr.middle_name, pr.last_name,
              dep.name AS department_name, d.name AS doctor_name
       FROM teleconsult_requests tr
       JOIN users u ON u.id = tr.user_id
       LEFT JOIN profiles p ON p.user_id = tr.user_id
       LEFT JOIN patient_registration_details pr ON pr.user_id = tr.user_id
       LEFT JOIN departments dep ON dep.id = tr.department_id
       LEFT JOIN users d ON d.id = tr.doctor_id
       WHERE tr.id = ?`,
      [consultId],
    );
    if (!consult) return reply.code(404).send({ error: "Consult not found." });
    if (request.authUser.role === "doctor" && Number(consult.doctor_id) !== Number(request.authUser.id)) {
      return reply.code(403).send({ error: "Only the assigned doctor can view this patient history." });
    }

    let patient = {
      id: consult.user_id,
      memberId: consult.member_id || null,
      name: consult.patient_name,
      email: consult.patient_email || "",
      age: consult.profile_age || null,
      sex: consult.profile_sex || "",
      conditions: consult.profile_conditions || "",
      allergies: consult.profile_allergies || "",
      bloodGroup: consult.profile_blood_group || "",
      dateOfBirth: consult.profile_date_of_birth || "",
      weightKg: consult.profile_weight_kg ?? "",
      heightCm: consult.profile_height_cm ?? "",
      phone: consult.profile_phone || "",
      abhaNumber: consult.profile_abha_number || "",
      abhaAddress: consult.profile_abha_address || "",
      abhaStatus: consult.profile_abha_status || "not_linked",
    };

    if (consult.member_id) {
      const member = await get(
        `SELECT id, name, age, sex, conditions, allergies
         FROM family_members
         WHERE id = ? AND user_id = ?`,
        [consult.member_id, consult.user_id],
      );
      if (member) {
        patient = {
          ...patient,
          memberId: member.id,
          name: member.name || patient.name,
          age: member.age || patient.age,
          sex: member.sex || patient.sex,
          conditions: member.conditions || patient.conditions,
          allergies: member.allergies || patient.allergies,
        };
      }
    }

    const previousEncounters = await all(
      `SELECT e.id, e.appointment_id, e.status, e.chief_complaint, e.diagnosis_text, e.plan_text, e.followup_date, e.created_at,
              a.scheduled_at, a.department, d.name AS doctor_name
       FROM encounters e
       LEFT JOIN appointments a ON a.id = e.appointment_id
       LEFT JOIN users d ON d.id = e.doctor_id
       WHERE e.user_id = ?
         AND COALESCE(e.member_id, 0) = COALESCE(?, 0)
       ORDER BY COALESCE(a.scheduled_at, e.created_at) DESC, e.created_at DESC
       LIMIT 6`,
      [consult.user_id, consult.member_id || 0],
    );

    return {
      consult: {
        id: consult.id,
        mode: consult.mode,
        status: consult.status,
        concern: consult.concern,
        preferredSlot: consult.preferred_slot,
        departmentName: consult.department_name || "",
        doctorName: consult.doctor_name || "",
      },
      patient: {
        ...patient,
        visitCount: previousEncounters.length,
        previousVisitCount: previousEncounters.length,
        isFollowUp: previousEncounters.length > 0,
        lastVisitAt: previousEncounters[0]?.scheduled_at || previousEncounters[0]?.created_at || null,
      },
      history: previousEncounters,
    };
  });

  fastify.patch("/api/teleconsults/:consultId/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!(isDoctorRole(request.authUser.role) || isOpsRole(request.authUser.role))) {
      return reply.code(403).send({ error: "Doctor, admin, or front desk access required." });
    }
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Invalid consult id." });
    }
    const { status, meetingUrl = null } = request.body || {};
    const normalizedStatus = String(status || "").trim().toLowerCase();
    const opsAllowed = new Set(["requested", "scheduled", "cancelled", "no_show"]);
    const doctorAllowed = new Set(["requested", "scheduled", "in_progress", "completed", "cancelled", "no_show"]);
    const allowed = new Set([...opsAllowed, ...doctorAllowed]);
    if (!allowed.has(normalizedStatus)) {
      return reply.code(400).send({ error: "Invalid consult status." });
    }
    if (meetingUrl && !/^https?:\/\/[^\s]+$/i.test(meetingUrl)) {
      return reply.code(400).send({ error: "meetingUrl must be a valid http(s) URL." });
    }

    const consult = await get(
      "SELECT id, user_id, doctor_id, mode, meeting_url FROM teleconsult_requests WHERE id = ?",
      [consultId],
    );
    if (!consult) {
      return reply.code(404).send({ error: "Consult not found." });
    }
    if (isOpsRole(request.authUser.role) && !opsAllowed.has(normalizedStatus) && request.authUser.role !== "admin") {
      return reply.code(403).send({ error: "Front desk can only manage requested, scheduled, cancelled, or no-show." });
    }
    if (request.authUser.role === "doctor") {
      if (Number(consult.doctor_id) !== Number(request.authUser.id)) {
        return reply.code(403).send({ error: "Only the assigned doctor can update this consult." });
      }
      if (!doctorAllowed.has(normalizedStatus)) {
        return reply.code(403).send({ error: "Doctors can update this remote consult using the supported consult states." });
      }
    }

    const resolvedMeetingUrl = await ensureTeleconsultMeetingUrl(
      consultId,
      consult.mode,
      String(meetingUrl || "").trim() || String(consult.meeting_url || "").trim(),
    );

    await run(
      `UPDATE teleconsult_requests
       SET status = ?, meeting_url = ?, updated_at = ?
       WHERE id = ?`,
      [normalizedStatus, resolvedMeetingUrl, nowIso(), consultId],
    );

    const statusLabel = normalizedStatus.replace(/_/g, " ");
    if (request.authUser.id !== Number(consult.user_id)) {
      await enqueueAndDeliverUserNotification({
        userId: Number(consult.user_id),
        type: "appointment_status",
        title: "Remote consult update",
        message: `Your remote consult is now ${statusLabel}. Review the latest status when you have a quiet moment.`,
        relatedId: consultId,
        eventKey: `teleconsult:${consultId}:status:patient:${normalizedStatus}`,
      });
    }
    if (consult.doctor_id && request.authUser.id !== Number(consult.doctor_id)) {
      await enqueueAndDeliverUserNotification({
        userId: Number(consult.doctor_id),
        type: "appointment_status",
        title: "Remote consult update",
        message: `Remote consult #${consultId} was ${statusLabel}.`,
        relatedId: consultId,
        eventKey: `teleconsult:${consultId}:status:doctor:${normalizedStatus}`,
      });
    }

    const updated = await get(
      `SELECT id, user_id, member_id, doctor_id, department_id, mode, status, concern, preferred_slot, phone, meeting_url, triage_log_id, created_at, updated_at
       FROM teleconsult_requests WHERE id = ?`,
      [consultId],
    );
    broadcastTeleconsultEvent(consultId, "consult_updated", {
      consultId,
      consult: {
        id: updated.id,
        userId: updated.user_id,
        memberId: updated.member_id,
        doctorId: updated.doctor_id,
        departmentId: updated.department_id,
        mode: updated.mode,
        status: updated.status,
        concern: updated.concern,
        preferredSlot: updated.preferred_slot,
        phone: updated.phone,
        meetingUrl: updated.meeting_url,
        triageLogId: updated.triage_log_id,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
    return { consult: updated };
  });

  fastify.get("/api/teleconsults/:consultId/messages", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Invalid consult id." });
    }
    const consult = await get("SELECT id, user_id, doctor_id FROM teleconsult_requests WHERE id = ?", [consultId]);
    if (!consult) {
      return reply.code(404).send({ error: "Consult not found." });
    }
    if (!canAccessConsult(request, consult)) {
      return reply.code(403).send({ error: "Access denied." });
    }

    const messages = await all(
      `SELECT id, consult_id, sender_user_id, sender_role, message, created_at
       FROM teleconsult_messages
       WHERE consult_id = ?
       ORDER BY created_at ASC`,
      [consultId],
    );
    return {
      messages: messages.map((row) => ({
        id: row.id,
        consultId: row.consult_id,
        senderUserId: row.sender_user_id,
        senderRole: row.sender_role,
        message: row.message,
        createdAt: row.created_at,
      })),
    };
  });

  fastify.get("/api/teleconsults/:consultId/consent", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Invalid consult id." });
    }
    const consult = await get("SELECT id, user_id, doctor_id FROM teleconsult_requests WHERE id = ?", [consultId]);
    if (!consult) {
      return reply.code(404).send({ error: "Consult not found." });
    }
    if (!canAccessConsult(request, consult)) {
      return reply.code(403).send({ error: "Access denied." });
    }
    const rows = await all(
      `SELECT id, user_id, consent_type, related_type, related_id, policy_version, accepted, created_at
       FROM consent_logs
       WHERE consent_type = 'teleconsult_chat'
         AND related_type = 'teleconsult'
         AND related_id = ?
       ORDER BY created_at DESC, id DESC`,
      [consultId],
    );
    const latestByUser = new Map();
    for (const row of rows) {
      if (!latestByUser.has(Number(row.user_id))) latestByUser.set(Number(row.user_id), row);
    }
    const patientConsent = latestByUser.get(Number(consult.user_id)) || null;
    const doctorConsent = latestByUser.get(Number(consult.doctor_id)) || null;
    return {
      summary: {
        consultId,
        policyVersion: patientConsent?.policy_version || doctorConsent?.policy_version || "teleconsult_chat_v1",
        patientAccepted: Boolean(patientConsent?.accepted),
        patientAcceptedAt: patientConsent?.created_at || null,
        doctorAccepted: Boolean(doctorConsent?.accepted),
        doctorAcceptedAt: doctorConsent?.created_at || null,
      },
    };
  });

  fastify.post("/api/teleconsults/:consultId/consent", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Invalid consult id." });
    }
    const consult = await get("SELECT id, user_id, doctor_id FROM teleconsult_requests WHERE id = ?", [consultId]);
    if (!consult) {
      return reply.code(404).send({ error: "Consult not found." });
    }
    if (!canAccessConsult(request, consult)) {
      return reply.code(403).send({ error: "Access denied." });
    }
    const { accepted = false, policyVersion = "teleconsult_chat_v1" } = request.body || {};
    if (!accepted) {
      return reply.code(400).send({ error: "Consent acceptance is required." });
    }
    const createdAt = nowIso();
    await run(
      `INSERT INTO consent_logs
       (user_id, consent_type, related_type, related_id, policy_version, accepted, created_at)
       VALUES (?, 'teleconsult_chat', 'teleconsult', ?, ?, 1, ?)`,
      [request.authUser.id, consultId, String(policyVersion || "teleconsult_chat_v1"), createdAt],
    );
    const summary = {
      consultId,
      policyVersion: String(policyVersion || "teleconsult_chat_v1"),
      patientAccepted: Number(request.authUser.id) === Number(consult.user_id),
      patientAcceptedAt: Number(request.authUser.id) === Number(consult.user_id) ? createdAt : null,
      doctorAccepted: Number(request.authUser.id) === Number(consult.doctor_id),
      doctorAcceptedAt: Number(request.authUser.id) === Number(consult.doctor_id) ? createdAt : null,
    };
    broadcastTeleconsultEvent(consultId, "consent_updated", {
      consultId,
      actorUserId: request.authUser.id,
      actorRole: request.authUser.role,
      acceptedAt: createdAt,
      summary,
    });
    return { ok: true, acceptedAt: createdAt };
  });

  fastify.post("/api/teleconsults/:consultId/messages", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Invalid consult id." });
    }
    const { message } = request.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return reply.code(400).send({ error: "message is required." });
    }
    if (message.length > 1500) {
      return reply.code(400).send({ error: "message is too long." });
    }

    const consult = await get("SELECT id, user_id, doctor_id FROM teleconsult_requests WHERE id = ?", [consultId]);
    if (!consult) {
      return reply.code(404).send({ error: "Consult not found." });
    }
    if (!canAccessConsult(request, consult)) {
      return reply.code(403).send({ error: "Access denied." });
    }

    const role = isDoctorRole(request.authUser.role) ? "doctor" : "patient";
    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO teleconsult_messages
       (consult_id, sender_user_id, sender_role, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [consultId, request.authUser.id, role, message.trim(), createdAt],
    );
    await run("UPDATE teleconsult_requests SET updated_at = ? WHERE id = ?", [createdAt, consultId]);
    const payload = {
      id: result.lastID,
      consultId,
      senderUserId: request.authUser.id,
      senderRole: role,
      message: message.trim(),
      createdAt,
    };
    broadcastTeleconsultEvent(consultId, "message_created", { consultId, message: payload });

    return { message: payload };
  });

  fastify.get("/api/teleconsults/:consultId/call-events", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Invalid consult id." });
    }
    const consult = await get("SELECT id, user_id, doctor_id, mode FROM teleconsult_requests WHERE id = ?", [consultId]);
    if (!consult) {
      return reply.code(404).send({ error: "Consult not found." });
    }
    if (!canAccessConsult(request, consult)) {
      return reply.code(403).send({ error: "Access denied." });
    }
    if (!["audio", "video"].includes(String(consult.mode || "").toLowerCase())) {
      return { events: [] };
    }
    const afterId = Math.max(0, Number(request.query?.afterId) || 0);
    const rows = await all(
      `SELECT id, consult_id, sender_user_id, sender_role, session_id, event_type, payload_json, created_at
       FROM teleconsult_call_events
       WHERE consult_id = ? AND id > ?
       ORDER BY id ASC`,
      [consultId, afterId],
    );
    return {
      events: rows.map((row) => ({
        id: row.id,
        consultId: row.consult_id,
        senderUserId: row.sender_user_id,
        senderRole: row.sender_role,
        sessionId: row.session_id,
        eventType: row.event_type,
        payload: safeJsonParse(row.payload_json, null),
        createdAt: row.created_at,
      })),
    };
  });

  fastify.get("/api/teleconsults/rtc-config", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    return buildRtcConfiguration();
  });

  fastify.post("/api/teleconsults/:consultId/call-events", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Invalid consult id." });
    }
    const consult = await get("SELECT id, user_id, doctor_id, mode FROM teleconsult_requests WHERE id = ?", [consultId]);
    if (!consult) {
      return reply.code(404).send({ error: "Consult not found." });
    }
    if (!canAccessConsult(request, consult)) {
      return reply.code(403).send({ error: "Access denied." });
    }
    const consultMode = String(consult.mode || "").toLowerCase();
    if (!["audio", "video"].includes(consultMode)) {
      return reply.code(400).send({ error: "Live call signaling is only available for audio or video consults." });
    }

    const { sessionId, eventType, payload = null } = request.body || {};
    const normalizedEventType = String(eventType || "").trim().toLowerCase();
    const allowedEventTypes = new Set(["offer", "answer", "candidate", "ended"]);
    if (!String(sessionId || "").trim()) {
      return reply.code(400).send({ error: "sessionId is required." });
    }
    if (!allowedEventTypes.has(normalizedEventType)) {
      return reply.code(400).send({ error: "Invalid call event type." });
    }

    const senderRole = isDoctorRole(request.authUser.role) ? "doctor" : "patient";
    const createdAt = nowIso();
    const payloadJson = payload == null ? null : JSON.stringify(payload);
    const result = await run(
      `INSERT INTO teleconsult_call_events
       (consult_id, sender_user_id, sender_role, session_id, event_type, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [consultId, request.authUser.id, senderRole, String(sessionId), normalizedEventType, payloadJson, createdAt],
    );

    const eventPayload = {
      id: result.lastID,
      consultId,
      senderUserId: request.authUser.id,
      senderRole,
      sessionId: String(sessionId),
      eventType: normalizedEventType,
      payload,
      createdAt,
    };

    broadcastTeleconsultEvent(consultId, "call_event_created", {
      consultId,
      event: eventPayload,
    });

    if (senderRole === "doctor" && normalizedEventType === "offer") {
      await run(
        `UPDATE teleconsult_requests
         SET status = CASE
           WHEN status IN ('requested', 'scheduled') THEN 'in_progress'
           ELSE status
         END,
         updated_at = ?
         WHERE id = ?`,
        [createdAt, consultId],
      );

      const updated = await get(
        `SELECT id, user_id, member_id, doctor_id, department_id, mode, status, concern, preferred_slot, phone, meeting_url, triage_log_id, created_at, updated_at
         FROM teleconsult_requests WHERE id = ?`,
        [consultId],
      );

      await enqueueAndDeliverUserNotification({
        userId: Number(consult.user_id),
        type: "appointment_status",
        title: `${consultMode === "video" ? "Video" : "Audio"} consult started`,
        message: `Your ${consultMode === "video" ? "video" : "audio"} consult has started. Open the consult room when you’re ready to join.`,
        relatedId: consultId,
        eventKey: `teleconsult:${consultId}:${consultMode}_offer:patient:${result.lastID}`,
      });

      broadcastTeleconsultEvent(consultId, "consult_updated", {
        consultId,
        consult: {
          id: updated.id,
          userId: updated.user_id,
          memberId: updated.member_id,
          doctorId: updated.doctor_id,
          departmentId: updated.department_id,
          mode: updated.mode,
          status: updated.status,
          concern: updated.concern,
          preferredSlot: updated.preferred_slot,
          phone: updated.phone,
          meetingUrl: updated.meeting_url,
          triageLogId: updated.triage_log_id,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      });
    }

    broadcastTeleconsultEvent(consultId, "call_event", {
      consultId,
      callEvent: eventPayload,
    });

    return { event: eventPayload };
  });

  fastify.get("/api/departments", async () => {
    const rows = await all(
      `SELECT id, name, description
       FROM departments
       WHERE active = 1
       ORDER BY name ASC`,
    );
    return { departments: rows };
  });

  fastify.get("/api/doctors", async (request) => {
    const departmentId = request.query?.departmentId ? Number(request.query.departmentId) : null;
    const rows = departmentId
      ? await all(
          `SELECT dp.doctor_id AS id, COALESCE(dp.display_name, u.name) AS name, dp.qualification,
                  dp.in_person_fee, dp.chat_fee, dp.video_fee, dp.audio_fee,
                  dp.department_id, d.name AS department_name
           FROM doctor_profiles dp
           JOIN users u ON u.id = dp.doctor_id
           LEFT JOIN departments d ON d.id = dp.department_id
           WHERE dp.active = 1 AND dp.department_id = ?
           ORDER BY name ASC`,
          [departmentId],
        )
      : await all(
          `SELECT dp.doctor_id AS id, COALESCE(dp.display_name, u.name) AS name, dp.qualification,
                  dp.in_person_fee, dp.chat_fee, dp.video_fee, dp.audio_fee,
                  dp.department_id, d.name AS department_name
           FROM doctor_profiles dp
           JOIN users u ON u.id = dp.doctor_id
           LEFT JOIN departments d ON d.id = dp.department_id
           WHERE dp.active = 1
           ORDER BY name ASC`,
        );
    return { doctors: rows };
  });

  fastify.get("/api/doctors/:doctorId/availability", async (request, reply) => {
    const doctorId = Number(request.params.doctorId);
    if (!doctorId) {
      return reply.code(400).send({ error: "Valid doctorId is required." });
    }
    const schedules = await getDoctorSchedules(doctorId);
    return { schedules };
  });

  fastify.put("/api/doctors/:doctorId/availability", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const doctorId = Number(request.params.doctorId);
    if (!doctorId) {
      return reply.code(400).send({ error: "Valid doctorId is required." });
    }
    if (!isDoctorRole(request.authUser.role) || (request.authUser.role !== "admin" && request.authUser.id !== doctorId)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }

    const schedules = Array.isArray(request.body?.schedules) ? request.body.schedules : null;
    if (!schedules) {
      return reply.code(400).send({ error: "schedules array is required." });
    }

    for (const item of schedules) {
      if (
        Number.isNaN(Number(item.weekday)) ||
        Number(item.weekday) < 0 ||
        Number(item.weekday) > 6 ||
        !item.startTime ||
        !item.endTime ||
        Number(item.slotMinutes) < 5 ||
        Number(item.slotMinutes) > 120
      ) {
        return reply.code(400).send({ error: "One or more schedules are invalid." });
      }
    }

    await run("DELETE FROM doctor_availability WHERE doctor_id = ?", [doctorId]);
    for (const item of schedules) {
      await run(
        `INSERT INTO doctor_availability
         (doctor_id, weekday, start_time, end_time, slot_minutes, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          doctorId,
          Number(item.weekday),
          item.startTime,
          item.endTime,
          Number(item.slotMinutes),
          nowIso(),
          nowIso(),
        ],
      );
    }
    return { schedules: await getDoctorSchedules(doctorId) };
  });

  fastify.get("/api/appointment-slots", async (request, reply) => {
    const doctorId = Number(request.query?.doctorId);
    const date = String(request.query?.date || "");
    if (!doctorId || !date) {
      return reply.code(400).send({ error: "doctorId and date are required." });
    }
    const result = await buildDoctorSlots(doctorId, date);
    if (result.error) {
      return reply.code(400).send({ error: result.error });
    }
    return result;
  });

  fastify.post("/api/appointments", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const idempotencyKey = request.headers["idempotency-key"];
    const {
      memberId = null,
      doctorId = null,
      departmentId = null,
      department = "",
      reason = "",
      scheduledAt = "",
    } = request.body || {};

    const resolvedDepartmentId = departmentId ? Number(departmentId) : null;
    let departmentRow = null;
    if (resolvedDepartmentId) {
      departmentRow = await get(
        "SELECT id, name FROM departments WHERE id = ? AND active = 1",
        [resolvedDepartmentId],
      );
    } else if (department && typeof department === "string" && department.trim()) {
      departmentRow = await get(
        "SELECT id, name FROM departments WHERE name = ? AND active = 1",
        [department.trim()],
      );
    }
    if (!departmentRow) {
      return reply.code(400).send({ error: "Valid department is required." });
    }
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return reply.code(400).send({ error: "reason must be at least 5 characters." });
    }
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
      return reply.code(400).send({ error: "scheduledAt must be a valid datetime." });
    }
    if (!doctorId) {
      return reply.code(400).send({ error: "Valid doctor selection is required." });
    }
    if (memberId) {
      const member = await getFamilyMember(request.authUser.id, Number(memberId));
      if (!member) {
        return reply.code(404).send({ error: "Selected family member not found." });
      }
    }
    const doctor = departmentRow?.id
      ? await get(
          `SELECT dp.doctor_id AS id, dp.in_person_fee
           FROM doctor_profiles dp
           WHERE dp.doctor_id = ? AND dp.active = 1 AND dp.department_id = ?`,
          [Number(doctorId), departmentRow.id],
        )
      : await get(
          `SELECT dp.doctor_id AS id, dp.in_person_fee
           FROM doctor_profiles dp
           WHERE dp.doctor_id = ? AND dp.active = 1`,
          [Number(doctorId)],
        );
    if (!doctor) {
      return reply.code(404).send({ error: "Selected doctor not found." });
    }
    const slotParts = getIndiaSlotParts(scheduledAt);
    if (!slotParts) {
      return reply.code(400).send({ error: "scheduledAt must be a valid datetime." });
    }
    const availableSlots = await buildDoctorSlots(Number(doctorId), slotParts.dateText);
    if (availableSlots.error) {
      return reply.code(400).send({ error: availableSlots.error });
    }
    const slotAllowed = availableSlots.slots.some((slot) => slot.time === slotParts.timeText);
    if (!slotAllowed) {
      return reply.code(409).send({ error: "Selected slot is no longer available." });
    }

    const executed = await consumeIdempotencyKey({
      userId: request.authUser.id,
      routeKey: "appointments:create",
      idempotencyKey,
      execute: async () => {
        const createdAt = nowIso();
        const result = await run(
          `INSERT INTO appointments
           (user_id, member_id, doctor_id, department_id, department, reason, scheduled_at, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)`,
          [
            request.authUser.id,
            memberId ? Number(memberId) : null,
            doctorId ? Number(doctorId) : null,
            departmentRow.id,
            departmentRow.name,
            reason.trim(),
            new Date(scheduledAt).toISOString(),
            createdAt,
            createdAt,
          ],
        );

        const appointment = await get(
          `SELECT a.*, d.name AS doctor_name, p.name AS patient_name, fm.name AS member_name, dep.name AS department_name
           FROM appointments a
           JOIN users p ON p.id = a.user_id
           LEFT JOIN users d ON d.id = a.doctor_id
           LEFT JOIN departments dep ON dep.id = a.department_id
           LEFT JOIN family_members fm ON fm.id = a.member_id
           WHERE a.id = ?`,
          [result.lastID],
        );
        await createAppointmentTimeline({
          appointmentId: result.lastID,
          actorUserId: request.authUser.id,
          eventType: "created",
          fromStatus: null,
          toStatus: "requested",
          note: "Appointment request created",
          metadata: {
            departmentId: departmentRow.id,
            doctorId: Number(doctorId),
            scheduledAt: appointment.scheduled_at,
          },
        });
        const appointmentFee = resolveConsultFee(doctor, "in_person");
        await upsertAppointmentBilling({
          appointmentId: result.lastID,
          amount: appointmentFee,
          status: appointmentFee > 0 ? "unpaid" : "waived",
          paymentMethod: appointmentFee > 0 ? null : "not_required",
          notes: appointmentFee > 0 ? "Waiting for patient payment." : "No consultation fee configured.",
          createdBy: request.authUser.id,
        });
        await enqueueAndDeliverUserNotification({
          userId: Number(request.authUser.id),
          type: "appointment_status",
          title: "Appointment request received",
          message: `Your appointment request with ${appointment.doctor_name ? `Dr. ${appointment.doctor_name}` : "the doctor"} has been received. We’ll keep the details ready here for your next step.`,
          relatedId: result.lastID,
          eventKey: `appointment:${result.lastID}:created:patient`,
        });
        if (appointment.doctor_id) {
          await enqueueAndDeliverUserNotification({
            userId: Number(appointment.doctor_id),
            type: "appointment_status",
            title: "New appointment request",
            message: `${appointment.patient_name || "A patient"} requested appointment #${result.lastID} for ${new Date(appointment.scheduled_at).toLocaleString()}.`,
            relatedId: result.lastID,
            eventKey: `appointment:${result.lastID}:created:doctor`,
          });
        }
        await notifyFrontDeskUsers({
          type: "appointment_status",
          title: "New appointment request",
          message: `${appointment.patient_name || "A patient"} requested appointment #${result.lastID} for ${new Date(appointment.scheduled_at).toLocaleString()}.`,
          relatedId: result.lastID,
          eventKeyBase: `appointment:${result.lastID}:created`,
        });
        return { appointment };
      },
    });
    return executed.payload;
  });

  fastify.post("/api/admin/patients/:patientId/visits", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const patientId = Number(request.params.patientId);
    const {
      doctorId = null,
      departmentId = null,
      department = "",
      reason = "",
      scheduledAt = "",
      visitType = "OPD",
      isFollowUp = false,
    } = request.body || {};

    if (!patientId) {
      return reply.code(400).send({ error: "Valid patient id is required." });
    }
    const patient = await get("SELECT id FROM users WHERE id = ? AND role = 'patient' AND active = 1", [patientId]);
    if (!patient) {
      return reply.code(404).send({ error: "Active patient not found." });
    }

    const resolvedDepartmentId = departmentId ? Number(departmentId) : null;
    let departmentRow = null;
    if (resolvedDepartmentId) {
      departmentRow = await get(
        "SELECT id, name FROM departments WHERE id = ? AND active = 1",
        [resolvedDepartmentId],
      );
    } else if (department && typeof department === "string" && department.trim()) {
      departmentRow = await get(
        "SELECT id, name FROM departments WHERE name = ? AND active = 1",
        [department.trim()],
      );
    }
    if (!departmentRow) {
      return reply.code(400).send({ error: "Valid department is required." });
    }
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return reply.code(400).send({ error: "reason must be at least 5 characters." });
    }
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
      return reply.code(400).send({ error: "scheduledAt must be a valid datetime." });
    }
    if (!doctorId) {
      return reply.code(400).send({ error: "Valid doctor selection is required." });
    }
    const doctor = departmentRow?.id
      ? await get(
          `SELECT dp.doctor_id AS id, dp.in_person_fee
           FROM doctor_profiles dp
           WHERE dp.doctor_id = ? AND dp.active = 1 AND dp.department_id = ?`,
          [Number(doctorId), departmentRow.id],
        )
      : await get(
          `SELECT dp.doctor_id AS id, dp.in_person_fee
           FROM doctor_profiles dp
           WHERE dp.doctor_id = ? AND dp.active = 1`,
          [Number(doctorId)],
        );
    if (!doctor) {
      return reply.code(404).send({ error: "Selected doctor not found." });
    }

    const slotParts = getIndiaSlotParts(scheduledAt);
    if (!slotParts) {
      return reply.code(400).send({ error: "scheduledAt must be a valid datetime." });
    }
    const availableSlots = await buildDoctorSlots(Number(doctorId), slotParts.dateText);
    if (availableSlots.error) {
      return reply.code(400).send({ error: availableSlots.error });
    }
    const slotAllowed = availableSlots.slots.some((slot) => slot.time === slotParts.timeText);
    if (!slotAllowed) {
      return reply.code(409).send({ error: "Selected slot is no longer available." });
    }

    const normalizedVisitType = hospitalSettingsService.normalizeVisitTypeCode(visitType || "OPD");
    const allowedVisitTypes = await getAllowedVisitTypeCodes();
    if (!allowedVisitTypes.has(normalizedVisitType)) {
      return reply.code(400).send({ error: `visitType must be one of: ${Array.from(allowedVisitTypes).join(", ")}` });
    }
    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO appointments
       (user_id, member_id, doctor_id, department_id, department, reason, scheduled_at, status, visit_type, is_follow_up, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?)`,
      [
        patientId,
        doctorId ? Number(doctorId) : null,
        departmentRow.id,
        departmentRow.name,
        reason.trim(),
        new Date(scheduledAt).toISOString(),
        normalizedVisitType,
        isFollowUp ? 1 : 0,
        createdAt,
        createdAt,
      ],
    );

    await createAppointmentTimeline({
      appointmentId: result.lastID,
      actorUserId: request.authUser.id,
      eventType: "visit_created",
      fromStatus: null,
      toStatus: "requested",
      note: `${isFollowUp ? "Follow-up" : "New"} ${normalizedVisitType} visit created by operations`,
      metadata: {
        visitType: normalizedVisitType,
        isFollowUp: Boolean(isFollowUp),
        createdByRole: request.authUser.role,
      },
    });
    const appointmentFee = resolveConsultFee(doctor, "in_person");
    await upsertAppointmentBilling({
      appointmentId: result.lastID,
      amount: appointmentFee,
      status: appointmentFee > 0 ? "unpaid" : "waived",
      paymentMethod: appointmentFee > 0 ? null : "not_required",
      notes: appointmentFee > 0 ? "Waiting for patient payment." : "No consultation fee configured.",
      createdBy: request.authUser.id,
    });

    const appointment = await get(
      `SELECT a.*, d.name AS doctor_name, p.name AS patient_name, dep.name AS department_name
       FROM appointments a
       JOIN users p ON p.id = a.user_id
       LEFT JOIN users d ON d.id = a.doctor_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       WHERE a.id = ?`,
      [result.lastID],
    );

    await enqueueAndDeliverUserNotification({
      userId: Number(request.authUser.id),
      type: "appointment_status",
      title: "Appointment request received",
      message: `Your appointment request #${result.lastID} with ${appointment.doctor_name ? `Dr. ${appointment.doctor_name}` : "the doctor"} has been submitted. We’ll keep the details ready here.`,
      relatedId: result.lastID,
      eventKey: `appointment:${result.lastID}:created:patient`,
    });
    if (appointment.doctor_id) {
      await enqueueAndDeliverUserNotification({
        userId: Number(appointment.doctor_id),
        type: "appointment_status",
        title: "New appointment request",
        message: `${appointment.patient_name || "A patient"} requested appointment #${result.lastID} for ${new Date(appointment.scheduled_at).toLocaleString()}.`,
        relatedId: result.lastID,
        eventKey: `appointment:${result.lastID}:created:doctor`,
      });
    }

    return { appointment };
  });

  fastify.get("/api/appointments", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const limit = Math.max(1, Math.min(Number(request.query?.limit) || 60, 200));
    const rows = isDoctorRole(request.authUser.role) && request.authUser.role !== "admin"
      ? await all(
          `SELECT a.*, d.name AS doctor_name, p.name AS patient_name, p.email AS patient_email,
                  fm.name AS member_name, dep.name AS department_name
           FROM appointments a
           JOIN users p ON p.id = a.user_id
           LEFT JOIN users d ON d.id = a.doctor_id
           LEFT JOIN departments dep ON dep.id = a.department_id
           LEFT JOIN family_members fm ON fm.id = a.member_id
           WHERE (? = 'admin' OR a.doctor_id = ?)
           ORDER BY a.scheduled_at ASC
           LIMIT ?`,
          [request.authUser.role, request.authUser.id, limit],
        )
      : isOpsRole(request.authUser.role) || request.authUser.role === "admin"
        ? await all(
            `SELECT a.*, d.name AS doctor_name, p.name AS patient_name, p.email AS patient_email,
                    fm.name AS member_name, dep.name AS department_name, b.amount AS bill_amount,
                    b.status AS bill_status, b.payment_method AS bill_payment_method
             FROM appointments a
             JOIN users p ON p.id = a.user_id
             LEFT JOIN users d ON d.id = a.doctor_id
             LEFT JOIN departments dep ON dep.id = a.department_id
             LEFT JOIN family_members fm ON fm.id = a.member_id
             LEFT JOIN appointment_billing b ON b.appointment_id = a.id
             ORDER BY a.scheduled_at ASC
             LIMIT ?`,
            [limit],
          )
        : await all(
            `SELECT a.*, d.name AS doctor_name, p.name AS patient_name, p.email AS patient_email,
                    fm.name AS member_name, dep.name AS department_name, b.amount AS bill_amount,
                    b.status AS bill_status, b.payment_method AS bill_payment_method
             FROM appointments a
             JOIN users p ON p.id = a.user_id
             LEFT JOIN users d ON d.id = a.doctor_id
             LEFT JOIN departments dep ON dep.id = a.department_id
             LEFT JOIN family_members fm ON fm.id = a.member_id
             LEFT JOIN appointment_billing b ON b.appointment_id = a.id
             WHERE a.user_id = ?
             ORDER BY a.scheduled_at ASC
             LIMIT ?`,
            [request.authUser.id, limit],
          );
    for (const row of rows) {
      if (request.authUser.role === "doctor") {
        await maybeEnqueueAppointmentReminder({ appointment: row, recipientUserId: request.authUser.id, audience: "doctor" });
      } else if (request.authUser.role === "patient") {
        await maybeEnqueueAppointmentReminder({ appointment: row, recipientUserId: request.authUser.id, audience: "patient" });
      }
    }
    return { appointments: rows };
  });

  fastify.get("/api/appointments/:appointmentId/timeline", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Invalid appointment id." });
    const appointment = await get("SELECT id, user_id, doctor_id FROM appointments WHERE id = ?", [appointmentId]);
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    const canAccess =
      Number(appointment.user_id) === Number(request.authUser.id) ||
      Number(appointment.doctor_id) === Number(request.authUser.id) ||
      isOpsRole(request.authUser.role) ||
      request.authUser.role === "admin";
    if (!canAccess) {
      return reply.code(403).send({ error: "Forbidden." });
    }
    const timeline = await all(
      `SELECT t.id, t.event_type, t.from_status, t.to_status, t.note, t.metadata_json, t.created_at,
              u.name AS actor_name, u.role AS actor_role
       FROM appointment_timeline t
       LEFT JOIN users u ON u.id = t.actor_user_id
       WHERE t.appointment_id = ?
       ORDER BY t.created_at ASC`,
      [appointmentId],
    );
    return {
      timeline: timeline.map((item) => ({
        id: item.id,
        eventType: item.event_type,
        fromStatus: item.from_status,
        toStatus: item.to_status,
        note: item.note,
        metadata: item.metadata_json ? JSON.parse(item.metadata_json) : null,
        createdAt: item.created_at,
        actorName: item.actor_name || "System",
        actorRole: item.actor_role || "system",
      })),
    };
  });

  fastify.patch("/api/appointments/:appointmentId/reschedule", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    const { scheduledAt = "", reason = "" } = request.body || {};
    if (!appointmentId || Number.isNaN(new Date(scheduledAt).getTime())) {
      return reply.code(400).send({ error: "Valid appointment and scheduledAt are required." });
    }
    if (!reason || String(reason).trim().length < 4) {
      return reply.code(400).send({ error: "Reschedule reason is required." });
    }
    const appointment = await get(
      "SELECT id, user_id, doctor_id, status, scheduled_at FROM appointments WHERE id = ?",
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    if (Number(appointment.user_id) !== Number(request.authUser.id)) {
      return reply.code(403).send({ error: "Only the patient can reschedule this appointment." });
    }
    if (!["requested", "approved"].includes(normalizeAppointmentStatus(appointment.status))) {
      return reply.code(409).send({ error: "Only requested/approved appointments can be rescheduled." });
    }
    const nextDate = new Date(scheduledAt);
    const slotParts = getIndiaSlotParts(scheduledAt);
    if (!slotParts) {
      return reply.code(400).send({ error: "Valid appointment and scheduledAt are required." });
    }
    const availableSlots = await buildDoctorSlots(Number(appointment.doctor_id), slotParts.dateText);
    if (availableSlots.error) {
      return reply.code(400).send({ error: availableSlots.error });
    }
    const slotAllowed = availableSlots.slots.some((slot) => slot.time === slotParts.timeText);
    if (!slotAllowed) {
      return reply.code(409).send({ error: "Selected slot is not available." });
    }
    const previousTime = appointment.scheduled_at;
    await run("UPDATE appointments SET scheduled_at = ?, updated_at = ? WHERE id = ?", [
      nextDate.toISOString(),
      nowIso(),
      appointmentId,
    ]);
    await createAppointmentTimeline({
      appointmentId,
      actorUserId: request.authUser.id,
      eventType: "rescheduled",
      fromStatus: appointment.status,
      toStatus: appointment.status,
      note: `Patient rescheduled: ${String(reason).trim()}`,
      metadata: {
        fromScheduledAt: previousTime,
        toScheduledAt: nextDate.toISOString(),
        reason: String(reason).trim(),
      },
    });
    await enqueueAndDeliverUserNotification({
      userId: Number(appointment.user_id),
      type: "appointment_status",
      title: "Appointment rescheduled",
      message: `Your appointment has been moved to ${nextDate.toLocaleString()}. Your plan and reports are still ready for that visit.`,
      relatedId: appointmentId,
      eventKey: `appointment:${appointmentId}:rescheduled:${nextDate.toISOString()}`,
    });
    if (appointment.doctor_id) {
      await enqueueAndDeliverUserNotification({
        userId: Number(appointment.doctor_id),
        type: "appointment_status",
        title: "Appointment rescheduled",
        message: `Appointment #${appointmentId} was rescheduled by the patient to ${nextDate.toLocaleString()}.`,
        relatedId: appointmentId,
        eventKey: `appointment:${appointmentId}:rescheduled:doctor:${nextDate.toISOString()}`,
      });
    }
    await notifyFrontDeskUsers({
      type: "appointment_status",
      title: "Appointment rescheduled",
      message: `Appointment #${appointmentId} was rescheduled by the patient to ${nextDate.toLocaleString()}.`,
      relatedId: appointmentId,
      eventKeyBase: `appointment:${appointmentId}:rescheduled:${nextDate.toISOString()}`,
    });
    return { ok: true };
  });

  fastify.patch("/api/appointments/:appointmentId/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    const { status } = request.body || {};
    const nextStatus = normalizeAppointmentStatus(status);
    if (!appointmentId || !APPOINTMENT_ALLOWED_STATUSES.has(nextStatus)) {
      return reply.code(400).send({ error: "Invalid appointment update." });
    }
    const appointment = await get(
      "SELECT id, user_id, doctor_id, department_id, status, scheduled_at, reason FROM appointments WHERE id = ?",
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    const currentStatus = normalizeAppointmentStatus(appointment.status);

    if (request.authUser.role === "admin") {
      // admin can operate status changes but must follow deterministic transitions
    } else if (request.authUser.role === "doctor") {
      if (Number(appointment.doctor_id) !== Number(request.authUser.id)) {
        return reply.code(403).send({ error: "Doctors can only update their own appointments." });
      }
      const allowedDoctorStatuses = new Set(["approved", "checked_in", "completed", "cancelled", "no_show"]);
      if (!allowedDoctorStatuses.has(nextStatus)) {
        return reply.code(403).send({ error: "Doctor cannot apply this appointment status." });
      }
    } else if (request.authUser.role === "front_desk") {
      const allowedOperationalStatuses = new Set(["checked_in", "completed", "cancelled", "no_show"]);
      if (!allowedOperationalStatuses.has(nextStatus)) {
        return reply.code(403).send({ error: "Only admin can approve appointments." });
      }
      if (currentStatus === "requested" && nextStatus !== "cancelled") {
        return reply.code(403).send({ error: "Requested appointments must be approved by admin first." });
      }
    } else if (request.authUser.id === Number(appointment.user_id) && nextStatus === "cancelled") {
      // patients can only cancel their own appointment
    } else {
      return reply.code(403).send({ error: "Access denied." });
    }
    if (!canTransitionAppointmentStatus({ fromStatus: currentStatus, toStatus: nextStatus })) {
      return reply.code(409).send({
        error: `Invalid status transition: ${currentStatus} -> ${nextStatus}.`,
      });
    }
    await run("UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?", [nextStatus, nowIso(), appointmentId]);
    await createAppointmentTimeline({
      appointmentId,
      actorUserId: request.authUser.id,
      eventType: "status_changed",
      fromStatus: currentStatus,
      toStatus: nextStatus,
      note: `Appointment status changed from ${currentStatus} to ${nextStatus}`,
    });
    if (request.authUser.id !== Number(appointment.user_id)) {
      const statusLabelMap = {
        requested: "moved to requested",
        approved: "scheduled",
        checked_in: "checked in",
        completed: "marked completed",
        cancelled: "cancelled",
        no_show: "marked no-show",
      };
      await enqueueAndDeliverUserNotification({
        userId: Number(appointment.user_id),
        type: "appointment_status",
        title: "Appointment update",
        message: `Your appointment was ${statusLabelMap[nextStatus] || nextStatus}. You can review the latest update whenever convenient.`,
        relatedId: appointmentId,
        eventKey: `appointment:${appointmentId}:status:${currentStatus}->${nextStatus}`,
      });
    }
    if (appointment.doctor_id && request.authUser.id !== Number(appointment.doctor_id)) {
      await enqueueAndDeliverUserNotification({
        userId: Number(appointment.doctor_id),
        type: "appointment_status",
        title: "Appointment update",
        message: `Appointment #${appointmentId} was ${nextStatus.replace(/_/g, " ")}.`,
        relatedId: appointmentId,
        eventKey: `appointment:${appointmentId}:doctor-status:${currentStatus}->${nextStatus}`,
      });
    }
    if (request.authUser.id === Number(appointment.user_id)) {
      await notifyFrontDeskUsers({
        type: "appointment_status",
        title: "Appointment update",
        message: `Appointment #${appointmentId} was ${nextStatus.replace(/_/g, " ")} by the patient.`,
        relatedId: appointmentId,
        eventKeyBase: `appointment:${appointmentId}:patient-status:${currentStatus}->${nextStatus}`,
      });
    }
    const updated = await get(
      `SELECT a.*, d.name AS doctor_name, p.name AS patient_name, p.email AS patient_email,
              fm.name AS member_name, dep.name AS department_name, b.amount AS bill_amount,
              b.status AS bill_status, b.payment_method AS bill_payment_method
       FROM appointments a
       JOIN users p ON p.id = a.user_id
       LEFT JOIN users d ON d.id = a.doctor_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       LEFT JOIN family_members fm ON fm.id = a.member_id
       LEFT JOIN appointment_billing b ON b.appointment_id = a.id
       WHERE a.id = ?`,
      [appointmentId],
    );
    return { ok: true, appointment: updated };
  });

  fastify.patch("/api/admin/appointments/:appointmentId", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) {
      return reply.code(400).send({ error: "Valid appointment id is required." });
    }

    const appointment = await get(
      `SELECT a.*, p.name AS patient_name
       FROM appointments a
       JOIN users p ON p.id = a.user_id
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!appointment) {
      return reply.code(404).send({ error: "Appointment not found." });
    }

    const { doctorId = appointment.doctor_id, departmentId = appointment.department_id, scheduledAt = appointment.scheduled_at, status = appointment.status, reason = appointment.reason } = request.body || {};

    const nextDepartmentId = Number(departmentId);
    const nextDoctorId = Number(doctorId);
    const currentStatus = normalizeAppointmentStatus(appointment.status);
    const nextStatus = normalizeAppointmentStatus(status || appointment.status);
    const nextReason = String(reason || appointment.reason).trim();
    const nextScheduledAt = new Date(scheduledAt);

    if (!nextDepartmentId) return reply.code(400).send({ error: "Valid department is required." });
    if (!nextDoctorId) return reply.code(400).send({ error: "Valid doctor is required." });
    if (!APPOINTMENT_ALLOWED_STATUSES.has(nextStatus)) return reply.code(400).send({ error: "Invalid appointment status." });
    if (!canTransitionAppointmentStatus({ fromStatus: currentStatus, toStatus: nextStatus })) {
      return reply.code(409).send({
        error: `Invalid appointment transition: ${currentStatus} -> ${nextStatus}.`,
      });
    }
    if (!nextReason || nextReason.length < 5) return reply.code(400).send({ error: "Reason must be at least 5 characters." });
    if (Number.isNaN(nextScheduledAt.getTime())) return reply.code(400).send({ error: "Valid scheduled time is required." });

    const departmentRow = await get("SELECT id, name FROM departments WHERE id = ? AND active = 1", [nextDepartmentId]);
    if (!departmentRow) return reply.code(404).send({ error: "Selected department not found." });
    const doctorRow = await get(
      `SELECT dp.doctor_id AS id, COALESCE(dp.display_name, u.name) AS name
       FROM doctor_profiles dp
       JOIN users u ON u.id = dp.doctor_id
       WHERE dp.doctor_id = ? AND dp.active = 1 AND dp.department_id = ?`,
      [nextDoctorId, nextDepartmentId],
    );
    if (!doctorRow) return reply.code(404).send({ error: "Selected doctor is not active in this department." });

    const slotParts = getIndiaSlotParts(nextScheduledAt);
    if (!slotParts) return reply.code(400).send({ error: "Valid scheduled time is required." });
    const availableSlots = await buildDoctorSlots(nextDoctorId, slotParts.dateText, { excludeAppointmentId: appointmentId });
    if (availableSlots.error) return reply.code(400).send({ error: availableSlots.error });
    const slotAllowed = availableSlots.slots.some((slot) => slot.time === slotParts.timeText);
    if (!slotAllowed) return reply.code(409).send({ error: "Selected slot is no longer available for this doctor." });

    await run(
      `UPDATE appointments
       SET doctor_id = ?, department_id = ?, department = ?, reason = ?, scheduled_at = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [nextDoctorId, nextDepartmentId, departmentRow.name, nextReason, nextScheduledAt.toISOString(), nextStatus, nowIso(), appointmentId],
    );

    const beforeMeta = {
      doctorId: appointment.doctor_id,
      departmentId: appointment.department_id,
      scheduledAt: appointment.scheduled_at,
      status: appointment.status,
      reason: appointment.reason,
    };
    const afterMeta = {
      doctorId: nextDoctorId,
      departmentId: nextDepartmentId,
      scheduledAt: nextScheduledAt.toISOString(),
      status: nextStatus,
      reason: nextReason,
    };

    await createAppointmentTimeline({
      appointmentId,
      actorUserId: request.authUser.id,
      eventType: "admin_updated",
      fromStatus: currentStatus,
      toStatus: nextStatus,
      note: "Appointment details updated by admin",
      metadata: { before: beforeMeta, after: afterMeta },
    });

    if (currentStatus !== nextStatus || appointment.doctor_id !== nextDoctorId || appointment.department_id !== nextDepartmentId || appointment.scheduled_at !== nextScheduledAt.toISOString()) {
      const changes = [];
      if (currentStatus !== nextStatus) changes.push(`status: ${currentStatus} -> ${nextStatus}`);
      if (appointment.department_id !== nextDepartmentId) changes.push(`department: ${appointment.department || "-"} -> ${departmentRow.name}`);
      if (appointment.doctor_id !== nextDoctorId) changes.push("doctor reassigned");
      if (appointment.scheduled_at !== nextScheduledAt.toISOString()) changes.push(`rescheduled to ${nextScheduledAt.toLocaleString()}`);
      await enqueueAndDeliverUserNotification({
        userId: Number(appointment.user_id),
        type: "appointment_status",
        title: "Appointment updated",
        message: `Your appointment details were updated (${changes.join(", ")}). Everything stays ready in one place here.`,
        relatedId: appointmentId,
        eventKey: `appointment:${appointmentId}:admin-update:${currentStatus}->${nextStatus}:${nextDoctorId}:${nextDepartmentId}:${nextScheduledAt.toISOString()}`,
      });
      await enqueueAndDeliverUserNotification({
        userId: Number(nextDoctorId),
        type: "appointment_status",
        title: "Appointment updated",
        message: `Appointment #${appointmentId} was updated by admin and is now set for ${nextScheduledAt.toLocaleString()}.`,
        relatedId: appointmentId,
        eventKey: `appointment:${appointmentId}:admin-update:doctor:${nextDoctorId}:${nextScheduledAt.toISOString()}`,
      });
      if (appointment.doctor_id && Number(appointment.doctor_id) !== Number(nextDoctorId)) {
        await enqueueAndDeliverUserNotification({
          userId: Number(appointment.doctor_id),
          type: "appointment_status",
          title: "Appointment reassigned",
          message: `Appointment #${appointmentId} is no longer assigned to you.`,
          relatedId: appointmentId,
          eventKey: `appointment:${appointmentId}:reassigned:from:${appointment.doctor_id}:${nextDoctorId}`,
        });
      }
    }

    const updated = await get(
      `SELECT a.*, d.name AS doctor_name, p.name AS patient_name, p.email AS patient_email,
              fm.name AS member_name, dep.name AS department_name, b.amount AS bill_amount,
              b.status AS bill_status, b.payment_method AS bill_payment_method
       FROM appointments a
       JOIN users p ON p.id = a.user_id
       LEFT JOIN users d ON d.id = a.doctor_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       LEFT JOIN family_members fm ON fm.id = a.member_id
       LEFT JOIN appointment_billing b ON b.appointment_id = a.id
       WHERE a.id = ?`,
      [appointmentId],
    );
    return { appointment: updated };
  });

  fastify.get("/api/admin/appointments/:appointmentId/timeline", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Valid appointment id is required." });
    const appointment = await get("SELECT id FROM appointments WHERE id = ?", [appointmentId]);
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    const rows = await all(
      `SELECT t.id, t.event_type, t.from_status, t.to_status, t.note, t.metadata_json, t.created_at,
              u.name AS actor_name, u.role AS actor_role
       FROM appointment_timeline t
       LEFT JOIN users u ON u.id = t.actor_user_id
       WHERE t.appointment_id = ?
       ORDER BY t.created_at DESC, t.id DESC`,
      [appointmentId],
    );
    return {
      timeline: rows.map((row) => ({
        ...row,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
      })),
    };
  });

  fastify.get("/api/ops/queue", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT a.id, a.status, a.reason, a.scheduled_at, a.created_at,
              p.name AS patient_name, p.email AS patient_email,
              d.name AS doctor_name, dep.name AS department_name,
              fm.name AS member_name,
              b.amount AS bill_amount, b.status AS bill_status, b.payment_method AS bill_payment_method
       FROM appointments a
       JOIN users p ON p.id = a.user_id
       LEFT JOIN users d ON d.id = a.doctor_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       LEFT JOIN family_members fm ON fm.id = a.member_id
       LEFT JOIN appointment_billing b ON b.appointment_id = a.id
       WHERE date(a.scheduled_at) = date('now')
       ORDER BY
         CASE a.status
           WHEN 'checked_in' THEN 0
           WHEN 'approved' THEN 1
           WHEN 'completed' THEN 2
           WHEN 'no_show' THEN 3
           WHEN 'cancelled' THEN 4
           ELSE 5
         END,
         a.scheduled_at ASC`,
    );
    return { queue: rows };
  });

  fastify.post("/api/appointments/:appointmentId/billing", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    const { amount = 0, status = "unpaid", paymentMethod = "", notes = "" } = request.body || {};
    const allowedStatuses = new Set(["unpaid", "paid", "partial", "waived"]);
    const numericAmount = Number(amount);
    if (!appointmentId || Number.isNaN(numericAmount) || numericAmount < 0 || !allowedStatuses.has(status)) {
      return reply.code(400).send({ error: "Invalid billing payload." });
    }
    const appointment = await get("SELECT id FROM appointments WHERE id = ?", [appointmentId]);
    if (!appointment) {
      return reply.code(404).send({ error: "Appointment not found." });
    }

    await run(
      `INSERT INTO appointment_billing
       (appointment_id, amount, status, payment_method, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(appointment_id) DO UPDATE SET
         amount = excluded.amount,
         status = excluded.status,
         payment_method = excluded.payment_method,
         notes = excluded.notes,
         created_by = excluded.created_by,
         updated_at = excluded.updated_at`,
      [appointmentId, numericAmount, status, paymentMethod || null, notes || null, request.authUser.id, nowIso(), nowIso()],
    );

    const billing = await get(
      `SELECT id, appointment_id, amount, status, payment_method, notes, updated_at
       FROM appointment_billing
       WHERE appointment_id = ?`,
      [appointmentId],
    );
    return { billing };
  });

  fastify.get("/api/appointments/:appointmentId/receipt", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) {
      return reply.code(400).send({ error: "Valid appointmentId is required." });
    }
    const row = await get(
      `SELECT a.id, a.status, a.reason, a.scheduled_at, a.doctor_id,
              p.id AS patient_id, p.name AS patient_name, p.email AS patient_email,
              d.name AS doctor_name, dep.name AS department_name,
              fm.name AS member_name,
              b.amount AS bill_amount, b.status AS bill_status, b.payment_method, b.notes
       FROM appointments a
       JOIN users p ON p.id = a.user_id
       LEFT JOIN users d ON d.id = a.doctor_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       LEFT JOIN family_members fm ON fm.id = a.member_id
       LEFT JOIN appointment_billing b ON b.appointment_id = a.id
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!row) return reply.code(404).send({ error: "Appointment not found." });
    const canView =
      request.authUser.role === "admin" ||
      request.authUser.role === "front_desk" ||
      request.authUser.id === Number(row.patient_id) ||
      (request.authUser.role === "doctor" && request.authUser.id === Number(row.doctor_id));
    if (!canView) return reply.code(403).send({ error: "Access denied." });
    return {
      receipt: {
        appointmentId: row.id,
        patientName: row.member_name || row.patient_name,
        patientEmail: row.patient_email,
        department: row.department_name,
        doctorName: row.doctor_name,
        reason: row.reason,
        scheduledAt: row.scheduled_at,
        appointmentStatus: row.status,
        amount: row.bill_amount || 0,
        billingStatus: row.bill_status || "unpaid",
        paymentMethod: row.payment_method || "",
        notes: row.notes || "",
      },
    };
  });

  fastify.get("/api/payments/config", async () => ({
    paymentGateway: {
      enabled: Boolean(paymentGatewayService?.enabled),
      ...paymentGatewayService?.publicConfig,
    },
  }));

  fastify.post("/api/appointments/:appointmentId/payment-order", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) {
      return reply.code(400).send({ error: "Valid appointment id is required." });
    }
    const appointment = await get(
      `SELECT a.id, a.user_id, a.status, a.reason, a.scheduled_at,
              b.amount AS bill_amount, b.status AS bill_status
       FROM appointments a
       LEFT JOIN appointment_billing b ON b.appointment_id = a.id
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    if (Number(appointment.user_id) !== Number(request.authUser.id)) {
      return reply.code(403).send({ error: "Access denied." });
    }
    if (["cancelled", "no_show"].includes(String(appointment.status || "").toLowerCase())) {
      return reply.code(409).send({ error: "Cancelled appointments cannot be paid online." });
    }
    const amount = normalizeAmount(appointment.bill_amount);
    if (amount <= 0) {
      return reply.code(409).send({ error: "No payable consultation fee is available for this appointment." });
    }
    if (String(appointment.bill_status || "").toLowerCase() === "paid") {
      return reply.code(409).send({ error: "This appointment has already been paid." });
    }

    const order = await paymentGatewayService.createRazorpayOrder({
      amountPaise: Math.round(amount * 100),
      receipt: `appt_${appointmentId}_${Date.now()}`,
      notes: {
        reference_type: "appointment",
        reference_id: String(appointmentId),
        patient_id: String(request.authUser.id),
      },
    });
    await upsertAppointmentBilling({
      appointmentId,
      amount,
      status: "unpaid",
      notes: "Online payment order created.",
      gatewayOrderId: order.id,
      createdBy: request.authUser.id,
    });
    await createPaymentTransaction({
      referenceType: "appointment",
      referenceId: appointmentId,
      providerOrderId: order.id,
      amount,
      createdByUserId: request.authUser.id,
    });
    return {
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: paymentGatewayService.publicConfig.keyId,
        description: "Consultation payment",
        patientName: request.authUser.name || "",
      },
    };
  });

  fastify.post("/api/appointments/:appointmentId/payment-verify", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
      request.body || {};
    if (!appointmentId || !orderId || !paymentId || !signature) {
      return reply.code(400).send({ error: "Payment verification payload is incomplete." });
    }
    const appointment = await get(
      `SELECT a.id, a.user_id, b.amount AS bill_amount
       FROM appointments a
       LEFT JOIN appointment_billing b ON b.appointment_id = a.id
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    if (Number(appointment.user_id) !== Number(request.authUser.id)) {
      return reply.code(403).send({ error: "Access denied." });
    }
    const verified = paymentGatewayService.verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
    });
    if (!verified) {
      return reply.code(400).send({ error: "Payment signature verification failed." });
    }
    await upsertAppointmentBilling({
      appointmentId,
      amount: appointment.bill_amount || 0,
      status: "paid",
      paymentMethod: "online_upi_card",
      notes: "Paid online via Razorpay.",
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignature: signature,
      createdBy: request.authUser.id,
    });
    await finalizePaymentTransaction({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      providerSignature: signature,
      paymentMethod: "online_upi_card",
      rawPayloadJson: JSON.stringify(request.body || {}),
    });
    const billing = await get(
      `SELECT id, appointment_id, amount, status, payment_method, notes, gateway_order_id, gateway_payment_id, updated_at
       FROM appointment_billing WHERE appointment_id = ?`,
      [appointmentId],
    );
    return { billing };
  });

  fastify.post("/api/teleconsults/:consultId/payment-order", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    if (!consultId) {
      return reply.code(400).send({ error: "Valid consult id is required." });
    }
    const consult = await get(
      `SELECT tr.id, tr.user_id, tr.status, tb.amount AS bill_amount, tb.status AS bill_status
       FROM teleconsult_requests tr
       LEFT JOIN teleconsult_billing tb ON tb.consult_id = tr.id
       WHERE tr.id = ?`,
      [consultId],
    );
    if (!consult) return reply.code(404).send({ error: "Consult not found." });
    if (Number(consult.user_id) !== Number(request.authUser.id)) {
      return reply.code(403).send({ error: "Access denied." });
    }
    if (["cancelled", "no_show"].includes(String(consult.status || "").toLowerCase())) {
      return reply.code(409).send({ error: "Cancelled consults cannot be paid online." });
    }
    const amount = normalizeAmount(consult.bill_amount);
    if (amount <= 0) {
      return reply.code(409).send({ error: "No payable consultation fee is available for this consult." });
    }
    if (String(consult.bill_status || "").toLowerCase() === "paid") {
      return reply.code(409).send({ error: "This consult has already been paid." });
    }

    const order = await paymentGatewayService.createRazorpayOrder({
      amountPaise: Math.round(amount * 100),
      receipt: `tele_${consultId}_${Date.now()}`,
      notes: {
        reference_type: "teleconsult",
        reference_id: String(consultId),
        patient_id: String(request.authUser.id),
      },
    });
    await upsertTeleconsultBilling({
      consultId,
      amount,
      status: "unpaid",
      notes: "Online payment order created.",
      gatewayOrderId: order.id,
      createdBy: request.authUser.id,
    });
    await createPaymentTransaction({
      referenceType: "teleconsult",
      referenceId: consultId,
      providerOrderId: order.id,
      amount,
      createdByUserId: request.authUser.id,
    });
    return {
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: paymentGatewayService.publicConfig.keyId,
        description: "Remote consultation payment",
        patientName: request.authUser.name || "",
      },
    };
  });

  fastify.post("/api/teleconsults/:consultId/payment-verify", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
      request.body || {};
    if (!consultId || !orderId || !paymentId || !signature) {
      return reply.code(400).send({ error: "Payment verification payload is incomplete." });
    }
    const consult = await get(
      `SELECT tr.id, tr.user_id, tb.amount AS bill_amount
       FROM teleconsult_requests tr
       LEFT JOIN teleconsult_billing tb ON tb.consult_id = tr.id
       WHERE tr.id = ?`,
      [consultId],
    );
    if (!consult) return reply.code(404).send({ error: "Consult not found." });
    if (Number(consult.user_id) !== Number(request.authUser.id)) {
      return reply.code(403).send({ error: "Access denied." });
    }
    const verified = paymentGatewayService.verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
    });
    if (!verified) {
      return reply.code(400).send({ error: "Payment signature verification failed." });
    }
    await upsertTeleconsultBilling({
      consultId,
      amount: consult.bill_amount || 0,
      status: "paid",
      paymentMethod: "online_upi_card",
      notes: "Paid online via Razorpay.",
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignature: signature,
      createdBy: request.authUser.id,
    });
    await finalizePaymentTransaction({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      providerSignature: signature,
      paymentMethod: "online_upi_card",
      rawPayloadJson: JSON.stringify(request.body || {}),
    });
    const billing = await get(
      `SELECT id, consult_id, amount, status, payment_method, notes, gateway_order_id, gateway_payment_id, updated_at
       FROM teleconsult_billing WHERE consult_id = ?`,
      [consultId],
    );
    return { billing };
  });
};

module.exports = { registerAppointmentRoutes };
