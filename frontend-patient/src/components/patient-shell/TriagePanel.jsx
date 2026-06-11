export function TriagePanel({
  t,
  submitTriage,
  triageType,
  setTriageType,
  triageForm,
  updateTriageField,
  dentalForm,
  updateDentalField,
  commonSymptoms,
  dentalSymptomsOptions,
  redFlagOptions,
  dentalRedFlagOptions,
  toggleArrayValue,
  toggleDentalArrayValue,
  translateSymptom,
  triageLoading,
  triageError,
  triageResult,
  history,
  saveTriageDraftNow,
  clearTriageDraft,
  triageDraftStatus,
  triageHistoryQuery,
  setTriageHistoryQuery,
  triageHistoryLevel,
  setTriageHistoryLevel,
  filteredHistory,
}) {
  return (
    <section className="panel triage-panel">
      <div className="triage-shell-hero">
        <div>
          <p className="eyebrow">Triage</p>
          <h2>{t("triageTitle")}</h2>
          <p className="panel-sub">{t("triageSubtitle")}</p>
        </div>
      </div>
      <div className="triage-layout">
        <form className="form triage-form-shell" onSubmit={submitTriage}>
          <div className="triage-section-block">
            <div className="triage-section-head">
              <div>
                <p className="eyebrow">Mode</p>
                <h3>Choose a triage flow</h3>
              </div>
            </div>
            <div className="action-row triage-mode-strip">
              <button type="button" className={triageType === "general" ? "chip active" : "chip"} onClick={() => setTriageType("general")}>
                {t("triageModeGeneral")}
              </button>
              <button type="button" className={triageType === "dental" ? "chip active" : "chip"} onClick={() => setTriageType("dental")}>
                {t("triageModeDental")}
              </button>
            </div>
          </div>

          <div className="triage-section-block">
            <div className="triage-section-head">
              <div>
                <p className="eyebrow">Details</p>
                <h3>Basic information</h3>
              </div>
            </div>
            <div className="form-row">
              <label>
                {t("age")}
                <input type="number" min="0" value={triageForm.age} onChange={(event) => updateTriageField("age", event.target.value)} />
              </label>
              <label>
                {t("sex")}
                <select value={triageForm.sex} onChange={(event) => updateTriageField("sex", event.target.value)}>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                  <option>Prefer not to say</option>
                </select>
              </label>
            </div>
            {triageType === "general" ? (
              <>
                <label className="block">
                  {t("duration")}
                  <input type="number" min="0" value={triageForm.durationDays} onChange={(event) => updateTriageField("durationDays", event.target.value)} />
                </label>
                <label className="block">
                  {t("severity")}
                  <input type="range" min="0" max="5" value={triageForm.severity} onChange={(event) => updateTriageField("severity", event.target.value)} />
                  <span className="range-label">{triageForm.severity} / 5</span>
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  {t("duration")}
                  <input type="number" min="0" value={dentalForm.durationDays} onChange={(event) => updateDentalField("durationDays", event.target.value)} />
                </label>
                <label className="block">
                  {t("dentalPainScale")}
                  <input type="range" min="0" max="10" value={dentalForm.painScale} onChange={(event) => updateDentalField("painScale", event.target.value)} />
                  <span className="range-label">{dentalForm.painScale} / 10</span>
                </label>
              </>
            )}
          </div>

          <div className="triage-section-block">
            <div className="triage-section-head">
              <div>
                <p className="eyebrow">Symptoms</p>
                <h3>{triageType === "general" ? "Select what you feel" : "Select dental symptoms"}</h3>
              </div>
            </div>
            <div className="chip-grid triage-chip-grid">
              {(triageType === "general" ? commonSymptoms : dentalSymptomsOptions).map((symptom) => (
                <button
                  type="button"
                  key={symptom}
                  className={((triageType === "general" ? triageForm.symptoms : dentalForm.symptoms).includes(symptom)) ? "chip active" : "chip"}
                  onClick={() => triageType === "general" ? toggleArrayValue("symptoms", symptom) : toggleDentalArrayValue("symptoms", symptom)}
                >
                  {triageType === "general" ? translateSymptom(symptom) : symptom}
                </button>
              ))}
            </div>
            {triageType === "general" ? (
              <label className="block">
                {t("additionalSymptoms")}
                <input type="text" value={triageForm.additionalSymptoms} onChange={(event) => updateTriageField("additionalSymptoms", event.target.value)} />
              </label>
            ) : null}
          </div>

          <div className="triage-section-block">
            <div className="triage-section-head">
              <div>
                <p className="eyebrow">Red flags</p>
                <h3>Urgent symptoms to check</h3>
              </div>
            </div>
            <div className="chip-grid triage-chip-grid">
              {(triageType === "general" ? redFlagOptions : dentalRedFlagOptions).map((flag) => (
                <button
                  type="button"
                  key={flag}
                  className={((triageType === "general" ? triageForm.redFlags : dentalForm.redFlags).includes(flag)) ? "chip danger" : "chip"}
                  onClick={() => triageType === "general" ? toggleArrayValue("redFlags", flag) : toggleDentalArrayValue("redFlags", flag)}
                >
                  {triageType === "general" ? translateSymptom(flag) : flag}
                </button>
              ))}
            </div>
          </div>

          <div className="triage-actions">
            <button className="primary full" type="submit">{triageLoading ? t("runningTriage") : t("getGuidance")}</button>
            {triageError && <p className="error">{triageError}</p>}
            <div className="action-row triage-draft-row">
              <button className="secondary" type="button" onClick={saveTriageDraftNow}>Save draft</button>
              <button className="ghost" type="button" onClick={clearTriageDraft}>Clear draft</button>
            </div>
            {triageDraftStatus && <p className="micro patient-status-note">{triageDraftStatus}</p>}
          </div>
        </form>

        <div className="triage-side-column">
          <div className="pass-card triage-result-shell">
            <div className="triage-section-head">
              <div>
                <p className="eyebrow">Guidance</p>
                <h3>Current result</h3>
              </div>
            </div>
            {!triageResult ? (
              <p className="micro">{t("guidanceEmpty")}</p>
            ) : (
              <>
                {triageResult.level === "emergency" ? (
                  <div className="triage-escalation-card is-emergency">
                    <p className="history-headline">Emergency escalation</p>
                    <p className="micro">
                      Severe warning signs were selected. Do not wait for app-only guidance if symptoms are active or worsening.
                    </p>
                  </div>
                ) : null}
                <p className="history-headline">{triageResult.headline}</p>
                <p className="micro">{triageResult.urgency}</p>
                <div className="result-list">
                  {triageResult.suggestions?.map((item) => (
                    <div key={item} className="result-item">{item}</div>
                  ))}
                </div>
                {triageResult.disclaimer ? <p className="micro triage-result-disclaimer">{triageResult.disclaimer}</p> : null}
                {history[1]?.result ? (
                  <p className="micro">
                    Change since last: {triageResult.level === history[1].result.level ? "Urgency level is similar to your previous triage." : `Level changed from ${history[1].result.level} to ${triageResult.level}.`}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="triage-history-shell">
            <div className="triage-section-head">
              <div>
                <p className="eyebrow">History</p>
                <h3>{t("historyTitle")}</h3>
              </div>
            </div>
            <div className="history-list triage-history-list">
              {(filteredHistory || []).slice(0, 20).map((item) => (
                <div key={`triage-history-${item.id}`} className="history-card">
                  <p className="history-date">{new Date(item.createdAt).toLocaleString()}</p>
                  <p className="history-headline">{item.result?.headline || "Guidance result"}</p>
                  <p className="micro">{item.result?.urgency || "Saved guidance"}</p>
                  <p className="micro">Symptoms: {(item.payload?.symptoms || []).slice(0, 6).join(", ") || "Not listed"}</p>
                </div>
              ))}
              {(!filteredHistory || filteredHistory.length === 0) && <p className="micro">{t("historyEmpty")}</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
