const { buildUipDueVaccines, buildIapDueVaccines, calculateAgeMonths, UIP_SCHEDULE, IAP_SCHEDULE } = require("../services/pediatricsService");
const { createDoctorAssistService } = require("../services/doctorAssistService");
const { listReportCatalog, buildReportInsights } = require("../services/reportInsightsService");
const { buildActionMap } = require("../services/actionMapService");

const { deriveInterpretationBand } = require("../services/reportInsightsService");

const registerClinicalRoutes = (fastify, deps) => {
  const { requireAuth, get, run, nowIso, isDoctorRole, crypto, canAccessConsult } = deps;
  const doctorAssistService = createDoctorAssistService();
  const reportCatalog = listReportCatalog();
  const safeJsonParse = (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const parseNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const isBlankText = (value) => String(value || "").trim().length === 0;
  const buildPlanScopeKey = (memberId = null) => (memberId ? `member:${Number(memberId)}` : "self");
  const normalizeDoctorPlanTasks = (tasks = []) =>
    (Array.isArray(tasks) ? tasks : [])
      .map((task, index) => {
        const label = String(task?.label || "").trim();
        const note = String(task?.note || "").trim();
        const id = String(task?.id || `doctor_task_${index + 1}`).trim();
        if (!label) return null;
        return {
          id,
          label,
          note,
          origin: task?.origin === "doctor" ? "doctor" : "ai",
          editedByDoctor: Boolean(task?.editedByDoctor),
        };
      })
      .filter(Boolean)
      .slice(0, 6);

  const normalizePediatricSex = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "male" || normalized === "m" || normalized === "boy") return "boys";
    if (normalized === "female" || normalized === "f" || normalized === "girl") return "girls";
    return null;
  };

  const buildPatientContextFromDb = async ({ userId, memberId = null }) => {
    try {
      if (memberId) {
        const member = await deps.get(
          `SELECT age, sex, conditions, allergies FROM family_members WHERE user_id = ? AND id = ?`,
          [userId, memberId],
        );
        if (!member) return {};
        const safeList = (value) => {
          if (!value) return [];
          try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
        };
        return {
          ageYears: member.age ? Number(member.age) : null,
          sex: member.sex || "",
          chronicConditions: safeList(member.conditions),
          allergies: safeList(member.allergies),
          medications: [],
        };
      }
      const profile = await deps.get(
        `SELECT age, sex, conditions, allergies, medications FROM profiles WHERE user_id = ?`,
        [userId],
      );
      if (!profile) return {};
      const safeList = (value) => {
        if (!value) return [];
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
      };
      return {
        ageYears: profile.age ? Number(profile.age) : null,
        sex: profile.sex || "",
        chronicConditions: safeList(profile.conditions),
        allergies: safeList(profile.allergies),
        medications: safeList(profile.medications),
      };
    } catch {
      return {};
    }
  };

  const buildPediatricsPayload = async ({ userId, memberId = null, dateOfBirth = "", referenceDate = nowIso() }) => {
    const growthHistory = await deps.all(
      `SELECT id, encounter_id, measured_at, age_months, date_of_birth, sex, guardian_name,
              weight_kg, height_cm, head_circumference_cm, bmi, created_at, updated_at
       FROM pediatric_growth_measurements
       WHERE user_id = ?
         AND COALESCE(member_id, 0) = COALESCE(?, 0)
       ORDER BY measured_at ASC, created_at ASC`,
      [userId, memberId || 0],
    );
    const immunizationRecords = await deps.all(
      `SELECT id, encounter_id, vaccine_code, vaccine_name, dose_label, due_date, administered_date, source, notes, created_at, updated_at
       FROM pediatric_immunization_records
       WHERE user_id = ?
         AND COALESCE(member_id, 0) = COALESCE(?, 0)
       ORDER BY administered_date DESC, created_at DESC`,
      [userId, memberId || 0],
    );
    const resolvedDateOfBirth =
      String(dateOfBirth || "").trim() || String(growthHistory[growthHistory.length - 1]?.date_of_birth || "").trim();

    return {
      supportedAgeMonthsMax: 60,
      referenceGenderKey: normalizePediatricSex(growthHistory[growthHistory.length - 1]?.sex || ""),
      dateOfBirth: resolvedDateOfBirth || "",
      growthHistory,
      immunizationRecords,
      dueVaccinesBySchedule: {
        UIP: buildUipDueVaccines({
          dateOfBirth: resolvedDateOfBirth,
          administeredRecords: immunizationRecords,
          referenceDate,
        }),
        IAP: buildIapDueVaccines({
          dateOfBirth: resolvedDateOfBirth,
          administeredRecords: immunizationRecords,
          referenceDate,
        }),
      },
      scheduleReferences: {
        UIP: UIP_SCHEDULE,
        IAP: IAP_SCHEDULE,
      },
    };
  };

  const buildReportInsightPayload = async ({ userId, memberId = null, months = 6 }) => {
    const records = await deps.all(
      `SELECT id, file_name, mimetype, created_at
       FROM medical_records
       WHERE user_id = ?
         AND COALESCE(member_id, 0) = COALESCE(?, 0)
       ORDER BY created_at DESC`,
      [userId, memberId || 0],
    );
    const analyses = await deps.all(
      `SELECT id, record_id, report_type, report_date, notes, source, created_at, updated_at
       FROM medical_record_analyses
       WHERE user_id = ?
         AND COALESCE(member_id, 0) = COALESCE(?, 0)
       ORDER BY report_date DESC, created_at DESC`,
      [userId, memberId || 0],
    );
    const sectionAnalyses = await deps.all(
      `SELECT id, record_id, report_type, report_date, notes, source, created_at, updated_at,
              page_number, section_key, section_label
       FROM medical_record_section_analyses
       WHERE user_id = ?
         AND COALESCE(member_id, 0) = COALESCE(?, 0)
       ORDER BY report_date DESC, created_at DESC`,
      [userId, memberId || 0],
    );
    const analysisIds = analyses.map((item) => item.id);
    const sectionAnalysisIds = sectionAnalyses.map((item) => item.id);
    const metrics = analysisIds.length
      ? await deps.all(
          `SELECT id, analysis_id, metric_key, metric_label, value_num, unit, reference_low, reference_high, created_at,
                  original_metric_label, original_unit, original_reference_low, original_reference_high, original_reference_text, interpretation_band,
                  original_value_text, normalized_value_text
           FROM medical_record_metrics
           WHERE analysis_id IN (${analysisIds.map(() => "?").join(",")})
           ORDER BY created_at ASC, id ASC`,
          analysisIds,
        )
      : [];
    const sectionMetrics = sectionAnalysisIds.length
      ? await deps.all(
          `SELECT id, section_analysis_id, metric_key, metric_label, value_num, unit, reference_low, reference_high, created_at,
                  original_metric_label, original_unit, original_reference_low, original_reference_high, original_reference_text, interpretation_band,
                  original_value_text, normalized_value_text
           FROM medical_record_section_metrics
           WHERE section_analysis_id IN (${sectionAnalysisIds.map(() => "?").join(",")})
           ORDER BY created_at ASC, id ASC`,
          sectionAnalysisIds,
        )
      : [];
    const extractions = await deps.all(
      `SELECT record_id, extracted_text, extraction_status, extractor, updated_at,
              suggested_report_type, suggested_report_date, suggested_metrics_json,
              detected_lab_source, overall_confidence, needs_review, last_error, detected_sections_json
       FROM medical_record_extractions
       WHERE user_id = ?
         AND COALESCE(member_id, 0) = COALESCE(?, 0)`,
      [userId, memberId || 0],
    );
    const analysisRows = [
      ...analyses.map((analysis) => ({
        id: `analysis-${analysis.id}`,
        recordId: analysis.record_id,
        reportType: analysis.report_type,
        reportDate: analysis.report_date,
        notes: analysis.notes || "",
        source: analysis.source || "manual",
        createdAt: analysis.created_at,
        updatedAt: analysis.updated_at,
        metrics: metrics
          .filter((item) => item.analysis_id === analysis.id)
          .map((item) => ({
            id: item.id,
            metricKey: item.metric_key,
            metricLabel: item.metric_label,
            valueNum: item.value_num,
            unit: item.unit || "",
            referenceLow: item.reference_low,
            referenceHigh: item.reference_high,
            originalMetricLabel: item.original_metric_label || item.metric_label,
            originalUnit: item.original_unit || item.unit || "",
            originalReferenceLow: item.original_reference_low,
            originalReferenceHigh: item.original_reference_high,
            originalReferenceText: item.original_reference_text || "",
            originalValueText: item.original_value_text || String(item.value_num ?? ""),
            normalizedValueText: item.normalized_value_text || String(item.value_num ?? ""),
            interpretationBand: item.interpretation_band || deriveInterpretationBand(item.value_num, item.reference_low, item.reference_high),
          })),
      })),
      ...sectionAnalyses.map((analysis) => ({
        id: `section-${analysis.id}`,
        recordId: analysis.record_id,
        reportType: analysis.report_type,
        reportDate: analysis.report_date,
        notes: analysis.notes || "",
        source: analysis.source || "auto_extracted",
        createdAt: analysis.created_at,
        updatedAt: analysis.updated_at,
        pageNumber: analysis.page_number,
        sectionKey: analysis.section_key || "",
        sectionLabel: analysis.section_label || "",
        metrics: sectionMetrics
          .filter((item) => item.section_analysis_id === analysis.id)
          .map((item) => ({
            id: item.id,
            metricKey: item.metric_key,
            metricLabel: item.metric_label,
            valueNum: item.value_num,
            unit: item.unit || "",
            referenceLow: item.reference_low,
            referenceHigh: item.reference_high,
            originalMetricLabel: item.original_metric_label || item.metric_label,
            originalUnit: item.original_unit || item.unit || "",
            originalReferenceLow: item.original_reference_low,
            originalReferenceHigh: item.original_reference_high,
            originalReferenceText: item.original_reference_text || "",
            originalValueText: item.original_value_text || String(item.value_num ?? ""),
            normalizedValueText: item.normalized_value_text || String(item.value_num ?? ""),
            interpretationBand: item.interpretation_band || deriveInterpretationBand(item.value_num, item.reference_low, item.reference_high),
          })),
      })),
    ];
    const patientContext = await buildPatientContextFromDb({ userId, memberId });
    return {
      catalog: reportCatalog,
      records: records.map((record) => ({
        ...record,
        analysis: analysisRows.find((item) => item.recordId === record.id) || null,
        analyses: analysisRows.filter((item) => item.recordId === record.id),
        extraction: (() => {
          const extraction = extractions.find((item) => item.record_id === record.id) || null;
          if (!extraction) return null;
          return {
            ...extraction,
            suggested_metrics: extraction.suggested_metrics_json ? safeJsonParse(extraction.suggested_metrics_json, []) : [],
            detected_sections: extraction.detected_sections_json ? safeJsonParse(extraction.detected_sections_json, []) : [],
            needs_review: Boolean(extraction.needs_review),
          };
        })(),
      })),
      insights: (() => {
        const ins = buildReportInsights({ analyses: analysisRows, months });
        ins.actionMap = buildActionMap(ins.trends || [], "en", patientContext);
        return ins;
      })(),
    };
  };

  fastify.get("/api/encounters", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const rows = isDoctorRole(request.authUser.role)
      ? await deps.all(
          `SELECT e.*, p.name AS patient_name, d.name AS doctor_name,
                  a.scheduled_at AS appointment_scheduled_at, a.reason AS appointment_reason, a.department AS appointment_department,
                  tr.preferred_slot AS teleconsult_preferred_slot, tr.concern AS teleconsult_concern, tr.mode AS teleconsult_mode,
                  dep.name AS teleconsult_department_name
           FROM encounters e
           JOIN users p ON p.id = e.user_id
           JOIN users d ON d.id = e.doctor_id
           LEFT JOIN appointments a ON a.id = e.appointment_id
           LEFT JOIN teleconsult_requests tr ON tr.id = e.teleconsult_id
           LEFT JOIN departments dep ON dep.id = tr.department_id
           WHERE (? = 'admin' OR e.doctor_id = ?)
           ORDER BY e.updated_at DESC, e.created_at DESC`,
          [request.authUser.role, request.authUser.id],
        )
      : await deps.all(
          `SELECT e.*, p.name AS patient_name, d.name AS doctor_name,
                  a.scheduled_at AS appointment_scheduled_at, a.reason AS appointment_reason, a.department AS appointment_department,
                  tr.preferred_slot AS teleconsult_preferred_slot, tr.concern AS teleconsult_concern, tr.mode AS teleconsult_mode,
                  dep.name AS teleconsult_department_name
           FROM encounters e
           JOIN users p ON p.id = e.user_id
           JOIN users d ON d.id = e.doctor_id
           LEFT JOIN appointments a ON a.id = e.appointment_id
           LEFT JOIN teleconsult_requests tr ON tr.id = e.teleconsult_id
           LEFT JOIN departments dep ON dep.id = tr.department_id
           WHERE e.user_id = ?
           ORDER BY e.updated_at DESC, e.created_at DESC`,
          [request.authUser.id],
        );
    return { encounters: rows };
  });

  fastify.get("/api/encounters/:encounterId", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const encounterId = Number(request.params.encounterId);
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });

    const encounter = await get(
      `SELECT e.*, p.name AS patient_name, d.name AS doctor_name,
              a.reason AS appointment_reason, a.department AS appointment_department, a.scheduled_at AS appointment_scheduled_at,
              tr.mode AS teleconsult_mode, tr.concern AS teleconsult_concern, tr.status AS teleconsult_status, tr.preferred_slot AS teleconsult_preferred_slot,
              dep.name AS teleconsult_department_name
       FROM encounters e
       JOIN users p ON p.id = e.user_id
       JOIN users d ON d.id = e.doctor_id
       LEFT JOIN appointments a ON a.id = e.appointment_id
       LEFT JOIN teleconsult_requests tr ON tr.id = e.teleconsult_id
       LEFT JOIN departments dep ON dep.id = tr.department_id
       WHERE e.id = ?`,
      [encounterId],
    );
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });

    const canAccess =
      Number(encounter.user_id) === Number(request.authUser.id) ||
      Number(encounter.doctor_id) === Number(request.authUser.id) ||
      isDoctorRole(request.authUser.role);
    if (!canAccess) {
      return reply.code(403).send({ error: "Forbidden." });
    }

    const notes = await deps.all(
      `SELECT id, doctor_id, note_text, signature_text, note_hash, created_at
       FROM encounter_notes
       WHERE encounter_id = ?
       ORDER BY created_at ASC`,
      [encounterId],
    );
    const prescriptions = await deps.all(
      `SELECT p.id, p.doctor_id, p.instructions, p.created_at
       FROM prescriptions p
       WHERE p.encounter_id = ?
       ORDER BY p.created_at DESC`,
      [encounterId],
    );
    const prescriptionItems = prescriptions.length
      ? await deps.all(
          `SELECT id, prescription_id, medicine, dose, frequency, duration, route, notes, created_at
           FROM prescription_items
           WHERE prescription_id IN (${prescriptions.map(() => "?").join(",")})`,
          prescriptions.map((item) => item.id),
        )
      : [];
    const orders = await deps.all(
      `SELECT id, doctor_id, order_type, item_name, destination, notes, status, created_at, updated_at
       FROM encounter_orders
       WHERE encounter_id = ?
       ORDER BY created_at DESC`,
      [encounterId],
    );
    const immunizations = await deps.all(
      `SELECT id, vaccine_code, vaccine_name, dose_label, due_date, administered_date, source, notes, created_at, updated_at
       FROM pediatric_immunization_records
       WHERE encounter_id = ?
       ORDER BY administered_date DESC, created_at DESC`,
      [encounterId],
    );
    const departmentForm = await get(
      `SELECT id, encounter_id, department_key, form_json, created_at, updated_at
       FROM encounter_department_forms
       WHERE encounter_id = ?`,
      [encounterId],
    );

    return {
      encounter,
      appointment: encounter.appointment_id
        ? {
            id: encounter.appointment_id,
            reason: encounter.appointment_reason || "",
            department: encounter.appointment_department || "",
            scheduledAt: encounter.appointment_scheduled_at || null,
          }
        : null,
      teleconsult: encounter.teleconsult_id
        ? {
            id: encounter.teleconsult_id,
            mode: encounter.teleconsult_mode || "",
            concern: encounter.teleconsult_concern || "",
            status: encounter.teleconsult_status || "",
            preferredSlot: encounter.teleconsult_preferred_slot || null,
            departmentName: encounter.teleconsult_department_name || "",
          }
        : null,
      notes,
      prescriptions: prescriptions.map((item) => ({
        ...item,
        items: prescriptionItems.filter((entry) => entry.prescription_id === item.id),
      })),
      orders,
      immunizations,
      departmentForm: departmentForm
        ? {
            ...departmentForm,
            form: departmentForm.form_json ? JSON.parse(departmentForm.form_json) : {},
          }
        : null,
    };
  });

  fastify.get("/api/appointments/:appointmentId/encounter", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Invalid appointment id." });

    const appointment = await get(
      `SELECT a.id, a.user_id, a.doctor_id, a.member_id, a.reason, a.status, a.scheduled_at,
              p.name AS patient_name, p.email AS patient_email
       FROM appointments a
       JOIN users p ON p.id = a.user_id
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });

    const canAccess =
      Number(appointment.user_id) === Number(request.authUser.id) ||
      Number(appointment.doctor_id) === Number(request.authUser.id) ||
      isDoctorRole(request.authUser.role);
    if (!canAccess) return reply.code(403).send({ error: "Forbidden." });

    const encounter = await get(
      `SELECT e.*, p.name AS patient_name, d.name AS doctor_name
       FROM encounters e
       JOIN users p ON p.id = e.user_id
       JOIN users d ON d.id = e.doctor_id
       WHERE e.appointment_id = ?`,
      [appointmentId],
    );

    if (encounter && isBlankText(encounter.chief_complaint) && !isBlankText(appointment.reason)) {
      const normalizedComplaint = String(appointment.reason).trim();
      await run(
        `UPDATE encounters
         SET chief_complaint = ?, updated_at = ?
         WHERE id = ?`,
        [normalizedComplaint, nowIso(), encounter.id],
      );
      encounter.chief_complaint = normalizedComplaint;
    }

    return { appointment, encounter: encounter || null };
  });

  fastify.get("/api/appointments/:appointmentId/patient-history", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Invalid appointment id." });

    const appointment = await get(
      `SELECT a.id, a.user_id, a.member_id, a.doctor_id, a.department, a.reason, a.status, a.scheduled_at,
              u.name AS patient_name, u.email AS patient_email,
              p.age AS profile_age, p.sex AS profile_sex, p.conditions AS profile_conditions,
              p.allergies AS profile_allergies, p.blood_group AS profile_blood_group,
              p.date_of_birth AS profile_date_of_birth, p.phone AS profile_phone, p.weight_kg AS profile_weight_kg, p.height_cm AS profile_height_cm,
              p.abha_number AS profile_abha_number, p.abha_address AS profile_abha_address, p.abha_status AS profile_abha_status,
              pr.first_name, pr.middle_name, pr.last_name
       FROM appointments a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN profiles p ON p.user_id = a.user_id
       LEFT JOIN patient_registration_details pr ON pr.user_id = a.user_id
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(appointment.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can view this patient history." });
    }

    let patient = {
      id: appointment.user_id,
      memberId: appointment.member_id || null,
      name: appointment.patient_name,
      email: appointment.patient_email || "",
      age: appointment.profile_age || null,
      sex: appointment.profile_sex || "",
      conditions: appointment.profile_conditions || "",
      allergies: appointment.profile_allergies || "",
      bloodGroup: appointment.profile_blood_group || "",
      dateOfBirth: appointment.profile_date_of_birth || "",
      weightKg: appointment.profile_weight_kg ?? "",
      heightCm: appointment.profile_height_cm ?? "",
      phone: appointment.profile_phone || "",
      abhaNumber: appointment.profile_abha_number || "",
      abhaAddress: appointment.profile_abha_address || "",
      abhaStatus: appointment.profile_abha_status || "not_linked",
    };

    if (appointment.member_id) {
      const member = await get(
        `SELECT id, name, age, sex, conditions, allergies
         FROM family_members
         WHERE id = ? AND user_id = ?`,
        [appointment.member_id, appointment.user_id],
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

    const previousEncounters = await deps.all(
      `SELECT e.id, e.appointment_id, e.status, e.chief_complaint, e.diagnosis_code, e.diagnosis_text,
              e.plan_text, e.followup_date, e.created_at, e.updated_at,
              a.scheduled_at, a.reason, a.department, a.status AS appointment_status,
              d.name AS doctor_name
       FROM encounters e
       LEFT JOIN appointments a ON a.id = e.appointment_id
       LEFT JOIN users d ON d.id = e.doctor_id
       WHERE e.user_id = ?
         AND COALESCE(e.member_id, 0) = COALESCE(?, 0)
         AND COALESCE(e.appointment_id, 0) != ?
       ORDER BY COALESCE(a.scheduled_at, e.created_at) DESC, e.created_at DESC
       LIMIT 8`,
      [appointment.user_id, appointment.member_id || 0, appointmentId],
    );

    const encounterIds = previousEncounters.map((item) => item.id);
    const notes = encounterIds.length
      ? await deps.all(
          `SELECT id, encounter_id, note_text, signature_text, created_at
           FROM encounter_notes
           WHERE encounter_id IN (${encounterIds.map(() => "?").join(",")})
           ORDER BY created_at DESC`,
          encounterIds,
        )
      : [];
    const prescriptions = encounterIds.length
      ? await deps.all(
          `SELECT id, encounter_id, instructions, created_at
           FROM prescriptions
           WHERE encounter_id IN (${encounterIds.map(() => "?").join(",")})
           ORDER BY created_at DESC`,
          encounterIds,
        )
      : [];
    const prescriptionIds = prescriptions.map((item) => item.id);
    const prescriptionItems = prescriptionIds.length
      ? await deps.all(
          `SELECT id, prescription_id, medicine, dose, frequency, duration, route, notes, created_at
           FROM prescription_items
           WHERE prescription_id IN (${prescriptionIds.map(() => "?").join(",")})`,
          prescriptionIds,
        )
      : [];
    const orders = encounterIds.length
      ? await deps.all(
          `SELECT id, encounter_id, order_type, item_name, destination, notes, status, created_at, updated_at
           FROM encounter_orders
           WHERE encounter_id IN (${encounterIds.map(() => "?").join(",")})
           ORDER BY created_at DESC`,
          encounterIds,
        )
      : [];
    const departmentForms = encounterIds.length
      ? await deps.all(
          `SELECT id, encounter_id, department_key, form_json, created_at, updated_at
           FROM encounter_department_forms
           WHERE encounter_id IN (${encounterIds.map(() => "?").join(",")})`,
          encounterIds,
        )
      : [];

    const history = previousEncounters.map((encounter) => {
      const encounterPrescriptions = prescriptions
        .filter((item) => item.encounter_id === encounter.id)
        .map((item) => ({
          ...item,
          items: prescriptionItems.filter((entry) => entry.prescription_id === item.id),
        }));
      const departmentForm = departmentForms.find((item) => item.encounter_id === encounter.id);
      return {
        ...encounter,
        notes: notes.filter((item) => item.encounter_id === encounter.id).slice(0, 3),
        prescriptions: encounterPrescriptions,
        orders: orders.filter((item) => item.encounter_id === encounter.id),
        departmentForm: departmentForm
          ? {
              ...departmentForm,
              form: departmentForm.form_json ? JSON.parse(departmentForm.form_json) : {},
            }
          : null,
      };
    });

    const pediatrics = await buildPediatricsPayload({
      userId: appointment.user_id,
      memberId: appointment.member_id || null,
      dateOfBirth: patient.dateOfBirth,
      referenceDate: appointment.scheduled_at || nowIso(),
    });

    return {
      patient: {
        ...patient,
        dateOfBirth: patient.dateOfBirth || pediatrics.dateOfBirth || "",
        visitCount: history.length + 1,
        previousVisitCount: history.length,
        isFollowUp: history.length > 0,
        lastVisitAt: history[0]?.scheduled_at || history[0]?.created_at || null,
      },
      history,
      pediatrics,
    };
  });

  fastify.get("/api/appointments/:appointmentId/report-insights", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Invalid appointment id." });
    const months = request.query?.months ? Number(request.query.months) : 6;
    const appointment = await get(
      `SELECT a.id, a.user_id, a.member_id, a.doctor_id
       FROM appointments a
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(appointment.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can view report insights." });
    }
    return buildReportInsightPayload({
      userId: appointment.user_id,
      memberId: appointment.member_id || null,
      months,
    });
  });

  fastify.get("/api/appointments/:appointmentId/health-plan", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Invalid appointment id." });

    const appointment = await get(
      `SELECT a.id, a.user_id, a.member_id, a.doctor_id
       FROM appointments a
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(appointment.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can review this plan." });
    }

    const scopeKey = buildPlanScopeKey(appointment.member_id || null);
    const plan = await get(
      `SELECT php.id, php.focus_key, php.title, php.subtitle, php.goal, php.focus_title, php.focus_summary,
              php.progress_json, php.plan_source, php.doctor_notes, php.doctor_updated_at,
              php.doctor_user_id, php.doctor_override_json, u.name AS doctor_name
       FROM patient_health_plans php
       LEFT JOIN users u ON u.id = php.doctor_user_id
       WHERE php.user_id = ?
         AND php.scope_key = ?
       ORDER BY php.updated_at DESC, php.id DESC
       LIMIT 1`,
      [appointment.user_id, scopeKey],
    );
    if (!plan) {
      return reply.code(404).send({ error: "No saved action plan exists for this patient yet." });
    }

    return {
      plan: {
        id: plan.id,
        focusKey: plan.focus_key,
        title: plan.title,
        subtitle: plan.subtitle || "",
        goal: plan.goal || "",
        focusTitle: plan.focus_title || "",
        focusSummary: plan.focus_summary || "",
        progress: plan.progress_json ? safeJsonParse(plan.progress_json, {}) : {},
        planSource: plan.plan_source || "ai",
        doctorNotes: plan.doctor_notes || "",
        doctorUpdatedAt: plan.doctor_updated_at || null,
        doctorUserId: plan.doctor_user_id || null,
        doctorName: plan.doctor_name || "",
        doctorOverride: plan.doctor_override_json ? safeJsonParse(plan.doctor_override_json, {}) : {},
      },
    };
  });

  fastify.patch("/api/appointments/:appointmentId/health-plan", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Invalid appointment id." });

    const appointment = await get(
      `SELECT a.id, a.user_id, a.member_id, a.doctor_id
       FROM appointments a
       WHERE a.id = ?`,
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(appointment.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can adjust this plan." });
    }

    const scopeKey = buildPlanScopeKey(appointment.member_id || null);
    const plan = await get(
      `SELECT id, focus_key
       FROM patient_health_plans
       WHERE user_id = ?
         AND scope_key = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [appointment.user_id, scopeKey],
    );
    if (!plan) {
      return reply.code(404).send({ error: "No saved action plan exists for this patient yet." });
    }

    const requestedStatus = String(request.body?.reviewStatus || "").trim().toLowerCase();
    if (!["doctor_reviewed", "doctor_adjusted"].includes(requestedStatus)) {
      return reply.code(400).send({ error: "reviewStatus must be doctor_reviewed or doctor_adjusted." });
    }
    const doctorNotes = String(request.body?.doctorNotes || "").trim();
    const reviewTimingNote = String(request.body?.reviewTimingNote || "").trim();
    const tasks = normalizeDoctorPlanTasks(request.body?.tasks || []);
    const override = {
      reviewTimingNote,
      tasks,
    };
    const now = nowIso();
    await run(
      `UPDATE patient_health_plans
       SET plan_source = ?, doctor_notes = ?, doctor_updated_at = ?, doctor_user_id = ?, doctor_override_json = ?, updated_at = ?
       WHERE id = ?`,
      [
        requestedStatus,
        doctorNotes,
        now,
        request.authUser.id,
        JSON.stringify(override),
        now,
        plan.id,
      ],
    );

    return {
      ok: true,
      planId: plan.id,
      focusKey: plan.focus_key,
      planSource: requestedStatus,
      doctorNotes,
      doctorUpdatedAt: now,
      doctorOverride: override,
    };
  });

  fastify.post("/api/appointments/:appointmentId/encounter", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Invalid appointment id." });

    const appointment = await get(
      `SELECT id, user_id, member_id, doctor_id, reason
       FROM appointments
       WHERE id = ?`,
      [appointmentId],
    );
    if (!appointment) return reply.code(404).send({ error: "Appointment not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(appointment.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can open this encounter." });
    }

    const existing = await get("SELECT id FROM encounters WHERE appointment_id = ?", [appointmentId]);
    if (existing) {
      return reply.code(200).send({ encounterId: existing.id, reused: true });
    }

    const now = nowIso();
    const result = await run(
      `INSERT INTO encounters
       (appointment_id, user_id, member_id, doctor_id, chief_complaint, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
      [
        appointmentId,
        appointment.user_id,
        appointment.member_id || null,
        appointment.doctor_id,
        appointment.reason || null,
        now,
        now,
      ],
    );
    return reply.code(201).send({ encounterId: result.lastID, reused: false });
  });

  fastify.get("/api/teleconsults/:consultId/encounter", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const consultId = Number(request.params.consultId);
    if (!consultId) return reply.code(400).send({ error: "Invalid consult id." });

    const consult = await get(
      `SELECT tr.id, tr.user_id, tr.member_id, tr.doctor_id, tr.concern
       FROM teleconsult_requests tr
       WHERE tr.id = ?`,
      [consultId],
    );
    if (!consult) return reply.code(404).send({ error: "Consult not found." });
    if (!canAccessConsult(request, consult)) {
      return reply.code(403).send({ error: "Forbidden." });
    }

    const encounter = await get(
      `SELECT e.*, p.name AS patient_name, d.name AS doctor_name
       FROM encounters e
       JOIN users p ON p.id = e.user_id
       JOIN users d ON d.id = e.doctor_id
       WHERE e.teleconsult_id = ?`,
      [consultId],
    );

    if (encounter && isBlankText(encounter.chief_complaint) && !isBlankText(consult.concern)) {
      const normalizedComplaint = String(consult.concern).trim();
      await run(
        `UPDATE encounters
         SET chief_complaint = ?, updated_at = ?
         WHERE id = ?`,
        [normalizedComplaint, nowIso(), encounter.id],
      );
      encounter.chief_complaint = normalizedComplaint;
    }

    return { consult, encounter: encounter || null };
  });

  fastify.post("/api/teleconsults/:consultId/encounter", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const consultId = Number(request.params.consultId);
    if (!consultId) return reply.code(400).send({ error: "Invalid consult id." });

    const consult = await get(
      `SELECT id, user_id, member_id, doctor_id, concern
       FROM teleconsult_requests
       WHERE id = ?`,
      [consultId],
    );
    if (!consult) return reply.code(404).send({ error: "Consult not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(consult.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can open this remote encounter." });
    }

    const existing = await get("SELECT id FROM encounters WHERE teleconsult_id = ?", [consultId]);
    if (existing) {
      return reply.code(200).send({ encounterId: existing.id, reused: true });
    }

    const now = nowIso();
    const result = await run(
      `INSERT INTO encounters
       (appointment_id, teleconsult_id, user_id, member_id, doctor_id, chief_complaint, status, created_at, updated_at)
       VALUES (NULL, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [
        consultId,
        consult.user_id,
        consult.member_id || null,
        consult.doctor_id,
        consult.concern || null,
        now,
        now,
      ],
    );
    return reply.code(201).send({ encounterId: result.lastID, reused: false });
  });

  fastify.patch("/api/encounters/:encounterId", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const encounterId = Number(request.params.encounterId);
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });

    const encounter = await get("SELECT id, doctor_id, teleconsult_id FROM encounters WHERE id = ?", [encounterId]);
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(encounter.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can update this encounter." });
    }

    const {
      chiefComplaint = null,
      vitals = null,
      findings = null,
      diagnosisCode = null,
      diagnosisText = null,
      planText = null,
      followupDate = null,
      status = "open",
    } = request.body || {};

    const allowedEncounterStatuses = new Set(["open", "in_progress", "completed"]);
    if (!allowedEncounterStatuses.has(String(status || "open"))) {
      return reply.code(400).send({ error: "Invalid encounter status." });
    }

    const updatedAt = nowIso();
    await run(
      `UPDATE encounters
       SET chief_complaint = ?,
           vitals_json = ?,
           findings = ?,
           diagnosis_code = ?,
           diagnosis_text = ?,
           plan_text = ?,
           followup_date = ?,
           status = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        chiefComplaint ? String(chiefComplaint).trim() : null,
        vitals ? JSON.stringify(vitals) : null,
        findings ? String(findings).trim() : null,
        diagnosisCode ? String(diagnosisCode).trim() : null,
        diagnosisText ? String(diagnosisText).trim() : null,
        planText ? String(planText).trim() : null,
        followupDate || null,
        String(status || "open"),
        updatedAt,
        encounterId,
      ],
    );

    if (encounter.teleconsult_id && ["in_progress", "completed"].includes(String(status || "open"))) {
      await run(
        `UPDATE teleconsult_requests
         SET status = ?, updated_at = ?
         WHERE id = ?`,
        [String(status), updatedAt, encounter.teleconsult_id],
      );
    }

    return { ok: true };
  });

  fastify.post("/api/encounters/:encounterId/notes", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const encounterId = Number(request.params.encounterId);
    const { note = "", signature = "" } = request.body || {};
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });
    if (!note.trim() || note.length < 5) {
      return reply.code(400).send({ error: "note must be at least 5 characters." });
    }
    const encounter = await get("SELECT id, doctor_id FROM encounters WHERE id = ?", [encounterId]);
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(encounter.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can add notes to this encounter." });
    }

    const createdAt = nowIso();
    const signatureText = signature.trim() || `Signed by Dr. ${request.authUser.name}`;
    const hashInput = `${encounterId}|${request.authUser.id}|${note.trim()}|${signatureText}|${createdAt}`;
    const noteHash = crypto.createHash("sha256").update(hashInput).digest("hex");

    const result = await run(
      `INSERT INTO encounter_notes
       (encounter_id, doctor_id, note_text, signature_text, note_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [encounterId, request.authUser.id, note.trim(), signatureText, noteHash, createdAt],
    );
    await run("UPDATE encounters SET updated_at = ? WHERE id = ?", [createdAt, encounterId]);
    return { noteId: result.lastID, noteHash };
  });

  fastify.post("/api/encounters/:encounterId/note-assist", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const encounterId = Number(request.params.encounterId);
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });

    const encounter = await get(
      `SELECT e.id, e.user_id, e.member_id, e.doctor_id, e.chief_complaint, e.findings, e.diagnosis_text, e.plan_text,
              a.reason, a.department, dep.name AS department_name, a.scheduled_at,
              u.name AS patient_name, p.age AS patient_age, p.sex AS patient_sex,
              p.conditions AS patient_conditions, p.allergies AS patient_allergies
       FROM encounters e
       LEFT JOIN appointments a ON a.id = e.appointment_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN profiles p ON p.user_id = e.user_id
       WHERE e.id = ?`,
      [encounterId],
    );
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(encounter.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can request note suggestions." });
    }

    const {
      query = "",
      departmentKey = "",
      chiefComplaint = "",
      findings = "",
      diagnosisText = "",
      planText = "",
    } = request.body || {};

    const resolvedDepartmentKey = String(departmentKey || encounter.department_name || encounter.department || "general")
      .trim()
      .toLowerCase()
      .includes("surg")
      ? "surgery"
      : String(departmentKey || encounter.department_name || encounter.department || "general")
          .trim()
          .toLowerCase()
          .includes("pedi")
        ? "pediatrics"
        : "general";

    const suggestions = doctorAssistService.suggestNoteDrafts({
      departmentKey: resolvedDepartmentKey,
      query,
      context: {
        reason: encounter.reason,
        chiefComplaint: chiefComplaint || encounter.chief_complaint,
        findings: findings || encounter.findings,
        diagnosisText: diagnosisText || encounter.diagnosis_text,
        planText: planText || encounter.plan_text,
        patient: {
          name: encounter.patient_name,
          age: encounter.patient_age,
          sex: encounter.patient_sex,
          conditions: encounter.patient_conditions,
          allergies: encounter.patient_allergies,
        },
      },
    });

    return {
      departmentKey: resolvedDepartmentKey,
      suggestions,
    };
  });

  fastify.post("/api/encounters/:encounterId/note-assist/refine", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const encounterId = Number(request.params.encounterId);
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });

    const encounter = await get(
      `SELECT e.id, e.user_id, e.doctor_id,
              a.department, dep.name AS department_name,
              u.name AS patient_name, p.age AS patient_age, p.sex AS patient_sex
       FROM encounters e
       LEFT JOIN appointments a ON a.id = e.appointment_id
       LEFT JOIN departments dep ON dep.id = a.department_id
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN profiles p ON p.user_id = e.user_id
       WHERE e.id = ?`,
      [encounterId],
    );
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(encounter.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can refine note drafts." });
    }

    const { draftText = "", mode = "clinical", departmentKey = "" } = request.body || {};
    if (!String(draftText || "").trim()) {
      return reply.code(400).send({ error: "draftText is required." });
    }

    const resolvedDepartmentKey = String(departmentKey || encounter.department_name || encounter.department || "general")
      .trim()
      .toLowerCase()
      .includes("surg")
      ? "surgery"
      : String(departmentKey || encounter.department_name || encounter.department || "general")
          .trim()
          .toLowerCase()
          .includes("pedi")
        ? "pediatrics"
        : "general";

    const result = await doctorAssistService.refineNoteDraft({
      draftText,
      mode,
      context: {
        departmentKey: resolvedDepartmentKey,
        reason: request.body?.reason || "",
        chiefComplaint: request.body?.chiefComplaint || "",
        findings: request.body?.findings || "",
        diagnosisText: request.body?.diagnosisText || "",
        planText: request.body?.planText || "",
        patient: {
          name: encounter.patient_name,
          age: encounter.patient_age,
          sex: encounter.patient_sex,
        },
      },
    });

    return {
      departmentKey: resolvedDepartmentKey,
      ...result,
    };
  });

  fastify.post("/api/encounters/:encounterId/prescriptions", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const encounterId = Number(request.params.encounterId);
    const { instructions = "", items = [] } = request.body || {};
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });
    if (!Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: "items array is required." });
    }
    for (const item of items) {
      if (!item?.medicine || typeof item.medicine !== "string") {
        return reply.code(400).send({ error: "Each prescription item needs medicine." });
      }
    }
    const encounter = await get("SELECT id, doctor_id FROM encounters WHERE id = ?", [encounterId]);
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(encounter.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can add prescriptions to this encounter." });
    }

    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO prescriptions (encounter_id, doctor_id, instructions, created_at)
       VALUES (?, ?, ?, ?)`,
      [encounterId, request.authUser.id, instructions || null, createdAt],
    );
    for (const item of items) {
      await run(
        `INSERT INTO prescription_items
         (prescription_id, medicine, dose, frequency, duration, route, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.lastID,
          item.medicine.trim(),
          item.dose || null,
          item.frequency || null,
          item.duration || null,
          item.route || null,
          item.notes || null,
          createdAt,
        ],
      );
    }
    await run("UPDATE encounters SET updated_at = ? WHERE id = ?", [createdAt, encounterId]);
    return { prescriptionId: result.lastID };
  });

  fastify.post("/api/encounters/:encounterId/orders", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const encounterId = Number(request.params.encounterId);
    const { orderType = "", itemName = "", destination = "", notes = "" } = request.body || {};
    const validTypes = new Set([
      "lab",
      "radiology",
      "pharmacy",
      "procedure",
      "vaccine",
      "referral",
      "pre_op_lab",
      "post_op_order",
    ]);
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });
    if (!validTypes.has(orderType)) {
      return reply.code(400).send({ error: "Invalid orderType." });
    }
    if (!itemName || typeof itemName !== "string") {
      return reply.code(400).send({ error: "itemName is required." });
    }
    const encounter = await get("SELECT id, doctor_id FROM encounters WHERE id = ?", [encounterId]);
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(encounter.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can add orders to this encounter." });
    }

    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO encounter_orders
       (encounter_id, doctor_id, order_type, item_name, destination, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ordered', ?, ?)`,
      [encounterId, request.authUser.id, orderType, itemName.trim(), destination || null, notes || null, createdAt, createdAt],
    );
    await run("UPDATE encounters SET updated_at = ? WHERE id = ?", [createdAt, encounterId]);
    return { orderId: result.lastID };
  });

  fastify.patch("/api/encounters/:encounterId/department-form", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const encounterId = Number(request.params.encounterId);
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });

    const encounter = await get("SELECT id, doctor_id FROM encounters WHERE id = ?", [encounterId]);
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(encounter.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can update this department form." });
    }

    const { departmentKey = "", form = {} } = request.body || {};
    const normalizedDepartmentKey = String(departmentKey || "").trim().toLowerCase();
    if (!normalizedDepartmentKey) {
      return reply.code(400).send({ error: "departmentKey is required." });
    }
    if (!["general", "surgery", "pediatrics"].includes(normalizedDepartmentKey)) {
      return reply.code(400).send({ error: "Invalid departmentKey." });
    }
    if (!form || typeof form !== "object" || Array.isArray(form)) {
      return reply.code(400).send({ error: "form object is required." });
    }

    const timestamp = nowIso();
    await run(
      `INSERT INTO encounter_department_forms
       (encounter_id, department_key, form_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(encounter_id) DO UPDATE SET
         department_key = excluded.department_key,
         form_json = excluded.form_json,
         updated_at = excluded.updated_at`,
      [encounterId, normalizedDepartmentKey, JSON.stringify(form), timestamp, timestamp],
    );

    if (normalizedDepartmentKey === "pediatrics") {
      const encounterMeta = await get(
        `SELECT e.id, e.user_id, e.member_id, e.doctor_id, a.scheduled_at,
                p.sex AS profile_sex, p.date_of_birth AS profile_date_of_birth
         FROM encounters e
         LEFT JOIN appointments a ON a.id = e.appointment_id
         LEFT JOIN profiles p ON p.user_id = e.user_id
         WHERE e.id = ?`,
        [encounterId],
      );

      const measuredAt = encounterMeta?.scheduled_at || timestamp;
      const resolvedDateOfBirth = String(form.dateOfBirth || encounterMeta?.profile_date_of_birth || "").trim() || null;
      const resolvedSex = String(form.sex || encounterMeta?.profile_sex || "").trim() || null;
      const weightKg = parseNumberOrNull(form.weightKg);
      const heightCm = parseNumberOrNull(form.heightCm);
      const headCircumferenceCm = parseNumberOrNull(form.headCircumferenceCm);
      const bmi =
        weightKg && heightCm
          ? Number((weightKg / ((heightCm / 100) * (heightCm / 100))).toFixed(2))
          : null;
      const ageMonths = resolvedDateOfBirth ? calculateAgeMonths(resolvedDateOfBirth, measuredAt) : null;

      await run(
        `INSERT INTO pediatric_growth_measurements
         (encounter_id, user_id, member_id, doctor_id, date_of_birth, sex, measured_at, age_months, guardian_name, weight_kg, height_cm, head_circumference_cm, bmi, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(encounter_id) DO UPDATE SET
           date_of_birth = excluded.date_of_birth,
           sex = excluded.sex,
           measured_at = excluded.measured_at,
           age_months = excluded.age_months,
           guardian_name = excluded.guardian_name,
           weight_kg = excluded.weight_kg,
           height_cm = excluded.height_cm,
           head_circumference_cm = excluded.head_circumference_cm,
           bmi = excluded.bmi,
           updated_at = excluded.updated_at`,
        [
          encounterId,
          encounterMeta?.user_id,
          encounterMeta?.member_id || null,
          encounterMeta?.doctor_id,
          resolvedDateOfBirth,
          resolvedSex,
          measuredAt,
          ageMonths,
          String(form.guardianName || "").trim() || null,
          weightKg,
          heightCm,
          headCircumferenceCm,
          bmi,
          timestamp,
          timestamp,
        ],
      );
    }

    await run("UPDATE encounters SET updated_at = ? WHERE id = ?", [timestamp, encounterId]);
    return { ok: true };
  });

  fastify.post("/api/encounters/:encounterId/immunizations", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const encounterId = Number(request.params.encounterId);
    if (!encounterId) return reply.code(400).send({ error: "Invalid encounter id." });

    const encounter = await get(
      `SELECT e.id, e.user_id, e.member_id, e.doctor_id, a.scheduled_at,
              p.date_of_birth AS profile_date_of_birth
       FROM encounters e
       LEFT JOIN appointments a ON a.id = e.appointment_id
       LEFT JOIN profiles p ON p.user_id = e.user_id
       WHERE e.id = ?`,
      [encounterId],
    );
    if (!encounter) return reply.code(404).send({ error: "Encounter not found." });
    if (
      request.authUser.role !== "admin" &&
      Number(encounter.doctor_id) !== Number(request.authUser.id)
    ) {
      return reply.code(403).send({ error: "Only the assigned doctor can record immunizations for this encounter." });
    }

    const {
      vaccineCode = "",
      vaccineName = "",
      doseLabel = "",
      dueDate = "",
      administeredDate = "",
      notes = "",
      source = "console",
    } = request.body || {};

    if (!String(vaccineCode || "").trim() || !String(vaccineName || "").trim() || !String(doseLabel || "").trim()) {
      return reply.code(400).send({ error: "vaccineCode, vaccineName, and doseLabel are required." });
    }
    const administeredAt = String(administeredDate || "").trim() || String(encounter.scheduled_at || nowIso()).slice(0, 10);
    const timestamp = nowIso();

    const result = await run(
      `INSERT INTO pediatric_immunization_records
       (encounter_id, user_id, member_id, doctor_id, vaccine_code, vaccine_name, dose_label, due_date, administered_date, source, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        encounterId,
        encounter.user_id,
        encounter.member_id || null,
        encounter.doctor_id,
        String(vaccineCode).trim().toLowerCase(),
        String(vaccineName).trim(),
        String(doseLabel).trim(),
        String(dueDate || "").trim() || null,
        administeredAt,
        String(source || "console").trim(),
        String(notes || "").trim() || null,
        timestamp,
        timestamp,
      ],
    );

    await run("UPDATE encounters SET updated_at = ? WHERE id = ?", [timestamp, encounterId]);
    return { immunizationId: result.lastID };
  });

  fastify.patch("/api/orders/:orderId/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    if (!isDoctorRole(request.authUser.role)) {
      return reply.code(403).send({ error: "Doctor or admin access required." });
    }
    const orderId = Number(request.params.orderId);
    const { status } = request.body || {};
    const allowed = new Set(["ordered", "processing", "completed", "cancelled"]);
    if (!orderId || !allowed.has(status)) {
      return reply.code(400).send({ error: "Invalid order status update." });
    }
    const order = await get("SELECT id FROM encounter_orders WHERE id = ?", [orderId]);
    if (!order) return reply.code(404).send({ error: "Order not found." });
    await run("UPDATE encounter_orders SET status = ?, updated_at = ? WHERE id = ?", [
      status,
      nowIso(),
      orderId,
    ]);
    return { ok: true };
  });
};

module.exports = { registerClinicalRoutes };
