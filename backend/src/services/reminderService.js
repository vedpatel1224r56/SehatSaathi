const INDIA_TZ = "Asia/Kolkata";

const DEFAULT_SETTINGS = {
  dailyReminderTime: "08:00",
  planReminders: true,
  followupNudges: true,
  visitReminders: true,
  labReminders: true,
};

const createReminderService = ({
  all,
  get,
  run,
  nowIso,
  enqueueAndDeliverUserNotification,
  log,
}) => {
  const indiaFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const formatInIndia = (date = new Date()) => {
    const parts = Object.fromEntries(
      indiaFormatter
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
    };
  };

  const parseTimeMinutes = (value = "") => {
    const match = String(value || "").trim().match(/^(\d{2}):(\d{2})$/);
    if (!match) return 8 * 60;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return 8 * 60;
    }
    return hours * 60 + minutes;
  };

  const mapSettingsRow = (row) => ({
    dailyReminderTime: String(row?.daily_reminder_time || DEFAULT_SETTINGS.dailyReminderTime),
    planReminders: Number(row?.plan_reminders) !== 0,
    followupNudges: Number(row?.followup_nudges) !== 0,
    visitReminders: Number(row?.visit_reminders) !== 0,
    labReminders: Number(row?.lab_reminders) !== 0,
  });

  const ensureSettings = async (userId) => {
    if (!userId) return DEFAULT_SETTINGS;
    let row = await get(
      `SELECT daily_reminder_time, plan_reminders, followup_nudges, visit_reminders, lab_reminders
       FROM patient_notification_preferences
       WHERE user_id = ?`,
      [Number(userId)],
    );
    if (!row) {
      await run(
        `INSERT INTO patient_notification_preferences
         (user_id, daily_reminder_time, plan_reminders, followup_nudges, visit_reminders, lab_reminders, created_at, updated_at)
         VALUES (?, ?, 1, 1, 1, 1, ?, ?)`,
        [Number(userId), DEFAULT_SETTINGS.dailyReminderTime, nowIso(), nowIso()],
      );
      row = await get(
        `SELECT daily_reminder_time, plan_reminders, followup_nudges, visit_reminders, lab_reminders
         FROM patient_notification_preferences
         WHERE user_id = ?`,
        [Number(userId)],
      );
    }
    return mapSettingsRow(row);
  };

  const updateSettings = async (userId, payload = {}) => {
    const current = await ensureSettings(userId);
    const next = {
      dailyReminderTime: /^\d{2}:\d{2}$/.test(String(payload.dailyReminderTime || ""))
        ? String(payload.dailyReminderTime)
        : current.dailyReminderTime,
      planReminders: payload.planReminders == null ? current.planReminders : Boolean(payload.planReminders),
      followupNudges: payload.followupNudges == null ? current.followupNudges : Boolean(payload.followupNudges),
      visitReminders: payload.visitReminders == null ? current.visitReminders : Boolean(payload.visitReminders),
      labReminders: payload.labReminders == null ? current.labReminders : Boolean(payload.labReminders),
    };
    await run(
      `UPDATE patient_notification_preferences
       SET daily_reminder_time = ?, plan_reminders = ?, followup_nudges = ?, visit_reminders = ?, lab_reminders = ?, updated_at = ?
       WHERE user_id = ?`,
      [
        next.dailyReminderTime,
        next.planReminders ? 1 : 0,
        next.followupNudges ? 1 : 0,
        next.visitReminders ? 1 : 0,
        next.labReminders ? 1 : 0,
        nowIso(),
        Number(userId),
      ],
    );
    return next;
  };

  const hasUpcomingVisit = async (userId, afterIso) => {
    const appointment = await get(
      `SELECT id
       FROM appointments
       WHERE user_id = ?
         AND status IN ('requested', 'approved', 'checked_in')
         AND scheduled_at >= ?
       ORDER BY scheduled_at ASC
       LIMIT 1`,
      [Number(userId), afterIso],
    );
    if (appointment?.id) return true;
    const consult = await get(
      `SELECT id
       FROM teleconsult_requests
       WHERE user_id = ?
         AND status IN ('requested', 'scheduled', 'in_progress')
         AND COALESCE(preferred_slot, created_at) >= ?
       ORDER BY COALESCE(preferred_slot, created_at) ASC
       LIMIT 1`,
      [Number(userId), afterIso],
    );
    return Boolean(consult?.id);
  };

  const maybeQueuePlanReminder = async ({ userId, settings, nowParts }) => {
    if (!settings.planReminders) return;
    if (nowParts.minuteOfDay < parseTimeMinutes(settings.dailyReminderTime)) return;
    const plans = await all(
      `SELECT id, title, progress_json
       FROM patient_health_plans
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`,
      [Number(userId)],
    );
    if (!plans.length) return;
    const activePlan = plans.find((plan) => {
      const progress = plan.progress_json ? JSON.parse(plan.progress_json) : {};
      const todayMap = progress?.[nowParts.dateKey] || {};
      return !Object.values(todayMap).some(Boolean);
    });
    if (!activePlan) return;
    await enqueueAndDeliverUserNotification({
      userId: Number(userId),
      type: "plan_reminder",
      title: "Plan reminder",
      message: `A small step today can help keep ${activePlan.title.toLowerCase()} on track. One useful check-in is enough for today.`,
      relatedId: activePlan.id,
      eventKey: `plan:${activePlan.id}:reminder:${nowParts.dateKey}:${settings.dailyReminderTime}`,
    });
  };

  const maybeQueueFollowupNudge = async ({ userId, settings, nowParts, nowDate }) => {
    if (!settings.followupNudges) return;
    const rows = await all(
      `SELECT id, followup_date, diagnosis_text
       FROM encounters
       WHERE user_id = ?
         AND followup_date IS NOT NULL
       ORDER BY followup_date ASC, id DESC`,
      [Number(userId)],
    );
    for (const row of rows) {
      const followupDate = new Date(row.followup_date);
      if (Number.isNaN(followupDate.getTime())) continue;
      const dayDiff = Math.floor((followupDate.getTime() - nowDate.getTime()) / (24 * 60 * 60 * 1000));
      if (dayDiff > 2) continue;
      const upcomingVisitExists = await hasUpcomingVisit(userId, nowIso());
      if (upcomingVisitExists) return;
      const overdue = dayDiff < 0;
      await enqueueAndDeliverUserNotification({
        userId: Number(userId),
        type: "followup_nudge",
        title: overdue ? "Follow-up check-in" : "Follow-up coming up",
        message: overdue
          ? `It may be a good time to review your latest health progress again and carry your reports and plan notes into the next visit.`
          : `Your follow-up is coming up soon. Booking it while your recent report and plan trend are still fresh can make the visit easier.`,
        relatedId: row.id,
        eventKey: `followup:${row.id}:${nowParts.dateKey}:${overdue ? "overdue" : "due-soon"}`,
      });
      return;
    }
  };

  const maybeQueueContinuityMemoryNudge = async ({ userId, settings, nowParts }) => {
    if (!settings.followupNudges) return;
    const latestRecord = await get(
      `SELECT id, created_at
       FROM medical_records
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [Number(userId)],
    );
    if (!latestRecord?.id) return;

    const latestActivity = await get(
      `SELECT id, tracker_key, value_text, logged_at
       FROM patient_health_plan_activity
       WHERE user_id = ?
       ORDER BY logged_at DESC, id DESC
       LIMIT 1`,
      [Number(userId)],
    );
    const latestQuestion = await get(
      `SELECT id, value_text, logged_at
       FROM patient_health_plan_activity
       WHERE user_id = ?
         AND tracker_key = 'question'
       ORDER BY logged_at DESC, id DESC
       LIMIT 1`,
      [Number(userId)],
    );
    const activityAgeDays = latestActivity?.logged_at
      ? Math.floor((Date.now() - new Date(latestActivity.logged_at).getTime()) / (24 * 60 * 60 * 1000))
      : null;
    if (activityAgeDays !== null && activityAgeDays < 7 && !latestQuestion?.id) return;

    const weekKey = `${nowParts.year}-W${Math.ceil((Number(nowParts.day) + new Date(`${nowParts.year}-${nowParts.month}-01`).getDay()) / 7)}`;
    const message = latestQuestion?.value_text
      ? `Your saved question is still ready for your next review: "${String(latestQuestion.value_text).slice(0, 120)}"`
      : "Your report is saved. One BP, glucose, weight, symptom, medicine, or question can make your next review clearer.";
    await enqueueAndDeliverUserNotification({
      userId: Number(userId),
      type: "continuity_memory",
      title: latestQuestion?.value_text ? "Question still ready" : "Health memory check-in",
      message,
      relatedId: latestQuestion?.id || latestRecord.id,
      eventKey: `continuity:${userId}:${weekKey}`,
    });
  };

  const queueVisitReminderForItem = async ({ userId, type, title, message, relatedId, eventKey }) => {
    await enqueueAndDeliverUserNotification({
      userId: Number(userId),
      type,
      title,
      message,
      relatedId,
      eventKey,
    });
  };

  const maybeQueueVisitReminders = async ({ userId, settings, nowDate }) => {
    if (!settings.visitReminders) return;
    const appointments = await all(
      `SELECT id, scheduled_at
       FROM appointments
       WHERE user_id = ?
         AND status = 'approved'
         AND scheduled_at > ?
       ORDER BY scheduled_at ASC
       LIMIT 10`,
      [Number(userId), nowIso()],
    );
    for (const item of appointments) {
      const scheduledAt = new Date(item.scheduled_at);
      const diffMs = scheduledAt.getTime() - nowDate.getTime();
      if (diffMs <= 0 || diffMs > 24 * 60 * 60 * 1000) continue;
      const milestone = diffMs <= 2 * 60 * 60 * 1000 ? "2h" : "24h";
      await queueVisitReminderForItem({
        userId,
        type: "appointment_reminder",
        title: "Visit reminder",
        message:
          milestone === "2h"
            ? `Your visit is coming up shortly. Keep your reports ready and take a quick look at the timing when you can.`
            : `You have a visit in the next 24 hours. Keeping your reports and current plan ready can make the visit smoother.`,
        relatedId: item.id,
        eventKey: `appointment:${item.id}:window:${milestone}:${new Date(item.scheduled_at).toISOString()}`,
      });
    }

    const consults = await all(
      `SELECT id, mode, preferred_slot
       FROM teleconsult_requests
       WHERE user_id = ?
         AND status = 'scheduled'
         AND preferred_slot > ?
       ORDER BY preferred_slot ASC
       LIMIT 10`,
      [Number(userId), nowIso()],
    );
    for (const item of consults) {
      const scheduledAt = new Date(item.preferred_slot);
      const diffMs = scheduledAt.getTime() - nowDate.getTime();
      if (diffMs <= 0 || diffMs > 24 * 60 * 60 * 1000) continue;
      const milestone = diffMs <= 2 * 60 * 60 * 1000 ? "2h" : "24h";
      await queueVisitReminderForItem({
        userId,
        type: "appointment_reminder",
        title: "Remote consult reminder",
        message:
          milestone === "2h"
            ? `Your ${String(item.mode || "remote").toUpperCase()} consult starts soon. Keep your report summary and a quiet space ready.`
            : `You have a remote consult in the next 24 hours. Keeping your concern summary and reports ready can make it easier to start.`,
        relatedId: item.id,
        eventKey: `teleconsult:${item.id}:window:${milestone}:${new Date(item.preferred_slot).toISOString()}`,
      });
    }
  };

  const maybeQueueLabReminders = async ({ userId, settings, nowParts, nowDate }) => {
    if (!settings.labReminders) return;
    const rows = await all(
      `SELECT id, service_name, status, created_at, updated_at
       FROM marketplace_requests
       WHERE user_id = ?
         AND status IN ('requested', 'accepted', 'sample_collected', 'processing')
       ORDER BY updated_at DESC, id DESC
       LIMIT 10`,
      [Number(userId)],
    );
    for (const row of rows) {
      const referenceDate = new Date(row.updated_at || row.created_at);
      if (Number.isNaN(referenceDate.getTime())) continue;
      const ageHours = (nowDate.getTime() - referenceDate.getTime()) / (60 * 60 * 1000);
      let title = "";
      let message = "";
      if (row.status === "requested" && ageHours >= 12) {
        title = "Lab request reminder";
        message = `${row.service_name} is still waiting for confirmation. You can check the latest request status whenever it suits you.`;
      } else if (row.status === "accepted" && ageHours >= 18) {
        title = "Home collection follow-up";
        message = `${row.service_name} has been accepted. Keeping your phone nearby can make the next collection update easier to catch.`;
      } else if ((row.status === "sample_collected" || row.status === "processing") && ageHours >= 24) {
        title = "Lab processing update";
        message = `${row.service_name} is still in progress. You can open Requests anytime for the latest lab status.`;
      }
      if (!title || !message) continue;
      await enqueueAndDeliverUserNotification({
        userId: Number(userId),
        type: "lab_reminder",
        title,
        message,
        relatedId: row.id,
        eventKey: `lab:${row.id}:${row.status}:${nowParts.dateKey}`,
      });
      return;
    }
  };

  const generateDueRemindersForUser = async (userId) => {
    if (!userId) return;
    const settings = await ensureSettings(userId);
    const nowDate = new Date();
    const nowParts = formatInIndia(nowDate);
    await maybeQueuePlanReminder({ userId, settings, nowParts });
    await maybeQueueContinuityMemoryNudge({ userId, settings, nowParts });
    await maybeQueueFollowupNudge({ userId, settings, nowParts, nowDate });
    await maybeQueueVisitReminders({ userId, settings, nowDate });
    await maybeQueueLabReminders({ userId, settings, nowParts, nowDate });
  };

  const processDueReminders = async ({ userId = null, limit = 100 } = {}) => {
    if (userId) {
      await generateDueRemindersForUser(Number(userId));
      return;
    }
    const rows = await all(
      `SELECT id
       FROM users
       WHERE role = 'patient' AND active = 1
       ORDER BY id ASC
       LIMIT ?`,
      [Math.max(1, Math.min(Number(limit) || 100, 500))],
    );
    for (const row of rows) {
      try {
        await generateDueRemindersForUser(Number(row.id));
      } catch (error) {
        log?.error?.(
          { event: "patient_reminder_generation_failed", userId: row.id, message: error.message },
          "patient_reminder_generation_failed",
        );
      }
    }
  };

  return {
    ensureSettings,
    updateSettings,
    processDueReminders,
    generateDueRemindersForUser,
  };
};

module.exports = { createReminderService, DEFAULT_SETTINGS };
