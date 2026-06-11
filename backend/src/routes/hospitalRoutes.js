const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { listReportCatalog, deriveInterpretationBand, parseReportSections } = require("../services/reportInsightsService");
const { extractDocumentFromFile } = require("../services/reportExtractionService");

const registerHospitalRoutes = (fastify, deps) => {
  const {
    requireOps,
    requireAdmin,
    get,
    all,
    run,
    nowIso,
    buildPatientUid,
    enqueueAndDeliverUserNotification,
    hospitalSettingsService,
    saveUpload,
    fs,
    path,
    recordsDir,
    hospitalContentAssetsDir,
  } = deps;
  const reportCatalog = listReportCatalog();
  const reportCatalogMap = new Map(reportCatalog.map((item) => [item.key, item]));

  const getAssetContentType = (filePath) => {
    const ext = String(path.extname(filePath || "") || "").toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    if (ext === ".svg") return "image/svg+xml";
    if (ext === ".heic") return "image/heic";
    return "application/octet-stream";
  };

  const buildStoredMetric = ({ item = {}, catalogMetric, metricKey }) => {
    const valueNum = Number(item.valueNum);
    if (!catalogMetric || !Number.isFinite(valueNum)) return null;
    const normalizedUnit = String(item.unit || catalogMetric.unit || "").trim();
    const normalizedReferenceLow = item.referenceLow ?? catalogMetric.low ?? null;
    const normalizedReferenceHigh = item.referenceHigh ?? catalogMetric.high ?? null;
    return {
      metricKey,
      metricLabel: catalogMetric.label,
      valueNum,
      unit: normalizedUnit,
      referenceLow: normalizedReferenceLow,
      referenceHigh: normalizedReferenceHigh,
      originalMetricLabel: String(item.originalMetricLabel || item.metricLabel || catalogMetric.label || "").trim(),
      originalUnit: String(item.originalUnit || normalizedUnit).trim(),
      originalReferenceLow: item.originalReferenceLow ?? null,
      originalReferenceHigh: item.originalReferenceHigh ?? null,
      originalReferenceText: String(item.originalReferenceText || "").trim(),
      originalValueText: String(item.originalValueText || item.valueNum || "").trim(),
      normalizedValueText: String(item.normalizedValueText || item.valueNum || "").trim(),
      interpretationBand:
        String(item.interpretationBand || "").trim() ||
        deriveInterpretationBand(valueNum, normalizedReferenceLow, normalizedReferenceHigh),
      confidence: item.confidence ?? 1,
    };
  };

  const replaceRecordSectionAnalyses = async ({ recordId, userId, sections = [], source = "lab_upload" }) => {
    const existing = await all(`SELECT id FROM medical_record_section_analyses WHERE record_id = ?`, [recordId]);
    for (const row of existing) {
      await run(`DELETE FROM medical_record_section_metrics WHERE section_analysis_id = ?`, [row.id]);
    }
    await run(`DELETE FROM medical_record_section_analyses WHERE record_id = ?`, [recordId]);

    const createdIds = [];
    const now = nowIso();
    for (const section of sections) {
      const catalogEntry = reportCatalogMap.get(section.reportType);
      if (!catalogEntry) continue;
      const allowedMetrics = new Map((catalogEntry.metrics || []).map((item) => [item.key, item]));
      const normalizedMetrics = (section.metrics || [])
        .map((item) => {
          const metricKey = String(item.metricKey || "").trim();
          const catalogMetric = allowedMetrics.get(metricKey);
          return buildStoredMetric({ item, catalogMetric, metricKey });
        })
        .filter(Boolean);
      if (!normalizedMetrics.length) continue;

      const insert = await run(
        `INSERT INTO medical_record_section_analyses
         (record_id, user_id, member_id, page_number, section_key, section_label, report_type, report_date, notes, source, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          userId,
          section.pageNumber || null,
          section.sectionKey || section.reportType || "",
          section.label || "",
          section.reportType,
          section.reportDate,
          String(section.summary || "").trim(),
          source,
          now,
          now,
        ],
      );

      for (const metric of normalizedMetrics) {
        await run(
          `INSERT INTO medical_record_section_metrics
           (section_analysis_id, metric_key, metric_label, value_num, unit, reference_low, reference_high, confidence, created_at,
            original_metric_label, original_unit, original_reference_low, original_reference_high, original_reference_text, interpretation_band,
            original_value_text, normalized_value_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            insert.lastID,
            metric.metricKey,
            metric.metricLabel,
            metric.valueNum,
            metric.unit,
            metric.referenceLow,
            metric.referenceHigh,
            metric.confidence ?? null,
            now,
            metric.originalMetricLabel,
            metric.originalUnit,
            metric.originalReferenceLow,
            metric.originalReferenceHigh,
            metric.originalReferenceText,
            metric.interpretationBand,
            metric.originalValueText,
            metric.normalizedValueText,
          ],
        );
      }
      createdIds.push(insert.lastID);
    }
    return createdIds;
  };

  const upsertRecordExtraction = async ({
    recordId,
    userId,
    extractedText = "",
    extractionStatus = "success",
    extractor = "swift_ocr",
    suggestedReportType = "",
    suggestedReportDate = "",
    suggestedMetrics = [],
    detectedSections = [],
    rejectedMetrics = [],
    detectedLabSource = "",
    overallConfidence = null,
    needsReview = true,
    qualityGate = "review",
    lastError = "",
  }) => {
    const now = nowIso();
    const existing = await get(`SELECT id FROM medical_record_extractions WHERE record_id = ?`, [recordId]);
    if (existing) {
      await run(
        `UPDATE medical_record_extractions
         SET extracted_text = ?, extraction_status = ?, extractor = ?, suggested_report_type = ?, suggested_report_date = ?,
             suggested_metrics_json = ?, detected_sections_json = ?, rejected_metrics_json = ?, detected_lab_source = ?, overall_confidence = ?, needs_review = ?, quality_gate = ?, last_error = ?, updated_at = ?
         WHERE id = ?`,
        [
          String(extractedText || ""),
          extractionStatus,
          extractor,
          suggestedReportType || "",
          suggestedReportDate || "",
          JSON.stringify(suggestedMetrics || []),
          JSON.stringify(detectedSections || []),
          JSON.stringify(rejectedMetrics || []),
          detectedLabSource || "",
          overallConfidence,
          needsReview ? 1 : 0,
          qualityGate || "review",
          lastError || "",
          now,
          existing.id,
        ],
      );
    } else {
      await run(
        `INSERT INTO medical_record_extractions
         (record_id, user_id, member_id, extracted_text, extraction_status, extractor, suggested_report_type,
          suggested_report_date, suggested_metrics_json, detected_sections_json, rejected_metrics_json, detected_lab_source, overall_confidence, needs_review, quality_gate, last_error, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          userId,
          String(extractedText || ""),
          extractionStatus,
          extractor,
          suggestedReportType || "",
          suggestedReportDate || "",
          JSON.stringify(suggestedMetrics || []),
          JSON.stringify(detectedSections || []),
          JSON.stringify(rejectedMetrics || []),
          detectedLabSource || "",
          overallConfidence,
          needsReview ? 1 : 0,
          qualityGate || "review",
          lastError || "",
          now,
          now,
        ],
      );
    }
  };

  const autoExtractAndAnalyzeRecord = async ({
    recordId,
    userId,
    filePath,
    mimetype,
    reportDate,
  }) => {
    const extraction = extractDocumentFromFile({ filePath, mimetype });
    const suggestion = extraction.text
      ? parseReportSections({ text: extraction.text, pages: extraction.pages || [], reportDate })
      : null;
    await upsertRecordExtraction({
      recordId,
      userId,
      extractedText: extraction.text || "",
      extractionStatus: extraction.error ? "failed" : extraction.text ? "success" : "empty",
      extractor: extraction.extractor || "swift_ocr",
      suggestedReportType: suggestion?.reportType || "",
      suggestedReportDate: suggestion?.reportDate || reportDate || "",
      suggestedMetrics: suggestion?.metrics || [],
      detectedSections: suggestion?.detectedSections || [],
      rejectedMetrics: suggestion?.rejectedMetrics || [],
      detectedLabSource: suggestion?.detectedLabSource?.label || "",
      overallConfidence: suggestion?.overallConfidence ?? null,
      needsReview: suggestion?.needsReview ?? true,
      qualityGate: suggestion?.qualityGate || "review",
      lastError: extraction.error || "",
    });

    if (!extraction.text || !(suggestion?.metrics || []).length) {
      return {
        ok: false,
        qualityGate: suggestion?.qualityGate || "review",
        confidence: suggestion?.overallConfidence ?? null,
        reason: extraction.error || suggestion?.summary || "No structured values detected.",
      };
    }

    const createdSectionIds = await replaceRecordSectionAnalyses({
      recordId,
      userId,
      sections: suggestion.sections || [],
      source: "lab_upload",
    });
    return {
      ok: createdSectionIds.length > 0,
      qualityGate: suggestion?.qualityGate || "review",
      confidence: suggestion?.overallConfidence ?? null,
      detectedLabSource: suggestion?.detectedLabSource?.label || "",
    };
  };

  const findBestPatientMatch = async ({ patientId = "", phone = "", email = "", abhaNumber = "", name = "" }) => {
    const conditions = [];
    const params = [];
    if (patientId) {
      conditions.push("lower(COALESCE(u.patient_uid, '')) = lower(?)");
      params.push(String(patientId).trim());
    }
    if (phone) {
      conditions.push("lower(COALESCE(p.phone, '')) = lower(?)");
      params.push(String(phone).trim());
    }
    if (email) {
      conditions.push("lower(u.email) = lower(?)");
      params.push(String(email).trim());
    }
    if (abhaNumber) {
      conditions.push("COALESCE(p.abha_number, '') = ?");
      params.push(String(abhaNumber).replace(/\D/g, ""));
    }
    if (!conditions.length && name) {
      conditions.push("lower(u.name) LIKE ?");
      params.push(`%${String(name).trim().toLowerCase()}%`);
    }
    if (!conditions.length) return null;
    return get(
      `SELECT u.id, u.name, u.patient_uid, u.email, p.phone, p.abha_number
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.role = 'patient'
         AND (${conditions.join(" OR ")})
       ORDER BY u.id DESC
       LIMIT 1`,
      params,
    );
  };

  fastify.get("/api/admin/hospital-profile", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    return {
      profile: (await hospitalSettingsService.getHospitalProfile()) || null,
    };
  });

  fastify.put("/api/admin/hospital-profile", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const result = await hospitalSettingsService.upsertHospitalProfile(request.body || {});
    if (result.error) {
      return reply.code(400).send({ error: result.error });
    }
    return result;
  });

  fastify.get("/api/admin/hospital-content", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    return hospitalSettingsService.getHospitalContentAdmin();
  });

  fastify.put("/api/admin/hospital-content", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const result = await hospitalSettingsService.saveHospitalContent(request.body?.content);
    if (result.error) {
      return reply.code(400).send({ error: result.error });
    }
    const patientRows = await all(
      `SELECT id
       FROM users
       WHERE role = 'patient' AND active = 1
       ORDER BY id ASC`,
    );
    const notificationTitle = "Hospital information updated";
    const notificationMessage =
      "There is a new patient guidance update from the hospital. Open the Hospital section whenever you want to review it.";
    const eventSuffix = (result.updatedAt || nowIso()).replace(/[^0-9A-Za-z]/g, "");
    for (const row of patientRows) {
      await enqueueAndDeliverUserNotification({
        userId: row.id,
        type: "hospital_update",
        title: notificationTitle,
        message: notificationMessage,
        eventKey: `hospital-content-update:${eventSuffix}:user:${row.id}`,
      });
    }
    return result;
  });

  fastify.post("/api/admin/hospital-content/assets", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    if (!request.isMultipart()) return reply.code(400).send({ error: "multipart form-data required." });

    let fileMeta = null;
    for await (const part of request.parts()) {
      if (part.type !== "file") continue;
      if (!part.mimetype || !part.mimetype.startsWith("image/")) {
        return reply.code(400).send({ error: "Upload a JPG, PNG, WEBP, GIF, or HEIC image." });
      }
      fileMeta = await saveUpload(part, {
        dir: hospitalContentAssetsDir,
        prefix: "hospital_update",
      });
      break;
    }

    if (!fileMeta) {
      return reply.code(400).send({ error: "Image file is required." });
    }

    return {
      filename: fileMeta.filename,
      url: `/api/hospital-content/assets/${encodeURIComponent(fileMeta.filename)}`,
    };
  });

  fastify.get("/api/hospital/content", async () => hospitalSettingsService.getPublicHospitalContent());

  fastify.get("/api/hospital-content/assets/:filename", async (request, reply) => {
    const filename = String(request.params?.filename || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!filename) return reply.code(400).send({ error: "Invalid asset name." });
    const filePath = path.join(hospitalContentAssetsDir, filename);
    if (!fs.existsSync(filePath)) return reply.code(404).send({ error: "Asset not found." });
    reply.header("Content-Type", getAssetContentType(filePath));
    return reply.send(fs.createReadStream(filePath));
  });

  fastify.get("/api/admin/visit-types", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    return { visitTypes: await hospitalSettingsService.readVisitTypes() };
  });

  fastify.put("/api/admin/visit-types", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const items = Array.isArray(request.body?.visitTypes) ? request.body.visitTypes : null;
    const result = await hospitalSettingsService.saveVisitTypes(items);
    if (result.error) {
      return reply.code(400).send({ error: result.error });
    }
    return result;
  });

  fastify.get("/api/admin/lab-desk/uploads", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const limit = Math.min(30, Math.max(1, Number(request.query?.limit || 12)));
    const rows = await all(
      `SELECT mr.id, mr.file_name, mr.original_file_name, mr.display_label, mr.source, mr.source_label, mr.created_at,
              u.id AS patient_id, u.name AS patient_name, u.patient_uid, u.email AS patient_email,
              p.phone AS patient_phone,
              me.quality_gate, me.overall_confidence, me.detected_lab_source,
              uploader.id AS uploaded_by_user_id,
              uploader.name AS uploaded_by_name,
              uploader.email AS uploaded_by_email
       FROM medical_records mr
       INNER JOIN users u ON u.id = mr.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN medical_record_extractions me ON me.record_id = mr.id
       LEFT JOIN users uploader ON uploader.id = mr.uploaded_by_user_id
       WHERE mr.source = 'lab_upload'
       ORDER BY mr.created_at DESC, mr.id DESC
       LIMIT ?`,
      [limit],
    );
    return {
      uploads: rows.map((row) => ({
        id: row.id,
        fileName: row.file_name,
        originalFileName: row.original_file_name || "",
        displayLabel: row.display_label || row.original_file_name || row.file_name,
        source: row.source || "lab_upload",
        sourceLabel: row.source_label || "Lab upload",
        createdAt: row.created_at,
        uploadedBy: {
          id: row.uploaded_by_user_id || null,
          name: row.uploaded_by_name || "",
          email: row.uploaded_by_email || "",
        },
        patient: {
          id: row.patient_id,
          name: row.patient_name || "Patient",
          patientUid: row.patient_uid || "",
          email: row.patient_email || "",
          phone: row.patient_phone || "",
        },
        extraction: {
          qualityGate: row.quality_gate || "review",
          overallConfidence: row.overall_confidence ?? null,
          detectedLabSource: row.detected_lab_source || "",
        },
      })),
    };
  });

  fastify.get("/api/admin/lab-desk/uploads/export", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT mr.id, mr.file_name, mr.original_file_name, mr.display_label, mr.source_label, mr.created_at,
              u.name AS patient_name, u.patient_uid, u.email AS patient_email,
              p.phone AS patient_phone,
              me.quality_gate, me.overall_confidence, me.detected_lab_source,
              uploader.name AS uploaded_by_name, uploader.email AS uploaded_by_email
       FROM medical_records mr
       INNER JOIN users u ON u.id = mr.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN medical_record_extractions me ON me.record_id = mr.id
       LEFT JOIN users uploader ON uploader.id = mr.uploaded_by_user_id
       WHERE mr.source = 'lab_upload'
       ORDER BY mr.created_at DESC, mr.id DESC`,
    );
    const escapeCsv = (value = "") => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = [
      "recordId",
      "displayLabel",
      "originalFileName",
      "patientName",
      "patientUid",
      "patientEmail",
      "patientPhone",
      "sourceLabel",
      "qualityGate",
      "overallConfidence",
      "detectedLabSource",
      "uploadedByName",
      "uploadedByEmail",
      "createdAt",
    ];
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.display_label || row.original_file_name || row.file_name,
          row.original_file_name || "",
          row.patient_name || "",
          row.patient_uid || "",
          row.patient_email || "",
          row.patient_phone || "",
          row.source_label || "Lab upload",
          row.quality_gate || "",
          row.overall_confidence ?? "",
          row.detected_lab_source || "",
          row.uploaded_by_name || "",
          row.uploaded_by_email || "",
          row.created_at || "",
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ].join("\n");
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="lab-upload-ledger-${nowIso().slice(0, 10)}.csv"`);
    return reply.send(csv);
  });

  fastify.get("/api/admin/lab-desk/analytics", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const [summary, dailyRows, qualityRows, engagementSummary] = await Promise.all([
      get(
        `SELECT
           COUNT(*) AS total_uploads,
           COUNT(DISTINCT mr.user_id) AS unique_patients,
           SUM(CASE WHEN me.quality_gate = 'trusted' THEN 1 ELSE 0 END) AS trusted_uploads,
           SUM(CASE WHEN me.quality_gate IN ('review', 'partial_review') THEN 1 ELSE 0 END) AS review_uploads,
           SUM(CASE WHEN me.quality_gate = 'rejected' OR me.extraction_status = 'failed' THEN 1 ELSE 0 END) AS failed_uploads,
           AVG(
             CASE
               WHEN me.updated_at IS NOT NULL
               THEN (julianday(me.updated_at) - julianday(mr.created_at)) * 24 * 60
               ELSE NULL
             END
           ) AS avg_turnaround_minutes
         FROM medical_records mr
         LEFT JOIN medical_record_extractions me ON me.record_id = mr.id
         WHERE mr.source = 'lab_upload'`,
      ),
      all(
        `SELECT date(mr.created_at) AS day,
                COUNT(*) AS total,
                SUM(CASE WHEN me.quality_gate = 'trusted' THEN 1 ELSE 0 END) AS trusted,
                SUM(CASE WHEN me.quality_gate = 'rejected' OR me.extraction_status = 'failed' THEN 1 ELSE 0 END) AS failed
         FROM medical_records mr
         LEFT JOIN medical_record_extractions me ON me.record_id = mr.id
         WHERE mr.source = 'lab_upload'
         GROUP BY date(mr.created_at)
         ORDER BY day DESC
         LIMIT 14`,
      ),
      all(
        `SELECT COALESCE(me.quality_gate, 'review') AS quality_gate, COUNT(*) AS total
         FROM medical_records mr
         LEFT JOIN medical_record_extractions me ON me.record_id = mr.id
         WHERE mr.source = 'lab_upload'
         GROUP BY COALESCE(me.quality_gate, 'review')`,
      ),
      get(
        `SELECT
           COUNT(DISTINCT CASE WHEN ae.event_name = 'lab_continuity_opened' THEN ae.user_id END) AS opened_patients,
           COUNT(DISTINCT CASE WHEN ae.event_name = 'lab_continuity_returned' THEN ae.user_id END) AS revisited_patients,
           COUNT(DISTINCT CASE WHEN ae.event_name IN ('health_memory_saved', 'plan_started', 'followup_booked') THEN ae.user_id END) AS prepared_patients
         FROM analytics_events ae
         WHERE ae.user_id IN (
           SELECT DISTINCT mr.user_id
           FROM medical_records mr
           WHERE mr.source = 'lab_upload'
         )`,
      ),
    ]);
    return {
      overview: {
        totalUploads: Number(summary?.total_uploads || 0),
        uniquePatients: Number(summary?.unique_patients || 0),
        trustedUploads: Number(summary?.trusted_uploads || 0),
        reviewUploads: Number(summary?.review_uploads || 0),
        failedUploads: Number(summary?.failed_uploads || 0),
        avgTurnaroundMinutes: Number(summary?.avg_turnaround_minutes || 0),
        openedPatients: Number(engagementSummary?.opened_patients || 0),
        revisitedPatients: Number(engagementSummary?.revisited_patients || 0),
        preparedPatients: Number(engagementSummary?.prepared_patients || 0),
      },
      daily: dailyRows.map((row) => ({
        day: row.day,
        total: Number(row.total || 0),
        trusted: Number(row.trusted || 0),
        failed: Number(row.failed || 0),
      })),
      qualityBreakdown: qualityRows.map((row) => ({
        qualityGate: row.quality_gate,
        total: Number(row.total || 0),
      })),
    };
  });

  fastify.post("/api/admin/lab-desk/patients", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const body = request.body || {};
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const emailInput = String(body.email || "").trim().toLowerCase();
    const abhaNumber = String(body.abhaNumber || "").replace(/\D/g, "");
    if (!name || name.length < 2) {
      return reply.code(400).send({ error: "Patient name is required." });
    }
    if (!phone && !emailInput && !abhaNumber) {
      return reply.code(400).send({ error: "Add at least one patient identifier like phone, email, or ABHA." });
    }
    if (emailInput) {
      const existingEmail = await get("SELECT id FROM users WHERE email = ?", [emailInput]);
      if (existingEmail) {
        return reply.code(409).send({ error: "A patient with this email already exists." });
      }
    }
    if (phone) {
      const existingPhone = await get(
        `SELECT u.id
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.role = 'patient' AND p.phone = ?`,
        [phone],
      );
      if (existingPhone) {
        return reply.code(409).send({ error: "A patient with this phone already exists." });
      }
    }
    if (abhaNumber) {
      const existingAbha = await get(
        `SELECT u.id
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.role = 'patient' AND p.abha_number = ?`,
        [abhaNumber],
      );
      if (existingAbha) {
        return reply.code(409).send({ error: "A patient with this ABHA number already exists." });
      }
    }

    const email =
      emailInput ||
      `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "patient"}.${Date.now()}@sehatsaathi.local`;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(12).toString("hex"), 10);
    const createdAt = nowIso();
    const insert = await run(
      `INSERT INTO users (name, email, password_hash, role, active, registration_mode, created_at)
       VALUES (?, ?, ?, 'patient', 1, 'lab_desk', ?)`,
      [name, email, passwordHash, createdAt],
    );
    const patientUid = buildPatientUid(insert.lastID);
    await run("UPDATE users SET patient_uid = ? WHERE id = ?", [patientUid, insert.lastID]);
    await run(
      `INSERT INTO profiles (user_id, phone, abha_number, updated_at)
       VALUES (?, ?, ?, ?)`,
      [insert.lastID, phone || null, abhaNumber || null, createdAt],
    );
    return {
      patient: {
        id: insert.lastID,
        name,
        patient_uid: patientUid,
        email,
        phone,
        abha_number: abhaNumber,
      },
    };
  });

  fastify.post("/api/admin/lab-desk/patient-matches", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = Array.isArray(request.body?.rows) ? request.body.rows.slice(0, 200) : [];
    const results = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const patient = await findBestPatientMatch({
        patientId: row.patientId || row.patient_uid || row.pid || "",
        phone: row.phone || row.mobile || "",
        email: row.email || "",
        abhaNumber: row.abhaNumber || row.abha_number || "",
        name: row.name || row.patientName || "",
      });
      results.push({
        rowIndex: index,
        input: row,
        status: patient ? "matched" : "unmatched",
        patient: patient
          ? {
              id: patient.id,
              name: patient.name || "Patient",
              patientUid: patient.patient_uid || "",
              email: patient.email || "",
              phone: patient.phone || "",
              abhaNumber: patient.abha_number || "",
            }
          : null,
      });
    }
    return { results };
  });

  fastify.post("/api/admin/lab-desk/patients/:patientId/records", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const patientId = Number(request.params?.patientId);
    if (!patientId) return reply.code(400).send({ error: "Valid patient id is required." });
    if (!request.isMultipart()) return reply.code(400).send({ error: "multipart form-data required." });

    const patient = await get(
      `SELECT u.id, u.name, u.patient_uid, u.email, p.phone, p.abha_number
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.role = 'patient'`,
      [patientId],
    );
    if (!patient) return reply.code(404).send({ error: "Patient not found." });

    let fileMeta = null;
    let originalFilename = "";
    for await (const part of request.parts()) {
      if (part.type !== "file") continue;
      if (!part.mimetype || (!part.mimetype.startsWith("image/") && part.mimetype !== "application/pdf")) {
        return reply.code(400).send({ error: "Unsupported format. Upload a PDF or a clear image file (JPG, PNG, HEIC, WEBP)." });
      }
      originalFilename = String(part.filename || "").trim();
      fileMeta = await saveUpload(part, { dir: recordsDir, prefix: "lab_record" });
      break;
    }
    if (!fileMeta) return reply.code(400).send({ error: "record file is required." });

    const createdAt = nowIso();
    const sourceLabel = request.authUser.role === "front_desk" ? "Lab desk upload" : "Lab upload";
    const displayLabel = originalFilename || fileMeta.filename;
    const result = await run(
      `INSERT INTO medical_records (user_id, member_id, file_name, file_path, mimetype, source, source_label, uploaded_by_user_id, original_file_name, display_label, created_at)
       VALUES (?, NULL, ?, ?, ?, 'lab_upload', ?, ?, ?, ?, ?)`,
      [patientId, fileMeta.filename, fileMeta.path, fileMeta.mimetype, sourceLabel, request.authUser.id, originalFilename || null, displayLabel, createdAt],
    );

    await upsertRecordExtraction({
      recordId: result.lastID,
      userId: patientId,
      extractedText: "",
      extractionStatus: "processing",
      extractor: "lab_background_queue",
      suggestedReportType: "",
      suggestedReportDate: createdAt.slice(0, 10),
      suggestedMetrics: [],
      detectedSections: [],
      rejectedMetrics: [],
      detectedLabSource: "",
      overallConfidence: null,
      needsReview: true,
      qualityGate: "review",
      lastError: "",
    });

    await enqueueAndDeliverUserNotification({
      userId: patientId,
      type: "lab_report_added",
      title: "New report added to your record",
      message: "A report was added to your SehatSaathi record by the care team. Open Reports when you want to review it.",
      eventKey: `lab-upload:${result.lastID}:user:${patientId}`,
    });

    void (async () => {
      try {
        await autoExtractAndAnalyzeRecord({
          recordId: result.lastID,
          userId: patientId,
          filePath: fileMeta.path,
          mimetype: fileMeta.mimetype,
          reportDate: createdAt.slice(0, 10),
        });
      } catch (error) {
        request.log.error({ error, recordId: result.lastID }, "Lab desk auto-extraction failed after upload");
      }
    })();

    return {
      ok: true,
      recordId: result.lastID,
      patient: {
        id: patient.id,
        name: patient.name || "Patient",
        patientUid: patient.patient_uid || "",
        email: patient.email || "",
        phone: patient.phone || "",
        abhaNumber: patient.abha_number || "",
      },
      extractionStatus: "processing",
      message: "Lab report added. Patient and doctor views will update as the report finishes processing.",
      extraction: {
        qualityGate: "review",
        overallConfidence: null,
        detectedLabSource: "",
      },
    };
  });
};

module.exports = { registerHospitalRoutes };
