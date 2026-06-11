import { ProfileInlineEditor } from "../profile/ProfileInlineEditor";

export function LegacyPatientFlowsSection(props) {
  const {
    t,
    user,
    isOpsUser,
    profileEditMode,
    setProfileEditMode,
    profileForm,
    departments,
    profileDepartmentDoctors,
    saveProfile,
    updateProfileField,
    setProfileForm,
    profileStatus,
    history,
    visibleHistory,
    historyExpanded,
    setHistoryExpanded,
    historyStatus,
    memberForm,
    setMemberForm,
    saveFamilyMember,
    familyStatus,
    activeMemberId,
    setActiveMemberId,
    familyMembers,
    recordsInputRef,
    uploadRecord,
    recordStatus,
    records,
    deleteRecord,
    generateEmergencyCard,
    emergencyCard,
    sharePassStatus,
    sharePass,
    generateSharePass,
    shareQr,
    shareHistory,
    careRequestMode,
    setCareRequestMode,
    submitCareRequest,
    appointmentForm,
    setAppointmentForm,
    departmentDoctors,
    availableSlots,
    slotStatus,
    teleForm,
    updateTeleField,
    teleStatus,
    appointmentsStatus,
    teleLoading,
    teleconsults,
    appointments,
    activeConsultId,
    setActiveConsultId,
    teleStatusLabel,
    activeConsult,
    consultMessages,
    sendConsultMessage,
    consultMessageText,
    setConsultMessageText,
    consultMessageStatus,
    encounters,
    activeEncounterId,
    setActiveEncounterId,
    encounterDetail,
    encounterStatus,
  } = props;

  if (!user || isOpsUser) return null;

  return (
    <>
      <section className="grid" id="profile">
        <ProfileInlineEditor
          t={t}
          profileEditMode={profileEditMode}
          setProfileEditMode={setProfileEditMode}
          profileForm={profileForm}
          departments={departments}
          profileDepartmentDoctors={profileDepartmentDoctors}
          saveProfile={saveProfile}
          updateProfileField={updateProfileField}
          setProfileForm={setProfileForm}
          profileStatus={profileStatus}
        />
        <div className="panel result">
          <h2>{t("historyTitle")}</h2>
          {history.length === 0 ? (
            <p className="micro">{t("historyEmpty")}</p>
          ) : (
            <div className="history-list">
              {visibleHistory.map((item) => (
                <div key={item.id} className="history-card">
                  <p className="history-date">{new Date(item.createdAt).toLocaleString()}</p>
                  <p className="history-headline">{item.result?.headline || "Guidance result"}</p>
                  <p className="micro">{item.result?.urgency || "Saved guidance"}</p>
                </div>
              ))}
              {history.length > 3 && (
                <button type="button" className="ghost full" onClick={() => setHistoryExpanded((prev) => !prev)}>
                  {historyExpanded ? t("historyShowLess") : t("historyShowMore")}
                </button>
              )}
            </div>
          )}
          {historyStatus && <p className="micro">{historyStatus}</p>}
        </div>
      </section>

      <section className="grid" id="family">
        <div className="panel">
          <h2>{t("familyTitle")}</h2>
          <form className="form" onSubmit={saveFamilyMember}>
            <div className="form-row">
              <label>
                {t("name")}
                <input type="text" value={memberForm.name} onChange={(e) => setMemberForm((prev) => ({ ...prev, name: e.target.value }))} />
              </label>
              <label>
                {t("relation")}
                <input type="text" value={memberForm.relation} onChange={(e) => setMemberForm((prev) => ({ ...prev, relation: e.target.value }))} />
              </label>
            </div>
            <div className="form-row">
              <label>
                {t("age")}
                <input type="number" value={memberForm.age} onChange={(e) => setMemberForm((prev) => ({ ...prev, age: e.target.value }))} />
              </label>
              <label>
                {t("sex")}
                <select value={memberForm.sex} onChange={(e) => setMemberForm((prev) => ({ ...prev, sex: e.target.value }))}>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
            <label className="block">
              {t("bloodType")}
              <input type="text" value={memberForm.bloodType} onChange={(e) => setMemberForm((prev) => ({ ...prev, bloodType: e.target.value }))} />
            </label>
            <label className="block">
              {t("conditions")}
              <input type="text" value={memberForm.conditions} onChange={(e) => setMemberForm((prev) => ({ ...prev, conditions: e.target.value }))} />
            </label>
            <label className="block">
              {t("allergies")}
              <input type="text" value={memberForm.allergies} onChange={(e) => setMemberForm((prev) => ({ ...prev, allergies: e.target.value }))} />
            </label>
            <button className="primary full" type="submit">{t("addMember")}</button>
            {familyStatus && <p className="micro">{familyStatus}</p>}
          </form>
          <div className="member-list">
            <button type="button" className={activeMemberId === null ? "chip active" : "chip"} onClick={() => setActiveMemberId(null)}>
              Self
            </button>
            {familyMembers.map((member) => (
              <button key={member.id} type="button" className={activeMemberId === member.id ? "chip active" : "chip"} onClick={() => setActiveMemberId(member.id)}>
                {member.name} ({member.relation || "family"})
              </button>
            ))}
          </div>
        </div>
        <div className="panel result">
          <h2 id="records">{t("recordsTitle")}</h2>
          <label className="block">
            {t("uploadRecord")}
            <input ref={recordsInputRef} type="file" accept="image/*,application/pdf" onChange={uploadRecord} />
          </label>
          {recordStatus && <p className="micro">{recordStatus}</p>}
          <div className="history-list">
            {records.map((r) => (
              <div key={r.id} className="history-card">
                <p className="history-headline">{r.file_name}</p>
                <p className="micro">{new Date(r.created_at).toLocaleString()}</p>
                <button type="button" className="remove-link" onClick={() => deleteRecord(r.id)}>
                  {t("removeRecord")}
                </button>
              </div>
            ))}
          </div>
          <div className="action-row">
            <button type="button" className="secondary" onClick={generateEmergencyCard}>
              {t("generateEmergencyCard")}
            </button>
          </div>
          {emergencyCard && (
            <div className="pass-card">
              <p>
                <strong>{t("openEmergencyCard")}:</strong>{" "}
                <a href={emergencyCard.url} target="_blank" rel="noreferrer">
                  {emergencyCard.url}
                </a>
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="panel health-pass">
        <h2>{t("healthPassTitle")}</h2>
        <p className="panel-sub">{t("healthPassBody")}</p>
        <button className="primary" type="button" onClick={generateSharePass}>
          {t("generatePass")}
        </button>
        {sharePassStatus && <p className="micro">{sharePassStatus}</p>}
        {sharePass && (
          <div className="pass-card">
            <p>
              <strong>{t("passCode")}:</strong> {sharePass.code}
            </p>
            <p>
              <strong>{t("passExpires")}:</strong> {new Date(sharePass.expiresAt).toLocaleString()}
            </p>
            <p className="micro">{t("oneTimeCodeNote")}</p>
            <a className="secondary" href={sharePass.doctorUrl} target="_blank" rel="noreferrer">
              {t("passOpenDoctorView")}
            </a>
            {shareQr && (
              <div className="qr-box">
                <img src={shareQr} alt="Health pass QR" />
                <p className="micro">{t("qrReady")}</p>
              </div>
            )}
          </div>
        )}
        <h3>{t("shareHistory")}</h3>
        <div className="history-list">
          {shareHistory.map((h, idx) => (
            <div key={`${h.code}-${idx}`} className="history-card">
              <p className="history-headline">{h.code}</p>
              <p className="micro">Active until {new Date(h.expiresAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid" id="teleconsult">
        <div className="panel">
          <h2>{t("teleTitle")}</h2>
          <p className="panel-sub">{t("teleSubtitle")}</p>
          <form className="form" onSubmit={submitCareRequest}>
            <label className="block">
              {t("careRequestType")}
              <select value={careRequestMode} onChange={(event) => setCareRequestMode(event.target.value)}>
                <option value="in_person">{t("careRequestInPerson")}</option>
                <option value="video">{t("teleModeVideo")}</option>
                <option value="audio">{t("teleModeAudio")}</option>
                <option value="chat">{t("teleModeChat")}</option>
              </select>
            </label>
            {careRequestMode === "in_person" ? (
              <>
                <label className="block">
                  {t("apptDepartment")}
                  <select
                    value={appointmentForm.departmentId}
                    onChange={(event) => setAppointmentForm((prev) => ({ ...prev, departmentId: event.target.value, doctorId: "" }))}
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Doctor
                  <select
                    value={appointmentForm.doctorId}
                    onChange={(event) => setAppointmentForm((prev) => ({ ...prev, doctorId: event.target.value, slotTime: "" }))}
                    disabled={!appointmentForm.departmentId || departmentDoctors.length === 0}
                  >
                    <option value="">
                      {appointmentForm.departmentId
                        ? departmentDoctors.length > 0
                          ? "Select doctor"
                          : "No doctors available"
                        : "Select department first"}
                    </option>
                    {departmentDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name}
                        {doctor.qualification ? ` • ${doctor.qualification}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  {t("apptReason")}
                  <textarea rows={3} value={appointmentForm.reason} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, reason: event.target.value }))} />
                </label>
                <label className="block">
                  Appointment date
                  <input type="date" value={appointmentForm.appointmentDate} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, appointmentDate: event.target.value, slotTime: "" }))} />
                </label>
                <label className="block">
                  Available slot
                  <select
                    value={appointmentForm.slotTime}
                    onChange={(event) => setAppointmentForm((prev) => ({ ...prev, slotTime: event.target.value }))}
                    disabled={!appointmentForm.appointmentDate || availableSlots.length === 0}
                  >
                    <option value="">
                      {appointmentForm.appointmentDate
                        ? availableSlots.length > 0
                          ? "Select slot"
                          : "No slots available"
                        : "Select date first"}
                    </option>
                    {availableSlots.map((slot) => (
                      <option key={slot.dateTime} value={slot.time}>
                        {slot.time}
                      </option>
                    ))}
                  </select>
                </label>
                {slotStatus && <p className="micro">{slotStatus}</p>}
                <button className="primary full" type="submit">{t("apptBook")}</button>
              </>
            ) : (
              <>
                <label className="block">
                  {t("teleSlot")}
                  <input type="datetime-local" value={teleForm.preferredSlot} onChange={(event) => updateTeleField("preferredSlot", event.target.value)} />
                </label>
                <label className="block">
                  {t("telePhone")}
                  <input type="text" value={teleForm.phone} onChange={(event) => updateTeleField("phone", event.target.value)} placeholder="+91..." />
                </label>
                <label className="block">
                  {t("teleConcern")}
                  <textarea rows={4} value={teleForm.concern} onChange={(event) => updateTeleField("concern", event.target.value)} placeholder={t("teleConcernPlaceholder")} />
                </label>
                <button type="submit" className="primary full">{t("teleBook")}</button>
              </>
            )}
          </form>
          {(teleStatus || appointmentsStatus) && <p className="micro">{teleStatus || appointmentsStatus}</p>}
        </div>
        <div className="panel result">
          <h2>{t("careRequestFeedTitle")}</h2>
          {teleLoading ? (
            <p className="micro">{t("teleLoading")}</p>
          ) : teleconsults.length === 0 && appointments.length === 0 ? (
            <p className="micro">{t("teleEmpty")}</p>
          ) : (
            <>
              {appointments.length > 0 && (
                <div className="history-list">
                  {appointments.slice(0, 5).map((appointment) => (
                    <div key={`appt-${appointment.id}`} className="history-card">
                      <p className="history-headline">{t("careRequestInPerson")} • {appointment.status}</p>
                      <p className="micro">
                        {appointment.department_name || appointment.department}
                        {appointment.doctor_name ? ` • Dr. ${appointment.doctor_name}` : ""}
                      </p>
                      <p className="micro">{appointment.reason}</p>
                      <p className="micro">{new Date(appointment.scheduled_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
              {teleconsults.length > 0 && (
                <>
                  <div className="member-list">
                    {teleconsults.map((consult) => (
                      <button key={consult.id} type="button" className={consult.id === activeConsultId ? "chip active" : "chip"} onClick={() => setActiveConsultId(consult.id)}>
                        #{consult.id} • {teleStatusLabel(consult.status)}
                      </button>
                    ))}
                  </div>
                  {activeConsult && (
                    <div className="pass-card consult-card">
                      <p className="history-headline">{teleStatusLabel(activeConsult.status)} • {activeConsult.mode}</p>
                      <p className="micro">{activeConsult.concern}</p>
                      {activeConsult.preferredSlot && (
                        <p className="micro">{t("teleSlot")}: {new Date(activeConsult.preferredSlot).toLocaleString()}</p>
                      )}
                      {activeConsult.meetingUrl && (
                        <a className="secondary" href={activeConsult.meetingUrl} target="_blank" rel="noreferrer">
                          Join consult link
                        </a>
                      )}
                      <div className="consult-thread">
                        {consultMessages.map((msg) => (
                          <div key={msg.id} className={`chat-msg ${msg.senderRole === "doctor" ? "bot" : "user"}`}>
                            <p className="micro">{new Date(msg.createdAt).toLocaleString()}</p>
                            <p>{msg.message}</p>
                          </div>
                        ))}
                      </div>
                      <form className="chat-form" onSubmit={sendConsultMessage}>
                        <input type="text" value={consultMessageText} placeholder={t("teleMessagePlaceholder")} onChange={(event) => setConsultMessageText(event.target.value)} />
                        <button className="primary" type="submit">{t("teleSend")}</button>
                      </form>
                      {consultMessageStatus && <p className="micro">{consultMessageStatus}</p>}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="grid" id="appointments">
        <div className="panel result">
          <h2>{t("encounterTitle")}</h2>
          {encounters.length === 0 ? (
            <p className="micro">{t("encounterEmpty")}</p>
          ) : (
            <>
              <div className="member-list">
                {encounters.map((encounter) => (
                  <button key={encounter.id} type="button" className={encounter.id === activeEncounterId ? "chip active" : "chip"} onClick={() => setActiveEncounterId(encounter.id)}>
                    #{encounter.id} • {encounter.status}
                  </button>
                ))}
              </div>
              {encounterDetail && (
                <div className="pass-card consult-card">
                  <p className="history-headline">{t("encounterDoctor")}: {encounterDetail.encounter.doctor_name || "-"}</p>
                  <p className="micro">
                    {t("encounterDiagnosis")}: {encounterDetail.encounter.diagnosis_text || encounterDetail.encounter.diagnosis_code || "-"}
                  </p>
                  <p className="micro">{t("encounterPlan")}: {encounterDetail.encounter.plan_text || "-"}</p>
                  <p className="micro">
                    {t("encounterVitals")}: {encounterDetail.encounter.vitals?.summary || JSON.stringify(encounterDetail.encounter.vitals || {})}
                  </p>
                  <h4>{t("encounterNotes")}</h4>
                  <div className="history-list">
                    {(encounterDetail.notes || []).map((note) => (
                      <div key={note.id} className="history-card">
                        <p className="micro">{new Date(note.created_at).toLocaleString()}</p>
                        <p>{note.note_text}</p>
                        <p className="micro">{note.signature_text}</p>
                      </div>
                    ))}
                  </div>
                  <h4>{t("encounterPrescription")}</h4>
                  <div className="history-list">
                    {(encounterDetail.prescriptions || []).map((rx) => (
                      <div key={rx.id} className="history-card">
                        <p className="micro">{new Date(rx.created_at).toLocaleString()}</p>
                        <p>{rx.instructions || "-"}</p>
                        <ul>
                          {(rx.items || []).map((item) => (
                            <li key={item.id}>
                              {item.medicine} {item.dose ? `| ${item.dose}` : ""} {item.frequency ? `| ${item.frequency}` : ""} {item.duration ? `| ${item.duration}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <h4>{t("encounterOrders")}</h4>
                  <div className="history-list">
                    {(encounterDetail.orders || []).map((order) => (
                      <div key={order.id} className="history-card">
                        <p className="history-headline">{order.order_type} • {order.status}</p>
                        <p className="micro">
                          {order.item_name} {order.destination ? `• ${order.destination}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {encounterStatus && <p className="micro">{encounterStatus}</p>}
        </div>
        <div className="panel result">
          <h2>Labs & Pharmacy</h2>
          <p className="panel-sub">Open dedicated tabs to compare nearby options by price, speed, and visit mode.</p>
          <div className="action-row">
            <a className="secondary" href="/labs" target="_blank" rel="noreferrer">
              Open labs
            </a>
            <a className="secondary" href="/pharmacy" target="_blank" rel="noreferrer">
              Open pharmacy
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
