export function HospitalContentView({
  hospitalContent,
  hospitalContentStatus,
  hospitalSections,
  activeHospitalSection,
  setActiveHospitalSection,
}) {
  return (
    <section className="panel hospital-panel">
      <div className="hospital-shell-hero">
        <div>
          <p className="eyebrow">Hospital</p>
          <h2>{hospitalContent?.profile?.hospitalName || "SehatSaathi Hospital"}</h2>
          <p className="panel-sub">
            Cashless partners, service scope, health packages, Ayushman support, and super-speciality details.
          </p>
        </div>
      </div>
      {hospitalContentStatus ? <p className="micro">{hospitalContentStatus}</p> : null}
      <div className="hospital-layout">
        <aside className="hospital-nav" aria-label="Hospital information sections">
          {hospitalSections.map((section) => (
            <button
              key={section.key}
              type="button"
              className={`hospital-nav-button ${activeHospitalSection === section.key ? "active" : ""}`}
              onClick={() => setActiveHospitalSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </aside>
        <div className="hospital-content-panel">
          {activeHospitalSection === "updates" && (
            <div className="history-card">
              <p className="history-headline">Hospital updates and seasonal guidance</p>
              <p className="micro">Published by the hospital for current patient education, camps, and seasonal care reminders.</p>
              {(hospitalContent?.patientUpdates || []).length ? (
                <div className="hospital-update-feed">
                  {(hospitalContent?.patientUpdates || []).map((item) => (
                    <article key={item.id} className="history-card subtle hospital-update-card">
                      {item.imageUrl ? (
                        <div className="hospital-update-media">
                          <img src={item.imageUrl} alt={item.title || "Hospital update"} className="hospital-update-image" />
                        </div>
                      ) : null}
                      <div className="hospital-update-copy">
                        <p className="micro strong">
                          {item.seasonTag ? `${item.seasonTag} • ` : ""}
                          {item.title || "Hospital update"}
                        </p>
                        {item.summary ? <p className="micro">{item.summary}</p> : null}
                        {item.body ? <p className="micro">{item.body}</p> : null}
                        {(item.startDate || item.endDate) ? (
                          <p className="micro">
                            Active: {[item.startDate, item.endDate].filter(Boolean).join(" to ")}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="micro">No hospital updates are active right now.</p>
              )}
            </div>
          )}
          {activeHospitalSection === "cashless" && (
            <div className="history-card">
              <p className="history-headline">{hospitalContent?.sections?.cashless?.title || "Cashless Facility Available"}</p>
              <p className="micro strong">List of cashless facility</p>
              <ul className="info-list">
                {(hospitalContent?.sections?.cashless?.cashlessFacilityList || []).map((item, index) => (
                  <li key={`cashless-${index}`} className="micro">{item}</li>
                ))}
              </ul>
              <p className="micro strong">TPA list</p>
              <ul className="info-list">
                {(hospitalContent?.sections?.cashless?.tpaList || []).map((item, index) => (
                  <li key={`tpa-${index}`} className="micro">{item}</li>
                ))}
              </ul>
              <p className="micro strong">Corporate list</p>
              <ul className="info-list">
                {(hospitalContent?.sections?.cashless?.corporateList || []).map((item, index) => (
                  <li key={`corp-${index}`} className="micro">{item}</li>
                ))}
              </ul>
              <p className="micro">TPA queries: {hospitalContent?.sections?.cashless?.tpaQueryPhone || hospitalContent?.profile?.contactPhone || "-"}</p>
            </div>
          )}
          {activeHospitalSection === "services" && (
            <div className="history-card">
              <p className="history-headline">{hospitalContent?.sections?.services?.title || "Scope of Services"}</p>
              <p className="micro strong">Clinical services/specialities</p>
              <ul className="info-list">
                {(hospitalContent?.sections?.services?.clinicalServices || []).map((item, index) => (
                  <li key={`clinical-${index}`} className="micro">{item}</li>
                ))}
              </ul>
              <p className="micro strong">State of the art facility</p>
              <ul className="info-list">
                {(hospitalContent?.sections?.services?.stateOfTheArt || []).map((item, index) => (
                  <li key={`soa-${index}`} className="micro">{item}</li>
                ))}
              </ul>
              <p className="micro strong">24 x 7 services</p>
              <ul className="info-list">
                {(hospitalContent?.sections?.services?.services24x7 || []).map((item, index) => (
                  <li key={`24x7-${index}`} className="micro">{item}</li>
                ))}
              </ul>
              <p className="micro">Appointments: {(hospitalContent?.sections?.services?.appointmentPhones || []).join(" / ") || "-"}</p>
              <p className="micro">Address: {[
                hospitalContent?.profile?.addressLine,
                hospitalContent?.profile?.taluka,
                hospitalContent?.profile?.district,
                hospitalContent?.profile?.city,
                hospitalContent?.profile?.state,
                hospitalContent?.profile?.pinCode,
              ].filter(Boolean).join(", ") || "-"}</p>
            </div>
          )}
          {activeHospitalSection === "healthCheckup" && (
            <div className="history-card">
              <p className="history-headline">{hospitalContent?.sections?.healthCheckup?.title || "Health Check-up"}</p>
              {(hospitalContent?.sections?.healthCheckup?.plans || []).map((plan, index) => (
                <div key={`health-plan-${index}`} className="history-card subtle">
                  <p className="micro strong">{plan?.name || `Package ${index + 1}`} {plan?.price ? `• ${plan.price}` : ""}</p>
                  <ul className="info-list">
                    {(plan?.includes || []).map((item, includeIndex) => (
                      <li key={`health-plan-${index}-item-${includeIndex}`} className="micro">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {activeHospitalSection === "ayushman" && (
            <div className="history-card">
              <p className="history-headline">{hospitalContent?.sections?.ayushman?.title || "Ayushman Support"}</p>
              <ul className="info-list">
                {(hospitalContent?.sections?.ayushman?.bullets || []).map((item, index) => (
                  <li key={`ayushman-${index}`} className="micro">{item}</li>
                ))}
              </ul>
              <p className="micro strong">Help phones</p>
              <p className="micro">{(hospitalContent?.sections?.ayushman?.helpPhones || []).join(" / ") || "-"}</p>
            </div>
          )}
          {activeHospitalSection === "specialities" && (
            <div className="history-card">
              <p className="history-headline">{hospitalContent?.sections?.specialities?.title || "Our Super-Specialities"}</p>
              {(hospitalContent?.sections?.specialities?.departments || []).map((department, index) => (
                <div key={`speciality-${index}`} className="history-card subtle">
                  <p className="micro strong">{department?.name || `Department ${index + 1}`}</p>
                  <ul className="info-list">
                    {(department?.points || []).map((item, pointIndex) => (
                      <li key={`speciality-${index}-point-${pointIndex}`} className="micro">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="micro">Contact: {hospitalContent?.sections?.specialities?.contactPhone || hospitalContent?.profile?.contactPhone || "-"}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
