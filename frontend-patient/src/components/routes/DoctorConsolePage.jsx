import { useEffect, useMemo, useRef, useState } from "react";
import { buildPersonalizedPlan, resolvePlan } from "../patient-shell/HealthPlanPanel";

const LAB_QUEUE_STORAGE_KEY = "sehatsaathi_lab_queue_v1";
const LAB_BATCH_STORAGE_KEY = "sehatsaathi_lab_batch_v1";

function createDoctorTask(index = 1) {
  return {
    id: `doctor_task_${Date.now()}_${index}`,
    label: "",
    note: "",
    origin: "doctor",
    editedByDoctor: true,
  };
}

function parseLabCsvRows(text = "") {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((item) => item.trim());
    return headers.reduce((acc, header, index) => {
      acc[header] = cells[index] || "";
      return acc;
    }, {});
  });
}

function normalizeBatchKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function buildBatchDisplayName(row = {}, rowIndex = 0) {
  return row.name || row.phone || row.email || row.patientId || row.abhaNumber || `Row ${rowIndex + 1}`;
}

function pairBatchMatchesWithFiles(matches = [], files = []) {
  if (!Array.isArray(matches) || !matches.length) return [];
  const unusedFiles = [...files];
  return matches.map((item) => {
    const input = item?.input || {};
    const desiredKey = normalizeBatchKey(
      input.fileName || input.filename || input.reportFile || input.reportName || input.name || input.patientId || input.phone || input.email,
    );
    let file = null;
    if (desiredKey) {
      const matchIndex = unusedFiles.findIndex((candidate) => normalizeBatchKey(candidate?.name) === desiredKey);
      if (matchIndex >= 0) {
        file = unusedFiles.splice(matchIndex, 1)[0];
      }
    }
    if (!file && unusedFiles.length) {
      file = unusedFiles.shift();
    }
    return {
      ...item,
      pairedFileName: file?.name || "",
      uploadStatus: item.uploadStatus || (file ? "ready" : "needs_file"),
      uploadMessage: item.uploadMessage || "",
      _file: file || null,
    };
  });
}

function serializeQueue(queue = []) {
  return queue.map((item) => ({
    id: item.id,
    name: item.name,
    patientId: item.patientId || "",
    patientName: item.patientName || "",
    status: item.status,
    source: item.source || "manual",
    fileMissing: !item.file,
  }));
}

function serializeBatch(matches = [], csvText = "", activeTab = "batch", files = []) {
  return {
    csvText,
    activeTab,
    files: files.map((file, index) => ({ name: file.name, index })),
    matches: matches.map((item) => ({
      rowIndex: item.rowIndex,
      input: item.input,
      status: item.status,
      patient: item.patient || null,
      pairedFileName: item.pairedFileName || "",
      uploadStatus: item.uploadStatus || "",
      uploadMessage: item.uploadMessage || "",
    })),
  };
}

export function DoctorConsolePage({
  consoleMode = "doctor",
  t = (key) => key,
  apiBase,
  apiFetch,
  user = null,
  sessionReady = false,
  authToken = "",
  handleAuth,
  authForm = { email: "", password: "" },
  updateAuthField,
  authError = "",
  signOut,
  loadTeleconsults,
  loadAppointments,
  loadEncounters,
  loadDoctorSchedule,
  scheduleForm = [],
  updateScheduleRow,
  weekdayLabel,
  removeScheduleRow,
  addScheduleRow,
  saveDoctorSchedule,
  scheduleStatus = "",
  teleLoading = false,
  teleconsults = [],
  activeConsultId = null,
  setActiveConsultId,
  activeConsult = null,
  doctorConsoleForm = { status: "requested", meetingUrl: "" },
  setDoctorConsoleForm,
  updateConsultStatus,
  doctorConsoleStatus = "",
  consultMessages = [],
  appointments = [],
  doctorChartForm = {
    appointmentId: "",
    chiefComplaint: "",
    findings: "",
    diagnosis: "",
    vitals: "",
    planText: "",
    followupDate: "",
  },
  setDoctorChartForm,
  createEncounterFromDoctor,
  encounters = [],
  activeEncounterId = null,
  setActiveEncounterId,
  noteForm = { note: "", signature: "" },
  setNoteForm,
  addDoctorNote,
  prescriptionForm = { instructions: "", itemsText: "" },
  setPrescriptionForm,
  addPrescription,
  orderForm = { orderType: "lab", itemName: "", destination: "" },
  setOrderForm,
  addOrder,
  doctorChartStatus = "",
  teleStatusLabel = (value) => value,
}) {
  const hasOpsAccess = user && (user.role === "doctor" || user.role === "admin" || user.role === "front_desk");
  const hasDoctorAccess = user && (user.role === "doctor" || user.role === "admin");
  const hasLabDeskAccess = user && (user.role === "admin" || user.role === "front_desk");
  const labUploadInputRef = useRef(null);
  const batchFileInputRef = useRef(null);
  const labDropZoneRef = useRef(null);
  const [labDeskQuery, setLabDeskQuery] = useState("");
  const [labDeskStatus, setLabDeskStatus] = useState("");
  const [labDeskLoading, setLabDeskLoading] = useState(false);
  const [labDeskUploading, setLabDeskUploading] = useState(false);
  const [labDeskPatients, setLabDeskPatients] = useState([]);
  const [labDeskUploads, setLabDeskUploads] = useState([]);
  const [selectedLabPatientId, setSelectedLabPatientId] = useState("");
  const [labQueue, setLabQueue] = useState([]);
  const [labCreateForm, setLabCreateForm] = useState({
    name: "",
    phone: "",
    email: "",
    abhaNumber: "",
  });
  const [activeLabTab, setActiveLabTab] = useState("upload");
  const [batchCsvText, setBatchCsvText] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [batchMatches, setBatchMatches] = useState([]);
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [isLabDragActive, setIsLabDragActive] = useState(false);
  const [labAnalytics, setLabAnalytics] = useState(null);
  const [labAnalyticsStatus, setLabAnalyticsStatus] = useState("");
  const [labAnalyticsLoading, setLabAnalyticsLoading] = useState(false);
  const [recordSourceFilter, setRecordSourceFilter] = useState("all");
  const [doctorRecordStatus, setDoctorRecordStatus] = useState("");
  const [patientRecords, setPatientRecords] = useState([]);
  const [planReviewAppointmentId, setPlanReviewAppointmentId] = useState("");
  const [planReviewStatus, setPlanReviewStatus] = useState("");
  const [planReviewLoading, setPlanReviewLoading] = useState(false);
  const [planReviewSavedPlan, setPlanReviewSavedPlan] = useState(null);
  const [planReviewInsights, setPlanReviewInsights] = useState(null);
  const [planReviewForm, setPlanReviewForm] = useState({
    reviewStatus: "doctor_reviewed",
    doctorNotes: "",
    reviewTimingNote: "",
    tasks: [],
  });
  const selectedPlanReviewAppointment = appointments.find((item) => String(item.id) === String(planReviewAppointmentId)) || null;
  const selectedLabPatient = labDeskPatients.find((item) => String(item.id) === String(selectedLabPatientId)) || null;
  const labBrandedMode = consoleMode === "lab";
  const showDoctorTools = hasDoctorAccess && !labBrandedMode;
  const consoleTitle = labBrandedMode || (hasLabDeskAccess && !hasDoctorAccess) ? "Lab operations desk" : t("doctorConsoleTitle");
  const consoleSubtitle =
    labBrandedMode || (hasLabDeskAccess && !hasDoctorAccess)
      ? "Upload reports into the right patient record and keep patient and doctor follow-up connected automatically."
      : t("doctorConsoleSubtitle");
  const doctorPlanPreview = useMemo(() => {
    if (!planReviewInsights || !planReviewSavedPlan?.focusKey) return null;
    return buildPersonalizedPlan(resolvePlan(planReviewInsights, planReviewSavedPlan.focusKey), planReviewInsights);
  }, [planReviewInsights, planReviewSavedPlan?.focusKey]);
  const doctorPlanTasks = planReviewForm.tasks.length
    ? planReviewForm.tasks
    : (doctorPlanPreview?.tasks || []).map((task) => ({
        id: task.id,
        label: task.label,
        note: task.note,
        origin: "ai",
        editedByDoctor: false,
      }));

  useEffect(() => {
    if (!hasLabDeskAccess) return;
    try {
      const savedQueue = window.localStorage.getItem(LAB_QUEUE_STORAGE_KEY);
      if (savedQueue) {
        const parsed = JSON.parse(savedQueue);
        if (Array.isArray(parsed) && parsed.length) {
          setLabQueue(
            parsed.map((item) => ({
              ...item,
              file: null,
              status: item.status === "uploading" ? "queued" : item.status,
            })),
          );
        }
      }
      const savedBatch = window.localStorage.getItem(LAB_BATCH_STORAGE_KEY);
      if (savedBatch) {
        const parsed = JSON.parse(savedBatch);
        if (parsed && typeof parsed === "object") {
          setBatchCsvText(String(parsed.csvText || ""));
          if (parsed.activeTab) {
            setActiveLabTab(String(parsed.activeTab));
          }
          if (Array.isArray(parsed.matches)) {
            setBatchMatches(parsed.matches.map((item) => ({ ...item, _file: null })));
          }
        }
      }
    } catch {
      // keep lab desk usable even if local persistence is unavailable
    }
  }, [hasLabDeskAccess]);

  useEffect(() => {
    if (!hasLabDeskAccess) return;
    try {
      window.localStorage.setItem(LAB_QUEUE_STORAGE_KEY, JSON.stringify(serializeQueue(labQueue)));
    } catch {
      // ignore persistence errors
    }
  }, [hasLabDeskAccess, labQueue]);

  useEffect(() => {
    if (!hasLabDeskAccess) return;
    try {
      window.localStorage.setItem(
        LAB_BATCH_STORAGE_KEY,
        JSON.stringify(serializeBatch(batchMatches, batchCsvText, activeLabTab, batchFiles)),
      );
    } catch {
      // ignore persistence errors
    }
  }, [activeLabTab, batchCsvText, batchFiles, batchMatches, hasLabDeskAccess]);

  useEffect(() => {
    if (!hasLabDeskAccess || !authToken) return;
    let cancelled = false;
    const loadRecentLabUploads = async () => {
      try {
        const response = await apiFetch(`${apiBase}/api/admin/lab-desk/uploads`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load recent lab uploads.");
        }
        if (!cancelled) {
          setLabDeskUploads(Array.isArray(data.uploads) ? data.uploads : []);
        }
      } catch (error) {
        if (!cancelled) {
          setLabDeskUploads([]);
        }
      }
    };
    loadRecentLabUploads();
    return () => {
      cancelled = true;
    };
  }, [apiBase, apiFetch, authToken, hasLabDeskAccess]);

  useEffect(() => {
    if (!hasLabDeskAccess || !authToken || activeLabTab !== "analytics") return;
    let cancelled = false;
    const loadAnalytics = async () => {
      setLabAnalyticsLoading(true);
      setLabAnalyticsStatus("");
      try {
        const response = await apiFetch(`${apiBase}/api/admin/lab-desk/analytics`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load lab analytics.");
        }
        if (!cancelled) {
          setLabAnalytics(data || null);
        }
      } catch (error) {
        if (!cancelled) {
          setLabAnalytics(null);
          setLabAnalyticsStatus(error?.message || "Unable to load lab analytics.");
        }
      } finally {
        if (!cancelled) setLabAnalyticsLoading(false);
      }
    };
    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [activeLabTab, apiBase, apiFetch, authToken, hasLabDeskAccess]);

  useEffect(() => {
    if (!showDoctorTools || !selectedLabPatientId) {
      setPatientRecords([]);
      return;
    }
    let cancelled = false;
    const loadPatientRecords = async () => {
      try {
        setDoctorRecordStatus("");
        const response = await apiFetch(
          `${apiBase}/api/admin/patients/${selectedLabPatientId}/records?source=${encodeURIComponent(recordSourceFilter)}`,
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load patient records.");
        }
        if (!cancelled) {
          setPatientRecords(Array.isArray(data.records) ? data.records : []);
        }
      } catch (error) {
        if (!cancelled) {
          setDoctorRecordStatus(error?.message || "Unable to load patient records.");
          setPatientRecords([]);
        }
      }
    };
    loadPatientRecords();
    return () => {
      cancelled = true;
    };
  }, [apiBase, apiFetch, recordSourceFilter, selectedLabPatientId, showDoctorTools]);

  useEffect(() => {
    if (!showDoctorTools || !planReviewAppointmentId) return;
    let cancelled = false;
    const loadPlanReview = async () => {
      setPlanReviewLoading(true);
      setPlanReviewStatus("");
      try {
        const [planResponse, insightsResponse] = await Promise.all([
          apiFetch(`${apiBase}/api/appointments/${planReviewAppointmentId}/health-plan`),
          apiFetch(`${apiBase}/api/appointments/${planReviewAppointmentId}/report-insights`),
        ]);
        const [planData, insightsData] = await Promise.all([planResponse.json(), insightsResponse.json()]);
        if (!planResponse.ok) {
          throw new Error(planData.error || "Unable to load patient action plan.");
        }
        if (!insightsResponse.ok) {
          throw new Error(insightsData.error || "Unable to load report insights.");
        }
        if (cancelled) return;
        setPlanReviewSavedPlan(planData.plan || null);
        setPlanReviewInsights(insightsData || null);
      } catch (error) {
        if (cancelled) return;
        setPlanReviewSavedPlan(null);
        setPlanReviewInsights(null);
        setPlanReviewStatus(error?.message || "Unable to load patient action plan.");
      } finally {
        if (!cancelled) setPlanReviewLoading(false);
      }
    };
    loadPlanReview();
    return () => {
      cancelled = true;
    };
  }, [apiBase, apiFetch, planReviewAppointmentId, showDoctorTools]);

  useEffect(() => {
    if (!doctorPlanPreview && !planReviewSavedPlan) return;
    const overrideTasks = Array.isArray(planReviewSavedPlan?.doctorOverride?.tasks) && planReviewSavedPlan.doctorOverride.tasks.length
      ? planReviewSavedPlan.doctorOverride.tasks
      : (doctorPlanPreview?.tasks || []).map((task) => ({
          id: task.id,
          label: task.label,
          note: task.note,
          origin: "ai",
          editedByDoctor: false,
        }));
    setPlanReviewForm({
      reviewStatus: planReviewSavedPlan?.planSource === "doctor_adjusted" ? "doctor_adjusted" : "doctor_reviewed",
      doctorNotes: planReviewSavedPlan?.doctorNotes || "",
      reviewTimingNote: planReviewSavedPlan?.doctorOverride?.reviewTimingNote || "",
      tasks: overrideTasks.map((task) => ({
        id: task.id,
        label: task.label || "",
        note: task.note || "",
        origin: task.origin || "ai",
        editedByDoctor: Boolean(task.editedByDoctor),
      })),
    });
  }, [doctorPlanPreview, planReviewSavedPlan]);

  const updatePlanReviewTask = (index, key, value) => {
    setPlanReviewForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task, taskIndex) =>
        taskIndex === index
          ? {
              ...task,
              [key]: value,
              origin: "doctor",
              editedByDoctor: true,
            }
          : task,
      ),
    }));
  };

  const addPlanReviewTask = () => {
    setPlanReviewForm((prev) => ({
      ...prev,
      reviewStatus: "doctor_adjusted",
      tasks: [...prev.tasks, createDoctorTask(prev.tasks.length + 1)].slice(0, 6),
    }));
  };

  const removePlanReviewTask = (index) => {
    setPlanReviewForm((prev) => {
      const nextTasks = prev.tasks.filter((_, taskIndex) => taskIndex !== index);
      return {
        ...prev,
        reviewStatus: "doctor_adjusted",
        tasks: nextTasks.length ? nextTasks : [createDoctorTask(1)],
      };
    });
  };

  const saveDoctorPlanReview = async (mode = "doctor_reviewed") => {
    if (!planReviewAppointmentId) {
      setPlanReviewStatus("Choose an appointment first.");
      return;
    }
    try {
      setPlanReviewStatus("");
      const response = await apiFetch(`${apiBase}/api/appointments/${planReviewAppointmentId}/health-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: mode,
          doctorNotes: planReviewForm.doctorNotes,
          reviewTimingNote: planReviewForm.reviewTimingNote,
          tasks: mode === "doctor_adjusted" ? planReviewForm.tasks : [],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPlanReviewStatus(data.error || "Unable to save doctor plan review.");
        return;
      }
      setPlanReviewSavedPlan((prev) => ({
        ...(prev || {}),
        planSource: data.planSource,
        doctorNotes: data.doctorNotes,
        doctorUpdatedAt: data.doctorUpdatedAt,
        doctorOverride: data.doctorOverride || {},
      }));
      setPlanReviewStatus(mode === "doctor_adjusted" ? "Doctor-adjusted plan saved." : "Plan marked as doctor-reviewed.");
    } catch (error) {
      setPlanReviewStatus("Unable to save doctor plan review.");
    }
  };

  const searchLabPatients = async () => {
    const query = String(labDeskQuery || "").trim();
    setLabDeskStatus("");
    setLabDeskLoading(true);
    try {
      const response = await apiFetch(`${apiBase}/api/admin/patients?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) {
        setLabDeskStatus(data.error || "Unable to search patients.");
        setLabDeskPatients([]);
        return;
      }
      setLabDeskPatients(Array.isArray(data.patients) ? data.patients : []);
      if (!data.patients?.length) {
        setLabDeskStatus("No matching patient found yet. Try phone, email, patient ID, or name.");
      }
    } catch (error) {
      setLabDeskStatus("Unable to search patients right now.");
      setLabDeskPatients([]);
    } finally {
      setLabDeskLoading(false);
    }
  };

  const uploadLabRecordToPatient = async (file, patientId = selectedLabPatientId) => {
    if (!patientId) {
      setLabDeskStatus("Select a patient first.");
      return false;
    }
    if (!file) {
      setLabDeskStatus("Choose a PDF or clear image report first.");
      return false;
    }
    setLabDeskStatus("");
    setLabDeskUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiFetch(`${apiBase}/api/admin/lab-desk/patients/${patientId}/records`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setLabDeskStatus(data.error || "Unable to upload this report to the patient record.");
        return false;
      }
      setLabDeskStatus(data.message || "Lab report added to the patient record.");
      if (labUploadInputRef.current && String(patientId) === String(selectedLabPatientId)) {
        labUploadInputRef.current.value = "";
      }
      const recentResponse = await apiFetch(`${apiBase}/api/admin/lab-desk/uploads`);
      const recentData = await recentResponse.json();
      if (recentResponse.ok) {
        setLabDeskUploads(Array.isArray(recentData.uploads) ? recentData.uploads : []);
      }
    } catch (error) {
      setLabDeskStatus("Unable to upload this report right now.");
      return false;
    } finally {
      setLabDeskUploading(false);
    }
    return true;
  };

  const uploadQueuedLabReports = async (files = []) => {
    if (!selectedLabPatientId) {
      setLabDeskStatus("Select a patient first.");
      return;
    }
    const queueItems = files.map((file, index) => ({
      id: `${Date.now()}_${index}`,
      name: file.name,
      file,
      patientId: selectedLabPatientId,
      patientName: selectedLabPatient?.name || "Patient",
      status: "queued",
      source: "manual",
    }));
    setLabQueue((prev) => [...prev, ...queueItems]);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const queueId = queueItems[index]?.id;
      setLabQueue((prev) => prev.map((item) => (item.id === queueId ? { ...item, status: "uploading" } : item)));
      const ok = await uploadLabRecordToPatient(file);
      if (ok) {
        setLabQueue((prev) => prev.map((item) => (item.id === queueId ? { ...item, status: "done" } : item)));
      } else {
        setLabQueue((prev) => prev.map((item) => (item.id === queueId ? { ...item, status: "failed" } : item)));
      }
    }
  };

  const retryQueuedItem = async (queueId) => {
    const target = labQueue.find((item) => item.id === queueId);
    if (!target?.file) return;
    setLabQueue((prev) => prev.map((item) => (item.id === queueId ? { ...item, status: "uploading" } : item)));
    const ok = await uploadLabRecordToPatient(target.file);
    setLabQueue((prev) =>
      prev.map((item) =>
        item.id === queueId
          ? {
              ...item,
              status: ok ? "done" : "failed",
            }
          : item,
      ),
    );
  };

  const retryFailedUploads = async () => {
    const failed = labQueue.filter((item) => item.status === "failed");
    for (const item of failed) {
      await retryQueuedItem(item.id);
    }
  };

  const createLabPatient = async () => {
    setLabDeskStatus("");
    try {
      const response = await apiFetch(`${apiBase}/api/admin/lab-desk/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(labCreateForm),
      });
      const data = await response.json();
      if (!response.ok) {
        setLabDeskStatus(data.error || "Unable to create a patient from lab desk.");
        return;
      }
      const nextPatient = data.patient || null;
      if (nextPatient) {
        setLabDeskPatients((prev) => [nextPatient, ...prev.filter((item) => String(item.id) !== String(nextPatient.id))]);
        setSelectedLabPatientId(String(nextPatient.id));
      }
      setLabCreateForm({ name: "", phone: "", email: "", abhaNumber: "" });
      setLabDeskStatus("Patient created and ready for lab upload.");
    } catch {
      setLabDeskStatus("Unable to create a patient right now.");
    }
  };

  const runBatchMapping = async () => {
    const rows = parseLabCsvRows(batchCsvText);
    if (!rows.length) {
      setBatchStatus("Paste a CSV with headers like name, phone, email, patientId, or abhaNumber.");
      setBatchMatches([]);
      return;
    }
    setBatchStatus("");
    try {
      const response = await apiFetch(`${apiBase}/api/admin/lab-desk/patient-matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBatchStatus(data.error || "Unable to map this CSV right now.");
        return;
      }
      const paired = pairBatchMatchesWithFiles(Array.isArray(data.results) ? data.results : [], batchFiles);
      setBatchMatches(paired);
      setBatchStatus(paired.some((item) => item.pairedFileName) ? "Batch mapping is ready and files are paired for upload." : "Batch mapping is ready for review.");
    } catch {
      setBatchStatus("Unable to map this CSV right now.");
    }
  };

  const attachBatchFiles = (files = []) => {
    setBatchFiles(files);
    setBatchMatches((prev) => pairBatchMatchesWithFiles(prev, files));
    if (files.length) {
      setBatchStatus(`Attached ${files.length} report file${files.length === 1 ? "" : "s"} for same-session intake.`);
    }
  };

  const uploadBatchMatches = async () => {
    const uploadable = batchMatches.filter((item) => item.status === "matched" && item.patient?.id && item._file);
    if (!uploadable.length) {
      setBatchStatus("Pair at least one matched row with a report file before uploading.");
      return;
    }
    setBatchUploading(true);
    setBatchStatus("");
    for (const item of uploadable) {
      setBatchMatches((prev) =>
        prev.map((entry) =>
          entry.rowIndex === item.rowIndex
            ? {
                ...entry,
                uploadStatus: "uploading",
                uploadMessage: "Uploading now",
              }
            : entry,
        ),
      );
      const ok = await uploadLabRecordToPatient(item._file, item.patient.id);
      setBatchMatches((prev) =>
        prev.map((entry) =>
          entry.rowIndex === item.rowIndex
            ? {
                ...entry,
                uploadStatus: ok ? "done" : "failed",
                uploadMessage: ok ? "Added to patient record" : "Needs retry",
              }
            : entry,
        ),
      );
      setLabQueue((prev) => [
        ...prev,
        {
          id: `batch_${item.rowIndex}_${Date.now()}`,
          name: item.pairedFileName || item._file?.name || buildBatchDisplayName(item.input, item.rowIndex),
          file: ok ? null : item._file,
          patientId: String(item.patient?.id || ""),
          patientName: item.patient?.name || "Patient",
          status: ok ? "done" : "failed",
          source: "batch",
        },
      ]);
    }
    setBatchUploading(false);
    setBatchStatus("Batch intake finished. Matched rows are now reflected in the upload history.");
  };

  const downloadLabUploadLedger = async () => {
    try {
      const response = await apiFetch(`${apiBase}/api/admin/lab-desk/uploads/export`);
      if (!response.ok) {
        setLabDeskStatus("Unable to export the lab upload ledger right now.");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lab-upload-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch {
      setLabDeskStatus("Unable to export the lab upload ledger right now.");
    }
  };

  return (
    <div className="app">
      <main className="doctor-view">
        <section className="panel">
          <h1>{consoleTitle}</h1>
          <p className="panel-sub">{consoleSubtitle}</p>
          {!sessionReady || (authToken && !user) ? (
            <p className="micro">Loading dashboard...</p>
          ) : !user ? (
            <>
              <p className="micro">{labBrandedMode ? "Sign in to continue with the lab operations desk." : t("doctorConsoleSignIn")}</p>
              <form className="auth" onSubmit={handleAuth}>
                <label className="block">
                  {t("email")}
                  <input
                    type="email"
                    required
                    value={authForm.email}
                    onChange={(event) => updateAuthField("email", event.target.value)}
                  />
                </label>
                <label className="block">
                  {t("password")}
                  <input
                    type="password"
                    required
                    value={authForm.password}
                    onChange={(event) => updateAuthField("password", event.target.value)}
                  />
                </label>
                {authError && <p className="error">{authError}</p>}
                <button className="primary" type="submit">
                  {t("signIn")}
                </button>
              </form>
            </>
          ) : !hasOpsAccess ? (
            <>
              <p className="error">{t("doctorConsoleNoAccess")}</p>
              <button className="secondary" type="button" onClick={signOut}>
                {t("navSignOut")}
              </button>
            </>
          ) : (
            <>
              <div className="action-row">
                <button
                  className="secondary"
                  type="button"
                  onClick={async () => {
                    if (!labBrandedMode) {
                      await loadTeleconsults();
                      await loadAppointments();
                      await loadEncounters();
                    }
                    if (!labBrandedMode && user?.id && (user.role === "doctor" || user.role === "admin")) {
                      await loadDoctorSchedule(user.id);
                    }
                  }}
                >
                  Refresh
                </button>
                <button className="ghost" type="button" onClick={signOut}>
                  {t("navSignOut")}
                </button>
              </div>
              {hasLabDeskAccess ? (
                <div className="pass-card" style={{ marginBottom: 16 }}>
                  <h3>Lab desk</h3>
                  <p className="micro">
                    Upload reports from the lab side and send them directly into the patient record, so the patient and doctor flows stay connected automatically.
                  </p>
                  <div className="member-list" style={{ marginBottom: 12 }}>
                    {[
                      { key: "upload", label: "Upload desk" },
                      { key: "batch", label: "Batch mapping" },
                      { key: "recent", label: "Recent uploads" },
                      { key: "analytics", label: "Analytics" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={activeLabTab === tab.key ? "chip active" : "chip"}
                        onClick={() => setActiveLabTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {activeLabTab === "upload" ? (
                    <>
                  <div className="form-row">
                    <label className="block">
                      Find patient
                      <input
                        type="text"
                        value={labDeskQuery}
                        onChange={(event) => setLabDeskQuery(event.target.value)}
                        placeholder="Search by name, phone, email, or patient ID"
                      />
                    </label>
                    <div className="action-row" style={{ alignItems: "flex-end" }}>
                      <button
                        className="secondary"
                        type="button"
                        onClick={searchLabPatients}
                        disabled={labDeskLoading}
                      >
                        {labDeskLoading ? "Searching..." : "Search"}
                      </button>
                    </div>
                  </div>
                  {labDeskPatients.length ? (
                    <div className="member-list" style={{ marginTop: 12 }}>
                      {labDeskPatients.slice(0, 8).map((patient) => (
                        <button
                          key={`lab-patient-${patient.id}`}
                          type="button"
                          className={String(selectedLabPatientId) === String(patient.id) ? "chip active" : "chip"}
                          onClick={() => setSelectedLabPatientId(String(patient.id))}
                        >
                          {patient.name || "Patient"} {patient.patient_uid ? `• ${patient.patient_uid}` : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {selectedLabPatient ? (
                    <div className="history-card" style={{ marginTop: 12 }}>
                      <p className="history-headline">{selectedLabPatient.name || "Patient selected"}</p>
                      <p className="micro">
                        {[selectedLabPatient.patient_uid, selectedLabPatient.phone, selectedLabPatient.email].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                  ) : null}
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <label className="block">
                      Upload report
                      <input
                        ref={labUploadInputRef}
                        type="file"
                        accept="application/pdf,image/*"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          if (files.length) uploadQueuedLabReports(files);
                        }}
                        disabled={!selectedLabPatientId || labDeskUploading}
                      />
                    </label>
                  </div>
                  <div
                    ref={labDropZoneRef}
                    className={`lab-dropzone${isLabDragActive ? " is-active" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!selectedLabPatientId) return;
                      setIsLabDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setIsLabDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsLabDragActive(false);
                      if (!selectedLabPatientId) return;
                      const files = Array.from(event.dataTransfer?.files || []);
                      if (files.length) uploadQueuedLabReports(files);
                    }}
                  >
                    <p className="history-headline">Drop reports here</p>
                    <p className="micro">
                      Drag and drop PDF or image reports here to add them straight into the selected patient record.
                    </p>
                  </div>
                  {labQueue.length ? (
                    <div className="history-list compact-list" style={{ marginTop: 12 }}>
                      {labQueue.map((item) => (
                        <div key={item.id} className="history-card">
                          <p className="history-headline">{item.name}</p>
                          <p className="micro">
                            {item.status === "uploading"
                              ? "Uploading now"
                              : item.status === "done"
                                ? "Added to patient record"
                                : item.status === "failed"
                                  ? "Needs retry"
                                  : "Queued"}
                          </p>
                          {item.status === "failed" && item.file ? (
                            <div className="action-row">
                              <button className="ghost" type="button" onClick={() => retryQueuedItem(item.id)}>
                                Retry
                              </button>
                            </div>
                          ) : null}
                          {item.status === "failed" && !item.file ? (
                            <p className="micro">Reattach this file if you want to retry after a refresh.</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {labQueue.some((item) => item.status === "failed") ? (
                    <div className="action-row" style={{ marginTop: 10 }}>
                      <button className="secondary" type="button" onClick={retryFailedUploads}>
                        Retry failed uploads
                      </button>
                    </div>
                  ) : null}
                  <p className="micro">
                    The uploaded report will appear in the patient’s Reports flow and can feed summaries, plans, and doctor review automatically.
                  </p>
                  {labDeskStatus ? <p className="micro">{labDeskStatus}</p> : null}
                  <div className="history-card" style={{ marginTop: 16 }}>
                    <p className="history-headline">Create patient from lab desk</p>
                    <div className="form-row">
                      <label className="block">
                        Name
                        <input
                          type="text"
                          value={labCreateForm.name}
                          onChange={(event) => setLabCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      </label>
                      <label className="block">
                        Phone
                        <input
                          type="text"
                          value={labCreateForm.phone}
                          onChange={(event) => setLabCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label className="block">
                        Email
                        <input
                          type="email"
                          value={labCreateForm.email}
                          onChange={(event) => setLabCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                        />
                      </label>
                      <label className="block">
                        ABHA number
                        <input
                          type="text"
                          value={labCreateForm.abhaNumber}
                          onChange={(event) => setLabCreateForm((prev) => ({ ...prev, abhaNumber: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="action-row">
                      <button className="secondary" type="button" onClick={createLabPatient}>
                        Create patient
                      </button>
                    </div>
                  </div>
                    </>
                  ) : null}
                  {activeLabTab === "batch" ? (
                    <div className="history-card">
                      <p className="history-headline">CSV batch patient mapping</p>
                      <p className="micro">
                        Paste a CSV with headers like <code>name</code>, <code>phone</code>, <code>email</code>, <code>patientId</code>, or <code>abhaNumber</code>.
                      </p>
                      <label className="block">
                        CSV rows
                        <textarea
                          rows={8}
                          value={batchCsvText}
                          onChange={(event) => setBatchCsvText(event.target.value)}
                          placeholder={"name,phone,email,patientId,abhaNumber\nRiya Patel,9876543210,,,"}
                        />
                      </label>
                      <div className="action-row">
                        <button className="secondary" type="button" onClick={runBatchMapping}>
                          Map CSV
                        </button>
                        <button className="ghost" type="button" onClick={() => batchFileInputRef.current?.click()}>
                          Attach report files
                        </button>
                        <button className="primary" type="button" onClick={uploadBatchMatches} disabled={batchUploading}>
                          {batchUploading ? "Uploading..." : "Upload matched rows"}
                        </button>
                      </div>
                      <input
                        ref={batchFileInputRef}
                        type="file"
                        accept="application/pdf,image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={(event) => attachBatchFiles(Array.from(event.target.files || []))}
                      />
                      {batchStatus ? <p className="micro">{batchStatus}</p> : null}
                      {batchFiles.length ? (
                        <p className="micro">
                          {batchFiles.length} file{batchFiles.length === 1 ? "" : "s"} attached for pairing. File objects stay available only in this browser session.
                        </p>
                      ) : null}
                      {batchMatches.length ? (
                        <div className="history-list compact-list" style={{ marginTop: 12 }}>
                          {batchMatches.map((item) => (
                            <div key={`batch-${item.rowIndex}`} className="history-card">
                              <p className="history-headline">{buildBatchDisplayName(item.input, item.rowIndex)}</p>
                              <p className="micro">
                                {item.status === "matched"
                                  ? `${item.patient?.name || "Patient"} • ${item.patient?.patientUid || "ID pending"}`
                                  : "No patient match found yet"}
                              </p>
                              <p className="micro">
                                {item.pairedFileName ? `Paired file: ${item.pairedFileName}` : "No report file paired yet"}
                              </p>
                              {item.uploadMessage ? <p className="micro">{item.uploadMessage}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {activeLabTab === "recent" && labDeskUploads.length ? (
                    <>
                    <div className="action-row" style={{ marginTop: 12 }}>
                      <button className="secondary" type="button" onClick={downloadLabUploadLedger}>
                        Export ledger
                      </button>
                    </div>
                    <div className="history-list compact-list" style={{ marginTop: 16 }}>
                      {labDeskUploads.slice(0, 8).map((upload) => (
                        <div key={`lab-upload-${upload.id}`} className="history-card">
                          <p className="history-headline">{upload.displayLabel || upload.patient?.name || "Patient"}</p>
                          <p className="micro">
                            {(upload.patient?.name || "Patient")}{upload.patient?.patientUid ? ` • ${upload.patient.patientUid}` : ""}
                            {upload.extraction?.detectedLabSource ? ` • ${upload.extraction.detectedLabSource}` : ""}
                          </p>
                          <p className="micro">
                            {upload.sourceLabel || "Lab upload"} • {upload.extraction?.qualityGate === "trusted" ? "Ready for review" : "Review-aware upload"}
                          </p>
                          <p className="micro">
                            Uploaded by {upload.uploadedBy?.name || upload.uploadedBy?.email || "staff user"}
                          </p>
                        </div>
                      ))}
                    </div>
                    </>
                  ) : activeLabTab === "recent" ? (
                    <>
                      <div className="action-row" style={{ marginTop: 12 }}>
                        <button className="secondary" type="button" onClick={downloadLabUploadLedger}>
                          Export ledger
                        </button>
                      </div>
                      <p className="micro">No recent lab uploads yet.</p>
                    </>
                  ) : null}
                  {activeLabTab === "analytics" ? (
                    <div className="history-card">
                      <p className="history-headline">Lab operations analytics</p>
                      <p className="micro">
                        Volume, failures, and turnaround stay visible here so the intake desk can spot friction early.
                      </p>
                      {labAnalyticsLoading ? <p className="micro">Loading analytics...</p> : null}
                      {labAnalyticsStatus ? <p className="micro">{labAnalyticsStatus}</p> : null}
                      {labAnalytics ? (
                        <>
                          <div className="history-list compact-list" style={{ marginTop: 12 }}>
                            {[
                              { label: "Total uploads", value: labAnalytics.overview?.totalUploads ?? 0 },
                              { label: "Trusted", value: labAnalytics.overview?.trustedUploads ?? 0 },
                              { label: "Review-aware", value: labAnalytics.overview?.reviewUploads ?? 0 },
                              { label: "Failed", value: labAnalytics.overview?.failedUploads ?? 0 },
                              {
                                label: "Avg turnaround",
                                value: `${Math.round(labAnalytics.overview?.avgTurnaroundMinutes ?? 0)} min`,
                              },
                            ].map((item) => (
                              <div key={item.label} className="history-card">
                                <p className="history-headline">{item.label}</p>
                                <p className="micro">{item.value}</p>
                              </div>
                            ))}
                          </div>
                          {Array.isArray(labAnalytics.daily) && labAnalytics.daily.length ? (
                            <div className="history-list compact-list" style={{ marginTop: 12 }}>
                              {labAnalytics.daily.map((row) => (
                                <div key={`analytics-${row.day}`} className="history-card">
                                  <p className="history-headline">{row.day}</p>
                                  <p className="micro">
                                    {row.total} uploads • {row.trusted} trusted • {row.failed} failed
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showDoctorTools && (
                <>
              <div className="pass-card" style={{ marginBottom: 16 }}>
                <h3>Doctor availability</h3>
                <p className="micro">
                  Define OPD timings and slot length used for appointment booking.
                </p>
                {scheduleForm.map((slot, index) => (
                  <div className="form-row" key={`schedule-${index}`}>
                    <label>
                      Day
                      <select
                        value={slot.weekday}
                        onChange={(event) => updateScheduleRow(index, "weekday", event.target.value)}
                      >
                        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                          <option key={day} value={day}>
                            {weekdayLabel(day)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Start
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(event) => updateScheduleRow(index, "startTime", event.target.value)}
                      />
                    </label>
                    <label>
                      End
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(event) => updateScheduleRow(index, "endTime", event.target.value)}
                      />
                    </label>
                    <label>
                      Slot (min)
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={slot.slotMinutes}
                        onChange={(event) => updateScheduleRow(index, "slotMinutes", event.target.value)}
                      />
                    </label>
                    <button className="ghost" type="button" onClick={() => removeScheduleRow(index)}>
                      Remove
                    </button>
                  </div>
                ))}
                <div className="action-row">
                  <button className="secondary" type="button" onClick={addScheduleRow}>
                    Add day
                  </button>
                  <button className="primary" type="button" onClick={saveDoctorSchedule}>
                    Save schedule
                  </button>
                </div>
                {scheduleStatus && <p className="micro">{scheduleStatus}</p>}
              </div>
              <div className="pass-card" style={{ marginBottom: 16 }}>
                <h3>Action plan review</h3>
                <p className="micro">
                  The patient app can run on its own. Use this only when you want to review or adjust the AI draft.
                </p>
                <div className="form-row">
                  <label>
                    Appointment
                    <select
                      value={planReviewAppointmentId}
                      onChange={(event) => setPlanReviewAppointmentId(event.target.value)}
                    >
                      <option value="">Select patient appointment</option>
                      {appointments.map((appointment) => (
                        <option key={`plan-review-${appointment.id}`} value={appointment.id}>
                          #{appointment.id} • {appointment.patient_name || appointment.patientName || "Patient"} • {appointment.member_name || "Self"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {selectedPlanReviewAppointment ? (
                  <p className="micro">
                    Reviewing {selectedPlanReviewAppointment.patient_name || selectedPlanReviewAppointment.patientName || "patient"}
                    {selectedPlanReviewAppointment.member_name ? ` (${selectedPlanReviewAppointment.member_name})` : ""}.
                  </p>
                ) : null}
                {planReviewLoading ? <p className="micro">Loading patient action plan...</p> : null}
                {doctorPlanPreview ? (
                  <>
                    <div className="history-card" style={{ marginTop: 12 }}>
                      <p className="history-headline">{doctorPlanPreview.title}</p>
                      <p className="micro">{doctorPlanPreview.subtitle}</p>
                      <p className="micro">
                        Current status: {planReviewSavedPlan?.planSource === "doctor_adjusted" ? "Doctor adjusted" : planReviewSavedPlan?.planSource === "doctor_reviewed" ? "Doctor reviewed" : "AI draft only"}
                      </p>
                    </div>
                    <div className="history-list compact-list" style={{ marginTop: 12 }}>
                      {doctorPlanTasks.map((task, index) => (
                        <div key={task.id || `doctor-task-${index}`} className="history-card">
                          <div className="action-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                            <p className="history-headline">Task {index + 1}</p>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => removePlanReviewTask(index)}
                              disabled={doctorPlanTasks.length <= 1}
                            >
                              Remove
                            </button>
                          </div>
                          <label className="block">
                            Task
                            <input
                              type="text"
                              value={task.label}
                              onChange={(event) => updatePlanReviewTask(index, "label", event.target.value)}
                            />
                          </label>
                          <label className="block">
                            Note
                            <input
                              type="text"
                              value={task.note || ""}
                              onChange={(event) => updatePlanReviewTask(index, "note", event.target.value)}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="action-row">
                      <button
                        className="ghost"
                        type="button"
                        onClick={addPlanReviewTask}
                        disabled={doctorPlanTasks.length >= 6}
                      >
                        Add doctor task
                      </button>
                    </div>
                    <label className="block">
                      Doctor note
                      <textarea
                        rows={3}
                        value={planReviewForm.doctorNotes}
                        onChange={(event) => setPlanReviewForm((prev) => ({ ...prev, doctorNotes: event.target.value }))}
                        placeholder="Example: Focus more on post-meal walking. Do not self-adjust medicines."
                      />
                    </label>
                    <label className="block">
                      Review timing note
                      <input
                        type="text"
                        value={planReviewForm.reviewTimingNote}
                        onChange={(event) => setPlanReviewForm((prev) => ({ ...prev, reviewTimingNote: event.target.value }))}
                        placeholder="Example: Repeat report in 6 to 8 weeks or earlier if symptoms worsen."
                      />
                    </label>
                    <div className="action-row">
                      <button className="secondary" type="button" onClick={() => saveDoctorPlanReview("doctor_reviewed")}>
                        Approve as reviewed
                      </button>
                      <button className="primary" type="button" onClick={() => saveDoctorPlanReview("doctor_adjusted")}>
                        Save adjusted plan
                      </button>
                    </div>
                  </>
                ) : null}
                {planReviewStatus ? <p className="micro">{planReviewStatus}</p> : null}
              </div>
              {teleLoading ? (
                <p className="micro">{t("teleLoading")}</p>
              ) : teleconsults.length === 0 ? (
                <p className="micro">{t("teleEmpty")}</p>
              ) : (
                <>
                  <div className="member-list">
                    {teleconsults.map((consult) => (
                      <button
                        key={consult.id}
                        type="button"
                        className={consult.id === activeConsultId ? "chip active" : "chip"}
                        onClick={() => setActiveConsultId(consult.id)}
                      >
                        #{consult.id} • {consult.patientName || "Patient"} •{" "}
                        {teleStatusLabel(consult.status)}
                      </button>
                    ))}
                  </div>
                  {activeConsult && (
                    <div className="pass-card consult-card">
                      <h3>
                        {activeConsult.patientName || "-"}{" "}
                        {activeConsult.memberName ? `(${activeConsult.memberName})` : ""}
                      </h3>
                      <p className="micro">
                        {activeConsult.patientEmail || "-"} • {activeConsult.phone || "No phone"}
                      </p>
                      <p className="micro">{activeConsult.concern}</p>
                      <p className="micro">
                        Requested: {new Date(activeConsult.createdAt).toLocaleString()}
                      </p>
                      <form className="form" onSubmit={updateConsultStatus}>
                        <div className="form-row">
                          <label>
                            {t("teleStatus")}
                            <select
                              value={doctorConsoleForm.status}
                              onChange={(event) =>
                                setDoctorConsoleForm((prev) => ({
                                  ...prev,
                                  status: event.target.value,
                                }))
                              }
                            >
                              <option value="requested">{t("teleStatusRequested")}</option>
                              <option value="scheduled">{t("teleStatusScheduled")}</option>
                              <option value="in_progress">{t("teleStatusInProgress")}</option>
                              <option value="completed">{t("teleStatusCompleted")}</option>
                              <option value="cancelled">{t("teleStatusCancelled")}</option>
                            </select>
                          </label>
                          <label>
                            {t("doctorConsoleMeetingUrl")}
                            <input
                              type="url"
                              value={doctorConsoleForm.meetingUrl}
                              placeholder="https://meet.google.com/..."
                              onChange={(event) =>
                                setDoctorConsoleForm((prev) => ({
                                  ...prev,
                                  meetingUrl: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <button className="primary" type="submit">
                          {t("doctorConsoleSave")}
                        </button>
                      </form>
                      {doctorConsoleStatus && <p className="micro">{doctorConsoleStatus}</p>}
                      <div className="consult-thread">
                        {consultMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`chat-msg ${msg.senderRole === "doctor" ? "bot" : "user"}`}
                          >
                            <p className="micro">{new Date(msg.createdAt).toLocaleString()}</p>
                            <p>{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <hr />
              <h2>{t("doctorChartTitle")}</h2>
              <form className="form" onSubmit={createEncounterFromDoctor}>
                <div className="form-row">
                  <label>
                    Appointment
                    <select
                      value={doctorChartForm.appointmentId}
                      onChange={(event) =>
                        setDoctorChartForm((prev) => ({
                          ...prev,
                          appointmentId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select appointment</option>
                      {appointments.map((appointment) => (
                        <option key={appointment.id} value={appointment.id}>
                          #{appointment.id} • {appointment.patient_name || appointment.patientName || "Patient"} •{" "}
                          {appointment.department_name || appointment.department || "Department"} •{" "}
                          {new Date(appointment.scheduled_at).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  {t("chiefComplaint")}
                  <textarea
                    rows={2}
                    value={doctorChartForm.chiefComplaint}
                    onChange={(event) =>
                      setDoctorChartForm((prev) => ({
                        ...prev,
                        chiefComplaint: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block">
                  {t("findings")}
                  <textarea
                    rows={2}
                    value={doctorChartForm.findings}
                    onChange={(event) =>
                      setDoctorChartForm((prev) => ({
                        ...prev,
                        findings: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="form-row">
                  <label className="block">
                    {t("diagnosisText")}
                    <input
                      type="text"
                      value={doctorChartForm.diagnosis}
                      onChange={(event) =>
                        setDoctorChartForm((prev) => ({
                          ...prev,
                          diagnosis: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="block">
                  {t("encounterVitals")}
                  <textarea
                    rows={2}
                    placeholder="BP: 152/70, Pulse: 84, Temp: 99F"
                    value={doctorChartForm.vitals}
                    onChange={(event) =>
                      setDoctorChartForm((prev) => ({ ...prev, vitals: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  {t("planText")}
                  <textarea
                    rows={2}
                    value={doctorChartForm.planText}
                    onChange={(event) =>
                      setDoctorChartForm((prev) => ({ ...prev, planText: event.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("followupDate")}
                  <input
                    type="date"
                    value={doctorChartForm.followupDate}
                    onChange={(event) =>
                      setDoctorChartForm((prev) => ({
                        ...prev,
                        followupDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <button className="primary" type="submit">
                  {t("doctorChartCreate")}
                </button>
              </form>
              <div className="member-list">
                {encounters.map((encounter) => (
                  <button
                    key={encounter.id}
                    type="button"
                    className={encounter.id === activeEncounterId ? "chip active" : "chip"}
                    onClick={() => setActiveEncounterId(encounter.id)}
                  >
                    #{encounter.id} • {encounter.status}
                  </button>
                ))}
              </div>
              {activeEncounterId && (
                <>
                  <form className="form" onSubmit={addDoctorNote}>
                    <label className="block">
                      {t("noteText")}
                      <textarea
                        rows={2}
                        value={noteForm.note}
                        onChange={(event) =>
                          setNoteForm((prev) => ({ ...prev, note: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      {t("signature")}
                      <input
                        type="text"
                        value={noteForm.signature}
                        onChange={(event) =>
                          setNoteForm((prev) => ({ ...prev, signature: event.target.value }))
                        }
                      />
                    </label>
                    <button className="secondary" type="submit">
                      {t("addNote")}
                    </button>
                  </form>
                  <form className="form" onSubmit={addPrescription}>
                    <label className="block">
                      Instructions
                      <textarea
                        rows={2}
                        value={prescriptionForm.instructions}
                        onChange={(event) =>
                          setPrescriptionForm((prev) => ({
                            ...prev,
                            instructions: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="block">
                      {t("medicines")} (one per line: medicine|dose|frequency|duration)
                      <textarea
                        rows={3}
                        value={prescriptionForm.itemsText}
                        onChange={(event) =>
                          setPrescriptionForm((prev) => ({
                            ...prev,
                            itemsText: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button className="secondary" type="submit">
                      {t("addPrescription")}
                    </button>
                  </form>
                  <form className="form" onSubmit={addOrder}>
                    <div className="form-row">
                      <label>
                        {t("orderType")}
                        <select
                          value={orderForm.orderType}
                          onChange={(event) =>
                            setOrderForm((prev) => ({
                              ...prev,
                              orderType: event.target.value,
                            }))
                          }
                        >
                          <option value="lab">lab</option>
                          <option value="radiology">radiology</option>
                          <option value="pharmacy">pharmacy</option>
                          <option value="procedure">procedure</option>
                        </select>
                      </label>
                      <label>
                        {t("orderItem")}
                        <input
                          type="text"
                          value={orderForm.itemName}
                          onChange={(event) =>
                            setOrderForm((prev) => ({ ...prev, itemName: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        {t("destination")}
                        <input
                          type="text"
                          value={orderForm.destination}
                          onChange={(event) =>
                            setOrderForm((prev) => ({
                              ...prev,
                              destination: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Notes
                        <input
                          type="text"
                          value={orderForm.notes}
                          onChange={(event) =>
                            setOrderForm((prev) => ({ ...prev, notes: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <button className="secondary" type="submit">
                      {t("addOrder")}
                    </button>
                  </form>
                  {doctorChartStatus && <p className="micro">{doctorChartStatus}</p>}
                  <div className="pass-card" style={{ marginTop: 16 }}>
                    <h3>Patient record uploads</h3>
                    <p className="micro">Filter records by upload source so doctor review can quickly separate patient uploads from lab-side uploads.</p>
                    <div className="form-row">
                      <label>
                        Upload source
                        <select value={recordSourceFilter} onChange={(event) => setRecordSourceFilter(event.target.value)}>
                          <option value="all">All uploads</option>
                          <option value="lab_upload">Lab uploads</option>
                          <option value="patient_upload">Patient uploads</option>
                        </select>
                      </label>
                    </div>
                    {doctorRecordStatus ? <p className="micro">{doctorRecordStatus}</p> : null}
                    {selectedLabPatientId ? (
                      patientRecords.length ? (
                        <div className="history-list compact-list">
                          {patientRecords.map((record) => (
                            <div key={`doctor-record-${record.id}`} className="history-card">
                              <p className="history-headline">{record.display_label || record.original_file_name || record.file_name}</p>
                              <p className="micro">
                                {(record.source_label || "Upload").toString()} • {new Date(record.created_at).toLocaleDateString()}
                              </p>
                              <p className="micro">
                                Uploaded by {record.uploaded_by_name || record.uploaded_by_email || "unknown staff"}
                              </p>
                              <div className="action-row">
                                <a className="secondary" href={`${apiBase}/api/admin/records/${record.id}/download`} target="_blank" rel="noreferrer">
                                  Download
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="micro">No records found for this source filter yet.</p>
                      )
                    ) : (
                      <p className="micro">Choose a patient in Lab desk to inspect upload sources.</p>
                    )}
                  </div>
                </> )}
                </> )}
              {!showDoctorTools ? (
                <p className="micro">Lab desk access is ready. Doctor-only review tools stay hidden for front-desk users.</p>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
