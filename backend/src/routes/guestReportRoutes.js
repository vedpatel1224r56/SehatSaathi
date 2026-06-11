const crypto = require("crypto");
const {
  parseReportSections,
  buildReportInsights,
  deriveInterpretationBand,
} = require("../services/reportInsightsService");
const { extractDocumentFromFile } = require("../services/reportExtractionService");
const { buildActionMap } = require("../services/actionMapService");
const {
  localizeReportInsights,
  localizeActionMap,
  normalizeLanguage,
} = require("../services/reportInsightsLocalizationService");

const GUEST_REPORT_TTL_HOURS = 48;
const GUEST_UPLOAD_RATE_LIMIT = process.env.NODE_ENV === "production" ? 60 : 300;
const GUEST_UPLOAD_WINDOW_MS = process.env.NODE_ENV === "production" ? 60 * 60 * 1000 : 60 * 1000;
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

function inferMime(filename = "", mimetype = "") {
  const type = String(mimetype || "").toLowerCase().trim();
  if (type && type !== "application/octet-stream") return type;
  const ext = require("path").extname(String(filename || "")).toLowerCase();
  const map = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif" };
  return map[ext] || type || "";
}

function buildGuestToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sectionsToAnalysis(sections = []) {
  return sections.map((section, idx) => ({
    recordId: `guest_${idx}`,
    reportType: section.reportType || section.sectionKey || "unknown",
    reportDate: section.reportDate || new Date().toISOString().slice(0, 10),
    metrics: (section.metrics || []).map((m) => ({
      metricKey: m.metricKey || m.key,
      metricLabel: m.label || m.metricKey,
      valueNum: Number(m.valueNum ?? m.value),
      unit: m.unit || "",
      referenceLow: m.referenceLow ?? m.low ?? null,
      referenceHigh: m.referenceHigh ?? m.high ?? null,
      confidence: m.confidence ?? 1,
      interpretationBand: m.interpretationBand || deriveInterpretationBand(Number(m.valueNum ?? m.value), m.referenceLow ?? m.low, m.referenceHigh ?? m.high),
    })).filter((m) => Number.isFinite(m.valueNum)),
  })).filter((a) => a.metrics.length > 0);
}

// ─── Localised string helpers ──────────────────────────────────────────────────
const VALID_LANGS = new Set(["en", "gu", "hi"]);
function sl(obj, lang) { return obj[lang] || obj.en; }

function buildGuestInsightSummary(insights = {}, sections = [], lang = "en") {
  const L = VALID_LANGS.has(lang) ? lang : "en";

  const allIssues = insights.healthIssues?.all || [];
  const stableList = (insights.conditionSummaries || []).filter((s) => s.zone === "normal").map((s) => s.title || s.key);

  const priorityFinding = allIssues[0] || null;

  const allMetrics = sections.flatMap((s) => s.metrics || []);
  const abnormalMetrics = allMetrics.filter((m) => m.interpretationBand && m.interpretationBand !== "normal");
  const normalMetrics = allMetrics.filter((m) => m.interpretationBand === "normal");

  const totalDetected = allMetrics.length;
  const abnormalCount = abnormalMetrics.length;

  // ── Priority focus ───────────────────────────────────────────────────────────
  const priorityFocus = priorityFinding
    ? {
        title: priorityFinding.focusLabel || priorityFinding.label || sl({ en: "Worth discussing", gu: "ચર્ચા કરવા યોગ્ય", hi: "चर्चा योग्य" }, L),
        summary: priorityFinding.summary || sl({
          en: `${priorityFinding.focusLabel || "This value"} is outside the expected range and worth mentioning to your doctor.`,
          gu: `${priorityFinding.focusLabel || "આ value"} અપેક્ષિત range ની બહાર છે — ડૉક્ટર ને જણાવો.`,
          hi: `${priorityFinding.focusLabel || "यह value"} अपेक्षित range से बाहर है — डॉक्टर को बताएं।`,
        }, L),
        urgency: priorityFinding.severity === "CRITICAL" ? "prompt_review" : "timely_follow_up",
      }
    : abnormalMetrics.length
      ? {
          title: abnormalMetrics[0].metricLabel || abnormalMetrics[0].metricKey,
          summary: sl({
            en: `${abnormalMetrics[0].metricLabel || abnormalMetrics[0].metricKey} is outside the typical range. Bring this report to your next doctor visit.`,
            gu: `${abnormalMetrics[0].metricLabel || abnormalMetrics[0].metricKey} normal range ની બહાર છે. આ report ડૉક્ટર ને બતાવો.`,
            hi: `${abnormalMetrics[0].metricLabel || abnormalMetrics[0].metricKey} सामान्य range से बाहर है। यह report डॉक्टर को दिखाएं।`,
          }, L),
          urgency: "timely_follow_up",
        }
      : null;

  // ── Stable areas ─────────────────────────────────────────────────────────────
  const stableAreas = stableList.length
    ? stableList.slice(0, 3)
    : normalMetrics.slice(0, 3).map((m) => m.metricLabel || m.metricKey);

  // ── Doctor questions ─────────────────────────────────────────────────────────
  const rawQuestions = insights.personalizedFollowUp?.doctorQuestions || [];
  const fallbackQ1 = priorityFocus
    ? sl({
        en: `Should I be concerned about my ${priorityFocus.title} result?`,
        gu: `${priorityFocus.title} result વિશે ચિંતા કરવી જોઈએ?`,
        hi: `${priorityFocus.title} result के बारे में चिंतित होना चाहिए क्या?`,
      }, L)
    : null;
  const fallbackQ2 = sl({ en: "Does this report need a follow-up test?",                     gu: "આ report ને follow-up test ની જરૂર છે?",        hi: "क्या इस report के लिए follow-up test ज़रूरी है?" }, L);
  const fallbackQ3 = sl({ en: "Are there any lifestyle changes I should make based on this report?", gu: "આ report ના આધારે lifestyle ફેરફાર કરવા જોઈએ?", hi: "इस report के आधार पर lifestyle में क्या बदलाव करने चाहिए?" }, L);
  const doctorQuestions = rawQuestions.length >= 3
    ? rawQuestions.slice(0, 3)
    : [...rawQuestions, ...[fallbackQ1, fallbackQ2, fallbackQ3].filter(Boolean)].slice(0, 3);

  // ── Summary line ─────────────────────────────────────────────────────────────
  const summaryLine = totalDetected === 0
    ? sl({
        en: "We could read your report but couldn't extract specific values. You can add values manually.",
        gu: "Report વાંચ્યો પણ specific values મળ્યા નહીં. Values manually ઉમેરી શકો છો.",
        hi: "Report पढ़ा लेकिन specific values नहीं मिले। Values manually जोड़ सकते हैं।",
      }, L)
    : abnormalCount === 0
      ? sl({
          en: `All ${totalDetected} values in your report are within the normal range.`,
          gu: `Report ના બધા ${totalDetected} values normal range માં છે.`,
          hi: `Report के सभी ${totalDetected} values सामान्य range में हैं।`,
        }, L)
      : abnormalCount === 1
        ? sl({
            en: `${totalDetected} values detected — 1 is outside the normal range and worth discussing with your doctor.`,
            gu: `${totalDetected} values મળ્યા — 1 normal range ની બહાર છે, ડૉક્ટર સાથે ચર્ચા કરો.`,
            hi: `${totalDetected} values मिले — 1 सामान्य range से बाहर है, डॉक्टर से चर्चा करें।`,
          }, L)
        : sl({
            en: `${totalDetected} values detected — ${abnormalCount} are outside the normal range.`,
            gu: `${totalDetected} values મળ્યા — ${abnormalCount} normal range ની બહાર છે.`,
            hi: `${totalDetected} values मिले — ${abnormalCount} सामान्य range से बाहर हैं।`,
          }, L);

  // ── Safe disclaimer ──────────────────────────────────────────────────────────
  const safeDisclaimer = sl({
    en: "This is for preparation only, not a diagnosis. Bring your report to your doctor for medical decisions.",
    gu: "આ ફક્ત તૈયારી માટે છે, નિદાન નથી. ડૉક્ટર પાસે report લઈ જાઓ.",
    hi: "यह सिर्फ़ तैयारी के लिए है, निदान नहीं। डॉक्टर के पास report लेकर जाएं।",
  }, L);

  return {
    summary: summaryLine,
    totalMetrics: totalDetected,
    abnormalCount,
    priorityFocus,
    stableAreas,
    doctorQuestions,
    safeDisclaimer,
    detectedLabSource: sections[0]?.detectedLabSource?.label || null,
    reportType: sections[0]?.reportType || null,
  };
}

function buildGuestResponse({ id, token, status, insights }) {
  return {
    guestReportId: id,
    temporaryAccessToken: token,
    processingStatus: status,
    summary: insights?.summary || "",
    priorityFocus: insights?.priorityFocus || null,
    stableAreas: insights?.stableAreas || [],
    doctorQuestions: insights?.doctorQuestions || [],
    actionMap: insights?.actionMap || null,
    safeDisclaimer: insights?.safeDisclaimer || "This is for preparation only, not a diagnosis. Bring your report to your doctor for medical decisions.",
    insights: insights || null,
  };
}

const registerGuestReportRoutes = (fastify, deps) => {
  const { requireAuth, run, get, nowIso, saveUpload, RECORDS_DIR, path, safeJsonParse, checkRateLimit } = deps;

  const persistGuestExtractionForRecord = async ({ recordId, userId, row, sections }) => {
    const now = nowIso();
    const firstSection = sections[0] || {};
    const allMetrics = sections.flatMap((section) => section.metrics || []);
    await run(
      `INSERT INTO medical_record_extractions
       (record_id, user_id, member_id, extracted_text, extraction_status, extractor, suggested_report_type,
        suggested_report_date, suggested_metrics_json, detected_sections_json, rejected_metrics_json, detected_lab_source,
        overall_confidence, needs_review, quality_gate, last_error, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        userId,
        row.extracted_text || "",
        row.extracted_text ? "success" : "empty",
        "guest_upload",
        firstSection.reportType || "",
        firstSection.reportDate || now.slice(0, 10),
        JSON.stringify(allMetrics || []),
        JSON.stringify(sections || []),
        JSON.stringify([]),
        firstSection.detectedLabSource?.label || "",
        firstSection.overallConfidence ?? null,
        sections.length ? 0 : 1,
        sections.length ? "accepted" : "review",
        "",
        now,
        now,
      ],
    );
  };

  const persistGuestSectionsForRecord = async ({ recordId, userId, sections }) => {
    const now = nowIso();
    let savedSections = 0;
    for (const section of sections || []) {
      const metrics = (section.metrics || [])
        .map((metric) => ({
          metricKey: String(metric.metricKey || metric.key || "").trim(),
          metricLabel: String(metric.metricLabel || metric.label || metric.metricKey || "").trim(),
          valueNum: Number(metric.valueNum ?? metric.value),
          unit: String(metric.unit || "").trim(),
          referenceLow: metric.referenceLow ?? metric.low ?? null,
          referenceHigh: metric.referenceHigh ?? metric.high ?? null,
          confidence: metric.confidence ?? 1,
          originalMetricLabel: String(metric.originalMetricLabel || metric.label || metric.metricKey || "").trim(),
          originalUnit: String(metric.originalUnit || metric.unit || "").trim(),
          originalReferenceLow: metric.originalReferenceLow ?? null,
          originalReferenceHigh: metric.originalReferenceHigh ?? null,
          originalReferenceText: String(metric.originalReferenceText || "").trim(),
          interpretationBand:
            String(metric.interpretationBand || "").trim() ||
            deriveInterpretationBand(Number(metric.valueNum ?? metric.value), metric.referenceLow ?? metric.low, metric.referenceHigh ?? metric.high),
          originalValueText: String(metric.originalValueText || metric.valueNum || metric.value || "").trim(),
          normalizedValueText: String(metric.normalizedValueText || metric.valueNum || metric.value || "").trim(),
        }))
        .filter((metric) => metric.metricKey && metric.metricLabel && Number.isFinite(metric.valueNum));
      if (!metrics.length) continue;

      const insert = await run(
        `INSERT INTO medical_record_section_analyses
         (record_id, user_id, member_id, page_number, section_key, section_label, report_type, report_date, notes, source, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'guest_claim', ?, ?)`,
        [
          recordId,
          userId,
          section.pageNumber || null,
          section.sectionKey || section.reportType || "guest_report",
          section.label || section.reportType || "Uploaded report",
          section.reportType || "unknown",
          section.reportDate || now.slice(0, 10),
          String(section.summary || "").trim(),
          now,
          now,
        ],
      );

      for (const metric of metrics) {
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
            metric.confidence,
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
      savedSections += 1;
    }
    return savedSections;
  };

  fastify.post("/api/guest-report/upload", async (request, reply) => {
    const lang = normalizeLanguage(request.query?.lang);
    const ip = request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown";
    const rateCheck = checkRateLimit(`guest_upload:${ip}`, GUEST_UPLOAD_RATE_LIMIT, GUEST_UPLOAD_WINDOW_MS);
    if (!rateCheck.allowed) {
      return reply.code(429).send({ error: "Too many uploads. Try again later.", retryAfterSec: rateCheck.retryAfterSec });
    }

    if (!request.isMultipart()) {
      return reply.code(400).send({ error: "multipart/form-data required." });
    }

    let fileMeta = null;
    let originalFilename = "";
    const guestContextFields = {};
    for await (const part of request.parts()) {
      if (part.type === "file") {
        const ext = path.extname(String(part.filename || "")).toLowerCase();
        const mime = String(part.mimetype || "").toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext) && !mime.startsWith("image/") && mime !== "application/pdf") {
          return reply.code(400).send({ error: "Upload a PDF or image file (JPG, PNG, HEIC)." });
        }
        originalFilename = String(part.filename || "").trim();
        fileMeta = await saveUpload(part, { dir: RECORDS_DIR, prefix: "guest" });
        fileMeta.mimetype = inferMime(originalFilename || fileMeta.filename, fileMeta.mimetype);
      } else if (part.type === "field") {
        // Collect optional guest context: age, sex, conditions
        const fieldName = String(part.fieldname || "").trim();
        const value = String(part.value || "").trim();
        if (["age", "sex", "conditions"].includes(fieldName) && value) {
          guestContextFields[fieldName] = value;
        }
      }
    }

    if (!fileMeta) {
      return reply.code(400).send({ error: "No file received." });
    }

    // Build patientContext from submitted fields (empty object = generic output)
    const patientContext = Object.keys(guestContextFields).length
      ? {
          age: guestContextFields.age ? Number(guestContextFields.age) : undefined,
          sex: guestContextFields.sex || undefined,
          conditions: guestContextFields.conditions || undefined,
        }
      : {};

    const guestToken = buildGuestToken();
    const tokenHash = hashToken(guestToken);
    const expiresAt = new Date(Date.now() + GUEST_REPORT_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const now = nowIso();

    let extractedText = "";
    let sections = [];
    let insightSummary = null;
    let processingStatus = "processing";

    try {
      const extraction = extractDocumentFromFile({ filePath: fileMeta.path, mimetype: fileMeta.mimetype });
      extractedText = extraction.text || "";

      if (extractedText) {
        const parsed = parseReportSections({ text: extractedText, pages: extraction.pages || [], reportDate: now.slice(0, 10) });
        sections = parsed.sections || parsed.mergedSections || [];

        if (!sections.length && parsed.metrics?.length) {
          sections = [{
            reportType: parsed.reportType || "unknown",
            reportDate: parsed.reportDate || now.slice(0, 10),
            metrics: parsed.metrics,
            detectedLabSource: parsed.detectedLabSource || null,
          }];
        }

        if (sections.length) {
          const analyses = sectionsToAnalysis(sections);
          if (analyses.length) {
            const sourceInsights = buildReportInsights({ analyses, months: 6, patientContext });
            const insights = localizeReportInsights(sourceInsights, lang);
            insightSummary = buildGuestInsightSummary(insights, sections, lang);
            insightSummary.actionMap = localizeActionMap(buildActionMap(sourceInsights.trends || [], lang, patientContext), lang);
            // Persist context so the GET /insights re-build can reuse it
            insightSummary._guestContext = patientContext;
            processingStatus = "ready";
          } else {
            insightSummary = buildGuestInsightSummary({}, [], lang);
            processingStatus = "partial";
          }
        } else {
          insightSummary = buildGuestInsightSummary({}, [], lang);
          processingStatus = "partial";
        }
      } else {
        processingStatus = "extraction_failed";
      }
    } catch (err) {
      request.log.error({ err }, "guest report processing failed");
      processingStatus = "extraction_failed";
    }

    const result = await run(
      `INSERT INTO guest_reports (guest_token_hash, file_path, file_name, mimetype, extracted_text, sections_json, insights_json, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tokenHash,
        fileMeta.path,
        originalFilename || fileMeta.filename,
        fileMeta.mimetype,
        extractedText,
        JSON.stringify(sections),
        JSON.stringify(insightSummary),
        processingStatus,
        expiresAt,
        now,
        now,
      ],
    );

    return reply.code(201).send(buildGuestResponse({
      id: result.lastID,
      token: guestToken,
      status: processingStatus,
      insights: insightSummary,
    }));
  });

  fastify.get("/api/guest-report/:id/insights", async (request, reply) => {
    const { id } = request.params;
    const token = String(request.headers["x-guest-token"] || "").trim();
    if (!token) return reply.code(401).send({ error: "Guest token required." });

    // Accept ?lang=en|gu|hi (default "en")
    const lang = normalizeLanguage(request.query?.lang);

    const tokenHash = hashToken(token);
    const row = await get(
      `SELECT id, status, insights_json, sections_json, expires_at FROM guest_reports WHERE id = ? AND guest_token_hash = ?`,
      [id, tokenHash],
    );

    if (!row) return reply.code(404).send({ error: "Report not found." });
    if (new Date(row.expires_at) < new Date()) return reply.code(410).send({ error: "This report has expired. Upload again to continue." });

    // Re-build with requested language so all strings (action plan, summary,
    // doctor questions, disclaimer) come back translated.
    const storedInsights = safeJsonParse(row.insights_json, null);
    let insights = storedInsights;

    if (storedInsights) {
      try {
        const sections = safeJsonParse(row.sections_json, []);
        const analyses = sectionsToAnalysis(sections);
        // Reuse the guest context that was saved at upload time
        const savedContext = storedInsights._guestContext || {};
        if (analyses.length) {
          const sourceInsights = buildReportInsights({ analyses, months: 6, patientContext: savedContext });
          const freshInsights = localizeReportInsights(sourceInsights, lang);
          insights = buildGuestInsightSummary(freshInsights, sections, lang);
          insights.actionMap = localizeActionMap(buildActionMap(sourceInsights.trends || [], lang, savedContext), lang);
          insights._guestContext = savedContext;
        } else {
          insights = buildGuestInsightSummary({}, [], lang);
        }
      } catch (err) {
        request.log.warn({ err }, "lang re-build failed, returning stored insights");
        insights = storedInsights;
      }
    }

    return buildGuestResponse({
      id: row.id,
      token,
      status: row.status,
      insights,
    });
  });

  fastify.post("/api/guest-report/:id/claim", async (request, reply) => {
    const { id } = request.params;
    const token = String(request.headers["x-guest-token"] || "").trim();
    if (!token) return reply.code(401).send({ error: "Guest token required." });

    const { phoneNumber } = request.body || {};
    if (!phoneNumber || String(phoneNumber).replace(/\D/g, "").length < 10) {
      return reply.code(400).send({ error: "A valid 10-digit phone number is required." });
    }

    const tokenHash = hashToken(token);
    const row = await get(
      `SELECT id, status, expires_at, claimed_user_id FROM guest_reports WHERE id = ? AND guest_token_hash = ?`,
      [id, tokenHash],
    );

    if (!row) return reply.code(404).send({ error: "Report not found." });
    if (new Date(row.expires_at) < new Date()) return reply.code(410).send({ error: "This report has expired." });
    if (row.claimed_user_id) return reply.code(409).send({ error: "This report has already been claimed." });

    const normalizedPhone = String(phoneNumber).replace(/\D/g, "").slice(-10);

    await run(
      `UPDATE guest_reports SET status = 'claim_pending', claim_phone = ?, updated_at = ? WHERE id = ?`,
      [normalizedPhone, nowIso(), id],
    );

    return {
      status: "otp_required",
      message: "OTP delivery is being set up. Your report is saved and ready to claim once phone verification is live.",
      phoneNumber: `+91${normalizedPhone}`,
    };
  });

  /**
   * Link a guest report to a newly-created (or existing) authenticated user.
   * Called immediately after account creation if a guest session was active.
   * Requires: X-Guest-Token header + valid auth (user must be logged in).
   */
  fastify.post("/api/guest-report/:id/link-account", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const { id } = request.params;
    const token = String(request.headers["x-guest-token"] || "").trim();
    if (!token) return reply.code(401).send({ error: "Guest token required." });

    const tokenHash = hashToken(token);
    const row = await get(
      `SELECT id, status, expires_at, claimed_user_id, file_path, file_name, mimetype, extracted_text, insights_json, sections_json
       FROM guest_reports WHERE id = ? AND guest_token_hash = ?`,
      [id, tokenHash],
    );

    if (!row) return reply.code(404).send({ error: "Report not found or token invalid." });
    if (new Date(row.expires_at) < new Date()) return reply.code(410).send({ error: "This report has expired." });
    if (row.claimed_user_id && Number(row.claimed_user_id) !== Number(request.authUser.id)) {
      return reply.code(409).send({ error: "This report has already been claimed by another account." });
    }

    const existingRecord = await get(
      `SELECT id FROM medical_records
       WHERE user_id = ? AND source = 'guest_upload' AND source_label = ?
       ORDER BY id DESC LIMIT 1`,
      [request.authUser.id, `guest:${row.id}`],
    );
    if (existingRecord?.id) {
      await run(
        `UPDATE guest_reports SET claimed_user_id = ?, status = 'claimed', updated_at = ? WHERE id = ?`,
        [request.authUser.id, nowIso(), id],
      );
      return reply.send({ ok: true, linked: true, alreadyLinked: true, recordId: existingRecord.id });
    }

    const now = nowIso();
    const displayLabel = row.file_name || "Uploaded report";
    const record = await run(
      `INSERT INTO medical_records
       (user_id, member_id, file_name, file_path, mimetype, source, source_label, uploaded_by_user_id, original_file_name, display_label, created_at)
       VALUES (?, NULL, ?, ?, ?, 'guest_upload', ?, ?, ?, ?, ?)`,
      [
        request.authUser.id,
        path.basename(row.file_path || row.file_name || `guest-report-${row.id}`),
        row.file_path || "",
        row.mimetype || "application/pdf",
        `guest:${row.id}`,
        request.authUser.id,
        row.file_name || null,
        displayLabel,
        now,
      ],
    );

    const sections = safeJsonParse(row.sections_json, []);
    await persistGuestExtractionForRecord({ recordId: record.lastID, userId: request.authUser.id, row, sections });
    const sectionCount = await persistGuestSectionsForRecord({ recordId: record.lastID, userId: request.authUser.id, sections });

    await run(
      `UPDATE guest_reports SET claimed_user_id = ?, status = 'claimed', updated_at = ? WHERE id = ?`,
      [request.authUser.id, nowIso(), id],
    );

    return reply.send({ ok: true, linked: true, userId: request.authUser.id, recordId: record.lastID, sectionCount });
  });

  // ── Guest consent audit log ─────────────────────────────────────────────
  // Called from the frontend the moment a guest clicks "Upload Report" and
  // confirms all consent checkboxes — before the file picker even opens.
  // No auth required. Stores IP + user-agent for legal compliance.
  fastify.post("/api/guest/consent", async (request, reply) => {
    const { policyVersion, consentTypes } = request.body || {};
    if (
      !policyVersion ||
      !Array.isArray(consentTypes) ||
      consentTypes.length === 0
    ) {
      return reply.code(400).send({ error: "policyVersion and consentTypes[] are required." });
    }
    const ip = String(
      request.headers?.["x-forwarded-for"] || request.ip || "",
    ).split(",")[0].trim().slice(0, 100);
    const ua = String(request.headers?.["user-agent"] || "").slice(0, 300);
    const now = deps.nowIso ? deps.nowIso() : new Date().toISOString();

    for (const ct of consentTypes.slice(0, 10)) {
      await deps.run(
        `INSERT INTO guest_consent_logs (consent_type, policy_version, ip, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [String(ct).slice(0, 100), String(policyVersion).slice(0, 50), ip, ua, now],
      );
    }
    return reply.send({ ok: true, logged: Math.min(consentTypes.length, 10) });
  });
};

module.exports = { registerGuestReportRoutes };
