import { useEffect, useMemo, useState } from "react";

const LAB_SORT_OPTIONS = [
  { key: "cheapest", label: "Cheapest" },
  { key: "fastest", label: "Fastest" },
  { key: "nearest", label: "Nearest" },
];

const PHARMACY_SORT_OPTIONS = [
  { key: "fastest", label: "Fastest" },
  { key: "cheapest", label: "Lowest fee" },
  { key: "nearest", label: "Nearest" },
];

const REQUEST_VIEW_OPTIONS = [
  { key: "future", label: "Upcoming" },
  { key: "present", label: "In progress" },
  { key: "past", label: "Past" },
];

const PHARMACY_SERVICE_MENU = [
  {
    key: "prescription_home",
    serviceName: "Prescription fulfilment",
    fulfillmentMode: "home_delivery",
    requestLabel: "Add home delivery",
    description: "Partner delivers medicines to your home.",
  },
  {
    key: "monthly_refill",
    serviceName: "Monthly refill basket",
    fulfillmentMode: "home_delivery",
    requestLabel: "Add refill basket",
    description: "Set up a recurring refill request.",
  },
  {
    key: "pickup_counter",
    serviceName: "Prescription pickup",
    fulfillmentMode: "pickup",
    requestLabel: "Add pickup",
    description: "Reserve and collect from the pharmacy counter.",
  },
];

function normalizeRetestKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function inferRetestClusterFromText(...values) {
  const text = values.filter(Boolean).map((value) => String(value).toLowerCase()).join(" ");
  if (!text) return "";
  if (/(hba1c|estimated average glucose|fasting glucose|postprandial glucose|\bglucose\b|\bfbs\b|\bppbs\b|\brbs\b|sugar)/i.test(text)) return "sugar_metabolic";
  if (/(mcv|mchc|\bmch\b|hemoglobin|haemoglobin|\brbc\b|red-cell|cbc)/i.test(text)) return "cbc_red_cell";
  if (/(serum ige|\bige\b|eosinophils|allergy|immune|sinus|breathing|skin)/i.test(text)) return "allergy_immune";
  if (/(bmi|weight|metabolic)/i.test(text)) return "weight_metabolic";
  return "";
}

function mapFocusKeyToRetestCluster(focusKey = "") {
  const normalized = normalizeRetestKey(focusKey);
  if (normalized === "diabetes") return "sugar_metabolic";
  if (normalized === "anemia") return "cbc_red_cell";
  if (normalized === "allergy") return "allergy_immune";
  if (normalized === "anthropometry" || normalized === "lipid") return "weight_metabolic";
  return "";
}

function getRetestClusterLabel(cluster = "") {
  if (cluster === "sugar_metabolic") return "Sugar-related follow-up";
  if (cluster === "cbc_red_cell") return "CBC / red-cell follow-up";
  if (cluster === "allergy_immune") return "Allergy/immune follow-up";
  if (cluster === "weight_metabolic") return "Weight/metabolic context";
  return "Follow-up comparison";
}

function getRetestHistoryCount(reportInsights, cluster = "") {
  const metricKeysByCluster = {
    sugar_metabolic: ["hba1c", "estimated_average_glucose", "fbs", "ppbs", "rbs"],
    cbc_red_cell: ["hemoglobin", "mcv", "mch", "mchc", "rbc_count"],
    allergy_immune: ["serum_ige", "ige", "eosinophils"],
    weight_metabolic: ["bmi", "weight", "hba1c", "estimated_average_glucose"],
  };
  const allowed = new Set(metricKeysByCluster[cluster] || []);
  const trends = Array.isArray(reportInsights?.trends) ? reportInsights.trends : [];
  const matching = trends.find((trend) => allowed.has(normalizeRetestKey(trend.metricKey)));
  if (!matching || !Array.isArray(matching.points)) return 0;
  return matching.points.filter((point) => Number.isFinite(Number(point.value))).length;
}

function formatDaysSince(days) {
  if (!Number.isFinite(days) || days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function getLatestReportAgeDays(records = []) {
  const latestDate = records?.[0]?.created_at ? new Date(records[0].created_at) : null;
  if (!latestDate || Number.isNaN(latestDate.getTime())) return null;
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - latestDate.getTime()) / 86400000));
}

// Future AI integration point for contextual retest reasoning.
function generateRetestGuidance(reportInsights, records = []) {
  const guidedPriorities = Array.isArray(reportInsights?.priorities)
    ? reportInsights.priorities
    : Array.isArray(reportInsights?.guidedFollowUp?.priorities)
      ? reportInsights.guidedFollowUp.priorities
      : [];
  const abnormalIssues = Array.isArray(reportInsights?.healthIssues?.abnormal) ? reportInsights.healthIssues.abnormal : [];
  const lowConfidence =
    reportInsights?.overview?.confidenceLevel === "low" ||
    reportInsights?.guidedFollowUp?.overview?.confidenceLevel === "low" ||
    reportInsights?.carePlan?.fallbackReason === "low_confidence";
  const clusterScores = new Map();
  const addClusterScore = (cluster, score, finding) => {
    if (!cluster) return;
    if (!clusterScores.has(cluster)) {
      clusterScores.set(cluster, { cluster, score: 0, findings: [], guidedCount: 0 });
    }
    const bucket = clusterScores.get(cluster);
    bucket.score += score;
    if (finding) bucket.findings.push(finding);
    return bucket;
  };

  guidedPriorities.forEach((item, index) => {
    const cluster =
      inferRetestClusterFromText(item?.conditionArea, item?.condition, item?.findingLabel, item?.finding, item?.reason) ||
      mapFocusKeyToRetestCluster(item?.focusKey);
    const attentionText = String(item?.attentionLevel || item?.followUpImportance || item?.severity || "").toLowerCase();
    const weight = attentionText.includes("prompt") ? 10 : attentionText.includes("timely") ? 8 : attentionText.includes("discuss") ? 5 : 3;
    const bucket = addClusterScore(cluster, 100 - index * 12 + weight, item?.findingLabel || item?.condition);
    if (bucket) bucket.guidedCount += 1;
  });

  abnormalIssues.forEach((issue) => {
    const cluster =
      mapFocusKeyToRetestCluster(issue?.focusKey) ||
      inferRetestClusterFromText(issue?.parameter, issue?.focusLabel, issue?.summary);
    addClusterScore(cluster, 18, issue?.parameter);
  });

  const rankedClusters = Array.from(clusterScores.values())
    .map((item) => ({
      ...item,
      findings: item.findings.filter((value, index, list) => value && list.findIndex((candidate) => candidate === value) === index),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.guidedCount !== a.guidedCount) return b.guidedCount - a.guidedCount;
      return b.findings.length - a.findings.length;
    });

  const primaryCluster = !lowConfidence && rankedClusters.length ? rankedClusters[0].cluster : "";
  const historyCount = getRetestHistoryCount(reportInsights, primaryCluster);
  const latestReportAgeDays = getLatestReportAgeDays(records);
  const continuityAgeLine = Number.isFinite(latestReportAgeDays)
    ? `${getRetestClusterLabel(primaryCluster || "followup")} was last updated ${formatDaysSince(latestReportAgeDays)}.`
    : "Future reports may help clarify whether this pattern stays stable.";

  if (!primaryCluster) {
    return {
      cluster: "fallback",
      title: "Retest guidance",
      whyRetestMatters: "Retest timing often depends on which findings were most meaningful, so this view stays cautious until the report context is clearer.",
      suggestedTiming: "Repeat timing often depends on symptoms, clinician advice, and prior trends.",
      urgencyLevel: "depends_on_clinician",
      confidenceLevel: lowConfidence ? "low" : "moderate",
      retestUsefulNow: lowConfidence ? "low_confidence" : "depends_on_clinician",
      suggestedMarkers: [],
      relatedFindings: [],
      continuityLine: continuityAgeLine,
      usefulNowLabel: lowConfidence ? "Low confidence" : "Depends on clinician",
      usefulNowDetail: lowConfidence
        ? "The report may need manual review before retesting decisions become more useful."
        : "A clinician may prefer a different retest interval depending on symptoms or treatment.",
    };
  }

  const plans = {
    sugar_metabolic: {
      title: "Sugar-related follow-up timing",
      whyRetestMatters: "This retest supports sugar-related follow-up continuity and may help compare whether the current pattern is staying similar or changing.",
      suggestedTiming: "HbA1c trends are usually more meaningful over longer intervals. Often reviewed over weeks to months depending on context.",
      suggestedMarkers: ["HbA1c", "Glucose", "Estimated Average Glucose"],
      relatedFindings: rankedClusters[0]?.findings || [],
      usefulNow: latestReportAgeDays == null ? "depends_on_clinician" : latestReportAgeDays < 28 ? "wait_for_more_time" : latestReportAgeDays < 84 ? "depends_on_clinician" : "true",
      usefulNowDetail: latestReportAgeDays == null
        ? "If your clinician advised repeat testing, keeping prior reports ready may help."
        : latestReportAgeDays < 28
          ? "Enough time may not have passed yet for a meaningful comparison."
          : latestReportAgeDays < 84
            ? "Your clinician may prefer a different retest interval depending on symptoms or treatment."
            : "Future sugar-related readings may help compare whether this pattern stays stable.",
    },
    cbc_red_cell: {
      title: "CBC follow-up timing",
      whyRetestMatters: "Repeat CBC comparison may help clarify whether these findings are temporary or repeated.",
      suggestedTiming: "CBC follow-up timing often depends on symptoms, clinician advice, and whether older CBC results are available for comparison.",
      suggestedMarkers: ["CBC", "Hemoglobin", "MCV", "MCH", "MCHC"],
      relatedFindings: rankedClusters[0]?.findings || [],
      usefulNow: latestReportAgeDays == null ? "depends_on_clinician" : latestReportAgeDays < 10 ? "wait_for_more_time" : latestReportAgeDays < 42 ? "depends_on_clinician" : "true",
      usefulNowDetail: latestReportAgeDays == null
        ? "Context and symptoms often matter more than one isolated reading."
        : latestReportAgeDays < 10
          ? "Retesting too early may not always improve clarity."
          : latestReportAgeDays < 42
            ? "Context and symptoms often matter more than one isolated reading."
            : "A repeat CBC comparison may be more useful once enough time has passed.",
    },
    allergy_immune: {
      title: "Allergy/immune follow-up timing",
      whyRetestMatters: "IgE interpretation often depends on symptoms, allergy history, or repeated patterns rather than one isolated number.",
      suggestedTiming: "Repeat timing often depends on symptom context. Repeat testing may not always be useful without allergy, breathing, skin, or sinus history.",
      suggestedMarkers: ["Serum IgE", "Eosinophils"],
      relatedFindings: rankedClusters[0]?.findings || [],
      usefulNow: lowConfidence ? "low_confidence" : "depends_on_clinician",
      usefulNowDetail: lowConfidence
        ? "The current report may need clearer extraction before stronger retest guidance."
        : "Repeat testing may not always be useful without symptom context.",
    },
    weight_metabolic: {
      title: "Weight/metabolic follow-up timing",
      whyRetestMatters: "Weight and metabolic context are usually interpreted alongside other markers over time.",
      suggestedTiming: "Future comparison is often more useful when weight or BMI is reviewed together with sugar or metabolic markers over time.",
      suggestedMarkers: ["BMI", "Weight"],
      relatedFindings: rankedClusters[0]?.findings || [],
      usefulNow: latestReportAgeDays == null ? "depends_on_clinician" : latestReportAgeDays < 21 ? "wait_for_more_time" : "depends_on_clinician",
      usefulNowDetail: latestReportAgeDays == null
        ? "Your clinician may prefer a different retest interval depending on symptoms or treatment."
        : latestReportAgeDays < 21
          ? "More time between reports may make the comparison more meaningful."
          : "Weight and metabolic context are usually interpreted alongside other markers over time.",
    },
  };

  const selected = plans[primaryCluster];
  const usefulNowLabelMap = {
    true: "Useful now",
    wait_for_more_time: "Wait for more time",
    depends_on_clinician: "Depends on clinician",
    low_confidence: "Low confidence",
  };

  return {
    cluster: primaryCluster,
    title: selected.title,
    whyRetestMatters: selected.whyRetestMatters,
    suggestedTiming: selected.suggestedTiming,
    urgencyLevel: selected.usefulNow === "true" ? "routine_review" : "contextual",
    confidenceLevel: lowConfidence ? "low" : historyCount > 1 ? "moderate" : "moderate",
    retestUsefulNow: selected.usefulNow,
    suggestedMarkers: selected.suggestedMarkers,
    relatedFindings: selected.relatedFindings,
    continuityLine: historyCount > 1
      ? `This would become your ${historyCount} saved comparison for this follow-up area.`
      : continuityAgeLine,
    usefulNowLabel: usefulNowLabelMap[selected.usefulNow] || "Depends on clinician",
    usefulNowDetail: selected.usefulNowDetail,
  };
}

function getLabPrice(lab) {
  return lab.startingPrice;
}

function formatMarketplacePrice(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `Rs ${amount}` : "Confirm price";
}

function getRequestGroups(requests, requestView) {
  return requests.filter((item) => {
    const status = String(item.status || "requested").toLowerCase();
    if (requestView === "future") return ["requested", "accepted", "scheduled"].includes(status);
    if (requestView === "present") {
      return ["processing", "sample_collected", "out_for_delivery", "ready_for_pickup", "in_progress"].includes(status);
    }
    return ["completed", "fulfilled", "cancelled", "rejected", "unavailable"].includes(status);
  });
}

function buildPharmacyMenu(partner) {
  return PHARMACY_SERVICE_MENU.filter((item) => {
    if (item.fulfillmentMode === "home_delivery") return partner.homeDeliveryAvailable;
    if (item.fulfillmentMode === "pickup") return partner.pickupAvailable;
    return true;
  }).map((item) => ({
    ...item,
    id: `${partner.id}-${item.key}`,
    price: item.fulfillmentMode === "home_delivery" ? Number(partner.deliveryFee || 0) : 0,
  }));
}

function buildPartnerBadges(item, isLabs, mode, sortKey) {
  const badges = [];
  if (sortKey === "cheapest") badges.push("Best value");
  if (sortKey === "fastest") badges.push("Fastest");
  if (sortKey === "nearest") badges.push("Nearest");
  if (!isLabs && item.homeDeliveryAvailable) badges.push("Delivery");
  if (!isLabs && item.pickupAvailable) badges.push("Pickup");
  return badges.slice(0, 3);
}

function getLabPrimaryActionLabel(service) {
  return service.homeCollectionAvailable ? "Save option" : "Not available";
}

function getPartnerOpenLabel(isLabs) {
  return isLabs ? "View" : "Open";
}

function ResultRow({ item, isLabs, mode, sortKey, selected, onSelect, onClose, formatFulfillmentTime }) {
  const price = isLabs ? getLabPrice(item) : item.deliveryFee;
  const badges = buildPartnerBadges(item, isLabs, mode, sortKey);

  return (
    <div className={`marketplace-result-row${selected ? " is-selected" : ""}`}>
      <button type="button" className="marketplace-result-main-button" onClick={onSelect}>
        <div className="marketplace-result-main">
          <div className="marketplace-result-head">
            <div>
              <p className="marketplace-result-name">{item.partnerName}</p>
              <p className="marketplace-result-meta">
                {item.areaLabel || "Nearby"} • {item.distanceKm} km • {formatFulfillmentTime(item.etaMinutes)}
              </p>
            </div>
            {!isLabs ? <div className="marketplace-result-price">{formatMarketplacePrice(price)}</div> : null}
          </div>
          {!isLabs && badges.length ? (
            <div className="marketplace-badge-row compact">
              {badges.map((badge) => (
                <span key={`${item.id}-${badge}`} className="marketplace-badge">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>
      <div className="marketplace-result-actions">
        {selected ? (
          <span className="marketplace-result-cta">Selected</span>
        ) : (
          <button type="button" className="marketplace-result-open" onClick={onSelect}>
            {getPartnerOpenLabel(isLabs)}
          </button>
        )}
        {selected ? (
          <button type="button" className="marketplace-result-close" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ServiceCard({
  title,
  subtitle,
  priceLabel,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  detailNote,
}) {
  const primaryDisabled = !onPrimary;
  return (
    <article className="marketplace-service-tile">
      <div className="marketplace-service-header">
        <div className="marketplace-service-copy">
          <h4>{title}</h4>
          {subtitle ? <p className="micro">{subtitle}</p> : null}
        </div>
        <div className="marketplace-service-price-pill">{priceLabel}</div>
      </div>
      {detailNote ? <p className="marketplace-service-note">{detailNote}</p> : null}
      <div className="marketplace-service-actions">
        {secondaryLabel ? (
          <button className="secondary" type="button" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        ) : null}
        <button className="primary" type="button" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </button>
      </div>
    </article>
  );
}

function RequestCard({ request, timelineOpen, timeline, timelineLoading, toggleTimeline, updateMarketplaceRequestStatus, formatMarketplaceStatus }) {
  return (
    <article className="marketplace-request-card">
      <div className="marketplace-request-head">
        <div>
          <p className="history-headline">{request.service_name || request.partner_name || "Request"}</p>
          <p className="micro">{request.partner_name || "Partner"} • {request.fulfillment_mode || request.mode || "service"}</p>
        </div>
        <span className={`marketplace-status-pill ${String(request.status || "").toLowerCase()}`}>
          {formatMarketplaceStatus(request.status)}
        </span>
      </div>
      <p className="micro">Requested {new Date(request.requested_at || request.created_at).toLocaleString()}</p>
      <div className="action-row compact-wrap">
        <button className="secondary" type="button" onClick={toggleTimeline}>
          {timelineOpen ? "Hide timeline" : "View timeline"}
        </button>
        {["requested", "accepted", "processing", "scheduled"].includes(String(request.status || "").toLowerCase()) ? (
          <button className="ghost" type="button" onClick={() => updateMarketplaceRequestStatus(request.id, "cancelled")}>
            Cancel
          </button>
        ) : null}
      </div>
      {timelineOpen ? (
        <div className="marketplace-timeline">
          {timelineLoading ? (
            <p className="micro">Loading timeline...</p>
          ) : timeline.length === 0 ? (
            <p className="micro">No timeline updates yet.</p>
          ) : (
            <ol className="marketplace-timeline-list">
              {timeline.map((item) => (
                <li key={`timeline-${request.id}-${item.id}`}>
                  <p className="timeline-title">{formatMarketplaceStatus(item.status)}</p>
                  <p className="micro">{item.note || "Partner updated the request."}</p>
                  <p className="micro">{new Date(item.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function MarketplaceView({
  type,
  reportInsights,
  records = [],
  labListings,
  pharmacyListings,
  labAreaSearch,
  setLabAreaSearch,
  labArea,
  setLabArea,
  labAreas,
  labMode,
  setLabMode,
  activeLabId,
  setActiveLabId,
  labSort,
  setLabSort,
  pharmacySearch,
  setPharmacySearch,
  pharmacyMode,
  setPharmacyMode,
  pharmacySort,
  setPharmacySort,
  cartItems,
  cartTotal,
  setCartOpen,
  marketplaceLoading,
  marketplaceRequests,
  marketplaceTimelineOpenByRequest,
  toggleMarketplaceRequestTimeline,
  updateMarketplaceRequestStatus,
  marketplaceTimelineByRequest,
  marketplaceTimelineLoadingByRequest,
  marketplaceStatus,
  marketplaceAnalytics,
  labRequestsView,
  setLabRequestsView,
  pharmacyRequestsView,
  setPharmacyRequestsView,
  sortLabs,
  sortPharmacies,
  formatFulfillmentTime,
  formatMarketplaceStatus,
  addToCart,
}) {
  const isLabs = type === "labs";
  const [selectedPharmacyId, setSelectedPharmacyId] = useState(null);
  const [labMenuView, setLabMenuView] = useState("tests");
  const [marketplaceSurfaceTab, setMarketplaceSurfaceTab] = useState("discover");
  const [compactDiscover, setCompactDiscover] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 1080 : false));

  const rawItems = isLabs ? labListings : pharmacyListings;
  const searchQuery = isLabs ? String(labAreaSearch || "").trim().toLowerCase() : String(pharmacySearch || "").trim().toLowerCase();
  const requestView = isLabs ? labRequestsView : pharmacyRequestsView;
  const setRequestView = isLabs ? setLabRequestsView : setPharmacyRequestsView;
  const requestType = isLabs ? "lab" : "pharmacy";
  const sortKey = isLabs ? labSort : pharmacySort;
  const mode = isLabs ? labMode : pharmacyMode;

  const filteredItems = useMemo(() => {
    let items = rawItems;
    if (isLabs) {
      if (labArea !== "all") {
        items = items.filter((lab) => String(lab.areaLabel || "").toLowerCase() === String(labArea).toLowerCase());
      }
      if (searchQuery) {
        items = items.filter((lab) => `${lab.partnerName || ""} ${lab.areaLabel || ""}`.toLowerCase().includes(searchQuery));
      }
      return sortLabs(items, labMode, labSort);
    }

    if (searchQuery) {
      items = items.filter((pharmacy) => `${pharmacy.partnerName || ""} ${pharmacy.areaLabel || ""}`.toLowerCase().includes(searchQuery));
    }
    if (pharmacyMode === "home_delivery") items = items.filter((pharmacy) => pharmacy.homeDeliveryAvailable);
    if (pharmacyMode === "pickup") items = items.filter((pharmacy) => pharmacy.pickupAvailable);
    return sortPharmacies(items, pharmacySort);
  }, [isLabs, rawItems, labArea, searchQuery, sortLabs, labMode, labSort, sortPharmacies, pharmacySort, pharmacyMode]);
  const retestGuidance = useMemo(() => (isLabs ? generateRetestGuidance(reportInsights, records) : null), [isLabs, reportInsights, records]);

  const selectedItem = useMemo(() => {
    if (isLabs) return filteredItems.find((item) => item.id === activeLabId) || null;
    return filteredItems.find((item) => item.id === selectedPharmacyId) || null;
  }, [filteredItems, isLabs, activeLabId, selectedPharmacyId]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      if (isLabs && activeLabId !== null) setActiveLabId(null);
      if (!isLabs && selectedPharmacyId !== null) setSelectedPharmacyId(null);
      return;
    }
    if (isLabs) {
      const stillExists = filteredItems.some((item) => item.id === activeLabId);
      if (!stillExists && activeLabId !== null) setActiveLabId(null);
      return;
    }
    const stillExists = filteredItems.some((item) => item.id === selectedPharmacyId);
    if (!stillExists && selectedPharmacyId !== null) setSelectedPharmacyId(null);
  }, [filteredItems, isLabs, activeLabId, selectedPharmacyId, setActiveLabId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncViewport = () => {
      const compact = window.innerWidth <= 1080;
      setCompactDiscover(compact);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const requestItems = useMemo(
    () => marketplaceRequests.filter((item) => item.request_type === requestType),
    [marketplaceRequests, requestType],
  );
  const requestCounts = useMemo(
    () => ({
      future: getRequestGroups(requestItems, "future").length,
      present: getRequestGroups(requestItems, "present").length,
      past: getRequestGroups(requestItems, "past").length,
    }),
    [requestItems],
  );
  const requestFeed = useMemo(() => getRequestGroups(requestItems, requestView).slice(0, 8), [requestItems, requestView]);

  const pharmacyMenu = selectedItem && !isLabs ? buildPharmacyMenu(selectedItem) : [];
  const activeLabServices = selectedItem ? (labMenuView === "tests" ? selectedItem.tests : selectedItem.packages) : [];
  const handleSelectPartner = (id) => {
    if (isLabs) {
      setActiveLabId(activeLabId === id ? null : id);
      return;
    }
    setSelectedPharmacyId(selectedPharmacyId === id ? null : id);
  };

  return (
    <div className="marketplace-studio">
      <section className="marketplace-topbar">
        <div>
          <p className="eyebrow">{isLabs ? "Retest support" : "Pharmacy marketplace"}</p>
          <h3>{isLabs ? "Follow-up timing and retest guidance" : "Choose a pharmacy and place your request in a few taps."}</h3>
        </div>
      </section>
      {isLabs && retestGuidance ? (
        <section className="marketplace-focus-card marketplace-copy-card">
          <div className="marketplace-panel-head slim">
            <div>
              <p className="eyebrow">Why this retest may help</p>
              <h3>{retestGuidance.title}</h3>
            </div>
          </div>
          <div className="marketplace-kpi-strip compact-grid">
            <div className="marketplace-kpi-chip">
              <span>Follow-up area</span>
              <strong>{getRetestClusterLabel(retestGuidance.cluster)}</strong>
            </div>
            <div className="marketplace-kpi-chip">
              <span>Retest usefulness now</span>
              <strong>{retestGuidance.usefulNowLabel}</strong>
            </div>
            <div className="marketplace-kpi-chip">
              <span>Confidence</span>
              <strong>{retestGuidance.confidenceLevel}</strong>
            </div>
          </div>
          <div className="marketplace-service-grid">
            <article className="marketplace-service-tile">
              <div className="marketplace-service-header">
                <div className="marketplace-service-copy">
                  <h4>Why this retest may help</h4>
                  <p className="micro">{retestGuidance.whyRetestMatters}</p>
                </div>
              </div>
            </article>
            <article className="marketplace-service-tile">
              <div className="marketplace-service-header">
                <div className="marketplace-service-copy">
                  <h4>Related findings</h4>
                  <p className="micro">
                    {retestGuidance.relatedFindings?.length ? retestGuidance.relatedFindings.join(" • ") : "Follow-up context will become clearer as more report history is added."}
                  </p>
                </div>
              </div>
            </article>
            <article className="marketplace-service-tile">
              <div className="marketplace-service-header">
                <div className="marketplace-service-copy">
                  <h4>Suggested timing</h4>
                  <p className="micro">{retestGuidance.suggestedTiming}</p>
                </div>
              </div>
            </article>
            <article className="marketplace-service-tile">
              <div className="marketplace-service-header">
                <div className="marketplace-service-copy">
                  <h4>Is a retest useful now?</h4>
                  <p className="micro">{retestGuidance.usefulNowDetail}</p>
                </div>
              </div>
            </article>
          </div>
          <p className="micro">{retestGuidance.continuityLine}</p>
          {retestGuidance.suggestedMarkers?.length ? (
            <p className="micro">Suggested markers: {retestGuidance.suggestedMarkers.join(" • ")}</p>
          ) : null}
          <p className="micro">Repeat timing often depends on symptoms, clinician advice, and prior trends. Retesting too early may not always improve clarity.</p>
        </section>
      ) : null}
      <section className="marketplace-filter-bar">
        <div className="marketplace-filter-grid">
          {isLabs ? (
            <>
              <label className="block">
                Area
                <select value={labArea} onChange={(event) => setLabArea(event.target.value)}>
                  <option value="all">All areas</option>
                  {labAreas.map((areaOption) => (
                    <option key={`lab-area-${areaOption}`} value={areaOption}>
                      {areaOption}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Search lab or area
                <input type="search" value={labAreaSearch} placeholder="Search lab or area" onChange={(event) => setLabAreaSearch(event.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                Fulfilment mode
                <select value={pharmacyMode} onChange={(event) => setPharmacyMode(event.target.value)}>
                  <option value="home_delivery">Home delivery</option>
                  <option value="pickup">Pickup</option>
                  <option value="all">Any</option>
                </select>
              </label>
              <label className="block marketplace-filter-wide">
                Search pharmacy or area
                <input type="search" value={pharmacySearch} placeholder="Search pharmacy or area" onChange={(event) => setPharmacySearch(event.target.value)} />
              </label>
            </>
          )}
        </div>
      </section>

      {marketplaceStatus ? <p className="micro">{marketplaceStatus}</p> : null}
      {marketplaceLoading ? <p className="micro">{isLabs ? "Loading nearby lab options..." : "Loading nearby options..."}</p> : null}

      <div className="marketplace-surface-switch" role="tablist" aria-label="Marketplace sections">
        <button type="button" className={marketplaceSurfaceTab === "discover" ? "active" : ""} onClick={() => setMarketplaceSurfaceTab("discover")}>
          {isLabs ? "Nearby options" : "Discover"}
        </button>
        <button type="button" className={marketplaceSurfaceTab === "requests" ? "active" : ""} onClick={() => setMarketplaceSurfaceTab("requests")}>
          Requests
        </button>
        <button className="secondary marketplace-cart-trigger" type="button" onClick={() => setCartOpen(true)}>
          Cart{cartItems.length ? ` (${cartItems.length})` : ""}
        </button>
      </div>

      {marketplaceSurfaceTab === "discover" ? (
      <section className="marketplace-layout-grid">
        {!compactDiscover ? (
        <section className="marketplace-focus-panel marketplace-discover-focus-panel">
          {!selectedItem ? (
            <div className="marketplace-empty-focus">
              <p className="history-headline">{isLabs ? "Nearby options if you decide to proceed" : "Select a partner"}</p>
              <p className="micro">{isLabs ? "Choose a lab only after the follow-up timing and comparison guidance feels useful." : "Partner details and services will appear here."}</p>
            </div>
          ) : (
            <>
              <div className="marketplace-focus-card marketplace-focus-header-card">
                <div className="marketplace-focus-header">
                  <div>
                    <p className="eyebrow">Selected {isLabs ? "lab option" : "pharmacy"}</p>
                    <h3>{selectedItem.partnerName}</h3>
                    <p className="panel-sub">
                      {selectedItem.areaLabel || "Nearby"} • {selectedItem.distanceKm} km • {formatFulfillmentTime(selectedItem.etaMinutes)}
                    </p>
                  </div>
                </div>
                {!isLabs ? (
                  <div className="marketplace-kpi-strip">
                    <div className="marketplace-kpi-chip">
                      <span>Services</span>
                      <strong>{pharmacyMenu.length}</strong>
                    </div>
                  </div>
                ) : null}
              </div>

              {isLabs ? (
                <>
                  <div className="marketplace-focus-card marketplace-segment-card">
                    <div className="marketplace-panel-head slim">
                      <div>
                        <p className="eyebrow">Available services</p>
                        <h3>{labMenuView === "tests" ? "Tests" : "Packages"}</h3>
                      </div>
                    </div>
                    <div className="marketplace-chip-row">
                      <button type="button" className={labMenuView === "tests" ? "primary" : "secondary"} onClick={() => setLabMenuView("tests")}>
                        Tests ({selectedItem.tests.length})
                      </button>
                      <button type="button" className={labMenuView === "packages" ? "primary" : "secondary"} onClick={() => setLabMenuView("packages")}>
                        Packages ({selectedItem.packages.length})
                      </button>
                    </div>
                  </div>
                  <div className="marketplace-service-grid">
                    {activeLabServices.map((item) => (
                      <ServiceCard
                        key={`${labMenuView}-${item.id}`}
                        title={item.serviceName}
                        subtitle={null}
                        priceLabel={formatMarketplacePrice(item.price)}
                        detailNote={
                          item.homeCollectionAvailable
                            ? "Home collection can be requested if the partner confirms availability."
                            : "Call or visit partner to confirm availability."
                        }
                        primaryLabel={getLabPrimaryActionLabel(item)}
                        onPrimary={
                          item.homeCollectionAvailable
                            ? () =>
                                addToCart({
                                  requestType: "lab",
                                  partnerId: selectedItem.id,
                                  partnerName: selectedItem.partnerName,
                                  serviceName: item.serviceName,
                                  fulfillmentMode: "home_visit",
                                  listedPrice: item.price,
                                  notes: `${selectedItem.partnerName} • ${item.serviceName} • home collection + delivery charge`,
                                })
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="marketplace-focus-card marketplace-copy-card">
                    <p className="eyebrow">Pricing note</p>
                    <p className="panel-sub compact-copy">{selectedItem.medicinePriceNote || "Medicine cost is confirmed by the pharmacy partner after they review the request."}</p>
                  </div>
                  <div className="marketplace-service-grid">
                    {pharmacyMenu.map((item) => (
                      <ServiceCard
                        key={item.id}
                        title={item.serviceName}
                        subtitle={item.description}
                        priceLabel={item.fulfillmentMode === "pickup" ? "Rs 0" : formatMarketplacePrice(item.price)}
                        primaryLabel={item.requestLabel}
                        onPrimary={() =>
                          addToCart({
                            requestType: "pharmacy",
                            partnerId: selectedItem.id,
                            partnerName: selectedItem.partnerName,
                            serviceName: item.serviceName,
                            fulfillmentMode: item.fulfillmentMode,
                            listedPrice: item.fulfillmentMode === "pickup" ? 0 : item.price,
                            notes: `${selectedItem.partnerName} • ${item.serviceName} • ${item.fulfillmentMode}`,
                          })
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
        ) : null}

        <aside className="marketplace-results-panel marketplace-discover-results-panel">
          <div className="marketplace-panel-head">
            <div>
              <p className="eyebrow">{isLabs ? "Nearby options" : "Results"}</p>
              <h3>{filteredItems.length} {filteredItems.length === 1 ? "partner" : "partners"}</h3>
            </div>
            <span className="marketplace-panel-note">{compactDiscover ? (isLabs ? "Tap a lab option to view services below" : "Tap a pharmacy to open details below") : isLabs ? "Labs stay secondary to follow-up guidance" : "Tap a pharmacy"}</span>
          </div>
          <div className="marketplace-results-list">
            {filteredItems.length === 0 ? (
              <div className="marketplace-empty-state">
                <p className="history-headline">No nearby options found</p>
                <p className="micro">{isLabs ? "Change area or search text if you still want to look for a follow-up lab option." : "Change area, mode, or search text to widen results."}</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={`${type}-${item.id}`} className="marketplace-result-stack">
                <ResultRow
                  item={item}
                  isLabs={isLabs}
                  mode={mode}
                  sortKey={sortKey}
                  selected={selectedItem?.id === item.id}
                  onSelect={() => handleSelectPartner(item.id)}
                  onClose={() => handleSelectPartner(item.id)}
                  formatFulfillmentTime={formatFulfillmentTime}
                />
                  {compactDiscover && selectedItem?.id === item.id ? (
                    <div className="marketplace-inline-detail-card">
                      {!isLabs ? (
                        <div className="marketplace-inline-detail-head">
                          <div>
                            <p className="eyebrow">Selected pharmacy</p>
                            <h3>{selectedItem.partnerName}</h3>
                            <p className="panel-sub">
                              {selectedItem.areaLabel || "Nearby"} • {selectedItem.distanceKm} km • {formatFulfillmentTime(selectedItem.etaMinutes)}
                            </p>
                          </div>
                        </div>
                      ) : null}
                      {!isLabs ? (
                        <div className="marketplace-kpi-strip compact-grid">
                          <div className="marketplace-kpi-chip">
                            <span>Services</span>
                            <strong>{pharmacyMenu.length}</strong>
                          </div>
                        </div>
                      ) : null}
                      {isLabs ? (
                        <>
                          <div className="marketplace-inline-menu-label">
                            <p className="eyebrow">Menu</p>
                          </div>
                          <div className="marketplace-inline-segment">
                            <button type="button" className={labMenuView === "tests" ? "primary" : "secondary"} onClick={() => setLabMenuView("tests")}>
                              Tests ({selectedItem.tests.length})
                            </button>
                            <button type="button" className={labMenuView === "packages" ? "primary" : "secondary"} onClick={() => setLabMenuView("packages")}>
                              Packages ({selectedItem.packages.length})
                            </button>
                          </div>
                          <div className="marketplace-service-grid compact-marketplace-grid">
                            {activeLabServices.map((service) => (
                            <ServiceCard
                              key={`${labMenuView}-${service.id}`}
                              title={service.serviceName}
                              subtitle={null}
                              priceLabel={formatMarketplacePrice(service.price)}
                              detailNote={
                                service.homeCollectionAvailable
                                  ? "Home collection can be requested if the partner confirms availability."
                                  : "Call or visit partner to confirm availability."
                              }
                                primaryLabel={getLabPrimaryActionLabel(service)}
                                onPrimary={
                                  service.homeCollectionAvailable
                                    ? () =>
                                        addToCart({
                                          requestType: "lab",
                                          partnerId: selectedItem.id,
                                          partnerName: selectedItem.partnerName,
                                          serviceName: service.serviceName,
                                          fulfillmentMode: "home_visit",
                                          listedPrice: service.price,
                                          notes: `${selectedItem.partnerName} • ${service.serviceName} • home collection + delivery charge`,
                                        })
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="marketplace-service-grid compact-marketplace-grid">
                          {pharmacyMenu.map((service) => (
                            <ServiceCard
                              key={service.id}
                              title={service.serviceName}
                              subtitle={service.description}
                              priceLabel={service.fulfillmentMode === "pickup" ? "Rs 0" : formatMarketplacePrice(service.price)}
                              primaryLabel={service.requestLabel}
                              onPrimary={() =>
                                addToCart({
                                  requestType: "pharmacy",
                                  partnerId: selectedItem.id,
                                  partnerName: selectedItem.partnerName,
                                  serviceName: service.serviceName,
                                  fulfillmentMode: service.fulfillmentMode,
                                  listedPrice: service.fulfillmentMode === "pickup" ? 0 : service.price,
                                  notes: `${selectedItem.partnerName} • ${service.serviceName} • ${service.fulfillmentMode}`,
                                })
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
      ) : null}

      {marketplaceSurfaceTab === "requests" ? (
      <section className="marketplace-requests-section marketplace-requests-shell">
        <div className="marketplace-panel-head">
          <div>
            <p className="eyebrow">Your requests</p>
            <h3>{isLabs ? "Lab requests" : "Pharmacy requests"}</h3>
          </div>
          <div className="marketplace-chip-row">
            {REQUEST_VIEW_OPTIONS.map((option) => (
              <button
                key={`${type}-request-${option.key}`}
                type="button"
                className={requestView === option.key ? "primary" : "secondary"}
                onClick={() => setRequestView(option.key)}
              >
                {option.label} ({requestCounts[option.key] || 0})
              </button>
            ))}
          </div>
        </div>

        <div className="marketplace-request-grid request-grid-tight">
          {requestFeed.length === 0 ? (
            <div className="marketplace-empty-state">
              <p className="history-headline">
                {requestView === "future"
                  ? "No upcoming requests"
                  : requestView === "present"
                    ? "No requests in progress"
                    : "No past requests"}
              </p>
              <p className="micro">
                {requestView === "future"
                  ? "New or scheduled requests will appear here."
                  : requestView === "present"
                    ? "Active requests will appear here once a partner starts processing them."
                    : "Completed, cancelled, and unavailable requests will appear here."}
              </p>
            </div>
          ) : (
            requestFeed.map((request) => (
              <RequestCard
                key={`${type}-request-card-${request.id}`}
                request={request}
                timelineOpen={marketplaceTimelineOpenByRequest[request.id]}
                timeline={marketplaceTimelineByRequest[request.id] || []}
                timelineLoading={marketplaceTimelineLoadingByRequest[request.id]}
                toggleTimeline={() => toggleMarketplaceRequestTimeline(request.id)}
                updateMarketplaceRequestStatus={updateMarketplaceRequestStatus}
                formatMarketplaceStatus={formatMarketplaceStatus}
              />
            ))
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}
