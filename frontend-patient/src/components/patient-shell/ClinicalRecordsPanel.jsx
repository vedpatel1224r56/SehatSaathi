import { useState } from "react";

function renderDepartmentSummary(detail) {
  const departmentKey = detail?.departmentForm?.departmentKey || detail?.departmentForm?.department_key;
  const form = detail?.departmentForm?.form || {};
  if (departmentKey === "surgery") {
    const items = [
      { label: "Procedure planned", value: form.procedurePlanned },
      { label: "Consent status", value: form.consentStatus },
      { label: "Indication", value: form.indication },
      { label: "Pre-op notes", value: form.preOpNotes },
      { label: "Post-op notes", value: form.postOpNotes },
      { label: "Surgical follow-up review", value: form.followUpReview },
    ].filter((item) => String(item.value || "").trim());
    if (!items.length) return null;
    return (
      <div className="history-list" style={{ marginTop: 12 }}>
        <div className="history-card">
          <p className="history-headline">Surgery details</p>
          {items.map((item) => (
            <p key={`clinical-surgery-detail-${item.label}`} className="micro">
              <strong>{item.label}:</strong> {item.value}
            </p>
          ))}
        </div>
      </div>
    );
  }
  if (departmentKey === "pediatrics") {
    const growthValue = [form.weightKg ? `${form.weightKg} kg` : "", form.heightCm ? `${form.heightCm} cm` : ""]
      .filter(Boolean)
      .join(" • ");
    const items = [
      { label: "Guardian", value: form.guardianName },
      { label: "Growth", value: growthValue },
      { label: "Growth notes", value: form.growthNotes },
      { label: "Immunization context", value: form.immunizationContext },
      { label: "Pediatric dosing context", value: form.pediatricDoseNotes },
      { label: "Follow-up pediatric notes", value: form.followUpPediatricNotes },
    ].filter((item) => String(item.value || "").trim());
    if (!items.length) return null;
    return (
      <div className="history-list" style={{ marginTop: 12 }}>
        <div className="history-card">
          <p className="history-headline">Pediatrics details</p>
          {items.map((item) => (
            <p key={`clinical-pediatrics-detail-${item.label}`} className="micro">
              <strong>{item.label}:</strong> {item.value}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function ClinicalRecordsPanel({
  encounters,
  activeEncounterId,
  setActiveEncounterId,
  encounterDetail,
  encounterStatus,
}) {
  const renderEmptyState = (title, body) => (
    <div className="patient-empty-state patient-empty-state-records">
      <div className="patient-empty-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="4.5" width="14" height="15" rx="3" />
          <path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4" />
        </svg>
      </div>
      <p className="history-headline">{title}</p>
      <p className="micro">{body}</p>
    </div>
  )

  const [viewTab, setViewTab] = useState("prescriptions");
  const activeEncounter = encounterDetail?.encounter || null;
  const latestEncounterDate =
    activeEncounter?.appointment_scheduled_at ||
    activeEncounter?.teleconsult_preferred_slot ||
    activeEncounter?.created_at ||
    activeEncounter?.scheduled_at;
  const activeEncounterType = activeEncounter?.teleconsult_id ? "Remote consult" : "Visit record";
  const activeEncounterDateLabel = latestEncounterDate ? new Date(latestEncounterDate).toLocaleDateString() : "-";
  const selectedEncounterValue = activeEncounterId == null ? "" : String(activeEncounterId);
  const diagnosisLabel = activeEncounter?.diagnosis_text || activeEncounter?.diagnosis_code || "No diagnosis added";
  const planLabel = activeEncounter?.plan_text || "No plan added";
  const followupLabel = activeEncounter?.followup_date || "No follow-up set";
  const activeDoctorLabel = activeEncounter?.doctor_name
    ? /^dr\.?\s/i.test(String(activeEncounter.doctor_name)) ? activeEncounter.doctor_name : `Dr. ${activeEncounter.doctor_name}`
    : "";

  return (
    <section className="panel clinical-records-panel">
      <div className="clinical-records-head">
        <div>
          <p className="eyebrow">Clinical records</p>
          <h2>Visit records</h2>
          <p className="panel-sub">Open one visit to review notes, prescriptions, and orders.</p>
        </div>
      </div>

      {encounterStatus ? <p className="micro patient-status-note">{encounterStatus}</p> : null}

      {encounters.length ? (
        <div className="clinical-record-picker">
          <div className="clinical-record-picker-card">
            <span className="mini-label">Select an appointment</span>
            <select
              className="clinical-record-select"
              value={selectedEncounterValue}
              onChange={(event) => {
                const selectedId = event.target.value;
                const matchedEncounter = encounters.find((encounter) => String(encounter.id) === selectedId);
                setActiveEncounterId(matchedEncounter ? matchedEncounter.id : selectedId);
              }}
            >
              {encounters.map((encounter) => {
                const encounterDate = new Date(
                  encounter.appointment_scheduled_at ||
                    encounter.teleconsult_preferred_slot ||
                    encounter.created_at ||
                    encounter.scheduled_at ||
                    Date.now(),
                ).toLocaleDateString();
                const encounterType = encounter.teleconsult_id ? "Remote consult" : "Visit record";
                const encounterDepartment = encounter.department_name || encounter.department || "General";
                return (
                  <option key={`clinical-encounter-${encounter.id}`} value={String(encounter.id)}>
                    {`${encounterDate} • ${encounterType} • ${encounterDepartment}`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      ) : null}

      {encounterDetail ? (
        <div className="pass-card clinical-record-shell">
          <div className="clinical-record-topline">
            <article className="clinical-record-highlight">
              <span className="mini-label">Open record</span>
              <strong>{activeEncounterType}</strong>
              <p>
                {activeEncounterDateLabel}
                {activeDoctorLabel ? ` • ${activeDoctorLabel}` : ""}
              </p>
            </article>
          </div>
          <div className="clinical-record-facts">
            <article className="clinical-record-fact">
              <span className="mini-label">Diagnosis</span>
              <strong>{diagnosisLabel}</strong>
            </article>
            <article className="clinical-record-fact">
              <span className="mini-label">Plan</span>
              <strong>{planLabel}</strong>
            </article>
            <article className="clinical-record-fact">
              <span className="mini-label">Follow-up</span>
              <strong>{followupLabel}</strong>
            </article>
          </div>
          <div className="clinical-tab-strip">
            <button type="button" className={viewTab === "summary" ? "active" : ""} onClick={() => setViewTab("summary")}>
              Summary
            </button>
            <button type="button" className={viewTab === "notes" ? "active" : ""} onClick={() => setViewTab("notes")}>
              Notes
            </button>
            <button type="button" className={viewTab === "prescriptions" ? "active" : ""} onClick={() => setViewTab("prescriptions")}>
              Prescriptions
            </button>
            <button type="button" className={viewTab === "orders" ? "active" : ""} onClick={() => setViewTab("orders")}>
              Orders
            </button>
          </div>

          <div className="clinical-record-body">
            {viewTab === "summary" ? (
              <>
                <div className="history-list compact-list">
                  <div className="history-card">
                    <p className="history-headline">Doctor</p>
                    <p className="micro">{encounterDetail.encounter?.doctor_name || "-"}</p>
                  </div>
                  <div className="history-card">
                    <p className="history-headline">Consult</p>
                    <p className="micro">
                      {encounterDetail.teleconsult
                        ? `${encounterDetail.teleconsult.mode?.toUpperCase() || "REMOTE"} • ${encounterDetail.teleconsult.concern || "-"}`
                        : encounterDetail.appointment?.reason || "-"}
                    </p>
                  </div>
                  <div className="history-card">
                    <p className="history-headline">Diagnosis</p>
                    <p className="micro">{encounterDetail.encounter?.diagnosis_text || encounterDetail.encounter?.diagnosis_code || "-"}</p>
                  </div>
                  <div className="history-card">
                    <p className="history-headline">Plan</p>
                    <p className="micro">{encounterDetail.encounter?.plan_text || "-"}</p>
                  </div>
                </div>
                {renderDepartmentSummary(encounterDetail)}
              </>
            ) : null}

            {viewTab === "notes" ? (
              <div className="history-list">
                {(encounterDetail.notes || []).length === 0 ? (
                  <p className="micro">No clinical notes yet.</p>
                ) : (
                  (encounterDetail.notes || []).map((note) => (
                    <div key={`clinical-note-${note.id}`} className="history-card">
                      <p className="micro">{note.note_text}</p>
                      <p className="micro">{note.signature_text || "Unsigned"} • {new Date(note.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {viewTab === "prescriptions" ? (
              <div className="history-list">
                {(encounterDetail.prescriptions || []).length === 0 ? (
                  <p className="micro">No prescriptions available yet.</p>
                ) : (
                  (encounterDetail.prescriptions || []).map((rx) => (
                    <div key={`clinical-rx-${rx.id}`} className="history-card">
                      <p className="history-headline">Prescription #{rx.id}</p>
                      <p className="micro">{rx.instructions || "No instructions"}</p>
                      <div className="history-list" style={{ marginTop: 8 }}>
                        {(rx.items || []).map((item) => (
                          <div key={`clinical-rx-item-${item.id}`} className="history-card">
                            <p className="micro"><strong>{item.medicine}</strong></p>
                            <p className="micro">{item.dose || "-"} • {item.frequency || "-"} • {item.duration || "-"}</p>
                            <p className="micro">{item.route || "-"}{item.notes ? ` • ${item.notes}` : ""}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {viewTab === "orders" ? (
              <div className="history-list">
                {(encounterDetail.orders || []).length === 0 ? (
                  <p className="micro">No doctor orders available yet.</p>
                ) : (
                  (encounterDetail.orders || []).map((order) => (
                    <div key={`clinical-order-${order.id}`} className="history-card">
                      <p className="history-headline">{order.item_name}</p>
                      <p className="micro">{order.order_type} • {order.status}</p>
                      <p className="micro">{order.destination || "-"}</p>
                      {order.notes ? <p className="micro">{order.notes}</p> : null}
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : renderEmptyState("No visit selected yet", encounters.length ? "Choose one visit above to open notes, prescriptions, and follow-up details." : "Clinical records will appear here after your first visit or consult is documented.")}
    </section>
  );
}
